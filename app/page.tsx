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

const DIFFICULTY_LABEL = {
  beginner: "入門",
  intermediate: "中階",
  advanced: "進階",
} as const;

/** 難度膠囊樣式：有底色 + 文字，看得懂、不是裸色點 */
const DIFFICULTY_PILL = {
  beginner: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  intermediate: "bg-amber-100 text-amber-800 ring-amber-300",
  advanced: "bg-rose-100 text-rose-800 ring-rose-200",
} as const;

const DIFFICULTY_DOT = {
  beginner: "bg-emerald-500",
  intermediate: "bg-amber-500",
  advanced: "bg-rose-500",
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
    (showFurniture ? furniture.length : 0) + (showTools ? 2 : 0);

  return (
    <main className="max-w-7xl mx-auto px-5 sm:px-6 py-8 sm:py-12">
      <PerspectivePrefetch />
      <StudentLoginHint />

      {/* ============ Hero ============ */}
      <header className="mb-9 sm:mb-12">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-50 via-white to-stone-100 ring-1 ring-amber-200/70 shadow-sm px-6 py-8 sm:px-10 sm:py-10">
          {/* 角落裝飾光暈 */}
          <div
            aria-hidden
            className="pointer-events-none absolute -top-16 -right-16 w-64 h-64 rounded-full bg-amber-200/40 blur-3xl"
          />
          <div className="relative flex flex-col md:flex-row md:items-center gap-7 md:gap-10">
            <Image
              src="/brand-logo.png"
              alt="木頭仁 木作藍圖"
              width={192}
              height={192}
              className="rounded-2xl shadow-lg ring-1 ring-amber-200 shrink-0 w-32 h-32 md:w-44 md:h-44"
              priority
            />
            <div className="flex-1 min-w-0">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white ring-1 ring-amber-300 text-amber-800 text-xs font-semibold mb-4 shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                木頭仁木匠學院 · 木作藍圖 v0.5
              </div>
              <h1 className="font-serif-tc text-3xl sm:text-4xl md:text-[2.75rem] font-bold tracking-tight text-zinc-900 leading-[1.15]">
                從尺寸到圖紙
                <span className="text-amber-700">,三秒鐘完成</span>
              </h1>
              <p className="mt-4 max-w-2xl text-zinc-700 leading-relaxed">
                做木工最花時間的從來不是動手——是先把圖畫對、料算準、工序排好。
                這個工具把這三件事壓進 3 秒鐘。
              </p>
              {/* 三件輸出小標 */}
              <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-zinc-700">
                <span className="inline-flex items-center gap-1.5">
                  <span aria-hidden className="text-amber-700">▸</span>3D 透視圖
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span aria-hidden className="text-amber-700">▸</span>工程三視圖 + 榫卯細節
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span aria-hidden className="text-amber-700">▸</span>切料尺寸 · 工具 · 工序
                </span>
              </div>
              <p className="mt-3 text-sm text-zinc-500 leading-relaxed">
                切料長度已內建台灣木匠慣例,拿著材料單就能直接進工坊開鋸。
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* 搜尋 + 分類:同一塊操作區 */}
      <div className="mb-6">
        <CatalogSearch />

        {/* 分類 chip row */}
        <nav className="mt-4 -mx-5 sm:mx-0 px-5 sm:px-0 overflow-x-auto scrollbar-hide">
          <div className="inline-flex gap-2 min-w-max">
            {CATEGORY_CHIPS.map((c) => {
              const active = chip === c.key;
              const href = c.key === "all" ? "/" : `/?cat=${c.key}`;
              return (
                <Link
                  key={c.key}
                  href={href}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
                    active
                      ? "bg-amber-700 text-white shadow-md shadow-amber-700/20 ring-1 ring-amber-700"
                      : "bg-white text-zinc-700 ring-1 ring-stone-300 hover:ring-amber-400 hover:text-amber-800 hover:-translate-y-0.5"
                  }`}
                >
                  {c.label}
                </Link>
              );
            })}
          </div>
        </nav>
      </div>

      {/* 計數 + 難度圖例（文字膠囊,看得懂） */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-x-5 gap-y-3">
        <span className="text-sm text-zinc-600">
          顯示{" "}
          <strong className="text-amber-800 font-bold tabular-nums text-base">
            {visibleCount}
          </strong>
          <span className="text-zinc-400"> / {ready + 1}</span> 件
        </span>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-zinc-400 font-medium">難度</span>
          {(["beginner", "intermediate", "advanced"] as const).map((d) => (
            <span
              key={d}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold ring-1 ${DIFFICULTY_PILL[d]}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${DIFFICULTY_DOT[d]}`} />
              {DIFFICULTY_LABEL[d]}
            </span>
          ))}
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white ring-1 ring-stone-300 text-zinc-600 font-medium">
            🔒 付費版
          </span>
        </div>
      </div>

      {/* 大圖網格 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5 sm:gap-4">
        {showTools && <CeilingToolCard />}
        {showTools && <FloorToolCard />}
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
      className="group relative block overflow-hidden rounded-xl bg-white ring-1 ring-amber-300 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-xl hover:shadow-amber-900/10 hover:ring-amber-500"
    >
      {/* Top-right markers */}
      <div className="absolute top-2 right-2 z-10 flex flex-col items-end gap-1">
        <span
          title="個人版工具"
          className="text-[10px] px-2 py-0.5 rounded-full bg-amber-600 text-white font-semibold shadow-sm tracking-wide"
        >
          個人版
        </span>
      </div>
      <div className="relative aspect-square flex items-center justify-center overflow-hidden bg-gradient-to-br from-white to-stone-50">
        <Image
          src="/thumbs/v2/ceiling.webp"
          alt="天花板骨架 3D 爆炸圖"
          width={240}
          height={180}
          quality={75}
          loading="lazy"
          sizes="(min-width:1024px) 240px, (min-width:768px) 25vw, (min-width:640px) 33vw, 50vw"
          className="transition-transform duration-300 ease-out group-hover:scale-[1.06]"
          style={{ objectFit: "contain", maxHeight: "84%", maxWidth: "84%" }}
        />
      </div>
      <div className="px-3 py-2.5 flex items-center justify-between border-t border-amber-100 bg-amber-50">
        <span className="text-sm font-semibold text-zinc-900 group-hover:text-amber-900 truncate">
          🔨 天花板骨架
        </span>
        <span className="shrink-0 text-[11px] font-semibold text-amber-700 opacity-0 -translate-x-1 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0">
          開啟 →
        </span>
      </div>
    </Link>
  );
}

