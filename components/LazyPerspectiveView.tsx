"use client";

import dynamic from "next/dynamic";
import type { FurnitureDesign } from "@/lib/types";

/**
 * 3D 透視圖懶載入 wrapper。
 * 主要 bundle（three / @react-three/*）約 600KB，在初始頁面載入時延遲，
 * 讓文字 / 表格 / 表單先互動完，再拉 3D 畫面。
 *
 * 提早看到內容的觀感比 FCP 數字還重要。
 */
const PerspectiveViewLazy = dynamic(
  () =>
    import("./PerspectiveView").then((m) => ({ default: m.PerspectiveView })),
  {
    ssr: false,
    loading: () => (
      <div className="w-full aspect-[4/3] md:aspect-[16/10] rounded-lg border border-dashed border-zinc-300 bg-zinc-50 flex items-center justify-center">
        <div className="text-center text-zinc-400 text-sm">
          <div className="inline-block h-8 w-8 rounded-full border-2 border-zinc-300 border-t-amber-500 animate-spin mb-3" />
          <p>3D 透視圖載入中…</p>
          <p className="text-xs mt-1">（首次載入約 1–2 秒，之後會快取）</p>
        </div>
      </div>
    ),
  },
);

export function LazyPerspectiveView({ design }: { design: FurnitureDesign }) {
  return <PerspectiveViewLazy design={design} />;
}
