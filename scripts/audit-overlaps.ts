/**
 * Audit zero-tolerance part overlaps for every furniture template.
 *
 * 跑每個 FURNITURE_CATALOG 條目（使用 defaults + 預設 options），對組裝版（無
 * 榫，這是預設模式）做 AABB overlap 偵測，輸出 markdown 表。
 *
 * Run: npx tsx scripts/audit-overlaps.ts [--joinery]
 *      --joinery 旗標：用榫接版（保留 tenons/mortises）跑 audit
 */
import { FURNITURE_CATALOG } from "../lib/templates";
import { toBeginnerMode } from "../lib/templates/beginner-mode";
import { findOverlaps } from "../lib/geometry/overlap";
import type { FurnitureDesign, MaterialId } from "../lib/types";

const useJoinery = process.argv.includes("--joinery");

interface Row {
  category: string;
  nameZh: string;
  partsCount: number;
  overlapCount: number;
  flag: string;
  examples: string[];
}

const rows: Row[] = [];

for (const entry of FURNITURE_CATALOG) {
  if (!entry.template) continue;
  const opts = (entry.optionSchema ?? []).reduce<Record<string, string | number | boolean>>(
    (acc, spec) => {
      acc[spec.key] = spec.defaultValue;
      return acc;
    },
    {},
  );
  const raw: FurnitureDesign = entry.template({
    length: entry.defaults.length,
    width: entry.defaults.width,
    height: entry.defaults.height,
    material: "maple" as MaterialId,
    options: opts,
  });
  const design = useJoinery ? raw : toBeginnerMode(raw);
  const overlaps = findOverlaps(design.parts);
  const examples = overlaps
    .slice(0, 3)
    .map(
      (o) =>
        `${o.a} × ${o.b} (${o.intersectionMm.x}×${o.intersectionMm.y}×${o.intersectionMm.z})`,
    );
  rows.push({
    category: entry.category,
    nameZh: entry.nameZh,
    partsCount: design.parts.length,
    overlapCount: overlaps.length,
    flag: design.useButtJointConvention ? "✓" : "  ",
    examples,
  });
}

rows.sort((a, b) => b.overlapCount - a.overlapCount);

console.log(
  `\n# Overlap Audit (${useJoinery ? "joinery" : "assembly/beginner"} mode)\n`,
);
console.log(`Total templates: ${rows.length}`);
console.log(
  `Templates with overlaps: ${rows.filter((r) => r.overlapCount > 0).length}`,
);
console.log(
  `Templates clean: ${rows.filter((r) => r.overlapCount === 0).length}`,
);
console.log("");
console.log(
  "| butt-joint? | category | name | parts | overlaps | examples (≤3) |",
);
console.log("|---|---|---|---|---|---|");
for (const r of rows) {
  const exCol = r.examples.length > 0 ? r.examples.join("<br>") : "—";
  console.log(
    `| ${r.flag} | \`${r.category}\` | ${r.nameZh} | ${r.partsCount} | **${r.overlapCount}** | ${exCol} |`,
  );
}
console.log("");
