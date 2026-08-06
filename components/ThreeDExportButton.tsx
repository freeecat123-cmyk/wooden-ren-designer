"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type { FurnitureDesign } from "@/lib/types";
import { downloadSTL, downloadOBJ, downloadFlatLayoutSTL, download3MF, validateDesignExport } from "@/lib/export/three-d-export";
import { downloadPartsSvgZip, downloadNestedSvg, downloadJoineryFacesZip, downloadNestedJoinerySvg, designHasMortises } from "@/lib/export/parts-svg";
import { DEFAULT_SHEET, type NestSheetConfig } from "@/lib/export/nest-sheet";
import { analyzeMinThickness, MIN_PRINTABLE_MM } from "@/lib/export/export-checks";

interface Props {
  design: FurnitureDesign;
}

const DEFAULT_IDX = 3;

/**
 * 套料用的板材與刀縫設定。存 localStorage：這是「我這台機器 / 我買的板」的屬性，
 * 不是設計的屬性，換一個設計還是同一套，不該每次重設。
 */
const NEST_KEY = "wrd-nest-sheet-v1";

/** 常見料規。刀縫＝實際會被吃掉的寬度：CNC 用刀徑＋餘裕，雷切幾乎不吃料。 */
const SHEET_PRESETS: Array<{ label: string; cfg: NestSheetConfig }> = [
  { label: "4×8 呎夾板 2440×1220（CNC 6mm 刀）", cfg: { sheetLengthMm: 2440, sheetWidthMm: 1220, kerfMm: 8 } },
  { label: "3×6 尺板 1820×910（CNC 6mm 刀）", cfg: { sheetLengthMm: 1820, sheetWidthMm: 910, kerfMm: 8 } },
  { label: "實木板 2000×250（CNC 6mm 刀）", cfg: { sheetLengthMm: 2000, sheetWidthMm: 250, kerfMm: 8 } },
  { label: "雷切板 600×400（刀縫 1mm）", cfg: { sheetLengthMm: 600, sheetWidthMm: 400, kerfMm: 1 } },
];

/**
 * mm 數字欄。**打字期間完全不校正，離開欄位（或按 Enter）才套用範圍**。
 *
 * ⭐每次 onChange 就 clamp 會讓人打不出數字：想輸入 2440，打完第一個「2」立刻被拉到
 *  下限 100，游標後面接的字全接在 100 後面 —— user 回報「沒辦法正常輸入數字」。
 *  數字欄的中間狀態（空字串、只打了一位）本來就不合法，那是過程不是結果，不該即時糾正。
 */
