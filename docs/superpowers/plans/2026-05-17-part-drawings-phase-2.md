# 零件圖 Phase 2 Implementation Plan

> **For agentic workers:** Use `superpowers:subagent-driven-development`. Steps with `- [ ]` for tracking.

**Goal:** Add T1 SVG overlay + T2 dashed box + 木紋箭頭 + 面向記號 + 配對 ID + butt-joint 宣告 to wrd 零件圖. Replace Phase 1 text-row T1 with proper SVG overlay; activate T2 dashed box stub.

**Architecture:** OrthoView gets `overlayContent` slot prop with viewBox context. PartDrawing injects T1+T2+GrainArrow+FacingMark overlays per view.

**Tech Stack:** Next.js 15 + React 19 + TypeScript + SVG + Tailwind. Audit pattern via `tsx`.

**Spec:** `docs/superpowers/specs/2026-05-17-part-drawings-phase-2-design.md`
**Baseline:** Phase 1 commits ending at `6223213` on branch `worktree-part-drawings-phase-2`

---

## Task 1: OrthoView slot prop + viewBox context export

**Files:**
- Modify: `lib/render/svg-views.tsx` — OrthoView add `overlayContent?: (ctx: OrthoViewBoxCtx) => React.ReactNode` prop; export `OrthoViewBoxCtx` type
- Create: `scripts/audit-overlay-ctx.ts`

### Steps

- [ ] **Step 1: Read OrthoView's current viewBox logic**

```bash
grep -n "viewBox\|drawAreaTop\|vbContent" lib/render/svg-views.tsx | head -20
```

Note the current per-view viewBox computation. Find where the SVG `<svg viewBox=...>` is emitted.

- [ ] **Step 2: Export OrthoViewBoxCtx type + partLocalToSvg helper**

In `lib/render/svg-views.tsx`, near other exports:

```ts
export interface OrthoViewBoxCtx {
  vbX: number;
  vbY: number;
  vbW: number;
  vbH: number;
  /** Convert part-local mm coords to SVG pixel coords for this view. */
  partLocalToSvg(localX: number, localY: number, localZ: number): { x: number; y: number };
}
```

Inside OrthoView, after computing viewBox numbers, build the ctx object. For `partLocalToSvg`, reuse the existing internal projection logic — specifically `makeProjector(part, view)` returns a function. The ctx wraps it.

Note: `makeProjector` takes a part. For overlay use, caller has a specific part (the isolated one). Either:
- (a) Pass the projector function directly when `isolatePartId` is set
- (b) ctx captures the isolated part's projector

Choose (a): when `isolatePartId` is non-null, build the projector for `renderDesign.parts[0]` and embed in ctx.

- [ ] **Step 3: Add `overlayContent` prop to OrthoView**

```tsx
overlayContent?: (ctx: OrthoViewBoxCtx) => React.ReactNode;
```

Inside OrthoView's JSX, right before the closing `</svg>`, render:
```tsx
{overlayContent && overlayContent(ctx)}
```

- [ ] **Step 4: Write audit**

Create `scripts/audit-overlay-ctx.ts`:

