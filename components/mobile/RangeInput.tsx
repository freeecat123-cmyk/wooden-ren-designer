"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useHoveredParts } from "@/components/HoveredPartsContext";
import { useUnit } from "@/hooks/useUnit";
import { formatInchFraction, MM_PER_INCH } from "@/lib/units/format";

const SIXTEENTH_MM = MM_PER_INCH / 16;

function snapToSixteenthMm(mm: number, dir: 1 | -1 | 0 = 0): number {
  const sixteenths = mm / SIXTEENTH_MM;
  const target =
    dir === 1 ? Math.floor(sixteenths) + 1
    : dir === -1 ? Math.ceil(sixteenths) - 1
    : Math.round(sixteenths);
  return Math.round(target * SIXTEENTH_MM);
}

interface PresetPoint {
  value: number;
  label: string;
}

interface RangeInputProps {
  /** form field name（給 DesignFormShell 抓） */
  name: string;
  /** 中文 label，如「長」「寬」「腳粗」 */
  label: string;
  /** 初始值（從 server defaultValue 來） */
  defaultValue: number;
  /** 單位，如 "mm" "°" */
  unit?: string;
  /** 滑桿 min */
  min: number;
  /** 滑桿 max */
  max: number;
  /** snap 步距（長/寬/高=10, 腳粗/牙板=2, 角度=0.5） */
  step?: number;
  /** help tooltip */
  help?: string;
  /** 軌道下方刻度線位置（mm 值） */
  ticks?: number[];
  /** chip 旁邊的可點預設值 */
  presetPoints?: PresetPoint[];
  /** 桌面 ±按鈕（手機強制 false 不論傳什麼） */
  showPlusMinus?: boolean;
  /** 動態 max 提示小字 */
  dynamicMaxHint?: string;
  /** 在數值右下方標出可調範圍（min–max），給整體尺寸欄位用 */
  showRange?: boolean;
  /** 給 Part anchor 用（這包只接通道、不接線） */
  partIds?: string[];
}

