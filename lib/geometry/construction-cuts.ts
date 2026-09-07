import { Box3, BoxGeometry, Euler, Matrix4, Quaternion, Vector3 } from "three";
import type { FurnitureDesign, Mortise, Part } from "@/lib/types";
import type { LocalBox } from "@/lib/render/svg-views";
import { worldExtents } from "@/lib/render/geometry";
import { buildShapeGeometry, type ShapeSpec } from "@/lib/render/part-geometry";

/** Explicit tool coordinates for newly generated v2 machining only.
 * Legacy mortises keep their face-selection/clamping semantics unchanged. */
export interface ConstructionMortise extends Mortise {
  constructionCut: { version: 2; box: Required<Pick<LocalBox, "cx" | "cy" | "cz" | "hx" | "hy" | "hz" | "depthAxis">> };
}

export function constructionCutBox(m: Mortise): ConstructionMortise["constructionCut"]["box"] | null {
  if (!("constructionCut" in m)) return null;
  const cut = (m as ConstructionMortise).constructionCut;
  const b = cut?.box;
  if (cut?.version !== 2 || !m.cosmetic || m.shape !== "rect" || !b
    || ![b.cx, b.cy, b.cz, b.hx, b.hy, b.hz].every(Number.isFinite)
    || Math.min(b.hx, b.hy, b.hz) <= 0 || !["x", "y", "z"].includes(b.depthAxis)) return null;
  return b;
}

export function constructionMatrix(part: Part): Matrix4 {
  return new Matrix4().compose(new Vector3(part.origin.x, part.origin.y + worldExtents(part).yExt / 2, part.origin.z),
    new Quaternion().setFromEuler(new Euler(part.rotation?.x ?? 0, part.rotation?.y ?? 0, part.rotation?.z ?? 0, "ZYX")), new Vector3(1, 1, 1));
}

export function constructionStockBounds(part: Part): Box3 {
  const shape = part.shape?.kind === "splayed-round-tapered" || part.shape?.kind === "splayed-tapered" || part.shape?.kind === "splayed"
    ? { ...part.shape, dx: part.shape.dxMm, dz: part.shape.dzMm } : part.shape;
  const size: [number, number, number] = [part.visible.length, part.visible.thickness, part.visible.width];
  const geometry = buildShapeGeometry(shape as ShapeSpec, size) ?? new BoxGeometry(...size);
  geometry.applyMatrix4(constructionMatrix(part));
  geometry.computeBoundingBox();
  const result = geometry.boundingBox!.clone();
  geometry.dispose();
  return result;
}

export function boxCorners(box: Box3): Vector3[] {
  const points: Vector3[] = [];
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) points.push(new Vector3(x, y, z));
  return points;
}

/** Route a rectangular housing over the actual shared stock, in receiver-local
 * coordinates. Extra 0.25mm per face is a machining clearance, not a new blank. */
export function addConstructionHousing(receiver: Part, obstacle: Part, label: string, region?: Box3): void {
  const intersection = constructionStockBounds(receiver).intersect(constructionStockBounds(obstacle));
  if (region) intersection.intersect(region);
  const size = intersection.getSize(new Vector3());
  if (intersection.isEmpty() || Math.min(size.x, size.y, size.z) < 0.01) return;
  const inverse = constructionMatrix(receiver).invert();
  const local = new Box3().setFromPoints(boxCorners(intersection).map(p => p.applyMatrix4(inverse))).expandByScalar(0.25);
  const center = local.getCenter(new Vector3()), half = local.getSize(new Vector3()).multiplyScalar(0.5);
  const axes = ["x", "y", "z"] as const;
  const stock = new Box3().setFromPoints(boxCorners(constructionStockBounds(receiver)).map(p => p.applyMatrix4(inverse)));
  const openingAxes = axes.filter(axis => center[axis] > 0
    ? local.max[axis] >= stock.max[axis] - 0.01 : local.min[axis] <= stock.min[axis] + 0.01);
  const depthAxis = [...(openingAxes.length ? openingAxes : axes)].sort((a, b) => half[a] - half[b])[0];
  const perpendicular = axes.filter(a => a !== depthAxis);
  const mortise: ConstructionMortise = {
    origin: { x: center.x, y: center.y + receiver.visible.thickness / 2, z: center.z },
    depth: half[depthAxis] * 2, length: half[perpendicular[0]] * 2, width: half[perpendicular[1]] * 2,
    shape: "rect", through: false, cosmetic: true, label,
    constructionCut: { version: 2, box: { cx: center.x, cy: center.y, cz: center.z, hx: half.x, hy: half.y, hz: half.z, depthAxis } },
  };
  receiver.mortises.push(mortise);
}

