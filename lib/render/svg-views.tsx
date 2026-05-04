import type { FurnitureDesign, Part } from "@/lib/types";
import { calculateCutDimensions } from "@/lib/geometry/cut-dimensions";
import { MATERIALS } from "@/lib/materials";
import { JOINERY_LABEL } from "@/lib/joinery/details";
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
  type OrthoView,
} from "@/lib/render/geometry";

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
      /^(apron|ls-|stretcher|back-rail|back-top-rail|back-splat|footrest|center-stretcher)/.test(
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

// ─── Joinery overlay (Phase 1.5) ────────────────────────────────────────────
// 把 part-local AABB（tenon 或 mortise 的小箱）投影到 view 平面，回 bbox。
// 採跟 projectPartSilhouette 相同的 Euler XYZ + bottom-origin 慣例：
//   M = Rx * Ry * Rz；part.origin.y 是 part 底部；local 軸 length=X、thickness=Y、width=Z
export type LocalBox = {
  cx: number; cy: number; cz: number;     // local center (centered on length/thickness/width)
  hx: number; hy: number; hz: number;     // half-extents
};

/**
 * 把 part-local 點 (xL, yL, zL) 經 part 的 Euler XYZ rotation + origin 投影
 * 到指定 view 的 (vx, vy)。共用給 projectFeatureRect 跟 projectDovetailPolygon。
 */
function makeProjector(part: Part, view: OrthoView) {
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
    if (view === "side") return { x: wz, y: wy };
    return { x: -wx, y: wy };
  };
}

/**
 * 鳩尾榫斷面投影：把 width 軸於 tenon TIP 端外擴 flare（標準 1:8 = L/8 per side），
 * BASE 端保持 W。回 4 組 silhouette 凸包點（projected 2D），給 svg `<polygon>` 用。
 *
 * 用 tenon.position 推 length / width / thickness 對應到哪條 local axis；oW/oT
 * 偏移跟一般 tenon 一致。返回 view-space 點。
 */
