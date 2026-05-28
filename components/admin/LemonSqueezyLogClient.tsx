"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";

type Tab = "subs" | "payments" | "log";

interface SubRow {
  id: string;
  user_id: string;
  plan: string | null;
  period: string | null;
  status: string | null;
  expires_at: string | null;
  started_at: string | null;
  lemonsqueezy_subscription_id: string | null;
  created_at: string;
}

interface PaymentRow {
  id: string;
  user_id: string;
  subscription_id: string | null;
  amount: number | null;
  status: string;
  lemonsqueezy_order_id: string | null;
  created_at: string;
}

interface WebhookLogRow {
  id: string;
  event_id: string;
  event_name: string;
  processed_at: string | null;
  processing_error: string | null;
  created_at: string;
}

interface UserRow {
  id: string;
  email: string | null;
  plan: string | null;
}

interface ApiResp {
  subs: SubRow[];
  payments: PaymentRow[];
  webhookLog: WebhookLogRow[];
  userMap: Record<string, UserRow>;
  error?: string;
}

const STATUS_STYLE: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  cancelled: "bg-amber-100 text-amber-800 ring-amber-200",
  expired: "bg-rose-100 text-rose-800 ring-rose-200",
  unpaid: "bg-rose-100 text-rose-800 ring-rose-200",
  paused: "bg-zinc-100 text-zinc-700 ring-zinc-300",
  success: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  failed: "bg-red-100 text-red-800 ring-red-200",
};

function formatTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.toISOString().slice(0, 10)} ${d.toISOString().slice(11, 16)}`;
}

function formatAmount(cents: number | null): string {
  if (cents === null || cents === undefined) return "—";
  return `$${(cents / 100).toFixed(2)}`;
}

export function LemonSqueezyLogClient() {
  const t = useTranslations("admin");
  const [tab, setTab] = useState<Tab>("subs");
  const [subStatus, setSubStatus] = useState<string>("");
  const [data, setData] = useState<ApiResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const qs = new URLSearchParams({ limit: "200" });
      if (subStatus) qs.set("subStatus", subStatus);
      const res = await fetch(`/api/admin/lemon-squeezy?${qs}`, { cache: "no-store" });
      const json = (await res.json()) as ApiResp;
      if (!res.ok) throw new Error(json.error ?? "load failed");
      setData(json);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [subStatus]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-zinc-800">
      <header className="mb-6 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-serif text-3xl font-bold text-zinc-900">
            🍋 {t("lemonsqueezyH1")}
          </h1>
          <p className="text-sm text-zinc-600 mt-1 max-w-2xl">{t("lemonsqueezyIntro")}</p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="px-3 py-1.5 rounded border border-zinc-300 text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
        >
          🔄
        </button>
      </header>

      {err && (
        <div className="mb-4 px-4 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          {err}
        </div>
      )}

      <nav className="flex gap-2 mb-4 border-b border-zinc-200">
        {(["subs", "payments", "log"] as const).map((key) => {
          const labelKey =
            key === "subs" ? "tabSubscriptions" : key === "payments" ? "tabPayments" : "tabWebhookLog";
          const count =
            key === "subs"
              ? data?.subs.length
              : key === "payments"
                ? data?.payments.length
                : data?.webhookLog.length;
          const active = tab === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px ${
                active
                  ? "border-yellow-600 text-yellow-700"
                  : "border-transparent text-zinc-500 hover:text-zinc-800"
              }`}
            >
              {t(labelKey)}
              {typeof count === "number" && (
                <span className="ml-2 text-xs text-zinc-400">({count})</span>
              )}
            </button>
          );
        })}
      </nav>

      {tab === "subs" && (
        <div>
          <div className="mb-3 flex gap-2">
            {[
              { v: "", l: t("filterAll") },
              { v: "active", l: t("filterActive") },
              { v: "cancelled", l: t("filterCancelled") },
            ].map((opt) => (
              <button
                key={opt.v}
                type="button"
                onClick={() => setSubStatus(opt.v)}
                className={`px-3 py-1 rounded text-xs font-semibold ${
                  subStatus === opt.v
                    ? "bg-zinc-900 text-white"
                    : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                }`}
              >
                {opt.l}
              </button>
            ))}
          </div>
          <SubsTable data={data} loading={loading} t={t} />
        </div>
      )}

      {tab === "payments" && <PaymentsTable data={data} loading={loading} t={t} />}

      {tab === "log" && <WebhookTable data={data} loading={loading} t={t} />}
    </main>
  );
}

interface TableProps {
  data: ApiResp | null;
  loading: boolean;
  t: ReturnType<typeof useTranslations>;
}

