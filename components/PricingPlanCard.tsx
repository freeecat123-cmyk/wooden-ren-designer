"use client";

import Link from "next/link";

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

export function PlanCardView({
  plan,
  period,
  earlyBird = false,
  currentPlan = null,
  currentStatus = null,
}: {
  plan: PlanCard;
  period: BillingPeriod;
  earlyBird?: boolean;
  /** user 目前的 plan (free/personal/pro/student/lifetime),用來顯示「升級/降級/已是」狀態 */
  currentPlan?: string | null;
  /** users.subscription_status,用來判斷是不是 active 訂閱中 */
  currentStatus?: string | null;
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
  } else if (earlyBird) {
    const earlyPrice = Math.round(plan.monthlyPrice / 2);
    priceLine = (
      <>
        <span className="text-2xl sm:text-3xl font-bold text-[#c0651e]">
          NT$ {earlyPrice.toLocaleString()}
        </span>
        <span className="text-sm text-zinc-400 line-through">
          NT$ {plan.monthlyPrice.toLocaleString()}
        </span>
        <span className="text-sm text-zinc-500">/ 月</span>
      </>
    );
    belowPrice = (
      <p className="mt-1 text-xs text-[#c0651e] font-semibold">
        🔥 早鳥半價 · 首 3 個月，第 4 個月起 NT$ {plan.monthlyPrice}/月
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

        // 已是這個方案 → 灰按鈕標示
        if (isCurrentTier) {
          return (
            <div className="mt-5 w-full px-4 py-2.5 rounded-lg font-medium text-sm bg-emerald-50 text-emerald-800 ring-1 ring-emerald-300 text-center">
              ✓ 你目前的方案
            </div>
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

        // 升級 → 走 checkout(server 端會先 cancel 舊 sub)
        const ctaText = isUpgrade ? "升級到此方案(送本期重疊)" : plan.cta;
        return (
          <form method="POST" action="/api/checkout" className="mt-5">
            <input type="hidden" name="plan" value={plan.id} />
            <input type="hidden" name="period" value={period} />
            <button
              type="submit"
              className={`w-full px-4 py-2.5 rounded-lg font-medium text-sm transition-colors ${
                plan.highlight
                  ? "bg-[#8b4513] text-white hover:bg-[#6f370f]"
                  : "bg-zinc-900 text-white hover:bg-zinc-700"
              }`}
            >
              {ctaText}
            </button>
          </form>
        );
      })()}
      {!isFree && (
        <p className="mt-2 text-[11px] text-zinc-500 text-center">
          將跳轉綠界 ECPay 付款 · {period === "monthly" ? "信用卡(每月自動扣款)" : "信用卡 / ATM / 超商"}
        </p>
      )}
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
