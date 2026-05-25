/**
 * connection-marks.ts — 零件圖「連接位置虛線標示」(Step 4)
 *
 * 即使組裝版/簡版沒有 mortise，leg 上接 apron / stretcher 的「該位置」仍要
 * 畫虛線矩形＋距端距離，讓使用者一眼看出該支零件上會有幾個接合面、
 * 各位置離端點多遠。
 *
 * 演算法：
 *   1. 算 target part 跟其他 part 的世界 AABB intersection。
 *   2. 若 intersection 體積 > 0，且 sibling 至少 1 個世界軸完全被 target
 *      包覆（吃進去），算成「該位置接 sibling」。
 *   3. 把 intersection 世界 AABB 投到 target part 的 local 座標
 *      （inverse rotation; 只支援 quarter rotation，與專案其他模組對齊）。
 *   4. 推導 ConnectionMark：local center / size + 距端距離 + sibling 資訊。
 *
 * 純函式、無 React、無 DOM 依賴。
 */

import type { FurnitureDesign, Part } from "@/lib/types";
import { worldExtents } from "@/lib/render/geometry";

export type ConnectionKind = "apron" | "stretcher" | "other";

export interface ConnectionMark {
  /** Target part-local center (mm) — local frame: length=X, thickness=Y, width=Z. */
  localX: number;
  localY: number;
  localZ: number;
  /** Target part-local half-size? — 不，這裡記「完整尺寸」，方便畫 rect 直接除 2。 */
  sizeX: number;
  sizeY: number;
  sizeZ: number;
  /** Sibling 識別 */
  siblingId: string;
  siblingNameZh: string;
  kind: ConnectionKind;
  /**
   * 距 target part 「橫躺後水平端」(worldExtents.xExt 的最大邊或最小邊) 的距離。
   * 用 local X 軸（length）做基準：距 `+L/2` (end) 或 `-L/2` (start) 取較近一邊。
   * 永遠 ≥ 0。
   */
  distanceFromEnd: number;
  /** 距哪一端（"start" = local -L/2、"end" = +L/2）。 */
  nearerEnd: "start" | "end";
  /** 距「頂端」(local -T/2 對 leg 而言 = 世界上方) 的垂直距離。畫 leader 標籤用。 */
  distanceFromTop: number;
}

interface WorldAABB {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  zMin: number;
  zMax: number;
}

function partWorldAABB(part: Part): WorldAABB {
  const { xExt, yExt, zExt } = worldExtents(part);
  // origin.y = 部件底部；origin.x/z = 中心
  return {
    xMin: part.origin.x - xExt / 2,
    xMax: part.origin.x + xExt / 2,
    yMin: part.origin.y,
    yMax: part.origin.y + yExt,
    zMin: part.origin.z - zExt / 2,
    zMax: part.origin.z + zExt / 2,
  };
}

/** 對 sibling AABB 做小 shrink（斜接 splayed 系列零件 AABB 比真實接合面大） */
function shrinkSiblingAABB(aabb: WorldAABB, sibling: Part, mm: number): WorldAABB {
  const k = sibling.shape?.kind;
  const isSplayed =
    k === "splayed" ||
    k === "splayed-tapered" ||
    k === "splayed-round-tapered" ||
    k === "apron-trapezoid" ||
    k === "apron-beveled" ||
    k === "apron-half-beveled";
  if (!isSplayed) return aabb;
  return {
    xMin: aabb.xMin + mm,
    xMax: aabb.xMax - mm,
    yMin: aabb.yMin + mm,
    yMax: aabb.yMax - mm,
    zMin: aabb.zMin + mm,
    zMax: aabb.zMax - mm,
  };
}

/** 把 AABB 各方向向外擴 mm；用來在 intersect 階段把「貼面」也視為相交。 */
function inflateAABB(a: WorldAABB, mm: number): WorldAABB {
  return {
    xMin: a.xMin - mm,
    xMax: a.xMax + mm,
    yMin: a.yMin - mm,
    yMax: a.yMax + mm,
    zMin: a.zMin - mm,
    zMax: a.zMax + mm,
  };
}

function intersectAABB(a: WorldAABB, b: WorldAABB): WorldAABB | null {
  const xMin = Math.max(a.xMin, b.xMin);
  const xMax = Math.min(a.xMax, b.xMax);
  if (xMax <= xMin) return null;
  const yMin = Math.max(a.yMin, b.yMin);
  const yMax = Math.min(a.yMax, b.yMax);
  if (yMax <= yMin) return null;
  const zMin = Math.max(a.zMin, b.zMin);
  const zMax = Math.min(a.zMax, b.zMax);
  if (zMax <= zMin) return null;
  return { xMin, xMax, yMin, yMax, zMin, zMax };
}

