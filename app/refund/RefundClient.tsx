"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface RefundRequest {
  id: string;
  amount_requested: number;
  reason: string;
  status: "pending" | "approved" | "rejected" | "refunded";
  admin_note: string | null;
  created_at: string;
  reviewed_at: string | null;
}

const STATUS_LABEL: Record<string, string> = {
  pending: "審核中",
  approved: "已通過",
  rejected: "未通過",
  refunded: "已退款",
};

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
  const [requests, setRequests] = useState<RefundRequest[] | null>(null);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notLoggedIn, setNotLoggedIn] = useState(false);

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    if (reason.trim().length < 5) {
      setError("請填寫退費原因（至少 5 個字）");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/refund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      const j = await res.json();
      if (!res.ok) {
        const errMap: Record<string, string> = {
          not_logged_in: "請先登入再申請",
          no_payment_to_refund: "找不到可退費的付款紀錄",
          duplicate_request: "您已有未完成的退費申請、不能重複提交",
          reason_too_short: "退費原因太短",
        };
        throw new Error(errMap[j.error] ?? j.error ?? `HTTP ${res.status}`);
      }
      setSubmitted(true);
      setReason("");
      void loadRequests();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  if (notLoggedIn) {
    return (
      <section className="mt-12 rounded-xl border-2 border-zinc-200 bg-white p-6">
        <h2 className="text-lg font-semibold mb-2">線上申請退費</h2>
        <p className="text-sm text-zinc-600">
          請先<Link href="/login?next=/refund" className="underline text-emerald-700 mx-1">登入</Link>
          再申請退費。也可直接 email 至{" "}
          <a className="underline" href="mailto:wengbinren@gmail.com">wengbinren@gmail.com</a>。
        </p>
      </section>
    );
  }

  return (
    <>
      <section className="mt-12 rounded-xl border-2 border-zinc-200 bg-white p-6">
        <h2 className="text-lg font-semibold mb-3">線上申請退費</h2>

        {submitted && (
          <div className="mb-4 rounded-lg p-3 border-2 bg-emerald-50 border-emerald-300 text-emerald-900 text-sm">
            ✅ 已收到您的申請，我們會在 7 個工作日內審核並 email 回覆。
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <label className="block text-sm font-medium text-zinc-700 mb-1">
            退費原因 <span className="text-zinc-500 text-xs">(請具體說明、至少 5 字)</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            placeholder="例：本服務無法產生我需要的家具類型；或：重複付款；或：系統長期無法使用…"
            className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
          {error && (
            <div className="mt-2 text-xs text-rose-700">⚠️ {error}</div>
          )}
          <p className="mt-2 text-xs text-zinc-500 leading-relaxed">
            退費將依「2. 可申請退費之情形」與「3. 不予退費之情形」審核，並非所有申請都會通過。
            審核後我們會 email 通知結果。
          </p>
          <button
            type="submit"
            disabled={submitting}
            className="mt-3 inline-block rounded-lg bg-amber-700 px-5 py-2 text-sm font-medium text-white hover:bg-amber-800 disabled:opacity-50"
          >
            {submitting ? "送出中…" : "送出退費申請"}
          </button>
        </form>
      </section>

      {requests !== null && requests.length > 0 && (
        <section className="mt-8 rounded-xl border-2 border-zinc-200 bg-white p-6">
          <h2 className="text-lg font-semibold mb-3">我的申請紀錄</h2>
          <ul className="space-y-3">
            {requests.map((r) => (
              <li key={r.id} className="border border-zinc-200 rounded-lg p-3">
                <div className="flex items-baseline justify-between gap-3 flex-wrap">
                  <div className="text-sm">
                    <span className="font-semibold">NT$ {r.amount_requested.toLocaleString()}</span>
                    <span className="text-zinc-500 ml-2 text-xs">申請日 {fmtDate(r.created_at)}</span>
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
                    <strong>客服回覆：</strong>{r.admin_note}
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
