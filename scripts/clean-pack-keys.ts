/**
 * Mass-clean lib/knowledge/style-detail-packs.ts: drop preset entries that
 * reference option keys not present in the template's current optionSchema,
 * and drop entire `square-stool` blocks (the category was renamed to `stool`).
 *
 * Dead preset keys have no runtime effect (resolveOptions ignores them) — this
 * is purely cosmetic cleanup to keep the packs file truthful.
 *
 * Run: pnpm tsx scripts/clean-pack-keys.ts
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { STYLE_DETAIL_PACKS } from "../lib/knowledge/style-detail-packs";
import { FURNITURE_CATALOG } from "../lib/templates";
import type { FurnitureCategory } from "../lib/types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = join(__dirname, "..", "lib/knowledge/style-detail-packs.ts");

const validCats = new Set(FURNITURE_CATALOG.map((e) => e.category));

function templateOptionKeys(category: FurnitureCategory): Set<string> {
  const entry = FURNITURE_CATALOG.find((e) => e.category === category);
  if (!entry?.optionSchema) return new Set();
  return new Set(entry.optionSchema.map((o) => o.key));
}

let droppedCats = 0;
let droppedKeys = 0;
const cleaned: typeof STYLE_DETAIL_PACKS = {};

for (const [style, byCat] of Object.entries(STYLE_DETAIL_PACKS)) {
  cleaned[style] = {};
  for (const [category, options] of Object.entries(byCat)) {
    if (!validCats.has(category as FurnitureCategory)) {
      droppedCats++;
      continue;
    }
    const validKeys = templateOptionKeys(category as FurnitureCategory);
    const filtered: Record<string, string | number | boolean> = {};
    for (const [key, val] of Object.entries(options)) {
      if (validKeys.has(key)) {
        filtered[key] = val;
      } else {
        droppedKeys++;
      }
    }
    if (Object.keys(filtered).length > 0) {
      cleaned[style][category] = filtered;
    }
  }
}

// Re-serialize as TS literal with consistent formatting matching the original style.
function serialize(packs: typeof STYLE_DETAIL_PACKS): string {
  const lines: string[] = [];
  lines.push("/**");
  lines.push(" * 風格 × 模板 細部設定包（detail packs）—— 自動產生 + 手動審改 hybrid。");
  lines.push(" * 詳見 AGENTS.md「家具設計器：加新家具種類的 SOP」。");
  lines.push(" */");
  lines.push("");
  lines.push("export const STYLE_DETAIL_PACKS: Record<string, Record<string, Record<string, string | number | boolean>>> = {");
  const styleEntries = Object.entries(packs);
  styleEntries.forEach(([style, byCat], si) => {
    lines.push(`  "${style}": {`);
    const catEntries = Object.entries(byCat);
    catEntries.forEach(([cat, opts], ci) => {
      lines.push(`    "${cat}": {`);
      const optEntries = Object.entries(opts);
      optEntries.forEach(([k, v], oi) => {
        const lit = typeof v === "string" ? `"${v}"` : String(v);
        lines.push(`      "${k}": ${lit}${oi === optEntries.length - 1 ? "" : ","}`);
      });
      lines.push(`    }${ci === catEntries.length - 1 ? "" : ","}`);
    });
    lines.push(`  }${si === styleEntries.length - 1 ? "" : ","}`);
  });
  lines.push("};");
  lines.push("");
  return lines.join("\n");
}

writeFileSync(OUT_PATH, serialize(cleaned), "utf8");

console.log(`\n🧹 style-detail-packs cleanup`);
console.log(`   dropped categories: ${droppedCats} (square-stool 等不存在)`);
console.log(`   dropped key entries: ${droppedKeys}`);
console.log(`   output: lib/knowledge/style-detail-packs.ts (re-serialized)\n`);
