"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

interface Props {
  className?: string;
  /** 點完安裝/關閉提示後呼叫（例如關掉 overflow menu） */
  onDone?: () => void;
}

export function InstallAppButton({ className, onDone }: Props) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [showIOSHint, setShowIOSHint] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone) {
      setInstalled(true);
      return;
    }

    // iPadOS 13+ 預設 UA 變成 "Macintosh",要靠 maxTouchPoints 才抓得到。
    // 舊規則 /iPad|iPhone|iPod/ 只能抓 iPhone 跟 iPodTouch + iPad 9.x 以下。
    const ua = window.navigator.userAgent;
    const isLegacyIOS =
      /iPad|iPhone|iPod/.test(ua) &&
      !(window as unknown as { MSStream?: unknown }).MSStream;
    const isIPadOS =
      /Macintosh/.test(ua) &&
      typeof window.navigator.maxTouchPoints === "number" &&
      window.navigator.maxTouchPoints > 1;
    setIsIOS(isLegacyIOS || isIPadOS);

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return null;
  // 不是 iOS 且沒拿到 prompt 事件就先不顯示（瀏覽器不支援 / 已安裝 / 還沒滿足 PWA 條件）
  if (!isIOS && !deferred) return null;

  const handleClick = async () => {
    if (deferred) {
      await deferred.prompt();
      await deferred.userChoice.catch(() => undefined);
      setDeferred(null);
      onDone?.();
      return;
    }
    if (isIOS) setShowIOSHint(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className={
          className ??
          "w-full flex items-center min-h-[48px] px-5 text-base text-zinc-800 hover:bg-zinc-50 text-left"
        }
      >
        📲 安裝 App 到主畫面
      </button>

      {showIOSHint && (
        <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5 space-y-3">
            <h3 className="text-base font-semibold text-zinc-900">安裝到主畫面（iOS）</h3>
            <ol className="text-sm text-zinc-700 space-y-2 list-decimal list-inside">
              <li>點擊 Safari 下方分享按鈕 <span aria-hidden>⬆️</span></li>
              <li>選擇「加入主畫面」</li>
              <li>點右上角「新增」即完成</li>
            </ol>
            <p className="text-xs text-zinc-500">
              注意：必須用 Safari 開啟才能安裝；Chrome / Line 內建瀏覽器無此選項。
            </p>
            <button
              type="button"
              onClick={() => {
                setShowIOSHint(false);
                onDone?.();
              }}
              className="w-full min-h-[44px] rounded-md bg-zinc-800 text-white text-sm font-semibold"
            >
              知道了
            </button>
          </div>
        </div>
      )}
    </>
  );
}
