"use client";

import { useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { useUserPlan } from "@/hooks/useUserPlan";
import { createClient } from "@/lib/supabase/client";
import { getTemplate } from "@/lib/templates";
import type { FurnitureCategory } from "@/lib/types";

interface DesignRow {
  id: string;
  furniture_type: string;
  name: string | null;
  params: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function buildEditHref(row: DesignRow): string {
  const slug = row.furniture_type.replace(/_/g, "-");
  const p = row.params ?? {};
  const qs = new URLSearchParams();
  const pick = (k: string) => {
    const v = (p as Record<string, unknown>)[k];
    if (v === undefined || v === null) return;
    qs.set(k, String(v));
  };
  pick("length");
  pick("width");
  pick("height");
  pick("material");
  pick("joineryMode");
  const q = qs.toString();
  return `/design/${slug}${q ? `?${q}` : ""}`;
}

export function MyDesignsClient() {
  const t = useTranslations("myDesignsPage");
  const tFurn = useTranslations("furniture");
  const { isLoading: planLoading, isLoggedIn, userId } = useUserPlan();
  const [rows, setRows] = useState<DesignRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);

  const categoryLabel = (type: string): string => {
    const normalized = type.replace(/_/g, "-") as FurnitureCategory;
    try {
      return tFurn(normalized);
    } catch {
      return getTemplate(normalized)?.nameZh ?? type;
    }
  };

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
          .from("designs")
          .select("id, furniture_type, name, params, created_at, updated_at")
          .eq("user_id", userId)
          .order("updated_at", { ascending: false });
        if (error) throw error;
        if (!cancelled) setRows((data ?? []) as DesignRow[]);
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

  const handleRename = async (row: DesignRow) => {
    const current = row.name ?? "";
    const next = window.prompt(t("promptRename"), current);
    if (next === null) return;
    const trimmed = next.trim();
    if (!trimmed || trimmed === current) return;
    setRenamingId(row.id);
    try {
      const res = await fetch(`/api/designs/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.error ?? t("alertRenameFail"));
      setRows((prev) =>
        prev ? prev.map((r) => (r.id === row.id ? { ...r, name: trimmed } : r)) : prev,
      );
    } catch (e) {
      window.alert(t("alertRenameFailTpl", { msg: e instanceof Error ? e.message : String(e) }));
    } finally {
      setRenamingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(t("confirmDelete"))) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/designs/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.error ?? t("alertDeleteFail"));
      setRows((prev) => (prev ? prev.filter((r) => r.id !== id) : prev));
    } catch (e) {
      window.alert(t("alertDeleteFailTpl", { msg: e instanceof Error ? e.message : String(e) }));
    } finally {
      setDeletingId(null);
    }
  };

  if (planLoading || loading) {
    return (
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-12 text-sm text-zinc-500">
        {t("loading")}
      </main>
    );
  }

  if (!isLoggedIn) {
    return (
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <h1 className="text-2xl font-bold text-zinc-900 mb-4">{t("h1")}</h1>
        <p className="text-zinc-600 text-sm">{t("loginRequired")}</p>
      </main>
    );
  }

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <Link href="/" className="text-sm text-zinc-500 hover:underline">
        {t("backHome")}
      </Link>
      <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 mt-3 mb-2">
        {t("h1")}
      </h1>
      <p className="text-sm text-zinc-500 mb-6">
        {t("countTpl", { n: rows?.length ?? 0 })}
      </p>

      {err && (
        <div className="rounded-lg border-2 border-red-200 bg-red-50 text-red-700 text-sm p-4 mb-6">
          {t("loadFailTpl", { msg: err })}
        </div>
      )}

      {rows && rows.length === 0 && (
        <div className="rounded-2xl border-2 border-dashed border-zinc-200 bg-white p-8 text-center">
          <p className="text-zinc-600 text-sm mb-4">{t("emptyBody")}</p>
          <Link
            href="/"
            className="inline-block px-4 py-2 rounded-lg bg-[#8b4513] text-white text-sm font-medium hover:bg-[#6f370f]"
          >
            {t("goCatalog")}
          </Link>
        </div>
      )}

      {rows && rows.length > 0 && (
        <ul className="space-y-3">
          {rows.map((row) => {
            const p = row.params ?? {};
            const length = (p as Record<string, unknown>).length;
            const width = (p as Record<string, unknown>).width;
            const height = (p as Record<string, unknown>).height;
            const material = (p as Record<string, unknown>).material;
            return (
              <li
                key={row.id}
                className="rounded-2xl border-2 border-zinc-200 bg-white p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <h2 className="font-semibold text-zinc-900 truncate">
                      {row.name?.trim() || categoryLabel(row.furniture_type)}
                    </h2>
                    <span className="text-xs text-zinc-500">
                      {categoryLabel(row.furniture_type)}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 mt-1">
                    {[length, width, height].every((v) => typeof v === "number")
                      ? `${length}×${width}×${height} mm`
                      : t("noDim")}
                    {material ? ` · ${String(material)}` : ""}
                    <span className="ml-2">{t("updatedTpl", { date: formatDate(row.updated_at) })}</span>
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Link
                    href={buildEditHref(row)}
                    className="px-3 py-1.5 rounded-lg bg-[#8b4513] text-white text-xs font-medium hover:bg-[#6f370f]"
                  >
                    {t("editBtn")}
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleRename(row)}
                    disabled={renamingId === row.id}
                    className="px-3 py-1.5 rounded-lg border border-zinc-300 text-zinc-600 text-xs hover:bg-zinc-50 disabled:opacity-50"
                  >
                    {renamingId === row.id ? t("renaming") : t("renameBtn")}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(row.id)}
                    disabled={deletingId === row.id}
                    className="px-3 py-1.5 rounded-lg border border-zinc-300 text-zinc-600 text-xs hover:bg-zinc-50 disabled:opacity-50"
                  >
                    {deletingId === row.id ? t("deleting") : t("deleteBtn")}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