function MmInput({
  value, min, max, step = 1, width, onCommit, title,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  width: string;
  onCommit: (n: number) => void;
  title?: string;
}) {
  const [txt, setTxt] = useState(String(value));
  // 外部改值（例如選了料規預設）要同步回來
  useEffect(() => { setTxt(String(value)); }, [value]);
  const commit = () => {
    const n = Number(txt);
    // 空白／亂打就退回原值，不要自作主張變成下限
    const next = txt.trim() === "" || !Number.isFinite(n) ? value : Math.min(max, Math.max(min, n));
    setTxt(String(next));
    onCommit(next);
  };
  return (
    <input
      type="number"
      value={txt}
      min={min}
      max={max}
      step={step}
      title={title}
      onChange={(e) => setTxt(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
      className={`${width} px-1.5 py-1 border border-zinc-300 rounded-md bg-white text-zinc-700 outline-none focus:ring-2 focus:ring-emerald-400`}
    />
  );
}

function clampNest(v: NestSheetConfig): NestSheetConfig {
  const c = (n: number, lo: number, hi: number, dflt: number) =>
    Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : dflt;
  return {
    sheetLengthMm: c(v.sheetLengthMm, 100, 6000, DEFAULT_SHEET.sheetLengthMm),
    sheetWidthMm: c(v.sheetWidthMm, 50, 3000, DEFAULT_SHEET.sheetWidthMm),
    // 刀縫 0 是合法的（純畫圖用），上限抓 30mm，再大就不是刀縫是排版間距了
    kerfMm: c(v.kerfMm, 0, 30, DEFAULT_SHEET.kerfMm),
  };
}

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

  // ⚠️localStorage 不能在 useState 初值讀：伺服器端算出來的是預設值，兩邊不一致會 hydration 警告。
  const [nest, setNest] = useState<NestSheetConfig>(DEFAULT_SHEET);
  const [showNest, setShowNest] = useState(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(NEST_KEY);
      if (raw) setNest(clampNest(JSON.parse(raw) as NestSheetConfig));
    } catch { /* 壞值就用預設，不值得為版面偏好中斷匯出 */ }
  }, []);
  const patchNest = (patch: Partial<NestSheetConfig>) => {
    setNest((prev) => {
      const next = clampNest({ ...prev, ...patch });
      try { localStorage.setItem(NEST_KEY, JSON.stringify(next)); } catch { /* 無痕模式等寫不進去，忽略 */ }
      return next;
    });
  };

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
          onClick={() => downloadNestedSvg(design, nest)}
          className="px-2.5 py-1 border border-emerald-300 rounded-md bg-white hover:border-emerald-400 hover:bg-emerald-50 text-emerald-800 transition-colors"
          title={`所有零件自動排進 ${nest.sheetLengthMm}×${nest.sheetWidthMm}mm 板材的套料 SVG。刀線式排料（跟裁切計算器同一套演算法）：零件之間留 ${nest.kerfMm}mm 刀縫，小件會填進大件旁邊的空位；不同料厚／材質自動分成不同張板（18mm 夾板和 45mm 桌腳排同一張是切不出來的）。每張裁到實際用到的範圍，檔名就是要準備的料多大。一張板一個 SVG 檔，多張就連續下載多個（瀏覽器會問一次「允許下載多個檔案」）。`}
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
            onClick={() => downloadNestedJoinerySvg(design, nest)}
            className="px-2.5 py-1 border border-amber-400 rounded-md bg-white hover:border-amber-500 hover:bg-amber-50 text-amber-800 transition-colors"
            title={`榫接版套料：所有零件的主加工面（含落在該面的榫孔）刀線式排進板材，一次切完外框＋榫孔。同樣依料厚／材質分張、留 ${nest.kerfMm}mm 刀縫。兩面都有孔的零件（如桌腳）只排主面，另一面請用「榫孔加工面 ZIP」翻面加工。`}
          >
            榫孔套料 SVG
          </button>
        )}
        {/* 套料設定：板材尺寸與刀縫。收在一顆鈕後面——設一次就固定的東西，不該長期佔版面。 */}
        <button
          type="button"
          onClick={() => setShowNest((v) => !v)}
          className={`px-2.5 py-1 border rounded-md transition-colors ${showNest ? "border-emerald-400 bg-emerald-50 text-emerald-800" : "border-zinc-300 bg-white hover:border-emerald-300 text-zinc-600"}`}
          title="設定套料要排進多大的板、零件之間留多少刀縫。這是你的機器／你買的板的屬性，設一次就記住，換設計不用重設。"
        >
          ⚙ {nest.sheetLengthMm}×{nest.sheetWidthMm}・刀縫 {nest.kerfMm}mm
        </button>
      </div>
      {showNest && (
        <div className="flex flex-wrap items-center gap-2 px-2 py-1.5 rounded-md border border-emerald-200 bg-emerald-50/60">
          <select
            value={SHEET_PRESETS.findIndex(
              (p) =>
                p.cfg.sheetLengthMm === nest.sheetLengthMm &&
                p.cfg.sheetWidthMm === nest.sheetWidthMm &&
                p.cfg.kerfMm === nest.kerfMm,
            )}
            onChange={(e) => {
              const i = Number(e.target.value);
              if (i >= 0) patchNest(SHEET_PRESETS[i].cfg);
            }}
            className="px-2 py-1 border border-zinc-300 rounded-md bg-white text-zinc-700 outline-none focus:ring-2 focus:ring-emerald-400"
            title="常見料規；改下面任一格就變成自訂。"
          >
            <option value={-1}>自訂</option>
            {SHEET_PRESETS.map((p, i) => (
              <option key={p.label} value={i}>{p.label}</option>
            ))}
          </select>
          <label className="flex items-center gap-1 text-zinc-600">
            板長
            <MmInput
              value={nest.sheetLengthMm}
              min={100}
              max={6000}
              width="w-24"
              onCommit={(n) => patchNest({ sheetLengthMm: n })}
            />
            mm
          </label>
          <label className="flex items-center gap-1 text-zinc-600">
            板寬
            <MmInput
              value={nest.sheetWidthMm}
              min={50}
              max={3000}
              width="w-24"
              onCommit={(n) => patchNest({ sheetWidthMm: n })}
            />
            mm
          </label>
          <label
            className="flex items-center gap-1 text-zinc-600"
            title="零件之間、以及零件與板邊之間要空出來的寬度。CNC 要放得下刀具（6mm 銑刀留 8mm 剛好）；雷切幾乎不吃料，1mm 就夠；圓鋸台鋸路約 3mm。留太小 CNC 切完第一片就會把隔壁那片的邊也吃掉。"
          >
            刀縫
            <MmInput
              value={nest.kerfMm}
              min={0}
              max={30}
              step={0.5}
              width="w-20"
              onCommit={(n) => patchNest({ kerfMm: n })}
            />
            mm
          </label>
          <button
            type="button"
            onClick={() => patchNest(DEFAULT_SHEET)}
            className="px-2 py-1 border border-zinc-300 rounded-md bg-white hover:border-emerald-300 text-zinc-600 transition-colors"
          >
            回預設
          </button>
          <span className="text-zinc-500 basis-full">
            比板子大的零件不會被丟掉——那一組的板會自動放大到裝得下，並在檔名／標題標明。
          </span>
        </div>
      )}
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
