"use client";

/**
 * /floor Client UI — 第一性原理版面:
 *   左欄=輸入(照決策順序:① 房間 → ② 地板 → ③ 鋪法細節 → ④ 估價),
 *   右欄=結果面板(sticky,總價/片數/損耗摘要 + 2D 預覽 + 材料清單),
 *   不管在改哪個輸入,結果永遠在眼前。任何輸入變更 → 即時 computeFloorBom 重算。
 */
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { computeFloorBom } from "@/lib/floor/calc";
import { encodeState } from "@/lib/engineering-quote/url-codec";
import { DEFAULT_FLOOR_INPUT, type FloorInput, type RoomPolygon } from "@/lib/floor/types";
import {
  SHAPE_PRESETS,
  getPreset,
  PLANK_PRESETS,
  type ShapePreset,
} from "@/lib/floor/presets";
import {
  boundingBox,
  scalePolygonToBBox,
  polygonSelfIntersects,
} from "@/lib/floor/geometry";
import { FloorOverviewSvg } from "@/lib/floor/FloorOverviewSvg";
import { FloorCanvasEditor } from "./FloorCanvasEditor";
import { FloorRangeInput } from "./FloorRangeInput";

export function FloorDevClient() {
  const router = useRouter();
  const [input, setInput] = useState<FloorInput>(DEFAULT_FLOOR_INPUT);
  const bom = useMemo(() => computeFloorBom(input), [input]);
  const [copied, setCopied] = useState(false);

  const set = <K extends keyof FloorInput>(k: K, v: FloorInput[K]) =>
    setInput((p) => ({ ...p, [k]: v }));
  const setRoom = (room: RoomPolygon) => setInput((p) => ({ ...p, room }));

  const roomBox = boundingBox(input.room);
  const roomW = roomBox.maxX - roomBox.minX;
  const roomD = roomBox.maxY - roomBox.minY;
  const roomBroken = polygonSelfIntersects(input.room);

  const copyBom = () => {
    const lines = [
      "【地板施工材料清單】",
      `房間 ${bom.auto.roomAreaM2.toFixed(1)} m² / ${bom.auto.pingShu.toFixed(1)} 坪 · 周長 ${bom.auto.perimeterM.toFixed(1)} m`,
      `鋪法:${input.pattern === "herringbone" ? "人字拼" : "直鋪錯縫"} · 地板 ${input.plankLengthCm}×${input.plankWidthCm}cm`,
      "──────────",
      ...bom.items.map((it) => {
        const qty =
          it.count != null
            ? `${it.count} 片`
            : it.totalLengthM != null
              ? `${it.totalLengthM.toFixed(1)} m`
              : it.totalAreaM2 != null
                ? `${it.totalAreaM2.toFixed(1)} m²`
                : "";
        const money =
          it.subtotal != null ? `  NT$ ${Math.round(it.subtotal).toLocaleString()}` : "";
        return `${it.nameZh} ${it.spec}  ${qty}${money}`;
      }),
      "──────────",
      bom.cost.total > 0
        ? `總計 NT$ ${Math.round(bom.cost.total).toLocaleString()}${bom.cost.hasUnpriced ? "(部分品項未報價)" : ""}`
        : "(未設定報價)",
      `損耗 ${bom.trace.wastePercent.toFixed(1)}%`,
    ];
    navigator.clipboard.writeText(lines.join("\n")).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <main className="mx-auto max-w-6xl p-6">
      <h1 className="text-xl font-bold">地板施工模擬器</h1>
      <p className="mt-1 text-sm text-zinc-500">
        超耐磨/海島型木地板 · 直鋪與人字拼排版算料、材料估價
      </p>

      <div className="mt-4 grid gap-6 md:grid-cols-[1fr_minmax(360px,400px)] md:items-start">
        {/* ───── 左:輸入(照決策順序) ───── */}
        <div className="space-y-4">
          {/* ① 房間 */}
          <section className="rounded-lg border border-zinc-200 p-4">
            <h2 className="mb-3 text-sm font-semibold">① 房間</h2>
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
              <FloorRangeInput label="總寬" unit="cm" value={Math.round(roomW)}
                min={100} max={1500} step={10}
                onChange={(v) => setRoom(scalePolygonToBBox(input.room, v, roomD))} />
              <FloorRangeInput label="總深" unit="cm" value={Math.round(roomD)}
                min={100} max={1500} step={10}
                onChange={(v) => setRoom(scalePolygonToBBox(input.room, roomW, v))} />
            </div>
            <FloorCanvasEditor room={input.room} onChange={setRoom} />
            <p className="mt-2 text-xs text-zinc-400">
              拉桿或打字設定外框,缺口比例隨之等比;拖角點微調,
              或點邊上的數字直接輸入該邊長度。
            </p>
            {roomBroken && (
              <p className="mt-2 rounded bg-red-50 px-2 py-1 text-xs text-red-600">
                ⚠ 房間外框線交叉了(自交多邊形),算料與預覽會失準。請把形狀調正常。
              </p>
            )}
          </section>

          {/* ② 地板 */}
          <section className="rounded-lg border border-zinc-200 p-4">
            <h2 className="mb-3 text-sm font-semibold">② 地板</h2>
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
              <div className="col-span-2">
                <SelField label="鋪設樣式" value={input.pattern}
                  opts={[
                    ["straight", "直鋪錯縫"],
                    ["herringbone", "人字拼(對牆 45°)"],
                  ]}
                  onChange={(v) => set("pattern", v as FloorInput["pattern"])} />
              </div>
            </div>
          </section>

          {/* ③ 鋪法細節(可收合) */}
          <details className="rounded-lg border border-zinc-200 p-4">
            <summary className="cursor-pointer text-sm font-semibold">
              ③ 鋪法細節
            </summary>
            <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
              <FloorRangeInput label="伸縮縫" unit="mm" value={input.expansionGapMm}
                min={0} max={20} step={1}
                onChange={(v) => set("expansionGapMm", v)} />
              <SelField label="損耗計法" value={input.wasteMode}
                opts={[["computed", "實算"], ["empirical", "經驗+10%"]]}
                onChange={(v) => set("wasteMode", v as FloorInput["wasteMode"])} />
              <SelField label="鋪設方向" value={input.direction}
                disabled={input.pattern === "herringbone"}
                opts={[["long-axis", "沿長邊"], ["short-axis", "沿短邊"]]}
                onChange={(v) => set("direction", v as FloorInput["direction"])} />
              <SelField label="錯縫" value={input.stagger}
                disabled={input.pattern === "herringbone"}
                opts={[["half", "1/2"], ["third", "1/3"], ["random", "亂縫"]]}
                onChange={(v) => set("stagger", v as FloorInput["stagger"])} />
              <SelField label="起鋪角" value={input.startCorner}
                disabled={input.pattern === "herringbone"}
                opts={[
                  ["top-left", "左上"],
                  ["top-right", "右上"],
                  ["bottom-left", "左下"],
                  ["bottom-right", "右下"],
                  ["center", "中央置中"],
                ]}
                onChange={(v) => set("startCorner", v as FloorInput["startCorner"])} />
            </div>
          </details>

          {/* ④ 估價 / 門洞(可收合) */}
          <details className="rounded-lg border border-zinc-200 p-4">
            <summary className="cursor-pointer text-sm font-semibold">
              ④ 估價 / 門洞
            </summary>
            <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
              <FloorRangeInput label="門洞數量" unit="個" value={input.doorCount}
                min={0} max={10} step={1}
                onChange={(v) => set("doorCount", v)} />
              <FloorRangeInput label="門洞寬度" unit="cm" value={input.doorWidthCm}
                min={60} max={200} step={5}
                onChange={(v) => set("doorWidthCm", v)} />
              <FloorRangeInput label="地板每坪" unit="元" value={input.plankPricePerPing}
                min={0} max={20000} step={50}
                onChange={(v) => set("plankPricePerPing", v)} />
              <FloorRangeInput label="踢腳板每米" unit="元" value={input.skirtingPricePerM}
                min={0} max={2000} step={10}
                onChange={(v) => set("skirtingPricePerM", v)} />
              <FloorRangeInput label="防潮墊每坪" unit="元" value={input.underlayPricePerPing}
                min={0} max={3000} step={10}
                onChange={(v) => set("underlayPricePerPing", v)} />
            </div>
          </details>
        </div>

        {/* ───── 右:結果面板(sticky) ───── */}
        <div className="space-y-3 md:sticky md:top-4">
          {/* 頭條:總價 */}
          <div className="rounded-lg border border-[#bd9955]/40 bg-[#bd9955]/10 p-3">
            <div className="text-xs text-zinc-500">預估總價</div>
            <div className="text-2xl font-bold text-[#8a6d3b]">
              {bom.cost.total > 0
                ? `NT$ ${Math.round(bom.cost.total).toLocaleString()}`
                : "未設定報價"}
            </div>
            {bom.cost.total > 0 && bom.cost.hasUnpriced && (
              <div className="text-[11px] text-amber-600">部分品項未報價</div>
            )}
          </div>
          {/* 摘要數字 */}
          <div className="grid grid-cols-3 gap-2">
            <Stat label="總片數" value={`${bom.trace.totalPlankCount}`} unit="片" />
            <Stat label="損耗" value={bom.trace.wastePercent.toFixed(1)} unit="%" />
            <Stat label="坪數" value={bom.auto.pingShu.toFixed(1)} unit="坪" />
          </div>

          {/* 2D 預覽 */}
          <FloorOverviewSvg bom={bom} width={388} />

          {/* 材料清單 */}
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
              房間 {bom.auto.roomAreaM2.toFixed(1)} m² · 周長{" "}
              {bom.auto.perimeterM.toFixed(1)} m
            </p>
            <table className="mt-2 w-full border-collapse text-xs">
              <tbody>
                {bom.items.map((it, i) => (
                  <tr key={i} className="border-b border-zinc-100">
                    <td className="py-1 font-medium">{it.nameZh}</td>
                    <td className="py-1 text-right whitespace-nowrap">
                      {it.count != null && `${it.count} 片`}
                      {it.totalLengthM != null && `${it.totalLengthM.toFixed(1)} m`}
                      {it.totalAreaM2 != null && `${it.totalAreaM2.toFixed(1)} m²`}
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
            <p className="mt-2 text-[11px] text-zinc-400">
              整片 {bom.trace.fullPlankCount} + 裁切 {bom.trace.cutPieceCount} 片
              (餘料優化後用新料 {bom.trace.cutPlankCount} 片)= {bom.trace.totalPlankCount} 片 ·{" "}
              {bom.trace.plankRows} 排 · 損耗 {bom.trace.wastePercent.toFixed(1)}%
            </p>
            {bom.trace.offcutReuseLog.length > 0 && (
              <details className="mt-1 text-[11px] text-zinc-400">
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
            <button
              onClick={() =>
                router.push(`/floor/quote?d=${encodeURIComponent(encodeState(input))}`)
              }
              className="mt-3 w-full rounded bg-[#bd9955] py-2 text-sm font-semibold text-white hover:opacity-90 transition"
            >
              🧾 產生報價單
            </button>
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
