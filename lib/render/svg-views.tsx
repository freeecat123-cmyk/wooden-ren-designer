"use client";

import { memo } from "react";
import type { FurnitureDesign, Part } from "@/lib/types";
import { calculateCutDimensions } from "@/lib/geometry/cut-dimensions";
import { MATERIALS } from "@/lib/materials";
import { JOINERY_LABEL, JOINERY_LABEL_EN } from "@/lib/joinery/details";
import { partName } from "@/lib/templates/part-names";
import { formatLengthBare, formatInchFraction, formatMm } from "@/lib/units/format";
import {
  MM3_PER_BDFT,
  SHEET_GOOD_LABEL,
  effectiveBillableMaterial,
} from "@/lib/pricing/catalog";
import {
  classifyEdgeVisibility,
  hasNonQuarterRotation,
  isPartHidden,
  makeHiddenChecker,
  pointInPolygon,
  projectPart,
  projectPartPolygon,
  projectTiltedBoxSilhouette,
  sortPartsByDepth,
  worldExtents,
  type OrthoView as OrthoViewKind,
} from "@/lib/render/geometry";

/** Sutherland-Hodgman: clip polygon to horizontal half-plane. */
function clipPolygonHalfPlane(
  poly: Array<{ x: number; y: number }>,
  clipY: number,
  side: "above" | "below",
) {
  if (poly.length === 0) return poly;
  const out: Array<{ x: number; y: number }> = [];
  const n = poly.length;
  const inside = side === "above" ? (y: number) => y >= clipY : (y: number) => y <= clipY;
  for (let i = 0; i < n; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % n];
    const aIn = inside(a.y);
    const bIn = inside(b.y);
    if (aIn && bIn) out.push(b);
    else if (aIn && !bIn) {
      const t = (clipY - a.y) / (b.y - a.y);
      out.push({ x: a.x + (b.x - a.x) * t, y: clipY });
    } else if (!aIn && bIn) {
      const t = (clipY - a.y) / (b.y - a.y);
      out.push({ x: a.x + (b.x - a.x) * t, y: clipY });
      out.push(b);
    }
  }
  return out;
}
const clipPolygonAboveY = (poly: Array<{ x: number; y: number }>, clipY: number) =>
  clipPolygonHalfPlane(poly, clipY, "above");
const clipPolygonBelowY = (poly: Array<{ x: number; y: number }>, clipY: number) =>
  clipPolygonHalfPlane(poly, clipY, "below");

interface ViewProps {
  design: FurnitureDesign;
}

const PADDING = 220; // 留空間給內外尺寸雙標線 + zone 高度鏈 + 腳高（避免文字撞外框）
const DIM_OFFSET = 50;
const TITLE_BAR_H = 32;

/**
 * 統一抓家具的標線資訊。涵蓋櫃體 / 桌 / 椅 / 凳 / 桌附下層 / 各種板件。
 *
 * - main = 主水平面（櫃頂 / 桌面 / 座板）
 * - cabinet = 同時有 top + bottom 才算（櫃體獨有的內部尺寸 + zone 鏈）
 * - shelves = 任何 id 含 "shelf" 或 "under-shelf" 的板（茶几下層、書櫃內層）
 */
function extractFurnitureDims(design: FurnitureDesign) {
  const topPart = design.parts.find((p) => p.id === "top");
  const seatPart = design.parts.find((p) => p.id === "seat");
  const bottomPart = design.parts.find((p) => p.id === "bottom");
  const main = topPart ?? seatPart;
  if (!main) return null;

  const mainT = main.visible.thickness;
  const mainBottomY = main.origin.y;
  const mainTopY = main.origin.y + mainT;
  const mainKind: "top" | "seat" = topPart ? "top" : "seat";

  const cabinet =
    topPart && bottomPart
      ? (() => {
          const panelT = topPart.visible.thickness;
          const innerW = topPart.visible.length - 2 * panelT;
          const bottomTopY = bottomPart.origin.y + bottomPart.visible.thickness;
          const topBottomY = topPart.origin.y;
          const innerH = topBottomY - bottomTopY;
          const sideLeft = design.parts.find((p) => p.id === "side-left");
          const innerD = sideLeft ? sideLeft.visible.width : topPart.visible.width;
          const legHeight = bottomPart.origin.y;
          return { panelT, innerW, innerH, innerD, bottomTopY, topBottomY, legHeight };
        })()
      : null;

  // 額外水平板（茶几下層架、書櫃內層、bench under-shelf）
  const shelves = design.parts
    .filter((p) => /shelf/.test(p.id) || /under-shelf/.test(p.id))
    .map((p) => ({
      id: p.id,
      nameZh: p.nameZh,
      bottomY: p.origin.y,
      topY: p.origin.y + p.visible.thickness,
      thickness: p.visible.thickness,
    }))
    .sort((a, b) => a.bottomY - b.bottomY);

  // 橫向構件：牙板 / 橫撐 / 椅背料 / footrest 等（Y 位置 = origin.y, yExt 用 worldExtents）
  const crossPieces = design.parts
    .filter((p) =>
      /^(apron|upper-apron|ls-|stretcher|lower-stretcher|back-rail|back-top-rail|back-splat|footrest|center-stretcher)/.test(
        p.id,
      ),
    )
    .map((p) => {
      const { yExt } = worldExtents(p);
      // 所有橫撐都標總長（拉箭頭）；梯形橫撐多標斜面角度
      // length = visible.length（bottom 邊長度，or 一般矩形的長度）
      // 斜面角度 = atan((bottom - top) / 2 / apronWidth)，trap shape 才有
      const trap = p.shape?.kind === "apron-trapezoid" ? p.shape : null;
      // 中軸對齊後 bottomLengthScale 也可能 ≠ 1（top 收、bot 放），
      // 取兩端較長者當切料長，角度看 top↔bot 差
      const trapBotLen = trap ? p.visible.length * trap.bottomLengthScale : p.visible.length;
      const trapTopLen = trap ? p.visible.length * trap.topLengthScale : p.visible.length;
      const cutLengthMm = Math.max(trapBotLen, trapTopLen);
      // 梯形件兩端不等長：保留上邊(接座)/下邊(接地)讓主三視圖也標兩個數,
      // 跟零件圖一致(user 2026-06-01「三視圖也改標上下邊」)。非梯形 = null。
      const trapTopMm = trap ? trapTopLen : null;
      const trapBotMm = trap ? trapBotLen : null;
      const cutAngleDeg = trap
        ? (Math.atan(Math.abs(trapBotLen - trapTopLen) / 2 / p.visible.width) *
            180) /
          Math.PI
        : 0;
      // 軸向：rotation.y ≈ π/2 → Z 軸橫撐（左/右），else X 軸（前/後）
      // 用來決定哪個視圖該顯示這條橫撐的長度標
      const isZAxis = Math.abs(p.rotation?.y ?? 0) > Math.PI / 4;
      // arch-bent（如 Windsor bow）會往 +Z 凸出 bendMm，側視圖標籤要避讓
      const archBendMm = p.shape?.kind === "arch-bent" ? p.shape.bendMm : 0;
      return {
        id: p.id,
        nameZh: p.nameZh,
        bottomY: p.origin.y,
        topY: p.origin.y + yExt,
        yExt,
        cutLengthMm,
        trapTopMm,
        trapBotMm,
        cutAngleDeg,
        isZAxis,
        archBendMm,
      };
    })
    .sort((a, b) => a.bottomY - b.bottomY);

  // 腳：取所有 id 開頭為 leg- 的件（俯視圖用來標腳跨距 / 腳粗）
  const legs = design.parts.filter((p) => /^leg-?\d*$/.test(p.id));
  // 外斜腳的最大落地點偏移（splayed shape 的 dxMm / dzMm 絕對值最大者）
  // 用來算落地點 X / Z 範圍 vs 椅面邊距
  const maxSplayDx = Math.max(
    0,
    ...legs.map((p) =>
      p.shape?.kind === "splayed" || p.shape?.kind === "splayed-tapered" || p.shape?.kind === "splayed-round-tapered"
        ? Math.abs(p.shape.dxMm)
        : 0,
    ),
  );
  const maxSplayDz = Math.max(
    0,
    ...legs.map((p) =>
      p.shape?.kind === "splayed" || p.shape?.kind === "splayed-tapered" || p.shape?.kind === "splayed-round-tapered"
        ? Math.abs(p.shape.dzMm)
        : 0,
    ),
  );
  const legFootprint =
    legs.length >= 2
      ? (() => {
          const xs = legs.map((p) => p.origin.x);
          const zs = legs.map((p) => p.origin.z);
          const minX = Math.min(...xs);
          const maxX = Math.max(...xs);
          const minZ = Math.min(...zs);
          const maxZ = Math.max(...zs);
          // 用第一根腳的「橫切面」當作腳粗（visible.length 通常 = legSize）
          const sample = legs[0];
          const legSize = Math.min(sample.visible.length, sample.visible.width);
          return { minX, maxX, minZ, maxZ, legSize, count: legs.length };
        })()
      : null;

  return {
    legs,
    maxSplayDx,
    maxSplayDz,
    main,
    mainT,
    mainBottomY,
    mainTopY,
    mainKind,
    cabinet,
    shelves,
    crossPieces,
    legFootprint,
  };
}

/**
 * 抓 zones 模式下每片 boundary 板的 Y 位置（origin.y = 板下緣）。
 * 用來在前視圖左側畫每個 zone 的高度標示鏈。
 */
function extractZoneBoundaryYs(design: FurnitureDesign): number[] {
  return design.parts
    .filter((p) => /^z\d+-boundary$/.test(p.id))
    .map((p) => p.origin.y)
    .sort((a, b) => a - b);
}

function partFill(part: Part) {
  return MATERIALS[part.material].color;
}

/**
 * lathe-turned 花瓶輪廓段表（前/側視 polygon 取樣用）。
 * 每段 [topR, botR, hFrac]：topR/botR 是該段上下半徑相對 fullR 的比例，
 * hFrac 是該段佔總高 fullH 的比例。從頂端往下累加。
 * 同份資料供 svg-views 內部畫輪廓 & part-drawing 的 LatheSegmentTable 列段別表。
 */
export const LATHE_SEG: ReadonlyArray<readonly [number, number, number]> = [
  [1.0, 1.0, 0.05], [1.0, 1.10, 0.04], [1.10, 1.0, 0.04],
  [1.0, 0.55, 0.10], [0.55, 0.78, 0.18], [0.78, 0.55, 0.20],
  [0.55, 0.50, 0.10], [0.50, 0.95, 0.10], [0.95, 0.85, 0.05],
  [0.85, 0.95, 0.06], [0.95, 0.95, 0.05], [0.95, 0.80, 0.03],
];

/**
 * OrthoView viewBox + projector context passed to `overlayContent` slot.
 * 讓零件圖 overlay（T1 尺寸/T2 榫卯虛框/木紋箭頭等）能對齊 OrthoView 的 viewBox。
 */
export interface OrthoViewBoxCtx {
  vbX: number;
  vbY: number;
  vbW: number;
  vbH: number;
  /** Convert part-local mm coords to SVG pixel coords for this view. */
  partLocalToSvg(localX: number, localY: number, localZ: number): { x: number; y: number };
}

// ─── Joinery overlay (Phase 1.5) ────────────────────────────────────────────
// 把 part-local AABB（tenon 或 mortise 的小箱）投影到 view 平面，回 bbox。
// 採跟 projectPartSilhouette 相同的 Euler XYZ + bottom-origin 慣例：
//   M = Rx * Ry * Rz；part.origin.y 是 part 底部；local 軸 length=X、thickness=Y、width=Z
export type LocalBox = {
  cx: number; cy: number; cz: number;     // local center (centered on length/thickness/width)
  hx: number; hy: number; hz: number;     // half-extents
  rotX?: number;                          // 額外繞 part-local X 軸旋轉（弧度）—外撇牆 cosmetic 孔 / splayed apron X 面榫
  rotY?: number;                          // 額外繞 part-local Y 軸旋轉（弧度）—rect 筆筒壁 dado dim swap
  rotZ?: number;                          // 額外繞 part-local Z 軸旋轉（弧度）—splayed apron Z 面榫的 tilt
};

/**
 * 把 part-local 點 (xL, yL, zL) 經 part 的 Euler XYZ rotation + origin 投影
 * 到指定 view 的 (vx, vy)。共用給 projectFeatureRect。
 */
function makeProjector(part: Part, view: OrthoViewKind) {
  const rx = part.rotation?.x ?? 0;
  const ry = part.rotation?.y ?? 0;
  const rz = part.rotation?.z ?? 0;
  const cx_ = Math.cos(rx), sx_ = Math.sin(rx);
  const cy_ = Math.cos(ry), sy_ = Math.sin(ry);
  const cz_ = Math.cos(rz), sz_ = Math.sin(rz);
  const { yExt } = worldExtents(part);
  const yOffset = part.origin.y + yExt / 2;
  return (xL: number, yL: number, zL: number) => {
    let x = xL, y = yL, z = zL;
    let y2 = y * cx_ - z * sx_;
    let z2 = y * sx_ + z * cx_;
    y = y2; z = z2;
    let x2 = x * cy_ + z * sy_;
    z2 = -x * sy_ + z * cy_;
    x = x2; z = z2;
    x2 = x * cz_ - y * sz_;
    y2 = x * sz_ + y * cz_;
    x = x2; y = y2;
    const wx = x + part.origin.x;
    const wy = y + yOffset;
    const wz = z + part.origin.z;
    if (view === "top") return { x: -wx, y: wz };
    // 側視（從 +X 看 -X，第三角法右側視圖）：viewer 右手 = -Z = 家具前面，
    // SVG x 增加方向 = 右邊 → 前面（-Z）映射到 SVG +x（右）→ 取 -wz。
    // 之前用 +wz 等於把側視畫成「左側視」（從 -X 看 +X），跟 UI 排版
    // [front][side][top] 第三角法右側位置不一致：把手在前面（-Z）卻
    // 顯示在 SVG 左邊。本 commit 統一為「前=右」。
    if (view === "side") return { x: -wz, y: wy };
    return { x: -wx, y: wy };
  };
}

/** 簡易 Andrew monotone-chain convex hull 2D（svg-views 內部用） */
function convexHull2DLocal(pts: Array<{ x: number; y: number }>): Array<{ x: number; y: number }> {
  if (pts.length < 3) return pts.slice();
  const sorted = pts.slice().sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }) =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: Array<{ x: number; y: number }> = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: Array<{ x: number; y: number }> = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  upper.pop(); lower.pop();
  return lower.concat(upper);
}

/**
 * Box center 在世界座標（套 deform + rotation + origin）。
 * 用來做 tenon ↔ mortise spatial match：榫接時公榫端面與母件 mortise 開口面
 * 在世界座標重合（誤差 < 1mm），可用最近距離找對應母榫。
 */
function boxWorldCenter(part: Part, box: LocalBox): { x: number; y: number; z: number } {
  const ly = part.visible.thickness;
  const rx = part.rotation?.x ?? 0;
  const ry = part.rotation?.y ?? 0;
  const rz = part.rotation?.z ?? 0;
  const cx_ = Math.cos(rx), sx_ = Math.sin(rx);
  const cy_ = Math.cos(ry), sy_ = Math.sin(ry);
  const cz_ = Math.cos(rz), sz_ = Math.sin(rz);
  const { yExt } = worldExtents(part);
  const yOffset = part.origin.y + yExt / 2;
  let x = box.cx, y = box.cy, z = box.cz;
  const shape = part.shape;
  if (shape?.kind === "splayed") {
    const yFromBottom = y + ly / 2;
    const t = ly > 0 ? Math.max(0, 1 - yFromBottom / ly) : 0;
    x += (shape.dxMm ?? 0) * t;
    z += (shape.dzMm ?? 0) * t;
  }
  let y2 = y * cx_ - z * sx_;
  let z2 = y * sx_ + z * cx_;
  y = y2; z = z2;
  let x2 = x * cy_ + z * sy_;
  z2 = -x * sy_ + z * cy_;
  x = x2; z = z2;
  x2 = x * cz_ - y * sz_;
  y2 = x * sz_ + y * cz_;
  x = x2; y = y2;
  return { x: x + part.origin.x, y: y + yOffset, z: z + part.origin.z };
}

