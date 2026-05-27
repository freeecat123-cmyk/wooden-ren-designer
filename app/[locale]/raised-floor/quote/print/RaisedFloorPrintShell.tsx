"use client";

/**
 * 列印頁外殼:
 *   1. 把 document.title 暫改為 PDF 下載檔名 `{客戶}_架高地板_{YYYY-MM-DD}`
 *   2. 提供「列印」「回設定」兩個 no-print 工具列按鈕
 *
 * @media print / .quote-page-break / .no-print 規則寫在 app/globals.css(共用)。
 */
import { useEffect } from "react";

interface Props {
  customerName: string;
  /** 回設定頁的 URL(不含 viewMode,但帶 d/o/c) */
  backHref: string;
  children: React.ReactNode;
}

export function RaisedFloorPrintShell({ customerName, backHref, children }: Props) {
  useEffect(() => {
    const prev = document.title;
    const today = new Date().toISOString().slice(0, 10);
    const safeName = customerName.trim().replace(/[\\/:*?"<>|]/g, "") || "客戶";
    document.title = `${safeName}_架高地板_${today}`;
    return () => {
      document.title = prev;
    };
  }, [customerName]);

  return (
    <>
      {/* 工具列 — 列印時隱藏 */}
      <div className="no-print sticky top-0 z-10 border-b border-zinc-200 bg-white/95 backdrop-blur px-4 py-2 flex items-center justify-between gap-2">
        <a
          href={backHref}
          className="text-xs text-zinc-500 hover:text-[#bd9955] underline"
        >
          ← 回設定頁
        </a>
        <button
          onClick={() => window.print()}
          className="rounded bg-[#bd9955] px-4 py-1.5 text-xs font-semibold text-white hover:opacity-90"
        >
          🖨️ 列印 / 存 PDF
        </button>
      </div>

      {/* 浮水印 — 只在 @media print 時顯示(global rule) */}
      <div className="print-watermark" aria-hidden="true">
        <span>木頭仁・架高地板</span>
      </div>

      {children}
    </>
  );
}
