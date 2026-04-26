import Link from "next/link";
import { FURNITURE_CATALOG, type FurnitureCatalogEntry } from "@/lib/templates";
import type { FurnitureCategory } from "@/lib/types";

/**
 * 首頁設計（第一性原理重排版）：
 *
 * 使用者進來想知道的根本問題：
 *   1. 我想做哪「類」家具（桌？椅？櫃？）→ 按類別分組
 *   2. 我的程度能做嗎 → 難度色塊
 *   3. 尺寸大概多少 → 預設 W×D×H
 *   4. 一眼看出選哪個 → 卡片視覺簡化、不要花俏 hover
 *
 * 19 件家具一字排列太雜亂，分 4 大類後使用者只要瀏覽自己關心的群組。
 */

const DIFFICULTY_LABEL = {
  beginner: "入門",
  intermediate: "中階",
  advanced: "進階",
} as const;

const DIFFICULTY_COLOR = {
  beginner: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  intermediate: "bg-amber-100 text-amber-800 ring-amber-200",
  advanced: "bg-rose-100 text-rose-800 ring-rose-200",
} as const;

interface CategoryGroup {
  key: string;
  emoji: string;
  title: string;
  description: string;
  match: (c: FurnitureCategory) => boolean;
}

/** 4 大類分組規則。順序 = 主頁顯示順序 */
const GROUPS: CategoryGroup[] = [
  {
    key: "seating",
    emoji: "🪑",
    title: "椅凳類",
    description: "凳、椅、長凳——日常坐用家具",
    match: (c) =>
      c === "stool" || c === "bench" || c === "dining-chair" ||
      c === "bar-stool" || c === "round-stool",
  },
  {
    key: "table",
    emoji: "🪵",
    title: "桌類",
    description: "茶几、邊桌、餐桌、書桌——含圓桌系列",
    match: (c) =>
      c === "tea-table" || c === "side-table" || c === "low-table" ||
      c === "dining-table" || c === "desk" ||
      c === "round-tea-table" || c === "round-table",
  },
  {
    key: "cabinet",
    emoji: "📦",
    title: "櫃類",
    description: "書櫃、斗櫃、鞋櫃、衣櫃、床頭櫃、電視櫃",
    match: (c) =>
      c === "open-bookshelf" || c === "chest-of-drawers" ||
      c === "shoe-cabinet" || c === "display-cabinet" ||
      c === "wardrobe" || c === "media-console" || c === "nightstand",
  },
  {
    key: "other",
    emoji: "✨",
    title: "其他",
    description: "尚未分類的特殊家具",
    match: () => true, // catch-all，永遠最後
  },
];

function groupFurniture(entries: FurnitureCatalogEntry[]) {
  const used = new Set<string>();
  return GROUPS.map((g) => {
    const items = entries.filter((e) => {
      if (used.has(e.category)) return false;
      if (!g.match(e.category)) return false;
      used.add(e.category);
      return true;
    });
    return { ...g, items };
  }).filter((g) => g.items.length > 0);
}

export default function Home() {
  const ready = FURNITURE_CATALOG.filter((f) => f.template).length;
  const grouped = groupFurniture(FURNITURE_CATALOG);

  return (
    <main className="max-w-6xl mx-auto px-6 py-12">
      <header className="mb-12">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 ring-1 ring-amber-200 text-amber-800 text-xs font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          木頭仁木匠學院 · 工程圖生成器 v0.4
        </div>
        <h1 className="mt-4 text-4xl font-bold tracking-tight text-zinc-900">
          從尺寸到圖紙,三秒鐘完成
        </h1>
        <p className="mt-3 max-w-2xl text-zinc-600 leading-relaxed">
          選一件家具、輸入寬深高,自動生成 3D 透視圖、工程三視圖、榫卯細節、切料尺寸、
          工具清單與製作工序。所有尺寸以毫米為單位,切料長度已自動計算榫頭凸出量。
        </p>
        <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm text-zinc-500">
          <span>
            <strong className="text-zinc-900 font-semibold">{ready}</strong> 種家具範本
          </span>
          <span>
            <strong className="text-zinc-900 font-semibold">6</strong> 種木材
          </span>
          <span>
            <strong className="text-zinc-900 font-semibold">10+</strong> 種榫卯結構
          </span>
          <span>
            <strong className="text-zinc-900 font-semibold">{grouped.length}</strong> 大分類
          </span>
        </div>

        {/* 難度色塊圖例（教使用者怎麼讀卡片） */}
        <div className="mt-5 flex flex-wrap gap-2 text-xs">
          <span className="text-zinc-500">難度標示：</span>
          {(["beginner", "intermediate", "advanced"] as const).map((d) => (
            <span
              key={d}
              className={`px-2 py-0.5 rounded-full ring-1 ${DIFFICULTY_COLOR[d]}`}
            >
              {DIFFICULTY_LABEL[d]}
            </span>
          ))}
          <span className="text-zinc-500 ml-auto">點擊卡片進入設計器</span>
        </div>
      </header>

      <div className="space-y-12">
        {grouped.map((group) => (
          <section key={group.key} id={group.key}>
            <div className="mb-5 flex items-baseline gap-3 flex-wrap pb-2 border-b border-zinc-200">
              <span className="text-2xl leading-none" aria-hidden>
                {group.emoji}
              </span>
              <h2 className="text-xl font-semibold text-zinc-800">
                {group.title}
              </h2>
              <span className="text-xs text-zinc-500 font-medium">
                {group.items.length} 件
              </span>
              <span className="text-sm text-zinc-500 ml-auto hidden sm:inline">
                {group.description}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {group.items.map((item) => (
                <FurnitureCard key={item.category} item={item} />
              ))}
            </div>
          </section>
        ))}
      </div>

      <footer className="mt-20 pt-8 border-t border-zinc-200 text-sm text-zinc-500 flex flex-wrap justify-between gap-4">
        <p>© 2026 木頭仁木匠學院</p>
        <p className="text-xs">
          v0.4 · {ready} 種家具範本 · 第一性原理分類重排
        </p>
      </footer>
    </main>
  );
}

function FurnitureCard({ item }: { item: FurnitureCatalogEntry }) {
  return (
    <Link
      href={`/design/${item.category}`}
      className="group block rounded-lg border border-zinc-200 bg-white p-4 hover:border-amber-400 hover:shadow-sm transition"
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <h3 className="text-base font-semibold text-zinc-900 group-hover:text-amber-900">
          {item.nameZh}
        </h3>
        <span
          className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded-full ring-1 ${DIFFICULTY_COLOR[item.difficulty]}`}
        >
          {DIFFICULTY_LABEL[item.difficulty]}
        </span>
      </div>
      <p className="text-xs text-zinc-600 leading-relaxed line-clamp-2 min-h-[2lh]">
        {item.description}
      </p>
      <p className="mt-2 text-[11px] text-zinc-500 font-mono tabular-nums">
        {item.defaults.length} × {item.defaults.width} × {item.defaults.height} mm
      </p>
      {!item.template && (
        <p className="mt-1 text-[11px] text-amber-700">尚未實作</p>
      )}
    </Link>
  );
}