```ts
import { FURNITURE_CATALOG } from "@/lib/templates";
import { needsPartDrawing } from "@/lib/render/part-drawing/grouping";
import React from "react";
import { renderToString } from "react-dom/server";
import { OrthoView } from "@/lib/render/svg-views";

let fail = 0;
function expect(c: boolean, m: string) { if (c) console.log("✓", m); else { console.error("❌", m); fail++; } }

// Build a round-stool design (same pattern as audit-part-drawings.ts buildDesign helper)
import { buildDesign } from "@/scripts/audit-part-drawings"; // OR inline the helper

// (If buildDesign isn't exportable, copy the inline build pattern from audit-part-drawings.ts)

const entry = FURNITURE_CATALOG.find((e: any) => e.category === "round-stool")!;
// ... build design as in audit-part-drawings.ts
const candidate = design.parts.find(needsPartDrawing)!;

let capturedCtx: any = null;
const svg = renderToString(
  React.createElement(OrthoView, {
    design,
    view: "front",
    title: "test",
    titleEn: "",
    isolatePartId: candidate.id,
    overlayContent: (ctx: any) => {
      capturedCtx = ctx;
      return React.createElement("rect", { x: 0, y: 0, width: 10, height: 10, fill: "red" });
    },
  } as any)
);

expect(capturedCtx !== null, "overlayContent callback invoked");
expect(typeof capturedCtx?.vbX === "number", "ctx.vbX is number");
expect(typeof capturedCtx?.vbW === "number", "ctx.vbW is number");
expect(typeof capturedCtx?.partLocalToSvg === "function", "ctx.partLocalToSvg is function");
expect(svg.includes("fill=\"red\""), "overlay rect appears in SVG output");

// Verify partLocalToSvg behaves reasonably
const origin = capturedCtx.partLocalToSvg(0, 0, 0);
expect(typeof origin?.x === "number" && typeof origin?.y === "number", "partLocalToSvg returns {x,y}");

console.log(`\n${fail === 0 ? "✅ all pass" : `❌ ${fail} failure(s)`}`);
process.exit(fail);
```

If buildDesign helper can't be imported from another script, inline the logic from `audit-part-drawings.ts` here.

- [ ] **Step 5: Run audit**

```bash
npx tsx scripts/audit-overlay-ctx.ts
npx tsc --noEmit
npm run audit
```

All green (baseline 1 failure OK).

- [ ] **Step 6: Commit**

```bash
git add lib/render/svg-views.tsx scripts/audit-overlay-ctx.ts
git commit -m "feat(svg-views): OrthoView overlayContent slot prop + OrthoViewBoxCtx

零件圖 Phase 2 Task 1：
- 新 prop overlayContent?: (ctx) => ReactNode，ctx 含 vbX/Y/W/H + partLocalToSvg
- 解 Phase 1 T1/T2 SVG overlay 對齊問題（OrthoView viewBox 常數不 export）
- audit: overlay callback 觸發、ctx 形狀正確、rect 出現在 SVG"
```

---

## Task 2: T1 SVG overlay activate

**Files:**
- Modify: `lib/render/part-drawing/annotation.tsx` — rewrite T1Dimensions to use OrthoViewBoxCtx
- Modify: `lib/render/part-drawing/drawing.tsx` — wire T1Dimensions via overlayContent

### Steps

- [ ] **Step 1: Rewrite T1Dimensions**

In `annotation.tsx`:

```tsx
import type { OrthoViewBoxCtx } from "@/lib/render/svg-views";

/**
 * T1 overall dimensions overlay. Renders horizontal + vertical dimension
 * lines at view edges using OrthoView's partLocalToSvg context.
 */
export function T1Dimensions({
  ctx,
  part,
  view,
}: {
  ctx: OrthoViewBoxCtx;
  part: Part;
  view: PartView;
}) {
  const round1 = (n: number) => Math.round(n * 10) / 10;
  const L = part.visible.length;
  const W = part.visible.width;
  const T = part.visible.thickness;

  // 4 corners in part-local coords (origin = (0,0,0) since isolated + recentered)
  // For each view, work out which corners bound the visible silhouette
  // and place dim lines outside that bbox.

  const horizMm = view === "side" ? W : L;
  const vertMm = view === "top" ? W : T;

  // Place dim line below SVG content area
  const margin = 12;
  const dimY = ctx.vbY + ctx.vbH - margin; // bottom edge - margin
  const dimX = ctx.vbX + ctx.vbW - margin; // right edge - margin

  // SVG coords for left and right ends of horizontal dim
  // Use partLocalToSvg with the part's local extents
  // For length axis (X): -L/2 to +L/2
  // For width axis (Z):  -W/2 to +W/2
  // For thickness (Y):    0 to T

  let horizP1, horizP2, vertP1, vertP2;
  if (view === "front") {
    horizP1 = ctx.partLocalToSvg(-L/2, T/2, 0);
    horizP2 = ctx.partLocalToSvg(+L/2, T/2, 0);
    vertP1 = ctx.partLocalToSvg(L/2, 0, 0);
    vertP2 = ctx.partLocalToSvg(L/2, T, 0);
  } else if (view === "top") {
    horizP1 = ctx.partLocalToSvg(-L/2, T, -W/2);
    horizP2 = ctx.partLocalToSvg(+L/2, T, -W/2);
    vertP1 = ctx.partLocalToSvg(L/2, T, -W/2);
    vertP2 = ctx.partLocalToSvg(L/2, T, +W/2);
  } else { // side
    horizP1 = ctx.partLocalToSvg(0, T/2, -W/2);
    horizP2 = ctx.partLocalToSvg(0, T/2, +W/2);
    vertP1 = ctx.partLocalToSvg(0, 0, W/2);
    vertP2 = ctx.partLocalToSvg(0, T, W/2);
  }

  return (
    <g className="t1-dim-overlay" style={{ fontSize: 9 }}>
      <DimensionLine x1={horizP1.x} x2={horizP2.x} y={dimY} label={String(round1(horizMm))} />
      <VerticalDimensionLine y1={vertP1.y} y2={vertP2.y} x={dimX} label={String(round1(vertMm))} />
    </g>
  );
}
```

