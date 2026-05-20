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
  invoice_status: string | null;
  invoice_error_message: string | null;
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

const STATUS_ZH: Record<string, string> = {
  success: "成功",
  failed: "失敗",
  refunded: "已退款",
};

const PLAN_ZH: Record<string, string> = {
  free: "免費版",
  personal: "個人版",
  pro: "專業版",
  lifetime: "終身版",
  student: "學員版",
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

  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [retryResult, setRetryResult] = useState<{ id: string; msg: string; ok: boolean } | null>(null);
  const [voidingId, setVoidingId] = useState<string | null>(null);
  const [simSubId, setSimSubId] = useState("");
  const [simSuccess, setSimSuccess] = useState(true);
  const [simBusy, setSimBusy] = useState(false);
  const [simResult, setSimResult] = useState<string | null>(null);
  const [reconBusy, setReconBusy] = useState(false);
  const [reconResult, setReconResult] = useState<string | null>(null);
  const [queryOrderId, setQueryOrderId] = useState("");
  const [queryBusy, setQueryBusy] = useState(false);
  const [queryResult, setQueryResult] = useState<string | null>(null);
  async function queryPeriodic() {
    if (!queryOrderId.trim()) {
      setQueryResult("請輸入 merchant_trade_no");
      return;
    }
    setQueryBusy(true);
    setQueryResult("查詢中…");
    try {
      const r = await fetch("/api/admin/ecpay/query-periodic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ merchant_trade_no: queryOrderId.trim() }),
      });
      const j = await r.json();
      setQueryResult(JSON.stringify(j, null, 2));
    } catch (e) {
      setQueryResult(`❌ ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setQueryBusy(false);
    }
  }
  async function runReconciliation() {
    if (!confirm("立即觸發對帳 cron?\n(查綠界每筆 active monthly sub 狀態,終止的同步 DB)")) return;
    setReconBusy(true);
    setReconResult("執行中…");
    try {
      const r = await fetch("/api/admin/run-reconciliation", { method: "POST" });
      const j = await r.json();
      if (!r.ok) {
        setReconResult(`❌ ${j.error ?? `HTTP ${r.status}`} ${j.detail ?? j.hint ?? ""}`);
      } else {
        const res = j.result ?? {};
        setReconResult(`✓ 檢查 ${res.checked ?? 0} 筆 / 同步 ${res.synced ?? 0} 筆 / 錯誤 ${res.errors ?? 0}${res.drifted?.length ? "\n漂移訂單: " + res.drifted.join(", ") : ""}`);
      }
      await load();
    } catch (e) {
      setReconResult(`❌ ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setReconBusy(false);
    }
  }
  async function simulatePeriodic() {
    if (!simSubId.trim()) {
      setSimResult("請輸入 subscription_id");
      return;
    }
    if (!confirm(`模擬綠界月扣 webhook(${simSuccess ? "成功" : "失敗"})打 sub=${simSubId}?`)) return;
    setSimBusy(true);
    setSimResult("呼叫中…");
    try {
      const r = await fetch("/api/admin/ecpay/simulate-periodic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription_id: simSubId.trim(), success: simSuccess }),
      });
      const j = await r.json();
      if (!r.ok) {
        setSimResult(`❌ ${j.error ?? `HTTP ${r.status}`} ${j.detail ?? j.hint ?? ""}`);
      } else {
        const beforeAfter = `\n  expires_at: ${j.before?.sub_expires_at?.slice(0,10) ?? "—"} → ${j.after?.sub_expires_at?.slice(0,10) ?? "—"}\n  status: ${j.before?.sub_status} → ${j.after?.sub_status}`;
        const pay = j.newest_payment ? `\n  最新 payment: ${j.newest_payment.amount} ${j.newest_payment.status} ${j.newest_payment.ecpay_trade_no ?? ""}` : "";
        setSimResult(`✓ webhook ${j.webhook_response?.status} ${j.webhook_response?.body}${beforeAfter}${pay}`);
      }
      await load();
    } catch (e) {
      setSimResult(`❌ ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSimBusy(false);
    }
  }
  async function voidInvoice(paymentId: string) {
    if (voidingId) return;
    if (!confirm("確定要作廢這張發票?(只限退款後同步、24h 內可用)")) return;
    setVoidingId(paymentId);
    setRetryResult(null);
    try {
      const r = await fetch(`/api/admin/payments/${paymentId}/void-invoice`, { method: "POST" });
      const j = await r.json();
      if (r.ok) {
        setRetryResult({ id: paymentId, ok: true, msg: `作廢成功 ${j.invoice_number ?? ""}` });
      } else if (j.error === "exceed_24h") {
        setRetryResult({ id: paymentId, ok: false, msg: `超過 24h (${Math.round(j.ageHours)}h),需走 Allowance 折讓人工處理` });
      } else {
        setRetryResult({ id: paymentId, ok: false, msg: `作廢失敗 ${j.error ?? "?"}: ${j.rtnMsg ?? ""}` });
      }
      await load();
    } catch (e) {
      setRetryResult({ id: paymentId, ok: false, msg: e instanceof Error ? e.message : String(e) });
    } finally {
      setVoidingId(null);
    }
  }
  async function retryInvoice(paymentId: string) {
    if (retryingId) return;
    setRetryingId(paymentId);
    setRetryResult(null);
    try {
      const r = await fetch(`/api/admin/payments/${paymentId}/retry-invoice`, { method: "POST" });
      const j = await r.json();
      if (r.ok) {
        setRetryResult({ id: paymentId, ok: true, msg: `重試成功 invoice_status=${j.invoice_status ?? "?"}` });
      } else {
        setRetryResult({ id: paymentId, ok: false, msg: `重試失敗 ${j.error ?? "?"}: ${j.message ?? ""}` });
      }
      await load();
    } catch (e) {
      setRetryResult({ id: paymentId, ok: false, msg: e instanceof Error ? e.message : String(e) });
    } finally {
      setRetryingId(null);
    }
  }

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
            最近 100 筆付款紀錄(綠界自動回傳寫入)。「原始回應」是綠界丟過來的完整資料,除錯用。
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2 py-1.5 rounded border border-zinc-300 text-sm"
          >
            <option value="">全部狀態</option>
            <option value="success">成功</option>
            <option value="failed">失敗</option>
            <option value="refunded">已退款</option>
          </select>
          <button
            type="button"
            onClick={runReconciliation}
            disabled={reconBusy}
            className="px-3 py-1.5 rounded border border-emerald-300 bg-emerald-50 text-emerald-900 text-sm hover:bg-emerald-100 disabled:opacity-50"
            title="對帳:抓所有 active monthly sub,查綠界狀態,終止的同步 DB"
          >
            🔃 {reconBusy ? "對帳中…" : "立即對帳"}
          </button>
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
      {retryResult && (
        <div className={`mb-4 px-4 py-2 rounded text-sm ${retryResult.ok ? "bg-emerald-50 border border-emerald-200 text-emerald-800" : "bg-red-50 border border-red-200 text-red-700"}`}>
          {retryResult.msg}
        </div>
      )}
      {reconResult && (
        <pre className="mb-4 px-4 py-2 rounded text-xs font-mono whitespace-pre-wrap bg-emerald-50 border border-emerald-200 text-emerald-900">
          {reconResult}
        </pre>
      )}

      {/* 模擬月扣下期 webhook(dev/test 用) */}
      <details className="mb-4 rounded-lg border border-indigo-300 bg-indigo-50">
        <summary className="cursor-pointer select-none px-3 py-2 text-[11px] font-semibold text-indigo-900">
          🧪 模擬月扣下期 webhook(periodic-notify 測試)
        </summary>
        <div className="px-3 pb-3">
          <p className="text-[11px] text-indigo-800 mb-2">
            輸入 monthly 訂閱的 subscription.id → 系統會用正確 CheckMacValue 自打 /api/ecpay/periodic-notify。
            測試:expires_at +31 天 / 寫 payment / 開發票 / 寄信。<strong>不會真扣錢</strong>。
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={simSubId}
              onChange={(e) => setSimSubId(e.target.value)}
              placeholder="subscription_id (uuid)"
              className="flex-1 min-w-[260px] text-xs px-3 py-1.5 rounded border border-indigo-300 bg-white font-mono"
              disabled={simBusy}
            />
            <label className="text-[11px] flex items-center gap-1 text-indigo-900">
              <input
                type="checkbox"
                checked={simSuccess}
                onChange={(e) => setSimSuccess(e.target.checked)}
                disabled={simBusy}
              />
              成功扣款(取消勾選 = 模擬失敗)
            </label>
            <button
              type="button"
              onClick={simulatePeriodic}
              disabled={simBusy}
              className="text-xs px-3 py-1.5 rounded bg-indigo-700 text-white hover:bg-indigo-800 disabled:opacity-50"
            >
              {simBusy ? "呼叫中…" : "模擬下期"}
            </button>
          </div>
          {simResult && (
            <pre className="mt-2 text-[11px] font-mono whitespace-pre-wrap text-indigo-950 bg-white border border-indigo-200 rounded p-2">
              {simResult}
            </pre>
          )}
          <hr className="my-3 border-indigo-200" />
          <p className="text-[11px] text-indigo-800 mb-2">
            🔍 查綠界定期定額 raw 狀態(對帳 cron 抓不到時診斷用)
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={queryOrderId}
              onChange={(e) => setQueryOrderId(e.target.value)}
              placeholder="merchant_trade_no (e.g. WRMPCT883KFJXN)"
              className="flex-1 min-w-[260px] text-xs px-3 py-1.5 rounded border border-indigo-300 bg-white font-mono"
              disabled={queryBusy}
            />
            <button
              type="button"
              onClick={queryPeriodic}
              disabled={queryBusy}
              className="text-xs px-3 py-1.5 rounded bg-zinc-700 text-white hover:bg-zinc-800 disabled:opacity-50"
            >
              {queryBusy ? "查詢中…" : "查綠界狀態"}
            </button>
          </div>
          {queryResult && (
            <pre className="mt-2 text-[11px] font-mono whitespace-pre-wrap text-zinc-900 bg-white border border-zinc-200 rounded p-2 max-h-[300px] overflow-auto">
              {queryResult}
            </pre>
          )}
        </div>
      </details>

      <div className="overflow-x-auto bg-white rounded-lg border border-zinc-200">
        <table className="min-w-full text-xs">
          <thead className="bg-zinc-50 text-zinc-600 text-[11px] tracking-wide">
            <tr>
              <th className="text-left px-3 py-2">時間</th>
              <th className="text-left px-3 py-2">帳號</th>
              <th className="text-left px-3 py-2">方案</th>
              <th className="text-right px-3 py-2">金額</th>
              <th className="text-left px-3 py-2">狀態</th>
              <th className="text-left px-3 py-2">發票</th>
              <th className="text-left px-3 py-2">交易編號</th>
              <th className="text-left px-3 py-2">警示</th>
              <th className="text-right px-3 py-2">明細</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {rows.length === 0 && !loading && (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-zinc-400">
                  目前還沒有付款紀錄
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
                      {(() => {
                        const p2 = sub?.plan ?? u?.plan;
                        return p2 ? (PLAN_ZH[p2] ?? p2) : "—";
                      })()}
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums text-zinc-800">
                      {p.amount != null ? `NT$${p.amount}` : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-0.5 rounded text-[11px] ring-1 ${STATUS_STYLE[p.status] ?? "bg-zinc-100 text-zinc-700 ring-zinc-200"}`}>
                        {STATUS_ZH[p.status] ?? p.status}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <InvoiceCell
                        payment={p}
                        retrying={retryingId === p.id}
                        voiding={voidingId === p.id}
                        onRetry={() => retryInvoice(p.id)}
                        onVoid={() => voidInvoice(p.id)}
                      />
                    </td>
                    <td className="px-3 py-2 font-mono text-[11px] text-zinc-600">
                      {p.ecpay_trade_no ?? "—"}
                    </td>
                    <td className="px-3 py-2">
                      {mismatch && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-red-100 text-red-800 ring-1 ring-red-200" title={`應收 NT$${sub?.expected_amount},實收 NT$${p.amount}`}>
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
                      <td colSpan={9} className="px-3 py-3">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                          <div>
                            <div className="text-[11px] text-zinc-500 mb-1">訂閱資料</div>
                            <pre className="text-[11px] bg-white border border-zinc-200 rounded p-2 overflow-x-auto">
{JSON.stringify(sub ?? null, null, 2)}
                            </pre>
                          </div>
                          <div>
                            <div className="text-[11px] text-zinc-500 mb-1">綠界原始回應</div>
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

function InvoiceCell({
  payment,
  retrying,
  voiding,
  onRetry,
  onVoid,
}: {
  payment: PaymentRow;
  retrying: boolean;
  voiding: boolean;
  onRetry: () => void;
  onVoid: () => void;
}) {
  const s = payment.invoice_status;
  // 取消後綠界誤扣的 payment(periodic-notify 在 cancelled 分支只記 row 不開發票)
  //   identify via raw_response._note
  const isPostCancelCharge =
    payment.raw_response &&
    typeof payment.raw_response === "object" &&
    (payment.raw_response as Record<string, unknown>)._note === "post_cancel_charge";
  if (isPostCancelCharge) {
    return (
      <span className="text-[11px] text-zinc-500" title="cancelled 後的扣款,刻意不開發票">
        ⏭ 已取消後扣款
      </span>
    );
  }
  // simulate-periodic 工具產的模擬付款(SIM* TradeNo,綠界無此交易,不能真的退款)
  const isSimPeriodic =
    payment.raw_response &&
    typeof payment.raw_response === "object" &&
    (payment.raw_response as Record<string, unknown>)._note === "sim_periodic";
  if (isSimPeriodic) {
    return (
      <span className="text-[11px] text-purple-600" title="admin 模擬月扣產生的測試付款,綠界無此交易,無法真的退款">
        🧪 模擬付款
      </span>
    );
  }
  // refunded payment 沒同步作廢/折讓 → 顯示按鈕(24h 內自動 invalid、超過自動 Allowance)
  if (payment.status === "refunded" && s === "issued") {
    return (
      <div className="flex flex-col items-start gap-1">
        <span className="text-[11px] text-amber-700">⚠ 已開立未處理</span>
        <button
          type="button"
          onClick={onVoid}
          disabled={voiding}
          className="text-[10px] px-1.5 py-0.5 rounded bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50"
          title="24h 內自動作廢、超過自動開折讓單"
        >
          {voiding ? "處理中…" : "補作廢/折讓"}
        </button>
      </div>
    );
  }
  if (s === "invalid") {
    return <span className="text-[11px] text-zinc-500">✗ 已作廢</span>;
  }
  if (s === "allowanced") {
    const allowNo = (payment as unknown as Record<string, unknown>).allowance_number as string | null;
    return (
      <span
        className="text-[11px] text-blue-700"
        title={allowNo ? `折讓單號 ${allowNo}` : "已開立折讓單"}
      >
        ↩ 已折讓
      </span>
    );
  }
  if (payment.status !== "success") return <span className="text-zinc-400 text-[11px]">—</span>;
  if (s === "issued") {
    return <span className="text-[11px] text-emerald-700">✓ 已開立</span>;
  }
  if (s === "failed") {
    return (
      <div className="flex flex-col items-start gap-1">
        <span className="text-[11px] text-red-700" title={payment.invoice_error_message ?? ""}>
          ✗ 失敗
        </span>
        <button
          type="button"
          onClick={onRetry}
          disabled={retrying}
          className="text-[10px] px-1.5 py-0.5 rounded bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
        >
          {retrying ? "重試中…" : "重試"}
        </button>
        {payment.invoice_error_message && (
          <div className="text-[10px] text-red-600 max-w-[160px] truncate" title={payment.invoice_error_message}>
            {payment.invoice_error_message}
          </div>
        )}
      </div>
    );
  }
  if (s === "pending" || !s) {
    return (
      <div className="flex flex-col items-start gap-1">
        <span className="text-[11px] text-amber-700">⋯ 待開立</span>
        <button
          type="button"
          onClick={onRetry}
          disabled={retrying}
          className="text-[10px] px-1.5 py-0.5 rounded bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
        >
          {retrying ? "重試中…" : "重試"}
        </button>
      </div>
    );
  }
  return <span className="text-[11px] text-zinc-600">{s}</span>;
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
