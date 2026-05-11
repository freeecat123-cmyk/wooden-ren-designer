"use client";

import { useState } from "react";

/**
 * 全站右下角浮動「回報問題」按鈕。
 * 點開展開小卡片，按「寄信」自動帶當前 URL/build SHA/瀏覽器資訊到 mailto。
 * 學生不必背任何指令，老師（木頭仁）收到信就知道是哪一版+哪一頁的問題。
 */
export function BugReportFab() {
  const [open, setOpen] = useState(false);

  const sha =
    (process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? "").slice(0, 7) || "dev";

  function handleReport() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
    const subject = encodeURIComponent(`[家具設計器] 問題回報 (build ${sha})`);
    const body = encodeURIComponent(
      `發生時間：${new Date().toLocaleString("zh-TW")}\n` +
        `build：${sha}\n` +
        `頁面：${url}\n` +
        `瀏覽器：${ua}\n\n` +
        `=== 請描述問題 ===\n` +
        `（例如：我把椅子高度調到 500mm，3D 變空白）\n\n` +
        `=== 截圖 ===\n` +
        `（請直接貼到信件中）\n`,
    );
    window.location.href = `mailto:wengbinren@gmail.com?subject=${subject}&body=${body}`;
    setOpen(false);
  }

  return (
    <>
      {open && (
        <div className="no-print fixed bottom-20 right-4 z-50 w-72 rounded-xl border border-zinc-200 bg-white p-4 shadow-2xl">
          <div className="text-sm font-semibold text-zinc-900">
            回報問題給木頭仁
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-zinc-600">
            按下會開啟 email，自動帶當前頁面 + 版本資訊。請描述你做了什麼步驟，最好附截圖。
          </p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={handleReport}
              className="flex-1 rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700"
            >
              寄信
            </button>
            <button
              onClick={() => setOpen(false)}
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-50"
            >
              取消
            </button>
          </div>
        </div>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        title="回報問題"
        aria-label="回報問題"
        className="no-print fixed bottom-4 right-4 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-900 text-xl text-white shadow-lg hover:bg-zinc-700"
      >
        🐛
      </button>
    </>
  );
}
