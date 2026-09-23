# Compound Splay Tenon Axis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the visual + geometric bug where, on 四角對角外斜 (compound splay) furniture, apron/stretcher tenons extend along the apron's main axis instead of perpendicular to the leg's tilted inner face, producing tenons that float past the slanted shoulder.

**Architecture:** Introduce optional `axis: Vec3` (part-local unit vector) on `Tenon` and `Mortise`. Templates compute the true leg-face normal for compound splay and write it onto the tenon/mortise. 3D rendering and SVG projection consume `axis` when present, falling back to position-derived axis when absent (full backward-compat for non-splay parts and single-axis splay degenerates to current behaviour). Part-drawings emit compound miter (α₁/α₂) annotations on apron ends.

**Tech Stack:** TypeScript, Next.js App Router, Three.js (`PerspectiveView.tsx`), custom SVG render (`lib/render/svg-views.tsx`), part-drawings pipeline (`lib/render/part-drawing/`).

**Reference template for development:** `lib/templates/square-stool.ts` (simplest splay surface; bar-stool/bench/dining-chair/etc replicate in M6).

**Manual verification target:** `app/design/square-stool/` with `legShape=splayed` + `splayAngle=8°` + joineryMode on. After M3, the red tenon mesh should visually emerge perpendicular to the leg's tilted inner face, not from the apron's flat end.

---

## File Structure

**Modified:**
- `lib/types/index.ts` — add `axis?: Vec3` to `Tenon` + `Mortise`, export `Vec3` type
- `lib/templates/_helpers.ts` — add `computeCompoundSplayNormal()` helper
- `lib/templates/square-stool.ts` — first template to wire compound-splay normals
- `lib/templates/bar-stool.ts`, `bench.ts`, `dining-chair.ts`, `dining-table.ts`, `low-table.ts`, `side-table.ts`, `tea-table.ts` — M6 propagation
- `components/PerspectiveView.tsx` — tenon mesh + mortise-match consume `axis` (around line 3150–3220 `tenonMeshes`)
- `lib/render/svg-views.tsx` — `tenonLocalBox` / projection + `findMortiseMatch` honour `axis`
- `lib/render/part-drawing/annotation.tsx` — new `<CompoundMiterLabel>` annotation primitive
- `lib/render/part-drawing/drawing.tsx` — call annotation when part has tilted end tenons

**Created:**
- `lib/templates/__tests__/compound-splay-normal.test.ts` — unit test for helper
- `lib/render/__tests__/tenon-axis-projection.test.ts` — projection regression
- `docs/superpowers/research/2026-05-18-compound-splay/normal-derivation.md` — math derivation reference

---

## Math Reference (read first)

For a square stool with compound splay angle α (single param, applied symmetrically to all 4 corners along the diagonal):

- Leg axis (top → bottom), for corner at sign (sx, sz) where sx,sz ∈ {−1,+1}:
  ```
  legBottom − legTop = ( sx · Δ ,  −legHeight ,  sz · Δ )
  where Δ = legHeight · tan(α)
  ```
- Leg inner face (the face the apron meets) — its outward normal in **part-world** axes:
  - For an **X-axis apron** at corner (sx, sz): tenon must point toward leg in +X direction (toward sx side).
    - Normal n = unit( (sx · cos(α) ,  sin(α) · k_y , 0 ) ) — but project onto the **X-leg-face**: leg's X-facing face normal lies in the XY plane.
    - Equivalent: legAxis is `(sx·sinα, −cosα, sz·sinα)`. The face normal of the leg face that the X-apron touches = `(sx·cosα, sx·sinα, 0)` normalized → n_x-apron = `(sx · cosα,  −sx · sinα · (sx · sx),  0)` — see derivation doc.
  - For a **Z-axis apron** at corner (sx, sz): n_z-apron = `(0, −sz·sinα, sz·cosα)`.
