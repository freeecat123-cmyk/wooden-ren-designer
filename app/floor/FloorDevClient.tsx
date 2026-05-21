"use client";

/**
 * /floor Client UI:房間編輯器 + 範本 + 設定表單 + 排版預覽 + BOM。
 * 任何輸入變更 → 即時 computeFloorBom 重算。
 */
import { useMemo, useState } from "react";
import { computeFloorBom } from "@/lib/floor/calc";
import { DEFAULT_FLOOR_INPUT, type FloorInput, type RoomPolygon } from "@/lib/floor/types";
import {
  SHAPE_PRESETS,
  getPreset,
  PLANK_PRESETS,
  type ShapePreset,
} from "@/lib/floor/presets";
import { boundingBox, scalePolygonToBBox } from "@/lib/floor/geometry";
import { FloorOverviewSvg } from "@/lib/floor/FloorOverviewSvg";
import { FloorCanvasEditor } from "./FloorCanvasEditor";
import { FloorRangeInput } from "./FloorRangeInput";

export function FloorDevClient() {
  const [input, setInput] = useState<FloorInput>(DEFAULT_FLOOR_INPUT);
  const bom = useMemo(() => computeFloorBom(input), [input]);

  const set = <K extends keyof FloorInput>(k: K, v: FloorInput[K]) =>
    setInput((p) => ({ ...p, [k]: v }));
  const setRoom = (room: RoomPolygon) => setInput((p) => ({ ...p, room }));

  const roomBox = boundingBox(input.room);
  const roomW = roomBox.maxX - roomBox.minX;
  const roomD = roomBox.maxY - roomBox.minY;

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
          <div className="mb-2 flex flex-wrap gap-2">
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
          <div className="mb-3 grid grid-cols-2 gap-x-3 gap-y-2">
            <FloorRangeInput
              label="總寬"
              unit="cm"
              value={Math.round(roomW)}
              min={100}
              max={1500}
              step={10}
              onChange={(v) => setRoom(scalePolygonToBBox(input.room, v, roomD))}
            />
            <FloorRangeInput
              label="總深"
              unit="cm"
              value={Math.round(roomD)}
              min={100}
              max={1500}
              step={10}
              onChange={(v) => setRoom(scalePolygonToBBox(input.room, roomW, v))}
            />
          </div>
          <FloorCanvasEditor room={input.room} onChange={setRoom} />
          <p className="mt-2 text-xs text-zinc-400">
            拉桿或打字設定房間外框,缺口比例隨之等比;拖角點可微調,
            或點邊上的數字直接輸入該邊長度(斜邊只顯示、不可改)。
          </p>
        </section>

        {/* 右:設定 + 預覽 */}
        <section>
          <h2 className="mb-2 text-sm font-semibold">排版設定</h2>
          <div className="mb-3 text-xs">
            <SelField
              label="鋪設樣式"
              value={input.pattern}
              opts={[
                ["straight", "直鋪錯縫"],
                ["herringbone", "人字拼(對牆 45°)"],
              ]}
              onChange={(v) => set("pattern", v as FloorInput["pattern"])}
            />
          </div>
          <div className="mb-1 text-xs text-zinc-500">常用地板尺寸</div>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {PLANK_PRESETS.map((p) => {
              const active =
                input.plankLengthCm === p.lengthCm &&
                input.plankWidthCm === p.widthCm &&
                input.expansionGapMm === p.gapMm;
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
                      expansionGapMm: p.gapMm,
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
          <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
            <FloorRangeInput label="地板片長" unit="cm" value={input.plankLengthCm}
              min={30} max={250} step={1}
              onChange={(v) => set("plankLengthCm", v)} />
            <FloorRangeInput label="地板片寬" unit="cm" value={input.plankWidthCm}
              min={5} max={40} step={0.5}
              onChange={(v) => set("plankWidthCm", v)} />
            <FloorRangeInput label="伸縮縫" unit="mm" value={input.expansionGapMm}
              min={0} max={20} step={1}
              onChange={(v) => set("expansionGapMm", v)} />
            <SelField label="鋪設方向" value={input.direction}
              disabled={input.pattern === "herringbone"}
              opts={[["long-axis", "沿長邊"], ["short-axis", "沿短邊"]]}
              onChange={(v) => set("direction", v as FloorInput["direction"])} />
            <SelField label="錯縫" value={input.stagger}
              disabled={input.pattern === "herringbone"}
              opts={[["half", "1/2"], ["third", "1/3"], ["random", "亂縫"]]}
              onChange={(v) => set("stagger", v as FloorInput["stagger"])} />
            <SelField label="損耗計法" value={input.wasteMode}
              opts={[["computed", "實算"], ["empirical", "經驗+10%"]]}
              onChange={(v) => set("wasteMode", v as FloorInput["wasteMode"])} />
          </div>
          <div className="mt-3">
            <FloorOverviewSvg bom={bom} width={420} />
          </div>

          {/* 材料清單 */}
          <h2 className="mb-2 mt-5 text-sm font-semibold">材料清單</h2>
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
      </div>
    </main>
  );
}

function SelField({
  label,
  value,
  opts,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  opts: [string, string][];
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className={`flex flex-col gap-0.5 ${disabled ? "opacity-40" : ""}`}>
      <span className="text-zinc-500">{label}</span>
      <select
        className="rounded border border-zinc-300 px-2 py-1 disabled:cursor-not-allowed"
        value={value}
        disabled={disabled}
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
