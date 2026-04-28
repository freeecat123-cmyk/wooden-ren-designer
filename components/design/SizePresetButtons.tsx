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
export function SizePresetButtons({ category }: { category: FurnitureCategory }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const presets = getSizePresets(category);
  if (presets.length === 0) return null;

  const handleClick = (l: number, w: number, h: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("length", String(l));
    params.set("width", String(w));
    params.set("height", String(h));
    router.replace(`?${params.toString()}`, { scroll: false });
  };

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
