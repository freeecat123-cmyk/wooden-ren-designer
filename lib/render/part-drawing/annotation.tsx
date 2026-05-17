/**
 * <T1Dimensions> + <T1DimensionsRow> — 零件圖 T1 整體尺寸標註
 *
 * 第三角投影慣例（與 OrthoView 一致）：
 *   front view: 水平 = length（長），垂直 = thickness（厚）
 *   top view:   水平 = length（長），垂直 = width（寬）
 *   side view:  水平 = width（寬），  垂直 = thickness（厚）
 *
 * Phase 1：以 text row 形式輸出在每張 OrthoView 下方（穩、無對位風險）。
 * Phase 2：T1Dimensions 升級成 SVG overlay，透過 OrthoView.overlayContent slot
 * 注入；T1DimensionsRow 仍保留 export 作為印製預覽或 fallback 用。
 *
 * Spec: docs/superpowers/specs/2026-05-17-part-drawings-phase-2-design.md §1
 */

import React from "react";
import type { FurnitureDesign, Mortise, Part, Tenon } from "@/lib/types";
import {
  DimensionLine,
  VerticalDimensionLine,
  LATHE_SEG,
  mortiseLocalBox,
  tenonLocalBox,
  type OrthoViewBoxCtx,
} from "@/lib/render/svg-views";

const round1 = (n: number) => Math.round(n * 10) / 10;

export type PartView = "front" | "side" | "top";

/**
 * 取得單一 view 在第三角法下的水平/垂直 mm 尺寸。
 */
export function getT1ForView(part: Part, view: PartView): {
  horiz: number;
  vert: number;
  horizLabel: string;
  vertLabel: string;
} {
  const L = round1(part.visible.length);
  const W = round1(part.visible.width);
  const T = round1(part.visible.thickness);
  const horiz = view === "side" ? W : L;
  const vert = view === "top" ? W : T;
  const horizLabel = view === "side" ? "寬" : "長";
  const vertLabel = view === "top" ? "寬" : "厚";
  return { horiz, vert, horizLabel, vertLabel };
}

/**
 * T1 整體尺寸 SVG overlay（Phase 2 啟用）。
 *
 * 透過 OrthoView 提供的 ctx.partLocalToSvg 把 part-local mm 轉成 SVG px，
 * 再以 DimensionLine / VerticalDimensionLine 畫水平 + 垂直尺寸線。
 *
 * 端點取得（part-local 慣例：length=X、thickness=Y、width=Z）：
 *   front view (vy=wy, vx=-wx)
 *     horiz: localX = ±L/2 在 thickness 底面（localY=+T/2）
 *     vert:  localY = ±T/2 在 length 左端 = localX=-L/2（SVG 右側，因 X 被負）
 *   top view (vy=wz, vx=-wx)
 *     horiz: localX = ±L/2 在 width 前緣（localZ=+W/2，SVG 較大 y）
 *     vert:  localZ = ±W/2 在 length 左端 = localX=-L/2（SVG 右側）
 *   side view (vy=wy, vx=wz)
 *     horiz: localZ = ±W/2 在 thickness 底面（localY=+T/2）
 *     vert:  localY = ±T/2 在 width 右端 = localZ=+W/2（SVG 右側）
 *
 * 尺寸線位置：水平線下方 +28（DimensionLine 內部 reach=26 預留），
 * 垂直線右側 +28。
 *
 * Spec: docs/superpowers/specs/2026-05-17-part-drawings-phase-2-design.md §1
 */
export function T1Dimensions({
  ctx,
  part,
  view,
}: {
  ctx: OrthoViewBoxCtx;
  part: Part;
  view: PartView;
}) {
  const { horiz, vert, horizLabel, vertLabel } = getT1ForView(part, view);
  const L = part.visible.length;
  const W = part.visible.width;
  const T = part.visible.thickness;
  const arrowId = `arr-${view}`;
  // T1 dim line 距 part 邊緣（水平用小、垂直保留大 — 垂直方向有 T2 shoulder
  // dim 跟榫頭 box 容易撞，故 vert 端離遠一點）
  const HORIZ_OFFSET = 18;
  const VERT_OFFSET = 50;
  const GROSS_GAP = 14; // SVG px；含榫總長 dim 距 T1 dim line

  let horizP1: { x: number; y: number };
  let horizP2: { x: number; y: number };
  let vertP1: { x: number; y: number };
  let vertP2: { x: number; y: number };

  if (view === "front") {
    // 底面 = localY = +T/2（SVG 較大 y）
    horizP1 = ctx.partLocalToSvg(-L / 2, +T / 2, 0);
    horizP2 = ctx.partLocalToSvg(+L / 2, +T / 2, 0);
    // 右側 = localX = -L/2（投影後 SVG 較大 x）
    vertP1 = ctx.partLocalToSvg(-L / 2, -T / 2, 0);
    vertP2 = ctx.partLocalToSvg(-L / 2, +T / 2, 0);
  } else if (view === "top") {
    horizP1 = ctx.partLocalToSvg(-L / 2, 0, +W / 2);
    horizP2 = ctx.partLocalToSvg(+L / 2, 0, +W / 2);
    vertP1 = ctx.partLocalToSvg(-L / 2, 0, -W / 2);
    vertP2 = ctx.partLocalToSvg(-L / 2, 0, +W / 2);
  } else {
    // side
    horizP1 = ctx.partLocalToSvg(0, +T / 2, -W / 2);
    horizP2 = ctx.partLocalToSvg(0, +T / 2, +W / 2);
    vertP1 = ctx.partLocalToSvg(0, -T / 2, +W / 2);
    vertP2 = ctx.partLocalToSvg(0, +T / 2, +W / 2);
  }

  // 水平 dim line 放材料 *上方* — 抓 part 8 角投影最高 SVG y（最小值）再上推 OFFSET
  // 之前用 max 2 個 horizP 端點 y 不夠保險（圓料/扁料 bbox 跟邊不一定一致）
  const allCorners = [
    ctx.partLocalToSvg(-L / 2, -T / 2, -W / 2),
    ctx.partLocalToSvg(+L / 2, -T / 2, -W / 2),
    ctx.partLocalToSvg(-L / 2, +T / 2, -W / 2),
    ctx.partLocalToSvg(+L / 2, +T / 2, -W / 2),
    ctx.partLocalToSvg(-L / 2, -T / 2, +W / 2),
    ctx.partLocalToSvg(+L / 2, -T / 2, +W / 2),
    ctx.partLocalToSvg(-L / 2, +T / 2, +W / 2),
    ctx.partLocalToSvg(+L / 2, +T / 2, +W / 2),
  ];
  const partMinY = Math.min(...allCorners.map((p) => p.y));
  const partMaxX = Math.max(...allCorners.map((p) => p.x));
  const horizY = partMinY - HORIZ_OFFSET;
  const vertX = partMaxX + VERT_OFFSET;

  // 連榫頭總長：把所有 tenon bbox 8 corners 投影併入 → 算 gross 比 partBody 大多少
  const grossCorners: { x: number; y: number }[] = [...allCorners];
  for (const t of part.tenons) {
    if (t.length <= 0) continue;
    const lb = tenonLocalBox(part, t);
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        for (const sz of [-1, 1]) {
          grossCorners.push(
            ctx.partLocalToSvg(
              lb.cx + sx * lb.hx,
              lb.cy + sy * lb.hy,
              lb.cz + sz * lb.hz,
            ),
          );
        }
      }
    }
  }
  const grossMinX = Math.min(...grossCorners.map((p) => p.x));
  const grossMaxX = Math.max(...grossCorners.map((p) => p.x));
  const grossMinY = Math.min(...grossCorners.map((p) => p.y));
  const grossMaxY = Math.max(...grossCorners.map((p) => p.y));
  const partWidthSvg =
    Math.max(...allCorners.map((p) => p.x)) -
    Math.min(...allCorners.map((p) => p.x));
  const partHeightSvg =
    Math.max(...allCorners.map((p) => p.y)) -
    Math.min(...allCorners.map((p) => p.y));
  const svgPerMmX =
    horiz > 0.1 && partWidthSvg > 1 ? partWidthSvg / horiz : 1;
  const svgPerMmY =
    vert > 0.1 && partHeightSvg > 1 ? partHeightSvg / vert : 1;
  const horizGross = round1((grossMaxX - grossMinX) / svgPerMmX);
  const vertGross = round1((grossMaxY - grossMinY) / svgPerMmY);
  const showHorizGross = horizGross - horiz > 0.5;
  const showVertGross = vertGross - vert > 0.5;

  // 自己畫 dim line + extension（DimensionLine 預設 extension 朝上、不適合
  // 我們 dim line 在 part 上方的場景——應該朝 part 下方延伸）
  const sortedX = [horizP1.x, horizP2.x].sort((a, b) => a - b);
  const hxLo = sortedX[0];
  const hxHi = sortedX[1];
  const hPartY = Math.min(horizP1.y, horizP2.y); // part edge SVG y（dim line 下方就是 part）
  const sortedY = [vertP1.y, vertP2.y].sort((a, b) => a - b);
  const vyLo = sortedY[0];
  const vyHi = sortedY[1];
  const vPartX = Math.max(vertP1.x, vertP2.x); // part edge SVG x（dim line 左邊就是 part）

  const ARROW = 3;
  return (
    <g
      className="t1-dim-overlay"
      stroke="#111"
      fill="#111"
      strokeWidth={0.4}
      fontFamily="sans-serif"
    >
      {/* 水平 dim line：dim line 在 part 上方、extension 從 dim line 往下拉到
          part edge 外側（留 2mm gap、不越過 part 邊）。CNS：dim line 上方再
          protrusion 2mm。 */}
      <line x1={hxLo} y1={horizY - 2} x2={hxLo} y2={hPartY - 2} strokeWidth={0.25} stroke="#888" />
      <line x1={hxHi} y1={horizY - 2} x2={hxHi} y2={hPartY - 2} strokeWidth={0.25} stroke="#888" />
      <line x1={hxLo} y1={horizY} x2={hxHi} y2={horizY} />
      <polygon points={`${hxLo},${horizY} ${hxLo + ARROW},${horizY - ARROW} ${hxLo + ARROW},${horizY + ARROW}`} />
      <polygon points={`${hxHi},${horizY} ${hxHi - ARROW},${horizY - ARROW} ${hxHi - ARROW},${horizY + ARROW}`} />
      <text x={(hxLo + hxHi) / 2} y={horizY - 4} textAnchor="middle" fontSize={11} stroke="none">
        {`${horizLabel} ${horiz}`}
      </text>

      {/* 連榫頭總長 dim：在水平 dim 上方再加一條，跨整個 gross bbox */}
      {showHorizGross && (
        <g>
          <line
            x1={grossMinX}
            y1={horizY - GROSS_GAP - 2}
            x2={grossMinX}
            y2={horizY - 2}
            strokeWidth={0.25}
            stroke="#888"
          />
          <line
            x1={grossMaxX}
            y1={horizY - GROSS_GAP - 2}
            x2={grossMaxX}
            y2={horizY - 2}
            strokeWidth={0.25}
            stroke="#888"
          />
          <line
            x1={grossMinX}
            y1={horizY - GROSS_GAP}
            x2={grossMaxX}
            y2={horizY - GROSS_GAP}
          />
          <polygon
            points={`${grossMinX},${horizY - GROSS_GAP} ${grossMinX + ARROW},${horizY - GROSS_GAP - ARROW} ${grossMinX + ARROW},${horizY - GROSS_GAP + ARROW}`}
          />
          <polygon
            points={`${grossMaxX},${horizY - GROSS_GAP} ${grossMaxX - ARROW},${horizY - GROSS_GAP - ARROW} ${grossMaxX - ARROW},${horizY - GROSS_GAP + ARROW}`}
          />
          <text
            x={(grossMinX + grossMaxX) / 2}
            y={horizY - GROSS_GAP - 4}
            textAnchor="middle"
            fontSize={11}
            stroke="none"
          >
            {`含榫 ${horizGross}`}
          </text>
        </g>
      )}

      {/* 垂直 dim line：dim line 在 part 右方、extension 從 dim line 往左拉到
          part edge 外側（留 2mm gap、不越過 part 邊）。 */}
      <line x1={vertX + 2} y1={vyLo} x2={vPartX + 2} y2={vyLo} strokeWidth={0.25} stroke="#888" />
      <line x1={vertX + 2} y1={vyHi} x2={vPartX + 2} y2={vyHi} strokeWidth={0.25} stroke="#888" />
      <line x1={vertX} y1={vyLo} x2={vertX} y2={vyHi} />
      <polygon points={`${vertX},${vyLo} ${vertX - ARROW},${vyLo + ARROW} ${vertX + ARROW},${vyLo + ARROW}`} />
      <polygon points={`${vertX},${vyHi} ${vertX - ARROW},${vyHi - ARROW} ${vertX + ARROW},${vyHi - ARROW}`} />
      <text x={vertX + 4} y={(vyLo + vyHi) / 2 + 4} fontSize={11} stroke="none">
        {`${vertLabel} ${vert}`}
      </text>

      {/* 連榫頭總長 dim（垂直）：vertical dim 右方再加一條 */}
      {showVertGross && (
        <g>
          <line
            x1={vertX + GROSS_GAP + 2}
            y1={grossMinY}
            x2={vertX + 2}
            y2={grossMinY}
            strokeWidth={0.25}
            stroke="#888"
          />
          <line
            x1={vertX + GROSS_GAP + 2}
            y1={grossMaxY}
            x2={vertX + 2}
            y2={grossMaxY}
            strokeWidth={0.25}
            stroke="#888"
          />
          <line
            x1={vertX + GROSS_GAP}
            y1={grossMinY}
            x2={vertX + GROSS_GAP}
            y2={grossMaxY}
          />
          <polygon
            points={`${vertX + GROSS_GAP},${grossMinY} ${vertX + GROSS_GAP - ARROW},${grossMinY + ARROW} ${vertX + GROSS_GAP + ARROW},${grossMinY + ARROW}`}
          />
          <polygon
            points={`${vertX + GROSS_GAP},${grossMaxY} ${vertX + GROSS_GAP - ARROW},${grossMaxY - ARROW} ${vertX + GROSS_GAP + ARROW},${grossMaxY - ARROW}`}
          />
          <text
            x={vertX + GROSS_GAP + 4}
            y={(grossMinY + grossMaxY) / 2 + 4}
            fontSize={11}
            stroke="none"
          >
            {`含榫 ${vertGross}`}
          </text>
        </g>
      )}
    </g>
  );
}

