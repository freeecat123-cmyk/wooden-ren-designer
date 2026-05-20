// 檢查 production Supabase 哪些 2026-05-18/19 migration 已套用
// 用法: node --env-file=.env.local scripts/check-migrations-applied.mjs
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const checks = [
  ["refund_requests table",            sb.from("refund_requests").select("id").limit(1)],
  ["admin_actions table",              sb.from("admin_actions").select("id").limit(1)],
  ["ai_usage_log table",               sb.from("ai_usage_log").select("id").limit(1)],
  ["payments.invoice_error",           sb.from("payments").select("invoice_error").limit(1)],
  ["payments.status=refunded",         sb.from("payments").select("id").eq("status", "refunded").limit(1)],
  ["payments.invoice_number",          sb.from("payments").select("invoice_number").limit(1)],
  ["subscriptions.period",             sb.from("subscriptions").select("period").limit(1)],
  ["subscriptions.replaced_by",        sb.from("subscriptions").select("replaced_by").limit(1)],
  ["subscriptions.expected_amount",    sb.from("subscriptions").select("expected_amount").limit(1)],
  ["users.last_expiry_reminder_sent_at", sb.from("users").select("last_expiry_reminder_sent_at").limit(1)],
  ["users.welcome_email_sent_at",      sb.from("users").select("welcome_email_sent_at").limit(1)],
  ["users.invoice_preference",         sb.from("users").select("invoice_preference").limit(1)],
];

for (const [name, q] of checks) {
  const { error } = await q;
  console.log(error ? `❌ ${name} — ${error.message}` : `✓ ${name}`);
}
