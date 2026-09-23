import { createClient } from "@supabase/supabase-js";
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);
const checks = [
  ["payments.allowance_number", () => sb.from("payments").select("allowance_number").limit(1)],
  ["payments.allowance_issued_at", () => sb.from("payments").select("allowance_issued_at").limit(1)],
  ["payments.allowance_amount", () => sb.from("payments").select("allowance_amount").limit(1)],
  ["invoice_status=allowanced", () => sb.from("payments").select("id").eq("invoice_status", "allowanced").limit(1)],
];
for (const [name, run] of checks) {
  const { error } = await run();
  console.log(`${error ? "✗" : "✓"} ${name}${error ? " — " + error.message : ""}`);
}