/**
 * Text-row 形式（Phase 1 用）：放在 OrthoView 下方一行純文字。
 * 每張 view 一條，例：「長 720　厚 40」。
 * 1 位小數 round（per feedback_ui_number_precision）。
 */
export function T1DimensionsRow({
  part,
  view,
  className,
}: {
  part: Part;
  view: PartView;
  className?: string;
}) {
  const { horiz, vert, horizLabel, vertLabel } = getT1ForView(part, view);
  return (
    <div
      className={`text-[10px] text-zinc-600 text-center mt-1 tabular-nums ${
        className ?? ""
      }`}
    >
      {horizLabel} {horiz}　{vertLabel} {vert}
    </div>
  );
}

/**
 * T2 label list — text rows below the 3-view grid listing each mortise/tenon
 * with dimensions and 距底 reference.
 *
 * Phase 1：簡單條列、無 leader line。Phase 2 會把 leader 從 dimension box 拉到
 * label。
 *
 * Format:
 *   榫眼N（depth-axis）：W×L 深 D，距底 Y
 *   榫頭N（position）：W×T 長 L，距底 Y
 *
 * 慣例：
 * - 1 位小數 round（feedback_ui_number_precision）
 * - mortise 沒有 `position` 欄位（depth axis 是 auto-detect），用 origin 推
 *   出進榫面當位置 hint
 * - tenon `length` 即「protrusion 長度」（沒有獨立的 depth 欄位）
 * - 「距底」= part 底面到 feature 中心的 Y 距離 = `cy + thickness/2`
 *
 * Spec: docs/superpowers/specs/2026-05-16-part-drawings-design.md §3.3 / §3.4
 */
interface MatchResult {
  partId: string;
  kind: "mortise" | "tenon";
  idx: number;
}

/**
 * 算 feature 的世界座標中心（mm）。
 *
 * - Mortise: `part.origin + mortise.origin`（origin 直接是 part-local mm）
 * - Tenon:   `part.origin + position-dependent offset`，沿端面外凸方向取
 *   `+length/2` 大致對中（端面對端面的榫頭—榫眼大概會落在 part 表面附近 ±length/2 內）。
 *   `offsetWidth/offsetThickness` 是斷面上的偏移，這裡也要納入。
 *
 * 注意：這只是一個粗略估算，目的是給 findMatchingFeature 比對「世界座標
 * 相鄰」用。15mm 容差吸收 part rotation/visible.length≠center-distance 的誤差。
 */
function featureWorldCenter(
  part: Part,
  feature: Mortise | Tenon,
  kind: "mortise" | "tenon",
): { x: number; y: number; z: number } {
  const px = part.origin?.x ?? 0;
  const py = part.origin?.y ?? 0;
  const pz = part.origin?.z ?? 0;
  if (kind === "mortise") {
    const m = feature as Mortise;
    return {
      x: px + (m.origin?.x ?? 0),
      y: py + (m.origin?.y ?? 0),
      z: pz + (m.origin?.z ?? 0),
    };
  }
  const t = feature as Tenon;
  const halfL = (part.visible.length ?? 0) / 2;
  const halfW = (part.visible.width ?? 0) / 2;
  const T = part.visible.thickness ?? 0;
  const offW = t.offsetWidth ?? 0;
  const offT = t.offsetThickness ?? 0;
  switch (t.position) {
    case "top":
      return { x: px + offW, y: py + T, z: pz + offT };
    case "bottom":
      return { x: px + offW, y: py, z: pz + offT };
    case "start":
      return { x: px - halfL, y: py + offT, z: pz + offW };
    case "end":
      return { x: px + halfL, y: py + offT, z: pz + offW };
    case "left":
      return { x: px + offT, y: py + offW, z: pz - halfW };
    case "right":
      return { x: px + offT, y: py + offW, z: pz + halfW };
    default:
      return { x: px, y: py, z: pz };
  }
}

/**
 * 找另一件零件上跟本 feature 配對的 mortise↔tenon。啟發式：
 * - 世界座標相鄰（中心距 < 15mm）
 * - 尺寸大致一致（width/length 差 ≤ 50%）
 *
 * 找不到合理候選回 null。多個候選取最近的。
 *
 * Spec: docs/superpowers/specs/2026-05-17-part-drawings-phase-2-design.md §6
 */
export function findMatchingFeature(
  part: Part,
  featureIdx: number,
  featureKind: "mortise" | "tenon",
  design: FurnitureDesign,
): MatchResult | null {
  const feature =
    featureKind === "mortise"
      ? part.mortises[featureIdx]
      : part.tenons[featureIdx];
  if (!feature) return null;

  const fCenter = featureWorldCenter(part, feature, featureKind);
  const targetKind: "mortise" | "tenon" =
    featureKind === "mortise" ? "tenon" : "mortise";

  // 自己 feature 的尺寸（用 width/length 做 sanity check）
  const fW = feature.width ?? 0;
  const fL =
    featureKind === "mortise"
      ? (feature as Mortise).length ?? 0
      : (feature as Tenon).length ?? 0;

  let best: { dist: number; result: MatchResult } | null = null;

  for (const other of design.parts) {
    if (other.id === part.id) continue;
    const list: Array<Mortise | Tenon> =
      targetKind === "mortise" ? other.mortises : other.tenons;
    for (let i = 0; i < list.length; i++) {
      const o = list[i];
      const oCenter = featureWorldCenter(other, o, targetKind);
      const dist = Math.hypot(
        oCenter.x - fCenter.x,
        oCenter.y - fCenter.y,
        oCenter.z - fCenter.z,
      );
      if (dist > 15) continue;

      // Size sanity: width / length within ~50%
      const oW = o.width ?? 0;
      const oL =
        targetKind === "mortise"
          ? (o as Mortise).length ?? 0
          : (o as Tenon).length ?? 0;
      if (fW && oW && Math.abs(fW - oW) / Math.max(fW, oW) > 0.5) continue;
      if (fL && oL && Math.abs(fL - oL) / Math.max(fL, oL) > 0.5) continue;

      if (best === null || dist < best.dist) {
        best = { dist, result: { partId: other.id, kind: targetKind, idx: i } };
      }
    }
  }
  return best?.result ?? null;
}

