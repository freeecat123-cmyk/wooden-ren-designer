import type {
  FurnitureDesign,
  Mortise,
  Part,
  Tenon,
  TenonPosition,
} from "@/lib/types";
import { SHOULDER_MM } from "./standards";

/**
 * 端面側單肩通用 post-process（drafting-math.md §A10.10）。
 *
 * 規則：任何 mortise 沿其「長軸」距離母件對應 face < shoulder（5mm），
 * 視為「靠端面」會破，自動把 mortise 朝內偏 shoulder mm，paired tenon
 * 的 offsetWidth 跟著設成相同位移。配合公差讓端面側留材變 2 × shoulder
 * （10mm）保護 mortise。
 *
 * **注意**：只動 width 軸（tenon.offsetWidth），thickness 軸（offsetThickness）
 * 一律不動 —— 側視圖看榫頭跟母件中心對齊，不偏。Z 軸方向若靠近端面，
 * 此版本不處理（v1 限制；視覺上比 X 軸對稱重要，先求一致，邊緣保護不對稱
 * 是可接受的妥協）。
 *
 * v1 限制：
 * 1. 受方件（mortise 所在）必須 axis-aligned（無 rotation）。
 * 2. 公榫件（tenon 所在）也必須 axis-aligned；apron / 旋轉件不在此版套用。
 * 3. Tenon ↔ mortise pairing 用空間鄰近 + dim 對位雙重判定，
 *    避免 4 個對稱 mortise 各偏 5mm 但全部去偏到同一個 tenon 的問題。
 */

/**
 * 觸發臨界：mortise 沿長軸距離 face < TARGET_MARGIN 時保護。
 * 目標讓最終留材 = TARGET_MARGIN（= 2 × SHOULDER_MM = 10mm）。
 * shift 量 = TARGET_MARGIN − 現有距離。
 */
const TARGET_MARGIN = SHOULDER_MM * 2; // 10mm 目標留材
const DIM_TOL = 1; // mm
const PAIR_DIST_MAX = 30; // mm，tenon end ↔ mortise center 最大配對距離
const ROT_EPS = 0.01;

function hasRotation(p: Part): boolean {
  const rx = p.rotation?.x ?? 0;
  const ry = p.rotation?.y ?? 0;
  const rz = p.rotation?.z ?? 0;
  return Math.abs(rx) > ROT_EPS || Math.abs(ry) > ROT_EPS || Math.abs(rz) > ROT_EPS;
}

/** 推 mortise depth axis（跟 svg-views.tsx mortiseLocalBox 同邏輯） */
function inferDepthAxis(part: Part, m: Mortise): "x" | "y" | "z" {
  const lx = part.visible.length;
  const ly = part.visible.thickness;
  const lz = part.visible.width;
  const yToFace = Math.min(Math.abs(m.origin.y), Math.abs(m.origin.y - ly));
  const xToFace = Math.min(
    Math.abs(m.origin.x - lx / 2),
    Math.abs(m.origin.x + lx / 2),
  );
  const zToFace = Math.min(
    Math.abs(m.origin.z - lz / 2),
    Math.abs(m.origin.z + lz / 2),
  );
  if (yToFace <= xToFace && yToFace <= zToFace) return "y";
  if (xToFace <= zToFace) return "x";
  return "z";
}

/** Mortise 的 long axis（沿 mortise.length 方向）在 part-local 是哪根軸 */
function inferLongAxis(part: Part, m: Mortise): "x" | "y" | "z" {
  const depthAxis = inferDepthAxis(part, m);
  // 慣例（svg-views.tsx mortiseLocalBox）：
  //   depthAxis y → length 沿 X
  //   depthAxis x → length 沿 Y
  //   depthAxis z → length 沿 Y
  if (depthAxis === "y") return "x";
  return "y";
}

/**
 * 沿 mortise long axis 算邊距，回 shift 量（push 方向 = 讓 mortise 遠離邊）。
 * 兩面都靠近 = ambiguous = 不偏（return 0）。
 */
function computeShift(
  part: Part,
  m: Mortise,
  longAxis: "x" | "y" | "z",
): number {
  const halfLen = m.length / 2;

  if (longAxis === "y") {
    // Y 從底量
    const ly = part.visible.thickness;
    const center = m.origin.y;
    const distMinus = center - halfLen; // 距底面
    const distPlus = ly - (center + halfLen); // 距頂面
    if (
      distMinus >= 0 &&
      distMinus < TARGET_MARGIN &&
      distPlus >= TARGET_MARGIN
    ) {
      return TARGET_MARGIN - distMinus;
    }
    if (
      distPlus >= 0 &&
      distPlus < TARGET_MARGIN &&
      distMinus >= TARGET_MARGIN
    ) {
      return -(TARGET_MARGIN - distPlus);
    }
    return 0;
  }

  // X 或 Z（從 center 量，face 在 ±extent/2）
  const partExtent =
    longAxis === "x" ? part.visible.length : part.visible.width;
  const center = longAxis === "x" ? m.origin.x : m.origin.z;
  const distMinus = center - halfLen - -partExtent / 2;
  const distPlus = partExtent / 2 - (center + halfLen);
  if (
    distMinus >= 0 &&
    distMinus < TARGET_MARGIN &&
    distPlus >= TARGET_MARGIN
  ) {
    return TARGET_MARGIN - distMinus; // push toward +
  }
  if (
    distPlus >= 0 &&
    distPlus < TARGET_MARGIN &&
    distMinus >= TARGET_MARGIN
  ) {
    return -(TARGET_MARGIN - distPlus); // push toward -
  }
  return 0;
}

