"use client";

import type { OptionSpec, OptionDependency } from "@/lib/types";
import { RangeInput } from "./RangeInput";

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

export function MobileOptionField({ spec, value, allValues, overallHeight }: MobileOptionFieldProps) {
  if (spec.type === "number") {
    const rawMax = spec.max ?? 9999;
    const cappedMax =
      overallHeight !== undefined && overallHeight > 0 && isHeightKey(spec.key)
        ? Math.min(rawMax, overallHeight)
        : rawMax;
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
  return (
    <label
      className="flex items-center justify-between gap-2 min-h-[44px] text-sm"
      title={spec.help}
    >
      <span className="text-zinc-800 flex-1">{spec.label}</span>
      <input
        type="checkbox"
        name={spec.key}
        defaultChecked={Boolean(value)}
        className="w-12 h-6 accent-violet-600"
      />
    </label>
  );
}
