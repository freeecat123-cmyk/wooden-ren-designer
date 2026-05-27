"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

interface CeilingRangeInputProps {
  /** 中文 label,如「長邊」「角材寬」 */
  label: string;
  /** 受控值 */
  value: number;
  /** 值變更 callback */
  onChange: (v: number) => void;
  /** 滑桿 min */
  min: number;
  /** 滑桿 max */
  max: number;
  /** snap 步距(整數參數=1/5,角材寬厚=0.1) */
  step?: number;
  /** 單位,如 "cm" "mm" */
  unit?: string;
  /** label 旁的小字補充,如「樓板到地」 */
  sub?: string;
  /** label 前的小圖示 */
  icon?: string;
  /** hover tooltip */
  help?: string;
  /** 鎖定(例如 useAutoSpacing 時主/副支間距唯讀) */
  disabled?: boolean;
}

/** step 收斂浮點誤差(0.1 級距拖拉常出 3.6000000000000005) */
function snap(n: number, step: number): number {
  const r = Math.round(n / step) * step;
  return Math.round(r * 1000) / 1000;
}

/**
 * /ceiling 專用拉條 — 比照家具設計器 RangeInput 外觀,
 * 但改 controlled(value + onChange),不綁表單 / hidden input。
 */
export function CeilingRangeInput({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit,
  sub,
  icon,
  help,
  disabled,
}: CeilingRangeInputProps) {
  const t = useTranslations("numberInput");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const clamp = (n: number) => (n > max ? max : n < min ? min : n);

  const commit = () => {
    const n = Number(draft);
    if (!Number.isNaN(n) && draft.trim() !== "") onChange(snap(clamp(n), step));
    setEditing(false);
  };

  // [−] / [+]:點一下走一個 step,夾到 min/max
  const stepBy = (dir: 1 | -1) => onChange(snap(clamp(value + dir * step), step));
  const atMin = value <= min;
  const atMax = value >= max;
  const stepBtn =
    "shrink-0 w-7 h-7 flex items-center justify-center rounded-md bg-stone-100 " +
    "hover:bg-stone-200 text-zinc-700 text-base leading-none font-medium " +
    "disabled:opacity-40 disabled:hover:bg-stone-100 disabled:cursor-not-allowed";

  return (
    <div className={`text-xs ${disabled ? "opacity-50" : ""}`} title={help}>
      <div className="flex items-center gap-1.5 mb-1">
        {icon && <span className="text-amber-600 leading-none">{icon}</span>}
        <span className="text-zinc-600 font-medium">{label}</span>
        {sub && <span className="text-[10px] text-zinc-400 font-normal">· {sub}</span>}
      </div>
      <div className="flex items-center gap-1.5">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={clamp(value)}
          disabled={disabled}
          onChange={(e) => onChange(snap(Number(e.target.value), step))}
          className="flex-1 min-w-0 accent-amber-600 h-5 cursor-grab disabled:cursor-not-allowed"
        />
        <button
          type="button"
          aria-label={t("decrease")}
          disabled={disabled || atMin}
          onClick={() => stepBy(-1)}
          className={stepBtn}
        >
          −
        </button>
        {editing ? (
          <input
            ref={inputRef}
            type="number"
            value={draft}
            min={min}
            max={max}
            step={step}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commit();
              }
              if (e.key === "Escape") setEditing(false);
            }}
            className="w-16 text-right border-b-2 border-amber-500 px-1 py-0.5 font-mono tabular-nums shrink-0 focus:outline-none"
            inputMode="decimal"
          />
        ) : (
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              setDraft(String(value));
              setEditing(true);
            }}
            className="shrink-0 min-w-[60px] px-2 py-1 rounded-md bg-stone-100 hover:bg-stone-200 font-mono tabular-nums text-zinc-900 disabled:hover:bg-stone-100"
          >
            {value}
            {unit && <span className="text-zinc-400 ml-0.5">{unit}</span>}
          </button>
        )}
        <button
          type="button"
          aria-label={t("increase")}
          disabled={disabled || atMax}
          onClick={() => stepBy(1)}
          className={stepBtn}
        >
          +
        </button>
      </div>
    </div>
  );
}
