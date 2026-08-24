/**
 * 每一張 public schema 的資料表都必須開 RLS。
 *
 * ⛔ 為什麼這是硬規定：Supabase 會把 public schema 的表透過 PostgREST 對外開放，
 *    而 anon key 是**印在瀏覽器 bundle 裡的公開值**（NEXT_PUBLIC_SUPABASE_ANON_KEY）。
 *    沒開 RLS 的表 = 任何人拿那把金鑰就讀得到整張表，而且不會有任何錯誤訊息。
 *
 * 2026-08-24 資料隔離稽核發現：`email_queue`（存客戶信箱與信件全文）在正式站
 * 有 RLS、但 migrations 裡從來沒寫 —— 是有人在 Supabase 後台手動開的。
 * 只要哪天從 migrations 重建資料庫（新環境／災難復原／staging），
 * 那張表就會變成全世界可讀。這支就是防止那種「線上跟版本控制對不起來」。
 *
 * ⚠️ 這支只驗 migrations（靜態）。要驗**正式站實際狀態**，用 --live
 *    （拿 .env.local 的 anon key 對每張表送一個必定失敗的寫入，看錯誤碼是不是
 *      42501 row-level security；失敗的寫入不會留下任何資料）。
 */
import * as fs from "fs";
import * as path from "path";

const ROOT = path.resolve(__dirname, "..");
const SQL_FILES = [
  path.join(ROOT, "supabase/schema.sql"),
  ...fs.readdirSync(path.join(ROOT, "supabase/migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => path.join(ROOT, "supabase/migrations", f)),
].filter((f) => fs.existsSync(f));

const sql = SQL_FILES.map((f) => fs.readFileSync(f, "utf8")).join("\n");
const low = sql.toLowerCase();

const tables = [...new Set([...low.matchAll(/create table (?:if not exists )?(?:public\.)?"?(\w+)"?/g)].map((m) => m[1]))].sort();
const rls = new Set([...low.matchAll(/alter table (?:public\.)?"?(\w+)"?\s+enable row level security/g)].map((m) => m[1]));

/** 不走 PostgREST、也不含使用者資料的內部表 */
const EXEMPT = new Set(["migration"]);

const missing = tables.filter((t) => !rls.has(t) && !EXEMPT.has(t));

// 政策一律要比對身分，不能 using(true) / with check(true) / 開給 anon
const badPolicies: string[] = [];
for (const m of sql.matchAll(/create policy\s+"?([^"\n]+?)"?\s+on\s+(?:public\.)?"?(\w+)"?(.*?);/gis)) {
  const [, name, tbl, bodyRaw] = m;
  const body = bodyRaw.replace(/\s+/g, " ").toLowerCase();
  const flags: string[] = [];
  if (/using\s*\(\s*true\s*\)/.test(body)) flags.push("USING(true) 全放行");
  if (/with check\s*\(\s*true\s*\)/.test(body)) flags.push("WITH CHECK(true) 誰都能寫");
  if (/\bto\s+(public|anon)\b/.test(body)) flags.push("開放給 anon/public");
  if (!body.includes("auth.uid()") && !body.includes("auth.jwt()") && !body.includes("service_role")) {
    flags.push("沒有比對 auth.uid()");
  }
  if (flags.length) badPolicies.push(`[${tbl}] ${name} → ${flags.join("、")}`);
}

console.log(`資料表 ${tables.length} 張 / 有 enable RLS 的 ${rls.size} 張 / 政策 ${[...sql.matchAll(/create policy/gi)].length} 條`);

let bad = false;
if (missing.length) {
  bad = true;
  console.log(`\n⛔ ${missing.length} 張表在 migrations 裡沒有 enable row level security：`);
  for (const t of missing) console.log(`   ${t}`);
  console.log("   → 這些表會被 anon key（公開值）直接讀走。補一支 migration。");
}
if (badPolicies.length) {
  bad = true;
  console.log(`\n⛔ ${badPolicies.length} 條政策太寬：`);
  for (const p of badPolicies) console.log(`   ${p}`);
}
if (bad) process.exit(1);
console.log("✅ 每張表都開了 RLS，每條政策都比對身分。");

/**
 * --live：拿 .env.local 的 anon key 對正式站每張表送一個**必定失敗**的寫入，
 *          看錯誤碼是不是 42501（row-level security）。失敗的寫入不會留下資料。
 *
 * ⚠️ 為什麼不用「讀取回 0 筆」當判準：RLS 擋住跟「表本來就是空的」看起來一樣。
 *    寫入被 RLS 擋才是明確訊號。（2026-08-24 實測時就先踩到這個陷阱。）
 */
async function liveCheck() {
  if (!process.argv.includes("--live")) return;
  const env = fs.existsSync(path.join(ROOT, ".env.local"))
    ? fs.readFileSync(path.join(ROOT, ".env.local"), "utf8")
    : "";
  const pick = (k: string) => env.match(new RegExp(`^${k}=(.*)$`, "m"))?.[1]?.trim().replace(/^"|"$/g, "");
  const url = pick("NEXT_PUBLIC_SUPABASE_URL");
  const key = pick("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (!url || !key) {
    console.log("\n⚠️ 找不到 .env.local 的 NEXT_PUBLIC_SUPABASE_URL / ANON_KEY，跳過 --live。");
  } else {
    console.log("\n── 正式站實測（用公開 anon key，只送必定失敗的寫入）──");
    const leaks: string[] = [];
    for (const t of tables) {
      if (EXEMPT.has(t)) continue;
      const res = await fetch(`${url}/rest/v1/${t}`, {
        method: "POST",
        headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: "{}",
      });
      const txt = await res.text();
      const blocked = txt.includes("row-level security") || txt.includes("42501");
      const absent = /does not exist|PGRST205|Not Found/i.test(txt);
      if (!blocked && !absent) leaks.push(`${t} → ${txt.slice(0, 90)}`);
    }
    if (leaks.length) {
      console.log(`⛔ ${leaks.length} 張表用公開金鑰寫得進去：`);
      for (const l of leaks) console.log(`   ${l}`);
      process.exit(1);
    }
    console.log("✅ 正式站每張表都被 RLS 擋住。");
  }
}

liveCheck().catch((e) => {
  console.error("⚠️ --live 實測失敗（不影響靜態檢查的結果）：", e?.message ?? e);
  process.exit(1);
});
