"use client";

/**
 * /raised-floor 和室架高平台估價 — 主 UI
 *
 * 版面:左欄 6 區漸進輸入(平台形狀 → 架高高度 → 面材 → 骨架 → 夾板 → 估價)
 *      右欄 sticky 結果(三 tab 預覽:骨架 2D / 拼花 2D / 3D 爆炸
 *                       + 5 張統計卡 + BOM 表 + 總價 + 複製清單)
 *
 * 任何輸入變更 → useMemo 即時 computeRaisedFloorBom 重算。
 */
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { encodeState } from "@/lib/engineering-quote/url-codec";
import { computeRaisedFloorBom } from "@/lib/raised-floor/calc";
import {
  DEFAULT_RAISED_FLOOR_INPUT,
  type Pillar,
  type PillarCorner,
  type PlatformShape,
  type RaisedFloorInput,
} from "@/lib/raised-floor/types";
import {
  JOIST_PRESETS,
  PLYWOOD_PRESETS,
  getJoistPreset,
  getPlywoodPreset,
} from "@/lib/raised-floor/presets";
import { PLANK_PRESETS } from "@/lib/floor/presets";
import { RaisedFloorOverviewSvg } from "@/lib/raised-floor/RaisedFloorOverviewSvg";
import { RaisedFloorPlankSvg } from "@/lib/raised-floor/RaisedFloorPlankSvg";
import {
  LazyRaisedFloorScene3D,
} from "@/lib/raised-floor/LazyRaisedFloorScene3D";
import type {
  LayerKey,
  ViewMode,
} from "@/lib/raised-floor/RaisedFloorScene3D";
import { FloorRangeInput } from "@/app/[locale]/floor/FloorRangeInput";
import { UnderlaySkirtingSection } from "./UnderlaySkirtingSection";
import {
  bomToCuttingPieces,
  computeCuttingPlan,
  computePlywoodLayout,
  bomToCsvRows,
  bomCsvString,
  type CuttingCategory,
} from "@/lib/raised-floor/cutting";

const PILLAR_CORNER_VALUES: PillarCorner[] = ["tl", "tr", "bl", "br"];

type PreviewTab = "frame" | "plank" | "3d";

const LAYER_KEYS: { key: LayerKey; labelKey: string }[] = [
  { key: "legs", labelKey: "layerLegs" },
  { key: "frameTop", labelKey: "layerFrameTop" },
  { key: "frameBottom", labelKey: "layerFrameBottom" },
  { key: "mainTop", labelKey: "layerMainTop" },
  { key: "mainBottom", labelKey: "layerMainBottom" },
  { key: "sub", labelKey: "layerSub" },
  { key: "plywood", labelKey: "layerPlywood" },
  { key: "plank", labelKey: "layerPlank" },
];

