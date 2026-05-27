"use client";

import { Link } from "@/i18n/navigation";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useUserPlan } from "@/hooks/useUserPlan";
import { InvoicePreferenceCard } from "@/components/InvoicePreferenceCard";
import { studentDaysRemaining } from "@/lib/permissions";
import {
  GRACE_PERIOD_DAYS,
  isExpiredPastGrace,
  isExpiringSoon,
  isInGracePeriod,
} from "@/lib/pricing/expiry";

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "-";
  return new Date(iso).toISOString().slice(0, 10);
}

interface PendingPayment {
  amount: number;
  paymentInfo: {
    method: "atm" | "cvs" | "barcode";
    expireDate: string;
    bankCode?: string;
    vAccount?: string;
    paymentNo?: string;
    barcode1?: string;
    barcode2?: string;
    barcode3?: string;
  } | null;
}

function PendingRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-amber-700">{label}</span>
      <span
        className={
          mono
            ? "font-mono font-semibold text-amber-900"
            : "font-semibold text-amber-900"
        }
      >
        {value}
      </span>
    </div>
  );
}

function PendingPaymentCard() {
  const t = useTranslations("mySubscription.pending");
  const [pending, setPending] = useState<PendingPayment | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/my-pending-payment")
      .then((r) => r.json())
      .then((d) => {
        if (alive) setPending(d.pending ?? null);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (!pending?.paymentInfo) return null;
  const info = pending.paymentInfo;
  const deadline = new Date(info.expireDate).toLocaleString("zh-TW", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="mb-4 rounded-xl border-2 border-amber-300 bg-amber-50 p-4">
      <p className="font-semibold text-amber-900">{t("h")}</p>
      <p className="mt-1 text-sm text-amber-800">
        {t("bodyTpl", { amount: pending.amount.toLocaleString(), deadline })}
      </p>
      <div className="mt-3 space-y-1 text-sm">
        {info.method === "atm" && (
          <>
            <PendingRow label={t("rowMethod")} value={t("methodAtm")} />
            <PendingRow label={t("rowBankCode")} value={info.bankCode ?? ""} mono />
            <PendingRow label={t("rowVAccount")} value={info.vAccount ?? ""} mono />
          </>
        )}
        {info.method === "cvs" && (
          <>
            <PendingRow label={t("rowMethod")} value={t("methodCvs")} />
            <PendingRow label={t("rowPaymentNo")} value={info.paymentNo ?? ""} mono />
          </>
        )}
        {info.method === "barcode" && (
          <>
            <PendingRow label={t("rowMethod")} value={t("methodBarcode")} />
            <PendingRow label={t("rowBarcode1")} value={info.barcode1 ?? ""} mono />
            <PendingRow label={t("rowBarcode2")} value={info.barcode2 ?? ""} mono />
            <PendingRow label={t("rowBarcode3")} value={info.barcode3 ?? ""} mono />
            <p className="pt-1 text-xs text-amber-700">{t("barcodeHint")}</p>
          </>
        )}
      </div>
    </div>
  );
}

export function MySubscriptionClient() {
  const t = useTranslations("mySubscription");
  const tPlanLabel = useTranslations("planLabel");
  const { profile, plan, isLoading, isLoggedIn } = useUserPlan();
  const [justPaid, setJustPaid] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    if (sp.get("paid") === "1") {
      setJustPaid(true);
      const url = new URL(window.location.href);
      url.searchParams.delete("paid");
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  if (isLoading) {
    return (
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-12 text-sm text-zinc-500">
        {t("loading")}
      </main>
    );
  }

  if (!isLoggedIn) {
    return (
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-12">
        <h1 className="text-2xl font-bold text-zinc-900 mb-4">{t("h1")}</h1>
        <p className="text-zinc-600 text-sm">{t("loginRequired")}</p>
      </main>
    );
  }

  const isStudent = profile?.plan === "student";
  const daysLeft = studentDaysRemaining(profile);
  const expired = daysLeft !== null && daysLeft <= 0;
  const expiringSoon = daysLeft !== null && daysLeft > 0 && daysLeft <= 30;

  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <Link href="/" className="text-sm text-zinc-500 hover:underline">
        {t("backHome")}
      </Link>
      <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 mt-3 mb-2">
        {t("h1")}
      </h1>

      {justPaid && (
        <div
          className="mb-4 rounded-lg p-4 border-2"
          style={{ background: "#ecfdf5", borderColor: "#34d399" }}
        >
          <div className="font-semibold text-emerald-800 flex items-center gap-2">
            {t("justPaidH")}
          </div>
          <p className="text-sm text-emerald-700 mt-1 leading-relaxed">
            {t("justPaidBody")}
          </p>
        </div>
      )}

      <PendingPaymentCard />

      <p className="text-sm text-zinc-500 mb-6">
        {t("currentPlanPre")}
        <strong className="text-zinc-900 ml-1">{tPlanLabel(plan)}</strong>
      </p>

      <div className="rounded-2xl border-2 border-zinc-200 bg-white p-5 sm:p-6">
        {isStudent && (
          <StudentSection
            activatedAt={profile?.student_activated_at ?? null}
            expiresAt={profile?.student_expires_at ?? null}
            daysLeft={daysLeft}
            expired={expired}
            expiringSoon={expiringSoon}
          />
        )}

        {!isStudent && profile?.plan === "lifetime" && (
          <div>
            <h2 className="font-semibold text-zinc-900 mb-1">{t("lifetimeH")}</h2>
            <p className="text-sm text-zinc-600">{t("lifetimeBody")}</p>
          </div>
        )}

        {!isStudent && (profile?.plan === "personal" || profile?.plan === "pro") && (
          <PaidPlanSection
            planLabel={tPlanLabel(profile.plan)}
            expiresAt={profile.subscription_expires_at}
            status={profile.subscription_status}
          />
        )}

        {!profile || profile.plan === "free" ? (
          <div>
            <h2 className="font-semibold text-zinc-900 mb-1">{t("freeH")}</h2>
            <p className="text-sm text-zinc-600">
              {t("freeBody")}
              <Link href="/pricing" className="text-emerald-700 hover:underline ml-1">
                {t("seePlans")}
              </Link>
            </p>
          </div>
        ) : null}
      </div>

      <UnlocksSection />

      {!isStudent &&
        profile &&
        (profile.plan === "personal" || profile.plan === "pro" || profile.plan === "lifetime") && (
          <InvoicePreferenceCard />
        )}
    </main>
  );
}

interface UnlockedTemplate { category: string; created_at: string; }
interface UnlockedTool { tool: string; created_at: string; }

function UnlocksSection() {
  const t = useTranslations("mySubscription.unlocks");
  const tFurn = useTranslations("furniture");
  const [templates, setTemplates] = useState<UnlockedTemplate[]>([]);
  const [tools, setTools] = useState<UnlockedTool[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          if (!cancelled) setLoading(false);
          return;
        }
        const [tplRes, toolRes] = await Promise.all([
          supabase
            .from("template_unlocks")
            .select("category, created_at")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false }),
          supabase
            .from("tool_unlocks")
            .select("tool, created_at")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false }),
        ]);
        if (cancelled) return;
        setTemplates((tplRes.data ?? []) as UnlockedTemplate[]);
        setTools((toolRes.data ?? []) as UnlockedTool[]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) return null;
  if (templates.length === 0 && tools.length === 0) return null;

  const toolLabel = (id: string): string => {
    if (id === "ceiling") return t("toolCeiling");
    if (id === "floor") return t("toolFloor");
    return id;
  };
  const templateName = (cat: string): string => {
    try {
      return tFurn(cat);
    } catch {
      return cat;
    }
  };

  return (
    <div className="mt-6 rounded-2xl border-2 border-amber-200 bg-amber-50/40 p-5 sm:p-6">
      <h2 className="font-semibold text-zinc-900 mb-3 flex items-center gap-2">
        {t("h")}
      </h2>
      <p className="text-xs text-zinc-600 mb-4">{t("intro")}</p>

      {tools.length > 0 && (
        <div className="mb-4">
          <div className="text-xs font-semibold text-zinc-700 mb-2">{t("toolsH")}</div>
          <ul className="space-y-1">
            {tools.map((tool) => (
              <li key={tool.tool} className="flex items-center justify-between text-sm">
                <span>{toolLabel(tool.tool)}</span>
                <Link href={tool.tool === "ceiling" ? "/ceiling" : "/floor"} className="text-xs text-amber-700 hover:underline">
                  {t("open")}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {templates.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-zinc-700 mb-2">{t("templatesH")}</div>
          <ul className="space-y-1">
            {templates.map((tpl) => (
              <li key={tpl.category} className="flex items-center justify-between text-sm">
                <span>🪵 {templateName(tpl.category)}</span>
                <Link href={`/design/${tpl.category}`} className="text-xs text-amber-700 hover:underline">
                  {t("open")}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function PaidPlanSection({
  planLabel,
  expiresAt,
  status,
}: {
  planLabel: string;
  expiresAt: string | null;
  status: string;
}) {
  const t = useTranslations("mySubscription.paidPlan");
  const tStatus = useTranslations("mySubscription.subStatus");
  const [cancelling, setCancelling] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isActive = status === "active";
  const isCancelled = status === "cancelled" || cancelled;

  async function handleCancel() {
    if (cancelling) return;
    const ok = window.confirm(t("confirmCancel"));
    if (!ok) return;
    setCancelling(true);
    setError(null);
    try {
      const r = await fetch("/api/cancel-subscription", { method: "POST" });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.error ?? `HTTP ${r.status}`);
      }
      setCancelled(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("cancelFail"));
    } finally {
      setCancelling(false);
    }
  }

  const statusText = (() => {
    if (isCancelled) return tStatus("cancelledStillValid");
    const known = ["active", "inactive", "cancelled", "expired"] as const;
    if ((known as readonly string[]).includes(status)) {
      return tStatus(status as (typeof known)[number]);
    }
    return status;
  })();

  const expiringSoon = isExpiringSoon(expiresAt, 7);
  const inGrace = isInGracePeriod(expiresAt);
  const pastGrace = isExpiredPastGrace(expiresAt);
  const expiresAtTime = expiresAt ? new Date(expiresAt).getTime() : null;
  const graceEndTime = expiresAtTime
    ? expiresAtTime + GRACE_PERIOD_DAYS * 86_400_000
    : null;
  const graceDaysLeft = graceEndTime
    ? Math.max(0, Math.ceil((graceEndTime - Date.now()) / 86_400_000))
    : null;
  const daysUntilExpiry = expiresAtTime
    ? Math.max(0, Math.ceil((expiresAtTime - Date.now()) / 86_400_000))
    : null;

  return (
    <div>
      <h2 className="font-semibold text-zinc-900 mb-1">{planLabel}</h2>
      <p className="text-sm text-zinc-600">{t("expiresAtLbl", { date: formatDate(expiresAt) })}</p>
      <p className="text-sm text-zinc-500 mt-1">{t("statusLbl", { status: statusText })}</p>

      {expiringSoon && !isCancelled && (
        <div
          className="mt-4 rounded-lg p-3 border"
          style={{ background: "#fefce8", borderColor: "#facc15" }}
        >
          <p className="text-xs text-[#854d0e] leading-relaxed">
            {t("expiringSoonTpl", { days: daysUntilExpiry ?? 0 })}
            <Link href="/pricing" className="underline ml-1">
              {t("reSubscribe")}
            </Link>
            {t("expiringSoonSuffix")}
          </p>
        </div>
      )}

      {inGrace && (
        <div
          className="mt-4 rounded-lg p-3 border-2"
          style={{ background: "#fef2f2", borderColor: "#f87171" }}
        >
          <p className="text-sm text-[#991b1b] leading-relaxed font-medium">
            {t("graceH", { days: graceDaysLeft ?? 0 })}
          </p>
          <p className="text-xs text-[#991b1b] mt-1 leading-relaxed">
            {t("graceBody", { days: graceDaysLeft ?? 0 })}
            <Link href="/pricing" className="underline ml-1 font-semibold">
              {t("resubLink")}
            </Link>
          </p>
        </div>
      )}

      {pastGrace && (
        <div
          className="mt-4 rounded-lg p-3 border-2"
          style={{ background: "#f3f4f6", borderColor: "#9ca3af" }}
        >
          <p className="text-sm text-zinc-700 leading-relaxed">
            {t("pastGraceTpl", { days: GRACE_PERIOD_DAYS })}
            <Link href="/pricing" className="underline ml-1 font-medium">/pricing</Link>
            {t("pastGraceSuffix")}
          </p>
        </div>
      )}

      {isActive && !isCancelled && (
        <div className="mt-5 pt-4 border-t border-zinc-200">
          <button
            type="button"
            onClick={handleCancel}
            disabled={cancelling}
            className="text-xs text-zinc-500 hover:text-red-600 underline underline-offset-2 disabled:opacity-50 disabled:cursor-wait"
          >
            {cancelling ? t("cancelling") : t("cancelCta")}
          </button>
          {error && <p className="mt-2 text-xs text-red-600">⚠️ {error}</p>}
        </div>
      )}

      {isCancelled && (
        <div
          className="mt-4 rounded-lg p-3 border"
          style={{ background: "#fff8ee", borderColor: "#d4a574" }}
        >
          <p className="text-xs text-[#7c4f1a] leading-relaxed">
            {t("cancelledBodyTpl", { date: formatDate(expiresAt) })}
            <Link href="/pricing" className="underline">
              {t("plansPage")}
            </Link>
            {t("cancelledBodySuffix")}
          </p>
        </div>
      )}
    </div>
  );
}

function StudentSection({
  activatedAt,
  expiresAt,
  daysLeft,
  expired,
  expiringSoon,
}: {
  activatedAt: string | null;
  expiresAt: string | null;
  daysLeft: number | null;
  expired: boolean;
  expiringSoon: boolean;
}) {
  const t = useTranslations("mySubscription.student");
  return (
    <div>
      <h2 className="font-semibold text-zinc-900 text-lg mb-3">{t("h")}</h2>
      <dl className="grid grid-cols-2 gap-y-3 text-sm">
        <dt className="text-zinc-500">{t("rowActivated")}</dt>
        <dd className="text-zinc-900 font-medium">{formatDate(activatedAt)}</dd>
        <dt className="text-zinc-500">{t("rowExpires")}</dt>
        <dd className="text-zinc-900 font-medium">
          {formatDate(expiresAt)}
          {daysLeft !== null && (
            <span
              className={`ml-2 text-xs ${
                expired
                  ? "text-red-600"
                  : expiringSoon
                  ? "text-amber-700 font-semibold"
                  : "text-zinc-500"
              }`}
            >
              {expired ? t("expired") : t("daysLeftTpl", { n: daysLeft })}
            </span>
          )}
        </dd>
      </dl>

      {expiringSoon && (
        <div
          className="mt-4 rounded-lg p-4 border-2"
          style={{ background: "#FFF8E7", borderColor: "#d4a574" }}
        >
          <div className="font-semibold text-[#5C3317] flex items-center gap-2">
            {t("expiringH", { n: daysLeft ?? 0 })}
          </div>
          <p className="text-sm text-[#7c4f1a] mt-1 leading-relaxed">{t("expiringBody")}</p>
          <Link
            href="/pricing"
            className="inline-block mt-3 px-4 py-2 rounded-lg bg-[#8b4513] text-white text-sm font-medium hover:bg-[#6f370f]"
          >
            {t("renewBtn")}
          </Link>
        </div>
      )}

      {expired && (
        <div
          className="mt-4 rounded-lg p-4 border-2"
          style={{ background: "#fff1f1", borderColor: "#fca5a5" }}
        >
          <div className="font-semibold text-red-700">{t("expiredH")}</div>
          <p className="text-sm text-red-600 mt-1 leading-relaxed">{t("expiredBody")}</p>
          <Link
            href="/pricing"
            className="inline-block mt-3 px-4 py-2 rounded-lg bg-[#8b4513] text-white text-sm font-medium hover:bg-[#6f370f]"
          >
            {t("expiredBtn")}
          </Link>
        </div>
      )}

      {!expiringSoon && !expired && (
        <p className="mt-4 text-xs text-zinc-500 leading-relaxed">{t("futurePriceNote")}</p>
      )}
    </div>
  );
}
