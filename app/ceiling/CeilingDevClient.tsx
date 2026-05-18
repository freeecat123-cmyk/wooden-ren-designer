"use client";

/**
 * /ceiling — 第一性原理版
 *
 * 砍掉所有非必要,只留:
 *   1. 4 個輸入(長 / 短 / 板高 / 花板高)— 占頂部 strip
 *   2. 1 個大視覺(2D / 3D 切換,佔 ≥ 55vh)
 *   3. 6 個重點數字(大字 grid)
 *   4. 1 個下載按鈕
 *
 * 進階設定 (板規/接縫/排版/吊筋/邊框兼支撐) 收進 ⚙ drawer。
 * 詳細 BOM 與公式 trace 收進 collapse。
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
  const [bomOpen, setBomOpen] = useState(false);
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

  // 6 重點摘要
  const subInner = bom.items.find((i) => i.category === "sub-joist");
  const subEdge = bom.items.filter((i) => i.category === "sub-joist")[1];
  const hanger = bom.items.find((i) => i.category === "hanger");
  const boardFull = bom.items.find((i) => i.category === "board-full");
  const boardCut = bom.items.find((i) => i.category === "board-cut");
  const totalBoards = (boardFull?.count ?? 0) + (boardCut?.count ?? 0);

  return (
    <div className="min-h-screen bg-stone-50">
      {/* ============ 頂部 strip ============ */}
      <header className="bg-white border-b border-stone-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-5 py-3 flex items-center gap-4 flex-wrap">
          <h1 className="text-base font-semibold text-zinc-900 mr-auto flex items-center gap-2">
            <span className="text-amber-600">▣</span>
            天花板骨架
            <span className="text-[10px] text-rose-700 bg-rose-50 ring-1 ring-rose-200 px-1.5 py-0.5 rounded-full font-normal">
              admin
            </span>
          </h1>
          <div className="inline-flex gap-0.5 p-0.5 bg-stone-100 rounded-md text-[11px] font-medium">
            <button onClick={() => setViewKind("2d")}
              className={`px-3 py-1.5 rounded transition ${viewKind === "2d" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-800"}`}>
              平面
            </button>
            <button onClick={() => setViewKind("3d")}
              className={`px-3 py-1.5 rounded transition ${viewKind === "3d" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-800"}`}>
              立體
            </button>
          </div>
          <button onClick={downloadCsv}
            className="px-3 py-1.5 text-[12px] font-medium rounded-md bg-amber-600 hover:bg-amber-700 text-white transition">
            下載 CSV
          </button>
          <button onClick={() => setSettingsOpen(true)}
            className="px-2.5 py-1.5 text-[12px] rounded-md border border-stone-200 hover:bg-stone-50 transition"
            title="進階設定">
            ⚙ 設定
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-5 py-6 space-y-5">
        {/* ============ 4 輸入 strip(主要輸入永遠可見) ============ */}
        <section className="rounded-xl bg-white ring-1 ring-stone-200 overflow-hidden">
          <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-stone-200">
            <HeroInput label="長邊" value={input.longSideCm} suffix="cm"
              onChange={(v) => update("longSideCm", v)} />
            <HeroInput label="短邊" value={input.shortSideCm} suffix="cm"
              onChange={(v) => update("shortSideCm", v)} />
            <HeroInput label="板高(樓板)" value={input.slabHeightCm} suffix="cm"
              onChange={(v) => update("slabHeightCm", v)} />
            <HeroInput label="天花板高" value={input.ceilingHeightCm} suffix="cm"
              onChange={(v) => update("ceilingHeightCm", v)} />
          </div>
        </section>

        {/* ============ 大視覺 ============ */}
        <section className="rounded-xl bg-white ring-1 ring-stone-200 overflow-hidden">
          {viewKind === "3d" && (
            <div className="px-3 py-2 border-b border-stone-100 flex flex-wrap items-center gap-3 text-[11px]">
              <div className="inline-flex gap-0.5 p-0.5 bg-stone-100 rounded">
                <button onClick={() => setView3D("iso")}
                  className={`px-2 py-1 rounded font-medium ${view3D === "iso" ? "bg-white shadow-sm" : "text-zinc-600"}`}>軸測</button>
                <button onClick={() => setView3D("top")}
                  className={`px-2 py-1 rounded font-medium ${view3D === "top" ? "bg-white shadow-sm" : "text-zinc-600"}`}>俯視</button>
              </div>
              <label className="flex items-center gap-2 text-zinc-600">
                爆炸
                <input type="range" min={0} max={1} step={0.01} value={explode}
                  onChange={(e) => setExplode(Number(e.target.value))} className="w-28 accent-amber-600" />
                <span className="tabular-nums w-8 text-zinc-500">{(explode * 100).toFixed(0)}%</span>
              </label>
              <div className="flex items-center gap-1.5 text-zinc-600">
                {[
                  { k: "room" as const, label: "房" },
                  { k: "frame" as const, label: "邊" },
                  { k: "main" as const, label: "主" },
                  { k: "sub" as const, label: "副" },
                  { k: "boards" as const, label: "板" },
                ].map(({ k, label }) => (
                  <button key={k} onClick={() => toggleLayer(k)}
                    className={`w-6 h-6 rounded text-[10px] font-semibold transition ${
                      layers[k] ? "bg-amber-100 text-amber-900 ring-1 ring-amber-300" : "bg-stone-100 text-stone-400"
                    }`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="p-3">
            {viewKind === "2d" ? (
              <CeilingOverviewSvg bom={bom} />
            ) : (
              <LazyCeilingScene3D bom={bom} viewMode={view3D} explode={explode} layers={layers} />
            )}
          </div>
        </section>

        {/* ============ 6 重點數字 ============ */}
        <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <Stat label="坪數" value={r2(bom.auto.pingShu)} unit="坪" />
          <Stat label="邊框" value={r1(bom.items[0].totalLengthM ?? 0)} unit="m" />
          <Stat label="主支" value={bom.trace.mainJoistTimberCount} unit="支" hint={`${r1(bom.trace.mainJoistLengthCm)} cm`} />
          <Stat label="副支" value={bom.trace.slots.reduce((s, x) => s + x.subJoistCount, 0)} unit="支"
            hint={subInner && subEdge ? `${subInner.unitLengthCm}/${subEdge.unitLengthCm}` : ""} />
          <Stat label="吊筋" value={hanger?.count ?? 0} unit="支" hint={`${r1(bom.auto.hangerHeightCm)} cm`} />
          <Stat label="矽酸鈣板" value={totalBoards} unit="張"
            hint={`${boardFull?.count ?? 0} 整 / ${boardCut?.count ?? 0} 裁`} />
        </section>

        {/* ============ 詳細 BOM(可摺) ============ */}
        <section>
          <button onClick={() => setBomOpen(!bomOpen)}
            className="w-full text-left px-4 py-2.5 rounded-lg bg-white ring-1 ring-stone-200 hover:bg-stone-50 flex items-center justify-between text-sm">
            <span className="font-medium text-zinc-800">詳細 BOM</span>
            <span className="text-zinc-400 text-xs">{bomOpen ? "▲" : "▼"}</span>
          </button>
          {bomOpen && (
            <div className="mt-2 rounded-lg bg-white ring-1 ring-stone-200 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-stone-50 text-zinc-500 text-[10px] uppercase tracking-wide">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">名稱</th>
                    <th className="text-left px-3 py-2 font-medium">規格</th>
                    <th className="text-right px-3 py-2 font-medium">單長</th>
                    <th className="text-right px-3 py-2 font-medium">總長</th>
                    <th className="text-right px-3 py-2 font-medium">數量</th>
                  </tr>
                </thead>
                <tbody>
                  {bom.items.map((it, i) => (
                    <tr key={i} className="border-t border-stone-100">
                      <td className="px-3 py-2 text-zinc-900">{it.nameZh}</td>
                      <td className="px-3 py-2 text-zinc-600 text-xs">{it.spec}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{it.unitLengthCm != null ? `${it.unitLengthCm} cm` : "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{it.totalLengthM != null ? `${it.totalLengthM} m` : "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-semibold text-amber-900">{it.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ============ 公式對照 trace(admin debug 用) ============ */}
        <section>
          <button onClick={() => setTraceOpen(!traceOpen)}
            className="w-full text-left px-4 py-2.5 rounded-lg bg-white ring-1 ring-stone-200 hover:bg-stone-50 flex items-center justify-between text-sm">
            <span className="font-medium text-zinc-800">公式對照 trace</span>
            <span className="text-zinc-400 text-xs">{traceOpen ? "▲" : "▼"}</span>
          </button>
          {traceOpen && <TracePanel bom={bom} />}
        </section>
      </main>

      {/* ============ 設定 drawer ============ */}
      {settingsOpen && (
        <SettingsDrawer
          input={input}
          bom={bom}
          update={update}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// HeroInput — 頂部 4 大輸入
// ─────────────────────────────────────────────────────────
function HeroInput({
  label, value, suffix, onChange,
}: { label: string; value: number; suffix: string; onChange: (v: number) => void }) {
  return (
    <label className="block px-5 py-4 hover:bg-stone-50/60 transition">
      <span className="text-[10px] text-zinc-500 uppercase tracking-wide font-medium">{label}</span>
      <div className="flex items-baseline gap-1.5 mt-1">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="text-2xl font-semibold text-zinc-900 tabular-nums bg-transparent w-full focus:outline-none focus:ring-0 [-moz-appearance:textfield] [&::-webkit-inner-spin-button]:m-0"
        />
        <span className="text-xs text-zinc-400">{suffix}</span>
      </div>
    </label>
  );
}

// ─────────────────────────────────────────────────────────
// Stat — 重點數字卡
// ─────────────────────────────────────────────────────────
function Stat({ label, value, unit, hint }: { label: string; value: number | string; unit: string; hint?: string }) {
  return (
    <div className="rounded-xl bg-white ring-1 ring-stone-200 px-4 py-3">
      <div className="text-[10px] text-zinc-500 uppercase tracking-wide font-medium">{label}</div>
      <div className="mt-0.5 flex items-baseline gap-1">
        <span className="text-2xl font-semibold text-zinc-900 tabular-nums">{value}</span>
        <span className="text-xs text-zinc-400">{unit}</span>
      </div>
      {hint && <div className="text-[10px] text-zinc-500 mt-0.5 tabular-nums truncate">{hint}</div>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// SettingsDrawer — 進階設定(右側 slide-in)
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
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <aside className="fixed right-0 top-0 bottom-0 w-full sm:w-[340px] bg-white shadow-2xl z-50 overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-stone-200 px-5 py-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-900">進階設定</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 text-lg leading-none">×</button>
        </div>
        <div className="p-5 space-y-5">
          <Group title="排版基準">
            <Toggle3 label="主支(沿長邊)" value={input.alignmentBase}
              opts={[["left", "靠左"], ["center", "置中"], ["right", "靠右"]]}
              onChange={(v) => update("alignmentBase", v as AlignmentBase)} />
            <Toggle3 label="副支(沿短邊)" value={input.subAlignmentBase}
              opts={[["top", "靠上"], ["middle", "置中"], ["bottom", "靠下"]]}
              onChange={(v) => update("subAlignmentBase", v as SubAlignmentBase)} />
            <Check label="邊框兼當支撐" checked={input.frameDoublesAsSupport}
              onChange={(v) => update("frameDoublesAsSupport", v)} />
          </Group>

          <Group title="角材間距">
            <Check label="🔒 依板規自動算" checked={input.useAutoSpacing}
              onChange={(v) => update("useAutoSpacing", v)} />
            <SmallNum label="主支中心距" value={input.useAutoSpacing ? bom.input.mainSpacingCm : input.mainSpacingCm}
              onChange={(v) => update("mainSpacingCm", v)} step={0.1}
              disabled={input.useAutoSpacing} unit="cm" />
            <SmallNum label="副支中心距" value={input.useAutoSpacing ? bom.input.subSpacingCm : input.subSpacingCm}
              onChange={(v) => update("subSpacingCm", v)} step={0.1}
              disabled={input.useAutoSpacing} unit="cm" />
            {input.useAutoSpacing && (
              <p className="text-[10px] text-amber-700 leading-snug">
                自動:主支 = 板寬 + 接縫,副支 = 板長 ÷ round(板長/36)。
              </p>
            )}
          </Group>

          <Group title="角材規格">
            <SmallNum label="截面寬" value={input.timberWidthCm} onChange={(v) => update("timberWidthCm", v)} step={0.1} unit="cm" />
            <SmallNum label="截面厚" value={input.timberThicknessCm} onChange={(v) => update("timberThicknessCm", v)} step={0.1} unit="cm" />
          </Group>

          <Group title="矽酸鈣板">
            <SmallNum label="板長" value={input.boardLongCm} onChange={(v) => update("boardLongCm", v)} unit="cm" />
            <SmallNum label="板寬" value={input.boardShortCm} onChange={(v) => update("boardShortCm", v)} unit="cm" />
            <SmallNum label="接縫" value={input.jointGapMm} onChange={(v) => update("jointGapMm", v)} step={1} unit="mm" />
            <p className="text-[10px] text-zinc-500 leading-snug">
              業界 3-6 mm,9 mm 板取 3。環氧樹脂 / 接縫帶 / 批土收尾。
            </p>
          </Group>

          <Group title="吊筋">
            <Toggle3 label="密度" value={input.hangerDensity}
              opts={[["standard", "業界標準"], ["minimal", "簡化(僅兩端)"]]}
              onChange={(v) => update("hangerDensity", v as HangerDensity)} />
            <SmallNum label="中心距" value={input.hangerSpacingCm} onChange={(v) => update("hangerSpacingCm", v)} unit="cm"
              disabled={input.hangerDensity === "minimal"} />
          </Group>
        </div>
      </aside>
    </>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold mb-2">{title}</h3>
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
        className="flex-1 min-w-0 px-2 py-1.5 text-sm border border-stone-300 rounded tabular-nums disabled:bg-stone-100 disabled:text-stone-400 focus:outline-none focus:border-amber-500" />
      {unit && <span className="text-[10px] text-zinc-400 w-6">{unit}</span>}
    </label>
  );
}

function Toggle3<T extends string>({
  label, value, opts, onChange,
}: { label: string; value: T; opts: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="text-xs">
      <div className="text-zinc-600 mb-1">{label}</div>
      <div className="inline-flex gap-0.5 p-0.5 bg-stone-100 rounded w-full">
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
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="accent-amber-600" />
      {label}
    </label>
  );
}

// ─────────────────────────────────────────────────────────
// TracePanel — admin debug trace
// ─────────────────────────────────────────────────────────
function TracePanel({ bom }: { bom: ReturnType<typeof computeCeilingBom> }) {
  return (
    <div className="mt-2 rounded-lg bg-white ring-1 ring-stone-200 p-4 text-xs space-y-3">
      <Row label="主支中心位置(沿長邊 cm)" mono>[{bom.trace.mainJoistCentersCm.join(", ")}]</Row>
      <Row label="主支單支長度 × 實際根數" mono>{bom.trace.mainJoistLengthCm} cm × {bom.trace.mainJoistTimberCount}</Row>
      <Row label="支撐排序(含邊框內側,cm)" mono>[{bom.trace.supportPositionsCm.join(", ")}]</Row>
      <div>
        <div className="text-[10px] text-zinc-500 uppercase tracking-wide font-medium mb-1">副支 slot 明細</div>
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
      <div className="text-[10px] text-zinc-500 uppercase tracking-wide font-medium mb-0.5">{label}</div>
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
