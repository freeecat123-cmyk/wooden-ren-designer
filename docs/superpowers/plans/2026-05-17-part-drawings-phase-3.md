# 零件圖 Phase 3 Implementation Plan

> **For agentic workers:** Use `superpowers:subagent-driven-development`. Steps with `- [ ]` for tracking.

**Goal:** Add shape-specific annotations for 5 hard shape variants + 補 7 silhouette gaps + 1×2 grid 切換 for hard parts.

**Architecture:** New `<ShapeSpecificAnnotation>` component in `annotation.tsx` dispatches per `shape.kind`. Per-shape sub-components render annotations using `OrthoViewBoxCtx`. `projectPartSilhouette` in `geometry.ts` gets new branches for 7 missing shape kinds.

**Tech Stack:** Next.js 15 + React 19 + TypeScript + SVG + Tailwind.

**Spec:** `docs/superpowers/specs/2026-05-17-part-drawings-phase-3-design.md`
**Branch:** `worktree-part-drawings-phase-3` (base Phase 2 end at `0b188e0`)

---

## Task 1: ShapeSpecificAnnotation framework + LatheSegmentTable

**Goal:** Set up `<ShapeSpecificAnnotation>` dispatch component. First sub-component: `LatheSegmentTable` (segment Y/R table in side view).

**Files:**
- Modify: `lib/render/svg-views.tsx` — export `LATHE_SEG` constant
- Modify: `lib/render/part-drawing/annotation.tsx` — add `ShapeSpecificAnnotation` + `LatheSegmentTable`
- Modify: `lib/render/part-drawing/drawing.tsx` — wire into overlay
- Modify: `scripts/audit-part-drawings.ts` — coat-rack lathe assertion

### Steps

- [ ] **Step 1: Locate LATHE_SEG**

```bash
grep -n "LATHE_SEG\|lathe.*segment" lib/render/svg-views.tsx | head -10
```

Find the array. Add `export` to the const declaration.

- [ ] **Step 2: Implement framework + LatheSegmentTable**

Append to `annotation.tsx`:

```tsx
import { LATHE_SEG } from "@/lib/render/svg-views";

/**
 * Dispatch shape-specific annotations to per-shape sub-components.
 * Returns null for shapes not handled in Phase 3.
 */
export function ShapeSpecificAnnotation({
  ctx, part, view,
}: { ctx: OrthoViewBoxCtx; part: Part; view: PartView }) {
  if (!part.shape) return null;
  switch (part.shape.kind) {
    case "lathe-turned": return <LatheSegmentTable ctx={ctx} part={part} view={view} />;
    default: return null;
  }
}

/**
 * Lathe segment Y/R table (side view only). Reads LATHE_SEG hard-coded
 * array + scales by part dimensions. Phase 3 Task 1.
 */
function LatheSegmentTable({
  ctx, part, view,
}: { ctx: OrthoViewBoxCtx; part: Part; view: PartView }) {
  if (view !== "side") return null;
  const legSize = part.visible.width; // round leg uses width as diameter
  const length = part.visible.length;
  const rows: Array<{ idx: number; y: number; r: number }> = LATHE_SEG.map((seg: any, i: number) => ({
    idx: i + 1,
    y: Math.round(seg.yFrac * length * 10) / 10,
    r: Math.round((legSize / 2) * seg.rScale * 10) / 10,
  }));

  // Render compact table near right edge of view
  const x0 = ctx.vbX + ctx.vbW - 90;
  const y0 = ctx.vbY + 24;
  const lineH = 9;

  return (
    <g className="lathe-segment-table" style={{ fontSize: 6, fontFamily: "monospace" }}>
      <text x={x0} y={y0} fontWeight="bold">段│Y│R</text>
      {rows.map((r, i) => (
        <text key={i} x={x0} y={y0 + (i + 1) * lineH}>
          {String(r.idx).padStart(2)}│{String(r.y).padStart(4)}│{String(r.r).padStart(4)}
        </text>
      ))}
    </g>
  );
}
```

NOTE: If `LATHE_SEG` doesn't have `yFrac/rScale` fields, inspect its actual shape and adapt. The point is: per-segment (Y, R) numbers.

- [ ] **Step 3: Wire into PartDrawing**

In `drawing.tsx`, add to overlayContent fragment alongside T1/T2/grain/facing:

