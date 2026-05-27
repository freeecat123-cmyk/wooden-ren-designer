"use client";

/**
 * Lemon Squeezy 國際版 pricing UI
 * 顯示 Pro Monthly / Pro Annual / Lifetime 三方案，按下按鈕走
 * /api/lemon-squeezy/checkout 建 LS hosted checkout 後跳轉。
 *
 * 三種狀態：
 *   - guest          → 引導去 /en/login?next=/en/pricing
 *   - logged-in      → form POST 觸發 checkout 跳轉
 *   - existing-plan  → 顯示「manage subscription」連 LS customer portal（v2 補）
 */

import { useState } from "react";
import { LemonSingleTemplateSection } from "./LemonSingleTemplateSection";

interface CatalogItem {
  id: string;
  nameEn: string;
  kind: "furniture" | "tool";
  difficulty: "beginner" | "intermediate" | "advanced";
}

interface Props {
  isAuthed: boolean;
  loginHref: string;
  /** 27 家具 + 2 工具 (ceiling/floor)，server fetch 後 pass 進來 */
  catalog: CatalogItem[];
  /** ?locked=stool 帶來，高亮對應卡片 */
  lockedCategory?: string | null;
}

const CHECKOUT_ENDPOINT = "/api/lemon-squeezy/checkout";

export function LemonSqueezyPricingClient({
  isAuthed,
  loginHref,
  catalog,
  lockedCategory,
}: Props) {
  return (
    <main className="min-h-[calc(100vh-120px)] mx-auto max-w-5xl px-6 py-16 text-zinc-800">
      <div className="text-center mb-12">
        <h1 className="font-serif text-4xl sm:text-5xl font-bold tracking-tight text-zinc-900 leading-tight">
          Furniture Blueprints
        </h1>
        <p className="mt-4 text-lg text-zinc-600 max-w-2xl mx-auto">
          Parametric furniture design with engineering drawings, 3D views, bill of
          materials, and step-by-step construction plans.
        </p>
      </div>

      <div className="grid sm:grid-cols-3 gap-6">
        <PlanCard
          title="Monthly"
          price="$9"
          period="/ month"
          subtitle="Cancel anytime"
          features={[
            "All 27+ furniture templates",
            "Unlimited designs",
            "PDF & SVG export",
            "Bill of materials + cut list",
            "3D real-time preview",
          ]}
          ctaLabel="Start monthly"
          checkoutType="sub_monthly"
          isAuthed={isAuthed}
          loginHref={loginHref}
        />
        <PlanCard
          title="Annual"
          price="$79"
          period="/ year"
          subtitle="Save 27% — 2 months free"
          features={[
            "Everything in Monthly",
            "Priority support",
            "Early access to new templates",
            "Annual maintenance billing",
          ]}
          ctaLabel="Start annual"
          checkoutType="sub_yearly"
          isAuthed={isAuthed}
          loginHref={loginHref}
          highlighted
        />
        <PlanCard
          title="Lifetime"
          price="$129"
          period=""
          subtitle="One-time purchase"
          features={[
            "All current templates",
            "All future templates included",
            "Unlimited designs forever",
            "No recurring charges",
          ]}
          ctaLabel="Buy lifetime"
          checkoutType="lifetime"
          isAuthed={isAuthed}
          loginHref={loginHref}
        />
      </div>

      <LemonSingleTemplateSection
        catalog={catalog}
        lockedCategory={lockedCategory}
        isAuthed={isAuthed}
        loginHref={loginHref}
      />

      <div className="mt-16 text-sm text-zinc-500 text-center border-t border-zinc-200 pt-6">
        <p>
          Payments processed securely by{" "}
          <a
            href="https://www.lemonsqueezy.com"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-amber-700"
          >
            Lemon Squeezy
          </a>{" "}
          (merchant of record). VAT/sales tax handled automatically for your
          country.
        </p>
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Plan card with checkout button
// ---------------------------------------------------------------------------

interface PlanCardProps {
  title: string;
  price: string;
  period: string;
  subtitle: string;
  features: string[];
  ctaLabel: string;
  checkoutType: "sub_monthly" | "sub_yearly" | "lifetime";
  isAuthed: boolean;
  loginHref: string;
  highlighted?: boolean;
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
  loginHref,
  highlighted,
}: PlanCardProps) {
  const [submitting, setSubmitting] = useState(false);

  return (
    <div
      className={`relative rounded-2xl p-6 ${
        highlighted
          ? "bg-amber-50 ring-2 ring-amber-500 shadow-xl"
          : "bg-white ring-1 ring-zinc-200"
      }`}
    >
      {highlighted && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-amber-500 text-white text-xs font-bold">
          BEST VALUE
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

      {isAuthed ? (
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
            {submitting ? "Redirecting…" : ctaLabel}
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
          Sign in to {ctaLabel.toLowerCase()}
        </a>
      )}
    </div>
  );
}
