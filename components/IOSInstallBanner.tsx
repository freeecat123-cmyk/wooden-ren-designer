"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

const DISMISS_KEY = "ios-install-banner-dismissed-v1";
const DELAY_MS = 4000;

export function IOSInstallBanner() {
  const t = useTranslations("iosInstall");
  const [show, setShow] = useState(false);
  const [expanded, setExpanded] = useState(false);

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

    const ua = window.navigator.userAgent;
    const isLegacyIOS =
      /iPad|iPhone|iPod/.test(ua) &&
      !(window as unknown as { MSStream?: unknown }).MSStream;
    const isIPadOS =
      /Macintosh/.test(ua) &&
      typeof window.navigator.maxTouchPoints === "number" &&
      window.navigator.maxTouchPoints > 1;
    const isIOS = isLegacyIOS || isIPadOS;
    if (!isIOS) return;

    const isNonSafariBrowser = /CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
    if (isNonSafariBrowser) return;

    const isWebview =
      /Line|FB_IAB|FBAN|FBAV|Instagram/i.test(ua) ||
      (!/Safari/.test(ua) && /Mobile/.test(ua));
    if (isWebview) return;

    const tm = window.setTimeout(() => setShow(true), DELAY_MS);
    return () => window.clearTimeout(tm);
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[70] px-3 pb-3 pointer-events-none">
      <div className="pointer-events-auto mx-auto max-w-md rounded-xl bg-gradient-to-br from-amber-50 to-stone-100 ring-1 ring-amber-300 shadow-xl">
        {!expanded ? (
          <div className="flex items-center gap-3 p-3">
            <span aria-hidden className="text-2xl">📲</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-zinc-900 leading-tight">
                {t("title")}
              </p>
              <p className="text-xs text-zinc-600 mt-0.5">{t("subtitle")}</p>
            </div>
            <button
              type="button"
              onClick={() => setExpanded(true)}
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
        ) : (
          <div className="p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-base font-semibold text-zinc-900">
                {t("expandedH")}
              </h3>
              <button
                type="button"
                onClick={dismiss}
                aria-label={t("closeAria")}
                className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-200"
              >
                ✕
              </button>
            </div>
            <ol className="text-sm text-zinc-700 space-y-2 list-decimal list-inside">
              <li>
                {t("step1Pre")}
                <strong>{t("step1Strong")}</strong>
                {t("step1Suffix")}
                <span aria-hidden className="inline-block px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-700 text-xs">{t("step1Icon")}</span>
              </li>
              <li>
                {t("step2Pre")}
                <strong>{t("step2Strong")}</strong>
              </li>
              <li>
                {t("step3Pre")}
                <strong>{t("step3Strong")}</strong>
                {t("step3Suffix")}
              </li>
            </ol>
            <p className="text-xs text-amber-800 bg-amber-100 rounded px-2 py-1.5 leading-relaxed">
              {t("warnPre")}
              <strong>{t("warnStrong")}</strong>
              {t("warnSuffix")}
            </p>
            <button
              type="button"
              onClick={dismiss}
              className="w-full min-h-[44px] rounded-lg bg-zinc-800 text-white text-sm font-semibold hover:bg-zinc-900"
            >
              {t("okBtn")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
