import React from "react";
import type { FurnitureDesign } from "@/lib/types";
import {
  groupPartsForDrawing,
  type PartDrawingGroup,
} from "@/lib/render/part-drawing/grouping";
import { rawStockSize } from "@/lib/render/part-drawing/raw-stock";
import { MATERIALS } from "@/lib/materials";

interface Props {
  design: FurnitureDesign;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * 「工法」欄是 derived hint — 從 shape.kind + mortise/tenon 有無推導。
 * 沒有用 process-steps.ts 是因為這欄要單字級短語、不是工序鏈。
 */
function workMethod(g: PartDrawingGroup): string {
  const p = g.representative;
  const shape = p.shape?.kind;
  if (shape === "lathe-turned") return "車旋";
  if (shape === "arch-bent") return "蒸彎/疊層";
  if (shape === "hoof") return "鑿馬蹄";
  if (shape === "apron-trapezoid") return "斜切+榫";
  if (shape === "splayed-tapered" || shape === "splayed-round-tapered")
    return "斜切+榫";
  const hasM = (p.mortises?.length ?? 0) > 0;
  const hasT = (p.tenons?.length ?? 0) > 0;
  if (hasM && hasT) return "榫眼+榫頭";
  if (hasM) return "鑿榫眼";
  if (hasT) return "開榫頭";
  return "鋸刨";
}

/**
 * 零件清單索引頁（Phase 4 Task 1）。
 *
 * 印製頁順序：榫卯細節 → 【零件清單索引】→ 零件圖 → 工具
 *
 * 表格欄：編號 / 名稱 / ×N / 成品 / 毛料 / 材料 / 工法
 * - 編號 P-NN：跟 PartDrawing 卡片右上角 partNo 對齊
 * - 工法：by shape.kind 優先、再 fallback 到 mortise/tenon 有無
 *
 * 整套先看零件總覽 → 翻到 PartDrawing 卡片找細節。
 */
export function PartDrawingsIndex({ design }: Props) {
  const groups = groupPartsForDrawing(design);
  if (!groups.length) return null;

  return (
    <section data-print-page className="px-10 py-12">
      <div className="mb-4 pb-2 border-b-2 border-zinc-900">
        <h2 className="text-2xl font-bold">零件清單索引</h2>
        <p className="text-xs text-zinc-500 mt-0.5">
          共 {groups.length} 件（合併同形）— 下方各 P-NN 為零件圖編號
        </p>
      </div>

      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b border-zinc-700 text-left">
            <th className="py-1 pr-2 w-14">編號</th>
            <th className="py-1 pr-2">名稱</th>
            <th className="py-1 pr-2 w-12">×N</th>
            <th className="py-1 pr-2">成品 L×W×T</th>
            <th className="py-1 pr-2">毛料 L×W×T</th>
            <th className="py-1 pr-2">材料</th>
            <th className="py-1 pr-2">工法</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g, idx) => {
            const p = g.representative;
            const raw = rawStockSize(p);
            const mat =
              MATERIALS[p.material]?.nameZh ??
              MATERIALS[p.material]?.nameEn ??
              p.material;
            const partNo = `P-${String(idx + 1).padStart(2, "0")}`;
            const countLabel =
              g.count > 1
                ? `×${Math.min(g.count, 99)}${g.count > 99 ? "+" : ""}`
                : "";
            return (
              <tr key={g.hash} className="border-b border-zinc-200">
                <td className="py-1 pr-2 font-mono tabular-nums">{partNo}</td>
                <td className="py-1 pr-2">{p.nameZh}</td>
                <td className="py-1 pr-2 font-mono tabular-nums">{countLabel}</td>
                <td className="py-1 pr-2 font-mono tabular-nums">
                  {round1(p.visible.length)}×{round1(p.visible.width)}×
                  {round1(p.visible.thickness)}
                </td>
                <td className="py-1 pr-2 font-mono tabular-nums text-zinc-600">
                  {raw.L}×{raw.W}×{raw.T}
                </td>
                <td className="py-1 pr-2">{mat}</td>
                <td className="py-1 pr-2">{workMethod(g)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
