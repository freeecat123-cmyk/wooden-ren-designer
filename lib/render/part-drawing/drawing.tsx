/**
 * <PartDrawing> — single-part shop drawing card（Phase 1 Task 4）
 *
 * 一張零件的工程圖卡：3 個 OrthoView（正/俯/側）+ 標題列 + 底部材料。
 * Task 4 只做 layout shell，T1/T2 尺寸標註等 Task 5/6 再補。
 *
 * Spec: docs/superpowers/specs/2026-05-16-part-drawings-design.md §4 / §5.1
 */

import React from "react";
import type { FurnitureDesign, Part } from "@/lib/types";
import type { PartDrawingGroup } from "./grouping";
import { OrthoView } from "@/lib/render/svg-views";
import { MATERIALS } from "@/lib/materials";
import {
  T1Dimensions,
  T2Annotations,
  T2LabelList,
  GrainArrow,
  FacingMark,
  ShapeSpecificAnnotation,
} from "./annotation";
import { InstallHintMini } from "./install-hint";
import { rawStockSize } from "./raw-stock";
import { inferProcessSteps, inferTableSawSetting } from "./process-steps";

const round1 = (n: number) => Math.round(n * 10) / 10;

interface PartDrawingProps {
  group: PartDrawingGroup;
  design: FurnitureDesign;
  /** Sequence number (P-01, P-02, ...). 0-based. */
  index: number;
  /** Override scale denominator; default auto. */
  scaleDenom?: number;
  className?: string;
}

/**
 * 自動選比例：以最長邊 / scale 為目標 ≤ 280mm 在紙上的對應長度。
 * 候選 1 / 2 / 5 / 10 / 20 / 50，從小到大選第一個滿足的。
 */
function pickScale(part: Part): number {
  const max = Math.max(
    part.visible.length,
    part.visible.width,
    part.visible.thickness,
  );
  for (const s of [1, 2, 5, 10, 20]) {
    if (max / s <= 280) return s;
  }
  return 50;
}

export function PartDrawing({
  group,
  design,
  index,
  scaleDenom,
  className,
}: PartDrawingProps) {
  const part = group.representative;
  const scale = scaleDenom ?? pickScale(part);
  const partNo = `P-${String(index + 1).padStart(2, "0")}`;
  const titleSuffix =
    group.count > 1
      ? ` ×${Math.min(group.count, 99)}${group.count > 99 ? "+" : ""}`
      : "";
  const material = MATERIALS[part.material];
  const raw = rawStockSize(part);
  const steps = inferProcessSteps(part);
  const tableSaw = inferTableSawSetting(part);

  return (
    <div
      className={`print-keep relative border border-zinc-300 rounded p-3 bg-white ${
        className ?? ""
      }`}
    >
      {/* Install hint mini — 整家具縮圖、target part 紅色（Phase 2.5 Task 1） */}
      <div className="absolute top-2 right-2 z-10">
        <InstallHintMini design={design} highlightPartId={part.id} />
      </div>
      {/* Title bar */}
      <div className="flex items-baseline justify-between border-b border-zinc-200 pb-1 mb-2 pr-[88px]">
        <h3 className="font-semibold text-sm">
          {part.nameZh}
          {titleSuffix}
        </h3>
        <span className="text-xs text-zinc-500 tabular-nums">
          比例 1:{scale}　{partNo}
        </span>
      </div>

      {/* 3 views grid，每張 OrthoView 內疊 T1 SVG overlay（Phase 2） */}
      <div className="grid grid-cols-3 gap-2">
        <OrthoView
          design={design}
          view="front"
          title="正視"
          titleEn="FRONT"
          isolatePartId={part.id}
          showDimensions={false}
          overlayContent={(ctx) => (
            <>
              <T1Dimensions ctx={ctx} part={part} view="front" />
              <T2Annotations ctx={ctx} part={part} view="front" />
              <GrainArrow ctx={ctx} part={part} view="front" />
              <FacingMark ctx={ctx} part={part} view="front" />
              <ShapeSpecificAnnotation ctx={ctx} part={part} view="front" />
            </>
          )}
        />
        <OrthoView
          design={design}
          view="top"
          title="俯視"
          titleEn="TOP"
          isolatePartId={part.id}
          showDimensions={false}
          overlayContent={(ctx) => (
            <>
              <T1Dimensions ctx={ctx} part={part} view="top" />
              <T2Annotations ctx={ctx} part={part} view="top" />
              <GrainArrow ctx={ctx} part={part} view="top" />
              <FacingMark ctx={ctx} part={part} view="top" />
              <ShapeSpecificAnnotation ctx={ctx} part={part} view="top" />
            </>
          )}
        />
        <OrthoView
          design={design}
          view="side"
          title="側視"
          titleEn="SIDE"
          isolatePartId={part.id}
          showDimensions={false}
          overlayContent={(ctx) => (
            <>
              <T1Dimensions ctx={ctx} part={part} view="side" />
              <T2Annotations ctx={ctx} part={part} view="side" />
              <GrainArrow ctx={ctx} part={part} view="side" />
              <FacingMark ctx={ctx} part={part} view="side" />
              <ShapeSpecificAnnotation ctx={ctx} part={part} view="side" />
            </>
          )}
        />
      </div>

      {/* T2 榫卯標註：每件 mortise/tenon 一行 W×L 深 D，距底 X */}
      <T2LabelList part={part} design={design} />

      {/* Phase 2.5 Task 3: title block 底列 — 編號 / 材料 / 比例 / 公差 */}
      <div className="border-t border-zinc-300 mt-2 pt-1 text-[9px] text-zinc-700 font-mono tabular-nums">
        <div className="grid grid-cols-4 gap-1">
          <div>
            <span className="text-zinc-500">編號 </span>
            {partNo}
          </div>
          <div>
            <span className="text-zinc-500">材料 </span>
            {material?.nameZh ?? material?.nameEn ?? part.material}
          </div>
          <div>
            <span className="text-zinc-500">比例 </span>1:{scale}
          </div>
          <div>
            <span className="text-zinc-500">公差 </span>±1mm
          </div>
        </div>
        {/* Phase 2.5 Task 2: 成品 vs 毛料雙標 */}
        <div className="text-zinc-500 mt-0.5">
          成品 {round1(part.visible.length)}×{round1(part.visible.width)}×
          {round1(part.visible.thickness)}　|　毛料 {raw.L}×{raw.W}×{raw.T}
        </div>
        {design.useButtJointConvention !== false && (
          <div className="text-[8px] text-zinc-400 italic mt-0.5">
            ※ visible.length = 含榫對接長度；裸露長 = visible.length − 2 × 榫長
          </div>
        )}
        {part.shape?.kind === "hoof" && (
          <div className="text-[8px] text-amber-700 mt-0.5">
            毛料厚建議 ≥{" "}
            {Math.round(
              part.visible.width * (part.shape.hoofScale ?? 1.4) * 10,
            ) / 10}
            mm
          </div>
        )}
        {/* Phase 4 Task 2: 加工順序建議 */}
        <div className="text-[9px] text-zinc-700 mt-0.5">
          <span className="text-zinc-500">工序 </span>
          {steps.join(" → ")}
        </div>
        {/* Phase 4 Task 3: 鋸台設定值（僅斜角件出現） */}
        {tableSaw && (
          <div className="text-[9px] text-amber-700 mt-0.5">
            <span className="text-amber-500">鋸台 </span>
            {tableSaw}
          </div>
        )}
      </div>
    </div>
  );
}
