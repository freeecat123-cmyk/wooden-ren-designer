/**
 * Y-segmented silhouette overlap helpers (drafting-math §A11 D.2)。
 *
 * 動機：lib/geometry/overlap.ts 的 OBB SAT 用 part.visible 等距常數方塊，無
 * 法反映 tapered / splayed 等形狀腳沿 Y 變化的截面，導致 leg ↔ apron / leg ↔
 * stretcher 端面對接時誤報 overlap（drafting-math §A11 D.2 / project memory
 * project_wrd_butt_joint_convention.md）。
 *
 * 解法：在 worldY = h 平面取「front silhouette 的 X 區間」與「side silhouette
 * 的 Z 區間」拼出該層 AABB-at-Y。tapered 腳在低 Y 自動縮、splayed 腳自動位
 * 移，符合真實截面。
 *
 * 投影座標慣例（lib/render/geometry.ts pushPoint）：
 *   front: vx = -worldX, vy = worldY → x range 取負反轉得 worldX
 *   side:  vx = worldZ,  vy = worldY → x range 直接是 worldZ
 *   top:   vx = -worldX, vy = worldZ → 不參與 Y-slice
 */
import type { Part } from "@/lib/types";
import { projectPartSilhouette } from "@/lib/render/geometry";

interface V2 {
  x: number;
  y: number;
}

const EPS = 1e-6;

/**
 * 從 polygon 在水平線 y = h 處取 x 區間（scan-line 求交）。
 *
 * polygon 須為閉合（首尾不需重複），逐邊掃描：邊 (p1, p2) 與 y=h 相交時
 * 算出 x 收進 [lo, hi]。水平邊（兩端皆在 y=h）兩個 x 都收。
 *
 * 回傳 null = polygon 完全不接觸 y=h（部件 Y 範圍外）。
 */
export function xRangeAtY(poly: V2[], h: number): [number, number] | null {
  if (poly.length < 2) return null;
  let lo = Infinity;
  let hi = -Infinity;
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    const p1 = poly[i];
    const p2 = poly[(i + 1) % n];
    const d1 = p1.y - h;
    const d2 = p2.y - h;
    const on1 = Math.abs(d1) < EPS;
    const on2 = Math.abs(d2) < EPS;
    if (on1 && on2) {
      // 水平邊正好在 h，兩端 x 都收
      if (p1.x < lo) lo = p1.x;
      if (p1.x > hi) hi = p1.x;
      if (p2.x < lo) lo = p2.x;
      if (p2.x > hi) hi = p2.x;
    } else if (d1 * d2 <= 0) {
      // 邊跨過 h（含 vertex 落在 h 的單側情況）
      let x: number;
      if (on1) x = p1.x;
      else if (on2) x = p2.x;
      else {
        const t = (h - p1.y) / (p2.y - p1.y);
        x = p1.x + (p2.x - p1.x) * t;
      }
      if (x < lo) lo = x;
      if (x > hi) hi = x;
    }
  }
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi - lo < 0) return null;
  return [lo, hi];
}

export interface SliceAabb {
  /** worldX [min, max] */
  x: [number, number];
  /** worldZ [min, max] */
  z: [number, number];
}

/**
 * 取部件在 worldY = h 處的 XZ-AABB（橫截面外接矩形）。
 *
 * 先用 frontPoly（worldY × -worldX）取 X 區間，再用 sidePoly（worldY × worldZ）
 * 取 Z 區間。frontPoly / sidePoly 由 caller 預先計算（findOverlaps 一次部件
 * 算完拿來重用）。
 *
 * 回傳 null = 部件 Y 範圍不含 h，或 polygon 退化。
 */
export function partAabbAtY(
  frontPoly: V2[],
  sidePoly: V2[],
  h: number,
): SliceAabb | null {
  const xr = xRangeAtY(frontPoly, h); // [-worldX_max, -worldX_min]
  if (!xr) return null;
  const zr = xRangeAtY(sidePoly, h);
  if (!zr) return null;
  // front 的 vx = -worldX，所以 vx 區間 [a, b] → worldX 區間 [-b, -a]
  return {
    x: [-xr[1], -xr[0]],
    z: [zr[0], zr[1]],
  };
}

/**
 * 預算一顆部件的 silhouette pair（front + side），給 findOverlaps 重複使用。
 */
export function precomputeSilhouettes(part: Part): {
  front: V2[];
  side: V2[];
} {
  return {
    front: projectPartSilhouette(part, "front"),
    side: projectPartSilhouette(part, "side"),
  };
}

/**
 * 兩個部件在 worldY = h 處的 AABB 是否在 X、Z 都重疊（容差 toleranceMm）。
 *
 * 回傳 null 表「至少一個部件在該層沒有截面（Y 範圍外）」，由 caller 視作
 * 「該層不算 overlap」。
 */
export function sliceOverlapAtY(
  frontA: V2[],
  sideA: V2[],
  frontB: V2[],
  sideB: V2[],
  h: number,
  toleranceMm = 1,
): { x: number; z: number } | null {
  const a = partAabbAtY(frontA, sideA, h);
  const b = partAabbAtY(frontB, sideB, h);
  if (!a || !b) return null;
  const xOverlap = Math.min(a.x[1], b.x[1]) - Math.max(a.x[0], b.x[0]);
  const zOverlap = Math.min(a.z[1], b.z[1]) - Math.max(a.z[0], b.z[0]);
  if (xOverlap <= toleranceMm || zOverlap <= toleranceMm) return null;
  return { x: xOverlap, z: zOverlap };
}