```tsx
import { ..., ShapeSpecificAnnotation } from "./annotation";

overlayContent={(ctx) => (
  <>
    <T1Dimensions ctx={ctx} part={part} view="..." />
    <T2Annotations ctx={ctx} part={part} view="..." />
    <GrainArrow ctx={ctx} part={part} view="..." />
    <FacingMark ctx={ctx} part={part} view="..." />
    <ShapeSpecificAnnotation ctx={ctx} part={part} view="..." />
  </>
)}
```

- [ ] **Step 4: Audit**

```ts
// Coat-rack column has lathe-turned shape → side view should show segment table
{
  const entry = FURNITURE_CATALOG.find((e: any) => e.category === "coat-rack")!;
  const design = buildDesign(entry);
  const groups = groupPartsForDrawing(design);
  const latheGroup = groups.find((g) => g.representative.shape?.kind === "lathe-turned");
  if (latheGroup) {
    const html = renderPartDrawing(
      React.createElement(PartDrawing, { group: latheGroup, design, index: 0 } as any)
    );
    expect(html.includes("lathe-segment-table"), "lathe-turned part renders segment table");
    expect(html.includes("段│Y│R"), "table header present");
  } else {
    console.log("⚠ coat-rack no lathe-turned group; skipping");
  }
}
```

- [ ] **Step 5: tsc + audit + commit**

```bash
npx tsc --noEmit
npx tsx scripts/audit-part-drawings.ts
npm run audit
git add lib/render/svg-views.tsx lib/render/part-drawing/annotation.tsx lib/render/part-drawing/drawing.tsx scripts/audit-part-drawings.ts
git commit -m "feat(part-drawing): ShapeSpecificAnnotation framework + LatheSegmentTable

零件圖 Phase 3 Task 1：
- ShapeSpecificAnnotation: switch on part.shape.kind dispatch sub-component
- LatheSegmentTable: side view 角落畫段別表 (段, Y, R)
- export LATHE_SEG from svg-views.tsx
- audit: coat-rack lathe column 出表"
```

---

## Task 2: ArchBentChord

**Files:**
- Modify: `lib/render/part-drawing/annotation.tsx` — add `ArchBentChord` + register in dispatcher
- Modify: `scripts/audit-part-drawings.ts`

### Steps

- [ ] **Step 1: Implement ArchBentChord**

```tsx
/**
 * Arch-bent shape annotation (front view): chord length + sagitta.
 * Woodworker reads these to lay out the arc with string + rule.
 */
function ArchBentChord({
  ctx, part, view,
}: { ctx: OrthoViewBoxCtx; part: Part; view: PartView }) {
  if (view !== "front") return null;
  const shape = part.shape as any;
  if (shape?.kind !== "arch-bent") return null;

  const chord = part.visible.length;
  const sagitta = shape.bendMm ?? 0;
  const round1 = (n: number) => Math.round(n * 10) / 10;

  const x0 = ctx.vbX + 14;
  const y0 = ctx.vbY + ctx.vbH - 40;

  return (
    <g className="arch-bent-chord" style={{ fontSize: 8 }}>
      <text x={x0} y={y0} fill="#374151">弦長 {round1(chord)}</text>
      <text x={x0} y={y0 + 10} fill="#374151">矢高 {round1(sagitta)}</text>
      <text x={x0} y={y0 + 20} fontSize={6} fill="#6b7280">（順弦切向木紋）</text>
    </g>
  );
}
```

- [ ] **Step 2: Register in dispatcher**

In ShapeSpecificAnnotation switch, add:
```tsx
case "arch-bent": return <ArchBentChord ctx={ctx} part={part} view={view} />;
```

- [ ] **Step 3: Audit**

Find a template with arch-bent (likely bench windsor or bar-stool panel back). Add assertion:

```ts
let archFound = false;
for (const entry of FURNITURE_CATALOG) {
  const design = buildDesign(entry);
  const groups = groupPartsForDrawing(design);
  const g = groups.find((g) => g.representative.shape?.kind === "arch-bent");
  if (g) {
    const html = renderPartDrawing(React.createElement(PartDrawing, { group: g, design, index: 0 } as any));
    if (html.includes("arch-bent-chord")) { archFound = true; break; }
  }
}
expect(archFound, "arch-bent shape renders chord+sagitta annotation");
```

If no template currently uses arch-bent, log a skip warning and don't fail audit.

- [ ] **Step 4: tsc + audit + commit**

