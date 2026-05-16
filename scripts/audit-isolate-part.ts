/**
 * Audit: OrthoView isolatePartId + showDimensions props (Phase 1 Task 3).
 *
 * - 既有三視圖（無 isolatePartId）renders full design
 * - isolatePartId 啟用時 filter 到單 part、recenter → 顯著縮小 SVG
 * - showDimensions=false → 標註層消失、SVG 更小
 *
 * Run: npx tsx scripts/audit-isolate-part.ts
 */
import { FURNITURE_CATALOG } from "../lib/templates";
import type { MaterialId, OptionSpec } from "../lib/types";
import { needsPartDrawing } from "../lib/render/part-drawing/grouping";
import React from "react";
import { renderToString } from "react-dom/server";
import { OrthoView } from "../lib/render/svg-views";

let fail = 0;
function expect(c: boolean, m: string) {
  if (c) console.log("✓", m);
  else {
    console.error("❌", m);
    fail++;
  }
}

// Build round-stool with defaults (same pattern as audit-part-drawings.ts)
const stool = FURNITURE_CATALOG.find((e) => e.category === "round-stool");
if (!stool || !stool.template) {
  console.error("round-stool not found in catalog");
  process.exit(2);
}
const opts = (stool.optionSchema ?? []).reduce<
  Record<string, string | number | boolean>
>((acc, spec: OptionSpec) => {
  acc[spec.key] = spec.defaultValue;
  return acc;
}, {});
const design = stool.template({
  length: stool.defaults.length,
  width: stool.defaults.width,
  height: stool.defaults.height,
  material: "walnut" as MaterialId,
  options: opts,
});

// Hold title constant so any size diff comes from prop logic, not text content
const baseProps = { design, view: "front", title: "正視", titleEn: "FRONT" };

// Render full design
const fullSvg = renderToString(
  React.createElement(OrthoView, baseProps as any),
);

// Find a triggered part
const candidate = design.parts.find(needsPartDrawing);
if (!candidate) {
  console.error("no triggered part in round-stool — unexpected");
  process.exit(2);
}

// Render with isolatePartId
const isoSvg = renderToString(
  React.createElement(OrthoView, {
    ...baseProps,
    isolatePartId: candidate.id,
  } as any),
);

// Isolation should drop ~3 of 4 legs etc → significantly smaller SVG
// Threshold 200 chars: a single removed `<polygon ...>` is ~150 chars
expect(
  fullSvg.length > isoSvg.length + 200,
  `Full SVG (${fullSvg.length}) substantially > isolated SVG (${isoSvg.length})`,
);
expect(fullSvg.length > 1000, `Full SVG has content (${fullSvg.length} chars)`);
expect(isoSvg.length > 500, `Isolated SVG has content (${isoSvg.length} chars)`);

// showDimensions=false should hide dimension overlays
const noDimSvg = renderToString(
  React.createElement(OrthoView, {
    ...baseProps,
    showDimensions: false,
  } as any),
);
// Each `<DimensionLine>` is ~200 chars; round-stool front has ≥3 dim lines
expect(
  noDimSvg.length + 200 < fullSvg.length,
  `showDimensions=false → smaller SVG (${noDimSvg.length} < ${fullSvg.length})`,
);

console.log(`\n${fail === 0 ? "✅ all pass" : `❌ ${fail} failure(s)`}`);
process.exit(fail);
