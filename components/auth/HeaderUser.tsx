"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "./AuthProvider";
import { LoginButton } from "./LoginButton";
import { getPublicAdminEmails, isAdminEmail } from "@/lib/admin";

/**
 * 頁首右上角浮動的登入狀態 widget。
 * - 未登入：顯示「使用 Google 登入」按鈕
 * - 已登入：頭像 + 名字 + 下拉選單（我的設計 / 訂閱方案 / 登出）
 */
export function HeaderUser() {
  const { user, loading, signOut } = useAuth();

  if (loading) {
    return (
      <div className="h-9 w-32 rounded-lg bg-zinc-100 animate-pulse" />
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
        className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 ring-1 ring-zinc-200 shadow-sm hover:bg-amber-50 hover:ring-amber-300 transition"
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
        <span className="max-w-[140px] truncate">{name}</span>
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
        <div className="absolute right-0 mt-2 w-56 rounded-lg bg-white ring-1 ring-zinc-200 shadow-lg overflow-hidden z-50">
          <div className="px-4 py-3 border-b border-zinc-100 bg-amber-50/50">
            <div className="text-sm font-medium text-zinc-900 truncate">{name}</div>
            <div className="text-xs text-zinc-500 truncate">{user.email}</div>
          </div>
          <Link
            href="/account/designs"
            className="block px-4 py-2 text-sm text-zinc-700 hover:bg-amber-50"
            onClick={() => setOpen(false)}
          >
            🗂 我的設計
          </Link>
          <Link
            href="/projects"
            className="block px-4 py-2 text-sm text-zinc-700 hover:bg-amber-50"
            onClick={() => setOpen(false)}
          >
            📁 我的專案
          </Link>
          <Link
            href="/my-subscription"
            className="block px-4 py-2 text-sm text-zinc-700 hover:bg-amber-50"
            onClick={() => setOpen(false)}
          >
            💎 我的訂閱
          </Link>
          <Link
            href="/pricing"
            className="block px-4 py-2 text-sm text-zinc-700 hover:bg-amber-50"
            onClick={() => setOpen(false)}
          >
            💰 方案
          </Link>
          {isAdmin && (
            <Link
              href="/admin"
              className="block px-4 py-2 text-sm text-amber-800 hover:bg-amber-100 font-medium border-t border-amber-100"
              onClick={() => setOpen(false)}
            >
              🛠 後台儀表板
            </Link>
          )}
          <button
            type="button"
            onClick={signOut}
            className="block w-full text-left px-4 py-2 text-sm text-zinc-700 hover:bg-rose-50 hover:text-rose-700 border-t border-zinc-100"
          >
            登出
          </button>
        </div>
      )}
    </div>
  );
}