export function addConstructionHalfLap(a: Part, b: Part, label: string): void {
  const intersection = constructionStockBounds(a).intersect(constructionStockBounds(b));
  if (intersection.isEmpty()) return;
  const middle = (intersection.min.y + intersection.max.y) / 2;
  const lower = intersection.clone(), upper = intersection.clone();
  lower.max.y = middle; upper.min.y = middle;
  addConstructionHousing(a, b, label, lower);
  addConstructionHousing(b, a, label, upper);
}

/** Every corner of the intersection must be inside one actual cutter. An OBB
 * is convex, so this proves coverage of the whole volume, without sampling. */
export function constructionCutsClear(receiver: Part, intersection: Box3): boolean {
  if (constructionLimits(receiver).issues.length) return false;
  const points = boxCorners(intersection).map(p => p.applyMatrix4(constructionMatrix(receiver).invert()));
  return receiver.mortises.some(m => {
    const b = constructionCutBox(m);
    return b && points.every(p => Math.abs(p.x - b.cx) <= b.hx + 1e-5
      && Math.abs(p.y - b.cy) <= b.hy + 1e-5 && Math.abs(p.z - b.cz) <= b.hz + 1e-5);
  });
}

export function constructionCutsCoverPair(a: Part, b: Part, intersection: Box3): boolean {
  if (constructionLimits(a).issues.length || constructionLimits(b).issues.length) return false;
  if (constructionCutsClear(a, intersection) || constructionCutsClear(b, intersection)) return true;
  const center = intersection.getCenter(new Vector3()), half = intersection.getSize(new Vector3()).multiplyScalar(0.5);
  const intervals: [number, number][] = [];
  for (const part of [a, b]) {
    const inverse = constructionMatrix(part).invert();
    const origin = new Vector3(center.x, 0, center.z).applyMatrix4(inverse);
    const zero = new Vector3().applyMatrix4(inverse);
    const dx = new Vector3(1, 0, 0).applyMatrix4(inverse).sub(zero);
    const dy = new Vector3(0, 1, 0).applyMatrix4(inverse).sub(zero);
    const dz = new Vector3(0, 0, 1).applyMatrix4(inverse).sub(zero);
    for (const mortise of part.mortises) {
      const cut = constructionCutBox(mortise);
      if (!cut) continue;
      let low = intersection.min.y, high = intersection.max.y;
      for (const axis of ["x", "y", "z"] as const) {
        const radius = Math.abs(dx[axis]) * half.x + Math.abs(dz[axis]) * half.z;
        const available = cut[`h${axis}`] - radius;
        const offset = origin[axis] - cut[`c${axis}`];
        if (available < 0) { high = -Infinity; break; }
        if (Math.abs(dy[axis]) < 1e-9) {
          if (Math.abs(offset) > available + 1e-5) { high = -Infinity; break; }
        } else {
          const limits = [(-available - offset) / dy[axis], (available - offset) / dy[axis]].sort((x, y) => x - y);
          low = Math.max(low, limits[0]); high = Math.min(high, limits[1]);
        }
      }
      if (high > low) intervals.push([low, high]);
    }
  }
  let covered = intersection.min.y;
  for (const [low, high] of intervals.sort((x, y) => x[0] - y[0])) {
    if (low > covered + 1e-5) return false;
    covered = Math.max(covered, high);
    if (covered >= intersection.max.y - 1e-5) return true;
  }
  return false;
}

export interface ConstructionLimits { minWebMm: number; maxDepthMm: number; accessibleCuts: number; issues: string[] }

