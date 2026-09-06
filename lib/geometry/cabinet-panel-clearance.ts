import { Box3, Euler, Vector3 } from "three";
import type { Part } from "../types";
import { buildShapeGeometry, type ShapeSpec } from "../render/part-geometry";
import { mortiseLocalBox } from "../render/svg-views";
import { boxCorners, constructionMatrix } from "./construction-cuts";

const EPS = 0.0001;
const quarter = (angle: number) => Number.isFinite(angle)
  && Math.abs(angle / (Math.PI / 2) - Math.round(angle / (Math.PI / 2))) < 1e-9;

function sections(part: Part) {
  const shape = part.shape?.kind === "splayed-tapered"
    ? { ...part.shape, dx: part.shape.dxMm, dz: part.shape.dzMm } : part.shape;
  const geometry = buildShapeGeometry(shape as ShapeSpec, [part.visible.length, part.visible.thickness, part.visible.width]);
  if (!geometry) return null;
  try {
    geometry.applyMatrix4(constructionMatrix(part));
    const positions = geometry.getAttribute("position"), index = geometry.getIndex();
    const vertices = Array.from({ length: positions.count }, (_, i) => new Vector3().fromBufferAttribute(positions, i));
    if (vertices.some(v => ![v.x, v.y, v.z].every(Number.isFinite))) return null;
    const triangles = Array.from({ length: (index?.count ?? positions.count) / 3 }, (_, i) =>
      [0, 1, 2].map(k => vertices[index ? index.getX(i * 3 + k) : i * 3 + k]));
    const heights = [...new Set(vertices.map(v => v.y))].sort((a, b) => a - b);
    const at = (y: number) => {
      const points: Vector3[] = [];
      for (const triangle of triangles) for (let i = 0; i < 3; i++) {
        const a = triangle[i], b = triangle[(i + 1) % 3];
        if (Math.abs(a.y - y) < EPS) points.push(a);
        if ((a.y - y) * (b.y - y) < 0) points.push(a.clone().lerp(b, (y - a.y) / (b.y - a.y)));
      }
      return points.length ? new Box3().setFromPoints(points) : null;
    };
    return { heights, at };
  } finally { geometry.dispose(); }
}

/** Cabinet raked-rail engagement, proved from actual mesh sections. No IDs or
 * labels are trusted. Between mesh vertex heights every triangle edge is
 * affine; its endpoint envelope contains every intermediate section. A single
 * physical cutter must cover each whole envelope, not just sample points. */
export function clearedByCabinetPanelGrooves(receiver: Part, panel: Part): boolean {
  if (receiver.shape?.kind !== "mitered-ends" || !receiver.shape.vertices
    || panel.shape?.kind !== "splayed-tapered") return false;
  if ([receiver, panel].some(p => p.rotation?.x || p.rotation?.z || !quarter(p.rotation?.y ?? 0))) return false;
  const stock = sections(receiver), insert = sections(panel);
  if (!stock || !insert) return false;
  const matrix = constructionMatrix(receiver);
  const cuts = receiver.mortises.filter(m => m.cosmetic && m.shape !== "round").flatMap(m => {
    const b = mortiseLocalBox(receiver, m);
    if (b.rotX || !quarter(b.rotY ?? 0) || !quarter(b.rotZ ?? 0)
      || ![b.cx, b.cy, b.cz, b.hx, b.hy, b.hz].every(Number.isFinite)
      || Math.min(b.hx, b.hy, b.hz) <= 0) return [];
    const local = new Box3(new Vector3(-b.hx, -b.hy, -b.hz), new Vector3(b.hx, b.hy, b.hz));
    return [new Box3().setFromPoints(boxCorners(local).map(p => p
      .applyEuler(new Euler(0, b.rotY ?? 0, b.rotZ ?? 0, "ZYX"))
      .add(new Vector3(b.cx, b.cy, b.cz)).applyMatrix4(matrix)))];
  });
  const low = Math.max(stock.heights[0], insert.heights[0]);
  const high = Math.min(stock.heights[stock.heights.length - 1], insert.heights[insert.heights.length - 1]);
  if (high <= low) return true;
  const heights = [...new Set([low, high, ...stock.heights, ...insert.heights,
    ...cuts.flatMap(c => [c.min.y, c.max.y])])].filter(y => y >= low && y <= high).sort((a, b) => a - b);
  for (let i = 1; i < heights.length; i++) {
    const a = heights[i - 1], b = heights[i];
    if (b - a < EPS) continue;
    const s0 = stock.at(a), s1 = stock.at(b), p0 = insert.at(a), p1 = insert.at(b);
    if (!s0 || !s1 || !p0 || !p1) return false;
    const intersection = s0.union(s1).intersect(p0.union(p1));
    intersection.min.y = a; intersection.max.y = b;
    if (intersection.isEmpty() || intersection.max.x - intersection.min.x <= EPS || intersection.max.z - intersection.min.z <= EPS) continue;
    if (!cuts.some(c => ["x", "y", "z"].every(axis => {
      const k = axis as "x" | "y" | "z";
      return c.min[k] <= intersection.min[k] + EPS && c.max[k] >= intersection.max[k] - EPS;
    }))) return false;
  }
  return true;
}