export function RangeInput({
  name,
  label,
  defaultValue,
  unit = "mm",
  min,
  max,
  step = 1,
  help,
  ticks,
  presetPoints,
  showPlusMinus,
  dynamicMaxHint,
  showRange,
  partIds,
}: RangeInputProps) {
  const tRange = useTranslations("mobile.range");
  const unitPref = useUnit();
  const showInchHelper = unit === "mm" && unitPref === "inch";
  // Part anchor hover/focus → 3D 對應件 emissive 高亮
  const { setHoveredPartIds } = useHoveredParts();
  const hasAnchor = !!(partIds && partIds.length > 0);
  const handleEnter = useCallback(() => {
    if (hasAnchor) setHoveredPartIds(partIds!);
  }, [hasAnchor, partIds, setHoveredPartIds]);
  const handleLeave = useCallback(() => {
    if (hasAnchor) setHoveredPartIds(null);
  }, [hasAnchor, setHoveredPartIds]);

  const [value, setValue] = useState<number>(defaultValue);
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const sliderRef = useRef<HTMLInputElement>(null);

  // max 從外部縮小（例如鎖定總高時其他層撐滿）→ 立即夾到上限，讓送出的值與顯示一致。
  useEffect(() => {
    setValue((v) => (v > max ? max : v < min ? min : v));
  }, [max, min]);

  // defaultValue 變更時同步（切 preset / 切情境會改變 defaultValue prop）
  useEffect(() => {
    setValue(defaultValue);
  }, [defaultValue]);

  const clamp = useCallback(
    (n: number) => (n > max ? max : n < min ? min : n),
    [min, max],
  );

  /** 寫進 sr-only mm number input,觸發 form auto-submit. 一條路徑取代所有 dispatch/race patch. */
  const writeMm = useCallback(
    (newMm: number) => {
      const clamped = clamp(newMm);
      setValue(clamped);
      const el = inputRef.current;
      if (el) {
        const tracker = (el as HTMLInputElement & { _valueTracker?: { setValue: (v: string) => void } })._valueTracker;
        requestAnimationFrame(() => {
          tracker?.setValue("");
          el.dispatchEvent(new Event("input", { bubbles: true }));
        });
      }
    },
    [clamp],
  );

  const editInchRef = useRef<HTMLInputElement>(null);
  const finishInchEdit = useCallback(() => {
    const el = editInchRef.current;
    if (el) {
      const raw = Number(el.value);
      if (Number.isFinite(raw) && raw > 0) {
        writeMm(snapToSixteenthMm(raw * MM_PER_INCH, 0));
      }
    }
    setEditing(false);
  }, [writeMm]);

  // ±按鈕：點一下走一個 step，按住 500ms 後 80ms auto-repeat
  const repeatTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const repeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopRepeat = useCallback(() => {
    if (repeatTimerRef.current) {
      clearTimeout(repeatTimerRef.current);
      repeatTimerRef.current = null;
    }
    if (repeatIntervalRef.current) {
      clearInterval(repeatIntervalRef.current);
      repeatIntervalRef.current = null;
    }
  }, []);

  const startRepeat = useCallback(
    (delta: number) => {
      writeMm((inputRef.current ? Number(inputRef.current.value) : 0) + delta);
      repeatTimerRef.current = setTimeout(() => {
        repeatIntervalRef.current = setInterval(() => {
          writeMm((inputRef.current ? Number(inputRef.current.value) : 0) + delta);
        }, 80);
      }, 500);
    },
    [writeMm],
  );

  useEffect(() => () => stopRepeat(), [stopRepeat]);

  // unmount 時清掉 hover state，避免 ghost highlight（hover 中切 tab/關 sheet）
  useEffect(() => {
    return () => {
      if (hasAnchor) setHoveredPartIds(null);
    };
  }, [hasAnchor, setHoveredPartIds]);

  const tickPercent = (mm: number) => {
    if (max === min) return 0;
    const pct = ((mm - min) / (max - min)) * 100;
    return Math.max(0, Math.min(100, pct));
  };

  return (
    <div
      className="text-sm"
      title={help}
      onPointerEnter={hasAnchor ? handleEnter : undefined}
      onPointerLeave={hasAnchor ? handleLeave : undefined}
    >
      <div className="flex items-center gap-3">
        <span className="text-zinc-700 font-medium shrink-0 w-16">{label}</span>

        {showPlusMinus && (
          <button
            type="button"
            aria-label={tRange("minus")}
            onMouseDown={() => startRepeat(-step)}
            onMouseUp={stopRepeat}
            onMouseLeave={stopRepeat}
            onTouchStart={() => startRepeat(-step)}
            onTouchEnd={stopRepeat}
            className="hidden md:flex shrink-0 w-8 h-8 items-center justify-center rounded-md bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-medium"
          >
            −
          </button>
        )}

        <div className="flex-1 flex flex-col">
          <input
            ref={sliderRef}
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => setValue(Number(e.target.value))}
            onFocus={hasAnchor ? handleEnter : undefined}
            onBlur={hasAnchor ? handleLeave : undefined}
            className="w-full accent-amber-600 h-6 cursor-grab"
          />
          {ticks && ticks.length > 0 && (
            <div className="relative h-2 -mt-1 pointer-events-none" aria-hidden="true">
              {ticks
                .filter((t) => t >= min && t <= max)
                .map((t, i) => (
                  <span
                    key={`${t}-${i}`}
                    className="absolute top-1 block w-px h-1 bg-zinc-300"
                    style={{ left: `${tickPercent(t)}%` }}
                  />
                ))}
            </div>
          )}
        </div>

        {showPlusMinus && (
          <button
            type="button"
            aria-label={tRange("plus")}
            onMouseDown={() => startRepeat(step)}
            onMouseUp={stopRepeat}
            onMouseLeave={stopRepeat}
            onTouchStart={() => startRepeat(step)}
            onTouchEnd={stopRepeat}
            className="hidden md:flex shrink-0 w-8 h-8 items-center justify-center rounded-md bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-medium"
          >
            +
          </button>
        )}

        <div className="shrink-0 flex flex-col items-end gap-0.5">
          {showInchHelper ? (
            editing ? (
              <input
                ref={editInchRef}
                type="number"
                step={0.0625}
                min={min / MM_PER_INCH}
                max={max / MM_PER_INCH}
                defaultValue={(value / MM_PER_INCH).toFixed(4).replace(/\.?0+$/, "")}
                autoFocus
                onFocus={(e) => e.target.select()}
                onBlur={finishInchEdit}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); finishInchEdit(); }
                  else if (e.key === "Escape") { e.preventDefault(); setEditing(false); }
                }}
                className="w-20 text-right border-b-2 border-amber-500 px-1 py-0.5 font-mono tabular-nums no-spinner"
                inputMode="decimal"
              />
            ) : (
              <div className="inline-flex items-center gap-1">
                <button
                  type="button"
                  aria-label={tRange("minus")}
                  disabled={value <= min}
                  onClick={() => writeMm(snapToSixteenthMm(value, -1))}
                  className="w-6 h-6 flex items-center justify-center rounded-md bg-amber-50 hover:bg-amber-100 text-amber-700 font-semibold text-sm leading-none disabled:opacity-40 border border-amber-200"
                >
                  −
                </button>
                <button
                  type="button"
                  tabIndex={0}
                  role="spinbutton"
                  aria-valuenow={value}
                  aria-valuemin={min}
                  aria-valuemax={max}
                  aria-valuetext={formatInchFraction(value)}
                  onClick={() => setEditing(true)}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowUp") { e.preventDefault(); writeMm(snapToSixteenthMm(value, 1)); }
                    else if (e.key === "ArrowDown") { e.preventDefault(); writeMm(snapToSixteenthMm(value, -1)); }
                    else if (e.key === "PageUp") { e.preventDefault(); let n = value; for (let i = 0; i < 4; i++) n = snapToSixteenthMm(n, 1); writeMm(n); }
                    else if (e.key === "PageDown") { e.preventDefault(); let n = value; for (let i = 0; i < 4; i++) n = snapToSixteenthMm(n, -1); writeMm(n); }
                    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setEditing(true); }
                  }}
                  className="min-h-[36px] min-w-[64px] px-2 py-1 rounded-md bg-zinc-100 hover:bg-zinc-200 font-mono tabular-nums text-zinc-900 text-xs flex items-center justify-center outline-none focus:ring-2 focus:ring-amber-300 cursor-text"
                >
                  {formatInchFraction(value)}
                </button>
                <button
                  type="button"
                  aria-label={tRange("plus")}
                  disabled={value >= max}
                  onClick={() => writeMm(snapToSixteenthMm(value, 1))}
                  className="w-6 h-6 flex items-center justify-center rounded-md bg-amber-50 hover:bg-amber-100 text-amber-700 font-semibold text-sm leading-none disabled:opacity-40 border border-amber-200"
                >
                  +
                </button>
              </div>
            )
          ) : editing ? (
            <input
              type="number"
              value={value}
              min={min}
              max={max}
              step={step}
              autoFocus
              onChange={(e) => setValue(Number(e.target.value))}
              onBlur={() => {
                // 離開時做一次 clamp 並走 writeMm,讓 URL 推到正確的值
                writeMm(value);
                setEditing(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  (e.target as HTMLInputElement).blur();
                }
              }}
              className="w-16 text-right border-b-2 border-amber-500 px-1 py-0.5 font-mono tabular-nums"
              inputMode="numeric"
            />
          ) : (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="min-h-[36px] min-w-[64px] px-2 py-1 rounded-md bg-zinc-100 hover:bg-zinc-200 font-mono tabular-nums text-zinc-900 text-xs"
            >
              {value}
              <span className="text-zinc-500 ml-0.5">{unit}</span>
            </button>
          )}
          {showRange && (
            <span className="text-[10px] leading-none text-zinc-400 tabular-nums pr-0.5">
              {min}–{max}
            </span>
          )}
        </div>

        {presetPoints && presetPoints.length > 0 && (
          <div className="hidden md:flex shrink-0 items-center gap-1">
            {presetPoints.map((p) => (
              <button
                key={`${p.label}-${p.value}`}
                type="button"
                onClick={() => writeMm(p.value)}
                className="h-6 px-1.5 rounded bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-[11px] leading-none font-medium"
              >
                {p.label}
                {p.value}
              </button>
            ))}
          </div>
        )}

        {/* sr-only 真實 number input — form auto-submit 走這個（hidden 不會
            觸發 React onChange 事件，所以這裡用 sr-only number）。 */}
        <input
          ref={inputRef}
          type="number"
          name={name}
          value={value}
          onChange={(e) => setValue(Number(e.target.value))}
          min={min}
          max={max}
          step={step}
          tabIndex={-1}
          aria-hidden
          className="sr-only"
        />
      </div>

      {dynamicMaxHint && (
        <div className="mt-1 ml-[4.25rem] text-[11px] text-zinc-500">
          ⚠ {dynamicMaxHint}
        </div>
      )}
    </div>
  );
}
