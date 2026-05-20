"use client";

import type { OptionSpec, OptionDependency } from "@/lib/types";
import { RangeInput } from "./RangeInput";
import { resolvePartIds } from "@/lib/design/option-part-map";

export function evalDep(
  dep: OptionDependency,
  values: Record<string, string | number | boolean>,
): boolean {
  if (dep.all) return dep.all.every((d) => evalDep(d, values));
  if (dep.any) return dep.any.some((d) => evalDep(d, values));
  if (!dep.key) return true;
  const v = values[dep.key];
  if (dep.notIn && dep.notIn.includes(v as string | number | boolean)) return false;
  if (dep.oneOf && !dep.oneOf.includes(v as string | number | boolean)) return false;
  if (dep.equals !== undefined && v !== dep.equals) return false;
  if (dep.equals === undefined && dep.notIn === undefined && dep.oneOf === undefined && !v)
    return false;
  return true;
}

interface MobileOptionFieldProps {
  spec: OptionSpec;
  value: string | number | boolean;
  allValues?: Record<string, string | number | boolean>;
  /** 家具整體高度（mm）。傳入時，所有 *Height key 的滑桿 max 會被夾到 ≤ overallHeight，
   *  避免使用者看到拉桿上限 1500 但家具總高才 800 的不合理情境。 */
  overallHeight?: number;
  /** 家具整體長度（mm）。給橫向欄寬欄位（leftWidthMm 等）動態夾 max 用。 */
  overallLength?: number;
  /** 所有 3D part.id，用於把 spec.key 對應到部件 hover 高亮。 */
  allPartIds?: string[];
}

/** key 看起來是「高度類」欄位嗎？用來決定是否要夾 overallHeight 上限。
 *  排除 wallHeight / ceilingHeight 等明顯是「空間環境」非「家具部件」的 key。 */
function isHeightKey(key: string): boolean {
  const k = key.toLowerCase();
  if (!k.includes("height")) return false;
  if (k === "height") return false; // 家具總高本身
  if (k.startsWith("wall") || k.startsWith("ceiling") || k.startsWith("room")) return false;
  return true;
}

// 鎖定總高時參與分配內高的欄位（含鞋櫃的 upperHeight/lowerHeight）
const LOCKED_ZONE_HEIGHT_KEYS = ["topHeight", "midHeight", "bottomHeight", "upperHeight", "lowerHeight"];

// 橫向分欄寬度欄位：依 layoutMode + 其他欄寬動態夾 max
const COLUMN_WIDTH_KEYS = ["leftWidthMm", "rightWidthMm", "singleLayerLeftWidthMm", "singleLayerRightWidthMm"];

function computeColumnWidthMax(
  key: string,
  allValues: Record<string, string | number | boolean>,
  overallLength: number,
): number | null {
  const MIN_COL = 80;
  const panelT = Number(allValues.panelThickness) || 18;
  const layoutMode = String(allValues.layoutMode ?? "");
  const innerW = overallLength - 2 * panelT;
  // 媒體櫃 h-2col：只用 leftWidthMm，右欄自動填滿
  if (key === "leftWidthMm" && layoutMode === "h-2col") {
    const usableW = innerW - panelT;
    return Math.max(MIN_COL, usableW - MIN_COL);
  }
  // 媒體櫃 h-3col：left + right ≤ usableW - 80（中欄留 80）
  if ((key === "leftWidthMm" || key === "rightWidthMm") && layoutMode === "h-3col") {
    const usableW = innerW - 2 * panelT;
    const otherKey = key === "leftWidthMm" ? "rightWidthMm" : "leftWidthMm";
    const other = Math.max(MIN_COL, Number(allValues[otherKey]) || 0);
    return Math.max(MIN_COL, usableW - other - MIN_COL);
  }
  // 縱向 1 層 / 2 層上層分欄
  const singleCols = parseInt(String(allValues.singleLayerCols ?? "1"), 10) || 1;
  const inVertical = layoutMode === "v-1layer" || layoutMode === "v-2layer";
  if (key === "singleLayerLeftWidthMm" && inVertical && singleCols >= 2) {
    if (singleCols === 2) {
      const usableW = innerW - panelT;
      return Math.max(MIN_COL, usableW - MIN_COL);
    }
    // singleCols === 3
    const usableW = innerW - 2 * panelT;
    const other = Math.max(MIN_COL, Number(allValues.singleLayerRightWidthMm) || 0);
    return Math.max(MIN_COL, usableW - other - MIN_COL);
  }
  if (key === "singleLayerRightWidthMm" && inVertical && singleCols === 3) {
    const usableW = innerW - 2 * panelT;
    const other = Math.max(MIN_COL, Number(allValues.singleLayerLeftWidthMm) || 0);
    return Math.max(MIN_COL, usableW - other - MIN_COL);
  }
  return null;
}

