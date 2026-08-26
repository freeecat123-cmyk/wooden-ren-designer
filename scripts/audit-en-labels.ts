/**
 * 稽核:新選項不可以「只有中文」。
 *
 * 🩸 英文站漏翻**不會壞畫面** —— `specLabel()` / `choiceLabel()` 找不到英文就
 *    直接 fallback 回中文,所以看起來一切正常,只是外國使用者看到中文。
 *    正因為不會壞,漏了沒人知道。AGENTS.md §5 把它列為「最易漏」的一步,
 *    但沒有任何機制在擋 —— 2026-08-25 的 `ctLowerCove`、8/26 的 `apronSetback`
 *    就這樣連著兩天漏掉,是我自己回頭掃才發現的。
 *
 * 存量太大（474 個選項裡有 87 個沒英文標籤）,一次補完不實際 ⇒ **基線比對**:
 * 只要「沒英文的清單」不比基線多就過。新加的選項一定會被抓到。
 *
 * 補完某一批之後跑 `--update` 把基線收緊（只能變少,不能變多）。
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { FURNITURE_CATALOG } from "../lib/templates";
import { SPEC_LABEL_EN, SPEC_HELP_EN, CHOICE_LABEL_EN } from "../lib/templates/spec-labels";

const BASE = path.join(__dirname, "__baselines__", "en-labels.json");

const specs = new Map<string, any>();
for (const e of FURNITURE_CATALOG as any[])
  for (const s of (e.optionSchema ?? []) as any[]) if (!specs.has(s.key)) specs.set(s.key, s);

const missing = {
  label: [...specs.keys()].filter((k) => !SPEC_LABEL_EN[k]).sort(),
  help: [...specs.values()].filter((s) => s.help && !SPEC_HELP_EN[s.key]).map((s) => s.key).sort(),
  choice: [] as string[],
};
for (const [k, s] of specs)
  if (s.type === "select")
    for (const c of s.choices ?? [])
      if (!CHOICE_LABEL_EN[`${k}:${c.value}`]) missing.choice.push(`${k}:${c.value}`);
missing.choice.sort();

if (process.argv.includes("--update")) {
  fs.writeFileSync(BASE, JSON.stringify(missing, null, 2) + "\n");
  console.log(`✅ 基線已更新（標籤 ${missing.label.length} / 說明 ${missing.help.length} / 選項值 ${missing.choice.length}）`);
  process.exit(0);
}

if (!fs.existsSync(BASE)) {
  console.log("⛔ 找不到基線,先跑 `npx tsx scripts/audit-en-labels.ts --update`");
  process.exit(1);
}
const baseline = JSON.parse(fs.readFileSync(BASE, "utf-8")) as typeof missing;
const kinds: Array<[keyof typeof missing, string]> = [
  ["label", "英文標籤 SPEC_LABEL_EN"],
  ["help", "英文說明 SPEC_HELP_EN"],
  ["choice", "英文選項值 CHOICE_LABEL_EN"],
];
let bad = 0;
for (const [k, name] of kinds) {
  const now = new Set(missing[k]);
  const was = new Set(baseline[k] ?? []);
  const added = [...now].filter((x) => !was.has(x));
  const fixed = [...was].filter((x) => !now.has(x));
  console.log(`${name.padEnd(28)} 沒英文 ${String(missing[k].length).padStart(3)}（基線 ${String((baseline[k] ?? []).length).padStart(3)}）` +
    (fixed.length ? `  ✅ 補了 ${fixed.length} 個` : "") + (added.length ? `  ❌ 新漏 ${added.length} 個` : ""));
  added.forEach((x) => { bad++; console.log(`     ❌ ${x}`); });
}
if (bad) {
  console.log("\n⛔ 有新選項沒補英文。英文站會 fallback 回中文,畫面不會壞 —— 所以只有這支會抓到。");
  console.log("   補在 lib/templates/spec-labels.ts;工序文字補在 lib/steps/translations.ts。");
  process.exit(1);
}
console.log("\n✅ 沒有比基線更多的漏翻。");
