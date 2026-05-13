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
}

export function MobileOptionField({ spec, value, allValues }: MobileOptionFieldProps) {
  if (spec.type === "number") {
    return (
      <RangeInput
        name={spec.key}
        label={spec.label}
        defaultValue={Number(value)}
        unit={spec.unit ?? ""}
        min={spec.min ?? 0}
        max={spec.max ?? 9999}
        step={spec.step ?? 1}
        help={spec.help}
      />
    );
  }
  if (spec.type === "select") {
    const visibleChoices = spec.choices.filter(
      (c) => !c.dependsOn || (allValues && evalDep(c.dependsOn, allValues)),
    );
    return (
      <label className="flex flex-col gap-1 text-sm" title={spec.help}>
        <span className="text-zinc-700 font-medium">{spec.label}</span>
        <select
          name={spec.key}
          defaultValue={String(value)}
          className="min-h-[44px] border border-zinc-300 rounded-md px-3 py-2 bg-white text-zinc-900 text-base"
        >
          {visibleChoices.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
        {spec.help && <span className="text-xs text-zinc-500">{spec.help}</span>}
      </label>
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