```
git commit -m "feat(part-drawing): ArchBentChord 弦長 + 矢高

零件圖 Phase 3 Task 2：
- arch-bent shape: front view 標弦長 (visible.length) + 矢高 (bendMm)
- 配「順弦切向木紋」說明
- audit 找 arch-bent group 驗證"
```

---

## Task 3: ApronTrapezoidDualEdge

**Files:**
- Modify: `lib/render/part-drawing/annotation.tsx`
- Modify: `scripts/audit-part-drawings.ts`

### Steps

- [ ] **Step 1: Implement ApronTrapezoidDualEdge**

```tsx
/**
 * apron-trapezoid: top view shows 上邊長 vs 下邊長 + bevel angle.
 */
function ApronTrapezoidDualEdge({
  ctx, part, view,
}: { ctx: OrthoViewBoxCtx; part: Part; view: PartView }) {
  if (view !== "top") return null;
  const shape = part.shape as any;
  if (shape?.kind !== "apron-trapezoid") return null;

  const L = part.visible.length;
  const topL = L * (shape.topLengthScale ?? 1);
  const botL = L * (shape.bottomLengthScale ?? 1);
  const bevel = shape.bevelAngle ?? 0;
  const round1 = (n: number) => Math.round(n * 10) / 10;

  const x0 = ctx.vbX + 14;
  const y0 = ctx.vbY + 42;

  return (
    <g className="apron-trap-dual" style={{ fontSize: 8 }}>
      <text x={x0} y={y0} fill="#374151">上邊長 {round1(topL)}</text>
      <text x={x0} y={y0 + 10} fill="#374151">下邊長 {round1(botL)}</text>
      {bevel !== 0 && (
        <text x={x0} y={y0 + 20} fill="#374151">端面斜 {round1(bevel * 180 / Math.PI)}°</text>
      )}
    </g>
  );
}
```

Inspect actual `apron-trapezoid` shape type to confirm field names (e.g. `topLengthScale` may be different).

- [ ] **Step 2: Register + audit + commit** (same pattern)

---

## Task 4: HoofDirection

**Files:**
- Modify: `lib/render/part-drawing/annotation.tsx`
- Modify: `lib/render/part-drawing/drawing.tsx` — show 毛料厚 hint at card footer for hoof parts
- Modify: `scripts/audit-part-drawings.ts`

### Steps

- [ ] **Step 1: Implement HoofDirection**

```tsx
function HoofDirection({
  ctx, part, view,
}: { ctx: OrthoViewBoxCtx; part: Part; view: PartView }) {
  if (view === "top") return null;
  const shape = part.shape as any;
  if (shape?.kind !== "hoof") return null;

  const dirX = shape.dirX ?? 0;
  const dirZ = shape.dirZ ?? 0;
  const hoofMm = shape.hoofMm ?? 0;
  const round1 = (n: number) => Math.round(n * 10) / 10;

  // Convert dirX/dirZ to human direction text
  const parts: string[] = [];
  if (dirX > 0) parts.push("右");
  if (dirX < 0) parts.push("左");
  if (dirZ > 0) parts.push("前");
  if (dirZ < 0) parts.push("後");
  const dirText = parts.length ? `腳趾朝${parts.join("")}` : "腳趾外撇";

  const x0 = ctx.vbX + 14;
  const y0 = ctx.vbY + 32;

  return (
    <g className="hoof-direction" style={{ fontSize: 8 }}>
      <text x={x0} y={y0} fill="#7c2d12" fontWeight="bold">{dirText}</text>
      <text x={x0} y={y0 + 10} fontSize={7} fill="#374151">轉折 Y={round1(hoofMm)}</text>
    </g>
  );
}
```

Then in `drawing.tsx`, after butt-joint footer, add hoof 毛料厚 hint:

```tsx
{part.shape?.kind === "hoof" && (
  <div className="text-[8px] text-amber-700 mt-0.5">
    毛料厚建議 ≥ {Math.round(part.visible.width * (part.shape.hoofScale ?? 1.4) * 10) / 10}mm
  </div>
)}
```

- [ ] **Step 2: Register + audit + commit**

---

## Task 5: SplayedTrueLength

**Files:**
- Modify: `lib/render/part-drawing/annotation.tsx`
- Modify: `scripts/audit-part-drawings.ts`

### Steps

- [ ] **Step 1: Implement SplayedTrueLength**

