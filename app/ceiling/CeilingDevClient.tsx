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

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { encodeState } from "@/lib/engineering-quote/url-codec";
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
import {
  type Fixture,
  type FixtureKind,
  FIXTURE_KIND_LABEL,
  checkFixtureCollisions,
  makeDefaultFixture,
} from "@/lib/ceiling/fixtures";
import { BrandedHeader } from "@/components/branding/BrandedHeader";
import { CeilingRangeInput } from "./CeilingRangeInput";

interface CustomerInfo {
  name: string;
  phone: string;
  address: string;
  notes: string;
}
const EMPTY_CUSTOMER: CustomerInfo = { name: "", phone: "", address: "", notes: "" };

export function CeilingDevClient() {
  const router = useRouter();
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
  const [spliceOverlapCm, setSpliceOverlapCm] = useState(10); // 拼接重疊(實務每段交接 ~10 cm 放邊框上強固)
  const [shareCode, setShareCode] = useState<string | null>(null);
  const [shareStatus, setShareStatus] = useState<"" | "loading" | "saved" | "copied">("");
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [fixturesOpen, setFixturesOpen] = useState(false);
  const [stepsOpen, setStepsOpen] = useState(false);
  const [customer, setCustomer] = useState<CustomerInfo>(EMPTY_CUSTOMER);
  const [customerOpen, setCustomerOpen] = useState(false);
  const collisions = useMemo(() => checkFixtureCollisions(fixtures, bom), [fixtures, bom]);
  const addFixture = (kind: FixtureKind) =>
    setFixtures((prev) => [...prev, makeDefaultFixture(kind, input.longSideCm, input.shortSideCm, prev.length)]);
  const updateFixture = (id: string, patch: Partial<Fixture>) =>
    setFixtures((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  const removeFixture = (id: string) =>
    setFixtures((prev) => prev.filter((f) => f.id !== id));

  // 載入短碼:?c=CODE
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const code = params.get("c");
    if (!code) return;
    setShareStatus("loading");
    fetch(`/api/ceiling/share?code=${encodeURIComponent(code)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.input) {
          setInput((prev) => ({ ...prev, ...data.input.input || data.input }));
          if (data.input.fixtures) setFixtures(data.input.fixtures);
          if (data.input.customer) setCustomer(data.input.customer);
          setShareCode(code);
          setShareStatus("saved");
        } else {
          setShareStatus("");
          console.warn("ceiling share load failed:", data.error);
        }
      })
      .catch((e) => { setShareStatus(""); console.warn(e); });
  }, []);

  async function shareCase() {
    setShareStatus("loading");
    try {
      const res = await fetch("/api/ceiling/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: { input, fixtures, customer } }),
      });
      const data = await res.json();
      if (!data.code) throw new Error(data.error || "no code");
      setShareCode(data.code);
      const url = `${window.location.origin}/ceiling?c=${data.code}`;
      await navigator.clipboard.writeText(url);
      setShareStatus("copied");
      // 加進 localStorage 近期案場
      const recent: { code: string; long: number; short: number; ts: number }[] =
        JSON.parse(localStorage.getItem("wrd-ceiling-recent") || "[]");
      recent.unshift({ code: data.code, long: input.longSideCm, short: input.shortSideCm, ts: Date.now() });
      localStorage.setItem("wrd-ceiling-recent", JSON.stringify(recent.slice(0, 10)));
      setTimeout(() => setShareStatus("saved"), 2000);
    } catch (e) {
      console.warn(e);
      setShareStatus("");
      alert("分享失敗,請稍後重試(或檢查 Upstash 設定)");
    }
  }

  // BOM → 視覺 高亮聯動。null = 無高亮(全顯)。
  const [highlight, setHighlight] = useState<Scene3DHighlight>(null);
  // 副支按長度分組高亮:同一 "sub" category 但不同長度(內 86.7 vs 邊 18.8)
  const [subLengthFilter, setSubLengthFilter] = useState<number | null>(null);
  // 矽酸鈣板按 整/裁 分組高亮
  const [boardKindFilter, setBoardKindFilter] = useState<"full" | "cut" | null>(null);
  const bomCategoryToHighlight = (c: string): Scene3DHighlight => {
    if (c === "frame") return "frame";
    if (c === "main-joist") return "main";
    if (c === "sub-joist") return "sub";
    if (c === "hanger") return "hanger";
    if (c === "board-full" || c === "board-cut") return "board";
    return null;
  };
  const toggleHighlight = (cat: string, length?: number | null) => {
    const target = bomCategoryToHighlight(cat);
    if (cat === "sub-joist" && length != null) {
      // 副支:同長度第二次點 = 取消
      if (highlight === "sub" && subLengthFilter === length) {
        setHighlight(null); setSubLengthFilter(null);
      } else {
        setHighlight("sub"); setSubLengthFilter(length); setBoardKindFilter(null);
      }
    } else if (cat === "board-full" || cat === "board-cut") {
      const kind = cat === "board-full" ? "full" : "cut";
      if (highlight === "board" && boardKindFilter === kind) {
        setHighlight(null); setBoardKindFilter(null);
      } else {
        setHighlight("board"); setBoardKindFilter(kind); setSubLengthFilter(null);
      }
    } else {
      setHighlight((prev) => (prev === target ? null : target));
      setSubLengthFilter(null);
      setBoardKindFilter(null);
    }
  };
  // SVG 加了 hanger 俯視點(2026-05-18),hanger 高亮直接 pass through
  const svgHighlight: HighlightCategory = highlight as HighlightCategory;

  const cuttingPlan = useMemo(
    () => computeCuttingPlan(bomToCuttingPieces(bom), stockLengthCm, sawKerfCm, spliceOverlapCm),
    [bom, stockLengthCm, sawKerfCm, spliceOverlapCm],
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
      <header className="bg-white/80 backdrop-blur-md border-b border-stone-200/80 sticky top-0 z-30 print:hidden">
        <div className="max-w-7xl mx-auto px-5 pr-16 lg:pr-5 py-3 flex items-center gap-3 flex-wrap">
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
          <button onClick={shareCase} disabled={shareStatus === "loading"}
            className="px-3 py-1.5 text-[12px] font-medium rounded-lg bg-white border border-stone-200 hover:bg-stone-50 hover:border-stone-300 transition text-zinc-700 disabled:opacity-50">
            {shareStatus === "loading" ? "..." : shareStatus === "copied" ? "✓ 連結已複製" : "🔗 分享"}
          </button>
          <button onClick={downloadCsv}
            className="px-3 py-1.5 text-[12px] font-medium rounded-lg bg-white border border-stone-200 hover:bg-stone-50 hover:border-stone-300 transition text-zinc-700">
            ⬇ CSV
          </button>
          <button onClick={() => { setViewKind("2d"); setTimeout(() => window.print(), 200); }}
            className="px-3 py-1.5 text-[12px] font-medium rounded-lg bg-gradient-to-b from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white shadow-sm shadow-amber-500/30 transition">
            🖨 列印
          </button>
        </div>
      </header>

      {/* 列印時頂部顯示的標題列 + 客戶 TO(平常隱藏) */}
      <div className="hidden print:block px-5 pt-4 pb-2 border-b border-stone-300">
        <div className="flex items-start justify-between gap-6">
          <BrandedHeader />
          <div className="text-right text-[11px] text-zinc-700">
            <p className="font-bold text-sm text-zinc-900">天花板骨架材料採購清單</p>
            <p className="mt-0.5">日期:{new Date().toLocaleDateString("zh-TW")}</p>
            {shareCode && <p className="text-zinc-500 font-mono">案場 #{shareCode}</p>}
          </div>
        </div>
        {(customer.name || customer.address || customer.phone) && (
          <div className="mt-3 pt-2 border-t border-stone-200 grid grid-cols-2 gap-2 text-[11px]">
            <div>
              <span className="text-zinc-500">客戶:</span>
              <span className="ml-1 font-semibold">{customer.name || "—"}</span>
              {customer.phone && <span className="ml-3 text-zinc-700">{customer.phone}</span>}
            </div>
            <div className="text-right">
              <span className="text-zinc-500">案場:</span>
              <span className="ml-1 text-zinc-700">{customer.address || "—"}</span>
            </div>
            {customer.notes && (
              <div className="col-span-2 text-zinc-600">備註:{customer.notes}</div>
            )}
          </div>
        )}
        <p className="text-[10px] text-zinc-500 mt-2">
          長 {input.longSideCm} × 短 {input.shortSideCm} × 板高 {input.slabHeightCm} × 天花板高 {input.ceilingHeightCm} cm
          · {r2(bom.auto.pingShu)} 坪
        </p>
      </div>

      <main className="max-w-7xl mx-auto px-5 py-6">
        <div className="flex flex-col lg:grid lg:grid-cols-[1fr_minmax(0,520px)] lg:gap-6 items-start">
          {/* ====== 視覺(mobile order-1 在最上、desktop order-2 在右、sticky)====== */}
          <aside className="w-full order-1 lg:order-2 sticky top-[156px] lg:top-[80px] z-20 lg:z-auto self-start mb-5 lg:mb-0 print:static print:mb-3 print-keep">
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
              <CeilingOverviewSvg bom={bom} highlight={svgHighlight} subLengthFilter={subLengthFilter}
                boardKindFilter={boardKindFilter} fixtures={fixtures} collisions={collisions} />
            ) : (
              <LazyCeilingScene3D bom={bom} viewMode={view3D} explode={explode} layers={layers} highlight={highlight} subLengthFilter={subLengthFilter} boardKindFilter={boardKindFilter} />
            )}
          </div>
            </section>
          </aside>

          {/* ====== 左欄(mobile order-2 在視覺下方、desktop order-1 在左) ====== */}
          <div className="w-full min-w-0 order-2 lg:order-1 space-y-5">
            {/* 4 大輸入 — 房間尺寸 */}
            <section className="rounded-2xl bg-white ring-1 ring-stone-200 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-stone-100 flex items-center gap-2">
                <h2 className="text-sm font-semibold text-zinc-900">📐 房間尺寸</h2>
                <span className="text-[11px] text-zinc-600">拖拉條調整,圖與材料表即時重算</span>
              </div>
              <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                <CeilingRangeInput icon="↔" label="長邊" value={input.longSideCm} unit="cm"
                  min={100} max={1500} step={5} onChange={(v) => update("longSideCm", v)} />
                <CeilingRangeInput icon="↕" label="短邊" value={input.shortSideCm} unit="cm"
                  min={100} max={1200} step={5} onChange={(v) => update("shortSideCm", v)} />
                <CeilingRangeInput icon="↥" label="板高" sub="樓板到地" value={input.slabHeightCm} unit="cm"
                  min={200} max={400} step={1} onChange={(v) => update("slabHeightCm", v)} />
                <CeilingRangeInput icon="≡" label="天花板高" sub="完成面" value={input.ceilingHeightCm} unit="cm"
                  min={180} max={380} step={1} onChange={(v) => update("ceilingHeightCm", v)} />
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
        <section className="rounded-2xl bg-white ring-1 ring-stone-200 shadow-sm print:hidden">
          <div className="px-5 py-3 border-b border-stone-100 flex items-center gap-2">
            <h2 className="text-sm font-semibold text-zinc-900">⚙ 參數</h2>
            <span className="text-[11px] text-zinc-600">改任何值,圖與材料表即時重算</span>
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
              <CeilingRangeInput label="板長" value={input.boardLongCm} unit="cm"
                min={60} max={300} step={10} onChange={(v) => update("boardLongCm", v)} />
              <CeilingRangeInput label="板寬" value={input.boardShortCm} unit="cm"
                min={45} max={150} step={5} onChange={(v) => update("boardShortCm", v)} />
              <CeilingRangeInput label="接縫" value={input.jointGapMm} unit="mm"
                min={0} max={10} step={1} onChange={(v) => update("jointGapMm", v)} />
              <p className="text-[10px] text-zinc-600 leading-snug">業界 3-6 mm,9 mm 板取 3 mm</p>
            </ParamGroup>

            {/* 角材 + 間距 */}
            <ParamGroup icon="📏" title="角材 + 間距">
              <Check label="🔒 依板規自動算間距" checked={input.useAutoSpacing}
                onChange={(v) => update("useAutoSpacing", v)} />
              <CeilingRangeInput label="主支中心距" unit="cm"
                value={input.useAutoSpacing ? bom.input.mainSpacingCm : input.mainSpacingCm}
                min={30} max={120} step={0.1} disabled={input.useAutoSpacing}
                help={input.useAutoSpacing ? "已鎖定:依板規自動算。取消上方勾選即可手動拖拉" : undefined}
                onChange={(v) => update("mainSpacingCm", v)} />
              <CeilingRangeInput label="副支中心距" unit="cm"
                value={input.useAutoSpacing ? bom.input.subSpacingCm : input.subSpacingCm}
                min={20} max={60} step={0.1} disabled={input.useAutoSpacing}
                help={input.useAutoSpacing ? "已鎖定:依板規自動算。取消上方勾選即可手動拖拉" : undefined}
                onChange={(v) => update("subSpacingCm", v)} />
              <CeilingRangeInput label="角材寬" value={input.timberWidthCm} unit="cm"
                min={2} max={6} step={0.1} onChange={(v) => update("timberWidthCm", v)} />
              <CeilingRangeInput label="角材厚" value={input.timberThicknessCm} unit="cm"
                min={2} max={6} step={0.1} onChange={(v) => update("timberThicknessCm", v)} />
            </ParamGroup>

            {/* 吊筋 */}
            <ParamGroup icon="🪝" title="吊筋">
              <Toggle3 label="密度" value={input.hangerDensity}
                opts={[["standard", "業界標準"], ["minimal", "簡化"]]}
                onChange={(v) => update("hangerDensity", v as HangerDensity)} />
              <CeilingRangeInput label="中心距" value={input.hangerSpacingCm} unit="cm"
                min={45} max={150} step={5} disabled={input.hangerDensity === "minimal"}
                help={input.hangerDensity === "minimal" ? "簡化模式下不適用(每根主支只在兩端各一支)" : undefined}
                onChange={(v) => update("hangerSpacingCm", v)} />
            </ParamGroup>
          </div>
        </section>

        {/* ============ BOM ============ */}
        <section className="rounded-2xl bg-white ring-1 ring-stone-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-stone-100 flex items-center gap-2 flex-wrap">
            <h2 className="text-sm font-semibold text-zinc-900">📋 材料清單</h2>
            <span className="text-[11px] text-zinc-600">總計 {bom.items.length} 項 · 點任一行高亮對應視覺</span>
            {highlight && (
              <button onClick={() => { setHighlight(null); setSubLengthFilter(null); setBoardKindFilter(null); }}
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
                  const isSub = it.category === "sub-joist";
                  const isBoard = it.category === "board-full" || it.category === "board-cut";
                  const isSelected = isSub
                    ? highlight === "sub" && subLengthFilter === it.unitLengthCm
                    : isBoard
                    ? highlight === "board" && boardKindFilter === (it.category === "board-full" ? "full" : "cut")
                    : highlight !== null && rowHigh === highlight && !subLengthFilter && !boardKindFilter;
                  const anyHighlighted = highlight !== null;
                  const isOther = anyHighlighted && !isSelected;
                  return (
                    <tr key={i}
                      onClick={() => toggleHighlight(it.category, isSub ? it.unitLengthCm : null)}
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
          <div className="px-5 py-3">
            <button
              onClick={() =>
                router.push(`/ceiling/quote?d=${encodeURIComponent(encodeState(input))}`)
              }
              className="mt-3 w-full rounded bg-[#bd9955] py-2 text-sm font-semibold text-white hover:opacity-90 transition"
            >
              🧾 產生報價單
            </button>
          </div>
        </section>

        {/* ============ 施作提示 ============ */}
        <section className="rounded-2xl bg-gradient-to-br from-amber-50 via-white to-stone-50 ring-1 ring-amber-200/50 p-4 sm:p-5">
          <h3 className="text-sm font-semibold text-amber-900 mb-2 flex items-center gap-2">💡 施作提示</h3>
          <ul className="text-[12px] text-zinc-700 leading-relaxed space-y-1 list-none">
            <li><span className="text-amber-700 font-semibold">板邊接縫:</span> 預設 {input.jointGapMm} mm,環氧樹脂填縫 + 48 mm 接縫帶 + 批土收尾</li>
            <li><span className="text-amber-700 font-semibold">板邊對齊:</span> 中間板邊落主支中心(藍色 tick),周邊板邊落邊框外線</li>
            <li><span className="text-amber-700 font-semibold">螺絲:</span> 距板邊 ≥ 15 mm,沿板邊每 20-30 cm 一支</li>
            <li><span className="text-amber-700 font-semibold">材料餘量:</span> 建議多訂 <strong>5-10% 餘料</strong>(現場切割損耗、量錯、板材瑕疵備用)</li>
          </ul>
        </section>

        {/* ============ 燈具 / 開孔 ============ */}
        <section className="rounded-2xl bg-white ring-1 ring-stone-200 shadow-sm overflow-hidden print:hidden">
          <button onClick={() => setFixturesOpen(!fixturesOpen)}
            className="w-full px-5 py-3.5 border-b border-stone-100 flex items-center justify-between hover:bg-stone-50 transition">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm font-semibold text-zinc-900">🔦 燈具 / 開孔</h2>
              <span className="text-[11px] text-zinc-600">
                {fixtures.length} 個{collisions.length > 0 && (
                  <span className="ml-2 text-rose-700 font-semibold">⚠ {collisions.length} 處撞主/副支</span>
                )}
              </span>
            </div>
            <span className="text-zinc-400 text-xs">{fixturesOpen ? "▲" : "▼"}</span>
          </button>
          {fixturesOpen && (
            <div className="p-5 space-y-4">
              <div className="flex flex-wrap gap-2">
                {(["led", "vent", "speaker", "sprinkler", "other"] as FixtureKind[]).map((k) => (
                  <button key={k} onClick={() => addFixture(k)}
                    className="px-2.5 py-1 text-[11px] rounded-md bg-amber-50 ring-1 ring-amber-200 text-amber-900 hover:bg-amber-100 transition">
                    + {FIXTURE_KIND_LABEL[k]}
                  </button>
                ))}
              </div>
              {fixtures.length === 0 ? (
                <p className="text-[11px] text-zinc-500">點上方按鈕加開孔。位置 X(沿長邊)/ Z(沿短邊)從房間左上(0,0)起算 cm。</p>
              ) : (
                <div className="overflow-x-auto rounded-lg ring-1 ring-stone-200">
                  <table className="w-full text-xs">
                    <thead className="bg-stone-50/60 text-zinc-500 text-[10px] uppercase tracking-wider">
                      <tr>
                        <th className="text-left px-3 py-2">類別</th>
                        <th className="text-left px-3 py-2">名稱</th>
                        <th className="text-right px-3 py-2">X cm</th>
                        <th className="text-right px-3 py-2">Z cm</th>
                        <th className="text-right px-3 py-2">半徑 cm</th>
                        <th className="text-right px-3 py-2">狀態</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {fixtures.map((f) => {
                        const fCollisions = collisions.filter((c) => c.fixtureId === f.id);
                        const ok = fCollisions.length === 0;
                        return (
                          <tr key={f.id} className={ok ? "" : "bg-rose-50/40"}>
                            <td className="px-3 py-1.5 text-zinc-700">{FIXTURE_KIND_LABEL[f.kind]}</td>
                            <td className="px-3 py-1.5">
                              <input type="text" value={f.label} placeholder={FIXTURE_KIND_LABEL[f.kind]}
                                onChange={(e) => updateFixture(f.id, { label: e.target.value })}
                                className="w-24 px-2 py-1 border border-stone-300 rounded text-xs focus:outline-none focus:border-amber-500" />
                            </td>
                            <td className="px-3 py-1.5 text-right">
                              <input type="number" value={f.xCm} step={1}
                                onChange={(e) => updateFixture(f.id, { xCm: Number(e.target.value) })}
                                className="w-16 px-2 py-1 border border-stone-300 rounded text-xs tabular-nums focus:outline-none focus:border-amber-500" />
                            </td>
                            <td className="px-3 py-1.5 text-right">
                              <input type="number" value={f.zCm} step={1}
                                onChange={(e) => updateFixture(f.id, { zCm: Number(e.target.value) })}
                                className="w-16 px-2 py-1 border border-stone-300 rounded text-xs tabular-nums focus:outline-none focus:border-amber-500" />
                            </td>
                            <td className="px-3 py-1.5 text-right">
                              <input type="number" value={f.rCm} step={0.5}
                                onChange={(e) => updateFixture(f.id, { rCm: Number(e.target.value) })}
                                className="w-14 px-2 py-1 border border-stone-300 rounded text-xs tabular-nums focus:outline-none focus:border-amber-500" />
                            </td>
                            <td className="px-3 py-1.5 text-right text-[10px]">
                              {ok ? <span className="text-emerald-700">✓ OK</span>
                                : <span className="text-rose-700">⚠ 撞 {fCollisions.map(c => c.hitWith).join(", ")}</span>}
                            </td>
                            <td className="px-2 py-1.5">
                              <button onClick={() => removeFixture(f.id)}
                                className="text-rose-600 hover:text-rose-800 text-xs">✕</button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              {collisions.length > 0 && (
                <div className="rounded-lg bg-rose-50 ring-1 ring-rose-200 p-3 text-[11px] text-rose-800">
                  <strong>⚠ {collisions.length} 處碰撞 — 燈具會卡到主/副支。</strong>
                  解法:挪燈具位置 / 改尺寸 / 改主支對齊基準(讓主支位置避開燈具)。
                </div>
              )}
            </div>
          )}
        </section>

        {/* ============ 裁切計算器 ============ */}
        <section className="rounded-2xl bg-white ring-1 ring-stone-200 shadow-sm overflow-hidden print:hidden">
          <button onClick={() => setCutOpen(!cutOpen)}
            className="w-full px-5 py-3.5 border-b border-stone-100 flex items-center justify-between hover:bg-stone-50 transition">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-zinc-900">🪚 裁料計算(角材)</h2>
              <span className="text-[11px] text-zinc-600">
                共 {cuttingPlan.summary.stockCount} 支角材 · 利用率 {cuttingPlan.summary.utilizationPct}%
                · 剩料 {cuttingPlan.summary.totalRemainM} m
              </span>
            </div>
            <span className="text-zinc-400 text-xs">{cutOpen ? "▲" : "▼"}</span>
          </button>
          {cutOpen && (
            <div className="p-5 space-y-4">
              <div className="flex flex-wrap items-center gap-4 text-xs">
                <label className="flex items-center gap-2">
                  <span className="text-zinc-600">原料一支長</span>
                  <input type="number" value={stockLengthCm} step={10}
                    onChange={(e) => setStockLengthCm(Number(e.target.value))}
                    className="w-20 px-2 py-1 border border-stone-300 rounded tabular-nums focus:outline-none focus:border-amber-500" />
                  <span className="text-[10px] text-zinc-600">cm</span>
                  <span className="text-[10px] text-zinc-600">(360=12 尺、300=10 尺、600=20 尺)</span>
                </label>
                <label className="flex items-center gap-2">
                  <span className="text-zinc-600">鋸路</span>
                  <input type="number" value={sawKerfCm} step={0.1}
                    onChange={(e) => setSawKerfCm(Number(e.target.value))}
                    className="w-16 px-2 py-1 border border-stone-300 rounded tabular-nums focus:outline-none focus:border-amber-500" />
                  <span className="text-[10px] text-zinc-600">cm</span>
                  <span className="text-[10px] text-zinc-600">(鋸條切一刀的損耗)</span>
                </label>
                <label className="flex items-center gap-2">
                  <span className="text-zinc-600">接點搭接</span>
                  <input type="number" value={spliceOverlapCm} step={1}
                    onChange={(e) => setSpliceOverlapCm(Number(e.target.value))}
                    className="w-16 px-2 py-1 border border-stone-300 rounded tabular-nums focus:outline-none focus:border-amber-500" />
                  <span className="text-[10px] text-zinc-600">cm</span>
                  <span className="text-[10px] text-zinc-600">(超原料一支的長段自動切多段、接點疊長)</span>
                </label>
              </div>
              {/* 拼接段資訊(自動切多段後顯示) */}
              {(() => {
                const splicedPieces = cuttingPlan.inputPieces.filter((p) => p.label.includes("(拼"));
                if (splicedPieces.length === 0) return null;
                // 抓出每組拼接(同 base label)
                const groups = new Map<string, typeof splicedPieces>();
                for (const p of splicedPieces) {
                  const base = p.label.replace(/\s*\(拼\d+\/\d+\)/, "");
                  if (!groups.has(base)) groups.set(base, []);
                  groups.get(base)!.push(p);
                }
                return (
                  <div className="rounded-lg bg-amber-50 ring-1 ring-amber-200 p-3 sm:p-4">
                    <h3 className="text-xs font-semibold text-amber-900 mb-2 flex items-center gap-1.5">
                      🔗 太長要分段接({groups.size} 件 → {splicedPieces.length} 段,每接點搭接 {spliceOverlapCm} cm)
                    </h3>
                    <ul className="text-[11px] text-amber-800 space-y-1 leading-relaxed">
                      {[...groups.entries()].map(([base, segs]) => (
                        <li key={base} className="flex items-center gap-2 flex-wrap">
                          <span>{base}</span>
                          <span className="text-amber-600">→</span>
                          {segs.map((s, i) => (
                            <span key={i} className={`px-1.5 py-0.5 rounded text-[10px] ring-1 font-mono ${pieceTone(s.category)}`}>
                              {r1(s.lengthCm)}
                            </span>
                          ))}
                          <span className="text-amber-600 font-mono">合 {r1(segs.reduce((s, p) => s + p.lengthCm, 0))} cm</span>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-2 text-[10px] text-amber-700 leading-relaxed">
                      實務:接點放在邊框上強固(或鎖鐵片補強)。
                    </p>
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
                              {oversize && <span className="text-[10px] text-rose-700">要分段接</span>}
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
                <span>訂料 <strong className="text-zinc-900 text-base font-bold">{cuttingPlan.summary.stockCount}</strong> 支 {stockLengthCm} cm 角材</span>
                <span>總長 <strong className="text-zinc-700">{cuttingPlan.summary.totalStockLengthM} m</strong></span>
                <span>實用 <strong className="text-zinc-700">{cuttingPlan.summary.totalUsedM} m</strong></span>
                <span>剩料 <strong className="text-rose-700">{cuttingPlan.summary.totalRemainM} m</strong></span>
                <span>利用率 <strong className="text-amber-700">{cuttingPlan.summary.utilizationPct}%</strong></span>
              </div>
            </div>
          )}
        </section>

        {/* ============ 5 步施工步驟(spec 階段 4 硬編,collapse) ============ */}
        <section className="rounded-2xl bg-white ring-1 ring-stone-200 shadow-sm overflow-hidden">
          <button onClick={() => setStepsOpen(!stepsOpen)}
            className="w-full px-5 py-3.5 border-b border-stone-100 flex items-center justify-between hover:bg-stone-50 transition">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-zinc-900">📐 施工步驟</h2>
              <span className="text-[11px] text-zinc-600">5 步流程</span>
            </div>
            <span className="text-zinc-400 text-xs">{stepsOpen ? "▲" : "▼"}</span>
          </button>
          {stepsOpen && (
            <ol className="divide-y divide-stone-100 text-sm">
              {[
                { n: 1, title: "牆面指定高度做邊框", desc: "靠牆邊緣為基準,角材往室內生成" },
                { n: 2, title: "主支跨短邊平接", desc: "主支中心距等於矽酸鈣板寬度" },
                { n: 3, title: "副支置入主支間", desc: "副支中心距一尺二,全部對齊" },
                { n: 4, title: "確認框架水平", desc: "以天花板作完成面基準,固定吊筋" },
                { n: 5, title: "封矽酸鈣板", desc: "中間板邊落在主支中心,周邊板邊落在邊框外線" },
              ].map((step) => (
                <li key={step.n} className="px-5 py-3 flex items-start gap-3 hover:bg-amber-50/30 transition">
                  <div className="w-7 h-7 shrink-0 rounded-full bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-white text-xs font-bold shadow-sm shadow-amber-500/30">
                    {step.n}
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-zinc-900">{step.title}</div>
                    <div className="text-xs text-zinc-600 mt-0.5">{step.desc}</div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>

        {/* ============ 客戶資料(列印 PDF 帶入頂部) — 放最下方,平常很少編 ============ */}
        <section className="rounded-2xl bg-white ring-1 ring-stone-200 shadow-sm overflow-hidden print:hidden">
          <button onClick={() => setCustomerOpen(!customerOpen)}
            className="w-full px-5 py-3 border-b border-stone-100 flex items-center justify-between hover:bg-stone-50 transition">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-zinc-900">📇 客戶資料</h2>
              <span className="text-[11px] text-zinc-600">
                {customer.name ? customer.name : "未填(列印不顯示)"}
              </span>
            </div>
            <span className="text-zinc-400 text-xs">{customerOpen ? "▲" : "▼"}</span>
          </button>
          {customerOpen && (
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <label className="block">
                <span className="text-zinc-600 block mb-1">客戶姓名</span>
                <input type="text" value={customer.name}
                  onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
                  placeholder="王先生 / 林設計師"
                  className="w-full px-2.5 py-1.5 text-sm border border-stone-300 rounded-md focus:outline-none focus:border-amber-500" />
              </label>
              <label className="block">
                <span className="text-zinc-600 block mb-1">聯絡電話</span>
                <input type="text" value={customer.phone}
                  onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
                  placeholder="09xx-xxx-xxx"
                  className="w-full px-2.5 py-1.5 text-sm border border-stone-300 rounded-md focus:outline-none focus:border-amber-500" />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-zinc-600 block mb-1">案場地址</span>
                <input type="text" value={customer.address}
                  onChange={(e) => setCustomer({ ...customer, address: e.target.value })}
                  placeholder="台北市信義區 ___ 路 ___ 號"
                  className="w-full px-2.5 py-1.5 text-sm border border-stone-300 rounded-md focus:outline-none focus:border-amber-500" />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-zinc-600 block mb-1">備註</span>
                <textarea value={customer.notes}
                  onChange={(e) => setCustomer({ ...customer, notes: e.target.value })}
                  rows={2}
                  placeholder="施作期 / 特別需求 / 收費對象..."
                  className="w-full px-2.5 py-1.5 text-sm border border-stone-300 rounded-md focus:outline-none focus:border-amber-500 resize-none" />
              </label>
              <p className="sm:col-span-2 text-[10px] text-zinc-500">
                客戶資料只用於 PDF 列印 + 短碼分享(讓師傅/客戶確認案場)。
                LOGO/公司資訊請去 <a href="/settings" className="text-amber-700 hover:underline">設定頁</a> 自訂。
              </p>
            </div>
          )}
        </section>

        {/* ============ 公式 trace(admin) ============ */}
        <section className="print:hidden">
          <button onClick={() => setTraceOpen(!traceOpen)}
            className="w-full text-left px-5 py-3 rounded-2xl bg-white ring-1 ring-stone-200 hover:bg-stone-50 flex items-center justify-between text-sm transition">
            <span className="font-medium text-zinc-700 flex items-center gap-2">
              🔬 公式對照 trace <span className="text-[10px] text-zinc-600 font-normal">admin debug</span>
            </span>
            <span className="text-zinc-400 text-xs">{traceOpen ? "▲" : "▼"}</span>
          </button>
          {traceOpen && <TracePanel bom={bom} />}
        </section>
          </div>
        </div>

        {/* 列印用簽收欄(平常隱藏) */}
        <div className="hidden print:block mt-6 pt-4 border-t border-stone-300">
          <div className="grid grid-cols-3 gap-4 text-[11px] text-zinc-700">
            <div>
              <p className="mb-8">師傅 / 木工:</p>
              <div className="border-t border-zinc-400 pt-1 text-center text-[10px] text-zinc-500">簽名</div>
            </div>
            <div>
              <p className="mb-8">客戶 / 業主:</p>
              <div className="border-t border-zinc-400 pt-1 text-center text-[10px] text-zinc-500">簽名</div>
            </div>
            <div>
              <p className="mb-8">日期:______ / ____ / ____</p>
              <div className="border-t border-zinc-400 pt-1 text-center text-[10px] text-zinc-500">確認</div>
            </div>
          </div>
        </div>

        {/* ============ 免責 / 使用提醒(頁尾) ============ */}
        <footer className="mt-8 mb-2 rounded-2xl bg-stone-100/60 border border-stone-200/80 p-4 sm:p-5 text-[11px] text-zinc-500 leading-relaxed">
          <p className="font-semibold text-zinc-700 mb-1.5">⚠ 使用提醒</p>
          <ul className="space-y-1 list-disc list-inside marker:text-zinc-400">
            <li>本工具計算結果為 <strong>估算值</strong>,實際施工請依現場狀況(樓板高低、樑柱位置、管線走向)調整。</li>
            <li>材料用量建議 <strong>多備 5-10% 餘量</strong>,涵蓋現場切割損耗、量錯、板材瑕疵備用。</li>
            <li>結構承重、防火、防水、隔音等專業評估,請洽合格 <strong>結構技師 / 室內裝修專業技術人員</strong>。</li>
            <li>使用本工具產生之施工結果造成之損失,本工具與木匠學院 <strong>概不負責</strong>。</li>
          </ul>
        </footer>
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// 小元件
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

function ParamGroup({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold flex items-center gap-1.5">
        <span>{icon}</span>{title}
      </h3>
      <div className="space-y-3">{children}</div>
    </div>
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