/**
 * Tenon 的 width 軸（offsetWidth 走的軸）在 world 座標的方向。
 * 對 part 的 Euler XYZ rotation 套單位向量得 world 軸 + 符號。
 *
 * 慣例：
 *   start/end 位置 → width 沿 part-local Z
 *   top/bottom    → width 沿 part-local X
 *   left/right    → width 沿 part-local X
 *
 * v2（C.1）：取代 v1「skip rotated parts」的限制。對 apron 等 X 軸 90° 旋
 * 轉零件能正確算出 width-axis 在 world Y 的負方向（sign=-1），edge-protection
 * 因此能設正確 offsetWidth 值。
 */
function tenonWidthAxisInWorld(
  part: Part,
  position: TenonPosition,
): { axis: "x" | "y" | "z"; sign: 1 | -1 } | null {
  // Width 軸的 part-local 單位向量
  const localVec: [number, number, number] =
    position === "start" || position === "end"
      ? [0, 0, 1]
      : [1, 0, 0]; // top/bottom/left/right 都走 X
  let [x, y, z] = localVec;
  const rx = part.rotation?.x ?? 0;
  const ry = part.rotation?.y ?? 0;
  const rz = part.rotation?.z ?? 0;
  // Three.js Euler XYZ: M = Rx * Ry * Rz；先 Rz、再 Ry、再 Rx 套。
  // 跟 svg-views.tsx projectFeatureRect 同順序。
  // Rx
  let y2 = y * Math.cos(rx) - z * Math.sin(rx);
  let z2 = y * Math.sin(rx) + z * Math.cos(rx);
  y = y2;
  z = z2;
  // Ry
  let x2 = x * Math.cos(ry) + z * Math.sin(ry);
  z2 = -x * Math.sin(ry) + z * Math.cos(ry);
  x = x2;
  z = z2;
  // Rz
  x2 = x * Math.cos(rz) - y * Math.sin(rz);
  y2 = x * Math.sin(rz) + y * Math.cos(rz);
  x = x2;
  y = y2;
  const ax = Math.abs(x);
  const ay = Math.abs(y);
  const az = Math.abs(z);
  const max = Math.max(ax, ay, az);
  if (max < 0.9) return null; // 非軸對齊（自由旋轉），v2 不處理
  if (ax === max) return { axis: "x", sign: x > 0 ? 1 : -1 };
  if (ay === max) return { axis: "y", sign: y > 0 ? 1 : -1 };
  return { axis: "z", sign: z > 0 ? 1 : -1 };
}

/** Tenon 凸出端中心點的 part-local 座標（centered，未加 part.origin） */
function tenonEndLocal(
  position: TenonPosition,
  part: Part,
  t: Tenon,
): { x: number; y: number; z: number } {
  const lx = part.visible.length;
  const ly = part.visible.thickness;
  const lz = part.visible.width;
  const oW = t.offsetWidth ?? 0;
  const oT = t.offsetThickness ?? 0;
  switch (position) {
    case "start":
      return { x: -lx / 2 - t.length / 2, y: oT, z: oW };
    case "end":
      return { x: +lx / 2 + t.length / 2, y: oT, z: oW };
    case "top":
      return { x: oW, y: +ly / 2 + t.length / 2, z: oT };
    case "bottom":
      return { x: oW, y: -ly / 2 - t.length / 2, z: oT };
    case "left":
      return { x: oW, y: oT, z: -lz / 2 - t.length / 2 };
    case "right":
      return { x: oW, y: oT, z: +lz / 2 + t.length / 2 };
  }
}

/** Tenon 凸出端中心 → world 座標。v2 支援 rotation（套 Euler XYZ）。 */
function tenonEndWorld(part: Part, t: Tenon): { x: number; y: number; z: number } | null {
  const local = tenonEndLocal(t.position, part, t);
  const ly = part.visible.thickness;
  // 套 Euler XYZ rotation（與 svg-views projectFeatureRect 一致）
  const rx = part.rotation?.x ?? 0;
  const ry = part.rotation?.y ?? 0;
  const rz = part.rotation?.z ?? 0;
  let { x, y, z } = local;
  // Rx
  let y2 = y * Math.cos(rx) - z * Math.sin(rx);
  let z2 = y * Math.sin(rx) + z * Math.cos(rx);
  y = y2; z = z2;
  // Ry
  let x2 = x * Math.cos(ry) + z * Math.sin(ry);
  z2 = -x * Math.sin(ry) + z * Math.cos(ry);
  x = x2; z = z2;
  // Rz
  x2 = x * Math.cos(rz) - y * Math.sin(rz);
  y2 = x * Math.sin(rz) + y * Math.cos(rz);
  x = x2; y = y2;
  return {
    x: part.origin.x + x,
    y: part.origin.y + ly / 2 + y,
    z: part.origin.z + z,
  };
}

