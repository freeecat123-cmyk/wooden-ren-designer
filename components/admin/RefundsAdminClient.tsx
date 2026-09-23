"use client";

import { useEffect, useMemo, useState } from "react";
import { Link } from "@/i18n/navigation";

interface LookupPaymentRow {
  payment_id: string;
  user_id: string;
  amount: number;
  status: string;
  method: "credit_card" | "atm" | "cvs" | "barcode" | "unknown";
  method_label: string;
  order_id: string | null;
  ecpay_trade_no: string | null;
  item_name: string | null;
  invoice_number: string | null;
  invoice_status: string | null;
  created_at: string;
  existing_refund: { id: string; status: string } | null;
}

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
  const [allCounts, setAllCounts] = useState<Record<string, number>>({
    pending: 0,
    approved: 0,
    rejected: 0,
    refunded: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [search, setSearch] = useState<string>("");
  const [reviewing, setReviewing] = useState<RefundRow | null>(null);
  const [quickEmail, setQuickEmail] = useState("");
  const [quickPaymentId, setQuickPaymentId] = useState("");
  const [quickBusy, setQuickBusy] = useState(false);
  const [quickResult, setQuickResult] = useState<string | null>(null);

  // 查使用者付款 → 建退費單（給 ATM/超商手動退費用，admin 收到 user email 後操作）
  const [lookupEmail, setLookupEmail] = useState("");
  const [lookupBusy, setLookupBusy] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookupResults, setLookupResults] = useState<LookupPaymentRow[] | null>(null);

  async function runLookup() {
    const email = lookupEmail.trim();
    if (!email) {
      setLookupError("請輸入 email");
      return;
    }
    setLookupBusy(true);
    setLookupError(null);
    setLookupResults(null);
    try {
      const res = await fetch(
        `/api/admin/refunds/manual?user_email=${encodeURIComponent(email)}`,
        { cache: "no-store" },
      );
      const j = await res.json();
      if (!res.ok) {
        setLookupError(j.error ?? `HTTP ${res.status}`);
      } else if (j.error === "user_not_found") {
        setLookupError("找不到此 email 的使用者");
        setLookupResults([]);
      } else {
        setLookupResults((j.data ?? []) as LookupPaymentRow[]);
      }
    } catch (e) {
      setLookupError(e instanceof Error ? e.message : String(e));
    } finally {
      setLookupBusy(false);
    }
  }

  async function openExistingRefund(refundId: string) {
    // 從目前 rows 找；找不到就把篩選切到全部 + reload 後再找
    let target = rows.find((x) => x.id === refundId);
    if (!target) {
      setStatusFilter("all");
      await load();
      // load() 完成後 rows 還沒同步到這個函式 scope 的 closure，
      // 改 fetch 一次拿目標 row
      try {
        const res = await fetch(`/api/admin/refunds?status=all`, { cache: "no-store" });
        const j = await res.json();
        target = (j.data ?? []).find((x: RefundRow) => x.id === refundId);
      } catch {
        // ignore
      }
    }
    if (target) {
      setReviewing(target);
      // 收起 lookup 結果，畫面比較乾淨
      setLookupResults(null);
      setLookupEmail("");
    } else {
      alert(`找不到 refund_request id=${refundId}，請手動到 /admin/refunds 全部分頁找`);
    }
  }

  async function createRefundForPayment(row: LookupPaymentRow) {
    const reason = window.prompt(
      `為這筆 ${row.method_label} NT$${row.amount} 付款建立退費單，請輸入原因：`,
      "使用者 email 來信申請退費",
    );
    if (!reason) return;
    try {
      const res = await fetch("/api/admin/refunds/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payment_id: row.payment_id, reason }),
      });
      const j = await res.json();
      if (!res.ok) {
        alert(`建立失敗：${j.error}\n${JSON.stringify(j.existing ?? {}, null, 2)}`);
        return;
      }
      alert(`✅ 退費單已建立（狀態：待審核）\n下方列表會出現此筆，點「審核此申請」進入處理流程。`);
      setLookupResults(null);
      setLookupEmail("");
      setStatusFilter("pending");
      void load();
    } catch (e) {
      alert(`建立失敗：${e instanceof Error ? e.message : String(e)}`);
    }
  }

  async function runQuickRefund() {
    const usePid = quickPaymentId.trim().length > 0;
    const target = usePid ? `payment ${quickPaymentId.trim().slice(0, 8)}…` : quickEmail.trim();
    if (!usePid && !quickEmail.trim()) {
      setQuickResult("請輸入 email 或 payment_id");
      return;
    }
    if (!confirm(`一鍵退費 ${target}?(實際送綠界退款 + 降權 free)`)) return;
    setQuickBusy(true);
    setQuickResult("處理中…");
    try {
      const res = await fetch("/api/admin/refunds/quick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          usePid
            ? { payment_id: quickPaymentId.trim() }
            : { user_email: quickEmail.trim() },
        ),
      });
      const j = await res.json();
      if (!res.ok) {
        setQuickResult(`❌ ${j.error ?? `HTTP ${res.status}`} ${j.hint ? "\n" + j.hint : ""}`);
      } else {
        const r = j.ecpay_refund ?? {};
        const inv = j.invoice_result ?? {};
        const summary = `✓ ${r.ok ? "退款成功" : "退款失敗"} | Action=${r.action ?? "?"} | rtnCode=${r.rtnCode ?? "—"} | rtnMsg=${r.rtnMsg ?? "—"}`;
        const attemptsLine = Array.isArray(r.attempts)
          ? "\n嘗試: " + r.attempts.map((a: { action: string; ok: boolean; rtnCode?: string; rtnMsg?: string }) => `${a.action}=${a.ok ? "✓" : "✗"}(${a.rtnMsg ?? a.rtnCode ?? "?"})`).join(" → ")
          : "";
        const invoiceLine = inv.mode
          ? `\n📄 發票: ${inv.mode === "voided" ? "已作廢" : inv.mode === "allowanced" ? "已折讓" : "跳過"} ${inv.ok ? "✓" : "✗"} (${inv.ageHours?.toFixed(1)}h)${inv.allowanceNumber ? " 折讓號 " + inv.allowanceNumber : ""}${inv.rtnMsg ? " — " + inv.rtnMsg : ""}`
          : "";
        setQuickResult(summary + attemptsLine + invoiceLine);
        void load();
      }
    } catch (e) {
      setQuickResult(`❌ ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setQuickBusy(false);
    }
  }

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
      if (j.counts) setAllCounts(j.counts as Record<string, number>);
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

  const visibleRows = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase().trim();
    return rows.filter((r) => {
      const user = unwrapJoined(r.users);
      const payment = unwrapJoined(r.payments);
      return (
        user?.email?.toLowerCase().includes(q) ||
        payment?.ecpay_trade_no?.toLowerCase().includes(q) ||
        r.reason.toLowerCase().includes(q)
      );
    });
  }, [rows, search]);
  const counts = visibleRows.length;

  return (
    <main className="max-w-6xl mx-auto px-4 py-6">
      <header className="mb-4 flex items-baseline justify-between gap-3 flex-wrap">
        <div>
          <Link href="/admin" className="text-xs text-zinc-600 hover:underline">
            ← 後台儀表板
          </Link>
          <h1 className="text-2xl font-bold text-zinc-900 mt-1">退費審核</h1>
          <p className="text-xs text-zinc-700 mt-1">
            目前顯示 {counts} 筆{search.trim() && `(已篩選自 ${rows.length} 筆)`}
          </p>
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

      {/* 統計卡:四個 status 各幾筆,點擊切篩選 */}
      <div className="mb-3 grid grid-cols-4 gap-2">
        {(["pending", "approved", "rejected", "refunded"] as const).map((s) => {
          const active = statusFilter === s;
          const c = allCounts[s] ?? 0;
          const tone =
            s === "pending"
              ? "text-amber-700"
              : s === "approved"
              ? "text-emerald-700"
              : s === "rejected"
              ? "text-rose-700"
              : "text-sky-700";
          return (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`text-left rounded-lg border bg-white px-3 py-2 transition ${
                active
                  ? "border-zinc-900 ring-2 ring-zinc-900/10"
                  : "border-zinc-200 hover:border-zinc-400"
              }`}
            >
              <div className="text-[11px] text-zinc-500">{STATUS_LABEL[s]}</div>
              <div className={`text-xl font-bold tabular-nums ${tone}`}>{c}</div>
            </button>
          );
        })}
      </div>

      {/* 查使用者付款 → 建退費單（ATM/超商手動流程入口） */}
      <div className="mb-3 rounded-lg border-2 border-sky-400 bg-sky-50 p-3">
        <div className="text-[12px] font-semibold text-sky-900 mb-2">
          🔎 查使用者付款 → 建退費單（ATM / 超商 / 條碼 手動退費用，信用卡不會列出）
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="email"
            value={lookupEmail}
            onChange={(e) => setLookupEmail(e.target.value)}
            placeholder="使用者 email"
            className="flex-1 min-w-[220px] text-sm px-3 py-2 rounded border border-sky-300 bg-white"
            disabled={lookupBusy}
            onKeyDown={(e) => {
              if (e.key === "Enter") void runLookup();
            }}
          />
          <button
            type="button"
            onClick={runLookup}
            disabled={lookupBusy}
            className="text-sm px-4 py-2 rounded bg-sky-600 text-white font-medium hover:bg-sky-700 disabled:opacity-50"
          >
            {lookupBusy ? "查詢中…" : "查付款紀錄"}
          </button>
        </div>
        {lookupError && (
          <div className="mt-2 text-xs text-rose-700 bg-white border border-rose-200 rounded px-2 py-1">
            ⚠️ {lookupError}
          </div>
        )}
        {lookupResults && lookupResults.length === 0 && !lookupError && (
          <div className="mt-2 text-xs text-zinc-600">查無此 email 的付款紀錄</div>
        )}
        {lookupResults && lookupResults.length > 0 && (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-sky-100 text-sky-900">
                <tr>
                  <th className="px-2 py-1.5 text-left">日期</th>
                  <th className="px-2 py-1.5 text-left">付款方式</th>
                  <th className="px-2 py-1.5 text-right">金額</th>
                  <th className="px-2 py-1.5 text-left">狀態</th>
                  <th className="px-2 py-1.5 text-left">品項 / 訂單</th>
                  <th className="px-2 py-1.5 text-left">退費</th>
                </tr>
              </thead>
              <tbody>
                {lookupResults.map((r) => (
                  <tr key={r.payment_id} className="border-b border-sky-100 bg-white">
                    <td className="px-2 py-1.5 whitespace-nowrap">
                      {fmtDate(r.created_at)}
                    </td>
                    <td className="px-2 py-1.5 whitespace-nowrap">
                      <span
                        className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          r.method === "credit_card"
                            ? "bg-emerald-100 text-emerald-900"
                            : r.method === "atm"
                              ? "bg-amber-100 text-amber-900"
                              : "bg-zinc-100 text-zinc-700"
                        }`}
                      >
                        {r.method_label}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-right font-semibold">
                      NT$ {r.amount.toLocaleString()}
                    </td>
                    <td className="px-2 py-1.5">{r.status}</td>
                    <td className="px-2 py-1.5">
                      <div className="text-zinc-700">{r.item_name ?? "—"}</div>
                      {r.order_id && (
                        <div className="font-mono text-[10px] text-zinc-500">{r.order_id}</div>
                      )}
                    </td>
                    <td className="px-2 py-1.5">
                      {r.existing_refund ? (
                        <button
                          type="button"
                          onClick={() => openExistingRefund(r.existing_refund!.id)}
                          className="text-[11px] px-2 py-1 rounded bg-zinc-700 text-white hover:bg-zinc-800"
                          title={`處理此退費單（狀態：${r.existing_refund.status}）`}
                        >
                          處理此單（{r.existing_refund.status}）
                        </button>
                      ) : r.status === "success" ? (
                        <button
                          type="button"
                          onClick={() => createRefundForPayment(r)}
                          className="text-[11px] px-2 py-1 rounded bg-sky-700 text-white hover:bg-sky-800"
                        >
                          建退費單
                        </button>
                      ) : (
                        <span className="text-[10px] text-zinc-500">不可退</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 一鍵代開退費(測試 N→E→R fallback 用) */}
      <div className="mb-3 rounded-lg border border-amber-300 bg-amber-50 p-3">
        <div className="text-[11px] font-semibold text-amber-900 mb-2">
          🧪 一鍵代開退費(測試用) — 兩擇一:輸入 email 撈最新 success / 或直接貼 payment_id 鎖定特定筆
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="email"
            value={quickEmail}
            onChange={(e) => setQuickEmail(e.target.value)}
            placeholder="user email (auto pick latest success)"
            className="flex-1 min-w-[180px] text-xs px-3 py-1.5 rounded border border-amber-300 bg-white"
            disabled={quickBusy || quickPaymentId.trim().length > 0}
          />
          <span className="text-[11px] text-amber-700">或</span>
          <input
            type="text"
            value={quickPaymentId}
            onChange={(e) => setQuickPaymentId(e.target.value)}
            placeholder="payment_id (UUID, 鎖定特定筆)"
            className="flex-1 min-w-[200px] text-xs px-3 py-1.5 rounded border border-amber-300 bg-white font-mono"
            disabled={quickBusy}
          />
          <button
            type="button"
            onClick={runQuickRefund}
            disabled={quickBusy}
            className="text-xs px-3 py-1.5 rounded bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {quickBusy ? "處理中…" : "一鍵退費"}
          </button>
        </div>
        {quickResult && (
          <pre className="mt-2 text-[11px] font-mono whitespace-pre-wrap text-amber-950 bg-white border border-amber-200 rounded p-2">
            {quickResult}
          </pre>
        )}
      </div>

      <div className="mb-3 flex items-center gap-2 flex-wrap">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜尋 email / 交易編號 / 退費理由"
          className="flex-1 min-w-[200px] text-xs px-3 py-1.5 rounded border border-zinc-300 bg-white"
        />
        <button
          type="button"
          onClick={() => setStatusFilter("all")}
          className={`text-xs px-2.5 py-1 rounded border ${
            statusFilter === "all"
              ? "bg-zinc-900 text-white border-zinc-900"
              : "bg-white text-zinc-700 border-zinc-300 hover:bg-zinc-50"
          }`}
        >
          全部
        </button>
      </div>

      {error && (
        <div className="mb-3 p-3 rounded bg-rose-50 border border-rose-200 text-sm text-rose-800">
          載入失敗：{error}
        </div>
      )}

      <ul className="space-y-3">
        {visibleRows.map((r) => {
          const user = unwrapJoined(r.users);
          const payment = unwrapJoined(r.payments);
          return (
            <li
              key={r.id}
              className="bg-white rounded-lg border border-zinc-200 p-4 shadow-sm"
            >
              <div className="flex justify-between items-baseline gap-3 flex-wrap mb-2">
                <div>
                  <div className="font-mono text-sm">{user?.email ?? "(查無 email)"}</div>
                  <div className="text-xs text-zinc-500 mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5">
                    <span>申請於 {fmtDate(r.created_at)}</span>
                    <span>·</span>
                    <span>退費金額 NT$ {r.amount_requested.toLocaleString()}</span>
                    {payment?.amount && payment.amount !== r.amount_requested && (
                      <span className="text-zinc-400">(原付 NT$ {payment.amount.toLocaleString()})</span>
                    )}
                    {payment?.ecpay_trade_no && (
                      <>
                        <span>·</span>
                        <span className="font-mono text-[11px] text-zinc-600" title="綠界交易編號">
                          🔗 {payment.ecpay_trade_no}
                        </span>
                      </>
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
                  <strong>客服回覆:</strong>{r.admin_note}
                </p>
              )}
              {(r.status === "pending" || r.status === "approved") && (
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setReviewing(r)}
                    className="text-xs px-3 py-1 rounded bg-amber-600 text-white font-medium hover:bg-amber-700"
                  >
                    {r.status === "pending" ? "審核此申請" : "標記已退款完成"}
                  </button>
                </div>
              )}
            </li>
          );
        })}
        {visibleRows.length === 0 && !loading && (
          <li className="text-center text-sm text-zinc-500 py-8">
            {search.trim() ? "找不到符合的退費申請" : "目前沒有退費申請"}
          </li>
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

        {/* 此申請的背景資料,審核時一眼可見 */}
        {(() => {
          const user = unwrapJoined(row.users);
          const payment = unwrapJoined(row.payments);
          return (
            <div className="mb-4 p-3 rounded border border-zinc-200 bg-zinc-50 text-xs space-y-1">
              <div>
                <span className="text-zinc-500">帳號:</span>{" "}
                <span className="font-mono">{user?.email ?? "(查無)"}</span>
                {user?.plan && (
                  <span className="ml-2 text-zinc-500">方案 {user.plan}</span>
                )}
              </div>
              <div>
                <span className="text-zinc-500">申請於:</span>{" "}
                {fmtDate(row.created_at)} · <span className="text-zinc-500">金額</span>{" "}
                <strong>NT$ {row.amount_requested.toLocaleString()}</strong>
              </div>
              {payment && (
                <div>
                  <span className="text-zinc-500">原付款:</span>{" "}
                  {payment.amount != null && <>NT$ {payment.amount.toLocaleString()}</>}
                  {payment.ecpay_trade_no && (
                    <span className="ml-2 font-mono text-zinc-600">
                      🔗 {payment.ecpay_trade_no}
                    </span>
                  )}
                </div>
              )}
              <div className="pt-1 mt-1 border-t border-zinc-200">
                <div className="text-zinc-500 mb-0.5">退費理由:</div>
                <div className="whitespace-pre-wrap text-zinc-800">{row.reason}</div>
              </div>
            </div>
          );
        })()}

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
