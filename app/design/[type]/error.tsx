"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function DesignError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[design page error boundary]", error);
  }, [error]);

  const sha = (process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? "").slice(0, 7) || "dev";
  const url = typeof window !== "undefined" ? window.location.href : "";
  const subject = encodeURIComponent(`[家具設計器] 設計頁渲染錯誤 (build ${sha})`);
  const body = encodeURIComponent(
    `發生時間：${new Date().toISOString()}\nbuild：${sha}\n設計連結：${url}\n錯誤訊息：${error.message}\ndigest：${error.digest ?? "n/a"}\n\n（請描述你剛剛做了什麼，例如：「我把腳高調到 500mm 就壞了」）`,
  );

  // 把 query 拔掉只留 pathname，給「重設預設值」用
  const resetHref = typeof window !== "undefined" ? window.location.pathname : "/";

  return (
    <main className="mx-auto max-w-2xl px-4 py-20">
      <div className="rounded-2xl border border-amber-300 bg-amber-50 p-8 text-center">
        <div className="text-5xl">🔧</div>
        <h1 className="mt-3 text-xl font-semibold text-amber-900">這組設計參數導致渲染失敗</h1>
        <p className="mt-2 text-sm text-amber-800">
          通常是某個尺寸組合超出合理範圍。你可以：重設預設值、或回報這個 bug 給木頭仁修。
        </p>
        <div className="mt-3 rounded bg-white/70 px-3 py-2 font-mono text-xs text-amber-700">
          {error.message || "Unknown error"}
          {error.digest && <span> · digest:{error.digest}</span>}
        </div>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            onClick={reset}
            className="rounded-lg bg-zinc-900 px-5 py-2.5 text-white hover:bg-zinc-700"
          >
            重試
          </button>
          <Link
            href={resetHref}
            className="rounded-lg border border-zinc-300 bg-white px-5 py-2.5 hover:bg-zinc-50"
          >
            重設預設值
          </Link>
          <a
            href={`mailto:wengbinren@gmail.com?subject=${subject}&body=${body}`}
            className="rounded-lg border border-zinc-300 bg-white px-5 py-2.5 hover:bg-zinc-50"
          >
            回報這個錯誤
          </a>
          <Link
            href="/"
            className="rounded-lg border border-zinc-300 bg-white px-5 py-2.5 hover:bg-zinc-50"
          >
            回首頁
          </Link>
        </div>
      </div>
    </main>
  );
}
