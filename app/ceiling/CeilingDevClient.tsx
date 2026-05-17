"use client";

/**
 * 階段 1 算料引擎驗證頁(陽春 UI):
 *   左欄 6 個輸入 + 排版/吊筋密度/邊框兼支撐 toggle
 *   中央 自動算 + BOM 表
 *   右欄 公式對照(展開 trace,給 user 逐條核對)
 *   下方 「下載 CSV」「複製公式對照」按鈕
 *
 * 風格:沿用 wrd amber/zinc/米色 token(不另創)。
 * 階段 2 才加 SVG 俯視圖。
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

  // ────── 階段 3 3D 狀態 ──────
  const [viewKind, setViewKind] = useState<"2d" | "3d">("2d");
  const [view3D, setView3D] = useState<ViewMode>("iso");
  const [explode, setExplode] = useState(0);
  const [layers, setLayers] = useState<Record<LayerKey, boolean>>({
    room: true, frame: true, main: true, sub: true, boards: true,
  });
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

  return (
    <main className="max-w-6xl mx-auto px-6 py-8">
      <header className="mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-50 ring-1 ring-rose-200 text-rose-800 text-[11px] font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
          階段 1 開發中 · 僅 admin 可見
        </div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-zinc-900">
          木作天花板骨架施工模擬器
        </h1>
        <p className="mt-2 text-sm text-zinc-600 leading-relaxed max-w-3xl">
          階段 1 純算料引擎驗證頁。請拿真實案場數字輸入,核對「材料表」與「公式對照」每一項是否合理。
          發現有問題的數字 → 截圖告訴我,核對通過後才進階段 2(2D 俯視排版圖)。
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr_320px] gap-6">
        {/* ────── 左欄:輸入 ────── */}
        <aside className="space-y-4">
          <Section title="房間尺寸">
            <NumberField label="長邊" suffix="cm" value={input.longSideCm}
              onChange={(v) => update("longSideCm", v)} />
            <NumberField label="短邊" suffix="cm" value={input.shortSideCm}
              onChange={(v) => update("shortSideCm", v)} />
            <NumberField label="板高(樓板到地)" suffix="cm" value={input.slabHeightCm}
              onChange={(v) => update("slabHeightCm", v)} />
            <NumberField label="天花板高" suffix="cm" value={input.ceilingHeightCm}
              onChange={(v) => update("ceilingHeightCm", v)} />
          </Section>

          <Section title="主支排版">
            <NumberField label="主支中心距" suffix="cm" value={input.mainSpacingCm}
              onChange={(v) => update("mainSpacingCm", v)} step={0.1} />
            <NumberField label="副支中心距" suffix="cm" value={input.subSpacingCm}
              onChange={(v) => update("subSpacingCm", v)} step={0.1} />
            <ToggleGroup<AlignmentBase>
              label="主支排版(沿長邊)"
              value={input.alignmentBase}
              options={[
                { value: "left", label: "靠左" },
                { value: "center", label: "置中" },
                { value: "right", label: "靠右" },
              ]}
              onChange={(v) => update("alignmentBase", v)}
            />
            <ToggleGroup<SubAlignmentBase>
              label="副支排版(沿短邊)"
              value={input.subAlignmentBase}
              options={[
                { value: "top", label: "靠上" },
                { value: "middle", label: "置中" },
                { value: "bottom", label: "靠下" },
              ]}
              onChange={(v) => update("subAlignmentBase", v)}
            />
            <Checkbox label="邊框兼當支撐" checked={input.frameDoublesAsSupport}
              onChange={(v) => update("frameDoublesAsSupport", v)} />
          </Section>

          <Section title="角材規格">
            <NumberField label="截面寬" suffix="cm" value={input.timberWidthCm}
              onChange={(v) => update("timberWidthCm", v)} step={0.1} />
            <NumberField label="截面厚" suffix="cm" value={input.timberThicknessCm}
              onChange={(v) => update("timberThicknessCm", v)} step={0.1} />
            <p className="text-[10px] text-zinc-500 leading-tight">
              預設 3.6×3.0 cm = 1.2×1 寸
            </p>
          </Section>

          <Section title="矽酸鈣板">
            <NumberField label="板長" suffix="cm" value={input.boardLongCm}
              onChange={(v) => update("boardLongCm", v)} />
            <NumberField label="板寬" suffix="cm" value={input.boardShortCm}
              onChange={(v) => update("boardShortCm", v)} />
            <NumberField label="接縫" suffix="mm" value={input.jointGapMm}
              onChange={(v) => update("jointGapMm", v)} step={1} />
            <p className="text-[10px] text-zinc-500 leading-tight">
              業界 3-6 mm;9 mm 板取 3 mm,環氧樹脂 / 接縫帶 / 批土收尾。
            </p>
          </Section>

          <Section title="吊筋">
            <ToggleGroup<HangerDensity>
              label="吊筋密度"
              value={input.hangerDensity}
              options={[
                { value: "standard", label: "業界標準(中段補)" },
                { value: "minimal", label: "圖示版(僅兩端)" },
              ]}
              onChange={(v) => update("hangerDensity", v)}
            />
            <NumberField label="吊筋中心距" suffix="cm" value={input.hangerSpacingCm}
              onChange={(v) => update("hangerSpacingCm", v)} disabled={input.hangerDensity === "minimal"} />
          </Section>
        </aside>

        {/* ────── 中央:SVG + 自動算 + BOM ────── */}
        <section>
          {/* 視圖切換 2D / 3D(階段 2 / 階段 3) */}
          <div className="rounded-lg border border-zinc-200 bg-white p-3 mb-5">
            <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <h2 className="text-sm font-semibold text-zinc-900">
                  {viewKind === "2d" ? "俯視排版圖(2D)" : "3D 軸測 / 俯視"}
                </h2>
                <div className="inline-flex gap-1 p-0.5 bg-zinc-100 rounded text-[11px]">
                  <button onClick={() => setViewKind("2d")}
                    className={`px-2 py-1 rounded font-medium transition ${viewKind === "2d" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-600"}`}>
                    📐 2D
                  </button>
                  <button onClick={() => setViewKind("3d")}
                    className={`px-2 py-1 rounded font-medium transition ${viewKind === "3d" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-600"}`}>
                    🧊 3D
                  </button>
                </div>
              </div>
              <ConsistencyBadge bom={bom} />
            </div>

            {/* 3D 控制列(只在 3D 模式顯示) */}
            {viewKind === "3d" && (
              <div className="mb-3 flex flex-wrap items-center gap-3 p-2 bg-zinc-50/60 rounded text-[11px]">
                <div className="inline-flex gap-1 p-0.5 bg-zinc-200 rounded">
                  <button onClick={() => setView3D("iso")}
                    className={`px-2 py-0.5 rounded font-medium ${view3D === "iso" ? "bg-white shadow-sm" : "text-zinc-600"}`}>
                    軸測
                  </button>
                  <button onClick={() => setView3D("top")}
                    className={`px-2 py-0.5 rounded font-medium ${view3D === "top" ? "bg-white shadow-sm" : "text-zinc-600"}`}>
                    俯視
                  </button>
                </div>
                <label className="flex items-center gap-2">
                  <span className="text-zinc-700">爆炸</span>
                  <input type="range" min={0} max={1} step={0.01} value={explode}
                    onChange={(e) => setExplode(Number(e.target.value))} className="w-24" />
                  <span className="tabular-nums text-zinc-500 w-8">{(explode * 100).toFixed(0)}%</span>
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-zinc-700">圖層</span>
                  {[
                    { k: "room" as const, label: "房間" },
                    { k: "frame" as const, label: "邊框" },
                    { k: "main" as const, label: "主支+吊筋" },
                    { k: "sub" as const, label: "副支" },
                    { k: "boards" as const, label: "矽酸鈣板" },
                  ].map(({ k, label }) => (
                    <button key={k} onClick={() => toggleLayer(k)}
                      className={`px-2 py-0.5 rounded ring-1 ${layers[k] ? "bg-amber-100 text-amber-900 ring-amber-300" : "bg-zinc-100 text-zinc-400 ring-zinc-200"}`}>
                      {layers[k] ? "👁" : "🚫"} {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {viewKind === "2d" ? (
              <CeilingOverviewSvg bom={bom} />
            ) : (
              <LazyCeilingScene3D bom={bom} viewMode={view3D} explode={explode} layers={layers} />
            )}
            <p className="mt-2 text-[10px] text-zinc-500 leading-snug">
              改任何輸入,圖即時重繪。「畫幾根 = 算幾根」:右下圖例 + 上方一致性檢查徽章。
            </p>
            <div className="mt-3 p-2 rounded bg-blue-50/60 border border-blue-200 text-[10px] text-blue-900 leading-relaxed">
              <strong>📐 板邊接縫處理(業界規範 3-6 mm):</strong>
              藍色虛線 tick(上下房間外)= 板邊位置,落在主支中心(施工 step 5)。
              <br />
              預設 <strong>3 mm 接縫</strong>(可調),板邊 → 環氧樹脂填縫 →
              <strong> 48 mm 寬纖維接縫帶</strong>(玻纖網)貼上 → 批土平整 → 上漆 / 噴塗。
              這流程不論縫多寬都必跑,**接縫帶是天花板防裂的關鍵**(矽酸鈣板熱脹冷縮 + 結構微振)。
              <br />
              <strong>螺絲規範:</strong>距板邊 ≥ 15 mm 鎖,沿板邊每 20-30 cm 一支、中間 30 cm 一支。
              <br />
              <strong>預設 90 / 36 公制間距 → 0 累積誤差。</strong>
              改回老派 90.9 / 36.36 台尺(form 內可調)= 板會多 0.9 / 1.8 cm 累積縫,需多填料,
              工具會以剩餘收邊形式回報。
              <br />
              邊欄(寬度 &lt; 85 cm)= 裁切板,材料表已標為「裁切」。
            </div>
          </div>

          {/* 自動算 唯讀顯示 */}
          <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4 mb-5">
            <h2 className="text-sm font-semibold text-amber-900 mb-3">自動算</h2>
            <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 text-sm">
              <ReadOnly label="吊筋高度" value={`${r1(bom.auto.hangerHeightCm)} cm`} />
              <ReadOnly label="房間面積" value={`${r2(bom.auto.roomAreaM2)} m²`} />
              <ReadOnly label="坪數" value={`${r2(bom.auto.pingShu)} 坪`} />
              <ReadOnly label="剩餘收邊" value={`${r1(bom.auto.leftoverCm)} cm`} />
              <ReadOnly label="主支位置數" value={`${bom.auto.mainPositionCount}`} />
            </dl>
          </div>

          {/* BOM 表 */}
          <div className="rounded-lg border border-zinc-200 bg-white overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-200 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-900">材料表 BOM</h2>
              <button onClick={downloadCsv}
                className="text-xs px-3 py-1 rounded bg-amber-600 text-white hover:bg-amber-700 font-medium">
                📋 下載 CSV
              </button>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-zinc-600 text-xs">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">類別</th>
                  <th className="text-left px-3 py-2 font-medium">名稱</th>
                  <th className="text-left px-3 py-2 font-medium">規格</th>
                  <th className="text-right px-3 py-2 font-medium">單支長</th>
                  <th className="text-right px-3 py-2 font-medium">總長</th>
                  <th className="text-right px-3 py-2 font-medium">數量</th>
                </tr>
              </thead>
              <tbody>
                {bom.items.map((it, i) => (
                  <tr key={i} className="border-t border-zinc-100 align-top">
                    <td className="px-3 py-2 text-[10px] uppercase text-zinc-500 font-mono">{it.category}</td>
                    <td className="px-3 py-2 text-zinc-900">{it.nameZh}</td>
                    <td className="px-3 py-2 text-zinc-700 text-xs">{it.spec}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{it.unitLengthCm != null ? `${it.unitLengthCm} cm` : "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{it.totalLengthM != null ? `${it.totalLengthM} m` : "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold">{it.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {/* 備註行(每項展開) */}
            <div className="px-4 py-3 border-t border-zinc-100 bg-zinc-50/40 space-y-1">
              {bom.items.filter((i) => i.note).map((it, i) => (
                <p key={i} className="text-[11px] text-zinc-600 leading-snug">
                  <span className="font-medium text-zinc-800">{it.nameZh}:</span> {it.note}
                </p>
              ))}
            </div>
          </div>
        </section>

        {/* ────── 右欄:公式對照 trace ────── */}
        <aside className="rounded-lg border border-zinc-200 bg-zinc-50/40 p-4 text-xs space-y-3">
          <h2 className="text-sm font-semibold text-zinc-900">公式對照 trace</h2>
          <p className="text-[10px] text-zinc-500 leading-snug">
            給你核對中間值用。對不上馬上告訴我。
          </p>
          <div>
            <p className="font-medium text-zinc-700">主支中心位置(沿長邊 cm)</p>
            <p className="font-mono text-[10px] text-zinc-600 break-all">
              [{bom.trace.mainJoistCentersCm.join(", ")}]
            </p>
          </div>
          <div>
            <p className="font-medium text-zinc-700">主支單支長度 / 實際根數</p>
            <p className="font-mono text-[10px] text-zinc-600">
              {bom.trace.mainJoistLengthCm} cm × {bom.trace.mainJoistTimberCount} 支
            </p>
          </div>
          <div>
            <p className="font-medium text-zinc-700">支撐排序(含邊框,cm)</p>
            <p className="font-mono text-[10px] text-zinc-600 break-all">
              [{bom.trace.supportPositionsCm.join(", ")}]
            </p>
          </div>
          <div>
            <p className="font-medium text-zinc-700">副支 slot 明細</p>
            <table className="w-full text-[10px] font-mono mt-1">
              <thead className="text-zinc-500">
                <tr>
                  <th className="text-left">slot</th>
                  <th className="text-right">寬</th>
                  <th className="text-right">副支長</th>
                  <th className="text-right">副支數</th>
                </tr>
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
          <div>
            <p className="font-medium text-zinc-700">每主支吊筋數</p>
            <p className="font-mono text-[10px] text-zinc-600">
              {bom.trace.hangerPerMainJoist} 支
            </p>
          </div>
          <div>
            <p className="font-medium text-zinc-700">矽酸鈣板鋪法</p>
            <p className="text-[10px] text-zinc-600 leading-snug">
              {bom.trace.boardLayoutDescription}
            </p>
            <p className="font-mono text-[10px] text-zinc-700 mt-1">
              {bom.trace.boardCols} 欄 × {bom.trace.boardRows} 列 = {bom.trace.boardCols * bom.trace.boardRows} 位置
            </p>
          </div>
        </aside>
      </div>

      {/* ────── 設計假設提示 ────── */}
      <details className="mt-8 text-xs text-zinc-600 bg-zinc-50/60 rounded-lg p-4 border border-zinc-200">
        <summary className="font-semibold text-zinc-800 cursor-pointer">
          設計假設(v1,user 核對後鎖定)
        </summary>
        <ol className="list-decimal list-inside mt-3 space-y-1 leading-relaxed">
          <li>角材寬度全模型統一(邊框 / 主支 / 副支同 timberWidthCm)</li>
          <li>副支與兩端對接 = butt joint,長度 = slot 寬 − 兩側角材寬合</li>
          <li>矽酸鈣板長(180)對齊主支方向(短邊),板寬(90)對齊長邊</li>
          <li>板邊「落在主支中心」近似:板寬 90 ≈ 主支中心距 90.9(差 0.9 cm 忽略)</li>
          <li>邊框吊筋未計(僅主支吊筋);邊框另有牆面固定 + 四角輔助吊筋</li>
          <li>吊筋 standard 模式:每主支 floor(主支長 / hangerSpacing) + 1 支</li>
          <li>吊筋 minimal 模式:每主支固定 2 支(兩端各一)</li>
          <li>主支單支長 = 短邊 − 2 × 邊框寬(對接邊框內側)</li>
        </ol>
      </details>
    </main>
  );
}

// ────── 小元件 ──────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-3 space-y-2">
      <h3 className="text-xs font-semibold text-zinc-700 uppercase tracking-wide">{title}</h3>
      {children}
    </div>
  );
}

function NumberField({
  label, suffix, value, onChange, step = 1, disabled,
}: {
  label: string;
  suffix?: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  disabled?: boolean;
}) {
  return (
    <label className="flex items-center gap-2 text-xs">
      <span className="text-zinc-700 w-24 shrink-0">{label}</span>
      <input
        type="number"
        value={value}
        step={step}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 min-w-0 px-2 py-1 text-sm border border-zinc-300 rounded tabular-nums disabled:bg-zinc-100 disabled:text-zinc-400"
      />
      {suffix && <span className="text-[10px] text-zinc-500 w-6">{suffix}</span>}
    </label>
  );
}

function Checkbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-xs text-zinc-700">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="accent-amber-600" />
      {label}
    </label>
  );
}

function ToggleGroup<T extends string>({
  label, value, options, onChange,
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (v: T) => void;
}) {
  return (
    <div className="text-xs">
      <p className="text-zinc-700 mb-1">{label}</p>
      <div className="inline-flex gap-1 p-0.5 bg-zinc-100 rounded">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`px-2 py-1 rounded text-[11px] font-medium transition ${
              value === opt.value
                ? "bg-white text-zinc-900 shadow-sm"
                : "text-zinc-600 hover:text-zinc-900"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ConsistencyBadge({ bom }: { bom: ReturnType<typeof computeCeilingBom> }) {
  // SVG 畫的主支位置數
  const svgMain = bom.trace.mainJoistCentersCm.length;
  // BOM 列的下料主支根數(可能被邊框 absorb)
  const bomMain = bom.trace.mainJoistTimberCount;
  // SVG 畫的副支總數 = trace slots 加總
  const svgSub = bom.trace.slots.reduce((sum, s) => sum + s.subJoistCount, 0);
  // BOM 列的副支總數
  const bomSub = bom.items
    .filter((i) => i.category === "sub-joist")
    .reduce((s, i) => s + i.count, 0);

  const subOk = svgSub === bomSub;
  // 主支:SVG 畫所有位置,BOM 列下料根數;差值應 = 被邊框 absorb 數
  const expectedDiff = svgMain - bomMain;
  const mainOk = expectedDiff === 0 || (bom.input.frameDoublesAsSupport && expectedDiff > 0);

  const allOk = subOk && mainOk;
  return (
    <div
      className={`text-[10px] px-2 py-1 rounded ring-1 tabular-nums ${
        allOk
          ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
          : "bg-rose-50 text-rose-800 ring-rose-200"
      }`}
      title="SVG 渲染數 vs BOM 列數對照"
    >
      {allOk ? "✓" : "⚠"} 主支 SVG {svgMain} / BOM {bomMain}
      {expectedDiff > 0 && bom.input.frameDoublesAsSupport ? `(邊框替代 ${expectedDiff})` : ""}
      {" · "}副支 SVG {svgSub} / BOM {bomSub}
    </div>
  );
}

function ReadOnly({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] text-amber-700 uppercase tracking-wide">{label}</dt>
      <dd className="text-sm font-semibold text-amber-950 tabular-nums">{value}</dd>
    </div>
  );
}

// ────── csv helper ──────
function csvEscape(s: string): string {
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function r1(n: number) { return Math.round(n * 10) / 10; }
function r2(n: number) { return Math.round(n * 100) / 100; }
