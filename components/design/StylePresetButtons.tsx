"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import type { OptionSpec, FurnitureCategory } from "@/lib/types";
import { STYLE_PRESETS, applyStylePreset, getAllStyleManagedKeys } from "@/lib/knowledge/style-presets";
import { getGenericVariantKeys } from "@/lib/knowledge/style-variants";

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
  designSize,
  compact = false,
}: {
  optionSchema: OptionSpec[];
  category?: FurnitureCategory;
  /** 當前家具尺寸，給 adapter 用來公式化調整（legSize 隨 size scale 等） */
  designSize?: { length: number; width: number; height: number };
  /** compact=true：手機橫滑模式，去掉說明文字與 adapter notes */
  compact?: boolean;
}) {
  const t = useTranslations("stylePreset");
  const router = useRouter();
  const sp = useSearchParams();
  const pathname = usePathname();
  const keys = new Set(optionSchema.map((s) => s.key));
  const [adapterNotes, setAdapterNotes] = useState<string[]>([]);

  // 至少要有 legShape 或 material 才有意義顯示
  if (!keys.has("legShape") && !keys.has("material")) return null;

  // 篩出對當前家具類型適用的風格
  const presets = Object.values(STYLE_PRESETS).filter(
    (p) => !p.applicableTo || !category || p.applicableTo.includes(category),
  );

  // 變體計數：URL ?style=midCentury&styleVariant=2 = 第 3 次按 midCentury
  const currentStyle = sp?.get("style") ?? "";
  const currentVariant = parseInt(sp?.get("styleVariant") ?? "0", 10) || 0;

  const apply = (id: string) => {
    // 重複按同一風格 → 變體 +1（無上限，hash 抽樣）；切換風格 → 重置為 0（base）
    const variantSeed = id === currentStyle ? currentVariant + 1 : 0;
    // 傳 category + ctx：取得包含 per-category detail pack + 公式化適應的完整參數
    const ctx = designSize
      ? {
          totalLength: designSize.length,
          totalWidth: designSize.width,
          totalHeight: designSize.height,
          material: sp?.get("material") ?? undefined,
        }
      : undefined;
    const params = applyStylePreset(id, category, ctx, variantSeed, optionSchema);
    if (!params) return;
    const next = new URLSearchParams(sp?.toString() ?? "");

    // 清掉所有風格可能管到的 key——避免舊風格設過、新風格沒覆寫的 key 殘留。
    // 含通用變體可寫入的 key：上次變體抽過、這次沒抽到的 key 要回模板預設。
    const managedKeys = getAllStyleManagedKeys(category);
    managedKeys.forEach((k) => next.delete(k));
    getGenericVariantKeys(optionSchema).forEach((k) => next.delete(k));

    next.set("style", id);
    if (variantSeed > 0) next.set("styleVariant", String(variantSeed));
    else next.delete("styleVariant");
    // _adapterNotes 不寫進 URL，但收集起來顯示給使用者
    const notes = typeof params._adapterNotes === "string"
      ? params._adapterNotes.split(" | ")
      : [];
    setAdapterNotes(notes);
    Object.entries(params).forEach(([k, v]) => {
      if (k.startsWith("_")) return; // skip meta
      // length/width/height 是 top-level 欄位（不在 optionSchema），但變體會動，
      // 必須允許寫入 URL 才能讓表單寬高欄位跟著更新
      if (keys.has(k) || k === "material" || k === "length" || k === "width" || k === "height") {
        next.set(k, String(v));
      }
    });
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
            const variantLabel = isActive && currentVariant > 0 ? ` #${currentVariant}` : "";
            // 截短：去掉括號裡英文翻譯
            const shortName = p.nameZh.replace(/\s*[（(].*?[)）]\s*/g, "").trim();
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => apply(p.id)}
                className={`shrink-0 min-h-[40px] px-3 py-1.5 rounded-full text-xs ring-1 transition whitespace-nowrap ${
                  isActive
                    ? "bg-violet-100 text-violet-900 ring-violet-400 font-medium"
                    : "bg-white text-zinc-800 ring-zinc-300"
                }`}
                title={p.visualHint}
              >
                {STYLE_EMOJI[p.id] ?? "🪵"} {shortName}{variantLabel}
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
          const variantLabel = isActive && currentVariant > 0 ? ` #${currentVariant}` : "";
          const shortName = p.nameZh.replace(/\s*[（(].*?[)）]\s*/g, "").trim();
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => apply(p.id)}
              className={`max-md:min-h-[40px] px-2.5 py-1 rounded-md text-xs ring-1 transition ${
                isActive
                  ? "bg-violet-100 text-violet-900 ring-violet-400 font-medium"
                  : "bg-white text-zinc-800 ring-zinc-300 hover:bg-violet-50 hover:ring-violet-400"
              }`}
              title={`${p.visualHint}${isActive ? t("reapplyHintTpl", { n: currentVariant + 1 }) : ""}`}
            >
              {STYLE_EMOJI[p.id] ?? "🪵"} {shortName}{variantLabel}
            </button>
          );
        })}
      </div>
      {adapterNotes.length > 0 && (
        <ul className="mt-1.5 text-[11px] text-zinc-500 leading-tight space-y-0.5">
          {adapterNotes.map((n, i) => (
            <li key={i}>· {n}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
