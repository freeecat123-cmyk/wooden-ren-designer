"use client";

/**
 * Lemon Squeezy 國際版 pricing UI
 * 顯示 Pro Monthly / Pro Annual / Lifetime 三方案，按下按鈕走
 * /api/lemon-squeezy/checkout 建 LS hosted checkout 後跳轉。
 *
 * 文案走 next-intl `lemon.pricing` namespace（en 主、未來加新語言補 zh-TW 等）。
 */

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { PlanId } from "@/lib/permissions";
import { LemonSingleTemplateSection } from "./LemonSingleTemplateSection";

interface CatalogItem {
  id: string;
  nameEn: string;
  kind: "furniture" | "tool";
  difficulty: "beginner" | "intermediate" | "advanced";
}

interface Props {
  isAuthed: boolean;
  /** 有效方案：free=尚未擁有全部；其餘付費版=全模板已含 */
  effectivePlan: PlanId;
  loginHref: string;
  catalog: CatalogItem[];
  lockedCategory?: string | null;
}

const CHECKOUT_ENDPOINT = "/api/lemon-squeezy/checkout";

export function LemonSqueezyPricingClient({
  isAuthed,
  effectivePlan,
  loginHref,
  catalog,
  lockedCategory,
}: Props) {
  const t = useTranslations("lemon.pricing");
  // 付費版已解鎖全部模板 → 單模板區與訂閱卡都做防呆，避免重複付款。
  const ownsAllTemplates = effectivePlan !== "free";
  // Lifetime = 永久擁有一切，連訂閱方案都不該再推。
  const isLifetime = effectivePlan === "lifetime";
  return (
    <main className="min-h-[calc(100vh-120px)] mx-auto max-w-5xl px-6 py-16 text-zinc-800">
      <div className="text-center mb-12">
        <h1 className="font-serif text-4xl sm:text-5xl font-bold tracking-tight text-zinc-900 leading-tight">
          {t("heroTitle")}
        </h1>
        <p className="mt-4 text-lg text-zinc-600 max-w-2xl mx-auto">
          {t("heroSubtitle")}
        </p>
      </div>

      <div className="grid sm:grid-cols-3 gap-6">
        <PlanCard
          title={t("monthlyTitle")}
          price={t("monthlyPrice")}
          period={t("monthlyPeriod")}
          subtitle={t("monthlySubtitle")}
          features={t.raw("monthlyFeatures") as string[]}
          ctaLabel={t("monthlyCta")}
          checkoutType="sub_monthly"
          isAuthed={isAuthed}
          alreadyOwned={isLifetime}
          loginHref={loginHref}
        />
        <PlanCard
          title={t("annualTitle")}
          price={t("annualPrice")}
          period={t("annualPeriod")}
          subtitle={t("annualSubtitle")}
          features={t.raw("annualFeatures") as string[]}
          ctaLabel={t("annualCta")}
          checkoutType="sub_yearly"
          isAuthed={isAuthed}
          alreadyOwned={isLifetime}
          loginHref={loginHref}
          highlighted
          bestValueLabel={t("bestValue")}
        />
        <PlanCard
          title={t("lifetimeTitle")}
          price={t("lifetimePrice")}
          period={t("lifetimePeriod")}
          subtitle={t("lifetimeSubtitle")}
          features={t.raw("lifetimeFeatures") as string[]}
          ctaLabel={t("lifetimeCta")}
          checkoutType="lifetime"
          isAuthed={isAuthed}
          alreadyOwned={isLifetime}
          loginHref={loginHref}
        />
      </div>

      <LemonSingleTemplateSection
        catalog={catalog}
        lockedCategory={lockedCategory}
        isAuthed={isAuthed}
        ownsAllTemplates={ownsAllTemplates}
        loginHref={loginHref}
      />

      <div className="mt-16 text-sm text-zinc-500 text-center border-t border-zinc-200 pt-6">
        <p>
          {t("footerPaymentsBy")}{" "}
          <a
            href="https://www.lemonsqueezy.com"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-amber-700"
          >
            Lemon Squeezy
          </a>{" "}
          {t("footerMoR")}
        </p>
      </div>
    </main>
  );
}

interface PlanCardProps {
  title: string;
  price: string;
  period: string;
  subtitle: string;
  features: string[];
  ctaLabel: string;
  checkoutType: "sub_monthly" | "sub_yearly" | "lifetime";
  isAuthed: boolean;
  /** 已是 Lifetime → 連訂閱方案都已涵蓋，置灰防重複付款 */
  alreadyOwned?: boolean;
  loginHref: string;
  highlighted?: boolean;
  bestValueLabel?: string;
}

function PlanCard({
  title,
  price,
  period,
  subtitle,
  features,
  ctaLabel,
  checkoutType,
  isAuthed,
  alreadyOwned,
  loginHref,
  highlighted,
  bestValueLabel,
}: PlanCardProps) {
  const t = useTranslations("lemon.pricing");
  const [submitting, setSubmitting] = useState(false);

  return (
    <div
      className={`relative rounded-2xl p-6 ${
        highlighted
          ? "bg-amber-50 ring-2 ring-amber-500 shadow-xl"
          : "bg-white ring-1 ring-zinc-200"
      }`}
    >
      {highlighted && bestValueLabel && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-amber-500 text-white text-xs font-bold">
          {bestValueLabel}
        </div>
      )}
      <h3 className="text-xl font-bold text-zinc-900">{title}</h3>
      <div className="mt-3 flex items-baseline gap-1">
        <span className="text-4xl font-bold text-zinc-900">{price}</span>
        <span className="text-zinc-600">{period}</span>
      </div>
      <p className="mt-1 text-sm text-zinc-600">{subtitle}</p>

      <ul className="mt-6 space-y-2 text-sm text-zinc-700">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2">
            <span className="text-emerald-600 mt-0.5 shrink-0">✓</span>
            <span>{f}</span>
          </li>
        ))}
      </ul>

      {alreadyOwned ? (
        <button
          type="button"
          disabled
          className="mt-6 w-full px-6 py-3 rounded-lg font-semibold bg-emerald-100 text-emerald-800 cursor-default"
        >
          {t("alreadyOwned")}
        </button>
      ) : isAuthed ? (
        <form
          method="POST"
          action={CHECKOUT_ENDPOINT}
          onSubmit={() => setSubmitting(true)}
          className="mt-6"
        >
          <input type="hidden" name="type" value={checkoutType} />
          <button
            type="submit"
            disabled={submitting}
            className={`w-full px-6 py-3 rounded-lg font-semibold transition-colors ${
              highlighted
                ? "bg-amber-600 text-white hover:bg-amber-700"
                : "bg-zinc-900 text-white hover:bg-zinc-800"
            } disabled:opacity-60 disabled:cursor-wait`}
          >
            {submitting ? t("redirecting") : ctaLabel}
          </button>
        </form>
      ) : (
        <a
          href={loginHref}
          className={`mt-6 inline-block w-full text-center px-6 py-3 rounded-lg font-semibold transition-colors ${
            highlighted
              ? "bg-amber-600 text-white hover:bg-amber-700"
              : "bg-zinc-900 text-white hover:bg-zinc-800"
          }`}
        >
          {t("signInPrefix")}
          {ctaLabel.toLowerCase()}
        </a>
      )}
    </div>
  );
}