function SubsTable({ data, loading, t }: TableProps) {
  if (loading) return <p className="text-zinc-500 text-sm py-8">{t("loading")}</p>;
  if (!data || data.subs.length === 0)
    return <p className="text-zinc-500 text-sm py-8">{t("empty")}</p>;
  return (
    <div className="overflow-x-auto rounded-lg ring-1 ring-zinc-200">
      <table className="w-full text-sm">
        <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
          <tr>
            <th className="px-3 py-2 text-left">{t("colCreatedAt")}</th>
            <th className="px-3 py-2 text-left">{t("colEmail")}</th>
            <th className="px-3 py-2 text-left">{t("colPlan")}</th>
            <th className="px-3 py-2 text-left">{t("colPeriod")}</th>
            <th className="px-3 py-2 text-left">{t("colStatus")}</th>
            <th className="px-3 py-2 text-left">{t("colSubId")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {data.subs.map((s) => (
            <tr key={s.id} className="hover:bg-zinc-50">
              <td className="px-3 py-2 text-xs text-zinc-500 whitespace-nowrap">
                {formatTime(s.created_at)}
              </td>
              <td className="px-3 py-2 text-zinc-700">
                {data.userMap[s.user_id]?.email ?? s.user_id.slice(0, 8)}
              </td>
              <td className="px-3 py-2 font-semibold">{s.plan ?? "—"}</td>
              <td className="px-3 py-2 text-zinc-600">{s.period ?? "—"}</td>
              <td className="px-3 py-2">
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-bold ring-1 ${
                    STATUS_STYLE[s.status ?? ""] ?? "bg-zinc-100 text-zinc-700 ring-zinc-300"
                  }`}
                >
                  {s.status ?? "?"}
                </span>
              </td>
              <td className="px-3 py-2 font-mono text-xs text-zinc-500">
                {s.lemonsqueezy_subscription_id ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PaymentsTable({ data, loading, t }: TableProps) {
  if (loading) return <p className="text-zinc-500 text-sm py-8">{t("loading")}</p>;
  if (!data || data.payments.length === 0)
    return <p className="text-zinc-500 text-sm py-8">{t("empty")}</p>;
  return (
    <div className="overflow-x-auto rounded-lg ring-1 ring-zinc-200">
      <table className="w-full text-sm">
        <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
          <tr>
            <th className="px-3 py-2 text-left">{t("colCreatedAt")}</th>
            <th className="px-3 py-2 text-left">{t("colEmail")}</th>
            <th className="px-3 py-2 text-right">{t("colAmount")}</th>
            <th className="px-3 py-2 text-left">{t("colStatus")}</th>
            <th className="px-3 py-2 text-left">{t("colOrderId")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {data.payments.map((p) => (
            <tr key={p.id} className="hover:bg-zinc-50">
              <td className="px-3 py-2 text-xs text-zinc-500 whitespace-nowrap">
                {formatTime(p.created_at)}
              </td>
              <td className="px-3 py-2 text-zinc-700">
                {data.userMap[p.user_id]?.email ?? p.user_id.slice(0, 8)}
              </td>
              <td className="px-3 py-2 text-right font-semibold">{formatAmount(p.amount)}</td>
              <td className="px-3 py-2">
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-bold ring-1 ${
                    STATUS_STYLE[p.status] ?? "bg-zinc-100 text-zinc-700 ring-zinc-300"
                  }`}
                >
                  {p.status}
                </span>
              </td>
              <td className="px-3 py-2 font-mono text-xs text-zinc-500">
                {p.lemonsqueezy_order_id ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function WebhookTable({ data, loading, t }: TableProps) {
  if (loading) return <p className="text-zinc-500 text-sm py-8">{t("loading")}</p>;
  if (!data || data.webhookLog.length === 0)
    return <p className="text-zinc-500 text-sm py-8">{t("empty")}</p>;
  return (
    <div className="overflow-x-auto rounded-lg ring-1 ring-zinc-200">
      <table className="w-full text-sm">
        <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
          <tr>
            <th className="px-3 py-2 text-left">{t("colCreatedAt")}</th>
            <th className="px-3 py-2 text-left">{t("colEvent")}</th>
            <th className="px-3 py-2 text-left">{t("colProcessed")}</th>
            <th className="px-3 py-2 text-left">{t("colError")}</th>
            <th className="px-3 py-2 text-left">{t("colEventId")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {data.webhookLog.map((row) => {
            const failed = !row.processed_at || row.processing_error;
            return (
              <tr
                key={row.id}
                className={`hover:bg-zinc-50 ${failed ? "bg-rose-50/50" : ""}`}
              >
                <td className="px-3 py-2 text-xs text-zinc-500 whitespace-nowrap">
                  {formatTime(row.created_at)}
                </td>
                <td className="px-3 py-2 font-mono text-xs">{row.event_name}</td>
                <td className="px-3 py-2 text-center">
                  {row.processed_at ? (
                    <span className="text-emerald-600 font-bold">{t("processedYes")}</span>
                  ) : (
                    <span className="text-rose-600 font-bold">{t("processedNo")}</span>
                  )}
                </td>
                <td className="px-3 py-2 text-xs text-rose-700 max-w-md truncate">
                  {row.processing_error ?? ""}
                </td>
                <td className="px-3 py-2 font-mono text-xs text-zinc-400">
                  {row.event_id.slice(0, 16)}…
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
