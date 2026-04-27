"use client";

import { useEffect, useState } from "react";
import { useUserPlan } from "@/hooks/useUserPlan";

const STORAGE_KEY = "wr_student_welcomed";

/**
 * 木匠學院學員首次登入時跳一次歡迎彈窗。
 * - 條件：plan === "student" 且 localStorage 沒看過
 * - 看完後寫 localStorage flag 不再跳
 */
export function StudentWelcomeModal() {
  const { plan, isLoading, isLoggedIn } = useUserPlan();
  const [shouldShow, setShouldShow] = useState(false);

  useEffect(() => {
    if (isLoading || !isLoggedIn) return;
    if (plan !== "student") return;
    if (typeof window === "undefined") return;
    const seen = window.localStorage.getItem(STORAGE_KEY);
    if (!seen) setShouldShow(true);
  }, [plan, isLoading, isLoggedIn]);

  function handleClose() {
    try {
      window.localStorage.setItem(STORAGE_KEY, new Date().toISOString());
    } catch {
      // localStorage 被禁也讓 modal 關閉
    }
    setShouldShow(false);
  }

  if (!shouldShow) return null;

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/40 flex items-center justify-center px-4"
      onClick={handleClose}
    >
      <div
        className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-6 sm:p-8 border-2"
        style={{ borderColor: "#d4a574" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-4xl mb-3">🎉</div>
        <h2 className="text-xl sm:text-2xl font-bold text-[#5a3812] mb-3">
          歡迎，木匠學院的學員！
        </h2>
        <p className="text-sm sm:text-base text-[#7c4f1a] leading-relaxed mb-5">
          你已自動開通 <strong>學員專屬版</strong>，所有付費功能都能免費使用：
          無限儲存設計、PDF 下載（無浮水印）、客製家具報價系統、客戶管理⋯⋯
          全部到位。盡情用吧～
        </p>
        <button
          type="button"
          onClick={handleClose}
          className="w-full px-5 py-3 rounded-lg bg-[#8b4513] text-white font-medium hover:bg-[#6f370f] transition-colors"
        >
          開始設計家具
        </button>
        <button
          type="button"
          onClick={handleClose}
          className="block mx-auto mt-3 text-xs text-zinc-500 hover:underline"
        >
          稍後再說
        </button>
      </div>
    </div>
  );
}
