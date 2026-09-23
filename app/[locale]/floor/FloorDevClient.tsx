"use client";

/**
 * /floor Client UI — 第一性原理版面:
 *   左欄=輸入(照決策順序:① 房間 → ② 地板 → ③ 鋪法細節 → ④ 估價),
 *   右欄=結果面板(sticky,總價/片數/損耗摘要 + 2D 預覽 + 材料清單),
 *   不管在改哪個輸入,結果永遠在眼前。任何輸入變更 → 即時 computeFloorBom 重算。
 */
import { useMemo, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations, useLocale } from "next-intl";
import { computeFloorBom } from "@/lib/floor/calc";
import { encodeState } from "@/lib/engineering-quote/url-codec";
import {
  DEFAULT_FLOOR_INPUT,
  floorBomItemName,
  floorBomItemSpec,
  type FloorInput,
  type RoomPolygon,
} from "@/lib/floor/types";
import {
  SHAPE_PRESETS,
  getPreset,
  PLANK_PRESETS,
  presetName,
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
import { useCurrency } from "@/hooks/useCurrency";
import { formatPrice } from "@/lib/units/fx";

export function FloorDevClient() {
  const router = useRouter();
  const t = useTranslations("floorTool");
  const locale = useLocale();
  const currency = useCurrency();
  const [input, setInput] = useState<FloorInput>(DEFAULT_FLOOR_INPUT);
  const bom = useMemo(() => computeFloorBom(input, locale), [input, locale]);
  const [copied, setCopied] = useState(false);
  const fmt = (n: number) => formatPrice(n, currency);

  const set = <K extends keyof FloorInput>(k: K, v: FloorInput[K]) =>
    setInput((p) => ({ ...p, [k]: v }));
  const setRoom = (room: RoomPolygon) => setInput((p) => ({ ...p, room }));

  const roomBox = boundingBox(input.room);
  const roomW = roomBox.maxX - roomBox.minX;
  const roomD = roomBox.maxY - roomBox.minY;
  const roomBroken = polygonSelfIntersects(input.room);

  const patternLabel =
    input.pattern === "herringbone" ? t("patternHerringbone") : t("patternStraight");

  const copyBom = () => {
    const lines = [
      t("copyTitle"),
      t("copyRoomLine", {
        area: bom.auto.roomAreaM2.toFixed(1),
        ping: bom.auto.pingShu.toFixed(1),
        perimeter: bom.auto.perimeterM.toFixed(1),
      }),
      t("copyPatternLine", {
        pattern: patternLabel,
        lengthCm: input.plankLengthCm,
        widthCm: input.plankWidthCm,
      }),
      t("copyDivider"),
      ...bom.items.map((it) => {
        const qty =
          it.count != null
            ? `${it.count} ${t("unitPiece")}`
            : it.totalLengthM != null
              ? `${it.totalLengthM.toFixed(1)} ${t("unitMeter")}`
              : it.totalAreaM2 != null
                ? `${it.totalAreaM2.toFixed(1)} ${t("unitSquareMeter")}`
                : "";
        const money = it.subtotal != null ? `  ${fmt(it.subtotal)}` : "";
        return `${floorBomItemName(it, locale)} ${floorBomItemSpec(it, locale)}  ${qty}${money}`;
      }),
      t("copyDivider"),
      bom.cost.total > 0
        ? t("copyTotalLine", { total: fmt(bom.cost.total) }) +
          (bom.cost.hasUnpriced ? t("copyTotalUnpricedSuffix") : "")
        : t("copyNoQuoteLine"),
      t("copyWasteLine", { waste: bom.trace.wastePercent.toFixed(1) }),
    ];
    navigator.clipboard.writeText(lines.join("\n")).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <main className="mx-auto max-w-6xl p-6">
      <h1 className="text-xl font-bold">{t("h1")}</h1>
      <p className="mt-1 text-sm text-zinc-500">{t("subtitle")}</p>

      <div className="mt-4 flex flex-col gap-6 md:grid md:grid-cols-[1fr_minmax(360px,400px)] md:items-start">
        {/* ───── 左:輸入(照決策順序) ───── */}
        <div className="space-y-4">
          {/* ① 房間 */}
          <section className="rounded-lg border border-zinc-200 p-4">
            <h2 className="mb-3 text-sm font-semibold">{t("section1Room")}</h2>
            <div className="mb-2 flex flex-wrap gap-2">
              {SHAPE_PRESETS.map((preset: ShapePreset) => (
                <button
                  key={preset.id}
                  className="rounded border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-50"
                  onClick={() => setRoom(getPreset(preset.id))}
                >
                  {presetName(preset, locale)}
                </button>
              ))}
            </div>
            <div className="mb-3 grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-2">
              <FloorRangeInput label={t("totalWidth")} unit={t("unitCm")} value={Math.round(roomW)}
                min={100} max={1500} step={10}
                onChange={(v) => setRoom(scalePolygonToBBox(input.room, v, roomD))} />
              <FloorRangeInput label={t("totalDepth")} unit={t("unitCm")} value={Math.round(roomD)}
                min={100} max={1500} step={10}
                onChange={(v) => setRoom(scalePolygonToBBox(input.room, roomW, v))} />
            </div>
            <FloorCanvasEditor room={input.room} onChange={setRoom} />
            <p className="mt-2 text-xs text-zinc-400">{t("canvasHint")}</p>
            {roomBroken && (
              <p className="mt-2 rounded bg-red-50 px-2 py-1 text-xs text-red-600">
                {t("selfIntersectWarning")}
              </p>
            )}
          </section>

          {/* ② 地板 */}
          <section className="rounded-lg border border-zinc-200 p-4">
            <h2 className="mb-3 text-sm font-semibold">{t("section2Plank")}</h2>
            <div className="mb-1 text-xs text-zinc-500">{t("presetLabel")}</div>
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
                    <span className="block font-medium">{presetName(p, locale)}</span>
                    <span className="block text-[10px] text-zinc-400">
                      {t("presetSpecFormat", {
                        lengthCm: p.lengthCm,
                        widthCm: p.widthCm,
                        gapMm: p.gapMm,
                      })}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="grid grid-cols-1 gap-x-3 gap-y-2 text-xs">
              <FloorRangeInput label={t("plankLength")} unit={t("unitCm")} value={input.plankLengthCm}
                min={30} max={250} step={1}
                onChange={(v) => set("plankLengthCm", v)} />
              <FloorRangeInput label={t("plankWidth")} unit={t("unitCm")} value={input.plankWidthCm}
                min={5} max={40} step={0.5}
                onChange={(v) => set("plankWidthCm", v)} />
              <div>
                <SelField label={t("patternLabel")} value={input.pattern}
                  opts={[
                    ["straight", t("patternStraight")],
                    ["herringbone", t("patternHerringbone")],
                  ]}
                  onChange={(v) => set("pattern", v as FloorInput["pattern"])} />
              </div>
            </div>
          </section>

          {/* ③ 鋪法細節(可收合，預設打開) */}
          <details open className="rounded-lg border border-zinc-200 p-4">
            <summary className="cursor-pointer text-sm font-semibold">
              {t("section3Detail")}
            </summary>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-2 text-xs">
              <FloorRangeInput label={t("expansionGap")} unit={t("unitMm")} value={input.expansionGapMm}
                min={0} max={20} step={1}
                onChange={(v) => set("expansionGapMm", v)} />
              <SelField label={t("wasteModeLabel")} value={input.wasteMode}
                opts={[
                  ["computed", t("wasteModeComputed")],
                  ["empirical", t("wasteModeEmpirical")],
                ]}
                onChange={(v) => set("wasteMode", v as FloorInput["wasteMode"])} />
              <SelField label={t("directionLabel")} value={input.direction}
                disabled={input.pattern === "herringbone"}
                opts={[
                  ["long-axis", t("directionLongAxis")],
                  ["short-axis", t("directionShortAxis")],
                ]}
                onChange={(v) => set("direction", v as FloorInput["direction"])} />
              <SelField label={t("staggerLabel")} value={input.stagger}
                disabled={input.pattern === "herringbone"}
                opts={[
                  ["half", t("staggerHalf")],
                  ["third", t("staggerThird")],
                  ["random", t("staggerRandom")],
                ]}
                onChange={(v) => set("stagger", v as FloorInput["stagger"])} />
              <SelField label={t("startCornerLabel")} value={input.startCorner}
                disabled={input.pattern === "herringbone"}
                opts={[
                  ["top-left", t("startTopLeft")],
                  ["top-right", t("startTopRight")],
                  ["bottom-left", t("startBottomLeft")],
                  ["bottom-right", t("startBottomRight")],
                  ["center", t("startCenter")],
                ]}
                onChange={(v) => set("startCorner", v as FloorInput["startCorner"])} />
            </div>
          </details>

        </div>

        {/* ───── 右:結果面板 ───── */}
        <div className="space-y-3">
          {/* 2D 預覽 + 摘要數字 — 桌面版 sticky 在畫面最上方,捲動時始終可見 */}
          <div className="md:sticky md:top-4 md:z-10 space-y-3 bg-white md:bg-transparent">
            <FloorOverviewSvg bom={bom} width={388} locale={locale} />
            <div className="grid grid-cols-3 gap-2">
              <Stat label={t("statTotalPlanks")} value={`${bom.trace.totalPlankCount}`} unit={t("unitPiece")} />
              <Stat label={t("statWaste")} value={bom.trace.wastePercent.toFixed(1)} unit={t("unitPercent")} />
              <Stat label={t("statPing")} value={bom.auto.pingShu.toFixed(1)} unit={t("unitPing")} />
            </div>
          </div>

          {/* ④ 估價 / 門洞(可收合) — 跟材料清單相鄰，改參數立刻看影響 */}
          <details className="rounded-lg border border-zinc-200 p-4">
            <summary className="cursor-pointer text-sm font-semibold">
              {t("section4Price")}
            </summary>
            <div className="mt-3 grid grid-cols-1 gap-x-3 gap-y-2 text-xs">
              <FloorRangeInput label={t("doorCount")} unit={t("unitCount")} value={input.doorCount}
                min={0} max={10} step={1}
                onChange={(v) => set("doorCount", v)} />
              <FloorRangeInput label={t("doorWidth")} unit={t("unitCm")} value={input.doorWidthCm}
                min={60} max={200} step={5}
                onChange={(v) => set("doorWidthCm", v)} />
              <FloorRangeInput label={t("plankPricePerPing")} unit={t("unitYuan")} value={input.plankPricePerPing}
                min={0} max={20000} step={50}
                onChange={(v) => set("plankPricePerPing", v)} />
              <FloorRangeInput label={t("skirtingPricePerM")} unit={t("unitYuan")} value={input.skirtingPricePerM}
                min={0} max={2000} step={10}
                onChange={(v) => set("skirtingPricePerM", v)} />
              <FloorRangeInput label={t("underlayPricePerPing")} unit={t("unitYuan")} value={input.underlayPricePerPing}
                min={0} max={3000} step={10}
                onChange={(v) => set("underlayPricePerPing", v)} />
            </div>
          </details>

          {/* 材料清單 */}
          <div className="rounded-lg border border-zinc-200 p-3">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold">{t("bomTitle")}</h2>
              <button
                onClick={copyBom}
                className="rounded border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-50"
              >
                {copied ? t("copyDone") : t("copyButton")}
              </button>
            </div>
            <p className="text-xs text-zinc-500">
              {t("roomSummary", {
                area: bom.auto.roomAreaM2.toFixed(1),
                perimeter: bom.auto.perimeterM.toFixed(1),
              })}
            </p>
            <table className="mt-2 w-full border-collapse text-xs">
              <tbody>
                {bom.items.map((it, i) => (
                  <tr key={i} className="border-b border-zinc-100">
                    <td className="py-1 font-medium">{floorBomItemName(it, locale)}</td>
                    <td className="py-1 text-right whitespace-nowrap">
                      {it.count != null && `${it.count} ${t("unitPiece")}`}
                      {it.totalLengthM != null && `${it.totalLengthM.toFixed(1)} ${t("unitMeter")}`}
                      {it.totalAreaM2 != null && `${it.totalAreaM2.toFixed(1)} ${t("unitSquareMeter")}`}
                    </td>
                    <td className="py-1 pl-2 text-right whitespace-nowrap text-zinc-700">
                      {it.subtotal != null ? fmt(it.subtotal) : t("noPrice")}
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 border-zinc-300">
                  <td className="py-1 font-semibold" colSpan={2}>
                    {t("totalRow")}
                  </td>
                  <td className="py-1 pl-2 text-right font-semibold whitespace-nowrap">
                    {bom.cost.total > 0 ? fmt(bom.cost.total) : t("noPrice")}
                  </td>
                </tr>
              </tbody>
            </table>
            <p className="mt-2 text-[11px] text-zinc-400">
              {t("traceLine", {
                full: bom.trace.fullPlankCount,
                cut: bom.trace.cutPieceCount,
                newSheets: bom.trace.cutPlankCount,
                total: bom.trace.totalPlankCount,
                rows: bom.trace.plankRows,
                waste: bom.trace.wastePercent.toFixed(1),
              })}
            </p>
            {bom.trace.offcutReuseLog.length > 0 && (
              <details className="mt-1 text-[11px] text-zinc-400">
                <summary className="cursor-pointer">
                  {t("offcutReuseHeading", { count: bom.trace.offcutReuseLog.length })}
                </summary>
                <ul className="mt-1 space-y-0.5 pl-4">
                  {bom.trace.offcutReuseLog.map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
              </details>
            )}
          </div>

          {/* 預估總價 — 放最下方,跟產生報價單按鈕相鄰 */}
          <div className="rounded-lg border border-[#bd9955]/40 bg-[#bd9955]/10 p-3">
            <div className="text-xs text-zinc-500">{t("estimatedTotal")}</div>
            <div className="text-2xl font-bold text-[#8a6d3b]">
              {bom.cost.total > 0 ? fmt(bom.cost.total) : t("noQuote")}
            </div>
            {bom.cost.total > 0 && bom.cost.hasUnpriced && (
              <div className="text-[11px] text-amber-600">{t("partiallyPriced")}</div>
            )}
          </div>
          <button
            onClick={() =>
              router.push(`/floor/quote?d=${encodeURIComponent(encodeState(input))}`)
            }
            className="w-full rounded bg-[#bd9955] py-2 text-sm font-semibold text-white hover:opacity-90 transition"
          >
            {t("generateQuoteButton")}
          </button>
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
