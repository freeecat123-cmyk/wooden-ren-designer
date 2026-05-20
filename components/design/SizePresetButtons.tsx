"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { getSizePresets } from "@/lib/design/size-presets";
import type { FurnitureCategory } from "@/lib/types";

/**
 * 在尺寸表單上方顯示「常用尺寸」一鍵帶入按鈕。
 * 客戶報尺寸時通常不會精準（「我要一張 6 人餐桌」），木工點按鈕直接帶入業界標準。
 *
 * 為什麼用 router.replace 而不是直接改 input：表單已經 onChange debounce 自動推 URL，
 * 改 input 還要 dispatch event 才會觸發，麻煩。直接改 URL params 最乾淨。
 */
interface SizePresetButtonsProps {
  category: FurnitureCategory;
  /** 該家具的 limits；任一維超過上限的 preset 不顯示，避免按了被 server clamp */
  limits?: { length: number; width: number; height: number };
  /**
   * compact=true 用於手機版：減少 margin、縮字級，適合尺寸 card 內嵌。
   * 不影響 desktop 預設視覺。
   */
  compact?: boolean;
}

export function SizePresetButtons({ category, limits, compact }: SizePresetButtonsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const allPresets = getSizePresets(category);
  const presets = limits
    ? allPresets.filter((p) => p.length <= limits.length && p.width <= limits.width && p.height <= limits.height)
    : allPresets;
  if (presets.length === 0) return null;

  const handleClick = (l: number, w: number, h: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("length", String(l));
    params.set("width", String(w));
    params.set("height", String(h));
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  if (compact) {
    // Mobile compact: horizontal scrollable chip strip, no label prefix, tighter sizing
    return (
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none -mx-0.5 px-0.5">
        {presets.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => handleClick(p.length, p.width, p.height)}
            title={`${p.length}×${p.width}×${p.height} mm${p.hint ? " · " + p.hint : ""}`}
            className="shrink-0 px-2.5 py-1 rounded text-[11px] bg-amber-50 text-amber-900 border border-amber-200 active:bg-amber-100 active:border-amber-300"
          >
            {p.label}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="mb-3 flex flex-wrap gap-1.5 items-center">
      <span className="text-[10px] text-zinc-500 font-medium tracking-wide mr-1">
        🎯 業界常用：
      </span>
      {presets.map((p) => (
        <button
          key={p.label}
          type="button"
          onClick={() => handleClick(p.length, p.width, p.height)}
          title={`${p.length}×${p.width}×${p.height} mm${p.hint ? " · " + p.hint : ""}`}
          className="px-2.5 py-1 rounded text-[11px] bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100 hover:border-amber-300"
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
