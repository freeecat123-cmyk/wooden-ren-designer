"use client";

import { useState, useRef, useEffect } from "react";

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
}: RangeInputProps) {
  const [value, setValue] = useState<number>(defaultValue);
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // editing 切換時自動 focus
  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  return (
    <div className="flex flex-col gap-1.5 text-sm" title={help}>
      <div className="flex items-center justify-between">
        <span className="text-zinc-700 font-medium">{label}</span>
        {editing ? (
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
            className="w-20 text-right border-b-2 border-violet-500 px-1 py-0.5 font-mono tabular-nums"
            inputMode="numeric"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="min-h-[44px] min-w-[64px] px-3 py-1 rounded-md bg-zinc-100 hover:bg-zinc-200 font-mono tabular-nums text-zinc-900"
          >
            {value}
            <span className="text-zinc-500 text-xs ml-1">{unit}</span>
          </button>
        )}
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => setValue(Number(e.target.value))}
        className="w-full accent-violet-600 h-6 cursor-grab"
      />
      {!editing && (
        <input type="hidden" name={name} value={value} />
      )}
    </div>
  );
}
