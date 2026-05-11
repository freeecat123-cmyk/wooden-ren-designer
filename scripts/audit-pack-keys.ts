/**
 * Audit lib/knowledge/style-detail-packs.ts for dead keys.
 *
 * For each (style, category, key) triple in STYLE_DETAIL_PACKS, check if `key`
 * exists in the corresponding template's optionSchema. Print any orphan key
 * groups so they can be cleaned up.
 *
 * Run: pnpm tsx scripts/audit-pack-keys.ts
 */
import { STYLE_DETAIL_PACKS } from "../lib/knowledge/style-detail-packs";
import { FURNITURE_CATALOG } from "../lib/templates";
import type { FurnitureCategory } from "../lib/types";

function templateOptionKeys(category: FurnitureCategory): Set<string> {
  const entry = FURNITURE_CATALOG.find((e) => e.category === category);
  if (!entry?.optionSchema) return new Set();
  return new Set(entry.optionSchema.map((o) => o.key));
}

let total = 0;
let dead = 0;
const deadByCategory = new Map<string, Set<string>>();

for (const [style, byCategory] of Object.entries(STYLE_DETAIL_PACKS)) {
  for (const [category, options] of Object.entries(byCategory)) {
    const validKeys = templateOptionKeys(category as FurnitureCategory);
    for (const key of Object.keys(options)) {
      total++;
      if (!validKeys.has(key)) {
        dead++;
        if (!deadByCategory.has(category)) deadByCategory.set(category, new Set());
        deadByCategory.get(category)!.add(key);
      }
    }
  }
}

console.log(`\n📊 STYLE_DETAIL_PACKS key audit`);
console.log(`   total key occurrences: ${total}`);
console.log(`   dead key occurrences: ${dead}`);
console.log(`   unique dead keys: ${[...deadByCategory.values()].reduce((a, b) => a + b.size, 0)}\n`);

if (dead === 0) {
  console.log(`✅ no dead keys.`);
  process.exit(0);
}

console.log(`❌ dead keys by category (preset key not in template optionSchema):\n`);
for (const [category, keys] of [...deadByCategory.entries()].sort()) {
  console.log(`  ${category}:`);
  for (const key of [...keys].sort()) {
    console.log(`    - ${key}`);
  }
}
console.log(`\nRun: pnpm tsx scripts/clean-pack-keys.ts to auto-remove them.\n`);
process.exit(1);
