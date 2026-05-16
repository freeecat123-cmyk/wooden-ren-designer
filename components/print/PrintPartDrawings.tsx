import React from "react";
import type { FurnitureDesign } from "@/lib/types";
import { groupPartsForDrawing } from "@/lib/render/part-drawing/grouping";
import { PartDrawing } from "@/lib/render/part-drawing/drawing";

interface Props {
  design: FurnitureDesign;
}

/**
 * Print page section: per-part shop drawings ("零件圖") in 2×2 grid.
 * Each card is `.print-keep` so it won't split across A4 page boundaries.
 * Hides entirely if no parts trigger the predicate (pure-box furniture).
 */
export function PrintPartDrawings({ design }: Props) {
  const groups = groupPartsForDrawing(design);

  if (!groups.length) return null;

  return (
    <section data-print-page className="px-10 py-12">
      <div className="mb-4 pb-2 border-b-2 border-zinc-900">
        <h2 className="text-2xl font-bold">零件圖</h2>
        <p className="text-xs text-zinc-500 mt-0.5">
          共 {groups.length} 件（合併同形後）—— 每張含三視圖、主要尺寸、榫卯位置
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {groups.map((g, idx) => (
          <PartDrawing key={g.hash} group={g} design={design} index={idx} />
        ))}
      </div>
    </section>
  );
}
