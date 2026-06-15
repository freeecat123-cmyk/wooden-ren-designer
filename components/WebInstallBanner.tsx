"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

/**
 * Android / 桌面 Chrome・Edge 的安裝 banner。
 *
 * 跟 IOSInstallBanner 互補:iOS Safari 不會觸發 `beforeinstallprompt`,所以兩者
 * 平台互斥,同時掛在 layout 不會雙重顯示。
 *
 * 這支抓 `beforeinstallprompt` 事件存起來,使用者點「安裝」時呼叫原生
 * `prompt()` 直接彈系統安裝對話框 — 不用教學,一鍵裝好。
 */

// 最小化 BeforeInstallPromptEvent 型別(瀏覽器原生,TS lib 沒內建)
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "web-install-banner-dismissed-v1";

export function WebInstallBanner() {
  const t = useTranslations("webInstall");
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      if (localStorage.getItem(DISMISS_KEY)) return;
    } catch {
      /* localStorage 不可用就當沒記住 */
    }

    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone) return;

    const onPrompt = (e: Event) => {
      // 阻止瀏覽器自動彈 mini-infobar,改由我們的 banner 控制時機
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setShow(true);
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", () => setShow(false));
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
    setShow(false);
  };

  const install = async () => {
    if (!deferred) return;
    try {
      await deferred.prompt();
      await deferred.userChoice;
    } catch {
      /* 使用者取消或瀏覽器拒絕 */
    }
    setDeferred(null);
    setShow(false);
  };

  if (!show || !deferred) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[70] px-3 pb-3 pointer-events-none">
      <div className="pointer-events-auto mx-auto max-w-md rounded-xl bg-gradient-to-br from-amber-50 to-stone-100 ring-1 ring-amber-300 shadow-xl">
        <div className="flex items-center gap-3 p-3">
          <span aria-hidden className="text-2xl">
            📲
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-zinc-900 leading-tight">
              {t("title")}
            </p>
            <p className="text-xs text-zinc-600 mt-0.5">{t("subtitle")}</p>
          </div>
          <button
            type="button"
            onClick={install}
            className="shrink-0 px-3 py-1.5 rounded-lg bg-amber-700 text-white text-sm font-semibold hover:bg-amber-800"
          >
            {t("installBtn")}
          </button>
          <button
            type="button"
            onClick={dismiss}
            aria-label={t("closeAria")}
            className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-200"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
