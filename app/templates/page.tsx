import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { FURNITURE_CATALOG, type FurnitureCatalogEntry } from "@/lib/templates";
import { FREE_UNLOCKED_CATEGORIES } from "@/lib/permissions";
import {
  FEATURED_TEMPLATE_CATEGORIES,
  getTemplateMarketing,
} from "@/lib/templates/marketing";
import type { FurnitureCategory } from "@/lib/types";

/**
 * /templates — 模板介紹索引頁
 *
 * 跟 /app（產品內部目錄）不同：
 *   /app   = 已登入用戶的家具貨架，點卡片直接進設計器
 *   /templates = SEO 入口、給訪客「先看介紹再決定要不要試」
 *
 * 主力 10 模板有獨立介紹頁（在 FEATURED_TEMPLATE_CATEGORIES 裡），
 * 其他模板只列名稱 + 「開始設計」按鈕（避免假介紹頁稀釋 SEO 信號）。
 */

export const metadata: Metadata = {
  title: "26 件家具範本 完整介紹｜木頭仁 木作藍圖",
  description:
    "從方凳、筆筒、邊桌到衣櫃、書桌、餐椅——26 件可參數化的家具範本完整介紹。每張家具都告訴你：能做什麼、適合誰、需要哪些工具、有什麼變化。",
  alternates: { canonical: "/templates" },
};

const CATEGORY_GROUPS: Array<{
  id: string;
  label: string;
  emoji: string;
  match: (c: FurnitureCategory) => boolean;
}> = [
  {
    id: "seating",
    label: "椅凳",
    emoji: "🪑",
    match: (c) =>
      c === "stool" || c === "bench" || c === "dining-chair" ||
      c === "bar-stool" || c === "round-stool",
  },
  {
    id: "table",
    label: "桌",
    emoji: "🪵",
    match: (c) =>
      c === "tea-table" || c === "side-table" || c === "low-table" ||
      c === "dining-table" || c === "desk" ||
      c === "round-tea-table" || c === "round-table",
  },
  {
    id: "cabinet",
    label: "櫃",
    emoji: "🗄️",
    match: (c) =>
      c === "open-bookshelf" || c === "chest-of-drawers" ||
      c === "shoe-cabinet" || c === "display-cabinet" ||
      c === "wardrobe" || c === "media-console" || c === "nightstand",
  },
  {
    id: "small",
    label: "小物",
    emoji: "🧰",
    match: (c) =>
      c === "pencil-holder" || c === "photo-frame" ||
      c === "tray" || c === "dovetail-box" || c === "wine-rack",
  },
  {
    id: "large",
    label: "大件",
    emoji: "🛏️",
    match: (c) =>
      c === "bed" || c === "coat-rack" || c === "chinese-cabinet",
  },
];

const DEV_SET = new Set<FurnitureCategory>([
  "chinese-cabinet", "bed", "coat-rack",
]);

