"use client";

/**
 * /ceiling — v4 完整版
 *
 * 結構:
 *   Header (logo + 視圖切 + CSV + ⚙)
 *   Hero 4 大輸入(長/短/板高/天花板高)
 *   視覺(2D / 3D)
 *   6 重點數字
 *   參數卡(排版 + 板規 + 角材 + 吊筋 + 自動間距,grid 密集)
 *   BOM 詳表(預設展開)
 *   施作提示
 *   裁切計算器(可摺)
 *   公式 trace(admin)
 *   ⚙ Settings drawer 只留進階(手動 spacing 值、裁切設定)
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
import { CeilingOverviewSvg, type HighlightCategory } from "@/lib/ceiling/CeilingOverviewSvg";
import { LazyCeilingScene3D } from "@/lib/ceiling/LazyCeilingScene3D";
import type { LayerKey, ViewMode, Scene3DHighlight } from "@/lib/ceiling/CeilingScene3D";
import { bomToCuttingPieces, computeCuttingPlan } from "@/lib/ceiling/cutting";

export function CeilingDevClient() {
  const [input, setInput] = useState<CeilingInput>(DEFAULT_CEILING_INPUT);
  const bom = useMemo(() => computeCeilingBom(input), [input]);

  const [viewKind, setViewKind] = useState<"2d" | "3d">("2d");
  const [view3D, setView3D] = useState<ViewMode>("iso");
  const [explode, setExplode] = useState(0);
  const [layers, setLayers] = useState<Record<LayerKey, boolean>>({
    room: true, frame: true, main: true, sub: true, boards: true,
  });
  const [traceOpen, setTraceOpen] = useState(false);
  const [cutOpen, setCutOpen] = useState(true);
  const [stockLengthCm, setStockLengthCm] = useState(360); // 12 尺
  const [sawKerfCm, setSawKerfCm] = useState(0.3);
  // BOM → 視覺 高亮聯動。null = 無高亮(全顯)。
  const [highlight, setHighlight] = useState<Scene3DHighlight>(null);
  const bomCategoryToHighlight = (c: string): Scene3DHighlight => {
    if (c === "frame") return "frame";
    if (c === "main-joist") return "main";
    if (c === "sub-joist") return "sub";
    if (c === "hanger") return "hanger";
    if (c === "board-full" || c === "board-cut") return "board";
    return null;
  };
  const toggleHighlight = (cat: string) => {
    const target = bomCategoryToHighlight(cat);
    setHighlight((prev) => (prev === target ? null : target));
  };
  // SVG 沒有 hanger 層,把 hanger 高亮映成 null(全亮)避免 SVG 全變暗
  const svgHighlight: HighlightCategory =
    highlight === "hanger" ? null : (highlight as HighlightCategory);

  const cuttingPlan = useMemo(
    () => computeCuttingPlan(bomToCuttingPieces(bom), stockLengthCm, sawKerfCm),
    [bom, stockLengthCm, sawKerfCm],
  );

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

  const subRows = bom.items.filter((i) => i.category === "sub-joist");
  const hanger = bom.items.find((i) => i.category === "hanger");
  const boardFull = bom.items.find((i) => i.category === "board-full");
  const boardCut = bom.items.find((i) => i.category === "board-cut");
  const totalBoards = (boardFull?.count ?? 0) + (boardCut?.count ?? 0);
  const totalSub = bom.trace.slots.reduce((s, x) => s + x.subJoistCount, 0);

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50/40 via-stone-50 to-stone-50">
      {/* Header */}
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
                木匠學院 · v0.4
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
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-5 py-6">
        <div className="flex flex-col lg:grid lg:grid-cols-[1fr_minmax(0,520px)] lg:gap-6 items-start">
          {/* ====== 視覺(mobile order-1 在最上、desktop order-2 在右、sticky)====== */}
          <aside className="w-full order-1 lg:order-2 lg:sticky lg:top-[80px] lg:self-start mb-5 lg:mb-0">
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
                  { k: "room" as const, label: "房間" },
                  { k: "frame" as const, label: "邊框" },
                  { k: "main" as const, label: "主支+吊筋" },
                  { k: "sub" as const, label: "副支" },
                  { k: "boards" as const, label: "矽酸鈣板" },
                ].map(({ k, label }) => (
                  <button key={k} onClick={() => toggleLayer(k)}
                    className={`px-2 h-7 rounded-md text-[11px] font-medium transition ${
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
              <CeilingOverviewSvg bom={bom} highlight={svgHighlight} />
            ) : (
              <LazyCeilingScene3D bom={bom} viewMode={view3D} explode={explode} layers={layers} highlight={highlight} />
            )}
          </div>
            </section>
          </aside>

          {/* ====== 左欄(mobile order-2 在視覺下方、desktop order-1 在左) ====== */}
          <div className="w-full min-w-0 order-2 lg:order-1 space-y-5">
            {/* 4 大輸入 */}
            <section className="rounded-2xl bg-white ring-1 ring-stone-200 shadow-sm overflow-hidden">
              <div className="grid grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-stone-100">
                <HeroInput icon="↔" label="長邊" value={input.longSideCm} suffix="cm"
                  onChange={(v) => update("longSideCm", v)} />
                <HeroInput icon="↕" label="短邊" value={input.shortSideCm} suffix="cm"
                  onChange={(v) => update("shortSideCm", v)} />
                <HeroInput icon="↥" label="板高" value={input.slabHeightCm} suffix="cm" sub="樓板到地"
                  onChange={(v) => update("slabHeightCm", v)} />
                <HeroInput icon="≡" label="天花板高" value={input.ceilingHeightCm} suffix="cm" sub="完成面"
                  onChange={(v) => update("ceilingHeightCm", v)} />
              </div>
            </section>

        {/* ============ 6 重點數字 ============ */}
        <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          <Stat icon="◬" tone="amber" label="坪數" value={r2(bom.auto.pingShu)} unit="坪"
            hint={`${r2(bom.auto.roomAreaM2)} m²`} />
          <Stat icon="▭" tone="stone" label="邊框" value={r1(bom.items[0].totalLengthM ?? 0)} unit="m"
            hint={`周長 ${input.longSideCm + input.shortSideCm}×2`} />
          <Stat icon="┃" tone="amber" label="主支" value={bom.trace.mainJoistTimberCount} unit="支"
            hint={`${r1(bom.trace.mainJoistLengthCm)} cm`} />
          <Stat icon="━" tone="stone" label="副支" value={totalSub} unit="支"
            hint={subRows.length >= 2 ? `${subRows[0].unitLengthCm}/${subRows[1].unitLengthCm} cm` : `${subRows[0]?.unitLengthCm ?? "—"} cm`} />
          <Stat icon="|" tone="stone" label="吊筋" value={hanger?.count ?? 0} unit="支"
            hint={`長 ${r1(bom.auto.hangerHeightCm)} cm`} />
          <Stat icon="▦" tone="amber" label="矽酸鈣板" value={totalBoards} unit="張"
            hint={`${boardFull?.count ?? 0} 整 / ${boardCut?.count ?? 0} 裁`} />
        </section>

        {/* ============ 參數卡(全部可調) ============ */}
        <section className="rounded-2xl bg-white ring-1 ring-stone-200 shadow-sm">
          <div className="px-5 py-3 border-b border-stone-100 flex items-center gap-2">
            <h2 className="text-sm font-semibold text-zinc-900">⚙ 參數</h2>
            <span className="text-[11px] text-zinc-400">改任何值,圖與材料表即時重算</span>
          </div>
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* 排版 */}
            <ParamGroup icon="⇆" title="排版基準">
              <Toggle3 label="主支(沿長邊)" value={input.alignmentBase}
                opts={[["left", "靠左"], ["center", "置中"], ["right", "靠右"]]}
                onChange={(v) => update("alignmentBase", v as AlignmentBase)} />
              <Toggle3 label="副支(沿短邊)" value={input.subAlignmentBase}
                opts={[["top", "靠上"], ["middle", "置中"], ["bottom", "靠下"]]}
                onChange={(v) => update("subAlignmentBase", v as SubAlignmentBase)} />
              <Check label="邊框兼當支撐 (−2 主支)" checked={input.frameDoublesAsSupport}
                onChange={(v) => update("frameDoublesAsSupport", v)} />
            </ParamGroup>

            {/* 矽酸鈣板 */}
            <ParamGroup icon="🪵" title="矽酸鈣板">
              <SmallNum label="板長" value={input.boardLongCm} onChange={(v) => update("boardLongCm", v)} unit="cm" />
              <SmallNum label="板寬" value={input.boardShortCm} onChange={(v) => update("boardShortCm", v)} unit="cm" />
              <SmallNum label="接縫" value={input.jointGapMm} onChange={(v) => update("jointGapMm", v)} step={1} unit="mm" />
              <p className="text-[10px] text-zinc-400 leading-snug">業界 3-6 mm,9 mm 板取 3 mm</p>
            </ParamGroup>

            {/* 角材 + 間距 */}
            <ParamGroup icon="📏" title="角材 + 間距">
              <Check label="🔒 依板規自動算間距" checked={input.useAutoSpacing}
                onChange={(v) => update("useAutoSpacing", v)} />
              <SmallNum label="主支中心距" value={input.useAutoSpacing ? bom.input.mainSpacingCm : input.mainSpacingCm}
                onChange={(v) => update("mainSpacingCm", v)} step={0.1} disabled={input.useAutoSpacing} unit="cm" />
              <SmallNum label="副支中心距" value={input.useAutoSpacing ? bom.input.subSpacingCm : input.subSpacingCm}
                onChange={(v) => update("subSpacingCm", v)} step={0.1} disabled={input.useAutoSpacing} unit="cm" />
              <SmallNum label="角材寬" value={input.timberWidthCm} onChange={(v) => update("timberWidthCm", v)} step={0.1} unit="cm" />
              <SmallNum label="角材厚" value={input.timberThicknessCm} onChange={(v) => update("timberThicknessCm", v)} step={0.1} unit="cm" />
            </ParamGroup>

            {/* 吊筋 */}
            <ParamGroup icon="🪝" title="吊筋">
              <Toggle3 label="密度" value={input.hangerDensity}
                opts={[["standard", "業界標準"], ["minimal", "簡化"]]}
                onChange={(v) => update("hangerDensity", v as HangerDensity)} />
              <SmallNum label="中心距" value={input.hangerSpacingCm} onChange={(v) => update("hangerSpacingCm", v)} unit="cm"
                disabled={input.hangerDensity === "minimal"} />
            </ParamGroup>
          </div>
        </section>

        {/* ============ BOM ============ */}
        <section className="rounded-2xl bg-white ring-1 ring-stone-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-stone-100 flex items-center gap-2 flex-wrap">
            <h2 className="text-sm font-semibold text-zinc-900">📋 材料清單</h2>
            <span className="text-[11px] text-zinc-400">總計 {bom.items.length} 項 · 點任一行高亮對應視覺</span>
            {highlight && (
              <button onClick={() => setHighlight(null)}
                className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 ring-1 ring-amber-300 hover:bg-amber-200 transition">
                清除高亮 ×
              </button>
            )}
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
                {bom.items.map((it, i) => {
                  const rowHigh = bomCategoryToHighlight(it.category);
                  const isSelected = highlight !== null && rowHigh === highlight;
                  const isOther = highlight !== null && rowHigh !== highlight;
                  return (
                    <tr key={i}
                      onClick={() => toggleHighlight(it.category)}
                      className={`cursor-pointer transition ${
                        isSelected ? "bg-amber-50 ring-1 ring-amber-300" :
                        isOther ? "opacity-40 hover:opacity-100" :
                        "hover:bg-amber-50/30"
                      }`}>
                      <td className="px-4 py-2.5"><CategoryBadge category={it.category} /></td>
                      <td className="px-4 py-2.5 text-zinc-900 font-medium">{it.nameZh}</td>
                      <td className="px-4 py-2.5 text-zinc-600 text-xs">{it.spec}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-zinc-700">{it.unitLengthCm != null ? `${it.unitLengthCm} cm` : "—"}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-zinc-700">{it.totalLengthM != null ? `${it.totalLengthM} m` : "—"}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-bold text-amber-700">{it.count}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* ============ 施作提示 ============ */}
        <section className="rounded-2xl bg-gradient-to-br from-amber-50 via-white to-stone-50 ring-1 ring-amber-200/50 p-4 sm:p-5">
          <h3 className="text-sm font-semibold text-amber-900 mb-2 flex items-center gap-2">💡 施作提示</h3>
          <ul className="text-[12px] text-zinc-700 leading-relaxed space-y-1 list-none">
            <li><span className="text-amber-700 font-semibold">板邊接縫:</span> 預設 {input.jointGapMm} mm,環氧樹脂填縫 + 48 mm 接縫帶 + 批土收尾</li>
            <li><span className="text-amber-700 font-semibold">板邊對齊:</span> 中間板邊落主支中心(藍色 tick),周邊板邊落邊框外線</li>
            <li><span className="text-amber-700 font-semibold">螺絲:</span> 距板邊 ≥ 15 mm,沿板邊每 20-30 cm 一支</li>
          </ul>
        </section>

        {/* ============ 裁切計算器 ============ */}
        <section className="rounded-2xl bg-white ring-1 ring-stone-200 shadow-sm overflow-hidden">
          <button onClick={() => setCutOpen(!cutOpen)}
            className="w-full px-5 py-3.5 border-b border-stone-100 flex items-center justify-between hover:bg-stone-50 transition">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-zinc-900">🪚 裁切計算(角材)</h2>
              <span className="text-[11px] text-zinc-400">
                共 {cuttingPlan.summary.stockCount} 支 stock · 利用率 {cuttingPlan.summary.utilizationPct}%
                · 廢料 {cuttingPlan.summary.totalRemainM} m
              </span>
            </div>
            <span className="text-zinc-400 text-xs">{cutOpen ? "▲" : "▼"}</span>
          </button>
          {cutOpen && (
            <div className="p-5 space-y-4">
              <div className="flex flex-wrap items-center gap-4 text-xs">
                <label className="flex items-center gap-2">
                  <span className="text-zinc-600">Stock 長度</span>
                  <input type="number" value={stockLengthCm} step={10}
                    onChange={(e) => setStockLengthCm(Number(e.target.value))}
                    className="w-20 px-2 py-1 border border-stone-300 rounded tabular-nums focus:outline-none focus:border-amber-500" />
                  <span className="text-[10px] text-zinc-400">cm</span>
                  <span className="text-[10px] text-zinc-400">(360=12 尺、300=10 尺、600=20 尺)</span>
                </label>
                <label className="flex items-center gap-2">
                  <span className="text-zinc-600">鋸口 kerf</span>
                  <input type="number" value={sawKerfCm} step={0.1}
                    onChange={(e) => setSawKerfCm(Number(e.target.value))}
                    className="w-16 px-2 py-1 border border-stone-300 rounded tabular-nums focus:outline-none focus:border-amber-500" />
                  <span className="text-[10px] text-zinc-400">cm</span>
                </label>
              </div>
              {/* 超 stock 段拼接警告 */}
              {(() => {
                const oversize = cuttingPlan.stocks.filter((s) => s.remainCm < -0.01);
                if (oversize.length === 0) return null;
                return (
                  <div className="rounded-lg bg-rose-50 ring-1 ring-rose-200 p-3 sm:p-4">
                    <h3 className="text-xs font-semibold text-rose-900 mb-2 flex items-center gap-1.5">
                      ⚠ 超出 stock 長度,需拼接({oversize.length} 段)
                    </h3>
                    <ul className="text-[11px] text-rose-800 space-y-1 leading-relaxed">
                      {oversize.map((s) => {
                        const p = s.pieces[0];
                        const overBy = Math.abs(s.remainCm);
                        return (
                          <li key={s.index} className="flex items-center gap-2">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] ring-1 font-mono ${pieceTone(p.category)}`}>
                              {p.lengthCm}
                            </span>
                            <span>{p.label}</span>
                            <span className="text-rose-600 font-mono">超 {r1(overBy)} cm</span>
                          </li>
                        );
                      })}
                    </ul>
                    <p className="mt-2 text-[10px] text-rose-700 leading-relaxed">
                      <strong>解法:</strong>
                      (a) 改用更長 stock(現在 {stockLengthCm} cm,建議 ≥ {Math.ceil(Math.max(...oversize.map((s) => s.pieces[0].lengthCm)) / 10) * 10} cm)
                      ;或 (b) 現場切兩段拼接(交接處放在邊框上強固)
                    </p>
                  </div>
                );
              })()}

              <div className="overflow-x-auto rounded-lg ring-1 ring-stone-200">
                <table className="w-full text-xs">
                  <thead className="bg-stone-50/60 text-zinc-500 text-[10px] uppercase tracking-wider">
                    <tr>
                      <th className="text-left px-3 py-2 font-semibold">Stock #</th>
                      <th className="text-left px-3 py-2 font-semibold">切法</th>
                      <th className="text-right px-3 py-2 font-semibold">已切</th>
                      <th className="text-right px-3 py-2 font-semibold">鋸</th>
                      <th className="text-right px-3 py-2 font-semibold">剩</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {cuttingPlan.stocks.map((s) => {
                      const oversize = s.remainCm < -0.01;
                      return (
                        <tr key={s.index} className={oversize ? "bg-rose-50/50 hover:bg-rose-50" : "hover:bg-amber-50/30"}>
                          <td className="px-3 py-2 font-mono text-zinc-700">
                            #{s.index}
                            {oversize && <span className="ml-1 text-[9px] text-rose-700">⚠</span>}
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex flex-wrap gap-1 items-center">
                              {s.pieces.map((p, j) => (
                                <span key={j} className={`px-1.5 py-0.5 rounded text-[10px] ring-1 font-mono ${pieceTone(p.category)}`}>
                                  {p.lengthCm}
                                </span>
                              ))}
                              {oversize && <span className="text-[10px] text-rose-700">需拼接</span>}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">{r1(s.usedLengthCm)}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-zinc-400">{r1(s.totalKerfCm)}</td>
                          <td className={`px-3 py-2 text-right tabular-nums font-semibold ${s.remainCm < 0 ? "text-rose-700" : s.remainCm < 10 ? "text-emerald-700" : "text-amber-700"}`}>
                            {r1(s.remainCm)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap gap-3 text-[11px] text-zinc-500">
                <span>採購 <strong className="text-zinc-900 text-base font-bold">{cuttingPlan.summary.stockCount}</strong> 支 {stockLengthCm} cm 角材</span>
                <span>總料 <strong className="text-zinc-700">{cuttingPlan.summary.totalStockLengthM} m</strong></span>
                <span>實用 <strong className="text-zinc-700">{cuttingPlan.summary.totalUsedM} m</strong></span>
                <span>廢料 <strong className="text-rose-700">{cuttingPlan.summary.totalRemainM} m</strong></span>
                <span>利用率 <strong className="text-amber-700">{cuttingPlan.summary.utilizationPct}%</strong></span>
              </div>
            </div>
          )}
        </section>

        {/* ============ 公式 trace(admin) ============ */}
        <section>
          <button onClick={() => setTraceOpen(!traceOpen)}
            className="w-full text-left px-5 py-3 rounded-2xl bg-white ring-1 ring-stone-200 hover:bg-stone-50 flex items-center justify-between text-sm transition">
            <span className="font-medium text-zinc-700 flex items-center gap-2">
              🔬 公式對照 trace <span className="text-[10px] text-zinc-400 font-normal">admin debug</span>
            </span>
            <span className="text-zinc-400 text-xs">{traceOpen ? "▲" : "▼"}</span>
          </button>
          {traceOpen && <TracePanel bom={bom} />}
        </section>
          </div>
        </div>
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// 小元件
// ─────────────────────────────────────────────────────────

function HeroInput({
  icon, label, sub, value, suffix, onChange,
}: { icon: string; label: string; sub?: string; value: number; suffix: string; onChange: (v: number) => void }) {
  return (
    <label className="group block px-5 py-4 hover:bg-amber-50/40 transition cursor-pointer">
      <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 uppercase tracking-wide font-semibold">
        <span className="text-amber-600 text-base leading-none">{icon}</span>
        {label}
        {sub && <span className="text-[9px] text-zinc-400 font-normal normal-case">· {sub}</span>}
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

function ParamGroup({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold flex items-center gap-1.5">
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
    <label className="block text-xs">
      <span className="text-zinc-600 block mb-1">{label}</span>
      <div className="flex items-center gap-1.5">
        <input type="number" value={value} step={step} disabled={disabled}
          onChange={(e) => onChange(Number(e.target.value))}
          className="flex-1 min-w-0 px-2.5 py-1.5 text-sm border border-stone-300 rounded-md tabular-nums disabled:bg-stone-100 disabled:text-stone-400 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200" />
        {unit && <span className="text-[10px] text-zinc-400 w-6 shrink-0">{unit}</span>}
      </div>
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

function pieceTone(category: string): string {
  switch (category) {
    case "frame":      return "bg-amber-100 text-amber-900 ring-amber-200";
    case "main-joist": return "bg-orange-100 text-orange-900 ring-orange-200";
    case "sub-joist":  return "bg-stone-100 text-stone-700 ring-stone-200";
    case "hanger":     return "bg-slate-100 text-slate-700 ring-slate-200";
    default:           return "bg-stone-100 text-stone-700 ring-stone-200";
  }
}

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

function csvEscape(s: string): string {
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function r1(n: number) { return Math.round(n * 10) / 10; }
function r2(n: number) { return Math.round(n * 100) / 100; }
