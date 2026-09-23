import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const { data: u } = await sb
  .from("users")
  .select("id, email, plan, subscription_status, subscription_expires_at")
  .eq("email", "wengruirui304@gmail.com")
  .single();

console.log("USER:", u);

const { data: payments } = await sb
  .from("payments")
  .select("id, ecpay_trade_no, amount, status, invoice_status, invoice_number, created_at, raw_response, subscription_id")
  .eq("user_id", u.id)
  .order("created_at", { ascending: false });

console.log(`\nPAYMENTS (${payments?.length}):`);
for (const p of payments ?? []) {
  const note = (p.raw_response && typeof p.raw_response === "object")
    ? (p.raw_response)._note ?? ""
    : "";
  console.log(` - ${p.created_at.slice(0, 19)} | ${p.ecpay_trade_no} | NT$${p.amount} | status=${p.status} | inv=${p.invoice_status ?? "-"} ${note ? `[${note}]` : ""}`);
}

const { data: refunds } = await sb
  .from("refund_requests")
  .select("id, payment_id, status, amount_requested, reason, admin_note, created_at, reviewed_at")
  .eq("user_id", u.id)
  .order("created_at", { ascending: false });

console.log(`\nREFUND_REQUESTS (${refunds?.length}):`);
for (const r of refunds ?? []) {
  console.log(` - ${r.created_at.slice(0, 19)} | status=${r.status} | NT$${r.amount_requested} | payment=${r.payment_id} | note: ${r.admin_note ?? "-"}`);
}

const { data: subs } = await sb
  .from("subscriptions")
  .select("id, plan, period, status, ecpay_merchant_trade_no, started_at, expires_at")
  .eq("user_id", u.id)
  .order("started_at", { ascending: false });

console.log(`\nSUBSCRIPTIONS (${subs?.length}):`);
for (const s of subs ?? []) {
  console.log(` - ${s.started_at?.slice(0, 19)} | ${s.plan}/${s.period} | ${s.status} | ${s.ecpay_merchant_trade_no} → exp ${s.expires_at?.slice(0, 10) ?? "-"}`);
}
