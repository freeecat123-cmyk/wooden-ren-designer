"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { EarlyBirdBanner, EARLY_BIRD } from "./EarlyBirdBanner";
import { PlanCardView, type PlanCard, type BillingPeriod } from "./PricingPlanCard";

const CATEGORY_NAME_ZH: Record<string, string> = {
  stool: "方凳",
  bench: "長凳",
  "tea-table": "邊桌",
  "side-table": "床邊桌",
  "low-table": "矮桌",
  "open-bookshelf": "開放書櫃",
  "chest-of-drawers": "斗櫃",
  "shoe-cabinet": "鞋櫃",
  "display-cabinet": "玻璃展示櫃",
  "dining-table": "餐桌",
  desk: "書桌",
  "dining-chair": "餐椅",
  wardrobe: "衣櫃",
  "bar-stool": "吧檯椅",
  "media-console": "電視櫃",
  nightstand: "床頭櫃",
  "round-stool": "圓凳",
  "round-tea-table": "圓茶几",
  "round-table": "圓餐桌",
  "pencil-holder": "筆筒",
  bookend: "書擋",
  "photo-frame": "相框",
  tray: "托盤",
  "dovetail-box": "木盒",
  "wine-rack": "紅酒架",
  "coat-rack": "立式衣帽架",
};

const PLANS: PlanCard[] = [
  {
    id: "free",
    name: "免費版",
    monthlyPrice: 0,
    yearlyPrice: 0,
    audience: [
      "想先試試看的",
      "做方凳、茶几、筆筒就夠的",
      "還沒決定要不要付費的",
    ],
    features: [
      { ok: true, text: "3 種入門家具：方凳、茶几、筆筒" },
      { ok: true, text: "3D 透視圖預覽" },
      { ok: true, text: "工程三視圖（含浮水印）" },
      { ok: false, text: "其他 16 種家具" },
      { ok: false, text: "下載 PDF" },
      { ok: false, text: "客製家具報價" },
    ],
    cta: "立即免費使用",
  },
  {
    id: "personal",
    name: "個人版",
    monthlyPrice: 390,
    yearlyPrice: 3900,
    originalYearly: 390 * 12,
    audience: ["DIY 木工玩家", "週末做家具的人", "自己家裡用的"],
    features: [
      { ok: true, text: "無限儲存設計" },
      { ok: true, text: "下載 PDF（無浮水印）" },
      { ok: true, text: "完整裁切計算器" },
      { ok: true, text: "全部範本 + 3D 預覽" },
      { ok: false, text: "天花板骨架施工模擬器" },
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
      { ok: true, text: "天花板骨架施工模擬器" },
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

export function PricingClient() {
  const [period, setPeriod] = useState<BillingPeriod>("monthly");
  const [lockedCategory, setLockedCategory] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    const locked = sp.get("locked");
    if (locked) setLockedCategory(locked);
  }, []);

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
      <EarlyBirdBanner />

      {lockedCategory && (
        <div
          className="max-w-3xl mx-auto mb-8 px-5 py-4 rounded-xl border-2 flex items-start gap-3"
          style={{ background: "#fff8ee", borderColor: "#d4a574" }}
        >
          <span className="text-2xl flex-shrink-0">🔒</span>
          <div className="flex-1 text-sm leading-relaxed">
            <p className="font-semibold text-[#5a3812]">
              「{CATEGORY_NAME_ZH[lockedCategory] ?? lockedCategory}」是付費版才能用的家具範本
            </p>
            <p className="mt-1 text-[#7c4f1a]">
              免費版只開放 3 種入門款（方凳、茶几、筆筒），其他 16 種要升級個人版以上。
              下方挑一個適合你的方案就能解鎖。
            </p>
          </div>
        </div>
      )}

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
          <PlanCardView
            key={p.id}
            plan={p}
            period={period}
            earlyBird={p.id === "pro" && period === "monthly" && EARLY_BIRD.isActive()}
          />
        ))}
      </div>

      <div className="mt-12 text-center text-xs text-zinc-500 max-w-2xl mx-auto leading-relaxed">
        <p>
          所有方案皆可隨時升降級。月費／年費方案到期未續訂自動降為免費版
          （你的設計、客戶資料保留 90 天）。
        </p>
        <p className="mt-2">
          年付 = 月費 × 10（省 2 個月），一年只付一次比較單純。
        </p>
      </div>
    </main>
  );
}
