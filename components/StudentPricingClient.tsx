"use client";

import { Link } from "@/i18n/navigation";
import { useState } from "react";
import { useLocale } from "next-intl";
import {
  PlanCardView,
  STUDENT_PLANS,
  type BillingPeriod,
} from "./PricingPlanCard";

/**
 * 學員續用方案隱藏頁面 — 只給木頭仁主動分享給學員的人看。
 * 不在公開 /pricing 顯示；不被搜尋引擎收錄（page.tsx 設 robots noindex）。
 */
export function StudentPricingClient() {
  const locale = useLocale();
  const [period, setPeriod] = useState<BillingPeriod>("monthly");

  if (locale !== "zh-TW") return null;

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
      <div className="text-center mb-8">
        <Link
          href="/"
          className="inline-block text-sm text-zinc-500 hover:text-zinc-700 mb-4"
        >
          ← 回家具列表
        </Link>
        <div className="inline-block px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-medium mb-3">
          🎓 學員專屬連結
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-zinc-900">
          學員續用方案
        </h1>
        <p className="mt-3 text-zinc-600 text-sm sm:text-base max-w-xl mx-auto leading-relaxed">
          木匠學院 / Hahow 學員 2 年免費期結束後，依需求挑一個續用：
          <br className="hidden sm:block" />
          DIY 自家用選個人版，接案 / 工作室選專業版
        </p>
      </div>

      {/* 月付 / 年付 toggle */}
      <div className="flex justify-center mb-8 sm:mb-10">
        <div className="inline-flex rounded-full border border-zinc-300 bg-white p-1 shadow-sm">
          <button
            type="button"
            onClick={() => setPeriod("monthly")}
            className={`px-5 py-2 rounded-full text-sm font-medium transition-colors ${
              period === "monthly"
                ? "bg-zinc-900 text-white"
                : "text-zinc-600 hover:text-zinc-900"
            }`}
          >
            月付
          </button>
          <button
            type="button"
            onClick={() => setPeriod("yearly")}
            className={`px-5 py-2 rounded-full text-sm font-medium transition-colors flex items-center gap-1.5 ${
              period === "yearly"
                ? "bg-zinc-900 text-white"
                : "text-zinc-600 hover:text-zinc-900"
            }`}
          >
            年付
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                period === "yearly"
                  ? "bg-emerald-500 text-white"
                  : "bg-emerald-100 text-emerald-700"
              }`}
            >
              省 2 個月
            </span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
        {STUDENT_PLANS.map((p) => (
          <PlanCardView key={p.id} plan={p} period={period} />
        ))}
      </div>

      <div className="mt-10 sm:mt-12 max-w-2xl mx-auto rounded-xl border-2 border-amber-200 bg-amber-50 p-5">
        <div className="font-semibold text-amber-900 text-sm flex items-center gap-2">
          ℹ️ 學員資格驗證
        </div>
        <ul className="mt-2 text-xs text-amber-800 leading-relaxed space-y-1 list-disc list-inside">
          <li>付款前系統會驗證你的帳號是否在學員白名單</li>
          <li>木匠學院 / Hahow 課程學員報名後 email 會自動帶入</li>
          <li>找不到資格但你確定是學員 → 寫信給木頭仁 補登</li>
        </ul>
      </div>

      <div className="mt-8 text-center text-xs text-zinc-500 leading-relaxed">
        <p>所有方案皆可隨時升降級。月費／年費方案到期未續訂自動降為免費版（你的設計、客戶資料保留 90 天）。</p>
        <p className="mt-2">年付 = 月費 × 10（省 2 個月），一年只付一次比較單純。</p>
      </div>
    </main>
  );
}
