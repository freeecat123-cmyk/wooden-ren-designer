"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useTranslations } from "next-intl";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("error");

  useEffect(() => {
    console.error("[app error boundary]", error);
  }, [error]);

  const sha = (process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? "").slice(0, 7) || "dev";
  const subject = encodeURIComponent(`${t("mailSubject")} (build ${sha})`);
  const body = encodeURIComponent(
    `time: ${new Date().toISOString()}\nbuild: ${sha}\nurl: ${typeof window !== "undefined" ? window.location.href : ""}\nmessage: ${error.message}\ndigest: ${error.digest ?? "n/a"}\n\n${t("mailBody")}`,
  );

  return (
    <main className="mx-auto flex max-w-2xl flex-col items-center px-4 py-24 text-center">
      <div className="text-6xl">{t("emoji")}</div>
      <h1 className="mt-4 text-2xl font-semibold">{t("h1")}</h1>
      <p className="mt-2 text-zinc-600">{t("body")}</p>
      <div className="mt-3 rounded bg-zinc-100 px-3 py-2 font-mono text-xs text-zinc-500">
        {error.message || t("unknown")}
        {error.digest && <span> · digest:{error.digest}</span>}
      </div>
      <div className="mt-6 flex flex-wrap gap-3">
        <button
          onClick={reset}
          className="rounded-lg bg-zinc-900 px-5 py-2.5 text-white hover:bg-zinc-700"
        >
          {t("retry")}
        </button>
        <Link
          href="/"
          className="rounded-lg border border-zinc-300 px-5 py-2.5 hover:bg-zinc-50"
        >
          {t("home")}
        </Link>
        <a
          href={`mailto:wengbinren@gmail.com?subject=${subject}&body=${body}`}
          className="rounded-lg border border-zinc-300 px-5 py-2.5 hover:bg-zinc-50"
        >
          {t("report")}
        </a>
      </div>
    </main>
  );
}
