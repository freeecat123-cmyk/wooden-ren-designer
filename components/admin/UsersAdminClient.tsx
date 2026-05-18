"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

interface UserRow {
  id: string;
  email: string;
  plan: string;
  subscription_status: string | null;
  subscription_expires_at?: string | null;
  student_activated_at: string | null;
  student_expires_at: string | null;
  created_at: string;
}

const PLAN_LABEL: Record<string, string> = {
  free: "免費版",
  student: "學員版",
  personal: "個人版",
  pro: "專業版",
};

const PLAN_COLOR: Record<string, string> = {
  free: "bg-zinc-100 text-zinc-700 border-zinc-300",
  student: "bg-amber-100 text-amber-900 border-amber-300",
  personal: "bg-sky-100 text-sky-900 border-sky-300",
  pro: "bg-purple-100 text-purple-900 border-purple-300",
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toISOString().slice(0, 10);
}

async function safeJson(res: Response): Promise<{ data?: unknown; error?: string }> {
  const text = await res.text();
  if (!text) {
    throw new Error(`HTTP ${res.status}：伺服器沒有回傳內容（可能是登入過期或 timeout）`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`HTTP ${res.status}：回傳格式錯誤（${text.slice(0, 100)}）`);
  }
}

export function UsersAdminClient() {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState<string>("all");
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/users", { cache: "no-store" });
      const json = await safeJson(res);
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "load failed");
      setRows(Array.isArray(json.data) ? (json.data as UserRow[]) : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (planFilter !== "all" && r.plan !== planFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!r.email.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [rows, search, planFilter]);

  const planCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rows) map.set(r.plan, (map.get(r.plan) ?? 0) + 1);
    return map;
  }, [rows]);

  return (
    <main className="max-w-6xl mx-auto px-4 py-6">
      <header className="mb-4 flex items-baseline justify-between gap-3 flex-wrap">
        <div>
          <Link href="/admin" className="text-xs text-zinc-600 hover:underline">
            ← 後台儀表板
          </Link>
          <h1 className="text-2xl font-bold text-zinc-900 mt-1">用戶清單</h1>
          <p className="text-xs text-zinc-700 mt-1">
            註冊 {rows.length} 人 · 依時間倒序（新→舊）
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

      {error && (
        <div className="mb-3 p-3 rounded bg-rose-50 border border-rose-200 text-sm text-rose-800">
          載入失敗：{error}
        </div>
      )}

      <div className="mb-3 flex items-center gap-3 flex-wrap">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜尋 email…"
          className="border border-zinc-300 rounded px-3 py-1.5 text-sm flex-1 min-w-[200px]"
        />
        <div className="flex items-center gap-1">
          {(["all", "free", "student", "personal", "pro"] as const).map((p) => {
            const active = planFilter === p;
            const count = p === "all" ? rows.length : (planCounts.get(p) ?? 0);
            return (
              <button
                key={p}
                type="button"
                onClick={() => setPlanFilter(p)}
                className={`text-xs px-2.5 py-1 rounded border ${
                  active
                    ? "bg-zinc-900 text-white border-zinc-900"
                    : "bg-white text-zinc-700 border-zinc-300 hover:bg-zinc-50"
                }`}
              >
                {p === "all" ? "全部" : PLAN_LABEL[p] ?? p}（{count}）
              </button>
            );
          })}
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-xs text-zinc-700">
            <tr>
              <th className="text-left px-3 py-2">Email</th>
              <th className="text-left px-3 py-2 w-24">方案</th>
              <th className="text-left px-3 py-2 w-28">訂閱狀態</th>
              <th className="text-left px-3 py-2 w-28">註冊日期</th>
              <th className="text-left px-3 py-2 w-28">學員啟用</th>
              <th className="text-left px-3 py-2 w-28">學員到期</th>
              <th className="text-left px-3 py-2 w-20">動作</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-t border-zinc-100 hover:bg-zinc-50">
                <td className="px-3 py-2 font-mono text-xs">{r.email}</td>
                <td className="px-3 py-2">
                  <span
                    className={`inline-block px-2 py-0.5 text-[10px] rounded border font-medium ${
                      PLAN_COLOR[r.plan] ?? "bg-zinc-100 text-zinc-700 border-zinc-300"
                    }`}
                  >
                    {PLAN_LABEL[r.plan] ?? r.plan}
                  </span>
                </td>
                <td className="px-3 py-2 text-xs text-zinc-700">
                  {r.subscription_status ?? "—"}
                </td>
                <td className="px-3 py-2 text-xs font-mono">{fmtDate(r.created_at)}</td>
                <td className="px-3 py-2 text-xs font-mono">
                  {fmtDate(r.student_activated_at)}
                </td>
                <td className="px-3 py-2 text-xs font-mono">
                  {fmtDate(r.student_expires_at)}
                </td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() => setEditingUser(r)}
                    className="text-xs px-2 py-0.5 rounded border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
                  >
                    編輯
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && !loading && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-zinc-500 text-sm">
                  {rows.length === 0 ? "尚無註冊用戶" : "沒有符合條件的用戶"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editingUser && (
        <EditPlanModal
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onSaved={() => {
            setEditingUser(null);
            void load();
          }}
        />
      )}
    </main>
  );
}

