"use client";

import Link from "next/link";
import { useUserPlan } from "@/hooks/useUserPlan";
import { getTemplate } from "@/lib/templates";
import { isPaidCategory } from "@/lib/permissions";
import type { FurnitureCategory } from "@/lib/types";

interface Suggestion {
  text: string;
  suggestedCategory: FurnitureCategory;
  presetParams: Record<string, string>;
}

/**
 * 模板切換建議卡片（尺寸超過本模板合理範圍時顯示）。
 *
 * 為什麼是 client component：建議連結要依使用者方案決定路徑——
 *   付費 → 直接 /design/<目標模板>?{params}（沿用當前尺寸/木材）
 *   免費 → /pricing?locked=<目標模板>（變成升級入口）
 *
 * 設計目的：catalog 邊界清楚 + 警告變 conversion gate（免費用戶想做大件
 * 才能轉付費）+ 付費 UX 不被擋（一鍵切到對的模板）。
 */
export function SuggestionsBox({ suggestions }: { suggestions: Suggestion[] }) {
  const { plan, isLoading } = useUserPlan();
  if (isLoading || suggestions.length === 0) return null;

  const isPaid = plan !== "free";

  return (
    <div className="mb-4 rounded-xl border-2 border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50 px-5 py-4 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="text-2xl leading-none mt-0.5">💡</span>
        <div className="flex-1 space-y-3">
          <div className="text-sm font-semibold text-amber-900">
            您要做的尺寸建議改用其他模板
          </div>
          {suggestions.map((s, i) => {
            const target = getTemplate(s.suggestedCategory);
            const targetLabel = target?.nameZh ?? s.suggestedCategory;
            const targetIsPaid = isPaidCategory(s.suggestedCategory);
            const showUpgradeFlow = !isPaid && targetIsPaid;
            const url = showUpgradeFlow
              ? `/pricing?locked=${s.suggestedCategory}`
              : `/design/${s.suggestedCategory}?${new URLSearchParams(s.presetParams).toString()}`;
            return (
              <div
                key={i}
                className="rounded-lg bg-white/70 ring-1 ring-amber-200 p-3"
              >
                <p className="text-xs text-amber-900 leading-relaxed mb-2">
                  {s.text}
                </p>
                <Link
                  href={url}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    showUpgradeFlow
                      ? "bg-amber-600 text-white hover:bg-amber-700"
                      : "bg-emerald-600 text-white hover:bg-emerald-700"
                  }`}
                >
                  {showUpgradeFlow ? (
                    <>🔓 升級看「{targetLabel}」模板</>
                  ) : (
                    <>→ 切換到「{targetLabel}」模板（沿用當前尺寸）</>
                  )}
                </Link>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