function projectDovetailPolygon(
  part: Part,
  tenon: Part["tenons"][number],
  view: OrthoView,
): Array<{ x: number; y: number }> {
  const lx = part.visible.length;
  const ly = part.visible.thickness;
  const lz = part.visible.width;
  const L = tenon.length;
  const W = tenon.width;
  const T = tenon.thickness;
  const oW = tenon.offsetWidth ?? 0;
  const oT = tenon.offsetThickness ?? 0;
  const angleTan = 1 / 8; // 1:8 dovetail standard (硬木；軟木 1:6)
  const flare = L * angleTan;
  const project = makeProjector(part, view);
  const ptsRaw: Array<[number, number, number]> = [];
  // BASE = 0; TIP = +1; each pair (s_thick, s_widthAxis)
  const addCorners = (axisL: "x" | "y" | "z", baseSign: -1 | 1, sign: -1 | 1) => {
    // baseSign: where the tenon sits on part face (start/bottom/left = -1 face; end/top/right = +1)
    // sign:    +1 = TIP (outer), -1 = BASE (at face)
    // length axis goes from face out by sign × L; width axis flare = TIP wider
    if (axisL === "x") {
      const halfW = sign > 0 ? W / 2 + flare : W / 2;
      const xL_ = baseSign * (lx / 2) + sign * baseSign * 0; // base at face
      const xT_ = baseSign * (lx / 2) + sign * baseSign * L; // ... not quite
      // simpler:
      // BASE x = baseSign * lx/2; TIP x = baseSign * (lx/2 + L)
      const xCoord = baseSign * (lx / 2 + (sign > 0 ? L : 0));
      // 4 corners: ±T (thickness=Y), ±W (width=Z)
      for (const sT of [-1, 1] as const) for (const sW of [-1, 1] as const) {
        ptsRaw.push([xCoord, oT + sT * (T / 2), oW + sW * halfW]);
      }
    } else if (axisL === "y") {
      const halfW = sign > 0 ? W / 2 + flare : W / 2;
      const yCoord = baseSign * (ly / 2 + (sign > 0 ? L : 0));
      for (const sT of [-1, 1] as const) for (const sW of [-1, 1] as const) {
        ptsRaw.push([oW + sW * halfW, yCoord, oT + sT * (T / 2)]);
      }
    } else {
      const halfW = sign > 0 ? W / 2 + flare : W / 2;
      const zCoord = baseSign * (lz / 2 + (sign > 0 ? L : 0));
      for (const sT of [-1, 1] as const) for (const sW of [-1, 1] as const) {
        ptsRaw.push([oW + sW * halfW, oT + sT * (T / 2), zCoord]);
      }
    }
  };
  switch (tenon.position) {
    case "start":  addCorners("x", -1, -1); addCorners("x", -1, +1); break;
    case "end":    addCorners("x", +1, -1); addCorners("x", +1, +1); break;
    case "bottom": addCorners("y", -1, -1); addCorners("y", -1, +1); break;
    case "top":    addCorners("y", +1, -1); addCorners("y", +1, +1); break;
    case "left":   addCorners("z", -1, -1); addCorners("z", -1, +1); break;
    case "right":  addCorners("z", +1, -1); addCorners("z", +1, +1); break;
  }
  const projected = ptsRaw.map(([a, b, c]) => project(a, b, c));
  return convexHull2DLocal(projected);
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
  view: OrthoView,
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
  view: OrthoView,
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
    else if (view === "side") { vx = wz; vy = wy; }
    else { vx = -wx; vy = wy; }
    return { x: vx, y: vy };
  };

  const corners: Array<{ x: number; y: number }> = [];
  for (const sx of [-1, 1])
    for (const sy of [-1, 1])
      for (const sz of [-1, 1]) {
        corners.push(project(box.cx + sx * box.hx, box.cy + sy * box.hy, box.cz + sz * box.hz));
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

function tenonLocalBox(part: Part, tenon: Part["tenons"][number]): LocalBox {
  const lx = part.visible.length;
  const ly = part.visible.thickness;
  const lz = part.visible.width;
  const L = tenon.length;
  const W = tenon.width;     // 斷面寬
  const T = tenon.thickness; // 斷面厚
  // 不對稱榫接的中心偏移（drafting-math.md §A10.10）
  const oW = tenon.offsetWidth ?? 0;
  const oT = tenon.offsetThickness ?? 0;
  switch (tenon.position) {
    // start/end：length 沿 ±X，width 沿 Z，thickness 沿 Y
    case "start":
      return { cx: -lx / 2 - L / 2, cy: oT, cz: oW, hx: L / 2, hy: T / 2, hz: W / 2 };
    case "end":
      return { cx: +lx / 2 + L / 2, cy: oT, cz: oW, hx: L / 2, hy: T / 2, hz: W / 2 };
    // top/bottom：length 沿 ±Y，width 沿 X，thickness 沿 Z
    case "top":
      return { cx: oW, cy: +ly / 2 + L / 2, cz: oT, hx: W / 2, hy: L / 2, hz: T / 2 };
    case "bottom":
      return { cx: oW, cy: -ly / 2 - L / 2, cz: oT, hx: W / 2, hy: L / 2, hz: T / 2 };
    // left/right：length 沿 ±Z，width 沿 X，thickness 沿 Y
    case "left":
      return { cx: oW, cy: oT, cz: -lz / 2 - L / 2, hx: W / 2, hy: T / 2, hz: L / 2 };
    case "right":
      return { cx: oW, cy: oT, cz: +lz / 2 + L / 2, hx: W / 2, hy: T / 2, hz: L / 2 };
  }
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
export function mortiseLocalBox(part: Part, m: Part["mortises"][number]): LocalBox {
  const lx = part.visible.length;
  const ly = part.visible.thickness;
  const lz = part.visible.width;
  // Y 是 from-bottom，shift 到 centered
  const oxC = m.origin.x;
  const oyC = m.origin.y - ly / 2;
  const ozC = m.origin.z;

  const yToFace = Math.min(Math.abs(m.origin.y), Math.abs(m.origin.y - ly));
  const xToFace = Math.min(Math.abs(m.origin.x - lx / 2), Math.abs(m.origin.x + lx / 2));
  const zToFace = Math.min(Math.abs(m.origin.z - lz / 2), Math.abs(m.origin.z + lz / 2));

  // 通孔（through）depth = 母件厚（沿 depth 軸的全長）
  // 深度軸 = 最靠近表面的軸
  let depthAxis: "x" | "y" | "z";
  if (yToFace <= xToFace && yToFace <= zToFace) depthAxis = "y";
  else if (xToFace <= zToFace) depthAxis = "x";
  else depthAxis = "z";

  const D = m.depth;
  const Lm = m.length;
  const Wm = m.width;

  if (depthAxis === "y") {
    // 入口面 = 上面 or 下面；mortise 的 length × width 在 X-Z 面上
    // 中心 Y：通孔置中；半通由入口位置 + depth/2 推
    const enterTop = m.origin.y >= ly - 1; // 若 origin 接近頂面
    const cyL = m.through
      ? 0
      : (enterTop ? +ly / 2 - D / 2 : -ly / 2 + D / 2);
    return { cx: oxC, cy: cyL, cz: ozC, hx: Lm / 2, hy: D / 2, hz: Wm / 2 };
  } else if (depthAxis === "x") {
    const enterRight = m.origin.x >= 0;
    const cxL = enterRight ? +lx / 2 - D / 2 : -lx / 2 + D / 2;
    return { cx: cxL, cy: oyC, cz: ozC, hx: D / 2, hy: Lm / 2, hz: Wm / 2 };
  } else {
    // depthAxis = z：垂直腳上的橫向 mortise（apron / stretcher 進入 leg）。
    // 慣例：mortise.length 沿 part Y（順 leg 高），mortise.width 沿 part X。
    const enterFront = m.origin.z >= 0;
    const czL = enterFront ? +lz / 2 - D / 2 : -lz / 2 + D / 2;
    return { cx: oxC, cy: oyC, cz: czL, hx: Wm / 2, hy: Lm / 2, hz: D / 2 };
  }
}

/** Single orthographic view with engineering-drawing frame and dim lines */
export function OrthoView({
  design,
  view,
  title,
  titleEn,
  className,
  joineryMode = false,
}: ViewProps & {
  view: OrthoView;
  title: string;
  titleEn: string;
  /** 覆蓋 SVG 預設 className（預設 "bg-white w-full h-auto max-h-[70vh]"） */
  className?: string;
  /** 榫接模式：在三視圖上加畫公榫凸出（實線）+ 母榫（虛線）+ 肩寬虛線 */
  joineryMode?: boolean;
}) {
  const { overall } = design;
  const w = view === "side" ? overall.width : overall.length;
  const h = view === "top" ? overall.width : overall.thickness;

  const vbW = w + PADDING * 2;
  const vbH = h + PADDING * 2 + DIM_OFFSET + TITLE_BAR_H;
  const vbX = -PADDING - w / 2;
  // Top view parts project around y=0 (origin.z - zExt/2 ranges roughly -h/2..h/2);
  // front/side views use natural flipY so parts span y=-h..0.
  const drawAreaTop = view === "top" ? -h / 2 : -h;
  const vbY = drawAreaTop - PADDING - TITLE_BAR_H;

  // Frame: enclose drawing + title bar + dim area
  const frameX = vbX + 8;
  const frameY = vbY + 8;
  const frameW = vbW - 16;
  const frameH = vbH - 16;

  return (
    <svg
      viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
      preserveAspectRatio="xMidYMid meet"
      className={className ?? "bg-white w-full h-auto max-h-[70vh]"}
    >
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

      {/* outer frame */}
      <rect
        x={frameX}
        y={frameY}
        width={frameW}
        height={frameH}
        fill="none"
        stroke="#222"
        strokeWidth={1}
      />

      {/* title bar at top */}
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
        </text>
        <text
          x={frameX + 10}
          y={frameY + TITLE_BAR_H - 10}
          dx={70}
          fontSize={10}
          fill="#666"
          fontFamily="sans-serif"
        >
          {titleEn}
        </text>
      </g>

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
      {sortPartsByDepth(design.parts, view).map((part) => {
        const hidden = isPartHidden(part, design.parts, view);
        const stroke = hidden ? "#888" : "#111";
        const sw = hidden ? 0.5 : 0.9;
        const dash = hidden ? "4 3" : undefined;
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
                  x1={seg.a.x}
                  y1={seg.a.y}
                  x2={seg.b.x}
                  y2={seg.b.y}
                  stroke={seg.hidden ? "#888" : "#111"}
                  strokeWidth={seg.hidden ? 0.5 : 0.9}
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
                stroke="#111"
                strokeWidth={0.9}
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
                  x1={seg.a.x}
                  y1={seg.a.y}
                  x2={seg.b.x}
                  y2={seg.b.y}
                  stroke={seg.hidden ? "#888" : "#111"}
                  strokeWidth={seg.hidden ? 0.5 : 0.9}
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
                stroke="#111"
                strokeWidth={0.9}
              />
            </g>
          );
        }
        // 圓盤 / 圓柱腳俯視畫圓；前/側視維持矩形（圓盤側面 = 直徑 × 厚）
        if (
          (part.shape?.kind === "round" ||
            part.shape?.kind === "round-tapered" ||
            part.shape?.kind === "splayed-round-tapered" ||
            part.shape?.kind === "lathe-turned") &&
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
            const bowOccluder = design.parts.find(
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
                    x1={seg.a.x}
                    y1={seg.a.y}
                    x2={seg.b.x}
                    y2={seg.b.y}
                    stroke={seg.hidden ? "#888" : stroke}
                    strokeWidth={seg.hidden ? 0.5 : sw}
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
                <circle cx={footCx} cy={footCy} r={r2} fill="none" stroke="#888" strokeWidth={0.4} strokeDasharray="3 3" />
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
        const isTiltedBox =
          (!part.shape || part.shape.kind === "box") && hasNonQuarterRotation(part);
        const isApronTrapezoid = part.shape?.kind === "apron-trapezoid";
        const isApronBeveled = part.shape?.kind === "apron-beveled";
        const isArchBentSideFront =
          part.shape?.kind === "arch-bent" && view !== "top";
        const isTiltZ = part.shape?.kind === "tilt-z" && view !== "top";
        if (
          isTiltedBox ||
          isApronTrapezoid ||
          isApronBeveled ||
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
              pts.map((p) => `${p.x},${-p.y}`).join(" ");
            // 傾斜橫撐俯視：被座板蓋著 → top/bot 兩面都用虛線（不做 HLE 分段，避免短實線）
            return (
              <g key={part.id}>
                <polygon points={fmt(topCorners)} fill="none" stroke="#888" strokeWidth={0.5} strokeDasharray="4 3" />
                <polygon points={fmt(botCorners)} fill="none" stroke="#888" strokeWidth={0.4} strokeDasharray="3 3" />
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
              // side view: svg x = wz, svg y = -wy
              return { x: wz, y: -wy };
            });
            const endPts = endCorners.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
            const poly = projectTiltedBoxSilhouette(part, view);
            const points = poly.map((p) => `${p.x},${-p.y}`).join(" ");
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
                  stroke="#111"
                  strokeWidth={0.5}
                />
              </g>
            );
          }
          // 其他 view：convex hull silhouette
          const poly = projectTiltedBoxSilhouette(part, view);
          const points = poly.map((p) => `${p.x},${-p.y}`).join(" ");
          return (
            <polygon
              key={part.id}
              points={points}
              fill="none"
              stroke={stroke}
              strokeWidth={sw}
              strokeDasharray={dash}
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
              <rect x={footX} y={footY} width={footW} height={footH} fill="none" stroke="#888" strokeWidth={0.4} strokeDasharray="3 3" />
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
          part.shape?.kind === "round" && (part.shape.chamferMm ?? 0) > 0;
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
        const useShape =
          !isFaceRoundedXTilt &&
          part.shape &&
          part.shape.kind !== "box" &&
          (part.shape.kind !== "round" || (isRoundWithChamfer && view !== "top")) &&
          !(
            view === "top" &&
            part.shape.kind !== "splayed" &&
            part.shape.kind !== "splayed-tapered" &&
            part.shape.kind !== "splayed-round-tapered" &&
            part.shape.kind !== "notched-corners" &&
            part.shape.kind !== "arch-bent" &&
            !isTaperedWithChamfer &&
            !isFaceRoundedBent
          );
        if (useShape) {
          const poly = projectPartPolygon(part, view);
          const points = poly.map((p) => `${p.x},${-p.y}`).join(" ");
          const extras: React.ReactNode[] = [];
          // Splayed top view: also draw the shifted bottom footprint so you
          // can see how far the foot lands from directly below the head.
          if (part.shape?.kind === "splayed" && view === "top") {
            const r = projectPart(part, view);
            extras.push(
              <rect
                key={`${part.id}-foot`}
                x={r.x + -part.shape.dxMm}
                y={-(r.y + r.h) - part.shape.dzMm}
                width={r.w}
                height={r.h}
                fill="none"
                stroke="#888"
                strokeWidth={0.4}
                strokeDasharray="3 3"
              />,
            );
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
          return (
            <g key={part.id}>
              <polygon
                points={points}
                fill="none"
                stroke={stroke}
                strokeWidth={sw}
                strokeDasharray={dash}
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
            if (view === "side") return { x: wz, y: wy };
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
          const points = polyPts.map((p) => `${p.x},${-p.y}`).join(" ");
          // face-rounded 帶 bend 在側視畫端面分隔線（區分真實厚度與彎曲延伸）
          let dividerLine: React.ReactNode = null;
          if (view === "side" && isFaceRounded && bendAxis === "z" && Math.abs(bendMm) >= 0.5) {
            const zDiv = bendMm > 0 ? +lzL / 2 : -lzL / 2;
            const a = projectOne(-lyL / 2, zDiv, 0);
            const b = projectOne(+lyL / 2, zDiv, 0);
            dividerLine = (
              <line
                key={`${part.id}-endface`}
                x1={a.x} y1={-a.y} x2={b.x} y2={-b.y}
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
        if (hidden) {
          return (
            <rect
              key={part.id}
              x={r.x}
              y={view === "top" ? -(r.y + r.h) : -r.y - r.h}
              width={r.w}
              height={r.h}
              fill="none"
              stroke={stroke}
              strokeWidth={sw}
              strokeDasharray={dash}
            />
          );
        }
        const corners = [
          { x: r.x, y: r.y },
          { x: r.x + r.w, y: r.y },
          { x: r.x + r.w, y: r.y + r.h },
          { x: r.x, y: r.y + r.h },
        ];
        const isHiddenAt = makeHiddenChecker(part, design.parts, view);
        const lines: React.ReactNode[] = [];
        for (let i = 0; i < 4; i++) {
          const a = corners[i];
          const b = corners[(i + 1) % 4];
          const segs = classifyEdgeVisibility(a, b, isHiddenAt);
          segs.forEach((seg, segIdx) => {
            lines.push(
              <line
                key={`${part.id}-e${i}-s${segIdx}`}
                x1={seg.a.x}
                y1={-seg.a.y}
                x2={seg.b.x}
                y2={-seg.b.y}
                stroke={seg.hidden ? "#888" : "#111"}
                strokeWidth={seg.hidden ? 0.5 : 0.9}
                strokeDasharray={seg.hidden ? "4 3" : undefined}
                fill="none"
              />,
            );
          });
        }
        return <g key={part.id}>{lines}</g>;
      })}

      {/* 座面挖型（saddle / scooped）— 前/側視疊一條虛線曲線顯示挖型輪廓
           俯視看不到挖型不畫；曲線從矩形頂緣往下凹（最深點 = depthMm） */}
      {view !== "top" && design.parts
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

      {/* outer bounding box (dashed ghost) */}
      <rect
        x={-w / 2}
        y={drawAreaTop}
        width={w}
        height={h}
        fill="none"
        stroke="#999"
        strokeDasharray="3 3"
        strokeWidth={0.5}
        opacity={0.8}
      />

      {/* 榫接模式 overlay（drafting-math.md §B5/§B6）：
            - tenon 凸出 = 紅實線
            - tenon 肩位 = 紅虛線（公榫件本體面 / 肩到肩 boundary）
            - mortise = 藍虛線
            - 通榫穿透時母件背面 = 端面木紋格 §B5
          glass 件略過。 */}
      {joineryMode && (() => {
        // Pre-build mortise polygon lookup：tenon 渲染時找對應母榫，用 mortise polygon
        // 取代 tenon polygon → 榫接視覺重合（紅疊在藍上、且 tenon 跟著母件斜）
        const mortiseEntries: Array<{
          partId: string;
          worldCenter: { x: number; y: number; z: number };
          polygon: Array<{ x: number; y: number }>;
        }> = [];
        for (const part of design.parts) {
          if (part.visual === "glass") continue;
          for (const m of part.mortises) {
            if (m.depth <= 0) continue;
            const lb = mortiseLocalBox(part, m);
            mortiseEntries.push({
              partId: part.id,
              worldCenter: boxWorldCenter(part, lb),
              polygon: projectFeaturePolygon(part, lb, view),
            });
          }
        }
        const findMortiseMatch = (
          partId: string,
          tenonCenter: { x: number; y: number; z: number },
        ): { polygon: Array<{ x: number; y: number }> } | null => {
          const TOL = 15; // 公差 15mm — 公榫端面與母榫開口應 < 1mm
          let best: typeof mortiseEntries[number] | null = null;
          let bestDist = TOL;
          for (const me of mortiseEntries) {
            if (me.partId === partId) continue;
            const dx = me.worldCenter.x - tenonCenter.x;
            const dy = me.worldCenter.y - tenonCenter.y;
            const dz = me.worldCenter.z - tenonCenter.z;
            const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
            if (d < bestDist) { best = me; bestDist = d; }
          }
          return best;
        };
        return (
        <g pointerEvents="none">
          {design.parts.map((part) => {
            if (part.visual === "glass") return null;
            const elements: React.ReactNode[] = [];
            // tenon 凸出（公榫）— 實線紅
            for (let i = 0; i < part.tenons.length; i++) {
              const t = part.tenons[i];
              if (t.length <= 0) continue;
              if (t.type === "dovetail") {
                // 鳩尾榫：渲染 1:8 flare 梯形（基礎版，3D phase 4+）
                const dovePts = projectDovetailPolygon(part, t, view);
                if (dovePts.length >= 3) {
                  const dvStr = dovePts.map((p) => `${p.x.toFixed(2)},${(-p.y).toFixed(2)}`).join(" ");
                  elements.push(
                    <polygon
                      key={`${part.id}-dt${i}`}
                      points={dvStr}
                      fill="none"
                      stroke="#c0392b"
                      strokeWidth={0.6}
                    />,
                  );
                }
                continue;
              }
              const lb = tenonLocalBox(part, t);
              const r = projectFeatureRect(part, lb, view);
              if (r.w >= 0.5 && r.h >= 0.5) {
                // 找對應母榫：tenon center 跟最近 mortise center match → 用 mortise
                // polygon 取代（榫接視覺重合：跟著母件斜）
                // 例外：公件有 splayed shape（如腳）→ 用 tenon 自己 polygon，跟公件
                // 中心軸延伸方向一致（不被「直的母件 mortise」拉平）
                const tCenter = boxWorldCenter(part, lb);
                const match = findMortiseMatch(part.id, tCenter);
                // apron 系列 shape 也用 own polygon，讓 tenon 4 邊跟著母件變形
                const useOwnPolygon =
                  part.shape?.kind === "splayed" ||
                  part.shape?.kind === "apron-trapezoid" ||
                  part.shape?.kind === "apron-beveled" ||
                  part.shape?.kind === "apron-half-beveled";
                // 通榫凸出於母件外 → 可見 → 實線；盲榫/半榫埋進母件裡 → 不可見 → 虛線
                const isVisibleTenon = t.type === "through-tenon";
                // 俯視圖 splayed 公件 + through-tenon：腳是斜的，從上往下看
                // entry（腳頂端面位置）跟 exit（穿出母件上方位置）X-Z 不同 → 畫兩個 rect
                if (view === "top" && useOwnPolygon && isVisibleTenon) {
                  const drawSlice = (yLocal: number, key: string) => {
                    const sliceBox: LocalBox = { ...lb, cy: yLocal, hy: 0.001 };
                    const poly = projectFeaturePolygon(part, sliceBox, view);
                    const pts = poly.map((p) => `${p.x},${-p.y}`).join(" ");
                    elements.push(
                      <polygon
                        key={`${part.id}-t${i}-${key}`}
                        points={pts}
                        fill="none"
                        stroke="#c0392b"
                        strokeWidth={0.6}
                      />,
                    );
                  };
                  drawSlice(lb.cy - lb.hy, "entry"); // 腳頂端面（進入孔位置）
                  drawSlice(lb.cy + lb.hy, "exit");  // 榫頭頂端（穿出位置）
                } else {
                  const tPoly = match && !useOwnPolygon
                    ? match.polygon
                    : projectFeaturePolygon(part, lb, view, true);
                  const tPoints = tPoly.map((p) => `${p.x},${-p.y}`).join(" ");
                  elements.push(
                    <polygon
                      key={`${part.id}-t${i}`}
                      points={tPoints}
                      fill="none"
                      stroke="#c0392b"
                      strokeWidth={0.6}
                      {...(isVisibleTenon ? {} : { strokeDasharray: "3 2" })}
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

      {/* horizontal dimension below — 加方向 prefix 讓讀者一看就懂
          Front/Top 投影 X 軸 = 寬（length）；Side 投影 X 軸 = 深（width）*/}
      <DimensionLine
        arrowId={`arr-${view}`}
        x1={-w / 2}
        x2={w / 2}
        y={drawAreaTop + h + 28}
        label={`${view === "side" ? "深" : "寬"} ${w} mm`}
      />

      {/* vertical dimension on right side
          桌椅類前/側視圖左側已有「座面 ${h}」/「桌面 ${h}」高度標，避免重複；
          頂視圖跟櫃類沒有左側等價標籤，仍顯示總高
          Front/Side 投影 Y 軸 = 高（thickness）；Top 投影 Y 軸 = 深（width）*/}
      {(() => {
        const hasFlatTopLeftLabel =
          view !== "top" && extractFurnitureDims(design) !== null;
        if (hasFlatTopLeftLabel) return null;
        return (
          <VerticalDimensionLine
            arrowId={`arr-${view}`}
            x={w / 2 + 28}
            y1={view === "top" ? -h / 2 : -h}
            y2={view === "top" ? h / 2 : 0}
            label={`${view === "top" ? "深" : "高"} ${h} mm`}
          />
        );
      })()}

      {/* === 額外標線（內部尺寸 + zone 高度鏈 / 桌面厚 + 淨高 / 層板高度）=== */}
      {(() => {
        const dims = extractFurnitureDims(design);
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
                  腳 {legSize}×{legSize}
                </text>
                {/* 桌面外伸——只在右上角標一個（4 邊對稱所以只標 1 處夠用）*/}
                {showOverhang && (
                  <>
                    <DimensionLine
                      arrowId={`arr-${view}`}
                      x1={maxX + legSize / 2}
                      x2={w / 2}
                      y={-h / 2 - 16}
                      label={`外伸 ${Math.round(overhangXr)}`}
                    />
                    <VerticalDimensionLine
                      arrowId={`arr-${view}`}
                      x={w / 2 + 16}
                      y1={maxZ + legSize / 2}
                      y2={h / 2}
                      label={`外伸 ${Math.round(overhangZb)}`}
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
                    mm > 0 ? `落地超出椅面 ${Math.round(mm)}` : `落地內縮 ${Math.round(-mm)}`;
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
          const labelMain = mainKind === "seat" ? "座板" : "桌面";
          const labelClear = mainKind === "seat" ? "座下高" : "桌下淨高";
          // 把所有「會疊在左側的高度標線」整合：座面高 + 層板 + cross-pieces
          const leftStack: { y: number; label: string }[] = [];
          if (mainKind === "seat") {
            leftStack.push({
              y: mainTopY,
              label: `座面 ${Math.round(mainTopY)}`,
            });
          }
          for (const s of shelves) {
            leftStack.push({
              y: s.topY,
              label: `${s.nameZh} ${Math.round(s.topY)}`,
            });
          }
          for (const c of crossPieces) {
            leftStack.push({
              y: c.topY,
              label: `${c.nameZh} ${Math.round(c.topY)}`,
            });
          }
          // 排序去重（同 Y 只留一個）
          const seen = new Set<number>();
          const dedupedStack = leftStack
            .sort((a, b) => a.y - b.y)
            .filter((it) => {
              const key = Math.round(it.y);
              if (seen.has(key)) return false;
              seen.add(key);
              return true;
            });
          return (
            <>
              {/* 主面厚 */}
              <VerticalDimensionLine
                arrowId={`arr-${view}`}
                x={w / 2 + 96}
                y1={-mainTopY}
                y2={-mainBottomY}
                label={`${labelMain} ${Math.round(mainT)}`}
              />
              {/* 淨高 */}
              <VerticalDimensionLine
                arrowId={`arr-${view}`}
                x={w / 2 + 140}
                y1={-mainBottomY}
                y2={sFloor}
                label={`${labelClear} ${Math.round(mainBottomY)} mm`}
              />
              {/* cross-pieces 厚度（橫撐 / 牙板 / 椅背）— 同 Y 同尺寸去重，只標一次
                  名稱去掉「前/後/左/右」前綴避免重複（4 個都同樣是「牙板 60」） */}
              {(() => {
                const seen = new Map<string, typeof crossPieces[0]>();
                for (const c of crossPieces) {
                  const key = `${Math.round(c.bottomY)}_${Math.round(c.yExt)}`;
                  if (!seen.has(key)) seen.set(key, c);
                }
                const bare = (n: string) => n.replace(/^(前|後|左|右)/, "");
                return [...seen.values()].map((c) => {
                  // 側視圖：arch-bent 件（bow）往 +Z 凸出 bendMm，標籤要再往右閃避
                  // 不然會壓在彎弧凸出的 silhouette 上面（使用者 4.29 回報 bow 標籤蓋到圖）
                  const archShift = view === "side" ? c.archBendMm : 0;
                  return (
                    <text
                      key={`xp-thick-${c.id}`}
                      x={w / 2 + 4 + archShift}
                      y={-(c.bottomY + c.yExt / 2) + 4}
                      fontSize={10}
                      fill="#444"
                      fontFamily="sans-serif"
                    >
                      {bare(c.nameZh)} {Math.round(c.yExt)}
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
                  const showAngle = c.cutAngleDeg > 0.1;
                  return (
                    <g key={`xp-len-${c.id}`} stroke="#a55" fill="#a55" strokeWidth={0.5} fontFamily="sans-serif">
                      <line x1={-halfL} y1={yLine} x2={halfL} y2={yLine}
                        markerStart={`url(#arr-${view})`} markerEnd={`url(#arr-${view})`} />
                      <text x={0} y={yLine + 11} textAnchor="middle" fontSize={9} stroke="none">
                        {bare(c.nameZh)} L{Math.round(c.cutLengthMm)}
                        {showAngle ? ` ∠${c.cutAngleDeg.toFixed(1)}°` : ""}
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
          const boundaryYs = extractZoneBoundaryYs(design);
          const zoneSegments: { y1: number; y2: number; label: string }[] = [];
          let prevY = bottomTopY;
          for (const by of boundaryYs) {
            zoneSegments.push({ y1: -prevY, y2: -by, label: `${Math.round(by - prevY)} mm` });
            prevY = by + panelT; // 下一段從 boundary 上緣開始
          }
          zoneSegments.push({
            y1: -prevY,
            y2: -topBottomY,
            label: `${Math.round(topBottomY - prevY)} mm`,
          });

          return (
            <>
              {/* 內寬 — 在外寬下方再加一條（位置往下偏 22px） */}
              <DimensionLine
                arrowId={`arr-${view}`}
                x1={-w / 2 + panelT}
                x2={w / 2 - panelT}
                y={drawAreaTop + h + 80}
                label={`內 ${Math.round(innerW)} mm`}
              />
              {/* 內高 — 在右側外高內側再加一條（往內偏 32px） */}
              <VerticalDimensionLine
                arrowId={`arr-${view}`}
                x={w / 2 + 96}
                y1={sTop}
                y2={sBottom}
                label={`內 ${Math.round(innerH)} mm`}
              />
              {/* 腳高 — 右側更靠內，從底板下緣到地面 */}
              {legHeight > 0 && (
                <VerticalDimensionLine
                  arrowId={`arr-${view}`}
                  x={w / 2 + 140}
                  y1={sLegBottom}
                  y2={sFloor}
                  label={`腳 ${Math.round(legHeight)}`}
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
                  頂板 {panelT}
                </text>
                <text x={w / 2 + 4} y={-bottomTopY + panelT / 2 + 8} textAnchor="start">
                  底板 {panelT}
                </text>
              </g>
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
                label={`內深 ${Math.round(innerD)} mm`}
              />
              {/* 內高 — 右側內側多一條 */}
              <VerticalDimensionLine
                arrowId={`arr-${view}`}
                x={w / 2 + 96}
                y1={-topBottomY}
                y2={-bottomTopY}
                label={`內 ${Math.round(innerH)} mm`}
              />
              {legHeight > 0 && (
                <VerticalDimensionLine
                  arrowId={`arr-${view}`}
                  x={w / 2 + 140}
                  y1={-legHeight}
                  y2={drawAreaTop + h}
                  label={`腳 ${Math.round(legHeight)}`}
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
                label={`內 ${Math.round(innerW)} mm`}
              />
              {/* 內深 — 右側內側 */}
              <VerticalDimensionLine
                arrowId={`arr-${view}`}
                x={w / 2 + 96}
                y1={-h / 2}
                y2={-h / 2 + innerD}
                label={`內深 ${Math.round(innerD)}`}
              />
            </>
          );
        }
        return null;
      })()}

      {/* Orientation marker: the TOP view shows the furniture from above, so
          label which edge is the FRONT face (−Z in world) and which is BACK.
          Helps readers orient since top-view alone is ambiguous. */}
      {view === "top" && (
        <g fontFamily="sans-serif" fill="#666" fontSize={11}>
          <text
            x={0}
            y={drawAreaTop - 6}
            textAnchor="middle"
          >
            後 BACK
          </text>
          <text
            x={0}
            y={drawAreaTop + h + 110}
            textAnchor="middle"
          >
            前 FRONT
          </text>
        </g>
      )}

      {/* 比例尺：100mm 參考棒（per drafting-math.md §A3）
          位於圖框左下角，給讀者一個視覺基準快速估其他尺寸 */}
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
    </svg>
  );
}

function DimensionLine({
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

function VerticalDimensionLine({
  x,
  y1,
  y2,
  label,
  arrowId,
}: {
  x: number;
  y1: number;
  y2: number;
  label: string;
  arrowId: string;
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
        y={(y1 + y2) / 2}
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
}: {
  design: FurnitureDesign;
  joineryMode?: boolean;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="border border-zinc-200 rounded-lg overflow-hidden bg-white shadow-sm">
        <OrthoView design={design} view="front" title="正視圖" titleEn="FRONT VIEW" joineryMode={joineryMode} />
      </div>
      <div className="border border-zinc-200 rounded-lg overflow-hidden bg-white shadow-sm">
        <OrthoView design={design} view="side" title="側視圖" titleEn="SIDE VIEW" joineryMode={joineryMode} />
      </div>
      <div className="border border-zinc-200 rounded-lg overflow-hidden bg-white shadow-sm">
        <OrthoView design={design} view="top" title="俯視圖" titleEn="TOP VIEW" joineryMode={joineryMode} />
      </div>
    </div>
  );
}

/**
 * Compact three-view strip — 3 views side-by-side 固定小尺寸，給 A4 報價單用。
 * 每個 view 最大高度 ~28mm，3 個總寬度 ~70mm，可放進文件抬頭不佔太多版面。
 */
export function CompactThreeViews({ design }: { design: FurnitureDesign }) {
  return (
    <div className="flex gap-2 compact-three-views">
      <div className="flex-1 border border-zinc-300 rounded overflow-hidden bg-white">
        <OrthoView design={design} view="front" title="正視圖" titleEn="FRONT" />
      </div>
      <div className="flex-1 border border-zinc-300 rounded overflow-hidden bg-white">
        <OrthoView design={design} view="side" title="側視圖" titleEn="SIDE" />
      </div>
      <div className="flex-1 border border-zinc-300 rounded overflow-hidden bg-white">
        <OrthoView design={design} view="top" title="俯視圖" titleEn="TOP" />
      </div>
    </div>
  );
}

/**
 * 零件分類——用 id 前綴判斷屬於哪個結構分組，方便材料單視覺切分。
 * 順序即為顯示順序。
 */
export type PartCategory =
  | "case"       // 櫃體結構：頂底板、側板、背板
  | "divider"    // 層板 / 分隔板 / 中柱
  | "drawer"     // 抽屜組件
  | "door"       // 門組件
  | "apron"      // 牙板 / 橫撐（桌椅）
  | "seat"       // 座板 / 椅背板（椅）
  | "leg"        // 椅腳 / 桌腳 / 底座
  | "misc";

const CATEGORY_ORDER: PartCategory[] = [
  "case", "divider", "drawer", "door", "apron", "seat", "leg", "misc",
];

const CATEGORY_LABEL: Record<PartCategory, string> = {
  case: "🗄️ 櫃體結構",
  divider: "═ 層板 / 分隔板",
  drawer: "🧺 抽屜",
  door: "🚪 門",
  apron: "━ 牙板 / 橫撐",
  seat: "🪑 座板 / 椅背",
  leg: "🦵 腳 / 底座",
  misc: "⚙ 其他",
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

export function categorizePart(id: string): PartCategory {
  // 抽屜組件：z*-drawer-N-face / front / back / side / bottom
  if (/^z?\d*-?drawer-?\d*-(face|front|back|side|bottom)/.test(id))
    return "drawer";
  if (/drawer-col-partition/.test(id)) return "divider";
  // 門組件
  if (/-door-.*-(rail|stile|panel|glass)/.test(id)) return "door";
  // 櫃體主結構
  if (id === "top" || id === "bottom" || id === "back") return "case";
  if (/^side-(left|right)$/.test(id)) return "case";
  // 分隔板 / 層板 / zone boundary / col partition
  if (
    /^shelf-/.test(id) ||
    /-shelf-/.test(id) ||
    /-divider-/.test(id) ||
    /-boundary/.test(id) ||
    /^col-partition/.test(id) ||
    /col-partition-/.test(id)
  )
    return "divider";
  // 牙板 / 橫撐
  if (
    /^apron/.test(id) ||
    /^stretcher/.test(id) ||
    /^ls-/.test(id) ||
    id === "center-stretcher" ||
    id === "back-rail" ||
    id === "back-top-rail"
  )
    return "apron";
  // 座板 / 椅背
  if (id === "seat" || /^seat-/.test(id)) return "seat";
  if (/^back-slat/.test(id) || /^back-splat/.test(id) || /^splat/.test(id))
    return "seat";
  if (/^slat/.test(id) || /^rung/.test(id)) return "seat";
  // 腳類 / 托腳牙 / 底座
  if (
    /^leg-/.test(id) ||
    /^bracket-/.test(id) ||
    /^plinth/.test(id) ||
    /^side-extension/.test(id)
  )
    return "leg";
  // 其他（吊衣桿、特殊件）
  return "misc";
}

export function MaterialList({ design }: { design: FurnitureDesign }) {
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
  const fmt = (n: number): string => {
    const rounded = Math.round(n * 10) / 10;
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  };

  const rows = design.parts.map((part) => {
    const cut = calculateCutDimensions(part);
    const isGlass = part.visual === "glass";
    const volMm3 = cut.length * cut.width * cut.thickness;
    // 玻璃不算木材材積（另向玻璃行訂製）；不累計 totalBdft / bdftByMaterial
    const bdft = isGlass ? 0 : volMm3 / MM3_PER_BDFT;
    if (!isGlass) totalBdft += bdft;
    // 拼板：顯示「桌面板 ×3 (each 200 × 1500 × 30mm)」讓學員按片下料
    const pieces = Math.max(1, Math.round(part.panelPieces ?? 1));

    const billable = effectiveBillableMaterial(part);
    const materialLabel = isGlass
      ? `${cut.thickness}mm 強化玻璃`
      : billable === "plywood" || billable === "mdf"
        ? `${MATERIALS[part.material].nameZh} / ${SHEET_GOOD_LABEL[billable]}`
        : MATERIALS[part.material].nameZh;

    if (!isGlass) {
      const groupKey =
        billable === "plywood" || billable === "mdf"
          ? SHEET_GOOD_LABEL[billable]
          : MATERIALS[part.material].nameZh;
      bdftByMaterial.set(groupKey, (bdftByMaterial.get(groupKey) ?? 0) + bdft);
    }

    const tenonNotes = isGlass
      ? "另向玻璃行訂製，不入裁切"
      : part.tenons.length
        ? part.tenons
            .map(
              (t) =>
                `${t.position} ${t.length}mm ${JOINERY_LABEL[t.type] ?? t.type}`,
            )
            .join("、")
        : "—";

    const category = categorizePart(part.id);

    return { part, cut, bdft, materialLabel, tenonNotes, category, isGlass, pieces };
  });

  // 依分類排序 + 每類內的原有順序（stable sort）
  // 玻璃單獨抽出來，不混在木材分類裡（玻璃行訂製，跟木工區隔）
  const byCategory = new Map<PartCategory, typeof rows>();
  const glassRows: typeof rows = [];
  for (const r of rows) {
    if (r.isGlass) {
      glassRows.push(r);
      continue;
    }
    if (!byCategory.has(r.category)) byCategory.set(r.category, []);
    byCategory.get(r.category)!.push(r);
  }
  const sortedCategories = CATEGORY_ORDER.filter((c) => byCategory.has(c));

  return (
    <table className="w-full text-sm">
      <thead className="bg-zinc-100">
        <tr>
          <th className="text-left p-2">零件</th>
          <th className="text-left p-2">材質</th>
          <th className="text-right p-2">可見長 × 寬 × 厚 (mm)</th>
          <th className="text-right p-2">切料尺寸 (mm)</th>
          <th className="text-right p-2">材積（板才）</th>
          <th className="text-left p-2">榫頭備註</th>
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
                  · {catRows.length} 件
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
                const piecesPrefix = pieces > 1 ? `${pieces} 片 × ` : "";
                return (
                  <tr key={part.id} className="border-b border-zinc-100">
                    <td className="p-2 pl-3 relative">
                      <span className={`absolute left-0 top-0 bottom-0 w-1 ${color.bar} opacity-50`} />
                      {part.nameZh}
                      {pieces > 1 && (
                        <span className="ml-1 text-[10px] text-amber-700 bg-amber-100 px-1 rounded">
                          拼 {pieces} 片
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
              🪟 玻璃（另向玻璃行訂製，不入裁切）
              <span className="ml-2 font-normal text-sky-700">· {glassRows.length} 片</span>
            </td>
            <td className="px-2 py-1.5 text-right text-xs font-mono text-sky-700">—</td>
            <td />
          </tr>
          <tr className="bg-sky-50/60">
            <td colSpan={6} className="px-3 py-1.5 text-[11px] text-sky-800 italic">
              ⚠️ 此尺寸僅供參考——實際應在門片做完、量過實際開口後再向玻璃行下單，
              避免框料切削誤差導致玻璃尺寸不合。
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
                <td className="p-2">{part.nameZh}</td>
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
      <tfoot className="bg-zinc-100 border-t-2 border-zinc-400">
        <tr>
          <td className="p-2 font-semibold" colSpan={4}>
            合計
            <span className="ml-3 text-xs text-zinc-500 font-normal">
              {[...bdftByMaterial.entries()]
                .map(([k, v]) => `${k} ${v.toFixed(2)} 板才`)
                .join("　・　")}
            </span>
          </td>
          <td className="p-2 text-right font-mono font-semibold">
            {totalBdft.toFixed(2)}
          </td>
          <td className="p-2 text-xs text-zinc-500">未含 10% 切料損耗</td>
        </tr>
      </tfoot>
    </table>
  );
}