export function T2LabelList({
  part,
  design,
}: {
  part: Part;
  design?: FurnitureDesign;
}) {
  const round1 = (n: number) => Math.round(n * 10) / 10;
  const ly = part.visible.thickness;

  /** 從 mortise.origin 推測 entry face（純 display hint，不影響幾何）。 */
  const mortiseFaceHint = (m: Part["mortises"][number]): string => {
    const lx = part.visible.length;
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
    const yIsCanonical = m.origin.y === 0 || m.origin.y === ly;
    if (yIsCanonical && (xToFace < ly / 2 || zToFace < ly / 2)) {
      return xToFace <= zToFace
        ? m.origin.x >= 0
          ? "右端"
          : "左端"
        : m.origin.z >= 0
          ? "前面"
          : "背面";
    }
    if (yToFace <= xToFace && yToFace <= zToFace) {
      return m.origin.y > ly / 2 ? "頂面" : "底面";
    }
    if (xToFace <= zToFace) return m.origin.x >= 0 ? "右端" : "左端";
    return m.origin.z >= 0 ? "前面" : "背面";
  };

  /**
   * Phase 2.5 Task 4：偵測通榫 vs 盲榫。
   * 優先吃 `m.through` flag；fallback 用 depth ≥ 95% × thickness 的 heuristic
   * （木匠視角：榫眼幾乎打穿就視為通榫）。
   */
  const isThroughMortise = (m: Part["mortises"][number]): boolean => {
    if (m.through) return true;
    const t = part.visible?.thickness ?? 0;
    return t > 0 && (m.depth ?? 0) >= t * 0.95;
  };

  const lines: string[] = [];

  part.mortises.forEach((m, idx) => {
    const W = round1(m.width);
    const L = round1(m.length);
    const D = round1(m.depth);
    const lb = mortiseLocalBox(part, m);
    const yFromBottom = round1(lb.cy + ly / 2);
    const face = mortiseFaceHint(m);
    const through = isThroughMortise(m);
    // Phase 2.5 Task 4：通榫 → 「W×L 通」；盲榫 → 「W×L 深 D」
    const dimText = through ? `${W}×${L} 通` : `${W}×${L} 深 ${D}`;
    let line = `榫眼${idx + 1}（${face}）：${dimText}，距底 ${yFromBottom}`;
    if (design) {
      const match = findMatchingFeature(part, idx, "mortise", design);
      if (match) {
        const label = match.kind === "tenon" ? "榫頭" : "榫眼";
        line += `　↔ ${match.partId} ${label}${match.idx + 1}`;
      }
    }
    lines.push(line);
  });

  part.tenons.forEach((t, idx) => {
    const W = round1(t.width);
    const T = round1(t.thickness);
    // Tenon `length` 就是榫頭凸出長度（沒有獨立 depth 欄位）
    const protrusion = round1(t.length);
    const lb = tenonLocalBox(part, t);
    const yFromBottom = round1(lb.cy + ly / 2);
    let line = `榫頭${idx + 1}（${t.position}）：${W}×${T} 長 ${protrusion}，距底 ${yFromBottom}`;
    if (design) {
      const match = findMatchingFeature(part, idx, "tenon", design);
      if (match) {
        const label = match.kind === "mortise" ? "榫眼" : "榫頭";
        line += `　↔ ${match.partId} ${label}${match.idx + 1}`;
      }
    }
    lines.push(line);
  });

  if (!lines.length) return null;
  return (
    <ul className="text-[10px] text-zinc-700 list-none mt-2 space-y-0.5 font-mono tabular-nums">
      {lines.map((l, i) => (
        <li key={i}>{l}</li>
      ))}
    </ul>
  );
}

/**
 * T2 joinery feature dashed bounding boxes (Phase 2 activated).
 *
 * 在每張 OrthoView 內疊一層 SVG `<g>`，於 mortise/tenon 投影位置畫細虛 box：
 *   - mortise: 虛線 `2 2` / `#666` / 0.6 mm（埋進母件，視覺上偏冷）
 *   - tenon:   虛線 `3 1.5` / `#888` / 0.5 mm（凸出部分，視覺上更細）
 * 兩種風格區分明確，木匠看圖時一眼分得出公榫 vs 母榫。
 *
 * 投影方式：把 `mortiseLocalBox` / `tenonLocalBox` 的 8 個角用 ctx.partLocalToSvg
 * 轉成 SVG 座標、取 AABB（part 有 rotation 時也能正確包到整個範圍）。
 *
 * 太小的 feature（< 0.5 mm × 0.5 mm 投影面積）略過避免製造噪點。
 * Phase 3 會再加 leader line + 對應 T2LabelList 編號。
 *
 * Spec: docs/superpowers/specs/2026-05-17-part-drawings-phase-2-design.md §2
 */
