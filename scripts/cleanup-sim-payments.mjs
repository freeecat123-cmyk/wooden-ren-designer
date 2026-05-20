// 清掉 simulate-periodic 產的 SIM* 測試 payment + 對應 refund_request
// 用法: node --env-file=.env.local scripts/cleanup-sim-payments.mjs
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const { data: sims, error: e1 } = await sb
  .from("payments")
  .select("id, ecpay_trade_no, amount, status, created_at, user_id")
  .ilike("ecpay_trade_no", "SIM%");

if (e1) {
  console.error("查 SIM payments 失敗:", e1);
  process.exit(1);
}

console.log(`找到 ${sims?.length ?? 0} 筆 SIM* payment:`);
for (const p of sims ?? []) {
  console.log(` - ${p.ecpay_trade_no} (${p.status}) NT$${p.amount} ${p.created_at}`);
}

if (!sims?.length) {
  console.log("沒東西要清。");
  process.exit(0);
}

const ids = sims.map((p) => p.id);

const { data: refs, error: e2 } = await sb
  .from("refund_requests")
  .select("id, payment_id, status")
  .in("payment_id", ids);

if (e2) {
  console.error("查 refund_requests 失敗:", e2);
  process.exit(1);
}

console.log(`  對應 refund_requests: ${refs?.length ?? 0} 筆`);

if (refs?.length) {
  const { error: e3 } = await sb
    .from("refund_requests")
    .delete()
    .in("payment_id", ids);
  if (e3) {
    console.error("刪 refund_requests 失敗:", e3);
    process.exit(1);
  }
  console.log(`✓ 刪掉 ${refs.length} 筆 refund_requests`);
}

const { error: e4 } = await sb.from("payments").delete().in("id", ids);
if (e4) {
  console.error("刪 payments 失敗:", e4);
  process.exit(1);
}
console.log(`✓ 刪掉 ${ids.length} 筆 SIM* payments`);
console.log("完成。");
