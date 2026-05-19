/**
 * POST /api/checkout
 *   表單欄位: plan (personal|pro|student_personal|student_pro)
 *            period (monthly|yearly)
 *
 * 流程:
 *   1. 確認登入；未登入 303 導到首頁帶 login=required
 *   2. student_* 方案：檢查使用者是 student 或在 whitelist
 *   3. 建立 subscription(row, status=expired 當 pending placeholder)
 *      ＋ ecpay_merchant_trade_no = 我們產的 orderId
 *   4. 組綠界 AioCheckOut 參數 + CheckMacValue
 *   5. 回 auto-submit HTML，瀏覽器 POST 到綠界
 */
import { NextResponse, type NextRequest } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import {
  PLAN_NAME_ZH,
  PLAN_PRICES,
  getBasePlan,
  getPlanPrice,
  isStudentOnly,
  type BillingPeriod,
  type CheckoutPlan,
} from "@/lib/pricing/plans";
import {
  buildAioParams,
  buildAutoSubmitHtml,
  buildPeriodicParams,
  generateOrderId,
  getAioUrl,
} from "@/lib/ecpay/create-order";
import { assertEcpayConfigured } from "@/lib/ecpay/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isValidPlan(p: string): p is CheckoutPlan {
  return p in PLAN_PRICES;
}
function isValidPeriod(p: string): p is BillingPeriod {
  return p === "monthly" || p === "yearly";
}

export async function POST(req: NextRequest) {
  try {
    assertEcpayConfigured();
  } catch (e) {
    console.error("[checkout] ECPay 未設定", e);
    return NextResponse.json(
      { error: "payment_not_configured" },
      { status: 500 },
    );
  }

  const form = await req.formData();
  const plan = String(form.get("plan") ?? "");
  const period = String(form.get("period") ?? "monthly");

  if (!isValidPlan(plan) || !isValidPeriod(period)) {
    return NextResponse.json({ error: "invalid_plan_or_period" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    const loginUrl = new URL("/?login=required", req.url);
    return NextResponse.redirect(loginUrl, 303);
  }

  const admin = createAdminClient();

  // 學員方案資格驗證
  if (isStudentOnly(plan)) {
    const [{ data: u }, { data: w }] = await Promise.all([
      admin.from("users").select("plan").eq("id", user.id).single(),
      user.email
        ? admin.from("whitelist").select("id").eq("email", user.email).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    if (u?.plan !== "student" && !w) {
      return NextResponse.json({ error: "student_only" }, { status: 403 });
    }
  }

  const amount = getPlanPrice(plan, period);
  const basePlan = getBasePlan(plan);
  const periodLabel = period === "yearly" ? "年付" : "月付";
  const orderId = generateOrderId();
  const itemName = `木頭仁 木作藍圖${PLAN_NAME_ZH[plan]}(${periodLabel})`;

  // 預先插入 subscription row 當 placeholder；status=expired，付款成功 webhook 改 active。
  // expected_amount = 預期收款金額（跨 student tier 都正確），webhook 用這個比對防 tampering。
  const { error: subErr } = await admin.from("subscriptions").insert({
    user_id: user.id,
    plan: basePlan,
    status: "expired",
    started_at: new Date().toISOString(),
    expires_at: null,
    ecpay_merchant_trade_no: orderId,
    expected_amount: amount,
    period,
  });
  if (subErr) {
    console.error("[checkout] insert subscription failed", subErr);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  // 紀錄 pending payment（webhook 收到 RtnCode=1 後再寫 success 那筆）
  await admin.from("payments").insert({
    user_id: user.id,
    amount,
    status: "pending",
    raw_response: {
      kind: "checkout_initiated",
      orderId,
      plan,
      period,
      itemName,
    } as Record<string, unknown>,
  });

  // 月付走信用卡定期定額（每月自動扣）；年付走一次性付款
  const orderInput = {
    orderId,
    amount,
    itemName,
    description: `${PLAN_NAME_ZH[plan]} ${periodLabel}訂閱`,
    email: user.email ?? undefined,
  };
  const params =
    period === "monthly"
      ? buildPeriodicParams({ ...orderInput, periodAmount: amount })
      : buildAioParams(orderInput);
  const html = buildAutoSubmitHtml(getAioUrl(), params);
  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
