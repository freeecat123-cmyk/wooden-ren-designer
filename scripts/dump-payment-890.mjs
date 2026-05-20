import { createClient } from "@supabase/supabase-js";
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);
const { data: p } = await sb
  .from("payments")
  .select("*")
  .eq("ecpay_trade_no", "2605201013284759")
  .single();
console.log("===  payment full row  ===");
console.log(JSON.stringify(p, null, 2));

const { data: s } = await sb
  .from("subscriptions")
  .select("*")
  .eq("ecpay_merchant_trade_no", "WRMPDFGT1EFVHR")
  .single();
console.log("\n=== subscription full row ===");
console.log(JSON.stringify(s, null, 2));
