"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCurrency } from "@/hooks/useCurrency";
import { formatPrice } from "@/lib/units/fx";
import {
  TOOL_UNLOCK_PRICES,
  VALID_TOOL_IDS,
  type ToolId,
} from "@/lib/pricing/tool-unlock";
import { getPublicAdminEmails, isAdminEmail } from "@/lib/admin";

export function ToolUnlockSection() {
  const t = useTranslations("toolUnlock");
  const currency = useCurrency();
  const searchParams = useSearchParams();
  const notice = searchParams.get("tool_notice");
  const [unlocked, setUnlocked] = useState<Set<ToolId>>(new Set());
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

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
        if (!cancelled && isAdminEmail(user.email, getPublicAdminEmails())) {
          setIsAdmin(true);
        }
        const { data } = await supabase
          .from("tool_unlocks")
          .select("tool")
          .eq("user_id", user.id);
        if (cancelled) return;
        setUnlocked(new Set((data ?? []).map((r) => r.tool as ToolId)));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const toolLabel = (id: ToolId): string => {
    if (id === "ceiling") return t("ceilingLabel");
    if (id === "raised-floor") return t("raisedFloorLabel");
    return t("floorLabel");
  };
  const toolDesc = (id: ToolId): string => {
    if (id === "ceiling") return t("ceilingDesc");
    if (id === "raised-floor") return t("raisedFloorDesc");
    return t("floorDesc");
  };

  return (
    <section className="mt-12 max-w-3xl mx-auto">
      <div className="text-center mb-6">
        <h2 className="font-serif-tc text-2xl sm:text-3xl font-bold text-amber-950">
          {t("h")}
        </h2>
        <p className="mt-2 text-sm text-zinc-600">{t("intro")}</p>
        {notice === "admin" && (
          <p className="mt-3 inline-block px-4 py-2 rounded-lg bg-amber-100 text-amber-900 text-sm font-medium">
            {t("noticeAdmin")}
          </p>
        )}
        {notice === "owned" && (
          <p className="mt-3 inline-block px-4 py-2 rounded-lg bg-emerald-100 text-emerald-800 text-sm font-medium">
            {t("noticeOwned")}
          </p>
        )}
      </div>

      {loading ? (
        <p className="text-center text-sm text-zinc-500">{t("loading")}</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {VALID_TOOL_IDS.map((tool) => {
            const isUnlocked = unlocked.has(tool);
            return (
              <div
                key={tool}
                className="rounded-xl bg-white p-5 ring-1 ring-stone-200 hover:ring-amber-400 hover:shadow-md transition-all"
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <h3 className="font-semibold text-zinc-900">{toolLabel(tool)}</h3>
                  <div className="text-lg font-bold text-amber-900 shrink-0">
                    {formatPrice(TOOL_UNLOCK_PRICES[tool], currency)}
                  </div>
                </div>
                <p className="text-xs text-zinc-600 leading-relaxed mb-4">
                  {toolDesc(tool)}
                </p>
                {isAdmin ? (
                  <button
                    type="button"
                    disabled
                    className="w-full px-3 py-2 rounded-lg bg-amber-100 text-amber-900 text-sm font-semibold cursor-default"
                  >
                    {t("adminBtn")}
                  </button>
                ) : isUnlocked ? (
                  <button
                    type="button"
                    disabled
                    className="w-full px-3 py-2 rounded-lg bg-emerald-100 text-emerald-800 text-sm font-semibold cursor-default"
                  >
                    {t("owned")}
                  </button>
                ) : (
                  <form method="POST" action="/api/checkout/tool">
                    <input type="hidden" name="tool" value={tool} />
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