export function T2Annotations({
  ctx,
  part,
  view,
}: {
  ctx: OrthoViewBoxCtx;
  part: Part;
  view: PartView;
}) {
  const projectBoxRect = (box: {
    cx: number; cy: number; cz: number;
    hx: number; hy: number; hz: number;
  }): { x: number; y: number; w: number; h: number } | null => {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        for (const sz of [-1, 1]) {
          const p = ctx.partLocalToSvg(
            box.cx + sx * box.hx,
            box.cy + sy * box.hy,
            box.cz + sz * box.hz,
          );
          if (p.x < minX) minX = p.x;
          if (p.x > maxX) maxX = p.x;
          if (p.y < minY) minY = p.y;
          if (p.y > maxY) maxY = p.y;
        }
      }
    }
    const w = maxX - minX;
    const h = maxY - minY;
    if (w < 0.5 || h < 0.5) return null;
    return { x: minX, y: minY, w, h };
  };

  type Item = {
    kind: "m" | "t";
    idx: number;
    rect: { x: number; y: number; w: number; h: number };
    name: string;
    dims: string;
    /** 基準距：對稱件用「距中 X/Z」、其他用「距底 Y」（依當前 view 軸取捨）。 */
    baseline: string;
  };
  const items: Item[] = [];

  /**
   * Mortise entry-aligned box：偵測 entry face、box 從 entry face 往 part 內部
   * 延伸 depth。傳回 part-local CENTERED frame 的 box，方便用 partLocalToSvg。
   * 比 mortiseLocalBox 直觀——榫眼從哪面進、就從哪面開始畫。
   */
  function mortiseEntryBox(m: Mortise): {
    cx: number; cy: number; cz: number;
    hx: number; hy: number; hz: number;
    depthAxis: "x" | "y" | "z";
  } {
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
    const yIsCanonical = m.origin.y === 0 || m.origin.y === ly;
    let depthAxis: "x" | "y" | "z";
    if (yIsCanonical && (xToFace < ly / 2 || zToFace < ly / 2)) {
      depthAxis = xToFace <= zToFace ? "x" : "z";
    } else if (yToFace <= xToFace && yToFace <= zToFace) {
      depthAxis = "y";
    } else if (xToFace <= zToFace) {
      depthAxis = "x";
    } else {
      depthAxis = "z";
    }

    const D = m.depth;
    const W = m.width;
    const L = m.length;
    const longDim = Math.max(L, W);
    const shortDim = Math.min(L, W);
    // Auto-fit：把 longDim 放在「origin 較居中、空間較大」的軸（跟 mortiseLocalBox
    // 一致，避免 3-view 跟 part-drawing 同 mortise 軸向反轉）

    const oxC = m.origin.x;
    const oyC = m.origin.y - ly / 2;
    const ozC = m.origin.z;

    if (depthAxis === "y") {
      const enterTop = m.origin.y > ly / 2;
      const entryY = enterTop ? +ly / 2 : -ly / 2;
      const cyL = enterTop ? entryY - D / 2 : entryY + D / 2;
      const xFace = Math.min(Math.abs(oxC - lx / 2), Math.abs(oxC + lx / 2));
      const zFace = Math.min(Math.abs(ozC - lz / 2), Math.abs(ozC + lz / 2));
      const longOnZ = zFace > xFace;
      return {
        cx: m.origin.x,
        cy: cyL,
        cz: m.origin.z,
        hx: (longOnZ ? shortDim : longDim) / 2,
        hy: D / 2,
        hz: (longOnZ ? longDim : shortDim) / 2,
        depthAxis: "y",
      };
    } else if (depthAxis === "x") {
      const enterRight = m.origin.x >= 0;
      const cxL = enterRight ? lx / 2 - D / 2 : -lx / 2 + D / 2;
      const yFace = Math.min(Math.abs(oyC - ly / 2), Math.abs(oyC + ly / 2));
      const zFace = Math.min(Math.abs(ozC - lz / 2), Math.abs(ozC + lz / 2));
      const longOnZ = zFace > yFace;
      return {
        cx: cxL,
        cy: oyC,
        cz: m.origin.z,
        hx: D / 2,
        hy: (longOnZ ? shortDim : longDim) / 2,
        hz: (longOnZ ? longDim : shortDim) / 2,
        depthAxis: "x",
      };
    } else {
      // depthAxis === "z"
      const enterFront = m.origin.z >= 0;
      const czL = enterFront ? lz / 2 - D / 2 : -lz / 2 + D / 2;
      const xFace = Math.min(Math.abs(oxC - lx / 2), Math.abs(oxC + lx / 2));
      const yFace = Math.min(Math.abs(oyC - ly / 2), Math.abs(oyC + ly / 2));
      const longOnX = xFace > yFace;
      return {
        cx: m.origin.x,
        cy: oyC,
        cz: czL,
        hx: (longOnX ? longDim : shortDim) / 2,
        hy: (longOnX ? shortDim : longDim) / 2,
        hz: D / 2,
        depthAxis: "z",
      };
    }
  }

  // 對稱件偵測：座板 / 椅面 / 圓桌面 等寬度方向對稱（mortise 在 X 軸或 Z 軸兩側）
  // 偵測啟發式：mortises 存在 +X 跟 -X 兩側、或 +Z 跟 -Z 兩側 → 對稱件
  const xs = part.mortises.map((m) => m.origin?.x ?? 0);
  const zs = part.mortises.map((m) => m.origin?.z ?? 0);
  const hasPlusX = xs.some((x) => x > 1);
  const hasMinusX = xs.some((x) => x < -1);
  const hasPlusZ = zs.some((z) => z > 1);
  const hasMinusZ = zs.some((z) => z < -1);
  const symmetricX = hasPlusX && hasMinusX;
  const symmetricZ = hasPlusZ && hasMinusZ;
  const isSymmetricPart = symmetricX || symmetricZ;

  /** 依 view + 對稱性給出基準距字串。 */
  const baselineFor = (
    lb: { cx: number; cy: number; cz: number; hy: number },
  ): string => {
    const distFromBot = round1(lb.cy + lb.hy);
    if (!isSymmetricPart) {
      return `距底 ${distFromBot}`;
    }
    // 對稱件用 距中心軸
    if (view === "top") {
      // top view: 看 X×Z, 取 X 跟 Z 距中
      const dx = round1(Math.abs(lb.cx));
      const dz = round1(Math.abs(lb.cz));
      return `距中 X${dx} Z${dz}`;
    } else if (view === "front") {
      // front view: 看 X×Y, X 軸距中 + 距底
      const dx = round1(Math.abs(lb.cx));
      return `距中 X${dx}　距底 ${distFromBot}`;
    } else {
      // side view: 看 Z×Y, Z 軸距中 + 距底
      const dz = round1(Math.abs(lb.cz));
      return `距中 Z${dz}　距底 ${distFromBot}`;
    }
  };

  part.mortises.forEach((m, idx) => {
    const lb = mortiseEntryBox(m);
    const r = projectBoxRect(lb);
    if (!r) return;
    const W = round1(m.width ?? 0);
    const L = round1(m.length ?? 0);
    const D = round1(m.depth ?? 0);
    // 圓孔（mortise.shape === "round"）用 Ø 標、不寫 W×L
    const isRound = m.shape === "round";
    const dims = isRound ? `Ø${W} 深${D}` : `${W}×${L} 深${D}`;
    items.push({
      kind: "m",
      idx,
      rect: r,
      name: `榫眼${idx + 1}`,
      dims,
      baseline: baselineFor(lb),
    });
  });

  part.tenons.forEach((t, idx) => {
    if (t.length <= 0) return;
    const lb = tenonLocalBox(part, t);
    const r = projectBoxRect(lb);
    if (!r) return;
    const W = round1(t.width ?? 0);
    const T = round1(t.thickness ?? 0);
    const L = round1(t.length ?? 0);
    items.push({
      kind: "t",
      idx,
      rect: r,
      name: `榫頭${idx + 1}`,
      dims: `${W}×${T} 長${L}`,
      baseline: baselineFor(lb),
    });
  });

  if (!items.length) return null;

  // 工程圖風格：每個 feature 畫 dashed box + 名稱/尺寸 label + 真實 dim line（黃俊傑式）
  // - DimensionLine: extension line + dim line + filled triangle arrows + label
  // - 對稱件用「距中軸」、非對稱件用「距底/距邊」
  // - 簡單 arrow: 在 line 端 draw small filled triangle
  const drawArrow = (
    cx: number,
    cy: number,
    dir: "left" | "right" | "up" | "down",
    color: string,
    key: string,
  ) => {
    const SZ = 2.5;
    let pts: string;
    if (dir === "left") pts = `${cx},${cy} ${cx + SZ},${cy - SZ} ${cx + SZ},${cy + SZ}`;
    else if (dir === "right") pts = `${cx},${cy} ${cx - SZ},${cy - SZ} ${cx - SZ},${cy + SZ}`;
    else if (dir === "up") pts = `${cx},${cy} ${cx - SZ},${cy + SZ} ${cx + SZ},${cy + SZ}`;
    else pts = `${cx},${cy} ${cx - SZ},${cy - SZ} ${cx + SZ},${cy - SZ}`;
    return <polygon key={key} points={pts} fill={color} />;
  };

  const hDim = (
    x1: number,
    x2: number,
    y: number,
    label: string,
    color: string,
    key: string,
  ) => {
    const lo = Math.min(x1, x2);
    const hi = Math.max(x1, x2);
    return (
      <g key={key}>
        <line x1={lo} y1={y} x2={hi} y2={y} stroke={color} strokeWidth={0.5} />
        {drawArrow(lo, y, "left", color, `${key}-aL`)}
        {drawArrow(hi, y, "right", color, `${key}-aR`)}
        <text
          x={(lo + hi) / 2}
          y={y - 2}
          fontSize={8}
          fill={color}
          textAnchor="middle"
        >
          {label}
        </text>
      </g>
    );
  };

  const vDim = (
    y1: number,
    y2: number,
    x: number,
    label: string,
    color: string,
    key: string,
  ) => {
    const lo = Math.min(y1, y2);
    const hi = Math.max(y1, y2);
    return (
      <g key={key}>
        <line x1={x} y1={lo} x2={x} y2={hi} stroke={color} strokeWidth={0.5} />
        {drawArrow(x, lo, "up", color, `${key}-aU`)}
        {drawArrow(x, hi, "down", color, `${key}-aD`)}
        <text
          x={x - 2}
          y={(lo + hi) / 2 + 3}
          fontSize={8}
          fill={color}
          textAnchor="end"
        >
          {label}
        </text>
      </g>
    );
  };

  // Part 中心軸在 SVG 的位置（用 partLocalToSvg(0, T/2, 0)）
  const centerLocalY = part.visible.thickness / 2;
  const partCenterSvg = ctx.partLocalToSvg(0, centerLocalY, 0);

  const elements: React.ReactNode[] = [];
  items.forEach((it) => {
    const box = it.rect;
    const isMortise = it.kind === "m";
    const stroke = isMortise ? "#dc2626" : "#2563eb";
    const fill = isMortise
      ? "rgba(220, 38, 38, 0.12)"
      : "rgba(37, 99, 235, 0.10)";
    const dash = isMortise ? "3 2" : "4 2";

    // 取得對應 feature 的 local box（重新計算用 cx/cz）
    // mortise 用 mortiseEntryBox（從 entry face 量起、跟 visual 對齊）；
    // tenon 用 tenonLocalBox
    const feature = isMortise
      ? part.mortises[it.idx]
      : part.tenons[it.idx];
    const lb = isMortise
      ? mortiseEntryBox(feature as Mortise)
      : tenonLocalBox(part, feature as Tenon);

    const cx = box.x + box.w / 2;
    const cy = box.y + box.h / 2;

    // 尺寸 label 放在 part body 下方（不塞進材料裡）+ 短 leader 從 box 拉到 label
    // 計算 part body 在 SVG 的最低點（下緣）+ 8px gap
    const T = part.visible.thickness;
    const W = part.visible.width;
    const L = part.visible.length;
    const cornersY: number[] = [];
    if (view === "front") {
      cornersY.push(
        ctx.partLocalToSvg(-L / 2, -T / 2, 0).y,
        ctx.partLocalToSvg(+L / 2, -T / 2, 0).y,
        ctx.partLocalToSvg(-L / 2, +T / 2, 0).y,
        ctx.partLocalToSvg(+L / 2, +T / 2, 0).y,
      );
    } else if (view === "top") {
      cornersY.push(
        ctx.partLocalToSvg(-L / 2, T / 2, -W / 2).y,
        ctx.partLocalToSvg(+L / 2, T / 2, -W / 2).y,
        ctx.partLocalToSvg(-L / 2, T / 2, +W / 2).y,
        ctx.partLocalToSvg(+L / 2, T / 2, +W / 2).y,
      );
    } else {
      cornersY.push(
        ctx.partLocalToSvg(0, -T / 2, -W / 2).y,
        ctx.partLocalToSvg(0, +T / 2, -W / 2).y,
        ctx.partLocalToSvg(0, -T / 2, +W / 2).y,
        ctx.partLocalToSvg(0, +T / 2, +W / 2).y,
      );
    }
    const partBottomY = Math.max(...cornersY);
    // label 水平 X 對齊 box 中心、垂直在 part body 下方 + 10
    const lblX = box.x + box.w / 2;
    const lblY = partBottomY + 16;

    // 圓榫眼：只有看圓柱軸線方向才是圓、垂直方向看是矩形（圓柱側影）
    // 推 mortise 的 depth axis（從 origin 距哪面最近）+ 比對當前 view 的視軸：
    //   top view 看 -Y → view axis = "y"
    //   front view 看 -Z → view axis = "z"
    //   side view 看 X → view axis = "x"
    const mortiseShapeIsRound =
      isMortise &&
      (part.mortises[it.idx] as Mortise).shape === "round";
    let mortiseIsRound = false;
    if (mortiseShapeIsRound && isMortise) {
      const m = part.mortises[it.idx] as Mortise;
      const ly = part.visible.thickness;
      const yToFace = Math.min(Math.abs(m.origin.y), Math.abs(m.origin.y - ly));
      const xToFace = Math.min(
        Math.abs(m.origin.x - part.visible.length / 2),
        Math.abs(m.origin.x + part.visible.length / 2),
      );
      const zToFace = Math.min(
        Math.abs(m.origin.z - part.visible.width / 2),
        Math.abs(m.origin.z + part.visible.width / 2),
      );
      const yIsCanonical = m.origin.y === 0 || m.origin.y === ly;
      let depthAxis: "x" | "y" | "z";
      if (yIsCanonical && (xToFace < ly / 2 || zToFace < ly / 2)) {
        depthAxis = xToFace <= zToFace ? "x" : "z";
      } else if (yToFace <= xToFace && yToFace <= zToFace) {
        depthAxis = "y";
      } else if (xToFace <= zToFace) {
        depthAxis = "x";
      } else {
        depthAxis = "z";
      }
      const viewAxis: "x" | "y" | "z" =
        view === "top" ? "y" : view === "side" ? "x" : "z";
      mortiseIsRound = depthAxis === viewAxis;
    }
    const partEls: React.ReactNode[] = [
      mortiseIsRound ? (
        <g key={`${it.kind}-${it.idx}-box`}>
          <ellipse
            cx={box.x + box.w / 2}
            cy={box.y + box.h / 2}
            rx={box.w / 2}
            ry={box.h / 2}
            fill={fill}
            stroke={stroke}
            strokeWidth={1.2}
            strokeDasharray={dash}
          />
          {/* 工程慣例：圓孔中心 long-dash-dot 十字線、延伸圓外 25% */}
          <line
            x1={box.x - box.w * 0.25}
            x2={box.x + box.w * 1.25}
            y1={box.y + box.h / 2}
            y2={box.y + box.h / 2}
            stroke={stroke}
            strokeWidth={0.4}
            strokeDasharray="4 1.5 0.5 1.5"
          />
          <line
            x1={box.x + box.w / 2}
            x2={box.x + box.w / 2}
            y1={box.y - box.h * 0.25}
            y2={box.y + box.h * 1.25}
            stroke={stroke}
            strokeWidth={0.4}
            strokeDasharray="4 1.5 0.5 1.5"
          />
        </g>
      ) : (
        <rect
          key={`${it.kind}-${it.idx}-box`}
          x={box.x}
          y={box.y}
          width={box.w}
          height={box.h}
          fill={fill}
          stroke={stroke}
          strokeWidth={1.2}
          strokeDasharray={dash}
        />
      ),
    ];

    // 圓孔：保留下方 leader + 「Ø18 深25」label（Ø 是行業慣例 short label）
    // 方榫 (rect)：把 W/L 拉箭頭直接畫在 box 上、深度小字附近（工程圖風格）
    if (mortiseIsRound) {
      partEls.push(
        <line
          key={`${it.kind}-${it.idx}-lead`}
          x1={box.x + box.w / 2}
          y1={box.y + box.h}
          x2={lblX}
          y2={lblY - 8}
          stroke={stroke}
          strokeWidth={0.4}
          strokeDasharray="2 1.5"
        />,
        <text
          key={`${it.kind}-${it.idx}-dims`}
          x={lblX}
          y={lblY}
          fontSize={9}
          fill="#1f2937"
          fontFamily="monospace"
          textAnchor="middle"
        >
          {it.dims}
        </text>,
      );
    } else {
      // 視圖軸 mapping：mortiseEntryBox / tenonLocalBox 都以 part-local 中心系
      //   front: 水平=X, 垂直=Y, 深(into page)=Z
      //   top:   水平=X, 垂直=Z, 深=Y
      //   side:  水平=Z, 垂直=Y, 深=X
      const hMm =
        view === "side" ? round1(2 * lb.hz) : round1(2 * lb.hx);
      const vMm =
        view === "top" ? round1(2 * lb.hz) : round1(2 * lb.hy);
      // 工程慣例：視圖內看不到的尺寸不在這視圖標（into-page dim 留給其他 view 標）

      // dim line 擺在 part body 外側（用 partCenterSvg 判內外）
      // 計算 partTopY / partLeftX / partRightX 當參考（內部 tenon 也能離 part
      // 邊有 GAP，不會擠在 part 內側 6/6/6 跟 part 邊重疊）
      const cornersXForDim: number[] = [];
      if (view === "front") {
        cornersXForDim.push(
          ctx.partLocalToSvg(-L / 2, -T / 2, 0).x,
          ctx.partLocalToSvg(+L / 2, +T / 2, 0).x,
        );
      } else if (view === "top") {
        cornersXForDim.push(
          ctx.partLocalToSvg(-L / 2, T / 2, -W / 2).x,
          ctx.partLocalToSvg(+L / 2, T / 2, +W / 2).x,
        );
      } else {
        cornersXForDim.push(
          ctx.partLocalToSvg(0, -T / 2, -W / 2).x,
          ctx.partLocalToSvg(0, +T / 2, +W / 2).x,
        );
      }
      const partLeftSvg = Math.min(...cornersXForDim);
      const partRightSvg = Math.max(...cornersXForDim);
      const partTopSvg = Math.min(...cornersY);

      const outerAbove = box.y < partCenterSvg.y;
      const outerLeft = box.x < partCenterSvg.x;
      const GAP = 12; // SVG px；榫 dim 距「max(box, partEdge)」推出去
      // 取 part 邊跟 box 邊的最外側當參考（protrusion 用 box / interior 用 partEdge）
      const wDimY = outerAbove
        ? Math.min(box.y, partTopSvg) - GAP
        : Math.max(box.y + box.h, partBottomY) + GAP;
      const lDimX = outerLeft
        ? Math.min(box.x, partLeftSvg) - GAP
        : Math.max(box.x + box.w, partRightSvg) + GAP;
      const wLabelY = outerAbove ? wDimY - 2 : wDimY + 7;
      const lLabelX = outerLeft ? lDimX - 2 : lDimX + 2;
      const lLabelAnchor: "start" | "end" = outerLeft ? "end" : "start";

      // 內向箭頭 dim line（box 兩端 tick → 中央 label）
      const SZ = 2.2;
      const inwardArrowsH = (lo: number, hi: number, y: number) => (
        <>
          <polygon
            points={`${lo},${y} ${lo + SZ + 1},${y - SZ} ${lo + SZ + 1},${y + SZ}`}
            fill={stroke}
          />
          <polygon
            points={`${hi},${y} ${hi - SZ - 1},${y - SZ} ${hi - SZ - 1},${y + SZ}`}
            fill={stroke}
          />
        </>
      );
      const inwardArrowsV = (lo: number, hi: number, x: number) => (
        <>
          <polygon
            points={`${x},${lo} ${x - SZ},${lo + SZ + 1} ${x + SZ},${lo + SZ + 1}`}
            fill={stroke}
          />
          <polygon
            points={`${x},${hi} ${x - SZ},${hi - SZ - 1} ${x + SZ},${hi - SZ - 1}`}
            fill={stroke}
          />
        </>
      );

      partEls.push(
        // W (水平) dim line：跨 box 寬度
        <g key={`${it.kind}-${it.idx}-Wdim`}>
          <line
            x1={box.x}
            y1={wDimY}
            x2={box.x + box.w}
            y2={wDimY}
            stroke={stroke}
            strokeWidth={0.5}
          />
          {/* 短延伸線連 box 邊到 dim line */}
          <line
            x1={box.x}
            y1={outerAbove ? box.y : box.y + box.h}
            x2={box.x}
            y2={wDimY}
            stroke={stroke}
            strokeWidth={0.3}
          />
          <line
            x1={box.x + box.w}
            y1={outerAbove ? box.y : box.y + box.h}
            x2={box.x + box.w}
            y2={wDimY}
            stroke={stroke}
            strokeWidth={0.3}
          />
          {inwardArrowsH(box.x, box.x + box.w, wDimY)}
          <text
            x={box.x + box.w / 2}
            y={wLabelY}
            fontSize={8}
            fill={stroke}
            fontFamily="monospace"
            textAnchor="middle"
          >
            {hMm}
          </text>
        </g>,
        // L (垂直) dim line：跨 box 高度
        <g key={`${it.kind}-${it.idx}-Ldim`}>
          <line
            x1={lDimX}
            y1={box.y}
            x2={lDimX}
            y2={box.y + box.h}
            stroke={stroke}
            strokeWidth={0.5}
          />
          <line
            x1={outerLeft ? box.x : box.x + box.w}
            y1={box.y}
            x2={lDimX}
            y2={box.y}
            stroke={stroke}
            strokeWidth={0.3}
          />
          <line
            x1={outerLeft ? box.x : box.x + box.w}
            y1={box.y + box.h}
            x2={lDimX}
            y2={box.y + box.h}
            stroke={stroke}
            strokeWidth={0.3}
          />
          {inwardArrowsV(box.y, box.y + box.h, lDimX)}
          <text
            x={lLabelX}
            y={box.y + box.h / 2 + 3}
            fontSize={8}
            fill={stroke}
            fontFamily="monospace"
            textAnchor={lLabelAnchor}
          >
            {vMm}
          </text>
        </g>,
      );

      // 鏈式 dim：榫到 part 邊緣（user 要求標 shoulder/offset）
      // 在 W/L dim 線上延伸，partEdge→box→box→partEdge 各段；段 < 2mm 跳過
      // 沿用上面已算出的 partLeftSvg / partRightSvg / partTopSvg
      const partLeftX = partLeftSvg;
      const partRightX = partRightSvg;
      const partTopY = partTopSvg;

      // mm/svg 比例：用 hMm/box.w fallback vMm/box.h
      const mmPerSvgX =
        box.w > 1 && hMm > 0.1 ? hMm / box.w : 1;
      const mmPerSvgY =
        box.h > 1 && vMm > 0.1 ? vMm / box.h : 1;

      // feature 必須在 part body 那軸範圍內，才算 shoulder（榫頭凸出側不是
      // shoulder、是 part 外）；2mm 容差吸收 SVG 投影誤差
      const SLACK = 2;
      const featureInsideX =
        box.x >= partLeftX - SLACK &&
        box.x + box.w <= partRightX + SLACK;
      const featureInsideY =
        box.y >= partTopY - SLACK &&
        box.y + box.h <= partBottomY + SLACK;

      // 同軸 sibling 偵測：避免兩個 mortise/tenon 各畫自己的 shoulder 到 part
      // 邊、視覺重疊。chain dim 慣例：用「上一個 sibling 邊→這個 feature 邊」
      // 算 shoulderTop，「這個 feature 邊→下一個 sibling 邊」算 shoulderBot；
      // 中間段 shoulderBot 跳過、由下一個 sibling 的 shoulderTop 補。
      const COL_TOL = 5; // SVG px 容差
      // L 軸 siblings：lDimX 同欄、垂直堆疊
      const lSiblings = items
        .map((other) => ({ other, lb: null as any }))
        .filter(({ other }, i) => {
          const otherFeature =
            other.kind === "m"
              ? part.mortises[other.idx]
              : part.tenons[other.idx];
          const otherLb =
            other.kind === "m"
              ? mortiseEntryBox(otherFeature as Mortise)
              : tenonLocalBox(part, otherFeature as Tenon);
          const otherR = projectBoxRect(otherLb);
          if (!otherR) return false;
          // 判定 same column：兩個 box 的水平 lDimX 應該幾乎一樣
          return Math.abs(otherR.x - box.x) < COL_TOL;
        })
        .map((s, i) => ({
          ...s,
          r: items.find((o) => o === s.other)!.rect,
        }))
        .sort((a, b) => a.r.y - b.r.y);
      const myLIdx = lSiblings.findIndex((s) => s.other === it);
      const prevLSibling = myLIdx > 0 ? lSiblings[myLIdx - 1] : null;
      const nextLSibling =
        myLIdx >= 0 && myLIdx < lSiblings.length - 1
          ? lSiblings[myLIdx + 1]
          : null;

      // top 邊界：前一個 sibling 的 bot edge（如果有），不然 partTopY
      const topBoundary = prevLSibling
        ? prevLSibling.r.y + prevLSibling.r.h
        : partTopY;
      // 中段 sibling 的 botShoulder 不畫（由 nextSibling 的 topShoulder 補）
      const drawBotShoulder = !nextLSibling;

      const shoulderTop = featureInsideY
        ? round1((box.y - topBoundary) * mmPerSvgY)
        : 0;
      const shoulderBot =
        featureInsideY && drawBotShoulder
          ? round1((partBottomY - (box.y + box.h)) * mmPerSvgY)
          : 0;
      const shoulderLft = featureInsideX
        ? round1((box.x - partLeftX) * mmPerSvgX)
        : 0;
      const shoulderRgt = featureInsideX
        ? round1((partRightX - (box.x + box.w)) * mmPerSvgX)
        : 0;
      const TH = 2; // mm 門檻
      // shoulder top 的 dim line 起點用 topBoundary（不一定 partTopY）
      const shoulderTopStartY = topBoundary;

      // L dim 線（vertical）上下延伸：topBoundary→box.y 和 box.y+box.h→partBottom
      // segment 太小（<14 svg unit）→ label 移出 dim line 外側、加 leader 避擠
      const TIGHT = 14;
      const LABEL_OUT = 14;
      if (shoulderTop > TH) {
        const segH = box.y - shoulderTopStartY;
        const tight = segH < TIGHT;
        const labelY = tight
          ? shoulderTopStartY - 3
          : (shoulderTopStartY + box.y) / 2 + 3;
        const labelX = tight
          ? lLabelX + (outerLeft ? -LABEL_OUT : LABEL_OUT)
          : lLabelX;
        partEls.push(
          <g key={`${it.kind}-${it.idx}-shT`}>
            <line
              x1={lDimX}
              y1={shoulderTopStartY}
              x2={lDimX}
              y2={box.y}
              stroke={stroke}
              strokeWidth={0.5}
            />
            <line
              x1={outerLeft ? partLeftX : partRightX}
              y1={shoulderTopStartY}
              x2={lDimX}
              y2={shoulderTopStartY}
              stroke={stroke}
              strokeWidth={0.3}
            />
            {inwardArrowsV(shoulderTopStartY, box.y, lDimX)}
            {tight && (
              <line
                x1={lDimX}
                y1={(shoulderTopStartY + box.y) / 2}
                x2={labelX + (outerLeft ? 2 : -2)}
                y2={labelY - 3}
                stroke={stroke}
                strokeWidth={0.3}
              />
            )}
            <text
              x={labelX}
              y={labelY}
              fontSize={6.5}
              fill={stroke}
              fontFamily="monospace"
              textAnchor={lLabelAnchor}
            >
              {shoulderTop}
            </text>
          </g>,
        );
      }
      if (shoulderBot > TH) {
        const segH = partBottomY - (box.y + box.h);
        const tight = segH < TIGHT;
        const labelY = tight
          ? partBottomY + 8
          : (box.y + box.h + partBottomY) / 2 + 3;
        const labelX = tight
          ? lLabelX + (outerLeft ? -LABEL_OUT : LABEL_OUT)
          : lLabelX;
        partEls.push(
          <g key={`${it.kind}-${it.idx}-shB`}>
            <line
              x1={lDimX}
              y1={box.y + box.h}
              x2={lDimX}
              y2={partBottomY}
              stroke={stroke}
              strokeWidth={0.5}
            />
            <line
              x1={outerLeft ? partLeftX : partRightX}
              y1={partBottomY}
              x2={lDimX}
              y2={partBottomY}
              stroke={stroke}
              strokeWidth={0.3}
            />
            {inwardArrowsV(box.y + box.h, partBottomY, lDimX)}
            {tight && (
              <line
                x1={lDimX}
                y1={(box.y + box.h + partBottomY) / 2}
                x2={labelX + (outerLeft ? 2 : -2)}
                y2={labelY - 3}
                stroke={stroke}
                strokeWidth={0.3}
              />
            )}
            <text
              x={labelX}
              y={labelY}
              fontSize={6.5}
              fill={stroke}
              fontFamily="monospace"
              textAnchor={lLabelAnchor}
            >
              {shoulderBot}
            </text>
          </g>,
        );
      }
      // W dim 線（horizontal）左右延伸：partLeft→box.x 和 box.x+box.w→partRight
      if (shoulderLft > TH) {
        partEls.push(
          <g key={`${it.kind}-${it.idx}-shL`}>
            <line
              x1={partLeftX}
              y1={wDimY}
              x2={box.x}
              y2={wDimY}
              stroke={stroke}
              strokeWidth={0.5}
            />
            <line
              x1={partLeftX}
              y1={outerAbove ? partTopY : partBottomY}
              x2={partLeftX}
              y2={wDimY}
              stroke={stroke}
              strokeWidth={0.3}
            />
            {inwardArrowsH(partLeftX, box.x, wDimY)}
            <text
              x={(partLeftX + box.x) / 2}
              y={wLabelY}
              fontSize={7}
              fill={stroke}
              fontFamily="monospace"
              textAnchor="middle"
            >
              {shoulderLft}
            </text>
          </g>,
        );
      }
      if (shoulderRgt > TH) {
        partEls.push(
          <g key={`${it.kind}-${it.idx}-shR`}>
            <line
              x1={box.x + box.w}
              y1={wDimY}
              x2={partRightX}
              y2={wDimY}
              stroke={stroke}
              strokeWidth={0.5}
            />
            <line
              x1={partRightX}
              y1={outerAbove ? partTopY : partBottomY}
              x2={partRightX}
              y2={wDimY}
              stroke={stroke}
              strokeWidth={0.3}
            />
            {inwardArrowsH(box.x + box.w, partRightX, wDimY)}
            <text
              x={(box.x + box.w + partRightX) / 2}
              y={wLabelY}
              fontSize={7}
              fill={stroke}
              fontFamily="monospace"
              textAnchor="middle"
            >
              {shoulderRgt}
            </text>
          </g>,
        );
      }
    }

    // 工程 dim line：根據 view + 對稱性
    // 距中軸 dim 放在 W/L dim line 外側（mortiseIsRound 用原 8px、rect 用 18px 避撞）
    const offCenter = mortiseIsRound ? 8 : 18;
    if (view === "top" && isSymmetricPart) {
      // 距中 X：水平 dim line 從 centerline 到 mortise center
      const dxMm = round1(Math.abs(lb.cx));
      const dzMm = round1(Math.abs(lb.cz));
      const xDimY =
        box.y < partCenterSvg.y
          ? box.y - offCenter
          : box.y + box.h + offCenter;
      const zDimX =
        box.x < partCenterSvg.x
          ? box.x - offCenter
          : box.x + box.w + offCenter;
      partEls.push(
        hDim(partCenterSvg.x, cx, xDimY, String(dxMm), "#0ea5e9", `${it.kind}-${it.idx}-xdim`),
      );
      partEls.push(
        vDim(partCenterSvg.y, cy, zDimX, String(dzMm), "#0ea5e9", `${it.kind}-${it.idx}-zdim`),
      );
    } else if (view !== "top" && isSymmetricPart) {
      // front / side 對稱件：只畫 X / Z 距中軸 dim line（距底 dim 已砍）
      const dxMm = round1(Math.abs(lb.cx));
      const xDimY = box.y - offCenter;
      partEls.push(
        hDim(
          partCenterSvg.x,
          cx,
          xDimY,
          String(dxMm),
          "#0ea5e9",
          `${it.kind}-${it.idx}-xdim`,
        ),
      );
    }

    elements.push(<g key={`${it.kind}-${it.idx}`}>{partEls}</g>);
  });

  return <g className="t2-overlay">{elements}</g>;
}

