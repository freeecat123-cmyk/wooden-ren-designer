import React from "react";
import type { FurnitureDesign } from "@/lib/types";
import {
  groupPartsForDrawing,
  type PartDrawingGroup,
} from "@/lib/render/part-drawing/grouping";
import { OrthoView } from "@/lib/render/svg-views";
import { partName } from "@/lib/templates/part-names";

interface Props {
  design: FurnitureDesign;
  locale?: string;
}

/**
 * Shapes that produce curved/non-rectangular silhouettes and benefit from
 * a 1:1 paper template the carpenter can cut out and stick onto stock.
 *
 * - arch-bent: 弧形件、需要照外輪廓鋸或蒸彎
 * - lathe-turned: 車旋件、需要照剖面車
 * - hoof: 馬蹄腳、腳趾段需要照線鋸
 * - live-edge: 自然邊、要照波浪線
 *
 * Spec: docs/superpowers/specs/2026-05-17-part-drawings-phase-4-design.md §4
 */
const CURVED_SHAPES = new Set<string>([
  "arch-bent",
  "lathe-turned",
  "hoof",
  "live-edge",
]);

function isCurvedPart(g: PartDrawingGroup): boolean {
  const shape = g.representative.shape;
  return !!(shape && CURVED_SHAPES.has(shape.kind));
}

/**
 * Print section: 1:1 真實尺寸樣板列印頁（Phase 4 Task 4）。
 *
 * 每件 curved/lathe/arch-bent/hoof/live-edge 件一頁，SVG width/height 用
 * CSS `${mm}mm` 寫死、`@media print` 出 1:1，工匠剪下貼擋板用。
 *
 * 沒有 curved 件時整段不渲染（pure-box 家具不要無謂分頁）。
 */
export function PrintTemplates({ design, locale = "zh-TW" }: Props) {
  const groups = groupPartsForDrawing(design);
  const curvedGroups = groups.filter(isCurvedPart);
  if (!curvedGroups.length) return null;
  const isEn = locale === "en";

  return (
    <>
      {curvedGroups.map((g) => {
        const p = g.representative;
        return (
          <section
            key={g.hash}
            data-print-page
            className="px-10 py-12 print-keep"
          >
            <div className="mb-2 pb-2 border-b-2 border-zinc-900">
              <h2 className="text-xl font-bold">
                {isEn
                  ? `Template — ${partName(p, locale)} (1:1 true size)`
                  : `樣板 — ${p.nameZh}（1:1 真實尺寸）`}
              </h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                {isEn ? "Cut along the outline and adhere to a story board" : "沿外輪廓剪下、貼擋板使用"}
              </p>
            </div>
            <div
              style={{
                width: `${p.visible.length}mm`,
                maxWidth: "100%",
              }}
            >
              <OrthoView
                design={design}
                view="front"
                title=""
                titleEn=""
                isolatePartId={p.id}
                showDimensions={false}
              />
            </div>
          </section>
        );
      })}
    </>
  );
}
