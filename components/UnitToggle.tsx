"use client";

import { useLocale } from "next-intl";
import { useUnit, UNIT_CHANGE_EVENT } from "@/hooks/useUnit";
import type { UnitPref } from "@/lib/geo-defaults";

/**
 * mm / inch 切換按鈕。寫 localStorage[wr-unit]，廣播 UNIT_CHANGE_EVENT
 * 讓所有 useUnit() 訂閱者即時換顯示。
 * 台灣版(zh-TW)強制 mm,隱藏不顯示;國際版(/en)可切。
 */
export function UnitToggle() {
  const locale = useLocale();
  const unit = useUnit();

  // 台灣版不顯示 — 強制 mm,不給切英寸
  if (locale === "zh-TW") return null;

  const setUnit = (next: UnitPref) => {
    try {
      window.localStorage.setItem("wr-unit", next);
    } catch {
      // private mode / quota — silently ignore
    }
    window.dispatchEvent(new Event(UNIT_CHANGE_EVENT));
  };

  return (
    <div
      role="group"
      aria-label="Unit toggle"
      className="inline-flex items-center rounded-md ring-1 ring-zinc-300 bg-white text-xs font-semibold overflow-hidden"
    >
      <button
        type="button"
        onClick={() => setUnit("mm")}
        className={`px-2.5 py-1 transition-colors ${
          unit === "mm"
            ? "bg-amber-700 text-white"
            : "text-zinc-600 hover:bg-amber-50"
        }`}
        aria-pressed={unit === "mm"}
      >
        mm
      </button>
      <button
        type="button"
        onClick={() => setUnit("inch")}
        className={`px-2.5 py-1 transition-colors ${
          unit === "inch"
            ? "bg-amber-700 text-white"
            : "text-zinc-600 hover:bg-amber-50"
        }`}
        aria-pressed={unit === "inch"}
      >
        inch
      </button>
    </div>
  );
}