/**
 * GrainArrow — 順紋方向小箭頭（Phase 2 Task 4）。
 *
 * 每張 OrthoView 右下角繪一個 14px 標記 + 「順紋」字（藍色 #1d4ed8）：
 *   - horiz：水平箭頭 →（沿水平軸順紋）
 *   - vert： 垂直箭頭 ↑（沿垂直軸順紋）
 *   - into： ⊙ 圓圈+點（順紋指向紙面內側，無法在此 view 平面表示）
 *
 * Per view 對應（GrainDirection 只有 length | width）：
 *   front: length→horiz / width→into
 *   top:   length→horiz / width→vert
 *   side:  length→into  / width→horiz
 *
 * Spec: docs/superpowers/specs/2026-05-17-part-drawings-phase-2-design.md §4
 */
type ArrowDir = "horiz" | "vert" | "into";

function grainArrowDir(
  grain: Part["grainDirection"],
  view: PartView,
): ArrowDir {
  if (view === "front") return grain === "length" ? "horiz" : "into";
  if (view === "top") return grain === "length" ? "horiz" : "vert";
  // side
  return grain === "width" ? "horiz" : "into";
}

export function GrainArrow({
  ctx,
  part,
  view,
}: {
  ctx: OrthoViewBoxCtx;
  part: Part;
  view: PartView;
}) {
  const dir = grainArrowDir(part.grainDirection, view);
  const x0 = ctx.vbX + ctx.vbW - 38;
  const y0 = ctx.vbY + ctx.vbH - 18;
  const len = 14;

  let glyph: React.ReactNode;
  if (dir === "horiz") {
    glyph = (
      <g>
        <line
          x1={x0}
          y1={y0 - 4}
          x2={x0 + len}
          y2={y0 - 4}
          stroke="#1d4ed8"
          strokeWidth={0.7}
        />
        <polygon
          points={`${x0 + len},${y0 - 4} ${x0 + len - 3},${y0 - 6} ${x0 + len - 3},${y0 - 2}`}
          fill="#1d4ed8"
        />
      </g>
    );
  } else if (dir === "vert") {
    glyph = (
      <g>
        <line
          x1={x0 + len / 2}
          y1={y0}
          x2={x0 + len / 2}
          y2={y0 - len}
          stroke="#1d4ed8"
          strokeWidth={0.7}
        />
        <polygon
          points={`${x0 + len / 2},${y0 - len} ${x0 + len / 2 - 2},${y0 - len + 3} ${x0 + len / 2 + 2},${y0 - len + 3}`}
          fill="#1d4ed8"
        />
      </g>
    );
  } else {
    // into the page
    glyph = (
      <g>
        <circle
          cx={x0 + len / 2}
          cy={y0 - 4}
          r={4}
          fill="none"
          stroke="#1d4ed8"
          strokeWidth={0.7}
        />
        <circle cx={x0 + len / 2} cy={y0 - 4} r={1} fill="#1d4ed8" />
      </g>
    );
  }

  return (
    <g className="grain-arrow">
      {glyph}
      <text x={x0} y={y0 + 8} fontSize={7} fill="#1d4ed8">
        順紋
      </text>
    </g>
  );
}

