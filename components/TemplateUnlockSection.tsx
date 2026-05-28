"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useCurrency } from "@/hooks/useCurrency";
import { formatPrice } from "@/lib/units/fx";
import {
  TEMPLATE_UNLOCK_PRICES,
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

export function TemplateUnlockSection({
  catalog,
  lockedCategory,
}: {
  catalog: CatalogItem[];
  lockedCategory?: string | null;
}) {
  const t = useTranslations("templateUnlock");
  const tDiff = useTranslations("difficulty");
  const tFurn = useTranslations("furniture");
  const currency = useCurrency();
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

  const templateName = (c: CatalogItem): string => {
    try {
      return tFurn(c.category);
    } catch {
      return c.nameZh;
    }
  };

  return (
    <section className="mt-16 max-w-5xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="font-serif-tc text-2xl sm:text-3xl font-bold text-amber-950">
          {t("h")}
        </h2>
        <p className="mt-2 text-sm text-zinc-600">{t("intro")}</p>
        <div className="mt-3 inline-flex gap-2 text-xs flex-wrap justify-center">
          {(Object.keys(TEMPLATE_UNLOCK_PRICES) as Difficulty[]).map((d) => (
            <span key={d} className="px-2.5 py-1 rounded-full bg-amber-50 ring-1 ring-amber-300 text-amber-900">
              {t("priceChipTpl", { label: tDiff(d), price: formatPrice(TEMPLATE_UNLOCK_PRICES[d], currency) })}
            </span>
          ))}
        </div>
      </div>

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
            {f === "all" ? t("filterAll") : tDiff(f)}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-center text-sm text-zinc-500">{t("loading")}</p>
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
                    <h3 className="font-semibold text-sm text-zinc-900">{templateName(item)}</h3>
                    <span className={`mt-1 inline-block text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                      item.difficulty === "beginner"
                        ? "bg-emerald-100 text-emerald-800"
                        : item.difficulty === "intermediate"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-rose-100 text-rose-800"
                    }`}>
                      {tDiff(item.difficulty)}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-base font-bold text-amber-900">{formatPrice(price, currency)}</div>
                  </div>
                </div>
                {isUnlocked ? (
                  <button
                    type="button"
                    disabled
                    className="mt-3 w-full px-3 py-2 rounded-lg bg-emerald-100 text-emerald-800 text-sm font-semibold cursor-default"
                  >
                    {t("owned")}
                  </button>
                ) : (
                  <form method="POST" action="/api/checkout/template" className="mt-3">
                    <input type="hidden" name="category" value={item.category} />
                    <button
                      type="submit"
                      className="w-full px-3 py-2 rounded-lg bg-amber-800 text-white text-sm font-semibold hover:bg-amber-900"
                    >
                      {t("buyBtn")}
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