export function MobileOptionField({ spec, value, allValues, overallHeight, overallLength, allPartIds }: MobileOptionFieldProps) {
  if (spec.type === "number") {
    const rawMax = spec.max ?? 9999;
    let cappedMax =
      overallHeight !== undefined && overallHeight > 0 && isHeightKey(spec.key)
        ? Math.min(rawMax, overallHeight)
        : rawMax;
    // 橫向欄寬欄位：依 layoutMode + 其他欄寬動態夾 max
    if (
      allValues
      && overallLength !== undefined
      && overallLength > 0
      && COLUMN_WIDTH_KEYS.includes(spec.key)
    ) {
      const w = computeColumnWidthMax(spec.key, allValues, overallLength);
      if (w !== null) cappedMax = Math.min(cappedMax, w);
    }
    // 鎖定總高時，區段高度上限要扣掉其他層 + 最低腳高 30 + 上下板 2×panelT
    if (
      allValues
      && allValues.lockTotalHeight === true
      && overallHeight !== undefined
      && overallHeight > 0
      && LOCKED_ZONE_HEIGHT_KEYS.includes(spec.key)
    ) {
      const MIN_LEG = 30;
      const panelT = Number(allValues.panelThickness) || 18;
      let otherSum = 0;
      for (const k of LOCKED_ZONE_HEIGHT_KEYS) {
        if (k === spec.key) continue;
        const v = Number(allValues[k]);
        if (Number.isFinite(v) && v > 0) otherSum += v;
      }
      const innerCap = overallHeight - MIN_LEG - 2 * panelT;
      const dynamicMax = Math.max(spec.min ?? 80, innerCap - otherSum);
      cappedMax = Math.min(cappedMax, dynamicMax);
    }
    const partIds = allPartIds ? resolvePartIds(spec.key, allPartIds) : undefined;
    const dynamicMaxHint =
      cappedMax < rawMax ? `上限 ${cappedMax}（鎖總高）` : undefined;
    return (
      <RangeInput
        name={spec.key}
        label={spec.label}
        defaultValue={Number(value)}
        unit={spec.unit ?? ""}
        min={spec.min ?? 0}
        max={cappedMax}
        step={spec.step ?? 1}
        help={spec.help}
        partIds={partIds}
        dynamicMaxHint={dynamicMaxHint}
      />
    );
  }
  if (spec.type === "select") {
    const visibleChoices = spec.choices.filter(
      (c) => !c.dependsOn || (allValues && evalDep(c.dependsOn, allValues)),
    );
    const currentValue = String(value);
    // 若 server 給的 value 已被 dependsOn 過濾掉，保險起見預設選第一個可見項
    const fallbackValue = visibleChoices.some((c) => c.value === currentValue)
      ? currentValue
      : visibleChoices[0]?.value ?? currentValue;
    return (
      <fieldset className="flex flex-col gap-1.5 text-sm" title={spec.help}>
        <legend className="text-zinc-700 font-medium mb-1">{spec.label}</legend>
        <div className="flex flex-wrap gap-1.5">
          {visibleChoices.map((c) => {
            const checked = fallbackValue === c.value;
            return (
              <label
                key={c.value}
                className={`cursor-pointer rounded-md px-2.5 py-1.5 text-xs leading-snug min-h-[44px] flex items-center ring-1 transition ${
                  checked
                    ? "bg-amber-100 ring-amber-500 text-amber-900 font-semibold"
                    : "bg-white ring-zinc-200 text-zinc-700 active:bg-amber-50"
                }`}
              >
                <input
                  type="radio"
                  name={spec.key}
                  value={c.value}
                  defaultChecked={checked}
                  className="sr-only"
                />
                {c.label}
              </label>
            );
          })}
        </div>
        {spec.help && <span className="text-xs text-zinc-500">{spec.help}</span>}
      </fieldset>
    );
  }
  // checkbox / boolean
  const showLegReadout =
    spec.key === "lockTotalHeight"
    && Boolean(value)
    && allValues
    && overallHeight !== undefined
    && overallHeight > 0;
  let legReadout: { leg: number; clamped: boolean } | null = null;
  if (showLegReadout) {
    const MIN_LEG = 30;
    const panelT = Number(allValues!.panelThickness) || 18;
    let zoneSum = 0;
    for (const k of LOCKED_ZONE_HEIGHT_KEYS) {
      const v = Number(allValues![k]);
      if (Number.isFinite(v) && v > 0) zoneSum += v;
    }
    const raw = overallHeight! - zoneSum - 2 * panelT;
    legReadout = { leg: Math.max(MIN_LEG, raw), clamped: raw < MIN_LEG };
  }
  return (
    <div className="flex flex-col gap-0.5">
      <label
        className="flex items-center justify-between gap-2 min-h-[44px] text-sm"
        title={spec.help}
      >
        <span className="text-zinc-800 flex-1">{spec.label}</span>
        <input
          type="checkbox"
          name={spec.key}
          defaultChecked={Boolean(value)}
          className="w-12 h-6 accent-amber-600"
        />
      </label>
      {legReadout && (
        <div
          className={`flex items-center justify-between gap-3 rounded-md px-2.5 py-2 text-sm ring-1 ${
            legReadout.clamped
              ? "bg-red-50 ring-red-300 text-red-800"
              : "bg-amber-50 ring-amber-200 text-amber-900"
          }`}
        >
          <span className="font-medium">計算後腳高</span>
          <span className="font-mono tabular-nums text-base">
            {legReadout.leg}<span className="text-xs ml-0.5 opacity-70">mm</span>
          </span>
        </div>
      )}
      {legReadout?.clamped && (
        <span className="text-xs text-red-600 pl-0.5">已夾到最低 30mm，請降低層高或加大總高</span>
      )}
    </div>
  );
}
