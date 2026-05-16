# Geometry helper coverage for single-part shop drawings

## Reusable helpers from svg-views.tsx

| Helper | File:Line | Signature | Status | Notes |
|--------|-----------|-----------|--------|-------|
| `mortiseLocalBox` | svg-views.tsx:543 | `(part, mortise) => LocalBox` | ✅ Reusable | Returns part-local AABB with depth inference, clipping, cosmetic rotX support (line 613); fully usable for isolated part |
| `tenonLocalBox` | svg-views.tsx:476 | `(part, tenon) => LocalBox` | ✅ Reusable | Returns part-local tenon box; handles all 6 positions + offsetWidth/offsetThickness asymmetry (line 489-501) |
| `tenonShoulderBox` | svg-views.tsx:458 | `(part, tenon) => LocalBox` | ✅ Reusable | Returns shoulder (fillet) box; same 6 position logic, used in joinery annotation |
| `makeProjector` | svg-views.tsx:235 | `(part, view) => (x,y,z) => {x,y}` | ✅ Reusable | Part-local XYZ → SVG coords; invoked implicitly by projection helpers |
| `projectFeatureRect` | svg-views.tsx:320 | `(part, view, rect: LocalBox) => {x,y,w,h}` | ✅ Reusable | Projects LocalBox → SVG rect; used for mortise/tenon visualization (line 320-340) |
| `projectFeaturePolygon` | svg-views.tsx:341 | `(part, view, polygon) => SVG path` | ✅ Reusable | Projects LocalBox → polygon outline; handles chamfer chamferStyle (line 341-455) |
| `convexHull2DLocal` | svg-views.tsx:265 | `(pts: {x,y}[]) => {x,y}[]` | ✅ Reusable | Graham scan convex hull; used for silhouette outline (line 265-287) |
| `categorizePart` | svg-views.tsx:3019 | `(partId: string) => PartCategory` | ✅ Optional | Classifies part by ID prefix (leg/stretcher/frame/etc); useful for single-part styling |
| `partFill` | svg-views.tsx:217 | `(part: Part) => string` | ✅ Optional | Returns CSS color; useful for single-part rendering (line 217-223) |

## Shape variant silhouette coverage in OrthoView

Audit of `OrthoView` component (lines 644–2850) and `projectPartSilhouette` from geometry.ts (lines 31–240):

