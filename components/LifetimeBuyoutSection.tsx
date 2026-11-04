"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useUserPlan } from "@/hooks/useUserPlan";
import { lifetimeEligibility } from "@/lib/pricing/lifetime";

interface Status {
  price: number;
  quota: number;
  remaining: number;
  available: boolean;
}

/**
 * pricing 頁的「終身買斷（限量）」區塊。名額從 /api/lifetime/status 讀：
 *   - 還有名額 → 顯示介紹與購買鈕（POST /api/checkout/lifetime，走既有綠界一次性付款）
 *   - 已額滿   → 改顯示「已額滿」，不顯示購買鈕
 *   - 讀不到（503／斷線）→ 整塊不顯示。寧可先不賣，也不要在不確定名額時開放購買。
 * 已有訂閱／學員／終身的帳號看到的是說明文字而不是購買鈕（伺服器端也會擋，這裡只是不讓人白按）。
 */
export function LifetimeBuyoutSection() {
  const t = useTranslations("lifetimeBuyout");
  const notice = useSearchParams().get("lifetime_notice");
  const { plan, isLoggedIn, isLoading } = useUserPlan();
  const [status, setStatus] = useState<Status | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/lifetime/status", { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as Status;
        if (!cancelled) setStatus(json);
      } catch {
        /* 讀不到就不顯示 */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!status || isLoading) return null;

  const priceText = status.price.toLocaleString("en-US");
  const eligibility = isLoggedIn ? lifetimeEligibility(plan) : ({ ok: true } as const);
  const noticeText =
    notice === "soldout"
      ? t("noticeSoldout")
      : notice === "has_plan"
        ? t("noticeHasPlan")
        : notice === "admin"
          ? t("noticeAdmin")
          : notice === "owned"
            ? t("owned")
            : null;

  return (
    <section id="lifetime" className="mt-12 max-w-3xl mx-auto">
      {noticeText && (
        <p className="mb-4 rounded-lg bg-amber-100 px-4 py-2 text-center text-sm font-medium text-amber-900">
          {noticeText}
        </p>
      )}

      {!status.available ? (
        <div className="rounded-xl bg-white p-6 text-center ring-1 ring-stone-200">
          <h2 className="font-serif-tc text-xl font-bold text-zinc-700">{t("soldOutTitle")}</h2>
          <p className="mt-2 text-sm text-zinc-600">{t("soldOutBody", { quota: status.quota })}</p>
        </div>
      ) : (
        <div className="rounded-xl bg-white p-6 ring-1 ring-stone-200">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <div>
              <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">
                {t("badge")}
              </span>
              <h2 className="mt-2 font-serif-tc text-2xl font-bold text-amber-950">{t("title")}</h2>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-amber-900">{t("price", { price: priceText })}</div>
              <div className="text-xs text-zinc-500">{t("unit")}</div>
            </div>
          </div>

          <p className="mt-3 text-sm leading-relaxed text-zinc-700">{t("intro", { quota: status.quota })}</p>
          <ul className="mt-3 space-y-1.5 text-sm text-zinc-700">
            {(t.raw("features") as string[]).map((f) => (
              <li key={f} className="flex gap-2">
                <span aria-hidden className="text-emerald-700">
                  ✓
                </span>
                <span>{f}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-zinc-500">{t("notIncluded")}</p>
          <p className="mt-3 text-sm font-semibold text-amber-900">
            {t("remaining", { remaining: status.remaining, quota: status.quota })}
          </p>

          {eligibility.ok ? (
            <form method="POST" action="/api/checkout/lifetime" className="mt-4">
              <button
                type="submit"
                className="w-full rounded-lg bg-amber-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-900"
              >
                {t("cta", { price: priceText })}
              </button>
              <p className="mt-2 text-center text-xs text-zinc-500">{t("refundNote")}</p>
            </form>
          ) : (
            <p className="mt-4 rounded-lg bg-stone-100 px-4 py-3 text-sm text-zinc-700">
              {eligibility.reason === "owned" ? t("owned") : t("hasPlan")}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
