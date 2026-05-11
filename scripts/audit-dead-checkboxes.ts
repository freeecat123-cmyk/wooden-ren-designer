/**
 * Audit checkbox options that only affect the `notes` string but never produce
 * a corresponding 3D part or modify any geometry. These were dubbed "dead
 * options" in the 2026-05-11 cabinet sweep — same audit extended to all 28
 * furniture templates.
 *
 * Heuristic: parse each template file, find every checkbox key, then count its
 * usages OUTSIDE the spec line + notes interpolation. If non-trivial usage
 * count is 0, flag as suspect.
 *
 * Run: pnpm tsx scripts/audit-dead-checkboxes.ts
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = join(__dirname, "..", "lib/templates");

const files = readdirSync(TEMPLATES_DIR)
  .filter((f) => f.endsWith(".ts") && !f.startsWith("_") && f !== "index.ts");

interface Suspect {
  file: string;
  key: string;
  label: string;
  rawUsages: number;
}

const suspects: Suspect[] = [];

for (const f of files) {
  const path = join(TEMPLATES_DIR, f);
  const src = readFileSync(path, "utf8");
  // Match { ... type: "checkbox", key: "xxx", label: "..." ... }
  const checkboxRe = /\{[^}]*?type:\s*"checkbox",\s*key:\s*"([^"]+)",\s*label:\s*"([^"]+)"[^}]*\}/g;
  let m: RegExpExecArray | null;
  while ((m = checkboxRe.exec(src)) !== null) {
    const key = m[1];
    const label = m[2];
    // Count every occurrence of the bare identifier (word-boundary).
    const re = new RegExp(`\\b${key}\\b`, "g");
    const total = (src.match(re) ?? []).length;
    // Subtract 2 for: spec line key, notes-interpolation expression.
    // 4+ usages typically means: spec + const + if-block + notes
    // 2-3 usages means: spec + const + notes (NO if-block = notes-only)
    if (total <= 3) {
      suspects.push({ file: f, key, label, rawUsages: total });
    }
  }
}

console.log(`\n🔎 dead checkbox audit (28 templates)`);
console.log(`   suspect checkboxes (≤ 3 occurrences = likely notes-only): ${suspects.length}\n`);

if (suspects.length === 0) {
  console.log(`✅ no suspects.`);
  process.exit(0);
}

for (const s of suspects) {
  console.log(`  ${s.file} :: ${s.key}（${s.label}）— ${s.rawUsages} mentions`);
}
console.log(`\n手動 review：${suspects.length} 個可疑 checkbox 可能只改 notes 沒實際畫東西。`);
console.log(`砍掉前先 grep \`<key>\` 確認沒 if-block / 沒 push part / 沒改 design.parts。\n`);
process.exit(1);
