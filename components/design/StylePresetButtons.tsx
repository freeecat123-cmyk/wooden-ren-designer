"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { OptionSpec, FurnitureCategory } from "@/lib/types";
import { STYLE_PRESETS, applyStylePreset } from "@/lib/knowledge/style-presets";

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
};

/**
 * 一鍵套用家具風格 preset。
 *
 * 機制：呼叫 lib/knowledge/style-presets.ts 的 applyStylePreset() 拿到
 * 一組 { material, legShape, legEdge, seatEdge, splayAngle, ... } URL params，
 * 過濾掉「目前模板沒這個 key」的欄位後寫進 URL，跟 EdgePresetButtons 同
 * 模式。表單會在 URL 變動時自動 re-render。
 *
 * 知識來源：lib/knowledge/style-presets.ts → wood-master/knowledge/
 * books_furniture_styles.md / books_chinese_classics.md /
 * books_chairmaking.md。
 */
export function StylePresetButtons({
  optionSchema,
  category,
}: {
  optionSchema: OptionSpec[];
  category?: FurnitureCategory;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const pathname = usePathname();
  const keys = new Set(optionSchema.map((s) => s.key));

  // 至少要有 legShape 或 material 才有意義顯示
  if (!keys.has("legShape") && !keys.has("material")) return null;

  // 篩出對當前家具類型適用的風格
  const presets = Object.values(STYLE_PRESETS).filter(
    (p) => !p.applicableTo || !category || p.applicableTo.includes(category),
  );

  const apply = (id: string) => {
    const params = applyStylePreset(id);
    if (!params) return;
    const next = new URLSearchParams(sp?.toString() ?? "");
    // 標記目前風格——讓 StyleMismatchWarning 等其他元件能讀到
    next.set("style", id);
    Object.entries(params).forEach(([k, v]) => {
      // 只寫當前模板有的 key（沒有的視為無關，跳過）
      if (keys.has(k) || k === "material") {
        next.set(k, String(v));
      }
    });
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };

  return (
    <div className="mb-4 p-3 rounded-lg bg-gradient-to-r from-violet-50 to-sky-50 ring-1 ring-violet-200">
      <div className="text-xs text-zinc-700 font-medium mb-2 flex items-center gap-1.5">
        <span>🎭</span>
        <span>風格快速套用</span>
        <span className="text-[10px] text-zinc-500 font-normal">
          （自動填腳形 / 邊緣 / 木種 / splay 角度）
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {presets.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => apply(p.id)}
            className="px-3 py-1.5 rounded-md bg-white text-zinc-800 text-xs ring-1 ring-zinc-300 hover:bg-violet-100 hover:ring-violet-400 transition"
            title={`${p.visualHint}\n\n來源：${p.source}`}
          >
            {STYLE_EMOJI[p.id] ?? "🪵"} {p.nameZh}
          </button>
        ))}
      </div>
    </div>
  );
}
