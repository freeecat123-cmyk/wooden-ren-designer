"use client";

import Link from "next/link";
import { useState } from "react";

type BillingPeriod = "monthly" | "yearly";

interface PlanCard {
  id: "free" | "personal" | "pro" | "student_personal" | "student_pro";
  name: string;
  monthlyPrice: number;
  yearlyPrice: number;
  /** 月付對比的「原價」(月費 × 12)，年付才顯示劃線 */
  originalYearly?: number;
  /** 原價月費（學員續用版顯示劃線對比用） */
  originalMonthly?: number;
  audience: string[];
  features: Array<{ ok: boolean; text: string }>;
  highlight?: boolean;
  studentOnly?: boolean;
  cta: string;
}

const PLANS: PlanCard[] = [
  {
    id: "free",
    name: "免費版",
    monthlyPrice: 0,
    yearlyPrice: 0,
    audience: ["想先試試看的", "偶爾畫一張就好的", "做小物件練手的"],
    features: [
      { ok: true, text: "全部 19 種家具範本" },
      { ok: true, text: "3D 透視圖預覽" },
      { ok: true, text: "工程三視圖（含浮水印）" },
      { ok: false, text: "下載 PDF" },
      { ok: false, text: "客製家具報價" },
      { ok: false, text: "儲存超過 1 件設計" },
    ],
    cta: "立即免費使用",
  },
  {
    id: "personal",
    name: "個人版",
    monthlyPrice: 290,
    yearlyPrice: 2900,
    originalYearly: 290 * 12,
    audience: ["DIY 木工玩家", "週末做家具的人", "自己家裡用的"],
    features: [
      { ok: true, text: "無限儲存設計" },
      { ok: true, text: "下載 PDF（無浮水印）" },
      { ok: true, text: "完整裁切計算器" },
      { ok: true, text: "全部範本 + 3D 預覽" },
      { ok: false, text: "客製家具報價系統" },
      { ok: false, text: "客戶資料管理" },
    ],
    cta: "選擇個人版",
  },
  {
    id: "pro",
    name: "專業版",
    monthlyPrice: 890,
    yearlyPrice: 8900,
    originalYearly: 890 * 12,
    audience: ["接案木工師傅", "獨立傢俱設計師", "工作室經營者"],
    features: [
      { ok: true, text: "個人版全部功能" },
      { ok: true, text: "客製家具報價系統" },
      { ok: true, text: "自訂報價單抬頭 / LOGO" },
      { ok: true, text: "客戶資料管理" },
      { ok: true, text: "PDF 報價單一鍵產出" },
      { ok: true, text: "LINE / Email 一鍵分享" },
    ],
    highlight: true,
    cta: "選擇專業版",
  },
];

const STUDENT_PLANS: PlanCard[] = [
  {
    id: "student_personal",
    name: "學員續用 · 個人",
    monthlyPrice: 219,
    yearlyPrice: 2190,
    originalMonthly: 290,
    originalYearly: 290 * 12,
    audience: ["DIY 自家用的學員", "做完課程作品想繼續做家具", "不需要報價系統"],
    features: [
      { ok: true, text: "個人版全部功能" },
      { ok: true, text: "無限儲存設計" },
      { ok: true, text: "PDF 下載（無浮水印）" },
      { ok: true, text: "完整裁切計算器" },
      { ok: true, text: "學員專屬約 25% 折扣" },
      { ok: false, text: "客製家具報價系統" },
    ],
    studentOnly: true,
    cta: "選擇學員 · 個人",
  },
  {
    id: "student_pro",
    name: "學員續用 · 專業",
    monthlyPrice: 690,
    yearlyPrice: 6900,
    originalMonthly: 890,
    originalYearly: 890 * 12,
    audience: ["學完去接案的學員", "獨立工作室經營者", "需要完整報價/客戶管理"],
    features: [
      { ok: true, text: "專業版全部功能" },
      { ok: true, text: "客製家具報價系統" },
      { ok: true, text: "自訂報價單抬頭 / LOGO" },
      { ok: true, text: "客戶資料管理" },
      { ok: true, text: "PDF 報價單一鍵產出" },
      { ok: true, text: "學員專屬約 22% 折扣" },
    ],
    studentOnly: true,
    cta: "選擇學員 · 專業",
  },
];

