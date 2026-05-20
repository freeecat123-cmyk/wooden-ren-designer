import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { FURNITURE_CATALOG, type FurnitureCatalogEntry } from "@/lib/templates";
import type { FurnitureCategory } from "@/lib/types";
import { StudentLoginHint } from "@/components/StudentLoginHint";
import { isPaidCategory } from "@/lib/permissions";
import { CatalogSearch } from "@/components/CatalogSearch";
import { PerspectivePrefetch } from "@/components/PerspectivePrefetch";

interface SearchParams {
  cat?: string;
}

export const metadata: Metadata = {
  title: "木頭仁 木作藍圖｜輸入尺寸 3 秒生工程圖、材料單、報價",
  description:
    "26 種家具範本：方凳、茶几、書桌、衣櫃、餐椅、鞋櫃、紅酒架… 輸入長寬高選木材，自動產出三視圖、透視圖、榫卯細節、材料單、A4 PDF 工程圖紙。木頭仁木匠學院出品。",
  alternates: { canonical: "/" },
};

/**
 * 首頁 v3：視覺優先大圖網格（第一性原理）
 *
 * 使用者進來 3 秒內想知道:
 *   1. 我能做什麼 → 全圖列表一目瞭然
 *   2. 看起來怎樣 → 3D 縮圖佔卡片 75%
 *   3. 我會嗎 → 難度用單色 dot (綠/黃/紅) 自說自話
 *   4. 我有資格 → 付費 🔒 角標,免費不標
 *
 * 砍掉:依類別 vs 依程度 view toggle、卡片內 5 件 meta 雜訊、
 * 分組 section 隔板、難度圖例說明字。
 * 用頂部 chip 篩單一條件,搜尋走 CatalogSearch。
 */

type CatKey = "all" | "seating" | "table" | "cabinet" | "accessories" | "tool" | "dev";

const CATEGORY_CHIPS: Array<{
  key: CatKey;
  label: string;
  match?: (c: FurnitureCategory) => boolean;
}> = [
  { key: "all", label: "全部" },
  {
    key: "seating",
    label: "椅凳",
    match: (c) =>
      c === "stool" || c === "bench" || c === "dining-chair" ||
      c === "bar-stool" || c === "round-stool",
  },
  {
    key: "table",
    label: "桌",
    match: (c) =>
      c === "tea-table" || c === "side-table" || c === "low-table" ||
      c === "dining-table" || c === "desk" ||
      c === "round-tea-table" || c === "round-table",
  },
  {
    key: "cabinet",
    label: "櫃",
    match: (c) =>
      c === "open-bookshelf" || c === "chest-of-drawers" ||
      c === "shoe-cabinet" || c === "display-cabinet" ||
      c === "wardrobe" || c === "media-console" || c === "nightstand",
  },
  {
    key: "accessories",
    label: "小物",
    match: (c) =>
      c === "pencil-holder" || c === "bookend" || c === "photo-frame" ||
      c === "tray" || c === "dovetail-box" || c === "wine-rack",
  },
  { key: "tool", label: "工具" },
  {
    key: "dev",
    label: "開發中",
    match: (c) => DEVELOPMENT_CATEGORIES.has(c),
  },
];

const DIFFICULTY_DOT = {
  beginner: "bg-emerald-500",
  intermediate: "bg-amber-500",
  advanced: "bg-rose-500",
} as const;

const DIFFICULTY_LABEL = {
  beginner: "入門",
  intermediate: "中階",
  advanced: "進階",
} as const;

const DIFFICULTY_ORDER = { beginner: 0, intermediate: 1, advanced: 2 } as const;

/** 開發中家具:卡片半透明、不可點、上覆「敬請期待」chip */
const DEVELOPMENT_CATEGORIES = new Set<FurnitureCategory>([
  "chinese-cabinet", "bed", "coat-rack",
]);

function filterByChip(entries: FurnitureCatalogEntry[], chip: CatKey) {
  if (chip === "dev") {
    return entries.filter((e) => DEVELOPMENT_CATEGORIES.has(e.category));
  }
  // 非「開發中」分頁一律排除開發中項目（含「全部」、各家具分類、工具）
  const ready = entries.filter((e) => !DEVELOPMENT_CATEGORIES.has(e.category));
  if (chip === "all" || chip === "tool") return ready;
  const def = CATEGORY_CHIPS.find((c) => c.key === chip);
  if (!def?.match) return ready;
  return ready.filter((e) => def.match!(e.category));
}

