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
import { useRouter } from "@/i18n/navigation";
import { useTranslations, useLocale } from "next-intl";
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
  const t = useTranslations("ceilingTool");
  const locale = useLocale();
  const fixtureKindLabel = (k: FixtureKind) => t(`fixtureKind.${k}`);
  const [input, setInput] = useState<CeilingInput>(DEFAULT_CEILING_INPUT);
  const bom = useMemo(() => computeCeilingBom(input, locale), [input, locale]);

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
      alert(t("shareError"));
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
    a.download = t("csvFilename", {
      long: input.longSideCm,
      short: input.shortSideCm,
    });
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
              <h1 className="text-sm font-semibold text-zinc-900 leading-tight">{t("header.h1")}</h1>
              <p className="text-[10px] text-zinc-500 leading-tight flex items-center gap-1.5">
                <span className="text-[9px] text-rose-700 bg-rose-50 ring-1 ring-rose-200 px-1.5 py-px rounded-full">{t("header.adminBadge")}</span>
                {t("header.subtitle")}
              </p>
            </div>
          </div>
          <div className="inline-flex gap-0.5 p-0.5 bg-stone-100 rounded-lg text-[11px] font-medium ring-1 ring-stone-200">
            <button onClick={() => setViewKind("2d")}
              className={`px-3 py-1.5 rounded-md transition ${viewKind === "2d" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-800"}`}>
              {t("header.view2d")}
            </button>
            <button onClick={() => setViewKind("3d")}
              className={`px-3 py-1.5 rounded-md transition ${viewKind === "3d" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-800"}`}>
              {t("header.view3d")}
            </button>
          </div>
          <button onClick={shareCase} disabled={shareStatus === "loading"}
            className="px-3 py-1.5 text-[12px] font-medium rounded-lg bg-white border border-stone-200 hover:bg-stone-50 hover:border-stone-300 transition text-zinc-700 disabled:opacity-50">
            {shareStatus === "loading" ? t("header.shareLoading") : shareStatus === "copied" ? t("header.shareCopied") : t("header.shareIdle")}
          </button>
          <button onClick={downloadCsv}
            className="px-3 py-1.5 text-[12px] font-medium rounded-lg bg-white border border-stone-200 hover:bg-stone-50 hover:border-stone-300 transition text-zinc-700">
            {t("header.csv")}
          </button>
          <button onClick={() => { setViewKind("2d"); setTimeout(() => window.print(), 200); }}
            className="px-3 py-1.5 text-[12px] font-medium rounded-lg bg-gradient-to-b from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white shadow-sm shadow-amber-500/30 transition">
            {t("header.print")}
          </button>
        </div>
      </header>

      {/* 列印時頂部顯示的標題列 + 客戶 TO(平常隱藏) */}
      <div className="hidden print:block px-5 pt-4 pb-2 border-b border-stone-300">
        <div className="flex items-start justify-between gap-6">
          <BrandedHeader />
          <div className="text-right text-[11px] text-zinc-700">
            <p className="font-bold text-sm text-zinc-900">{t("printHeader.title")}</p>
            <p className="mt-0.5">{t("printHeader.dateLabel")}{new Date().toLocaleDateString()}</p>
            {shareCode && <p className="text-zinc-500 font-mono">{t("printHeader.caseLabel")}{shareCode}</p>}
          </div>
        </div>
        {(customer.name || customer.address || customer.phone) && (
          <div className="mt-3 pt-2 border-t border-stone-200 grid grid-cols-2 gap-2 text-[11px]">
            <div>
              <span className="text-zinc-500">{t("printHeader.clientLabel")}</span>
              <span className="ml-1 font-semibold">{customer.name || t("printHeader.missingValue")}</span>
              {customer.phone && <span className="ml-3 text-zinc-700">{customer.phone}</span>}
            </div>
            <div className="text-right">
              <span className="text-zinc-500">{t("printHeader.siteLabel")}</span>
              <span className="ml-1 text-zinc-700">{customer.address || t("printHeader.missingValue")}</span>
            </div>
            {customer.notes && (
              <div className="col-span-2 text-zinc-600">{t("printHeader.notesLabel")}{customer.notes}</div>
            )}
          </div>
        )}
        <p className="text-[10px] text-zinc-500 mt-2">
          {t("printHeader.dimensionSummary", {
            long: input.longSideCm,
            short: input.shortSideCm,
            slab: input.slabHeightCm,
            ceiling: input.ceilingHeightCm,
            ping: r2(bom.auto.pingShu),
          })}
        </p>
      </div>

      <main className="max-w-7xl mx-auto px-5 py-6">
        <div className="flex flex-col lg:grid lg:grid-cols-[1fr_minmax(0,520px)] lg:gap-6 items-start">
          {/* ====== 視覺(mobile order-1 在最上、desktop order-2 在右、sticky)====== */}
          <aside className="w-full order-1 lg:order-2 sticky top-[108px] lg:top-[80px] z-20 lg:z-auto self-start mb-5 lg:mb-0 print:static print:mb-3 print-keep">
            <section className="rounded-2xl bg-white ring-1 ring-stone-200 shadow-sm overflow-hidden">
          {viewKind === "3d" && (
            <div className="px-4 py-2.5 border-b border-stone-100 bg-gradient-to-r from-stone-50/50 to-transparent flex flex-wrap items-center gap-3 text-[11px]">
              <div className="inline-flex gap-0.5 p-0.5 bg-white rounded-md ring-1 ring-stone-200">
                <button onClick={() => setView3D("iso")}
                  className={`px-2 py-1 rounded font-medium ${view3D === "iso" ? "bg-amber-100 text-amber-900" : "text-zinc-600 hover:text-zinc-900"}`}>{t("view3dToolbar.iso")}</button>
                <button onClick={() => setView3D("top")}
                  className={`px-2 py-1 rounded font-medium ${view3D === "top" ? "bg-amber-100 text-amber-900" : "text-zinc-600 hover:text-zinc-900"}`}>{t("view3dToolbar.top")}</button>
              </div>
              <label className="flex items-center gap-2 text-zinc-600">
                {t("view3dToolbar.explode")}
                <input type="range" min={0} max={1} step={0.01} value={explode}
                  onChange={(e) => setExplode(Number(e.target.value))} className="w-28 accent-amber-600" />
                <span className="tabular-nums w-10 text-zinc-500 font-mono">{(explode * 100).toFixed(0)}%</span>
              </label>
              <div className="flex items-center gap-1 text-zinc-600">
                <span>{t("view3dToolbar.layersLabel")}</span>
                {[
                  { k: "room" as const, label: t("view3dToolbar.layerRoom") },
                  { k: "frame" as const, label: t("view3dToolbar.layerFrame") },
                  { k: "main" as const, label: t("view3dToolbar.layerMain") },
                  { k: "sub" as const, label: t("view3dToolbar.layerSub") },
                  { k: "boards" as const, label: t("view3dToolbar.layerBoards") },
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
                boardKindFilter={boardKindFilter} fixtures={fixtures} collisions={collisions} locale={locale} />
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
                <h2 className="text-sm font-semibold text-zinc-900">{t("roomSize.h2")}</h2>
                <span className="text-[11px] text-zinc-600">{t("roomSize.hint")}</span>
              </div>
              <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                <CeilingRangeInput icon="↔" label={t("roomSize.longSide")} value={input.longSideCm} unit="cm"
                  min={100} max={1500} step={5} onChange={(v) => update("longSideCm", v)} />
                <CeilingRangeInput icon="↕" label={t("roomSize.shortSide")} value={input.shortSideCm} unit="cm"
                  min={100} max={1200} step={5} onChange={(v) => update("shortSideCm", v)} />
                <CeilingRangeInput icon="↥" label={t("roomSize.slabHeight")} sub={t("roomSize.slabHeightSub")} value={input.slabHeightCm} unit="cm"
                  min={200} max={400} step={1} onChange={(v) => update("slabHeightCm", v)} />
                <CeilingRangeInput icon="≡" label={t("roomSize.ceilingHeight")} sub={t("roomSize.ceilingHeightSub")} value={input.ceilingHeightCm} unit="cm"
                  min={180} max={380} step={1} onChange={(v) => update("ceilingHeightCm", v)} />
              </div>
            </section>

        {/* ============ 6 重點數字 ============ */}
        <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          <Stat icon="◬" tone="amber" label={t("stats.ping")} value={r2(bom.auto.pingShu)} unit={t("stats.pingUnit")}
            hint={`${r2(bom.auto.roomAreaM2)} m²`} />
          <Stat icon="▭" tone="stone" label={t("stats.frame")} value={r1(bom.items[0].totalLengthM ?? 0)} unit={t("stats.frameUnit")}
            hint={t("stats.framePerimHint", { perim: input.longSideCm + input.shortSideCm })} />
          <Stat icon="┃" tone="amber" label={t("stats.mainJoist")} value={bom.trace.mainJoistTimberCount} unit={t("stats.joistUnit")}
            hint={t("stats.mainJoistHint", { len: r1(bom.trace.mainJoistLengthCm) })} />
          <Stat icon="━" tone="stone" label={t("stats.subJoist")} value={totalSub} unit={t("stats.joistUnit")}
            hint={subRows.length >= 2
              ? t("stats.subJoistHintTwo", { a: subRows[0].unitLengthCm ?? "—", b: subRows[1].unitLengthCm ?? "—" })
              : t("stats.subJoistHintOne", { a: subRows[0]?.unitLengthCm ?? "—" })} />
          <Stat icon="|" tone="stone" label={t("stats.hanger")} value={hanger?.count ?? 0} unit={t("stats.joistUnit")}
            hint={t("stats.hangerHint", { len: r1(bom.auto.hangerHeightCm) })} />
          <Stat icon="▦" tone="amber" label={t("stats.boards")} value={totalBoards} unit={t("stats.boardsUnit")}
            hint={t("stats.boardsHint", { full: boardFull?.count ?? 0, cut: boardCut?.count ?? 0 })} />
        </section>

        {/* ============ 參數卡(全部可調) ============ */}
        <section className="rounded-2xl bg-white ring-1 ring-stone-200 shadow-sm print:hidden">
          <div className="px-5 py-3 border-b border-stone-100 flex items-center gap-2">
            <h2 className="text-sm font-semibold text-zinc-900">{t("params.h2")}</h2>
            <span className="text-[11px] text-zinc-600">{t("params.subtitle")}</span>
          </div>
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* 排版 */}
            <ParamGroup icon="⇆" title={t("params.alignmentTitle")}>
              <Toggle3 label={t("params.alignMainLabel")} value={input.alignmentBase}
                opts={[
                  ["left", t("params.alignLeft")],
                  ["center", t("params.alignCenter")],
                  ["right", t("params.alignRight")],
                ]}
                onChange={(v) => update("alignmentBase", v as AlignmentBase)} />
              <Toggle3 label={t("params.alignSubLabel")} value={input.subAlignmentBase}
                opts={[
                  ["top", t("params.alignTop")],
                  ["middle", t("params.alignMiddle")],
                  ["bottom", t("params.alignBottom")],
                ]}
                onChange={(v) => update("subAlignmentBase", v as SubAlignmentBase)} />
              <Check label={t("params.frameDoublesAsSupport")} checked={input.frameDoublesAsSupport}
                onChange={(v) => update("frameDoublesAsSupport", v)} />
            </ParamGroup>

            {/* 矽酸鈣板 */}
            <ParamGroup icon="🪵" title={t("params.boardTitle")}>
              <CeilingRangeInput label={t("params.boardLong")} value={input.boardLongCm} unit="cm"
                min={60} max={300} step={10} onChange={(v) => update("boardLongCm", v)} />
              <CeilingRangeInput label={t("params.boardShort")} value={input.boardShortCm} unit="cm"
                min={45} max={150} step={5} onChange={(v) => update("boardShortCm", v)} />
              <CeilingRangeInput label={t("params.jointGap")} value={input.jointGapMm} unit="mm"
                min={0} max={10} step={1} onChange={(v) => update("jointGapMm", v)} />
              <p className="text-[10px] text-zinc-600 leading-snug">{t("params.jointGapHint")}</p>
            </ParamGroup>

            {/* 角材 + 間距 */}
            <ParamGroup icon="📏" title={t("params.timberTitle")}>
              <Check label={t("params.autoSpacing")} checked={input.useAutoSpacing}
                onChange={(v) => update("useAutoSpacing", v)} />
              <CeilingRangeInput label={t("params.mainSpacing")} unit="cm"
                value={input.useAutoSpacing ? bom.input.mainSpacingCm : input.mainSpacingCm}
                min={30} max={120} step={0.1} disabled={input.useAutoSpacing}
                help={input.useAutoSpacing ? t("params.autoSpacingLockHelp") : undefined}
                onChange={(v) => update("mainSpacingCm", v)} />
              <CeilingRangeInput label={t("params.subSpacing")} unit="cm"
                value={input.useAutoSpacing ? bom.input.subSpacingCm : input.subSpacingCm}
                min={20} max={60} step={0.1} disabled={input.useAutoSpacing}
                help={input.useAutoSpacing ? t("params.autoSpacingLockHelp") : undefined}
                onChange={(v) => update("subSpacingCm", v)} />
              <CeilingRangeInput label={t("params.timberWidth")} value={input.timberWidthCm} unit="cm"
                min={2} max={6} step={0.1} onChange={(v) => update("timberWidthCm", v)} />
              <CeilingRangeInput label={t("params.timberThickness")} value={input.timberThicknessCm} unit="cm"
                min={2} max={6} step={0.1} onChange={(v) => update("timberThicknessCm", v)} />
            </ParamGroup>

            {/* 吊筋 */}
            <ParamGroup icon="🪝" title={t("params.hangerTitle")}>
              <Toggle3 label={t("params.hangerDensity")} value={input.hangerDensity}
                opts={[
                  ["standard", t("params.hangerStandard")],
                  ["minimal", t("params.hangerMinimal")],
                ]}
                onChange={(v) => update("hangerDensity", v as HangerDensity)} />
              <CeilingRangeInput label={t("params.hangerSpacing")} value={input.hangerSpacingCm} unit="cm"
                min={45} max={150} step={5} disabled={input.hangerDensity === "minimal"}
                help={input.hangerDensity === "minimal" ? t("params.hangerMinimalHelp") : undefined}
                onChange={(v) => update("hangerSpacingCm", v)} />
            </ParamGroup>
          </div>
        </section>

        {/* ============ BOM ============ */}
        <section className="rounded-2xl bg-white ring-1 ring-stone-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-stone-100 flex items-center gap-2 flex-wrap">
            <h2 className="text-sm font-semibold text-zinc-900">{t("bom.h2")}</h2>
            <span className="text-[11px] text-zinc-600">{t("bom.subtitle", { count: bom.items.length })}</span>
            {highlight && (
              <button onClick={() => { setHighlight(null); setSubLengthFilter(null); setBoardKindFilter(null); }}
                className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 ring-1 ring-amber-300 hover:bg-amber-200 transition">
                {t("bom.clearHighlight")}
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-stone-50/60 text-zinc-500 text-[10px] uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-2.5 font-semibold">{t("bom.thCategory")}</th>
                  <th className="text-left px-4 py-2.5 font-semibold">{t("bom.thName")}</th>
                  <th className="text-left px-4 py-2.5 font-semibold">{t("bom.thSpec")}</th>
                  <th className="text-right px-4 py-2.5 font-semibold">{t("bom.thUnitLen")}</th>
                  <th className="text-right px-4 py-2.5 font-semibold">{t("bom.thTotalLen")}</th>
                  <th className="text-right px-4 py-2.5 font-semibold">{t("bom.thCount")}</th>
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
                      <td className="px-4 py-2.5"><CategoryBadge category={it.category} t={t} /></td>
                      <td className="px-4 py-2.5 text-zinc-900 font-medium">{locale === "en" && it.nameEn ? it.nameEn : it.nameZh}</td>
                      <td className="px-4 py-2.5 text-zinc-600 text-xs">{it.spec}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-zinc-700">{it.unitLengthCm != null ? `${it.unitLengthCm} cm` : t("bom.dash")}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-zinc-700">{it.totalLengthM != null ? `${it.totalLengthM} m` : t("bom.dash")}</td>
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
          <h3 className="text-sm font-semibold text-amber-900 mb-2 flex items-center gap-2">{t("tips.h3")}</h3>
          <ul className="text-[12px] text-zinc-700 leading-relaxed space-y-1 list-none">
            <li><span className="text-amber-700 font-semibold">{t("tips.jointLabel")}</span> {t("tips.jointDesc", { gap: input.jointGapMm })}</li>
            <li><span className="text-amber-700 font-semibold">{t("tips.alignLabel")}</span> {t("tips.alignDesc")}</li>
            <li><span className="text-amber-700 font-semibold">{t("tips.screwLabel")}</span> {t("tips.screwDesc")}</li>
            <li><span className="text-amber-700 font-semibold">{t("tips.wasteLabel")}</span> {t("tips.wasteDescPrefix")}<strong>{t("tips.wasteDescBold")}</strong>{t("tips.wasteDescSuffix")}</li>
          </ul>
        </section>

        {/* ============ 燈具 / 開孔 ============ */}
        <section className="rounded-2xl bg-white ring-1 ring-stone-200 shadow-sm overflow-hidden print:hidden">
          <button onClick={() => setFixturesOpen(!fixturesOpen)}
            className="w-full px-5 py-3.5 border-b border-stone-100 flex items-center justify-between hover:bg-stone-50 transition">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm font-semibold text-zinc-900">{t("fixtures.h2")}</h2>
              <span className="text-[11px] text-zinc-600">
                {t("fixtures.countSummary", { count: fixtures.length })}{collisions.length > 0 && (
                  <span className="ml-2 text-rose-700 font-semibold">{t("fixtures.collisionSummary", { count: collisions.length })}</span>
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
                    + {fixtureKindLabel(k)}
                  </button>
                ))}
              </div>
              {fixtures.length === 0 ? (
                <p className="text-[11px] text-zinc-500">{t("fixtures.emptyHint")}</p>
              ) : (
                <div className="overflow-x-auto rounded-lg ring-1 ring-stone-200">
                  <table className="w-full text-xs">
                    <thead className="bg-stone-50/60 text-zinc-500 text-[10px] uppercase tracking-wider">
                      <tr>
                        <th className="text-left px-3 py-2">{t("fixtures.thCategory")}</th>
                        <th className="text-left px-3 py-2">{t("fixtures.thName")}</th>
                        <th className="text-right px-3 py-2">{t("fixtures.thX")}</th>
                        <th className="text-right px-3 py-2">{t("fixtures.thZ")}</th>
                        <th className="text-right px-3 py-2">{t("fixtures.thR")}</th>
                        <th className="text-right px-3 py-2">{t("fixtures.thStatus")}</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {fixtures.map((f) => {
                        const fCollisions = collisions.filter((c) => c.fixtureId === f.id);
                        const ok = fCollisions.length === 0;
                        return (
                          <tr key={f.id} className={ok ? "" : "bg-rose-50/40"}>
                            <td className="px-3 py-1.5 text-zinc-700">{fixtureKindLabel(f.kind)}</td>
                            <td className="px-3 py-1.5">
                              <input type="text" value={f.label} placeholder={fixtureKindLabel(f.kind)}
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
                              {ok ? <span className="text-emerald-700">{t("fixtures.statusOk")}</span>
                                : <span className="text-rose-700">{t("fixtures.statusHit", { parts: fCollisions.map(c => c.hitWith).join(", ") })}</span>}
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
                  <strong>{t("fixtures.collisionTitle", { count: collisions.length })}</strong>
                  {t("fixtures.collisionFix")}
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
              <h2 className="text-sm font-semibold text-zinc-900">{t("cutting.h2")}</h2>
              <span className="text-[11px] text-zinc-600">
                {t("cutting.summary", {
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
                  <span className="text-zinc-600">{t("cutting.stockLengthLabel")}</span>
                  <input type="number" value={stockLengthCm} step={10}
                    onChange={(e) => setStockLengthCm(Number(e.target.value))}
                    className="w-20 px-2 py-1 border border-stone-300 rounded tabular-nums focus:outline-none focus:border-amber-500" />
                  <span className="text-[10px] text-zinc-600">cm</span>
                  <span className="text-[10px] text-zinc-600">{t("cutting.stockLengthHint")}</span>
                </label>
                <label className="flex items-center gap-2">
                  <span className="text-zinc-600">{t("cutting.sawKerfLabel")}</span>
                  <input type="number" value={sawKerfCm} step={0.1}
                    onChange={(e) => setSawKerfCm(Number(e.target.value))}
                    className="w-16 px-2 py-1 border border-stone-300 rounded tabular-nums focus:outline-none focus:border-amber-500" />
                  <span className="text-[10px] text-zinc-600">cm</span>
                  <span className="text-[10px] text-zinc-600">{t("cutting.sawKerfHint")}</span>
                </label>
                <label className="flex items-center gap-2">
                  <span className="text-zinc-600">{t("cutting.spliceLabel")}</span>
                  <input type="number" value={spliceOverlapCm} step={1}
                    onChange={(e) => setSpliceOverlapCm(Number(e.target.value))}
                    className="w-16 px-2 py-1 border border-stone-300 rounded tabular-nums focus:outline-none focus:border-amber-500" />
                  <span className="text-[10px] text-zinc-600">cm</span>
                  <span className="text-[10px] text-zinc-600">{t("cutting.spliceHint")}</span>
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
                      {t("cutting.splicedTitle", {
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
                            <span key={i} className={`px-1.5 py-0.5 rounded text-[10px] ring-1 font-mono ${pieceTone(s.category)}`}>
                              {r1(s.lengthCm)}
                            </span>
                          ))}
                          <span className="text-amber-600 font-mono">{t("cutting.splicedSum", { len: r1(segs.reduce((s, p) => s + p.lengthCm, 0)) })}</span>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-2 text-[10px] text-amber-700 leading-relaxed">
                      {t("cutting.splicedFooter")}
                    </p>
                  </div>
                );
              })()}

              <div className="overflow-x-auto rounded-lg ring-1 ring-stone-200">
                <table className="w-full text-xs">
                  <thead className="bg-stone-50/60 text-zinc-500 text-[10px] uppercase tracking-wider">
                    <tr>
                      <th className="text-left px-3 py-2 font-semibold">{t("cutting.thStock")}</th>
                      <th className="text-left px-3 py-2 font-semibold">{t("cutting.thCut")}</th>
                      <th className="text-right px-3 py-2 font-semibold">{t("cutting.thUsed")}</th>
                      <th className="text-right px-3 py-2 font-semibold">{t("cutting.thKerf")}</th>
                      <th className="text-right px-3 py-2 font-semibold">{t("cutting.thRemain")}</th>
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
                              {oversize && <span className="text-[10px] text-rose-700">{t("cutting.oversize")}</span>}
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
                <span>{t("cutting.footStockCount")} <strong className="text-zinc-900 text-base font-bold">{cuttingPlan.summary.stockCount}</strong> {t("cutting.footStockSuffix", { len: stockLengthCm })}</span>
                <span>{t("cutting.footTotalLen")} <strong className="text-zinc-700">{t("cutting.footMeter", { n: cuttingPlan.summary.totalStockLengthM })}</strong></span>
                <span>{t("cutting.footUsed")} <strong className="text-zinc-700">{t("cutting.footMeter", { n: cuttingPlan.summary.totalUsedM })}</strong></span>
                <span>{t("cutting.footRemain")} <strong className="text-rose-700">{t("cutting.footMeter", { n: cuttingPlan.summary.totalRemainM })}</strong></span>
                <span>{t("cutting.footUtilization")} <strong className="text-amber-700">{t("cutting.footPercent", { n: cuttingPlan.summary.utilizationPct })}</strong></span>
              </div>
            </div>
          )}
        </section>

        {/* ============ 5 步施工步驟(spec 階段 4 硬編,collapse) ============ */}
        <section className="rounded-2xl bg-white ring-1 ring-stone-200 shadow-sm overflow-hidden">
          <button onClick={() => setStepsOpen(!stepsOpen)}
            className="w-full px-5 py-3.5 border-b border-stone-100 flex items-center justify-between hover:bg-stone-50 transition">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-zinc-900">{t("steps.h2")}</h2>
              <span className="text-[11px] text-zinc-600">{t("steps.subtitle")}</span>
            </div>
            <span className="text-zinc-400 text-xs">{stepsOpen ? "▲" : "▼"}</span>
          </button>
          {stepsOpen && (
            <ol className="divide-y divide-stone-100 text-sm">
              {[
                { n: 1, title: t("steps.step1Title"), desc: t("steps.step1Desc") },
                { n: 2, title: t("steps.step2Title"), desc: t("steps.step2Desc") },
                { n: 3, title: t("steps.step3Title"), desc: t("steps.step3Desc") },
                { n: 4, title: t("steps.step4Title"), desc: t("steps.step4Desc") },
                { n: 5, title: t("steps.step5Title"), desc: t("steps.step5Desc") },
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
              <h2 className="text-sm font-semibold text-zinc-900">{t("customer.h2")}</h2>
              <span className="text-[11px] text-zinc-600">
                {customer.name ? customer.name : t("customer.emptyHint")}
              </span>
            </div>
            <span className="text-zinc-400 text-xs">{customerOpen ? "▲" : "▼"}</span>
          </button>
          {customerOpen && (
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <label className="block">
                <span className="text-zinc-600 block mb-1">{t("customer.nameLabel")}</span>
                <input type="text" value={customer.name}
                  onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
                  placeholder={t("customer.namePlaceholder")}
                  className="w-full px-2.5 py-1.5 text-sm border border-stone-300 rounded-md focus:outline-none focus:border-amber-500" />
              </label>
              <label className="block">
                <span className="text-zinc-600 block mb-1">{t("customer.phoneLabel")}</span>
                <input type="text" value={customer.phone}
                  onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
                  placeholder={t("customer.phonePlaceholder")}
                  className="w-full px-2.5 py-1.5 text-sm border border-stone-300 rounded-md focus:outline-none focus:border-amber-500" />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-zinc-600 block mb-1">{t("customer.addressLabel")}</span>
                <input type="text" value={customer.address}
                  onChange={(e) => setCustomer({ ...customer, address: e.target.value })}
                  placeholder={t("customer.addressPlaceholder")}
                  className="w-full px-2.5 py-1.5 text-sm border border-stone-300 rounded-md focus:outline-none focus:border-amber-500" />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-zinc-600 block mb-1">{t("customer.notesLabel")}</span>
                <textarea value={customer.notes}
                  onChange={(e) => setCustomer({ ...customer, notes: e.target.value })}
                  rows={2}
                  placeholder={t("customer.notesPlaceholder")}
                  className="w-full px-2.5 py-1.5 text-sm border border-stone-300 rounded-md focus:outline-none focus:border-amber-500 resize-none" />
              </label>
              <p className="sm:col-span-2 text-[10px] text-zinc-500">
                {t("customer.footnotePart1")}<a href="/settings" className="text-amber-700 hover:underline">{t("customer.footnoteLink")}</a>{t("customer.footnotePart2")}
              </p>
            </div>
          )}
        </section>

        {/* ============ 產生報價單 — 整頁最後 CTA ============ */}
        <button
          onClick={() =>
            router.push(`/ceiling/quote?d=${encodeURIComponent(encodeState(input))}`)
          }
          className="w-full rounded-2xl bg-[#bd9955] py-3 text-base font-semibold text-white hover:opacity-90 transition shadow-sm print:hidden"
        >
          {t("generateQuote")}
        </button>

        {/* ============ 公式 trace(admin) ============ */}
        <section className="print:hidden">
          <button onClick={() => setTraceOpen(!traceOpen)}
            className="w-full text-left px-5 py-3 rounded-2xl bg-white ring-1 ring-stone-200 hover:bg-stone-50 flex items-center justify-between text-sm transition">
            <span className="font-medium text-zinc-700 flex items-center gap-2">
              {t("trace.label")} <span className="text-[10px] text-zinc-600 font-normal">{t("trace.adminTag")}</span>
            </span>
            <span className="text-zinc-400 text-xs">{traceOpen ? "▲" : "▼"}</span>
          </button>
          {traceOpen && <TracePanel bom={bom} t={t} />}
        </section>
          </div>
        </div>

        {/* 列印用簽收欄(平常隱藏) */}
        <div className="hidden print:block mt-6 pt-4 border-t border-stone-300">
          <div className="grid grid-cols-3 gap-4 text-[11px] text-zinc-700">
            <div>
              <p className="mb-8">{t("printSignature.carpenter")}</p>
              <div className="border-t border-zinc-400 pt-1 text-center text-[10px] text-zinc-500">{t("printSignature.signLabel")}</div>
            </div>
            <div>
              <p className="mb-8">{t("printSignature.client")}</p>
              <div className="border-t border-zinc-400 pt-1 text-center text-[10px] text-zinc-500">{t("printSignature.signLabel")}</div>
            </div>
            <div>
              <p className="mb-8">{t("printSignature.dateLine")}</p>
              <div className="border-t border-zinc-400 pt-1 text-center text-[10px] text-zinc-500">{t("printSignature.confirmLabel")}</div>
            </div>
          </div>
        </div>

        {/* ============ 免責 / 使用提醒(頁尾) ============ */}
        <footer className="mt-8 mb-2 rounded-2xl bg-stone-100/60 border border-stone-200/80 p-4 sm:p-5 text-[11px] text-zinc-500 leading-relaxed">
          <p className="font-semibold text-zinc-700 mb-1.5">{t("footerDisclaimer.title")}</p>
          <ul className="space-y-1 list-disc list-inside marker:text-zinc-400">
            <li>{t("footerDisclaimer.line1Prefix")}<strong>{t("footerDisclaimer.line1Bold")}</strong>{t("footerDisclaimer.line1Suffix")}</li>
            <li>{t("footerDisclaimer.line2Prefix")}<strong>{t("footerDisclaimer.line2Bold")}</strong>{t("footerDisclaimer.line2Suffix")}</li>
            <li>{t("footerDisclaimer.line3Prefix")}<strong>{t("footerDisclaimer.line3Bold")}</strong>{t("footerDisclaimer.line3Suffix")}</li>
            <li>{t("footerDisclaimer.line4Prefix")}<strong>{t("footerDisclaimer.line4Bold")}</strong>{t("footerDisclaimer.line4Suffix")}</li>
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

function CategoryBadge({ category, t }: { category: string; t: ReturnType<typeof useTranslations<"ceilingTool">> }) {
  const tone: Record<string, string> = {
    "frame":      "bg-amber-100 text-amber-900 ring-amber-200",
    "main-joist": "bg-orange-100 text-orange-900 ring-orange-200",
    "sub-joist":  "bg-stone-100 text-stone-700 ring-stone-200",
    "hanger":     "bg-slate-100 text-slate-700 ring-slate-200",
    "board-full": "bg-emerald-100 text-emerald-900 ring-emerald-200",
    "board-cut":  "bg-rose-100 text-rose-900 ring-rose-200",
  };
  const labelKeyMap: Record<string, string> = {
    "frame": "category.frame",
    "main-joist": "category.mainJoist",
    "sub-joist": "category.subJoist",
    "hanger": "category.hanger",
    "board-full": "category.boardFull",
    "board-cut": "category.boardCut",
  };
  const labelKey = labelKeyMap[category];
  const label = labelKey ? t(labelKey) : category;
  const klass = tone[category] ?? "bg-stone-100 text-stone-700 ring-stone-200";
  return (
    <span className={`inline-block text-[10px] px-2 py-0.5 rounded-full ring-1 font-medium ${klass}`}>
      {label}
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

function TracePanel({ bom, t }: { bom: ReturnType<typeof computeCeilingBom>; t: ReturnType<typeof useTranslations<"ceilingTool">> }) {
  return (
    <div className="mt-2 rounded-2xl bg-white ring-1 ring-stone-200 p-5 text-xs space-y-3">
      <Row label={t("trace.rowMainCenters")} mono>[{bom.trace.mainJoistCentersCm.join(", ")}]</Row>
      <Row label={t("trace.rowMainLenCount")} mono>{t("trace.rowMainLenCountValue", { len: bom.trace.mainJoistLengthCm, count: bom.trace.mainJoistTimberCount })}</Row>
      <Row label={t("trace.rowSupportPositions")} mono>[{bom.trace.supportPositionsCm.join(", ")}]</Row>
      <div>
        <div className="text-[10px] text-zinc-500 uppercase tracking-wide font-semibold mb-1">{t("trace.subSlotsTitle")}</div>
        <table className="w-full text-[10px] font-mono">
          <thead className="text-zinc-400">
            <tr><th className="text-left">{t("trace.thSlot")}</th><th className="text-right">{t("trace.thWidth")}</th><th className="text-right">{t("trace.thSubLen")}</th><th className="text-right">{t("trace.thCount")}</th></tr>
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
      <Row label={t("trace.rowHangerPerMain")} mono>{bom.trace.hangerPerMainJoist}</Row>
      <Row label={t("trace.rowSubYOffsets")} mono>[{bom.trace.subJoistYOffsetsCm.join(", ")}]</Row>
      <Row label={t("trace.rowBoardLayout")}>{bom.trace.boardLayoutDescription}</Row>
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