function projectFeatureRect(
  part: Part,
  box: LocalBox,
  view: OrthoViewKind,
): { x: number; y: number; w: number; h: number } {
  const polygon = projectFeaturePolygon(part, box, view);
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const c of polygon) {
    if (c.x < minX) minX = c.x;
    if (c.x > maxX) maxX = c.x;
    if (c.y < minY) minY = c.y;
    if (c.y > maxY) maxY = c.y;
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/**
 * Box → polygon corners projected to view space, with part shape deformation
 * applied so mortise / tenon track splay / taper / apron-trapezoid 變形。
 * 用於 svg `<polygon>` 直接渲染斜邊。
 */
function projectFeaturePolygon(
  part: Part,
  box: LocalBox,
  view: OrthoViewKind,
  /** true = box 是 tenon/mortise 之類 feature（強制走 full bevel，不套 half-bevel 的 top-only 邏輯） */
  isFeature = false,
): Array<{ x: number; y: number }> {
  const lx = part.visible.length;
  const ly = part.visible.thickness;
  const lz = part.visible.width;
  const rx = part.rotation?.x ?? 0;
  const ry = part.rotation?.y ?? 0;
  const rz = part.rotation?.z ?? 0;
  const cx_ = Math.cos(rx), sx_ = Math.sin(rx);
  const cy_ = Math.cos(ry), sy_ = Math.sin(ry);
  const cz_ = Math.cos(rz), sz_ = Math.sin(rz);
  const { yExt } = worldExtents(part);
  const yOffset = part.origin.y + yExt / 2;

  // 套 part shape 變形：splayed 腳（local Y 軸 = mesh 高度方向）
  // 俯視圖（top）：splay 是 Y 軸高度的偏移，垂直往下看不到「上下不同 X/Z」的差異，
  // 應該顯示為 box 中心的單一 footprint（axis-aligned rect）。所以 top view 用 fixed t。
  // t 不 clamp：腳頂上方（如腳頂凸出 tenon）t < 0，splay 軸線繼續延伸朝家具中心偏。
  const shape = part.shape;
  const fixedT =
    view === "top" && shape?.kind === "splayed" && ly > 0
      ? 1 - (box.cy + ly / 2) / ly
      : null;
  const deform = (xL: number, yL: number, zL: number): [number, number, number] => {
    if (!shape) return [xL, yL, zL];
    if (shape.kind === "splayed") {
      const t =
        fixedT !== null
          ? fixedT
          : ly > 0
            ? 1 - (yL + ly / 2) / ly
            : 0;
      return [xL + (shape.dxMm ?? 0) * t, yL, zL + (shape.dzMm ?? 0) * t];
    }
    // apron-trapezoid: 沿 z 軸線性內插（z=-lz/2 用 topLengthScale, z=+lz/2 用 bottomLengthScale）
    // bevelAngle 套 z shear；bevelMode="half" 時只 top vertex (z<0) 套 shear
    // tenon (isFeature=true) 完全不套 bevel shear（讓 tenon 4 邊都跟著 rotation tilt → 都斜）
    // body 走原本邏輯（full bevel = 上下水平 / half bevel = 只 top 水平）
    if (shape.kind === "apron-trapezoid") {
      const tZ = lz > 0 ? (zL + lz / 2) / lz : 0.5;
      const xScale = shape.topLengthScale + (shape.bottomLengthScale - shape.topLengthScale) * tZ;
      const bev = shape.bevelAngle ?? 0;
      const halfMode = shape.bevelMode === "half";
      const bevShear = Math.tan(bev);
      const applyShear = isFeature ? false : (halfMode ? zL < 0 : true);
      const zOut = zL - (applyShear ? yL * bevShear : 0);
      return [xL * xScale, yL, zOut];
    }
    if (shape.kind === "apron-beveled") {
      const bevShear = Math.tan(shape.bevelAngle);
      const zOut = isFeature ? zL : zL - yL * bevShear;
      return [xL, yL, zOut];
    }
    if (shape.kind === "apron-half-beveled") {
      const bevShear = Math.tan(shape.bevelAngle);
      const applyShear = isFeature ? false : zL < 0;
      const zOut = applyShear ? zL - yL * bevShear : zL;
      return [xL, yL, zOut];
    }
    return [xL, yL, zL];
  };

  const project = (xL_in: number, yL_in: number, zL_in: number) => {
    const [xL, yL, zL] = deform(xL_in, yL_in, zL_in);
    let x = xL, y = yL, z = zL;
    let y2 = y * cx_ - z * sx_;
    let z2 = y * sx_ + z * cx_;
    y = y2; z = z2;
    let x2 = x * cy_ + z * sy_;
    z2 = -x * sy_ + z * cy_;
    x = x2; z = z2;
    x2 = x * cz_ - y * sz_;
    y2 = x * sz_ + y * cz_;
    x = x2; y = y2;
    const wx = x + part.origin.x;
    const wy = y + yOffset;
    const wz = z + part.origin.z;
    let vx: number, vy: number;
    if (view === "top") { vx = -wx; vy = wz; }
    // 側視 = 右側視（從 +X 看 -X），前面（-Z）→ SVG 右（+x）→ 取 -wz
    else if (view === "side") { vx = -wz; vy = wy; }
    else { vx = -wx; vy = wy; }
    return { x: vx, y: vy };
  };

  // box 自己的 Euler XYZ 旋轉（splayed apron mortise 的 rotZ ≈ tiltX 等）
  const brx = box.rotX ?? 0, bry = box.rotY ?? 0, brz = box.rotZ ?? 0;
  const bcx = Math.cos(brx), bsx = Math.sin(brx);
  const bcy = Math.cos(bry), bsy = Math.sin(bry);
  const bcz = Math.cos(brz), bsz = Math.sin(brz);
  const rotateBoxCorner = (ox: number, oy: number, oz: number) => {
    let x = ox, y = oy, z = oz;
    if (brx) { const ny = y * bcx - z * bsx, nz = y * bsx + z * bcx; y = ny; z = nz; }
    if (bry) { const nx = x * bcy + z * bsy, nz = -x * bsy + z * bcy; x = nx; z = nz; }
    if (brz) { const nx = x * bcz - y * bsz, ny = x * bsz + y * bcz; x = nx; y = ny; }
    return [x, y, z] as [number, number, number];
  };

  const corners: Array<{ x: number; y: number }> = [];
  for (const sx of [-1, 1])
    for (const sy of [-1, 1])
      for (const sz of [-1, 1]) {
        const [ox, oy, oz] = rotateBoxCorner(sx * box.hx, sy * box.hy, sz * box.hz);
        corners.push(project(box.cx + ox, box.cy + oy, box.cz + oz));
      }
  // unused vars to avoid lint
  void lx; void lz;
  return convexHull2DLocal(corners);
}

/**
 * Tenon 在公榫件 local 座標下的 AABB（凸出部分）。
 * 慣例（drafting-math.md §A5/§B2）：
 *   "start" 沿 -X、"end" 沿 +X 凸出；
 *   "top" 沿 +Y、"bottom" 沿 -Y 凸出；
 *   "left" 沿 -Z、"right" 沿 +Z 凸出。
 *   length = 凸出方向尺寸；width × thickness 是斷面（4 邊全肩居中）。
 *   斷面對應軸：start/end → width 沿 Z、thickness 沿 Y；
 *              top/bottom → width 沿 X、thickness 沿 Z；
 *              left/right → width 沿 X、thickness 沿 Y。
 */
/**
 * 公榫件「肩位」rectangle（drafting-math.md §B2/§B6）。畫在公榫件本體面上
 * 的扁平 box（protrusion 軸 half-extent = 0），等同 tenon 跨刀紋——三視圖
 * 從肩面方向看是 rect、其他視圖是 line。標記「肩到肩」邊界讓木工知道從
 * 哪裡開始切肩。
 */
function tenonShoulderBox(part: Part, tenon: Part["tenons"][number]): LocalBox {
  const lx = part.visible.length;
  const ly = part.visible.thickness;
  const lz = part.visible.width;
  const W = tenon.width;
  const T = tenon.thickness;
  const oW = tenon.offsetWidth ?? 0;
  const oT = tenon.offsetThickness ?? 0;
  switch (tenon.position) {
    case "start":  return { cx: -lx / 2, cy: oT, cz: oW, hx: 0, hy: T / 2, hz: W / 2 };
    case "end":    return { cx: +lx / 2, cy: oT, cz: oW, hx: 0, hy: T / 2, hz: W / 2 };
    case "top":    return { cx: oW, cy: +ly / 2, cz: oT, hx: W / 2, hy: 0, hz: T / 2 };
    case "bottom": return { cx: oW, cy: -ly / 2, cz: oT, hx: W / 2, hy: 0, hz: T / 2 };
    case "left":   return { cx: oW, cy: oT, cz: -lz / 2, hx: W / 2, hy: T / 2, hz: 0 };
    case "right":  return { cx: oW, cy: oT, cz: +lz / 2, hx: W / 2, hy: T / 2, hz: 0 };
  }
}

export function tenonLocalBox(part: Part, tenon: Part["tenons"][number]): LocalBox {
  const lx = part.visible.length;
  const ly = part.visible.thickness;
  const lz = part.visible.width;
  const L = tenon.length;
  const W = tenon.width;     // 斷面寬
  const T = tenon.thickness; // 斷面厚
  // 不對稱榫接的中心偏移（drafting-math.md §A10.10）
  const oW = tenon.offsetWidth ?? 0;
  const oT = tenon.offsetThickness ?? 0;
  let cx = 0, cy = 0, cz = 0, hx = 0, hy = 0, hz = 0;
  switch (tenon.position) {
    // start/end：length 沿 ±X，width 沿 Z，thickness 沿 Y
    case "start":
      cx = -lx / 2 - L / 2; cy = oT; cz = oW; hx = L / 2; hy = T / 2; hz = W / 2; break;
    case "end":
      cx = +lx / 2 + L / 2; cy = oT; cz = oW; hx = L / 2; hy = T / 2; hz = W / 2; break;
    // top/bottom：length 沿 ±Y，width 沿 X，thickness 沿 Z
    case "top":
      cx = oW; cy = +ly / 2 + L / 2; cz = oT; hx = W / 2; hy = L / 2; hz = T / 2; break;
    case "bottom":
      cx = oW; cy = -ly / 2 - L / 2; cz = oT; hx = W / 2; hy = L / 2; hz = T / 2; break;
    // left/right：length 沿 ±Z，width 沿 X，thickness 沿 Y
    case "left":
      cx = oW; cy = oT; cz = -lz / 2 - L / 2; hx = W / 2; hy = T / 2; hz = L / 2; break;
    case "right":
      cx = oW; cy = oT; cz = +lz / 2 + L / 2; hx = W / 2; hy = T / 2; hz = L / 2; break;
  }
  // 注意：tenon.axis 是「世界座標系」單位向量（由 computeCompoundSplayNormal
  // 算的腳/牙板斜接法向），不是 part-local。早期版本（2af8c14）在這裡誤把
  // axis 當 part-local 加到 cx/cy/cz：經過 part.rotation 後再次旋轉，產生
  // 大幅錯位（左右牙板榫在正/側視變兩疊、位置鏡像到腳外側）。
  //
  // 修正：axis 只用在 CompoundMiterAnnotation 文字角度（α₁/α₂），不參與
  // tenon body 的 part-local 位置；位置完全靠 position-default 的 cx/cy/cz +
  // part.rotation 自然投影即可。PerspectiveView 也走同樣慣例（只用 axis 做
  // 朝向 quaternion、不偏 local position），這樣 3D 與 2D 一致。
  // ≤12° 範圍內視覺差距 AABB 可吸收。
  return { cx, cy, cz, hx, hy, hz };
}

/**
 * Mortise 在母件 local 座標下的 AABB。
 *
 * Mortise.origin 慣例（從 lib/templates/* 散落用法歸納）：
 *   - X / Z：part-local 從 center 量（範圍 [-l/2, +l/2]，原點為 part 中心）。
 *     對於 ±1 sign-flag 形式（如 leg 內側 z = ±1），表示「靠該面的內側」，
 *     渲染上 clamp 到 ±lz/2 - depth/2 把 mortise 推回到內部。
 *   - Y：part-local 從底量（範圍 [0, +ly]，原點為 part 底）。
 *
 * Mortise depth 軸推測：origin 哪個軸最靠近 part 表面，就視為 depth 軸。
 *   - Y 面：min(|y|, |y - ly|) 最小
 *   - X 面：min(|x - lx/2|, |x + lx/2|) 最小
 *   - Z 面：min(|z - lz/2|, |z + lz/2|) 最小
 *
 * 限制：對非軸對齊 mortise（例如圓腳上的 mortise）無法處理，等 Phase 4+。
 */
/**
 * Runtime spec validation：警告 mortise.origin 用了「post-rotation」慣例
 * （origin.y > ly 或 < -1）這是常見坑。dev mode console.warn，prod 不喊。
 */
function warnInvalidMortiseSpec(partId: string, m: Part["mortises"][number], lx: number, ly: number, lz: number): void {
  if (typeof window === "undefined" && process.env.NODE_ENV === "production") return;
  const issues: string[] = [];
  if (m.origin.y < -1 || m.origin.y > ly + 1) {
    issues.push(`origin.y=${m.origin.y} 超出 part.thickness 範圍 [0, ${ly}]—可能誤把「post-rotation 高度」放在 mesh local Y 軸（應放 origin.x）`);
  }
  if (m.origin.x < -lx / 2 - 1 || m.origin.x > lx / 2 + 1) {
    issues.push(`origin.x=${m.origin.x} 超出 part.length 範圍 [${-lx/2}, ${lx/2}]`);
  }
  if (m.origin.z < -lz / 2 - 1 || m.origin.z > lz / 2 + 1) {
    issues.push(`origin.z=${m.origin.z} 超出 part.width 範圍 [${-lz/2}, ${lz/2}]`);
  }
  if (issues.length > 0 && typeof console !== "undefined") {
    // eslint-disable-next-line no-console
    console.warn(`[mortise spec] ${partId}:`, issues.join("; "));
  }
}

export function mortiseLocalBox(part: Part, m: Part["mortises"][number]): LocalBox {
  const lx = part.visible.length;
  const ly = part.visible.thickness;
  const lz = part.visible.width;
  warnInvalidMortiseSpec(part.id, m, lx, ly, lz);
  // Y 是 from-bottom，shift 到 centered
  const oxC = m.origin.x;
  const oyC = m.origin.y - ly / 2;
  const ozC = m.origin.z;

  const yToFace = Math.min(Math.abs(m.origin.y), Math.abs(m.origin.y - ly));
  const xToFace = Math.min(Math.abs(m.origin.x - lx / 2), Math.abs(m.origin.x + lx / 2));
  const zToFace = Math.min(Math.abs(m.origin.z - lz / 2), Math.abs(m.origin.z + lz / 2));

  // 通孔（through）depth = 母件厚（沿 depth 軸的全長）
  // 深度軸 = 最靠近表面的軸
  //
  // Bug 修：origin.y=0 是 from-bottom 慣例的「便利預設值」，不該被當作真的
  // Y face 入榫。當 origin.y 在 canonical 值（0 或 ly）+ X 或 Z 軸有 origin
  // **嚴格更靠近** face（< yToFace）時，優先選 X/Z 為真正 entry axis—template
  // 真正想表達的入榫方向。例：頂板側板榫眼 origin=(±halfL-9, 0, 0)，xToFace=9
  // 比 yToFace=0 不更靠近，仍維持 depthAxis="y"（這類 case 已改 template 不
  // 依賴 placeholder）。
  //
  // 2026-05-21 修：原條件 `xToFace < ly/2 || zToFace < ly/2` 會在 part 很薄
  // （例 topRailThickness=22, ly=topRailHeight=50, zToFace=11 < 25）時誤判，
  // 把 slat→topRail 底面入榫的 mortise 改判成 Z 軸入榫 → CSG 切錯面、tenon
  // mesh 找不到母件 → 紅榫頭凸出頂橫木頂面。改用「嚴格小於 yToFace」確保
  // 真實底/頂面入榫（yToFace=0）永遠保留 Y。
  const yIsCanonical = m.origin.y === 0 || m.origin.y === ly;
  let depthAxis: "x" | "y" | "z";
  // cosmetic+through+rotX：外撇牆手把孔軸固定沿 part-local Y（牆厚方向）。
  // 不能讓 mortiseLocalBox 的 yToFace/xToFace/zToFace 比較邏輯把 depthAxis
  // 切到 "z"——origin.y 隨外撇 θ 增大會超過 zToFace（θ ~18°），結果 mortise
  // box 方向反轉、marker 跑到天上。
  if (m.cosmetic && m.through && m.rotX !== undefined && m.rotX !== 0) {
    depthAxis = "y";
  } else if (yIsCanonical && (xToFace < yToFace || zToFace < yToFace)) {
    depthAxis = xToFace <= zToFace ? "x" : "z";
  } else if (yToFace <= xToFace && yToFace <= zToFace) depthAxis = "y";
  else if (xToFace <= zToFace) depthAxis = "x";
  else depthAxis = "z";

  const D = m.depth;
  const Lm = m.length;
  const Wm = m.width;

  // Auto-fit Lm/Wm 到較合適的兩個垂直軸：
  // 若 Lm 大於可分配軸的 part 範圍而 Wm 不會，自動 swap，避免 CSG 切超過 part
  // 邊界（造成 through-hole 而非 blind pocket）。Audit 慣例：
  // mortise.length=tongue.width(較長)、mortise.width=tongue.thickness(較短)
  // Smart Lm/Wm 軸別分配：把較長的維度 (max) 放在「origin 較居中、空間較大」
  // 的軸，較短的維度 (min) 放在「origin 靠邊、空間較窄」的軸。確保 CSG slot
  // 完整在 part 內又能對應 tongue 真實方向。
  const longDim = Math.max(Lm, Wm);
  const shortDim = Math.min(Lm, Wm);

  // mortise CSG cut 用全尺寸（不 shrink），讓 tenon mesh 0.5mm 縮量直接貼進 cut
  // 內側，留 0.5mm clearance 避免 z-fighting。之前 mortise -1mm + tenon -0.5mm
  // 不一致 → tenon 反而比 cut 大 0.5mm，從洞四周溢紅點。
  const PERP_SHRINK = 0;
  if (depthAxis === "y") {
    const enterTop = m.origin.y > ly / 2;
    // cosmetic through mortise（如外撇托盤手把孔）：part 幾何在 part-local Y
    // 偏離 AABB 中心（牆傾斜後實際 Y 位置不在 0），不能 override 為 cy=0、
    // 要用 origin.y 給的中心。一般通榫維持 cy=0（標準對稱通孔）。
    const cyL = m.cosmetic && m.through
      ? oyC
      : (m.through ? 0 : (enterTop ? +ly / 2 - D / 2 : -ly / 2 + D / 2));
    const xFace = Math.min(Math.abs(oxC - lx / 2), Math.abs(oxC + lx / 2));
    const zFace = Math.min(Math.abs(ozC - lz / 2), Math.abs(ozC + lz / 2));
    const longOnZ = zFace > xFace;
    const useX = Math.max(0.1, (longOnZ ? shortDim : longDim) - PERP_SHRINK * 2);
    const useZ = Math.max(0.1, (longOnZ ? longDim : shortDim) - PERP_SHRINK * 2);
    const cxClipped = Math.max(-lx / 2 + useX / 2, Math.min(lx / 2 - useX / 2, oxC));
    const czClipped = Math.max(-lz / 2 + useZ / 2, Math.min(lz / 2 - useZ / 2, ozC));
    return { cx: cxClipped, cy: cyL, cz: czClipped, hx: useX / 2, hy: D / 2, hz: useZ / 2, rotX: m.rotX, rotY: m.rotY };
  } else if (depthAxis === "x") {
    const enterRight = m.origin.x >= 0;
    const cxL = enterRight ? +lx / 2 - D / 2 : -lx / 2 + D / 2;
    const yFace = Math.min(Math.abs(oyC - ly / 2), Math.abs(oyC + ly / 2));
    const zFace = Math.min(Math.abs(ozC - lz / 2), Math.abs(ozC + lz / 2));
    const longOnZ = zFace > yFace;
    const useY = Math.max(0.1, (longOnZ ? shortDim : longDim) - PERP_SHRINK * 2);
    const useZ = Math.max(0.1, (longOnZ ? longDim : shortDim) - PERP_SHRINK * 2);
    const cyClipped = Math.max(-ly / 2 + useY / 2, Math.min(ly / 2 - useY / 2, oyC));
    const czClipped = Math.max(-lz / 2 + useZ / 2, Math.min(lz / 2 - useZ / 2, ozC));
    return { cx: cxL, cy: cyClipped, cz: czClipped, hx: D / 2, hy: useY / 2, hz: useZ / 2, rotX: m.rotX };
  } else {
    // depthAxis = z：垂直腳上的橫向 mortise（apron / stretcher 進入 leg），
    // 或門橫檔內側面的鑲板槽（length 沿 rail 長度 = X 軸）。
    // 比照 x/y 分支做 auto-fit：把 longDim 放在較居中的軸，shortDim 放在靠邊的軸，
    // 並 clip 中心到 part 範圍內，避免 CSG 切穿 part 厚度。
    const enterFront = m.origin.z >= 0;
    const czL = enterFront ? +lz / 2 - D / 2 : -lz / 2 + D / 2;
    const xFace = Math.min(Math.abs(oxC - lx / 2), Math.abs(oxC + lx / 2));
    const yFace = Math.min(Math.abs(oyC - ly / 2), Math.abs(oyC + ly / 2));
    const longOnX = xFace > yFace;
    const useX = Math.max(0.1, (longOnX ? longDim : shortDim) - PERP_SHRINK * 2);
    const useY = Math.max(0.1, (longOnX ? shortDim : longDim) - PERP_SHRINK * 2);
    const cxClipped = Math.max(-lx / 2 + useX / 2, Math.min(lx / 2 - useX / 2, oxC));
    const cyClipped = Math.max(-ly / 2 + useY / 2, Math.min(ly / 2 - useY / 2, oyC));
    return { cx: cxClipped, cy: cyClipped, cz: czL, hx: useX / 2, hy: useY / 2, hz: D / 2, rotZ: m.rotZ };
  }
}

/**
 * 仰視 BOTTOM view：把 design 沿 XZ 平面（Y=0）鏡像，內部當作 top view 渲染。
 *
 * 鏡像 = 每個 part 的 origin.y 反號 + 繞 part-local X 軸再轉 180°。後者讓 part
 * 局部「底面」（local +Y）轉到世界 -Y 方向，等同從下方看的視角。
 *
 * ⚠️ tenon 的中心偏移（offsetWidth / offsetThickness）不會「自動」被 rotation
 * 翻對：tenonLocalBox 把 offset 套進 part-local 的 cx/cy/cz，而繞 local X 轉
 * 180° 只翻 cy/cz、不翻 cx。所以 offset 落在被翻軸（cy/cz）時要手動反號補正，
 * 否則牙板「上半榫/下半榫」在仰視(BOTTOM)/零件圖正視會上下顛倒
 * （user 2026-06-01 回報：3D 前後牙條榫在下、零件圖卻畫在上）。
 * 按 position 分軸（對齊 tenonLocalBox §A10）：
 *   - start/end ：offsetWidth→cz、offsetThickness→cy，兩者都被翻 → 都反號
 *   - top/bottom：offsetWidth→cx（不翻）、offsetThickness→cz（翻）→ 只反 offsetThickness
 *   - left/right：offsetWidth→cy（翻）、offsetThickness→cx（不翻）→ 只反 offsetWidth
 * leg 頂榫(top, offsetWidth→cx)實測不受影響，驗證見 commit 訊息。
 *
 * 此處不動 part.shape 的 Y 不對稱參數（如 tapered.bottomScale）；
 * π rotation 已把 local +Y 轉到世界 -Y，幾何 silhouette 會自然從反面看。
 */
export function mirrorYPart(p: import("@/lib/types").Part): import("@/lib/types").Part {
  const flipTenonOffset = (
    t: import("@/lib/types").Tenon,
  ): import("@/lib/types").Tenon => {
    const flipW =
      t.position === "start" ||
      t.position === "end" ||
      t.position === "left" ||
      t.position === "right";
    const flipT =
      t.position === "start" ||
      t.position === "end" ||
      t.position === "top" ||
      t.position === "bottom";
    const next = { ...t };
    if (flipW && t.offsetWidth != null) next.offsetWidth = -t.offsetWidth;
    if (flipT && t.offsetThickness != null)
      next.offsetThickness = -t.offsetThickness;
    return next;
  };
  return {
    ...p,
    origin: { x: p.origin.x, y: -p.origin.y, z: p.origin.z },
    rotation: {
      x: (p.rotation?.x ?? 0) + Math.PI,
      y: p.rotation?.y ?? 0,
      z: p.rotation?.z ?? 0,
    },
    tenons: p.tenons?.map(flipTenonOffset) ?? p.tenons,
  };
}
function mirrorYDesign(d: import("@/lib/types").FurnitureDesign): import("@/lib/types").FurnitureDesign {
  return {
    ...d,
    parts: d.parts.map(mirrorYPart),
  };
}

/** Single orthographic view with engineering-drawing frame and dim lines */
function OrthoViewImpl({
  design: rawDesign,
  view: rawView,
  title,
  titleEn,
  className,
  joineryMode = false,
  isolatePartId,
  showDimensions = true,
  overlayContent,
  noTitleInSvg = false,
  paperMode,
  paperScale,
  paperBroken,
  paperTitleBlock,
  paperViewport,
  paperFrame = true,
  embedded = false,
  locale = "zh-TW",
  unit,
}: ViewProps & {
  view: OrthoViewKind;
  title: string;
  titleEn: string;
  /** 覆蓋 SVG 預設 className（預設 "bg-white w-full h-auto max-h-[70vh]"） */
  className?: string;
  /** 榫接模式：在三視圖上加畫公榫凸出（實線）+ 母榫（虛線）+ 肩寬虛線 */
  joineryMode?: boolean;
  /** 零件圖：只渲染這個 part.id、把它 recenter 到原點。預設 undefined = 渲染整套。 */
  isolatePartId?: string;
  /** 是否顯示尺寸標註層（dim lines / scale bar / 方位標記）。預設 true。
   *  PartDrawing 會傳 false 然後自己畫零件層級的標註。*/
  showDimensions?: boolean;
  /** 零件圖 overlay slot：給定 viewBox 上下文，回 SVG 元素疊在最上層。
   *  例如 T1 全長尺寸/T2 榫卯虛框/木紋箭頭等。*/
  overlayContent?: (ctx: OrthoViewBoxCtx) => React.ReactNode;
  /**
   * 不在 SVG 內畫 title bar（外框 + 標題列底線 + title/titleEn text）。
   * 預設 false（保留既有行為）。PartDrawing zoom 模式設 true、自己用 HTML
   * 在 SVG 外畫標題，避免 transform: scale(zoom) 把 SVG 內的標題字也一起放大。
   */
  noTitleInSvg?: boolean;
  /**
   * 零件圖正規製圖紙張模式（Step 1）。設為 "a4-landscape" 時：
   *   - viewBox 固定 0 0 297 210（A4 横式 mm）
   *   - silhouette + overlay 套 <g transform="translate(cx, cy) scale(1/scale)">
   *   - paperScale denominator 由 caller（PartDrawing）算好傳進
   * 預設 undefined → 走既有 isolatePartId 動態 padding 邏輯。
   */
  paperMode?: "a4-landscape";
  /** paperMode 對應的 CNS 比例分母（pickScaleForPaper 結果）。 */
  paperScale?: number;
  /** paperMode + needBrokenView 時，broken view 切割參數（傳 null 不切）。 */
  paperBroken?: import("@/lib/render/part-drawing/broken-view").BrokenViewSpec | null;
  /** paperMode title block 欄位（件號/材料/數量/尺寸）。 */
  paperTitleBlock?: {
    partNo: string;
    count: number;
    materialLabel: string;
    dimsLabel: string; // e.g. "35×35×425"
  };
  /** paperMode 自訂 viewport 中心（A4 mm 座標）。
   *  L 型佈局時 PaperSheet wrapper 用這個把 3 個 view 放到不同位置。
   *  傳 undefined → 預設置中於 drawing area 中央。 */
  paperViewport?: { x: number; y: number; w: number; h: number };
  /** 是否渲染 A4 紙面 chrome（外框/標題列/標題欄/比例尺/投影符號）。
   *  L 型 PaperSheet 已自繪 chrome,3 個內嵌 view 該設 false。預設 true。 */
  paperFrame?: boolean;
  /** 是否回 <g> 而非 <svg>，給 PaperSheet 多 view 共用同一 outer SVG。 */
  embedded?: boolean;
  /** 'zh-TW'（預設）或 'en'。影響 SVG 內 dim label 文字（寬/深/高/內/外伸…）。 */
  locale?: string;
  /** 'mm' | 'inch'，控制長度數值格式。未傳時依 locale 推（en→inch、其他→mm），
   *  讓使用者透過 UnitToggle 可以在中文站切英寸 / 英文站切 mm 不被綁死。 */
  unit?: "mm" | "inch";
}) {
  const isEn = locale === "en";
  const effectiveUnit: "mm" | "inch" = unit ?? (isEn ? "inch" : "mm");
  const useInch = effectiveUnit === "inch";
  // useInch 時長度標籤從「123 mm」改成「4-13/16"」(1/16" 精度).
  // mm 端保留 Math.round 整數呈現 — 桌長 800.4mm 標 800mm，師傅看到不會多想。
  const dimMm = (mm: number): string =>
    useInch ? formatInchFraction(mm) : `${Math.round(mm)} mm`;
  // 小數一位版：梯形橫撐上/下邊長度要跟零件圖(round1)同精度,整數會跟
  // 零件圖的 285.2 對不上(user 2026-06-01)。inch 模式沿用分數。
  const dimMm1 = (mm: number): string =>
    useInch ? formatInchFraction(mm) : `${(Math.round(mm * 10) / 10).toFixed(1)} mm`;
  // 仰視 BOTTOM = top view 看「Y 軸鏡像」後的 design。
  // 內部所有 view ===、投影、visibility 邏輯都用 top 跑，使用者標題顯示「仰視」。
  const isBottomView = rawView === "bottom";
  const view: OrthoViewKind = isBottomView ? "top" : rawView;
  const design = isBottomView ? mirrorYDesign(rawDesign) : rawDesign;
  // 零件圖模式：只留指定 part、把 origin 拉到 (0,0,0)。
  // 預設 isolatePartId === undefined → renderDesign === design，行為與既有完全一致。
  const renderDesign = isolatePartId
    ? (() => {
        const isolated = design.parts
          .filter((p) => p.id === isolatePartId)
          .map((p) => {
            // splayed-tapered / splayed-round-tapered → 清零 dx/dz 保留 kind,
            // 讓 top view 雙 rect 渲染呈現 taper 收縮。
            // 純 splayed → 保留 dx/dz，渲染原本平行四邊形（斜邊），rotation 會把
            // 整個 part 轉成橫躺，所以平行四邊形也跟著轉橫，端面斜切自然朝橫向。
            let nextShape = p.shape;
            if (p.shape?.kind === "splayed-tapered") {
              nextShape = { ...p.shape, dxMm: 0, dzMm: 0 };
            } else if (p.shape?.kind === "splayed-round-tapered") {
              nextShape = { ...p.shape, dxMm: 0, dzMm: 0 };
            }

            // 橫向正規製圖：偵測 part 三軸最大者，加 rotation 讓長軸轉到水平
            //   local X = visible.length,  local Y = visible.thickness,  local Z = visible.width
            //   想要 longest 軸落在 world X（front view r.w 方向 = 水平）
            //     length 最長 → 不旋轉
            //     thickness 最長 → rotation.z = -π/2 把 local Y 轉到 world X
            //     width 最長 → rotation.y = -π/2 把 local Z 轉到 world X
            const L = p.visible.length;
            const T = p.visible.thickness;
            const W = p.visible.width;
            let rotation = { x: 0, y: 0, z: 0 };
            if (T > L && T >= W) {
              rotation = { x: 0, y: 0, z: -Math.PI / 2 };
            } else if (W > L && W > T) {
              rotation = { x: 0, y: -Math.PI / 2, z: 0 };
            }

            return {
              ...p,
              origin: { x: 0, y: 0, z: 0 },
              rotation,
              shape: nextShape,
            };
          });
        if (!isolated.length) return design;
        const p = isolated[0];
        // 同步更新 overall——用 worldExtents 算旋轉後的 bbox,讓圖紙框跟著 part
        // 旋轉變橫向（rotation.z=-π/2 把 thickness 轉到水平 → overall.length
        // = worldExtents.xExt = 原 thickness）。
        // 若直接用 p.visible.thickness 當高度,框會維持 portrait、橫躺的 part 會
        // 突出框外。
        const we = worldExtents(p);
        return {
          ...design,
          parts: isolated,
          overall: {
            length: we.xExt,
            width: we.zExt,
            thickness: we.yExt,
          },
        };
      })()
    : design;
  const { overall } = renderDesign;
  const w = view === "side" ? overall.width : overall.length;
  const h = view === "top" ? overall.width : overall.thickness;

  // 正/側視圖共用同一 viewBox 寬（取 max(length, width)），讓兩張圖
  // 同 mm 對到同 px。否則側視圖在同樣容器寬下會被放大、120mm 高看起來
  // 比正視圖大一截。Top 視圖維持自己 vbW。
  const vbContentW =
    view === "front" || view === "side"
      ? Math.max(overall.length, overall.width)
      : w;
  // noTitleInSvg=true 時不保留 SVG 內 title bar 空間（PartDrawing zoom 模式
  // 會在 SVG 外另畫 HTML 標題、避免 transform:scale 把標題字一起放大）
  const reservedTitleH = noTitleInSvg ? 0 : TITLE_BAR_H;
  // 零件圖（isolatePartId）：固定 PADDING=220 對「整套家具」是必要（容納
  // 整片 dim chain + 工序文字 + zone 鏈），但對單一零件來說太誇張——一支
  // 35×425mm 的腳套 220mm padding 後 viewBox 寬 475mm，腳只佔 7% 寬，
  // 視覺上整片白邊配右下角小小的剪影（Inspector A 多家具回報）。
  // 改用「跟 part 較大邊成比例 + T1 dim line 預留」的動態 padding：
  //   - T1Dimensions 需 HORIZ_OFFSET 18-30 + VERT_OFFSET 50 + 文字寬約 30
  //   - 取 max(64, 0.15 × part 較大邊)，上限 PADDING（220）保底
  // 對 35mm 腳：max(64, 5.25) = 64mm 兩側、viewBox 寬 163mm、腳佔 21% 寬（OK）
  // 對 1000mm 圓桌面：max(64, 150) = 150mm、viewBox 寬 1300mm、桌面佔 77%（OK）
  // 頂端榫頭凸出量 — front/side view 看到「top tenon」沿 +Y 凸；top view 看到
  // length/width 端面 tenon 沿 ±X/±Z 凸。padding 不夠的話 T1 dim chain（含榫
  // 標籤）+ title bar 會撞在一起。
  // front/side view：top tenon 朝畫面上方凸出，dim chain 會被推到 part top
  // 之上 (tenon.length + HORIZ_OFFSET + label) 處。top view 不算這條，因為
  // top view 看 L×W 平面，tenon 凸出方向是 ±X / ±Z（水平），不影響上邊距。
  const maxTenonProtrusion = isolatePartId && renderDesign.parts[0] && view !== "top"
    ? Math.max(
        0,
        ...renderDesign.parts[0].tenons
          .filter((t) => t.position === "top")
          .map((t) => t.length),
      )
    : 0;
  // T1 dim chain 上推：HORIZ_OFFSET(30) + GROSS_GAP(14) + text height(12) + 上箭頭
  // facing mark(16) + safety(8) = 80。少於這個會跟 title bar 卡同一線。
  const tenonTopBuffer = maxTenonProtrusion > 0 ? maxTenonProtrusion + 80 : 0;
  const isolatePadding = isolatePartId
    ? Math.min(
        PADDING,
        Math.max(64, 0.15 * Math.max(overall.length, overall.width, overall.thickness), tenonTopBuffer),
      )
    : PADDING;
  const isolateDimOffset = isolatePartId
    ? Math.max(36, isolatePadding * 0.4)
    : DIM_OFFSET;
  const vbW = vbContentW + isolatePadding * 2;
  const vbH = h + isolatePadding * 2 + isolateDimOffset + reservedTitleH;
  const vbX = -isolatePadding - vbContentW / 2;
  // Top view parts project around y=0 (origin.z - zExt/2 ranges roughly -h/2..h/2);
  // front/side views use natural flipY so parts span y=-h..0.
  const drawAreaTop = view === "top" ? -h / 2 : -h;
  const vbY = drawAreaTop - isolatePadding - reservedTitleH;

  // Frame: enclose drawing + title bar + dim area
  const frameX = vbX + 8;
  const frameY = vbY + 8;
  const frameW = vbW - 16;
  const frameH = vbH - 16;

  // Build overlay ctx only when consumer asks — avoid projector overhead otherwise.
  // 零件圖模式（isolatePartId 設）下，renderDesign.parts[0] 就是 recentered 的 part，
  // 它的 makeProjector 直接吃 part-local mm 回到 SVG 座標。
  // 整套模式下沒有單一 part，給 no-op projector 讓 caller 可選擇不依賴此欄位。
  const overlayCtx: OrthoViewBoxCtx | null = overlayContent
    ? {
        vbX,
        vbY,
        vbW,
        vbH,
        // 注意：silhouette 渲染時用 -p.y 翻 Y（svg-views 內部慣例）。
        // overlay (T1/T2/dim line) 為了跟 silhouette 對齊、也需要負 Y。
        // 這裡的 partLocalToSvg wrap projector、output y 已翻好不用 caller 再處理。
        partLocalToSvg:
          isolatePartId && renderDesign.parts.length > 0
            ? (() => {
                const proj = makeProjector(renderDesign.parts[0], view);
                return (x: number, y: number, z: number) => {
                  const p = proj(x, y, z);
                  return { x: p.x, y: -p.y };
                };
              })()
            : (_x: number, _y: number, _z: number) => ({ x: 0, y: 0 }),
      }
    : null;

  // ─── Paper mode (Step 1)：A4 横式紙面 ─────────────────────────────────
  // viewBox 固定 0 0 297 210，把既有 inner content（part-local mm）用
  // <g transform="translate(...) scale(1/n)"> 映射到紙面主繪圖區中央。
  // partLocalToSvg 仍輸出原 mm（不變語意），overlay 跟 silhouette 同 group。
  const isPaper = paperMode === "a4-landscape";
  const paperScaleN = isPaper ? Math.max(1, paperScale ?? 1) : 1;
  const outerViewBox = isPaper
    ? `0 0 297 210`
    : `${vbX} ${vbY} ${vbW} ${vbH}`;
  // 把原 inner viewBox 中心 (innerCx, innerCy) 映射到紙面 viewport 中心
  // (paperCx, paperCy)：translate 量 = paperC - innerC/n
  // paperViewport 設定時用該 region 中心,否則用 drawing area 中央
  const innerCx = vbX + vbW / 2;
  const innerCy = vbY + vbH / 2;
  const paperCx = paperViewport
    ? paperViewport.x + paperViewport.w / 2
    : (10 + 287) / 2; // 148.5
  const paperCy = paperViewport
    ? paperViewport.y + paperViewport.h / 2
    : (24 + 180) / 2; // 102
  const paperTx = paperCx - innerCx / paperScaleN;
  const paperTy = paperCy - innerCy / paperScaleN;
  const paperGroupTransform = isPaper
    ? `translate(${paperTx} ${paperTy}) scale(${1 / paperScaleN})`
    : undefined;

  const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) =>
    embedded ? (
      <g>{children}</g>
    ) : (
      <svg
        viewBox={outerViewBox}
        preserveAspectRatio="xMidYMid meet"
        className={className ?? "bg-white w-full h-auto max-h-[70vh]"}
      >
        {children}
      </svg>
    );

  return (
    <Wrapper>
      <defs>
        <marker
          id={`arr-${view}`}
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="8"
          markerHeight="8"
          orient="auto-start-reverse"
        >
          {/* CNS 3-3 規定箭頭夾角 20°：半角 10° → 半寬 = 10·tan(10°) ≈ 1.76 */}
          <path d="M 0 3.24 L 10 5 L 0 6.76 z" fill="#111" />
        </marker>
        {/* splayed 俯視中間分割：左半詳細 / 右半簡化 用的 clipPath */}
        <clipPath id={`leftHalf-${view}`}>
          <rect x={vbX} y={vbY} width={-vbX} height={vbH} />
        </clipPath>
      </defs>

      {/* Paper mode（Step 1）：A4 紙面外框 + title bar + title block，
          放在 scaled group **外**，這樣文字/框線不受 1/n 縮放影響。
          paperFrame=false（L 型 PaperSheet wrap 已自繪 chrome 時）跳過。 */}
      {isPaper && paperFrame && (
        <g fontFamily="sans-serif">
          {/* A4 紙面外框 */}
          <rect
            x={0.5}
            y={0.5}
            width={296}
            height={209}
            fill="none"
            stroke="#222"
            strokeWidth={0.5}
          />
          {/* Title bar 區（y 8~20） */}
          <line
            x1={10}
            x2={287}
            y1={20}
            y2={20}
            stroke="#222"
            strokeWidth={0.4}
          />
          <text
            x={12}
            y={16.5}
            fontSize={5}
            fontWeight={700}
            fill="#111"
          >
            {title}
            <tspan dx={3} fontSize={3.5} fontWeight={400} fill="#666">
              {titleEn}
            </tspan>
          </text>
          <text
            x={285}
            y={16.5}
            fontSize={4}
            fill="#444"
            textAnchor="end"
          >
            比例 1:{paperScaleN}
          </text>
          {/* Drawing area inner border (淺色輔助) */}
          <rect
            x={10}
            y={24}
            width={277}
            height={156}
            fill="none"
            stroke="#ddd"
            strokeWidth={0.2}
            strokeDasharray="1 1"
          />

          {/* 比例尺條 — 實體 50mm 真實長度，按比例縮畫
              印 1:1 時影印縮放仍能對照真實尺寸 */}
          {(() => {
            const realMm = 50;
            const barMm = realMm / paperScaleN; // 紙上 mm
            if (barMm < 4 || barMm > 60) return null;
            const barX = 200;
            const barY = 178;
            return (
              <g fontFamily="sans-serif">
                {/* 主刻度線 5 分 */}
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <line
                    key={i}
                    x1={barX + (barMm * i) / 5}
                    x2={barX + (barMm * i) / 5}
                    y1={barY - (i % 5 === 0 ? 2 : 1)}
                    y2={barY}
                    stroke="#222"
                    strokeWidth={0.3}
                  />
                ))}
                {/* 主橫條 */}
                <line
                  x1={barX}
                  x2={barX + barMm}
                  y1={barY}
                  y2={barY}
                  stroke="#222"
                  strokeWidth={0.4}
                />
                <text x={barX} y={barY + 4} fontSize={2.8} fill="#444">
                  0
                </text>
                <text
                  x={barX + barMm}
                  y={barY + 4}
                  fontSize={2.8}
                  fill="#444"
                  textAnchor="end"
                >
                  {useInch ? formatInchFraction(realMm) : `${realMm}mm`}
                </text>
              </g>
            );
          })()}

          {/* 第三角法投影符號（CNS / JIS / ASME 慣例）
              兩塊：左 = 圓+同心小圓（從圓錐大端看）、右 = 梯形（側面看）
              木工不一定需要，但符合製圖規範，學員教學/正式圖紙都該有 */}
          {(() => {
            const sx = 168;
            const sy = 184;
            const w = 6;
            return (
              <g fontFamily="sans-serif">
                {/* 左方塊：兩個同心圓 */}
                <circle
                  cx={sx + w / 2}
                  cy={sy + 6}
                  r={2.5}
                  fill="none"
                  stroke="#333"
                  strokeWidth={0.3}
                />
                <circle
                  cx={sx + w / 2}
                  cy={sy + 6}
                  r={1.2}
                  fill="none"
                  stroke="#333"
                  strokeWidth={0.3}
                />
                {/* 右方塊：梯形 */}
                <path
                  d={`M ${sx + w + 1} ${sy + 8.5}
                      L ${sx + w + 1} ${sy + 3.5}
                      L ${sx + w + 6} ${sy + 4.5}
                      L ${sx + w + 6} ${sy + 7.5} Z`}
                  fill="none"
                  stroke="#333"
                  strokeWidth={0.3}
                />
                <text x={sx} y={sy + 2.5} fontSize={2.4} fill="#666">
                  第三角法
                </text>
              </g>
            );
          })()}
          {/* Title block 區（y 182~202）— CNS 六大必備欄位
              寬 277mm 分 6 等：每格 ~46mm（件號/件名/材料/數量/比例/尺寸）*/}
          <line
            x1={10}
            x2={287}
            y1={182}
            y2={182}
            stroke="#222"
            strokeWidth={0.5}
          />
          <rect
            x={10}
            y={182}
            width={277}
            height={20}
            fill="none"
            stroke="#222"
            strokeWidth={0.4}
          />
          {/* 6 個欄位垂直分割線 */}
          {[1, 2, 3, 4, 5].map((i) => (
            <line
              key={i}
              x1={10 + (277 / 6) * i}
              x2={10 + (277 / 6) * i}
              y1={182}
              y2={202}
              stroke="#222"
              strokeWidth={0.3}
            />
          ))}
          {/* 欄位標籤 + 值 */}
          {(() => {
            const colW = 277 / 6;
            // Title-block field labels — chosen short so they fit a 277/6 mm column.
            // We pick EN labels when the OrthoView title starts with an ASCII letter
            // (which only happens when ThreeViewLayout passed an EN title), otherwise zh.
            const enTitleBlock = /^[A-Z]/.test(title);
            const cols: Array<{ label: string; value: string }> = enTitleBlock
              ? [
                  { label: "Part #", value: paperTitleBlock?.partNo ?? "—" },
                  { label: "Name", value: title },
                  { label: "Material", value: paperTitleBlock?.materialLabel ?? "—" },
                  { label: "Qty", value: `×${paperTitleBlock?.count ?? 1}` },
                  { label: "Scale", value: `1:${paperScaleN}` },
                  { label: useInch ? "Size in" : "Size mm", value: paperTitleBlock?.dimsLabel ?? "—" },
                ]
              : [
                  { label: "件號", value: paperTitleBlock?.partNo ?? "—" },
                  { label: "件名", value: title },
                  { label: "材料", value: paperTitleBlock?.materialLabel ?? "—" },
                  { label: "數量", value: `×${paperTitleBlock?.count ?? 1}` },
                  { label: "比例", value: `1:${paperScaleN}` },
                  { label: useInch ? "尺寸 in" : "尺寸 mm", value: paperTitleBlock?.dimsLabel ?? "—" },
                ];
            return cols.map((c, i) => {
              const cx = 10 + colW * i + colW / 2;
              return (
                <g key={i}>
                  <text
                    x={cx}
                    y={189}
                    fontSize={3}
                    fill="#666"
                    textAnchor="middle"
                  >
                    {c.label}
                  </text>
                  <text
                    x={cx}
                    y={198}
                    fontSize={4.5}
                    fontWeight={600}
                    fill="#111"
                    textAnchor="middle"
                  >
                    {c.value}
                  </text>
                </g>
              );
            });
          })()}
        </g>
      )}

      {/* 把 inner content 包進 scaled group（paperMode 才有 transform）；
          一般模式 transform=undefined → React 不會輸出 transform 屬性。 */}
      <g transform={paperGroupTransform}>

      {/* outer frame + title bar — 預設保留；noTitleInSvg=true（PartDrawing zoom 模式）
          時整組跳過，由 caller 用 HTML 在 SVG 外畫標題，避免 transform:scale
          連帶把這層 SVG 文字也一起放大。
          paperMode 時也跳過（紙面外框由上面 isPaper 區處理） */}
      {!noTitleInSvg && !isPaper && (
        <>
          <rect
            x={frameX}
            y={frameY}
            width={frameW}
            height={frameH}
            fill="none"
            stroke="#222"
            strokeWidth={1}
          />
          <g>
            <line
              x1={frameX}
              x2={frameX + frameW}
              y1={frameY + TITLE_BAR_H}
              y2={frameY + TITLE_BAR_H}
              stroke="#222"
              strokeWidth={0.6}
            />
            <text
              x={frameX + 10}
              y={frameY + TITLE_BAR_H - 10}
              fontSize={13}
              fontWeight="700"
              fill="#111"
              fontFamily="sans-serif"
            >
              {title}
              <tspan
                dx={8}
                fontSize={10}
                fontWeight="400"
                fill="#666"
              >
                {titleEn}
              </tspan>
            </text>
          </g>
        </>
      )}

      {/* center lines (dot-dash) */}
      <g stroke="#888" strokeWidth={0.5} strokeDasharray="8 2 2 2" opacity={0.7}>
        <line x1={0} x2={0} y1={drawAreaTop - 10} y2={drawAreaTop + h + 10} />
        <line
          x1={-w / 2 - 10}
          x2={w / 2 + 10}
          y1={drawAreaTop + h / 2}
          y2={drawAreaTop + h / 2}
        />
      </g>

      {/* parts — line-art style: visible solid, hidden dashed */}
      {(() => {
        const sortedParts = sortPartsByDepth(
          joineryMode
            ? renderDesign.parts.map((p) =>
                p.joineryView
                  ? {
                      ...p,
                      shape: p.joineryView.shape ?? p.shape,
                      visible: p.joineryView.visible ?? p.visible,
                      origin: p.joineryView.origin ?? p.origin,
                    }
                  : p,
              )
            : renderDesign.parts,
          view,
        );

        // 俯視 dot-cloud dedup（chinese-cabinet 等多層櫃體）：
        // 多個 hidden part 在俯視疊在同 X-Z bbox（divider/back-panel/抽屜內板/
        // 鉸鍊/把手），每件畫 4 條 dashed line → 100+ 條虛線重疊變 dot cloud。
        // 規則：part 完全被 *另一個更大的 hidden part* contain 就跳過 outline
        // 渲染。最外層 hidden 件（divider / drawer-front）保留；內層內裝（抽屜底/
        // 側板/把手）跳過。可見件不受影響。
        const skipOutlineInTopDotCloud = new Set<string>();
        if (view === "top" && !isolatePartId) {
          const hiddenParts: Array<{ id: string; r: { x: number; y: number; w: number; h: number } }> = [];
          for (const p of sortedParts) {
            const id = p.id;
            const dir = id.match(/-(front|back|left|right)$/)?.[1] ?? null;
            const isCornerPost = /^post-(front|back)-(left|right)$/.test(id);
            const isDoorMuntin = /-door-muntin-/.test(id);
            void dir;
            if (isCornerPost || isDoorMuntin) continue;
            // 用跟下游一樣的 hidden 判定（只 top view 的 isPartHidden 結果即可—isInteriorInTop 不存在）
            const isHidden = isPartHidden(p, renderDesign.parts, view);
            if (!isHidden) continue;
            hiddenParts.push({ id, r: projectPart(p, view) });
          }
          // 用 AABB containment：若 a 完全包住 b 就把 b skip
          const eps = 1;
          for (let i = 0; i < hiddenParts.length; i++) {
            const b = hiddenParts[i];
            for (let j = 0; j < hiddenParts.length; j++) {
              if (i === j) continue;
              const a = hiddenParts[j];
              // a 完全包 b 且不等於（避免相同 bbox 互殺）
              const sameSize =
                Math.abs(a.r.x - b.r.x) < eps &&
                Math.abs(a.r.y - b.r.y) < eps &&
                Math.abs(a.r.w - b.r.w) < eps &&
                Math.abs(a.r.h - b.r.h) < eps;
              if (sameSize) {
                // 重複 bbox 的兩件，只留 ID 字典序較小的（穩定）
                if (b.id > a.id) {
                  skipOutlineInTopDotCloud.add(b.id);
                  break;
                }
                continue;
              }
              const contains =
                a.r.x <= b.r.x + eps &&
                a.r.x + a.r.w >= b.r.x + b.r.w - eps &&
                a.r.y <= b.r.y + eps &&
                a.r.y + a.r.h >= b.r.y + b.r.h - eps;
              if (contains) {
                skipOutlineInTopDotCloud.add(b.id);
                break;
              }
            }
          }
        }

        return sortedParts.map((part) => {
        // 俯視 dot-cloud dedup：part 完全被更大 hidden part contain 就跳過
        if (skipOutlineInTopDotCloud.has(part.id)) return null;
        // Hidden line elimination 補強：isPartHidden 的 AABB containment 對某些
        // 情況失準（splayed 腳的 AABB 不含 shape 變形、apron tilt 邊界、跨件
        // 形變、apron-trapezoid scale）。用 ID 慣例直接標記內部結構件。
        //
        // ID 慣例：方位後綴 -front/-back/-left/-right 標示零件所在方向。
        //   front view（從 -Z 看 +Z）：left/right/back 的零件被前面/中間擋
        //   side view（從 +X 看 -X）：front/back 的零件被側面/中間擋
        //   top view 都看得到（俯視穿透）
        const id = part.id;
        const dir = id.match(/-(front|back|left|right)$/)?.[1] ?? null;
        const isAlwaysInterior =
          /^slat-/.test(id) ||
          id === "center-stretcher" ||
          id === "lazy-susan" ||
          id === "column" ||
          id === "pedestal-column" ||
          id === "under-shelf" ||
          id === "inner-tray" ||
          id === "floor-tray" ||
          id === "interior-led-strip" ||
          id === "hanging-rod" ||
          id === "hat-rail" ||
          id === "trestle-center-stretcher";
        const isBackOfChair =
          id === "back-rail" || id === "back-top-rail" ||
          id === "back-splat" || id === "back-curved-splat";
        const isBedEnd = id === "headboard" || id === "footboard";
        const isBedSideRail =
          id === "side-rail-left" || id === "side-rail-right";
        const isCabinetBack = id === "back-panel" || id === "back";
        // 角柱（中式櫃 4 立柱）：ID `post-{fb}-{lr}` 末段 `-left/-right` 會被
        // dir 邏輯誤判成 interior。立柱是櫃體外輪廓，不該被當內部結構藏掉。
        const isCornerPost = /^post-(front|back)-(left|right)$/.test(id);
        // 格扇門櫺條（凸貼門面浮雕）—— AABB 投影被門 part 完全 contain，
        // isPartHidden 會把它判 hidden。但櫺條凸貼在門前方 Z 較小（更靠
        // 觀察者），語意上是「正面浮雕」，必須當 visible 走實線。
        const isDoorMuntin = /-door-muntin-/.test(id);

        const isInteriorInFront =
          view === "front" && !isCornerPost && !isDoorMuntin &&
          (isAlwaysInterior ||
            isCabinetBack ||
            isBackOfChair ||
            isBedSideRail ||
            dir === "left" || dir === "right" || dir === "back");
        const isInteriorInSide =
          view === "side" && !isCornerPost && !isDoorMuntin &&
          (isAlwaysInterior ||
            isBedEnd ||
            id === "cornice-front" ||
            dir === "front" || dir === "back");
        // 立柱永遠 visible（櫃體外輪廓骨架），不走 isPartHidden 的 4 立柱互相
        // contains 判斷（每個立柱投影都被其他立柱包住，會全部誤判 hidden）。
        // 格扇門櫺條同理——凸貼浮雕不該被它附著的門 part contain 規則藏掉。
        // 零件圖模式（isolatePartId）：part 就是主角，不該套組裝視圖的
        // interior/hidden 啟發式（e.g. apron-front 側視被 dir="front" 判 hidden）。
        const hidden = isolatePartId
          ? false
          : (isInteriorInFront || isInteriorInSide || (!isCornerPost && !isDoorMuntin && isPartHidden(part, renderDesign.parts, view)));
        const stroke = hidden ? "#444" : "#000";
        // 立柱用粗線突顯（俯視圖立柱方塊容易被頂板/層板矩形蓋住）
        // 零件圖（isolatePartId）下 0.9 在 1x 螢幕 sub-pixel 灰，1.2 才穩
        const sw = hidden
          ? 0.7
          : isolatePartId
            ? 1.5
            : isCornerPost
              ? 1.4
              : 0.9;
        const dash = hidden ? "4 3" : undefined;
        // 玻璃片（visual === "glass"）特例：玻璃 5mm 比門框 22mm 薄，4 條 outline
        // 邊在 HLE 都會落在 frame 內判 hidden → 全部變灰虛線消失。改用工程圖
        // 慣例「淡色矩形外框 + 45° 對角細線雙條」表明這是透明玻璃片。
        if (part.visual === "glass") {
          const r = projectPart(part, view);
          // top view 看玻璃只看到 5mm 厚的細長條，視覺意義低 → 維持原 rendering
          // （讓 HLE 跑、灰虛線無妨）。只有 front/side 才畫 hatching。
          if (view === "front" || view === "side") {
            const x1 = r.x, x2 = r.x + r.w;
            const y1 = -(r.y + r.h), y2 = -r.y;
            return (
              <g key={part.id}>
                {/* 外框：淡灰實線 */}
                <rect x={x1} y={y1} width={r.w} height={r.h}
                  fill="none" stroke="#9ca3af" strokeWidth={0.7} />
                {/* 對角線 ×：左上 → 右下 + 右上 → 左下 */}
                <line x1={x1} y1={y1} x2={x2} y2={y2}
                  stroke="#9ca3af" strokeWidth={0.4} opacity={0.6} />
                <line x1={x2} y1={y1} x2={x1} y2={y2}
                  stroke="#9ca3af" strokeWidth={0.4} opacity={0.6} />
              </g>
            );
          }
        }
        // arch-bent + rotation.x（傾斜彎弧料，例如 Windsor bow）正視特例：
        // 前面 vs 背面在 Y 軸偏移 lz·sin(rake)/2，分開畫前面實線、背面 HLE 分段
        if (
          view === "front" &&
          part.shape?.kind === "arch-bent" &&
          Math.abs(part.rotation?.x ?? 0) > 0.01
        ) {
          const arch = part.shape;
          const rakeRad = part.rotation!.x;
          const cosRake = Math.cos(rakeRad);
          const sinRake = Math.sin(rakeRad);
          const lx = part.visible.length;
          const ly = part.visible.thickness;
          const lz = part.visible.width;
          const segments = arch.segments ?? 16;
          // worldExtents 對非 quarter rotation 取近似——這裡手動算正確 yExt
          const yExt = ly * Math.abs(cosRake) + lz * Math.abs(sinRake);
          const yOffset = part.origin.y + yExt / 2;
          // 建構單一面 (ez=-1 = front 面 / +1 = back 面) 在 front view 的 svg 多邊形
          // 沿 X 軸採樣 N 段，每段 archDz 影響 Z，再經 rake 旋轉吃進 Y → 弧形輪廓
          const buildFace = (ez: 1 | -1): Array<{ x: number; y: number }> => {
            const top: Array<{ x: number; y: number }> = []; // ey=+1 (top edge, smaller svg y)
            const bot: Array<{ x: number; y: number }> = []; // ey=-1 (bottom edge)
            for (let i = 0; i <= segments; i++) {
              const t = -1 + (2 * i) / segments;
              const xLocal = (lx * t) / 2;
              const archDz = arch.bendMm * Math.max(0, 1 - t * t);
              const zLocal = (ez * lz) / 2 + archDz;
              // Top edge
              const yTopLocal = +ly / 2;
              const yTopWorld = yTopLocal * cosRake - zLocal * sinRake;
              top.push({
                x: -(xLocal + part.origin.x),
                y: -(yTopWorld + yOffset),
              });
              // Bottom edge
              const yBotLocal = -ly / 2;
              const yBotWorld = yBotLocal * cosRake - zLocal * sinRake;
              bot.push({
                x: -(xLocal + part.origin.x),
                y: -(yBotWorld + yOffset),
              });
            }
            // CCW: top edge left-to-right + bottom edge right-to-left
            // svg y 較小 = 上方；top.y < bot.y。CCW（svg y-down）= 順時針 in math sense
            // 從 svg 角度走外圈：top-left → top-right → bot-right → bot-left
            return [...top, ...bot.reverse()];
          };
          const frontFace = buildFace(-1);
          const backFace = buildFace(+1);
          const fmt = (pts: Array<{ x: number; y: number }>) =>
            pts.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
          const isHiddenByFront = (x: number, y: number): boolean => {
            return pointInPolygon({ x, y }, frontFace);
          };
          const backLines: React.ReactNode[] = [];
          for (let i = 0; i < backFace.length; i++) {
            const a = backFace[i];
            const b = backFace[(i + 1) % backFace.length];
            const segs = classifyEdgeVisibility(a, b, isHiddenByFront);
            segs.forEach((seg, segIdx) => {
              backLines.push(
                <line
                  key={`${part.id}-back-${i}-${segIdx}`}
                  x1={Number(seg.a.x.toFixed(2))}
                  y1={Number(seg.a.y.toFixed(2))}
                  x2={Number(seg.b.x.toFixed(2))}
                  y2={Number(seg.b.y.toFixed(2))}
                  stroke={seg.hidden ? "#444" : "#111"}
                  strokeWidth={seg.hidden ? 0.7 : 0.9}
                  strokeDasharray={seg.hidden ? "4 3" : undefined}
                  fill="none"
                />,
              );
            });
          }
          return (
            <g key={part.id}>
              {backLines}
              <polygon
                points={fmt(frontFace)}
                fill="none"
                stroke={stroke}
                strokeWidth={sw}
              />
            </g>
          );
        }
        // arch-bent + rotation.x（傾斜彎弧料，例如 Windsor bow）俯視特例：
        // 頂面 vs 底面在 Z 軸偏移 ly·sin(rake)/2，分開畫頂面實線、底面虛線
        if (
          view === "top" &&
          part.shape?.kind === "arch-bent" &&
          Math.abs(part.rotation?.x ?? 0) > 0.01
        ) {
          const arch = part.shape;
          const rakeRad = part.rotation!.x;
          const cosRake = Math.cos(rakeRad);
          const sinRake = Math.sin(rakeRad);
          const lx = part.visible.length;
          const ly = part.visible.thickness;
          const lz = part.visible.width;
          const segments = arch.segments ?? 16;
          // 頂面 (ey=+1) 跟底面 (ey=-1) 各自的 outline (front 弧 + back 弧 + 兩端)
          const buildFaceOutline = (ey: 1 | -1): Array<{ x: number; y: number }> => {
            const front: Array<{ x: number; y: number }> = [];
            const back: Array<{ x: number; y: number }> = [];
            for (let i = 0; i <= segments; i++) {
              const t = -1 + (2 * i) / segments;
              const xLocal = (lx * t) / 2;
              const archDz = arch.bendMm * Math.max(0, 1 - t * t);
              const yLocal = (ey * ly) / 2;
              const zFrontLocal = -lz / 2 + archDz;
              const zBackLocal = +lz / 2 + archDz;
              // 旋轉 x:rakeRad 後 world Z = y·sin + z·cos
              const wzFront = yLocal * sinRake + zFrontLocal * cosRake + part.origin.z;
              const wzBack = yLocal * sinRake + zBackLocal * cosRake + part.origin.z;
              const wx = xLocal + part.origin.x;
              // top view 投影：vx = -wx, vy = wz；svg flip：svg y = -vy = -wz
              front.push({ x: -wx, y: -wzFront });
              back.push({ x: -wx, y: -wzBack });
            }
            return [...front, ...back.reverse()];
          };
          const topFace = buildFaceOutline(+1);
          const botFace = buildFaceOutline(-1);
          const fmt = (pts: Array<{ x: number; y: number }>) =>
            pts.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
          // 底面的每條邊：被頂面 polygon 蓋到的段虛線、沒蓋到的實線
          // 用 pointInPolygon 判斷頂面是否包含底面採樣點
          const isHiddenByTopFace = (x: number, y: number): boolean => {
            return pointInPolygon({ x, y }, topFace);
          };
          const botLines: React.ReactNode[] = [];
          for (let i = 0; i < botFace.length; i++) {
            const a = botFace[i];
            const b = botFace[(i + 1) % botFace.length];
            const segs = classifyEdgeVisibility(a, b, isHiddenByTopFace);
            segs.forEach((seg, segIdx) => {
              botLines.push(
                <line
                  key={`${part.id}-bot-${i}-${segIdx}`}
                  x1={Number(seg.a.x.toFixed(2))}
                  y1={Number(seg.a.y.toFixed(2))}
                  x2={Number(seg.b.x.toFixed(2))}
                  y2={Number(seg.b.y.toFixed(2))}
                  stroke={seg.hidden ? "#444" : "#111"}
                  strokeWidth={seg.hidden ? 0.7 : 0.9}
                  strokeDasharray={seg.hidden ? "4 3" : undefined}
                  fill="none"
                />,
              );
            });
          }
          return (
            <g key={part.id}>
              {botLines}
              <polygon
                points={fmt(topFace)}
                fill="none"
                stroke={stroke}
                strokeWidth={sw}
              />
            </g>
          );
        }
        // lathe-turned 前 / 側視畫花瓶階梯輪廓（segments 跟 PerspectiveView 那份同步）
        // LATHE_SEG 提升到 module top（export 給 part-drawing 列段別表共用）
        if (part.shape?.kind === "lathe-turned" && view !== "top") {
          const r = projectPart(part, view);
          const fullR = r.w / 2;
          const fullH = r.h;
          const cxSvg = r.x + r.w / 2;
          const topYsvg = -(r.y + r.h); // SVG Y 翻轉，top = world top 取反
          const right: Array<{ x: number; y: number }> = [];
          const left: Array<{ x: number; y: number }> = [];
          right.push({ x: cxSvg + fullR * LATHE_SEG[0][0], y: topYsvg });
          left.push({ x: cxSvg - fullR * LATHE_SEG[0][0], y: topYsvg });
          let ySvg = topYsvg;
          for (const [, botR, hFrac] of LATHE_SEG) {
            ySvg += fullH * hFrac;
            right.push({ x: cxSvg + fullR * botR, y: ySvg });
            left.push({ x: cxSvg - fullR * botR, y: ySvg });
          }
          const polyPts = [...right, ...left.reverse()];
          return (
            <polygon
              key={part.id}
              points={polyPts.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ")}
              fill="none"
              stroke={stroke}
              strokeWidth={sw}
            />
          );
        }
        // 圓料軸別感知（2026-05-21）：knob 把手 axis="z"（往前突出的橫圓柱），
        // 從正視才看得到端面圓；俯視看到的是側面 = 矩形。
        // legs / 圓盤腳 axis="y"（垂直圓柱），俯視才是圓。
        // axis="x"（極少見的橫向圓料）side view 才是圓。
        const roundAxis = part.shape?.kind === "round" ? (part.shape.axis ?? "y") : "y";
        const roundCircleView: "front" | "side" | "top" =
          roundAxis === "z" ? "front" :
          roundAxis === "x" ? "side" :
          "top";
        // round axis="z"/"x"：用對應視角畫圓；其他視角 fall-through 走預設矩形。
        if (
          part.shape?.kind === "round" &&
          (roundAxis === "z" || roundAxis === "x") &&
          view === roundCircleView
        ) {
          const r = projectPart(part, view);
          const cx = r.x + r.w / 2;
          const cy = view === "top" ? -(r.y + r.h / 2) : -(r.y + r.h / 2);
          const radius = Math.min(r.w, r.h) / 2;
          return (
            <circle
              key={part.id}
              cx={cx}
              cy={cy}
              r={radius}
              fill="none"
              stroke={stroke}
              strokeWidth={sw}
            />
          );
        }
        // 圓盤 / 圓柱腳俯視畫圓；前/側視維持矩形（圓盤側面 = 直徑 × 厚）
        if (
          (part.shape?.kind === "round" ||
            part.shape?.kind === "round-tapered" ||
            part.shape?.kind === "splayed-round-tapered" ||
            part.shape?.kind === "lathe-turned") &&
          (part.shape.kind !== "round" || roundAxis === "y") &&
          view === "top"
        ) {
          const r = projectPart(part, view);
          const cx = r.x + r.w / 2;
          // Top view 翻轉 Y 跟 polygon 路徑（-p.y）一致：world +Z (BACK) → SVG 上方
          const cy = -(r.y + r.h / 2);
          const radius = Math.min(r.w, r.h) / 2;
          // 外斜圓錐：實線=腳頂位置，虛線=腳底位置 + 兩條外切線連起來才看得出是腳
          if (part.shape.kind === "splayed-round-tapered") {
            const scale = part.shape.bottomScale;
            const footCx = cx + -part.shape.dxMm; // 俯視鏡像 X
            const footCy = cy - part.shape.dzMm;  // 翻轉 Y 後 dzMm 符號要反過來
            const r1 = radius;
            const r2 = radius * scale;
            // 兩個圓的外切線：N = cosθ·p + sinθ·u，其中 sinθ = (r1-r2)/d
            const ddx = footCx - cx;
            const ddy = footCy - cy;
            const d = Math.hypot(ddx, ddy);
            const tangents: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
            if (d > Math.abs(r1 - r2) + 0.01) {
              const ux = ddx / d, uy = ddy / d;
              const px = -uy, py = ux;
              const sinT = (r1 - r2) / d;
              const cosT = Math.sqrt(Math.max(0, 1 - sinT * sinT));
              for (const s of [-1, 1] as const) {
                const Nx = s * cosT * px + sinT * ux;
                const Ny = s * cosT * py + sinT * uy;
                tangents.push({
                  x1: cx + r1 * Nx, y1: cy + r1 * Ny,
                  x2: footCx + r2 * Nx, y2: footCy + r2 * Ny,
                });
              }
            }
            // HLE：在俯視找出 bow（arch-bent + rotation.x）作為遮蔽體，
            // 算出 bow 頂面 top-view footprint，spindle 在裡面的部分用虛線
            const bowOccluder = renderDesign.parts.find(
              (q) =>
                q.id !== part.id &&
                q.shape?.kind === "arch-bent" &&
                Math.abs(q.rotation?.x ?? 0) > 0.01 &&
                (q.origin?.y ?? 0) > (part.origin?.y ?? 0),
            );
            let bowFace: Array<{ x: number; y: number }> | null = null;
            if (bowOccluder && bowOccluder.shape?.kind === "arch-bent") {
              const arch = bowOccluder.shape;
              const rakeRad = bowOccluder.rotation!.x;
              const cosRake = Math.cos(rakeRad);
              const sinRake = Math.sin(rakeRad);
              const blx = bowOccluder.visible.length;
              const bly = bowOccluder.visible.thickness;
              const blz = bowOccluder.visible.width;
              const segments = arch.segments ?? 16;
              const front: Array<{ x: number; y: number }> = [];
              const back: Array<{ x: number; y: number }> = [];
              for (let i = 0; i <= segments; i++) {
                const t = -1 + (2 * i) / segments;
                const xLocal = (blx * t) / 2;
                const archDz = arch.bendMm * Math.max(0, 1 - t * t);
                const yLocal = bly / 2; // 頂面 ey=+1
                const zFrontLocal = -blz / 2 + archDz;
                const zBackLocal = +blz / 2 + archDz;
                const wzFront = yLocal * sinRake + zFrontLocal * cosRake + bowOccluder.origin.z;
                const wzBack = yLocal * sinRake + zBackLocal * cosRake + bowOccluder.origin.z;
                const wx = xLocal + bowOccluder.origin.x;
                front.push({ x: -wx, y: -wzFront });
                back.push({ x: -wx, y: -wzBack });
              }
              bowFace = [...front, ...back.reverse()];
            }
            const isHidden = (x: number, y: number): boolean =>
              bowFace ? pointInPolygon({ x, y }, bowFace) : false;
            // tangent 線分段：被 bow 蓋的虛線
            const tangentEls: React.ReactNode[] = [];
            tangents.forEach((t, i) => {
              const segs = classifyEdgeVisibility(
                { x: t.x1, y: t.y1 },
                { x: t.x2, y: t.y2 },
                isHidden,
              );
              segs.forEach((seg, segIdx) => {
                tangentEls.push(
                  <line
                    key={`t-${i}-${segIdx}`}
                    x1={Number(seg.a.x.toFixed(2))}
                    y1={Number(seg.a.y.toFixed(2))}
                    x2={Number(seg.b.x.toFixed(2))}
                    y2={Number(seg.b.y.toFixed(2))}
                    stroke={seg.hidden ? "#444" : stroke}
                    strokeWidth={seg.hidden ? 0.7 : sw}
                    strokeDasharray={seg.hidden ? "4 3" : dash}
                  />,
                );
              });
            });
            // 頂圓（接 bow 那端）：圓心在 bow footprint 內 → 整圓虛線
            const topCircleHidden = isHidden(cx, cy);
            return (
              <g key={part.id}>
                <circle
                  cx={cx}
                  cy={cy}
                  r={r1}
                  fill="none"
                  stroke={topCircleHidden ? "#888" : stroke}
                  strokeWidth={topCircleHidden ? 0.5 : sw}
                  strokeDasharray={topCircleHidden ? "4 3" : dash}
                />
                <circle cx={footCx} cy={footCy} r={r2} fill="none" stroke="#222" strokeWidth={0.7} strokeDasharray="3 3" />
                {tangentEls}
              </g>
            );
          }
          return (
            <circle
              key={part.id}
              cx={cx}
              cy={cy}
              r={radius}
              fill="none"
              stroke={stroke}
              strokeWidth={sw}
              strokeDasharray={dash}
            />
          );
        }
        // 傾斜 box / 梯形 apron / arch-bent / tilt-z
        // worldExtents 只認 quarter rotation；非 quarter 旋轉、彎料、傾斜料都要走
        // projectPartSilhouette（3D corner sample → rotate → project → hull）
        // 任何「box-like」shape（含 chamfered-edges、chamfered-top 等微小邊緣修飾）
        // + 非 quarter rotation 都要走 projectPartSilhouette，否則 worldExtents 只認
        // quarter rotation，背柱 chamfered-edges + backRake 5° 會被畫成直立。
        const boxLikeShape = !part.shape
          || part.shape.kind === "box"
          || part.shape.kind === "chamfered-edges"
          || part.shape.kind === "chamfered-top";
        const isTiltedBox = boxLikeShape && hasNonQuarterRotation(part);
        const isApronTrapezoid = part.shape?.kind === "apron-trapezoid";
        const isApronBeveled = part.shape?.kind === "apron-beveled";
        // apron-half-beveled 之前漏掉 silhouette gate，掉到 useShape →
        // projectPartPolygon 對該 shape 沒分支 → 回 fallback box，三視圖全變
        // 純矩形看不出單側 bevel。projectTiltedBoxSilhouette 已支援，補進來。
        const isApronHalfBeveled = part.shape?.kind === "apron-half-beveled";
        const isArchBentSideFront =
          part.shape?.kind === "arch-bent" && view !== "top";
        const isTiltZ = part.shape?.kind === "tilt-z" && view !== "top";
        if (
          isTiltedBox ||
          isApronTrapezoid ||
          isApronBeveled ||
          isApronHalfBeveled ||
          isArchBentSideFront ||
          isTiltZ
        ) {
          // 俯視特例：上面（接座）+ 下面（接地，虛線）+ 4 條連接線
          // 跟外斜腳同樣的視覺風格——讓使用者看出 apron 是傾斜的
          if (view === "top") {
            const lx = part.visible.length;
            const ly = part.visible.thickness;
            const lz = part.visible.width;
            const trap = isApronTrapezoid && part.shape?.kind === "apron-trapezoid" ? part.shape : null;
            const bev = isApronBeveled && part.shape?.kind === "apron-beveled" ? part.shape : null;
            const bevShear = bev ? Math.tan(bev.bevelAngle) : 0;
            // 零件圖（isolatePartId）apron-trapezoid 專屬：rotation 已 reset，
            // 原本的 topCorners/botCorners 雙 polygon 在 rotation=0 下會塌成
            // 兩條水平線（4 corners 共用同 y）。改畫單一閉合梯形 outline，
            // 4 corner 各自帶 top/bot scale → 看出兩端錯位（user 2026-05-21 回報
            // 「四腳外斜的牙板 top view 應該是單斜你畫成直的」）。
            if (isolatePartId && trap) {
              // 物理上：visible.length 是 apron center Y 的長度，tenon 從 ±lx/2 端
              // 面凸出。topLengthScale/bottomLengthScale 是相對 center 的比例。
              // 之前直接套 ±lx/2 * scale 會讓 top corner 在 ±lx/2 × 0.97 = 比 tenon
              // 內側位置（±lx/2）短 3mm → top edge 跟 tenon 之間有三角形缺口；
              // bot corner 則凸過 tenon。改成把 body top 對齊 tenon 端面（±lx/2），
              // bottom 用相對比例延伸（physical：splay 是底面往外開、頂面接腳）。
              // ⚠️ 2026-06-01 改：接座/接地一律用 doc §A10.4 真實比例
              // （length × top/bottomLengthScale，相對肩到肩中心），跟俯視
              // silhouette + 主三視圖同源。先前用 ratio=bot/top 把接座對齊 tenon
              // 端面、接地放大，數值偏大(師傅照切會切長)、且跟俯視不一致
              // (user 2026-06-01「俯視短一節」)。寧可接座 < tenon 端面有小縫,
              // 也要三視圖/零件圖數值一致且符合 doc。
              const halfTop = (lx / 2) * trap.topLengthScale; // 接座(窄)
              const halfBot = (lx / 2) * trap.bottomLengthScale; // 接地(寬)
              const corners = [
                { x: -halfTop, y: +lz / 2 }, // 接座面左（畫面上方，跟 tenon 左內側對齊）
                { x: +halfTop, y: +lz / 2 }, // 接座面右
                { x: +halfBot, y: -lz / 2 }, // 接地面右（畫面下方，往外延伸）
                { x: -halfBot, y: -lz / 2 }, // 接地面左
              ];
              const pts = corners
                .map((p) => `${p.x.toFixed(2)},${(-p.y).toFixed(2)}`)
                .join(" ");
              return (
                <polygon
                  key={part.id}
                  points={pts}
                  fill="none"
                  stroke={stroke}
                  strokeWidth={sw}
                  strokeDasharray={dash}
                />
              );
            }
            const proj = (xl: number, yl: number, zl: number) => {
              // 梯形：x 依 z 端的 scale 縮放
              const xScale = trap
                ? zl < 0 ? trap.topLengthScale : trap.bottomLengthScale
                : 1;
              xl = xl * xScale;
              // 斜邊 apron：z 依 y 偏移（上下緣轉成水平面）
              zl = zl - yl * bevShear;
              const rx = part.rotation?.x ?? 0;
              const ry = part.rotation?.y ?? 0;
              const rz = part.rotation?.z ?? 0;
              const cxR = Math.cos(rx), sxR = Math.sin(rx);
              const cyR = Math.cos(ry), syR = Math.sin(ry);
              const czR = Math.cos(rz), szR = Math.sin(rz);
              let x = xl, y = yl, z = zl;
              let y2 = y * cxR - z * sxR;
              let z2 = y * sxR + z * cxR;
              y = y2; z = z2;
              let x2 = x * cyR + z * syR;
              z2 = -x * syR + z * cyR;
              x = x2; z = z2;
              x2 = x * czR - y * szR;
              y2 = x * szR + y * czR;
              x = x2; y = y2;
              return { x: -(x + part.origin.x), y: z + part.origin.z };
            };
            // 上面（local z = -lz/2）= 接座那面，下面 = 接地那面
            const topCorners = [
              proj(-lx / 2, -ly / 2, -lz / 2),
              proj(+lx / 2, -ly / 2, -lz / 2),
              proj(+lx / 2, +ly / 2, -lz / 2),
              proj(-lx / 2, +ly / 2, -lz / 2),
            ];
            const botCorners = [
              proj(-lx / 2, -ly / 2, +lz / 2),
              proj(+lx / 2, -ly / 2, +lz / 2),
              proj(+lx / 2, +ly / 2, +lz / 2),
              proj(-lx / 2, +ly / 2, +lz / 2),
            ];
            const fmt = (pts: typeof topCorners) =>
              pts.map((p) => `${p.x.toFixed(2)},${(-p.y).toFixed(2)}`).join(" ");
            // 傾斜橫撐俯視：top（接座面）實線、bot（接地面）虛線，跟 splayed-tapered
            // top view 同 convention，視覺上看得出哪面是頂哪面是底（user 2026-05-21
            // 回報 apron-beveled top view 兩條虛線重疊分不出 top/bot）。
            return (
              <g key={part.id}>
                <polygon points={fmt(topCorners)} fill="none" stroke={stroke} strokeWidth={sw} />
                <polygon points={fmt(botCorners)} fill="none" stroke="#222" strokeWidth={0.7} strokeDasharray="3 3" />
              </g>
            );
          }
          // arch-bent + rotation.x 側視特例：silhouette（含彎弧凸出）+ 端面截面平行四邊形輪廓
          // 端面 = x=±L/2 (archDz=0) 的橫截面，旋轉 rakeRad 後變平行四邊形
          // 兩端 X 在側視同點，所以端面只畫一個 overlay
          if (
            view === "side" &&
            part.shape?.kind === "arch-bent" &&
            Math.abs(part.rotation?.x ?? 0) > 0.01
          ) {
            const arch = part.shape;
            const rakeRad = part.rotation!.x;
            const cosRake = Math.cos(rakeRad);
            const sinRake = Math.sin(rakeRad);
            const ly = part.visible.thickness;
            const lz = part.visible.width;
            const ly_ext = ly * Math.abs(cosRake) + lz * Math.abs(sinRake);
            const yOff = part.origin.y + ly_ext / 2;
            // end-face 4 corners (z_local 不加 archDz)
            const endCorners = ([
              [-1, -1], [-1, +1], [+1, +1], [+1, -1],
            ] as const).map(([ey, ez]) => {
              const yL = (ey * ly) / 2;
              const zL = (ez * lz) / 2;
              const wy = yL * cosRake - zL * sinRake + yOff;
              const wz = yL * sinRake + zL * cosRake + part.origin.z;
              // side view: svg x = -wz（前=右慣例）, svg y = -wy
              return { x: -wz, y: -wy };
            });
            const endPts = endCorners.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
            const poly = projectTiltedBoxSilhouette(part, view);
            const points = poly.map((p) => `${p.x.toFixed(2)},${(-p.y).toFixed(2)}`).join(" ");
            void arch;
            return (
              <g key={part.id}>
                <polygon
                  points={points}
                  fill="none"
                  stroke={stroke}
                  strokeWidth={sw}
                  strokeDasharray={dash}
                />
                <polygon
                  points={endPts}
                  fill="none"
                  stroke={stroke}
                  strokeWidth={sw * 0.6}
                />
              </g>
            );
          }
          // 其他 view：convex hull silhouette
          let poly = projectTiltedBoxSilhouette(part, view);
          // 三視圖 back-* 部件 clip（側/正視）：
          // - back-post 底端被座板上緣 clip（overshoot 補縫進座板）
          // - back-slat / back-splat / back-curved-splat / back-spindle 頂端被
          //   上橫條下緣 clip（skipClamp 讓頂端 dip 進上橫條）
          // back-post 不 clip 頂端（柱穿到 height）；back-top-rail / back-rung 不 clip
          if (view === "side" || view === "front") {
            if (part.id.startsWith("back-post-")) {
              const seat = renderDesign.parts.find((p) => p.id === "seat");
              if (seat) poly = clipPolygonAboveY(poly, seat.origin.y + seat.visible.thickness);
            } else if (
              part.id.startsWith("back-slat-") ||
              part.id === "back-splat" ||
              part.id === "back-curved-splat" ||
              part.id.startsWith("back-spindle-")
            ) {
              const topRail = renderDesign.parts.find((p) => p.id === "back-top-rail");
              if (topRail) poly = clipPolygonBelowY(poly, topRail.origin.y);
            }
          }
          const points = poly.map((p) => `${p.x.toFixed(2)},${(-p.y).toFixed(2)}`).join(" ");
          // 零件圖 splay 腳側/正視:實線=未傾斜原料(outer ghost rect)、
          // 虛線=傾斜後 silhouette。木工視角:要動鋸子的原料 = 實線比較直覺。
          const isSplayFamily =
            part.shape?.kind === "splayed" ||
            part.shape?.kind === "splayed-tapered" ||
            part.shape?.kind === "splayed-round-tapered";
          const splaySwap =
            isolatePartId && isSplayFamily && (view === "front" || view === "side");
          // 零件圖 apron-trapezoid 俯視(view="front"): silhouette = 下邊長
          // (290.4)，但師傅要看得到上邊(280)位置才知道兩端要切多少。加兩條
          // 虛線「肩線」標 ±L/2×topLengthScale = 上邊端點 X 位置。
          // user 2026-06-02「單斜俯視看得到框形的榫肩樣子」。
          const trapForTop =
            isolatePartId &&
            view === "front" &&
            part.shape?.kind === "apron-trapezoid"
              ? part.shape
              : null;
          let trapShoulderOverlay: React.ReactNode = null;
          if (trapForTop && Math.abs(trapForTop.topLengthScale - trapForTop.bottomLengthScale) > 0.0001) {
            const lx = part.visible.length;
            const ly = part.visible.thickness;
            const halfTop = (lx / 2) * trapForTop.topLengthScale;
            // 俯視 view="front" 投影：(wx, wy) → (-wx, wy)；apron 原點 0、
            // rotation reset 後 part-local X→世界 X、Y→世界 Y。
            const xL = halfTop; // 螢幕 = -wx → 左肩在 -(-halfTop) = +halfTop
            const xR = -halfTop;
            // 內邊用 Y span = 投影後 thickness 上下緣
            const ySvgTop = -ly / 2;
            const ySvgBot = +ly / 2;
            trapShoulderOverlay = (
              <g key={`${part.id}-trap-shoulder`}>
                <line
                  x1={xL}
                  x2={xL}
                  y1={ySvgTop}
                  y2={ySvgBot}
                  stroke="#000"
                  strokeWidth={sw * 0.7}
                  strokeDasharray="3 2"
                />
                <line
                  x1={xR}
                  x2={xR}
                  y1={ySvgTop}
                  y2={ySvgBot}
                  stroke="#000"
                  strokeWidth={sw * 0.7}
                  strokeDasharray="3 2"
                />
              </g>
            );
          }
          if (trapShoulderOverlay) {
            return (
              <g key={part.id}>
                <polygon
                  points={points}
                  fill="none"
                  stroke={stroke}
                  strokeWidth={sw}
                  strokeDasharray={dash}
                />
                {trapShoulderOverlay}
              </g>
            );
          }
          return (
            <polygon
              key={part.id}
              points={points}
              fill="none"
              stroke={stroke}
              strokeWidth={splaySwap ? sw * 0.8 : sw}
              strokeDasharray={splaySwap ? "4 3" : dash}
            />
          );
        }
        // 外斜方錐俯視：實線=腳頂位置，虛線=腳底位置 + 4 條角對角線
        if (part.shape?.kind === "splayed-tapered" && view === "top") {
          const r = projectPart(part, view);
          const scale = part.shape.bottomScale;
          const footW = r.w * scale;
          const footH = r.h * scale;
          // Top view 翻轉 Y：原 y → -(y+h)
          const headY = -(r.y + r.h);
          const footX = r.x + r.w / 2 - footW / 2 + -part.shape.dxMm;
          const footY = -(r.y + r.h / 2 + footH / 2) - part.shape.dzMm;
          // 4 個角對角線：頂角 → 底角（翻轉 Y）
          const topCorners = [
            [r.x, headY], [r.x + r.w, headY], [r.x + r.w, headY + r.h], [r.x, headY + r.h],
          ];
          const botCorners = [
            [footX, footY], [footX + footW, footY], [footX + footW, footY + footH], [footX, footY + footH],
          ];
          return (
            <g key={part.id}>
              <rect x={r.x} y={headY} width={r.w} height={r.h} fill="none" stroke={stroke} strokeWidth={sw} strokeDasharray={dash} />
              <rect x={footX} y={footY} width={footW} height={footH} fill="none" stroke="#222" strokeWidth={0.7} strokeDasharray="3 3" />
              {topCorners.map((tc, i) => (
                <line key={i} x1={tc[0]} y1={tc[1]} x2={botCorners[i][0]} y2={botCorners[i][1]} stroke={stroke} strokeWidth={sw} strokeDasharray={dash} />
              ))}
            </g>
          );
        }
        // Use polygon when the shape is non-box AND it would differ from a rect
        // in this view.
        // round 一般不走 polygon（俯視畫圓另外處理；前/側視就是矩形），
        // 但「帶 chamferMm 的 round（圓凳座板倒角）」前/側視會多 2 個倒角，
        // 這時要走 polygon 路徑；俯視仍由上面的圓形 case 處理。
        const isRoundWithChamfer =
          part.shape?.kind === "round" &&
          ((part.shape.chamferMm ?? 0) > 0 || (part.shape.bottomChamferMm ?? 0) > 0);
        // tapered 帶 chamfer（圓凳/餐椅方錐腳套 legEdge）：俯視要畫八邊形
        // cross-section；前/側視仍是梯形（同 chamfered-edges convention）。
        const isTaperedWithChamfer =
          part.shape?.kind === "tapered" && (part.shape.chamferMm ?? 0) > 0;
        // face-rounded 帶 bendMm（靠背彎合板）：top view 也要走 polygon 才能畫出彎弧
        const isFaceRoundedBent =
          part.shape?.kind === "face-rounded" && Math.abs(part.shape.bendMm ?? 0) > 0;
        // face-rounded 板帶 rotation.x（recline）→ projectPartPolygon 用的
        // worldExtents 不認非 quarter rotation，會把 panel 畫成直立矩形看不到
        // 後仰角度。這種 case 跳過 useShape，讓它落到下面手算 silhouette 兜底。
        const isFaceRoundedXTilt =
          part.shape?.kind === "face-rounded" &&
          Math.abs(part.rotation?.x ?? 0) > 0.01 &&
          Math.abs(part.rotation?.x ?? 0) < Math.PI / 2 - 0.01 &&
          view !== "top";
        // tray 鳩尾榫 pin board synthesis：wall-left/right 沒 shape（3D 走 CSG
        // 挖洞）但 design 有 tail board → projectPartPolygon 合成 phase=1
        // dovetail-ends 出梯形 notch。
        // projectPartPolygon 內 combAxis 偵測會自動 reject「該視角看不到 broad
        // face」（含 thickness 的 end-face / edge-face）；不再 hardcode `view`
        // 限制，讓零件圖（reset rotation）下 top 視圖也能 synthesise。
        // 零件圖 isolation 模式只剩 1 個 part，本 part 沒 shape、找不到 donor
        // → 也用 design.parts 找原始 donor（renderDesign.parts 被 filter 掉了）
        // tray 鳩尾接合：tail board = wall-front/back (有 shape)、pin board = wall-left/right
        // drawer 鳩尾接合（半鳩尾 / 通鳩尾）：tail board = 側板 (-side-left/right，有 shape)、
        //   pin board = 前/後板 (-N-front / -N-back，無 shape)。
        // 兩種 case pin board 都需要 projectPartPolygon 合成梯形 notch。
        const isDovetailPinBoard =
          (!part.shape || part.shape.kind === "box") &&
          (/^wall-(left|right)$/.test(part.id) ||
            /-\d+-(front|back)$/.test(part.id)) &&
          (renderDesign.parts.some((p) => p.shape?.kind === "dovetail-ends") ||
            design.parts.some((p) => p.shape?.kind === "dovetail-ends"));
        const useShape =
          isDovetailPinBoard ||
          (!isFaceRoundedXTilt &&
          part.shape &&
          part.shape.kind !== "box" &&
          (part.shape.kind !== "round" || (isRoundWithChamfer && view !== "top")) &&
          !(
            view === "top" &&
            part.shape.kind !== "splayed" &&
            part.shape.kind !== "splayed-tapered" &&
            part.shape.kind !== "splayed-round-tapered" &&
            part.shape.kind !== "notched-corners" &&
            part.shape.kind !== "mitered-ends" &&
            part.shape.kind !== "finger-joint-ends" &&
            part.shape.kind !== "dovetail-ends" &&
            part.shape.kind !== "regular-polygon" &&
            part.shape.kind !== "arch-bent" &&
            part.shape.kind !== "right-triangle" &&
            part.shape.kind !== "mitered-corner" &&
            // pointed-ends：六角柱斜板（45° 旋轉），top view 也要走 silhouette
            // pipeline 才能正確投影旋轉後的尖角輪廓，不被 fallback rect 補方
            part.shape.kind !== "pointed-ends" &&
            // chamfered-edges：腳 / 橫撐 4 條長邊倒角，在「沿最長軸看過去」
            // 的視圖畫八邊形截面（geometry.ts projectPartPolygon §730 處理）；
            // top view 對腳（最長軸=Y）正好是 cross-section view，必須走
            // polygon path 才能畫八邊形，否則 fallback rect 沒倒角。
            part.shape.kind !== "chamfered-edges" &&
            // tilt-z：椅背直料 top view 用底面 cross-section 不要被 tilt Z 拉長
            // 成 (20+topShift) tall rect；projectPartPolygon 有專屬 tilt-z 分支
            part.shape.kind !== "tilt-z" &&
            !isTaperedWithChamfer &&
            !isFaceRoundedBent
          ));
        if (useShape) {
          // 零件圖 isolation 模式下，renderDesign.parts 只有 1 個 part、找不到
          // dovetail-ends donor → 額外把 design.parts（原始 4 壁）餵進去，讓
          // projectPartPolygon 借得到參數合成 pin board phase=1 shape。
          const polyAllParts = isolatePartId ? design.parts : renderDesign.parts;
          const poly = projectPartPolygon(part, view, polyAllParts);
          const points = poly.map((p) => `${p.x.toFixed(2)},${(-p.y).toFixed(2)}`).join(" ");
          const extras: React.ReactNode[] = [];
          // Splayed top view 雙條 shoulder（user 2026-05-29「俯視應該看到 2 條線
          // 單斜起點 + 切好終點」）:外輪廓 polygon 已含 bottom 面偏移,補上 top 面
          // 兩端 shoulder 線(未偏移)。X 軸 dxMm 才有 X 方向偏移、TOP view 看得到
          // 雙線;dzMm 單斜在 TOP view 投影沒 X 偏移、不畫(保留判斷簡單)。
          if (
            view === "top" &&
            (part.shape?.kind === "splayed" ||
              part.shape?.kind === "splayed-tapered" ||
              part.shape?.kind === "splayed-round-tapered")
          ) {
            const dxMm = part.shape.dxMm ?? 0;
            const dzMm = part.shape.dzMm ?? 0;
            if (Math.abs(dxMm) > 0.5 || Math.abs(dzMm) > 0.5) {
              const r = projectPart(part, view);
              // top 面(無偏移)是 projectPart 回的 r;bottom 面偏 (Dx, Dy)
              // 跟 geometry.ts:651-652 同慣例:Dx=-dxMm, Dy=dzMm
              const Dx = -dxMm;
              const Dy = dzMm;
              // 兩端各畫 top 面 shoulder(若跟 bottom 面 shoulder X 偏移 > 1.5 svg
              // 才畫,避免雙線疊在一起看不出來)
              if (Math.abs(Dx) > 1.5) {
                extras.push(
                  <line
                    key={`${part.id}-topshoulder-L`}
                    x1={r.x}
                    x2={r.x}
                    y1={-r.y}
                    y2={-(r.y + r.h)}
                    stroke="#444"
                    strokeWidth={0.6}
                  />,
                  <line
                    key={`${part.id}-topshoulder-R`}
                    x1={r.x + r.w}
                    x2={r.x + r.w}
                    y1={-r.y}
                    y2={-(r.y + r.h)}
                    stroke="#444"
                    strokeWidth={0.6}
                  />,
                );
              }
              // Z 偏移時補 top 面前/後 shoulder(沿 length 軸的水平線)
              if (Math.abs(Dy) > 1.5) {
                extras.push(
                  <line
                    key={`${part.id}-topshoulder-F`}
                    x1={r.x}
                    x2={r.x + r.w}
                    y1={-r.y}
                    y2={-r.y}
                    stroke="#444"
                    strokeWidth={0.6}
                  />,
                  <line
                    key={`${part.id}-topshoulder-B`}
                    x1={r.x}
                    x2={r.x + r.w}
                    y1={-(r.y + r.h)}
                    y2={-(r.y + r.h)}
                    stroke="#444"
                    strokeWidth={0.6}
                  />,
                );
              }
            }
          }
          // Arch-bent 側視：在未彎時的端面後緣多畫一條垂直實線，標示
          // 端面（cross-section）邊界——讓看圖的人分得出料的真實厚度 vs 彎弧延伸
          if (part.shape?.kind === "arch-bent" && view === "side") {
            const r = projectPart(part, view);
            const bend = part.shape.bendMm;
            if (Math.abs(bend) >= 0.5) {
              const xBackOriginal = r.x + r.w; // 未彎時的後緣
              extras.push(
                <line
                  key={`${part.id}-endface`}
                  x1={xBackOriginal}
                  x2={xBackOriginal}
                  y1={-r.y}
                  y2={-(r.y + r.h)}
                  stroke={stroke}
                  strokeWidth={sw}
                />,
              );
            }
          }
          // Face-rounded 側視（靠背 / 椅面彎合板）：silhouette 延伸 |bendMm|，
          // 在原板邊界畫分隔線分出「端面真實厚度」與「彎曲延伸」兩塊。
          if (part.shape?.kind === "face-rounded" && view === "side") {
            const bend = part.shape.bendMm ?? 0;
            const bendAxis = part.shape.bendAxis ?? "z";
            if (Math.abs(bend) >= 0.5) {
              const r = projectPart(part, view);
              if (bendAxis === "z") {
                // bendMm>0：往右延伸；分隔線在原右緣 r.x+r.w
                // bendMm<0：往左延伸；分隔線在原左緣 r.x
                const xDiv = bend > 0 ? r.x + r.w : r.x;
                extras.push(
                  <line
                    key={`${part.id}-endface`}
                    x1={xDiv}
                    x2={xDiv}
                    y1={-r.y}
                    y2={-(r.y + r.h)}
                    stroke={stroke}
                    strokeWidth={sw}
                  />,
                );
              } else {
                // bendAxis="y"：bendMm>0 往上延伸；bendMm<0 往下延伸
                const yDiv = bend > 0 ? r.y + r.h : r.y;
                extras.push(
                  <line
                    key={`${part.id}-endface`}
                    x1={r.x}
                    x2={r.x + r.w}
                    y1={-yDiv}
                    y2={-yDiv}
                    stroke={stroke}
                    strokeWidth={sw}
                  />,
                );
              }
            }
          }
          // dovetail-ends 端頭視圖（length 軸 ⊥ view direction）：pin 板（phase=1）
          // 在端面看會有 N 個梯形 gap 形狀（= 對面 tail 的截面投影）：外側較寬
          // 內側較窄。tail 板（phase=0）端面是直的（plain rect），不畫 overlay。
          if (part.shape?.kind === "dovetail-ends" && view !== "top" && part.shape.phase === 1) {
            const L = part.visible.length;
            const r = projectPart(part, view);
            const isEndFace = Math.abs(r.w - L) > 0.5 && Math.abs(r.h - L) > 0.5;
            if (isEndFace) {
              const N = Math.max(3, Math.floor(part.shape.segmentCount));
              const angleRad = (Math.max(1, Math.min(25, part.shape.angleDeg)) * Math.PI) / 180;
              const halfPin = part.shape.halfPin ?? true;
              const phaseDt = part.shape.phase;
              const isPinDt = (s: number) =>
                (halfPin && (s === 0 || s === N - 1)) ? true : ((s + phaseDt) % 2) === 0;
              const isLeftWall = part.origin.x < 0;
              const xOuter = isLeftWall ? r.x : r.x + r.w;
              const xInner = isLeftWall ? r.x + r.w : r.x;
              const useH = r.h > r.w;
              if (useH) {
                const segH = r.h / N;
                const d = Math.min(part.shape.pinDepth, r.w * 0.45);
                const slant = Math.min(segH * 0.45, d * Math.tan(angleRad));
                for (let s = 0; s < N; s++) {
                  if (isPinDt(s)) continue;
                  const yT = r.y + r.h - s * segH;
                  const yB = r.y + r.h - (s + 1) * segH;
                  const slantTop = s === 0 ? 0 : slant;
                  const slantBot = s === N - 1 ? 0 : slant;
                  const polyPts = [
                    [xOuter, yT + slantTop],
                    [xInner, yT],
                    [xInner, yB],
                    [xOuter, yB - slantBot],
                  ];
                  extras.push(
                    <polygon
                      key={`${part.id}-gap-${s}`}
                      points={polyPts.map((p) => `${p[0].toFixed(2)},${(-p[1]).toFixed(2)}`).join(" ")}
                      fill="none"
                      stroke={stroke}
                      strokeWidth={sw}
                      strokeDasharray={dash}
                    />,
                  );
                }
              }
            }
          }
          // 多邊形底板在俯視從外面是被壁體擋住 → 虛線（hidden line convention）
          const isPolygonBottomTop = part.shape?.kind === "regular-polygon" && view === "top";
          const effDash = isPolygonBottomTop ? "4 3" : dash;
          const effStroke = isPolygonBottomTop ? "#444" : stroke;
          // 零件圖 splay 腳側/正視:實線=未傾斜原料(outer ghost rect 加深處理)、
          // 虛線=傾斜後 silhouette。木工視角:要動鋸子的原料 = 實線比較直覺。
          const isSplayFamilyShape =
            part.shape?.kind === "splayed" ||
            part.shape?.kind === "splayed-tapered" ||
            part.shape?.kind === "splayed-round-tapered";
          const splaySwapShape =
            isolatePartId && isSplayFamilyShape && (view === "front" || view === "side");
          // 〔已停用 2026-06-01〕原本(9adb6ee2)為斜接 apron 俯視 TOP 把垂直端邊
          // 換成 overlay 的 shoulder 雙線。但 body 已統一成真實比例梯形/矩形 outline,
          // 這套 shoulder 雙線多餘且讓俯視端部多出榫頭肩線、看起來亂
          // (user 2026-06-01「俯視不畫榫頭肩線」)。直接停用,俯視走正常 body outline。
          const hasTiltedEndTenon = false;
          if (hasTiltedEndTenon) {
            const r = projectPart(part, view);
            const yTop = -(r.y + r.h);
            const yBot = -r.y;
            return (
              <g key={part.id}>
                <line
                  x1={r.x}
                  x2={r.x + r.w}
                  y1={yTop}
                  y2={yTop}
                  stroke={effStroke}
                  strokeWidth={sw}
                  strokeDasharray={effDash}
                />
                <line
                  x1={r.x}
                  x2={r.x + r.w}
                  y1={yBot}
                  y2={yBot}
                  stroke={effStroke}
                  strokeWidth={sw}
                  strokeDasharray={effDash}
                />
                {extras}
              </g>
            );
          }
          return (
            <g key={part.id}>
              <polygon
                points={points}
                fill="none"
                stroke={effStroke}
                strokeWidth={splaySwapShape ? sw * 0.8 : sw}
                strokeDasharray={splaySwapShape ? "4 3" : effDash}
              />
              {extras}
            </g>
          );
        }
        // 兜底：rotation.x ≠ 0 且非 quarter（typical 是 recline 4° 之類），
        // 但前面任何 special case 都沒接到的圓柱 / 弧形板。手算「YZ 平面 4 角
        // 經 X 旋轉」的 silhouette，在側視 / 正視畫成平行四邊形。
        // （projectPartSilhouette 對 round 的取樣假設橫向 dowel = 軸 X，
        //  對垂直圓柱 = 軸 Y 會出錯。）
        const rotX = part.rotation?.x ?? 0;
        const isXTilt =
          Math.abs(rotX) > 0.01 &&
          Math.abs(rotX) < Math.PI / 2 - 0.01 &&
          !(part.rotation?.y) &&
          !(part.rotation?.z);
        const isRoundLike =
          part.shape?.kind === "round" ||
          part.shape?.kind === "round-tapered" ||
          part.shape?.kind === "lathe-turned" ||
          part.shape?.kind === "shaker";
        const isFaceRounded = part.shape?.kind === "face-rounded";
        if (isXTilt && (isRoundLike || isFaceRounded) && view !== "top") {
          const lyL = part.visible.thickness; // 垂直高（局部 Y）
          const lzL = part.visible.width;     // 局部 Z（深度）
          const lxL = part.visible.length;    // 局部 X
          const cx = Math.cos(rotX), sx = Math.sin(rotX);
          const ox = part.origin.x;
          const oy = part.origin.y + lyL / 2;
          const oz = part.origin.z;
          const bendMm = isFaceRounded && part.shape?.kind === "face-rounded"
            ? (part.shape.bendMm ?? 0) : 0;
          const bendAxis = isFaceRounded && part.shape?.kind === "face-rounded"
            ? (part.shape.bendAxis ?? "z") : "z";
          const zMin = bendAxis === "z" && bendMm < 0 ? -lzL / 2 + bendMm : -lzL / 2;
          const zMax = bendAxis === "z" && bendMm > 0 ? +lzL / 2 + bendMm : +lzL / 2;
          // X 旋轉 + 加 origin + 投影到 view 平面
          const projectOne = (yL: number, zL: number, xL: number) => {
            const yR = yL * cx - zL * sx;
            const zR = yL * sx + zL * cx;
            const wx = xL + ox;
            const wy = yR + oy;
            const wz = zR + oz;
            // 側視前=右慣例：svg x = -wz
            if (view === "side") return { x: -wz, y: wy };
            return { x: -wx, y: wy }; // front
          };
          let polyPts: Array<{ x: number; y: number }>;
          if (view === "side") {
            // 側視：X 軸投影掉，YZ 4 corner → 平行四邊形（順時針）
            polyPts = [
              projectOne(-lyL / 2, zMin, 0),
              projectOne(-lyL / 2, zMax, 0),
              projectOne(+lyL / 2, zMax, 0),
              projectOne(+lyL / 2, zMin, 0),
            ];
          } else {
            // 正視：8 個 corner（左右 × 上下 × 前後 zMin/zMax）→ 投影到 XY
            // X 旋轉不動 X，所以 X 範圍 = ±lxL/2；Y 範圍 = max/min of yR
            const yRcandidates = [
              -lyL / 2 * cx - zMin * sx,
              -lyL / 2 * cx - zMax * sx,
              +lyL / 2 * cx - zMin * sx,
              +lyL / 2 * cx - zMax * sx,
            ];
            const yMin = Math.min(...yRcandidates) + oy;
            const yMax = Math.max(...yRcandidates) + oy;
            const xLeft = -(+lxL / 2 + ox);
            const xRight = -(-lxL / 2 + ox);
            polyPts = [
              { x: xLeft, y: yMin },
              { x: xRight, y: yMin },
              { x: xRight, y: yMax },
              { x: xLeft, y: yMax },
            ];
          }
          const points = polyPts.map((p) => `${p.x.toFixed(2)},${(-p.y).toFixed(2)}`).join(" ");
          // face-rounded 帶 bend 在側視畫端面分隔線（區分真實厚度與彎曲延伸）
          let dividerLine: React.ReactNode = null;
          if (view === "side" && isFaceRounded && bendAxis === "z" && Math.abs(bendMm) >= 0.5) {
            const zDiv = bendMm > 0 ? +lzL / 2 : -lzL / 2;
            const a = projectOne(-lyL / 2, zDiv, 0);
            const b = projectOne(+lyL / 2, zDiv, 0);
            dividerLine = (
              <line
                key={`${part.id}-endface`}
                x1={Number(a.x.toFixed(2))} y1={Number((-a.y).toFixed(2))} x2={Number(b.x.toFixed(2))} y2={Number((-b.y).toFixed(2))}
                stroke={stroke} strokeWidth={sw}
              />
            );
          } else if (view === "side" && isFaceRounded && bendAxis === "y" && Math.abs(bendMm) >= 0.5) {
            // bendAxis="y" 側視 divider：bend 沿 Y 軸延伸，分隔線在原始 Y 邊界（Z 跨 lzL）
            const yDiv = bendMm > 0 ? +lyL / 2 : -lyL / 2;
            const a = projectOne(yDiv, -lzL / 2, 0);
            const b = projectOne(yDiv, +lzL / 2, 0);
            dividerLine = (
              <line
                key={`${part.id}-endface`}
                x1={Number(a.x.toFixed(2))} y1={Number((-a.y).toFixed(2))} x2={Number(b.x.toFixed(2))} y2={Number((-b.y).toFixed(2))}
                stroke={stroke} strokeWidth={sw}
              />
            );
          }
          return (
            <g key={part.id}>
              <polygon
                points={points}
                fill="none"
                stroke={stroke}
                strokeWidth={sw}
                strokeDasharray={dash}
              />
              {dividerLine}
            </g>
          );
        }
        const r = projectPart(part, view);
        // 預設 rect path：把 4 條邊用 HLE 分段——visible 段實線、hidden 段虛線
        // 整個零件被擋住時 hidden 變數會 true，沿用整體實線/虛線；否則用 per-edge 判斷
        // 〔已停用 2026-06-01〕同 hasTiltedEndTenon：shoulder 雙線機制移除,
        // 俯視 fallback rect 走正常四邊。
        const hasTiltedEndTenonRect = false;
        if (hidden) {
          // 改畫成 4 條獨立 line + 同步 dashoffset（不再用 single rect path）
          // 同 Y / 同 X 的多 part hidden 邊就能 phase 對齊不鋸齒
          const ry = view === "top" ? -(r.y + r.h) : -r.y - r.h;
          const PERIOD = 7; // dasharray "4 3"
          const mod = (n: number) => ((n % PERIOD) + PERIOD) % PERIOD;
          const vfx = isolatePartId ? "non-scaling-stroke" : undefined;
          return (
            <g key={part.id}>
              <line x1={r.x} y1={ry} x2={r.x + r.w} y2={ry}
                stroke={stroke} strokeWidth={sw} strokeDasharray={dash}
                strokeDashoffset={mod(r.x)} fill="none" vectorEffect={vfx} />
              {!hasTiltedEndTenonRect && (
                <line x1={r.x + r.w} y1={ry} x2={r.x + r.w} y2={ry + r.h}
                  stroke={stroke} strokeWidth={sw} strokeDasharray={dash}
                  strokeDashoffset={mod(ry)} fill="none" vectorEffect={vfx} />
              )}
              <line x1={r.x} y1={ry + r.h} x2={r.x + r.w} y2={ry + r.h}
                stroke={stroke} strokeWidth={sw} strokeDasharray={dash}
                strokeDashoffset={mod(r.x)} fill="none" vectorEffect={vfx} />
              {!hasTiltedEndTenonRect && (
                <line x1={r.x} y1={ry} x2={r.x} y2={ry + r.h}
                  stroke={stroke} strokeWidth={sw} strokeDasharray={dash}
                  strokeDashoffset={mod(ry)} fill="none" vectorEffect={vfx} />
              )}
            </g>
          );
        }
        const corners = [
          { x: r.x, y: r.y },
          { x: r.x + r.w, y: r.y },
          { x: r.x + r.w, y: r.y + r.h },
          { x: r.x, y: r.y + r.h },
        ];
        const isHiddenAt = makeHiddenChecker(part, renderDesign.parts, view);
        const lines: React.ReactNode[] = [];
        // 主面板（座板 / 桌面）俯視 outline：viewBox 大（790×872）經 SVG scale ≈0.75
        // 後 sw=0.9→0.67 css px 變 sub-pixel anti-aliased 灰，整個座板實線消失。
        // 立柱可見邊用粗線 1.4；零件圖模式（isolatePartId）下 0.9 在 1x 螢幕
        // 還是 sub-pixel anti-aliased 灰，提到 1.2 才穩定渲染 1 css px 純黑
        const isMainPanelTopView =
          view === "top" &&
          (part.id === "seat" || part.id === "top" || part.id === "table-top");
        const visibleSw = isolatePartId
          ? 1.5
          : isCornerPost
            ? 1.4
            : isMainPanelTopView
              ? 1.8
              : 0.9;
        const visibleStroke = "#000";
        for (let i = 0; i < 4; i++) {
          // 跳過 view="front" 帶斜接 tenon 的料的左右垂直端邊
          // (i=1 右垂直 / i=3 左垂直,corners 順序:TL→TR→BR→BL)
          if (hasTiltedEndTenonRect && (i === 1 || i === 3)) continue;
          const a = corners[i];
          const b = corners[(i + 1) % 4];
          const segs = classifyEdgeVisibility(a, b, isHiddenAt);
          segs.forEach((seg, segIdx) => {
            // Canonicalize 方向 (smaller→larger)，dashoffset 用世界座標當 phase anchor，
            // 同 Y 的水平虛線、同 X 的垂直虛線都對齊到全局 (0,0) 同相位 → 重疊不鋸齒
            const isHoriz = Math.abs(seg.a.y - seg.b.y) < 0.01;
            const isVert = Math.abs(seg.a.x - seg.b.x) < 0.01;
            const svgY1 = -seg.a.y;
            const svgY2 = -seg.b.y;
            let x1 = seg.a.x, y1 = svgY1, x2 = seg.b.x, y2 = svgY2;
            if (isHoriz && x1 > x2) { [x1, x2] = [x2, x1]; }
            if (isVert && y1 > y2) { [y1, y2] = [y2, y1]; }
            // dashoffset = (anchor mod period) 讓所有同方向虛線 phase 對齊
            const PERIOD = 7;  // dasharray "4 3"
            const mod = (n: number) => ((n % PERIOD) + PERIOD) % PERIOD;
            const dashOffset = seg.hidden
              ? isHoriz ? mod(x1) : isVert ? mod(y1) : 0
              : undefined;
            lines.push(
              <line
                key={`${part.id}-e${i}-s${segIdx}`}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={seg.hidden ? "#444" : visibleStroke}
                strokeWidth={seg.hidden ? 0.7 : visibleSw}
                strokeDasharray={seg.hidden ? "4 3" : undefined}
                strokeDashoffset={dashOffset}
                fill="none"
                vectorEffect={isolatePartId ? "non-scaling-stroke" : undefined}
              />,
            );
          });
        }
        return <g key={part.id}>{lines}</g>;
      });
      })()}

      {/* 單斜 apron tenon shoulder 俯視 TOP 面板雙線(user 2026-05-29):
          零件圖「俯視 TOP」面板 = OrthoView view="front" = X-Y 投影。
          每個 start/end tenon 帶 axis 的 → 兩條黑色垂直直線:
            top 面 shoulder + bottom 面 shoulder
          兩條 X 偏移 = (ay/ax) × T(全厚度的 tan)。
          先用白線蓋掉 polygon 本體在 shoulder 處的垂直端邊(避免變 3 條線),
          再畫黑色 shoulder 雙線。 */}
      {/* 〔已停用 2026-06-01〕斜接 apron 俯視 shoulder 雙線 overlay 移除:
          body 已用真實比例 outline,此 overlay 多出榫頭肩線、俯視看起來亂
          (user「俯視不畫榫頭肩線」)。 */}
      {false && view === "front" && !!isolatePartId && renderDesign.parts.map((p) => {
        const tilts = p.tenons.filter((t) => {
          if (!t.axis) return false;
          if (t.position !== "start" && t.position !== "end") return false;
          const ax = t.axis.x ?? 0;
          const ay = t.axis.y ?? 0;
          if (Math.abs(ax) < 0.001) return false;
          return Math.abs((ay / ax) * p.visible.thickness / 2) >= 0.5;
        });
        if (tilts.length === 0) return null;
        const T = p.visible.thickness;
        const r = projectPart(p, view);
        const yTopSvg = -(r.y + r.h);
        const yBotSvg = -r.y;
        const lines: React.ReactNode[] = [];
        for (const t of tilts) {
          const ax = t.axis!.x ?? 0;
          const ay = t.axis!.y ?? 0;
          const delta = (ay / ax) * T / 2;
          let xTop: number;
          let xBot: number;
          if (t.position === "end") {
            xTop = r.x + delta;
            xBot = r.x - delta;
          } else {
            xTop = r.x + r.w + delta;
            xBot = r.x + r.w - delta;
          }
          lines.push(
            <line
              key={`${p.id}-${t.position}-shoulder-top`}
              x1={xTop}
              x2={xTop}
              y1={yTopSvg}
              y2={yBotSvg}
              stroke="#000"
              strokeWidth={0.8}
            />,
            <line
              key={`${p.id}-${t.position}-shoulder-bot`}
              x1={xBot}
              x2={xBot}
              y1={yTopSvg}
              y2={yBotSvg}
              stroke="#000"
              strokeWidth={0.8}
            />,
          );
        }
        return <g key={`${p.id}-tilt-shoulders`}>{lines}</g>;
      })}

      {/* 座面挖型（saddle / scooped）— 前/側視疊一條虛線曲線顯示挖型輪廓
           俯視看不到挖型不畫；曲線從矩形頂緣往下凹（最深點 = depthMm） */}
      {view !== "top" && renderDesign.parts
        .filter((p) => p.shape?.kind === "seat-scoop")
        .map((p) => {
          if (p.shape?.kind !== "seat-scoop") return null;
          const scoop = p.shape;
          const r = projectPart(p, view);
          const yTop = -r.y - r.h; // SVG y for the seat top
          // x 軸：前視看 length，側視看 width
          const axisLen = view === "side" ? p.visible.width : p.visible.length;
          const halfL = axisLen / 2;
          const SAMPLES = 40;
          const dipFn = (t: number): number => {
            // t ∈ [-1, 1]
            if (scoop.profile === "saddle") {
              return scoop.depthMm * Math.max(0, 1 - t * t);
            }
            if (scoop.profile === "dished") {
              // 沿 Z 軸單軸下凹：側視全弧、前視淺弧
              if (view === "side") return scoop.depthMm * Math.max(0, 1 - t * t);
              return scoop.depthMm * Math.max(0, 1 - t * t * 0.3);
            }
            // scooped 兩個 basin（中心在 ±0.5）
            // 前視 (X 軸 ↔ length)：能看到 M 形雙凹
            // 側視 (Z 軸 ↔ width)：兩 basin 沿 Z 全長延伸（兩端稍淺），畫單凹
            if (view === "side") {
              return scoop.depthMm * Math.max(0, 1 - t * t * 0.6);
            }
            const r1 = (t - 0.5) / 0.5;
            const r2 = (t + 0.5) / 0.5;
            const f1 = Math.max(0, 1 - r1 * r1);
            const f2 = Math.max(0, 1 - r2 * r2);
            return scoop.depthMm * Math.max(f1, f2);
          };
          const cx = r.x + r.w / 2;
          const pts: string[] = [];
          for (let i = 0; i <= SAMPLES; i++) {
            const t = -1 + (2 * i) / SAMPLES;
            const x = cx + t * halfL;
            const y = yTop + dipFn(t);
            pts.push(`${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`);
          }
          return (
            <path
              key={`scoop-${p.id}-${view}`}
              d={pts.join(" ")}
              fill="none"
              stroke="#666"
              strokeWidth={0.6}
              strokeDasharray="3 2"
            />
          );
        })}

      {/* outer bounding box (dashed ghost)
          零件圖 splay 腳側/正視:此框=未傾斜原料,改實線深色當主輪廓
          (跟 polygon silhouette 改虛線配對, 木工視角實線=要切的料) */}
      {(() => {
        const isolatedPart = isolatePartId ? renderDesign.parts[0] : null;
        const isSplayPartSwap =
          !!isolatedPart &&
          (isolatedPart.shape?.kind === "splayed" ||
            isolatedPart.shape?.kind === "splayed-tapered" ||
            isolatedPart.shape?.kind === "splayed-round-tapered") &&
          (view === "front" || view === "side");
        return (
          <rect
            x={-w / 2}
            y={drawAreaTop}
            width={w}
            height={h}
            fill="none"
            stroke={isSplayPartSwap ? "#000" : "#999"}
            strokeDasharray={isSplayPartSwap ? undefined : "3 3"}
            strokeWidth={isSplayPartSwap ? 1.2 : 0.5}
            opacity={isSplayPartSwap ? 1 : 0.8}
          />
        );
      })()}

      {/* 榫接模式 overlay（drafting-math.md §B5/§B6）：
            - tenon 凸出 = 紅實線
            - tenon 肩位 = 紅虛線（公榫件本體面 / 肩到肩 boundary）
            - mortise = 藍虛線
            - 通榫穿透時母件背面 = 端面木紋格 §B5
          glass 件略過。 */}
      {joineryMode && (() => {
        // 簡化版 joinery 渲染：tenon/mortise 一律用 axis-aligned 2D rect 畫
        // （projectFeatureRect 取 AABB），不跟 part shape 變形、不 match 母榫
        // polygon、不畫 splayed 2-slice。視覺乾淨，三視圖一致。
        return (
        <g pointerEvents="none">
          {renderDesign.parts.map((part) => {
            if (part.visual === "glass") return null;
            const elements: React.ReactNode[] = [];
            // tenon 凸出（公榫）—— 一律單 polygon，跟著公件 shape/rotation 變形
            // （splayed 腳、apron-trapezoid 牙條），這樣腳斜時榫頭也跟著斜。
            // 不再做 mortise polygon 配對、splayed 2-slice 等堆疊（避免「3D 太亂」）。
            // 通榫 = 藍實線（凸出可見），盲榫/其他 = 紅虛線（埋進母件不可見）。
            // X 字撐（rotation y 45°）的對角榫俯視圖不畫——
            // 端面落在 X-Z 對角，tipFaceView 判定不在純軸；圓料腳鑿方榫
            // 的方框畫出來會跟腳的圓輪廓重疊，視覺反而亂。
            // 對角榫做法手作端自行決定（45° 盲榫 / 暗銷 / 楔釘）。
            const isXCrossTopView = view === "top" && part.id.startsWith("ls-xcross-");

            // 圓料腳中軸線（debug 用）：從腳底中心到腳頂中心
            const isRoundLegPartForAxis =
              part.shape?.kind === "round" ||
              part.shape?.kind === "round-tapered" ||
              part.shape?.kind === "shaker" ||
              part.shape?.kind === "splayed-round-tapered";
            if (isRoundLegPartForAxis && view !== "top") {
              const lh = part.visible.thickness;
              const ox = part.origin?.x ?? 0;
              const oy = part.origin?.y ?? 0;
              const oz = part.origin?.z ?? 0;
              // splayed 腳：底偏 (dx, dz)；非 splayed：dx=dz=0
              let bottomDx = 0, bottomDz = 0;
              if (part.shape?.kind === "splayed-round-tapered") {
                bottomDx = part.shape.dxMm ?? 0;
                bottomDz = part.shape.dzMm ?? 0;
              }
              // 腳底中心 (世界): (ox + bottomDx, oy, oz + bottomDz)
              // 腳頂中心 (世界): (ox, oy + lh, oz)
              const bx = ox + bottomDx, by = oy, bz = oz + bottomDz;
              const tx = ox, ty = oy + lh, tz = oz;
              // 投影到視圖平面（用跟 makeProjector 相同的慣例：front/top 都 -wx；側視 -wz）
              const proj = (wx: number, wy: number, wz: number) => {
                if (view === "front") return { x: -wx, y: wy };
                if (view === "side") return { x: -wz, y: wy };
                return { x: -wx, y: wz };  // top view (won't use here)
              };
              const p1 = proj(bx, by, bz);
              const p2 = proj(tx, ty, tz);
              elements.push(
                <line
                  key={`${part.id}-axis`}
                  x1={p1.x}
                  y1={-p1.y}
                  x2={p2.x}
                  y2={-p2.y}
                  stroke="#444"
                  strokeWidth={0.5}
                  strokeDasharray="2 2"
                  opacity={0.7}
                />,
              );
            }

            for (let i = 0; i < part.tenons.length; i++) {
              const t = part.tenons[i];
              if (t.length <= 0) continue;
              if (isXCrossTopView) continue;
              const lb = tenonLocalBox(part, t);
              const r = projectFeatureRect(part, lb, view);
              if (r.w >= 0.5 && r.h >= 0.5) {
                // tipFaceView 判斷：通榫只有「端面正對視線」的視圖才藍實線
                let tenonLocalAxis: "x" | "y" | "z" = "x";
                if (t.position === "top" || t.position === "bottom") tenonLocalAxis = "y";
                else if (t.position === "left" || t.position === "right") tenonLocalAxis = "z";
                const rx = part.rotation?.x ?? 0;
                const ry = part.rotation?.y ?? 0;
                let vx = tenonLocalAxis === "x" ? 1 : 0;
                let vy = tenonLocalAxis === "y" ? 1 : 0;
                let vz = tenonLocalAxis === "z" ? 1 : 0;
                const cx_ = Math.cos(rx), sx_ = Math.sin(rx);
                const ny = vy * cx_ - vz * sx_;
                const nz = vy * sx_ + vz * cx_;
                vy = ny; vz = nz;
                const cy_ = Math.cos(ry), sy_ = Math.sin(ry);
                const nx2 = vx * cy_ + vz * sy_;
                const nz2 = -vx * sy_ + vz * cy_;
                vx = nx2; vz = nz2;
                const ax = Math.abs(vx), ay = Math.abs(vy), az = Math.abs(vz);
                const tenonWorldAxis: "x" | "y" | "z" =
                  ax >= ay && ax >= az ? "x" : ay >= az ? "y" : "z";
                const viewCollapsedAxis: "x" | "y" | "z" =
                  view === "front" ? "z" : view === "side" ? "x" : "y";
                const tipFaceView = tenonWorldAxis === viewCollapsedAxis;
                const isVisibleTenon = t.type === "through-tenon" && tipFaceView;
                // 圓料腳的 top 榫：榫頭跟腳同軸同心 → 畫橢圓
                // splayed-round-tapered 還要沿腳中軸 tilt（榫頭跟腳延伸成一直線）
                const isRoundLegPart =
                  part.shape?.kind === "round" ||
                  part.shape?.kind === "round-tapered" ||
                  part.shape?.kind === "shaker" ||
                  part.shape?.kind === "splayed-round-tapered";
                if (isRoundLegPart && (t.position === "top" || t.position === "bottom")) {
                  if (view === "top") {
                    // 俯視：圓榫畫成圓（圓料 cross-section）
                    const cx = r.x + r.w / 2;
                    const cyWorld = r.y + r.h / 2;
                    const cySvg = -cyWorld;
                    const radius = Math.min(r.w, r.h) / 2;
                    elements.push(
                      <circle
                        key={`${part.id}-t${i}-r`}
                        cx={cx}
                        cy={cySvg}
                        r={radius}
                        fill="none"
                        stroke={isVisibleTenon ? "#2980b9" : "#c0392b"}
                        strokeWidth={0.6}
                        strokeDasharray={isVisibleTenon ? undefined : "3 2"}
                      />,
                    );
                  } else {
                    // 正/側視：圓柱榫的側面投影 = 兩條沿腳中軸方向的平行延伸線
                    // top tenon：root 在 r.y（低 Y），tip 在 r.y+r.h（高 Y），軸向 +Y
                    // bottom tenon：root 在 r.y+r.h（高 Y），tip 在 r.y（低 Y），軸向 -Y
                    const isTopPos = t.position === "top";
                    const cxBase = r.x + r.w / 2;
                    const yBaseWorld = isTopPos ? r.y : r.y + r.h;  // root face Y
                    const yTopWorld = isTopPos ? r.y + r.h : r.y;   // tip face Y
                    const halfWidth = r.w / 2;  // 圓料半徑
                    // 腳中軸方向（top tenon = 腳頂往榫頂；bottom tenon = 圓料底往榫尖即繼續往下）
                    // 直腳=(0, ±1)，splayed-round-tapered=(±dx, ±lh) 歸一化
                    let axDx = 0;
                    let axDy = isTopPos ? 1 : -1;
                    if (part.shape?.kind === "splayed-round-tapered") {
                      const dx = part.shape.dxMm ?? 0;
                      const dz = part.shape.dzMm ?? 0;
                      const lh = part.visible.thickness;
                      if (lh > 0) {
                        // top tenon: leg axis (bot→top) = (-dx, +lh, -dz)；繼續延伸上去 same direction
                        // bottom tenon: spindle axis (top→bot) = (+dx, -lh, +dz)；繼續往下 same
                        const sgn = isTopPos ? 1 : -1;
                        const projDx = view === "front" ? dx : view === "side" ? dz : 0;
                        const norm = Math.sqrt(projDx * projDx + lh * lh);
                        // screen X = -world X (front) 或 -world Z (side)
                        // top: screen Δx = sgn * +projDx；bottom: 反向 → 套 -sgn
                        axDx = (sgn === 1 ? projDx : -projDx) / norm;
                        axDy = (sgn * lh) / norm;
                      }
                    }
                    // 榫長 = 沿腳中軸延伸的距離；用 r.h（投影 Y 距離）≈ length × |axDy|
                    const tenonLen = Math.abs(axDy) > 0.01 ? r.h / Math.abs(axDy) : r.h;
                    // 兩條平行線：腳頂/底左右端點（垂直腳中軸偏 ±halfWidth）→ 沿軸延伸 tenonLen
                    // 垂直軸的 unit vector (right side)：rotate 軸 90° → (axDy, -axDx)
                    const perpX = axDy;
                    const perpY = -axDx;
                    const ends: Array<{ x: number; y: number }> = [];
                    for (const sgn of [-1, 1]) {
                      const x1 = cxBase + sgn * halfWidth * perpX;
                      const y1World = yBaseWorld + sgn * halfWidth * perpY;
                      const x2 = x1 + tenonLen * axDx;
                      const y2World = y1World + tenonLen * axDy;
                      elements.push(
                        <line
                          key={`${part.id}-t${i}-r${sgn}`}
                          x1={x1}
                          y1={-y1World}
                          x2={x2}
                          y2={-y2World}
                          fill="none"
                          stroke={isVisibleTenon ? "#2980b9" : "#c0392b"}
                          strokeWidth={0.6}
                          strokeDasharray={isVisibleTenon ? undefined : "3 2"}
                        />,
                      );
                      ends.push({ x: x2, y: -y2World });
                    }
                    // 頂端封口：連接兩條線的頂端，表達榫頭深度（端面 cap）
                    if (ends.length === 2) {
                      elements.push(
                        <line
                          key={`${part.id}-t${i}-r-cap`}
                          x1={ends[0].x}
                          y1={ends[0].y}
                          x2={ends[1].x}
                          y2={ends[1].y}
                          fill="none"
                          stroke={isVisibleTenon ? "#2980b9" : "#c0392b"}
                          strokeWidth={0.6}
                          strokeDasharray={isVisibleTenon ? undefined : "3 2"}
                        />,
                      );
                    }
                    void yTopWorld;
                  }
                  continue;
                }
                // 側/正視 用 polygon 跟著 part shape（splayed/apron-trapezoid/
                // beveled）變形——apron 斜的話榫頭也跟著斜。
                // 俯視 用 axis-aligned rect——避免 apron-trapezoid 讓 top/bot
                // 端 length scale 差距產生疊影 mess。
                if (view === "top") {
                  elements.push(
                    <rect
                      key={`${part.id}-t${i}`}
                      x={r.x}
                      y={-(r.y + r.h)}
                      width={r.w}
                      height={r.h}
                      fill="none"
                      stroke={isVisibleTenon ? "#2980b9" : "#c0392b"}
                      strokeWidth={0.6}
                      strokeDasharray={isVisibleTenon ? undefined : "3 2"}
                    />,
                  );
                } else {
                  const tPoly = projectFeaturePolygon(part, lb, view, true);
                  const tPoints = tPoly.map((p) => `${p.x.toFixed(2)},${(-p.y).toFixed(2)}`).join(" ");
                  elements.push(
                    <polygon
                      key={`${part.id}-t${i}`}
                      points={tPoints}
                      fill="none"
                      stroke={isVisibleTenon ? "#2980b9" : "#c0392b"}
                      strokeWidth={0.6}
                      strokeDasharray={isVisibleTenon ? undefined : "3 2"}
                    />,
                  );
                }
                // 指接榫加 zigzag 平行線：在 r 內部沿較長軸畫 3-5 條等距線，
                // 暗示 finger 切口（drafting-math §B2 指數 n = 板高/板厚）
                if (t.type === "finger-joint") {
                  const longAxis = r.w >= r.h ? "x" : "y";
                  const N = 4; // 4 條暗示分區
                  for (let k = 1; k < N; k++) {
                    const f = k / N;
                    if (longAxis === "x") {
                      const xL = r.x + r.w * f;
                      elements.push(
                        <line
                          key={`${part.id}-fj${i}-${k}`}
                          x1={xL}
                          y1={-(r.y + r.h)}
                          x2={xL}
                          y2={-r.y}
                          stroke="#c0392b"
                          strokeWidth={0.3}
                          opacity={0.7}
                        />,
                      );
                    } else {
                      const yL = -(r.y + r.h * (1 - f));
                      elements.push(
                        <line
                          key={`${part.id}-fj${i}-${k}`}
                          x1={r.x}
                          y1={yL}
                          x2={r.x + r.w}
                          y2={yL}
                          stroke="#c0392b"
                          strokeWidth={0.3}
                          opacity={0.7}
                        />,
                      );
                    }
                  }
                }
                // 半搭榫：對角斜線暗示 lap 搭接面
                if (t.type === "half-lap") {
                  elements.push(
                    <line
                      key={`${part.id}-hl${i}`}
                      x1={r.x}
                      y1={-r.y}
                      x2={r.x + r.w}
                      y2={-(r.y + r.h)}
                      stroke="#c0392b"
                      strokeWidth={0.3}
                      strokeDasharray="2 1.5"
                      opacity={0.6}
                    />,
                  );
                }
                // 企口榫（舌狀）：薄水平線暗示舌中心
                if (t.type === "tongue-and-groove") {
                  const midY = -(r.y + r.h / 2);
                  elements.push(
                    <line
                      key={`${part.id}-tg${i}`}
                      x1={r.x}
                      y1={midY}
                      x2={r.x + r.w}
                      y2={midY}
                      stroke="#c0392b"
                      strokeWidth={0.3}
                      opacity={0.6}
                    />,
                  );
                }
              }
              // shoulder polygon 移除：tenon body 已表達榫接位置，shoulder 是重複資訊
            }
            // mortise 不獨立畫：tenon 已用 mortise polygon 取代並依「通榫實線/盲榫虛線」
            // 區分可見性。Mortise 自己畫只會跟 tenon 重疊，視覺重複。
            // （保留通榫穿透時母件「背面」端面木紋格 §B5）
            for (let i = 0; i < part.mortises.length; i++) {
              const m = part.mortises[i];
              if (m.depth <= 0) continue;
              const lb = mortiseLocalBox(part, m);
              const r = projectFeatureRect(part, lb, view);
              if (r.w < 0.5 || r.h < 0.5) continue;
              // 通榫穿透時母件「背面」端面木紋格（§B5）：在 mortise 的 exit
              // 面（跟 entry 相反那面）上隨機點。AABB 投影到該視圖時取
              // 入口 face 的 rect 即可（depth 垂直於該 face，bbox 在 view
              // 上是 length×width）。只在 depth 軸朝 view normal 的視圖看
              // 得到（top view 看 Y-depth mortise；front 看 Z-depth；side
              // 看 X-depth）。簡化：top view 內 m.through=true && depth 沿
              // Y 軸時就畫端面格。
              if (m.through) {
                // 估 mortise 跟 view 的對應：通孔 face 跟 mortise depth 軸
                // 垂直；簡單做法：把 mortise 看成完整 bbox 投到該 view 看
                // 是不是夠面 → 是的話畫端面格在面上中央。
                // 偷懶：通孔在每個 view 都畫小格紋，反正不重複到 tenon 那邊。
                const grainStep = 1.5;
                const padding = 1.0;
                const innerW = r.w - 2 * padding;
                const innerH = r.h - 2 * padding;
                if (innerW > grainStep * 2 && innerH > grainStep * 2) {
                  const innerLines: React.ReactNode[] = [];
                  // 隨機點作為端面木纖（用 mortise origin 當 seed）
                  const seed = (m.origin.x * 7 + m.origin.y * 13 + m.origin.z * 19);
                  let rng = Math.abs(seed) % 1000 / 1000;
                  const next = () => { rng = (rng * 9301 + 49297) % 233280 / 233280; return rng; };
                  const dotCount = Math.max(3, Math.round((innerW * innerH) / 60));
                  for (let d = 0; d < dotCount; d++) {
                    const px = r.x + padding + next() * innerW;
                    const py = -(r.y + r.h) + padding + next() * innerH;
                    innerLines.push(
                      <circle
                        key={`g-${d}`}
                        cx={px}
                        cy={py}
                        r={0.3}
                        fill="#2980b9"
                        opacity={0.55}
                      />,
                    );
                  }
                  elements.push(
                    <g key={`${part.id}-m${i}-grain`}>{innerLines}</g>,
                  );
                }
              }
            }
            return elements.length > 0 ? <g key={`joinery-${part.id}`}>{elements}</g> : null;
          })}
        </g>
        );
      })()}

      {/* Cosmetic mortise（無線充電凹槽、後板穿線孔等產品功能）—正常三視圖也要可見 */}
      <g pointerEvents="none">
        {renderDesign.parts.map((part) => {
          if (part.visual === "glass") return null;
          // polygon staves（wall-1, wall-2…）的 divider dado mortise 不畫橘色指示框
          // CSG 還是會挖，只是 2D 不再加多餘虛線（隔板邊緣已經視覺上嵌入壁）
          if (/^wall-\d+$/.test(part.id)) return null;
          // rect 壁 dado（divider 嵌入溝）：m.rotY 標記用，CSG 會挖但 2D outline 算錯方向，跳過
          const cosmetic = part.mortises.filter((m) => m.cosmetic && m.depth > 0 && !m.rotY);
          if (cosmetic.length === 0) return null;
          // Pill 偵測：rect mortise + 2 round mortise（at ±rect.length/2、同 cy/cz/rotX/depth）
          // 視為單一 pill 路徑。否則 3 個獨立框 + outer/inner 雙輪廓 = 6 條線，使用者覺得亂。
          type Entry =
            | { kind: "pill"; rect: typeof cosmetic[number]; rounds: [typeof cosmetic[number], typeof cosmetic[number]] }
            | { kind: "single"; m: typeof cosmetic[number] };
          const entries: Entry[] = [];
          const used = new Set<number>();
          const eq = (a: number, b: number) => Math.abs(a - b) < 0.5;
          for (let i = 0; i < cosmetic.length; i++) {
            if (used.has(i)) continue;
            const m = cosmetic[i];
            if (m.shape === "rect") {
              const offX = m.length / 2;
              let li = -1, ri = -1;
              for (let j = 0; j < cosmetic.length; j++) {
                if (j === i || used.has(j)) continue;
                const om = cosmetic[j];
                if (om.shape !== "round") continue;
                if (!eq(om.origin.y, m.origin.y) || !eq(om.origin.z, m.origin.z)) continue;
                if ((om.rotX ?? 0) !== (m.rotX ?? 0)) continue;
                if (eq(om.origin.x, m.origin.x - offX)) li = j;
                else if (eq(om.origin.x, m.origin.x + offX)) ri = j;
              }
              if (li >= 0 && ri >= 0) {
                entries.push({ kind: "pill", rect: m, rounds: [cosmetic[li], cosmetic[ri]] });
                used.add(i); used.add(li); used.add(ri);
                continue;
              }
            }
            entries.push({ kind: "single", m });
            used.add(i);
          }
          return (
            <g key={`cosmetic-${part.id}`}>
              {entries.flatMap((entry, i) => {
                // 取得本 entry 用的 mortise 與 box（pill 用合成 box；single 用本身）
                const m = entry.kind === "pill" ? entry.rect : entry.m;
                const lb = mortiseLocalBox(part, m);
                let r: { x: number; y: number; w: number; h: number };
                const isPill = entry.kind === "pill";
                if (entry.kind === "pill") {
                  // Pill 合成 box：x 半寬 = (handleW)/2 = rect.length/2 + round.length/2
                  // 用 rect mortise 的 lb 做基底、改 hx
                  const handleW = entry.rect.length + entry.rounds[0].length;
                  const pillLb = { ...lb, hx: handleW / 2 };
                  r = projectFeatureRect(part, pillLb, view);
                } else {
                  r = projectFeatureRect(part, lb, view);
                }
                if (r.w < 0.5 || r.h < 0.5) return [];
                const cx = r.x + r.w / 2;
                const cy = -(r.y + r.h) + r.h / 2;
                const rotDeg = m.rotX && view === "front" ? (-m.rotX * 180 / Math.PI) : 0;
                const transform = rotDeg !== 0 ? `rotate(${rotDeg.toFixed(2)} ${cx} ${cy})` : undefined;

                // 斜壁通孔：side/top view 加內面虛線（外實內虛）。
                // 外內偏移在 side view = 0（外/內面 cut 在同 SVG 位置、視覺上覆蓋同一處
                // 用 solid+dashed 區分前後），foreshortening 才是 pill 在 view 真正高度。
                // Pill 在 splayed 壁上 24mm 高，但 side view 看的是 24·cosθ ≈ 17mm（θ=45°）。
                const isThroughTilted = m.through && m.rotX !== undefined && m.rotX !== 0;
                const innerDx = 0;
                const innerDy = 0;
                // 在 side view 對 splayed 通孔的高度套 cosθ foreshortening。
                // 用 SVG group transform 套 scaleY，中心 = pill 中心，避免位置位移。
                let foreshortenScaleY = 1;
                if (isThroughTilted && view === "side") {
                  foreshortenScaleY = Math.cos(Math.abs(m.rotX!));
                }

                const stroke = "#c97a2b";
                const strokeW = 0.6;
                const dashedAttr = "2 1.5";

                // foreshortening：對 splayed pill 在 side view 套 scaleY，繞 pill 中心
                // 縮 cos θ 倍。SVG transform 合併 rotate（front view）+ scale。
                const composeTransform = () => {
                  const parts: string[] = [];
                  if (rotDeg !== 0) parts.push(`rotate(${rotDeg.toFixed(2)} ${cx} ${cy})`);
                  if (foreshortenScaleY !== 1) {
                    // translate to center, scale, translate back（centered scale）
                    parts.push(`translate(${cx} ${cy})`);
                    parts.push(`scale(1 ${foreshortenScaleY.toFixed(4)})`);
                    parts.push(`translate(${-cx} ${-cy})`);
                  }
                  return parts.length > 0 ? parts.join(" ") : undefined;
                };
                const tform = composeTransform();

                // round 孔只在「軸正對視圖」時畫圓（投影矩形接近正方形）；
                // 軸跟視圖平行時（投影成長細條）改畫 silhouette rect = 兩條長邊像
                // 工程圖約定的「通孔上下緣」雙線
                const rAspect = r.w > 0 && r.h > 0 ? Math.min(r.w, r.h) / Math.max(r.w, r.h) : 0;
                const roundAsCircle = !isPill && m.shape === "round" && rAspect >= 0.7;
                const node = (key: string, ox: number, oy: number, dashed: boolean) => {
                  if (roundAsCircle) {
                    return (
                      <circle
                        key={key}
                        cx={cx + ox}
                        cy={cy + oy}
                        r={Math.min(r.w, r.h) / 2}
                        fill="none"
                        stroke={stroke}
                        strokeWidth={strokeW}
                        strokeDasharray={dashed ? dashedAttr : m.through ? undefined : dashedAttr}
                        transform={tform}
                      />
                    );
                  }
                  // Pill 或 rect 或 round-as-silhouette：rect (with rx for pill)
                  const rx = isPill ? Math.min(r.w, r.h) / 2 : 0;
                  return (
                    <rect
                      key={key}
                      x={r.x + ox}
                      y={-(r.y + r.h) + oy}
                      width={r.w}
                      height={r.h}
                      rx={rx}
                      ry={rx}
                      fill="none"
                      stroke={stroke}
                      strokeWidth={strokeW}
                      strokeDasharray={dashed ? dashedAttr : m.through ? undefined : dashedAttr}
                      transform={tform}
                    />
                  );
                };

                const outer = node(`cm-${i}`, 0, 0, !m.through);
                if (!isThroughTilted || (view !== "side" && view !== "top")) {
                  return [outer];
                }
                const inner = node(`cm-${i}-inner`, innerDx, innerDy, true);
                return [outer, inner];
              })}
            </g>
          );
        })}
      </g>

      {/* horizontal dimension below — 加方向 prefix 讓讀者一看就懂
          Front/Top 投影 X 軸 = 寬（length）；Side 投影 X 軸 = 深（width）*/}
      {showDimensions && (
        <DimensionLine
          arrowId={`arr-${view}`}
          x1={-w / 2}
          x2={w / 2}
          y={drawAreaTop + h + 28}
          label={isEn ? `${view === "side" ? "Depth" : "Width"} ${dimMm(w)}` : `${view === "side" ? "深" : "寬"} ${dimMm(w)}`}
        />
      )}

      {/* vertical dimension on right side
          桌椅類（非 cabinet）前/側視圖左側有「桌下淨高 + 桌面厚」等價資訊，跳過；
          頂視圖 + 所有櫃類（cabinet !== null）無左側等價總高標，必顯示
          Front/Side 投影 Y 軸 = 高（thickness）；Top 投影 Y 軸 = 深（width）*/}
      {showDimensions && (() => {
        // 桌椅類（有主面但無底板 = 非櫃）才跳過右側總高標，因左側已有
        // 「桌下淨高 + 桌面厚」等價資訊。
        // 櫃類（cabinet 非 null）只有內高 / 腳高，師傅看不到整件家具
        // 實際總高，必須保留此右側總高標線（解法 C）。
        const dims0 = extractFurnitureDims(renderDesign);
        const hasFlatTopLeftLabel =
          view !== "top" && dims0 !== null && dims0.cabinet === null;
        if (hasFlatTopLeftLabel) return null;
        return (
          <VerticalDimensionLine
            arrowId={`arr-${view}`}
            x={w / 2 + 28}
            y1={view === "top" ? -h / 2 : -h}
            y2={view === "top" ? h / 2 : 0}
            label={isEn ? `${view === "top" ? "Depth" : "Height"} ${dimMm(h)}` : `${view === "top" ? "深" : "高"} ${dimMm(h)}`}
          />
        );
      })()}

      {/* === 額外標線（內部尺寸 + zone 高度鏈 / 桌面厚 + 淨高 / 層板高度）=== */}
      {showDimensions && (() => {
        const dims = extractFurnitureDims(renderDesign);
        if (!dims) return null;
        const {
          main,
          mainT,
          mainBottomY,
          mainTopY,
          mainKind,
          cabinet,
          shelves,
          crossPieces,
          legFootprint,
          legs,
          maxSplayDx,
          maxSplayDz,
        } = dims;
        const sFloor = drawAreaTop + h;

        // ===== 桌椅 / 凳子 / 茶几（無 cabinet 部分）=====
        if (!cabinet) {
          if (view === "top") {
            // 俯視圖：腳粗 + 桌面外伸（4 角到腳外面距離）+ 對角線（檢查方正度）
            if (!legFootprint) return null;
            const { minX, maxX, minZ, maxZ, legSize } = legFootprint;
            const overhangXr = w / 2 - (maxX + legSize / 2);  // 右側外伸
            const overhangXl = -w / 2 - (minX - legSize / 2); // 左側 (負值取 abs)
            const overhangZb = h / 2 - (maxZ + legSize / 2);  // 後側 (z>0)
            const overhangZf = -h / 2 - (minZ - legSize / 2); // 前側 (negative)
            const showOverhang = Math.abs(overhangXr) > 1; // > 1mm 才標
            return (
              <>
                {/* 腳粗 */}
                <text
                  x={minX + legSize / 2 + 4}
                  y={minZ - 4}
                  fontSize={10}
                  fill="#444"
                  fontFamily="sans-serif"
                >
                  {`${isEn ? "Leg " : "腳 "}${useInch ? `${formatLengthBare(legSize, "inch")}×${formatLengthBare(legSize, "inch")}` : `${legSize}×${legSize}`}`}
                </text>
                {/* 桌面外伸——只在右上角標一個（4 邊對稱所以只標 1 處夠用）*/}
                {showOverhang && (
                  <>
                    <DimensionLine
                      arrowId={`arr-${view}`}
                      x1={maxX + legSize / 2}
                      x2={w / 2}
                      y={-h / 2 - 16}
                      label={isEn ? `Overhang ${dimMm(overhangXr)}` : `外伸 ${dimMm(overhangXr)}`}
                    />
                    <VerticalDimensionLine
                      arrowId={`arr-${view}`}
                      x={w / 2 + 16}
                      y1={maxZ + legSize / 2}
                      y2={h / 2}
                      label={isEn ? `Overhang ${dimMm(overhangZb)}` : `外伸 ${dimMm(overhangZb)}`}
                    />
                  </>
                )}
                {/* splayed 俯視中間分割：左半 = 詳細（含多 Y 腳框 + 落地超出 +
                    對角線），右半 = 椅面簡化（只保留椅面 outline + 圓角 + 尺寸 +
                    腳頂 + 外伸）。中間垂直虛線 + 兩側小標。 */}
                {(maxSplayDx > 0 || maxSplayDz > 0) && (
                  <g>
                    <line
                      x1={0}
                      y1={-h / 2 - 6}
                      x2={0}
                      y2={h / 2 + 6}
                      stroke="#bbb"
                      strokeWidth={0.5}
                      strokeDasharray="6 3"
                    />
                    <text
                      x={-w / 4}
                      y={-h / 2 - 50}
                      fontSize={10}
                      fontFamily="sans-serif"
                      fill="#a55"
                      textAnchor="middle"
                    >
                      詳細
                    </text>
                    <text
                      x={w / 4}
                      y={-h / 2 - 50}
                      fontSize={10}
                      fontFamily="sans-serif"
                      fill="#888"
                      textAnchor="middle"
                    >
                      簡化
                    </text>
                  </g>
                )}
                {/* 外斜腳：每個橫撐的上下緣 Y 跟落地 Y 都畫一圈腳框
                    （4 隻腳每個 Y 都畫 legSize×legSize），讓師傅看到腳在不同高度的位置。
                    深紅 = 落地 Y（最重要）；淺紅 = 橫撐接腳 Y

                    詳細內容 clip 到 x<0 左半，clipPath 在 SVG defs 設好。*/}
                {(maxSplayDx > 0 || maxSplayDz > 0) && (() => {
                  // 落地 Y + 牙板 Y 用深紅；下橫撐 (ls-) Y 用深藍，跟牙板分得開
                  const footColor = "#c63d3d";
                  const stretcherColor = "#c63d3d";
                  const lowerStretcherColor = "#1e3a8a";
                  const footProtrudeX = maxX + maxSplayDx + legSize / 2 - w / 2;
                  const footProtrudeZ = maxZ + maxSplayDz + legSize / 2 - h / 2;
                  const protrudeLabel = (mm: number) =>
                    isEn
                      ? (mm > 0 ? `Footprint past seat ${dimMm(mm)}` : `Foot inset ${dimMm(-mm)}`)
                      : (mm > 0 ? `落地超出椅面 ${dimMm(mm)}` : `落地內縮 ${dimMm(-mm)}`);
                  return (
                    <g clipPath={`url(#leftHalf-${view})`}>
                      {/* 橫撐上下緣 Y 的腳框（淺紅）+ 落地點腳框（深紅）
                          每隻腳依 splay 物理在每個 Y 算位置：
                          legX(Y) = origin.x + dxMm * (1 − Y / legHeight)
                          dedupe by Y——4 個 stretcher 同 Y 只畫一次（避免 React key 衝突 */}
                      {(() => {
                        const sample = legs[0];
                        const legHeight = sample.visible.thickness;
                        const yMap = new Map<number, string>();
                        // 牙板先寫（紅），下橫撐後寫蓋過去（藍）——這樣同 Y 時藍勝出
                        const sortedPieces = [...crossPieces].sort(
                          (a, b) => Number(/^ls-/.test(a.id)) - Number(/^ls-/.test(b.id)),
                        );
                        for (const c of sortedPieces) {
                          const color = /^ls-/.test(c.id) ? lowerStretcherColor : stretcherColor;
                          const yb = Math.round(c.bottomY);
                          const yt = Math.round(c.topY);
                          yMap.set(yb, color);
                          yMap.set(yt, color);
                        }
                        yMap.set(0, footColor); // 落地（覆蓋同 Y stretcher 的話以落地為主）
                        const ys = [...yMap.entries()].map(([y, color]) => ({ y, color }));
                        // 4 隻腳 × N 個 Y → 同 Y 同腳的框
                        return legs.flatMap((leg) => {
                          const sh = leg.shape;
                          const dx = sh?.kind === "splayed" || sh?.kind === "splayed-tapered" || sh?.kind === "splayed-round-tapered"
                            ? sh.dxMm : 0;
                          const dz = sh?.kind === "splayed" || sh?.kind === "splayed-tapered" || sh?.kind === "splayed-round-tapered"
                            ? sh.dzMm : 0;
                          if (dx === 0 && dz === 0) return [];
                          return ys.map(({ y, color }) => {
                            // 腳越下面外推越多：shift = (1 − y/legHeight)
                            const shift = legHeight > 0 ? 1 - y / legHeight : 0;
                            const cx = leg.origin.x + dx * shift;
                            const cz = leg.origin.z + dz * shift;
                            return (
                              <rect
                                key={`leg-${leg.id}-y${Math.round(y)}`}
                                x={cx - legSize / 2}
                                y={cz - legSize / 2}
                                width={legSize}
                                height={legSize}
                                fill="none"
                                stroke={color}
                                strokeWidth={0.4}
                                strokeDasharray="2 3"
                              />
                            );
                          });
                        });
                      })()}
                      {maxSplayDx > 0 && Math.abs(footProtrudeX) > 0.5 && (
                        <DimensionLine
                          arrowId={`arr-${view}`}
                          x1={Math.min(w / 2, maxX + maxSplayDx + legSize / 2)}
                          x2={Math.max(w / 2, maxX + maxSplayDx + legSize / 2)}
                          y={-h / 2 - 32}
                          label={protrudeLabel(footProtrudeX)}
                        />
                      )}
                      {maxSplayDz > 0 && Math.abs(footProtrudeZ) > 0.5 && (
                        <VerticalDimensionLine
                          arrowId={`arr-${view}`}
                          x={w / 2 + 32}
                          y1={Math.min(h / 2, maxZ + maxSplayDz + legSize / 2)}
                          y2={Math.max(h / 2, maxZ + maxSplayDz + legSize / 2)}
                          label={protrudeLabel(footProtrudeZ)}
                        />
                      )}
                    </g>
                  );
                })()}
              </>
            );
          }
          // front / side：主面厚 + 淨高 + 座面高 + 層板 + 橫撐 / 牙板 / 椅背
          const labelMain = isEn
            ? (mainKind === "seat" ? "Seat" : "Top")
            : (mainKind === "seat" ? "座板" : "桌面");
          const labelClear = isEn
            ? (mainKind === "seat" ? "Under-seat" : "Under-top clear")
            : (mainKind === "seat" ? "座下高" : "桌下淨高");
          // 把所有「會疊在左側的高度標線」整合：座面高 + 層板 + cross-pieces
          const leftStack: { y: number; label: string }[] = [];
          if (mainKind === "seat") {
            leftStack.push({
              y: mainTopY,
              label: isEn ? `Seat ${dimMm(mainTopY)}` : `座面 ${dimMm(mainTopY)}`,
            });
          }
          for (const s of shelves) {
            leftStack.push({
              y: s.topY,
              label: `${partName(s, locale)} ${dimMm(s.topY)}`,
            });
          }
          for (const c of crossPieces) {
            leftStack.push({
              y: c.topY,
              label: `${partName(c, locale)} ${dimMm(c.topY)}`,
            });
          }
          // 排序去重（同 Y 只留一個）
          const seen = new Set<number>();
          const dedupedStackBase = leftStack
            .sort((a, b) => a.y - b.y)
            .filter((it) => {
              const key = Math.round(it.y);
              if (seen.has(key)) return false;
              seen.add(key);
              return true;
            });
          // labelY 防撞：兩筆 topY 太近時把後面那筆往下推一格（避免「左牙板 416/
          // 前牙板 400」「左下橫撐 170/前下橫撐 170」label 撞字 user 2026-05-21 回報）。
          // 處理順序由螢幕上往下（worldY 大→小、SVG y 小→大）：算出每筆「不要
          // 撞到前一筆」的 labelY，再以原本的 column index 順序（i = ascending y）
          // 套回去渲染。
          const MIN_GAP = 18; // SVG mm，約一行字高
          const labelYMap = new Map<number, number>();
          {
            const topDown = [...dedupedStackBase].sort((a, b) => b.y - a.y);
            let prevLabelY = -Infinity;
            for (const it of topDown) {
              const desired = -it.y;
              const effective = desired < prevLabelY + MIN_GAP
                ? prevLabelY + MIN_GAP
                : desired;
              prevLabelY = effective;
              labelYMap.set(Math.round(it.y), effective);
            }
          }
          const dedupedStack = dedupedStackBase.map((it) => ({
            ...it,
            labelY: labelYMap.get(Math.round(it.y)) ?? -it.y,
          }));
          return (
            <>
              {/* 主面厚 */}
              <VerticalDimensionLine
                arrowId={`arr-${view}`}
                x={w / 2 + 96}
                y1={-mainTopY}
                y2={-mainBottomY}
                label={`${labelMain} ${dimMm(mainT)}`}
              />
              {/* 淨高 */}
              <VerticalDimensionLine
                arrowId={`arr-${view}`}
                x={w / 2 + 140}
                y1={-mainBottomY}
                y2={sFloor}
                label={`${labelClear} ${dimMm(mainBottomY)}`}
              />
              {/* cross-pieces 厚度（橫撐 / 牙板 / 椅背）— 同名 + 同尺寸去重只標一次
                  名稱去掉「前/後/左/右」前綴避免重複（4 個都同樣是「牙板 60」）
                  ⚠ 不用 bottomY 當 dedup key：apronStaggerMm > 0 時 X 軸牙板與
                     Z 軸牙板坐在不同 Y、bottomY 不同，key 不同會疊兩個「牙板 85」 */}
              {(() => {
                const bare = (n: string) => n.replace(/^(前|後|左|右)/, "");
                const seen = new Map<string, typeof crossPieces[0]>();
                for (const c of crossPieces) {
                  const key = `${bare(c.nameZh)}_${Math.round(c.yExt)}`;
                  if (!seen.has(key)) seen.set(key, c);
                }
                return [...seen.values()].map((c) => {
                  // 側視圖：arch-bent 件（bow）往 +Z 凸出 bendMm。
                  // 前=右慣例下 +Z 投影到 SVG -x（左），bow 往 SVG 左凸 →
                  // 右側標籤不再與 silhouette 重疊；archShift 取 0。
                  // 若未來有 -Z（前）方向 bend，外推應為 |bendMm|（往左閃避）。
                  const archShift = 0;
                  void c.archBendMm;
                  return (
                    <text
                      key={`xp-thick-${c.id}`}
                      x={w / 2 + 4 + archShift}
                      y={-(c.bottomY + c.yExt / 2) + 4}
                      fontSize={10}
                      fill="#444"
                      fontFamily="sans-serif"
                    >
                      {bare(isEn ? (partName(c, locale) ?? c.nameZh) : c.nameZh)} {dimMm(c.yExt)}
                    </text>
                  );
                });
              })()}
              {/* 橫撐長度標——所有橫撐都標 L（拉箭頭），梯形多標 ∠
                  按視圖軸過濾：front 顯示 X 軸（前/後）、side 顯示 Z 軸（左/右） */}
              {(() => {
                const seenLen = new Map<string, typeof crossPieces[0]>();
                for (const c of crossPieces) {
                  if (view === "front" && c.isZAxis) continue;
                  if (view === "side" && !c.isZAxis) continue;
                  const key = `${Math.round(c.bottomY)}_${Math.round(c.cutLengthMm)}`;
                  if (!seenLen.has(key)) seenLen.set(key, c);
                }
                const bare = (n: string) => n.replace(/^(前|後|左|右)/, "");
                return [...seenLen.values()].map((c) => {
                  const halfL = c.cutLengthMm / 2;
                  const yLine = -c.bottomY + 12;
                  const showAngle = c.cutAngleDeg > 0.05;
                  return (
                    <g key={`xp-len-${c.id}`} stroke="#a55" fill="#a55" strokeWidth={0.5} fontFamily="sans-serif">
                      <line x1={-halfL} y1={yLine} x2={halfL} y2={yLine}
                        markerStart={`url(#arr-${view})`} markerEnd={`url(#arr-${view})`} />
                      <text x={0} y={yLine + 11} textAnchor="middle" fontSize={9} stroke="none">
                        {bare(isEn ? (partName(c, locale) ?? c.nameZh) : c.nameZh)}{" "}
                        {c.trapTopMm != null &&
                        c.trapBotMm != null &&
                        Math.abs(c.trapBotMm - c.trapTopMm) > 0.5
                          ? isEn
                            ? `top ${dimMm1(c.trapTopMm)} / btm ${dimMm1(c.trapBotMm)}`
                            : `上 ${dimMm1(c.trapTopMm)} 下 ${dimMm1(c.trapBotMm)}`
                          : `${isEn ? "net" : "淨長"} ${dimMm(c.cutLengthMm)}`}
                        {showAngle ? (isEn ? ` bevel ∠${c.cutAngleDeg.toFixed(1)}°` : ` 切角 ∠${c.cutAngleDeg.toFixed(1)}°`) : ""}
                      </text>
                    </g>
                  );
                });
              })()}
              {/* 左側高度堆疊 */}
              {dedupedStack.map((it, i) => (
                <VerticalDimensionLine
                  key={`stack-${i}`}
                  arrowId={`arr-${view}`}
                  x={-w / 2 - 36 - i * 44}
                  y1={-it.y}
                  y2={sFloor}
                  label={it.label}
                  // 標籤位置：基準是各自 topY、但同 Y 或太近的會被算好錯位推下去
                  labelY={it.labelY}
                />
              ))}
            </>
          );
        }

        // ===== 櫃體 =====
        const { panelT, innerW, innerH, innerD, bottomTopY, topBottomY, legHeight } =
          cabinet;
        // 由下面延用原本的櫃體 dims
        if (view === "front") {
          // SVG 座標：y 軸向下，OrthoView 內部 y = -worldY，drawAreaTop 對應櫃頂
          // 頂板下緣螢幕 Y = -topBottomY，底板上緣螢幕 Y = -bottomTopY
          const sBottom = -bottomTopY;
          const sTop = -topBottomY;
          const sLegBottom = -legHeight; // 底板下緣（= 腳頂）
          const sFloor = drawAreaTop + h; // 螢幕地面 Y
          // 內寬：上方 dim line（畫在頂板下緣再往下一點，內側 W）
          // zone 高度鏈：從 bottomTopY 往上每片 boundary，左側堆疊
          const boundaryYs = extractZoneBoundaryYs(renderDesign);
          const zoneSegments: { y1: number; y2: number; label: string }[] = [];
          let prevY = bottomTopY;
          for (const by of boundaryYs) {
            zoneSegments.push({ y1: -prevY, y2: -by, label: dimMm(by - prevY) });
            prevY = by + panelT; // 下一段從 boundary 上緣開始
          }
          zoneSegments.push({
            y1: -prevY,
            y2: -topBottomY,
            label: dimMm(topBottomY - prevY),
          });

          return (
            <>
              {/* 內寬 — 在外寬下方再加一條（位置往下偏 22px） */}
              <DimensionLine
                arrowId={`arr-${view}`}
                x1={-w / 2 + panelT}
                x2={w / 2 - panelT}
                y={drawAreaTop + h + 80}
                label={isEn ? `Inner ${dimMm(innerW)}` : `內 ${dimMm(innerW)}`}
              />
              {/* 內高 — 在右側外高內側再加一條（往內偏 32px） */}
              <VerticalDimensionLine
                arrowId={`arr-${view}`}
                x={w / 2 + 96}
                y1={sTop}
                y2={sBottom}
                label={isEn ? `Inner ${dimMm(innerH)}` : `內 ${dimMm(innerH)}`}
              />
              {/* 腳高 — 右側更靠內，從底板下緣到地面 */}
              {legHeight > 0 && (
                <VerticalDimensionLine
                  arrowId={`arr-${view}`}
                  x={w / 2 + 140}
                  y1={sLegBottom}
                  y2={sFloor}
                  label={isEn ? `Leg ${dimMm(legHeight)}` : `腳 ${dimMm(legHeight)}`}
                />
              )}
              {/* zone 高度鏈 — 左側堆疊 */}
              {zoneSegments.length > 1 && zoneSegments.map((seg, i) => (
                <VerticalDimensionLine
                  key={`zone-${i}`}
                  arrowId={`arr-${view}`}
                  x={-w / 2 - 28}
                  y1={seg.y1}
                  y2={seg.y2}
                  label={seg.label}
                />
              ))}
              {/* 板厚標註：頂板 + 底板（小字 + 引線） */}
              <g fontFamily="sans-serif" fill="#444" fontSize={10}>
                <text x={w / 2 + 4} y={-topBottomY - panelT / 2 - 2} textAnchor="start">
                  {isEn ? "Top" : "頂板"} {dimMm(panelT)}
                </text>
                <text x={w / 2 + 4} y={-bottomTopY + panelT / 2 + 8} textAnchor="start">
                  {isEn ? "Bottom" : "底板"} {dimMm(panelT)}
                </text>
              </g>
              {/* 紅酒架格子尺寸：只在「左下第一格」標一次，全部格子尺寸都相同。
                  Rect = 直接標 cellSize × cellSize pitch；
                  Diamond = 標內接圓直徑（瓶子實際能塞多大、≈ cellSize/√2 − panelT，
                  比方格小約 30%，跟 pitch 完全不同）。 */}
              {(() => {
                if (renderDesign.category !== "wine-rack") return null;
                const m = renderDesign.notes?.match(/每瓶位\s*(\d+(?:\.\d+)?)\s*×/);
                if (!m) return null;
                const cellSize = parseFloat(m[1]);
                if (cellSize <= 0) return null;
                const isDiamond = renderDesign.parts.some((p) =>
                  p.id.startsWith("diamond-"),
                );
                const cellCx = -w / 2 + panelT + cellSize / 2;
                // 菱形 layout 在左下角是半菱形（被框邊切掉），標籤往上推 1 row
                // 落在第 2 列完整菱形/邊界節點之間的空白處，避免壓到對角線。
                const rowOffset = isDiamond ? cellSize * 1.5 : cellSize / 2;
                const cellCy = -(bottomTopY + rowOffset);
                if (isDiamond) {
                  const inscribed = Math.round(cellSize / Math.SQRT2 - panelT);
                  if (inscribed <= 0) return null;
                  return (
                    <g fontFamily="sans-serif" pointerEvents="none">
                      <text
                        x={cellCx}
                        y={cellCy - 2}
                        textAnchor="middle"
                        fontSize={11}
                        fill="#7a5a2b"
                        fontWeight="600"
                      >
                        {isEn ? "Diamond" : "菱形"} Ø{dimMm(inscribed)}
                      </text>
                      <text
                        x={cellCx}
                        y={cellCy + 11}
                        textAnchor="middle"
                        fontSize={9}
                        fill="#7a5a2b"
                      >
                        內接圓
                      </text>
                    </g>
                  );
                }
                const rectNet = Math.round(cellSize - panelT);
                return (
                  <g fontFamily="sans-serif" pointerEvents="none">
                    <text
                      x={cellCx}
                      y={cellCy - 2}
                      textAnchor="middle"
                      fontSize={11}
                      fill="#7a5a2b"
                      fontWeight="600"
                    >
                      {isEn ? "Cell" : "格"} {dimMm(rectNet)}×{dimMm(rectNet)}
                    </text>
                    <text
                      x={cellCx}
                      y={cellCy + 11}
                      textAnchor="middle"
                      fontSize={9}
                      fill="#7a5a2b"
                    >
                      淨寬
                    </text>
                  </g>
                );
              })()}
            </>
          );
        }
        if (view === "side") {
          return (
            <>
              {/* 內深 — 外深下方再加一條 */}
              <DimensionLine
                arrowId={`arr-${view}`}
                x1={-w / 2}
                x2={-w / 2 + innerD}
                y={drawAreaTop + h + 80}
                label={isEn ? `Inner depth ${dimMm(innerD)}` : `內深 ${dimMm(innerD)}`}
              />
              {/* 內高 — 右側內側多一條 */}
              <VerticalDimensionLine
                arrowId={`arr-${view}`}
                x={w / 2 + 96}
                y1={-topBottomY}
                y2={-bottomTopY}
                label={isEn ? `Inner ${dimMm(innerH)}` : `內 ${dimMm(innerH)}`}
              />
              {legHeight > 0 && (
                <VerticalDimensionLine
                  arrowId={`arr-${view}`}
                  x={w / 2 + 140}
                  y1={-legHeight}
                  y2={drawAreaTop + h}
                  label={isEn ? `Leg ${dimMm(legHeight)}` : `腳 ${dimMm(legHeight)}`}
                />
              )}
            </>
          );
        }
        if (view === "top") {
          // top view: x 軸 = 櫃寬（length），y 軸 = 櫃深（width / depth）
          // h = overall.width；drawAreaTop = -h/2
          return (
            <>
              {/* 內寬 — 下方再加一條 */}
              <DimensionLine
                arrowId={`arr-${view}`}
                x1={-w / 2 + panelT}
                x2={w / 2 - panelT}
                y={drawAreaTop + h + 80}
                label={isEn ? `Inner ${dimMm(innerW)}` : `內 ${dimMm(innerW)}`}
              />
              {/* 內深 — 右側內側 */}
              <VerticalDimensionLine
                arrowId={`arr-${view}`}
                x={w / 2 + 96}
                y1={-h / 2}
                y2={-h / 2 + innerD}
                label={isEn ? `Inner depth ${dimMm(innerD)}` : `內深 ${dimMm(innerD)}`}
              />
            </>
          );
        }
        return null;
      })()}

      {/* Orientation marker: the TOP view shows the furniture from above, so
          label which edge is the FRONT face (−Z in world) and which is BACK.
          Helps readers orient since top-view alone is ambiguous. */}
      {showDimensions && view === "top" && (
        <g fontFamily="sans-serif" fill="#666" fontSize={11}>
          <text
            x={0}
            y={drawAreaTop - 6}
            textAnchor="middle"
          >
            {isEn ? "BACK" : "後 BACK"}
          </text>
          <text
            x={0}
            y={drawAreaTop + h + 110}
            textAnchor="middle"
          >
            {isEn ? "FRONT" : "前 FRONT"}
          </text>
        </g>
      )}

      {/* 比例尺：100mm 參考棒（per drafting-math.md §A3）
          位於圖框左下角，給讀者一個視覺基準快速估其他尺寸。
          paperMode 時 scale bar 已由 title block 表達，跳過。 */}
      {showDimensions && !isPaper && (
        <g fontFamily="sans-serif" fill="#666" stroke="#666" strokeWidth={0.3}>
          {(() => {
            const sx = frameX + 14;
            const sy = frameY + frameH - 14;
            const barLen = 100; // mm in SVG units (since viewBox is mm-based)
            return (
              <>
                {/* 主棒 */}
                <line x1={sx} y1={sy} x2={sx + barLen} y2={sy} strokeWidth={0.6} />
                {/* 兩端 + 中央 tick */}
                <line x1={sx} y1={sy - 4} x2={sx} y2={sy + 4} strokeWidth={0.6} />
                <line x1={sx + barLen / 2} y1={sy - 3} x2={sx + barLen / 2} y2={sy + 3} strokeWidth={0.4} />
                <line x1={sx + barLen} y1={sy - 4} x2={sx + barLen} y2={sy + 4} strokeWidth={0.6} />
                <text x={sx + barLen / 2} y={sy + 14} textAnchor="middle" fontSize={9} stroke="none" fill="#666">
                  100 mm
                </text>
              </>
            );
          })()}
        </g>
      )}

      {/* Phase 2: overlay slot — caller-controlled SVG over OrthoView. */}
      {overlayCtx && overlayContent && overlayContent(overlayCtx)}

      {/* Broken view（Step 3）：超長件中段省略 — 用白色遮中段 silhouette + 兩條
          波浪線標示中斷邊界。不真 clipPath 切 silhouette（複雜），但視覺上能
          看出「中段省略 → 真實全長」這件事。 */}
      {isPaper && paperBroken?.active && (() => {
        const spec = paperBroken;
        // 中段 gap 區（part-world mm，y 用 silhouette 慣例負 y）
        const gapMinX = spec.leftHi;
        const gapMaxX = spec.rightLo;
        const vert = spec.vertHeight;
        // y range：silhouette 用 -y 慣例，從 -vert 到 +vert/2 取保險寬一點
        const yTop = -vert * 0.65;
        const yBot = vert * 0.65;
        return (
          <g className="broken-view">
            {/* 白遮罩：把中段 silhouette 蓋掉 */}
            <rect
              x={gapMinX}
              y={yTop}
              width={gapMaxX - gapMinX}
              height={yBot - yTop}
              fill="white"
            />
            {/* 兩條波浪線 — 因 scaled group 有 1/n scale，stroke-width 要 × n 才會
                顯示成設計的 0.4mm 紙上寬度 */}
            <path
              d={(() => {
                const amp = 1.5 * paperScaleN; // 振幅按 scale 補回
                const seg = 4 * paperScaleN;
                const n = Math.max(2, Math.ceil((yBot - yTop) / seg));
                let d = `M ${gapMinX} ${yTop}`;
                for (let i = 0; i < n; i++) {
                  const yMid = yTop + (i + 0.5) * ((yBot - yTop) / n);
                  const yEnd = yTop + (i + 1) * ((yBot - yTop) / n);
                  const dir = i % 2 === 0 ? +1 : -1;
                  d += ` Q ${gapMinX + dir * amp} ${yMid} ${gapMinX} ${yEnd}`;
                }
                return d;
              })()}
              stroke="#222"
              strokeWidth={0.4 * paperScaleN}
              fill="none"
            />
            <path
              d={(() => {
                const amp = 1.5 * paperScaleN;
                const seg = 4 * paperScaleN;
                const n = Math.max(2, Math.ceil((yBot - yTop) / seg));
                let d = `M ${gapMaxX} ${yTop}`;
                for (let i = 0; i < n; i++) {
                  const yMid = yTop + (i + 0.5) * ((yBot - yTop) / n);
                  const yEnd = yTop + (i + 1) * ((yBot - yTop) / n);
                  const dir = i % 2 === 0 ? +1 : -1;
                  d += ` Q ${gapMaxX + dir * amp} ${yMid} ${gapMaxX} ${yEnd}`;
                }
                return d;
              })()}
              stroke="#222"
              strokeWidth={0.4 * paperScaleN}
              fill="none"
            />
            {/* 中段標真實全長 */}
            <text
              x={(gapMinX + gapMaxX) / 2}
              y={yBot + 6 * paperScaleN}
              fontSize={4 * paperScaleN}
              fill="#444"
              textAnchor="middle"
            >
              真實全長 {Math.round(spec.fullLength)}mm
            </text>
          </g>
        );
      })()}

      </g>
    </Wrapper>
  );
}

