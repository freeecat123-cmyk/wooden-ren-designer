"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type { FurnitureDesign } from "@/lib/types";
import { downloadSTL, downloadOBJ, downloadFlatLayoutSTL, download3MF, validateDesignExport } from "@/lib/export/three-d-export";
import { analyzeMinThickness, MIN_PRINTABLE_MM } from "@/lib/export/export-checks";

interface Props {
  design: FurnitureDesign;
}

const DEFAULT_IDX = 3;

export function ThreeDExportButton({ design }: Props) {
  const t = useTranslations("threeDExport");
  const [scaleIdx, setScaleIdx] = useState(DEFAULT_IDX);
  const SCALES: Array<{ label: string; value: number }> = [
    { label: t("scale1to1"), value: 1 },
    { label: t("scale1to2"), value: 0.5 },
    { label: t("scale1to5"), value: 0.2 },
    { label: t("scale1to10"), value: 0.1 },
    { label: t("scale1to20"), value: 0.05 },
    { label: t("scale1to25"), value: 0.04 },
    { label: t("scale1to50"), value: 0.02 },
    { label: t("scale1to100"), value: 0.01 },
  ];
  const scale = SCALES[scaleIdx].value;

  const minThk = useMemo(() => analyzeMinThickness(design, scale), [design, scale]);
  const tooThin = minThk.thinnestMm < MIN_PRINTABLE_MM;

  const validation = useMemo(() => validateDesignExport(design), [design]);

  return (
    <div className="px-4 py-2.5 border-t border-amber-100 bg-amber-50/40 flex flex-col gap-1.5 text-[11px]">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-zinc-500 font-medium">{t("lbl")}</span>
        <select
          value={scaleIdx}
          onChange={(e) => setScaleIdx(Number(e.target.value))}
          className="px-2 py-1 border border-zinc-300 rounded-md bg-white text-zinc-700 focus:ring-2 focus:ring-amber-400 focus:border-amber-400 outline-none transition"
          title={t("selectTitle")}
        >
          {SCALES.map((s, i) => (
            <option key={s.value} value={i}>{s.label}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => downloadSTL(design, scale)}
          className="px-2.5 py-1 border border-zinc-300 rounded-md bg-white hover:border-amber-300 hover:bg-amber-50 text-zinc-700 transition-colors"
          title={t("stlTitle")}
        >
          {t("stlBtn")}
        </button>
        <button
          type="button"
          onClick={() => downloadOBJ(design, scale)}
          className="px-2.5 py-1 border border-zinc-300 rounded-md bg-white hover:border-amber-300 hover:bg-amber-50 text-zinc-700 transition-colors"
          title={t("objTitle")}
        >
          {t("objBtn")}
        </button>
        <button
          type="button"
          onClick={() => downloadFlatLayoutSTL(design, scale)}
          className="px-2.5 py-1 border border-zinc-300 rounded-md bg-white hover:border-amber-300 hover:bg-amber-50 text-zinc-700 transition-colors"
          title={t("flatTitle")}
        >
          {t("flatBtn")}
        </button>
        <button
          type="button"
          onClick={() => download3MF(design, scale)}
          className="px-2.5 py-1 border border-zinc-300 rounded-md bg-white hover:border-amber-300 hover:bg-amber-50 text-zinc-700 transition-colors"
          title={t("threeMfTitle")}
        >
          {t("threeMfBtn")}
        </button>
      </div>
      {tooThin && (
        <p className="text-amber-700">
          {t("warnThinTpl", {
            thin: minThk.thinnestMm.toFixed(1),
            part: minThk.partName,
            min: MIN_PRINTABLE_MM,
          })}
        </p>
      )}
      {!validation.ok && (
        <p className="text-rose-600">
          {t("warnBadGeoTpl", {
            n: validation.badParts.length,
            parts: validation.badParts.map((p) => p.partName).join("、"),
          })}
        </p>
      )}
    </div>
  );
}
