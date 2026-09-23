import React from "react";
import type { FurnitureDesign } from "@/lib/types";
import {
  groupPartsForDrawing,
  groupDisplayName,
  type PartDrawingGroup,
} from "@/lib/render/part-drawing/grouping";
import { rawStockSize } from "@/lib/render/part-drawing/raw-stock";
import { MATERIALS, materialName } from "@/lib/materials";

interface Props {
  design: FurnitureDesign;
  locale?: string;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Derived "work-method" hint — from shape.kind + mortise/tenon presence.
 * Short single-phrase per row; not a full process chain.
 */
function workMethod(g: PartDrawingGroup, locale: string): string {
  const isEn = locale === "en";
  const p = g.representative;
  const shape = p.shape?.kind;
  if (shape === "lathe-turned") return isEn ? "Turn" : "車旋";
  if (shape === "arch-bent") return isEn ? "Steam-bend / laminate" : "蒸彎/疊層";
  if (shape === "hoof") return isEn ? "Carve hoof" : "鑿馬蹄";
  if (shape === "apron-trapezoid") return isEn ? "Bevel + tenon" : "斜切+榫";
  if (shape === "splayed-tapered" || shape === "splayed-round-tapered")
    return isEn ? "Bevel + tenon" : "斜切+榫";
  const hasM = (p.mortises?.length ?? 0) > 0;
  const hasT = (p.tenons?.length ?? 0) > 0;
  if (hasM && hasT) return isEn ? "Mortise + tenon" : "榫眼+榫頭";
  if (hasM) return isEn ? "Mortise" : "鑿榫眼";
  if (hasT) return isEn ? "Tenon" : "開榫頭";
  return isEn ? "Saw + plane" : "鋸刨";
}

/**
 * Part-list index page (Phase 4 Task 1).
 * Print order: joinery details → [Part list] → part drawings → tools
 *
 * Columns: ID / Name / ×N / Finished / Raw / Material / Work method
 *  - P-NN ID aligns with the partNo on each PartDrawing card
 *  - Work method derives from shape.kind first, then mortise/tenon presence
 */
export function PartDrawingsIndex({ design, locale = "zh-TW" }: Props) {
  const groups = groupPartsForDrawing(design);
  if (!groups.length) return null;
  const isEn = locale === "en";

  return (
    <section data-print-page className="px-10 py-12">
      <div className="mb-4 pb-2 border-b-2 border-zinc-900">
        <h2 className="text-2xl font-bold">{isEn ? "Part list" : "零件清單索引"}</h2>
        <p className="text-xs text-zinc-500 mt-0.5">
          {isEn
            ? `${groups.length} parts (deduplicated by shape) — P-NN below maps to the drawing cards`
            : `共 ${groups.length} 件（合併同形）— 下方各 P-NN 為零件圖編號`}
        </p>
      </div>

      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b border-zinc-700 text-left">
            <th className="py-1 pr-2 w-14">{isEn ? "ID" : "編號"}</th>
            <th className="py-1 pr-2">{isEn ? "Name" : "名稱"}</th>
            <th className="py-1 pr-2 w-12">×N</th>
            <th className="py-1 pr-2">{isEn ? "Finished L×W×T" : "成品 L×W×T"}</th>
            <th className="py-1 pr-2">{isEn ? "Raw L×W×T" : "毛料 L×W×T"}</th>
            <th className="py-1 pr-2">{isEn ? "Material" : "材料"}</th>
            <th className="py-1 pr-2">{isEn ? "Method" : "工法"}</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g, idx) => {
            const p = g.representative;
            const raw = rawStockSize(p);
            const mat = MATERIALS[p.material]
              ? materialName(p.material, locale)
              : p.material;
            const partNo = `P-${String(idx + 1).padStart(2, "0")}`;
            const countLabel =
              g.count > 1
                ? `×${Math.min(g.count, 99)}${g.count > 99 ? "+" : ""}`
                : "";
            return (
              <tr key={g.hash} className="border-b border-zinc-200">
                <td className="py-1 pr-2 font-mono tabular-nums">{partNo}</td>
                <td className="py-1 pr-2">{groupDisplayName(g, locale)}</td>
                <td className="py-1 pr-2 font-mono tabular-nums">{countLabel}</td>
                <td className="py-1 pr-2 font-mono tabular-nums">
                  {round1(p.visible.length)}×{round1(p.visible.width)}×
                  {round1(p.visible.thickness)}
                </td>
                <td className="py-1 pr-2 font-mono tabular-nums text-zinc-600">
                  {raw.L}×{raw.W}×{raw.T}
                </td>
                <td className="py-1 pr-2">{mat}</td>
                <td className="py-1 pr-2">{workMethod(g, locale)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
