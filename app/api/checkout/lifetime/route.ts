/**
 * POST /api/checkout/lifetime
 *   終身買斷（限量，個人版等級）— 走既有綠界一次性付款，沒有新增任何金流。
 *
 * 跟 /api/checkout/tool 同一個模式：
 *   - 先在 payments 開一筆 pending，raw_response.kind = "lifetime_buyout"
 *   - 綠界 ReturnURL（/api/ecpay/return）收到付款成功後，把 users.plan 設成 lifetime_personal
 *
 * 擋下的情況（都導回 /pricing?lifetime_notice=...，不會開單、不會收錢）：
 *   - 還沒登入                     → 先去登入
 *   - 管理員                       → admin
 *   - 已是終身會員                 → owned
 *   - 已有訂閱／學員方案           → has_plan（不動既有用戶的權限與扣款）
 *   - 名額已滿                     → soldout
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
import { getServerAdminEmails, isAdminEmail } from "@/lib/admin";
import { getEffectivePlan, type UserPlanProfile } from "@/lib/permissions";
import {
  LIFETIME_ITEM_NAME,
  LIFETIME_PAYMENT_KIND,
  LIFETIME_PRICE,
  getLifetimeStatus,
  lifetimeEligibility,
} from "@/lib/pricing/lifetime";
import { countLifetimeTaken } from "@/lib/pricing/lifetime-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    assertEcpayConfigured();
  } catch {
    return NextResponse.redirect(new URL(`/pricing?error=payment_not_configured`, req.url), 303);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    const next = encodeURIComponent(`/pricing#lifetime`);
    return NextResponse.redirect(new URL(`/login?next=${next}`, req.url), 303);
  }

  if (isAdminEmail(user.email, getServerAdminEmails())) {
    return NextResponse.redirect(new URL(`/pricing?lifetime_notice=admin`, req.url), 303);
  }

  const admin = createAdminClient();

  // 查現在的方案。⛔ 查詢失敗不能當「免費版」放行（會讓已有訂閱的人又買一次終身 → 雙扣）。
  const { data: profile, error: profileErr } = await admin
    .from("users")
    .select("plan, subscription_status, subscription_expires_at, student_activated_at, student_expires_at")
    .eq("id", user.id)
    .single();
  if (profileErr || !profile) {
    console.error("[checkout/lifetime] 查使用者方案失敗,拒絕開單", {
      userId: user.id,
      error: profileErr?.message,
    });
    return NextResponse.json(
      { error: "unavailable", message: "系統忙碌中,請稍後再試一次(不會重複扣款)。" },
      { status: 503 },
    );
  }
  const eligibility = lifetimeEligibility(getEffectivePlan(profile as UserPlanProfile));
  if (!eligibility.ok) {
    return NextResponse.redirect(new URL(`/pricing?lifetime_notice=${eligibility.reason}`, req.url), 303);
  }

  // 名額。⛔ 讀失敗要擋，不能當 0（會把已額滿的方案又開賣）。
  let taken: number;
  try {
    taken = await countLifetimeTaken(admin);
  } catch (e) {
    console.error("[checkout/lifetime] 算名額失敗,拒絕開單", e);
    return NextResponse.json(
      { error: "unavailable", message: "系統忙碌中,請稍後再試一次(不會重複扣款)。" },
      { status: 503 },
    );
  }
  if (!getLifetimeStatus(taken).available) {
    return NextResponse.redirect(new URL(`/pricing?lifetime_notice=soldout`, req.url), 303);
  }

  const orderId = generateOrderId();
  const { error: insertErr } = await admin.from("payments").insert({
    user_id: user.id,
    amount: LIFETIME_PRICE,
    status: "pending",
    raw_response: {
      kind: LIFETIME_PAYMENT_KIND,
      orderId,
      amount: LIFETIME_PRICE,
      itemName: LIFETIME_ITEM_NAME,
      plan: "lifetime_personal",
    } as Record<string, unknown>,
  });
  if (insertErr) {
    // 開單失敗就不能把客人丟去綠界付錢，否則回傳時找不到訂單 = 錢收了沒出貨
    console.error("[checkout/lifetime] payments 開單失敗", insertErr);
    return NextResponse.json(
      { error: "unavailable", message: "系統忙碌中,請稍後再試一次(不會重複扣款)。" },
      { status: 503 },
    );
  }

  const params = buildAioParams({
    orderId,
    amount: LIFETIME_PRICE,
    itemName: LIFETIME_ITEM_NAME,
    description: "木作藍圖 終身買斷（限量，個人版功能永久使用）",
    email: user.email ?? undefined,
  });
  return new Response(buildAutoSubmitHtml(getAioUrl(), params), {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
