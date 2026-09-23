"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";

export function BugReportFab() {
  const t = useTranslations("bugReport");
  const inDesigner = /\/(?:design)\/[^/]+/.test(usePathname() ?? "");
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

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
        <div className="no-print fixed bottom-40 lg:bottom-20 right-4 z-50 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-zinc-200 bg-white p-4 shadow-2xl">
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
        className={`no-print ${inDesigner ? "relative ml-auto mr-4 mt-4 mb-24 md:fixed md:m-0 md:bottom-24 lg:bottom-4 md:right-4" : "fixed bottom-24 lg:bottom-4 right-4"} z-50 flex h-12 items-center gap-1.5 rounded-full bg-white pl-1.5 pr-3.5 shadow-lg ring-1 ring-zinc-200 hover:bg-zinc-50 [body.wr-sheet-open_&]:pointer-events-none [body.wr-sheet-open_&]:opacity-0 transition-opacity`}
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
