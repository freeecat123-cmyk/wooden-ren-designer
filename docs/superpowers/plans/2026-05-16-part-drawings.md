# 零件圖 Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Phase 1 MVP of per-part shop drawings for wrd: predicate filter + ×N grouping + mirror split + `<PartDrawing>` 3-view component with T1+T2 dimensions + interactive panel + print section, working across all 28 templates without crashing.

**Architecture:**
- Pure functions for predicate/grouping/mirror in `lib/render/part-drawing/grouping.ts` (audit-testable in isolation)
- Extend existing `OrthoView` in `lib/render/svg-views.tsx` with `isolatePartId?: string` prop (default behavior unchanged when prop absent)
- New `<PartDrawing>` wrapper component renders 3 views + dimensions for a single part group
- Same `<PartDrawing>` used by interactive `<PartDrawingsPanel>` (design page) and `<PrintPartDrawings>` (print page)

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, SVG, Tailwind CSS, `tsx` for audit scripts.

**Spec:** `docs/superpowers/specs/2026-05-16-part-drawings-design.md` (v2)

**Verification commands** (use throughout):
- Type check: `npx tsc --noEmit`
- Existing audit suite (must not regress): `npm run audit`
- Dev server: `npm run dev` (Mac: kill listener with `lsof -i:3000 -sTCP:LISTEN | awk 'NR>1{print $2}' | xargs kill`)

**Important repo conventions:**
- Use **npm** not pnpm
- `origin` of `Part` = 底部中心（X/Z from center, Y from bottom）
- `visible.length` = butt-joint length (含端面進入榫眼)
- 動 helper 改空間語意前先 grep callers
- Read `docs/drafting-math.md` §A6 / §A4 / §A8 / §A10 before touching projection logic

---

## Task 1: Predicate + isolation filter

**Goal:** Create pure functions `needsPartDrawing(part)` and `filterDesignForIsolation(design, partId)`. Audit verifies behavior across all 28 templates.

**Files:**
- Create: `lib/render/part-drawing/grouping.ts`
- Create: `scripts/audit-part-drawings.ts`

### Steps:

- [ ] **Step 1: Write the failing audit script**

Create `scripts/audit-part-drawings.ts`:

```ts
import { FURNITURE_CATALOG } from "@/lib/templates";
import { needsPartDrawing, filterDesignForIsolation } from "@/lib/render/part-drawing/grouping";
import { getTemplate } from "@/lib/templates";

let fail = 0;

function expect(cond: boolean, msg: string) {
  if (!cond) {
    console.error("❌", msg);
    fail++;
  } else {
    console.log("✓", msg);
  }
}

// Test 1: predicate on hand-picked cases
const dummyBox = {
  id: "test-flat-panel",
  nameZh: "平板",
  material: "walnut" as const,
  grainDirection: "length" as const,
  visible: { length: 100, width: 50, thickness: 10 },
  origin: { x: 0, y: 0, z: 0 },
  tenons: [],
  mortises: [],
};

expect(
  !needsPartDrawing(dummyBox as any),
  "Plain box with no joinery → no drawing"
);

expect(
  needsPartDrawing({ ...dummyBox, tenons: [{ position: "top" } as any] } as any),
  "Has tenon → needs drawing"
);

expect(
  needsPartDrawing({ ...dummyBox, mortises: [{ position: "top" } as any] } as any),
  "Has mortise → needs drawing"
);

expect(
  needsPartDrawing({ ...dummyBox, shape: { kind: "round" } } as any),
  "Non-box shape → needs drawing"
);

// Test 2: isolation filter
for (const entry of FURNITURE_CATALOG) {
  if (!entry.template) continue;
  const template = entry.template;
  const design = template.build({});
  if (!design.parts.length) continue;

  const firstPart = design.parts[0];
  const filtered = filterDesignForIsolation(design, firstPart.id);
  expect(
    filtered.parts.length === 1,
    `${entry.id}: filter to ${firstPart.id} → 1 part (got ${filtered.parts.length})`
  );
  expect(
    filtered.parts[0].id === firstPart.id,
    `${entry.id}: filtered part id matches`
  );
}

// Test 3: predicate triggers reasonable number per template (sanity)
let totalTriggered = 0;
for (const entry of FURNITURE_CATALOG) {
  if (!entry.template) continue;
  const design = entry.template.build({});
  totalTriggered += design.parts.filter(needsPartDrawing).length;
}
expect(
  totalTriggered > 100 && totalTriggered < 500,
  `Total triggered parts across all templates: ${totalTriggered} (expected 100-500)`
);

console.log(`\n${fail === 0 ? "✅ all pass" : `❌ ${fail} failure(s)`}`);
process.exit(fail);
```

- [ ] **Step 2: Run audit, verify FAIL**

```bash
npx tsx scripts/audit-part-drawings.ts
```
Expected: error like `Cannot find module '@/lib/render/part-drawing/grouping'`

- [ ] **Step 3: Implement grouping.ts**

Create `lib/render/part-drawing/grouping.ts`:

```ts
import type { Part, FurnitureDesign } from "@/lib/types";

/**
 * Whether a part needs its own shop drawing.
 * True if it has joinery features or non-trivial shape.
 */
export function needsPartDrawing(part: Part): boolean {
  return part.tenons.length > 0
    || part.mortises.length > 0
    || (part.shape !== undefined && part.shape.kind !== "box");
}

/**
 * Returns a copy of design with only the named part, recentered at origin.
 * Original design is untouched. If partId not found, returns design unchanged.
 */
export function filterDesignForIsolation(
  design: FurnitureDesign,
  partId: string,
): FurnitureDesign {
  const part = design.parts.find((p) => p.id === partId);
  if (!part) return design;

  return {
    ...design,
    parts: [
      {
        ...part,
        // Recenter: keep Y=底部, X/Z=0 (matches origin=底部中心 convention)
        origin: { x: 0, y: 0, z: 0 },
      },
    ],
  };
}
```

- [ ] **Step 4: Run audit, verify PASS**

```bash
npx tsx scripts/audit-part-drawings.ts
```
Expected: all `✓`, exit code 0

- [ ] **Step 5: Type check + existing audit**

```bash
npx tsc --noEmit
npm run audit
```
Expected: both green (no regressions)

- [ ] **Step 6: Commit**