/** Sibling 至少 1 個世界軸完全被 target 包覆（吃進去）。 */
function siblingFullyEatenOnSomeAxis(target: WorldAABB, sib: WorldAABB): boolean {
  const eatenX = sib.xMin >= target.xMin - 1e-3 && sib.xMax <= target.xMax + 1e-3;
  const eatenY = sib.yMin >= target.yMin - 1e-3 && sib.yMax <= target.yMax + 1e-3;
  const eatenZ = sib.zMin >= target.zMin - 1e-3 && sib.zMax <= target.zMax + 1e-3;
  return eatenX || eatenY || eatenZ;
}

/** 世界 AABB 相交體積（mm³）；放寬版 filter 用。 */
function intersectVolume(a: WorldAABB, b: WorldAABB): number {
  const ix = Math.max(0, Math.min(a.xMax, b.xMax) - Math.max(a.xMin, b.xMin));
  const iy = Math.max(0, Math.min(a.yMax, b.yMax) - Math.max(a.yMin, b.yMin));
  const iz = Math.max(0, Math.min(a.zMax, b.zMax) - Math.max(a.zMin, b.zMin));
  return ix * iy * iz;
}

/**
 * 把世界座標 (wx, wy, wz) 點轉到 target part-local 座標（centered frame：local 軸
 * length=X、thickness=Y、width=Z；target 中心在 origin.x / origin.y+yExt/2 / origin.z）。
 * 給 ConnectionMarks 鄰件 polygon 投影用。
 */
export function worldPointToTargetLocal(
  target: Part,
  wx: number,
  wy: number,
  wz: number,
): { x: number; y: number; z: number } {
  const { yExt } = worldExtents(target);
  const cxW = target.origin.x;
  const cyW = target.origin.y + yExt / 2;
  const czW = target.origin.z;
  const rotX = target.rotation?.x ?? 0;
  const rotY = target.rotation?.y ?? 0;
  const rotZ = target.rotation?.z ?? 0;
  return worldDeltaToLocal(wx - cxW, wy - cyW, wz - czW, rotX, rotY, rotZ);
}

/**
 * 取得 sibling 在世界座標的 AABB 8 角點（不套 shape modifier，純 bbox corners）。
 * 對方凳基礎件（直牙條/橫撐 = 純長方體）已能精確呈現外形輪廓。
 */
export function siblingWorldCorners(
  sibling: Part,
): Array<{ x: number; y: number; z: number }> {
  const aabb = partWorldAABB(sibling);
  const corners: Array<{ x: number; y: number; z: number }> = [];
  for (const x of [aabb.xMin, aabb.xMax]) {
    for (const y of [aabb.yMin, aabb.yMax]) {
      for (const z of [aabb.zMin, aabb.zMax]) {
        corners.push({ x, y, z });
      }
    }
  }
  return corners;
}

/**
 * Inverse-rotate a world-frame delta vector back to part-local.
 * 三軸 Euler XYZ extrinsic：R = Rx · Ry · Rz；inverse = Rz^T · Ry^T · Rx^T。
 * 只支援 quarter rotation（與專案其他模組對齊）。
 */
function worldDeltaToLocal(
  dx: number,
  dy: number,
  dz: number,
  rotX: number,
  rotY: number,
  rotZ: number,
): { x: number; y: number; z: number } {
  // R · v_local = v_world  →  v_local = R^T · v_world
  // 用 forward rotation 走一輪 cosθ/sinθ 後再轉置（程式碼比手算 9 個 entry 短）
  const cx = Math.cos(rotX), sx = Math.sin(rotX);
  const cy = Math.cos(rotY), sy = Math.sin(rotY);
  const cz = Math.cos(rotZ), sz = Math.sin(rotZ);
  // Forward R = Rx · Ry · Rz  → 9 個 entry（標準推導）
  const r00 = cy * cz;
  const r01 = -cy * sz;
  const r02 = sy;
  const r10 = sx * sy * cz + cx * sz;
  const r11 = -sx * sy * sz + cx * cz;
  const r12 = -sx * cy;
  const r20 = -cx * sy * cz + sx * sz;
  const r21 = cx * sy * sz + sx * cz;
  const r22 = cx * cy;
  // v_local = R^T · v_world
  return {
    x: r00 * dx + r10 * dy + r20 * dz,
    y: r01 * dx + r11 * dy + r21 * dz,
    z: r02 * dx + r12 * dy + r22 * dz,
  };
}

/**
 * 把世界 AABB 投到 target part 的 local frame（target 中心為 part 中心：
 * local X=length 中央、Y=thickness 中央、Z=width 中央）。
 * Target 世界中心：
 *   cxW = origin.x；cyW = origin.y + yExt/2；czW = origin.z
 */
