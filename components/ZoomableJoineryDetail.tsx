"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { JoineryDetail, JOINERY_LABEL, type JoineryDetailParams } from "@/lib/joinery/details";
import type { JoineryType } from "@/lib/types";

/**
 * 榫卯細節圖卡片——點擊整張 4 quadrant SVG 放大成 modal，
 * 含 +/- zoom 控制（1x = fit、最大 4x）、ESC / 點背景關閉。
 * 跟 ZoomableThreeViews 同一 modal pattern，視覺一致。
 */
export function ZoomableJoineryDetail({
  type,
  params,
}: {
  type: JoineryType;
  params: JoineryDetailParams;
}) {
  const [zoomed, setZoomed] = useState(false);
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
      if (e.key === "Escape") setZoomed(false);
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
      <button
        type="button"
        onClick={() => setZoomed(true)}
        className="block w-full border border-zinc-200 rounded-lg overflow-hidden bg-white shadow-sm cursor-zoom-in hover:border-amber-400 hover:shadow-md transition relative group text-left"
        aria-label={`點擊放大 ${JOINERY_LABEL[type]} 細節圖`}
        title="點擊放大"
      >
        <JoineryDetail type={type} params={params} />
        <span className="absolute top-1.5 right-1.5 text-[10px] bg-zinc-900/70 text-white px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition">
          🔍 點擊放大
        </span>
      </button>

      {zoomed && (
        <div
          className="fixed inset-0 z-50 bg-zinc-900/90 flex flex-col items-center justify-center cursor-zoom-out"
          onClick={() => setZoomed(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="relative bg-white shadow-2xl w-screen h-screen flex flex-col cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-200">
              <div className="text-sm font-semibold text-zinc-800">
                {JOINERY_LABEL[type]} · 4 視圖細節
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 bg-zinc-100 rounded px-1 py-0.5">
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
                  onClick={() => setZoomed(false)}
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
                className="flex items-center justify-center"
              >
                <div className="w-full h-full max-w-[1600px] flex items-center justify-center p-4">
                  <JoineryDetail type={type} params={params} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