// memo wrap：父層（ZoomableThreeViews / ThreeViewLayout / PartDrawing）有自己的
// scale/scroll state，每次互動都會 re-render。OrthoView 內含 projectPart、
// sortPartsByDepth、Sutherland-Hodgman polygon clipping，O(n²) 級別重算。
// design 物件由 server component 產生、reference 在 client 端穩定 → 預設 shallow
// 比較就能跳過大量無謂重算。
export const OrthoView = memo(OrthoViewImpl);

export function DimensionLine({
  x1,
  x2,
  y,
  label,
  arrowId,
}: {
  x1: number;
  x2: number;
  y: number;
  label: string;
  arrowId: string;
}) {
  const ext = 2; // 越過 dim line 2 (per CNS 2-3mm)
  const reach = 26; // 從 dim line 往 bbox 方向延伸 26（典型 dim 距 bbox 28，剩 2 mm 為 CNS gap）
  // CNS 線寬分層：標註線 0.4（細），延伸線 0.25（更細），輪廓另由 part rendering 0.6+
  return (
    <g stroke="#111" fill="#111" strokeWidth={0.4} fontFamily="sans-serif">
      {/* extension lines — 從 bbox 邊（離 1-2mm gap）拉到 dim line 過去 2mm */}
      <line x1={x1} y1={y - reach} x2={x1} y2={y + ext} strokeWidth={0.25} stroke="#888" />
      <line x1={x2} y1={y - reach} x2={x2} y2={y + ext} strokeWidth={0.25} stroke="#888" />
      {/* dim line with arrows at both ends */}
      <line
        x1={x1}
        y1={y}
        x2={x2}
        y2={y}
        markerStart={`url(#${arrowId})`}
        markerEnd={`url(#${arrowId})`}
      />
      <text
        x={(x1 + x2) / 2}
        y={y - 5}
        textAnchor="middle"
        fontSize={13}
        fontWeight="600"
        stroke="none"
      >
        {label}
      </text>
    </g>
  );
}

