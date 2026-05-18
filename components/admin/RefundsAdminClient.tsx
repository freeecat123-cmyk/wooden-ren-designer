"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

interface RefundRow {
  id: string;
  user_id: string;
  payment_id: string | null;
  amount_requested: number;
  reason: string;
  status: "pending" | "approved" | "rejected" | "refunded";
  admin_note: string | null;
  created_at: string;
  reviewed_at: string | null;
  users: { email?: string; plan?: string } | { email?: string; plan?: string }[] | null;
  payments: { amount?: number; ecpay_trade_no?: string } | { amount?: number; ecpay_trade_no?: string }[] | null;
}

const STATUS_LABEL: Record<string, string> = {
  pending: "審核中",
  approved: "已通過",
  rejected: "未通過",
  refunded: "已退款",
};

const STATUS_COLOR: Record<string, string> = {
  pending: "bg-amber-100 text-amber-900 border-amber-300",
  approved: "bg-emerald-100 text-emerald-900 border-emerald-300",
  rejected: "bg-rose-100 text-rose-900 border-rose-300",
  refunded: "bg-sky-100 text-sky-900 border-sky-300",
};

function unwrapJoined<T>(v: T | T[] | null): T | null {
  if (!v) return null;
  return Array.isArray(v) ? v[0] ?? null : v;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toISOString().slice(0, 10);
}

export function RefundsAdminClient() {
  const [rows, setRows] = useState<RefundRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [reviewing, setReviewing] = useState<RefundRow | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/refunds?status=${statusFilter}`, {
        cache: "no-store",
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? `HTTP ${res.status}`);
      setRows((j.data ?? []) as RefundRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const counts = useMemo(() => rows.length, [rows]);

  return (
    <main className="max-w-6xl mx-auto px-4 py-6">
      <header className="mb-4 flex items-baseline justify-between gap-3 flex-wrap">
        <div>
          <Link href="/admin" className="text-xs text-zinc-600 hover:underline">
            ← 後台儀表板
          </Link>
          <h1 className="text-2xl font-bold text-zinc-900 mt-1">退費審核</h1>
          <p className="text-xs text-zinc-700 mt-1">當前 {counts} 筆</p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="text-xs px-3 py-1.5 rounded border border-zinc-300 bg-white hover:bg-zinc-50 disabled:opacity-50"
        >
          {loading ? "載入中…" : "🔄 重新載入"}
        </button>
      </header>

      <div className="mb-3 flex items-center gap-1 flex-wrap">
        {(["pending", "approved", "rejected", "refunded", "all"] as const).map(
          (s) => {
            const active = statusFilter === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={`text-xs px-2.5 py-1 rounded border ${
                  active
                    ? "bg-zinc-900 text-white border-zinc-900"
                    : "bg-white text-zinc-700 border-zinc-300 hover:bg-zinc-50"
                }`}
              >
                {s === "all" ? "全部" : STATUS_LABEL[s] ?? s}
              </button>
            );
          },
        )}
      </div>

      {error && (
        <div className="mb-3 p-3 rounded bg-rose-50 border border-rose-200 text-sm text-rose-800">
          載入失敗：{error}
        </div>
      )}

      <ul className="space-y-3">
        {rows.map((r) => {
          const user = unwrapJoined(r.users);
          const payment = unwrapJoined(r.payments);
          return (
            <li
              key={r.id}
              className="bg-white rounded-lg border border-zinc-200 p-4 shadow-sm"
            >
              <div className="flex justify-between items-baseline gap-3 flex-wrap mb-2">
                <div>
                  <div className="font-mono text-sm">{user?.email ?? "(no email)"}</div>
                  <div className="text-xs text-zinc-500 mt-0.5">
                    申請 {fmtDate(r.created_at)} · NT$ {r.amount_requested.toLocaleString()}
                    {payment?.amount && payment.amount !== r.amount_requested && (
                      <span className="ml-1">（原付 NT$ {payment.amount.toLocaleString()}）</span>
                    )}
                  </div>
                </div>
                <span
                  className={`text-xs px-2 py-0.5 rounded border font-medium ${
                    STATUS_COLOR[r.status] ?? ""
                  }`}
                >
                  {STATUS_LABEL[r.status] ?? r.status}
                </span>
              </div>
              <p className="text-sm text-zinc-700 whitespace-pre-wrap bg-zinc-50 border border-zinc-200 rounded p-2 mb-2">
                {r.reason}
              </p>
              {r.admin_note && (
                <p className="text-xs text-zinc-600 mt-1">
                  <strong>客服回覆：</strong>{r.admin_note}
                </p>
              )}
              {(r.status === "pending" || r.status === "approved") && (
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setReviewing(r)}
                    className="text-xs px-3 py-1 rounded bg-amber-600 text-white font-medium hover:bg-amber-700"
                  >
                    {r.status === "pending" ? "審核" : "標記已退款"}
                  </button>
                </div>
              )}
            </li>
          );
        })}
        {rows.length === 0 && !loading && (
          <li className="text-center text-sm text-zinc-500 py-8">沒有資料</li>
        )}
      </ul>

      {reviewing && (
        <ReviewModal
          row={reviewing}
          onClose={() => setReviewing(null)}
          onSaved={() => {
            setReviewing(null);
            void load();
          }}
        />
      )}
    </main>
  );
}

function ReviewModal({
  row,
  onClose,
  onSaved,
}: {
  row: RefundRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [decision, setDecision] = useState<"approved" | "rejected" | "refunded">(
    row.status === "approved" ? "refunded" : "approved",
  );
  const [note, setNote] = useState(row.admin_note ?? "");
  const [downgrade, setDowngrade] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/refunds/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: decision,
          admin_note: note,
          downgrade_user: downgrade,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? `HTTP ${res.status}`);
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg w-full max-w-md p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-semibold text-zinc-900 text-lg mb-3">審核退費申請</h3>

        <label className="block text-xs text-zinc-600 mb-1">決議</label>
        <select
          value={decision}
          onChange={(e) =>
            setDecision(e.target.value as "approved" | "rejected" | "refunded")
          }
          className="w-full border border-zinc-300 rounded px-2 py-1.5 text-sm mb-3"
        >
          {row.status === "pending" && (
            <>
              <option value="approved">通過（同意退費）</option>
              <option value="rejected">拒絕</option>
            </>
          )}
          {row.status === "approved" && (
            <option value="refunded">標記已完成退款</option>
          )}
        </select>

        {decision === "approved" && (
          <label className="flex items-center gap-2 text-xs text-zinc-700 mb-3">
            <input
              type="checkbox"
              checked={downgrade}
              onChange={(e) => setDowngrade(e.target.checked)}
            />
            通過後自動降為免費版（建議勾選）
          </label>
        )}

        <label className="block text-xs text-zinc-600 mb-1">
          備註 / 給 user 看的說明（會在 email 內出現）
        </label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder="例：經審核您符合退費條件、款項將於 3-7 個工作日退回信用卡"
          className="w-full border border-zinc-300 rounded px-2 py-1.5 text-sm mb-3"
        />

        {err && (
          <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded p-2 mb-3">
            {err}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="text-sm px-3 py-1.5 rounded border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="text-sm px-3 py-1.5 rounded bg-amber-600 text-white font-medium hover:bg-amber-700 disabled:opacity-50"
          >
            {saving ? "儲存中…" : "送出"}
          </button>
        </div>
      </div>
    </div>
  );
}
