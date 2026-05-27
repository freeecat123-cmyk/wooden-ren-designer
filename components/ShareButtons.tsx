"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

interface Props {
  url: string;
  title: string;
}

export function ShareButtons({ url, title }: Props) {
  const t = useTranslations("shareButtons");
  const [copied, setCopied] = useState(false);
  const lineShareText = encodeURIComponent(`${title}\n${url}`);
  const fbShareUrl = encodeURIComponent(url);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt(t("copyPrompt"), url);
    }
  }

  return (
    <div className="inline-flex items-center gap-2 text-xs text-zinc-500">
      <span className="text-zinc-400">{t("lbl")}</span>
      <a
        href={`https://line.me/R/msg/text/?${lineShareText}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white ring-1 ring-stone-300 hover:ring-emerald-500 hover:text-emerald-700 hover:-translate-y-0.5 transition-all"
        title={t("lineTitle")}
      >
        <span aria-hidden>💬</span>
        LINE
      </a>
      <a
        href={`https://www.facebook.com/sharer/sharer.php?u=${fbShareUrl}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white ring-1 ring-stone-300 hover:ring-blue-500 hover:text-blue-700 hover:-translate-y-0.5 transition-all"
        title={t("fbTitle")}
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
        title={t("copyTitle")}
      >
        <span aria-hidden>{copied ? "✓" : "🔗"}</span>
        {copied ? t("copiedLabel") : t("copyLabel")}
      </button>
    </div>
  );
}
