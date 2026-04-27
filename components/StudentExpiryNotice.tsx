"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useUserPlan } from "@/hooks/useUserPlan";
import { studentDaysRemaining } from "@/lib/permissions";

const STORAGE_PREFIX = "wr_expiry_dismissed_";

function todayKey(): string {
  return STORAGE_PREFIX + new Date().toISOString().slice(0, 10);
}

/**
 * 學員到期前 30 天頂部橫幅。
 * - 條件：profile.plan === "student" 且 daysLeft ∈ [1, 30]
 * - 可關（X 按鈕）→ 寫 localStorage 當天不再顯示
 * - 過期（daysLeft ≤ 0）不再顯示這個通知（已經被降為 free，由 /my-subscription 內顯示）
 */
export function StudentExpiryNotice() {
  const { profile, isLoggedIn, isLoading } = useUserPlan();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(todayKey())) {
      setDismissed(true);
    }
  }, []);

  if (isLoading || !isLoggedIn) return null;
  if (profile?.plan !== "student") return null;

  const daysLeft = studentDaysRemaining(profile);
  if (daysLeft === null || daysLeft <= 0 || daysLeft > 30) return null;
  if (dismissed) return null;

  function handleDismiss() {
    try {
      window.localStorage.setItem(todayKey(), "1");
    } catch {
      // ignore
    }
    setDismissed(true);
  }

  return (
    <div
      className="w-full px-4 py-3 sm:px-6 border-b-2 flex items-center gap-3 flex-wrap"
      style={{ background: "#FFF8E7", borderColor: "#d4a574", color: "#5C3317" }}
    >
      <span className="text-base flex-shrink-0">📅</span>
      <div className="flex-1 min-w-0 text-sm leading-relaxed">
        <strong>你的學員專屬版還有 {daysLeft} 天到期</strong>
        <span className="ml-2 text-[#7c4f1a]">
          ／ 第 3 年起可享學員專屬價：個人 NT$ 219、專業 NT$ 690 / 月
        </span>
      </div>
      <Link
        href="/pricing"
        className="px-3 py-1.5 rounded bg-[#8b4513] text-white text-xs font-medium hover:bg-[#6f370f] flex-shrink-0"
      >
        立即續訂
      </Link>
      <button
        type="button"
        onClick={handleDismiss}
        className="px-2 py-1 text-xs text-[#7c4f1a] hover:text-[#5C3317] flex-shrink-0"
        title="當天不再顯示"
      >
        稍後再說 ✕
      </button>
    </div>
  );
}
