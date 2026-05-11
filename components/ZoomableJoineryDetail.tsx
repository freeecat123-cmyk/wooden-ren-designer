"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { JoineryDetail, JOINERY_LABEL, type JoineryDetailParams } from "@/lib/joinery/details";
import type { JoineryType } from "@/lib/types";

type ViewKind = "front" | "side" | "top" | "iso";

const VIEW_TITLES: Record<ViewKind, string> = {
  front: "正視圖",
  side: "側視圖",
  top: "俯視圖",
  iso: "等角圖",
};

const VIEW_ORDER: ViewKind[] = ["front", "side", "top", "iso"];

/**
 * 榫卯細節圖 4 視圖拆開——每張獨立可點擊放大；放大時 modal 顯示該視圖
 * 占滿視窗 + +/- zoom 控制（1x = fit、最大 4x）。ESC / 點背景關閉。
 * 跟 ZoomableThreeViews 同一 modal pattern。
 */
export function ZoomableJoineryDetail({
  type,
  params,
}: {
  type: JoineryType;
  params: JoineryDetailParams;
}) {
  const [zoomed, setZoomed] = useState<ViewKind | null>(null);
  const [scale, setScale] = useState(1);
  const scrollRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
    el.scrollTop = (el.scrollHeight - el.clientHeight) / 2;
  }, [scale, zoomed]);

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

  useEffect(() => {
    if (zoomed) setScale(1);
  }, [zoomed]);

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {VIEW_ORDER.map((view) => (
          <button
            key={view}
            type="button"
            onClick={() => setZoomed(view)}
            className="border border-zinc-200 rounded-lg overflow-hidden bg-white shadow-sm cursor-zoom-in hover:border-amber-400 hover:shadow-md transition relative group text-left"
            aria-label={`點擊放大 ${JOINERY_LABEL[type]} ${VIEW_TITLES[view]}`}
            title="點擊放大"
          >
            <JoineryDetail type={type} params={params} singleView={view} />
            <span className="absolute top-1.5 right-1.5 text-[10px] bg-zinc-900/70 text-white px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition pointer-events-none">
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
                {JOINERY_LABEL[type]} · {VIEW_TITLES[zoomed]}
              </div>
              <div className="flex items-center gap-2">
                {VIEW_ORDER.map((v) => (
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
                    {VIEW_TITLES[v]}
                  </button>
                ))}
                <div className="ml-2 flex items-center gap-1 bg-zinc-100 rounded px-1 py-0.5">
                  <button
                    type="button"
                    onClick={() => setScale((s) => Math.max(1, s - 0.25))}
                    disabled={scale <= 1}
                    className="w-6 h-6 rounded text-zinc-700 hover:bg-white disabled:opacity-30 text-base leading-none"
                    title="縮小 (−)"
                  >
                    −
                  </button>
                  <button
                    type="button"
                    onClick={() => setScale(1)}
                    className="px-1.5 h-6 rounded text-[11px] text-zinc-700 hover:bg-white tabular-nums min-w-[42px]"
                    title="重設 (0)"
                  >
                    {Math.round(scale * 100)}%
                  </button>
                  <button
                    type="button"
                    onClick={() => setScale((s) => Math.min(4, s + 0.25))}
                    disabled={scale >= 4}
                    className="w-6 h-6 rounded text-zinc-700 hover:bg-white disabled:opacity-30 text-base leading-none"
                    title="放大 (+)"
                  >
                    ＋
                  </button>
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
            <div
              ref={scrollRef}
              className="flex-1 min-h-0 overflow-auto flex bg-zinc-50 [align-items:safe_center] [justify-content:safe_center]"
            >
              <div
                style={{
                  width: `${scale * 100}%`,
                  height: `${scale * 100}%`,
                  flexShrink: 0,
                }}
                className="flex items-center justify-center p-6"
              >
                <div className="w-full h-full flex items-center justify-center" style={{ aspectRatio: "475 / 325" }}>
                  <JoineryDetail type={type} params={params} singleView={zoomed} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