export function VerticalDimensionLine({
  x,
  y1,
  y2,
  label,
  arrowId,
  labelY,
}: {
  x: number;
  y1: number;
  y2: number;
  label: string;
  arrowId: string;
  /** 自訂標籤垂直位置（SVG 座標）；不傳則用 (y1+y2)/2。
   *  左側高度堆疊用 labelY = y1 讓每筆貼著自己的 topY，
   *  416 vs 400 兩個 staggered 牙板自然錯開不疊字。 */
  labelY?: number;
}) {
  const ext = 2; // 越過 dim line 2 (per CNS 2-3mm)
  const reach = 26; // 從 dim line 往 bbox 方向延伸 26（典型 dim 距 bbox 28，剩 2 mm 為 CNS gap）
  // bbox 通常跨 0；x>0 代表 dim 在 bbox 右側（朝 -x 方向延伸到 bbox），x<0 反之
  const towardBbox = x >= 0 ? -reach : reach;
  const pastDim = x >= 0 ? ext : -ext;
  return (
    <g stroke="#111" fill="#111" strokeWidth={0.4} fontFamily="sans-serif">
      <line x1={x + towardBbox} y1={y1} x2={x + pastDim} y2={y1} strokeWidth={0.25} stroke="#888" />
      <line x1={x + towardBbox} y1={y2} x2={x + pastDim} y2={y2} strokeWidth={0.25} stroke="#888" />
      <line
        x1={x}
        y1={y1}
        x2={x}
        y2={y2}
        markerStart={`url(#${arrowId})`}
        markerEnd={`url(#${arrowId})`}
      />
      <text
        x={x >= 0 ? x + 6 : x - 6}
        y={labelY ?? (y1 + y2) / 2}
        textAnchor={x >= 0 ? "start" : "end"}
        dominantBaseline="middle"
        fontSize={13}
        fontWeight="600"
        stroke="none"
      >
        {label}
      </text>
    </g>
  );
}

