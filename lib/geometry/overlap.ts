import type { Part } from "@/lib/types";
import { projectPartSilhouette } from "@/lib/render/geometry";

export interface AABB3D {
  min: { x: number; y: number; z: number };
  max: { x: number; y: number; z: number };
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
 * 偵測零件互相 overlap (AABB 體積相交超過 toleranceMm³ 算 overlap)。
 *
 * 過濾規則：任一軸交集 ≤ tolerance 視為「面對面 butt joint 貼合」（容許
 * 浮點誤差），不算 overlap。要 3 軸都有實質交集才算「真的穿模」。
 *
 * 玻璃片（visual="glass"）跳過：玻璃裝在門框內、層板上是設計上正常重疊。
 */
export function findOverlaps(parts: Part[], toleranceMm = 1): Overlap[] {
  const candidates = parts.filter((p) => p.visual !== "glass");
  const aabbs = candidates.map((p) => ({ id: p.id, aabb: worldAABB(p) }));
  const overlaps: Overlap[] = [];
  for (let i = 0; i < aabbs.length; i++) {
    for (let j = i + 1; j < aabbs.length; j++) {
      const a = aabbs[i];
      const b = aabbs[j];
      const inter = aabbIntersection(a.aabb, b.aabb);
      if (!inter) continue;
      if (
        inter.x <= toleranceMm ||
        inter.y <= toleranceMm ||
        inter.z <= toleranceMm
      )
        continue;
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
