"use client";

/**
 * /ceiling — v3 視覺豐富版(第一性原理 + 質感)
 *
 * 結構不變(輸入 → 視覺 → 結果),但加質感:
 *   - hero 標題 + 副標 + 漸層背景
 *   - 輸入卡:hover lift,大數字 tabular
 *   - 視覺:陰影 + 漸層 backdrop + 控制列
 *   - 排版 / 對齊 toggles 拉到視覺下方一行(可見)
 *   - 6 stats:每張卡有 icon + 色 accent,hover 浮起
 *   - BOM 預設展開,分組標題(邊框 / 主支 / 副支 / 吊筋 / 矽酸鈣板)+ icon
 *   - 公式 trace 摺起(admin debug)
 *   - 進階設定(板規/接縫/角材/吊筋) 收在 ⚙ drawer
 */

import { useMemo, useState } from "react";
import {
  DEFAULT_CEILING_INPUT,
  type AlignmentBase,
  type CeilingInput,
  type HangerDensity,
  type SubAlignmentBase,
} from "@/lib/ceiling/types";
import { bomToCsvRows, computeCeilingBom } from "@/lib/ceiling/calc";
import { CeilingOverviewSvg } from "@/lib/ceiling/CeilingOverviewSvg";
import { LazyCeilingScene3D } from "@/lib/ceiling/LazyCeilingScene3D";
import type { LayerKey, ViewMode } from "@/lib/ceiling/CeilingScene3D";

