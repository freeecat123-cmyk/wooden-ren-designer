// 找 expires_at 超過合理範圍的訂閱(可能被 simulate-periodic 污染)
// monthly 應該 = started_at + 31 天 × (1 + 實際 success payment 數);
// 超過明顯多 = 被假扣污染
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const { data: subs } = await sb
  .from("subscriptions")
  .select("id, plan, period, status, started_at, expires_at, user_id")
  .eq("period", "monthly")
  .not("expires_at", "is", null);

const suspects = [];
for (const s of subs ?? []) {
  if (!s.started_at || !s.expires_at) continue;
  const startMs = new Date(s.started_at).getTime();
  const expMs = new Date(s.expires_at).getTime();
  const days = Math.round((expMs - startMs) / 86_400_000);

  // 撈該 sub 的 success payment 數量
  const { count } = await sb
    .from("payments")
    .select("id", { count: "exact", head: true })
    .eq("subscription_id", s.id)
    .eq("status", "success");

  const expectedDays = 31 * (count ?? 1);
  const overflow = days - expectedDays;
  if (overflow >= 31) {
    suspects.push({ ...s, days, payments: count, expectedDays, overflow });
  }
}

console.log(`找到 ${suspects.length} 筆 expires_at 超量 >= 31 天的 sub:`);
for (const s of suspects) {
  console.log(
    ` - ${s.id} ${s.plan}/${s.status} user=${s.user_id.slice(0, 8)} ` +
    `started=${s.started_at.slice(0, 10)} expires=${s.expires_at.slice(0, 10)} ` +
    `days=${s.days} payments=${s.payments} expected=${s.expectedDays} overflow=+${s.overflow}d`
  );
}
