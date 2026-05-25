"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { HeaderUser } from "@/components/auth/HeaderUser";

/**
 * 全站頂部導覽列（sticky top:0 z:50）
 *
 * 設計頁（/design/[type]）有自己的左上「回家具列表」+ 右上 ⋯ 移動式選單，
 * 為避免重複，設計頁不顯示這個 SiteHeader。
 *
 * 桌面：水平 link bar
 * 行動：漢堡選單，點 logo 旁 ☰ 展開
 */

const NAV_LINKS = [
  { href: "/templates", label: "範本介紹" },
  { href: "/app", label: "家具範本" },
  { href: "/pricing", label: "方案定價" },
  { href: "/help", label: "常見問題" },
  { href: "/changelog", label: "更新日誌" },
];

export function SiteHeader() {
  const pathname = usePathname();
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
      <div className="no-print fixed top-4 right-4 z-40">
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
            木作藍圖
          </span>
        </Link>

        {/* 桌面 nav */}
        <nav className="hidden md:flex items-center gap-1 flex-1 justify-center">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                isActive(l.href)
                  ? "bg-amber-700 text-white shadow-sm"
                  : "text-zinc-700 hover:bg-amber-100/70 hover:text-amber-800"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        {/* 右側：HeaderUser + 行動漢堡 */}
        <div className="flex items-center gap-2 shrink-0">
          <HeaderUser />
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="md:hidden inline-flex items-center justify-center w-10 h-10 rounded-full hover:bg-amber-100/70 transition-colors"
            aria-label={open ? "關閉選單" : "開啟選單"}
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
            {NAV_LINKS.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className={`block px-3 py-3 rounded-lg text-base font-medium transition-colors ${
                    isActive(l.href)
                      ? "bg-amber-100 text-amber-900"
                      : "text-zinc-700 hover:bg-amber-50 hover:text-amber-800"
                  }`}
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  );
}