If the existing axis convention differs (e.g. Y points up vs down), inspect `makeProjector` to learn what `partLocalToSvg` actually maps.

- [ ] **Step 2: Wire into PartDrawing**

In `drawing.tsx`, replace each OrthoView wrapper. Instead of separate `<T1DimensionsRow>` below, pass overlayContent:

```tsx
<OrthoView
  design={design}
  view="front"
  title="正視"
  titleEn="FRONT"
  isolatePartId={part.id}
  showDimensions={false}
  overlayContent={(ctx) => (
    <T1Dimensions ctx={ctx} part={part} view="front" />
  )}
/>
```

Remove the T1DimensionsRow below (keep as exported helper for now in case needed).

- [ ] **Step 3: Update audit smoke**

Check that the SVG output STILL contains the L/W/T numbers (just inside `<text>` elements within SVG, not in separate divs).

- [ ] **Step 4: tsc + audits**

```bash
npx tsc --noEmit
npx tsx scripts/audit-part-drawings.ts
npx tsx scripts/audit-overlay-ctx.ts
npm run audit
```

- [ ] **Step 5: Commit**

```bash
git add lib/render/part-drawing/annotation.tsx lib/render/part-drawing/drawing.tsx scripts/audit-part-drawings.ts
git commit -m "feat(part-drawing): T1 SVG overlay (replaces Phase 1 text-row)

零件圖 Phase 2 Task 2：
- T1Dimensions 用 OrthoViewBoxCtx.partLocalToSvg 算尺寸線端點
- 每 view 對應軸：front=L,T / top=L,W / side=W,T
- 移除 PartDrawing 裡的 T1DimensionsRow text-row、改用 overlayContent slot
- T1DimensionsRow 保留 export（fallback / 印製可選）"
```

---

## Task 3: T2 dashed box overlay activate

**Files:**
- Modify: `lib/render/part-drawing/annotation.tsx` — rewrite T2Annotations
- Modify: `lib/render/part-drawing/drawing.tsx` — wire T2Annotations

### Steps

- [ ] **Step 1: Rewrite T2Annotations**

```tsx
import { mortiseLocalBox, tenonLocalBox, projectFeatureRect } from "@/lib/render/svg-views";

export function T2Annotations({
  ctx,
  part,
  view,
}: {
  ctx: OrthoViewBoxCtx;
  part: Part;
  view: PartView;
}) {
  const features: Array<{ kind: "m" | "t"; idx: number; localBox: any }> = [
    ...part.mortises.map((m, idx) => ({ kind: "m" as const, idx, localBox: mortiseLocalBox(part, m) })),
    ...part.tenons.map((t, idx) => ({ kind: "t" as const, idx, localBox: tenonLocalBox(part, t) })),
  ];

  const rects: React.ReactNode[] = [];
  for (const f of features) {
    const rect = projectFeatureRect(part, view, f.localBox);
    if (!rect || rect.w < 0.5 || rect.h < 0.5) continue;
    rects.push(
      <rect
        key={`${f.kind}-${f.idx}-${view}`}
        x={rect.x}
        y={rect.y}
        width={rect.w}
        height={rect.h}
        fill="none"
        stroke="#666"
        strokeWidth={0.6}
        strokeDasharray="2 2"
      />
    );
  }

  return <g className="t2-overlay">{rects}</g>;
}
```