export function CeilingDevClient() {
  const [input, setInput] = useState<CeilingInput>(DEFAULT_CEILING_INPUT);
  const bom = useMemo(() => computeCeilingBom(input), [input]);

  const [viewKind, setViewKind] = useState<"2d" | "3d">("2d");
  const [view3D, setView3D] = useState<ViewMode>("iso");
  const [explode, setExplode] = useState(0);
  const [layers, setLayers] = useState<Record<LayerKey, boolean>>({
    room: true, frame: true, main: true, sub: true, boards: true,
  });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [traceOpen, setTraceOpen] = useState(false);

  const toggleLayer = (k: LayerKey) =>
    setLayers((prev) => ({ ...prev, [k]: !prev[k] }));

  function update<K extends keyof CeilingInput>(key: K, value: CeilingInput[K]) {
    setInput((prev) => ({ ...prev, [key]: value }));
  }

  function downloadCsv() {
    const rows = bomToCsvRows(bom);
    const csv = "﻿" + rows.map((r) => r.map(csvEscape).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `天花板算料_${input.longSideCm}x${input.shortSideCm}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // 重點數字
  const subRows = bom.items.filter((i) => i.category === "sub-joist");
  const subInner = subRows[0];
  const subEdge = subRows[1];
  const hanger = bom.items.find((i) => i.category === "hanger");
  const boardFull = bom.items.find((i) => i.category === "board-full");
  const boardCut = bom.items.find((i) => i.category === "board-cut");
  const totalBoards = (boardFull?.count ?? 0) + (boardCut?.count ?? 0);
  const totalSub = bom.trace.slots.reduce((s, x) => s + x.subJoistCount, 0);

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50/40 via-stone-50 to-stone-50">
      {/* ============ 頂部 ============ */}
      <header className="bg-white/80 backdrop-blur-md border-b border-stone-200/80 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-5 py-3 flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2.5 mr-auto">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-white text-sm font-bold shadow-sm shadow-amber-500/30">
              ▣
            </div>
            <div>
              <h1 className="text-sm font-semibold text-zinc-900 leading-tight">天花板骨架施工模擬器</h1>
              <p className="text-[10px] text-zinc-500 leading-tight flex items-center gap-1.5">
                <span className="text-[9px] text-rose-700 bg-rose-50 ring-1 ring-rose-200 px-1.5 py-px rounded-full">admin</span>
                木匠學院 · v0.3
              </p>
            </div>
          </div>
          <div className="inline-flex gap-0.5 p-0.5 bg-stone-100 rounded-lg text-[11px] font-medium ring-1 ring-stone-200">
            <button onClick={() => setViewKind("2d")}
              className={`px-3 py-1.5 rounded-md transition ${viewKind === "2d" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-800"}`}>
              📐 平面
            </button>
            <button onClick={() => setViewKind("3d")}
              className={`px-3 py-1.5 rounded-md transition ${viewKind === "3d" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-800"}`}>
              🧊 立體
            </button>
          </div>
          <button onClick={downloadCsv}
            className="px-3 py-1.5 text-[12px] font-medium rounded-lg bg-gradient-to-b from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white shadow-sm shadow-amber-500/30 transition">
            ⬇ CSV
          </button>
          <button onClick={() => setSettingsOpen(true)}
            className="px-3 py-1.5 text-[12px] rounded-lg bg-white border border-stone-200 hover:bg-stone-50 hover:border-stone-300 transition text-zinc-700">
            ⚙ 設定
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-5 py-6 space-y-5">
        {/* ============ 4 大輸入 ============ */}
        <section className="rounded-2xl bg-white ring-1 ring-stone-200 shadow-sm overflow-hidden">
          <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-stone-100">
            <HeroInput icon="↔" label="長邊" value={input.longSideCm} suffix="cm"
              onChange={(v) => update("longSideCm", v)} />
            <HeroInput icon="↕" label="短邊" value={input.shortSideCm} suffix="cm"
              onChange={(v) => update("shortSideCm", v)} />
            <HeroInput icon="↥" label="板高" value={input.slabHeightCm} suffix="cm" sub="樓板到地"
              onChange={(v) => update("slabHeightCm", v)} />
            <HeroInput icon="≡" label="天花板高" value={input.ceilingHeightCm} suffix="cm" sub="完成面到地"
              onChange={(v) => update("ceilingHeightCm", v)} />
          </div>
        </section>

        {/* ============ 視覺 + 控制 ============ */}
        <section className="rounded-2xl bg-white ring-1 ring-stone-200 shadow-sm overflow-hidden">
          {viewKind === "3d" && (
            <div className="px-4 py-2.5 border-b border-stone-100 bg-gradient-to-r from-stone-50/50 to-transparent flex flex-wrap items-center gap-3 text-[11px]">
              <div className="inline-flex gap-0.5 p-0.5 bg-white rounded-md ring-1 ring-stone-200">
                <button onClick={() => setView3D("iso")}
                  className={`px-2 py-1 rounded font-medium ${view3D === "iso" ? "bg-amber-100 text-amber-900" : "text-zinc-600 hover:text-zinc-900"}`}>軸測</button>
                <button onClick={() => setView3D("top")}
                  className={`px-2 py-1 rounded font-medium ${view3D === "top" ? "bg-amber-100 text-amber-900" : "text-zinc-600 hover:text-zinc-900"}`}>俯視</button>
              </div>
              <label className="flex items-center gap-2 text-zinc-600">
                💥 爆炸
                <input type="range" min={0} max={1} step={0.01} value={explode}
                  onChange={(e) => setExplode(Number(e.target.value))} className="w-28 accent-amber-600" />
                <span className="tabular-nums w-10 text-zinc-500 font-mono">{(explode * 100).toFixed(0)}%</span>
              </label>
              <div className="flex items-center gap-1 text-zinc-600">
                <span>圖層</span>
                {[
                  { k: "room" as const, label: "房" },
                  { k: "frame" as const, label: "邊" },
                  { k: "main" as const, label: "主" },
                  { k: "sub" as const, label: "副" },
                  { k: "boards" as const, label: "板" },
                ].map(({ k, label }) => (
                  <button key={k} onClick={() => toggleLayer(k)}
                    className={`w-7 h-7 rounded-md text-[11px] font-semibold transition ${
                      layers[k] ? "bg-amber-500 text-white shadow-sm shadow-amber-500/40" : "bg-stone-100 text-stone-400 hover:bg-stone-200"
                    }`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="p-3 bg-gradient-to-br from-stone-50/40 via-transparent to-amber-50/20">
            {viewKind === "2d" ? (
              <CeilingOverviewSvg bom={bom} />
            ) : (
              <LazyCeilingScene3D bom={bom} viewMode={view3D} explode={explode} layers={layers} />
            )}
          </div>
        </section>

        {/* ============ 排版 / 對齊 quick toggles ============ */}
        <section className="rounded-2xl bg-white ring-1 ring-stone-200 shadow-sm p-3 sm:p-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-5">
            <ToggleRow icon="⇆" label="主支排版" subLabel="沿長邊"
              value={input.alignmentBase}
              opts={[["left", "靠左"], ["center", "置中"], ["right", "靠右"]]}
              onChange={(v) => update("alignmentBase", v as AlignmentBase)} />
            <ToggleRow icon="⇅" label="副支排版" subLabel="沿短邊,板邊有副支撐"
              value={input.subAlignmentBase}
              opts={[["top", "靠上"], ["middle", "置中"], ["bottom", "靠下"]]}
              onChange={(v) => update("subAlignmentBase", v as SubAlignmentBase)} />
            <label className="flex items-center gap-2 text-xs sm:self-end px-2 py-2 rounded-lg hover:bg-stone-50 cursor-pointer transition">
              <input type="checkbox" checked={input.frameDoublesAsSupport}
                onChange={(e) => update("frameDoublesAsSupport", e.target.checked)}
                className="accent-amber-600 w-4 h-4" />
              <span className="text-zinc-700">邊框兼當支撐 <span className="text-zinc-400">(BOM −2)</span></span>
            </label>
          </div>
        </section>

        {/* ============ 6 重點數字 ============ */}
        <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <Stat icon="◬" tone="amber" label="坪數" value={r2(bom.auto.pingShu)} unit="坪"
            hint={`${r2(bom.auto.roomAreaM2)} m²`} />
          <Stat icon="▭" tone="stone" label="邊框" value={r1(bom.items[0].totalLengthM ?? 0)} unit="m"
            hint={`周長 ${input.longSideCm + input.shortSideCm}×2`} />
          <Stat icon="┃" tone="amber" label="主支" value={bom.trace.mainJoistTimberCount} unit="支"
            hint={`${r1(bom.trace.mainJoistLengthCm)} cm`} />
          <Stat icon="━" tone="stone" label="副支" value={totalSub} unit="支"
            hint={subInner && subEdge ? `${subInner.unitLengthCm}/${subEdge.unitLengthCm} cm` : `${subInner?.unitLengthCm ?? "—"} cm`} />
          <Stat icon="|" tone="stone" label="吊筋" value={hanger?.count ?? 0} unit="支"
            hint={`長 ${r1(bom.auto.hangerHeightCm)} cm`} />
          <Stat icon="▦" tone="amber" label="矽酸鈣板" value={totalBoards} unit="張"
            hint={`${boardFull?.count ?? 0} 整 / ${boardCut?.count ?? 0} 裁`} />
        </section>

        {/* ============ BOM 詳表 預設展開 ============ */}
        <section className="rounded-2xl bg-white ring-1 ring-stone-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-stone-100 flex items-center gap-2">
            <h2 className="text-sm font-semibold text-zinc-900">📋 材料清單</h2>
            <span className="text-[11px] text-zinc-400">總計 {bom.items.length} 項</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-stone-50/60 text-zinc-500 text-[10px] uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-2.5 font-semibold">類別</th>
                  <th className="text-left px-4 py-2.5 font-semibold">名稱</th>
                  <th className="text-left px-4 py-2.5 font-semibold">規格</th>
                  <th className="text-right px-4 py-2.5 font-semibold">單長</th>
                  <th className="text-right px-4 py-2.5 font-semibold">總長</th>
                  <th className="text-right px-4 py-2.5 font-semibold">數量</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {bom.items.map((it, i) => (
                  <tr key={i} className="hover:bg-amber-50/30 transition">
                    <td className="px-4 py-2.5">
                      <CategoryBadge category={it.category} />
                    </td>
                    <td className="px-4 py-2.5 text-zinc-900 font-medium">{it.nameZh}</td>
                    <td className="px-4 py-2.5 text-zinc-600 text-xs">{it.spec}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-zinc-700">{it.unitLengthCm != null ? `${it.unitLengthCm} cm` : "—"}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-zinc-700">{it.totalLengthM != null ? `${it.totalLengthM} m` : "—"}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-bold text-amber-700">{it.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ============ 提示 - 接縫處理 ============ */}
        <section className="rounded-2xl bg-gradient-to-br from-amber-50 via-white to-stone-50 ring-1 ring-amber-200/50 p-4 sm:p-5">
          <h3 className="text-sm font-semibold text-amber-900 mb-2 flex items-center gap-2">
            💡 施作提示
          </h3>
          <ul className="text-[12px] text-zinc-700 leading-relaxed space-y-1 list-none">
            <li><span className="text-amber-600 font-semibold">板邊接縫:</span> 預設 {input.jointGapMm} mm,環氧樹脂填縫 + 48 mm 接縫帶 + 批土收尾(防熱脹冷縮 / 結構振動裂)</li>
            <li><span className="text-amber-600 font-semibold">板邊對齊:</span> 中間板邊落主支中心(藍色虛線 tick),周邊板邊落邊框外線</li>
            <li><span className="text-amber-600 font-semibold">螺絲:</span> 距板邊 ≥ 15 mm,沿板邊 20-30 cm 一支</li>
          </ul>
        </section>

        {/* ============ 公式對照(admin) ============ */}
        <section>
          <button onClick={() => setTraceOpen(!traceOpen)}
            className="w-full text-left px-5 py-3 rounded-2xl bg-white ring-1 ring-stone-200 hover:bg-stone-50 flex items-center justify-between text-sm transition">
            <span className="font-medium text-zinc-700 flex items-center gap-2">🔬 公式對照 trace <span className="text-[10px] text-zinc-400 font-normal">admin debug</span></span>
            <span className="text-zinc-400 text-xs">{traceOpen ? "▲" : "▼"}</span>
          </button>
          {traceOpen && <TracePanel bom={bom} />}
        </section>
      </main>

      {settingsOpen && (
        <SettingsDrawer input={input} bom={bom} update={update} onClose={() => setSettingsOpen(false)} />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// HeroInput
// ─────────────────────────────────────────────────────────
function HeroInput({
  icon, label, sub, value, suffix, onChange,
}: { icon: string; label: string; sub?: string; value: number; suffix: string; onChange: (v: number) => void }) {
  return (
    <label className="group block px-5 py-4 hover:bg-amber-50/40 transition cursor-pointer">
      <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 uppercase tracking-wide font-semibold">
        <span className="text-amber-600 text-base leading-none">{icon}</span>
        {label}
        {sub && <span className="text-[9px] text-zinc-400 lowercase font-normal normal-case">· {sub}</span>}
      </div>
      <div className="flex items-baseline gap-1.5 mt-1">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="text-3xl font-bold text-zinc-900 tabular-nums bg-transparent w-full focus:outline-none [-moz-appearance:textfield] [&::-webkit-inner-spin-button]:m-0 group-hover:text-amber-900 transition"
        />
        <span className="text-xs text-zinc-400 font-medium">{suffix}</span>
      </div>
    </label>
  );
}

// ─────────────────────────────────────────────────────────
// Stat
// ─────────────────────────────────────────────────────────
function Stat({
  icon, tone, label, value, unit, hint,
}: { icon: string; tone: "amber" | "stone"; label: string; value: number | string; unit: string; hint?: string }) {
  const toneClasses = tone === "amber"
    ? "bg-gradient-to-br from-amber-50 via-white to-white ring-amber-200/60 hover:ring-amber-300"
    : "bg-white ring-stone-200 hover:ring-stone-300";
  const iconClasses = tone === "amber" ? "text-amber-600" : "text-zinc-400";
  return (
    <div className={`group rounded-xl ring-1 px-4 py-3 shadow-sm hover:shadow transition cursor-default ${toneClasses}`}>
      <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 uppercase tracking-wide font-semibold">
        <span className={`text-base leading-none ${iconClasses}`}>{icon}</span>
        {label}
      </div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="text-2xl font-bold text-zinc-900 tabular-nums">{value}</span>
        <span className="text-xs text-zinc-400">{unit}</span>
      </div>
      {hint && <div className="text-[10px] text-zinc-500 mt-0.5 tabular-nums truncate font-mono">{hint}</div>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// ToggleRow — 排版 toggle 主畫面版
// ─────────────────────────────────────────────────────────
function ToggleRow<T extends string>({
  icon, label, subLabel, value, opts, onChange,
}: { icon: string; label: string; subLabel?: string; value: T; opts: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-[11px] text-zinc-600 font-medium mb-1.5">
        <span className="text-amber-600">{icon}</span>
        {label}
        {subLabel && <span className="text-[10px] text-zinc-400 font-normal">· {subLabel}</span>}
      </div>
      <div className="inline-flex w-full gap-0.5 p-0.5 bg-stone-100 rounded-lg ring-1 ring-stone-200/50">
        {opts.map(([v, lbl]) => (
          <button key={v} type="button" onClick={() => onChange(v)}
            className={`flex-1 px-2 py-1.5 rounded-md text-[11px] font-medium transition ${
              value === v
                ? "bg-white text-zinc-900 shadow-sm ring-1 ring-stone-200"
                : "text-zinc-500 hover:text-zinc-800"
            }`}>
            {lbl}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// CategoryBadge
// ─────────────────────────────────────────────────────────
function CategoryBadge({ category }: { category: string }) {
  const map: Record<string, { label: string; tone: string }> = {
    "frame":      { label: "邊框",   tone: "bg-amber-100 text-amber-900 ring-amber-200" },
    "main-joist": { label: "主支",   tone: "bg-orange-100 text-orange-900 ring-orange-200" },
    "sub-joist":  { label: "副支",   tone: "bg-stone-100 text-stone-700 ring-stone-200" },
    "hanger":     { label: "吊筋",   tone: "bg-slate-100 text-slate-700 ring-slate-200" },
    "board-full": { label: "板·整", tone: "bg-emerald-100 text-emerald-900 ring-emerald-200" },
    "board-cut":  { label: "板·裁", tone: "bg-rose-100 text-rose-900 ring-rose-200" },
  };
  const info = map[category] ?? { label: category, tone: "bg-stone-100 text-stone-700 ring-stone-200" };
  return (
    <span className={`inline-block text-[10px] px-2 py-0.5 rounded-full ring-1 font-medium ${info.tone}`}>
      {info.label}
    </span>
  );
}

// ─────────────────────────────────────────────────────────
// SettingsDrawer
// ─────────────────────────────────────────────────────────
function SettingsDrawer({
  input, bom, update, onClose,
}: {
  input: CeilingInput;
  bom: ReturnType<typeof computeCeilingBom>;
  update: <K extends keyof CeilingInput>(key: K, value: CeilingInput[K]) => void;
  onClose: () => void;
}) {
  return (
    <>
      <div className="fixed inset-0 bg-zinc-900/40 backdrop-blur-sm z-40 animate-[fadeIn_150ms_ease-out]" onClick={onClose} />
      <aside className="fixed right-0 top-0 bottom-0 w-full sm:w-[360px] bg-white shadow-2xl z-50 overflow-y-auto animate-[slideInRight_200ms_ease-out]">
        <div className="sticky top-0 bg-white/95 backdrop-blur-sm border-b border-stone-200 px-5 py-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
            <span className="text-amber-600">⚙</span> 進階設定
          </h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-900 text-2xl leading-none w-7 h-7 flex items-center justify-center rounded hover:bg-stone-100 transition">×</button>
        </div>
        <div className="p-5 space-y-5">
          <Group icon="📏" title="角材規格">
            <SmallNum label="截面寬" value={input.timberWidthCm} onChange={(v) => update("timberWidthCm", v)} step={0.1} unit="cm" />
            <SmallNum label="截面厚" value={input.timberThicknessCm} onChange={(v) => update("timberThicknessCm", v)} step={0.1} unit="cm" />
            <p className="text-[10px] text-zinc-400">預設 3.6 × 3.0 cm = 1.2" × 1"</p>
          </Group>

          <Group icon="🪵" title="矽酸鈣板">
            <SmallNum label="板長" value={input.boardLongCm} onChange={(v) => update("boardLongCm", v)} unit="cm" />
            <SmallNum label="板寬" value={input.boardShortCm} onChange={(v) => update("boardShortCm", v)} unit="cm" />
            <SmallNum label="接縫" value={input.jointGapMm} onChange={(v) => update("jointGapMm", v)} step={1} unit="mm" />
            <p className="text-[10px] text-amber-700 leading-snug">業界 3-6 mm,9 mm 板取 3 mm。</p>
          </Group>

          <Group icon="📐" title="角材間距">
            <Check label="🔒 依板規 + 接縫自動算" checked={input.useAutoSpacing}
              onChange={(v) => update("useAutoSpacing", v)} />
            <SmallNum label="主支中心距" value={input.useAutoSpacing ? bom.input.mainSpacingCm : input.mainSpacingCm}
              onChange={(v) => update("mainSpacingCm", v)} step={0.1}
              disabled={input.useAutoSpacing} unit="cm" />
            <SmallNum label="副支中心距" value={input.useAutoSpacing ? bom.input.subSpacingCm : input.subSpacingCm}
              onChange={(v) => update("subSpacingCm", v)} step={0.1}
              disabled={input.useAutoSpacing} unit="cm" />
            {input.useAutoSpacing && (
              <p className="text-[10px] text-amber-700 leading-snug">
                主支 = 板寬 + 接縫;副支 = 板長 ÷ round(板長 / 36)。
              </p>
            )}
          </Group>

          <Group icon="🪝" title="吊筋">
            <Toggle3 label="密度" value={input.hangerDensity}
              opts={[["standard", "業界標準"], ["minimal", "簡化(僅兩端)"]]}
              onChange={(v) => update("hangerDensity", v as HangerDensity)} />
            <SmallNum label="中心距" value={input.hangerSpacingCm} onChange={(v) => update("hangerSpacingCm", v)} unit="cm"
              disabled={input.hangerDensity === "minimal"} />
          </Group>
        </div>
      </aside>
      <style jsx>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }
      `}</style>
    </>
  );
}

function Group({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold mb-2 flex items-center gap-1.5">
        <span>{icon}</span>{title}
      </h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function SmallNum({
  label, value, onChange, step = 1, unit, disabled,
}: { label: string; value: number; onChange: (v: number) => void; step?: number; unit?: string; disabled?: boolean }) {
  return (
    <label className="flex items-center gap-2 text-xs">
      <span className="text-zinc-600 w-20 shrink-0">{label}</span>
      <input type="number" value={value} step={step} disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 min-w-0 px-2.5 py-1.5 text-sm border border-stone-300 rounded-md tabular-nums disabled:bg-stone-100 disabled:text-stone-400 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200" />
      {unit && <span className="text-[10px] text-zinc-400 w-7">{unit}</span>}
    </label>
  );
}

function Toggle3<T extends string>({
  label, value, opts, onChange,
}: { label: string; value: T; opts: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="text-xs">
      <div className="text-zinc-600 mb-1">{label}</div>
      <div className="inline-flex w-full gap-0.5 p-0.5 bg-stone-100 rounded-md">
        {opts.map(([v, lbl]) => (
          <button key={v} type="button" onClick={() => onChange(v)}
            className={`flex-1 px-2 py-1.5 rounded text-[11px] font-medium transition ${
              value === v ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-600 hover:text-zinc-900"
            }`}>
            {lbl}
          </button>
        ))}
      </div>
    </div>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-xs text-zinc-700 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="accent-amber-600 w-4 h-4" />
      {label}
    </label>
  );
}

// ─────────────────────────────────────────────────────────
// TracePanel
// ─────────────────────────────────────────────────────────
function TracePanel({ bom }: { bom: ReturnType<typeof computeCeilingBom> }) {
  return (
    <div className="mt-2 rounded-2xl bg-white ring-1 ring-stone-200 p-5 text-xs space-y-3">
      <Row label="主支中心位置(沿長邊 cm)" mono>[{bom.trace.mainJoistCentersCm.join(", ")}]</Row>
      <Row label="主支單支長度 × 實際根數" mono>{bom.trace.mainJoistLengthCm} cm × {bom.trace.mainJoistTimberCount}</Row>
      <Row label="支撐排序(含邊框內側,cm)" mono>[{bom.trace.supportPositionsCm.join(", ")}]</Row>
      <div>
        <div className="text-[10px] text-zinc-500 uppercase tracking-wide font-semibold mb-1">副支 slot 明細</div>
        <table className="w-full text-[10px] font-mono">
          <thead className="text-zinc-400">
            <tr><th className="text-left">slot</th><th className="text-right">寬</th><th className="text-right">副支長</th><th className="text-right">數</th></tr>
          </thead>
          <tbody className="text-zinc-700">
            {bom.trace.slots.map((s, i) => (
              <tr key={i}>
                <td>{s.fromCm}→{s.toCm}</td>
                <td className="text-right">{s.slotWidthCm}</td>
                <td className="text-right">{s.subJoistLengthCm}</td>
                <td className="text-right">{s.subJoistCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Row label="每主支吊筋數" mono>{bom.trace.hangerPerMainJoist}</Row>
      <Row label="副支 Y 偏移(從 innerY0,cm)" mono>[{bom.trace.subJoistYOffsetsCm.join(", ")}]</Row>
      <Row label="矽酸鈣板鋪法">{bom.trace.boardLayoutDescription}</Row>
    </div>
  );
}

function Row({ label, children, mono }: { label: string; children: React.ReactNode; mono?: boolean }) {
  return (
    <div>
      <div className="text-[10px] text-zinc-500 uppercase tracking-wide font-semibold mb-0.5">{label}</div>
      <div className={`text-zinc-700 ${mono ? "font-mono text-[11px] break-all" : ""}`}>{children}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// helpers
// ─────────────────────────────────────────────────────────
function csvEscape(s: string): string {
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function r1(n: number) { return Math.round(n * 10) / 10; }
function r2(n: number) { return Math.round(n * 100) / 100; }
