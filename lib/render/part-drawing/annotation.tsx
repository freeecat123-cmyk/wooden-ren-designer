/**
 * <T1Dimensions> + <T1DimensionsRow> — 零件圖 T1 整體尺寸標註
 *
 * 第三角投影慣例（與 OrthoView 一致）：
 *   front view: 水平 = length（長），垂直 = thickness（厚）
 *   top view:   水平 = length（長），垂直 = width（寬）
 *   side view:  水平 = width（寬），  垂直 = thickness（厚）
 *
 * Phase 1：以 text row 形式輸出在每張 OrthoView 下方（穩、無對位風險）。
 * Phase 2 會把 <T1Dimensions> SVG 元件（已就緒）promote 成 OrthoView 內 overlay
 * 形式，畫真正的尺寸線 + 箭頭。
 *
 * Spec: docs/superpowers/specs/2026-05-16-part-drawings-design.md §4.2 element 2
 */

import React from "react";
import type { Part } from "@/lib/types";
import {
  DimensionLine,
  VerticalDimensionLine,
  mortiseLocalBox,
  tenonLocalBox,
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

interface T1DimensionsProps {
  part: Part;
  view: PartView;
  /** 視圖 mm 單位下的 bbox 範圍（OrthoView viewBox 等同 mm）。 */
  bboxHalfW: number;
  bboxTop: number;
  bboxBottom: number;
  /** dim line 距 bbox 邊的 offset（mm）。預設 28（OrthoView 慣例）。 */
  offset?: number;
  /** SVG defs 中 marker id（OrthoView 用 `arr-${view}`）。 */
  arrowId: string;
}

/**
 * SVG overlay 形式（Phase 2 用）：直接放進 SVG `<g>`，需要外部 SVG 有對應 viewBox。
 * Phase 1 PartDrawing 不用此 SVG 形式，改用 <T1DimensionsRow> text-row。
 */
export function T1Dimensions({
  part,
  view,
  bboxHalfW,
  bboxTop,
  bboxBottom,
  offset = 28,
  arrowId,
}: T1DimensionsProps) {
  const { horiz, vert, horizLabel, vertLabel } = getT1ForView(part, view);
  return (
    <g className="t1-dims">
      <DimensionLine
        arrowId={arrowId}
        x1={-bboxHalfW}
        x2={bboxHalfW}
        y={bboxBottom + offset}
        label={`${horizLabel} ${horiz} mm`}
      />
      <VerticalDimensionLine
        arrowId={arrowId}
        x={bboxHalfW + offset}
        y1={bboxTop}
        y2={bboxBottom}
        label={`${vertLabel} ${vert} mm`}
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
 * T2 joinery feature bounding boxes (Phase 2 promotion candidate).
 *
 * Renders thin-dashed rectangles inside each view to mark mortise/tenon
 * positions. Phase 1 用 <T1LabelList> 取代（純文字、無對位風險）。
 * Phase 2 會把 OrthoView 的 viewBox 計算外露出來，配合 projectFeatureRect
 * 在 view 內疊一層 SVG `<g>` 畫 dashed bbox + leader line 接到 T2LabelList。
 *
 * Stub 目前回 null，留 prop signature 給 Phase 2 接手用。
 */
export function T2Annotations(_props: {
  part: Part;
  view: PartView;
  width: number;
  height: number;
}) {
  return null;
}
