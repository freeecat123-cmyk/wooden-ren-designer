"use client";

import { useMemo, useState } from "react";
import type { FurnitureDesign } from "@/lib/types";
import { downloadSTL, downloadOBJ, downloadFlatLayoutSTL, validateDesignExport } from "@/lib/export/three-d-export";
import { analyzeMinThickness, MIN_PRINTABLE_MM } from "@/lib/export/export-checks";

interface Props {
  design: FurnitureDesign;
}

// 預設 1:10——家用 3D 列印機 200mm 床能放整件方凳/椅。
const SCALES: Array<{ label: string; value: number }> = [
  { label: "1:1 原寸（SketchUp / 工業列印 / CNC）", value: 1 },
  { label: "1:2（局部試做、榫接驗證）", value: 0.5 },
  { label: "1:5（提案打樣、桌面展示）", value: 0.2 },
  { label: "1:10 預設（家用 3D 列印 200mm 床放得下）", value: 0.1 },
  { label: "1:20（建築模型、櫃體縮影）", value: 0.05 },
  { label: "1:25（建築模型常用）", value: 0.04 },
  { label: "1:50（整間家具擺設）", value: 0.02 },
  { label: "1:100（空間規劃示意）", value: 0.01 },
];
const DEFAULT_IDX = 3;

export function ThreeDExportButton({ design }: Props) {
  const [scaleIdx, setScaleIdx] = useState(DEFAULT_IDX);
  const scale = SCALES[scaleIdx].value;

  // 最薄件警告——scale 變動即時重算（純數值、便宜）
  const minThk = useMemo(() => analyzeMinThickness(design, scale), [design, scale]);
  const tooThin = minThk.thinnestMm < MIN_PRINTABLE_MM;

  // 幾何自檢——只跟 design 有關（與比例無關），design 變才重算
  const validation = useMemo(() => validateDesignExport(design), [design]);

  return (
    <div className="px-4 py-2.5 border-t border-amber-100 bg-amber-50/40 flex flex-col gap-1.5 text-[11px]">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-zinc-500 font-medium">3D 列印檔</span>
        <select
          value={scaleIdx}
          onChange={(e) => setScaleIdx(Number(e.target.value))}
          className="px-2 py-1 border border-zinc-300 rounded-md bg-white text-zinc-700 focus:ring-2 focus:ring-amber-400 focus:border-amber-400 outline-none transition"
          title="輸出比例。1:10 預設適合家用 3D 列印"
        >
          {SCALES.map((s, i) => (
            <option key={s.value} value={i}>{s.label}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => downloadSTL(design, scale)}
          className="px-2.5 py-1 border border-zinc-300 rounded-md bg-white hover:border-amber-300 hover:bg-amber-50 text-zinc-700 transition-colors"
          title="3D 列印 / 切片器（Cura、PrusaSlicer）"
        >
          🖨️ STL
        </button>
        <button
          type="button"
          onClick={() => downloadOBJ(design, scale)}
          className="px-2.5 py-1 border border-zinc-300 rounded-md bg-white hover:border-amber-300 hover:bg-amber-50 text-zinc-700 transition-colors"
          title="SketchUp / Blender / 通用 3D 軟體"
        >
          📐 OBJ
        </button>
        <button
          type="button"
          onClick={() => downloadFlatLayoutSTL(design, scale)}
          className="px-2.5 py-1 border border-zinc-300 rounded-md bg-white hover:border-amber-300 hover:bg-amber-50 text-zinc-700 transition-colors"
          title="所有零件攤平排開、免支撐——適合直接送切片器列印"
        >
          🛏️ 攤平 STL
        </button>
      </div>
      {tooThin && (
        <p className="text-amber-700">
          ⚠️ 最薄件 {minThk.thinnestMm.toFixed(1)}mm（{minThk.partName}），
          一般 3D 印表機印不出來，建議改用更大的比例。
        </p>
      )}
      {!validation.ok && (
        <p className="text-rose-600">
          ⚠️ 偵測到 {validation.badParts.length} 個零件幾何異常
          （{validation.badParts.map((p) => p.partName).join("、")}），
          匯出檔在切片器可能需要修復。
        </p>
      )}
    </div>
  );
}
