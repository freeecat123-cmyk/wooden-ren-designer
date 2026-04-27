"use client";

import Link from "next/link";
import { PLAN_LABEL, type PlanId } from "@/lib/permissions";

interface Props {
  /** 缺少的功能描述（給使用者看的，例：「下載 PDF」「客製家具報價」） */
  feature: string;
  /** 哪個方案開始有這個功能（決定 CTA 文案） */
  requiredPlan: PlanId;
  /** 推薦理由的一句話（會接在「升級 X 方案」後）— 沒給用預設 */
  hint?: string;
  /** 樣式變體：card 整塊放置；inline 行內小提示 */
  variant?: "card" | "inline";
  /** 隱藏「立即升級」按鈕（外面想自己接動作時用） */
  hideCta?: boolean;
}

const PLAN_PRICE_LINE: Record<PlanId, string> = {
  free: "",
  personal: "個人版 NT$ 290 / 月",
  pro: "專業版 NT$ 890 / 月",
  student: "學員版（憑學員身份）",
  lifetime: "終身版 NT$ 8,900",
};

/**
 * 暖色調升級提示。語氣像朋友推薦，不強迫。
 */
export function UpgradePrompt({
  feature,
  requiredPlan,
  hint,
  variant = "card",
  hideCta = false,
}: Props) {
  const planLabel = PLAN_LABEL[requiredPlan];
  const priceLine = PLAN_PRICE_LINE[requiredPlan];

  if (variant === "inline") {
    return (
      <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-[#fff4e6] border border-[#d4a574] text-[#7c4f1a] text-xs">
        <span>🌱 想用 {feature}？升級 {planLabel}</span>
        {!hideCta && (
          <Link href="/pricing" className="underline font-medium hover:text-[#5a3812]">
            看方案 →
          </Link>
        )}
      </span>
    );
  }

  return (
    <div
      className="rounded-xl border-2 px-5 py-4"
      style={{ background: "#fff8ee", borderColor: "#d4a574" }}
    >
      <div className="flex items-start gap-3">
        <div className="text-2xl leading-none mt-0.5">🌱</div>
        <div className="flex-1">
          <div className="font-semibold text-[#5a3812] mb-1">
            想用「{feature}」嗎？
          </div>
          <p className="text-sm text-[#7c4f1a] leading-relaxed mb-2">
            {hint ?? `${planLabel}就能用囉～`}
            {priceLine && <span className="text-[#5a3812] font-medium"> · {priceLine}</span>}
          </p>
          {!hideCta && (
            <Link
              href="/pricing"
              className="inline-block mt-1 px-4 py-1.5 rounded-md bg-[#8b4513] text-white text-sm font-medium hover:bg-[#6f370f] transition-colors"
            >
              看方案
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