export function PricingClient() {
  const [period, setPeriod] = useState<BillingPeriod>("monthly");

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
      <div className="text-center mb-8">
        <Link
          href="/"
          className="inline-block text-sm text-zinc-500 hover:text-zinc-700 mb-4"
        >
          ← 回家具列表
        </Link>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-zinc-900">
          選一個適合你的方案
        </h1>
        <p className="mt-3 text-zinc-600 text-sm sm:text-base">
          不論你是 DIY 玩家、接案師傅，還是設計師，都有對應方案
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
        {PLANS.map((p) => (
          <PlanCardView key={p.id} plan={p} period={period} />
        ))}
      </div>

      {/* === 學員續用版（兩條分流）=== */}
      <section className="mt-14 sm:mt-16">
        <div className="text-center mb-5">
          <h2 className="text-xl sm:text-2xl font-bold text-zinc-900">
            🎓 學員專屬續用方案
          </h2>
          <p className="mt-2 text-sm text-zinc-500">
            木匠學院 / Hahow 學員 2 年免費期結束後，依需求挑一個續用：
            DIY 自家用選個人，接案/工作室選專業
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5 max-w-3xl mx-auto">
          {STUDENT_PLANS.map((p) => (
            <PlanCardView key={p.id} plan={p} period={period} />
          ))}
        </div>
      </section>

      <div className="mt-12 text-center text-xs text-zinc-500 max-w-2xl mx-auto leading-relaxed">
        <p>
          所有方案皆可隨時升降級。月費／年費方案到期未續訂自動降為免費版
          （你的設計、客戶資料保留 90 天）。
        </p>
        <p className="mt-2">
          年付 = 月費 × 10（省 2 個月），一年只付一次比較單純。
        </p>
        <p className="mt-2">
          學員版限 木匠學院 / Hahow 課程學員，註冊後 email 自動帶入白名單。
        </p>
      </div>
    </main>
  );
}

function PlanCardView({
  plan,
  period,
}: {
  plan: PlanCard;
  period: BillingPeriod;
}) {
  const isFree = plan.monthlyPrice === 0;
  let priceLine: React.ReactNode;
  let belowPrice: React.ReactNode = null;

  if (isFree) {
    priceLine = (
      <>
        <span className="text-2xl sm:text-3xl font-bold text-zinc-900">NT$ 0</span>
        <span className="text-sm text-zinc-500">
          {period === "yearly" ? "/ 年" : "/ 月"}
        </span>
      </>
    );
  } else if (period === "yearly") {
    const monthlyEq = Math.round(plan.yearlyPrice / 12);
    priceLine = (
      <>
        <span className="text-2xl sm:text-3xl font-bold text-zinc-900">
          NT$ {plan.yearlyPrice.toLocaleString()}
        </span>
        {plan.originalYearly && plan.originalYearly > plan.yearlyPrice && (
          <span className="text-sm text-zinc-400 line-through">
            NT$ {plan.originalYearly.toLocaleString()}
          </span>
        )}
        <span className="text-sm text-zinc-500">/ 年</span>
      </>
    );
    belowPrice = (
      <p className="mt-1 text-xs text-emerald-700 font-medium">
        相當於 NT$ {monthlyEq} / 月
        {plan.originalYearly &&
          plan.originalYearly > plan.yearlyPrice &&
          `（省 NT$ ${(plan.originalYearly - plan.yearlyPrice).toLocaleString()}）`}
      </p>
    );
  } else {
    priceLine = (
      <>
        <span className="text-2xl sm:text-3xl font-bold text-zinc-900">
          NT$ {plan.monthlyPrice.toLocaleString()}
        </span>
        {plan.originalMonthly && plan.originalMonthly > plan.monthlyPrice && (
          <span className="text-sm text-zinc-400 line-through">
            NT$ {plan.originalMonthly.toLocaleString()}
          </span>
        )}
        <span className="text-sm text-zinc-500">/ 月</span>
      </>
    );
  }

  return (
    <div
      className={`relative rounded-xl border-2 bg-white p-5 sm:p-6 flex flex-col ${
        plan.highlight ? "border-[#8b4513] shadow-lg" : "border-zinc-200"
      }`}
    >
      {plan.highlight && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-[#8b4513] text-white text-xs font-semibold">
          ★ 推薦
        </div>
      )}

      <h2 className="text-lg sm:text-xl font-bold text-zinc-900">{plan.name}</h2>
      <div className="mt-2 flex items-baseline gap-1 flex-wrap">{priceLine}</div>
      {belowPrice}
      {plan.studentOnly && (
        <p className="mt-1 text-xs text-amber-700 font-medium">🎓 限木匠學院學員</p>
      )}

      <ul className="mt-3 text-xs text-zinc-600 space-y-0.5">
        {plan.audience.map((a) => (
          <li key={a}>· {a}</li>
        ))}
      </ul>

      <hr className="my-4 border-zinc-200" />

      <ul className="flex-1 space-y-2 text-sm">
        {plan.features.map((f, i) => (
          <li
            key={i}
            className={`flex items-start gap-2 ${
              f.ok ? "text-zinc-700" : "text-zinc-400 line-through"
            }`}
          >
            <span className="mt-0.5 leading-none">{f.ok ? "✓" : "✗"}</span>
            <span>{f.text}</span>
          </li>
        ))}
      </ul>

      <button
        type="button"
        className={`mt-5 w-full px-4 py-2.5 rounded-lg font-medium text-sm transition-colors ${
          plan.highlight
            ? "bg-[#8b4513] text-white hover:bg-[#6f370f]"
            : "bg-zinc-900 text-white hover:bg-zinc-700"
        } disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        {plan.cta}
      </button>
      <p className="mt-2 text-[11px] text-zinc-400 text-center">付款功能即將開放</p>
    </div>
  );
}