```bash
git add lib/render/part-drawing/grouping.ts scripts/audit-part-drawings.ts
git commit -m "feat(part-drawing): predicate + isolation filter

零件圖 Phase 1 Task 1：
- needsPartDrawing(): tenons || mortises || shape!=box → 要圖
- filterDesignForIsolation(): single-part recentered design (for <PartDrawing>)
- audit script tests predicate behavior + filter across 28 templates"
```

---

## Task 2: Geometry hash + group with mirror split

**Goal:** Hash function for ×N merge + `groupPartsForDrawing(design)` returns sorted groups, mirror-detected splits.

**Files:**
- Modify: `lib/render/part-drawing/grouping.ts` (add hashPart + groupPartsForDrawing)
- Modify: `scripts/audit-part-drawings.ts` (add tests)

### Steps:

- [ ] **Step 1: Add failing audit tests**

Append to `scripts/audit-part-drawings.ts`:

```ts
import { hashPart, groupPartsForDrawing } from "@/lib/render/part-drawing/grouping";

// Test 4: identical parts collide, different parts diverge
const partA: Part = { ...dummyBox, id: "leg-1", tenons: [{ position: "top", offsetWidth: 10 } as any] } as any;
const partB: Part = { ...partA, id: "leg-2" }; // same geometry, different id
const partC: Part = { ...dummyBox, id: "leg-3", visible: { length: 200, width: 50, thickness: 10 } } as any;

expect(hashPart(partA) === hashPart(partB), "Identical geometry → same hash (id doesn't count)");
expect(hashPart(partA) !== hashPart(partC), "Different visible.length → different hash");

// Test 5: mirror split
// Mortise position X-mirrored should produce different hashes (mirror = split)
const mirrorLeft: Part = {
  ...dummyBox, id: "leg-fl",
  mortises: [{ position: "top", offsetWidth: -10, length: 30, width: 12, depth: 25 } as any],
} as any;
const mirrorRight: Part = {
  ...mirrorLeft, id: "leg-fr",
  mortises: [{ position: "top", offsetWidth: 10, length: 30, width: 12, depth: 25 } as any], // X mirror
};
expect(hashPart(mirrorLeft) !== hashPart(mirrorRight), "Mirror pair → different hashes");

// Test 6: grouping across all templates produces reasonable count
let totalGroups = 0;
for (const entry of FURNITURE_CATALOG) {
  if (!entry.template) continue;
  const design = entry.template.build({});
  const groups = groupPartsForDrawing(design);
  for (const g of groups) {
    expect(g.parts.length >= 1, `${entry.id}: group ${g.hash.slice(0,8)} has ${g.parts.length} part(s)`);
    expect(g.count === g.parts.length, `${entry.id}: count matches parts.length`);
  }
  totalGroups += groups.length;
}
expect(totalGroups > 50 && totalGroups < 200, `Total groups across 28 templates: ${totalGroups} (expected 50-200)`);
```

- [ ] **Step 2: Run audit, verify FAIL**

```bash
npx tsx scripts/audit-part-drawings.ts
```
Expected: `Cannot find name 'hashPart'` etc.

- [ ] **Step 3: Implement hashPart + groupPartsForDrawing**

Append to `lib/render/part-drawing/grouping.ts`:

```ts
import { categorizePart, type PartCategory } from "@/lib/render/svg-views";

/**
 * Stable geometry hash. Identical hash → merge as ×N. Mirror parts get
 * different hashes (mortise/tenon X-position differs after mirror).
 */
export function hashPart(part: Part): string {
  const tenons = part.tenons
    .map((t) => `T:${t.position}|w:${(t as any).offsetWidth ?? 0}|t:${(t as any).offsetThickness ?? 0}|L:${(t as any).length ?? 0}|W:${(t as any).width ?? 0}|D:${(t as any).depth ?? 0}`)
    .sort()
    .join(";");
  const mortises = part.mortises
    .map((m) => `M:${m.position}|w:${(m as any).offsetWidth ?? 0}|t:${(m as any).offsetThickness ?? 0}|L:${(m as any).length ?? 0}|W:${(m as any).width ?? 0}|D:${(m as any).depth ?? 0}`)
    .sort()
    .join(";");
  return [
    `L:${part.visible.length}`,
    `W:${part.visible.width}`,
    `T:${part.visible.thickness}`,
    `S:${part.shape ? JSON.stringify(part.shape) : "box"}`,
    `t:${tenons}`,
    `m:${mortises}`,
  ].join("/");
}

export type PartDrawingGroup = {
  hash: string;
  parts: Part[];
  count: number;
  representative: Part;
  category: PartCategory | "unknown";
};

const CATEGORY_SORT_ORDER: Array<PartCategory | "unknown"> = [
  "case", "leg", "apron", "drawer", "door", "back", "hardware",
];

/**
 * Group parts by geometry hash. Mirror pairs (different X-mortise position)
 * get split into separate groups. Sorted by category, then by hash for stability.
 */
export function groupPartsForDrawing(design: FurnitureDesign): PartDrawingGroup[] {
  const triggered = design.parts.filter(needsPartDrawing);
  const byHash = new Map<string, Part[]>();

  for (const part of triggered) {
    const h = hashPart(part);
    const list = byHash.get(h) ?? [];
    list.push(part);
    byHash.set(h, list);
  }

  const groups: PartDrawingGroup[] = [];
  for (const [hash, parts] of byHash) {
    const representative = parts[0];
    const cat = categorizePart(representative.id);
    const category: PartCategory | "unknown" = CATEGORY_SORT_ORDER.includes(cat as any) ? cat : "unknown";
    groups.push({ hash, parts, count: parts.length, representative, category });
  }

  // Sort: known categories in CATEGORY_SORT_ORDER, unknown last; within
  // category, by representative.id alphabetically.
  groups.sort((a, b) => {
    const ai = CATEGORY_SORT_ORDER.indexOf(a.category);
    const bi = CATEGORY_SORT_ORDER.indexOf(b.category);
    const aIdx = ai === -1 ? CATEGORY_SORT_ORDER.length : ai;
    const bIdx = bi === -1 ? CATEGORY_SORT_ORDER.length : bi;
    if (aIdx !== bIdx) return aIdx - bIdx;
    return a.representative.id.localeCompare(b.representative.id);
  });

  return groups;
}
```

