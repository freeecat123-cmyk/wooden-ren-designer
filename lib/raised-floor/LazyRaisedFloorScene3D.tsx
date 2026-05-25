"use client";

/**
 * Dynamic import wrapper — 動態載入 R3F bundle 避免拖累首屏。
 * 對齊 lib/ceiling/LazyCeilingScene3D.tsx 模式([[feedback-frameloop-demand-invalidate]])。
 */

import dynamic from "next/dynamic";

export const LazyRaisedFloorScene3D = dynamic(
  () => import("./RaisedFloorScene3D").then((m) => m.RaisedFloorScene3D),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[30vh] sm:h-[520px] rounded border border-zinc-200 bg-gradient-to-b from-zinc-50 to-zinc-100 flex items-center justify-center">
        <span className="text-sm text-zinc-500">3D 場景載入中...</span>
      </div>
    ),
  },
);