export function ThreeViewLayout({
  design,
  joineryMode = false,
  locale = "zh-TW",
  unit,
}: {
  design: FurnitureDesign;
  joineryMode?: boolean;
  locale?: string;
  unit?: "mm" | "inch";
}) {
  const isEn = locale === "en";
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="border border-zinc-200 rounded-lg overflow-hidden bg-white shadow-sm">
        <OrthoView design={design} view="front" title={isEn ? "FRONT VIEW" : "正視圖"} titleEn={isEn ? "" : "FRONT VIEW"} joineryMode={joineryMode} locale={locale} unit={unit} />
      </div>
      <div className="border border-zinc-200 rounded-lg overflow-hidden bg-white shadow-sm">
        <OrthoView design={design} view="side" title={isEn ? "SIDE VIEW" : "側視圖"} titleEn={isEn ? "" : "SIDE VIEW"} joineryMode={joineryMode} locale={locale} unit={unit} />
      </div>
      <div className="border border-zinc-200 rounded-lg overflow-hidden bg-white shadow-sm">
        <OrthoView design={design} view="top" title={isEn ? "TOP VIEW" : "俯視圖"} titleEn={isEn ? "" : "TOP VIEW"} joineryMode={joineryMode} locale={locale} unit={unit} />
      </div>
    </div>
  );
}

