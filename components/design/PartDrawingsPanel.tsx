"use client";

/**
 * <PartDrawingsPanel> — interactive list of part drawings（Phase 1 Task 7）
 *
 * /design/[type] 三視圖下方的 inline section：
 *   - 用 groupPartsForDrawing(design) 算出零件群組（含 mirror split + ×N count）
 *   - 卡片網格列出每個 group：nameZh + ×N + P-NN + L×W×T
 *   - 點卡片開 modal：完整 <PartDrawing> + 上一件/下一件導航 + × 關閉
 *   - groups.length === 0 → 整段不渲染（純方料 furniture 不出零件圖）
 *
 * Spec: docs/superpowers/specs/2026-05-16-part-drawings-design.md §5.3 §5.5
 */

import React, { useState } from "react";
import type { FurnitureDesign, Part } from "@/lib/types";
import { groupPartsForDrawing } from "@/lib/render/part-drawing/grouping";
import { PartDrawing } from "@/lib/render/part-drawing/drawing";

interface Props {
  design: FurnitureDesign;
}

type PartView = "front" | "top" | "side";
const ZOOM_LEVELS = [1, 2, 3, 5, 8] as const;
type ZoomLevel = (typeof ZOOM_LEVELS)[number];

// 顯示用：mm 最多保留 1 位小數（feedback_ui_number_precision）。
// 內部計算保持高精度，只在 render layer round。
const fmt = (n: number): string => {
  const rounded = Math.round(n * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
};

// 圓料家族：part.shape.kind 屬於圓族時，dim 用「Ø{直徑}×{長度}」不寫 L×W×T。
// 規則對齊 `889a38c`（圓料 tenon ellipse）與 annotation.tsx 的 isRoundPart。
function isRoundFamilyPart(part: Part): boolean {
  const k = part.shape?.kind;
  return (
    k === "round" ||
    k === "round-tapered" ||
    k === "splayed-round-tapered" ||
    k === "lathe-turned" ||
    k === "shaker"
  );
}

// 圓料 dim：visible.length = 長軸長；直徑取 width / thickness 較大者
// （防 thickness=length 的橫躺圓料 edge case）。
function roundPartDim(part: Part): string {
  const len = part.visible.length;
  const diameter = Math.max(part.visible.width, part.visible.thickness);
  return `Ø${fmt(diameter)}×${fmt(len)}`;
}

export function PartDrawingsPanel({ design }: Props) {
  const groups = groupPartsForDrawing(design);
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [zoomedView, setZoomedView] = useState<PartView | null>(null);
  const [zoom, setZoom] = useState<ZoomLevel>(2);

  if (!groups.length) return null;

  return (
    <section className="mt-5 rounded-2xl border border-amber-200/70 bg-white shadow-md shadow-amber-900/5 overflow-hidden">
      <div className="px-4 py-2.5 border-b border-amber-100 bg-gradient-to-r from-amber-50/80 to-transparent text-xs font-semibold text-zinc-800 flex items-center gap-2">
        <span className="w-1 h-4 bg-amber-500 rounded-full" />
        零件圖
        <span className="ml-auto text-[10px] font-normal text-zinc-400">
          共 {groups.length} 件（合併同形）
        </span>
      </div>

      {/* List of group cards */}
      <ul className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 p-3">
        {groups.map((g, idx) => (
          <li key={g.hash}>
            <button
              type="button"
              className="w-full text-left border border-zinc-200 rounded-xl p-2.5 hover:border-amber-300 hover:bg-amber-50/50 hover:shadow-sm transition-all"
              onClick={() => setOpenIdx(idx)}
            >
              <div className="text-sm font-semibold text-zinc-900">
                {g.representative.nameZh}
                {g.count > 1 ? (
                  <span className="text-zinc-500 ml-1">
                    ×{Math.min(g.count, 99)}
                    {g.count > 99 ? "+" : ""}
                  </span>
                ) : null}
              </div>
              <div className="text-[10px] text-zinc-500 mt-0.5 tabular-nums">
                P-{String(idx + 1).padStart(2, "0")} ·{" "}
                {isRoundFamilyPart(g.representative)
                  ? roundPartDim(g.representative)
                  : `${fmt(g.representative.visible.length)}×${fmt(
                      g.representative.visible.width,
                    )}×${fmt(g.representative.visible.thickness)}`}
              </div>
            </button>
          </li>
        ))}
      </ul>

      {/* Modal */}
      {openIdx !== null ? (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          onClick={() => setOpenIdx(null)}
        >
          <div
            className="bg-white rounded-lg w-[95vw] max-w-[1400px] max-h-[95vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center gap-3 p-3 border-b border-zinc-200 sticky top-0 bg-white z-10">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                {zoomedView !== null && (
                  <button
                    type="button"
                    onClick={() => setZoomedView(null)}
                    className="text-zinc-600 hover:text-zinc-900 text-xs px-2 py-0.5 rounded border border-zinc-300 hover:bg-zinc-50"
                  >
                    ← 返回三視圖
                  </button>
                )}
                零件圖 — {groups[openIdx].representative.nameZh}
                {zoomedView && (
                  <span className="text-zinc-500 text-xs">
                    （
                    {zoomedView === "front"
                      ? "正視"
                      : zoomedView === "top"
                      ? "俯視"
                      : "側視"}
                    ）
                  </span>
                )}
              </h3>
              {zoomedView !== null && (
                <div className="flex items-center gap-1 ml-auto">
                  <span className="text-[10px] text-zinc-500 mr-1">放大</span>
                  {ZOOM_LEVELS.map((z) => (
                    <button
                      key={z}
                      type="button"
                      onClick={() => setZoom(z)}
                      className={`text-xs px-2 py-0.5 rounded border tabular-nums ${
                        zoom === z
                          ? "bg-amber-500 text-white border-amber-500"
                          : "border-zinc-300 text-zinc-700 hover:bg-zinc-50"
                      }`}
                    >
                      {z}×
                    </button>
                  ))}
                </div>
              )}
              <button
                type="button"
                className={`text-zinc-500 hover:text-zinc-900 text-xl leading-none ${
                  zoomedView !== null ? "ml-2" : "ml-auto"
                }`}
                onClick={() => {
                  setOpenIdx(null);
                  setZoomedView(null);
                  setZoom(2);
                }}
                aria-label="關閉"
              >
                ×
              </button>
            </div>
            <div className="p-4 overflow-auto">
              {/* zoom 改交給 PartDrawing 內部處理：只縮 SVG drawing 本體、
                  不縮卡片邊框 / 標題列 / 右上角 InstallHintMini / 底部 title block / T2 標註清單。
                  外層不再 transform: scale，避免「正視/側視」「縮圖」一起放大。 */}
              <PartDrawing
                group={groups[openIdx]}
                design={design}
                index={openIdx}
                viewLayout="stack"
                singleView={zoomedView ?? undefined}
                onViewClick={
                  zoomedView ? undefined : (v) => setZoomedView(v)
                }
                orthoClassName="bg-white w-full h-auto"
                zoom={zoomedView !== null ? zoom : 1}
              />
              <div className="flex justify-between items-center mt-4 text-sm">
                <button
                  type="button"
                  disabled={openIdx === 0}
                  className="text-zinc-700 disabled:text-zinc-300 disabled:cursor-not-allowed hover:text-zinc-900"
                  onClick={() =>
                    setOpenIdx((i) => (i === null || i === 0 ? i : i - 1))
                  }
                >
                  ← 上一件
                </button>
                <span className="text-zinc-500 tabular-nums">
                  {openIdx + 1} / {groups.length}
                </span>
                <button
                  type="button"
                  disabled={openIdx === groups.length - 1}
                  className="text-zinc-700 disabled:text-zinc-300 disabled:cursor-not-allowed hover:text-zinc-900"
                  onClick={() =>
                    setOpenIdx((i) =>
                      i === null || i === groups.length - 1 ? i : i + 1,
                    )
                  }
                >
                  下一件 →
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
