/**
 * audit-i18n-parity — messages/en.json 與 messages/zh-TW.json 的鍵值對等稽核。
 *
 * 守三件事（全部基線 0，不是「比昨天少就好」）：
 *   1. 兩邊的 key 必須一模一樣。少一邊 → next-intl 在正式站噴 MISSING_MESSAGE，
 *      英文客人會看到原始 key（例 `templateUnlock.bundleNote`）或整塊空白。
 *   2. en.json 的值不可以含中日韓漢字 —— 那代表翻譯漏做，英文站會夾雜中文。
 *   3. 同一個 key 兩邊的 ICU 變數（{count} 之類）必須一致，
 *      否則切語系時會丟 IntlError: MISSING_VALUE。
 *
 * 刻意只擋「漢字」不擋其他非 ASCII：en.json 本來就有 ✓ → ✕ 等符號與重音字母。
 *
 * 用法：npx tsx scripts/audit-i18n-parity.ts
 */
import fs from "node:fs";
import path from "node:path";

type Json = string | number | boolean | null | Json[] | { [k: string]: Json };

const ROOT = process.cwd();
const EN = path.join(ROOT, "messages/en.json");
const ZH = path.join(ROOT, "messages/zh-TW.json");

const HAN = /[㐀-䶿一-鿿]/;
const ICU_VAR = /\{\s*([A-Za-z0-9_]+)\s*[,}]/g;

function flatten(node: Json, prefix = "", out = new Map<string, string>()): Map<string, string> {
  if (node !== null && typeof node === "object" && !Array.isArray(node)) {
    for (const [k, v] of Object.entries(node)) {
      flatten(v, prefix ? `${prefix}.${k}` : k, out);
    }
  } else {
    out.set(prefix, typeof node === "string" ? node : JSON.stringify(node));
  }
  return out;
}

function icuVars(s: string): string[] {
  const seen = new Set<string>();
  for (const m of s.matchAll(ICU_VAR)) seen.add(m[1]);
  return [...seen].sort();
}

const en = flatten(JSON.parse(fs.readFileSync(EN, "utf8")) as Json);
const zh = flatten(JSON.parse(fs.readFileSync(ZH, "utf8")) as Json);

const problems: string[] = [];

for (const k of zh.keys()) if (!en.has(k)) problems.push(`en 缺 key：${k}（zh = ${JSON.stringify(zh.get(k)).slice(0, 80)}）`);
for (const k of en.keys()) if (!zh.has(k)) problems.push(`zh-TW 缺 key：${k}`);

for (const [k, v] of en) {
  if (HAN.test(v)) problems.push(`en 的值仍是中文：${k} = ${JSON.stringify(v).slice(0, 80)}`);
}

for (const [k, v] of en) {
  const z = zh.get(k);
  if (z === undefined) continue;
  const a = icuVars(v).join(",");
  const b = icuVars(z).join(",");
  if (a !== b) problems.push(`ICU 變數不一致：${k}  en={${a}} vs zh={${b}}`);
}

console.log(`== i18n 鍵值對等稽核 ==  en ${en.size} 鍵 / zh-TW ${zh.size} 鍵`);
if (problems.length === 0) {
  console.log("✅ 0 問題（key 對齊、en 無殘留中文、ICU 變數一致）");
  process.exit(0);
}
for (const p of problems) console.log(`  ❌ ${p}`);
console.log(`\n共 ${problems.length} 個問題`);
process.exit(1);
