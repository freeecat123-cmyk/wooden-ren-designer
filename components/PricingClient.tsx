"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { PlanCardView, type PlanCard, type BillingPeriod } from "./PricingPlanCard";
import { useUserPlan } from "@/hooks/useUserPlan";
import { TemplateUnlockSection } from "./TemplateUnlockSection";
import { ToolUnlockSection } from "./ToolUnlockSection";
import { FURNITURE_CATALOG } from "@/lib/templates";
import { isPaidCategory } from "@/lib/permissions";
import { FEATURED_TEMPLATE_CATEGORIES } from "@/lib/templates/marketing";

const DEVELOPMENT_CATEGORIES = new Set<string>(["chinese-cabinet", "bed", "coat-rack"]);

interface CouponState {
  code: string;
  status: "idle" | "checking" | "ok" | "error";
  discountPercent?: number;
  error?: string;
}

const PLAN_PRICES: Record<"free" | "personal" | "pro", { monthly: number; yearly: number; originalYearly?: number }> = {
  free: { monthly: 0, yearly: 0 },
  personal: { monthly: 390, yearly: 3900, originalYearly: 390 * 12 },
  pro: { monthly: 890, yearly: 8900, originalYearly: 890 * 12 },
};

export function PricingClient() {
  const t = useTranslations("pricingPage");
  const tFurn = useTranslations("furniture");
  const tPlans = useTranslations("pricingPlans");
  const tRoot = useTranslations();
  const faqs = tRoot.raw("pricingFaqs") as Array<{ q: string; a: string }>;
  const [period, setPeriod] = useState<BillingPeriod>("monthly");
  const [lockedCategory, setLockedCategory] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState(false);
  const [coupon, setCoupon] = useState<CouponState>({ code: "", status: "idle" });
  const { profile, userId } = useUserPlan();
  const currentPlan = profile?.plan ?? null;
  const currentStatus = profile?.subscription_status ?? null;
  const [currentPeriod, setCurrentPeriod] = useState<BillingPeriod | null>(null);

  const lockedName = lockedCategory
    ? (() => {
        try {
          return tFurn(lockedCategory);
        } catch {
          return lockedCategory;
        }
      })()
    : "";

  const buildPlan = (id: "free" | "personal" | "pro"): PlanCard => {
    const prices = PLAN_PRICES[id];
    const data = tPlans.raw(id) as {
      name: string;
      audience: string[];
      features: Array<{ ok: boolean; text: string }>;
      cta: string;
    };
    return {
      id,
      name: data.name,
      monthlyPrice: prices.monthly,
      yearlyPrice: prices.yearly,
      originalYearly: prices.originalYearly,
      audience: data.audience,
      features: data.features,
      highlight: id === "pro",
      cta: data.cta,
    };
  };

  const PLANS: PlanCard[] = [buildPlan("free"), buildPlan("personal"), buildPlan("pro")];

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
    const c = sp.get("coupon");
    if (c) setCoupon({ code: c.toUpperCase(), status: "idle" });
    if (sp.get("error") === "payment_not_configured") {
      setPaymentError(true);
    }
  }, []);

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
        body: JSON.stringify({ code: coupon.code, plan: "personal", period }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setCoupon((c) => ({
          ...c,
          status: "error",
          error: json.error ?? t("couponErrFallback"),
        }));
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
        error: e instanceof Error ? e.message : t("couponNetworkErr"),
      }));
    }
  }

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
      {paymentError && (
        <div className="max-w-3xl mx-auto mb-6 px-5 py-4 rounded-2xl bg-rose-50 ring-1 ring-rose-300 shadow-sm flex items-start gap-3">
          <span className="text-2xl flex-shrink-0">⚠️</span>
          <div className="flex-1 text-sm leading-relaxed">
            <p className="font-semibold text-rose-900">{t("paymentErrorH")}</p>
            <p className="mt-1 text-rose-800">
              {t("paymentErrorBody")}
              <Link href="/contact" className="underline underline-offset-2 font-semibold">
                {t("paymentErrorContact")}
              </Link>
              {t("paymentErrorBodyTail")}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  if (typeof window !== "undefined" && window.history.length > 1) {
                    window.history.back();
                  } else {
                    window.location.href = "/templates";
                  }
                }}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-white text-rose-800 text-xs font-semibold ring-1 ring-rose-300 hover:ring-rose-500 hover:-translate-y-0.5 transition-all"
              >
                {t("paymentErrorBack")}
              </button>
              <Link
                href="/templates"
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-white text-zinc-700 text-xs font-semibold ring-1 ring-stone-300 hover:ring-amber-500 hover:-translate-y-0.5 transition-all"
              >
                {t("paymentErrorBrowse")}
              </Link>
            </div>
          </div>
        </div>
      )}
      {lockedCategory && (
        <div className="max-w-3xl mx-auto mb-8 px-5 py-4 rounded-2xl bg-amber-50 ring-1 ring-amber-400/60 shadow-sm flex items-start gap-3">
          <span className="text-2xl flex-shrink-0">🔒</span>
          <div className="flex-1 text-sm leading-relaxed">
            <p className="font-semibold text-amber-950">
              {t("lockedHTpl", { name: lockedName })}
            </p>
            <p className="mt-1 text-amber-800">{t("lockedBody")}</p>
            {FEATURED_TEMPLATE_CATEGORIES.includes(lockedCategory as never) && (
              <Link
                href={`/templates/${lockedCategory}`}
                className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-amber-800 hover:text-amber-950 underline underline-offset-2"
              >
                {t("lockedDetailTpl", { name: lockedName })}
              </Link>
            )}
          </div>
        </div>
      )}

      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-4 flex-wrap mb-5">
          <Link
            href="/app"
            className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-amber-800 transition-colors"
          >
            {t("backToApp")}
          </Link>
          <span aria-hidden className="text-amber-900/20 select-none">·</span>
          <Link
            href="/templates"
            className="inline-flex items-center gap-1 text-sm text-amber-700 hover:text-amber-900 transition-colors"
          >
            {t("browseTemplates")}
          </Link>
        </div>
        <h1 className="font-serif-tc text-3xl sm:text-4xl font-bold tracking-tight text-amber-950">
          {t("h1")}
        </h1>
        <p className="mt-3 text-zinc-600 text-sm sm:text-base">{t("subH1")}</p>
        <p className="mt-2 text-xs text-zinc-500">
          {t("subHelpPre")}{" "}
          <Link href="/templates" className="text-amber-700 hover:text-amber-900 underline underline-offset-2">
            {t("subHelpLink")}
          </Link>{" "}
          {t("subHelpSuffix")}
        </p>
      </div>

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
            {t("tabMonthly")}
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
            {t("tabYearly")}
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                period === "yearly"
                  ? "bg-emerald-400 text-emerald-950"
                  : "bg-emerald-100 text-emerald-700"
              }`}
            >
              {t("yearlySavings")}
            </span>
          </button>
        </div>
      </div>

      <div className="max-w-md mx-auto mb-8">
        <div className="rounded-2xl bg-white ring-1 ring-amber-900/10 p-4 shadow-sm">
          <label className="block text-xs font-semibold text-zinc-700 mb-2">
            {t("couponLabel")}
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
              placeholder={t("couponPlaceholder")}
              className="flex-1 px-3 py-2 rounded-lg border border-zinc-300 text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <button
              type="button"
              onClick={applyCoupon}
              disabled={!coupon.code.trim() || coupon.status === "checking"}
              className="px-4 py-2 rounded-lg bg-zinc-800 text-white text-sm font-semibold hover:bg-zinc-900 disabled:opacity-50"
            >
              {coupon.status === "checking" ? t("couponChecking") : t("couponApply")}
            </button>
          </div>
          {coupon.status === "ok" && (
            <p className="mt-2 text-xs text-emerald-700 font-semibold">
              {t("couponOkTpl", { pct: coupon.discountPercent ?? 0 })}
            </p>
          )}
          {coupon.status === "error" && (
            <p className="mt-2 text-xs text-rose-700">
              {t("couponErrPrefix")}{coupon.error}
            </p>
          )}
          {coupon.status === "ok" && period === "monthly" && (
            <p className="mt-1 text-xs text-amber-700">{t("couponMonthlyWarn")}</p>
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

      <ToolUnlockSection />

      <section className="mt-16 max-w-3xl mx-auto">
        <h2 className="font-serif-tc text-2xl sm:text-3xl font-bold text-center text-amber-950 mb-2">
          {t("faqsH")}
        </h2>
        <p className="text-center text-zinc-500 text-sm mb-9">{t("faqsSub")}</p>
        <div className="space-y-3">
          {faqs.map((f) => (
            <details
              key={f.q}
              className="group rounded-2xl bg-white ring-1 ring-stone-200 px-5 py-4 open:shadow-md transition-shadow"
            >
              <summary className="cursor-pointer font-semibold text-zinc-900 list-none flex items-center justify-between gap-3">
                <span>{f.q}</span>
                <span className="text-amber-700 group-open:rotate-45 transition-transform text-xl shrink-0">
                  +
                </span>
              </summary>
              <p className="mt-3 text-zinc-700 leading-relaxed text-sm whitespace-pre-line">
                {f.a}
              </p>
            </details>
          ))}
        </div>
        <div className="mt-6 text-center">
          <Link
            href="/help"
            className="text-sm text-amber-700 hover:text-amber-900 font-semibold"
          >
            {t("fullFaq")}
          </Link>
        </div>
      </section>

      <div className="mt-12 max-w-2xl mx-auto rounded-2xl bg-amber-50/80 ring-1 ring-amber-900/10 px-6 py-5 text-center text-xs text-zinc-600 leading-relaxed">
        <p className="flex items-center justify-center gap-1.5">
          <span aria-hidden>🔄</span>
          {t("footnote1")}
        </p>
        <p className="mt-2 flex items-center justify-center gap-1.5">
          <span aria-hidden>💡</span>
          {t("footnote2")}
        </p>
      </div>
    </main>
  );
}
