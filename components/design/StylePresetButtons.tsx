"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { OptionSpec, FurnitureCategory } from "@/lib/types";
import { STYLE_PRESETS, applyStylePreset, getAllStyleManagedKeys } from "@/lib/knowledge/style-presets";

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
  designSize,
}: {
  optionSchema: OptionSpec[];
  category?: FurnitureCategory;
  /** 當前家具尺寸，給 adapter 用來公式化調整（legSize 隨 size scale 等） */
  designSize?: { length: number; width: number; height: number };
}) {
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

  const apply = (id: string) => {
    // 傳 category + ctx：取得包含 per-category detail pack + 公式化適應的完整參數
    const ctx = designSize
      ? {
          totalLength: designSize.length,
          totalWidth: designSize.width,
          totalHeight: designSize.height,
          material: sp?.get("material") ?? undefined,
        }
      : undefined;
    const params = applyStylePreset(id, category, ctx);
    if (!params) return;
    const next = new URLSearchParams(sp?.toString() ?? "");

    // 清掉所有風格可能管到的 key——避免舊風格設過、新風格沒覆寫的 key 殘留
    const managedKeys = getAllStyleManagedKeys(category);
    managedKeys.forEach((k) => next.delete(k));

    next.set("style", id);
    // _adapterNotes 不寫進 URL，但收集起來顯示給使用者
    const notes = typeof params._adapterNotes === "string"
      ? params._adapterNotes.split(" | ")
      : [];
    setAdapterNotes(notes);
    Object.entries(params).forEach(([k, v]) => {
      if (k.startsWith("_")) return; // skip meta
      if (keys.has(k) || k === "material") {
        next.set(k, String(v));
      }
    });
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    // 強制 RSC 重新 fetch——預設 replace 在純 client 路徑可能 cache stale
    // server props，導致表單不重新拿 optionValues（看起來像「按了沒反應」）
    router.refresh();
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
      {adapterNotes.length > 0 && (
        <div className="mt-2 px-2 py-1.5 rounded bg-white/60 ring-1 ring-violet-200">
          <div className="text-[10px] text-violet-700 font-medium mb-0.5">
            🔧 依當前尺寸 / 材質微調：
          </div>
          <ul className="text-[10px] text-zinc-600 space-y-0.5 list-disc list-inside">
            {adapterNotes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
