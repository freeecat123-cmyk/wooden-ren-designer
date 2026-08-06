"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type { FurnitureDesign } from "@/lib/types";
import { downloadSTL, downloadOBJ, downloadFlatLayoutSTL, download3MF, validateDesignExport } from "@/lib/export/three-d-export";
import { downloadPartsSvgZip, downloadNestedSvg, downloadJoineryFacesZip, downloadNestedJoinerySvg, designHasMortises } from "@/lib/export/parts-svg";
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
  const hasMortises = useMemo(() => designHasMortises(design), [design]);

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
        {/* 零件 2D 輪廓 SVG（CNC / 雷切）——mm 實尺、不受上方 3D 縮放影響。 */}
        <span className="w-px h-4 bg-zinc-200" aria-hidden />
        <button
          type="button"
          onClick={() => downloadPartsSvgZip(design)}
          className="px-2.5 py-1 border border-emerald-300 rounded-md bg-white hover:border-emerald-400 hover:bg-emerald-50 text-emerald-800 transition-colors"
          title="每個零件一張攤平輪廓 SVG（mm 實尺），打包 ZIP。可直接匯入 CNC 刀路工具 / 雷切。"
        >
          零件輪廓 ZIP
        </button>
        <button
          type="button"
          onClick={() => downloadNestedSvg(design)}
          className="px-2.5 py-1 border border-emerald-300 rounded-md bg-white hover:border-emerald-400 hover:bg-emerald-50 text-emerald-800 transition-colors"
          title="所有零件自動排進 4×8 板材（2440×1220mm）的套料 SVG。刀線式排料（跟裁切計算器同一套演算法）：零件之間留 8mm 刀縫，小件會填進大件旁邊的空位；不同料厚／材質自動分成不同張板（18mm 夾板和 45mm 桌腳排同一張是切不出來的）。一張板直接下載 SVG，多張打包 ZIP，檔名帶利用率。"
        >
          套料 SVG
        </button>
        {hasMortises && (
          <button
            type="button"
            onClick={() => downloadJoineryFacesZip(design)}
            className="px-2.5 py-1 border border-amber-400 rounded-md bg-white hover:border-amber-500 hover:bg-amber-50 text-amber-800 transition-colors"
            title="榫接版專用：每個零件「有榫孔的那一面」各出一張 SVG（外框 + 榫孔內框），打包 ZIP。放平該面在 CNC 上，外框和榫孔同一次裝夾一起洗；盲榫深度進 cnc-tool 設挖槽。腳等兩面有孔的零件會出兩張（翻面分兩次夾）。"
          >
            榫孔加工面 ZIP
          </button>
        )}
        {hasMortises && (
          <button
            type="button"
            onClick={() => downloadNestedJoinerySvg(design)}
            className="px-2.5 py-1 border border-amber-400 rounded-md bg-white hover:border-amber-500 hover:bg-amber-50 text-amber-800 transition-colors"
            title="榫接版套料：所有零件的主加工面（含落在該面的榫孔）刀線式排進板材，一次切完外框＋榫孔。同樣依料厚／材質分張、留 8mm 刀縫。兩面都有孔的零件（如桌腳）只排主面，另一面請用「榫孔加工面 ZIP」翻面加工。"
          >
            榫孔套料 SVG
          </button>
        )}
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
