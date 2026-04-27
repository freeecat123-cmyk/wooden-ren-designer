"use client";

/**
 * 試用版浮水印——只在免費版顯示。橫跨整頁、半透明、不可互動。
 * 螢幕跟列印都顯示。
 */
export function TrialWatermark({ text = "TRIAL VERSION" }: { text?: string }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[1] flex items-center justify-center select-none"
    >
      <span
        className="whitespace-nowrap font-bold tracking-widest"
        style={{
          fontSize: "120px",
          color: "rgba(220, 38, 38, 0.08)",
          transform: "rotate(-30deg)",
          letterSpacing: "0.3em",
        }}
      >
        {text}
      </span>
    </div>
  );
}

/**
 * 三視圖角落小型浮水印——給每個視圖框右下角貼一個小標。
 * 列印 PDF 時也保留（區別於對角線大字版）。
 */
export function CornerWatermark({
  label = "木頭仁工程圖生成器 — 試用版",
}: {
  label?: string;
}) {
  return (
    <span
      aria-hidden
      className="absolute right-2 bottom-2 z-[1] text-[9px] text-zinc-400 pointer-events-none"
    >
      {label}
    </span>
  );
}