/**
 * FacingMark — 面向記號（Phase 2 Task 5）
 *
 * 推論非對稱零件的「外/內/上/下」面，協助木匠決定哪面當外觀面（光面/打磨完整）。
 *
 * `inferFacing(part)` 啟發式：
 * - X 軸：mortise.origin.x 偏向某側集中 → 對面為「外」（因為榫眼那側是組裝隱面）
 * - Z 軸：同上以 mortise.origin.z 推論
 * - Y 軸：tenon.position = "top" → 上 / "bottom" → 下
 *   （Tenon 沒有 origin，用 position 軸別判斷）
 * - 完全對稱 / 無線索 → null（不標）
 *
 * 顯示：左上角 9px 深橘 #7c2d12 字。只在能看到該軸的 view 顯示
 * （X→front/top、Z→side/top、Y→front/side）。
 *
 * Spec: docs/superpowers/specs/2026-05-17-part-drawings-phase-2-design.md §5
 */
type FacingHint = {
  axis: "x" | "y" | "z";
  positive: boolean;
  label: "外" | "內" | "上" | "下";
};

export function inferFacing(part: Part): FacingHint | null {
  const mortises = part.mortises ?? [];
  const tenons = part.tenons ?? [];

  // X / Z 軸：以 mortise.origin 群聚判斷
  // origin.x / origin.z 是 part-centered（[-l/2, +l/2]）
  let xPos = 0,
    xNeg = 0;
  let zPos = 0,
    zNeg = 0;
  for (const m of mortises) {
    const x = m.origin?.x ?? 0;
    const z = m.origin?.z ?? 0;
    if (x > 1) xPos++;
    else if (x < -1) xNeg++;
    if (z > 1) zPos++;
    else if (z < -1) zNeg++;
  }

  // 偏移 ≥ 2 才算明顯不對稱（避免單個 mortise 就觸發 noise）
  if (xPos > xNeg + 1) return { axis: "x", positive: false, label: "外" };
  if (xNeg > xPos + 1) return { axis: "x", positive: true, label: "外" };
  if (zPos > zNeg + 1) return { axis: "z", positive: false, label: "外" };
  if (zNeg > zPos + 1) return { axis: "z", positive: true, label: "外" };

  // Y 軸（上/下）：Tenon 沒有 origin，改用 position 判斷
  let yTop = 0,
    yBot = 0;
  for (const t of tenons) {
    if (t.position === "top") yTop++;
    else if (t.position === "bottom") yBot++;
  }
  if (yTop > yBot && yTop > 0) return { axis: "y", positive: true, label: "上" };
  if (yBot > yTop && yBot > 0) return { axis: "y", positive: false, label: "下" };

  return null;
}

