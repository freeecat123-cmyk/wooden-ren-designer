/**
 * POST /api/admin/ecpay/query-periodic
 *   admin 直接查綠界 QueryCreditCardPeriodInfo,看 raw 回應到底長怎樣。
 *   診斷對帳 cron 為什麼沒抓到 drift 用。
 *
 *   body: { merchant_trade_no: string }
 */
import { NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { getServerAdminEmails, isAdminEmail } from "@/lib/admin";
import { queryPeriodicStatus } from "@/lib/ecpay/refund";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email, getServerAdminEmails())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { merchant_trade_no?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!body.merchant_trade_no) {
    return NextResponse.json(
      { error: "missing_merchant_trade_no" },
      { status: 400 },
    );
  }

  const result = await queryPeriodicStatus(body.merchant_trade_no);
  return NextResponse.json({
    ok: result.ok,
    parsed_status: result.status,
    raw_response: result.raw,
    total_success_times: result.totalSuccessTimes,
    total_amount: result.totalAmount,
    error: result.error,
  });
}