function sortByDifficulty(entries: FurnitureCatalogEntry[]) {
  return [...entries].sort(
    (a, b) => DIFFICULTY_ORDER[a.difficulty] - DIFFICULTY_ORDER[b.difficulty],
  );
}

/** 全部 view 專用排序:免費 3 件置頂,其餘按難度。 */
function sortAllFreeFirst(entries: FurnitureCatalogEntry[]) {
  return [...entries].sort((a, b) => {
    const aPaid = isPaidCategory(a.category) ? 1 : 0;
    const bPaid = isPaidCategory(b.category) ? 1 : 0;
    if (aPaid !== bPaid) return aPaid - bPaid; // 免費 (0) 在前
    return DIFFICULTY_ORDER[a.difficulty] - DIFFICULTY_ORDER[b.difficulty];
  });
}

export default async function Home({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const sp = (await searchParams) ?? {};
  const chip = (CATEGORY_CHIPS.find((c) => c.key === sp.cat)?.key ?? "all") as CatKey;
  const ready = FURNITURE_CATALOG.filter((f) => f.template).length;

  const filtered = filterByChip(FURNITURE_CATALOG, chip);
  const furniture = chip === "all"
    ? sortAllFreeFirst(filtered)
    : sortByDifficulty(filtered);
  const showTools = chip === "all" || chip === "tool";
  const showFurniture = chip !== "tool";
  const visibleCount =
    (showFurniture ? furniture.length : 0) + (showTools ? 1 : 0);

  return (
    <main className="max-w-7xl mx-auto px-5 sm:px-6 py-10 sm:py-12">
      <PerspectivePrefetch />
      <StudentLoginHint />

      {/* Hero */}
      <header className="mb-8 sm:mb-10">
        <div className="flex flex-col md:flex-row md:items-center gap-6 md:gap-8">
          <Image
            src="/brand-logo.png"
            alt="木頭仁 木作藍圖"
            width={180}
            height={180}
            className="rounded-2xl shadow-md ring-1 ring-zinc-200 shrink-0 w-36 h-36 md:w-44 md:h-44"
            priority
          />
          <div className="flex-1 min-w-0">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 ring-1 ring-amber-200 text-amber-800 text-xs font-medium mb-3">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              木頭仁木匠學院 · 木作藍圖 v0.5
            </div>
            <h1 className="font-serif-tc text-3xl md:text-4xl font-bold tracking-tight text-zinc-900 leading-tight">
              從尺寸到圖紙,三秒鐘完成
            </h1>
            <p className="mt-3 max-w-2xl text-zinc-700 leading-relaxed">
              做木工最花時間的從來不是動手——是先把圖畫對、料算準、工序排好。
              這個工具把這三件事壓進 3 秒鐘。
            </p>
            <p className="mt-2 max-w-2xl text-zinc-600 leading-relaxed text-sm">
              選一件家具、填長寬高,自動出 3D 透視圖、工程三視圖、榫卯細節、
              切料尺寸、工具清單與製作工序。切料長度已內建台灣木匠慣例,
              拿著材料單就能直接進工坊開鋸。
            </p>
          </div>
        </div>
      </header>

      <CatalogSearch />

      {/* 分類 chip row */}
      <nav className="mt-5 mb-5 -mx-5 sm:mx-0 px-5 sm:px-0 overflow-x-auto scrollbar-hide">
        <div className="inline-flex gap-1.5 min-w-max">
          {CATEGORY_CHIPS.map((c) => {
            const active = chip === c.key;
            const href = c.key === "all" ? "/" : `/?cat=${c.key}`;
            return (
              <Link
                key={c.key}
                href={href}
                className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition ${
                  active
                    ? "bg-zinc-900 text-white shadow-sm"
                    : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                }`}
              >
                {c.label}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* 計數 + 圖例 */}
      <div className="mb-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-zinc-500">
        <span>
          顯示 <strong className="text-zinc-900 font-semibold tabular-nums">{visibleCount}</strong>
          {" / "}
          <span className="tabular-nums">{ready + 1}</span> 件
        </span>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />入門
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500" />中階
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-rose-500" />進階
          </span>
        </div>
        <span className="text-zinc-400">🔒 = 付費版才能進入</span>
      </div>

      {/* 大圖網格 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
        {showTools && <CeilingToolCard />}
        {showFurniture &&
          furniture.map((item) => (
            <FurnitureCard key={item.category} item={item} />
          ))}
      </div>
    </main>
  );
}

function CeilingToolCard() {
  return (
    <Link
      href="/ceiling"
      data-catalog-search="天花板 骨架 矽酸鈣板 裝潢 ceiling"
      className="group relative block overflow-hidden rounded-xl ring-1 ring-amber-200 hover:ring-amber-400 hover:shadow-md transition"
    >
      {/* Top-right markers */}
      <div className="absolute top-2 right-2 z-10 flex flex-col items-end gap-1">
        <span
          title="專業版工具"
          className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500 text-white font-semibold shadow-sm"
        >
          專業版
        </span>
      </div>
      <div className="relative aspect-square flex items-center justify-center bg-white">
        <Image
          src="/thumbs/v2/ceiling.webp"
          alt="天花板骨架 3D 爆炸圖"
          width={240}
          height={180}
          quality={75}
          loading="lazy"
          sizes="(min-width:1024px) 240px, (min-width:768px) 25vw, (min-width:640px) 33vw, 50vw"
          style={{ objectFit: "contain", maxHeight: "84%", maxWidth: "84%" }}
        />
      </div>
      <div className="px-3 py-2.5 flex items-center justify-between border-t border-amber-100 bg-amber-50">
        <span className="text-sm font-semibold text-zinc-900 group-hover:text-amber-900 truncate">
          🔨 天花板骨架
        </span>
      </div>
    </Link>
  );
}

function FurnitureCard({ item }: { item: FurnitureCatalogEntry }) {
  const paid = isPaidCategory(item.category);
  const inDevelopment = DEVELOPMENT_CATEGORIES.has(item.category);
  const searchTokens = [item.nameZh, item.category, item.description]
    .filter(Boolean)
    .join(" ");
  const dotClass = DIFFICULTY_DOT[item.difficulty];

  // 開發中:不可點、灰遮罩 + 中央 chip
  if (inDevelopment) {
    return (
      <div
        data-catalog-search={searchTokens}
        aria-disabled="true"
        className="group relative block overflow-hidden rounded-xl bg-stone-50 ring-1 ring-stone-300 opacity-60 cursor-not-allowed select-none"
      >
        <span className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
          <span className="px-2.5 py-1 rounded-full bg-zinc-900/85 text-white text-xs font-semibold tracking-wide shadow">
            🚧 敬請期待
          </span>
        </span>
        <CardThumb item={item} />
        <CardFooter item={item} dotClass={dotClass} paid={paid} />
      </div>
    );
  }

  return (
    <Link
      href={`/design/${item.category}`}
      data-catalog-search={searchTokens}
      title={`${item.nameZh} · ${DIFFICULTY_LABEL[item.difficulty]}${paid ? " · 付費版" : " · 免費"}`}
      className="group relative block overflow-hidden rounded-xl bg-white ring-1 ring-stone-300 hover:ring-amber-500 hover:shadow-md transition"
    >
      {/* Top-right corner markers */}
      {paid && (
        <div className="absolute top-2 right-2 z-10 w-6 h-6 rounded-full bg-white/90 ring-1 ring-amber-300 flex items-center justify-center shadow-sm">
          <span className="text-amber-600 text-xs" title="付費版">🔒</span>
        </div>
      )}
      <CardThumb item={item} />
      <CardFooter item={item} dotClass={dotClass} paid={paid} />
    </Link>
  );
}

function CardThumb({ item }: { item: FurnitureCatalogEntry }) {
  return (
    <div className="relative aspect-square flex items-center justify-center bg-white">
      <Image
        src={`/thumbs/v2/${item.category}.webp`}
        alt={`${item.nameZh} 3D 預覽`}
        width={240}
        height={180}
        quality={75}
        loading="lazy"
        sizes="(min-width:1024px) 240px, (min-width:768px) 25vw, (min-width:640px) 33vw, 50vw"
        style={{ objectFit: "contain", maxHeight: "84%", maxWidth: "84%" }}
      />
    </div>
  );
}

function CardFooter({
  item,
  dotClass,
  paid,
}: {
  item: FurnitureCatalogEntry;
  dotClass: string;
  paid: boolean;
}) {
  return (
    <div className="px-3 py-2.5 flex items-center justify-between border-t border-amber-100 bg-amber-50">
      <span className="text-sm font-semibold text-zinc-900 group-hover:text-amber-900 truncate">
        {item.nameZh}
      </span>
      <span
        className={`shrink-0 w-2.5 h-2.5 rounded-full ${dotClass}`}
        title={DIFFICULTY_LABEL[item.difficulty]}
      />
    </div>
  );
}
