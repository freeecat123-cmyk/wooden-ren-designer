"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useUnit } from "@/hooks/useUnit";
import { formatMm } from "@/lib/units/format";
import {
  workbenchByHeight,
  diningSeatByHeight,
  diningTableByHeight,
  deskByHeight,
  kitchenCounterByHeight,
  DEFAULT_USER_HEIGHT_CM,
} from "@/lib/knowledge/ergonomics";
import type { FurnitureCategory } from "@/lib/types";

type MappingKind = "seat" | "table";
type Mapping = { key: string; calc: (cm: number) => number; kind: MappingKind };

const CATEGORY_MAP: Partial<Record<FurnitureCategory, Mapping[]>> = {
  "dining-chair": [{ key: "seatHeight", calc: diningSeatByHeight, kind: "seat" }],
  "bench": [{ key: "seatHeight", calc: diningSeatByHeight, kind: "seat" }],
  "stool": [{ key: "height", calc: diningSeatByHeight, kind: "seat" }],
  "round-stool": [{ key: "height", calc: diningSeatByHeight, kind: "seat" }],
  "dining-table": [{ key: "height", calc: diningTableByHeight, kind: "table" }],
  "round-table": [{ key: "height", calc: diningTableByHeight, kind: "table" }],
  "desk": [{ key: "height", calc: deskByHeight, kind: "table" }],
};

export function HeightToSizeButton({ category }: { category: FurnitureCategory }) {
  const t = useTranslations("heightToSize");
  const router = useRouter();
  const searchParams = useSearchParams();
  const unit = useUnit();
  const mapping = CATEGORY_MAP[category];
  const [open, setOpen] = useState(false);
  const [height, setHeight] = useState<number>(DEFAULT_USER_HEIGHT_CM.default);
  if (!mapping) return null;

  const applyHeight = (cm: number) => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    for (const m of mapping) {
      params.set(m.key, String(m.calc(cm)));
    }
    router.replace(`?${params.toString()}`, { scroll: false });
    setOpen(false);
  };

  const previewLines = mapping
    .map((m) => `${m.kind === "seat" ? t("lblSeat") : t("lblTable")} ${formatMm(m.calc(height), unit)}`)
    .join(" / ");

  return (
    <div className="mb-3 flex flex-wrap items-center gap-1.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="px-2.5 py-1 rounded text-[11px] bg-emerald-50 text-emerald-900 border border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300"
        title={t("btnTitle")}
      >
        {t("btn")}
      </button>
      {open && (
        <div className="flex flex-wrap items-center gap-1.5 p-2 rounded border border-emerald-200 bg-emerald-50/40">
          <span className="text-[10px] text-emerald-900">{t("heightLbl")}</span>
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
          <span className="text-[10px] text-emerald-900">{t("cm")}</span>
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
            {t("applyBtn")}
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