```tsx
function SplayedTrueLength({
  ctx, part, view,
}: { ctx: OrthoViewBoxCtx; part: Part; view: PartView }) {
  if (view !== "front") return null;
  const shape = part.shape as any;
  if (shape?.kind !== "splayed-tapered" && shape?.kind !== "splayed-round-tapered") return null;

  const L = part.visible.length;
  const dx = shape.dxMm ?? 0;
  const dz = shape.dzMm ?? 0;
  const realL = Math.sqrt(L * L + dx * dx + dz * dz);
  const angle = Math.atan2(Math.sqrt(dx * dx + dz * dz), L) * 180 / Math.PI;
  const round1 = (n: number) => Math.round(n * 10) / 10;

  const x0 = ctx.vbX + 14;
  const y0 = ctx.vbY + ctx.vbH - 30;

  return (
    <g className="splayed-true-length" style={{ fontSize: 8 }}>
      <text x={x0} y={y0} fill="#374151">真長 {round1(realL)}</text>
      <text x={x0} y={y0 + 10} fontSize={7} fill="#6b7280">端面斜 {round1(angle)}°</text>
      {shape.kind === "splayed-round-tapered" && (
        <>
          <text x={x0} y={y0 + 20} fontSize={7} fill="#374151">
            頂徑 {round1(part.visible.width)} / 底徑 {round1(part.visible.width * (shape.bottomScale ?? 1))}
          </text>
        </>
      )}
    </g>
  );
}
```

- [ ] **Step 2: Register + audit + commit**

---

## Task 6: 7 silhouette gap 補

**Files:**
- Modify: `lib/render/geometry.ts` — `projectPartSilhouette` add 7 new branches
- Modify: `scripts/audit-part-drawings.ts`

### Steps

- [ ] **Step 1: Locate projectPartSilhouette**

```bash
grep -n "projectPartSilhouette\|isRound\|boxLikeShape" lib/render/geometry.ts | head -20
```

Read existing branches (lines 48-240 approximately).

- [ ] **Step 2: Add 7 new branches**

For each shape, add a `case` or `if` branch returning a polygon (not AABB fallback). Per spec:

- **shaker**: top segment `squareFrac` portion = full bbox, bottom segment scaled by `bottomScale`. Compose 6-8 points.
- **notched-corners**: AABB minus 4 corner squares (each `notchSize × notchSize`). Returns 12-point polygon.
- **finger-joint-ends**: comb teeth at start/end faces, per `segmentCount`. Polygon with 2N+4 points.
- **dovetail-ends**: trapezoidal comb. Verify doesn't break user's tray dovetail work (see `git log lib/render/geometry.ts` for recent changes).
- **face-rounded / chamfered-top**: NOT visible in 2D orthographic. Document with JSDoc only; no polygon change. Optionally add a thin highlight edge as visual hint.
- **live-edge**: sine wave sampling. Maybe 30 points along the wavy edge with amplitude `liveEdgeAmplitude`.
- **regular-polygon**: For front/side views, project the N-gon vertices at top + bottom Z planes. Hull → silhouette.

Each branch should be self-contained `if (part.shape?.kind === "X") { return [...polygon points...] }`.

- [ ] **Step 3: Audit each gap**

```ts
// Test silhouette improvement for each of the 7 shapes
const SHAPE_GAPS = ["shaker", "notched-corners", "finger-joint-ends", "dovetail-ends", "live-edge", "regular-polygon"];
for (const kind of SHAPE_GAPS) {
  // Find a part in any template with this shape
  let found: Part | null = null;
  for (const entry of FURNITURE_CATALOG) {
    if (!entry.template) continue;
    const design = buildDesign(entry);
    for (const p of design.parts) {
      if (p.shape?.kind === kind) { found = p; break; }
    }
    if (found) break;
  }
  if (!found) {
    console.log(`⚠ no part with shape=${kind} found in catalog; skipping`);
    continue;
  }
  const poly = projectPartSilhouette(found, "front");
  expect(poly.length > 4, `shape=${kind}: silhouette has > 4 points (not AABB) — got ${poly.length}`);
}
```

NOTE: `projectPartSilhouette` may need to be exported from `geometry.ts` first.

- [ ] **Step 4: tsc + audit + commit**