If `categorizePart` doesn't export `PartCategory` from `svg-views.tsx`, check the existing export at line ~2969 — it should be there.

If `CATEGORY_SORT_ORDER` strings don't match `PartCategory` enum values, run:

```bash
grep -n "type PartCategory" lib/render/svg-views.tsx
```

And adjust the array to match actual enum values.

- [ ] **Step 4: Run audit, verify PASS**

```bash
npx tsx scripts/audit-part-drawings.ts
```
Expected: all `✓`, exit code 0. Note the `Total groups across 28 templates` number — should be 50-200.

- [ ] **Step 5: Type check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add lib/render/part-drawing/grouping.ts scripts/audit-part-drawings.ts
git commit -m "feat(part-drawing): geometry hash + group with mirror split

零件圖 Phase 1 Task 2：
- hashPart(): stable hash of visible+shape+tenons+mortises sorted by position
- groupPartsForDrawing(): bucket by hash, mirror auto-split (X-mortise diff),
  sort by categorizePart() order (unknown last), alphabetical within
- audit asserts identical→merge, mirror→split, 28 templates produce 50-200 groups"
```

---

## Task 3: Extend OrthoView with isolatePartId

**Goal:** Add optional props to existing `OrthoView` component so it can render a single isolated part with auto-zoom.

**Files:**
- Modify: `lib/render/svg-views.tsx` (function `OrthoView` at line ~644)
- Create: `scripts/audit-isolate-part.ts`

### Steps:

- [ ] **Step 1: Read existing OrthoView signature**

```bash
sed -n '644,670p' lib/render/svg-views.tsx
```

Note the current props (likely: `design`, `view`, `title`, `titleEn`, `className`, `joineryMode`).

- [ ] **Step 2: Write failing audit**

Create `scripts/audit-isolate-part.ts`:

```ts
import { FURNITURE_CATALOG } from "@/lib/templates";
import { filterDesignForIsolation } from "@/lib/render/part-drawing/grouping";
import React from "react";
import { renderToString } from "react-dom/server";
import { OrthoView } from "@/lib/render/svg-views";

let fail = 0;
function expect(c: boolean, m: string) { if (c) console.log("✓", m); else { console.error("❌", m); fail++; } }

// Pick a template guaranteed to exist with multiple parts
const stool = FURNITURE_CATALOG.find((e) => e.id === "round-stool")!;
const design = stool.template!.build({});

// Full render
const fullSvg = renderToString(
  React.createElement(OrthoView, { design, view: "front", title: "正視", titleEn: "FRONT" } as any)
);
const fullPartCount = (fullSvg.match(/<g [^>]*data-part-id/g) ?? []).length;

// Pick first part that needs drawing
import { needsPartDrawing } from "@/lib/render/part-drawing/grouping";
const candidate = design.parts.find(needsPartDrawing);
if (!candidate) {
  console.error("no triggered part in round-stool — unexpected");
  process.exit(2);
}

// Isolated render via filterDesignForIsolation
const isoDesign = filterDesignForIsolation(design, candidate.id);
const isoSvg = renderToString(
  React.createElement(OrthoView, { design: isoDesign, view: "front", title: "test", titleEn: "" } as any)
);
const isoPartCount = (isoSvg.match(/<g [^>]*data-part-id/g) ?? []).length;

expect(isoPartCount === 1, `isolated render has 1 part (got ${isoPartCount})`);
expect(fullPartCount > 1, `full render has >1 part (got ${fullPartCount})`);

// Alternative: use isolatePartId prop directly (when implemented)
const propSvg = renderToString(
  React.createElement(OrthoView, { design, view: "front", title: "t", titleEn: "", isolatePartId: candidate.id } as any)
);
const propPartCount = (propSvg.match(/<g [^>]*data-part-id/g) ?? []).length;
expect(propPartCount === 1, `OrthoView with isolatePartId prop → 1 part (got ${propPartCount})`);

