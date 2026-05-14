"use client";

import { useState, useEffect } from "react";

interface Props {
  name: string;
  defaultValue: number | string;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
}

/**
 * 桌面版「鎖定總高」用：max 從外部縮小時，把值立刻夾到上限並回寫表單，
 * 避免顯示值與實際渲染值不一致。
 */
export function ClampedNumberInput({ name, defaultValue, min, max, step, className }: Props) {
  const [value, setValue] = useState<string>(String(defaultValue));

  useEffect(() => {
    const n = Number(value);
    if (!Number.isFinite(n)) return;
    if (max !== undefined && n > max) setValue(String(max));
    else if (min !== undefined && n < min) setValue(String(min));
  }, [max, min, value]);

  return (
    <input
      type="number"
      name={name}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={(e) => {
        const n = Number(e.target.value);
        if (!Number.isFinite(n)) return;
        if (max !== undefined && n > max) setValue(String(max));
        else if (min !== undefined && n < min) setValue(String(min));
      }}
      min={min}
      max={max}
      step={step}
      className={className}
    />
  );
}
