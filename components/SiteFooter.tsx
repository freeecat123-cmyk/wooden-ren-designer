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
    <footer className="mt-12 border-t border-zinc-200 bg-white/50 py-6 text-center text-xs text-zinc-500">
      <div className="mx-auto max-w-7xl px-4">
        <div>
          © {year}{" "}
          <a href="https://woodenren.com" className="underline-offset-2 hover:underline">
            木頭仁木匠學院
          </a>{" "}
          · Wooden Ren Education Co., Ltd.
        </div>
        <div className="mt-1 font-mono text-[10px] text-zinc-400">
          build {sha} · {env}
        </div>
      </div>
    </footer>
  );
}
