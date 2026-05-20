/**
 * 站底版本資訊：學生回報 bug 時可以告訴你他用哪版。
 * Vercel 部署自動帶 NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA + NEXT_PUBLIC_VERCEL_ENV。
 * 本地 dev 沒有就顯示 "dev"。
 */
export function SiteFooter() {
  const sha = (process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? "").slice(0, 7) || "dev";
  const env = process.env.NEXT_PUBLIC_VERCEL_ENV ?? "local";
  const year = new Date().getFullYear();

  const links = [
    { href: "/about", label: "關於本站" },
    { href: "/help", label: "常見問題" },
    { href: "/terms", label: "服務條款" },
    { href: "/privacy", label: "隱私權政策" },
    { href: "/refund", label: "退費政策" },
    { href: "/contact", label: "聯絡我們" },
  ];

  return (
    <footer className="no-print mt-16 border-t border-amber-900/15 bg-amber-50/70 backdrop-blur-sm">
      <div className="mx-auto max-w-7xl px-6 py-9">
        {/* 品牌列 */}
        <div className="flex flex-col items-center gap-2 text-center">
          <a
            href="https://woodenren.com"
            className="inline-flex items-center gap-2 group"
          >
            <span className="font-serif-tc text-base font-bold text-amber-900 group-hover:text-amber-700 transition-colors">
              木頭仁木匠學院
            </span>
          </a>
          <p className="text-xs text-zinc-500">
            木作藍圖 · 把腦中的家具，畫成可以動手做的圖
          </p>
        </div>

        {/* 連結列 */}
        <nav className="mt-5 flex flex-wrap items-center justify-center gap-x-1 gap-y-1">
          {links.map((l, i) => (
            <span key={l.href} className="flex items-center">
              <a
                href={l.href}
                className="inline-flex items-center max-md:min-h-[44px] rounded-md px-2.5 py-1 text-sm text-zinc-600 hover:text-amber-800 hover:bg-amber-100/70 transition-colors"
              >
                {l.label}
              </a>
              {i < links.length - 1 && (
                <span aria-hidden className="text-amber-900/20 select-none">
                  ·
                </span>
              )}
            </span>
          ))}
        </nav>

        {/* 版權 + build */}
        <div className="mt-6 flex flex-col items-center gap-1.5 border-t border-amber-900/10 pt-5 text-center">
          <p className="text-xs text-zinc-500">
            © {year} 木頭仁木匠學院 · Wooden Ren Education Co., Ltd.
          </p>
          <p className="font-mono text-[11px] text-zinc-400">
            build {sha} · {env}
          </p>
        </div>
      </div>
    </footer>
  );
}