/**
 * Compact three-view strip — 3 views side-by-side 固定小尺寸，給 A4 報價單用。
 * 每個 view 最大高度 ~28mm，3 個總寬度 ~70mm，可放進文件抬頭不佔太多版面。
 */
export function CompactThreeViews({ design, locale = "zh-TW" }: { design: FurnitureDesign; locale?: string }) {
  const isEn = locale === "en";
  return (
    <div className="flex gap-2 compact-three-views">
      <div className="flex-1 border border-zinc-300 rounded overflow-hidden bg-white">
        <OrthoView design={design} view="front" title={isEn ? "FRONT" : "正視圖"} titleEn={isEn ? "" : "FRONT"} locale={locale} />
      </div>
      <div className="flex-1 border border-zinc-300 rounded overflow-hidden bg-white">
        <OrthoView design={design} view="side" title={isEn ? "SIDE" : "側視圖"} titleEn={isEn ? "" : "SIDE"} locale={locale} />
      </div>
      <div className="flex-1 border border-zinc-300 rounded overflow-hidden bg-white">
        <OrthoView design={design} view="top" title={isEn ? "TOP" : "俯視圖"} titleEn={isEn ? "" : "TOP"} locale={locale} />
      </div>
    </div>
  );
}

// 零件分類——用 id 前綴判斷屬於哪個結構分組，方便材料單視覺切分。
// 邏輯在 lib/render/categorize-part.ts（server-safe），這裡只做 re-export。
import { categorizePart } from "./categorize-part";
import type { PartCategory } from "./categorize-part";
export { categorizePart };
export type { PartCategory };

