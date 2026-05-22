"use client";

import { useEffect, useState } from "react";
import {
  TOOL_UNLOCK_PRICES,
  TOOL_LABEL_ZH,
  TOOL_DESC_ZH,
  VALID_TOOL_IDS,
  type ToolId,
} from "@/lib/pricing/tool-unlock";

/**
 * /pricing 頁面用的「裝潢工具單次買斷」section
 * 列天花板 / 地板兩個工具,各 NT$599 一次性買斷,永久使用。
 */
export function ToolUnlockSection() {
  const [unlocked, setUnlocked] = useState<Set<ToolId>>(new Set());
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

  return (
    <section className="mt-12 max-w-3xl mx-auto">
      <div className="text-center mb-6">
        <h2 className="font-serif-tc text-2xl sm:text-3xl font-bold text-amber-950">
          🔨 裝潢工具買斷
        </h2>
        <p className="mt-2 text-sm text-zinc-600">
          不想訂月費,單買工具永久使用。屋主自己 DIY 一次裝潢就回本。
        </p>
      </div>

      {loading ? (
        <p className="text-center text-sm text-zinc-500">載入中…</p>
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
                  <h3 className="font-semibold text-zinc-900">
                    {TOOL_LABEL_ZH[tool]}
                  </h3>
                  <div className="text-lg font-bold text-amber-900 shrink-0">
                    NT${TOOL_UNLOCK_PRICES[tool]}
                  </div>
                </div>
                <p className="text-xs text-zinc-600 leading-relaxed mb-4">
                  {TOOL_DESC_ZH[tool]}
                </p>
                {isUnlocked ? (
                  <button
                    type="button"
                    disabled
                    className="w-full px-3 py-2 rounded-lg bg-emerald-100 text-emerald-800 text-sm font-semibold cursor-default"
                  >
                    ✓ 已擁有
                  </button>
                ) : (
                  <form method="POST" action="/api/checkout/tool">
                    <input type="hidden" name="tool" value={tool} />
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
