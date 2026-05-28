"use client";

import { useLocale } from "next-intl";
import { useCurrency, CURRENCY_CHANGE_EVENT } from "@/hooks/useCurrency";
import type { CurrencyPref } from "@/lib/geo-defaults";

/**
 * TWD / USD 切換按鈕。寫 localStorage[wr-currency]，廣播 CURRENCY_CHANGE_EVENT
 * 讓所有 useCurrency() 訂閱者即時換顯示。
 *
 * 只切「顯示 LABEL/格式」（NT$ 390 ↔ $ 390），不做匯率換算 —
 * 金額層級的多幣別定價是商業決策，未統一前 USD/TWD 各自硬寫一份。
 */
export function CurrencyToggle() {
  const locale = useLocale();
  const currency = useCurrency();

  // 國外版（en）強制 USD,台灣版（zh-TW）強制 TWD,皆隱藏不給切
  if (locale === "en" || locale === "zh-TW") return null;

  const setCurrency = (next: CurrencyPref) => {
    try {
      window.localStorage.setItem("wr-currency", next);
    } catch {
      // private mode / quota — silently ignore
    }
    window.dispatchEvent(new Event(CURRENCY_CHANGE_EVENT));
  };

  return (
    <div
      role="group"
      aria-label="Currency toggle"
      className="inline-flex items-center rounded-md ring-1 ring-zinc-300 bg-white text-xs font-semibold overflow-hidden"
    >
      <button
        type="button"
        onClick={() => setCurrency("TWD")}
        className={`px-2.5 py-1 transition-colors ${
          currency === "TWD"
            ? "bg-amber-700 text-white"
            : "text-zinc-600 hover:bg-amber-50"
        }`}
        aria-pressed={currency === "TWD"}
      >
        TWD
      </button>
      <button
        type="button"
        onClick={() => setCurrency("USD")}
        className={`px-2.5 py-1 transition-colors ${
          currency === "USD"
            ? "bg-amber-700 text-white"
            : "text-zinc-600 hover:bg-amber-50"
        }`}
        aria-pressed={currency === "USD"}
      >
        USD
      </button>
    </div>
  );
}
