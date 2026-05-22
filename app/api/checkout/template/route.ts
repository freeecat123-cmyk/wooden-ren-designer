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
import { getUnlockPrice, getDifficulty, DIFFICULTY_LABEL_ZH } from "@/lib/pricing/template-unlock";
import { getCatalogEntry } from "@/lib/pricing/template-unlock";
import { isPaidCategory } from "@/lib/permissions";
import type { FurnitureCategory } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    assertEcpayConfigured();
  } catch (e) {
    console.error("[checkout/template] ECPay 未設定", e);
    return NextResponse.json({ error: "payment_not_configured" }, { status: 500 });
  }

  const form = await req.formData();
  const category = String(form.get("category") ?? "");
  if (!category) {
    return NextResponse.json({ error: "category 必填" }, { status: 400 });
  }

  const entry = getCatalogEntry(category);
  if (!entry) {
    return NextResponse.json({ error: "category 不存在" }, { status: 400 });
  }
  if (!isPaidCategory(category as FurnitureCategory)) {
    return NextResponse.json({ error: "免費範本不需要購買" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    const loginUrl = new URL(`/login?next=/pricing?unlock=${category}`, req.url);
    return NextResponse.redirect(loginUrl, 303);
  }

  const admin = createAdminClient();

  // 已解鎖過 → 不要重複收錢
  const { data: existing } = await admin
    .from("template_unlocks")
    .select("id")
    .eq("user_id", user.id)
    .eq("category", category)
    .maybeSingle();
  if (existing) {
    return NextResponse.json(
      { error: "already_unlocked", message: "你已經買過這個範本了" },
      { status: 400 },
    );
  }

  const amount = getUnlockPrice(category);
  if (!amount) {
    return NextResponse.json({ error: "找不到此範本的買斷價" }, { status: 400 });
  }

  const difficulty = getDifficulty(category);
  const orderId = generateOrderId();
  const itemName = `${entry.nameZh}（${DIFFICULTY_LABEL_ZH[difficulty]}）永久買斷`;

  // 把 category + amount 寫進 pending payments,webhook 看 raw_response.kind 分流
  await admin.from("payments").insert({
    user_id: user.id,
    amount,
    status: "pending",
    raw_response: {
      kind: "template_unlock",
      orderId,
      category,
      amount,
      itemName,
    } as Record<string, unknown>,
  });

  const params = buildAioParams({
    orderId,
    amount,
    itemName,
    description: `${entry.nameZh} 工程圖永久使用`,
    email: user.email ?? undefined,
  });
  const html = buildAutoSubmitHtml(getAioUrl(), params);
  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
