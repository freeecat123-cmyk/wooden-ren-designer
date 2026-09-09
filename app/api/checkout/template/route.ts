/**
 * POST /api/checkout/template
 *   表單欄位: category (FurnitureCategory)
 *
 * 流程:
 *   1. 驗證登入
 *   2. 確認 category 是付費範本 + user 還沒解鎖過
 *   3. 用 getUnlockPrice(category) 拿單範本買斷價（依難度三階）
 *   4. 建 template_unlocks placeholder（先不寫,改用 payments raw_response 暫存）
 *   5. 組綠界 AioCheckOut 一次性付款參數
 *   6. 回 auto-submit HTML,瀏覽器 POST 到綠界
 *
 * webhook /api/ecpay/return 收到 RtnCode=1 後,依 raw_response.kind === "template_unlock"
 * 自動 insert template_unlocks。
 */
import { NextResponse, type NextRequest } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import {
  buildAioParams,
  buildAutoSubmitHtml,
  generateOrderId,
  getAioUrl,
} from "@/lib/ecpay/create-order";
import { assertEcpayConfigured } from "@/lib/ecpay/config";
import {
  getUnlockPrice,
  getDifficulty,
  DIFFICULTY_LABEL_ZH,
  getCatalogEntry,
  getBundleFor,
  getUnlockCategories,
} from "@/lib/pricing/template-unlock";
import { isPaidCategory } from "@/lib/permissions";
import { isDevCategory } from "@/lib/templates";
import { getServerAdminEmails, isAdminEmail } from "@/lib/admin";
import type { FurnitureCategory } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    assertEcpayConfigured();
  } catch (e) {
    console.error("[checkout/template] ECPay 未設定", e);
    // 避免用戶看到 raw JSON。導回 /pricing 帶 error banner。
    const fallback = new URL(`/pricing?error=payment_not_configured`, req.url);
    return NextResponse.redirect(fallback, 303);
  }

  const form = await req.formData();
  const category = String(form.get("category") ?? "");
  if (!category) {
    return NextResponse.json({ error: "category-required" }, { status: 400 });
  }

  const entry = getCatalogEntry(category);
  if (!entry) {
    return NextResponse.json({ error: "category-not-found" }, { status: 400 });
  }
  /**
   * ⛔ 開發中／暫不上架的範本不准開單。
   *
   * 🩸 2026-09-09：木頭仁說乙級「先不要上架」，DEV_CATEGORIES 加了 cert-b1/cert-b2，
   *    /templates、/app、sitemap、定價頁、介紹頁七個 UI 入口都擋乾淨了，
   *    **但這支 API 從來沒問過 isDevCategory** → 登入後手打一個 POST 帶 category=cert-b2
   *    就能對「先不要上架」的半成品開出真的綠界付款單（實測 cert-b1 290、cert-b2 299）。
   *    UI 擋得再乾淨也蓋不到直接打 API 這條路；擋在這裡才是根因。
   *
   * 套組也一起檢查：混了開發中成員的套組不能拿已上架的那支當幌子整組解鎖。
   */
  if (getUnlockCategories(category).some(isDevCategory)) {
    return NextResponse.json(
      { error: "template-not-released", message: "這個範本還沒上架，暫時無法購買" },
      { status: 400 },
    );
  }

  if (!isPaidCategory(category as FurnitureCategory)) {
    return NextResponse.json({ error: "free-template-no-purchase" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    const loginUrl = new URL(`/login?next=/pricing?unlock=${category}`, req.url);
    return NextResponse.redirect(loginUrl, 303);
  }

  // Admin override 已把 UI 顯示成 lifetime + 全模板開放,實際付款也沒意義 → 直接擋
  if (isAdminEmail(user.email, getServerAdminEmails())) {
    return NextResponse.json(
      { error: "admin_no_purchase", message: "管理員帳號已享有全部功能,無需購買" },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  // 已解鎖過 → 不要重複收錢（套組：任一支已解鎖就算買過）
  const bundle = getBundleFor(category);
  const unlockCategories = getUnlockCategories(category);
  const { data: existingRows, error: existingErr } = await admin
    .from("template_unlocks")
    .select("id")
    .eq("user_id", user.id)
    .in("category", unlockCategories)
    .limit(1);
  const existing = existingRows?.[0] ?? null;
  /**
   * ⛔ 原本只解構 data、把 error 丟掉。supabase-js 查詢失敗不會 throw,
   *    而是回 `{ data: null, error }` → existing 變成 null → 判定「還沒買過」
   *    → **對已經買過的人再收一次錢**。
   * 「查不到」跟「沒有」是兩件事:查詢壞掉時要讓結帳失敗,不是放行。
   */
  if (existingErr) {
    console.error("[checkout/template] 查既有解鎖失敗,拒絕開單(不能當成沒買過)", {
      userId: user.id,
      category,
      error: existingErr.message,
    });
    return NextResponse.json(
      { error: "unavailable", message: "系統忙碌中,請稍後再試一次(不會重複扣款)。" },
      { status: 503 },
    );
  }
  if (existing) {
    return NextResponse.json(
      { error: "already_unlocked", message: "你已經買過這個範本了" },
      { status: 400 },
    );
  }

  const amount = getUnlockPrice(category);
  if (!amount) {
    return NextResponse.json({ error: "template-price-not-found" }, { status: 400 });
  }

  const difficulty = getDifficulty(category);
  const orderId = generateOrderId();
  const itemName = bundle
    ? `${bundle.nameZh} 永久買斷`
    : `${entry.nameZh}（${DIFFICULTY_LABEL_ZH[difficulty]}）永久買斷`;

  // 把 category + amount 寫進 pending payments,webhook 看 raw_response.kind 分流
  await admin.from("payments").insert({
    user_id: user.id,
    amount,
    status: "pending",
    raw_response: {
      kind: "template_unlock",
      orderId,
      category,
      // 套組：回呼時每一支各寫一列 template_unlocks
      categories: unlockCategories,
      bundleId: bundle?.id ?? null,
      amount,
      itemName,
    } as Record<string, unknown>,
  });

  const params = buildAioParams({
    orderId,
    amount,
    itemName,
    description: bundle ? `${bundle.nameZh} 工程圖永久使用` : `${entry.nameZh} 工程圖永久使用`,
    email: user.email ?? undefined,
  });
  const html = buildAutoSubmitHtml(getAioUrl(), params);
  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
