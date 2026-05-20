"use client";

import { useState } from "react";
import type { FurnitureDesign } from "@/lib/types";
import { downloadSTL, downloadOBJ } from "@/lib/export/three-d-export";

interface Props {
  design: FurnitureDesign;
}

// 1:10 是預設值——家用 3D 列印機 200mm 床能放整件方凳/椅。
// 1:1 給 SketchUp 或工業列印機用。
const SCALES: Array<{ label: string; value: number }> = [
  { label: "1:10 模型", value: 0.1 },
  { label: "1:1 原寸", value: 1 },
];

export function ThreeDExportButton({ design }: Props) {
  const [scaleIdx, setScaleIdx] = useState(0);
  const scale = SCALES[scaleIdx].value;

  return (
    <div className="px-4 py-2 border-t border-zinc-200 bg-zinc-50 flex flex-wrap items-center gap-2 text-[11px]">
      <span className="text-zinc-500">工程檔輸出（簡化盒體）</span>
      <select
        value={scaleIdx}
        onChange={(e) => setScaleIdx(Number(e.target.value))}
        className="px-2 py-1 border border-zinc-300 rounded bg-white text-zinc-700"
        title="輸出比例。1:10 預設適合家用 3D 列印；1:1 給 SketchUp / 工業列印"
      >
        {SCALES.map((s, i) => (
          <option key={s.value} value={i}>{s.label}</option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => downloadSTL(design, scale)}
        className="px-2 py-1 border border-zinc-300 rounded bg-white hover:bg-zinc-100 text-zinc-700"
        title="3D 列印 / 切片器（Cura、PrusaSlicer）"
      >
        🖨️ STL
      </button>
      <button
        type="button"
        onClick={() => downloadOBJ(design, scale)}
        className="px-2 py-1 border border-zinc-300 rounded bg-white hover:bg-zinc-100 text-zinc-700"
        title="SketchUp / Blender / 通用 3D 軟體"
      >
        📐 OBJ
      </button>
    </div>
  );
}
