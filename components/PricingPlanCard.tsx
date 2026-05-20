"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { InvoicePreflightModal } from "./InvoicePreflightModal";

export type BillingPeriod = "monthly" | "yearly";

export interface PlanCard {
  id:
    | "free"
    | "personal"
    | "pro"
    | "student_personal"
    | "student_pro";
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

/**
 * Plan tier 排序(跟 lib/pricing/plans.ts 的 TIER 保持一致)。
 * Client component 不能 import server-side lib,複製一份簡單 lookup。
 */
const TIER: Record<string, number> = {
  free: 0,
  personal: 1,
  student: 2,
  pro: 2,
  lifetime: 3,
};
function tier(p: string | null | undefined): number {
  if (!p) return 0;
  return TIER[p] ?? 0;
}

/**
 * 舊方案每月 / 每年標準價,給升級退費計算用 (跟 lib/pricing/plans.ts 同步)。
 * 不從 PLAN_PRICES 引,避免拉到 server lib 累贅。
 */
const PRICE_BY_PLAN: Record<string, { monthly: number; yearly: number }> = {
  personal: { monthly: 390, yearly: 3900 },
  pro: { monthly: 890, yearly: 8900 },
  student: { monthly: 219, yearly: 2190 }, // 同 student_personal
};

export function PlanCardView({
  plan,
  period,
  currentPlan = null,
  currentStatus = null,
  currentPeriod = null,
  currentExpiresAt = null,
}: {
  plan: PlanCard;
  period: BillingPeriod;
  /** user 目前的 plan (free/personal/pro/student/lifetime),用來顯示「升級/降級/已是」狀態 */
  currentPlan?: string | null;
  /** users.subscription_status,用來判斷是不是 active 訂閱中 */
  currentStatus?: string | null;
  /** user 當前訂閱的計費週期 monthly/yearly,用來判斷跨週期切換 */
  currentPeriod?: BillingPeriod | null;
  /** users.subscription_expires_at (ISO),算升級贈送的剩餘天數用 */
  currentExpiresAt?: string | null;
}) {
  const isFree = plan.monthlyPrice === 0;
  let priceLine: React.ReactNode;
  let belowPrice: React.ReactNode = null;

  // 結帳前發票偏好攔截 — 沒設過就彈 modal,設完才真送 checkout form
  const formRef = useRef<HTMLFormElement | null>(null);
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [hasInvoicePref, setHasInvoicePref] = useState<boolean | null>(null);
  const [checkingPref, setCheckingPref] = useState(false);

  async function handleCheckoutSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (checkingPref) return;
    // 已知有設過 → 直接送
    if (hasInvoicePref === true) {
      formRef.current?.submit();
      return;
    }
    setCheckingPref(true);
    try {
      const r = await fetch("/api/invoice-preference", { credentials: "include" });
      if (r.ok) {
        const j = await r.json();
        if (j.preference) {
          setHasInvoicePref(true);
          formRef.current?.submit();
          return;
        }
      }
      // 沒設過 → 開 modal
      setHasInvoicePref(false);
      setInvoiceModalOpen(true);
    } catch {
      // 抓 preference 出包 → fallback 開 modal 讓 user 填,不要靜默繼續 (否則拿不到 invoice)
      setInvoiceModalOpen(true);
    } finally {
      setCheckingPref(false);
    }
  }

  function handleInvoiceSaved() {
    setHasInvoicePref(true);
    setInvoiceModalOpen(false);
    // 等 state 更新完同步呼叫 form.submit() — 用 setTimeout 0 推到下個 tick
    setTimeout(() => formRef.current?.submit(), 0);
  }

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

