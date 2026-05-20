"use client";

import type { FurnitureDesign } from "@/lib/types";
import { downloadSTL, downloadOBJ } from "@/lib/export/three-d-export";

interface Props {
  design: FurnitureDesign;
}

export function ThreeDExportButton({ design }: Props) {
  return (
    <div className="px-4 py-2 border-t border-zinc-200 bg-zinc-50 flex items-center gap-2 text-[11px]">
      <span className="text-zinc-500">工程檔輸出（簡化盒體 · mm）</span>
      <button
        type="button"
        onClick={() => downloadSTL(design)}
        className="px-2 py-1 border border-zinc-300 rounded bg-white hover:bg-zinc-100 text-zinc-700"
        title="3D 列印 / 切片器（Cura、PrusaSlicer）"
      >
        🖨️ STL
      </button>
      <button
        type="button"
        onClick={() => downloadOBJ(design)}
        className="px-2 py-1 border border-zinc-300 rounded bg-white hover:bg-zinc-100 text-zinc-700"
        title="SketchUp / Blender / 通用 3D 軟體"
      >
        📐 OBJ
      </button>
    </div>
  );
}
