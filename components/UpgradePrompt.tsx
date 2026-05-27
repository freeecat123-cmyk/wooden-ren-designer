"use client";

import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { type PlanId } from "@/lib/permissions";

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
  const t = useTranslations("upgradePrompt");
  const tPlanLabel = useTranslations("planLabel");
  const planLabel = tPlanLabel(requiredPlan);
  const PLAN_PRICE_LINE: Record<PlanId, string> = {
    free: t("planPriceFree"),
    personal: t("planPricePersonal"),
    pro: t("planPricePro"),
    student: t("planPriceStudent"),
    lifetime: t("planPriceLifetime"),
  };
  const priceLine = PLAN_PRICE_LINE[requiredPlan];

  if (variant === "inline") {
    return (
      <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-[#fff4e6] border border-[#d4a574] text-[#7c4f1a] text-xs">
        <span>{t("inlineTpl", { feature, plan: planLabel })}</span>
        {!hideCta && (
          <Link href="/pricing" className="underline font-medium hover:text-[#5a3812]">
            {t("inlineCta")}
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
            {t("cardH", { feature })}
          </div>
          <p className="text-sm text-[#7c4f1a] leading-relaxed mb-2">
            {hint ?? t("cardHintFallbackTpl", { plan: planLabel })}
            {priceLine && <span className="text-[#5a3812] font-medium"> · {priceLine}</span>}
          </p>
          {!hideCta && (
            <Link
              href="/pricing"
              className="inline-block mt-1 px-4 py-1.5 rounded-md bg-[#8b4513] text-white text-sm font-medium hover:bg-[#6f370f] transition-colors"
            >
              {t("cardCta")}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