function EditPlanModal({
  user,
  onClose,
  onSaved,
}: {
  user: UserRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [plan, setPlan] = useState(user.plan);
  const [status, setStatus] = useState(user.subscription_status ?? "active");
  const [expires, setExpires] = useState<string>(
    user.subscription_expires_at
      ? new Date(user.subscription_expires_at).toISOString().slice(0, 10)
      : "",
  );
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    setErr(null);
    try {
      const body: Record<string, string | null> = { plan, reason };
      // free / lifetime 自動清 expires_at（後端也會處理、前端統一顯示）
      if (plan === "free" || plan === "lifetime") {
        body.subscription_expires_at = null;
        body.subscription_status = plan === "lifetime" ? "active" : "inactive";
      } else {
        body.subscription_status = status;
        body.subscription_expires_at = expires
          ? new Date(expires + "T23:59:59+08:00").toISOString()
          : null;
      }
      const res = await fetch(`/api/admin/users/${user.id}/plan`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(typeof j.error === "string" ? j.error : `HTTP ${res.status}`);
      }
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  function setQuickExpires(days: number) {
    const d = new Date(Date.now() + days * 86_400_000);
    setExpires(d.toISOString().slice(0, 10));
  }

  const noExpires = plan === "free" || plan === "lifetime";

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg w-full max-w-md p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-semibold text-zinc-900 text-lg mb-3">
          編輯方案
        </h3>
        <p className="text-xs text-zinc-500 mb-3 font-mono break-all">{user.email}</p>

        <label className="block text-xs text-zinc-600 mb-1">方案</label>
        <select
          value={plan}
          onChange={(e) => setPlan(e.target.value)}
          className="w-full border border-zinc-300 rounded px-2 py-1.5 text-sm mb-3"
        >
          <option value="free">免費版</option>
          <option value="personal">個人版</option>
          <option value="pro">專業版</option>
          <option value="lifetime">終身版</option>
          <option value="student">學員版</option>
        </select>

        {!noExpires && (
          <>
            <label className="block text-xs text-zinc-600 mb-1">訂閱狀態</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full border border-zinc-300 rounded px-2 py-1.5 text-sm mb-3"
            >
              <option value="active">active</option>
              <option value="cancelled">cancelled</option>
              <option value="expired">expired</option>
              <option value="inactive">inactive</option>
            </select>

            <label className="block text-xs text-zinc-600 mb-1">到期日</label>
            <input
              type="date"
              value={expires}
              onChange={(e) => setExpires(e.target.value)}
              className="w-full border border-zinc-300 rounded px-2 py-1.5 text-sm mb-2"
            />
            <div className="flex gap-1 mb-3 flex-wrap">
              {[
                { label: "+30 天", days: 30 },
                { label: "+90 天", days: 90 },
                { label: "+1 年", days: 365 },
                { label: "+2 年", days: 730 },
              ].map((opt) => (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => setQuickExpires(opt.days)}
                  className="text-xs px-2 py-0.5 rounded border border-zinc-300 bg-white hover:bg-zinc-50"
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </>
        )}

        <label className="block text-xs text-zinc-600 mb-1">
          原因（可選、僅 log）
        </label>
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="例：手動退款、白名單朋友、學員年費續訂"
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
            className="text-sm px-3 py-1.5 rounded border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
            disabled={saving}
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="text-sm px-3 py-1.5 rounded bg-amber-500 text-white font-medium hover:bg-amber-600 disabled:opacity-50"
          >
            {saving ? "儲存中…" : "儲存"}
          </button>
        </div>
      </div>
    </div>
  );
}
