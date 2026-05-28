"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useUnit } from "@/hooks/useUnit";
import { formatInchFraction } from "@/lib/units/format";

interface FloorRangeInputProps {
  /** 中文 label,如「總寬」「地板片長」 */
  label: string;
  /** 受控值 */
  value: number;
  /** 值變更 callback(拖拉即時、打字按 Enter/失焦才觸發) */
  onChange: (v: number) => void;
  /** 滑桿 min */
  min: number;
  /** 滑桿 max */
  max: number;
  /** snap 步距 */
  step?: number;
  /** 單位,如 "cm" "mm" */
  unit?: string;
  /** label 旁的小字補充 */
  sub?: string;
}

/** step 收斂浮點誤差(0.5 級距拖拉常出 12.500000000000002) */
function snap(n: number, step: number): number {
  const r = Math.round(n / step) * step;
  return Math.round(r * 1000) / 1000;
}

/**
 * /floor 專用拉條 — 比照 /ceiling CeilingRangeInput:
 * controlled(value + onChange),滑桿 + [−][值][+] 步進 + 點開可打字。
 * 打字走本地草稿,Enter/失焦才 commit → 不會「只能輸入一個字」。
 */
export function FloorRangeInput({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit,
  sub,
}: FloorRangeInputProps) {
  const t = useTranslations("numberInput");
  const unitPref = useUnit();
  // 只有長度欄位（mm / cm）才在 inch 偏好下顯示英寸換算。
  // 元/個/% 等非長度欄位略過。
  const isMmLength = unit === "mm";
  const isCmLength = unit === "cm";
  const showInchHelper = unitPref === "inch" && (isMmLength || isCmLength);
  const valueMm = isCmLength ? value * 10 : value;
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

  const stepBy = (dir: 1 | -1) => onChange(snap(clamp(value + dir * step), step));
  const atMin = value <= min;
  const atMax = value >= max;
  const stepBtn =
    "shrink-0 w-7 h-7 flex items-center justify-center rounded-md bg-stone-100 " +
    "hover:bg-stone-200 text-zinc-700 text-base leading-none font-medium " +
    "disabled:opacity-40 disabled:hover:bg-stone-100 disabled:cursor-not-allowed";

  return (
    <div className="text-xs">
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-zinc-600 font-medium">{label}</span>
        {sub && <span className="text-[10px] text-zinc-400 font-normal">· {sub}</span>}
      </div>
      {showInchHelper && Number.isFinite(valueMm) && (
        <div className="mb-1 text-[10px] text-zinc-500 tabular-nums leading-none">
          ≈ {formatInchFraction(valueMm)}
        </div>
      )}
      <div className="flex items-center gap-1.5">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={clamp(value)}
          onChange={(e) => onChange(snap(Number(e.target.value), step))}
          className="flex-1 min-w-0 accent-amber-600 h-5 cursor-grab"
        />
        <button
          type="button"
          aria-label={t("decrease")}
          disabled={atMin}
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
            onClick={() => {
              setDraft(String(value));
              setEditing(true);
            }}
            className="shrink-0 w-[72px] px-2 py-1 rounded-md bg-stone-100 hover:bg-stone-200 font-mono tabular-nums text-zinc-900 text-right"
          >
            {value}
            {unit && (
              <span className="text-zinc-400 ml-0.5">
                {showInchHelper ? "in" : unit}
              </span>
            )}
          </button>
        )}
        <button
          type="button"
          aria-label={t("increase")}
          disabled={atMax}
          onClick={() => stepBy(1)}
          className={stepBtn}
        >
          +
        </button>
      </div>
    </div>
  );
}