export function FacingMark({
  ctx,
  part,
  view,
}: {
  ctx: OrthoViewBoxCtx;
  part: Part;
  view: PartView;
}) {
  const facing = inferFacing(part);
  if (!facing) return null;

  // 只在能看到該軸面的 view 顯示記號
  //   X 軸面 → front（length 水平）/ top（length 水平）能看見
  //   Z 軸面 → side（width 水平）/ top（width 垂直）能看見
  //   Y 軸面（上/下）→ front / side 能看見；top 是俯視看不到上下面
  const showOn =
    (facing.axis === "x" && (view === "front" || view === "top")) ||
    (facing.axis === "z" && (view === "side" || view === "top")) ||
    (facing.axis === "y" && view !== "top");
  if (!showOn) return null;

  const x0 = ctx.vbX + 14;
  const y0 = ctx.vbY + 22;
  return (
    <g className="facing-mark">
      <text x={x0} y={y0} fontSize={9} fill="#7c2d12" fontWeight="bold">
        {facing.label}
      </text>
    </g>
  );
}

/**
 * <ShapeSpecificAnnotation> — 依 part.shape.kind 分派對應的特殊標註元件
 *（Phase 3 Task 1+ 框架）。
 *
 * 不在 5 種 hard shape 內回 null（safe no-op）。
 *
 * Spec: docs/superpowers/specs/2026-05-17-part-drawings-phase-3-design.md §1
 */
export function ShapeSpecificAnnotation({
  ctx,
  part,
  view,
}: {
  ctx: OrthoViewBoxCtx;
  part: Part;
  view: PartView;
}) {
  if (!part.shape) return null;
  switch (part.shape.kind) {
    case "lathe-turned":
      return <LatheSegmentTable ctx={ctx} part={part} view={view} />;
    case "arch-bent":
      return <ArchBentChord ctx={ctx} part={part} view={view} />;
    case "apron-trapezoid":
      // 上邊長/下邊長 雙標移除——T1 dim 已標 part body length、taper 細微差
      // 用 shape 視覺呈現即可，多印一行字反而噪音（user 05-17 22:28 要求）
      return null;
    case "hoof":
      return <HoofDirection ctx={ctx} part={part} view={view} />;
    case "splayed-tapered":
    case "splayed-round-tapered":
      return <SplayedTrueLength ctx={ctx} part={part} view={view} />;
    default:
      return null;
  }
}

/**
 * <LatheSegmentTable> — lathe-turned 段別表（side view 角落）。
 *
 * 讀 module 常數 LATHE_SEG（12 段 [topR, botR, hFrac]）。
 *   Y(seg i) = Σ(hFrac[0..i]) × visible.length   // 累加從頂往下
 *   R(seg i) = botR × visible.width / 2          // 半徑 = bot 比例 × fullR
 *
 * 字級 6px / 行高 9px / 等寬字、貼右邊 90px。
 *
 * Spec: …phase-3 §1.1
 */
function LatheSegmentTable({
  ctx,
  part,
  view,
}: {
  ctx: OrthoViewBoxCtx;
  part: Part;
  view: PartView;
}) {
  if (view !== "side") return null;
  // round leg 系列用 width 當直徑、length 當高度
  const fullR = part.visible.width / 2;
  const length = part.visible.length;

  let cumH = 0;
  const rows = LATHE_SEG.map((seg, i) => {
    const [, botR, hFrac] = seg;
    cumH += hFrac;
    return {
      idx: i + 1,
      y: Math.round(cumH * length * 10) / 10,
      r: Math.round(botR * fullR * 10) / 10,
    };
  });

  const x0 = ctx.vbX + ctx.vbW - 90;
  const y0 = ctx.vbY + 24;
  const lineH = 9;

  return (
    <g
      className="lathe-segment-table"
      style={{ fontSize: 6, fontFamily: "monospace" }}
    >
      <text x={x0} y={y0} fontWeight="bold">
        段│Y│R
      </text>
      {rows.map((r, i) => (
        <text key={i} x={x0} y={y0 + (i + 1) * lineH}>
          {String(r.idx).padStart(2)}│{String(r.y).padStart(4)}│
          {String(r.r).padStart(4)}
        </text>
      ))}
    </g>
  );
}

/**
 * <ArchBentChord> — arch-bent 弦長 + 矢高（front view 左下）。
 *
 * 木匠用「弦長 + 矢高」就能用繩子+尺放樣弧線（古法）。
 *   弦長 = visible.length（直線端到端距離）
 *   矢高 = shape.bendMm（垂直弦的最大彎度）
 *
 * 配「順弦切向木紋」小字提示走紋方向。
 *
 * Spec: …phase-3 §1.2
 */
function ArchBentChord({
  ctx,
  part,
  view,
}: {
  ctx: OrthoViewBoxCtx;
  part: Part;
  view: PartView;
}) {
  if (view !== "front") return null;
  if (part.shape?.kind !== "arch-bent") return null;
  const chord = part.visible.length;
  const sagitta = part.shape.bendMm ?? 0;

  const x0 = ctx.vbX + 14;
  const y0 = ctx.vbY + ctx.vbH - 40;

  return (
    <g className="arch-bent-chord" style={{ fontSize: 8 }}>
      <text x={x0} y={y0} fill="#374151">
        弦長 {round1(chord)}
      </text>
      <text x={x0} y={y0 + 10} fill="#374151">
        矢高 {round1(sagitta)}
      </text>
      <text x={x0} y={y0 + 20} fontSize={6} fill="#6b7280">
        （順弦切向木紋）
      </text>
    </g>
  );
}

/**
 * <ApronTrapezoidDualEdge> — apron-trapezoid 上下邊雙標 + 端面斜角。
 *
 * 牙條梯形（topLengthScale / bottomLengthScale）要木匠看清上邊跟下邊各多長，
 * top view 左上角同時標兩條邊長，bevelAngle 非 0 時加端面斜角度°。
 *
 *   上邊長 = visible.length × topLengthScale
 *   下邊長 = visible.length × bottomLengthScale
 *   端面斜 = bevelAngle * 180/π （若 != 0）
 *
 * Spec: …phase-3 §1.3
 */
function ApronTrapezoidDualEdge({
  ctx,
  part,
  view,
}: {
  ctx: OrthoViewBoxCtx;
  part: Part;
  view: PartView;
}) {
  if (view !== "top") return null;
  if (part.shape?.kind !== "apron-trapezoid") return null;
  const shape = part.shape;
  const L = part.visible.length;
  const topL = L * (shape.topLengthScale ?? 1);
  const botL = L * (shape.bottomLengthScale ?? 1);
  const bevel = shape.bevelAngle ?? 0;

  const x0 = ctx.vbX + 14;
  const y0 = ctx.vbY + 42;

  return (
    <g className="apron-trap-dual" style={{ fontSize: 8 }}>
      <text x={x0} y={y0} fill="#374151">
        上邊長 {round1(topL)}
      </text>
      <text x={x0} y={y0 + 10} fill="#374151">
        下邊長 {round1(botL)}
      </text>
      {bevel !== 0 && (
        <text x={x0} y={y0 + 20} fill="#374151">
          端面斜 {round1((bevel * 180) / Math.PI)}°
        </text>
      )}
    </g>
  );
}

/**
 * <HoofDirection> — 明式馬蹄腳方向 + 轉折 Y（Phase 3 Task 4）。
 *
 * `hoof` shape：`hoofMm` (馬蹄高)、`hoofScale` (外撇倍率)、
 * `dirX`/`dirZ` ∈ {-1, 0, +1} 外撇方向。
 *
 * front + side view 角標：
 *   - 「腳趾朝右/左/前/後」中文（不寫變數名）
 *   - 「轉折 Y={hoofMm}」距底高度（從底往上量到 S 上半轉折點）
 *
 * 卡片底再加一行毛料厚建議（drawing.tsx）。
 *
 * Spec: …phase-3 §1.4
 */
function HoofDirection({
  ctx,
  part,
  view,
}: {
  ctx: OrthoViewBoxCtx;
  part: Part;
  view: PartView;
}) {
  if (view === "top") return null;
  if (part.shape?.kind !== "hoof") return null;
  const shape = part.shape;

  const dirX = shape.dirX ?? 0;
  const dirZ = shape.dirZ ?? 0;
  const hoofMm = shape.hoofMm ?? 0;

  const dirParts: string[] = [];
  if (dirX > 0) dirParts.push("右");
  if (dirX < 0) dirParts.push("左");
  if (dirZ > 0) dirParts.push("前");
  if (dirZ < 0) dirParts.push("後");
  const dirText = dirParts.length
    ? `腳趾朝${dirParts.join("")}`
    : "腳趾外撇";

  const x0 = ctx.vbX + 14;
  const y0 = ctx.vbY + 32;

  return (
    <g className="hoof-direction" style={{ fontSize: 8 }}>
      <text x={x0} y={y0} fill="#7c2d12" fontWeight="bold">
        {dirText}
      </text>
      <text x={x0} y={y0 + 10} fontSize={7} fill="#374151">
        轉折 Y={round1(hoofMm)}
      </text>
    </g>
  );
}

/**
 * <SplayedTrueLength> — 外斜腳真實長度 + 端面斜角（Phase 3 Task 5）。
 *
 * `splayed-tapered` / `splayed-round-tapered`：整支腳沿 length 軸傾斜，
 * 底面相對頂面在 part-local 偏移 (dxMm, dzMm)。
 *
 * front view 左下角標：
 *   - 真長 = √(L² + dx² + dz²)
 *   - 端面斜 = atan2(√(dx² + dz²), L) × 180/π （°）
 *   - splayed-round-tapered 多標頂徑/底徑（visible.width × bottomScale）
 *
 * 視覺長度 visible.length 是 chord（直線距離），真長要含偏移量。
 *
 * Spec: …phase-3 §1.5
 */
