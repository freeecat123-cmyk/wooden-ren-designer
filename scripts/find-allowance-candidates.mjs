// 找適合測 Allowance 折讓的 payment:
// - status=success(還沒退過)
// - invoice_status=issued(發票還在)
// - invoice_issued_at > 24h ago
// - 屬於 wengruirui304 測試帳號(避免影響真實用戶)
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
const { data: u } = await sb
  .from("users")
  .select("id")
  .eq("email", "wengruirui304@gmail.com")
  .single();

const { data: candidates } = await sb
  .from("payments")
  .select("id, amount, ecpay_trade_no, invoice_number, invoice_issued_at, status, invoice_status, subscription_id")
  .eq("user_id", u.id)
  .eq("status", "success")
  .eq("invoice_status", "issued")
  .lt("invoice_issued_at", cutoff)
  .order("invoice_issued_at", { ascending: true });

console.log(`找到 ${candidates?.length ?? 0} 筆 wengruirui304 > 24h 可測折讓的:`);
for (const p of candidates ?? []) {
  const ageHours = (Date.now() - new Date(p.invoice_issued_at).getTime()) / 3_600_000;
  console.log(` - ${p.id} | NT$${p.amount} | TradeNo ${p.ecpay_trade_no} | inv ${p.invoice_number} | ${ageHours.toFixed(1)}h ago`);
}

if (!candidates?.length) {
  // 也看一下其他帳號(只列出來,不會選)
  const { data: others } = await sb
    .from("payments")
    .select("id, user_id, amount, ecpay_trade_no, invoice_number, invoice_issued_at")
    .eq("status", "success")
    .eq("invoice_status", "issued")
    .lt("invoice_issued_at", cutoff)
    .order("invoice_issued_at", { ascending: true })
    .limit(5);
  console.log(`\n其他帳號的 candidates (慎用):`);
  for (const p of others ?? []) {
    const ageHours = (Date.now() - new Date(p.invoice_issued_at).getTime()) / 3_600_000;
    console.log(` - ${p.id} user=${p.user_id.slice(0, 8)} NT$${p.amount} inv ${p.invoice_number} ${ageHours.toFixed(1)}h`);
  }
}
