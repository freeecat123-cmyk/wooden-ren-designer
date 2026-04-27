"use client";

import { useAuth } from "@/components/auth/AuthProvider";
import { LoginButton } from "@/components/auth/LoginButton";

/**
 * 首頁未登入時顯示的學員引導橫幅——LINE 對話框風格的軟提示。
 * 已登入或 loading 時不顯示。
 */
export function StudentLoginHint() {
  const { user, loading } = useAuth();
  if (loading || user) return null;

  return (
    <div className="mb-6 sm:mb-8 flex justify-center">
      <div
        className="relative max-w-2xl w-full rounded-2xl border-2 px-5 py-4 sm:px-6 sm:py-5 flex items-start gap-3 sm:gap-4"
        style={{ background: "#fff8ee", borderColor: "#d4a574" }}
      >
        {/* 木頭仁頭像（圓形） */}
        <div className="flex-shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="木頭仁"
            className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-white object-contain border border-[#d4a574]"
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-[#5a3812] text-sm sm:text-base">
            是木匠學院的學員嗎？✨
          </div>
          <p className="mt-1 text-xs sm:text-sm text-[#7c4f1a] leading-relaxed">
            登入就自動開通完整功能（無限儲存、PDF 下載、客製報價⋯⋯都解鎖）。
            非學員也能登入儲存自己的設計。
          </p>
          <div className="mt-2 sm:mt-3">
            <LoginButton />
          </div>
        </div>
      </div>
    </div>
  );
}
