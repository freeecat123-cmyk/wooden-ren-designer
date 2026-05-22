"use client";

import { useEffect, useMemo, useState } from "react";
import {
  TEMPLATE_UNLOCK_PRICES,
  DIFFICULTY_LABEL_ZH,
  type Difficulty,
} from "@/lib/pricing/template-unlock";

interface CatalogItem {
  category: string;
  nameZh: string;
  difficulty: Difficulty;
}

interface UnlockedRow {
  category: string;
}

/**
 * /pricing 頁面用的「單範本買斷」section
 * 列出三階範本 + 各自買斷價,點 → POST /api/checkout/template
 * 已解鎖的範本標「已擁有」、不能再買
 */
export function TemplateUnlockSection({
  catalog,
  lockedCategory,
}: {
  catalog: CatalogItem[];
  lockedCategory?: string | null;
}) {
  const [unlocked, setUnlocked] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | Difficulty>(
    lockedCategory ? "all" : "all",
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          if (!cancelled) setLoading(false);
          return;
        }
        const { data } = await supabase
          .from("template_unlocks")
          .select("category")
          .eq("user_id", user.id);
        if (cancelled) return;
        setUnlocked(new Set((data ?? []).map((r: UnlockedRow) => r.category)));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const items = useMemo(() => {
    return catalog.filter((c) => (filter === "all" ? true : c.difficulty === filter));
  }, [catalog, filter]);

  return (
    <section className="mt-16 max-w-5xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="font-serif-tc text-2xl sm:text-3xl font-bold text-amber-950">
          🪵 單範本永久買斷
        </h2>
        <p className="mt-2 text-sm text-zinc-600">
          只想做某張椅子? 一次買斷,永久擁有那張藍圖。不訂閱也能用。
        </p>
        <div className="mt-3 inline-flex gap-2 text-xs flex-wrap justify-center">
          {(Object.keys(TEMPLATE_UNLOCK_PRICES) as Difficulty[]).map((d) => (
            <span key={d} className="px-2.5 py-1 rounded-full bg-amber-50 ring-1 ring-amber-300 text-amber-900">
              {DIFFICULTY_LABEL_ZH[d]} NT$ {TEMPLATE_UNLOCK_PRICES[d]}
            </span>
          ))}
        </div>
      </div>

      {/* difficulty filter */}
      <div className="flex justify-center gap-2 mb-6 flex-wrap">
        {(["all", "beginner", "intermediate", "advanced"] as const).map((f) => (
          <button
            type="button"
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
              filter === f
                ? "bg-amber-700 text-white shadow-md"
                : "bg-white text-zinc-700 ring-1 ring-stone-300 hover:ring-amber-400"
            }`}
          >
            {f === "all" ? "全部" : DIFFICULTY_LABEL_ZH[f]}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-center text-sm text-zinc-500">載入中…</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {items.map((item) => {
            const isUnlocked = unlocked.has(item.category);
            const isLockedHighlight = lockedCategory === item.category;
            const price = TEMPLATE_UNLOCK_PRICES[item.difficulty];
            return (
              <div
                key={item.category}
                className={`rounded-xl bg-white p-4 shadow-sm transition-all ${
                  isLockedHighlight
                    ? "ring-2 ring-amber-600 shadow-md"
                    : "ring-1 ring-stone-200 hover:ring-amber-400 hover:shadow"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-sm text-zinc-900">{item.nameZh}</h3>
                    <span className={`mt-1 inline-block text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                      item.difficulty === "beginner"
                        ? "bg-emerald-100 text-emerald-800"
                        : item.difficulty === "intermediate"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-rose-100 text-rose-800"
                    }`}>
                      {DIFFICULTY_LABEL_ZH[item.difficulty]}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-base font-bold text-amber-900">NT${price}</div>
                  </div>
                </div>
                {isUnlocked ? (
                  <button
                    type="button"
                    disabled
                    className="mt-3 w-full px-3 py-2 rounded-lg bg-emerald-100 text-emerald-800 text-sm font-semibold cursor-default"
                  >
                    ✓ 已擁有
                  </button>
                ) : (
                  <form method="POST" action="/api/checkout/template" className="mt-3">
                    <input type="hidden" name="category" value={item.category} />
                    <button
                      type="submit"
                      className="w-full px-3 py-2 rounded-lg bg-amber-800 text-white text-sm font-semibold hover:bg-amber-900"
                    >
                      買斷 →
                    </button>
                  </form>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
