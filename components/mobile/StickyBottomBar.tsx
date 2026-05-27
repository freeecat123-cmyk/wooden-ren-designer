"use client";

import { Link } from "@/i18n/navigation";
import { useTranslations, useLocale } from "next-intl";

interface StickyBottomBarProps {
  /** 總價（NTD，已含稅毛利） */
  totalPrice: number;
  /** 重量 kg */
  weight: number;
  /** 報價頁 URL（保留 /quote 路由） */
  quoteUrl: string;
  /** LINE 分享文字（前綴，URL 由 client 用 window.location.href 組） */
  lineShareText: string;
}

export function StickyBottomBar({
  totalPrice,
  weight,
  quoteUrl,
  lineShareText,
}: StickyBottomBarProps) {
  const t = useTranslations("mobile.bottom");
  const locale = useLocale();
  const isEn = locale === "en";
  const handleLineShare = () => {
    if (typeof window === "undefined") return;
    const fullText = `${lineShareText} ${window.location.href}`;
    window.open(
      `https://line.me/R/msg/text/?${encodeURIComponent(fullText)}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  const formattedPrice = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(totalPrice);
  const currencyPrefix = isEn ? "TWD " : "NT$ ";

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur border-t border-amber-900/10 shadow-[0_-3px_14px_rgba(120,80,20,0.12)]"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3 min-h-[72px]">
        <div className="flex flex-col">
          <span className="text-[11px] text-zinc-500 tracking-wide">{t("totalLabel")}</span>
          <span className="text-xl font-bold text-amber-900 tabular-nums leading-tight">
            {currencyPrefix}{formattedPrice}
          </span>
          <span className="text-[11px] text-zinc-500">{t("weight", { kg: weight.toFixed(1) })}</span>
        </div>
        <div className="flex gap-2">
          <Link
            href={quoteUrl}
            className="inline-flex items-center justify-center min-h-[46px] px-4 rounded-xl bg-amber-700 hover:bg-amber-800 active:scale-[0.97] text-white text-sm font-semibold shadow-sm transition-all"
          >
            {t("quoteBtn")}
          </Link>
          <button
            type="button"
            onClick={handleLineShare}
            className="inline-flex items-center justify-center min-h-[46px] px-4 rounded-xl bg-green-600 hover:bg-green-700 active:scale-[0.97] text-white text-sm font-semibold shadow-sm transition-all"
          >
            📲 LINE
          </button>
        </div>
      </div>
    </div>
  );
}