| shape.kind | Front view | Side view | Top view | Implementation | Gaps |
|-----------|-------------|-----------|----------|-----------------|------|
| **box** | ✅ AABB rect | ✅ AABB rect | ✅ AABB rect | Simple bounds via `worldExtents()` + minor AABB checks. **Caveat:** non-quarter rotation → falls back to `projectPartSilhouette` (line 1181) which samples 3D corners, rotates, projects → convex hull. Accurate. | None for axis-aligned; handles non-quarter rotation correctly |
| **tapered** | ✅ Trapezoid | ✅ Trapezoid | ✅ Trapezoid | `projectPartSilhouette` lines 56, 169–171: scales bottom face by `bottomScale` along both X & Z axes; linear interpolation gives proper trapezoid. **Fixed 2026-05-01** — previously only scaled X in silhouette. | None; fully correct as of latest code |
| **splayed** | ✅ Trapezoid | ✅ Trapezoid | ✅ Special | `projectPartSilhouette` lines 62–66, 178–179: bottom face offset by `(dxMm, dzMm)` via linear interpolation. Front/side show trapezoid; **top view renders two rectangles** (top + bottom offset) + 4 connector lines (lines 1230–1250) to show tilt visually. | None; deliberate dual-rect visualization for clarity |
| **hoof** | ✅ Not explicit | ✅ Not explicit | ✅ Not explicit | **Not in `projectPartSilhouette` branch.** SVG rendering relies on `worldExtents()` approximate bounding box. S-curve geometry (外撇 + 馬蹄) only visible in 3D Perspective; 2D orthographic treats as simple tapered leg. | ⚠️ Silhouette inaccurate: shows box/tapered, not true S-curve profile |
| **round** | ✅ Rect | ✅ Rect | ✅ Circle | Line 1041–1169: Front/side draw rectangle (diameter × height); top view draws circle. `projectPartSilhouette` line 83–84 flags `isRound=true`, samples 16 points around perimeter (line 133–136), convex hull to circle. | None; correct |
| **round-tapered** | ✅ Trapezoid | ✅ Trapezoid | ✅ Circle | `projectPartSilhouette`: `isRound=true` + `tapered` scale applied per sample. Samples around perimeter at each height level, linearly scaled → cone silhouette. | None; correct |
| **shaker** | ✅ Compound | ✅ Compound | ✅ Compound | No explicit special case in `OrthoView`. Shape is `{ kind: "shaker", squareFrac, bottomScale }`. **Likely falls back to bounding box** — no dedicated `projectPartSilhouette` branch (not listed lines 48–82). Should be treated as **tapered** with top square (squareFrac %) + bottom cone. | ⚠️ **Gap:** No `projectPartSilhouette` branch; silhouette probably inaccurate (missing top-square transition) |
| **lathe-turned** | ✅ Stepped outline | ✅ Stepped outline | ✅ Circle | Lines 1006–1039: Hard-coded `LATHE_SEG` array (12 segments) draws stepped profile in front/side (right + left curves meet at edges). Top view: circle. No `projectPartSilhouette` branch but explicit special case handles it. | None for predefined segments; silhouette matches 3D car-turned profile. **Caveat:** segments are hard-coded, not parameterized. |
| **splayed-tapered** | ✅ Trapezoid | ✅ Trapezoid | ✅ Special | `projectPartSilhouette` lines 56–66: combines `tapered` (bottomScale on X/Z) + `splay` (dx/dz offset). Top view (lines 1334–1380): two rectangles + 4 diagonal corner lines, visual indicator of tilt. | None; consistent with splayed rendering |
| **splayed-round-tapered** | ✅ Cone + splay | ✅ Cone + splay | ✅ Two circles + tangents | Lines 1054–1157: Top view shows top circle (real position) + bottom circle (foot position, dashed) + 2 external tangent lines. `projectPartSilhouette` applies both `isRound` sampling + `splay` interpolation. Front/side: cone silhouette (no special splay visual; axis-aligned cone). | None for top view; front/side might benefit from splay indicator (tangent lines) but not critical for shop drawing |
| **apron-trapezoid** | ✅ Trapezoid | ✅ Trapezoid | ✅ Trapezoid | `projectPartSilhouette` lines 48, 172–174: top/bottom scale applied to length axis per Z endpoint (`topLengthScale` vs `bottomLengthScale`). Linear interpolation gives smooth trapezoid. | None; correct |
| **apron-beveled** | ✅ Sheared quad | ✅ Sheared quad | ✅ Sheared quad | `projectPartSilhouette` line 49, 51–52, 200–202: Applies shear `zLocal -= yLocal * tan(bevelAngle)` to Z coordinates; transforms rectangle to parallelogram. | None; correct |
| **apron-half-beveled** | ✅ Sheared (top only) | ✅ Sheared (top only) | ✅ Sheared (top only) | Lines 50, 198, 200: Only top face (ezSamp < 0) gets shear; bottom stays axis-aligned. | None; correct |
| **chamfered-top** | ✅ Chamfered rect | ✅ Chamfered rect | ✅ Rect (unchanged in 2D) | `projectPartSilhouette` line 177–180: treated as "boxLikeShape"; silhouette shows outer AABB. **2D orthographic doesn't show chamfer edges** — only visible as subtle outline reduction in 3D. Top view still shows full plan rectangle. | ⚠️ Minor: Chamfer top edges invisible in 2D orthographic; only visible in 3D or angled views |
| **chamfered-edges** | ✅ Octagonal outline | ✅ Octagonal outline | ✅ Octagonal outline | `projectPartSilhouette` line 177–180: "boxLikeShape" + non-quarter rotation detection invokes full 3D sampling. Sampling 16 points around chamfer (or 4 corners if no chamfer detail) → convex hull gives near-octagonal silhouette when chamfer angle = 45°. | None; accurate |
| **arch-bent** | ✅ Curved outline | ✅ Curved outline | ✅ Two curved outlines | Lines 842–926 (front), 928–1005 (top): Explicit special cases. Samples along X axis (segments=16 default), applies `archDz = bendMm × (1 - t²)`, rotates by `rotation.x` (rake), classifies edge visibility (HLE). Top view: top + bottom outlines + connectors. | None for standard arch; correct for Windsor bow-type |
| **tilt-z** | ✅ Parallelogram | ✅ Parallelogram | ✅ Trapezoid | Lines 1186, 2501–2560: `projectPartSilhouette` line 72, 182: Z offset `topShiftMm` applied linearly per Y. Top view explicit special case (lines 1196–1250): top/bottom corners projected with rotation + z-shear, visual parallelepiped. | None; correct |
| **notched-corners** | ✅ Rect minus 4 corners | ✅ Rect minus 4 corners | ✅ Rect minus 4 corners | `projectPartSilhouette` not yet implemented. **Falls back to bounding box** — silhouette shows full rectangle, not cut corners. | ⚠️ **Gap:** Notches invisible in orthographic projection |
| **finger-joint-ends** | ✅ Comb silhouette | ✅ Comb silhouette | ✅ Rect (no comb) | `projectPartSilhouette` not explicit. **Falls back to AABB** — front/side views show rectangle outline. Comb teeth not rendered in 2D. Top view always rectangle (per line 323 spec). | ⚠️ **Gap:** Finger-joint detail (comb) invisible in front/side orthographic |
| **dovetail-ends** | ✅ Trapezoid comb | ✅ Trapezoid comb | ✅ Rect (no comb) | No `projectPartSilhouette` branch. **Falls back to AABB.** Dovetail pins/tails would need explicit sampling. | ⚠️ **Gap:** Dovetail detail not visible; shows plain rectangle |
| **face-rounded** | ✅ Rounded rect (X-Z plane) | ✅ Rounded rect | ✅ Rect | `projectPartSilhouette` not explicit; "boxLikeShape" AABB applied. **Rounded corners visible only in 3D/perspective**, not in orthographic projections of X-Z faces. | ⚠️ Minor: Corner rounding not visible in 2D orthographic |
| **live-edge** | ✅ Wavy outline | ✅ Wavy outline | ✅ Rect | No explicit `projectPartSilhouette` handling. **Falls back to AABB**. Wavy edge visible only in 3D. | ⚠️ **Gap:** Wave geometry invisible in 2D; shows rect |
| **seat-scoop** | ✅ Rect (AABB) | ✅ Rect (AABB) | ✅ Rect (AABB) | Per line 295 spec: "俯視/前視/側視仍以矩形 bbox 顯示". **By design, scoop invisible in 2D.** Only visible as curved surface in 3D. | ✅ Intentional (spec says AABB only) |
| **mitered-ends** | ✅ Trapezoid (45° ends) | ✅ Trapezoid (45° ends) | ✅ Trapezoid | `projectPartSilhouette` line 74, 112–118: `mitered.vertices` direct 8-vertex input → convex hull (trapezoid). If no vertices, falls back to AABB. **Reverse-method (vertices=[8 points])** supports complex mitered geometry. | None if using vertices; ⚠️ if falling back to AABB, ends not shown |
| **mitered-corner** | ✅ Pentagon/hexagon | ✅ Pentagon/hexagon | ✅ Pentagon/hexagon | `projectPartSilhouette` line 81, 204–234: Detects cut corner, skips original corner vertex, inserts two inset edge points → convex hull gives 45°-cut silhouette. | None; correct |
| **regular-polygon** | ✅ N-gon | ✅ Rectangle | ✅ N-gon | `projectPartSilhouette` not explicit. Likely falls back to bounding box (rectangle), losing polygon facets except in top view if special handling exists. | ⚠️ **Gap:** Front/side views show rect instead of N-gon outline |
| **right-triangle** | ✅ Triangle | ✅ Triangle | ✅ Triangle | `projectPartSilhouette` line 77–79, 142–145: Skips one corner (X-Z plane diagonal), keeps 3 others → convex hull = right triangle. All views show triangle. | None; correct |

