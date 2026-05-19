"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

interface PaymentRow {
  id: string;
  user_id: string;
  subscription_id: string | null;
  amount: number | null;
  status: string;
  ecpay_trade_no: string | null;
  ecpay_payment_date: string | null;
  raw_response: Record<string, unknown> | null;
  created_at: string;
}

interface UserRow {
  id: string;
  email: string | null;
  plan: string | null;
}

interface SubRow {
  id: string;
  plan: string | null;
  ecpay_merchant_trade_no: string | null;
  ecpay_periodic_no: string | null;
  expected_amount: number | null;
  status: string | null;
}

interface ApiResp {
  rows: PaymentRow[];
  userMap: Record<string, UserRow>;
  subMap: Record<string, SubRow>;
  error?: string;
}

const STATUS_STYLE: Record<string, string> = {
  success: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  failed: "bg-red-100 text-red-800 ring-red-200",
  refunded: "bg-amber-100 text-amber-800 ring-amber-200",
};

export function EcpayLogClient() {
  const [data, setData] = useState<ApiResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const qs = new URLSearchParams({ limit: "100" });
      if (statusFilter) qs.set("status", statusFilter);
      const res = await fetch(`/api/admin/ecpay-log?${qs}`, { cache: "no-store" });
      const json = (await res.json()) as ApiResp;
      if (!res.ok) throw new Error(json.error ?? "load failed");
      setData(json);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const rows = data?.rows ?? [];
  const successCount = rows.filter((r) => r.status === "success").length;
  const failedCount = rows.filter((r) => r.status === "failed").length;
  const refundedCount = rows.filter((r) => r.status === "refunded").length;

  // 偵測「金額不符」warning:expected_amount vs amount
  function amountMismatch(p: PaymentRow): boolean {
    const sub = p.subscription_id ? data?.subMap[p.subscription_id] : null;
    if (!sub || !sub.expected_amount || p.amount == null) return false;
    return Number(sub.expected_amount) !== Number(p.amount);
  }

  return (
    <main className="max-w-7xl mx-auto px-5 py-8">
      <header className="mb-6 flex items-baseline justify-between gap-4 flex-wrap">
        <div>
          <Link href="/admin" className="text-sm text-zinc-500 hover:underline">
            ← 後台
          </Link>
          <h1 className="text-2xl font-bold mt-1">綠界日誌</h1>
          <p className="mt-1 text-sm text-zinc-500">
            最近 100 筆 payments(ECPay callback 寫入)。raw_response 是綠界原始 callback,debug 用。
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2 py-1.5 rounded border border-zinc-300 text-sm"
          >
            <option value="">全部 status</option>
            <option value="success">success</option>
            <option value="failed">failed</option>
            <option value="refunded">refunded</option>
          </select>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="px-3 py-1.5 rounded border border-zinc-300 text-sm hover:bg-zinc-50 disabled:opacity-50"
          >
            🔄 {loading ? "載入中…" : "重新載入"}
          </button>
        </div>
      </header>

      <div className="mb-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="共" value={rows.length} />
        <Stat label="成功" value={successCount} tone="emerald" />
        <Stat label="失敗" value={failedCount} tone="red" />
        <Stat label="退款" value={refundedCount} tone="amber" />
      </div>

      {err && (
        <div className="mb-4 px-4 py-2 rounded bg-red-50 border border-red-200 text-sm text-red-700">
          {err}
        </div>
      )}

      <div className="overflow-x-auto bg-white rounded-lg border border-zinc-200">
        <table className="min-w-full text-xs">
          <thead className="bg-zinc-50 text-zinc-600 text-[11px] uppercase tracking-wide">
            <tr>
              <th className="text-left px-3 py-2">時間</th>
              <th className="text-left px-3 py-2">User</th>
              <th className="text-left px-3 py-2">Plan</th>
              <th className="text-right px-3 py-2">金額</th>
              <th className="text-left px-3 py-2">Status</th>
              <th className="text-left px-3 py-2">TradeNo</th>
              <th className="text-left px-3 py-2">警示</th>
              <th className="text-right px-3 py-2">Raw</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {rows.length === 0 && !loading && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-zinc-400">
                  沒有資料
                </td>
              </tr>
            )}
            {rows.map((p) => {
              const u = data?.userMap[p.user_id];
              const sub = p.subscription_id ? data?.subMap[p.subscription_id] : null;
              const mismatch = amountMismatch(p);
              const isExpanded = expanded === p.id;
              return (
                <>
                  <tr key={p.id} className="hover:bg-zinc-50">
                    <td className="px-3 py-2 font-mono tabular-nums text-zinc-700 whitespace-nowrap">
                      {new Date(p.created_at).toLocaleString("zh-TW", { hour12: false }).replace(/\//g, "-")}
                    </td>
                    <td className="px-3 py-2 text-zinc-800">
                      {u?.email ?? <span className="text-zinc-400 font-mono">{p.user_id.slice(0, 8)}…</span>}
                    </td>
                    <td className="px-3 py-2 text-zinc-600">
                      {sub?.plan ?? u?.plan ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums text-zinc-800">
                      {p.amount != null ? `NT$${p.amount}` : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-0.5 rounded text-[11px] ring-1 ${STATUS_STYLE[p.status] ?? "bg-zinc-100 text-zinc-700 ring-zinc-200"}`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono text-[11px] text-zinc-600">
                      {p.ecpay_trade_no ?? "—"}
                    </td>
                    <td className="px-3 py-2">
                      {mismatch && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-red-100 text-red-800 ring-1 ring-red-200" title={`expected ${sub?.expected_amount} got ${p.amount}`}>
                          ⚠ 金額不符
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => setExpanded(isExpanded ? null : p.id)}
                        className="text-zinc-500 hover:text-zinc-900"
                      >
                        {isExpanded ? "收起" : "展開"}
                      </button>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr key={`${p.id}-raw`} className="bg-zinc-50">
                      <td colSpan={8} className="px-3 py-3">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                          <div>
                            <div className="text-[11px] text-zinc-500 mb-1">Subscription</div>
                            <pre className="text-[11px] bg-white border border-zinc-200 rounded p-2 overflow-x-auto">
{JSON.stringify(sub ?? null, null, 2)}
                            </pre>
                          </div>
                          <div>
                            <div className="text-[11px] text-zinc-500 mb-1">ECPay raw_response</div>
                            <pre className="text-[11px] bg-white border border-zinc-200 rounded p-2 overflow-x-auto">
{JSON.stringify(p.raw_response ?? null, null, 2)}
                            </pre>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
    </main>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "emerald" | "red" | "amber" }) {
  const toneClass = tone === "emerald"
    ? "text-emerald-700"
    : tone === "red"
    ? "text-red-700"
    : tone === "amber"
    ? "text-amber-700"
    : "text-zinc-900";
  return (
    <div className="bg-white rounded-lg border border-zinc-200 px-3 py-2">
      <div className="text-[11px] text-zinc-500">{label}</div>
      <div className={`text-xl font-bold tabular-nums ${toneClass}`}>{value}</div>
    </div>
  );
}
