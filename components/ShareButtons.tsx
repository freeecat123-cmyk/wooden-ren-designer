"use client";

import { useState } from "react";

/**
 * 介紹頁的分享按鈕：LINE / Facebook / 複製連結。
 * Server component 傳入 absolute url + title 即可。
 *
 * LINE: line.me/R/msg/text/?{text}（手機自動開 App、桌面開新分頁）
 * FB:   facebook.com/sharer/sharer.php?u={url}
 * Copy: navigator.clipboard.writeText
 */

interface Props {
  url: string;
  title: string;
}

export function ShareButtons({ url, title }: Props) {
  const [copied, setCopied] = useState(false);
  const lineShareText = encodeURIComponent(`${title}\n${url}`);
  const fbShareUrl = encodeURIComponent(url);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // navigator.clipboard 在非 HTTPS / 舊瀏覽器會失敗，退回 prompt
      window.prompt("複製這個連結：", url);
    }
  }

  return (
    <div className="inline-flex items-center gap-2 text-xs text-zinc-500">
      <span className="text-zinc-400">分享：</span>
      <a
        href={`https://line.me/R/msg/text/?${lineShareText}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white ring-1 ring-stone-300 hover:ring-emerald-500 hover:text-emerald-700 hover:-translate-y-0.5 transition-all"
        title="分享到 LINE"
      >
        <span aria-hidden>💬</span>
        LINE
      </a>
      <a
        href={`https://www.facebook.com/sharer/sharer.php?u=${fbShareUrl}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white ring-1 ring-stone-300 hover:ring-blue-500 hover:text-blue-700 hover:-translate-y-0.5 transition-all"
        title="分享到 Facebook"
      >
        <span aria-hidden>👍</span>
        FB
      </a>
      <button
        type="button"
        onClick={handleCopy}
        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white ring-1 transition-all hover:-translate-y-0.5 ${
          copied
            ? "ring-emerald-500 text-emerald-700"
            : "ring-stone-300 hover:ring-amber-500 hover:text-amber-700"
        }`}
        title="複製連結"
      >
        <span aria-hidden>{copied ? "✓" : "🔗"}</span>
        {copied ? "已複製" : "複製連結"}
      </button>
    </div>
  );
}