- In **apron-local** space (after the existing single-axis tilt in `square-stool.ts:351`):
  - The remaining un-corrected component is the lean along the apron's own long axis. The corrected tenon-local axis becomes a small rotation about the apron's perpendicular-to-tilt axis equal to α (the diagonal-splay component the apron rotation can't carry on its own).

For implementation purposes the helper output is what matters; the test in M1 pins the values for known inputs.

---

## M1 — Type extensions + helper

### Task 1: Add `Vec3` and optional `axis` fields

**Files:**
- Modify: `lib/types/index.ts:55-116` (near `TenonPosition`, `Tenon`, `Mortise`)

- [ ] **Step 1: Add Vec3 export**

In `lib/types/index.ts`, just below the `TenonPosition` export (line ~61), add:

```ts
/** Unit vector in part-local frame. Used by Tenon.axis / Mortise.axis to override
 *  the implicit position-derived direction (compound splay, see plan
 *  2026-05-18-compound-splay-tenon-axis.md). */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}
```

- [ ] **Step 2: Add `axis?` to `Tenon`**

In the `Tenon` interface (line ~71-96), append a new optional field before the closing brace:

```ts
  /**
   * Part-local unit vector the tenon extends along. Overrides the implicit
   * direction derived from `position` (start→−x, end→+x, top→+y, bottom→−y,
   * left→−z, right→+z). Used for compound splay where the tenon must point
   * along the leg-face normal, not along the apron's main axis. Renderers
   * that don't recognise this field fall back to position-only behaviour
   * (so omitting it remains fully backward compatible).
   */
  axis?: Vec3;
```

- [ ] **Step 3: Add `axis?` to `Mortise`**

In the `Mortise` interface (line ~97-116), append before the closing brace:

```ts
  /**
   * Part-local unit vector the mortise opens along (entry → bottom of pocket).
   * Should be the negative of the matching tenon's `axis`. When present,
   * `findMortiseMatch` matches on this axis instead of inferring from origin
   * alignment. Same backward-compat fallback as Tenon.axis.
   */
  axis?: Vec3;
```

- [ ] **Step 4: Commit**

```bash
git add lib/types/index.ts
git commit -m "feat(types): add optional Tenon.axis / Mortise.axis for compound splay"
```

### Task 2: Helper `computeCompoundSplayNormal`

**Files:**
- Modify: `lib/templates/_helpers.ts` (append after `computeSplayGeometry` at line 58)
- Create: `lib/templates/__tests__/compound-splay-normal.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/templates/__tests__/compound-splay-normal.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { computeCompoundSplayNormal } from "../_helpers";

const DEG = Math.PI / 180;
const closeTo = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) < eps;

describe("computeCompoundSplayNormal", () => {
  it("returns +X axis for X-apron when splayAngle=0", () => {
    const n = computeCompoundSplayNormal({
      apronAxis: "x", cornerSx: +1, cornerSz: -1, splayAngleDeg: 0,
    });
    expect(closeTo(n.x, 1)).toBe(true);
    expect(closeTo(n.y, 0)).toBe(true);
    expect(closeTo(n.z, 0)).toBe(true);
  });

  it("tilts X-apron tenon along +X with downward Y component for compound splay", () => {
    const n = computeCompoundSplayNormal({
      apronAxis: "x", cornerSx: +1, cornerSz: -1, splayAngleDeg: 8,
    });
    expect(n.x).toBeGreaterThan(0.95);     // mostly +X
    expect(n.y).toBeLessThan(0);            // points slightly downward toward leg
    expect(closeTo(n.z, 0, 1e-6)).toBe(true); // X-apron has no Z component
    const mag = Math.hypot(n.x, n.y, n.z);
    expect(closeTo(mag, 1, 1e-9)).toBe(true);
  });

  it("mirrors X component sign at opposite corner", () => {
    const right = computeCompoundSplayNormal({
      apronAxis: "x", cornerSx: +1, cornerSz: -1, splayAngleDeg: 8,
    });
    const left = computeCompoundSplayNormal({
      apronAxis: "x", cornerSx: -1, cornerSz: -1, splayAngleDeg: 8,
    });
    expect(closeTo(right.x, -left.x, 1e-9)).toBe(true);
    expect(closeTo(right.y, left.y, 1e-9)).toBe(true);
  });

  it("Z-apron has Z component, no X component", () => {
    const n = computeCompoundSplayNormal({
      apronAxis: "z", cornerSx: -1, cornerSz: +1, splayAngleDeg: 8,
    });
    expect(closeTo(n.x, 0, 1e-6)).toBe(true);
    expect(n.z).toBeGreaterThan(0.95);
    expect(n.y).toBeLessThan(0);
  });

  it("degenerates to single-axis when only splayed-length (z-component=0)", () => {
    const n = computeCompoundSplayNormal({
      apronAxis: "x", cornerSx: +1, cornerSz: 0, splayAngleDeg: 8,
    });
    expect(n.x).toBeGreaterThan(0.95);
    expect(closeTo(n.z, 0, 1e-6)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run lib/templates/__tests__/compound-splay-normal.test.ts
```

Expected: FAIL with "computeCompoundSplayNormal is not a function".

- [ ] **Step 3: Implement helper**

Append to `lib/templates/_helpers.ts` (after `computeSplayGeometry`, ~line 58):

```ts
/**
 * For compound splay (4-corner diagonal external splay), compute the part-local
 * unit normal of the leg's inner face that an apron's end tenon should align with.
 *
 * Convention:
 *   - apronAxis "x": apron lies along world X. Tenon at corner (sx, sz) points
 *     toward +sx·X with a downward (−Y) component proportional to splay angle.
 *   - apronAxis "z": symmetric in Z.
 *   - cornerSz=0 (single-axis splayed-length) or cornerSx=0 (splayed-width)
 *     degenerates: tenon stays in the apron-axis plane.
 *
 * The single-axis tilt that `square-stool.ts` already applies to the WHOLE part
 * (`rotation.x` or `rotation.z`) carries the cross-direction lean; this normal
 * is **expressed in part-local frame AFTER that rotation**, so the only remaining
 * correction is the in-axis lean toward the leg.
 */
export function computeCompoundSplayNormal(args: {
  apronAxis: "x" | "z";
  cornerSx: -1 | 0 | 1;
  cornerSz: -1 | 0 | 1;
  splayAngleDeg: number;
}): { x: number; y: number; z: number } {
  const { apronAxis, cornerSx, cornerSz, splayAngleDeg } = args;
  const a = splayAngleDeg * (Math.PI / 180);
  // Each apron only carries lean in its own length direction (the part rotation
  // handles the cross direction). For 4-corner diagonal splay, the leg face the
  // apron meets has normal: (sx·cosα, −sinα, 0) for X-apron in part-local frame
  // AFTER the cross-tilt rotation. (See research note for full derivation.)
  if (apronAxis === "x") {
    if (cornerSx === 0) return { x: 0, y: 0, z: 0 }; // invalid: x-apron needs ±X corner
    return { x: cornerSx * Math.cos(a), y: -Math.sin(a), z: 0 };
  } else {
    if (cornerSz === 0) return { x: 0, y: 0, z: 0 };
    return { x: 0, y: -Math.sin(a), z: cornerSz * Math.cos(a) };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run lib/templates/__tests__/compound-splay-normal.test.ts
```

Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/templates/_helpers.ts lib/templates/__tests__/compound-splay-normal.test.ts
git commit -m "feat(helpers): add computeCompoundSplayNormal + unit tests"
```

---

## M2 — Reference template: square-stool

### Task 3: Wire compound normals into square-stool apron tenons

**Files:**
- Modify: `lib/templates/square-stool.ts` lines ~289–406 (apron + apron tenon generation)

- [ ] **Step 1: Import helper**

Top of `lib/templates/square-stool.ts`, add to the existing `@/lib/templates/_helpers` import:

```ts
import {
  // …existing imports…
  computeCompoundSplayNormal,
} from "@/lib/templates/_helpers";
```

- [ ] **Step 2: Compute per-apron corner-tenon axes**

Inside the `apronSides.map((s) => { … })` block (~line 307), after `geom = apronGeomFor(...)` and before building tenons, add:

```ts
// Compound splay only — single-axis splay is fully handled by part.rotation.
const isCompoundSplay = splayDx > 0 && splayDz > 0;
const startCornerSx = s.axis === "x" ? -1 : (s.sx as -1 | 1);
const startCornerSz = s.axis === "z" ? -1 : (s.sz as -1 | 1);
const endCornerSx   = s.axis === "x" ? +1 : (s.sx as -1 | 1);
const endCornerSz   = s.axis === "z" ? +1 : (s.sz as -1 | 1);
const tenonAxisStart = isCompoundSplay
  ? computeCompoundSplayNormal({
      apronAxis: s.axis, cornerSx: startCornerSx, cornerSz: startCornerSz,
      splayAngleDeg: splayAngle,
    })
  : undefined;
const tenonAxisEnd = isCompoundSplay
  ? computeCompoundSplayNormal({
      apronAxis: s.axis, cornerSx: endCornerSx, cornerSz: endCornerSz,
      splayAngleDeg: splayAngle,
    })
  : undefined;
// start-tenon's leg-local axis points OUT of apron's start = part-local −axis
// Negate the world-frame normal back to apron-local "outward" direction:
const negate = (v?: { x: number; y: number; z: number }) =>
  v ? { x: -v.x, y: -v.y, z: -v.z } : undefined;
const startAxisLocal = tenonAxisStart ? negate(tenonAxisStart) : undefined;
const endAxisLocal   = tenonAxisEnd;
```

- [ ] **Step 3: Attach `axis` to apron tenons**

Inside the `tenons: (() => { … })` IIFE around line 358 in the same file: in both branches (`apronCanHalfStagger` false branch returning 2 tenons + the stagger branch returning 2 tenons), thread `axis` into each tenon object. Example for the non-stagger branch:

```ts
if (!apronCanHalfStagger) {
  return [
    {
      position: "start" as const,
      type: tenonType,
      length: apronTenonLength,
      width: apronTenonW,
      thickness: apronTenonThick,
      shoulderOn: [...apronTenonStd.shoulderOn],
      ...(startAxisLocal ? { axis: startAxisLocal } : {}),
    },
    {
      position: "end" as const,
      type: tenonType,
      length: apronTenonLength,
      width: apronTenonW,
      thickness: apronTenonThick,
      shoulderOn: [...apronTenonStd.shoulderOn],
      ...(endAxisLocal ? { axis: endAxisLocal } : {}),
    },
  ];
}
```

Apply the same `axis` spread to the stagger branch's `start` + `end` tenons (around lines 380–400 — both halves of the stagger get the same axis as their position).

- [ ] **Step 4: Add matching `axis` to leg's apron mortise**

Find the leg `mortises:` block (currently inside leg part construction at ~line 234, populated by helper `apronMortisesForLeg`). Open the helper used (likely in `_helpers.ts` or `_builders/`) and grep:

```bash
git grep -n "apronMortisesForLeg" lib/
```

Locate definition. The helper must accept an optional `axis` parameter so the leg's mortise stores the negative of the tenon axis. In `square-stool.ts` where the helper is called (around line 234), pass through the matching axis (build a small map keyed by corner sx/sz). If the helper is private to the file, edit it in place; if it's shared, add the optional `axis` param at the call site (back-compat: optional, default undefined → mortise.axis omitted).

Concrete sample call site change (adapt to actual helper signature you find):

```ts
mortises: [
  ...apronMortisesForLeg({
    // …existing args…
    isCompoundSplay,
    apronAxesForCorner: {
      x: isCompoundSplay
        ? computeCompoundSplayNormal({ apronAxis: "x", cornerSx: c.x > 0 ? 1 : -1, cornerSz: c.z > 0 ? 1 : -1, splayAngleDeg: splayAngle })
        : undefined,
      z: isCompoundSplay
        ? computeCompoundSplayNormal({ apronAxis: "z", cornerSx: c.x > 0 ? 1 : -1, cornerSz: c.z > 0 ? 1 : -1, splayAngleDeg: splayAngle })
        : undefined,
    },
  }),
],
```

The helper itself, when these axes are provided, must spread `axis: <vec>` onto each Mortise object. The mortise's axis points INTO the leg, which is exactly the tenon-world-axis the helper receives.

- [ ] **Step 5: Type-check + lint**

```bash
npx tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add lib/templates/square-stool.ts lib/templates/_helpers.ts
git commit -m "feat(square-stool): compute compound-splay tenon/mortise axes"
```

---

## M3 — 3D rendering consumes `tenon.axis`

### Task 4: Tenon mesh + outward axis use `axis` when present

**Files:**
- Modify: `components/PerspectiveView.tsx` lines ~3150–3220

- [ ] **Step 1: Replace position-only outward derivation**

In the `tenonMeshes` map starting at line 3150, the existing switch on `t.position` produces `lrx/lry/lrz` (root point) and `lox/loy/loz` (outward in part-local). Add an override BEFORE the `rRoot`/`rOut` rotation calls (line 3175):

```ts
// part-local outward (default from position):
switch (t.position) {
  case "start":  lrx = -lx / 2; lry = oT; lrz = oW; lox = -1; break;
  case "end":    lrx = +lx / 2; lry = oT; lrz = oW; lox = +1; break;
  case "top":    lrx = oW; lry = +ly / 2; lrz = oT; loy = +1; break;
  case "bottom": lrx = oW; lry = -ly / 2; lrz = oT; loy = -1; break;
  case "left":   lrx = oW; lry = oT; lrz = -lz / 2; loz = -1; break;
  case "right":  lrx = oW; lry = oT; lrz = +lz / 2; loz = +1; break;
}
// Override with explicit axis if the template provided one (compound splay).
if (t.axis) {
  const m = Math.hypot(t.axis.x, t.axis.y, t.axis.z) || 1;
  lox = t.axis.x / m;
  loy = t.axis.y / m;
  loz = t.axis.z / m;
}
```

- [ ] **Step 2: Generalise outAxis from dominant-component, accept fractional axes**

The block at line 3180–3185 picks a single dominant axis. Keep that for the mortise-match comparator (which still uses cardinal axes), **but also** store the full unit `rOut` for tenon mesh orientation:

```ts
const outUnit = (() => {
  const m = Math.hypot(rOut.x, rOut.y, rOut.z) || 1;
  return { x: rOut.x / m, y: rOut.y / m, z: rOut.z / m };
})();
```

`outAxis` / `outSign` stay for the mortise lookup loop (line 3201–3211). Update the loop's filter so a mortise whose own `axis` is set is matched by dot-product instead of cardinal equality:

```ts
for (const mw of worldMortiseIndex) {
  if (mw.partId === part.id) continue;
  if (drawerFamily && !mw.partId.startsWith(drawerFamily)) continue;
  // Prefer dot-product alignment when both sides expose unit axes.
  if (mw.axisUnit && t.axis) {
    const dot = mw.axisUnit.x * outUnit.x + mw.axisUnit.y * outUnit.y + mw.axisUnit.z * outUnit.z;
    if (dot > -0.85) continue; // require near-antiparallel (cos > 0.85)
  } else {
    if (mw.axis !== outAxis) continue;
    if (mw.sign === outSign) continue;
  }
  // …existing distance check, increase tolerance to 60mm for compound splay…
}
```

(`mw.axisUnit` is new — populated by the index builder in Step 3.)

- [ ] **Step 3: Populate `axisUnit` in `worldMortiseIndex`**

Locate the index builder in `PerspectiveView.tsx` (around line 2619 — the `worldMortiseIndex` construction). Where each mortise entry is built, add:

```ts
const axisUnit = m.axis
  ? (() => {
      const r = rotateXYZ(rxP, ryP, rzP, m.axis.x, m.axis.y, m.axis.z);
      const mag = Math.hypot(r.x, r.y, r.z) || 1;
      // Sign flip: mortise.axis points INTO leg; opening direction is OUT of leg
      return { x: -r.x / mag, y: -r.y / mag, z: -r.z / mag };
    })()
  : null;
// …append to entry…
{ partId, axis, sign, entryX, entryY, entryZ, depth, through, axisUnit }
```

Also extend the `WorldMortise` type local to that file to include `axisUnit?: {x,y,z} | null`.

- [ ] **Step 4: Orient the tenon mesh using outUnit**

The existing tenon mesh uses `part.rotation` directly so the tenon inherits the part's rotation. For compound splay, the part rotation alone is insufficient — we need to add a delta-rotation that aligns the tenon's local +axis with `outUnit`.

After the existing `Box`-creation block (look for `<Box>` or mesh prop with `args={...}` for the tenon mesh, ~line 3289), compute and apply a quaternion rotating part-local +X (or the position's axis) onto `t.axis`:

```ts
// Delta quaternion: rotate default position-axis onto t.axis (part-local frame).
const defaultLocal: [number, number, number] =
  t.position === "start" ? [-1, 0, 0] :
  t.position === "end"   ? [+1, 0, 0] :
  t.position === "top"   ? [ 0, +1, 0] :
  t.position === "bottom"? [ 0, -1, 0] :
  t.position === "left"  ? [ 0, 0, -1] :
                           [ 0, 0, +1];
let deltaQuat: [number, number, number, number] = [0, 0, 0, 1]; // identity (x,y,z,w)
if (t.axis) {
  const am = Math.hypot(t.axis.x, t.axis.y, t.axis.z) || 1;
  const targetLocal: [number, number, number] = [t.axis.x / am, t.axis.y / am, t.axis.z / am];
  // axis-angle from defaultLocal → targetLocal
  const dot = defaultLocal[0]*targetLocal[0] + defaultLocal[1]*targetLocal[1] + defaultLocal[2]*targetLocal[2];
  if (dot < 0.9999) {
    const cx = defaultLocal[1]*targetLocal[2] - defaultLocal[2]*targetLocal[1];
    const cy = defaultLocal[2]*targetLocal[0] - defaultLocal[0]*targetLocal[2];
    const cz = defaultLocal[0]*targetLocal[1] - defaultLocal[1]*targetLocal[0];
    const angle = Math.acos(Math.max(-1, Math.min(1, dot)));
    const s = Math.sin(angle / 2);
    const cmag = Math.hypot(cx, cy, cz) || 1;
    deltaQuat = [(cx / cmag) * s, (cy / cmag) * s, (cz / cmag) * s, Math.cos(angle / 2)];
  }
}
// Use deltaQuat on the mesh: <Box quaternion={new THREE.Quaternion(...deltaQuat)} … />
// AND multiply it onto the part's rotation. Reference @react-three/fiber docs for
// the actual prop wiring; this codebase already imports THREE elsewhere in the file.
```

- [ ] **Step 5: Visual smoke test**

```bash
npm run dev
```

Open `http://localhost:3000/design/square-stool`. Set `legShape=splayed`, `splayAngle=8`, enable joinery mode. Verify the red tenon meshes at every apron end emerge perpendicular to the leg's tilted inner face (no longer floating past a slanted shoulder).

- [ ] **Step 6: Commit**

```bash
git add components/PerspectiveView.tsx
git commit -m "feat(3d): tenon mesh + mortise match honour Tenon.axis / Mortise.axis"
```

---

## M4 — SVG views (3-view) honour tenon.axis

### Task 5: tenonLocalBox + projection use axis when present

**Files:**
- Modify: `lib/render/svg-views.tsx` — `tenonLocalBox` (~line 502), `tenonShoulderBox` (~line 484), and the iteration in the main render loop (~line 2009)

- [ ] **Step 1: Write the projection regression test**

Create `lib/render/__tests__/tenon-axis-projection.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { tenonLocalBox } from "../svg-views";
import type { Part } from "@/lib/types";

const basePart = (): Part => ({
  id: "test-apron", nameZh: "test", material: "oak",
  grainDirection: "length",
  visible: { length: 400, width: 60, thickness: 20 },
  origin: { x: 0, y: 0, z: 0 },
  tenons: [], mortises: [],
});

describe("tenonLocalBox with axis override", () => {
  it("falls back to position-derived box when axis absent", () => {
    const p = basePart();
    const box = tenonLocalBox(p, {
      position: "end", type: "shouldered-tenon",
      length: 20, width: 30, thickness: 12,
    });
    // Existing behaviour: end tenon centred at +length/2 along x
    expect(box.cx).toBeGreaterThan(0);
  });

  it("offsets the box along the axis when axis is present", () => {
    const p = basePart();
    const box = tenonLocalBox(p, {
      position: "end", type: "shouldered-tenon",
      length: 20, width: 30, thickness: 12,
      axis: { x: 0.9848, y: -0.1736, z: 0 }, // 10° tilt downward
    });
    expect(box.cy).toBeLessThan(0); // moved slightly down
    expect(box.cx).toBeGreaterThan(p.visible.length / 2 * 0.95);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run lib/render/__tests__/tenon-axis-projection.test.ts
```

Expected: FAIL (current implementation ignores axis).

- [ ] **Step 3: Update `tenonLocalBox`**

In `lib/render/svg-views.tsx`, modify `tenonLocalBox` (around line 502). After the existing `switch (tenon.position)` block produces the default cx/cy/cz, add:

```ts
if (tenon.axis) {
  const m = Math.hypot(tenon.axis.x, tenon.axis.y, tenon.axis.z) || 1;
  const u = { x: tenon.axis.x / m, y: tenon.axis.y / m, z: tenon.axis.z / m };
  // Re-anchor the box centre by tenon.length/2 along the axis from the root face.
  // Root face = where the box currently lives MINUS half the tenon length along
  // the position-default axis. We replace that half-length translation.
  const halfLen = tenon.length / 2;
  switch (tenon.position) {
    case "start":  cx += halfLen; break; // undo −x shift
    case "end":    cx -= halfLen; break;
    case "top":    cy -= halfLen; break;
    case "bottom": cy += halfLen; break;
    case "left":   cz += halfLen; break;
    case "right":  cz -= halfLen; break;
  }
  cx += u.x * halfLen;
  cy += u.y * halfLen;
  cz += u.z * halfLen;
}
```

(Identifiers must match the actual variable names in the function — adjust if `cx/cy/cz` are named differently. If they are e.g. `box.cx`, mutate the box accordingly.)

- [ ] **Step 4: Run projection test to verify it passes**

```bash
npx vitest run lib/render/__tests__/tenon-axis-projection.test.ts
```

Expected: PASS (2 tests).

- [ ] **Step 5: Tenon polygon should be drawn rotated, not axis-aligned**

In the main render loop (~line 2009), the current code calls `projectFeatureRect` which assumes axis-aligned local AABB. When `tenon.axis` is present, we need a rotated quad instead.

Add immediately after the `tenonLocalBox` call in the loop:

```ts
if (t.axis) {
  const m = Math.hypot(t.axis.x, t.axis.y, t.axis.z) || 1;
  const u = { x: t.axis.x / m, y: t.axis.y / m, z: t.axis.z / m };
  // Build a 3D quad oriented to t.axis, project all 4 corners, draw as polygon.
  // 4 corners of the tenon's outward end face in part-local frame:
  const halfW = t.width / 2;
  const halfT = t.thickness / 2;
  // Build orthonormal frame around u
  const helper = Math.abs(u.y) < 0.9 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 };
  const right = (() => {
    const r = { x: u.y*helper.z - u.z*helper.y, y: u.z*helper.x - u.x*helper.z, z: u.x*helper.y - u.y*helper.x };
    const mr = Math.hypot(r.x, r.y, r.z) || 1;
    return { x: r.x/mr, y: r.y/mr, z: r.z/mr };
  })();
  const up = { x: u.y*right.z - u.z*right.y, y: u.z*right.x - u.x*right.z, z: u.x*right.y - u.y*right.x };
  const rootCx = lb.cx - u.x * (t.length / 2);
  const rootCy = lb.cy - u.y * (t.length / 2);
  const rootCz = lb.cz - u.z * (t.length / 2);
  const tipCx = rootCx + u.x * t.length;
  const tipCy = rootCy + u.y * t.length;
  const tipCz = rootCz + u.z * t.length;
  // Project 8 vertices, draw silhouette polygon
  // (delegate to existing projectPartLocalPoint helper or inline)
  // …construct <polygon points=…> and push to elements…
}
```

NOTE: this step's polygon code is a sketch — the exact projection helper to call (`projectPartLocalPoint`, `projectXYZ`, etc.) must be looked up in the file. The reviewer subagent in M7 will verify the SVG output matches the 3D view at the same viewing angle.

- [ ] **Step 6: Visual smoke test**

```bash
npm run dev
```

In the square-stool page, switch to print preview / 3-view layout. Verify front view shows the tilted tenon polygon, not the previous axis-aligned rectangle.

- [ ] **Step 7: Commit**

```bash
git add lib/render/svg-views.tsx lib/render/__tests__/tenon-axis-projection.test.ts
git commit -m "feat(svg-views): tenon polygon respects Tenon.axis"
```

### Task 6: Update `findMortiseMatch` 15mm-tolerance to be axis-aware

**Files:**
- Modify: `lib/render/svg-views.tsx` — locate `findMortiseMatch` (grep within the file)

- [ ] **Step 1: Locate function**

```bash
git grep -n "findMortiseMatch\|findMortise" lib/render/svg-views.tsx
```

- [ ] **Step 2: Add axis dot-product filter**

When both the tenon and a candidate mortise have an `axis` set, require their part-world axes to be anti-parallel (`dot < -0.85`). Otherwise fall through to existing 15mm-AABB matching. Reference Task 4 Step 2 for the matching pattern.

- [ ] **Step 3: Commit**

```bash
git add lib/render/svg-views.tsx
git commit -m "feat(svg-views): findMortiseMatch axis-aware for compound splay"
```

---

## M5 — Part-drawings emit compound miter labels

### Task 7: Add compound-miter annotation

**Files:**
- Modify: `lib/render/part-drawing/annotation.tsx`
- Modify: `lib/render/part-drawing/drawing.tsx`

- [ ] **Step 1: Append a new annotation primitive**

In `annotation.tsx`, add:

```tsx
export function CompoundMiterLabel(props: {
  x: number; y: number;
  primaryDeg: number;  // angle in the part's "wide" face (apron length × width plane)
  secondaryDeg: number; // angle in the "narrow" face (apron length × thickness plane)
  side: "start" | "end";
}) {
  return (
    <g transform={`translate(${props.x},${props.y})`}>
      <text fontSize="3" fill="#222">
        {props.side === "start" ? "S" : "E"} miter
        α₁ {props.primaryDeg.toFixed(1)}°
        α₂ {props.secondaryDeg.toFixed(1)}°
      </text>
    </g>
  );
}
```

- [ ] **Step 2: Call it from drawing.tsx when part has tenons with axis**

Inside the existing apron drawing function in `drawing.tsx`, after the part outline is drawn, check `part.tenons.some(t => t.axis)` and if so, decompose each end tenon's axis into the two miter angles (asin of the cross-component) and emit `<CompoundMiterLabel>` next to the end edge.

```ts
for (const t of part.tenons) {
  if (!t.axis) continue;
  const a1 = Math.atan2(t.axis.y, Math.abs(t.axis.x) + Math.abs(t.axis.z)) * 180 / Math.PI;
  const a2 = Math.atan2(
    t.position === "start" || t.position === "end" ? t.axis.z : t.axis.x,
    Math.abs(t.axis.x) + Math.abs(t.axis.z),
  ) * 180 / Math.PI;
  // Position label at the appropriate end of the part in the drawing
  emit(<CompoundMiterLabel x={...} y={...} primaryDeg={Math.abs(a1)} secondaryDeg={Math.abs(a2)} side={t.position === "start" ? "start" : "end"} />);
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/render/part-drawing/annotation.tsx lib/render/part-drawing/drawing.tsx
git commit -m "feat(part-drawings): compound-miter angle label for splay aprons"
```

---

## M6 — Propagate to other splay templates (parallel-safe)

Each of the following templates uses the same `apronSides + rotation: tiltX/tiltZ` pattern as `square-stool.ts`. Apply the same delta — compute `isCompoundSplay`, derive per-end axes via `computeCompoundSplayNormal`, attach to each tenon. Each task is independent and can be executed by a separate subagent in parallel; the reviewer agent (M7) validates each.

### Task 8: bar-stool

**Files:** `lib/templates/bar-stool.ts`

- [ ] Mirror M2 Task 3's diff. Identify the apron-sides map + lower-stretcher map (search "apronSides" and "stretcher"). Add axis to apron tenons and lower-stretcher tenons. Add matching axis on leg mortises. Visual smoke test on `/design/bar-stool`. Commit `feat(bar-stool): compound-splay tenon axes`.

### Task 9: bench

**Files:** `lib/templates/bench.ts`

- [ ] Same pattern. Commit `feat(bench): compound-splay tenon axes`.

### Task 10: dining-chair

**Files:** `lib/templates/dining-chair.ts`

- [ ] Dining-chair adds back legs that splay backward in addition to compound splay — verify `computeCompoundSplayNormal` still applies (front aprons + side aprons treated independently). Commit `feat(dining-chair): compound-splay tenon axes`.

### Task 11: dining-table, low-table, side-table, tea-table

**Files:** `lib/templates/dining-table.ts`, `low-table.ts`, `side-table.ts`, `tea-table.ts`

- [ ] Same delta as square-stool. These tables generally share `_builders/simple-table.ts` — if the builder is shared, edit the builder once and verify all four templates pick up the change. Commit `feat(tables): compound-splay tenon axes (4 templates)`.

### Task 12: round-stool / round-table / round-tea-table

**Files:** `lib/templates/round-stool.ts`, `round-table.ts`, `round-tea-table.ts`

- [ ] Round-leg templates use `splayed-round-tapered` shape — the leg face the apron meets is a **curved** surface, not a flat face. For these, the helper still applies (the tangent plane at the meeting point has the same normal as the flat-face case). Commit `feat(round-furniture): compound-splay tenon axes`.

---

## M7 — Regression + reviewer pass

### Task 13: Single-axis splay regression

**Files:** (no code changes — verification only)

- [ ] **Step 1:** `npm run dev`, open `/design/square-stool`, set `legShape=splayed-length` (X-only splay), splayAngle=8°. Confirm the apron tenons render exactly as they did before the plan started (visual diff against `git stash + reload`). Same for `splayed-width`.

- [ ] **Step 2:** Repeat for `bar-stool`, `bench`, `dining-chair`.

- [ ] **Step 3:** `npx vitest run` — full test suite green.

- [ ] **Step 4:** `npx tsc --noEmit` — clean.

- [ ] **Step 5:** Run the overlap audit hook (it's a pre-commit hook in this repo): `node scripts/audit-overlaps.ts` — no new overlap regressions.

### Task 14: Reviewer subagent pass

- [ ] Dispatch a `superpowers:receiving-code-review`-style reviewer subagent over all commits in this plan. Reviewer brief:
  - Verify every splay template populates `axis` only when `splayDx > 0 && splayDz > 0` (single-axis splay must remain unchanged).
  - Verify every Mortise paired with an axis-bearing Tenon also has its own `axis` populated to the negation.
  - Verify `findMortiseMatch` dot-product threshold (−0.85) is consistent between `PerspectiveView.tsx` and `svg-views.tsx`.
  - Spot-check a compound-splay screenshot of `/design/square-stool` matches expectation (tenons emerge perpendicular to slanted leg faces).
  - Inspect part-drawings PDF preview for one apron — confirm compound-miter labels are present and angle values are within ±0.5° of `atan(tan(α)/√2)`-derived expectations.

---

## Risks & rollback

- **Risk:** `findMortiseMatch` axis-aware match rejects valid same-cardinal pairs because a stray `axis` was attached. Mitigation: only emit `axis` for compound splay (`isCompoundSplay` guard). Reviewer Task 14 enforces.
- **Risk:** Tenon mesh quaternion stacks weirdly with the part's Euler rotation. Mitigation: the delta-quat is computed in **part-local** frame and applied as a relative offset, then composed with part rotation. If mesh appears to twist, regress to per-tenon `<group>` wrapping with the delta-quat applied inside.
- **Rollback:** Each task is a single commit; revert from M6 backwards if a template regresses.

---

## Manual verification matrix (must all pass before declaring done)

| Template | `splayed` (compound) | `splayed-length` (X-only) | `splayed-width` (Z-only) | No splay (box/tapered) |
|---|---|---|---|---|
| square-stool | M3+M4 visual | M7 regression | M7 regression | M7 regression |
| bar-stool | M6 visual | M7 regression | M7 regression | M7 regression |
| bench | M6 visual | M7 regression | M7 regression | M7 regression |
| dining-chair | M6 visual | M7 regression | M7 regression | M7 regression |
| dining-table | M6 visual | M7 regression | M7 regression | M7 regression |
| round-stool | M6 visual | M7 regression | M7 regression | M7 regression |
