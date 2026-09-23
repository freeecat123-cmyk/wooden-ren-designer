// 清掉超過 1 小時還是 pending 的 payment(webhook 沒回的孤兒,測試殘骸)
// 用法: node --use-system-ca --env-file=.env.local scripts/cleanup-pending-payments.mjs
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const cutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();
const { data: pendings, error } = await sb
  .from("payments")
  .select("id, amount, created_at, user_id")
  .eq("status", "pending")
  .lt("created_at", cutoff);

if (error) {
  console.error("查詢失敗:", error);
  process.exit(1);
}

console.log(`找到 ${pendings?.length ?? 0} 筆 pending > 1h 的 payment`);
for (const p of pendings ?? []) {
  console.log(` - ${p.created_at.slice(0, 19)} NT$${p.amount} ${p.id}`);
}

if (!pendings?.length) {
  console.log("沒東西要清。");
  process.exit(0);
}

const ids = pendings.map((p) => p.id);
const { error: delErr } = await sb.from("payments").delete().in("id", ids);
if (delErr) {
  console.error("刪除失敗:", delErr);
  process.exit(1);
}
console.log(`✓ 刪掉 ${ids.length} 筆`);
