"use client";

/**
 * /raised-floor 和室架高平台估價 — 主 UI
 *
 * 版面:左欄 6 區漸進輸入(平台形狀 → 架高高度 → 面材 → 骨架 → 夾板 → 估價)
 *      右欄 sticky 結果(俯視預覽 + 4 張統計卡 + BOM 表 + 總價 + 複製清單)
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
import { FloorRangeInput } from "@/app/floor/FloorRangeInput";

const PILLAR_CORNERS: { value: PillarCorner; label: string }[] = [
  { value: "tl", label: "左上" },
  { value: "tr", label: "右上" },
  { value: "bl", label: "左下" },
  { value: "br", label: "右下" },
];

export function RaisedFloorClient() {
  const [input, setInput] = useState<RaisedFloorInput>(DEFAULT_RAISED_FLOOR_INPUT);
  const bom = useMemo(() => computeRaisedFloorBom(input), [input]);
  const [copied, setCopied] = useState(false);

  const set = <K extends keyof RaisedFloorInput>(k: K, v: RaisedFloorInput[K]) =>
    setInput((p) => ({ ...p, [k]: v }));

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
                <span className="text-zinc-500">角材規格</span>
                <select
                  className="rounded border border-zinc-300 px-2 py-1"
                  value={input.joist.id}
                  onChange={(e) => set("joist", getJoistPreset(e.target.value))}
                >
                  {JOIST_PRESETS.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.nameZh}
                    </option>
                  ))}
                </select>
              </label>
              <FloorRangeInput
                label="骨架間距"
                unit="cm"
                value={input.joistSpacingCm}
                min={20}
                max={50}
                step={5}
                onChange={(v) => set("joistSpacingCm", v)}
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
            <RaisedFloorOverviewSvg bom={bom} width={388} />

            <div className="grid grid-cols-4 gap-2">
              <Stat
                label="面材"
                value={`${bom.trace.plankTotalCount}`}
                unit="片"
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
      </div>
    </main>
  );
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
