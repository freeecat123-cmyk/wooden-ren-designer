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
