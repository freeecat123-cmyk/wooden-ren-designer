import React from "react";
import type { FurnitureDesign } from "@/lib/types";
import {
  groupPartsForDrawing,
  type PartDrawingGroup,
} from "@/lib/render/part-drawing/grouping";
import { PartDrawing } from "@/lib/render/part-drawing/drawing";

interface Props {
  design: FurnitureDesign;
  locale?: string;
}

/**
 * Hard shapes whose annotations (lathe segment table / arch chord / apron
 * trapezoid dual-edge / hoof direction / splayed true length) need the full
 * row in print. These render with `col-span-2` so they consume an entire row
 * of the 2-column grid instead of half.
 *
 * Spec: docs/superpowers/specs/2026-05-16-part-drawings-phase3-design.md §7
 */
const HARD_SHAPES = new Set<string>([
  "lathe-turned",
  "arch-bent",
  "apron-trapezoid",
  "hoof",
  "splayed-tapered",
  "splayed-round-tapered",
]);

function isHardPart(g: PartDrawingGroup): boolean {
  const shape = g.representative.shape;
  return !!(shape && HARD_SHAPES.has(shape.kind));
}

/**
 * Print page section: per-part shop drawings ("零件圖") in 2×2 grid.
 * Each card is `.print-keep` so it won't split across A4 page boundaries.
 * Hides entirely if no parts trigger the predicate (pure-box furniture).
 *
 * Hard-shape parts (HARD_SHAPES) take `col-span-2` so their richer
 * annotations (Phase 3) get a full row; lighter parts stay 2-up.
 */
export function PrintPartDrawings({ design, locale = "zh-TW" }: Props) {
  const groups = groupPartsForDrawing(design);

  if (!groups.length) return null;
  const isEn = locale === "en";

  return (
    <section data-print-page className="px-10 py-12">
      <div className="mb-4 pb-2 border-b-2 border-zinc-900">
        <h2 className="text-2xl font-bold">{isEn ? "Part drawings" : "零件圖"}</h2>
        <p className="text-xs text-zinc-500 mt-0.5">
          {isEn
            ? `${groups.length} parts (deduplicated by shape) — each card has 3 views, key dimensions, joinery positions`
            : `共 ${groups.length} 件（合併同形後）—— 每張含三視圖、主要尺寸、榫卯位置`}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {groups.map((g, idx) => (
          <div
            key={g.hash}
            className={isHardPart(g) ? "col-span-2" : undefined}
          >
            <PartDrawing group={g} design={design} index={idx} />
          </div>
        ))}
      </div>
    </section>
  );
}