/** Geometry limits, not a load rating. Preserve an uninterrupted outer spine in
 * splayed legs, a 0.6R square hub in turned columns, and >= half the rail web.
 * All cuts must open onto stock exterior: blind enclosed boxes are rejected. */
export function constructionLimits(part: Part): ConstructionLimits {
  const result: ConstructionLimits = { minWebMm: Infinity, maxDepthMm: 0, accessibleCuts: 0, issues: [] };
  const cuts = part.mortises.flatMap(m => { const b = constructionCutBox(m); return b ? [b] : []; });
  if (!cuts.length) return result;
  const stock = constructionStockBounds(part);
  const localStock = new Box3().setFromPoints(boxCorners(stock).map(p => p.applyMatrix4(constructionMatrix(part).invert())));
  for (const b of cuts) {
    const min = new Vector3(b.cx - b.hx, b.cy - b.hy, b.cz - b.hz), max = new Vector3(b.cx + b.hx, b.cy + b.hy, b.cz + b.hz);
    const opens = (["x", "y", "z"] as const).some(axis => min[axis] <= localStock.min[axis] + 0.01 || max[axis] >= localStock.max[axis] - 0.01);
    if (opens) result.accessibleCuts++;
    else result.issues.push("Enclosed cutter has no verified exterior opening");
    const entry = b.depthAxis;
    if (!(b[`c${entry}`] > 0 ? max[entry] >= localStock.max[entry] - 0.01 : min[entry] <= localStock.min[entry] + 0.01)) {
      result.issues.push("Selected machining face has no verified exterior opening");
    }
    if (part.shape?.kind === "splayed-round-tapered") {
      const shape = part.shape, height = part.visible.thickness, r = part.visible.length / 2;
      const low = Math.max(0, min.y + height / 2), high = Math.min(height, max.y + height / 2);
      const sx = Math.sign(shape.dxMm || part.origin.x), sz = Math.sign(shape.dzMm || part.origin.z);
      // The protected square moves/tapers with the post. Its outermost corner
      // is <= (0.65 + sqrt(2)*0.15)R = 0.863R, inside every circular section.
      const spine = [low, high].map(y => {
        const radius = r * (shape.bottomScale + (1 - shape.bottomScale) * y / height);
        const half = radius * 0.15;
        return { x: shape.dxMm * (1 - y / height) + sx * radius * 0.65 / Math.SQRT2,
          z: shape.dzMm * (1 - y / height) + sz * radius * 0.65 / Math.SQRT2, half, radius };
      });
      const separated = (["x", "z"] as const).some(axis => Math.max(...spine.map(p => p[axis] + p.half)) < min[axis]
        || Math.min(...spine.map(p => p[axis] - p.half)) > max[axis]);
      const web = Math.min(...spine.map(p => 2 * p.half));
      result.minWebMm = Math.min(result.minWebMm, web);
      const depth = b[`h${b.depthAxis}`] * 2;
      result.maxDepthMm = Math.max(result.maxDepthMm, depth);
      if (!separated || web < 6) result.issues.push("Rail housing violates the continuous >=6mm outer post spine");
      if (depth > part.visible.length * 0.6) result.issues.push("Rail housing exceeds 60% of post diameter");
    } else if (part.shape?.kind === "lathe-turned") {
      const hub = part.visible.length * 0.15;
      const leavesHub = max.x < -hub || min.x > hub || max.z < -hub || min.z > hub;
      result.minWebMm = Math.min(result.minWebMm, hub * 2);
      result.maxDepthMm = Math.max(result.maxDepthMm, max.y + part.visible.thickness / 2);
      if (!leavesHub) result.issues.push("Foot housing cuts the continuous 30%-diameter central hub");
      if (max.y + part.visible.thickness / 2 > part.visible.thickness * 0.2) result.issues.push("Foot housing exceeds the bottom 20% of the column");
    } else {
      const t = part.visible.thickness;
      const depth = Math.min(max.y, t / 2) - Math.max(min.y, -t / 2);
      const web = t - depth;
      result.minWebMm = Math.min(result.minWebMm, web);
      result.maxDepthMm = Math.max(result.maxDepthMm, depth);
      const cutHeight = Math.min(max.z, part.visible.width / 2) - Math.max(min.z, -part.visible.width / 2);
      const remainingArea = t * part.visible.width - depth * cutHeight;
      if (web < 6 || remainingArea < t * part.visible.width * 0.5) result.issues.push("Corner housing leaves less than 6mm web / 50% section");
    }
  }
  if (part.shape?.kind !== "splayed-round-tapered" && part.shape?.kind !== "lathe-turned") {
    // Exact rectangle-union sweep at each cutter X interval. Two individually
    // acceptable pockets must not combine into a severed/thinned cross-section.
    const xs = [...new Set(cuts.flatMap(b => [b.cx - b.hx, b.cx + b.hx]))].sort((a, b) => a - b);
    const t = part.visible.thickness, w = part.visible.width;
    // Closed boundary sections also catch opposite half-depth cuts meeting
    // end-to-end: the two remaining webs must connect across the joint plane.
    const sections = [...xs, ...xs.slice(1).map((x, i) => (xs[i] + x) / 2)];
    for (const x of sections) {
      const active = cuts.filter(b => Math.abs(x - b.cx) <= b.hx + 1e-8);
      const zs = [...new Set([-w / 2, w / 2, ...active.flatMap(b => [b.cz - b.hz, b.cz + b.hz])])]
        .filter(z => z >= -w / 2 && z <= w / 2).sort((a, b) => a - b);
      // Z interfaces need the same closed-section check as X interfaces:
      // opposite half-depth slots may otherwise meet on a zero-web boundary.
      const zSections = [...zs, ...zs.slice(1).map((z, i) => (zs[i] + z) / 2)];
      for (const z of zSections) {
        const intervals = active.filter(b => Math.abs(z - b.cz) <= b.hz + 1e-8)
          .map(b => [Math.max(-t / 2, b.cy - b.hy), Math.min(t / 2, b.cy + b.hy)])
          .filter(([lo, hi]) => hi > lo).sort((a, b) => a[0] - b[0]);
        let end = -t / 2, largestWeb = 0;
        for (const [lo, hi] of intervals) { largestWeb = Math.max(largestWeb, lo - end); end = Math.max(end, hi); }
        largestWeb = Math.max(largestWeb, t / 2 - end);
        result.minWebMm = Math.min(result.minWebMm, largestWeb);
        if (largestWeb < 6) result.issues.push("Combined corner cuts leave less than 6mm continuous web");
      }
      const ys = [...new Set([-t / 2, t / 2, ...active.flatMap(b => [Math.max(-t / 2, b.cy - b.hy), Math.min(t / 2, b.cy + b.hy)])])].sort((a, b) => a - b);
      let removed = 0;
      for (let j = 1; j < ys.length; j++) {
        const y = (ys[j - 1] + ys[j]) / 2;
        const intervals = active.filter(b => Math.abs(y - b.cy) < b.hy)
          .map(b => [Math.max(-w / 2, b.cz - b.hz), Math.min(w / 2, b.cz + b.hz)]).filter(([lo, hi]) => hi > lo).sort((a, b) => a[0] - b[0]);
        let end = -w / 2, length = 0;
        for (const [lo, hi] of intervals) { length += Math.max(0, hi - Math.max(lo, end)); end = Math.max(end, hi); }
        removed += length * (ys[j] - ys[j - 1]);
      }
      if (t * w - removed < t * w * 0.5) { result.issues.push("Combined corner cuts remove more than 50% of a rail section"); break; }
    }
  }
  return result;
}

/** Do not emit an unverified excavation for unsupported parameter combinations. */
export function enforceConstructionLimits(design: FurnitureDesign, locale?: string): void {
  for (const part of design.parts) {
    const limits = constructionLimits(part);
    if (!limits.issues.length) continue;
    part.mortises = part.mortises.filter(m => !constructionCutBox(m));
    (design.warnings ??= []).push(locale === "en"
      ? `${part.nameEn ?? part.id}: revised machining rejected (${limits.issues.join("; ")}). Increase the post/rail size or revise the shoulder layout before fabrication.`
      : `${part.nameZh}：修訂加工未套用，剩餘肉厚或開口不合格。請加大腳／牙撐尺寸或調整肩位，未解決前不可照此製作。`);
  }
}