const CATEGORY_ORDER: PartCategory[] = [
  "case", "divider", "drawer", "door", "apron", "seat", "leg", "misc",
];

const CATEGORY_LABEL_ZH: Record<PartCategory, string> = {
  case: "🗄️ 櫃體結構",
  divider: "═ 層板 / 分隔板",
  drawer: "🧺 抽屜",
  door: "🚪 門",
  apron: "━ 牙板",
  seat: "🪑 座板 / 椅背",
  leg: "🦵 腳 / 底座",
  misc: "⚙ 其他",
};

const CATEGORY_LABEL_EN: Record<PartCategory, string> = {
  case: "🗄️ Carcase",
  divider: "═ Shelves / Dividers",
  drawer: "🧺 Drawers",
  door: "🚪 Doors",
  apron: "━ Aprons",
  seat: "🪑 Seat / Back",
  leg: "🦵 Legs / Base",
  misc: "⚙ Other",
};

// 色碼分組：每個分類一個顯眼色，左側 4px 直條 + 標頭背景。
// 木工現場掃讀用，顏色選相近自然色（避免螢光色）。
const CATEGORY_COLOR: Record<
  PartCategory,
  { bar: string; head: string; text: string }
> = {
  case:    { bar: "bg-amber-500",   head: "bg-amber-50",   text: "text-amber-900"   },
  divider: { bar: "bg-orange-400",  head: "bg-orange-50",  text: "text-orange-900"  },
  drawer:  { bar: "bg-rose-400",    head: "bg-rose-50",    text: "text-rose-900"    },
  door:    { bar: "bg-fuchsia-400", head: "bg-fuchsia-50", text: "text-fuchsia-900" },
  apron:   { bar: "bg-lime-500",    head: "bg-lime-50",    text: "text-lime-900"    },
  seat:    { bar: "bg-emerald-500", head: "bg-emerald-50", text: "text-emerald-900" },
  leg:     { bar: "bg-sky-500",     head: "bg-sky-50",     text: "text-sky-900"     },
  misc:    { bar: "bg-zinc-400",    head: "bg-zinc-50",    text: "text-zinc-700"    },
};

