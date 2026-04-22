import type { Part } from "@/lib/types";

/**
 * World-frame extents of a part's bounding box, honoring its rotation.
 *
 * Local (unrotated) convention: length→X, thickness→Y, width→Z.
 * Rotations are applied in three.js default Euler XYZ order (extrinsic around
 * world X, then world Y, then world Z). Only ~90° quarter-turns are supported.
 */
export function worldExtents(part: Part) {
  let xExt = part.visible.length;
  let yExt = part.visible.thickness;
  let zExt = part.visible.width;
  const quarter = (a: number) => Math.abs(Math.sin(a)) > 0.5;
  if (quarter(part.rotation?.x ?? 0)) [yExt, zExt] = [zExt, yExt];
  if (quarter(part.rotation?.y ?? 0)) [xExt, zExt] = [zExt, xExt];
  if (quarter(part.rotation?.z ?? 0)) [xExt, yExt] = [yExt, xExt];
  return { xExt, yExt, zExt };
}

export type OrthoView = "front" | "side" | "top";

/**
 * 2D silhouette of a part for the given orthographic view.
 * Origin convention: part.origin.y is bottom of the part; x/z are centered.
 * Returned rect is in **world coords** (not yet flipped for SVG Y-down).
 */
export function projectPart(part: Part, view: OrthoView) {
  const { x, y, z } = part.origin;
  const { xExt, yExt, zExt } = worldExtents(part);
  if (view === "front") return { x: x - xExt / 2, y, w: xExt, h: yExt };
  if (view === "side") return { x: z - zExt / 2, y, w: zExt, h: yExt };
  return { x: x - xExt / 2, y: z - zExt / 2, w: xExt, h: zExt };
}

/**
 * Depth range of a part along the view axis, normalized so `near > far`
 * (larger value = closer to viewer).
 *
 * Viewer positions (derived from template conventions — front of furniture
 * faces -Z; the 3D camera is on +Z looking at the back, so the drafting
 * "front view" is the opposite face):
 *   front view → viewer at -Z (drawer fronts at min-z are closest)
 *   side view  → viewer at +X (right-side in conventional drafting)
 *   top view   → viewer at +Y
 */
export function partDepth(part: Part, view: OrthoView) {
  const { x, y, z } = part.origin;
  const { xExt, yExt, zExt } = worldExtents(part);
  if (view === "front") return { near: -(z - zExt / 2), far: -(z + zExt / 2) };
  if (view === "side") return { near: x + xExt / 2, far: x - xExt / 2 };
  return { near: y + yExt, far: y };
}

/**
 * 2D silhouette polygon for a part. Returns 4 points (top-left, top-right,
 * bottom-right, bottom-left) in *world* coords. For "tapered" parts, top
 * face uses visible width but bottom face is scaled. Y axis is world-up
 * (no flip) — caller flips for SVG.
 */
export function projectPartPolygon(part: Part, view: OrthoView): Array<{ x: number; y: number }> {
  const r = projectPart(part, view);
  // Default box polygon (rectangle, tracing CCW in world-Y-up coords).
  const box = [
    { x: r.x, y: r.y + r.h },       // top-left
    { x: r.x + r.w, y: r.y + r.h }, // top-right
    { x: r.x + r.w, y: r.y },       // bottom-right
    { x: r.x, y: r.y },             // bottom-left
  ];
  if (!part.shape || part.shape.kind === "box") return box;

  // Taper only applies when the part stands vertically (length/thickness →
  // world Y). Always skipped in top view.
  if (part.shape.kind === "tapered") {
    if (view === "top") return box;
    const scale = part.shape.bottomScale;
    const cx = (r.x + r.x + r.w) / 2;
    const halfTop = r.w / 2;
    const halfBot = halfTop * scale;
    return [
      { x: cx - halfTop, y: r.y + r.h },
      { x: cx + halfTop, y: r.y + r.h },
      { x: cx + halfBot, y: r.y },
      { x: cx - halfBot, y: r.y },
    ];
  }

  if (part.shape.kind === "splayed") {
    // Splayed: bottom face shifted by (dxMm, dzMm) in world. Silhouette is a
    // parallelogram in front/side view; top view shows both top and shifted
    // bottom footprints (we draw the top, bottom handled by second polygon in
    // the renderer — keep it simple here: top silhouette only in top view).
    if (view === "top") return box;
    const offset =
      view === "front" ? part.shape.dxMm : part.shape.dzMm;
    return [
      { x: r.x, y: r.y + r.h },
      { x: r.x + r.w, y: r.y + r.h },
      { x: r.x + r.w + offset, y: r.y },
      { x: r.x + offset, y: r.y },
    ];
  }

  if (part.shape.kind === "hoof") {
    if (view === "top") return box;
    const flareY = r.y + part.shape.hoofMm;
    const cx = (r.x + r.x + r.w) / 2;
    const halfN = r.w / 2;
    const halfF = halfN * part.shape.hoofScale;
    return [
      { x: cx - halfN, y: r.y + r.h },
      { x: cx + halfN, y: r.y + r.h },
      { x: cx + halfN, y: flareY },
      { x: cx + halfF, y: r.y },
      { x: cx - halfF, y: r.y },
      { x: cx - halfN, y: flareY },
    ];
  }

  return box;
}

const CONTAIN_EPS = 0.5;
const DEPTH_EPS = 0.5;

/**
 * A part is "hidden" in this view if some other part's silhouette fully
 * contains it AND that other part is completely in front of it along the
 * view axis. Hidden parts should render with dashed stroke.
 */
export function isPartHidden(part: Part, allParts: Part[], view: OrthoView) {
  const r = projectPart(part, view);
  const d = partDepth(part, view);
  for (const other of allParts) {
    if (other.id === part.id) continue;
    const ro = projectPart(other, view);
    const doo = partDepth(other, view);
    const contains =
      ro.x <= r.x + CONTAIN_EPS &&
      ro.x + ro.w >= r.x + r.w - CONTAIN_EPS &&
      ro.y <= r.y + CONTAIN_EPS &&
      ro.y + ro.h >= r.y + r.h - CONTAIN_EPS;
    if (contains && doo.far >= d.near - DEPTH_EPS) return true;
  }
  return false;
}

/**
 * Sort parts so deeper (farther-from-viewer) parts draw first; closer parts
 * paint on top. Stable order for equal depths preserves template order.
 */
export function sortPartsByDepth(parts: Part[], view: OrthoView): Part[] {
  return [...parts]
    .map((p, i) => ({ p, i, near: partDepth(p, view).near }))
    .sort((a, b) => (a.near === b.near ? a.i - b.i : a.near - b.near))
    .map((e) => e.p);
}
