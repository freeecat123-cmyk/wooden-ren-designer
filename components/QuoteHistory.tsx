"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

interface QuoteHistoryEntry {
  /** ISO timestamp */
  savedAt: string;
  /** 客戶名 */
  customerName: string;
  /** 家具中文名 */
  furnitureName: string;
  /** 家具 URL 路徑（pathname，不含 ?） */
  pathname: string;
  /** URL query 字串（不含 ?） */
  query: string;
  /** 含稅總計，用於列表顯示 */
  total: number;
  /** 報價單號 */
  quoteNo: string;
}

const KEY = "wooden-ren-designer:quoteHistory:v1";
const MAX = 20;

function load(): QuoteHistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.slice(0, MAX) : [];
  } catch {
    return [];
  }
}

function save(list: QuoteHistoryEntry[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
}

function formatTWD(n: number): string {
  return new Intl.NumberFormat("zh-TW", {
    style: "currency",
    currency: "TWD",
    maximumFractionDigits: 0,
  }).format(Math.round(n));
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toISOString().slice(0, 16).replace("T", " ");
  } catch {
    return iso;
  }
}

/** 依 query 中的 expiryDays（預設 14）與 savedAt 判斷是否已過期 */
function isExpired(savedAt: string, query: string): boolean {
  try {
    const params = new URLSearchParams(query);
    const days = parseInt(params.get("expiryDays") ?? "14", 10) || 14;
    const saved = new Date(savedAt).getTime();
    const expireAt = saved + days * 86400000;
    return Date.now() > expireAt;
  } catch {
    return false;
  }
}

interface Props {
  /** 當前報價資料——若客戶名非空，自動寫入歷史 */
  current: {
    customerName: string;
    furnitureName: string;
    query: string;
    total: number;
    quoteNo: string;
  };
}

/**
 * 顯示「最近報價」下拉；同時 mount 時把 `current` 寫入 localStorage（僅在 customerName 非空）。
 * 存儲 key: `wooden-ren-designer:quoteHistory:v1`
 */
export function QuoteHistory({ current }: Props) {
  const [entries, setEntries] = useState<QuoteHistoryEntry[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const pathname = usePathname() ?? "";

  useEffect(() => {
    const existing = load();
    setEntries(existing);
    setHydrated(true);

    if (!current.customerName.trim()) return;

    // 同客戶+家具+總價視為重複，不重複寫入（以 query string 比對避免小差異都 dedupe）
    const entry: QuoteHistoryEntry = {
      savedAt: new Date().toISOString(),
      customerName: current.customerName,
      furnitureName: current.furnitureName,
      pathname,
      query: current.query,
      total: current.total,
      quoteNo: current.quoteNo,
    };
    const dedup = existing.filter(
      (e) => !(e.quoteNo === entry.quoteNo && e.customerName === entry.customerName),
    );
    dedup.unshift(entry);
    save(dedup);
    setEntries(dedup);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clearHistory = () => {
    save([]);
    setEntries([]);
  };

  if (!hydrated) return null;
  if (entries.length === 0) return null;

  return (
    <details className="mb-4 rounded-lg border border-zinc-200 bg-white">
      <summary className="cursor-pointer list-none px-4 py-2.5 text-sm flex items-center justify-between hover:bg-zinc-50">
        <span className="font-medium text-zinc-800">
          📁 最近報價（{entries.length}）
        </span>
        <span className="text-xs text-zinc-400">點擊展開</span>
      </summary>
      <ul className="divide-y divide-zinc-100 border-t border-zinc-100">
        {entries.map((e, i) => {
          const expired = isExpired(e.savedAt, e.query);
          return (
            <li key={i}>
              <Link
                href={`${e.pathname}?${e.query}`}
                className={`flex items-baseline gap-3 px-4 py-2.5 text-xs transition-colors ${
                  expired
                    ? "text-zinc-400 hover:bg-zinc-50"
                    : "hover:bg-emerald-50"
                }`}
              >
                <span
                  className={`font-mono whitespace-nowrap ${expired ? "text-zinc-300" : "text-zinc-400"}`}
                >
                  {formatDate(e.savedAt)}
                </span>
                <span
                  className={`font-medium flex-shrink-0 ${expired ? "text-zinc-400 line-through" : "text-zinc-800"}`}
                >
                  {e.customerName}
                </span>
                <span className={expired ? "text-zinc-300" : "text-zinc-500"}>
                  · {e.furnitureName}
                </span>
                {expired && (
                  <span className="px-1.5 py-0.5 text-[9px] font-medium rounded bg-zinc-200 text-zinc-500">
                    已過期
                  </span>
                )}
                <span
                  className={`ml-auto font-mono font-semibold ${expired ? "text-zinc-400" : "text-zinc-900"}`}
                >
                  {formatTWD(e.total)}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="px-4 py-2 border-t border-zinc-100 text-right">
        <button
          type="button"
          onClick={clearHistory}
          className="text-[11px] text-zinc-400 hover:text-red-600 hover:underline"
        >
          清除所有歷史
        </button>
      </div>
    </details>
  );
}