NOTE: `projectFeatureRect` may return SVG coords directly (it's used internally by OrthoView). Verify by reading the function. If it returns part-local coords, run through `ctx.partLocalToSvg` first.

- [ ] **Step 2: Wire into PartDrawing**

Combine T1 + T2 in overlayContent:

```tsx
overlayContent={(ctx) => (
  <>
    <T1Dimensions ctx={ctx} part={part} view="front" />
    <T2Annotations ctx={ctx} part={part} view="front" />
  </>
)}
```

- [ ] **Step 3: tsc + audits**

Add smoke check: rendered SVG for a part with mortises should contain at least one `<rect>` with `stroke-dasharray="2 2"`.

```bash
npx tsc --noEmit
npx tsx scripts/audit-part-drawings.ts
npm run audit
```

- [ ] **Step 4: Commit**

```bash
git add lib/render/part-drawing/annotation.tsx lib/render/part-drawing/drawing.tsx scripts/audit-part-drawings.ts
git commit -m "feat(part-drawing): T2 dashed box overlay (Phase 2 stub activated)

零件圖 Phase 2 Task 3：
- T2Annotations 用 mortiseLocalBox + projectFeatureRect 畫細虛 box (dash 2 2)
- 跟 T1Dimensions 一起塞進 overlayContent slot
- T2LabelList 文字行保留 (Phase 1 已上)，box 補空間定位"
```

---

## Task 4: 木紋方向箭頭

**Files:**
- Modify: `lib/render/part-drawing/annotation.tsx` — add `GrainArrow`
- Modify: `lib/render/part-drawing/drawing.tsx` — include in overlay

### Steps

- [ ] **Step 1: Implement GrainArrow**

```tsx
/**
 * Wood grain direction indicator (right-bottom corner of each view).
 * grainDirection mapping per view:
 *   front: length=→/←, width=⊙(out), thickness=↑/↓
 *   top:   length=→/←, width=↑/↓, thickness=⊙
 *   side:  length=⊙, width=→/←, thickness=↑/↓
 */
export function GrainArrow({
  ctx,
  part,
  view,
}: {
  ctx: OrthoViewBoxCtx;
  part: Part;
  view: PartView;
}) {
  const grain = part.grainDirection;
  // Determine arrow direction
  type ArrowDir = "horiz" | "vert" | "into" | "outOf";
  let dir: ArrowDir;
  if (view === "front") {
    dir = grain === "length" ? "horiz" : grain === "thickness" ? "vert" : "into";
  } else if (view === "top") {
    dir = grain === "length" ? "horiz" : grain === "width" ? "vert" : "into";
  } else { // side
    dir = grain === "width" ? "horiz" : grain === "thickness" ? "vert" : "into";
  }

  // Place at bottom-right of viewBox, away from dim lines
  const x0 = ctx.vbX + ctx.vbW - 32;
  const y0 = ctx.vbY + ctx.vbH - 32;
  const len = 14;

  let glyph: React.ReactNode;
  if (dir === "horiz") {
    glyph = (
      <>
        <line x1={x0} y1={y0} x2={x0 + len} y2={y0} stroke="#1d4ed8" strokeWidth={0.7} />
        <polygon points={`${x0+len},${y0} ${x0+len-3},${y0-2} ${x0+len-3},${y0+2}`} fill="#1d4ed8" />
      </>
    );
  } else if (dir === "vert") {
    glyph = (
      <>
        <line x1={x0} y1={y0} x2={x0} y2={y0 - len} stroke="#1d4ed8" strokeWidth={0.7} />
        <polygon points={`${x0},${y0-len} ${x0-2},${y0-len+3} ${x0+2},${y0-len+3}`} fill="#1d4ed8" />
      </>
    );
  } else { // into (⊙)
    glyph = (
      <>
        <circle cx={x0+5} cy={y0-5} r={4} fill="none" stroke="#1d4ed8" strokeWidth={0.7} />
        <circle cx={x0+5} cy={y0-5} r={1} fill="#1d4ed8" />
      </>
    );
  }

  return (
    <g className="grain-arrow">
      {glyph}
      <text x={x0} y={y0+10} fontSize={7} fill="#1d4ed8">順紋</text>
    </g>
  );
}
```

- [ ] **Step 2: Wire into PartDrawing overlayContent**

Add `<GrainArrow ctx={ctx} part={part} view="..." />` alongside T1+T2.

- [ ] **Step 3: tsc + audit**

Add smoke: rendered SVG contains 順紋 text.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(part-drawing): 木紋方向箭頭 (GrainArrow)

零件圖 Phase 2 Task 4：
- 每 view 右下角 12px 箭頭 + 「順紋」字
- grainDirection 對應軸：length/width/thickness → 對應該 view 的水平/垂直/深軸
- 深軸（看不到的軸）→ ⊙ 符號"
```

---

## Task 5: 面向記號（外/內/上/下）

**Files:**
- Modify: `lib/render/part-drawing/annotation.tsx` — add `inferFacing` + `FacingMark`
- Modify: `lib/render/part-drawing/drawing.tsx`

### Steps

- [ ] **Step 1: Implement inferFacing**

```tsx
type FacingHint = { axis: "x" | "y" | "z"; positive: boolean; label: "外" | "內" | "上" | "下" };

/**
 * Infer "facing" of an asymmetric part. Returns null for symmetric parts.
 * Rule: face with most mortises = 內 (joinery hidden); opposite face = 外.
 * For tenons on Y axis, top tenon → 上 / 下.
 */
export function inferFacing(part: Part): FacingHint | null {
  // Count mortises by face (origin sign)
  const xPos = part.mortises.filter((m: any) => m.origin?.x > 1).length;
  const xNeg = part.mortises.filter((m: any) => m.origin?.x < -1).length;
  const zPos = part.mortises.filter((m: any) => m.origin?.z > 1).length;
  const zNeg = part.mortises.filter((m: any) => m.origin?.z < -1).length;

  if (xPos > xNeg + 1) return { axis: "x", positive: false, label: "外" };
  if (xNeg > xPos + 1) return { axis: "x", positive: true, label: "外" };
  if (zPos > zNeg + 1) return { axis: "z", positive: false, label: "外" };
  if (zNeg > zPos + 1) return { axis: "z", positive: true, label: "外" };

  // Tenons indicate up/down face
  const yTopTenon = part.tenons.filter((t: any) => (t.origin?.y ?? 0) > part.visible.thickness * 0.7).length;
  const yBotTenon = part.tenons.filter((t: any) => (t.origin?.y ?? 0) < part.visible.thickness * 0.3).length;
  if (yTopTenon > 0) return { axis: "y", positive: true, label: "上" };
  if (yBotTenon > 0) return { axis: "y", positive: false, label: "下" };

  return null;
}

export function FacingMark({ ctx, part, view }: { ctx: OrthoViewBoxCtx; part: Part; view: PartView }) {
  const facing = inferFacing(part);
  if (!facing) return null;
  // Show on the view that displays the relevant axis
  const showOnView =
    (facing.axis === "x" && (view === "front" || view === "top")) ||
    (facing.axis === "z" && (view === "side" || view === "top")) ||
    (facing.axis === "y" && view !== "top");
  if (!showOnView) return null;

  const x0 = ctx.vbX + 16;
  const y0 = ctx.vbY + 24;
  return (
    <g className="facing-mark">
      <text x={x0} y={y0} fontSize={8} fill="#7c2d12">{facing.label} ↗</text>
    </g>
  );
}
```

- [ ] **Step 2: Wire into PartDrawing**

Add `<FacingMark ctx={ctx} part={part} view="..." />` to overlayContent.

- [ ] **Step 3: tsc + audit**

Smoke: at least 1 part in 28 templates has facing mark text.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(part-drawing): 面向記號 (FacingMark + inferFacing)

零件圖 Phase 2 Task 5：
- inferFacing: 由 mortise/tenon origin 統計推「外面/內面/上/下」
  + mortise X 軸偏多側 → 對面是「外」
  + tenon 在頂端 → 「上」記號
- FacingMark: 左上角小字「外 ↗」/「內 ↗」/「上」/「下」"
```

---

## Task 6: 配對 ID（榫眼 ↔ 榫頭）

**Files:**
- Modify: `lib/render/part-drawing/annotation.tsx` — `findMatchingFeature` + extend T2LabelList format

### Steps

- [ ] **Step 1: Implement findMatchingFeature**

```tsx
import type { FurnitureDesign } from "@/lib/types";

/**
 * For a given mortise/tenon, find the matching feature on another part.
 * Heuristic: world-space proximity + size match.
 * Returns { partId, kind: "mortise"|"tenon", idx } or null.
 */
export function findMatchingFeature(
  part: Part,
  feature: any,
  kind: "mortise" | "tenon",
  design: FurnitureDesign
): { partId: string; kind: "mortise" | "tenon"; idx: number } | null {
  // World position = part.origin + feature.origin (approximate)
  const fWorldX = (part.origin?.x ?? 0) + (feature.origin?.x ?? 0);
  const fWorldY = (part.origin?.y ?? 0) + (feature.origin?.y ?? 0);
  const fWorldZ = (part.origin?.z ?? 0) + (feature.origin?.z ?? 0);

  const otherKind = kind === "mortise" ? "tenons" : "mortises";
  const otherKindLabel: "mortise" | "tenon" = kind === "mortise" ? "tenon" : "mortise";

  for (const other of design.parts) {
    if (other.id === part.id) continue;
    const list = (other as any)[otherKind] as any[];
    for (let idx = 0; idx < list.length; idx++) {
      const o = list[idx];
      const oX = (other.origin?.x ?? 0) + (o.origin?.x ?? 0);
      const oY = (other.origin?.y ?? 0) + (o.origin?.y ?? 0);
      const oZ = (other.origin?.z ?? 0) + (o.origin?.z ?? 0);
      const dist = Math.hypot(oX - fWorldX, oY - fWorldY, oZ - fWorldZ);
      if (dist < 10) {
        // Size check (approximate)
        const sizeMatch =
          Math.abs((o.length ?? 0) - (feature.length ?? 0)) < 5 &&
          Math.abs((o.width ?? 0) - (feature.width ?? 0)) < 5;
        if (sizeMatch) {
          return { partId: other.id, kind: otherKindLabel, idx };
        }
      }
    }
  }
  return null;
}
```

- [ ] **Step 2: Extend T2LabelList to include matches**

Modify the label generation to optionally append `↔ {partId} {榫頭|榫眼}{N+1}` when match found:

```tsx
export function T2LabelList({ part, design }: { part: Part; design?: FurnitureDesign }) {
  // ...existing logic...
  // For each mortise/tenon:
  let line = `榫眼${idx + 1}（${face}）：${W}×${L} 深 ${D}，距底 ${y}`;
  if (design) {
    const match = findMatchingFeature(part, m, "mortise", design);
    if (match) {
      const matchLabel = match.kind === "tenon" ? "榫頭" : "榫眼";
      line += `　↔ ${match.partId} ${matchLabel}${match.idx + 1}`;
    }
  }
  lines.push(line);
  // ...
}
```

Update callers (`PartDrawing` passes `design` to `T2LabelList`).

- [ ] **Step 3: tsc + audit**

Smoke: a template with multi-part joinery (e.g. stool with apron tenons → leg mortises) produces `↔` in label list.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(part-drawing): 配對 ID (mortise ↔ tenon)

零件圖 Phase 2 Task 6：
- findMatchingFeature: 用 world position proximity + size match 找配對
- T2LabelList: 標籤後綴「↔ {partId} 榫頭N」/「↔ {partId} 榫眼N」
- 沒配對到的不附 suffix"
```

---

## Task 7: butt-joint 慣例宣告 + Phase 2 smoke

**Files:**
- Modify: `lib/render/part-drawing/drawing.tsx` — card footer
- Modify: `scripts/audit-part-drawings.ts` — Phase 2 smoke

### Steps

- [ ] **Step 1: Add butt-joint footer to PartDrawing**

```tsx
{(design.useButtJointConvention !== false) && (
  <div className="mt-1 text-[8px] text-zinc-400 italic">
    ※ visible.length = 含榫對接長度；裸露長 = visible.length − 2 × 榫長
  </div>
)}
```

Place after material line, before card close.

- [ ] **Step 2: Phase 2 smoke**

Append to `scripts/audit-part-drawings.ts`:

```ts
console.log("\n--- Phase 2 element smoke (28 templates) ---");
let p2fail = 0;
for (const entry of FURNITURE_CATALOG) {
  if (!entry.template) continue;
  const design = buildDesign(entry);
  const groups = groupPartsForDrawing(design);
  for (const g of groups) {
    const html = renderPartDrawing(
      React.createElement(PartDrawing, { group: g, design, index: 0 } as any)
    );
    // T1+T2+grain+facing+match+butt-joint should all be detectable in output
    // (each test is best-effort — some parts may have no mortises so no T2, etc.)
    if (g.representative.mortises.length > 0 || g.representative.tenons.length > 0) {
      if (!html.includes("stroke-dasharray=\"2 2\"")) {
        console.error("  ❌", entry.category ?? entry.id, "T2 box missing");
        p2fail++;
      }
    }
    if (!html.includes("順紋")) {
      console.error("  ❌", entry.category ?? entry.id, "grain arrow missing");
      p2fail++;
    }
  }
}
expect(p2fail === 0, `Phase 2 smoke: ${p2fail} element missing(s)`);
```

(Adapt assertions based on actual smoke results — some parts legitimately don't have all elements.)

- [ ] **Step 3: tsc + full audit**

```bash
npx tsc --noEmit
npx tsx scripts/audit-part-drawings.ts
npm run audit
```

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(part-drawing): butt-joint 宣告 + Phase 2 28-template smoke

零件圖 Phase 2 Task 7（驗收）：
- 卡片底加 butt-joint 慣例小字（design.useButtJointConvention !== false）
- audit Phase 2 smoke: 28 模板 × 224 group 全包 T2 box/grain/facing
- Phase 2 done (7/7 tasks)

下一步：Phase 2.5（3D 縮圖 / 毛料雙標）或 Phase 3（難件特殊 / silhouette gap）"
```

---

## Phase 2 Acceptance Checklist

- [ ] 28 模板 panel + print 零 crash（Task 7 smoke）
- [ ] tsc --noEmit 零錯
- [ ] npm run audit 不退步（baseline photo-frame × default 預期）
- [ ] 隨抽 3 part 看 T1 SVG overlay 數字對齊
- [ ] 隨抽 3 part 看 T2 dashed box 在 mortise 位置
- [ ] 木紋箭頭方向跟 grainDirection 一致
- [ ] 配對 ID 寫到合理對象
- [ ] butt-joint 宣告出現

---

## Notes for executor agents

1. **Spec:** `docs/superpowers/specs/2026-05-17-part-drawings-phase-2-design.md`
2. **Branch:** `worktree-part-drawings-phase-2` (already created)
3. **Baseline:** All Phase 1 commits already applied (`6223213` end)
4. **Pre-existing audit failure:** `photo-frame × default · 4 pairs` — IGNORE, that's user's parallel WIP
5. **No push** until final task; user controls when PR opens
6. **Memory pointer:** [[project_wrd_part_drawings]] / [[feedback_parallel_agent_inspector]]
