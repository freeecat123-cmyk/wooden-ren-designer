"use client";
import { announceDesignNavigation } from "@/lib/design/navigation-pending";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useLocale } from "next-intl";
import type { OptionSpec, FurnitureCategory } from "@/lib/types";
import { STYLE_PRESETS } from "@/lib/knowledge/style-presets";
import { quickStyleQuery } from "@/lib/knowledge/quick-style";

/** 風格圖示 → emoji 對照（沒對到的用🪵） */
const STYLE_EMOJI: Record<string, string> = {
  shaker: "⛪",
  midCentury: "🇩🇰",
  mission: "⚒️",
  ming: "🏯",
  windsor: "🐎",
  industrial: "🏭",
  japanese: "🎋",
  chippendale: "👑",
  scandi: "❄️",
  farmhouse: "🌾",
  wabiSabi: "🍃",
  bauhaus: "◼️",
};

/**
 * 一鍵套用家具風格 preset。
 *
 * Only supported appearance choices are changed. Dimensions, material and
 * structural configuration remain owned by the design form.
 *
 * 知識來源：lib/knowledge/style-presets.ts → wood-master/knowledge/
 * books_furniture_styles.md / books_chinese_classics.md /
 * books_chairmaking.md。
 */
export function StylePresetButtons({
  optionSchema,
  category,
  compact = false,
}: {
  optionSchema: OptionSpec[];
  category?: FurnitureCategory;
  /** Retained for existing callers; quick styling no longer adjusts dimensions. */
  designSize?: { length: number; width: number; height: number };
  /** compact=true：手機橫滑模式，去掉說明文字與 adapter notes */
  compact?: boolean;
}) {
  const locale = useLocale();
  const isEn = locale === "en";
  const presetLabel = (p: typeof STYLE_PRESETS[string]) => {
    if (isEn) {
      return p.labelEn ?? p.nameEn ?? p.nameZh;
    }
    return p.nameZh.replace(/\s*[（(].*?[)）]\s*/g, "").trim();
  };
  const router = useRouter();
  const sp = useSearchParams();
  const pathname = usePathname();
  const current = new URLSearchParams(sp?.toString() ?? "");
  const presets = Object.values(STYLE_PRESETS).filter(
    (p) => quickStyleQuery(current, p.id, category, optionSchema) !== null,
  );
  if (presets.length === 0) return null;

  // Reapplying a style is stable; legacy variant counters are removed on apply.
  const currentStyle = sp?.get("style") ?? "";

  const apply = (id: string) => {
    const next = quickStyleQuery(current, id, category, optionSchema);
    if (!next || next.toString() === current.toString()) return;
    announceDesignNavigation(`${pathname}?${next.toString()}`);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    // 強制 RSC 重新 fetch——預設 replace 在純 client 路徑可能 cache stale
    // server props，導致表單不重新拿 optionValues（看起來像「按了沒反應」）
    router.refresh();
  };

  if (compact) {
    return (
      <div className="relative">
        <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-1">
          {presets.map((p) => {
            const isActive = currentStyle === p.id;
            const shortName = presetLabel(p);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => apply(p.id)}
                aria-pressed={isActive}
                className={`shrink-0 min-h-[40px] px-3 py-1.5 rounded-full text-xs ring-1 transition whitespace-nowrap ${
                  isActive
                    ? "bg-violet-100 text-violet-900 ring-violet-400 font-medium"
                    : "bg-white text-zinc-800 ring-zinc-300"
                }`}
                title={presetLabel(p)}
              >
                {STYLE_EMOJI[p.id] ?? "🪵"} {shortName}
              </button>
            );
          })}
        </div>
        {/* 右側 fade mask 提示橫滑 */}
        <div className="pointer-events-none absolute top-0 right-0 bottom-0 w-6 bg-gradient-to-l from-white to-transparent" />
      </div>
    );
  }

  return (
    <div className="mb-3">
      <div className="flex flex-wrap gap-1.5">
        {presets.map((p) => {
          const isActive = currentStyle === p.id;
          const shortName = presetLabel(p);
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => apply(p.id)}
              aria-pressed={isActive}
              className={`max-md:min-h-[40px] px-2.5 py-1 rounded-md text-xs ring-1 transition ${
                isActive
                  ? "bg-violet-100 text-violet-900 ring-violet-400 font-medium"
                  : "bg-white text-zinc-800 ring-zinc-300 hover:bg-violet-50 hover:ring-violet-400"
              }`}
              title={presetLabel(p)}
            >
              {STYLE_EMOJI[p.id] ?? "🪵"} {shortName}
            </button>
          );
        })}
      </div>
    </div>
  );
}
