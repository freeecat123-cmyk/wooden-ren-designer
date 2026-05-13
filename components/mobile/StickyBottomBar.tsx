"use client";

import Link from "next/link";

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
  const handleLineShare = () => {
    if (typeof window === "undefined") return;
    const fullText = `${lineShareText} ${window.location.href}`;
    window.open(
      `https://line.me/R/msg/text/?${encodeURIComponent(fullText)}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  const formattedPrice = new Intl.NumberFormat("zh-TW", { maximumFractionDigits: 0 }).format(totalPrice);

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-zinc-200 shadow-[0_-2px_8px_rgba(0,0,0,0.08)]"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3 min-h-[72px]">
        <div className="flex flex-col">
          <span className="text-xs text-zinc-500 uppercase tracking-wide">參考總價</span>
          <span className="text-lg font-bold text-zinc-900 tabular-nums">
            NT$ {formattedPrice}
          </span>
          <span className="text-xs text-zinc-500">約 {weight.toFixed(1)} kg</span>
        </div>
        <div className="flex gap-2">
          <Link
            href={quoteUrl}
            className="inline-flex items-center justify-center min-h-[44px] px-4 rounded-md bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold"
          >
            💰 報價
          </Link>
          <button
            type="button"
            onClick={handleLineShare}
            className="inline-flex items-center justify-center min-h-[44px] px-4 rounded-md bg-green-600 hover:bg-green-700 text-white text-sm font-semibold"
          >
            📲 LINE
          </button>
        </div>
      </div>
    </div>
  );
}
