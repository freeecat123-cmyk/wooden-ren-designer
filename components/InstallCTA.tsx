"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

/**
 * 安裝引導頁頂端的智慧 CTA。
 *
 * - Android / 桌面 Chrome・Edge:抓到 `beforeinstallprompt` → 顯示可一鍵安裝的按鈕
 * - iOS Safari:沒有 prompt API → 提示用下方分享鈕(對照頁面的 iOS 步驟)
 * - 已安裝(standalone):顯示完成狀態
 * - 其他(不支援的瀏覽器):提示照下方步驟手動加入
 */

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type Mode = "loading" | "installable" | "ios" | "installed" | "manual";

export function InstallCTA() {
  const t = useTranslations("installPage.cta");
  const [mode, setMode] = useState<Mode>("loading");
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone) {
      setMode("installed");
      return;
    }

    const ua = window.navigator.userAgent;
    const isIOS =
      (/iPad|iPhone|iPod/.test(ua) &&
        !(window as unknown as { MSStream?: unknown }).MSStream) ||
      (/Macintosh/.test(ua) &&
        typeof window.navigator.maxTouchPoints === "number" &&
        window.navigator.maxTouchPoints > 1);

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setMode("installable");
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", () => setMode("installed"));

    // beforeinstallprompt 可能晚一點才來;先給平台 fallback
    if (isIOS) {
      setMode("ios");
    } else {
      setMode("manual");
    }

    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const install = async () => {
    if (!deferred) return;
    try {
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      if (outcome === "accepted") setMode("installed");
    } catch {
      /* 取消或被拒 */
    }
    setDeferred(null);
  };

  if (mode === "installed") {
    return (
      <p className="inline-flex items-center gap-2 rounded-xl bg-emerald-50 px-5 py-3 text-emerald-800 font-semibold ring-1 ring-emerald-200">
        <span aria-hidden>✅</span>
        {t("installed")}
      </p>
    );
  }

  if (mode === "installable") {
    return (
      <button
        type="button"
        onClick={install}
        className="inline-flex items-center gap-2 rounded-xl bg-amber-700 px-6 py-3 text-white font-semibold shadow-sm hover:bg-amber-800 transition-colors"
      >
        <span aria-hidden>📲</span>
        {t("installNow")}
      </button>
    );
  }

  if (mode === "ios") {
    return (
      <p className="inline-flex items-center gap-2 rounded-xl bg-amber-50 px-5 py-3 text-amber-900 ring-1 ring-amber-200">
        <span aria-hidden>👇</span>
        {t("iosHint")}
      </p>
    );
  }

  if (mode === "manual") {
    return (
      <p className="inline-flex items-center gap-2 rounded-xl bg-stone-50 px-5 py-3 text-zinc-700 ring-1 ring-zinc-200">
        <span aria-hidden>👇</span>
        {t("manualHint")}
      </p>
    );
  }

  // loading
  return (
    <p className="inline-flex items-center gap-2 rounded-xl bg-stone-50 px-5 py-3 text-zinc-400 ring-1 ring-zinc-200">
      {t("loading")}
    </p>
  );
}
