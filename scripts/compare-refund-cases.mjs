// 比對「成功退款的 NT$390」vs「失敗的 NT$890」raw_response 差異
import { createClient } from "@supabase/supabase-js";
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

// 找今天 refunded 的 (應該 NT$390)
const { data: refunded } = await sb
  .from("payments")
  .select("ecpay_trade_no, amount, raw_response, ecpay_payment_date, created_at")
  .eq("status", "refunded")
  .gte("created_at", "2026-05-20")
  .order("created_at", { ascending: false });

console.log("=== refunded today ===");
for (const r of refunded ?? []) {
  console.log(`TradeNo: ${r.ecpay_trade_no}, MTNo: ${r.raw_response?.MerchantTradeNo}, amt: ${r.amount}, paid: ${r.ecpay_payment_date}`);
  console.log("  raw:", JSON.stringify(r.raw_response));
}

// 找失敗的
const { data: failed } = await sb
  .from("payments")
  .select("ecpay_trade_no, amount, raw_response, ecpay_payment_date")
  .eq("ecpay_trade_no", "2605201013284759")
  .single();

console.log("\n=== failed to refund (NT$890) ===");
console.log(`TradeNo: ${failed.ecpay_trade_no}, MTNo: ${failed.raw_response?.MerchantTradeNo}`);
console.log("  raw:", JSON.stringify(failed.raw_response));
