"use client";

/**
 * Lemon Squeezy 國際版「我的訂閱」頁。
 * 對應 zh-TW 的 MySubscriptionClient（ECPay 版），這版僅顯示 LS 訂閱資料。
 * 「Manage subscription」按鈕走 /api/lemon-squeezy/portal 跳 LS customer portal。
 */

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Link } from "@/i18n/navigation";

interface LemonSubscriptionRow {
  plan: string;
  period: string | null;
  status: string;
  expires_at: string | null;
  started_at: string | null;
  lemonsqueezy_subscription_id: string | null;
  created_at: string;
}

interface SinglePurchase {
  kind: "template" | "tool";
  id: string;
  paid_amount: number;
  created_at: string;
}

const PORTAL_ENDPOINT = "/api/lemon-squeezy/portal";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toISOString().slice(0, 10);
}

function statusBadge(status: string): string {
  switch (status) {
    case "active":
      return "bg-emerald-100 text-emerald-800 ring-emerald-300";
    case "cancelled":
      return "bg-amber-100 text-amber-800 ring-amber-300";
    case "expired":
    case "unpaid":
      return "bg-rose-100 text-rose-800 ring-rose-300";
    case "paused":
      return "bg-zinc-200 text-zinc-700 ring-zinc-400";
    default:
      return "bg-zinc-100 text-zinc-700 ring-zinc-300";
  }
}

function statusLabel(t: ReturnType<typeof useTranslations>, status: string): string {
  switch (status) {
    case "active": return t("statusActive");
    case "cancelled": return t("statusCancelled");
    case "expired": return t("statusExpired");
    case "unpaid": return t("statusUnpaid");
    case "paused": return t("statusPaused");
    default: return status.toUpperCase();
  }
}

export function LemonSubscriptionClient() {
  const t = useTranslations("lemon.subscription");
  const searchParams = useSearchParams();
  const checkoutSuccess = searchParams.get("checkout") === "success";
  const [sub, setSub] = useState<LemonSubscriptionRow | null>(null);
  const [purchases, setPurchases] = useState<SinglePurchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dismissBanner, setDismissBanner] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          if (!cancelled) {
            setError("Please sign in.");
            setLoading(false);
          }
          return;
        }

        const [subRes, tplRes, toolRes] = await Promise.all([
          supabase
            .from("subscriptions")
            .select(
              "plan, period, status, expires_at, started_at, lemonsqueezy_subscription_id, created_at",
            )
            .eq("user_id", user.id)
            .eq("payment_provider", "lemonsqueezy")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from("template_unlocks")
            .select("category, paid_amount, created_at")
            .eq("user_id", user.id)
            .eq("payment_provider", "lemonsqueezy"),
          supabase
            .from("tool_unlocks")
            .select("tool, paid_amount, created_at")
            .eq("user_id", user.id)
            .eq("payment_provider", "lemonsqueezy"),
        ]);

        if (cancelled) return;
        if (subRes.data) setSub(subRes.data as LemonSubscriptionRow);
        const all: SinglePurchase[] = [];
        (tplRes.data ?? []).forEach((r: { category: string; paid_amount: number; created_at: string }) =>
          all.push({ kind: "template", id: r.category, paid_amount: r.paid_amount, created_at: r.created_at }),
        );
        (toolRes.data ?? []).forEach((r: { tool: string; paid_amount: number; created_at: string }) =>
          all.push({ kind: "tool", id: r.tool, paid_amount: r.paid_amount, created_at: r.created_at }),
        );
        all.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
        setPurchases(all);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <main className="max-w-3xl mx-auto px-6 py-16">
        <p className="text-zinc-500">{t("loading")}</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="max-w-3xl mx-auto px-6 py-16">
        <p className="text-rose-700">{error}</p>
      </main>
    );
  }

  return (
    <main className="max-w-3xl mx-auto px-6 py-12 text-zinc-800">
      <h1 className="font-serif text-3xl sm:text-4xl font-bold text-zinc-900 mb-2">
        {t("h1")}
      </h1>
      <p className="text-zinc-600 mb-8">{t("intro")}</p>

      {checkoutSuccess && !dismissBanner && (
        <div className="rounded-2xl bg-emerald-50 ring-1 ring-emerald-300 p-5 mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="font-bold text-emerald-900">{t("checkoutSuccessTitle")}</p>
            <p className="text-sm text-emerald-800 mt-1">{t("checkoutSuccessBody")}</p>
          </div>
          <button
            type="button"
            onClick={() => setDismissBanner(true)}
            aria-label={t("checkoutSuccessDismiss")}
            className="text-emerald-700 hover:text-emerald-900 text-xl leading-none"
          >
            ×
          </button>
        </div>
      )}

      {sub ? (
        <section className="rounded-2xl bg-white ring-1 ring-stone-200 p-6 shadow-sm mb-8">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-xl font-bold text-zinc-900">
                {sub.plan === "pro" ? t("planProLabel") : sub.plan}
                {sub.period ? (
                  <span className="ml-2 text-sm font-normal text-zinc-500">
                    ({sub.period})
                  </span>
                ) : null}
              </h2>
              <span
                className={`mt-2 inline-block text-xs px-2.5 py-1 rounded-full font-bold ring-1 ${statusBadge(sub.status)}`}
              >
                {statusLabel(t, sub.status)}
              </span>
            </div>
            <a
              href={PORTAL_ENDPOINT}
              className="px-5 py-2.5 rounded-lg bg-zinc-900 text-white text-sm font-semibold hover:bg-zinc-800 transition-colors"
            >
              {t("manage")}
            </a>
          </div>

          <dl className="mt-6 grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-zinc-500">{t("started")}</dt>
              <dd className="font-semibold text-zinc-900">{formatDate(sub.started_at)}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">
                {sub.status === "cancelled" ? t("accessUntil") : t("renewsOn")}
              </dt>
              <dd className="font-semibold text-zinc-900">{formatDate(sub.expires_at)}</dd>
            </div>
          </dl>

          {sub.status === "cancelled" && (
            <p className="mt-4 text-sm text-amber-800 bg-amber-50 rounded-lg p-3 ring-1 ring-amber-200">
              {t("cancelledNote", { date: formatDate(sub.expires_at) })}
            </p>
          )}

          <p className="mt-4 text-xs text-zinc-500">{t("portalHint")}</p>
        </section>
      ) : (
        <section className="rounded-2xl bg-amber-50 ring-1 ring-amber-200 p-6 mb-8">
          <p className="text-amber-900 font-semibold">{t("noActive")}</p>
          <Link
            href="/pricing"
            className="mt-3 inline-block px-5 py-2.5 rounded-lg bg-amber-700 text-white text-sm font-semibold hover:bg-amber-800"
          >
            {t("viewPlans")}
          </Link>
        </section>
      )}

      {purchases.length > 0 && (
        <section className="rounded-2xl bg-white ring-1 ring-stone-200 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-zinc-900 mb-4">
            {t("singlePurchasesH")}
          </h2>
          <ul className="divide-y divide-stone-200">
            {purchases.map((p, i) => (
              <li key={`${p.kind}-${p.id}-${i}`} className="flex items-center justify-between py-3 text-sm">
                <div>
                  <span className="font-semibold text-zinc-900">{p.id}</span>
                  <span className="ml-2 text-xs text-zinc-500">
                    {p.kind === "tool" ? t("purchaseTypeTool") : t("purchaseTypeTemplate")} · {formatDate(p.created_at)}
                  </span>
                </div>
                <span className="font-bold text-zinc-900">${p.paid_amount}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