export function RaisedFloorClient() {
  const router = useRouter();
  const t = useTranslations("raisedFloorTool.client");
  const cornerLabel = (c: PillarCorner) => {
    const map: Record<PillarCorner, string> = {
      tl: "cornerTopLeft",
      tr: "cornerTopRight",
      bl: "cornerBottomLeft",
      br: "cornerBottomRight",
    };
    return t(map[c]);
  };
  const [input, setInput] = useState<RaisedFloorInput>(DEFAULT_RAISED_FLOOR_INPUT);
  const bom = useMemo(() => computeRaisedFloorBom(input), [input]);
  const [copied, setCopied] = useState(false);

  // 預覽 tab + 3D 控制
  const [tab, setTab] = useState<PreviewTab>("frame");
  const [layers, setLayers] = useState<Record<LayerKey, boolean>>({
    legs: true,
    frameTop: true,
    frameBottom: true,
    mainTop: true,
    mainBottom: true,
    sub: true,
    plywood: true,
    plank: true,
  });
  const [explode, setExplode] = useState(0.3);
  const [viewMode, setViewMode] = useState<ViewMode>("iso");

  // 裁切表設定(對齊 /ceiling 的常用 12 尺角材 + 3mm 鋸路 + 10cm 接點)
  const [cutOpen, setCutOpen] = useState(false);
  const [stockLengthCm, setStockLengthCm] = useState(360);
  const [sawKerfCm, setSawKerfCm] = useState(0.3);
  const [spliceOverlapCm, setSpliceOverlapCm] = useState(10);
  const cuttingPlan = useMemo(
    () =>
      computeCuttingPlan(
        bomToCuttingPieces(bom),
        stockLengthCm,
        sawKerfCm,
        spliceOverlapCm,
      ),
    [bom, stockLengthCm, sawKerfCm, spliceOverlapCm],
  );
  const [plankCutOpen, setPlankCutOpen] = useState(false);
  const [plywoodCutOpen, setPlywoodCutOpen] = useState(false);
  const [stepsOpen, setStepsOpen] = useState(false);
  const plywoodLayout = useMemo(() => computePlywoodLayout(bom), [bom]);

  const set = <K extends keyof RaisedFloorInput>(k: K, v: RaisedFloorInput[K]) =>
    setInput((p) => ({ ...p, [k]: v }));

  // 夾板尺寸變化 → 自動把主/副支間距重算成對齊夾板(plywoodDim/N 為間距)
  // 切換 preset 或微調長/短邊都會觸發。手動拉間距 slider 不會觸發(deps 只看夾板)。
  useEffect(() => {
    setInput((p) => {
      const plyShort = p.plywood.sheetLengthCm; // 短邊 → 主支對齊
      const plyLong = p.plywood.sheetWidthCm;   // 長邊 → 副支對齊
      const nMain = Math.max(2, Math.round(plyShort / Math.max(p.joistSpacingCm, 10)));
      const nSub = Math.max(2, Math.round(plyLong / Math.max(p.subJoistSpacingCm, 10)));
      const newMain = Math.round(plyShort / nMain);
      const newSub = Math.round(plyLong / nSub);
      if (newMain === p.joistSpacingCm && newSub === p.subJoistSpacingCm) return p;
      return { ...p, joistSpacingCm: newMain, subJoistSpacingCm: newSub };
    });
  }, [input.plywood.sheetLengthCm, input.plywood.sheetWidthCm]);

  const toggleLayer = (k: LayerKey) =>
    setLayers((prev) => ({ ...prev, [k]: !prev[k] }));

  const addPillar = () => {
    if (input.pillars.length >= 2) return;
    const used = new Set(input.pillars.map((p) => p.corner));
    const free = PILLAR_CORNER_VALUES.find((c) => !used.has(c)) ?? "tl";
    set("pillars", [...input.pillars, { corner: free, widthCm: 60, depthCm: 60 }]);
  };
  const removePillar = () => {
    if (input.pillars.length <= 0) return;
    set("pillars", input.pillars.slice(0, -1));
  };
  const updatePillar = (idx: number, patch: Partial<Pillar>) => {
    set(
      "pillars",
      input.pillars.map((p, i) => (i === idx ? { ...p, ...patch } : p)),
    );
  };

  const copyBom = () => {
    const shapeName = input.shape === "rect" ? t("shapeRect") : t("shapeLshape");
    const shapeLine =
      t("copyShapeLine", {
        shape: shapeName,
        width: input.widthCm,
        depth: input.depthCm,
      }) +
      (input.pillars.length > 0
        ? t("copyPillarSuffix", { count: input.pillars.length })
        : "");
    const lines = [
      t("copyTitle"),
      t("copyPlatformLine", {
        area: bom.auto.platformAreaM2.toFixed(2),
        ping: bom.auto.pingShu.toFixed(2),
        perimeter: bom.auto.perimeterM.toFixed(1),
        height: input.heightCm,
      }),
      shapeLine,
      t("copyDivider"),
      ...bom.items.map((it) => {
        const qty =
          it.count != null
            ? `${it.count} ${t("unitPiece")}`
            : it.totalLengthM != null
              ? `${it.totalLengthM.toFixed(1)} ${t("unitMeter")}`
              : "";
        const money =
          it.subtotal != null ? `  NT$ ${Math.round(it.subtotal).toLocaleString()}` : "";
        return `${it.nameZh} ${it.spec}  ${qty}${money}`;
      }),
      t("copyDivider"),
      bom.cost.total > 0
        ? t("copyTotalLine", { total: Math.round(bom.cost.total).toLocaleString() }) +
          (bom.cost.hasUnpriced ? t("copyTotalUnpricedSuffix") : "")
        : t("copyNoQuoteLine"),
    ];
    navigator.clipboard.writeText(lines.join("\n")).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const downloadCsv = () => {
    const csv = bomCsvString(bomToCsvRows(bom, cuttingPlan, plywoodLayout));
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = t("csvFilename", {
      width: input.widthCm,
      depth: input.depthCm,
      height: input.heightCm,
    });
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="mx-auto max-w-6xl p-6">
      <h1 className="text-xl font-bold">{t("h1")}</h1>
      <p className="mt-1 text-sm text-zinc-500">{t("subtitle")}</p>

      <div className="mt-4 flex flex-col gap-6 md:grid md:grid-cols-[minmax(0,1fr)_420px] md:items-start">
        {/* ───── 左:輸入 ───── */}
        <div className="space-y-4 min-w-0">
          {/* ① 平台形狀 [永遠展開] */}
          <section className="rounded-lg border border-zinc-200 p-4">
            <h2 className="mb-3 text-sm font-semibold">{t("section1Shape")}</h2>
            <div className="mb-3 flex gap-2">
              {(["rect", "l-shape"] as PlatformShape[]).map((s) => {
                const active = input.shape === s;
                return (
                  <button
                    key={s}
                    onClick={() => set("shape", s)}
                    className={`flex-1 rounded border px-3 py-1.5 text-xs ${
                      active
                        ? "border-[#bd9955] bg-[#bd9955]/15 text-[#8a6d3b] font-medium"
                        : "border-zinc-300 hover:bg-zinc-50"
                    }`}
                  >
                    {s === "rect" ? t("shapeRect") : t("shapeLshape")}
                  </button>
                );
              })}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-2">
              <FloorRangeInput
                label={t("totalWidth")}
                unit={t("unitCm")}
                value={input.widthCm}
                min={100}
                max={800}
                step={10}
                onChange={(v) => set("widthCm", v)}
              />
              <FloorRangeInput
                label={t("totalDepth")}
                unit={t("unitCm")}
                value={input.depthCm}
                min={100}
                max={800}
                step={10}
                onChange={(v) => set("depthCm", v)}
              />
              {input.shape === "l-shape" && (
                <>
                  <FloorRangeInput
                    label={t("lCutX")}
                    unit={t("unitCm")}
                    value={input.lCutXCm}
                    min={50}
                    max={400}
                    step={10}
                    onChange={(v) => set("lCutXCm", v)}
                  />
                  <FloorRangeInput
                    label={t("lCutY")}
                    unit={t("unitCm")}
                    value={input.lCutYCm}
                    min={50}
                    max={400}
                    step={10}
                    onChange={(v) => set("lCutYCm", v)}
                  />
                </>
              )}
            </div>

          </section>

          {/* ② 架高高度 */}
          <section className="rounded-lg border border-zinc-200 p-4">
            <h2 className="mb-3 text-sm font-semibold">{t("section2Height")}</h2>
            <FloorRangeInput
              label={t("height")}
              unit={t("unitCm")}
              value={input.heightCm}
              min={10}
              max={50}
              step={1}
              onChange={(v) => set("heightCm", v)}
            />
          </section>

          {/* ③ 面材 */}
          <section className="rounded-lg border border-zinc-200 p-4">
            <h2 className="mb-3 text-sm font-semibold">{t("section3Plank")}</h2>
            <div className="mb-1 text-xs text-zinc-500">{t("plankPresetLabel")}</div>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {PLANK_PRESETS.map((p) => {
                const active =
                  input.plankLengthCm === p.lengthCm &&
                  input.plankWidthCm === p.widthCm &&
                  input.plankGapMm === p.gapMm;
                return (
                  <button
                    key={p.id}
                    className={`rounded border px-2 py-1 text-left text-xs ${
                      active
                        ? "border-[#bd9955] bg-[#bd9955]/15 text-[#8a6d3b]"
                        : "border-zinc-300 hover:bg-zinc-50"
                    }`}
                    onClick={() =>
                      setInput((prev) => ({
                        ...prev,
                        plankLengthCm: p.lengthCm,
                        plankWidthCm: p.widthCm,
                        plankGapMm: p.gapMm,
                      }))
                    }
                  >
                    <span className="block font-medium">{p.nameZh}</span>
                    <span className="block text-[10px] text-zinc-400">
                      {t("plankPresetSpec", {
                        lengthCm: p.lengthCm,
                        widthCm: p.widthCm,
                        gapMm: p.gapMm,
                      })}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="grid grid-cols-1 gap-x-3 gap-y-2">
              <FloorRangeInput
                label={t("plankLength")}
                unit={t("unitCm")}
                value={input.plankLengthCm}
                min={50}
                max={200}
                step={1}
                onChange={(v) => set("plankLengthCm", v)}
              />
              <FloorRangeInput
                label={t("plankWidth")}
                unit={t("unitCm")}
                value={input.plankWidthCm}
                min={5}
                max={30}
                step={0.5}
                onChange={(v) => set("plankWidthCm", v)}
              />
              <FloorRangeInput
                label={t("plankGap")}
                unit={t("unitMm")}
                value={input.plankGapMm}
                min={3}
                max={15}
                step={1}
                onChange={(v) => set("plankGapMm", v)}
              />
            </div>

            {/* 鋪設方向轉向 toggle */}
            <div className="mt-3 flex items-center gap-2">
              <span className="text-xs text-zinc-500">{t("plankDirectionLabel")}</span>
              <div className="flex gap-1">
                {(
                  [
                    { v: "long-axis", label: t("plankDirLong") },
                    { v: "short-axis", label: t("plankDirShort") },
                  ] as { v: "long-axis" | "short-axis"; label: string }[]
                ).map((opt) => {
                  const active = (input.plankDirection ?? "long-axis") === opt.v;
                  return (
                    <button
                      key={opt.v}
                      onClick={() => set("plankDirection", opt.v)}
                      className={`rounded border px-2 py-1 text-xs ${
                        active
                          ? "border-[#bd9955] bg-[#bd9955]/15 text-[#8a6d3b] font-medium"
                          : "border-zinc-300 hover:bg-zinc-50"
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 起鋪角(對齊地板模擬器:左/右/上/下/中央置中) */}
            <label className="mt-2 flex items-center gap-2 text-xs">
              <span className="text-zinc-500">{t("plankStartLabel")}</span>
              <select
                className="rounded border border-zinc-300 px-2 py-1"
                value={input.plankStartCorner ?? "top-left"}
                onChange={(e) =>
                  set(
                    "plankStartCorner",
                    e.target.value as NonNullable<RaisedFloorInput["plankStartCorner"]>,
                  )
                }
              >
                <option value="top-left">{t("plankStartTopLeft")}</option>
                <option value="top-right">{t("plankStartTopRight")}</option>
                <option value="bottom-left">{t("plankStartBottomLeft")}</option>
                <option value="bottom-right">{t("plankStartBottomRight")}</option>
                <option value="center">{t("plankStartCenter")}</option>
              </select>
            </label>
          </section>

          {/* ④ 挨柱(可選,預設展開可摺) */}
          <details open className="rounded-lg border border-zinc-200 p-4">
            <summary className="cursor-pointer text-sm font-semibold">
              {t("section4Pillar")}
              <span className="ml-2 text-[11px] font-normal text-zinc-400">
                {t("pillarCountLabel", { count: input.pillars.length })}
              </span>
            </summary>
            <div className="mt-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs text-zinc-500">{t("pillarHint")}</span>
                <div className="flex gap-1">
                  <button
                    onClick={removePillar}
                    disabled={input.pillars.length <= 0}
                    className="h-6 w-6 rounded bg-stone-100 text-base leading-none hover:bg-stone-200 disabled:opacity-40 disabled:cursor-not-allowed"
                    aria-label={t("pillarRemoveAria")}
                  >
                    −
                  </button>
                  <button
                    onClick={addPillar}
                    disabled={input.pillars.length >= 2}
                    className="h-6 w-6 rounded bg-stone-100 text-base leading-none hover:bg-stone-200 disabled:opacity-40 disabled:cursor-not-allowed"
                    aria-label={t("pillarAddAria")}
                  >
                    +
                  </button>
                </div>
              </div>
              <div className="space-y-3">
                {input.pillars.map((p, i) => (
                  <div key={i} className="rounded border border-zinc-200 p-2">
                    <label className="mb-2 flex items-center gap-2 text-xs">
                      <span className="text-zinc-500">{t("pillarPositionLabel")}</span>
                      <select
                        className="rounded border border-zinc-300 px-2 py-1"
                        value={p.corner}
                        onChange={(e) =>
                          updatePillar(i, { corner: e.target.value as PillarCorner })
                        }
                      >
                        {PILLAR_CORNER_VALUES.map((c) => (
                          <option key={c} value={c}>
                            {cornerLabel(c)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-2">
                      <FloorRangeInput
                        label={t("pillarWidth")}
                        unit={t("unitCm")}
                        value={p.widthCm}
                        min={20}
                        max={150}
                        step={5}
                        onChange={(v) => updatePillar(i, { widthCm: v })}
                      />
                      <FloorRangeInput
                        label={t("pillarDepth")}
                        unit={t("unitCm")}
                        value={p.depthCm}
                        min={20}
                        max={150}
                        step={5}
                        onChange={(v) => updatePillar(i, { depthCm: v })}
                      />
                    </div>
                  </div>
                ))}
                {input.pillars.length === 0 && (
                  <p className="text-[11px] text-zinc-400">{t("pillarEmptyHint")}</p>
                )}
              </div>
            </div>
          </details>

          {/* ⑤ 骨架 */}
          <details className="rounded-lg border border-zinc-200 p-4">
            <summary className="cursor-pointer text-sm font-semibold">{t("section5Frame")}</summary>
            <div className="mt-3 space-y-3">
              <label className="flex flex-col gap-1 text-xs">
                <span className="text-zinc-500">{t("mainJoistLabel")}</span>
                <select
                  className="rounded border border-zinc-300 px-2 py-1"
                  value={input.mainJoist.id}
                  onChange={(e) => set("mainJoist", getJoistPreset(e.target.value))}
                >
                  {JOIST_PRESETS.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.nameZh}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs">
                <span className="text-zinc-500">{t("subJoistLabel")}</span>
                <select
                  className="rounded border border-zinc-300 px-2 py-1"
                  value={input.subJoist.id}
                  onChange={(e) => set("subJoist", getJoistPreset(e.target.value))}
                >
                  {JOIST_PRESETS.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.nameZh}
                    </option>
                  ))}
                </select>
              </label>
              <FloorRangeInput
                label={t("mainJoistSpacing")}
                unit={t("unitCm")}
                value={input.joistSpacingCm}
                min={20}
                max={50}
                step={5}
                onChange={(v) => set("joistSpacingCm", v)}
              />
              <FloorRangeInput
                label={t("subJoistSpacing")}
                unit={t("unitCm")}
                value={input.subJoistSpacingCm}
                min={20}
                max={80}
                step={5}
                onChange={(v) => set("subJoistSpacingCm", v)}
              />
            </div>
          </details>

          {/* ⑥ 夾板 */}
          <details className="rounded-lg border border-zinc-200 p-4">
            <summary className="cursor-pointer text-sm font-semibold">{t("section6Plywood")}</summary>
            <div className="mt-3 space-y-3">
              <label className="flex flex-col gap-1 text-xs">
                <span className="text-zinc-500">{t("plywoodSpecLabel")}</span>
                <select
                  className="rounded border border-zinc-300 px-2 py-1"
                  value={input.plywood.id}
                  onChange={(e) => set("plywood", getPlywoodPreset(e.target.value))}
                >
                  {PLYWOOD_PRESETS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nameZh}
                    </option>
                  ))}
                </select>
              </label>

              {/* 夾板微調(預設來自規格,可±1cm 調整成料行實品) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-2">
                <FloorRangeInput
                  label={t("plywoodLongEdge")}
                  unit={t("unitCm")}
                  value={input.plywood.sheetWidthCm}
                  min={120}
                  max={260}
                  step={1}
                  onChange={(v) =>
                    set("plywood", { ...input.plywood, sheetWidthCm: v })
                  }
                />
                <FloorRangeInput
                  label={t("plywoodShortEdge")}
                  unit={t("unitCm")}
                  value={input.plywood.sheetLengthCm}
                  min={60}
                  max={130}
                  step={1}
                  onChange={(v) =>
                    set("plywood", { ...input.plywood, sheetLengthCm: v })
                  }
                />
                <FloorRangeInput
                  label={t("plywoodThickness")}
                  unit={t("unitMm")}
                  value={input.plywood.thicknessMm}
                  min={9}
                  max={24}
                  step={1}
                  onChange={(v) =>
                    set("plywood", { ...input.plywood, thicknessMm: v })
                  }
                />
              </div>
              <p className="text-[10px] text-zinc-500 leading-relaxed">{t("plywoodSpecHint")}</p>

              <FloorRangeInput
                label={t("plywoodGap")}
                unit={t("unitMm")}
                value={input.plywoodGapMm}
                min={2}
                max={4}
                step={1}
                onChange={(v) => set("plywoodGapMm", v)}
              />
              <FloorRangeInput
                label={t("plywoodWaste")}
                unit={t("unitPercent")}
                value={Math.round(input.plywoodWaste * 100)}
                min={0}
                max={50}
                step={5}
                onChange={(v) => set("plywoodWaste", v / 100)}
              />
            </div>
          </details>

          {/* ⑦ 防潮墊 + 踢腳板(可選) */}
          <UnderlaySkirtingSection input={input} set={set} />

          {/* ⑧ 估價 */}
          <details className="rounded-lg border border-zinc-200 p-4">
            <summary className="cursor-pointer text-sm font-semibold">{t("section8Price")}</summary>
            <div className="mt-3 grid grid-cols-1 gap-x-3 gap-y-2">
              <FloorRangeInput
                label={t("plankPrice")}
                unit={t("unitYuan")}
                value={input.plankPricePerPing}
                min={0}
                max={20000}
                step={50}
                onChange={(v) => set("plankPricePerPing", v)}
              />
              <FloorRangeInput
                label={t("joistPrice")}
                unit={t("unitYuan")}
                value={input.joistPricePerM}
                min={0}
                max={500}
                step={5}
                onChange={(v) => set("joistPricePerM", v)}
              />
              <FloorRangeInput
                label={t("plywoodPrice")}
                unit={t("unitYuan")}
                value={input.plywoodPricePerSheet}
                min={0}
                max={3000}
                step={10}
                onChange={(v) => set("plywoodPricePerSheet", v)}
              />
              <FloorRangeInput
                label={t("skirtingPrice")}
                unit={t("unitYuan")}
                value={input.skirtingPricePerM}
                min={0}
                max={500}
                step={5}
                onChange={(v) => set("skirtingPricePerM", v)}
              />
            </div>
          </details>
        </div>

        {/* ───── 右:結果(整塊 sticky,grid item 自身 sticky 才有效) ───── */}
        <aside className="space-y-3 md:sticky md:top-4 md:self-start md:max-h-[calc(100vh-2rem)] md:overflow-y-auto md:pr-1">
          <div className="space-y-3">
            {/* tab 切換 */}
            <div className="flex gap-1.5">
              {(
                [
                  { key: "frame", label: t("tabFrame") },
                  { key: "plank", label: t("tabPlank") },
                  { key: "3d", label: t("tab3d") },
                ] as { key: PreviewTab; label: string }[]
              ).map((tab2) => {
                const active = tab === tab2.key;
                return (
                  <button
                    key={tab2.key}
                    onClick={() => setTab(tab2.key)}
                    className={`flex-1 rounded border px-3 py-1.5 text-xs ${
                      active
                        ? "border-[#bd9955] bg-[#bd9955]/15 text-[#8a6d3b] font-medium"
                        : "border-zinc-300 hover:bg-zinc-50"
                    }`}
                  >
                    {tab2.label}
                  </button>
                );
              })}
            </div>

            {/* 對應 tab 顯示視圖 */}
            {tab === "frame" && (
              <RaisedFloorOverviewSvg bom={bom} layers={layers} />
            )}
            {tab === "plank" && <RaisedFloorPlankSvg bom={bom} width={388} />}
            {tab === "3d" && (
              <div className="space-y-2">
                <LazyRaisedFloorScene3D
                  bom={bom}
                  viewMode={viewMode}
                  explode={explode}
                  layers={layers}
                />

                {/* 爆炸 slider */}
                <div className="rounded border border-zinc-200 p-2">
                  <div className="mb-1 flex items-center justify-between text-[11px] text-zinc-500">
                    <span>{t("explodeLabel")}</span>
                    <span className="font-mono text-zinc-700">
                      {Math.round(explode * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={Math.round(explode * 100)}
                    onChange={(e) => setExplode(Number(e.target.value) / 100)}
                    className="w-full accent-[#bd9955]"
                  />
                </div>

                {/* 視角切換 */}
                <div className="flex gap-1.5">
                  {(
                    [
                      { key: "iso", label: t("view3dIso") },
                      { key: "top", label: t("view3dTop") },
                    ] as { key: ViewMode; label: string }[]
                  ).map((v) => {
                    const active = viewMode === v.key;
                    return (
                      <button
                        key={v.key}
                        onClick={() => setViewMode(v.key)}
                        className={`flex-1 rounded border px-3 py-1 text-xs ${
                          active
                            ? "border-[#bd9955] bg-[#bd9955]/15 text-[#8a6d3b] font-medium"
                            : "border-zinc-300 hover:bg-zinc-50"
                        }`}
                      >
                        {v.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 圖層 toggle — 三個 tab 都共用(2D/拼花/3D 都吃 layers) */}
            {(tab === "frame" || tab === "3d") && (
              <div className="rounded border border-zinc-200 p-2">
                <div className="mb-1 text-[11px] text-zinc-500">{t("layersLabel")}</div>
                <div className="flex flex-wrap gap-x-3 gap-y-1">
                  {LAYER_KEYS.map((l) => (
                    <label
                      key={l.key}
                      className="flex items-center gap-1 text-xs text-zinc-600 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={layers[l.key]}
                        onChange={() => toggleLayer(l.key)}
                        className="accent-[#bd9955]"
                      />
                      {t(l.labelKey)}
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              <Stat
                label={t("statPlank")}
                value={`${bom.trace.plankTotalCount}`}
                unit={t("unitPiece")}
              />
              <Stat
                label={t("statSub")}
                value={bom.trace.subJoistTotalM.toFixed(1)}
                unit={t("unitMeter")}
              />
              <Stat
                label={t("statFrame")}
                value={bom.trace.joistTotalM.toFixed(1)}
                unit={t("unitMeter")}
              />
              <Stat
                label={t("statPlywood")}
                value={`${bom.trace.plywoodSheetCount}`}
                unit={t("unitPiece")}
              />
              <Stat
                label={t("statPerimeter")}
                value={bom.auto.perimeterM.toFixed(1)}
                unit={t("unitMeter")}
              />
            </div>

            {/* BOM 表 */}
            <div className="rounded-lg border border-zinc-200 p-3">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-sm font-semibold">{t("bomTitle")}</h2>
                <div className="flex gap-1.5">
                  <button
                    onClick={downloadCsv}
                    className="rounded border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-50"
                    title={t("csvTitle")}
                  >
                    {t("csvButton")}
                  </button>
                  <button
                    onClick={copyBom}
                    className="rounded border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-50"
                  >
                    {copied ? t("copyDone") : t("copyButton")}
                  </button>
                </div>
              </div>
              <p className="text-xs text-zinc-500">
                {t("platformSummary", {
                  area: bom.auto.platformAreaM2.toFixed(2),
                  ping: bom.auto.pingShu.toFixed(2),
                })}
              </p>
              <table className="mt-2 w-full border-collapse text-xs">
                <tbody>
                  {bom.items.map((it, i) => (
                    <tr key={i} className="border-b border-zinc-100 align-top">
                      <td className="py-1">
                        <div className="font-medium">{it.nameZh}</div>
                        <div className="text-[10px] text-zinc-400">{it.spec}</div>
                      </td>
                      <td className="py-1 text-right whitespace-nowrap">
                        {it.count != null && `${it.count} ${t("unitPiece")}`}
                        {it.totalLengthM != null && `${it.totalLengthM.toFixed(1)} ${t("unitMeter")}`}
                      </td>
                      <td className="py-1 pl-2 text-right whitespace-nowrap text-zinc-700">
                        {it.subtotal != null
                          ? `NT$ ${Math.round(it.subtotal).toLocaleString()}`
                          : t("noPrice")}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-zinc-300">
                    <td className="py-1 font-semibold" colSpan={2}>
                      {t("totalRow")}
                    </td>
                    <td className="py-1 pl-2 text-right font-semibold whitespace-nowrap">
                      {bom.cost.total > 0
                        ? `NT$ ${Math.round(bom.cost.total).toLocaleString()}`
                        : t("noPrice")}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* 預估總價 */}
            <div className="rounded-lg border border-[#bd9955]/40 bg-[#bd9955]/10 p-3">
              <div className="flex items-end justify-between gap-2">
                <div>
                  <div className="text-xs text-zinc-500">{t("estimatedTotal")}</div>
                  <div className="text-2xl font-bold text-[#8a6d3b]">
                    {bom.cost.total > 0
                      ? `NT$ ${Math.round(bom.cost.total).toLocaleString()}`
                      : t("noQuote")}
                  </div>
                </div>
                {bom.cost.total > 0 && bom.cost.hasUnpriced && (
                  <div className="text-[10px] text-amber-700 text-right leading-tight">
                    {t("partiallyPriced1")}
                    <br />
                    {t("partiallyPriced2")}
                  </div>
                )}
              </div>
            </div>

            {/* 產生報價單 → /raised-floor/quote?d=<encoded> */}
            <button
              type="button"
              onClick={() =>
                router.push(
                  `/raised-floor/quote?d=${encodeURIComponent(encodeState(input))}`,
                )
              }
              className="w-full rounded bg-[#bd9955] py-2 text-sm font-semibold text-white hover:opacity-90 transition"
            >
              {t("generateQuote")}
            </button>
          </div>
        </aside>
      </div>

      {/* ════════════════════════════════════════
          下方全寬:裁切表 ① 骨架(1D FFD,角材原料用)
          ════════════════════════════════════════ */}
      <div className="mt-6 space-y-4">
        <section className="rounded-2xl bg-white ring-1 ring-stone-200 shadow-sm overflow-hidden">
          <button
            onClick={() => setCutOpen(!cutOpen)}
            className="w-full px-5 py-3.5 border-b border-stone-100 flex items-center justify-between hover:bg-stone-50 transition"
          >
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-zinc-900">{t("frameCutSection")}</h2>
              <span className="text-[11px] text-zinc-600">
                {t("frameCutSummary", {
                  count: cuttingPlan.summary.stockCount,
                  pct: cuttingPlan.summary.utilizationPct,
                  remain: cuttingPlan.summary.totalRemainM,
                })}
              </span>
            </div>
            <span className="text-zinc-400 text-xs">{cutOpen ? "▲" : "▼"}</span>
          </button>
          {cutOpen && (
            <div className="p-5 space-y-4">
              <div className="flex flex-wrap items-center gap-4 text-xs">
                <label className="flex items-center gap-2">
                  <span className="text-zinc-600">{t("stockLengthLabel")}</span>
                  <input
                    type="number"
                    value={stockLengthCm}
                    step={10}
                    onChange={(e) => setStockLengthCm(Number(e.target.value))}
                    className="w-20 px-2 py-1 border border-stone-300 rounded tabular-nums focus:outline-none focus:border-amber-500"
                  />
                  <span className="text-[10px] text-zinc-600">{t("stockLengthHint")}</span>
                </label>
                <label className="flex items-center gap-2">
                  <span className="text-zinc-600">{t("sawKerfLabel")}</span>
                  <input
                    type="number"
                    value={sawKerfCm}
                    step={0.1}
                    onChange={(e) => setSawKerfCm(Number(e.target.value))}
                    className="w-16 px-2 py-1 border border-stone-300 rounded tabular-nums focus:outline-none focus:border-amber-500"
                  />
                  <span className="text-[10px] text-zinc-600">cm</span>
                </label>
                <label className="flex items-center gap-2">
                  <span className="text-zinc-600">{t("spliceLabel")}</span>
                  <input
                    type="number"
                    value={spliceOverlapCm}
                    step={1}
                    onChange={(e) => setSpliceOverlapCm(Number(e.target.value))}
                    className="w-16 px-2 py-1 border border-stone-300 rounded tabular-nums focus:outline-none focus:border-amber-500"
                  />
                  <span className="text-[10px] text-zinc-600">{t("spliceHint")}</span>
                </label>
              </div>

              {(() => {
                const splicedPieces = cuttingPlan.inputPieces.filter((p) =>
                  p.label.includes("(拼"),
                );
                if (splicedPieces.length === 0) return null;
                const groups = new Map<string, typeof splicedPieces>();
                for (const p of splicedPieces) {
                  const base = p.label.replace(/\s*\(拼\d+\/\d+\)/, "");
                  if (!groups.has(base)) groups.set(base, []);
                  groups.get(base)!.push(p);
                }
                return (
                  <div className="rounded-lg bg-amber-50 ring-1 ring-amber-200 p-3 sm:p-4">
                    <h3 className="text-xs font-semibold text-amber-900 mb-2">
                      {t("splicedTitle", {
                        groups: groups.size,
                        pieces: splicedPieces.length,
                        overlap: spliceOverlapCm,
                      })}
                    </h3>
                    <ul className="text-[11px] text-amber-800 space-y-1 leading-relaxed">
                      {[...groups.entries()].map(([base, segs]) => (
                        <li key={base} className="flex items-center gap-2 flex-wrap">
                          <span>{base}</span>
                          <span className="text-amber-600">→</span>
                          {segs.map((s, i) => (
                            <span
                              key={i}
                              className={`px-1.5 py-0.5 rounded text-[10px] ring-1 font-mono ${pieceTone(s.category)}`}
                            >
                              {r1(s.lengthCm)}
                            </span>
                          ))}
                          <span className="text-amber-600 font-mono">
                            {t("splicedSum", { len: r1(segs.reduce((s, p) => s + p.lengthCm, 0)) })}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })()}

              <div className="overflow-x-auto rounded-lg ring-1 ring-stone-200">
                <table className="w-full text-xs">
                  <thead className="bg-stone-50/60 text-zinc-500 text-[10px] uppercase tracking-wider">
                    <tr>
                      <th className="text-left px-3 py-2 font-semibold">{t("thStock")}</th>
                      <th className="text-left px-3 py-2 font-semibold">{t("thCut")}</th>
                      <th className="text-right px-3 py-2 font-semibold">{t("thUsed")}</th>
                      <th className="text-right px-3 py-2 font-semibold">{t("thKerf")}</th>
                      <th className="text-right px-3 py-2 font-semibold">{t("thRemain")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {cuttingPlan.stocks.map((s) => {
                      const oversize = s.remainCm < -0.01;
                      return (
                        <tr
                          key={s.index}
                          className={
                            oversize
                              ? "bg-rose-50/50 hover:bg-rose-50"
                              : "hover:bg-amber-50/30"
                          }
                        >
                          <td className="px-3 py-2 font-mono text-zinc-700">
                            #{s.index}
                            {oversize && (
                              <span className="ml-1 text-[9px] text-rose-700">⚠</span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex flex-wrap gap-1 items-center">
                              {s.pieces.map((p, j) => (
                                <span
                                  key={j}
                                  className={`px-1.5 py-0.5 rounded text-[10px] ring-1 font-mono ${pieceTone(p.category)}`}
                                  title={p.label}
                                >
                                  {r1(p.lengthCm)}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {r1(s.usedLengthCm)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-zinc-400">
                            {r1(s.totalKerfCm)}
                          </td>
                          <td
                            className={`px-3 py-2 text-right tabular-nums font-semibold ${
                              s.remainCm < 0
                                ? "text-rose-700"
                                : s.remainCm < 10
                                  ? "text-emerald-700"
                                  : "text-amber-700"
                            }`}
                          >
                            {r1(s.remainCm)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap gap-3 text-[11px] text-zinc-500">
                <span>
                  {t("footOrder")}{" "}
                  <strong className="text-zinc-900 text-base font-bold">
                    {cuttingPlan.summary.stockCount}
                  </strong>{" "}
                  {t("footStockSuffix", { len: stockLengthCm })}
                </span>
                <span>
                  {t("footTotalLen")}{" "}
                  <strong className="text-zinc-700">
                    {t("footMeter", { n: cuttingPlan.summary.totalStockLengthM })}
                  </strong>
                </span>
                <span>
                  {t("footUsed")}{" "}
                  <strong className="text-zinc-700">
                    {t("footMeter", { n: cuttingPlan.summary.totalUsedM })}
                  </strong>
                </span>
                <span>
                  {t("footRemain")}{" "}
                  <strong className="text-rose-700">
                    {t("footMeter", { n: cuttingPlan.summary.totalRemainM })}
                  </strong>
                </span>
                <span>
                  {t("footUtilization")}{" "}
                  <strong className="text-amber-700">
                    {t("footPercent", { n: cuttingPlan.summary.utilizationPct })}
                  </strong>
                </span>
              </div>

              <div className="flex flex-wrap gap-3 text-[10px] text-zinc-500">
                <Legend tone={pieceTone("frame-top")} label={t("legendFrameTop")} />
                <Legend tone={pieceTone("frame-bottom")} label={t("legendFrameBottom")} />
                <Legend tone={pieceTone("main-joist")} label={t("legendMainTop")} />
                <Legend tone={pieceTone("main-joist-bottom")} label={t("legendMainBottom")} />
                <Legend tone={pieceTone("sub-joist")} label={t("legendSub")} />
              </div>
            </div>
          )}
        </section>

        {/* ════════════════════════════════════════
            裁切表 ② 地板(全片 + 裁切片 + 餘料再利用)
            ════════════════════════════════════════ */}
        <section className="mt-4 rounded-2xl bg-white ring-1 ring-stone-200 shadow-sm overflow-hidden">
          <button
            onClick={() => setPlankCutOpen(!plankCutOpen)}
            className="w-full px-5 py-3.5 border-b border-stone-100 flex items-center justify-between hover:bg-stone-50 transition"
          >
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-zinc-900">{t("plankCutSection")}</h2>
              <span className="text-[11px] text-zinc-600">
                {t("plankCutSummary", {
                  full: bom.trace.plankFullCount,
                  cut: bom.trace.plankCutCount,
                  newPieces: bom.trace.plankCutNewCount,
                  total: bom.trace.plankTotalCount,
                  waste: bom.trace.plankWastePercent.toFixed(1),
                })}
              </span>
            </div>
            <span className="text-zinc-400 text-xs">{plankCutOpen ? "▲" : "▼"}</span>
          </button>
          {plankCutOpen && (
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <Stat label={t("statFull")} value={String(bom.trace.plankFullCount)} unit={t("unitPiece")} />
                <Stat label={t("statCutPieces")} value={String(bom.trace.plankCutCount)} unit={t("unitCount")} />
                <Stat
                  label={t("statCutNew")}
                  value={String(bom.trace.plankCutNewCount)}
                  unit={t("unitPiece")}
                />
                <Stat
                  label={t("statWaste")}
                  value={bom.trace.plankWastePercent.toFixed(1)}
                  unit={t("unitPercent")}
                />
              </div>

              <div className="overflow-x-auto rounded-lg ring-1 ring-stone-200">
                <table className="w-full text-xs">
                  <thead className="bg-stone-50/60 text-zinc-500 text-[10px] uppercase tracking-wider">
                    <tr>
                      <th className="text-left px-3 py-2 font-semibold">{t("thNo")}</th>
                      <th className="text-left px-3 py-2 font-semibold">{t("thType")}</th>
                      <th className="text-right px-3 py-2 font-semibold">{t("thEffectiveLen")}</th>
                      <th className="text-right px-3 py-2 font-semibold">{t("thArea")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {bom.layout.planks.map((p, i) => (
                      <tr
                        key={i}
                        className={
                          p.kind === "cut"
                            ? "bg-amber-50/30 hover:bg-amber-50"
                            : "hover:bg-stone-50/50"
                        }
                      >
                        <td className="px-3 py-2 font-mono text-zinc-700">#{i + 1}</td>
                        <td className="px-3 py-2">
                          {p.kind === "full" ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] ring-1 bg-stone-100 text-stone-700 ring-stone-200">
                              {t("labelFull")}
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[10px] ring-1 bg-amber-100 text-amber-900 ring-amber-200">
                              {t("labelCut")}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {r1(p.effectiveLengthCm)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-zinc-500">
                          {Math.round(p.usedAreaCm2).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {bom.trace.offcutReuseLog.length > 0 && (
                <details className="rounded-lg bg-emerald-50 ring-1 ring-emerald-200 p-3">
                  <summary className="cursor-pointer text-xs font-semibold text-emerald-900">
                    {t("offcutReuseSummary", { count: bom.trace.offcutReuseLog.length })}
                  </summary>
                  <ul className="mt-2 text-[11px] text-emerald-800 space-y-0.5 pl-4 list-disc">
                    {bom.trace.offcutReuseLog.map((line, i) => (
                      <li key={i}>{line}</li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}
        </section>

        {/* ════════════════════════════════════════
            裁切表 ③ 夾板(整片 + 裁切片 + 棋盤交錯每片明細)
            ════════════════════════════════════════ */}
        <section className="mt-4 rounded-2xl bg-white ring-1 ring-stone-200 shadow-sm overflow-hidden">
          <button
            onClick={() => setPlywoodCutOpen(!plywoodCutOpen)}
            className="w-full px-5 py-3.5 border-b border-stone-100 flex items-center justify-between hover:bg-stone-50 transition"
          >
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-zinc-900">{t("plywoodCutSection")}</h2>
              <span className="text-[11px] text-zinc-600">
                {t("plywoodCutSummary", {
                  count: plywoodLayout.sheets.length,
                  full: plywoodLayout.fullCount,
                  cut: plywoodLayout.cutCount,
                })}{" "}
                <strong className="text-amber-700">{plywoodLayout.orderSheetCount} {t("plywoodOrderUnit")}</strong>
                {plywoodLayout.sheets.length > plywoodLayout.orderSheetCount && (
                  <span className="text-emerald-700">
                    {t("plywoodSaved", { n: plywoodLayout.sheets.length - plywoodLayout.orderSheetCount })}
                  </span>
                )}
              </span>
            </div>
            <span className="text-zinc-400 text-xs">{plywoodCutOpen ? "▲" : "▼"}</span>
          </button>
          {plywoodCutOpen && (
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <Stat label={t("statPlywoodLay")} value={String(plywoodLayout.sheets.length)} unit={t("unitPiece")} />
                <Stat label={t("statPlywoodFull")} value={String(plywoodLayout.fullCount)} unit={t("unitPiece")} />
                <Stat label={t("statPlywoodCut")} value={String(plywoodLayout.cutCount)} unit={t("unitPiece")} />
                <Stat
                  label={t("statPlywoodOrder")}
                  value={String(plywoodLayout.orderSheetCount)}
                  unit={t("unitSheet")}
                />
              </div>

              {plywoodLayout.sheets.length > plywoodLayout.orderSheetCount && (
                <div className="rounded-lg bg-emerald-50 ring-1 ring-emerald-200 p-3 text-[11px] text-emerald-900">
                  {t("plywoodSavedBanner", {
                    n: plywoodLayout.sheets.length - plywoodLayout.orderSheetCount,
                    laid: plywoodLayout.sheets.length,
                    ordered: plywoodLayout.orderSheetCount,
                    longCm: plywoodLayout.sheetLongX,
                    shortCm: plywoodLayout.sheetShortZ,
                  })}
                </div>
              )}

              <div className="overflow-x-auto rounded-lg ring-1 ring-stone-200">
                <table className="w-full text-xs">
                  <thead className="bg-stone-50/60 text-zinc-500 text-[10px] uppercase tracking-wider">
                    <tr>
                      <th className="text-left px-3 py-2 font-semibold">{t("thNo")}</th>
                      <th className="text-left px-3 py-2 font-semibold">{t("thType")}</th>
                      <th className="text-right px-3 py-2 font-semibold">{t("thWidthCm")}</th>
                      <th className="text-right px-3 py-2 font-semibold">{t("thHeightCm")}</th>
                      <th className="text-right px-3 py-2 font-semibold">{t("thArea")}</th>
                      <th className="text-right px-3 py-2 font-semibold">{t("thNewSheet")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {plywoodLayout.sheets.map((s) => (
                      <tr
                        key={s.index}
                        className={
                          s.isFull
                            ? "hover:bg-amber-50/40"
                            : "bg-rose-50/30 hover:bg-rose-50"
                        }
                      >
                        <td className="px-3 py-2 font-mono text-zinc-700">
                          #{s.index}
                          {!s.isFull && (
                            <span className="ml-1 text-[10px] text-rose-700">{t("cutMark")}</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {s.isFull ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] ring-1 bg-amber-100 text-amber-900 ring-amber-200">
                              {t("labelFull")}
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[10px] ring-1 bg-rose-100 text-rose-900 ring-rose-200">
                              {t("labelCut")}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {r1(s.w)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {r1(s.h)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-zinc-500">
                          {Math.round(s.w * s.h).toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-right text-zinc-700 font-mono text-[11px]">
                          {s.orderSheetIndex != null
                            ? t("newSheetFormat", { n: s.orderSheetIndex })
                            : t("noPrice")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 同張新料切出的 cell 編號清單(用戶要的「4-14-24-3」格式) */}
              {(() => {
                const groups = new Map<number, number[]>();
                for (const s of plywoodLayout.sheets) {
                  if (s.orderSheetIndex == null) continue;
                  if (!groups.has(s.orderSheetIndex))
                    groups.set(s.orderSheetIndex, []);
                  groups.get(s.orderSheetIndex)!.push(s.index);
                }
                if (groups.size === 0) return null;
                return (
                  <div className="rounded-lg bg-stone-50 ring-1 ring-stone-200 p-3">
                    <h3 className="text-xs font-semibold text-stone-800 mb-2">
                      {t("newSheetGroupTitle")}
                    </h3>
                    <ul className="text-[11px] text-stone-700 space-y-0.5 font-mono">
                      {[...groups.entries()]
                        .sort(([a], [b]) => a - b)
                        .map(([sheetIdx, cells]) => (
                          <li key={sheetIdx}>
                            <span className="text-amber-700 font-semibold">
                              {t("newSheetGroupLabel", { n: sheetIdx })}
                            </span>{" "}
                            #{cells.join(" + #")}
                            {cells.length > 1 && (
                              <span className="text-emerald-700 ml-1">
                                {t("newSheetSharedSuffix", { n: cells.length })}
                              </span>
                            )}
                          </li>
                        ))}
                    </ul>
                  </div>
                );
              })()}

              {plywoodLayout.packingLog.length > 0 && (
                <details className="rounded-lg bg-amber-50 ring-1 ring-amber-200 p-3">
                  <summary className="cursor-pointer text-xs font-semibold text-amber-900">
                    {t("packingLogSummary", { count: plywoodLayout.packingLog.length })}
                  </summary>
                  <ul className="mt-2 text-[11px] text-amber-800 space-y-0.5 pl-4 list-disc">
                    {plywoodLayout.packingLog.map((line, i) => (
                      <li key={i}>{line}</li>
                    ))}
                  </ul>
                </details>
              )}

              <p className="text-[11px] text-zinc-500 leading-relaxed">
                {t("plywoodFooter", {
                  longCm: plywoodLayout.sheetLongX,
                  shortCm: plywoodLayout.sheetShortZ,
                })}
              </p>
            </div>
          )}
        </section>

        {/* ════════════════════════════════════════
            施工步驟 — 6 步流程(對標 ceiling 5 步)
            ════════════════════════════════════════ */}
        <section className="mt-4 rounded-2xl bg-white ring-1 ring-stone-200 shadow-sm overflow-hidden">
          <button
            onClick={() => setStepsOpen(!stepsOpen)}
            className="w-full px-5 py-3.5 border-b border-stone-100 flex items-center justify-between hover:bg-stone-50 transition"
          >
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-zinc-900">{t("stepsSection")}</h2>
              <span className="text-[11px] text-zinc-600">{t("stepsSubtitle")}</span>
            </div>
            <span className="text-zinc-400 text-xs">{stepsOpen ? "▲" : "▼"}</span>
          </button>
          {stepsOpen && (
            <ol className="divide-y divide-stone-100 text-sm">
              {[
                {
                  n: 1,
                  title: t("step1Title"),
                  desc: t("step1Desc"),
                },
                {
                  n: 2,
                  title: t("step2Title"),
                  desc: t("step2Desc", {
                    joist: bom.input.mainJoist.nameZh,
                    rows: bom.trace.joistRowCount,
                  }),
                },
                {
                  n: 3,
                  title: t("step3Title"),
                  desc: t("step3Desc", {
                    joist: bom.input.mainJoist.nameZh,
                    spacing: bom.input.joistSpacingCm,
                    rows: bom.trace.joistRowCount,
                  }),
                },
                {
                  n: 4,
                  title: t("step4Title"),
                  desc: t("step4Desc", {
                    joist: bom.input.subJoist.nameZh,
                    spacing: bom.input.subJoistSpacingCm,
                    count: bom.trace.subJoistCount,
                  }),
                },
                {
                  n: 5,
                  title: t("step5Title", { plywood: bom.input.plywood.nameZh }),
                  desc: t("step5Desc", {
                    full: plywoodLayout.fullCount,
                    cut: plywoodLayout.cutCount,
                    gap: bom.input.plywoodGapMm,
                  }),
                },
                {
                  n: 6,
                  title: t("step6Title"),
                  desc: t("step6Desc", {
                    lengthCm: bom.input.plankLengthCm,
                    widthCm: bom.input.plankWidthCm,
                    gap: bom.input.plankGapMm,
                  }),
                },
              ].map((step) => (
                <li
                  key={step.n}
                  className="px-5 py-3 flex items-start gap-3 hover:bg-amber-50/30 transition"
                >
                  <div className="w-7 h-7 shrink-0 rounded-full bg-gradient-to-br from-[#bd9955] to-[#8a6d3b] flex items-center justify-center text-white text-xs font-bold shadow-sm">
                    {step.n}
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-zinc-900">{step.title}</div>
                    <div className="text-xs text-zinc-600 mt-0.5 leading-relaxed">
                      {step.desc}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </main>
  );
}

function Legend({ tone, label }: { tone: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`inline-block w-3 h-3 rounded ring-1 ${tone}`} />
      <span className="text-zinc-600">{label}</span>
    </span>
  );
}

function pieceTone(category: CuttingCategory | string): string {
  switch (category) {
    case "frame-top":
      return "bg-amber-100 text-amber-900 ring-amber-200";
    case "frame-bottom":
      return "bg-orange-100 text-orange-900 ring-orange-200";
    case "main-joist":
      return "bg-rose-100 text-rose-900 ring-rose-200";
    case "main-joist-bottom":
      return "bg-yellow-100 text-yellow-900 ring-yellow-200";
    case "sub-joist":
      return "bg-stone-100 text-stone-700 ring-stone-200";
    default:
      return "bg-zinc-100 text-zinc-700 ring-zinc-200";
  }
}

function r1(n: number) {
  return Math.round(n * 10) / 10;
}

function Stat({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 p-2 text-center">
      <div className="text-[11px] text-zinc-500">{label}</div>
      <div className="text-base font-semibold text-zinc-800">
        {value}
        <span className="ml-0.5 text-xs font-normal text-zinc-400">{unit}</span>
      </div>
    </div>
  );
}
