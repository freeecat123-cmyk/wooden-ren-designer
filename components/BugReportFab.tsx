"use client";

import { useState } from "react";

/**
 * 全站右下角浮動「回報問題」按鈕。
 * 點開展開小卡片，按「寄信」自動帶當前 URL/build SHA/瀏覽器資訊到 mailto。
 * 學生不必背任何指令，老師（木頭仁）收到信就知道是哪一版+哪一頁的問題。
 */
export function BugReportFab() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const sha =
    (process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? "").slice(0, 7) || "dev";

  function buildReport() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
    const subject = `[家具設計器] 問題回報 (build ${sha})`;
    const body =
      `發生時間：${new Date().toLocaleString("zh-TW")}\n` +
      `build：${sha}\n` +
      `頁面：${url}\n` +
      `瀏覽器：${ua}\n\n` +
      `=== 請描述問題 ===\n` +
      `（例如：我把椅子高度調到 500mm，3D 變空白）\n\n` +
      `=== 截圖 ===\n` +
      `（請直接貼到信件中）\n`;
    return { subject, body };
  }

  function openGmailCompose() {
    const { subject, body } = buildReport();
    // Gmail web compose 直連，不依賴本機 mail handler
    const u = new URL("https://mail.google.com/mail/");
    u.searchParams.set("view", "cm");
    u.searchParams.set("fs", "1");
    u.searchParams.set("to", "wengbinren@gmail.com");
    u.searchParams.set("su", subject);
    u.searchParams.set("body", body);
    window.open(u.toString(), "_blank", "noopener");
    setOpen(false);
  }

  async function copyToClipboard() {
    const { subject, body } = buildReport();
    const text = `寄至：wengbinren@gmail.com\n主旨：${subject}\n\n${body}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt("複製下方內容貼到任何信箱，寄到 wengbinren@gmail.com", text);
    }
  }


  return (
    <>
      {open && (
        <div className="no-print fixed bottom-40 lg:bottom-20 right-4 z-50 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-zinc-200 bg-white p-4 shadow-2xl">
          <div className="text-sm font-semibold text-zinc-900">
            回報問題給木頭仁
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-zinc-600">
            自動帶當前頁面 + 版本資訊。請描述你做了什麼步驟，最好附截圖。寄到{" "}
            <span className="font-mono text-zinc-800">wengbinren@gmail.com</span>
          </p>
          <button
            onClick={openGmailCompose}
            className="mt-3 w-full rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700"
          >
            📧 用 Gmail 開新分頁
          </button>
          <button
            onClick={copyToClipboard}
            className="mt-2 w-full rounded-md border border-zinc-300 px-3 py-2 text-xs hover:bg-zinc-50"
          >
            {copied ? "✓ 已複製，請貼到任何信箱寄出" : "📋 複製內容到剪貼簿（不用 Gmail 用這個）"}
          </button>
          <button
            onClick={() => setOpen(false)}
            className="mt-2 w-full text-center text-xs text-zinc-500 hover:text-zinc-700"
          >
            取消
          </button>
        </div>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        title="回報問題"
        aria-label="回報問題"
        className="no-print fixed bottom-24 lg:bottom-4 right-4 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-lg ring-1 ring-zinc-200 hover:bg-zinc-50 overflow-hidden"
      >
        <img
          src="/logo-mark.png"
          alt="木頭仁"
          className="h-9 w-9 object-contain"
        />
      </button>
    </>
  );
}
