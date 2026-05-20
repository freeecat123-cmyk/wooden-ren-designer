"use client";

import { useMemo } from "react";
import { computeFloorBom } from "@/lib/floor/calc";
import { DEFAULT_FLOOR_INPUT } from "@/lib/floor/types";

export function FloorDevClient() {
  const bom = useMemo(() => computeFloorBom(DEFAULT_FLOOR_INPUT), []);
  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-xl font-bold">地板施工模擬器(階段 1 驗證頁)</h1>
      <p className="mt-1 text-sm text-zinc-500">
        房間 {bom.auto.roomAreaM2.toFixed(2)} m² / {bom.auto.pingShu.toFixed(1)} 坪
      </p>
      <ul className="mt-4 space-y-1 text-sm">
        {bom.items.map((it, i) => (
          <li key={i}>
            {it.nameZh} — {it.spec}
            {it.count != null && ` ×${it.count}`}
            {it.totalLengthM != null && ` ${it.totalLengthM.toFixed(1)} m`}
            {it.totalAreaM2 != null && ` ${it.totalAreaM2.toFixed(1)} m²`}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-zinc-400">
        整片 {bom.trace.fullPlankCount} + 裁切 {bom.trace.cutPlankCount} ={" "}
        {bom.trace.totalPlankCount} 片({bom.trace.plankRows} 排)
      </p>
    </main>
  );
}