---

## Key findings and gaps

### Fully reusable for single-part (no modifications needed)
1. **`mortiseLocalBox` + `tenonLocalBox`** — Core joinery anatomy; works perfectly in isolation
2. **Projection helpers** (`projectFeatureRect`, `projectFeaturePolygon`) — Already designed for single features
3. **Silhouettes for box/tapered/splayed/round/lathe-turned/arch-bent** — All have explicit or convex-hull branches in `projectPartSilhouette`

### Notable gaps (would need augmentation for shop drawings)
| Shape | Issue | Recommendation |
|-------|-------|-----------------|
| **shaker** | No `projectPartSilhouette` branch; falls back to AABB | Add branch: `squareFrac` top portion + `bottomScale` cone blend |
| **notched-corners** | Notches invisible | Would need corner-clip sampling in `projectPartSilhouette` |
| **finger-joint-ends** | Comb teeth invisible in front/side | Explicit comb polygon generation (segments) |
| **dovetail-ends** | Pins/tails invisible | Trapezoid comb generation per `segmentCount` + `angleDeg` |
| **face-rounded** / **chamfered-top** | Rounding invisible in orthographic | Document as "visible in 3D only" or add subtle highlight edge |
| **live-edge** | Waves invisible | Document as "3D feature" or sample wave function along outline |
| **regular-polygon** | Front/side show rect instead of facets | Sample polygon vertices at Z extremes → hull |