/** Mortise 中心 → world 座標。回 null 代表 v1 不處理。 */
function mortiseCenterWorld(part: Part, m: Mortise): { x: number; y: number; z: number } | null {
  if (hasRotation(part)) return null;
  // m.origin.y 是從底量，其他軸從 center 量
  return {
    x: part.origin.x + m.origin.x,
    y: part.origin.y + m.origin.y,
    z: part.origin.z + m.origin.z,
  };
}

/** 找空間最近的 paired tenon（dim 也要對位） */
function findPairedTenon(
  parts: Part[],
  receivingPart: Part,
  m: Mortise,
  morCenter: { x: number; y: number; z: number },
): { partIndex: number; tenonIndex: number } | null {
  let best: { partIndex: number; tenonIndex: number; dist: number } | null = null;
  for (let pi = 0; pi < parts.length; pi++) {
    const other = parts[pi];
    if (other.id === receivingPart.id) continue;
    // v2：rotated 公榫件也接受（tenonEndWorld 已套 rotation）
    for (let ti = 0; ti < other.tenons.length; ti++) {
      const t = other.tenons[ti];
      if (
        Math.abs(m.depth - t.length) > DIM_TOL ||
        Math.abs(m.length - t.width) > DIM_TOL ||
        Math.abs(m.width - t.thickness) > DIM_TOL
      )
        continue;
      const tw = tenonEndWorld(other, t);
      if (!tw) continue;
      const dx = tw.x - morCenter.x;
      const dy = tw.y - morCenter.y;
      const dz = tw.z - morCenter.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dist > PAIR_DIST_MAX) continue;
      if (!best || dist < best.dist) {
        best = { partIndex: pi, tenonIndex: ti, dist };
      }
    }
  }
  return best ? { partIndex: best.partIndex, tenonIndex: best.tenonIndex } : null;
}

/**
 * Apply edge protection to a design.
 * 不變動 visible.length（butt-joint 慣例不變），只動 mortise.origin 跟 tenon.offsetWidth。
 */
export function applyEdgeProtection(design: FurnitureDesign): FurnitureDesign {
  const parts: Part[] = design.parts.map((p) => ({
    ...p,
    tenons: p.tenons.map((t) => ({ ...t })),
    mortises: p.mortises.map((m) => ({ ...m, origin: { ...m.origin } })),
  }));

  for (const part of parts) {
    if (hasRotation(part)) continue;
    for (const m of part.mortises) {
      const longAxis = inferLongAxis(part, m);
      const shift = computeShift(part, m, longAxis);
      if (shift === 0) continue;

      const morCenter = mortiseCenterWorld(part, m);
      if (!morCenter) continue;
      const pair = findPairedTenon(parts, part, m, morCenter);
      if (!pair) continue;

      // 套 shift 到 mortise origin
      if (longAxis === "x") m.origin.x += shift;
      else if (longAxis === "z") m.origin.z += shift;
      else m.origin.y += shift;

      // 套 world-axis shift 到 paired tenon's offsetWidth
      // v2：tenon 公榫件可能有 rotation，width 軸在 world 不一定 = mortise long
      // 軸；先算 tenon width 軸的 world 方向 + 符號，只有跟 mortise long 軸吻合
      // 才能用 offsetWidth 補償（不吻合就跳過——thickness 軸 v2 也不動，避免
      // 改側視圖渲染對齊）。
      const tenonPart = parts[pair.partIndex];
      const t = tenonPart.tenons[pair.tenonIndex];
      const widthInfo = tenonWidthAxisInWorld(tenonPart, t.position);
      if (!widthInfo || widthInfo.axis !== longAxis) continue;
      // shift 是 mortise origin 沿 longAxis world 方向的位移
      // tenon offsetWidth × widthInfo.sign = world 方向位移
      // → offsetWidth = shift × widthInfo.sign（sign ∈ ±1，故 ÷sign = ×sign）
      const offsetVal = shift * widthInfo.sign;
      t.offsetWidth = (t.offsetWidth ?? 0) + offsetVal;
      // 同步 shoulderOn：tenon 中心朝 +width 偏 → "right"（+width side）跟母件
      // 邊齊平、那邊沒肩 → 從 shoulderOn 移除 "right"。反之移除 "left"。
      // 慣例（tenon cross-section）："left/right" = ±width 軸；"top/bottom" = ±thickness 軸。
      if (Math.abs(t.offsetWidth) > 0.5) {
        const sideToRemove: "left" | "right" =
          t.offsetWidth > 0 ? "right" : "left";
        const current = t.shoulderOn ?? ["top", "bottom", "left", "right"];
        t.shoulderOn = current.filter((s) => s !== sideToRemove);
      }
    }
  }

  return { ...design, parts };
}
