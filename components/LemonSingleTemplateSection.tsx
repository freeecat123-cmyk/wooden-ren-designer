"use client";

/**
 * Lemon Squeezy 國際版單模板買斷區塊
 * 顯示 27 家具 + 2 裝潢工具 (ceiling/floor)，按 tier 分組顯示價格。
 *
 * 對應 zh-TW 的 TemplateUnlockSection — en 版接 /api/lemon-squeezy/checkout。
 */

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  getTemplateTier,
  TIER_PRICE_USD,
  type SellableTemplate,
  type TemplateTier,
} from "@/lib/lemon-squeezy/tier-map";

interface CatalogItem {
  /** 對應 FurnitureCategory 或 ToolId */
  id: string;
  /** 英文名 */
  nameEn: string;
  /** 'furniture' | 'tool' */
  kind: "furniture" | "tool";
  /** 家具難度（tool 沒有，給 'intermediate' 當預設） */
  difficulty: "beginner" | "intermediate" | "advanced";
}

interface Props {
  catalog: CatalogItem[];
  /** ?locked=stool 帶來，高亮這張卡 */
  lockedCategory?: string | null;
  isAuthed: boolean;
  loginHref: string;
}

const TIER_BADGE_COLOR: Record<TemplateTier, string> = {
  basic: "bg-emerald-100 text-emerald-800",
  pro: "bg-amber-100 text-amber-800",
  studio: "bg-rose-100 text-rose-800",
};

interface UnlockedRow {
  category?: string;
  tool?: string;
}

export function LemonSingleTemplateSection({
  catalog,
  lockedCategory,
  isAuthed,
  loginHref,
}: Props) {
  const t = useTranslations("lemon.singleTemplate");
  const tierLabel: Record<TemplateTier, string> = {
    basic: t("tierBasic"),
    pro: t("tierPro"),
    studio: t("tierStudio"),
  };
  const [unlocked, setUnlocked] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(isAuthed);
  const [filter, setFilter] = useState<"all" | TemplateTier>("all");

  useEffect(() => {
    if (!isAuthed) return;
    let cancelled = false;
    (async () => {
      try {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          if (!cancelled) setLoading(false);
          return;
        }
        const [tpl, tool] = await Promise.all([
          supabase.from("template_unlocks").select("category").eq("user_id", user.id),
          supabase.from("tool_unlocks").select("tool").eq("user_id", user.id),
        ]);
        if (cancelled) return;
        const set = new Set<string>();
        (tpl.data ?? []).forEach((r: UnlockedRow) => r.category && set.add(r.category));
        (tool.data ?? []).forEach((r: UnlockedRow) => r.tool && set.add(r.tool));
        setUnlocked(set);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthed]);

  const items = useMemo(() => {
    const enriched = catalog.map((c) => {
      const sellable: SellableTemplate =
        c.kind === "tool"
          ? { kind: "tool", tool: c.id as never }
          : { kind: "furniture", category: c.id as never };
      return { ...c, tier: getTemplateTier(sellable) };
    });
    return enriched.filter((c) => (filter === "all" ? true : c.tier === filter));
  }, [catalog, filter]);

  return (
    <section className="mt-16 max-w-5xl mx-auto" id="single-templates">
      <div className="text-center mb-8">
        <h2 className="font-serif text-2xl sm:text-3xl font-bold text-zinc-900">
          {t("heading")}
        </h2>
        <p className="mt-2 text-sm text-zinc-600">{t("intro")}</p>
        <div className="mt-3 inline-flex gap-2 text-xs flex-wrap justify-center">
          {(Object.keys(TIER_PRICE_USD) as TemplateTier[]).map((tier) => (
            <span
              key={tier}
              className="px-2.5 py-1 rounded-full bg-zinc-100 ring-1 ring-zinc-300 text-zinc-800"
            >
              {tierLabel[tier]} ${TIER_PRICE_USD[tier]}
            </span>
          ))}
        </div>
      </div>

      <div className="flex justify-center gap-2 mb-6 flex-wrap">
        {(["all", "basic", "pro", "studio"] as const).map((f) => (
          <button
            type="button"
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
              filter === f
                ? "bg-zinc-900 text-white shadow-md"
                : "bg-white text-zinc-700 ring-1 ring-stone-300 hover:ring-amber-400"
            }`}
          >
            {f === "all" ? t("filterAll") : tierLabel[f]}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-center text-sm text-zinc-500">{t("loading")}</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {items.map((item) => {
            const isUnlocked = unlocked.has(item.id);
            const isLockedHighlight = lockedCategory === item.id;
            const price = TIER_PRICE_USD[item.tier];
            return (
              <div
                key={item.id}
                className={`rounded-xl bg-white p-4 shadow-sm transition-all ${
                  isLockedHighlight
                    ? "ring-2 ring-amber-600 shadow-md"
                    : "ring-1 ring-stone-200 hover:ring-amber-400 hover:shadow"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-sm text-zinc-900">{item.nameEn}</h3>
                    <span
                      className={`mt-1 inline-block text-[10px] px-1.5 py-0.5 rounded-full font-bold ${TIER_BADGE_COLOR[item.tier]}`}
                    >
                      {tierLabel[item.tier]}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-base font-bold text-zinc-900">${price}</div>
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
                ) : isAuthed ? (
                  <form method="POST" action="/api/lemon-squeezy/checkout" className="mt-3">
                    <input type="hidden" name="type" value="single_template" />
                    <input type="hidden" name="template_id" value={item.id} />
                    <button
                      type="submit"
                      className="w-full px-3 py-2 rounded-lg bg-amber-800 text-white text-sm font-semibold hover:bg-amber-900"
                    >
                      {t("buy")}
                    </button>
                  </form>
                ) : (
                  <a
                    href={loginHref}
                    className="mt-3 block w-full text-center px-3 py-2 rounded-lg bg-zinc-900 text-white text-sm font-semibold hover:bg-zinc-800"
                  >
                    {t("signIn")}
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
