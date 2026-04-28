"use client";

import { useState, useCallback, useEffect } from "react";
import type { FurnitureDesign } from "@/lib/types";
import { OrthoView } from "@/lib/render/svg-views";

type ViewKind = "front" | "side" | "top";

const VIEWS: { kind: ViewKind; title: string; titleEn: string }[] = [
  { kind: "front", title: "正視圖", titleEn: "FRONT" },
  { kind: "side", title: "側視圖", titleEn: "SIDE" },
  { kind: "top", title: "俯視圖", titleEn: "TOP" },
];

export function ZoomableThreeViews({ design }: { design: FurnitureDesign }) {
  const [zoomed, setZoomed] = useState<ViewKind | null>(null);

  const close = useCallback(() => setZoomed(null), []);

  useEffect(() => {
    if (!zoomed) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [zoomed, close]);

  return (
    <>
      <div className="flex gap-2">
        {VIEWS.map((v) => (
          <button
            key={v.kind}
            type="button"
            onClick={() => setZoomed(v.kind)}
            className="flex-1 group relative border border-zinc-300 rounded overflow-hidden bg-white hover:border-zinc-900 hover:shadow-md transition-all cursor-zoom-in"
            aria-label={`放大${v.title}`}
          >
            <OrthoView design={design} view={v.kind} title={v.title} titleEn={v.titleEn} />
            <span className="absolute top-1 right-1 text-[9px] px-1.5 py-0.5 rounded bg-zinc-900/70 text-white opacity-0 group-hover:opacity-100 transition-opacity">
              🔍 放大
            </span>
          </button>
        ))}
      </div>

      {zoomed && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          onClick={close}
        >
          <div
            className="relative bg-white rounded-lg shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200">
              <div className="font-semibold text-zinc-900">
                {VIEWS.find((v) => v.kind === zoomed)?.title}
                <span className="ml-2 text-xs text-zinc-500 font-normal tracking-wider">
                  {VIEWS.find((v) => v.kind === zoomed)?.titleEn}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {VIEWS.map((v) => (
                  <button
                    key={v.kind}
                    type="button"
                    onClick={() => setZoomed(v.kind)}
                    className={`text-xs px-2.5 py-1 rounded border transition-colors ${
                      zoomed === v.kind
                        ? "bg-zinc-900 text-white border-zinc-900"
                        : "bg-white text-zinc-700 border-zinc-300 hover:bg-zinc-100"
                    }`}
                  >
                    {v.title}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={close}
                  className="ml-2 w-7 h-7 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-sm flex items-center justify-center"
                  aria-label="關閉"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="p-4">
              <OrthoView
                design={design}
                view={zoomed}
                title={VIEWS.find((v) => v.kind === zoomed)?.title ?? ""}
                titleEn={VIEWS.find((v) => v.kind === zoomed)?.titleEn ?? ""}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
