import type { Part } from "@/lib/types";
import { projectPartSilhouette, worldExtents } from "@/lib/render/geometry";

export interface AABB3D {
  min: { x: number; y: number; z: number };
  max: { x: number; y: number; z: number };
}

interface V3 {
  x: number;
  y: number;
  z: number;
}

interface OBB {
  /** mesh 在世界座標的中心點（= origin.x, origin.y + yExt/2, origin.z） */
  center: V3;
  /** 3 個正交單位向量（local X/Y/Z 軸經過 rotation 後的世界方向） */
  axes: [V3, V3, V3];
  /** 3 軸 half-extent (visible.length/2, visible.thickness/2, visible.width/2) */
  halfExtents: [number, number, number];
}

export interface Overlap {
  a: string;
  b: string;
  intersectionMm: { x: number; y: number; z: number };
  worstAxis: "x" | "y" | "z";
}

/**
 * 估算零件世界座標 AABB。
 *
 * 用 front + top + side 三個視圖的 silhouette polygon 取 min/max 拼出 3D AABB。
 * projectPartSilhouette 已經處理：
 *   - 正常 box / 旋轉
 *   - tapered / splayed / splayed-tapered（外斜底面偏移）
 *   - apron-trapezoid（梯形牙條）
 *   - apron-beveled（傾斜牙條）
 *   - arch-bent / face-rounded / tilt-z
 *   - 圓料（round / round-tapered / lathe-turned）
 *
 * 投影座標慣例（見 lib/render/geometry.ts pushPoint）：
 *   front: vx = -worldX, vy = worldY
 *   side:  vx = worldZ,  vy = worldY
 *   top:   vx = -worldX, vy = worldZ
 *
 * 因此 worldX 從 front 或 top 的 -vx 取，worldY 從 front/side 的 vy 取，worldZ
 * 從 top 的 vy 或 side 的 vx 取。
 */
export function worldAABB(part: Part): AABB3D {
  const front = projectPartSilhouette(part, "front");
  const side = projectPartSilhouette(part, "side");
  const top = projectPartSilhouette(part, "top");
  const xs = [...front.map((p) => -p.x), ...top.map((p) => -p.x)];
  const ys = [...front.map((p) => p.y), ...side.map((p) => p.y)];
  const zs = [...top.map((p) => p.y), ...side.map((p) => p.x)];
  return {
    min: { x: Math.min(...xs), y: Math.min(...ys), z: Math.min(...zs) },
    max: { x: Math.max(...xs), y: Math.max(...ys), z: Math.max(...zs) },
  };
}

export function aabbIntersection(
  a: AABB3D,
  b: AABB3D,
): { x: number; y: number; z: number } | null {
  const minX = Math.max(a.min.x, b.min.x);
  const maxX = Math.min(a.max.x, b.max.x);
  if (maxX <= minX) return null;
  const minY = Math.max(a.min.y, b.min.y);
  const maxY = Math.min(a.max.y, b.max.y);
  if (maxY <= minY) return null;
  const minZ = Math.max(a.min.z, b.min.z);
  const maxZ = Math.min(a.max.z, b.max.z);
  if (maxZ <= minZ) return null;
  return { x: maxX - minX, y: maxY - minY, z: maxZ - minZ };
}

/**
 * 從 Part 算出 OBB（Oriented Bounding Box，含旋轉）。
 *
 * 中心對齊 PerspectiveView 渲染慣例：mesh.position = (origin.x,
 * origin.y + yExt/2, origin.z)，yExt 來自 worldExtents（quarter rotation 精
 * 確、非 quarter 用 unrotated 近似——這跟 renderer 一致）。
 */
export function obbFromPart(part: Part): OBB {
  const rx = part.rotation?.x ?? 0;
  const ry = part.rotation?.y ?? 0;
  const rz = part.rotation?.z ?? 0;
  const cx = Math.cos(rx),
    sx = Math.sin(rx);
  const cy = Math.cos(ry),
    sy = Math.sin(ry);
  const cz = Math.cos(rz),
    sz = Math.sin(rz);
  // Three.js Euler order='XYZ': v' = Rx * Ry * Rz * v（先繞 Z、再 Y、再 X）
  const rotate = (x: number, y: number, z: number): V3 => {
    // Rz
    const x1 = x * cz - y * sz;
    const y1 = x * sz + y * cz;
    const z1 = z;
    // Ry
    const x2 = x1 * cy + z1 * sy;
    const y2 = y1;
    const z2 = -x1 * sy + z1 * cy;
    // Rx
    const x3 = x2;
    const y3 = y2 * cx - z2 * sx;
    const z3 = y2 * sx + z2 * cx;
    return { x: x3, y: y3, z: z3 };
  };
  const { yExt } = worldExtents(part);
  return {
    center: {
      x: part.origin.x,
      y: part.origin.y + yExt / 2,
      z: part.origin.z,
    },
    axes: [rotate(1, 0, 0), rotate(0, 1, 0), rotate(0, 0, 1)],
    halfExtents: [
      part.visible.length / 2,
      part.visible.thickness / 2,
      part.visible.width / 2,
    ],
  };
}

