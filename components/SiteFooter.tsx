/**
 * 站底版本資訊：學生回報 bug 時可以告訴你他用哪版。
 * Vercel 部署自動帶 NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA + NEXT_PUBLIC_VERCEL_ENV。
 * 本地 dev 沒有就顯示 "dev"。
 */
export function SiteFooter() {
  const sha = (process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? "").slice(0, 7) || "dev";
  const env = process.env.NEXT_PUBLIC_VERCEL_ENV ?? "local";
  const year = new Date().getFullYear();
  return (
    <footer className="no-print mt-12 border-t border-zinc-200 bg-white/50 py-6 text-center text-xs text-zinc-500">
      <div className="mx-auto max-w-7xl px-4">
        <div className="flex flex-wrap justify-center items-center gap-1">
          <span>© {year}</span>
          <a href="https://woodenren.com" className="inline-flex items-center min-h-[44px] px-1 underline-offset-2 hover:underline">
            木頭仁木匠學院
          </a>
          <span>· Wooden Ren Education Co., Ltd.</span>
        </div>
        <div className="mt-2 flex flex-wrap justify-center gap-1">
          <a href="/terms" className="inline-flex items-center min-h-[44px] px-2 hover:underline">服務條款</a>
          <span aria-hidden className="self-center">·</span>
          <a href="/privacy" className="inline-flex items-center min-h-[44px] px-2 hover:underline">隱私權政策</a>
          <span aria-hidden className="self-center">·</span>
          <a href="/refund" className="inline-flex items-center min-h-[44px] px-2 hover:underline">退費政策</a>
          <span aria-hidden className="self-center">·</span>
          <a href="/contact" className="inline-flex items-center min-h-[44px] px-2 hover:underline">聯絡我們</a>
        </div>
        <div className="mt-2 font-mono text-xs text-zinc-400">
          build {sha} · {env}
        </div>
      </div>
    </footer>
  );
}
