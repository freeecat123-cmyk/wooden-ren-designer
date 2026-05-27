"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useTranslations } from "next-intl";

export default function DesignError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("designError");

  useEffect(() => {
    console.error("[design page error boundary]", error);
  }, [error]);

  const sha = (process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? "").slice(0, 7) || "dev";
  const url = typeof window !== "undefined" ? window.location.href : "";
  const subject = encodeURIComponent(t("subjectTpl", { sha }));
  const body = encodeURIComponent(
    t("bodyTpl", {
      time: new Date().toISOString(),
      sha,
      url,
      message: error.message,
      digest: error.digest ?? "n/a",
    }),
  );

  // 把 query 拔掉只留 pathname，給「重設預設值」用
  const resetHref = typeof window !== "undefined" ? window.location.pathname : "/";

  return (
    <main className="mx-auto max-w-2xl px-4 py-20">
      <div className="rounded-2xl border border-amber-300 bg-amber-50 p-8 text-center">
        <div className="text-5xl">🔧</div>
        <h1 className="mt-3 text-xl font-semibold text-amber-900">{t("h1")}</h1>
        <p className="mt-2 text-sm text-amber-800">
          {t("body")}
        </p>
        <div className="mt-3 rounded bg-white/70 px-3 py-2 font-mono text-xs text-amber-700">
          {error.message || t("unknownError")}
          {error.digest && <span> · digest:{error.digest}</span>}
        </div>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            onClick={reset}
            className="rounded-lg bg-zinc-900 px-5 py-2.5 text-white hover:bg-zinc-700"
          >
            {t("btnRetry")}
          </button>
          <Link
            href={resetHref}
            className="rounded-lg border border-zinc-300 bg-white px-5 py-2.5 hover:bg-zinc-50"
          >
            {t("btnReset")}
          </Link>
          <a
            href={`mailto:wengbinren@gmail.com?subject=${subject}&body=${body}`}
            className="rounded-lg border border-zinc-300 bg-white px-5 py-2.5 hover:bg-zinc-50"
          >
            {t("btnReport")}
          </a>
          <Link
            href="/"
            className="rounded-lg border border-zinc-300 bg-white px-5 py-2.5 hover:bg-zinc-50"
          >
            {t("btnHome")}
          </Link>
        </div>
      </div>
    </main>
  );
}