```
git commit -m "feat(geometry): 7 silhouette gap 補（shaker/notched/finger-joint/dovetail/live-edge/regular-polygon）

零件圖 Phase 3 Task 6：
- projectPartSilhouette 加 6 個 shape 分支（face-rounded/chamfered-top 純 3D 用、JSDoc 註明）
- 對應的 silhouette > 4 points 而非 AABB fallback
- dovetail-ends 跟 user 並行 tray dovetail 工作不衝突（pin/tail comb 都正確）
- audit: 每個 gap shape 至少在 1 template 找到 part 並驗 polygon point count"
```

---

## Task 7: 1×2 grid 切換 + Phase 3 smoke

**Files:**
- Modify: `components/print/PrintPartDrawings.tsx` — detect hard shapes
- Modify: `scripts/audit-part-drawings.ts` — Phase 3 final smoke

### Steps

- [ ] **Step 1: Update PrintPartDrawings**

```tsx
const HARD_SHAPES = new Set([
  "lathe-turned", "arch-bent", "apron-trapezoid",
  "hoof", "splayed-tapered", "splayed-round-tapered",
]);

function isHardPart(g: PartDrawingGroup) {
  return g.representative.shape && HARD_SHAPES.has(g.representative.shape.kind);
}

// In JSX:
<div className="grid grid-cols-2 gap-4">
  {groups.map((g, idx) => (
    <div key={g.hash} className={isHardPart(g) ? "col-span-2" : undefined}>
      <PartDrawing group={g} design={design} index={idx} />
    </div>
  ))}
</div>
```

- [ ] **Step 2: Phase 3 28-template smoke**

```ts
console.log("\n--- Phase 3 element smoke (28 templates) ---");
let p3lathe = 0, p3arch = 0, p3trap = 0, p3hoof = 0, p3splayed = 0;
let p3crashes = 0;
let totalCards = 0;
for (const entry of FURNITURE_CATALOG) {
  if (!entry.template) continue;
  try {
    const design = buildDesign(entry);
    const groups = groupPartsForDrawing(design);
    for (const g of groups) {
      totalCards++;
      const html = renderPartDrawing(React.createElement(PartDrawing, { group: g, design, index: 0 } as any));
      if (!html || html.length < 200) { p3crashes++; continue; }
      if (html.includes("lathe-segment-table")) p3lathe++;
      if (html.includes("arch-bent-chord")) p3arch++;
      if (html.includes("apron-trap-dual")) p3trap++;
      if (html.includes("hoof-direction")) p3hoof++;
      if (html.includes("splayed-true-length")) p3splayed++;
    }
  } catch (e: any) {
    console.error("  ❌", entry.id, "CRASH:", e.message);
    p3crashes++;
  }
}
console.log(`  P3 stats: cards=${totalCards} lathe=${p3lathe} arch=${p3arch} apron-trap=${p3trap} hoof=${p3hoof} splayed=${p3splayed} crashes=${p3crashes}`);
expect(p3crashes === 0, `Phase 3 smoke: ${p3crashes} crashes`);
```

- [ ] **Step 3: tsc + audit + final commit**

```
git commit -m "feat(part-drawing): Phase 3 1×2 grid 切換 + 28-template smoke

零件圖 Phase 3 Task 7（驗收）：
- PrintPartDrawings: HARD_SHAPES (lathe/arch/trap/hoof/splayed*) 強制 col-span-2
- audit Phase 3 smoke: 28 模板覆蓋 5 shape-specific 元素，0 crash
- Phase 3 done (7/7 tasks)

下一步：Phase 2.5（3D 縮圖 / 毛料雙標通用版 / title block 重設計 / 榫卯語法細化）"
```

---

## Phase 3 Acceptance

- [ ] 28 模板 panel + print 零 crash
- [ ] tsc + audit no new regression
- [ ] lathe 段別表出現於 coat-rack column
- [ ] arch-bent 弦+矢 出現於某 template（如有）
- [ ] apron-trapezoid 雙邊長 出現於某 template
- [ ] hoof 方向 + 轉折 出現於某 template
- [ ] splayed true length 出現於某 template
- [ ] 7 silhouette gap shape 各驗 polygon point count > 4
- [ ] 印製頁難件 1×2 grid 切換、輕件 2×2 不變

---

## Notes
- Spec: `docs/superpowers/specs/2026-05-17-part-drawings-phase-3-design.md`
- Baseline: Phase 2 end `0b188e0`
- Pre-existing audit failure `photo-frame × default · 4 pairs` IGNORE
- Memory: [[project_wrd_part_drawings]]
