"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app error boundary]", error);
  }, [error]);

  const sha = (process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? "").slice(0, 7) || "dev";
  const subject = encodeURIComponent(`[家具設計器] 系統錯誤回報 (build ${sha})`);
  const body = encodeURIComponent(
    `發生時間：${new Date().toISOString()}\nbuild：${sha}\n路徑：${typeof window !== "undefined" ? window.location.href : ""}\n錯誤訊息：${error.message}\ndigest：${error.digest ?? "n/a"}\n\n（請描述你剛剛做了什麼）`,
  );

  return (
    <main className="mx-auto flex max-w-2xl flex-col items-center px-4 py-24 text-center">
      <div className="text-6xl">⚠️</div>
      <h1 className="mt-4 text-2xl font-semibold">系統發生錯誤</h1>
      <p className="mt-2 text-zinc-600">
        家具設計器當機了。你可以重試，或回報這個問題給木頭仁。
      </p>
      <div className="mt-3 rounded bg-zinc-100 px-3 py-2 font-mono text-xs text-zinc-500">
        {error.message || "Unknown error"}
        {error.digest && <span> · digest:{error.digest}</span>}
      </div>
      <div className="mt-6 flex flex-wrap gap-3">
        <button
          onClick={reset}
          className="rounded-lg bg-zinc-900 px-5 py-2.5 text-white hover:bg-zinc-700"
        >
          重試
        </button>
        <Link
          href="/"
          className="rounded-lg border border-zinc-300 px-5 py-2.5 hover:bg-zinc-50"
        >
          回首頁
        </Link>
        <a
          href={`mailto:wengbinren@gmail.com?subject=${subject}&body=${body}`}
          className="rounded-lg border border-zinc-300 px-5 py-2.5 hover:bg-zinc-50"
        >
          回報這個錯誤
        </a>
      </div>
    </main>
  );
}
