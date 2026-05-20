"use client";

/**
 * /floor Client UI:房間編輯器 + 範本 + 設定表單 + 排版預覽 + BOM。
 * 任何輸入變更 → 即時 computeFloorBom 重算。
 */
import { useMemo, useState } from "react";
import { computeFloorBom } from "@/lib/floor/calc";
import { DEFAULT_FLOOR_INPUT, type FloorInput, type RoomPolygon } from "@/lib/floor/types";
import { SHAPE_PRESETS, getPreset, type ShapePreset } from "@/lib/floor/presets";
import { FloorOverviewSvg } from "@/lib/floor/FloorOverviewSvg";
import { FloorCanvasEditor } from "./FloorCanvasEditor";

export function FloorDevClient() {
  const [input, setInput] = useState<FloorInput>(DEFAULT_FLOOR_INPUT);
  const bom = useMemo(() => computeFloorBom(input), [input]);

  const set = <K extends keyof FloorInput>(k: K, v: FloorInput[K]) =>
    setInput((p) => ({ ...p, [k]: v }));
  const setRoom = (room: RoomPolygon) => setInput((p) => ({ ...p, room }));

  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="text-xl font-bold">地板施工模擬器</h1>
      <p className="mt-1 text-sm text-zinc-500">
        超耐磨/海島型木地板平鋪 · 階段 1 驗證頁(admin 限定)
      </p>

      <div className="mt-4 grid gap-6 md:grid-cols-2">
        {/* 左:房間編輯 */}
        <section>
          <h2 className="mb-2 text-sm font-semibold">房間形狀</h2>
          <div className="mb-2 flex gap-2">
            {SHAPE_PRESETS.map((preset: ShapePreset) => (
              <button
                key={preset.id}
                className="rounded border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-50"
                onClick={() => setRoom(getPreset(preset.id))}
              >
                {preset.nameZh}
              </button>
            ))}
          </div>
          <FloorCanvasEditor room={input.room} onChange={setRoom} />
        </section>

        {/* 右:設定 + 預覽 */}
        <section>
          <h2 className="mb-2 text-sm font-semibold">排版設定</h2>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <NumField label="地板片長 (cm)" value={input.plankLengthCm}
              onChange={(v) => set("plankLengthCm", v)} />
            <NumField label="地板片寬 (cm)" value={input.plankWidthCm}
              onChange={(v) => set("plankWidthCm", v)} />
            <NumField label="伸縮縫 (mm)" value={input.expansionGapMm}
              onChange={(v) => set("expansionGapMm", v)} />
            <SelField label="鋪設方向" value={input.direction}
              opts={[["long-axis", "沿長邊"], ["short-axis", "沿短邊"]]}
              onChange={(v) => set("direction", v as FloorInput["direction"])} />
            <SelField label="錯縫" value={input.stagger}
              opts={[["half", "1/2"], ["third", "1/3"], ["random", "亂縫"]]}
              onChange={(v) => set("stagger", v as FloorInput["stagger"])} />
            <SelField label="損耗計法" value={input.wasteMode}
              opts={[["computed", "實算"], ["empirical", "經驗+10%"]]}
              onChange={(v) => set("wasteMode", v as FloorInput["wasteMode"])} />
          </div>
          <div className="mt-3">
            <FloorOverviewSvg bom={bom} width={420} />
          </div>
        </section>
      </div>

      {/* BOM */}
      <section className="mt-6">
        <h2 className="mb-2 text-sm font-semibold">材料清單</h2>
        <p className="text-sm text-zinc-600">
          房間 {bom.auto.roomAreaM2.toFixed(1)} m² / {bom.auto.pingShu.toFixed(1)} 坪 ·
          周長 {bom.auto.perimeterM.toFixed(1)} m
        </p>
        <table className="mt-2 w-full border-collapse text-sm">
          <tbody>
            {bom.items.map((it, i) => (
              <tr key={i} className="border-b border-zinc-100">
                <td className="py-1 font-medium">{it.nameZh}</td>
                <td className="py-1 text-zinc-500">{it.spec}</td>
                <td className="py-1 text-right">
                  {it.count != null && `${it.count} 片`}
                  {it.totalLengthM != null && `${it.totalLengthM.toFixed(1)} m`}
                  {it.totalAreaM2 != null && `${it.totalAreaM2.toFixed(1)} m²`}
                </td>
                <td className="py-1 pl-3 text-xs text-zinc-400">{it.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-zinc-400">
          整片 {bom.trace.fullPlankCount} + 裁切{" "}
          {bom.trace.cutPieceCount} 片(餘料優化後用新料 {bom.trace.cutPlankCount} 片)={" "}
          {bom.trace.totalPlankCount} 片 · {bom.trace.plankRows} 排 · 損耗{" "}
          {bom.trace.wastePercent.toFixed(1)}%
        </p>
        {bom.trace.offcutReuseLog.length > 0 && (
          <details className="mt-1 text-xs text-zinc-400">
            <summary className="cursor-pointer">
              餘料再利用明細({bom.trace.offcutReuseLog.length} 筆)
            </summary>
            <ul className="mt-1 space-y-0.5 pl-4">
              {bom.trace.offcutReuseLog.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          </details>
        )}
      </section>
    </main>
  );
}

function NumField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-0.5">
      <span className="text-zinc-500">{label}</span>
      <input
        type="number"
        className="rounded border border-zinc-300 px-2 py-1"
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
      />
    </label>
  );
}

function SelField({
  label,
  value,
  opts,
  onChange,
}: {
  label: string;
  value: string;
  opts: [string, string][];
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-0.5">
      <span className="text-zinc-500">{label}</span>
      <select
        className="rounded border border-zinc-300 px-2 py-1"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {opts.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}