---

## Single-part extraction strategy (recommendation)

### Best approach: **Extend `OrthoView` with isolated mode**

**Why:** 
- `OrthoView` already handles all shape types and projection logic
- Mortise/tenon visualization is already supported via `joineryMode` boolean
- No need to duplicate 2500+ lines of silhouette, HLE, dimension logic

**Implementation sketch:**

```typescript
// lib/render/svg-views.tsx
export function OrthoView({
  design,
  view,
  title,
  titleEn,
  className,
  joineryMode = false,
  isolatePartId?: string,  // ← NEW
  showDimensions = true,    // ← NEW
}: ViewProps & { ... }) {
  // If isolatePartId, filter design.parts to [specified part]
  // and transform to local origin:
  const partsToRender = isolatePartId
    ? design.parts
        .filter(p => p.id === isolatePartId)
        .map(p => ({
          ...p,
          origin: { x: 0, y: -p.visible.thickness / 2, z: 0 },  // Center in local frame
        }))
    : design.parts;

  // Rest of OrthoView logic unchanged, but uses partsToRender
  // Dimension lines auto-scale to part size (already proportional)
  
  return (
    <svg viewBox={...}>
      {/* existing rendering */}
      {partsToRender.map(part => {
        // ... existing silhouette logic
      })}
    </svg>
  );
}
```

### Helper for per-part shop drawing generation:

```typescript
// lib/render/part-drawing.tsx (new file)
export function PartDrawingViews({
  part,
  design,
  showJoinery = false,
}: {
  part: Part;
  design: FurnitureDesign;
  showJoinery?: boolean;
}) {
  return (
    <div className="grid grid-cols-3 gap-4">
      <OrthoView
        design={design}
        view="front"
        title={part.nameZh}
        titleEn="Front"
        isolatePartId={part.id}
        joineryMode={showJoinery}
      />
      <OrthoView
        design={design}
        view="side"
        title={part.nameZh}
        titleEn="Side"
        isolatePartId={part.id}
        joineryMode={showJoinery}
      />
      <OrthoView
        design={design}
        view="top"
        title={part.nameZh}
        titleEn="Top"
        isolatePartId={part.id}
        joineryMode={showJoinery}
      />
    </div>
  );
}
```

### Remaining work:

1. **Test shape coverage** — Audit each of the 22 shape kinds above; ensure `projectPartSilhouette` handles all or document as "visible in 3D only"
2. **Dimension line scaling** — For single small part, adjust `DIM_OFFSET` (line 63) and padding to fit page properly
3. **Joinery annotation** — Leverage existing `mortiseLocalBox`/`tenonLocalBox` + `projectFeatureRect` to render dimension labels on mortises/tenons in isolation
4. **Material legend** — Optional: add single-part material callout (wood type, grain direction) in corner
5. **Close the 7 gaps** (shaker, notched-corners, finger-joint, dovetail, live-edge, regular-polygon) — either as separate `projectPartSilhouette` branches or documented limitations

---

## Summary table: ready-to-reuse helpers

| Helper | Why useful | Risk level |
|--------|-----------|-----------|
| `mortiseLocalBox(part, mortise)` | Gives local bounding box; ready to project onto any view | ✅ Zero |
| `tenonLocalBox(part, tenon)` | Symmetric; handles all positions + offsets | ✅ Zero |
| `projectFeatureRect(part, view, localBox)` | Turns box → SVG rect directly | ✅ Zero |
| `OrthoView(..., isolatePartId)` | One-stop shop; all silhouettes + HLE + dims | 🟡 Moderate (needs testing on all shape variants) |
| `categorizePart(id)` | Cosmetic labeling (leg vs. stretcher vs. frame) | ✅ Zero |

**Effort estimate for Phase 1 (MVP):** 2–4 hours
- Wire isolatePartId into OrthoView
- Test 5–8 most common shapes (box, tapered, round, leg, splayed, apron, arch-bent)
- Document 7 known gaps
- Write basic PartDrawingViews wrapper component