export default function TemplatesIndex() {
  const featuredSet = new Set<string>(FEATURED_TEMPLATE_CATEGORIES);

  return (
    <main className="bg-[#fafaf7]">
      {/* ============ Header ============ */}
      <section className="bg-gradient-to-br from-amber-50 via-white to-stone-100 border-b border-stone-200">
        <div className="max-w-6xl mx-auto px-5 sm:px-6 py-14 sm:py-20 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white ring-1 ring-amber-300 text-amber-800 text-xs font-semibold mb-5 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            模板完整介紹 · 含適用情境 + FAQ
          </div>
          <h1 className="font-serif-tc text-4xl sm:text-5xl font-bold tracking-tight text-zinc-900">
            26 件家具範本
          </h1>
          <p className="mt-5 text-zinc-700 max-w-2xl mx-auto leading-relaxed text-lg">
            每張家具背後都有它的工法、適用場景、變化方式。
            <br />
            先看介紹搞懂，再決定要不要動手做。
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link
              href="/app"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-amber-700 text-white font-semibold shadow-md hover:bg-amber-800 transition-colors"
            >
              直接看貨架 →
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white text-zinc-800 font-semibold ring-1 ring-stone-300 hover:ring-amber-500 hover:text-amber-800 transition-colors"
            >
              查看方案
            </Link>
          </div>
        </div>
      </section>

      {/* ============ 快速跳轉 chip bar ============ */}
      <div className="sticky top-0 z-30 bg-[#fafaf7]/95 backdrop-blur-sm border-b border-stone-200 shadow-sm">
        <nav className="max-w-6xl mx-auto px-5 sm:px-6 py-3 overflow-x-auto scrollbar-thin">
          <div className="inline-flex gap-2 min-w-max">
            {CATEGORY_GROUPS.map((g) => {
              const count = FURNITURE_CATALOG.filter((e) => g.match(e.category)).length;
              if (count === 0) return null;
              return (
                <a
                  key={g.id}
                  href={`#${g.id}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white text-sm font-medium text-zinc-700 ring-1 ring-stone-300 hover:ring-amber-500 hover:text-amber-800 hover:-translate-y-0.5 transition-all"
                >
                  <span aria-hidden>{g.emoji}</span>
                  <span>{g.label}</span>
                  <span className="text-xs text-zinc-400 tabular-nums">
                    {count}
                  </span>
                </a>
              );
            })}
          </div>
        </nav>
      </div>

      {/* ============ Groups ============ */}
      <section className="max-w-6xl mx-auto px-5 sm:px-6 py-12 sm:py-16 space-y-14">
        {CATEGORY_GROUPS.map((g) => {
          const items = FURNITURE_CATALOG.filter((e) => g.match(e.category));
          if (items.length === 0) return null;
          return (
            <div
              key={g.id}
              id={g.id}
              className="scroll-mt-20"
            >
              <h2 className="font-serif-tc text-2xl sm:text-3xl font-bold text-zinc-900 mb-1 flex items-center gap-2">
                <span aria-hidden>{g.emoji}</span>
                {g.label}
              </h2>
              <p className="text-zinc-500 text-sm mb-6">
                {items.length} 件範本
              </p>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map((item) => (
                  <TemplateCard
                    key={item.category}
                    item={item}
                    hasDetail={featuredSet.has(item.category)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </section>

      {/* ============ Bottom CTA ============ */}
      <section className="bg-gradient-to-br from-amber-700 to-amber-900 text-white">
        <div className="max-w-4xl mx-auto px-5 sm:px-6 py-14 sm:py-20 text-center">
          <h2 className="font-serif-tc text-3xl sm:text-4xl font-bold leading-tight">
            選一張開始
          </h2>
          <p className="mt-4 text-amber-100 max-w-xl mx-auto leading-relaxed">
            方凳和筆筒永遠免費。其他模板可訂閱解鎖，或先看介紹再決定。
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link
              href="/app"
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full bg-white text-amber-800 font-bold shadow-lg hover:-translate-y-0.5 hover:bg-amber-50 transition-all"
            >
              開始設計 →
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full bg-white/10 text-white font-semibold ring-1 ring-white/30 hover:bg-white/20 transition-all"
            >
              查看方案
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

function TemplateCard({
  item,
  hasDetail,
}: {
  item: FurnitureCatalogEntry;
  hasDetail: boolean;
}) {
  const isFree = FREE_UNLOCKED_CATEGORIES.includes(item.category);
  const isDev = DEV_SET.has(item.category);
  const marketing = getTemplateMarketing(item.category);
  const tagline = marketing?.tagline;

  return (
    <div className="group relative rounded-2xl bg-white ring-1 ring-stone-200 overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all">
      <div className="absolute top-2.5 right-2.5 z-10 flex gap-1.5">
        {isFree && (
          <span className="px-1.5 py-0.5 rounded-full bg-emerald-100 ring-1 ring-emerald-300 text-emerald-800 text-[10px] font-bold shadow-sm">
            免費
          </span>
        )}
        {isDev && (
          <span className="px-1.5 py-0.5 rounded-full bg-zinc-900/90 text-white text-[10px] font-bold shadow-sm">
            🚧 開發中
          </span>
        )}
      </div>
      <div className="aspect-square flex items-center justify-center bg-gradient-to-br from-white to-stone-50">
        <Image
          src={`/thumbs/v2/${item.category}.webp`}
          alt={`${item.nameZh} 3D 預覽`}
          width={240}
          height={180}
          quality={75}
          loading="lazy"
          sizes="(min-width:1024px) 320px, (min-width:640px) 50vw, 100vw"
          className="transition-transform group-hover:scale-[1.06]"
          style={{ objectFit: "contain", maxHeight: "84%", maxWidth: "84%" }}
        />
      </div>
      <div className="p-4 border-t border-amber-100 bg-amber-50">
        <h3 className="font-bold text-lg text-zinc-900 mb-1">{item.nameZh}</h3>
        {tagline ? (
          <p className="text-xs text-zinc-600 leading-snug mb-3 min-h-[2.5em] line-clamp-2">
            {tagline}
          </p>
        ) : (
          <p className="text-xs text-zinc-400 leading-snug mb-3 min-h-[2.5em]">
            {isDev ? "敬請期待" : item.description ?? ""}
          </p>
        )}
        <div className="flex gap-2">
          {hasDetail ? (
            <Link
              href={`/templates/${item.category}`}
              className="flex-1 text-center px-3 py-2 rounded-full bg-white text-amber-800 font-semibold text-sm ring-1 ring-amber-300 hover:bg-amber-100 transition-colors"
            >
              了解更多
            </Link>
          ) : null}
          {!isDev ? (
            <Link
              href={`/design/${item.category}`}
              className="flex-1 text-center px-3 py-2 rounded-full bg-amber-700 text-white font-semibold text-sm shadow-sm hover:bg-amber-800 transition-colors"
            >
              開始設計
            </Link>
          ) : (
            <span className="flex-1 text-center px-3 py-2 rounded-full bg-stone-200 text-stone-500 font-semibold text-sm cursor-not-allowed">
              敬請期待
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
