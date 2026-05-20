// 木頭仁手動在綠界後台退了 NT$890,DB 同步:
// 1. payment.status = refunded
// 2. subscription.status = expired (原本 cancelled,改 expired 更準確 — 退款不是取消)
// 3. user.plan = free, subscription_status = expired, expires_at = null
// 然後請 admin 到 /admin/ecpay 按那筆 payment 的「補作廢」(24h 內可作廢發票)
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const PAYMENT_ID = "57476c6f-e487-4ab6-ba4b-0ce7a98b3a91";
const USER_ID = "cd96df54-4d47-4d38-8701-a35e16492fa4";
const SUB_ID = "665eb82b-35b6-4329-a6d4-6d9926bc3248";

// 1. payment
const { error: e1 } = await sb
  .from("payments")
  .update({ status: "refunded" })
  .eq("id", PAYMENT_ID);
if (e1) {
  console.error("更新 payment 失敗:", e1);
  process.exit(1);
}
console.log("✓ payment.status = refunded");

// 2. subscription
const { error: e2 } = await sb
  .from("subscriptions")
  .update({ status: "expired", expires_at: null })
  .eq("id", SUB_ID);
if (e2) {
  console.error("更新 subscription 失敗:", e2);
  process.exit(1);
}
console.log("✓ subscription.status = expired, expires_at = null");

// 3. user
const { error: e3 } = await sb
  .from("users")
  .update({
    plan: "free",
    subscription_status: "expired",
    subscription_expires_at: null,
  })
  .eq("id", USER_ID);
if (e3) {
  console.error("更新 user 失敗:", e3);
  process.exit(1);
}
console.log("✓ user.plan = free");

// 也插一筆 refund_request 紀錄留底
const { data: existingRr } = await sb
  .from("refund_requests")
  .select("id")
  .eq("payment_id", PAYMENT_ID)
  .maybeSingle();

if (existingRr) {
  const { error: e4 } = await sb
    .from("refund_requests")
    .update({
      status: "refunded",
      admin_note: "綠界後台手動退款 (DoAction 500 bug),DB 補同步",
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", existingRr.id);
  if (e4) console.error("更新 refund_request 失敗:", e4);
  else console.log("✓ 既有 refund_request 改 refunded");
} else {
  const { error: e4 } = await sb.from("refund_requests").insert({
    user_id: USER_ID,
    payment_id: PAYMENT_ID,
    amount_requested: 890,
    reason: "手動退費 (NT$890,綠界 DoAction 回 500 無法 API 退,後台處理)",
    status: "refunded",
    admin_note: "綠界後台手動退款,DB 補同步",
    reviewed_at: new Date().toISOString(),
  });
  if (e4) console.error("新增 refund_request 失敗:", e4);
  else console.log("✓ 補了 refund_request 紀錄");
}

console.log("\n下一步: 到 /admin/ecpay 找這筆 payment,InvoiceCell 會顯示「⚠ 已開立未作廢 [補作廢]」按一下作廢發票 BN01301206 (24h 內)");
