"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLocale } from "next-intl";
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
export function ZoomableThreeViews({
  design,
  joineryMode = false,
}: {
  design: FurnitureDesign;
  joineryMode?: boolean;
}) {
  const locale = useLocale();
  const isEn = locale === "en";
  const titleFor = (v: ViewKind) => isEn ? VIEW_TITLES[v].en : VIEW_TITLES[v].zh;
  const titleEnFor = (v: ViewKind) => isEn ? "" : VIEW_TITLES[v].en;
  const [zoomed, setZoomed] = useState<ViewKind | null>(null);
  const [scale, setScale] = useState(1);
  const scrollRef = useRef<HTMLDivElement>(null);

  // scale 變動時把 scroll 位置同步到「中央錨定放大」效果——使用者按 +
  // 不會看到圖往右下跑，而是維持以中心為基準向四周擴張
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
            aria-label={isEn ? `Tap to zoom ${VIEW_TITLES[view].en}` : `點擊放大${VIEW_TITLES[view].zh}`}
            title={isEn ? "Tap to zoom" : "點擊放大"}
          >
            <OrthoView
              design={design}
              view={view}
              title={titleFor(view)}
              titleEn={titleEnFor(view)}
              joineryMode={joineryMode}
              locale={locale}
            />
            <span className="absolute top-1.5 right-1.5 text-xs bg-zinc-900/70 text-white px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition">
              {isEn ? "🔍 Tap to zoom" : "🔍 點擊放大"}
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
          {/* 永遠浮在最上面：3 視圖切換 chip + 縮放整合成同一個 pill，
              手機 390px header 一排塞不下時也找得到、按得到。
              用 -mt 把 safe-area inset 拉進來，瀏海下也露 */}
          <div
            className="fixed top-3 left-3 z-[60] flex items-center gap-1 bg-white/95 rounded-full shadow-lg ring-1 ring-zinc-300 p-1"
            onClick={(e) => e.stopPropagation()}
            style={{ marginTop: "env(safe-area-inset-top)" }}
          >
            {(["front", "side", "top"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setZoomed(v)}
                className={`min-h-[32px] min-w-[40px] px-2.5 py-1 rounded-full text-xs font-medium ${
                  v === zoomed
                    ? "bg-amber-500 text-white"
                    : "text-zinc-700 hover:bg-zinc-100"
                }`}
              >
                {titleFor(v)}
              </button>
            ))}
            <span className="w-px h-5 bg-zinc-300 mx-0.5" aria-hidden />
            <button
              type="button"
              onClick={() => setScale((s) => Math.max(1, s - 0.25))}
              disabled={scale <= 1}
              className="min-h-[32px] min-w-[32px] rounded-full text-zinc-700 hover:bg-zinc-100 disabled:opacity-30 text-base leading-none"
              title={isEn ? "Zoom out (−)" : "縮小 (−)"}
            >−</button>
            <button
              type="button"
              onClick={() => setScale(1)}
              className="min-h-[32px] px-1.5 rounded-full text-[11px] text-zinc-700 hover:bg-zinc-100 tabular-nums min-w-[42px]"
              title={isEn ? "Reset (0)" : "重設 (0)"}
            >{Math.round(scale * 100)}%</button>
            <button
              type="button"
              onClick={() => setScale((s) => Math.min(4, s + 0.25))}
              disabled={scale >= 4}
              className="min-h-[32px] min-w-[32px] rounded-full text-zinc-700 hover:bg-zinc-100 disabled:opacity-30 text-base leading-none"
              title={isEn ? "Zoom in (+)" : "放大 (+)"}
            >＋</button>
          </div>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setZoomed(null); }}
            className="fixed top-3 right-3 z-[60] w-11 h-11 rounded-full bg-white/95 shadow-lg ring-1 ring-zinc-300 text-zinc-800 text-xl font-bold flex items-center justify-center hover:bg-white"
            aria-label={isEn ? "Close zoomed view" : "關閉放大檢視"}
            title={isEn ? "Close (ESC)" : "關閉 (ESC)"}
            style={{ marginTop: "env(safe-area-inset-top)" }}
          >
            ×
          </button>
          <div
            className="relative bg-white shadow-2xl w-screen h-screen flex flex-col cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 視圖切換 + 縮放 + X 都搬到上面 floating，header 整條移除讓 SVG 吃滿 viewport */}
            <div
              ref={scrollRef}
              className="flex-1 min-h-0 overflow-auto flex bg-zinc-50 [align-items:safe_center] [justify-content:safe_center]"
            >
              {/* scale > 1 時內容溢出對稱方向；safe center 讓溢出時退回 start-alignment，scrollbar 才能捲到頂部/最左邊 */}
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
                  title={titleFor(zoomed)}
                  titleEn={titleEnFor(zoomed)}
                  className="bg-white w-full h-full"
                  joineryMode={joineryMode}
                  locale={locale}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