function projectWorldAABBToTargetLocal(
  target: Part,
  wb: WorldAABB,
): { cx: number; cy: number; cz: number; sx: number; sy: number; sz: number } {
  const { yExt } = worldExtents(target);
  const cxW = target.origin.x;
  const cyW = target.origin.y + yExt / 2;
  const czW = target.origin.z;
  const rotX = target.rotation?.x ?? 0;
  const rotY = target.rotation?.y ?? 0;
  const rotZ = target.rotation?.z ?? 0;
  // 取世界 AABB 8 角，轉到 local，再取 local AABB
  const corners: Array<{ x: number; y: number; z: number }> = [];
  for (const xs of [wb.xMin, wb.xMax]) {
    for (const ys of [wb.yMin, wb.yMax]) {
      for (const zs of [wb.zMin, wb.zMax]) {
        corners.push(
          worldDeltaToLocal(xs - cxW, ys - cyW, zs - czW, rotX, rotY, rotZ),
        );
      }
    }
  }
  const xs = corners.map((p) => p.x);
  const ys = corners.map((p) => p.y);
  const zs = corners.map((p) => p.z);
  const lxMin = Math.min(...xs), lxMax = Math.max(...xs);
  const lyMin = Math.min(...ys), lyMax = Math.max(...ys);
  const lzMin = Math.min(...zs), lzMax = Math.max(...zs);
  return {
    cx: (lxMin + lxMax) / 2,
    cy: (lyMin + lyMax) / 2,
    cz: (lzMin + lzMax) / 2,
    sx: lxMax - lxMin,
    sy: lyMax - lyMin,
    sz: lzMax - lzMin,
  };
}

function classifyKind(sibling: Part): ConnectionKind {
  const id = sibling.id.toLowerCase();
  const name = sibling.nameZh ?? "";
  if (id.includes("apron") || name.includes("牙條") || name.includes("牙板"))
    return "apron";
  if (
    id.includes("stretcher") ||
    name.includes("橫撐") ||
    name.includes("枨") ||
    name.includes("棖")
  )
    return "stretcher";
  return "other";
}

/**
 * 推導 target part 上的 connection marks。
 *
 * - 純函式，無副作用
 * - 不修改 target / design
 * - 同一 sibling 只產 1 mark（避免重複）
 * - shrink 5mm 對 splayed 系列 sibling
 */
export function inferConnectionMarks(
  target: Part,
  design: FurnitureDesign,
): ConnectionMark[] {
  const tWorldRaw = partWorldAABB(target);
  // 把 target AABB 各方向向外擴 2mm 做 filter 用，讓「貼面接合」(鄰件外緣剛好貼齊
  // target 外緣，例如 stool leg 跟 apron) 也被當成相交。本地 box 還是用未擴大版
  // 算，避免測試假設的 sizeX/sizeY 受影響。
  const tWorldInflated = inflateAABB(tWorldRaw, 2);
  const marks: ConnectionMark[] = [];

  for (const sib of design.parts) {
    if (sib.id === target.id) continue;
    const sWorld = shrinkSiblingAABB(partWorldAABB(sib), sib, 5);
    const inter = intersectAABB(tWorldInflated, sWorld);
    if (!inter) continue;
    // 相交體積 > 100mm³ threshold（取代舊版 siblingFullyEatenOnSomeAxis 嚴格約束）。
    // stool 下橫撐 X 軸跨多隻腳、Y 軸在腳底外、3 軸都沒被完整包覆 → 舊 filter 漏掉。
    if (intersectVolume(tWorldInflated, sWorld) < 100) continue;
    void siblingFullyEatenOnSomeAxis; // 保留 helper 給未來使用

    // local box derivation 用未擴大版 target，這樣 distanceFromEnd/Top 跟原本一致；
    // 跟 inflated tWorld 算 inter 就拿來判斷「有沒有接」即可。
    const interLocal = intersectAABB(tWorldRaw, sWorld) ?? inter;
    const local = projectWorldAABBToTargetLocal(target, interLocal);
    const L = target.visible.length;
    const T = target.visible.thickness;

    // 距端：以 local X 軸（length）兩端 ±L/2 取較近一邊
    const distStart = local.cx - -L / 2; // local.cx 距 -L/2
    const distEnd = +L / 2 - local.cx;
    const nearerEnd: "start" | "end" =
      Math.abs(distStart) <= Math.abs(distEnd) ? "start" : "end";
    const distanceFromEnd = Math.max(
      0,
      nearerEnd === "start" ? distStart : distEnd,
    );
    // 頂端 = local -T/2 對橫躺前 leg 而言是世界上方。沒旋轉時 local -T/2 = 部件
    // local Y 軸負端，但對 leg 慣例 part-local Y 是 thickness。對齊 svg-views
    // 慣例：local Y 軸負端在 OrthoView front view 顯示為上方。
    const distanceFromTop = local.cy - -T / 2;

    marks.push({
      localX: local.cx,
      localY: local.cy,
      localZ: local.cz,
      sizeX: local.sx,
      sizeY: local.sy,
      sizeZ: local.sz,
      siblingId: sib.id,
      siblingNameZh: sib.nameZh,
      kind: classifyKind(sib),
      distanceFromEnd,
      nearerEnd,
      distanceFromTop,
    });
  }

  // 同一個 part 多 mark：依 local Y 由小到大排（leader 上→下分散）
  marks.sort((a, b) => a.localY - b.localY);
  return marks;
}
