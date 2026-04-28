"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useUserPlan } from "@/hooks/useUserPlan";
import { createClient } from "@/lib/supabase/client";
import {
  PROJECT_STATUS_LABEL,
  type ProjectRow,
  type ProjectStatus,
} from "@/lib/projects/types";

const STATUS_BADGE: Record<ProjectStatus, string> = {
  draft: "bg-zinc-100 text-zinc-700",
  sent: "bg-blue-100 text-blue-800",
  confirmed: "bg-emerald-100 text-emerald-800",
  in_production: "bg-amber-100 text-amber-800",
  delivered: "bg-zinc-200 text-zinc-700",
  cancelled: "bg-red-100 text-red-700",
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function ProjectsClient() {
  const { isLoading: planLoading, isLoggedIn, userId } = useUserPlan();
  const [rows, setRows] = useState<ProjectRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (planLoading) return;
    if (!isLoggedIn || !userId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("projects")
          .select("*")
          .eq("user_id", userId)
          .order("updated_at", { ascending: false });
        if (error) throw error;
        if (!cancelled) setRows((data ?? []) as ProjectRow[]);
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [planLoading, isLoggedIn, userId]);

  const handleCreate = async () => {
    if (!userId) return;
    const name = window.prompt("專案名稱（例：林宅全屋、王公館客廳）");
    if (!name?.trim()) return;
    setCreating(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("projects")
        .insert({ user_id: userId, name: name.trim() })
        .select()
        .single();
      if (error) throw error;
      setRows((prev) => (prev ? [data as ProjectRow, ...prev] : [data as ProjectRow]));
    } catch (e) {
      window.alert(`建立失敗：${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setCreating(false);
    }
  };

  if (planLoading || loading) {
    return (
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-12 text-sm text-zinc-500">
        載入中…
      </main>
    );
  }

  if (!isLoggedIn) {
    return (
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <h1 className="text-2xl font-bold text-zinc-900 mb-4">我的專案</h1>
        <p className="text-zinc-600 text-sm">
          請先登入才能管理專案（右上角點「使用 Google 登入」）。
        </p>
      </main>
    );
  }

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <Link href="/" className="text-sm text-zinc-500 hover:underline">
        ← 回家具列表
      </Link>
      <div className="mt-3 mb-2 flex items-baseline justify-between gap-3 flex-wrap">
        <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900">我的專案</h1>
        <button
          type="button"
          onClick={handleCreate}
          disabled={creating}
          className="px-4 py-2 rounded-lg bg-[#8b4513] text-white text-sm font-medium hover:bg-[#6f370f] disabled:opacity-50"
        >
          {creating ? "建立中…" : "+ 新增專案"}
        </button>
      </div>
      <p className="text-sm text-zinc-500 mb-6">
        把多件家具打包成一個案子（含客戶資料、案場、設計概念、整套報價）。
      </p>

      {err && (
        <div className="rounded-lg border-2 border-red-200 bg-red-50 text-red-700 text-sm p-4 mb-6">
          載入失敗：{err}
        </div>
      )}

      {rows && rows.length === 0 && (
        <div className="rounded-2xl border-2 border-dashed border-zinc-200 bg-white p-8 text-center">
          <p className="text-zinc-600 text-sm mb-4">
            還沒有任何專案。建一個新專案，就可以把多件家具打包成一份提案給客戶。
          </p>
          <button
            type="button"
            onClick={handleCreate}
            disabled={creating}
            className="inline-block px-4 py-2 rounded-lg bg-[#8b4513] text-white text-sm font-medium hover:bg-[#6f370f] disabled:opacity-50"
          >
            建立第一個專案
          </button>
        </div>
      )}

      {rows && rows.length > 0 && (
        <ul className="space-y-3">
          {rows.map((row) => (
            <li
              key={row.id}
              className="rounded-2xl border-2 border-zinc-200 bg-white hover:border-zinc-300 transition"
            >
              <Link
                href={`/projects/${row.id}`}
                className="block p-4 sm:p-5"
              >
                <div className="flex items-baseline justify-between gap-2 flex-wrap">
                  <div className="min-w-0">
                    <h2 className="font-semibold text-zinc-900 text-lg truncate">
                      {row.name}
                    </h2>
                    {row.customer_name && (
                      <p className="text-xs text-zinc-500 mt-0.5">
                        客戶：{row.customer_name}
                        {row.project_address ? ` · ${row.project_address}` : ""}
                      </p>
                    )}
                  </div>
                  <span
                    className={`shrink-0 text-[11px] px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[row.status]}`}
                  >
                    {PROJECT_STATUS_LABEL[row.status]}
                  </span>
                </div>
                {row.design_concept && (
                  <p className="text-xs text-zinc-600 mt-2 italic line-clamp-2">
                    {row.design_concept}
                  </p>
                )}
                <p className="text-[10px] text-zinc-400 mt-2">
                  更新於 {formatDate(row.updated_at)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
