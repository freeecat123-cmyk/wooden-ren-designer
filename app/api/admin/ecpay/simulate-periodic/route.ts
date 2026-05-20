/**
 * POST /api/admin/ecpay/simulate-periodic
 *   admin 模擬綠界 PeriodReturnURL「第 N 期月扣」回呼,測試 /api/ecpay/periodic-notify。
 *
 *   body: {
 *     subscription_id: string  // 必填,要模擬扣款的訂閱
 *     success?: boolean        // 預設 true。false = 模擬扣款失敗(RtnCode=10100073)
 *     times?: number           // TotalSuccessTimes,預設用 sub 既有 +1
 *   }
 *
 *   流程:
 *   1. admin auth
 *   2. 撈 subscription → 取 ecpay_merchant_trade_no + expected_amount
 *   3. 組綠界 PeriodReturnURL 會回的 form 欄位 + 算正確 CheckMacValue
 *   4. POST 到自己的 /api/ecpay/periodic-notify (用 SITE_URL)
 *   5. 回傳該 endpoint 的回應 + 對應 DB 變化前後 snapshot
 *
 *   注意:
 *   - 訂閱 status=cancelled 會被 endpoint skip(這是 production 邏輯,測試用來驗 cancel 流程)
 *   - 每次模擬用唯一假 TradeNo,避免 UNIQUE 防 replay 擋住
 *   - 真實環境不會被綠界拿到任何資訊,純內部呼叫
 */
import { NextResponse } from "next/server";
import {
  createClient as createServerSupabase,
  createAdminClient,
} from "@/lib/supabase/server";
import { getServerAdminEmails, isAdminEmail } from "@/lib/admin";
import { calculateCheckMacValue } from "@/lib/ecpay/check-mac-value";
import {
  ECPAY_HASH_IV,
  ECPAY_HASH_KEY,
  ECPAY_MERCHANT_ID,
} from "@/lib/ecpay/config";

export const runtime = "nodejs";

function nowEcpayDate(): string {
  // yyyy/MM/dd HH:mm:ss in TW time
  const d = new Date(Date.now() + 8 * 3_600_000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}/${pad(d.getUTCMonth() + 1)}/${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

export async function POST(req: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email, getServerAdminEmails())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { subscription_id?: string; success?: boolean; times?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!body.subscription_id) {
    return NextResponse.json({ error: "missing_subscription_id" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: sub, error: subErr } = await admin
    .from("subscriptions")
    .select(
      "id, user_id, plan, period, status, expected_amount, expires_at, ecpay_merchant_trade_no, ecpay_periodic_no",
    )
    .eq("id", body.subscription_id)
    .single();

  if (subErr || !sub) {
    return NextResponse.json(
      { error: "subscription_not_found", detail: subErr?.message },
      { status: 404 },
    );
  }
  if (!sub.ecpay_merchant_trade_no) {
    return NextResponse.json(
      { error: "subscription_has_no_merchant_trade_no" },
      { status: 400 },
    );
  }
  if (sub.period !== "monthly") {
    return NextResponse.json(
      {
        error: "not_monthly_period",
        period: sub.period,
        hint: "只有 monthly 訂閱才有第 2 期以後扣款",
      },
      { status: 400 },
    );
  }

  // 算「這應該是第幾期」— 既有成功 payment 數 + 1
  const { count: prevSuccessCount } = await admin
    .from("payments")
    .select("id", { count: "exact", head: true })
    .eq("subscription_id", sub.id)
    .eq("status", "success");
  const times = body.times ?? (prevSuccessCount ?? 0) + 1;

  // 組綠界 PeriodReturnURL 會送的欄位
  const success = body.success !== false;
  const amount = sub.expected_amount ?? 0;
  const fakeTradeNo = `SIM${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const params: Record<string, string> = {
    MerchantID: ECPAY_MERCHANT_ID,
    MerchantTradeNo: sub.ecpay_merchant_trade_no,
    RtnCode: success ? "1" : "10100073",
    RtnMsg: success ? "Succeeded" : "Insufficient Funds (模擬)",
    TradeNo: fakeTradeNo,
    amount: String(amount),
    TradeAmt: String(amount),
    PeriodType: "M",
    Frequency: "1",
    ExecTimes: "99",
    TotalSuccessTimes: String(times),
    process_date: nowEcpayDate(),
    PaymentDate: nowEcpayDate(),
    gwsr: sub.ecpay_periodic_no ?? fakeTradeNo,
  };
  params.CheckMacValue = calculateCheckMacValue(params, ECPAY_HASH_KEY, ECPAY_HASH_IV);

  // snapshot before
  const before = {
    sub_status: sub.status,
    sub_expires_at: sub.expires_at,
    sub_replaced_subscription_id: null as string | null,
  };

  // POST 到自己的 webhook
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://designer.woodenren.com";
  const target = `${siteUrl}/api/ecpay/periodic-notify`;
  let webhookResp: { status: number; body: string };
  try {
    const formBody = new URLSearchParams(params).toString();
    const res = await fetch(target, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formBody,
    });
    webhookResp = { status: res.status, body: await res.text() };
  } catch (e) {
    return NextResponse.json(
      { error: "webhook_call_failed", detail: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }

  // snapshot after
  const { data: subAfter } = await admin
    .from("subscriptions")
    .select("status, expires_at")
    .eq("id", sub.id)
    .single();
  const { data: newestPayment } = await admin
    .from("payments")
    .select("id, status, amount, ecpay_trade_no, invoice_status, created_at, raw_response")
    .eq("subscription_id", sub.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // 標記剛產生的這筆是模擬付款,讓 UI / quick refund 可以辨識
  if (newestPayment && (newestPayment.ecpay_trade_no as string | null)?.startsWith("SIM")) {
    const existingRaw =
      (newestPayment.raw_response as Record<string, unknown> | null) ?? {};
    await admin
      .from("payments")
      .update({
        raw_response: { ...existingRaw, _note: "sim_periodic", _sim_at: new Date().toISOString() },
      })
      .eq("id", newestPayment.id);
  }

  return NextResponse.json({
    ok: true,
    target,
    simulated_params: { ...params, CheckMacValue: "(redacted)" },
    webhook_response: webhookResp,
    before,
    after: {
      sub_status: subAfter?.status,
      sub_expires_at: subAfter?.expires_at,
    },
    newest_payment: newestPayment,
  });
}