      {(() => {
        if (isFree) {
          return (
            <Link
              href="/"
              className="mt-5 w-full inline-block text-center px-4 py-2.5 rounded-lg font-medium text-sm bg-zinc-900 text-white hover:bg-zinc-700 transition-colors"
            >
              {plan.cta}
            </Link>
          );
        }

        // 比對當前 plan 與這張卡的 plan
        const cardBase = plan.id.startsWith("student_") ? plan.id.replace("student_", "") : plan.id;
        const curT = tier(currentPlan);
        const cardT = tier(cardBase);
        const isActiveSub = currentStatus === "active" && curT > 0;
        const isCurrentTier = isActiveSub && curT === cardT;
        const isUpgrade = isActiveSub && cardT > curT;
        const isDowngrade = isActiveSub && cardT < curT;

        // 已是這個方案 → 灰按鈕標示 (但若跨週期 monthly↔yearly 切,提示「換週期請先取消」)
        if (isCurrentTier) {
          const samePeriod = currentPeriod && currentPeriod === period;
          if (samePeriod || !currentPeriod) {
            return (
              <div className="mt-5 w-full px-4 py-2.5 rounded-lg font-medium text-sm bg-emerald-50 text-emerald-800 ring-1 ring-emerald-300 text-center">
                ✓ 你目前的方案
              </div>
            );
          }
          // 跨週期切換 (例:月扣 → 年扣) 需先取消
          return (
            <Link
              href="/my-subscription"
              className="mt-5 w-full inline-block text-center px-4 py-2.5 rounded-lg font-medium text-sm bg-zinc-100 text-zinc-700 ring-1 ring-zinc-300 hover:bg-zinc-200 transition-colors"
            >
              換成{period === "yearly" ? "年" : "月"}付請先取消當前
            </Link>
          );
        }

        // 降級 → 不能直接買,引導去 /my-subscription
        if (isDowngrade) {
          return (
            <Link
              href="/my-subscription"
              className="mt-5 w-full inline-block text-center px-4 py-2.5 rounded-lg font-medium text-sm bg-zinc-100 text-zinc-700 ring-1 ring-zinc-300 hover:bg-zinc-200 transition-colors"
            >
              降級請先取消當前訂閱
            </Link>
          );
        }

        // 升級 → 走 checkout(server 端會先 cancel 舊 sub,新付款成功 webhook 退舊版 prorate)
        // 算剩餘天數 + prorate 退款金額 (跟 lib/pricing/prorate.ts 同公式,純 client 預覽)
        //
        // 三態:
        //   loaded + remaining > 0  → 顯示「立刻升級 · 退舊版 NT$ X」
        //   loaded + remaining = 0  → 「舊方案已無剩餘天數」
        //   未 loaded (race)        → 不顯示計算,只「立刻升級」+ 通用說明
        //                             (避免之前 bug:剛買完到 pricing,period 還沒拉回來
        //                              就誤顯示「已無剩餘天數」嚇到 user)
        const refundCalc = (() => {
          if (!isUpgrade) return { state: "n/a" as const };
          if (!currentExpiresAt || !currentPlan || !currentPeriod) {
            return { state: "loading" as const };
          }
          const priceRow = PRICE_BY_PLAN[currentPlan];
          if (!priceRow) return { state: "loading" as const };
          const paidAmount = priceRow[currentPeriod];
          const totalDays = currentPeriod === "yearly" ? 365 : 30;
          const ms = new Date(currentExpiresAt).getTime() - Date.now();
          if (Number.isNaN(ms) || ms <= 0) {
            return { state: "loaded" as const, remainingDays: 0, refundAmount: 0 };
          }
          const remainingDays = Math.floor(ms / 86400000);
          const raw = Math.floor((paidAmount * remainingDays) / totalDays);
          const refundAmount = Math.max(0, Math.min(paidAmount, raw));
          return { state: "loaded" as const, remainingDays, refundAmount };
        })();
        const ctaText =
          isUpgrade && refundCalc.state === "loaded" && refundCalc.refundAmount > 0
            ? `立刻升級 · 退舊版 NT$ ${refundCalc.refundAmount}`
            : isUpgrade
            ? "立刻升級"
            : plan.cta;
        return (
          <form
            ref={formRef}
            method="POST"
            action="/api/checkout"
            className="mt-5"
            onSubmit={handleCheckoutSubmit}
          >
            <input type="hidden" name="plan" value={plan.id} />
            <input type="hidden" name="period" value={period} />
            <button
              type="submit"
              disabled={checkingPref}
              className={`w-full px-4 py-2.5 rounded-lg font-medium text-sm transition-colors ${
                plan.highlight
                  ? "bg-[#8b4513] text-white hover:bg-[#6f370f]"
                  : "bg-zinc-900 text-white hover:bg-zinc-700"
              } disabled:opacity-60`}
            >
              {checkingPref ? "確認中…" : ctaText}
            </button>
            {isUpgrade && refundCalc.state === "loaded" && refundCalc.refundAmount > 0 && (
              <p className="mt-2 text-[11px] text-emerald-700 text-center leading-snug">
                舊方案剩 {refundCalc.remainingDays} 天未用,升級後自動退 <strong>NT$ {refundCalc.refundAmount}</strong> 回原信用卡(3-7 個工作日入帳)
              </p>
            )}
            {isUpgrade && refundCalc.state === "loaded" && refundCalc.refundAmount === 0 && (
              <p className="mt-2 text-[11px] text-zinc-500 text-center leading-snug">
                舊方案已無剩餘天數可退,新方案立刻啟用
              </p>
            )}
            {isUpgrade && refundCalc.state === "loading" && (
              <p className="mt-2 text-[11px] text-zinc-500 text-center leading-snug">
                升級後將自動退舊版未使用部分回原信用卡
              </p>
            )}
          </form>
        );
      })()}
      {!isFree && (
        <p className="mt-2 text-[11px] text-zinc-500 text-center">
          將跳轉綠界 ECPay 付款 · {period === "monthly" ? "信用卡(每月自動扣款)" : "信用卡 / ATM / 超商"}
        </p>
      )}

      <InvoicePreflightModal
        open={invoiceModalOpen}
        onClose={() => setInvoiceModalOpen(false)}
        onSaved={handleInvoiceSaved}
      />
    </div>
  );
}

/** 學員續用版方案資料（共享給 /pricing/student 與其他需要的頁面） */
export const STUDENT_PLANS: PlanCard[] = [
  {
    id: "student_personal",
    name: "學員續用 · 個人",
    monthlyPrice: 219,
    yearlyPrice: 2190,
    originalMonthly: 390,
    originalYearly: 390 * 12,
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
