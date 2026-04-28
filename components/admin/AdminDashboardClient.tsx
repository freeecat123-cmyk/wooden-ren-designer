"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

interface Stats {
  totalUsers: number;
  totalDesigns: number;
  totalWhitelist: number;
  plansBreakdown: Array<{ plan: string; count: number }>;
  students: { active: number; expired: number; expiringSoon: number };
  churnedCount: number;
  mrrEstimate: number;
  last30Pay: { count: number; revenue: number };
  trend7: Array<{ date: string; count: number }>;
  trend30: Array<{ date: string; count: number }>;
  generatedAt: string;
}

const PLAN_LABEL: Record<string, string> = {
  free: "免費版",
  personal: "個人版",
  pro: "專業版",
  student: "學員版",
  lifetime: "終身版",
};

const PLAN_COLOR: Record<string, string> = {
  free: "bg-zinc-200",
  personal: "bg-emerald-400",
  pro: "bg-amber-400",
  student: "bg-blue-400",
  lifetime: "bg-purple-400",
};

export function AdminDashboardClient() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/stats", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "load failed");
      setStats(json as Stats);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <header className="mb-6 flex items-end justify-between flex-wrap gap-3">
        <div>
          <Link href="/" className="text-sm text-zinc-500 hover:underline">
            ← 回首頁
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold mt-2 text-zinc-900">
            後台儀表板
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            註冊 / 訂閱 / 流失 / 學員到期狀況一覽
            {stats?.generatedAt && (
              <span className="ml-2 text-xs">
                · 更新於 {stats.generatedAt.slice(11, 19)}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/users"
            className="px-3 py-1.5 rounded bg-sky-700 text-white text-sm hover:bg-sky-800"
          >
            👤 用戶清單
          </Link>
          <Link
            href="/admin/whitelist"
            className="px-3 py-1.5 rounded bg-emerald-700 text-white text-sm hover:bg-emerald-800"
          >
            👥 白名單管理
          </Link>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="px-3 py-1.5 rounded border border-zinc-300 text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
          >
            🔄 重新載入
          </button>
        </div>
      </header>

      {error && (
        <div className="mb-4 px-4 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          載入失敗：{error}
        </div>
      )}

      {!stats && loading && (
        <div className="text-center text-sm text-zinc-500 py-12">載入中…</div>
      )}

      {stats && (
        <>
          {/* === 數字卡 === */}
          <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
            <StatCard label="總註冊用戶" value={stats.totalUsers} hint="users 表全部" />
            <StatCard
              label="付費 MRR 估算"
              value={`NT$ ${stats.mrrEstimate.toLocaleString()}`}
              hint="個人 290 + 專業 890"
              accent
            />
            <StatCard
              label="過去 30 天付款收入"
              value={`NT$ ${stats.last30Pay.revenue.toLocaleString()}`}
              hint={`${stats.last30Pay.count} 筆`}
            />
            <StatCard
              label="流失（cancel/expired）"
              value={stats.churnedCount}
              hint="非學員"
            />
            <StatCard
              label="學員 active"
              value={stats.students.active}
              hint={`其中 ${stats.students.expiringSoon} 位即將到期`}
            />
            <StatCard
              label="學員已過期"
              value={stats.students.expired}
              hint="降為 free"
            />
            <StatCard label="儲存的設計" value={stats.totalDesigns} hint="designs 表" />
            <StatCard label="白名單總筆數" value={stats.totalWhitelist} hint="whitelist 表" />
          </section>

          {/* === 方案分布 === */}
          <section className="mb-6 rounded-lg border border-zinc-200 bg-white p-5">
            <h2 className="font-semibold text-zinc-900 mb-3">方案分布</h2>
            <PlanDistribution plans={stats.plansBreakdown} total={stats.totalUsers} />
          </section>

          {/* === 註冊趨勢 === */}
          <section className="grid md:grid-cols-2 gap-4 mb-6">
            <TrendChart title="過去 7 天每日新註冊" data={stats.trend7} />
            <TrendChart title="過去 30 天每日新註冊" data={stats.trend30} />
          </section>
        </>
      )}
    </main>
  );
}

function StatCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: number | string;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-4 ${
        accent ? "bg-amber-50 border-amber-300" : "bg-white border-zinc-200"
      }`}
    >
      <div className="text-xs text-zinc-500 mb-1">{label}</div>
      <div
        className={`text-xl sm:text-2xl font-bold ${
          accent ? "text-amber-900" : "text-zinc-900"
        }`}
      >
        {value}
      </div>
      {hint && <div className="text-[11px] text-zinc-400 mt-1">{hint}</div>}
    </div>
  );
}

function PlanDistribution({
  plans,
  total,
}: {
  plans: Array<{ plan: string; count: number }>;
  total: number;
}) {
  if (total === 0) return <p className="text-sm text-zinc-500">還沒有使用者</p>;
  return (
    <div className="space-y-2">
      <div className="flex h-3 rounded overflow-hidden bg-zinc-100">
        {plans.map((p) => {
          const w = (p.count / total) * 100;
          return (
            <div
              key={p.plan}
              title={`${PLAN_LABEL[p.plan] ?? p.plan} ${p.count} 人 (${w.toFixed(1)}%)`}
              className={PLAN_COLOR[p.plan] ?? "bg-zinc-400"}
              style={{ width: `${w}%` }}
            />
          );
        })}
      </div>
      <ul className="grid sm:grid-cols-2 gap-x-4 gap-y-1 text-sm">
        {plans.map((p) => (
          <li key={p.plan} className="flex items-center gap-2">
            <span
              className={`inline-block w-3 h-3 rounded ${
                PLAN_COLOR[p.plan] ?? "bg-zinc-400"
              }`}
            />
            <span className="text-zinc-700">{PLAN_LABEL[p.plan] ?? p.plan}</span>
            <span className="text-zinc-500 ml-auto font-mono text-xs">
              {p.count} 人 · {((p.count / total) * 100).toFixed(1)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TrendChart({
  title,
  data,
}: {
  title: string;
  data: Array<{ date: string; count: number }>;
}) {
  const max = useMemo(
    () => Math.max(1, ...data.map((d) => d.count)),
    [data],
  );
  const total = data.reduce((s, d) => s + d.count, 0);

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="font-semibold text-zinc-900 text-sm">{title}</h3>
        <span className="text-xs text-zinc-500">合計 {total} 人</span>
      </div>
      <div className="flex items-end gap-[2px] h-24">
        {data.map((d) => {
          const h = (d.count / max) * 100;
          return (
            <div
              key={d.date}
              title={`${d.date}: ${d.count} 人`}
              className="flex-1 bg-emerald-300 hover:bg-emerald-500 transition-colors rounded-sm"
              style={{ height: `${Math.max(2, h)}%` }}
            />
          );
        })}
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-zinc-400 font-mono">
        <span>{data[0]?.date.slice(5)}</span>
        <span>{data[data.length - 1]?.date.slice(5)}</span>
      </div>
    </div>
  );
}
