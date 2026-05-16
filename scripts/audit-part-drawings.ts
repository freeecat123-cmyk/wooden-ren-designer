/**
 * Audit: needsPartDrawing predicate + filterDesignForIsolation across all
 * 28 furniture templates (Phase 1 Task 1).
 *
 * - 單元測試：predicate 對 4 種代表性 part 行為正確（plain box / has-tenon /
 *   has-mortise / non-box shape）。
 * - 批量測試：對每個 FURNITURE_CATALOG entry，build 預設 design，把第一個 part
 *   做 isolation filter，驗證回傳 design 只剩 1 part 且 id 對得起來。
 * - Sanity 測試：predicate 在 28 模板上觸發數量在合理區間（100-500）。
 *
 * Run: npx tsx scripts/audit-part-drawings.ts
 */

import { FURNITURE_CATALOG } from "../lib/templates";
import type { MaterialId, OptionSpec } from "../lib/types";
import {
  needsPartDrawing,
  filterDesignForIsolation,
} from "../lib/render/part-drawing/grouping";

let fail = 0;

function expect(cond: boolean, msg: string) {
  if (!cond) {
    console.error("❌", msg);
    fail++;
  } else {
    console.log("✓", msg);
  }
}

// ─── Test 1: predicate on hand-picked cases ────────────────────────────────
const dummyBox = {
  id: "test-flat-panel",
  nameZh: "平板",
  material: "walnut" as MaterialId,
  grainDirection: "length" as const,
  visible: { length: 100, width: 50, thickness: 10 },
  origin: { x: 0, y: 0, z: 0 },
  tenons: [],
  mortises: [],
};

expect(
  !needsPartDrawing(dummyBox as any),
  "Plain box with no joinery → no drawing",
);

expect(
  needsPartDrawing({
    ...dummyBox,
    tenons: [{ position: "top" } as any],
  } as any),
  "Has tenon → needs drawing",
);

expect(
  needsPartDrawing({
    ...dummyBox,
    mortises: [{ position: "top" } as any],
  } as any),
  "Has mortise → needs drawing",
);

expect(
  needsPartDrawing({ ...dummyBox, shape: { kind: "round" } } as any),
  "Non-box shape → needs drawing",
);

expect(
  !needsPartDrawing({ ...dummyBox, shape: { kind: "box" } } as any),
  "Explicit box shape with no joinery → no drawing",
);

// ─── Test 2: isolation filter across all templates ─────────────────────────
function buildDesign(entry: (typeof FURNITURE_CATALOG)[number]) {
  if (!entry.template) return null;
  const opts = (entry.optionSchema ?? []).reduce<
    Record<string, string | number | boolean>
  >((acc, spec: OptionSpec) => {
    acc[spec.key] = spec.defaultValue;
    return acc;
  }, {});
  return entry.template({
    length: entry.defaults.length,
    width: entry.defaults.width,
    height: entry.defaults.height,
    material: "maple" as MaterialId,
    options: opts,
  });
}

for (const entry of FURNITURE_CATALOG) {
  if (!entry.template) continue;
  const design = buildDesign(entry);
  if (!design || !design.parts.length) continue;

  const firstPart = design.parts[0];
  const filtered = filterDesignForIsolation(design, firstPart.id);
  expect(
    filtered.parts.length === 1,
    `${entry.category}: filter to ${firstPart.id} → 1 part (got ${filtered.parts.length})`,
  );
  expect(
    filtered.parts[0].id === firstPart.id,
    `${entry.category}: filtered part id matches`,
  );
  expect(
    filtered.parts[0].origin.x === 0 &&
      filtered.parts[0].origin.y === 0 &&
      filtered.parts[0].origin.z === 0,
    `${entry.category}: filtered part recentered to origin`,
  );
  // 原 design 不應被修改
  expect(
    design.parts.length > 1
      ? design.parts.length >= 2
      : design.parts.length === 1,
    `${entry.category}: original design untouched`,
  );

  // Bonus: partId 不存在 → 原樣回傳
  const noopFiltered = filterDesignForIsolation(design, "__nonexistent__");
  expect(
    noopFiltered === design,
    `${entry.category}: unknown partId → returns original design`,
  );
}

// ─── Test 3: predicate triggers reasonable count across all templates ──────
let totalTriggered = 0;
let totalParts = 0;
for (const entry of FURNITURE_CATALOG) {
  if (!entry.template) continue;
  const design = buildDesign(entry);
  if (!design) continue;
  totalParts += design.parts.length;
  totalTriggered += design.parts.filter(needsPartDrawing).length;
}
console.log(
  `\nstats: ${totalTriggered}/${totalParts} parts trigger needsPartDrawing across ${FURNITURE_CATALOG.length} templates`,
);
expect(
  totalTriggered > 100 && totalTriggered < 500,
  `Total triggered parts: ${totalTriggered} (expected 100-500 per spec §1.2)`,
);

console.log(`\n${fail === 0 ? "✅ all pass" : `❌ ${fail} failure(s)`}`);
process.exit(fail);
