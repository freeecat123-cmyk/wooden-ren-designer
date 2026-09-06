import { Box3, Euler, Vector3 } from "three";
import type { Part } from "@/lib/types";
import { buildHoofGeometry } from "@/lib/render/part-geometry";
import { mortiseLocalBox } from "@/lib/render/svg-views";
import { boxCorners, constructionMatrix, constructionStockBounds } from "./construction-cuts";

export interface HoofSection { y: number; minX: number; maxX: number; minZ: number; maxZ: number }
const axes = ["x", "y", "z"] as const;
const quarter = (r: number) => Number.isFinite(r) && Math.abs(r / (Math.PI / 2) - Math.round(r / (Math.PI / 2))) < 1e-9;

/** Actual renderer rings, restricted to upright stock. Ring edges are linear
 * between consecutive heights; no symmetric proxy or furniture IDs involved. */
export function hoofSections(post: Part): HoofSection[] {
  if (post.shape?.kind !== "hoof" || axes.some(a => (post.rotation?.[a] ?? 0) !== 0)) return [];
  const s = post.shape;
  const mesh = buildHoofGeometry([post.visible.length, post.visible.thickness, post.visible.width], s.hoofMm, s.hoofScale, s.dirX ?? 0, s.dirZ ?? 0);
  try {
    const positions = mesh.getAttribute("position"), rings = new Map<number, HoofSection>();
    for (let i = 0; i < positions.count; i++) {
      const y = positions.getY(i) + post.visible.thickness / 2 + post.origin.y;
      const x = positions.getX(i) + post.origin.x, z = positions.getZ(i) + post.origin.z;
      const r = rings.get(y) ?? { y, minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity };
      r.minX = Math.min(r.minX, x); r.maxX = Math.max(r.maxX, x);
      r.minZ = Math.min(r.minZ, z); r.maxZ = Math.max(r.maxZ, z);
      rings.set(y, r);
    }
    return [...rings.values()].sort((a, b) => a.y - b.y);
  } finally { mesh.dispose(); }
}

export function clearedByHoofSections(post: Part, receiver: Part): boolean {
  const rings = hoofSections(post);
  if (rings.length < 2 || receiver.rotation?.x || receiver.rotation?.z || !quarter(receiver.rotation?.y ?? 0)) return false;
  const stock = constructionStockBounds(receiver);
  const cuts = receiver.mortises.filter(m => m.cosmetic && m.shape !== "round" && !m.axis).flatMap(m => {
    const b = mortiseLocalBox(receiver, m);
    if (b.rotX || !quarter(b.rotY ?? 0) || !quarter(b.rotZ ?? 0)
      || ![b.cx, b.cy, b.cz, b.hx, b.hy, b.hz].every(Number.isFinite)) return [];
    const box = new Box3(new Vector3(-b.hx, -b.hy, -b.hz), new Vector3(b.hx, b.hy, b.hz));
    return [new Box3().setFromPoints(boxCorners(box).map(p => p.applyEuler(new Euler(0, b.rotY ?? 0, b.rotZ ?? 0, "ZYX"))
      .add(new Vector3(b.cx, b.cy, b.cz)).applyMatrix4(constructionMatrix(receiver))))];
  });
  const heights = [...new Set([stock.min.y, stock.max.y, ...rings.map(r => r.y), ...cuts.flatMap(c => [c.min.y, c.max.y])])].sort((a, b) => a - b);
  for (let i = 1; i < heights.length; i++) {
    const low = heights[i - 1], high = heights[i];
    if (high <= stock.min.y || low >= stock.max.y || high <= rings[0].y || low >= rings[rings.length - 1].y) continue;
    const j = rings.findIndex((r, k) => k > 0 && r.y >= high);
    if (j < 1) return false;
    const a = rings[j - 1], b = rings[j];
    const at = (y: number, key: "minX" | "maxX" | "minZ" | "maxZ") => a[key] + (b[key] - a[key]) * (y - a.y) / (b.y - a.y);
    // The endpoint envelope contains every intermediate section. Intersecting
    // it with a conservative receiver box cannot hide intermediate collisions.
    const envelope = new Box3(new Vector3(Math.min(at(low, "minX"), at(high, "minX")), low, Math.min(at(low, "minZ"), at(high, "minZ"))),
      new Vector3(Math.max(at(low, "maxX"), at(high, "maxX")), high, Math.max(at(low, "maxZ"), at(high, "maxZ")))).intersect(stock);
    if (envelope.isEmpty() || envelope.max.x - envelope.min.x <= 1e-7 || envelope.max.z - envelope.min.z <= 1e-7) continue;
    // A single convex cutter must cover this entire slab, not different
    // disconnected cutters at opposite endpoints. Boundaries are split above.
    if (!cuts.some(c => axes.every(axis => c.min[axis] <= envelope.min[axis] + 1e-7 && c.max[axis] >= envelope.max[axis] - 1e-7))) return false;
  }
  return true;
}