console.log(`\n${fail === 0 ? "✅ all pass" : `❌ ${fail} failure(s)`}`);
process.exit(fail);
```

NOTE: If existing OrthoView doesn't emit `data-part-id` attributes on per-part groups, change the regex to whatever DOES identify per-part elements (e.g. `<polygon` count, `<rect` count). Run with the existing component first to see what it outputs.

- [ ] **Step 3: Run audit, verify FAIL on `isolatePartId`**

```bash
npx tsx scripts/audit-isolate-part.ts
```
Expected: the first 2 expects pass (via filter helper), the 3rd FAILS (prop not yet supported, full render anyway).

- [ ] **Step 4: Add isolatePartId prop to OrthoView**

Open `lib/render/svg-views.tsx`. Find `export function OrthoView({` near line 644.

Add to the props destructure + type:

```tsx
export function OrthoView({
  design,
  view,
  title,
  titleEn,
  className,
  joineryMode = false,
  isolatePartId,          // ← NEW
  showDimensions = true,  // ← NEW
}: {
  design: FurnitureDesign;
  view: OrthoView;
  title: string;
  titleEn: string;
  className?: string;
  joineryMode?: boolean;
  isolatePartId?: string;  // ← NEW
  showDimensions?: boolean; // ← NEW
}) {
```

Immediately after the destructure, before any rendering logic:

```tsx
  // 零件圖隔離模式：if isolatePartId set, filter design.parts to that one
  // and recenter at origin. See lib/render/part-drawing/grouping.ts.
  const renderDesign = isolatePartId
    ? {
        ...design,
        parts: design.parts
          .filter((p) => p.id === isolatePartId)
          .map((p) => ({ ...p, origin: { x: 0, y: 0, z: 0 } })),
      }
    : design;
```

Then **replace every internal reference** to `design` in the OrthoView body with `renderDesign`. Use a careful find/replace within the function body only (NOT outside this function). Common patterns:

```
design.parts  → renderDesign.parts
extractFurnitureDims(design)  → extractFurnitureDims(renderDesign)
extractZoneBoundaryYs(design) → extractZoneBoundaryYs(renderDesign)
```

If you see `design` passed to a helper that does anything related to part rendering, change to `renderDesign`.

If `showDimensions === false`, wrap the dimension rendering blocks with a conditional. Look for `<DimensionLine ...>` and `<VerticalDimensionLine ...>` JSX — wrap them in `{showDimensions && <...>}`.

- [ ] **Step 5: Run audit, verify PASS**

```bash
npx tsx scripts/audit-isolate-part.ts
```
Expected: all 3 expects pass.

- [ ] **Step 6: Visual sanity check via dev server**

```bash
npm run dev
```

Open `http://localhost:3000/design/round-stool` in browser. Existing 三視圖 should render identically (no visual change because `isolatePartId` is undefined by default).

- [ ] **Step 7: Existing audit + tsc**

```bash
npx tsc --noEmit
npm run audit
```
Expected: green.

- [ ] **Step 8: Commit**

```bash
git add lib/render/svg-views.tsx scripts/audit-isolate-part.ts
git commit -m "feat(svg-views): OrthoView isolatePartId + showDimensions props

零件圖 Phase 1 Task 3：
- isolatePartId 啟用時 filter design.parts 到單件、recenter origin=(0,0,0)
- showDimensions=false 隱藏標註層（供 <PartDrawing> 自己畫）
- default 都 undefined/true → 既有三視圖完全不受影響
- audit: round-stool 全 render >1 part / isolate prop → 恰好 1 part"
```

---

## Task 4: `<PartDrawing>` skeleton (3 views, no dimensions)

**Goal:** New component that renders 3 views (front/side/top) for one part group, using OrthoView underneath. Just the layout shell + title bar; dimensions in Task 5.

**Files:**
- Create: `lib/render/part-drawing/drawing.tsx`

### Steps:

- [ ] **Step 1: Look at how 三視圖 lays out 3 views**

```bash
grep -n "ThreeViewLayout\|CompactThreeViews" lib/render/svg-views.tsx | head -5
```

Read those functions to learn the existing layout (grid / SVG viewBox conventions).

- [ ] **Step 2: Write the component**

Create `lib/render/part-drawing/drawing.tsx`:

```tsx
import React from "react";
import type { FurnitureDesign } from "@/lib/types";
import type { PartDrawingGroup } from "./grouping";
import { OrthoView } from "@/lib/render/svg-views";
import { MATERIALS } from "@/lib/materials";

interface PartDrawingProps {
  group: PartDrawingGroup;
  design: FurnitureDesign;
  /** Sequence number for this drawing (P-01, P-02, ...). */
  index: number;
  /** Override scale denominator; default auto from longest dimension. */
  scaleDenom?: number;
  className?: string;
}

function pickScale(part: PartDrawingGroup["representative"]): number {
  const max = Math.max(part.visible.length, part.visible.width, part.visible.thickness);
  // Standard ISO scale series, pick smallest that fits in ~280px viewport
  for (const s of [1, 2, 5, 10, 20]) {
    if (max / s <= 280) return s;
  }
  return 50;
}

/**
 * Single-part shop drawing card: 3 views + title bar.
 * Phase 1: layout only. T1/T2 dimensions added in next task.
 */
export function PartDrawing({ group, design, index, scaleDenom, className }: PartDrawingProps) {
  const part = group.representative;
  const scale = scaleDenom ?? pickScale(part);
  const partNo = `P-${String(index + 1).padStart(2, "0")}`;
  const titleSuffix = group.count > 1 ? ` ×${Math.min(group.count, 99)}${group.count > 99 ? "+" : ""}` : "";
  const material = MATERIALS[part.material];

  return (
    <div className={`print-keep border border-zinc-300 rounded p-3 bg-white ${className ?? ""}`}>
      {/* Title bar */}
      <div className="flex items-baseline justify-between border-b border-zinc-200 pb-1 mb-2">
        <h3 className="font-semibold text-sm">
          {part.nameZh}{titleSuffix}
        </h3>
        <span className="text-xs text-zinc-500 tabular-nums">
          比例 1:{scale}　{partNo}
        </span>
      </div>

      {/* 3 views grid */}
      <div className="grid grid-cols-3 gap-2">
        <OrthoView
          design={design}
          view="front"
          title="正視"
          titleEn="FRONT"
          isolatePartId={part.id}
          showDimensions={false}
        />
        <OrthoView
          design={design}
          view="top"
          title="俯視"
          titleEn="TOP"
          isolatePartId={part.id}
          showDimensions={false}
        />
        <OrthoView
          design={design}
          view="side"
          title="側視"
          titleEn="SIDE"
          isolatePartId={part.id}
          showDimensions={false}
        />
      </div>

      {/* Footer */}
      <div className="mt-2 text-[10px] text-zinc-600">
        材料：{material?.nameZh ?? part.material}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Add smoke test to audit**

Append to `scripts/audit-part-drawings.ts`:

```ts
import { PartDrawing } from "@/lib/render/part-drawing/drawing";
import { renderToString as renderPartDrawing } from "react-dom/server";

// Smoke: render PartDrawing for first group of round-stool — no crash
{
  const design = FURNITURE_CATALOG.find((e) => e.id === "round-stool")!.template!.build({});
  const groups = groupPartsForDrawing(design);
  expect(groups.length > 0, "round-stool has at least 1 group");
  const html = renderPartDrawing(
    React.createElement(PartDrawing, { group: groups[0], design, index: 0 } as any)
  );
  expect(html.includes("比例"), "renders title bar with 比例");
  expect(html.includes("P-01"), "renders P-01 sequence");
  expect((html.match(/<svg/g) ?? []).length === 3, "renders 3 SVG views");
}
```

NOTE: requires `import React from "react"` at top of audit script if not already there.

- [ ] **Step 4: Run audit, verify PASS**

```bash
npx tsx scripts/audit-part-drawings.ts
```

- [ ] **Step 5: Type check**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add lib/render/part-drawing/drawing.tsx scripts/audit-part-drawings.ts
git commit -m "feat(part-drawing): <PartDrawing> skeleton with 3-view layout

零件圖 Phase 1 Task 4：
- 3 OrthoView (正/俯/側) with isolatePartId + showDimensions=false
- 標題列：part nameZh + ×N badge + 比例 1:scale + P-NN 編號
- 底列：材料中文名
- audit smoke test renders 3 SVG, 標題正常"
```

---

## Task 5: T1 dimensions (overall L×W×T)

**Goal:** Add overall outer-dimension labels (length × width × thickness) to each view in `<PartDrawing>`.

**Files:**
- Modify: `lib/render/part-drawing/drawing.tsx`
- Create: `lib/render/part-drawing/annotation.tsx`

### Steps:

- [ ] **Step 1: Inspect existing DimensionLine helper**

```bash
grep -n "function DimensionLine\|function VerticalDimensionLine" lib/render/svg-views.tsx
```

Read those two functions. They're at line ~2834 and ~2878. Note their signatures: `(props: { x1, x2, y, label }) → <g>...</g>`. We'll reuse them.

- [ ] **Step 2: Decide: re-export or duplicate**

The simplest path is to **export** the existing `DimensionLine` and `VerticalDimensionLine` from `svg-views.tsx`. Open the file, find those functions, change `function` → `export function`.

- [ ] **Step 3: Build T1 overlay component**

Create `lib/render/part-drawing/annotation.tsx`:

```tsx
import React from "react";
import type { Part } from "@/lib/types";
import { DimensionLine, VerticalDimensionLine } from "@/lib/render/svg-views";

interface T1DimensionsProps {
  part: Part;
  view: "front" | "side" | "top";
  /** Inner SVG width/height (pixels) for placing labels at edges. */
  width: number;
  height: number;
  /** Padding from viewBox edge for label placement. */
  pad?: number;
}

/**
 * Overall outer dimensions (T1 tier): just L×W×T of the part, no joinery.
 * Placed outside the part silhouette. Phase 1: simple rule-based positioning,
 * no collision avoidance.
 */
export function T1Dimensions({ part, view, width, height, pad = 30 }: T1DimensionsProps) {
  const round1 = (n: number) => Math.round(n * 10) / 10;
  const L = round1(part.visible.length);
  const W = round1(part.visible.width);
  const T = round1(part.visible.thickness);

  // Per third-angle convention:
  //   front view: horizontal=length, vertical=thickness
  //   top view:   horizontal=length, vertical=width
  //   side view:  horizontal=width,  vertical=thickness
  const horiz = view === "side" ? W : L;
  const vert = view === "top" ? W : T;

  return (
    <g className="t1-dims" style={{ fontSize: 9 }}>
      {/* horizontal dim at bottom of view */}
      <DimensionLine
        x1={pad}
        x2={width - pad}
        y={height - 8}
        label={String(horiz)}
      />
      {/* vertical dim at right of view */}
      <VerticalDimensionLine
        y1={pad}
        y2={height - pad}
        x={width - 8}
        label={String(vert)}
      />
    </g>
  );
}
```

NOTE: if `DimensionLine` / `VerticalDimensionLine` signatures differ from `(x1, x2, y, label)`, adjust prop names. Read the function definitions before this step.

- [ ] **Step 4: Add T1 to PartDrawing**

In `lib/render/part-drawing/drawing.tsx`, wrap each OrthoView so the T1 overlay can sit on top. Simplest: add `<T1Dimensions>` as a sibling inside a `<div className="relative">`:

```tsx
import { T1Dimensions } from "./annotation";

// Inside the grid:
<div className="relative">
  <OrthoView
    design={design}
    view="front"
    title="正視"
    titleEn="FRONT"
    isolatePartId={part.id}
    showDimensions={false}
  />
  <svg className="absolute inset-0 pointer-events-none" viewBox="0 0 400 280" style={{ width: "100%", height: "100%" }}>
    <T1Dimensions part={part} view="front" width={400} height={280} />
  </svg>
</div>
```

Repeat for top and side views.

If overlay sizing is off, inspect OrthoView's viewBox values (likely 400×280 or similar — check lib/render/svg-views.tsx).

- [ ] **Step 5: Update audit smoke test**

In `scripts/audit-part-drawings.ts`, the existing render assertion should still pass. Add:

```ts
{
  const design = FURNITURE_CATALOG.find((e) => e.id === "round-stool")!.template!.build({});
  const groups = groupPartsForDrawing(design);
  const html = renderPartDrawing(React.createElement(PartDrawing, { group: groups[0], design, index: 0 } as any));
  // T1 dims should render the literal numeric values
  const L = String(Math.round(groups[0].representative.visible.length * 10) / 10);
  expect(html.includes(L), `T1: front view shows length ${L}`);
}
```

- [ ] **Step 6: Run audit + tsc**

```bash
npx tsx scripts/audit-part-drawings.ts
npx tsc --noEmit
```

- [ ] **Step 7: Visual check**

```bash
npm run dev
```

(After Task 7 wires panel into page, we can see this. For now this step is `(skip - tested via Task 7)`.)

- [ ] **Step 8: Commit**

```bash
git add lib/render/part-drawing/drawing.tsx lib/render/part-drawing/annotation.tsx lib/render/svg-views.tsx scripts/audit-part-drawings.ts
git commit -m "feat(part-drawing): T1 overall dimensions (L×W×T)

零件圖 Phase 1 Task 5：
- annotation.tsx: <T1Dimensions> 用既有 DimensionLine/VerticalDimensionLine
- export DimensionLine + VerticalDimensionLine from svg-views.tsx
- 每視圖底部/右側標一個尺寸（front: L, T / top: L, W / side: W, T）
- 數字 round 到 1 位小數（per feedback_ui_number_precision）"
```

---

## Task 6: T2 dimensions (joinery features)

**Goal:** Per mortise/tenon: draw a thin-dashed bounding box on each view + leader to text label «W×L 深 D，距底 X».

**Files:**
- Modify: `lib/render/part-drawing/annotation.tsx` (add T2Annotations)
- Modify: `lib/render/part-drawing/drawing.tsx` (use T2Annotations)

### Steps:

- [ ] **Step 1: Find existing local-box helpers**

```bash
grep -n "export function mortiseLocalBox\|export function tenonLocalBox\|export function projectFeatureRect" lib/render/svg-views.tsx
```

Confirm they're exported. If not, add `export` to them.

- [ ] **Step 2: Implement T2Annotations**

Append to `lib/render/part-drawing/annotation.tsx`:

```tsx
import {
  mortiseLocalBox,
  tenonLocalBox,
  projectFeatureRect,
} from "@/lib/render/svg-views";

interface T2AnnotationsProps {
  part: Part;
  view: "front" | "side" | "top";
  width: number;
  height: number;
}

/**
 * Joinery features (T2): bounding box per mortise/tenon + leader to label.
 * Phase 1: thin dashed box, label placed below in a simple stack — no
 * collision avoidance. Phase 2 will route leaders properly.
 */
export function T2Annotations({ part, view, width, height }: T2AnnotationsProps) {
  const round1 = (n: number) => Math.round(n * 10) / 10;

  type Feature = { kind: "mortise" | "tenon"; idx: number; localBox: ReturnType<typeof mortiseLocalBox> };
  const features: Feature[] = [
    ...part.mortises.map((m, idx) => ({ kind: "mortise" as const, idx, localBox: mortiseLocalBox(part, m) })),
    ...part.tenons.map((t, idx) => ({ kind: "tenon" as const, idx, localBox: tenonLocalBox(part, t) })),
  ];

  // Render rect on view + collect label texts to stack at bottom of view
  const rects: React.ReactNode[] = [];
  const labels: string[] = [];

  for (const f of features) {
    const rect = projectFeatureRect(part, view, f.localBox);
    if (!rect) continue; // not visible in this view

    rects.push(
      <rect
        key={`${f.kind}-${f.idx}-${view}`}
        x={rect.x}
        y={rect.y}
        width={rect.w}
        height={rect.h}
        fill="none"
        stroke="#444"
        strokeWidth={0.6}
        strokeDasharray="2 2"
      />
    );

    // Build text label
    const m = f.kind === "mortise" ? part.mortises[f.idx] : part.tenons[f.idx];
    const W = round1((m as any).width ?? 0);
    const L = round1((m as any).length ?? 0);
    const D = round1((m as any).depth ?? 0);
    const fromBottom = round1(f.localBox.y);
    const prefix = f.kind === "mortise" ? `榫眼${f.idx + 1}` : `榫頭${f.idx + 1}`;
    labels.push(`${prefix}: ${W}×${L} 深${D}，距底${fromBottom}`);
  }

  return (
    <g className="t2-annotations" style={{ fontSize: 8, fontFamily: "monospace" }}>
      {rects}
    </g>
  );
}

/**
 * Standalone list of joinery labels (rendered as text rows below the views).
 */
export function T2LabelList({ part }: { part: Part }) {
  const round1 = (n: number) => Math.round(n * 10) / 10;
  const lines: string[] = [];
  part.mortises.forEach((m, idx) => {
    const W = round1((m as any).width ?? 0);
    const L = round1((m as any).length ?? 0);
    const D = round1((m as any).depth ?? 0);
    const lb = mortiseLocalBox(part, m);
    lines.push(`榫眼${idx + 1}（${m.position}）：${W}×${L} 深 ${D}，距底 ${round1(lb.y)}`);
  });
  part.tenons.forEach((t, idx) => {
    const W = round1((t as any).width ?? 0);
    const L = round1((t as any).length ?? 0);
    const D = round1((t as any).depth ?? 0);
    const lb = tenonLocalBox(part, t);
    lines.push(`榫頭${idx + 1}（${t.position}）：${W}×${L} 長 ${D}，距底 ${round1(lb.y)}`);
  });
  if (!lines.length) return null;
  return (
    <ul className="text-[10px] text-zinc-700 list-none mt-1 space-y-0.5 font-mono">
      {lines.map((l, i) => <li key={i}>{l}</li>)}
    </ul>
  );
}
```

- [ ] **Step 3: Wire T2 into PartDrawing**

In `lib/render/part-drawing/drawing.tsx`:

```tsx
import { T2Annotations, T2LabelList } from "./annotation";
```

In each view overlay SVG, add `<T2Annotations part={part} view="front" width={400} height={280} />` next to T1Dimensions.

After the views grid, before the footer:

```tsx
<T2LabelList part={part} />
```

- [ ] **Step 4: Add audit test**

Append to `scripts/audit-part-drawings.ts`:

```ts
// T2 should render a label list when part has joinery
{
  const design = FURNITURE_CATALOG.find((e) => e.id === "square-stool")!.template!.build({});
  const groups = groupPartsForDrawing(design);
  // Find a group whose representative has mortises
  const groupWithMortise = groups.find((g) => g.representative.mortises.length > 0);
  if (groupWithMortise) {
    const html = renderPartDrawing(
      React.createElement(PartDrawing, { group: groupWithMortise, design, index: 0 } as any)
    );
    expect(html.includes("榫眼"), "T2: 榫眼 label appears");
    expect(html.includes("距底"), "T2: 距底 reference appears");
  } else {
    console.log("⚠ square-stool no mortise group — skipping T2 label check");
  }
}
```

- [ ] **Step 5: Run audit + tsc**

```bash
npx tsx scripts/audit-part-drawings.ts
npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add lib/render/part-drawing/annotation.tsx lib/render/part-drawing/drawing.tsx scripts/audit-part-drawings.ts
git commit -m "feat(part-drawing): T2 joinery annotations + label list

零件圖 Phase 1 Task 6：
- T2Annotations: 每 mortise/tenon 在 3 視圖各畫一個細虛 box (dash 2 2)
  reuse mortiseLocalBox/tenonLocalBox/projectFeatureRect
- T2LabelList: 卡片底列文字「榫眼N（位置）：W×L 深D，距底X」
- 中文+mm+1 位小數（per feedback_ui_number_precision）
- 不做 leader 連線、文字避撞——Phase 2 才做"
```

---

## Task 7: PartDrawingsPanel (interactive)

**Goal:** New component for the design page. List groups, click → modal with full PartDrawing.

**Files:**
- Create: `components/design/PartDrawingsPanel.tsx`
- Modify: `app/design/[type]/page.tsx` (insert panel)

### Steps:

- [ ] **Step 1: Locate where ThreeViewLayout renders on design page**

```bash
grep -n "ThreeViewLayout\|CompactThreeViews\|svg-views" app/design/\[type\]/page.tsx
```

Note the surrounding markup so we can insert below it.

- [ ] **Step 2: Build PartDrawingsPanel**

Create `components/design/PartDrawingsPanel.tsx`:

```tsx
"use client";

import React, { useState } from "react";
import type { FurnitureDesign } from "@/lib/types";
import { groupPartsForDrawing } from "@/lib/render/part-drawing/grouping";
import { PartDrawing } from "@/lib/render/part-drawing/drawing";

interface Props {
  design: FurnitureDesign;
}

export function PartDrawingsPanel({ design }: Props) {
  const groups = groupPartsForDrawing(design);
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  if (!groups.length) return null;

  return (
    <section className="mt-8 border-t border-zinc-200 pt-6">
      <div className="mb-4">
        <h2 className="text-lg font-bold">零件圖</h2>
        <p className="text-xs text-zinc-500 mt-0.5">共 {groups.length} 件（合併同形）</p>
      </div>

      {/* List */}
      <ul className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {groups.map((g, idx) => (
          <li key={g.hash}>
            <button
              type="button"
              className="w-full text-left border border-zinc-300 rounded p-2 hover:bg-zinc-50 transition"
              onClick={() => setOpenIdx(idx)}
            >
              <div className="text-sm font-semibold">
                {g.representative.nameZh}
                {g.count > 1 ? <span className="text-zinc-500 ml-1">×{Math.min(g.count, 99)}{g.count > 99 ? "+" : ""}</span> : null}
              </div>
              <div className="text-[10px] text-zinc-500 mt-0.5">
                P-{String(idx + 1).padStart(2, "0")} · {g.representative.visible.length}×{g.representative.visible.width}×{g.representative.visible.thickness}
              </div>
            </button>
          </li>
        ))}
      </ul>

      {/* Modal */}
      {openIdx !== null ? (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          onClick={() => setOpenIdx(null)}
        >
          <div
            className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center p-3 border-b border-zinc-200">
              <h3 className="font-semibold">零件圖 — {groups[openIdx].representative.nameZh}</h3>
              <button
                type="button"
                className="text-zinc-500 hover:text-zinc-900 text-xl leading-none"
                onClick={() => setOpenIdx(null)}
                aria-label="關閉"
              >
                ×
              </button>
            </div>
            <div className="p-4">
              <PartDrawing group={groups[openIdx]} design={design} index={openIdx} />
              <div className="flex justify-between mt-4 text-sm">
                <button
                  type="button"
                  disabled={openIdx === 0}
                  className="text-zinc-700 disabled:text-zinc-300"
                  onClick={() => setOpenIdx((i) => (i === null || i === 0 ? i : i - 1))}
                >
                  ← 上一件
                </button>
                <span className="text-zinc-500">{openIdx + 1} / {groups.length}</span>
                <button
                  type="button"
                  disabled={openIdx === groups.length - 1}
                  className="text-zinc-700 disabled:text-zinc-300"
                  onClick={() => setOpenIdx((i) => (i === null || i === groups.length - 1 ? i : i + 1))}
                >
                  下一件 →
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
```

- [ ] **Step 3: Wire into design page**

In `app/design/[type]/page.tsx`, add import:

```tsx
import { PartDrawingsPanel } from "@/components/design/PartDrawingsPanel";
```

After the existing 三視圖 / ThreeViewLayout JSX block (in the design page rendering), insert:

```tsx
<PartDrawingsPanel design={design} />
```

Exact insertion line depends on the file's current structure — find the closing tag of the 三視圖 wrapper and add the panel as a sibling immediately below.

- [ ] **Step 4: Dev server visual check**

```bash
lsof -i:3000 -sTCP:LISTEN | awk 'NR>1{print $2}' | xargs -r kill
npm run dev
```

Browser to `http://localhost:3000/design/round-stool`. Expect:
- 三視圖 unchanged
- Below it, a "零件圖" section with grid of part buttons
- Clicking a button opens modal with full PartDrawing
- ← → navigation works between parts
- × closes modal

- [ ] **Step 5: tsc + audit**

```bash
npx tsc --noEmit
npm run audit
```

- [ ] **Step 6: Commit**

```bash
git add components/design/PartDrawingsPanel.tsx app/design/\[type\]/page.tsx
git commit -m "feat(part-drawing): PartDrawingsPanel interactive list on design page

零件圖 Phase 1 Task 7：
- /design/[type] 在三視圖下方加 inline section
- 卡片網格列零件群組（合併同形後）每張：nameZh + ×N + P-NN + L×W×T
- 點開 modal 顯示完整 <PartDrawing> + ← → 上下件導航 + × 關閉
- groups.length === 0 時整段不渲染（無零件圖需求的家具不顯示）"
```

---

## Task 8: PrintPartDrawings (print section, 2×2 grid)

**Goal:** Print page section with 2×2 grid of `<PartDrawing>` cards, sized for A4 print.

**Files:**
- Create: `components/print/PrintPartDrawings.tsx`
- Modify: `app/design/[type]/print/page.tsx`

### Steps:

- [ ] **Step 1: Build PrintPartDrawings**

Create `components/print/PrintPartDrawings.tsx`:

```tsx
import React from "react";
import type { FurnitureDesign } from "@/lib/types";
import { groupPartsForDrawing } from "@/lib/render/part-drawing/grouping";
import { PartDrawing } from "@/lib/render/part-drawing/drawing";

interface Props {
  design: FurnitureDesign;
}

export function PrintPartDrawings({ design }: Props) {
  const groups = groupPartsForDrawing(design);

  if (!groups.length) return null;

  return (
    <section data-print-page className="px-10 py-12">
      <div className="mb-4 pb-2 border-b-2 border-zinc-900">
        <h2 className="text-2xl font-bold">零件圖</h2>
        <p className="text-xs text-zinc-500 mt-0.5">
          共 {groups.length} 件（合併同形後）—— 每張含三視圖 + 主要尺寸 + 榫卯位置
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {groups.map((g, idx) => (
          <PartDrawing key={g.hash} group={g} design={design} index={idx} />
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Insert into print page**

Open `app/design/[type]/print/page.tsx`.

Find the JoineryDetail closing `)}` (approximate line ~223) and PrintToolList opening (~line 231).

Add import:

```tsx
import { PrintPartDrawings } from "@/components/print/PrintPartDrawings";
```

After the JoineryDetail section closes, before `<PrintToolList />`:

```tsx
<PrintPartDrawings design={design} />
```

Exact placement: find the markup pattern where JoineryDetail is rendered inside `{usages.length > 0 && (...)}` block, then immediately after that block.

- [ ] **Step 3: Print preview check**

```bash
npm run dev
```

Browser to `http://localhost:3000/design/round-stool/print`. Press Cmd+P to preview.

Expect:
- Existing pages render normally
- New page "零件圖" appears between 榫卯細節圖 and 工具清單
- 2 columns of cards
- No overflow / cards stay intact across page breaks

- [ ] **Step 4: tsc + audit**

```bash
npx tsc --noEmit
npm run audit
```

- [ ] **Step 5: Commit**

```bash
git add components/print/PrintPartDrawings.tsx "app/design/[type]/print/page.tsx"
git commit -m "feat(part-drawing): PrintPartDrawings 2×2 grid section in print page

零件圖 Phase 1 Task 8：
- 印製頁順序：cover → 三視 → 材料單 → 榫卯細節圖 → 【零件圖】→ 工具 → 工序
- 2×2 grid (4 件/頁)，每張 .print-keep 避免分頁切斷
- groups.length===0 時整段不渲染（純方料 furniture 無零件圖）"
```

---

## Task 9: 28-template audit + final verification

**Goal:** Confirm Phase 1 acceptance criteria across all 28 furniture templates.

**Files:**
- Modify: `scripts/audit-part-drawings.ts` (add multi-template smoke)

### Steps:

- [ ] **Step 1: Add comprehensive template smoke test**

Append to `scripts/audit-part-drawings.ts`:

```ts
// Comprehensive: every template must render PartDrawing for every group without crashing
console.log("\n--- Comprehensive 28-template smoke ---");
let crashCount = 0;
for (const entry of FURNITURE_CATALOG) {
  if (!entry.template) continue;
  try {
    const design = entry.template.build({});
    const groups = groupPartsForDrawing(design);
    for (const g of groups) {
      const html = renderPartDrawing(
        React.createElement(PartDrawing, { group: g, design, index: 0 } as any)
      );
      if (!html || html.length < 100) {
        console.error("❌", entry.id, "group", g.hash.slice(0, 12), "tiny output");
        crashCount++;
      }
    }
    console.log("✓", entry.id, `${groups.length} group(s) rendered`);
  } catch (e: any) {
    console.error("❌", entry.id, "CRASH:", e.message);
    crashCount++;
  }
}
expect(crashCount === 0, `${crashCount} template crash/empty (must be 0)`);
```

- [ ] **Step 2: Run audit**

```bash
npx tsx scripts/audit-part-drawings.ts
```

Expected: every template prints `✓`, final summary `0 template crash/empty`.

If a template crashes, fix the underlying issue in PartDrawing / OrthoView. Common causes:
- A shape variant not handled in OrthoView when isolated
- A part with empty visible dimensions
- A category not in CATEGORY_SORT_ORDER (should fall to "unknown")

Iterate fix → re-run audit until all 28 pass.

- [ ] **Step 3: Full existing-audit + tsc**

```bash
npx tsc --noEmit
npm run audit
```

Expected: no regression.

- [ ] **Step 4: Manual visual sanity (5 representative templates)**

```bash
npm run dev
```

Browse these and confirm:
- `/design/round-stool` — interactive panel + modal navigation
- `/design/round-stool/print` — print preview, 零件圖 section appears
- `/design/dining-chair` — multiple part categories
- `/design/wardrobe` — case furniture (may have few or zero parts → section should hide cleanly)
- `/design/coat-rack` — round / lathe-turned parts

For each, take a screenshot via DevTools or Playwright as record.

- [ ] **Step 5: Cross-check ×N count vs material list**

Pick one template (e.g. square-stool). Compare:
- Number of 腿 in 材料單 (BOM)
- ×N count on 腿 group in zero件圖 panel

Should match exactly (or count = 1 if mirror split into left/right).

- [ ] **Step 6: Commit final + note backlog**

```bash
git add scripts/audit-part-drawings.ts
git commit -m "test(part-drawing): comprehensive 28-template smoke + Phase 1 done

零件圖 Phase 1 Task 9（驗收）：
- audit-part-drawings.ts 跑遍 28 模板每個 group 都 render 不 crash
- npm run audit 不退步
- npx tsc --noEmit 零錯
- 5 模板 visual sanity 過

Phase 1 done. 下階段 spec：見 docs/superpowers/specs/2026-05-16-part-drawings-design.md §8
（木紋箭頭 / 面向記號 / 3D 縮圖 / 配對 ID / butt-joint 宣告 / 毛料雙標 → Phase 2）"
```

- [ ] **Step 7: Push if user signed off**

User must approve before push. After approval:

```bash
git push origin main
```

---

## Phase 1 Acceptance Checklist

After all 9 tasks complete, verify:

- [ ] 28 模板每個跑 design page + print page，零 crash（Task 9 step 2）
- [ ] `tsc --noEmit` 零錯（Task 9 step 3）
- [ ] `scripts/audit-overlaps.ts` 不退步（`npm run audit` Task 9 step 3）
- [ ] 隨抽 5 個 part 比對 spec 上的 `visible.length` 跟圖上 L 一致（Task 9 step 4 manual）
- [ ] 合併 ×N 數量 = 材料單同類 part 數量（Task 9 step 5）

---

## Notes for executor agents

1. **Read the spec first.** `docs/superpowers/specs/2026-05-16-part-drawings-design.md` v2. Especially §2 (合併規則), §3 (排序), §5 (架構).

2. **Don't mutate beyond spec.** If you find a "great idea" while implementing (e.g. "let's add grain arrows!"), STOP — that's Phase 2. Note it in the commit message as "deferred to Phase 2" and move on.

3. **OrthoView is shared with the existing 三視圖.** Test that the existing three-view page still renders identically after Task 3. Don't break it.

4. **Audit before commit.** Every task ends with `npx tsc --noEmit && npm run audit && npx tsx scripts/audit-part-drawings.ts` all green before committing.

5. **Memory rule: 配對幾何常數要一起改.** If you touch a shrink/clearance constant in OrthoView, grep for the matching constant in `lib/render/geometry.ts` and confirm consistency.

6. **Memory rule: 視覺 bug 自跑到對.** If a part renders wrong, screenshot via playwright and fix yourself — don't ask user. Iterate until correct.

7. **Memory rule: commit 前查 staged 檔.** Before each commit, run `git status` to make sure only intended files are staged.

8. **DO NOT push without user approval.** Local commits are fine; push (`git push`) requires explicit user signoff.
