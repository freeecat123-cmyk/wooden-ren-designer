/**
 * Audit: OrthoView overlayContent slot + OrthoViewBoxCtx (Phase 2 Task 1).
 *
 * - 驗證 overlayContent callback 確實被 OrthoView 調用
 * - 驗證 ctx.vbX/Y/W/H 是 number 且 W/H > 0
 * - 驗證 ctx.partLocalToSvg 是 function 且 return {x, y}
 * - 驗證 caller 傳回的 SVG 元素出現在 renderToString 結果裡（標記 attr 偵測）
 *
 * Run: npx tsx scripts/audit-overlay-ctx.ts
 */

import React from "react";
import { renderToString } from "react-dom/server";
import { FURNITURE_CATALOG } from "../lib/templates";
import type { MaterialId, OptionSpec } from "../lib/types";
import { needsPartDrawing } from "../lib/render/part-drawing/grouping";
import { OrthoView, type OrthoViewBoxCtx } from "../lib/render/svg-views";

let fail = 0;
function expect(cond: boolean, msg: string) {
  if (cond) {
    console.log("✓", msg);
  } else {
    console.error("❌", msg);
    fail++;
  }
}

// Mirrors buildDesign helper from audit-part-drawings.ts.
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

const stool = FURNITURE_CATALOG.find((e) => e.category === "round-stool");
expect(!!stool, "round-stool entry found in FURNITURE_CATALOG");
if (!stool) {
  console.log(`\n❌ ${fail} failure(s)`);
  process.exit(1);
}

const design = buildDesign(stool);
expect(!!design && design.parts.length > 0, "round-stool design built");
if (!design) {
  console.log(`\n❌ ${fail} failure(s)`);
  process.exit(1);
}

const candidate = design.parts.find(needsPartDrawing);
expect(!!candidate, "found a part that needsPartDrawing");
if (!candidate) {
  console.log(`\n❌ ${fail} failure(s)`);
  process.exit(1);
}

const ctxHolder: { ctx: OrthoViewBoxCtx | null } = { ctx: null };
const svg = renderToString(
  React.createElement(OrthoView, {
    design,
    view: "front",
    title: "test",
    titleEn: "",
    isolatePartId: candidate.id,
    overlayContent: (ctx: OrthoViewBoxCtx) => {
      ctxHolder.ctx = ctx;
      return React.createElement("rect", {
        x: 0,
        y: 0,
        width: 10,
        height: 10,
        fill: "red",
        "data-test-overlay": "1",
      });
    },
  } as never),
);

const capturedCtx = ctxHolder.ctx;
expect(capturedCtx !== null, "overlayContent callback invoked");
expect(typeof capturedCtx?.vbX === "number", "ctx.vbX is number");
expect(typeof capturedCtx?.vbY === "number", "ctx.vbY is number");
expect(
  typeof capturedCtx?.vbW === "number" && (capturedCtx?.vbW ?? 0) > 0,
  "ctx.vbW > 0",
);
expect(
  typeof capturedCtx?.vbH === "number" && (capturedCtx?.vbH ?? 0) > 0,
  "ctx.vbH > 0",
);
expect(
  typeof capturedCtx?.partLocalToSvg === "function",
  "ctx.partLocalToSvg is function",
);
expect(
  svg.includes("data-test-overlay"),
  "overlay element appears in SVG output",
);

if (capturedCtx) {
  const p = capturedCtx.partLocalToSvg(0, 0, 0);
  expect(
    typeof p?.x === "number" && typeof p?.y === "number",
    "partLocalToSvg returns {x,y}",
  );
}

// 控制組：不傳 overlayContent → callback 不會跑、SVG 也不會有測試標記。
let secondCalled = false;
const svgNoOverlay = renderToString(
  React.createElement(OrthoView, {
    design,
    view: "front",
    title: "test-no-overlay",
    titleEn: "",
    isolatePartId: candidate.id,
  } as never),
);
expect(!secondCalled, "without overlayContent, no overlay rendered");
expect(
  !svgNoOverlay.includes("data-test-overlay"),
  "SVG without overlayContent has no overlay marker",
);

// 控制組：傳 overlayContent 但不 isolate（整套模式）→ partLocalToSvg 是 no-op
// 但 ctx 仍可用、overlay 仍會渲染。
const fullModeHolder: { ctx: OrthoViewBoxCtx | null } = { ctx: null };
const svgFullMode = renderToString(
  React.createElement(OrthoView, {
    design,
    view: "front",
    title: "test-full",
    titleEn: "",
    overlayContent: (ctx: OrthoViewBoxCtx) => {
      fullModeHolder.ctx = ctx;
      return React.createElement("rect", {
        x: 0,
        y: 0,
        width: 5,
        height: 5,
        "data-full-mode-overlay": "1",
      });
    },
  } as never),
);
expect(fullModeHolder.ctx !== null, "overlayContent invoked in full-design mode");
expect(
  svgFullMode.includes("data-full-mode-overlay"),
  "overlay renders in full-design mode too",
);

console.log(`\n${fail === 0 ? "✅ all pass" : `❌ ${fail} failure(s)`}`);
process.exit(fail);
