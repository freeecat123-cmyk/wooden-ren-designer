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

  return (
    <div
      className={`print-keep border border-zinc-300 rounded p-3 bg-white ${
        className ?? ""
      }`}
    >
      {/* Title bar */}
      <div className="flex items-baseline justify-between border-b border-zinc-200 pb-1 mb-2">
        <h3 className="font-semibold text-sm">
          {part.nameZh}
          {titleSuffix}
        </h3>
        <span className="text-xs text-zinc-500 tabular-nums">
          比例 1:{scale}　{partNo}
        </span>
      </div>

      {/* 3 views grid */}
      <div className="grid grid-cols-3 gap-2">
        <OrthoView
          design={design}
          view="front"
          title="正視"
          titleEn="FRONT"
          isolatePartId={part.id}
          showDimensions={false}
        />
        <OrthoView
          design={design}
          view="top"
          title="俯視"
          titleEn="TOP"
          isolatePartId={part.id}
          showDimensions={false}
        />
        <OrthoView
          design={design}
          view="side"
          title="側視"
          titleEn="SIDE"
          isolatePartId={part.id}
          showDimensions={false}
        />
      </div>

      {/* Footer */}
      <div className="mt-2 text-[10px] text-zinc-600">
        材料：{material?.nameZh ?? material?.nameEn ?? part.material}
      </div>
    </div>
  );
}
