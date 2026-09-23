"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { HeaderUser } from "@/components/auth/HeaderUser";
import { UnitToggle } from "@/components/UnitToggle";
import { CurrencyToggle } from "@/components/CurrencyToggle";

/**
 * 全站頂部導覽列（sticky top:0 z:50）
 *
 * 設計頁（/design/[type]）有自己的左上「回家具列表」+ 右上 ⋯ 移動式選單，
 * 為避免重複，設計頁不顯示這個 SiteHeader。
 *
 * 桌面：水平 link bar
 * 行動：漢堡選單，點 logo 旁 ☰ 展開
 *
 * Phase 2：使用 next-intl 的 Link/usePathname；hrefs 不帶 locale 前綴，
 * wrapper 會依當前 locale 自動處理（zh-TW 不前綴、en 前綴 /en）。
 */

const NAV_KEYS = ["about", "templates", "app", "pricing", "help", "changelog"] as const;
const NAV_HREFS: Record<(typeof NAV_KEYS)[number], string> = {
  about: "/about",
  templates: "/templates",
  app: "/app",
  pricing: "/pricing",
  help: "/help",
  changelog: "/changelog",
};

export function SiteHeader() {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const tLogo = useTranslations("logo");
  const [open, setOpen] = useState(false);

  // 路徑切換時關閉行動選單
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // 設計頁（/design/[type]）跟列印頁不顯示頂部 nav，避免跟編輯器 UI 打架。
  // 但要保留右上角浮動 HeaderUser（設計頁編輯器佈局依賴它）。
  if (
    pathname?.startsWith("/design/") ||
    pathname?.includes("/print") ||
    pathname?.includes("/quote")
  ) {
    return (
      <div className="no-print fixed top-4 right-4 z-40 flex items-center gap-2">
        <UnitToggle />
        <CurrencyToggle />
        <HeaderUser />
      </div>
    );
  }

  function isActive(href: string) {
    if (href === "/app") {
      return pathname === "/app" || pathname?.startsWith("/app");
    }
    if (href === "/") return pathname === "/";
    return pathname?.startsWith(href);
  }

  return (
    <header className="no-print sticky top-0 z-40 bg-[#fafaf7]/95 backdrop-blur-md border-b border-amber-900/10 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-2 shrink-0 group"
        >
          <span className="text-xl" aria-hidden>
            🪵
          </span>
          <span className="font-serif-tc font-bold text-amber-900 text-base sm:text-lg group-hover:text-amber-700 transition-colors hidden sm:inline">
            {tLogo("short")}
          </span>
        </Link>

        {/* 桌面 nav */}
        <nav className="hidden md:flex items-center gap-1 flex-1 justify-center">
          {NAV_KEYS.map((key) => {
            const href = NAV_HREFS[key];
            return (
              <Link
                key={key}
                href={href}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                  isActive(href)
                    ? "bg-amber-700 text-white shadow-sm"
                    : "text-zinc-700 hover:bg-amber-100/70 hover:text-amber-800"
                }`}
              >
                {t(key)}
              </Link>
            );
          })}
        </nav>

        {/* 右側：UnitToggle + HeaderUser + 行動漢堡 */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="hidden sm:flex items-center gap-2">
            <UnitToggle />
            <CurrencyToggle />
          </div>
          <HeaderUser />
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="md:hidden inline-flex items-center justify-center w-10 h-10 rounded-full hover:bg-amber-100/70 transition-colors"
            aria-label={open ? tLogo("menuClose") : tLogo("menuOpen")}
            aria-expanded={open}
          >
            <span className="text-xl" aria-hidden>
              {open ? "✕" : "☰"}
            </span>
          </button>
        </div>
      </div>

      {/* 行動 dropdown 選單 */}
      {open && (
        <nav className="md:hidden border-t border-amber-900/10 bg-white shadow-lg">
          <ul className="max-w-7xl mx-auto px-4 py-2 flex flex-col">
            {NAV_KEYS.map((key) => {
              const href = NAV_HREFS[key];
              return (
                <li key={key}>
                  <Link
                    href={href}
                    className={`block px-3 py-3 rounded-lg text-base font-medium transition-colors ${
                      isActive(href)
                        ? "bg-amber-100 text-amber-900"
                        : "text-zinc-700 hover:bg-amber-50 hover:text-amber-800"
                    }`}
                  >
                    {t(key)}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </header>
  );
}
