"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

interface RefundRequest {
  id: string;
  amount_requested: number;
  reason: string;
  status: "pending" | "approved" | "rejected" | "refunded";
  admin_note: string | null;
  created_at: string;
  reviewed_at: string | null;
}

const STATUS_COLOR: Record<string, string> = {
  pending: "bg-amber-50 text-amber-900 border-amber-300",
  approved: "bg-emerald-50 text-emerald-900 border-emerald-300",
  rejected: "bg-rose-50 text-rose-900 border-rose-300",
  refunded: "bg-sky-50 text-sky-900 border-sky-300",
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toISOString().slice(0, 10);
}

export function RefundClient() {
  const t = useTranslations("refund.client");
  const [requests, setRequests] = useState<RefundRequest[] | null>(null);
  const [notLoggedIn, setNotLoggedIn] = useState(false);

  const STATUS_LABEL: Record<RefundRequest["status"], string> = {
    pending: t("statusPending"),
    approved: t("statusApproved"),
    rejected: t("statusRejected"),
    refunded: t("statusRefunded"),
  };

  async function loadRequests() {
    try {
      const res = await fetch("/api/refund", { cache: "no-store" });
      if (res.status === 401) {
        setNotLoggedIn(true);
        return;
      }
      const j = await res.json();
      setRequests((j.data ?? []) as RefundRequest[]);
    } catch (e) {
      console.warn("[refund] load failed", e);
    }
  }

  useEffect(() => {
    void loadRequests();
  }, []);

  return (
    <>
      <section className="mt-12 rounded-xl border-2 border-amber-200 bg-amber-50/50 p-6">
        <h2 className="text-lg font-semibold mb-3">{t("applyH")}</h2>
        <p className="text-sm text-zinc-700 leading-relaxed mb-3">
          {t("applyP1")}
          <strong>{t("applyP1Strong")}</strong>
          {t("applyP1Suffix")}
        </p>
        <div className="mt-4 rounded-lg bg-white border border-amber-300 p-4">
          <p className="text-sm text-zinc-700 mb-1">{t("emailLabel")}</p>
          <a
            className="text-base font-mono font-semibold text-amber-800 hover:underline"
            href={`mailto:wengbinren@gmail.com?subject=${encodeURIComponent(t("mailtoSubject"))}`}
          >
            wengbinren@gmail.com
          </a>
          <p className="text-xs text-zinc-500 mt-3 leading-relaxed">
            {t("emailHint")}
            <br />
            {t("emailHint2")}
          </p>
        </div>
        {notLoggedIn && (
          <p className="text-xs text-zinc-500 mt-3">
            <Link href="/login?next=/refund" className="underline text-emerald-700">
              {t("loginLink")}
            </Link>
            {t("loginToView")}
          </p>
        )}
      </section>

      {requests !== null && requests.length > 0 && (
        <section className="mt-8 rounded-xl border-2 border-zinc-200 bg-white p-6">
          <h2 className="text-lg font-semibold mb-3">{t("myRecordsH")}</h2>
          <ul className="space-y-3">
            {requests.map((r) => (
              <li key={r.id} className="border border-zinc-200 rounded-lg p-3">
                <div className="flex items-baseline justify-between gap-3 flex-wrap">
                  <div className="text-sm">
                    <span className="font-semibold">
                      NT$ {r.amount_requested.toLocaleString()}
                    </span>
                    <span className="text-zinc-500 ml-2 text-xs">
                      {t("appliedOnTpl", { date: fmtDate(r.created_at) })}
                    </span>
                  </div>
                  <span
                    className={`text-xs px-2 py-0.5 rounded border font-medium ${
                      STATUS_COLOR[r.status] ?? ""
                    }`}
                  >
                    {STATUS_LABEL[r.status] ?? r.status}
                  </span>
                </div>
                <p className="text-xs text-zinc-600 mt-1 whitespace-pre-wrap">{r.reason}</p>
                {r.admin_note && (
                  <div className="mt-2 text-xs text-zinc-700 bg-zinc-50 border border-zinc-200 rounded p-2">
                    <strong>{t("adminReplyLabel")}</strong>
                    {r.admin_note}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
