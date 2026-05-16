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
import type { Part } from "@/lib/types";
import {
  DimensionLine,
  VerticalDimensionLine,
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
  const OFFSET = 28; // mm；DimensionLine reach=26 留 2mm CNS gap

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

  const horizY = Math.max(horizP1.y, horizP2.y) + OFFSET;
  const vertX = Math.max(vertP1.x, vertP2.x) + OFFSET;

  return (
    <g className="t1-dim-overlay">
      <DimensionLine
        arrowId={arrowId}
        x1={horizP1.x}
        x2={horizP2.x}
        y={horizY}
        label={`${horizLabel} ${horiz}`}
      />
      <VerticalDimensionLine
        arrowId={arrowId}
        x={vertX}
        y1={vertP1.y}
        y2={vertP2.y}
        label={`${vertLabel} ${vert}`}
      />
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
export function T2LabelList({ part }: { part: Part }) {
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

  const lines: string[] = [];

  part.mortises.forEach((m, idx) => {
    const W = round1(m.width);
    const L = round1(m.length);
    const D = round1(m.depth);
    const lb = mortiseLocalBox(part, m);
    const yFromBottom = round1(lb.cy + ly / 2);
    const face = mortiseFaceHint(m);
    const throughTag = m.through ? "通" : "";
    lines.push(
      `榫眼${idx + 1}（${face}${throughTag}）：${W}×${L} 深 ${D}，距底 ${yFromBottom}`,
    );
  });

  part.tenons.forEach((t, idx) => {
    const W = round1(t.width);
    const T = round1(t.thickness);
    // Tenon `length` 就是榫頭凸出長度（沒有獨立 depth 欄位）
    const protrusion = round1(t.length);
    const lb = tenonLocalBox(part, t);
    const yFromBottom = round1(lb.cy + ly / 2);
    lines.push(
      `榫頭${idx + 1}（${t.position}）：${W}×${T} 長 ${protrusion}，距底 ${yFromBottom}`,
    );
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

  const rects: React.ReactNode[] = [];

  part.mortises.forEach((m, idx) => {
    const lb = mortiseLocalBox(part, m);
    const r = projectBoxRect(lb);
    if (!r) return;
    rects.push(
      <rect
        key={`m-${idx}-${view}`}
        x={r.x}
        y={r.y}
        width={r.w}
        height={r.h}
        fill="none"
        stroke="#666"
        strokeWidth={0.6}
        strokeDasharray="2 2"
      />,
    );
  });

  part.tenons.forEach((t, idx) => {
    if (t.length <= 0) return;
    const lb = tenonLocalBox(part, t);
    const r = projectBoxRect(lb);
    if (!r) return;
    rects.push(
      <rect
        key={`t-${idx}-${view}`}
        x={r.x}
        y={r.y}
        width={r.w}
        height={r.h}
        fill="none"
        stroke="#888"
        strokeWidth={0.5}
        strokeDasharray="3 1.5"
      />,
    );
  });

  if (!rects.length) return null;
  return <g className="t2-overlay">{rects}</g>;
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
