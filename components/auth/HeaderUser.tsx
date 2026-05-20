"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "./AuthProvider";
import { LoginButton } from "./LoginButton";
import { getPublicAdminEmails, isAdminEmail } from "@/lib/admin";
import { InstallAppButton } from "@/components/InstallAppButton";

/**
 * 頁首右上角浮動的登入狀態 widget。
 * - 未登入：顯示「使用 Google 登入」按鈕
 * - 已登入：頭像 + 名字 + 下拉選單（我的設計 / 訂閱方案 / 登出）
 */
export function HeaderUser() {
  const { user, loading, signOut } = useAuth();

  if (loading) {
    return (
      <div className="h-9 w-32 rounded-xl bg-amber-100/70 animate-pulse" />
    );
  }

  if (!user) {
    return <LoginButton />;
  }

  return <UserDropdown user={user} signOut={signOut} />;
}

function UserDropdown({
  user,
  signOut,
}: {
  user: { email?: string; user_metadata?: { full_name?: string; avatar_url?: string } };
  signOut: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // 點外面關閉下拉
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  const name = user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? "已登入";
  const avatar = user.user_metadata?.avatar_url;
  const isAdmin = isAdminEmail(user.email, getPublicAdminEmails());

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        className="inline-flex items-center gap-2 rounded-xl bg-white/95 backdrop-blur px-3 py-1.5 max-md:min-h-[44px] text-sm font-medium text-zinc-800 ring-1 ring-amber-900/10 shadow-sm hover:bg-amber-50 hover:ring-amber-300 hover:shadow active:scale-[0.98] transition"
      >
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatar}
            alt=""
            className="h-6 w-6 rounded-full ring-1 ring-zinc-200"
          />
        ) : (
          <div className="h-6 w-6 rounded-full bg-amber-200 text-amber-900 text-xs font-bold flex items-center justify-center">
            {name[0]?.toUpperCase()}
          </div>
        )}
        <span className="hidden md:inline max-w-[140px] truncate">{name}</span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          aria-hidden="true"
          className={`transition ${open ? "rotate-180" : ""}`}
        >
          <path d="M2 4l4 4 4-4" stroke="currentColor" fill="none" strokeWidth="1.5" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-60 rounded-2xl bg-white ring-1 ring-amber-900/10 shadow-xl overflow-hidden z-50">
          <div className="flex items-center gap-3 px-4 py-3.5 bg-amber-50 border-b border-amber-900/10">
            {avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatar} alt="" className="h-9 w-9 rounded-full ring-1 ring-amber-900/15" />
            ) : (
              <div className="h-9 w-9 rounded-full bg-amber-200 text-amber-900 text-sm font-bold flex items-center justify-center">
                {name[0]?.toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <div className="text-sm font-semibold text-zinc-900 truncate">{name}</div>
              <div className="text-xs text-zinc-500 truncate">{user.email}</div>
            </div>
          </div>
          <div className="py-1.5">
            {[
              { href: "/", icon: "🪑", label: "家具列表" },
              { href: "/account/designs", icon: "🗂", label: "我的設計" },
              { href: "/projects", icon: "📁", label: "我的專案" },
              { href: "/customers", icon: "👥", label: "客戶名單" },
              { href: "/settings/branding", icon: "🏢", label: "抬頭設定" },
              { href: "/my-subscription", icon: "💎", label: "我的訂閱" },
              { href: "/pricing", icon: "💰", label: "方案" },
            ].map((it) => (
              <Link
                key={it.href}
                href={it.href}
                className="flex items-center gap-2.5 mx-1.5 px-2.5 py-2 rounded-lg text-sm text-zinc-700 hover:bg-amber-50 hover:text-amber-900 transition-colors"
                onClick={() => setOpen(false)}
              >
                <span className="w-5 text-center">{it.icon}</span>
                {it.label}
              </Link>
            ))}
          </div>
          <div className="py-1.5 border-t border-zinc-100">
            {[
              { href: "/about", icon: "ℹ️", label: "關於本站" },
              { href: "/help", icon: "❓", label: "常見問題" },
            ].map((it) => (
              <Link
                key={it.href}
                href={it.href}
                className="flex items-center gap-2.5 mx-1.5 px-2.5 py-2 rounded-lg text-sm text-zinc-700 hover:bg-amber-50 hover:text-amber-900 transition-colors"
                onClick={() => setOpen(false)}
              >
                <span className="w-5 text-center">{it.icon}</span>
                {it.label}
              </Link>
            ))}
            {isAdmin && (
              <Link
                href="/admin"
                className="flex items-center gap-2.5 mx-1.5 px-2.5 py-2 rounded-lg text-sm text-amber-800 hover:bg-amber-100 font-medium transition-colors"
                onClick={() => setOpen(false)}
              >
                <span className="w-5 text-center">🛠</span>
                後台儀表板
              </Link>
            )}
            <InstallAppButton
              onDone={() => setOpen(false)}
              className="flex w-[calc(100%-12px)] items-center mx-1.5 px-2.5 py-2 rounded-lg text-sm text-zinc-700 hover:bg-amber-50 hover:text-amber-900 transition-colors"
            />
          </div>
          <div className="py-1.5 border-t border-zinc-100">
            <button
              type="button"
              onClick={signOut}
              className="flex w-[calc(100%-12px)] items-center gap-2.5 mx-1.5 px-2.5 py-2 rounded-lg text-sm text-zinc-600 hover:bg-rose-50 hover:text-rose-700 transition-colors"
            >
              <span className="w-5 text-center">↩</span>
              登出
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
