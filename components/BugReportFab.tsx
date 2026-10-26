"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";

/**
 * 「回報問題」浮動鈕跟放大／全螢幕浮層同為 z-50,而它掛在 layout 的 children 之後,
 * DOM 順序讓它畫在浮層上面 → 放大三視圖時會壓住圖面右下角(實測 desktop 1440x900
 * 蓋掉 110x48px 的圖)。這支負責從「畫面中心最上層的元素」往上找有沒有吃點擊的全螢幕浮層。
 *
 * ⚠️ 三個排除條件都是實測踩過的,拿掉任何一條都會讓回報鈕在不該消失的時候消失:
 *   - display:none / visibility:hidden —— 關著的 <dialog> 一直留在 DOM 裡
 *   - pointer-events:none —— TrialWatermark 是常駐的 fixed inset-0,不吃點擊
 *   - 沒鋪滿畫面的 fixed(sticky header、側邊欄)不算浮層
 */
export function fullscreenLayerAbove(
  start: Element | null,
  win: {
    innerWidth: number;
    innerHeight: number;
    getComputedStyle: (el: Element) => Pick<
      CSSStyleDeclaration,
      "position" | "display" | "visibility" | "pointerEvents"
    >;
  },
): boolean {
  for (let node = start; node; node = node.parentElement) {
    const cs = win.getComputedStyle(node);
    if (cs.position !== "fixed") continue;
    if (cs.display === "none" || cs.visibility === "hidden") continue;
    if (cs.pointerEvents === "none") continue;
    const r = node.getBoundingClientRect();
    if (r.width >= win.innerWidth * 0.9 && r.height >= win.innerHeight * 0.9) {
      return true;
    }
  }
  return false;
}

export function BugReportFab() {
  const t = useTranslations("bugReport");
  const inDesigner = /\/(?:design)\/[^/]+/.test(usePathname() ?? "");
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [behindOverlay, setBehindOverlay] = useState(false);

  // 浮層一開就讓位(等同 MobileShell 用 body.wr-sheet-open 讓位的作法,只是這裡自己偵測,
  // 不用去改 ZoomableThreeViews / PartDrawingsPanel 等 6 支浮層)。
  useEffect(() => {
    let raf = 0;
    const scan = () => {
      raf = 0;
      const mid = document.elementFromPoint(
        Math.round(window.innerWidth / 2),
        Math.round(window.innerHeight / 2),
      );
      setBehindOverlay(fullscreenLayerAbove(mid, window));
    };
    const queue = () => {
      if (!raf) raf = window.requestAnimationFrame(scan);
    };
    queue();
    const mo = new MutationObserver(queue);
    mo.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "style", "open", "hidden"],
    });
    window.addEventListener("resize", queue);
    window.addEventListener("scroll", queue, { passive: true });
    return () => {
      mo.disconnect();
      window.removeEventListener("resize", queue);
      window.removeEventListener("scroll", queue);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, []);

  const sha =
    (process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? "").slice(0, 7) || "dev";

  function buildReport() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
    const subject = t("subjectTpl", { sha });
    // 描述欄放最上面:Gmail 撰寫視窗游標停在信件開頭,使用者第一眼要看到「請描述問題」,
    // 不是四行看不懂的機器資訊。2026-09-07 收到一封整封沒改過的空回報就是這樣來的。
    const body =
      `${t("bodyDescH")}\n` +
      `${t("bodyDescExample")}\n\n\n` +
      `${t("bodyScreenshotH")}\n` +
      `${t("bodyScreenshotHint")}\n\n` +
      `${t("bodyMetaH")}\n` +
      `${t("bodyTimePre")}${new Date().toLocaleString()}\n` +
      `${t("bodyBuildPre")}${sha}\n` +
      `${t("bodyPagePre")}${url}\n` +
      `${t("bodyBrowserPre")}${ua}\n`;
    return { subject, body };
  }

  function openGmailCompose() {
    const { subject, body } = buildReport();
    const to = "wengbinren@gmail.com";

    const webUrl = new URL("https://mail.google.com/mail/");
    webUrl.searchParams.set("view", "cm");
    webUrl.searchParams.set("fs", "1");
    webUrl.searchParams.set("to", to);
    webUrl.searchParams.set("su", subject);
    webUrl.searchParams.set("body", body);

    const ua = navigator.userAgent;
    const isMobile = /Android|iPhone|iPad|iPod/i.test(ua);

    if (isMobile) {
      const appUrl =
        `googlegmail://co?to=${encodeURIComponent(to)}` +
        `&subject=${encodeURIComponent(subject)}` +
        `&body=${encodeURIComponent(body)}`;

      const start = Date.now();
      const fallback = () => {
        if (document.hidden) return;
        if (Date.now() - start < 1400) return;
        window.open(webUrl.toString(), "_blank", "noopener");
      };
      const timer = window.setTimeout(fallback, 1500);
      const onHide = () => {
        if (document.hidden) window.clearTimeout(timer);
      };
      document.addEventListener("visibilitychange", onHide, { once: true });

      window.location.href = appUrl;
      setOpen(false);
      return;
    }

    window.open(webUrl.toString(), "_blank", "noopener");
    setOpen(false);
  }

  async function copyToClipboard() {
    const { subject, body } = buildReport();
    const text = `To: wengbinren@gmail.com\nSubject: ${subject}\n\n${body}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt(t("copyPromptTpl"), text);
    }
  }


  return (
    <>
      {open && (
        <div className={`no-print ${behindOverlay ? "pointer-events-none opacity-0" : ""} fixed bottom-40 lg:bottom-20 right-4 z-50 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-zinc-200 bg-white p-4 shadow-2xl transition-opacity`}>
          <div className="text-sm font-semibold text-zinc-900">
            {t("panelH")}
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-zinc-600">
            {t("panelBodyPre")}
            <span className="font-mono text-zinc-800">wengbinren@gmail.com</span>
          </p>
          <button
            onClick={openGmailCompose}
            className="mt-3 w-full rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700"
          >
            {t("gmailBtn")}
          </button>
          <button
            onClick={copyToClipboard}
            className="mt-2 w-full rounded-md border border-zinc-300 px-3 py-2 text-xs hover:bg-zinc-50"
          >
            {copied ? t("copyBtnDone") : t("copyBtnIdle")}
          </button>
          <button
            onClick={() => setOpen(false)}
            className="mt-2 w-full text-center text-xs text-zinc-500 hover:text-zinc-700"
          >
            {t("cancel")}
          </button>
        </div>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        title={t("fabTitle")}
        aria-label={t("fabTitle")}
        className={`no-print ${behindOverlay ? "pointer-events-none opacity-0" : ""} ${inDesigner ? "relative ml-auto mr-4 mt-4 mb-24 md:fixed md:m-0 md:bottom-24 lg:bottom-4 md:right-4" : "fixed bottom-24 lg:bottom-4 right-4"} z-50 flex h-12 items-center gap-1.5 rounded-full bg-white pl-1.5 pr-3.5 shadow-lg ring-1 ring-zinc-200 hover:bg-zinc-50 [body.wr-sheet-open_&]:pointer-events-none [body.wr-sheet-open_&]:opacity-0 transition-opacity`}
      >
        <img
          src="/logo-mark.png"
          alt={t("logoAlt")}
          className="h-9 w-9 shrink-0 object-contain"
        />
        {/* 只有 logo 的白色圓鈕沒人看得出是回報問題(四個月只收到 2 封) → 把字露出來 */}
        <span className="whitespace-nowrap text-xs font-medium text-zinc-700">
          {t("fabTitle")}
        </span>
      </button>
    </>
  );
}
