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

  // editing 切換時自動 focus
  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

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
      setValue((v) => clamp(v + delta));
      repeatTimerRef.current = setTimeout(() => {
        repeatIntervalRef.current = setInterval(() => {
          setValue((v) => clamp(v + delta));
        }, 80);
      }, 500);
    },
    [clamp],
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
            <div className="inline-flex items-center gap-1">
              <button
                type="button"
                aria-label={tRange("minus")}
                disabled={value <= min}
                onClick={() => {
                  setValue((v) => {
                    const next = clamp(snapToSixteenthMm(v, -1));
                    requestAnimationFrame(() => {
                      sliderRef.current?.dispatchEvent(new Event("input", { bubbles: true }));
                      sliderRef.current?.dispatchEvent(new Event("change", { bubbles: true }));
                    });
                    return next;
                  });
                }}
                className="w-6 h-6 flex items-center justify-center rounded-md bg-amber-50 hover:bg-amber-100 text-amber-700 font-semibold text-sm leading-none disabled:opacity-40 border border-amber-200"
              >
                −
              </button>
              <span
                tabIndex={0}
                role="spinbutton"
                aria-valuenow={value}
                aria-valuemin={min}
                aria-valuemax={max}
                aria-valuetext={formatInchFraction(value)}
                onKeyDown={(e) => {
                  const stepInch = (dir: 1 | -1, mag: 1 | 4 = 1) => {
                    e.preventDefault();
                    setValue((v) => {
                      let next = v;
                      for (let i = 0; i < mag; i++) next = snapToSixteenthMm(next, dir);
                      next = clamp(next);
                      requestAnimationFrame(() => {
                        sliderRef.current?.dispatchEvent(new Event("input", { bubbles: true }));
                        sliderRef.current?.dispatchEvent(new Event("change", { bubbles: true }));
                      });
                      return next;
                    });
                  };
                  if (e.key === "ArrowUp") stepInch(1);
                  else if (e.key === "ArrowDown") stepInch(-1);
                  else if (e.key === "PageUp") stepInch(1, 4);
                  else if (e.key === "PageDown") stepInch(-1, 4);
                }}
                className="min-h-[36px] min-w-[64px] px-2 py-1 rounded-md bg-zinc-100 font-mono tabular-nums text-zinc-900 text-xs flex items-center justify-center outline-none focus:ring-2 focus:ring-amber-300"
              >
                {formatInchFraction(value)}
              </span>
              <button
                type="button"
                aria-label={tRange("plus")}
                disabled={value >= max}
                onClick={() => {
                  setValue((v) => {
                    const next = clamp(snapToSixteenthMm(v, 1));
                    requestAnimationFrame(() => {
                      sliderRef.current?.dispatchEvent(new Event("input", { bubbles: true }));
                      sliderRef.current?.dispatchEvent(new Event("change", { bubbles: true }));
                    });
                    return next;
                  });
                }}
                className="w-6 h-6 flex items-center justify-center rounded-md bg-amber-50 hover:bg-amber-100 text-amber-700 font-semibold text-sm leading-none disabled:opacity-40 border border-amber-200"
              >
                +
              </button>
            </div>
          ) : editing ? (
            <input
              ref={inputRef}
              type="number"
              name={name}
              value={value}
              min={min}
              max={max}
              step={step}
              onChange={(e) => setValue(Number(e.target.value))}
              onBlur={() => setEditing(false)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  setEditing(false);
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
              <span className="text-zinc-500 ml-0.5">
                {showInchHelper ? "in" : unit}
              </span>
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
                onClick={() => {
                  const v = clamp(p.value);
                  setValue(v);
                  // 觸發 form 的 onChange 偵測 — slider 自身的 setter 改 hidden input
                  // 不會 fire 原生事件，DesignFormShell 的 debounce auto-submit 收不到
                  requestAnimationFrame(() => {
                    sliderRef.current?.dispatchEvent(new Event("input", { bubbles: true }));
                    sliderRef.current?.dispatchEvent(new Event("change", { bubbles: true }));
                    sliderRef.current?.focus();
                  });
                }}
                className="h-6 px-1.5 rounded bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-[11px] leading-none font-medium"
              >
                {p.label}
                {p.value}
              </button>
            ))}
          </div>
        )}

        {(!editing || showInchHelper) && <input type="hidden" name={name} value={value} />}
      </div>

      {dynamicMaxHint && (
        <div className="mt-1 ml-[4.25rem] text-[11px] text-zinc-500">
          ⚠ {dynamicMaxHint}
        </div>
      )}
    </div>
  );
}
