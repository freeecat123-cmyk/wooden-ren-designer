"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { PlanCardView, type PlanCard, type BillingPeriod } from "./PricingPlanCard";
import { useUserPlan } from "@/hooks/useUserPlan";
import { TemplateUnlockSection } from "./TemplateUnlockSection";
import { ToolUnlockSection } from "./ToolUnlockSection";
import { FURNITURE_CATALOG } from "@/lib/templates";
import { isPaidCategory } from "@/lib/permissions";

// 跟 app/page.tsx 同步:開發中的家具不上架買斷,等做完才放
const DEVELOPMENT_CATEGORIES = new Set<string>(["chinese-cabinet", "bed", "coat-rack"]);

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
      "做方凳、筆筒、書擋就夠的",
      "還沒決定要不要付費的",
    ],
    features: [
      { ok: true, text: "3 種練習小物：方凳、筆筒、書擋" },
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
      { ok: true, text: "天花板骨架施工模擬器" },
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

interface CouponState {
  code: string;
  status: "idle" | "checking" | "ok" | "error";
  discountPercent?: number;
  error?: string;
}

export function PricingClient() {
  const [period, setPeriod] = useState<BillingPeriod>("monthly");
  const [lockedCategory, setLockedCategory] = useState<string | null>(null);
  const [coupon, setCoupon] = useState<CouponState>({ code: "", status: "idle" });
  const { profile, userId } = useUserPlan();
  const currentPlan = profile?.plan ?? null;
  const currentStatus = profile?.subscription_status ?? null;
  const [currentPeriod, setCurrentPeriod] = useState<BillingPeriod | null>(null);

  // 拉當前 active sub 的 period (monthly/yearly),給跨週期切換 UI 用
  useEffect(() => {
    if (!userId || currentStatus !== "active") {
      setCurrentPeriod(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { data } = await supabase
        .from("subscriptions")
        .select("period")
        .eq("user_id", userId)
        .eq("status", "active")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      const p = (data as { period?: string } | null)?.period;
      setCurrentPeriod(p === "yearly" || p === "monthly" ? (p as BillingPeriod) : null);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, currentStatus]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    const locked = sp.get("locked");
    if (locked) setLockedCategory(locked);
    // 支援 ?coupon=XXXX 自動填入
    const c = sp.get("coupon");
    if (c) setCoupon({ code: c.toUpperCase(), status: "idle" });
  }, []);

  // 切換 period / coupon code 改動時，重置 coupon 驗證狀態
  useEffect(() => {
    if (coupon.status === "ok" || coupon.status === "error") {
      setCoupon((c) => ({ code: c.code, status: "idle" }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  async function applyCoupon() {
    if (!coupon.code.trim()) return;
    setCoupon((c) => ({ ...c, status: "checking", error: undefined }));
    try {
      const res = await fetch("/api/coupon/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // plan 隨便挑一個（後端只用 plan 決定 baseAmount 預覽，實際結帳時用 user 選的）
        body: JSON.stringify({ code: coupon.code, plan: "personal", period }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setCoupon((c) => ({ ...c, status: "error", error: json.error ?? "驗證失敗" }));
      } else {
        setCoupon((c) => ({
          ...c,
          status: "ok",
          discountPercent: json.coupon.discountPercent,
        }));
      }
    } catch (e) {
      setCoupon((c) => ({
        ...c,
        status: "error",
        error: e instanceof Error ? e.message : "網路錯誤",
      }));
    }
  }

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
      {lockedCategory && (
        <div className="max-w-3xl mx-auto mb-8 px-5 py-4 rounded-2xl bg-amber-50 ring-1 ring-amber-400/60 shadow-sm flex items-start gap-3">
          <span className="text-2xl flex-shrink-0">🔒</span>
          <div className="flex-1 text-sm leading-relaxed">
            <p className="font-semibold text-amber-950">
              「{CATEGORY_NAME_ZH[lockedCategory] ?? lockedCategory}」是付費版才能用的家具範本
            </p>
            <p className="mt-1 text-amber-800">
              免費版只開放 3 種練習小物（方凳、筆筒、書擋）。其他真實家具可選「單範本買斷」或「升級個人版」。
              下方挑一個適合你的方案就能解鎖。
            </p>
          </div>
        </div>
      )}

      <div className="text-center mb-8">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-amber-800 mb-5 transition-colors"
        >
          ← 回家具列表
        </Link>
        <h1 className="font-serif-tc text-3xl sm:text-4xl font-bold tracking-tight text-amber-950">
          選一個適合你的方案
        </h1>
        <p className="mt-3 text-zinc-600 text-sm sm:text-base">
          不論你是 DIY 玩家、接案師傅，還是設計師，都有對應方案
        </p>
      </div>

      {/* 月付 / 年付 toggle */}
      <div className="flex justify-center mb-8 sm:mb-10">
        <div className="inline-flex rounded-full ring-1 ring-amber-900/15 bg-white p-1 shadow-sm">
          <button
            type="button"
            onClick={() => setPeriod("monthly")}
            className={`px-6 py-2 rounded-full text-sm font-semibold transition-all ${
              period === "monthly"
                ? "bg-amber-800 text-white shadow-sm"
                : "text-zinc-600 hover:text-amber-800"
            }`}
          >
            月付
          </button>
          <button
            type="button"
            onClick={() => setPeriod("yearly")}
            className={`px-6 py-2 rounded-full text-sm font-semibold transition-all flex items-center gap-1.5 ${
              period === "yearly"
                ? "bg-amber-800 text-white shadow-sm"
                : "text-zinc-600 hover:text-amber-800"
            }`}
          >
            年付
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                period === "yearly"
                  ? "bg-emerald-400 text-emerald-950"
                  : "bg-emerald-100 text-emerald-700"
              }`}
            >
              省 2 個月
            </span>
          </button>
        </div>
      </div>

      {/* Coupon 折扣碼 */}
      <div className="max-w-md mx-auto mb-8">
        <div className="rounded-2xl bg-white ring-1 ring-amber-900/10 p-4 shadow-sm">
          <label className="block text-xs font-semibold text-zinc-700 mb-2">
            🎫 折扣碼（可選）
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={coupon.code}
              onChange={(e) =>
                setCoupon((c) => ({
                  code: e.target.value.toUpperCase(),
                  status: c.status === "ok" ? "idle" : c.status,
                }))
              }
              placeholder="例：LAUNCH-XXXXXXXX"
              className="flex-1 px-3 py-2 rounded-lg border border-zinc-300 text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <button
              type="button"
              onClick={applyCoupon}
              disabled={!coupon.code.trim() || coupon.status === "checking"}
              className="px-4 py-2 rounded-lg bg-zinc-800 text-white text-sm font-semibold hover:bg-zinc-900 disabled:opacity-50"
            >
              {coupon.status === "checking" ? "驗證中…" : "套用"}
            </button>
          </div>
          {coupon.status === "ok" && (
            <p className="mt-2 text-xs text-emerald-700 font-semibold">
              ✅ 折扣 {coupon.discountPercent}% 已套用（限年付方案，結帳自動扣）
            </p>
          )}
          {coupon.status === "error" && (
            <p className="mt-2 text-xs text-rose-700">❌ {coupon.error}</p>
          )}
          {coupon.status === "ok" && period === "monthly" && (
            <p className="mt-1 text-xs text-amber-700">
              ⚠️ 此 coupon 只能用年付,切到上方「年付」才會生效
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6 items-start">
        {PLANS.map((p) => (
          <PlanCardView
            key={p.id}
            plan={p}
            period={period}
            currentPlan={currentPlan}
            currentStatus={currentStatus}
            currentPeriod={currentPeriod}
            currentExpiresAt={profile?.subscription_expires_at ?? null}
            couponCode={coupon.status === "ok" && period === "yearly" ? coupon.code : null}
            couponDiscountPercent={coupon.status === "ok" && period === "yearly" ? coupon.discountPercent ?? null : null}
          />
        ))}
      </div>

      {/* 單範本買斷 section */}
      <TemplateUnlockSection
        catalog={FURNITURE_CATALOG
          .filter((e) => isPaidCategory(e.category))
          .filter((e) => !DEVELOPMENT_CATEGORIES.has(e.category))
          .map((e) => ({
            category: e.category,
            nameZh: e.nameZh,
            difficulty: e.difficulty,
          }))}
        lockedCategory={lockedCategory}
      />

      {/* 裝潢工具買斷 */}
      <ToolUnlockSection />

      <div className="mt-12 max-w-2xl mx-auto rounded-2xl bg-amber-50/80 ring-1 ring-amber-900/10 px-6 py-5 text-center text-xs text-zinc-600 leading-relaxed">
        <p className="flex items-center justify-center gap-1.5">
          <span aria-hidden>🔄</span>
          所有方案皆可隨時升降級。月費／年費方案到期未續訂自動降為免費版
          （你的設計、客戶資料保留 90 天）。
        </p>
        <p className="mt-2 flex items-center justify-center gap-1.5">
          <span aria-hidden>💡</span>
          年付 = 月費 × 10（省 2 個月），一年只付一次比較單純。
        </p>
      </div>
    </main>
  );
}