function SplayedTrueLength({
  ctx,
  part,
  view,
}: {
  ctx: OrthoViewBoxCtx;
  part: Part;
  view: PartView;
}) {
  if (view !== "front") return null;
  if (
    part.shape?.kind !== "splayed-tapered" &&
    part.shape?.kind !== "splayed-round-tapered"
  ) {
    return null;
  }
  const shape = part.shape;
  const L = part.visible.length;
  const dx = shape.dxMm ?? 0;
  const dz = shape.dzMm ?? 0;
  const realL = Math.sqrt(L * L + dx * dx + dz * dz);
  const angleDeg =
    (Math.atan2(Math.sqrt(dx * dx + dz * dz), L) * 180) / Math.PI;

  const x0 = ctx.vbX + 14;
  const y0 = ctx.vbY + ctx.vbH - 30;

  return (
    <g className="splayed-true-length" style={{ fontSize: 8 }}>
      <text x={x0} y={y0} fill="#374151">
        真長 {round1(realL)}
      </text>
      <text x={x0} y={y0 + 10} fontSize={7} fill="#6b7280">
        端面斜 {round1(angleDeg)}°
      </text>
      {shape.kind === "splayed-round-tapered" && (
        <text x={x0} y={y0 + 20} fontSize={7} fill="#374151">
          頂徑 {round1(part.visible.width)} / 底徑{" "}
          {round1(part.visible.width * (shape.bottomScale ?? 1))}
        </text>
      )}
    </g>
  );
}

/**
 * <DetailCallout> — Phase 5 多 detail + corner placement 版。
 *
 * 為複雜榫卯 part 在 front view 拉最多 3 個 2× zoom detail inset：
 *   - 觸發條件：≥2 mortises（全收）OR tenon length ≥ 40mm（填餘格）
 *   - 每個 feature 在 main view 圈紅圈 + 字母（A/B/C）
 *   - 每個 detail 用 corner-based collision avoidance：
 *     優先序 BR → TR → BL → TL，避撞 grain arrow 保留區與已放 inset
 *   - 50×50 inset：border + 「詳圖 X 2:1」 + 名稱 + 尺寸
 *   - dash leader 從 feature 圓邊拉到 inset 最近角
 *
 * Phase 5 升級自 Phase 3.5（單一 detail / 固定右下）。
 *
 * Spec: docs/superpowers/specs/2026-05-17-part-drawings-phase-3-5-design.md
 *       (Phase 5 extension — multi-detail corner placement)
 */
interface DetailTarget {
  kind: "mortise" | "tenon";
  idx: number;
  localBox: ReturnType<typeof mortiseLocalBox>;
  label: string; // "A" | "B" | "C"
}

function findDetailTargets(part: Part): DetailTarget[] {
  const labels = ["A", "B", "C"];
  const out: DetailTarget[] = [];

  // 1st priority: 所有 mortises（最多 3）
  if ((part.mortises?.length ?? 0) >= 2) {
    for (let i = 0; i < part.mortises.length && out.length < 3; i++) {
      out.push({
        kind: "mortise",
        idx: i,
        localBox: mortiseLocalBox(part, part.mortises[i]),
        label: labels[out.length],
      });
    }
  }

  // 2nd priority: 深 tenons (length ≥ 40mm) 填餘格
  for (let i = 0; i < (part.tenons ?? []).length && out.length < 3; i++) {
    const t = part.tenons[i];
    if ((t.length ?? 0) >= 40) {
      out.push({
        kind: "tenon",
        idx: i,
        localBox: tenonLocalBox(part, t),
        label: labels[out.length],
      });
    }
  }

  return out;
}

type Corner = "TL" | "TR" | "BR" | "BL";
// BR 優先（左下/右上次之，TL 留給 facing mark）
const CORNER_PRIORITY: Corner[] = ["BR", "TR", "BL", "TL"];

interface InsetPlacement {
  corner: Corner;
  x: number;
  y: number;
  w: number;
  h: number;
}

function placeInsets(
  ctx: OrthoViewBoxCtx,
  count: number,
): InsetPlacement[] {
  const W = 50;
  const H = 50;
  const pad = 6;
  // GrainArrow 在右下角 ~40×40 px 保留區（避免 inset 蓋上去）
  const grainReserve = {
    x: ctx.vbX + ctx.vbW - 45,
    y: ctx.vbY + ctx.vbH - 45,
    w: 40,
    h: 40,
  };

  const corners: Record<Corner, { x: number; y: number }> = {
    TL: { x: ctx.vbX + pad, y: ctx.vbY + pad + 18 }, // 讓出 facing mark 區
    TR: { x: ctx.vbX + ctx.vbW - W - pad, y: ctx.vbY + pad + 18 },
    BR: {
      x: ctx.vbX + ctx.vbW - W - pad,
      y: ctx.vbY + ctx.vbH - H - pad - 30,
    },
    BL: { x: ctx.vbX + pad, y: ctx.vbY + ctx.vbH - H - pad - 30 },
  };

  const placed: InsetPlacement[] = [];

  for (let i = 0; i < count; i++) {
    for (const c of CORNER_PRIORITY) {
      const pos = corners[c];
      const candidate: InsetPlacement = {
        corner: c,
        x: pos.x,
        y: pos.y,
        w: W,
        h: H,
      };
      // 避撞已放 inset
      const overlapsPlaced = placed.some(
        (p) =>
          !(
            candidate.x + candidate.w < p.x ||
            candidate.x > p.x + p.w ||
            candidate.y + candidate.h < p.y ||
            candidate.y > p.y + p.h
          ),
      );
      if (overlapsPlaced) continue;
      // 避撞 grain arrow 保留區
      const overlapsGrain = !(
        candidate.x + candidate.w < grainReserve.x ||
        candidate.x > grainReserve.x + grainReserve.w ||
        candidate.y + candidate.h < grainReserve.y ||
        candidate.y > grainReserve.y + grainReserve.h
      );
      if (overlapsGrain) continue;
      placed.push(candidate);
      break;
    }
    // 找不到 corner 就 skip（不渲染這個 detail）
  }

  return placed;
}

export function DetailCallout({
  ctx,
  part,
  view,
}: {
  ctx: OrthoViewBoxCtx;
  part: Part;
  view: PartView;
}) {
  if (view !== "front") return null;
  const targets = findDetailTargets(part);
  if (!targets.length) return null;

  const placements = placeInsets(ctx, targets.length);

  // Project feature local box → SVG AABB → 中心 + 半徑
  function projectFeature(lb: DetailTarget["localBox"]) {
    const corners: Array<{ x: number; y: number }> = [];
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        for (const sz of [-1, 1]) {
          corners.push(
            ctx.partLocalToSvg(
              lb.cx + sx * lb.hx,
              lb.cy + sy * lb.hy,
              lb.cz + sz * lb.hz,
            ),
          );
        }
      }
    }
    const xs = corners.map((c) => c.x);
    const ys = corners.map((c) => c.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const fcx = (minX + maxX) / 2;
    const fcy = (minY + maxY) / 2;
    const r = Math.max((maxX - minX) / 2, (maxY - minY) / 2) * 1.3 + 1;
    return { cx: fcx, cy: fcy, r };
  }

  return (
    <g className="detail-callout">
      {targets.map((t, i) => {
        const p = placements[i];
        if (!p) return null; // 沒角落塞 → 不渲染
        const feature = projectFeature(t.localBox);

        const m = t.kind === "mortise" ? part.mortises[t.idx] : part.tenons[t.idx];
        const W = round1(m.width ?? 0);
        const L = round1(m.length ?? 0);
        // mortise: depth；tenon: thickness（斷面 T）
        const D = round1(
          t.kind === "mortise"
            ? (part.mortises[t.idx].depth ?? 0)
            : (part.tenons[t.idx].thickness ?? 0),
        );
        const targetName =
          t.kind === "mortise" ? `榫眼${t.idx + 1}` : `榫頭${t.idx + 1}`;
        const dimText =
          t.kind === "mortise" ? `${W}×${L} 深${D}` : `${W}×${D} 長${L}`;

        // Leader: feature 圓邊朝 inset 中心方向 → inset 最近角
        const insetCx = p.x + p.w / 2;
        const insetCy = p.y + p.h / 2;
        const dx = insetCx - feature.cx;
        const dy = insetCy - feature.cy;
        const dist = Math.hypot(dx, dy) || 1;
        const lx1 = feature.cx + (dx / dist) * feature.r;
        const ly1 = feature.cy + (dy / dist) * feature.r;
        const fromLeft = lx1 < insetCx;
        const fromTop = ly1 < insetCy;
        const lx2 = fromLeft ? p.x : p.x + p.w;
        const ly2 = fromTop ? p.y : p.y + p.h;

        return (
          <g key={i}>
            {/* feature 圓圈 + 字母 */}
            <circle
              cx={feature.cx}
              cy={feature.cy}
              r={feature.r}
              fill="none"
              stroke="#dc2626"
              strokeWidth={0.8}
            />
            <text
              x={feature.cx + feature.r + 2}
              y={feature.cy - feature.r + 4}
              fontSize={7}
              fill="#dc2626"
              fontWeight="bold"
            >
              {t.label}
            </text>

            {/* leader */}
            <line
              x1={lx1}
              y1={ly1}
              x2={lx2}
              y2={ly2}
              stroke="#dc2626"
              strokeWidth={0.5}
              strokeDasharray="3 1.5"
            />

            {/* inset background */}
            <rect
              x={p.x}
              y={p.y}
              width={p.w}
              height={p.h}
              fill="white"
              stroke="#dc2626"
              strokeWidth={0.6}
            />

            {/* inset title */}
            <text
              x={p.x + 3}
              y={p.y + 9}
              fontSize={6}
              fill="#dc2626"
              fontWeight="bold"
            >
              {`詳圖 ${t.label} 2:1`}
            </text>

            {/* feature name + dims（text-only，避免幾何變換誤差） */}
            <text
              x={p.x + p.w / 2}
              y={p.y + p.h / 2}
              fontSize={6.5}
              fill="#374151"
              textAnchor="middle"
            >
              {targetName}
            </text>
            <text
              x={p.x + p.w / 2}
              y={p.y + p.h / 2 + 9}
              fontSize={5.5}
              fill="#374151"
              textAnchor="middle"
              fontFamily="monospace"
            >
              {dimText}
            </text>
          </g>
        );
      })}
    </g>
  );
}
