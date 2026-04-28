"use client";

import { useEffect, useState } from "react";
import { OrthoView } from "@/lib/render/svg-views";
import type { FurnitureDesign } from "@/lib/types";

type ViewKind = "front" | "side" | "top";

const VIEW_TITLES: Record<ViewKind, { zh: string; en: string }> = {
  front: { zh: "正視圖", en: "FRONT VIEW" },
  side: { zh: "側視圖", en: "SIDE VIEW" },
  top: { zh: "俯視圖", en: "TOP VIEW" },
};

/**
 * 三視圖三宮格——每張獨立可點擊放大；放大時 modal 只顯示被點的那一張，
 * 占滿視窗（90vw × 88vh），SVG 自動依比例最大化。ESC / 點背景關閉。
 * Modal 內含 +/- zoom 控制：1x = fit，可放到 4x（內部捲軸瀏覽）
 */
export function ZoomableThreeViews({ design }: { design: FurnitureDesign }) {
  const [zoomed, setZoomed] = useState<ViewKind | null>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    if (!zoomed) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setZoomed(null);
      if (e.key === "+" || e.key === "=") setScale((s) => Math.min(4, s + 0.25));
      if (e.key === "-" || e.key === "_") setScale((s) => Math.max(1, s - 0.25));
      if (e.key === "0") setScale(1);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [zoomed]);

  // 換 view 時 reset scale
  useEffect(() => {
    if (zoomed) setScale(1);
  }, [zoomed]);

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(["front", "side", "top"] as const).map((view) => (
          <button
            key={view}
            type="button"
            onClick={() => setZoomed(view)}
            className="border border-zinc-200 rounded-lg overflow-hidden bg-white shadow-sm cursor-zoom-in hover:border-amber-400 hover:shadow-md transition relative group text-left"
            aria-label={`點擊放大${VIEW_TITLES[view].zh}`}
            title="點擊放大"
          >
            <OrthoView
              design={design}
              view={view}
              title={VIEW_TITLES[view].zh}
              titleEn={VIEW_TITLES[view].en}
            />
            <span className="absolute top-1.5 right-1.5 text-[10px] bg-zinc-900/70 text-white px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition">
              🔍 點擊放大
            </span>
          </button>
        ))}
      </div>

      {zoomed && (
        <div
          className="fixed inset-0 z-50 bg-zinc-900/90 flex flex-col items-center justify-center cursor-zoom-out"
          onClick={() => setZoomed(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="relative bg-white shadow-2xl w-screen h-screen flex flex-col cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-200">
              <div className="text-sm font-semibold text-zinc-800">
                {VIEW_TITLES[zoomed].zh} · {design.nameZh}
              </div>
              <div className="flex items-center gap-2">
                {(["front", "side", "top"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setZoomed(v)}
                    className={`px-2 py-1 text-xs rounded ${
                      v === zoomed
                        ? "bg-amber-500 text-white"
                        : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                    }`}
                  >
                    {VIEW_TITLES[v].zh}
                  </button>
                ))}
                <div className="ml-2 flex items-center gap-1 bg-zinc-100 rounded px-1 py-0.5">
                  <button
                    type="button"
                    onClick={() => setScale((s) => Math.max(1, s - 0.25))}
                    disabled={scale <= 1}
                    className="w-6 h-6 rounded text-zinc-700 hover:bg-white disabled:opacity-30 text-base leading-none"
                    title="縮小 (−)"
                  >−</button>
                  <button
                    type="button"
                    onClick={() => setScale(1)}
                    className="px-1.5 h-6 rounded text-[11px] text-zinc-700 hover:bg-white tabular-nums min-w-[42px]"
                    title="重設 (0)"
                  >{Math.round(scale * 100)}%</button>
                  <button
                    type="button"
                    onClick={() => setScale((s) => Math.min(4, s + 0.25))}
                    disabled={scale >= 4}
                    className="w-6 h-6 rounded text-zinc-700 hover:bg-white disabled:opacity-30 text-base leading-none"
                    title="放大 (+)"
                  >＋</button>
                </div>
                <button
                  type="button"
                  onClick={() => setZoomed(null)}
                  className="ml-2 w-7 h-7 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-base flex items-center justify-center"
                  aria-label="關閉"
                  title="關閉 (ESC)"
                >
                  ×
                </button>
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-auto flex items-center justify-center bg-zinc-50">
              {/* scale > 1 時用 transform: scale + 內部 div 給 overflow 捲軸瀏覽 */}
              <div
                style={{
                  width: `${scale * 100}%`,
                  height: `${scale * 100}%`,
                  flexShrink: 0,
                }}
                className="flex items-center justify-center"
              >
                <OrthoView
                  design={design}
                  view={zoomed}
                  title={VIEW_TITLES[zoomed].zh}
                  titleEn={VIEW_TITLES[zoomed].en}
                  className="bg-white w-full h-full"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