export function MaterialList({
  design,
  selectedPartId,
  onPartClick,
  locale = "zh-TW",
  unit,
}: {
  design: FurnitureDesign;
  selectedPartId?: string | null;
  onPartClick?: (id: string) => void;
  locale?: string;
  unit?: "mm" | "inch";
}) {
  const isEn = locale === "en";
  const effectiveUnit: "mm" | "inch" = unit ?? (isEn ? "inch" : "mm");
  const CATEGORY_LABEL = isEn ? CATEGORY_LABEL_EN : CATEGORY_LABEL_ZH;
  let totalBdft = 0;
  const bdftByMaterial = new Map<string, number>();

  /**
   * 顯示用尺寸：將長/寬/厚依數值降冪排序輸出（最長→次長→最薄）。
   * 因為背板等零件 visible 欄位命名取自幾何軸而非木工語意，
   * length=innerW / width=backT / thickness=innerH 看起來會是 760×8×1460，
   * 直覺上應該是 1460×760×8（長寬厚）。統一排序讓使用者認材快速。
   */
  const sortDimsDesc = (l: number, w: number, t: number): [number, number, number] => {
    const arr = [l, w, t].sort((a, b) => b - a);
    return [arr[0], arr[1], arr[2]];
  };
  // 顯示尺寸時最多保留 1 位小數，整數就不顯示「.0」。
  // 木工現場 0.1mm 已是極限，130.66666666 這種沒意義反而難讀。
  // EN locale → 1/16" 分數（38mm → 1-1/2、19mm → 3/4），對應北美/英國木工慣例。
  const fmt = (n: number): string => formatLengthBare(n, effectiveUnit);

  const rows = design.parts.map((part) => {
    const cut = calculateCutDimensions(part);
    const isGlass = part.visual === "glass";
    const isBrass = part.visual === "brass-antique";
    const isHardware = isGlass || isBrass;
    // bdft 體積：bbox × thickness 是預設；對非方形截面（regular-polygon / round）改用實際面積。
    // 注意：cut 尺寸仍維持 bbox（下料需要方板），只是 bdft 計算用實際截面積避免高估。
    let crossSectionFactor = 1;
    if (part.shape?.kind === "regular-polygon") {
      const n = Math.max(3, part.shape.sides);
      // 正多邊形面積 / bbox 面積。bbox = 2R × 2R = 4R²；polygon area = (n/2)R²sin(2π/n)
      crossSectionFactor = (n / 8) * Math.sin((2 * Math.PI) / n);
    } else if (part.shape?.kind === "round") {
      crossSectionFactor = Math.PI / 4; // 圓 πR² / bbox 4R²
    }
    const volMm3 = cut.length * cut.width * cut.thickness * crossSectionFactor;
    // 五金件（玻璃/銅件）不算木材材積；不累計 totalBdft / bdftByMaterial
    const bdft = isHardware ? 0 : volMm3 / MM3_PER_BDFT;
    if (!isHardware) totalBdft += bdft;
    // 拼板：顯示「桌面板 ×3 (each 200 × 1500 × 30mm)」讓學員按片下料
    const pieces = Math.max(1, Math.round(part.panelPieces ?? 1));

    const billable = effectiveBillableMaterial(part);
    const matName = isEn ? (MATERIALS[part.material].nameEn ?? MATERIALS[part.material].nameZh) : MATERIALS[part.material].nameZh;
    const materialLabel = isGlass
      ? (isEn ? `${formatMm(cut.thickness, effectiveUnit)} tempered glass` : `${formatMm(cut.thickness, effectiveUnit)} 強化玻璃`)
      : isBrass
        ? (isEn ? "Antiqued-brass hardware (purchased)" : "仿古銅五金（外購）")
        : billable === "plywood" || billable === "mdf"
          ? `${matName} / ${SHEET_GOOD_LABEL[billable]}`
          : matName;

    if (!isHardware) {
      const groupKey =
        billable === "plywood" || billable === "mdf"
          ? SHEET_GOOD_LABEL[billable]
          : matName;
      bdftByMaterial.set(groupKey, (bdftByMaterial.get(groupKey) ?? 0) + bdft);
    }

    const tenonNotes = isGlass
      ? (isEn ? "Order from glass shop; not in cut list" : "另向玻璃行訂製，不入裁切")
      : isBrass
        ? (isEn ? "Purchased hardware; not in cut list" : "外購五金件，不入裁切")
        : part.tenons.length
          ? part.tenons
              .map(
                (t) =>
                  `${t.position} ${formatMm(t.length, effectiveUnit)} ${(isEn ? JOINERY_LABEL_EN : JOINERY_LABEL)[t.type] ?? t.type}`,
              )
              .join(isEn ? ", " : "、")
          : "—";

    const category = categorizePart(part.id);

    return { part, cut, bdft, materialLabel, tenonNotes, category, isGlass, isBrass, isHardware, pieces };
  });

  // 依分類排序 + 每類內的原有順序（stable sort）
  // 玻璃 / 銅件單獨抽出來，不混在木材分類裡（外購五金，跟木工區隔）
  const byCategory = new Map<PartCategory, typeof rows>();
  const glassRows: typeof rows = [];
  const brassRows: typeof rows = [];
  for (const r of rows) {
    if (r.isGlass) {
      glassRows.push(r);
      continue;
    }
    if (r.isBrass) {
      brassRows.push(r);
      continue;
    }
    if (!byCategory.has(r.category)) byCategory.set(r.category, []);
    byCategory.get(r.category)!.push(r);
  }
  const sortedCategories = CATEGORY_ORDER.filter((c) => byCategory.has(c));

  // isolate 建立獨立 stacking context——避免內部 sticky thead / 第一欄 z-index
  // 穿透到 MobileShell 上方的 sticky 3D viewer (z-10)。wrap 自己 z-auto 整塊
  // 滑到 3D viewer 底下。
  return (
    <div className="isolate overflow-auto max-h-[70vh] md:max-h-none md:overflow-x-auto print:max-h-none print:overflow-visible">
    <table className="w-full text-sm min-w-[760px]">
      <thead className="bg-zinc-100 sticky top-0 z-20">
        <tr>
          <th className="text-left p-2 sticky left-0 z-30 bg-zinc-100">{isEn ? "Part" : "零件"}</th>
          <th className="text-left p-2">{isEn ? "Material" : "材質"}</th>
          <th className="text-right p-2">{isEn ? `Visible L × W × T (${effectiveUnit === "inch" ? "in" : "mm"})` : `可見長 × 寬 × 厚 (${effectiveUnit === "inch" ? "in" : "mm"})`}</th>
          <th className="text-right p-2">{isEn ? `Cut size (${effectiveUnit === "inch" ? "in" : "mm"})` : `切料尺寸 (${effectiveUnit === "inch" ? "in" : "mm"})`}</th>
          <th className="text-right p-2">{isEn ? "Volume (bdft)" : "材積（板才）"}</th>
          <th className="text-left p-2">{isEn ? "Tenon notes" : "榫頭備註"}</th>
        </tr>
      </thead>
      {sortedCategories.map((cat) => {
        const catRows = byCategory.get(cat)!;
        const catBdft = catRows.reduce((s, r) => s + r.bdft, 0);
        const color = CATEGORY_COLOR[cat];
        return (
          <tbody key={cat} className="border-t-2 border-zinc-200">
            <tr className={color.head}>
              <td
                colSpan={4}
                className={`relative px-2 py-1.5 pl-3 text-xs font-semibold ${color.text}`}
              >
                <span className={`absolute left-0 top-0 bottom-0 w-1 ${color.bar}`} />
                {CATEGORY_LABEL[cat]}
                <span className="ml-2 font-normal opacity-60">
                  · {isEn ? `${catRows.length} parts` : `${catRows.length} 件`}
                </span>
              </td>
              <td className={`px-2 py-1.5 text-right text-xs font-mono ${color.text}`}>
                {catBdft.toFixed(2)}
              </td>
              <td />
            </tr>
            {catRows.map(
              ({ part, cut, bdft, materialLabel, tenonNotes, pieces }) => {
                // 拼板：可見/切料寬度都先除以片數（單片實際尺寸），方便去料行下單
                const dispVw = part.visible.width / pieces;
                const dispCw = cut.width / pieces;
                const [vl, vw, vt] = sortDimsDesc(
                  part.visible.length,
                  dispVw,
                  part.visible.thickness,
                );
                const [cl, cw, ct] = sortDimsDesc(
                  cut.length,
                  dispCw,
                  cut.thickness,
                );
                const piecesPrefix = pieces > 1 ? (isEn ? `${pieces} × ` : `${pieces} 片 × `) : "";
                const isSelected = selectedPartId === part.id;
                const interactive = !!onPartClick;
                // sticky 第一欄需自帶 bg 避免下方 cell 從後面透出來；
                // 跟 row 狀態同步：選中=amber-100、hover=amber-50、預設=white
                const firstColBg = isSelected
                  ? "bg-amber-100"
                  : interactive
                    ? "bg-white group-hover:bg-amber-50"
                    : "bg-white";
                return (
                  <tr
                    key={part.id}
                    data-part-id={part.id}
                    onClick={interactive ? () => onPartClick!(part.id) : undefined}
                    className={`group border-b border-zinc-100 ${
                      interactive ? "cursor-pointer hover:bg-amber-50" : ""
                    } ${isSelected ? "bg-amber-100 ring-2 ring-amber-400" : ""}`}
                  >
                    <td className={`p-2 pl-3 relative sticky left-0 z-10 ${firstColBg}`}>
                      <span className={`absolute left-0 top-0 bottom-0 w-1 ${color.bar} opacity-50`} />
                      {partName(part, locale)}
                      {pieces > 1 && (
                        <span className="ml-1 text-[10px] text-amber-700 bg-amber-100 px-1 rounded">
                          {isEn ? `glue ${pieces}` : `拼 ${pieces} 片`}
                        </span>
                      )}
                    </td>
                    <td className="p-2">{materialLabel}</td>
                    <td className="p-2 text-right">
                      {piecesPrefix}{fmt(vl)} × {fmt(vw)} × {fmt(vt)}
                    </td>
                    <td className="p-2 text-right font-semibold">
                      {piecesPrefix}{fmt(cl)} × {fmt(cw)} × {fmt(ct)}
                    </td>
                    <td className="p-2 text-right font-mono">
                      {bdft.toFixed(2)}
                    </td>
                    <td className="p-2 text-xs text-zinc-600">{tenonNotes}</td>
                  </tr>
                );
              },
            )}
          </tbody>
        );
      })}
      {glassRows.length > 0 && (
        <tbody className="border-t-2 border-sky-300 bg-sky-50/30">
          <tr className="bg-sky-100/60">
            <td colSpan={4} className="px-2 py-1.5 text-xs font-semibold text-sky-900">
              {isEn ? "🪟 Glass (order from glass shop; not in cut list)" : "🪟 玻璃（另向玻璃行訂製，不入裁切）"}
              <span className="ml-2 font-normal text-sky-700">{isEn ? `· ${glassRows.length} panels` : `· ${glassRows.length} 片`}</span>
            </td>
            <td className="px-2 py-1.5 text-right text-xs font-mono text-sky-700">—</td>
            <td />
          </tr>
          <tr className="bg-sky-50/60">
            <td colSpan={6} className="px-3 py-1.5 text-[11px] text-sky-800 italic">
              {isEn
                ? "⚠️ Sizes shown are approximate — only order glass after the doors are built and the openings measured, to avoid frame-machining drift."
                : "⚠️ 此尺寸僅供參考——實際應在門片做完、量過實際開口後再向玻璃行下單，避免框料切削誤差導致玻璃尺寸不合。"}
            </td>
          </tr>
          {glassRows.map(({ part, cut, materialLabel, tenonNotes }) => {
            const [vl, vw, vt] = sortDimsDesc(
              part.visible.length,
              part.visible.width,
              part.visible.thickness,
            );
            const [cl, cw, ct] = sortDimsDesc(cut.length, cut.width, cut.thickness);
            return (
              <tr key={part.id} className="border-b border-sky-100">
                <td className="p-2">{partName(part, locale)}</td>
                <td className="p-2">{materialLabel}</td>
                <td className="p-2 text-right">
                  {fmt(vl)} × {fmt(vw)} × {fmt(vt)}
                </td>
                <td className="p-2 text-right font-semibold">
                  {fmt(cl)} × {fmt(cw)} × {fmt(ct)}
                </td>
                <td className="p-2 text-right font-mono text-sky-600">—</td>
                <td className="p-2 text-xs text-sky-700">{tenonNotes}</td>
              </tr>
            );
          })}
        </tbody>
      )}
      {brassRows.length > 0 && (
        <tbody className="border-t-2 border-amber-400 bg-amber-50/30">
          <tr className="bg-amber-100/60">
            <td colSpan={4} className="px-2 py-1.5 text-xs font-semibold text-amber-900">
              {isEn ? "🪙 Antiqued-brass hardware (purchased; not in cut list)" : "🪙 仿古銅五金（外購，不入裁切）"}
              <span className="ml-2 font-normal text-amber-700">{isEn ? `· ${brassRows.length} items` : `· ${brassRows.length} 件`}</span>
            </td>
            <td className="px-2 py-1.5 text-right text-xs font-mono text-amber-700">—</td>
            <td />
          </tr>
          {brassRows.map(({ part, cut, materialLabel, tenonNotes }) => {
            const [vl, vw, vt] = sortDimsDesc(
              part.visible.length,
              part.visible.width,
              part.visible.thickness,
            );
            const [cl, cw, ct] = sortDimsDesc(cut.length, cut.width, cut.thickness);
            return (
              <tr key={part.id} className="border-b border-amber-100">
                <td className="p-2">{partName(part, locale)}</td>
                <td className="p-2">{materialLabel}</td>
                <td className="p-2 text-right">
                  {fmt(vl)} × {fmt(vw)} × {fmt(vt)}
                </td>
                <td className="p-2 text-right font-semibold">
                  {fmt(cl)} × {fmt(cw)} × {fmt(ct)}
                </td>
                <td className="p-2 text-right font-mono text-amber-600">—</td>
                <td className="p-2 text-xs text-amber-700">{tenonNotes}</td>
              </tr>
            );
          })}
        </tbody>
      )}
      <tfoot className="bg-zinc-100 border-t-2 border-zinc-400">
        <tr>
          <td className="p-2 font-semibold" colSpan={4}>
            {isEn ? "Total" : "合計"}
            <span className="ml-3 text-xs text-zinc-500 font-normal">
              {[...bdftByMaterial.entries()]
                .map(([k, v]) => isEn ? `${k} ${v.toFixed(2)} bdft` : `${k} ${v.toFixed(2)} 板才`)
                .join(isEn ? "  ·  " : "　・　")}
            </span>
          </td>
          <td className="p-2 text-right font-mono font-semibold">
            {totalBdft.toFixed(2)}
          </td>
          <td className="p-2 text-xs text-zinc-500">{isEn ? "Excludes 10% trim waste" : "未含 10% 切料損耗"}</td>
        </tr>
      </tfoot>
    </table>
    </div>
  );
}
