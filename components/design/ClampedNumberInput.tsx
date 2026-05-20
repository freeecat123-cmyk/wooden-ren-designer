"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useHoveredParts } from "@/components/HoveredPartsContext";

interface PresetPoint {
  value: number;
  label: string;
}

interface Props {
  name: string;
  defaultValue: number | string;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
  /** label（選填，用於 ±按鈕 aria 與保留版面） */
  label?: string;
  /** chip 旁邊的可點預設值 */
  presetPoints?: PresetPoint[];
  /** 桌面 ±按鈕（手機強制 false） */
  showPlusMinus?: boolean;
  /** 動態 max 提示小字 */
  dynamicMaxHint?: string;
  /** 給 Part anchor 用（這包只接通道） */
  partIds?: string[];
  /** 預留以求與 RangeInput 對齊（此元件無 slider，無作用） */
  ticks?: number[];
}

/**
 * 桌面版「鎖定總高」用：max 從外部縮小時，把值立刻夾到上限並回寫表單，
 * 避免顯示值與實際渲染值不一致。
 */
export function ClampedNumberInput({
  name,
  defaultValue,
  min,
  max,
  step,
  className,
  label,
  presetPoints,
  showPlusMinus,
  dynamicMaxHint,
  partIds,
  ticks,
}: Props) {
  void ticks;

  // Part anchor hover/focus → 3D 對應件 emissive 高亮
  const { setHoveredPartIds } = useHoveredParts();
  const hasAnchor = !!(partIds && partIds.length > 0);
  const handleEnter = useCallback(() => {
    if (hasAnchor) setHoveredPartIds(partIds!);
  }, [hasAnchor, partIds, setHoveredPartIds]);
  const handleLeave = useCallback(() => {
    if (hasAnchor) setHoveredPartIds(null);
  }, [hasAnchor, setHoveredPartIds]);

  const [value, setValue] = useState<string>(String(defaultValue));
  const inputRef = useRef<HTMLInputElement>(null);

  // 只在 max 從外部縮小時把值拉回（「鎖總高」場景）。
  // 不要 react 到 value 自己變化、也不要在這裡 enforce min ——
  // 否則使用者打「2」想接著打「2400」時，2 < min 20 會立刻跳成 20、
  // 接下來 user 打「4」變成「204」、再「0」變「2040」、再「0」變「20400」
  // 然後又被夾到 max。整個輸入流被毀。min 改成只在 onBlur 時 clamp。
  useEffect(() => {
    if (max === undefined) return;
    setValue((prev) => {
      const n = Number(prev);
      if (!Number.isFinite(n)) return prev;
      return n > max ? String(max) : prev;
    });
  }, [max]);

  const clamp = useCallback(
    (n: number) => {
      let r = n;
      if (max !== undefined && r > max) r = max;
      if (min !== undefined && r < min) r = min;
      return r;
    },
    [min, max],
  );

  const repeatTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const repeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fireNativeChange = useCallback(() => {
    // ± 按鈕只改 React state，DOM 值是 React 自己 render 進去的，
    // React 的 _valueTracker 認為「值沒變」所以 dispatch 的 input event
    // 不會 fire React synthetic onChange → form 收不到 → URL 不 push。
    // 解法：把 _valueTracker 重置成空，這樣 React 比對時會視為「值有變」。
    const el = inputRef.current as (HTMLInputElement & { _valueTracker?: { setValue: (v: string) => void } }) | null;
    if (!el) return;
    el._valueTracker?.setValue("");
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }, []);

  const stopRepeat = useCallback(() => {
    if (repeatTimerRef.current) {
      clearTimeout(repeatTimerRef.current);
      repeatTimerRef.current = null;
    }
    if (repeatIntervalRef.current) {
      clearInterval(repeatIntervalRef.current);
      repeatIntervalRef.current = null;
    }
    // 放開後在下一個 frame 觸發（等 setValue 的 re-render 把 input.value 寫進 DOM）
    requestAnimationFrame(fireNativeChange);
  }, [fireNativeChange]);

  const startRepeat = useCallback(
    (delta: number) => {
      setValue((v) => {
        const n = Number(v);
        return String(clamp((Number.isFinite(n) ? n : 0) + delta));
      });
      repeatTimerRef.current = setTimeout(() => {
        repeatIntervalRef.current = setInterval(() => {
          setValue((v) => {
            const n = Number(v);
            return String(clamp((Number.isFinite(n) ? n : 0) + delta));
          });
        }, 80);
      }, 500);
    },
    [clamp],
  );

  useEffect(() => () => stopRepeat(), [stopRepeat]);

  // unmount 時清掉 hover state，避免 ghost highlight
  useEffect(() => {
    return () => {
      if (hasAnchor) setHoveredPartIds(null);
    };
  }, [hasAnchor, setHoveredPartIds]);

  const stepDelta = step ?? 1;

  const hasExtras =
    showPlusMinus ||
    (presetPoints && presetPoints.length > 0) ||
    dynamicMaxHint ||
    label;

  // 沒有任何新 prop 時，保持原本「裸 input」輸出 100% 不變（hover 接線除外）
  if (!hasExtras) {
    return (
      <input
        type="number"
        name={name}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onFocus={hasAnchor ? handleEnter : undefined}
        onBlur={(e) => {
          if (hasAnchor) handleLeave();
          const n = Number(e.target.value);
          if (!Number.isFinite(n)) return;
          if (max !== undefined && n > max) setValue(String(max));
          else if (min !== undefined && n < min) setValue(String(min));
        }}
        onPointerEnter={hasAnchor ? handleEnter : undefined}
        onPointerLeave={hasAnchor ? handleLeave : undefined}
        min={min}
        max={max}
        step={step}
        className={className}
      />
    );
  }

  return (
    <span
      className="flex flex-col w-full min-w-0"
      onPointerEnter={hasAnchor ? handleEnter : undefined}
      onPointerLeave={hasAnchor ? handleLeave : undefined}
    >
      <span className="flex items-center gap-1 w-full min-w-0">
        {label && (
          <span className="text-zinc-700 font-medium shrink-0 w-16 text-sm">
            {label}
          </span>
        )}

        {showPlusMinus && (
          <button
            type="button"
            aria-label="減"
            onMouseDown={() => startRepeat(-stepDelta)}
            onMouseUp={stopRepeat}
            onMouseLeave={stopRepeat}
            onTouchStart={() => startRepeat(-stepDelta)}
            onTouchEnd={stopRepeat}
            className="hidden md:flex shrink-0 w-6 h-9 items-center justify-center rounded-md bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-semibold text-sm leading-none"
          >
            −
          </button>
        )}

        <input
          ref={inputRef}
          type="number"
          name={name}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={hasAnchor ? handleEnter : undefined}
          onBlur={(e) => {
            if (hasAnchor) handleLeave();
            const n = Number(e.target.value);
            if (!Number.isFinite(n)) return;
            if (max !== undefined && n > max) setValue(String(max));
            else if (min !== undefined && n < min) setValue(String(min));
          }}
          min={min}
          max={max}
          step={step}
          className={`${className ?? ""} flex-1 min-w-[3.5rem] w-full text-center tabular-nums no-spinner`.trim()}
        />

        {showPlusMinus && (
          <button
            type="button"
            aria-label="加"
            onMouseDown={() => startRepeat(stepDelta)}
            onMouseUp={stopRepeat}
            onMouseLeave={stopRepeat}
            onTouchStart={() => startRepeat(stepDelta)}
            onTouchEnd={stopRepeat}
            className="hidden md:flex shrink-0 w-6 h-9 items-center justify-center rounded-md bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-semibold text-sm leading-none"
          >
            +
          </button>
        )}

        {presetPoints && presetPoints.length > 0 && (
          <span className="hidden md:inline-flex shrink-0 items-center gap-1">
            {presetPoints.map((p) => (
              <button
                key={`${p.label}-${p.value}`}
                type="button"
                onClick={() => {
                  const v = clamp(p.value);
                  setValue(String(v));
                  // 觸發原生 change 讓 form auto-submit 偵測得到（setValue 改 React state
                  // 不會 fire DOM 事件）
                  requestAnimationFrame(() => {
                    inputRef.current?.dispatchEvent(new Event("input", { bubbles: true }));
                    inputRef.current?.dispatchEvent(new Event("change", { bubbles: true }));
                    inputRef.current?.focus();
                  });
                }}
                className="h-6 px-1.5 rounded bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-[11px] leading-none font-medium"
              >
                {p.label}
                {p.value}
              </button>
            ))}
          </span>
        )}
      </span>

      {dynamicMaxHint && (
        <span className="mt-1 text-[11px] text-zinc-500">
          ⚠ {dynamicMaxHint}
        </span>
      )}
    </span>
  );
}
