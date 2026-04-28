"use client";

import Link from "next/link";
import { QuoteAccessGate } from "@/components/QuoteAccessGate";
import { formatTWD } from "@/lib/pricing/catalog";
import type { CustomerSummary } from "@/app/customers/page";

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function CustomersClient({
  initial,
  loggedIn,
}: {
  initial: CustomerSummary[];
  loggedIn: boolean;
}) {
  if (!loggedIn) {
    return (
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <h1 className="text-2xl font-bold text-zinc-900 mb-4">客戶名單</h1>
        <p className="text-zinc-600 text-sm">
          請先登入才能查看客戶名單（右上角點「使用 Google 登入」）。
        </p>
      </main>
    );
  }

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <Link href="/" className="text-sm text-zinc-500 hover:underline">
        ← 回家具列表
      </Link>
      <QuoteAccessGate>
        <div className="mt-3 mb-2 flex items-baseline justify-between gap-3 flex-wrap">
          <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900">
            客戶名單
          </h1>
          <Link
            href="/projects"
            className="text-sm text-amber-700 hover:underline"
          >
            → 看所有專案
          </Link>
        </div>
        <p className="text-sm text-zinc-500 mb-6">
          自動從你的專案聚合：同一個客戶的多件案子、累計金額、最近往來時間都在這裡。
        </p>

        {initial.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-zinc-200 bg-white p-8 text-center">
            <p className="text-zinc-600 text-sm mb-2">
              還沒有任何客戶資料。
            </p>
            <p className="text-zinc-500 text-xs">
              在專案頁填上「客戶名稱」，這裡就會自動聚合該客戶的所有案件。
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {initial.map((c) => (
              <li
                key={c.name}
                className="rounded-2xl border-2 border-zinc-200 bg-white hover:border-zinc-300 transition"
              >
                <Link
                  href={`/projects/${c.latestProjectId}`}
                  className="block p-4 sm:p-5"
                >
                  <div className="flex items-baseline justify-between gap-2 flex-wrap mb-1.5">
                    <h2 className="font-semibold text-zinc-900 text-lg">
                      {c.name}
                    </h2>
                    <span className="shrink-0 text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-medium">
                      {c.projectCount} 件案
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs text-zinc-600">
                    {c.contact && (
                      <div>
                        <span className="text-zinc-400">聯絡：</span>
                        {c.contact}
                      </div>
                    )}
                    {c.address && (
                      <div className="sm:col-span-2 truncate">
                        <span className="text-zinc-400">案場：</span>
                        {c.address}
                      </div>
                    )}
                  </div>
                  <div className="mt-3 pt-3 border-t border-zinc-100 flex items-baseline justify-between gap-2 flex-wrap">
                    <p className="text-[11px] text-zinc-400">
                      最近往來 {formatDate(c.lastUpdated)}
                    </p>
                    {c.totalRevenue > 0 && (
                      <p className="text-sm font-mono text-zinc-700">
                        累計 <strong>{formatTWD(c.totalRevenue)}</strong>
                      </p>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </QuoteAccessGate>
    </main>
  );
}
