"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  workbenchByHeight,
  diningSeatByHeight,
  diningTableByHeight,
  deskByHeight,
  kitchenCounterByHeight,
  DEFAULT_USER_HEIGHT_CM,
} from "@/lib/knowledge/ergonomics";
import type { FurnitureCategory } from "@/lib/types";

type Mapping = { key: string; calc: (cm: number) => number; label: string };

const CATEGORY_MAP: Partial<Record<FurnitureCategory, Mapping[]>> = {
  "dining-chair": [{ key: "seatHeight", calc: diningSeatByHeight, label: "座高" }],
  "bench": [{ key: "seatHeight", calc: diningSeatByHeight, label: "座高" }],
  "stool": [{ key: "height", calc: diningSeatByHeight, label: "座高" }],
  "round-stool": [{ key: "height", calc: diningSeatByHeight, label: "座高" }],
  "dining-table": [{ key: "height", calc: diningTableByHeight, label: "桌高" }],
  "round-table": [{ key: "height", calc: diningTableByHeight, label: "桌高" }],
  "desk": [{ key: "height", calc: deskByHeight, label: "桌高" }],
};

export function HeightToSizeButton({ category }: { category: FurnitureCategory }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mapping = CATEGORY_MAP[category];
  const [open, setOpen] = useState(false);
  const [height, setHeight] = useState<number>(DEFAULT_USER_HEIGHT_CM.default);
  if (!mapping) return null;

  const applyHeight = (cm: number) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const m of mapping) {
      params.set(m.key, String(m.calc(cm)));
    }
    router.replace(`?${params.toString()}`, { scroll: false });
    setOpen(false);
  };

  const previewLines = mapping.map((m) => `${m.label} ${m.calc(height)}mm`).join(" / ");

  return (
    <div className="mb-3 flex flex-wrap items-center gap-1.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="px-2.5 py-1 rounded text-[11px] bg-emerald-50 text-emerald-900 border border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300"
        title="輸入身高自動推薦座高 / 桌高（依人體工學公式）"
      >
        📏 依身高推薦
      </button>
      {open && (
        <div className="flex flex-wrap items-center gap-1.5 p-2 rounded border border-emerald-200 bg-emerald-50/40">
          <span className="text-[10px] text-emerald-900">身高</span>
          <input
            type="number"
            value={height}
            min={140}
            max={200}
            step={1}
            onChange={(e) => setHeight(Number(e.target.value) || 0)}
            onClick={(e) => e.stopPropagation()}
            className="w-16 px-1.5 py-0.5 text-[11px] border border-emerald-200 rounded bg-white"
          />
          <span className="text-[10px] text-emerald-900">cm</span>
          {[155, 165, 172, 180].map((cm) => (
            <button
              key={cm}
              type="button"
              onClick={() => setHeight(cm)}
              className={`px-1.5 py-0.5 text-[10px] rounded border ${
                height === cm
                  ? "bg-emerald-600 text-white border-emerald-600"
                  : "bg-white text-emerald-900 border-emerald-200 hover:bg-emerald-100"
              }`}
            >
              {cm}
            </button>
          ))}
          <span className="text-[10px] text-emerald-700">→ {previewLines}</span>
          <button
            type="button"
            onClick={() => applyHeight(height)}
            className="px-2 py-0.5 text-[11px] rounded bg-emerald-600 text-white hover:bg-emerald-700"
          >
            套用
          </button>
        </div>
      )}
    </div>
  );
}

/** 工作台 / 廚房料理台等特殊用途的單獨 helper（暫不接 UI，先 export 備用） */
export const HEIGHT_HELPERS = {
  workbench: workbenchByHeight,
  kitchenCounter: kitchenCounterByHeight,
} as const;