/** 地板施工模擬器:個人版工具卡(可點,導 /floor) */
function FloorToolCard() {
  return (
    <Link
      href="/floor"
      data-catalog-search="地板 施工 模擬器 超耐磨 海島型 木地板 排版 人字拼 估價 floor"
      className="group relative block overflow-hidden rounded-xl bg-white ring-1 ring-amber-300 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-xl hover:shadow-amber-900/10 hover:ring-amber-500"
    >
      <div className="absolute top-2 right-2 z-10 flex flex-col items-end gap-1">
        <span
          title="個人版工具"
          className="text-[10px] px-2 py-0.5 rounded-full bg-amber-600 text-white font-semibold shadow-sm tracking-wide"
        >
          個人版
        </span>
      </div>
      <div className="relative aspect-square flex items-center justify-center overflow-hidden bg-gradient-to-br from-white to-stone-50">
        <svg viewBox="0 0 120 120" className="w-[78%] h-[78%] transition-transform duration-300 ease-out group-hover:scale-[1.06]" aria-hidden>
          {[0, 1, 2, 3, 4].map((r) => (
            <g key={r}>
              {[-1, 0, 1, 2, 3].map((c) => (
                <rect
                  key={c}
                  x={c * 44 + (r % 2) * 22}
                  y={8 + r * 22}
                  width={42}
                  height={20}
                  rx={2}
                  fill="#e7d8ae"
                  stroke="#bd9955"
                  strokeWidth={1.2}
                />
              ))}
            </g>
          ))}
        </svg>
      </div>
      <div className="px-3 py-2.5 flex items-center justify-between border-t border-amber-100 bg-amber-50">
        <span className="text-sm font-semibold text-zinc-900 group-hover:text-amber-900 truncate">
          🪵 地板施工模擬器
        </span>
        <span className="shrink-0 text-[11px] font-semibold text-amber-700 opacity-0 -translate-x-1 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0">
          開啟 →
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

  // 開發中:不可點、灰遮罩 + 中央 chip
  if (inDevelopment) {
    return (
      <div
        data-catalog-search={searchTokens}
        aria-disabled="true"
        className="group relative block overflow-hidden rounded-xl bg-stone-50 ring-1 ring-stone-300 opacity-65 cursor-not-allowed select-none"
      >
        <span className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
          <span className="px-2.5 py-1 rounded-full bg-zinc-900/85 text-white text-xs font-semibold tracking-wide shadow">
            🚧 敬請期待
          </span>
        </span>
        <CardThumb item={item} />
        <CardFooter item={item} paid={paid} />
      </div>
    );
  }

  return (
    <Link
      href={`/design/${item.category}`}
      data-catalog-search={searchTokens}
      title={`${item.nameZh} · ${DIFFICULTY_LABEL[item.difficulty]}${paid ? " · 付費版" : " · 免費"}`}
      className="group relative block overflow-hidden rounded-xl bg-white ring-1 ring-stone-300 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-xl hover:shadow-amber-900/10 hover:ring-amber-500"
    >
      {/* Top-right corner markers */}
      {paid && (
        <div className="absolute top-2 right-2 z-10 w-6 h-6 rounded-full bg-white/95 ring-1 ring-amber-300 flex items-center justify-center shadow-sm">
          <span className="text-amber-600 text-xs" title="付費版">🔒</span>
        </div>
      )}
      <CardThumb item={item} />
      <CardFooter item={item} paid={paid} />
    </Link>
  );
}

function CardThumb({ item }: { item: FurnitureCatalogEntry }) {
  return (
    <div className="relative aspect-square flex items-center justify-center overflow-hidden bg-gradient-to-br from-white to-stone-50">
      <Image
        src={`/thumbs/v2/${item.category}.webp`}
        alt={`${item.nameZh} 3D 預覽`}
        width={240}
        height={180}
        quality={75}
        loading="lazy"
        sizes="(min-width:1024px) 240px, (min-width:768px) 25vw, (min-width:640px) 33vw, 50vw"
        className="transition-transform duration-300 ease-out group-hover:scale-[1.06]"
        style={{ objectFit: "contain", maxHeight: "84%", maxWidth: "84%" }}
      />
    </div>
  );
}

function CardFooter({
  item,
  paid,
}: {
  item: FurnitureCatalogEntry;
  paid: boolean;
}) {
  return (
    <div className="px-3 py-2.5 flex items-center justify-between gap-2 border-t border-amber-100 bg-amber-50">
      <span className="text-sm font-semibold text-zinc-900 group-hover:text-amber-900 truncate">
        {item.nameZh}
      </span>
      <span
        className={`shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold ring-1 ${DIFFICULTY_PILL[item.difficulty]}`}
        title={`難度:${DIFFICULTY_LABEL[item.difficulty]}`}
      >
        {DIFFICULTY_LABEL[item.difficulty]}
      </span>
    </div>
  );
}
