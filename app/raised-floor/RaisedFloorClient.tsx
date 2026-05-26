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
import { useMemo, useState } from "react";
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
import { FloorRangeInput } from "@/app/floor/FloorRangeInput";
import {
  bomToCuttingPieces,
  computeCuttingPlan,
  type CuttingCategory,
} from "@/lib/raised-floor/cutting";

const PILLAR_CORNERS: { value: PillarCorner; label: string }[] = [
  { value: "tl", label: "左上" },
  { value: "tr", label: "右上" },
  { value: "bl", label: "左下" },
  { value: "br", label: "右下" },
];

type PreviewTab = "frame" | "plank" | "3d";

const LAYER_LABELS: { key: LayerKey; label: string }[] = [
  { key: "legs", label: "腳柱" },
  { key: "frame", label: "邊框" },
  { key: "main", label: "主支" },
  { key: "sub", label: "副支" },
  { key: "plywood", label: "夾板" },
  { key: "plank", label: "面材" },
];

export function RaisedFloorClient() {
  const [input, setInput] = useState<RaisedFloorInput>(DEFAULT_RAISED_FLOOR_INPUT);
  const bom = useMemo(() => computeRaisedFloorBom(input), [input]);
  const [copied, setCopied] = useState(false);

  // 預覽 tab + 3D 控制
  const [tab, setTab] = useState<PreviewTab>("frame");
  const [layers, setLayers] = useState<Record<LayerKey, boolean>>({
    legs: true,
    frame: true,
    main: true,
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

  const set = <K extends keyof RaisedFloorInput>(k: K, v: RaisedFloorInput[K]) =>
    setInput((p) => ({ ...p, [k]: v }));

  const toggleLayer = (k: LayerKey) =>
    setLayers((prev) => ({ ...prev, [k]: !prev[k] }));

  const addPillar = () => {
    if (input.pillars.length >= 2) return;
    const used = new Set(input.pillars.map((p) => p.corner));
    const free = PILLAR_CORNERS.find((c) => !used.has(c.value))?.value ?? "tl";
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
    const lines = [
      "【和室架高平台材料清單】",
      `平台 ${bom.auto.platformAreaM2.toFixed(2)} m² / ${bom.auto.pingShu.toFixed(2)} 坪 · 周長 ${bom.auto.perimeterM.toFixed(1)} m · 架高 ${input.heightCm} cm`,
      `形狀:${input.shape === "rect" ? "矩形" : "L 形"} ${input.widthCm}×${input.depthCm} cm${input.pillars.length > 0 ? ` · 挨柱 ${input.pillars.length} 根` : ""}`,
      "──────────",
      ...bom.items.map((it) => {
        const qty =
          it.count != null
            ? `${it.count} 片`
            : it.totalLengthM != null
              ? `${it.totalLengthM.toFixed(1)} m`
              : "";
        const money =
          it.subtotal != null ? `  NT$ ${Math.round(it.subtotal).toLocaleString()}` : "";
        return `${it.nameZh} ${it.spec}  ${qty}${money}`;
      }),
      "──────────",
      bom.cost.total > 0
        ? `總計 NT$ ${Math.round(bom.cost.total).toLocaleString()}${bom.cost.hasUnpriced ? "(部分品項未報價)" : ""}`
        : "(未設定報價)",
    ];
    navigator.clipboard.writeText(lines.join("\n")).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <main className="mx-auto max-w-6xl p-6">
      <h1 className="text-xl font-bold">和室架高平台估價</h1>
      <p className="mt-1 text-sm text-zinc-500">
        底架 + 面材完整算料 · 矩形/L 形 + 0~2 根挨柱
      </p>

      <div className="mt-4 flex flex-col gap-6 md:grid md:grid-cols-[1fr_minmax(360px,400px)] md:items-start">
        {/* ───── 左:輸入 ───── */}
        <div className="space-y-4">
          {/* ① 平台形狀 */}
          <section className="rounded-lg border border-zinc-200 p-4">
            <h2 className="mb-3 text-sm font-semibold">① 平台形狀</h2>
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
                    {s === "rect" ? "矩形" : "L 形"}
                  </button>
                );
              })}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-2">
              <FloorRangeInput
                label="總寬"
                unit="cm"
                value={input.widthCm}
                min={100}
                max={800}
                step={10}
                onChange={(v) => set("widthCm", v)}
              />
              <FloorRangeInput
                label="總深"
                unit="cm"
                value={input.depthCm}
                min={100}
                max={800}
                step={10}
                onChange={(v) => set("depthCm", v)}
              />
              {input.shape === "l-shape" && (
                <>
                  <FloorRangeInput
                    label="L 凹陷寬"
                    unit="cm"
                    value={input.lCutXCm}
                    min={50}
                    max={400}
                    step={10}
                    onChange={(v) => set("lCutXCm", v)}
                  />
                  <FloorRangeInput
                    label="L 凹陷深"
                    unit="cm"
                    value={input.lCutYCm}
                    min={50}
                    max={400}
                    step={10}
                    onChange={(v) => set("lCutYCm", v)}
                  />
                </>
              )}
            </div>

            {/* 挨柱 */}
            <div className="mt-4 border-t border-zinc-100 pt-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium text-zinc-600">
                  挨柱({input.pillars.length}/2)
                </span>
                <div className="flex gap-1">
                  <button
                    onClick={removePillar}
                    disabled={input.pillars.length <= 0}
                    className="h-6 w-6 rounded bg-stone-100 text-base leading-none hover:bg-stone-200 disabled:opacity-40 disabled:cursor-not-allowed"
                    aria-label="移除挨柱"
                  >
                    −
                  </button>
                  <button
                    onClick={addPillar}
                    disabled={input.pillars.length >= 2}
                    className="h-6 w-6 rounded bg-stone-100 text-base leading-none hover:bg-stone-200 disabled:opacity-40 disabled:cursor-not-allowed"
                    aria-label="加入挨柱"
                  >
                    +
                  </button>
                </div>
              </div>
              <div className="space-y-3">
                {input.pillars.map((p, i) => (
                  <div key={i} className="rounded border border-zinc-200 p-2">
                    <label className="mb-2 flex items-center gap-2 text-xs">
                      <span className="text-zinc-500">位置</span>
                      <select
                        className="rounded border border-zinc-300 px-2 py-1"
                        value={p.corner}
                        onChange={(e) =>
                          updatePillar(i, { corner: e.target.value as PillarCorner })
                        }
                      >
                        {PILLAR_CORNERS.map((c) => (
                          <option key={c.value} value={c.value}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-2">
                      <FloorRangeInput
                        label="柱寬"
                        unit="cm"
                        value={p.widthCm}
                        min={20}
                        max={150}
                        step={5}
                        onChange={(v) => updatePillar(i, { widthCm: v })}
                      />
                      <FloorRangeInput
                        label="柱深"
                        unit="cm"
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
                  <p className="text-[11px] text-zinc-400">
                    無挨柱;若靠柱施工,按 + 加入並選位置與凹陷尺寸。
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* ② 架高高度 */}
          <section className="rounded-lg border border-zinc-200 p-4">
            <h2 className="mb-3 text-sm font-semibold">② 架高高度</h2>
            <FloorRangeInput
              label="高度"
              unit="cm"
              value={input.heightCm}
              min={10}
              max={50}
              step={1}
              onChange={(v) => set("heightCm", v)}
            />
          </section>

          {/* ③ 面材 */}
          <section className="rounded-lg border border-zinc-200 p-4">
            <h2 className="mb-3 text-sm font-semibold">③ 面材</h2>
            <div className="mb-1 text-xs text-zinc-500">常用地板尺寸</div>
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
                      {p.lengthCm}×{p.widthCm}cm · 縫{p.gapMm}mm
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="grid grid-cols-1 gap-x-3 gap-y-2">
              <FloorRangeInput
                label="片長"
                unit="cm"
                value={input.plankLengthCm}
                min={50}
                max={200}
                step={1}
                onChange={(v) => set("plankLengthCm", v)}
              />
              <FloorRangeInput
                label="片寬"
                unit="cm"
                value={input.plankWidthCm}
                min={5}
                max={30}
                step={0.5}
                onChange={(v) => set("plankWidthCm", v)}
              />
              <FloorRangeInput
                label="伸縮縫"
                unit="mm"
                value={input.plankGapMm}
                min={3}
                max={15}
                step={1}
                onChange={(v) => set("plankGapMm", v)}
              />
            </div>
          </section>

          {/* ④ 骨架 */}
          <details open className="rounded-lg border border-zinc-200 p-4">
            <summary className="cursor-pointer text-sm font-semibold">④ 骨架</summary>
            <div className="mt-3 space-y-3">
              <label className="flex flex-col gap-1 text-xs">
                <span className="text-zinc-500">主支角材(頂/底框共用)</span>
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
                <span className="text-zinc-500">副支角材</span>
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
                label="主支間距"
                unit="cm"
                value={input.joistSpacingCm}
                min={20}
                max={50}
                step={5}
                onChange={(v) => set("joistSpacingCm", v)}
              />
              <FloorRangeInput
                label="副支間距"
                unit="cm"
                value={input.subJoistSpacingCm}
                min={20}
                max={80}
                step={5}
                onChange={(v) => set("subJoistSpacingCm", v)}
              />
            </div>
          </details>

          {/* ⑤ 夾板 */}
          <details className="rounded-lg border border-zinc-200 p-4">
            <summary className="cursor-pointer text-sm font-semibold">⑤ 夾板</summary>
            <div className="mt-3 space-y-3">
              <label className="flex flex-col gap-1 text-xs">
                <span className="text-zinc-500">夾板規格</span>
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
              <FloorRangeInput
                label="損耗"
                unit="%"
                value={Math.round(input.plywoodWaste * 100)}
                min={0}
                max={50}
                step={5}
                onChange={(v) => set("plywoodWaste", v / 100)}
              />
            </div>
          </details>

          {/* ⑥ 估價 */}
          <details className="rounded-lg border border-zinc-200 p-4">
            <summary className="cursor-pointer text-sm font-semibold">⑥ 估價</summary>
            <div className="mt-3 grid grid-cols-1 gap-x-3 gap-y-2">
              <FloorRangeInput
                label="面材每坪"
                unit="元"
                value={input.plankPricePerPing}
                min={0}
                max={20000}
                step={50}
                onChange={(v) => set("plankPricePerPing", v)}
              />
              <FloorRangeInput
                label="角材每米"
                unit="元"
                value={input.joistPricePerM}
                min={0}
                max={500}
                step={5}
                onChange={(v) => set("joistPricePerM", v)}
              />
              <FloorRangeInput
                label="夾板每片"
                unit="元"
                value={input.plywoodPricePerSheet}
                min={0}
                max={3000}
                step={10}
                onChange={(v) => set("plywoodPricePerSheet", v)}
              />
              <FloorRangeInput
                label="踢腳每米"
                unit="元"
                value={input.skirtingPricePerM}
                min={0}
                max={500}
                step={5}
                onChange={(v) => set("skirtingPricePerM", v)}
              />
            </div>
          </details>
        </div>

        {/* ───── 右:結果 sticky ───── */}
        <div className="space-y-3">
          <div className="md:sticky md:top-4 md:z-10 space-y-3 bg-white md:bg-transparent">
            {/* tab 切換 */}
            <div className="flex gap-1.5">
              {(
                [
                  { key: "frame", label: "骨架 2D" },
                  { key: "plank", label: "拼花 2D" },
                  { key: "3d", label: "3D 爆炸" },
                ] as { key: PreviewTab; label: string }[]
              ).map((t) => {
                const active = tab === t.key;
                return (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    className={`flex-1 rounded border px-3 py-1.5 text-xs ${
                      active
                        ? "border-[#bd9955] bg-[#bd9955]/15 text-[#8a6d3b] font-medium"
                        : "border-zinc-300 hover:bg-zinc-50"
                    }`}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>

            {/* 對應 tab 顯示視圖 */}
            {tab === "frame" && <RaisedFloorOverviewSvg bom={bom} width={388} />}
            {tab === "plank" && <RaisedFloorPlankSvg bom={bom} width={388} />}
            {tab === "3d" && (
              <div className="space-y-2">
                <LazyRaisedFloorScene3D
                  bom={bom}
                  viewMode={viewMode}
                  explode={explode}
                  layers={layers}
                />

                {/* 圖層 toggle(2 列 wrap) */}
                <div className="rounded border border-zinc-200 p-2">
                  <div className="mb-1 text-[11px] text-zinc-500">顯示圖層</div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1">
                    {LAYER_LABELS.map((l) => (
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
                        {l.label}
                      </label>
                    ))}
                  </div>
                </div>

                {/* 爆炸 slider */}
                <div className="rounded border border-zinc-200 p-2">
                  <div className="mb-1 flex items-center justify-between text-[11px] text-zinc-500">
                    <span>爆炸程度</span>
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
                      { key: "iso", label: "軸測" },
                      { key: "top", label: "俯視" },
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

            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              <Stat
                label="面材"
                value={`${bom.trace.plankTotalCount}`}
                unit="片"
              />
              <Stat
                label="副支"
                value={bom.trace.subJoistTotalM.toFixed(1)}
                unit="m"
              />
              <Stat
                label="骨架"
                value={bom.trace.joistTotalM.toFixed(1)}
                unit="m"
              />
              <Stat
                label="夾板"
                value={`${bom.trace.plywoodSheetCount}`}
                unit="片"
              />
              <Stat
                label="周長"
                value={bom.auto.perimeterM.toFixed(1)}
                unit="m"
              />
            </div>

            {/* BOM 表 */}
            <div className="rounded-lg border border-zinc-200 p-3">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-sm font-semibold">材料清單</h2>
                <button
                  onClick={copyBom}
                  className="rounded border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-50"
                >
                  {copied ? "已複製 ✓" : "複製清單"}
                </button>
              </div>
              <p className="text-xs text-zinc-500">
                平台 {bom.auto.platformAreaM2.toFixed(2)} m² ·{" "}
                {bom.auto.pingShu.toFixed(2)} 坪
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
                        {it.count != null && `${it.count} 片`}
                        {it.totalLengthM != null && `${it.totalLengthM.toFixed(1)} m`}
                      </td>
                      <td className="py-1 pl-2 text-right whitespace-nowrap text-zinc-700">
                        {it.subtotal != null
                          ? `NT$ ${Math.round(it.subtotal).toLocaleString()}`
                          : "—"}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-zinc-300">
                    <td className="py-1 font-semibold" colSpan={2}>
                      總計
                    </td>
                    <td className="py-1 pl-2 text-right font-semibold whitespace-nowrap">
                      {bom.cost.total > 0
                        ? `NT$ ${Math.round(bom.cost.total).toLocaleString()}`
                        : "—"}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* 預估總價 */}
            <div className="rounded-lg border border-[#bd9955]/40 bg-[#bd9955]/10 p-3">
              <div className="flex items-end justify-between gap-2">
                <div>
                  <div className="text-xs text-zinc-500">預估總價</div>
                  <div className="text-2xl font-bold text-[#8a6d3b]">
                    {bom.cost.total > 0
                      ? `NT$ ${Math.round(bom.cost.total).toLocaleString()}`
                      : "未設定報價"}
                  </div>
                </div>
                {bom.cost.total > 0 && bom.cost.hasUnpriced && (
                  <div className="text-[10px] text-amber-700 text-right leading-tight">
                    部分品項
                    <br />
                    未報價
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ════════════════════════════════════════
            裁切表 ① 骨架(1D FFD,角材原料用)
            ════════════════════════════════════════ */}
        <section className="mt-6 rounded-2xl bg-white ring-1 ring-stone-200 shadow-sm overflow-hidden">
          <button
            onClick={() => setCutOpen(!cutOpen)}
            className="w-full px-5 py-3.5 border-b border-stone-100 flex items-center justify-between hover:bg-stone-50 transition"
          >
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-zinc-900">🪚 裁料表 ① 骨架</h2>
              <span className="text-[11px] text-zinc-600">
                共 {cuttingPlan.summary.stockCount} 支角材 · 利用率{" "}
                {cuttingPlan.summary.utilizationPct}% · 剩料{" "}
                {cuttingPlan.summary.totalRemainM} m
              </span>
            </div>
            <span className="text-zinc-400 text-xs">{cutOpen ? "▲" : "▼"}</span>
          </button>
          {cutOpen && (
            <div className="p-5 space-y-4">
              <div className="flex flex-wrap items-center gap-4 text-xs">
                <label className="flex items-center gap-2">
                  <span className="text-zinc-600">原料一支長</span>
                  <input
                    type="number"
                    value={stockLengthCm}
                    step={10}
                    onChange={(e) => setStockLengthCm(Number(e.target.value))}
                    className="w-20 px-2 py-1 border border-stone-300 rounded tabular-nums focus:outline-none focus:border-amber-500"
                  />
                  <span className="text-[10px] text-zinc-600">cm (360=12 尺、300=10 尺)</span>
                </label>
                <label className="flex items-center gap-2">
                  <span className="text-zinc-600">鋸路</span>
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
                  <span className="text-zinc-600">接點搭接</span>
                  <input
                    type="number"
                    value={spliceOverlapCm}
                    step={1}
                    onChange={(e) => setSpliceOverlapCm(Number(e.target.value))}
                    className="w-16 px-2 py-1 border border-stone-300 rounded tabular-nums focus:outline-none focus:border-amber-500"
                  />
                  <span className="text-[10px] text-zinc-600">cm(超原料長段自動分段拼)</span>
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
                      🔗 太長要分段接({groups.size} 件 → {splicedPieces.length} 段,每接點搭接 {spliceOverlapCm} cm)
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
                            合 {r1(segs.reduce((s, p) => s + p.lengthCm, 0))} cm
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
                      <th className="text-left px-3 py-2 font-semibold">第幾支</th>
                      <th className="text-left px-3 py-2 font-semibold">切法</th>
                      <th className="text-right px-3 py-2 font-semibold">已用</th>
                      <th className="text-right px-3 py-2 font-semibold">鋸路</th>
                      <th className="text-right px-3 py-2 font-semibold">剩料</th>
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
                  訂料{" "}
                  <strong className="text-zinc-900 text-base font-bold">
                    {cuttingPlan.summary.stockCount}
                  </strong>{" "}
                  支 {stockLengthCm} cm
                </span>
                <span>
                  總長{" "}
                  <strong className="text-zinc-700">
                    {cuttingPlan.summary.totalStockLengthM} m
                  </strong>
                </span>
                <span>
                  實用{" "}
                  <strong className="text-zinc-700">
                    {cuttingPlan.summary.totalUsedM} m
                  </strong>
                </span>
                <span>
                  剩料{" "}
                  <strong className="text-rose-700">
                    {cuttingPlan.summary.totalRemainM} m
                  </strong>
                </span>
                <span>
                  利用率{" "}
                  <strong className="text-amber-700">
                    {cuttingPlan.summary.utilizationPct}%
                  </strong>
                </span>
              </div>

              <div className="flex flex-wrap gap-3 text-[10px] text-zinc-500">
                <Legend tone={pieceTone("frame-top")} label="頂框" />
                <Legend tone={pieceTone("frame-bottom")} label="底框" />
                <Legend tone={pieceTone("main-joist")} label="頂主支" />
                <Legend tone={pieceTone("main-joist-bottom")} label="底主支" />
                <Legend tone={pieceTone("sub-joist")} label="副支" />
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
              <h2 className="text-sm font-semibold text-zinc-900">🪵 裁料表 ② 地板</h2>
              <span className="text-[11px] text-zinc-600">
                整片 {bom.trace.plankFullCount} + 裁切{" "}
                {bom.trace.plankCutCount}(實耗新片{" "}
                {bom.trace.plankCutNewCount})= {bom.trace.plankTotalCount} 片 · 損耗{" "}
                {bom.trace.plankWastePercent.toFixed(1)}%
              </span>
            </div>
            <span className="text-zinc-400 text-xs">{plankCutOpen ? "▲" : "▼"}</span>
          </button>
          {plankCutOpen && (
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <Stat label="整片" value={String(bom.trace.plankFullCount)} unit="片" />
                <Stat label="裁切件" value={String(bom.trace.plankCutCount)} unit="件" />
                <Stat
                  label="裁切實耗新片"
                  value={String(bom.trace.plankCutNewCount)}
                  unit="片"
                />
                <Stat
                  label="實算損耗"
                  value={bom.trace.plankWastePercent.toFixed(1)}
                  unit="%"
                />
              </div>

              <div className="overflow-x-auto rounded-lg ring-1 ring-stone-200">
                <table className="w-full text-xs">
                  <thead className="bg-stone-50/60 text-zinc-500 text-[10px] uppercase tracking-wider">
                    <tr>
                      <th className="text-left px-3 py-2 font-semibold">編號</th>
                      <th className="text-left px-3 py-2 font-semibold">類型</th>
                      <th className="text-right px-3 py-2 font-semibold">有效長 cm</th>
                      <th className="text-right px-3 py-2 font-semibold">面積 cm²</th>
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
                              整片
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[10px] ring-1 bg-amber-100 text-amber-900 ring-amber-200">
                              裁切片
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
                    ♻️ 餘料再利用明細({bom.trace.offcutReuseLog.length} 筆)
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