const cross = (a: V3, b: V3): V3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
const dot = (a: V3, b: V3): number => a.x * b.x + a.y * b.y + a.z * b.z;
const len = (a: V3): number => Math.hypot(a.x, a.y, a.z);

/**
 * Project an OBB onto a unit vector axis. Returns { min, max } interval.
 *   center 在軸上的投影 c = center · axis
 *   半徑 r = Σ |axis_i · axis| × halfExtent_i
 *   interval = [c - r, c + r]
 */
function projectOBB(obb: OBB, axis: V3): { min: number; max: number } {
  const c = dot(obb.center, axis);
  const r =
    Math.abs(dot(obb.axes[0], axis)) * obb.halfExtents[0] +
    Math.abs(dot(obb.axes[1], axis)) * obb.halfExtents[1] +
    Math.abs(dot(obb.axes[2], axis)) * obb.halfExtents[2];
  return { min: c - r, max: c + r };
}

/**
 * 3D OBB 相交檢查（Separating Axis Theorem）。
 *
 * 15 條候選 separating axis：
 *   - A 的 3 個面法線 (= A 的軸)
 *   - B 的 3 個面法線
 *   - 9 個 A_i × B_j 的 cross product
 * 任一軸找到 separating（交集 ≤ tolerance）→ 不相交。
 */
export function obbIntersect(a: OBB, b: OBB, toleranceMm = 1): boolean {
  const axes: V3[] = [a.axes[0], a.axes[1], a.axes[2], b.axes[0], b.axes[1], b.axes[2]];
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      const c = cross(a.axes[i], b.axes[j]);
      const l = len(c);
      if (l < 1e-6) continue; // 平行軸跳過
      axes.push({ x: c.x / l, y: c.y / l, z: c.z / l });
    }
  }
  for (const axis of axes) {
    const pa = projectOBB(a, axis);
    const pb = projectOBB(b, axis);
    const overlap = Math.min(pa.max, pb.max) - Math.max(pa.min, pb.min);
    if (overlap <= toleranceMm) return false; // 找到 separating axis
  }
  return true;
}

/**
 * 偵測零件互相 overlap。
 *
 * 兩階段檢查：
 *   1. AABB 體積相交（快速 reject 遠方對）
 *   2. OBB SAT 確認（消除非 90° 旋轉的 AABB-OBB false positive）
 *
 * 過濾規則：任一軸交集 ≤ tolerance 視為「面對面 butt joint 貼合」（容許
 * 浮點誤差），不算 overlap。要 3 軸都有實質交集才算「真的穿模」。
 *
 * 玻璃片（visual="glass"）跳過：玻璃裝在門框內、層板上是設計上正常重疊。
 */
export function findOverlaps(parts: Part[], toleranceMm = 1): Overlap[] {
  const candidates = parts.filter((p) => p.visual !== "glass");
  const entries = candidates.map((p) => ({
    id: p.id,
    aabb: worldAABB(p),
    obb: obbFromPart(p),
  }));
  const overlaps: Overlap[] = [];
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const a = entries[i];
      const b = entries[j];
      // Stage 1: AABB volume intersection (fast reject)
      const inter = aabbIntersection(a.aabb, b.aabb);
      if (!inter) continue;
      if (
        inter.x <= toleranceMm ||
        inter.y <= toleranceMm ||
        inter.z <= toleranceMm
      )
        continue;
      // Stage 2: OBB SAT (confirm — eliminates non-quarter rotation false positives)
      if (!obbIntersect(a.obb, b.obb, toleranceMm)) continue;
      const minDim = Math.min(inter.x, inter.y, inter.z);
      const worstAxis: "x" | "y" | "z" =
        inter.x === minDim ? "x" : inter.y === minDim ? "y" : "z";
      overlaps.push({
        a: a.id,
        b: b.id,
        intersectionMm: {
          x: Math.round(inter.x * 10) / 10,
          y: Math.round(inter.y * 10) / 10,
          z: Math.round(inter.z * 10) / 10,
        },
        worstAxis,
      });
    }
  }
  return overlaps;
}
