import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { FURNITURE_CATALOG } from "@/lib/templates";
import { FREE_UNLOCKED_CATEGORIES } from "@/lib/permissions";
import { FEATURED_TEMPLATE_CATEGORIES } from "@/lib/templates/marketing";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/supabase/server";
import {
  TEMPLATE_UNLOCK_PRICES,
  DIFFICULTY_LABEL_ZH,
} from "@/lib/pricing/template-unlock";
import { AcademyPromoBanner } from "@/components/AcademyPromoBanner";

/**
 * 首頁 = 行銷 Landing（給新訪客）
 *
 * 已登入用戶會被 middleware 直接導 /app（家具目錄）。
 * 這頁面是給「Google 搜進來、FB 點過來、第一次來」的人看的。
 *
 * 8 大區塊：Hero / 痛點 / 三大產出 / 模板 / 情境 / 定價 / FAQ / 底部 CTA
 *
 * 老貨架在 /app/page.tsx，未動。
 */

export const metadata: Metadata = {
  title: "木頭仁 木作藍圖｜輸入尺寸，3 秒生工程圖、材料單、報價單",
  description:
    "做木工最花時間的從來不是動手，是先把圖畫對、料算準、工序排好。輸入尺寸選木材，自動產出三視圖、透視圖、榫卯細節、材料單、A4 PDF。免費試用方凳與筆筒，付費 NT$390/月起。",
  alternates: { canonical: "/" },
  openGraph: {
    title: "木頭仁 木作藍圖｜輸入尺寸 3 秒生工程圖",
    description:
      "把畫圖、算料、報價壓進 3 秒鐘。免費試做方凳、筆筒。木頭仁木匠學院出品。",
    images: [{ url: "/og.png", width: 1200, height: 630 }],
  },
};

// 主力 10 模板（依計畫；按出現順序排）
const FEATURED_TYPES = [
  "stool",          // 方凳 free
  "pencil-holder",  // 筆筒 free
  "side-table",     // 邊桌
  "dining-chair",   // 餐椅
  "desk",           // 書桌
  "open-bookshelf", // 開放書櫃
  "bed",            // 床架 — dev 中，但要曝光
  "chest-of-drawers", // 斗櫃
  "media-console",  // 電視櫃
  "wardrobe",       // 衣櫃
] as const;

const PAIN_POINTS = [
  {
    icon: "📐",
    title: "想做但畫不出來",
    body: "腦袋有畫面，比例怎麼抓？腳要多粗？牙板要多深？開 SketchUp 半小時還在轉視角。",
  },
  {
    icon: "📏",
    title: "材料算不準，怕浪費",
    body: "板才怎麼換台才？切下來會剩多少邊料？報價怎麼算才不會虧？每次都重算一遍。",
  },
  {
    icon: "🪚",
    title: "客戶要報價，沒效率",
    body: "客人 LINE 問「這張餐桌多少？」總要回家算半天。當場開圖、當場報，才有專業感。",
  },
];

const OUTPUTS = [
  {
    title: "三視圖 + 榫卯細節",
    body: "前視、側視、俯視自動標尺寸；榫頭通榫／盲榫／半榫錯位都算好位置。",
    img: "/about-assets/feat-threeview.png",
  },
  {
    title: "材料單 + 切割圖",
    body: "自動換算板才／台才，列出每片木料尺寸與裁切順序，邊料最少。",
    img: "/about-assets/feat-cutplan-full.png",
  },
  {
    title: "報價單 + 工時",
    body: "板材 × 厚度 × 塗裝 × 工時自動算總價，專業版可帶客戶抬頭、margin。",
    img: "/about-assets/feat-quote.png",
  },
];

const SCENARIOS = [
  { icon: "☕", tag: "清晨咖啡", body: "沙發上滑手機畫一張床邊桌，無摩擦、輕巧、生活感。" },
  { icon: "🪚", tag: "工作室實戰", body: "拿著剛印的 PDF 對木料，精準到 mm，減少報廢。" },
  { icon: "🎓", tag: "教室上課", body: "每人一支手機開 designer，抽象變具象，學員秒懂榫卯。" },
  { icon: "💬", tag: "客戶接單", body: "客人 LINE 來訊「能不能做張餐桌」，當場開圖邊聊邊改。" },
  { icon: "🌙", tag: "半夜靈感", body: "靈感來了不流失，半夢半醒做設計，明天再優化細節。" },
  { icon: "🎂", tag: "小孩生日", body: "30 分鐘和孩子一起設計筆筒，把木工變親子工具。" },
];

const FAQS = [
  {
    q: "免費版到底能做什麼？",
    a: "開放方凳、筆筒兩個入門模板，3D、榫卯、三視圖、材料單、PDF 全給你，跟付費用戶一樣。差別只在模板數量跟尺寸上限。",
  },
  {
    q: "跟 SketchUp / Fusion 360 差在哪？",
    a: "designer 是給「想做木工但不想學 CAD」的人用的。5 分鐘上手，榫卯／三視圖／材料單／切割圖全部自動，不是要取代專業 CAD。",
  },
  {
    q: "個人版跟專業版差在哪？",
    a: "不接案就買個人版（NT$390／月，全 26 模板＋裝潢工具）；要靠木工賺錢就上專業版（NT$890／月，多了客戶報價系統＋CNC 輸出＋尺寸無上限）。",
  },
  {
    q: "可以隨時取消嗎？",
    a: "可以。月扣方案隨時取消，當月仍可使用到期。年扣方案 7 天內不滿意可全額退費。",
  },
  {
    q: "可以拿產出的圖去 CNC 嗎？",
    a: "可以。專業版支援 STL / OBJ 輸出，能接 CNC、雷射切割。免費版／個人版產出的 PDF 三視圖足夠手作。",
  },
];

export default async function Landing() {
  // 已登入用戶 → 直接送進 /app（middleware 也會做這件事，這層是保險）
  const user = await getSessionUser();
  if (user) redirect("/app");

  const featuredEntries = FEATURED_TYPES
    .map((t) => FURNITURE_CATALOG.find((f) => f.category === t))
    .filter((e): e is NonNullable<typeof e> => Boolean(e));

  return (
    <main>
      {/* ============ Hero ============ */}
      <section className="relative overflow-hidden bg-gradient-to-br from-amber-50 via-white to-stone-100">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 -right-32 w-[28rem] h-[28rem] rounded-full bg-amber-200/40 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 -left-32 w-[24rem] h-[24rem] rounded-full bg-emerald-200/30 blur-3xl"
        />
        <div className="relative max-w-6xl mx-auto px-5 sm:px-6 pt-16 sm:pt-24 pb-12 sm:pb-20">
          <div className="grid md:grid-cols-2 gap-10 md:gap-14 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white ring-1 ring-amber-300 text-amber-800 text-xs font-semibold mb-5 shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                木頭仁木匠學院 · 木作藍圖 v0.5
              </div>
              <h1 className="font-serif-tc text-4xl sm:text-5xl md:text-[3.25rem] font-bold tracking-tight text-zinc-900 leading-[1.1]">
                從尺寸到圖紙
                <br className="hidden sm:block" />
                <span className="text-amber-700">三秒鐘完成</span>
              </h1>
              <p className="mt-5 text-lg text-zinc-700 leading-relaxed max-w-xl">
                做木工最花時間的從來不是動手——是先把圖畫對、料算準、工序排好。<br />
                這個工具把這三件事壓進 3 秒鐘。
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link
                  href="/app"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-amber-700 text-white font-semibold shadow-lg shadow-amber-700/30 hover:bg-amber-800 hover:-translate-y-0.5 transition-all"
                >
                  免費試做方凳 →
                </Link>
                <Link
                  href="/pricing"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white text-zinc-800 font-semibold ring-1 ring-stone-300 hover:ring-amber-500 hover:text-amber-800 transition-all"
                >
                  查看方案
                </Link>
              </div>
              <p className="mt-4 text-sm text-zinc-500">
                免註冊免登入即可試做 · 方凳 + 筆筒永遠免費
              </p>
            </div>
            <div className="relative">
              <div className="rounded-3xl bg-white ring-1 ring-amber-200 shadow-2xl overflow-hidden p-4 sm:p-6">
                <div className="aspect-[4/3] flex items-center justify-center bg-gradient-to-br from-stone-50 to-amber-50/40">
                  <Image
                    src="/about-assets/hero-3d.png"
                    alt="木頭仁木作藍圖實際產出 — 胡桃色電視櫃 3D 透視"
                    width={620}
                    height={465}
                    priority
                    style={{ objectFit: "contain", maxHeight: "92%", maxWidth: "92%" }}
                  />
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-zinc-500">
                  <span className="inline-flex items-center gap-1.5">
                    <span aria-hidden className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    實際產出畫面
                  </span>
                  <span className="font-mono">designer.woodenren.com</span>
                </div>
              </div>
              <div
                aria-hidden
                className="hidden md:block absolute -bottom-5 -right-4 rotate-3 px-3 py-1.5 rounded-full bg-amber-700 text-white text-xs font-bold shadow-lg"
              >
                ⚡ 3 秒生成
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ 痛點區 ============ */}
      <section className="max-w-6xl mx-auto px-5 sm:px-6 py-16 sm:py-24">
        <h2 className="font-serif-tc text-3xl sm:text-4xl font-bold text-center text-zinc-900">
          你是不是這樣？
        </h2>
        <p className="mt-3 text-center text-zinc-600">
          這三件事，我們聽木工朋友抱怨了三年。
        </p>
        <div className="mt-12 grid sm:grid-cols-3 gap-5">
          {PAIN_POINTS.map((p) => (
            <div
              key={p.title}
              className="rounded-2xl bg-white ring-1 ring-stone-200 p-6 shadow-sm hover:shadow-lg transition-shadow"
            >
              <div className="text-4xl mb-3">{p.icon}</div>
              <h3 className="font-bold text-lg text-zinc-900 mb-2">{p.title}</h3>
              <p className="text-zinc-600 leading-relaxed text-sm">{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ============ 三大產出 ============ */}
      <section className="bg-stone-50 border-y border-stone-200">
        <div className="max-w-6xl mx-auto px-5 sm:px-6 py-16 sm:py-24">
          <h2 className="font-serif-tc text-3xl sm:text-4xl font-bold text-center text-zinc-900">
            輸入尺寸，自動產出三件事
          </h2>
          <p className="mt-3 text-center text-zinc-600">
            拿著材料單就能直接進工坊開鋸。
          </p>
          <div className="mt-12 grid md:grid-cols-3 gap-6">
            {OUTPUTS.map((o) => (
              <div
                key={o.title}
                className="rounded-2xl bg-white ring-1 ring-stone-200 overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all"
              >
                <div className="relative aspect-video bg-gradient-to-br from-stone-50 to-amber-50/30 overflow-hidden">
                  <Image
                    src={o.img}
                    alt={o.title}
                    fill
                    sizes="(min-width:768px) 33vw, 100vw"
                    className="object-contain p-3"
                  />
                </div>
                <div className="p-6">
                  <h3 className="font-bold text-lg text-zinc-900 mb-2">
                    {o.title}
                  </h3>
                  <p className="text-zinc-600 leading-relaxed text-sm">
                    {o.body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ 模板輪播 ============ */}
      <section className="max-w-6xl mx-auto px-5 sm:px-6 py-16 sm:py-24">
        <div className="flex items-end justify-between mb-8 flex-wrap gap-3">
          <div>
            <h2 className="font-serif-tc text-3xl sm:text-4xl font-bold text-zinc-900">
              26 件家具範本
            </h2>
            <p className="mt-2 text-zinc-600">
              點任一張看「能幫你做什麼」、設計重點、實際畫面。
            </p>
          </div>
          <Link
            href="/templates"
            className="text-amber-700 hover:text-amber-900 font-semibold text-sm inline-flex items-center gap-1"
          >
            看全部範本介紹 →
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3.5 sm:gap-4">
          {featuredEntries.map((e) => {
            const free = FREE_UNLOCKED_CATEGORIES.includes(e.category);
            const hasDetail = FEATURED_TEMPLATE_CATEGORIES.includes(e.category);
            return (
              <Link
                key={e.category}
                href={hasDetail ? `/templates/${e.category}` : `/app`}
                className="group relative block overflow-hidden rounded-xl bg-white ring-1 ring-stone-300 shadow-sm hover:-translate-y-1 hover:shadow-xl hover:ring-amber-500 transition-all"
              >
                {free && (
                  <div className="absolute top-2 right-2 z-10 px-1.5 py-0.5 rounded-full bg-emerald-100 ring-1 ring-emerald-300 text-emerald-800 text-[10px] font-bold shadow-sm">
                    免費
                  </div>
                )}
                <div className="relative aspect-square flex items-center justify-center bg-gradient-to-br from-white to-stone-50">
                  <Image
                    src={`/thumbs/v2/${e.category}.webp`}
                    alt={`${e.nameZh} 3D 預覽`}
                    width={240}
                    height={180}
                    quality={75}
                    loading="lazy"
                    sizes="(min-width:768px) 20vw, (min-width:640px) 33vw, 50vw"
                    className="transition-transform group-hover:scale-[1.06]"
                    style={{ objectFit: "contain", maxHeight: "84%", maxWidth: "84%" }}
                  />
                </div>
                <div className="px-3 py-2.5 border-t border-amber-100 bg-amber-50">
                  <span className="text-sm font-semibold text-zinc-900 group-hover:text-amber-900 truncate block">
                    {e.nameZh}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ============ 6 情境 ============ */}
      <section className="bg-gradient-to-b from-white to-amber-50/30 border-y border-amber-100">
        <div className="max-w-6xl mx-auto px-5 sm:px-6 py-16 sm:py-24">
          <h2 className="font-serif-tc text-3xl sm:text-4xl font-bold text-center text-zinc-900">
            什麼時候會用到？
          </h2>
          <p className="mt-3 text-center text-zinc-600">
            六個真實情境——你最像哪一個？
          </p>
          <div className="mt-12 grid sm:grid-cols-2 md:grid-cols-3 gap-4">
            {SCENARIOS.map((s) => (
              <div
                key={s.tag}
                className="group rounded-2xl bg-white ring-1 ring-stone-200 p-5 shadow-sm hover:shadow-lg hover:-translate-y-0.5 hover:ring-amber-300 transition-all"
              >
                <div className="flex items-center gap-2.5 mb-3">
                  <span
                    aria-hidden
                    className="text-3xl leading-none group-hover:scale-110 transition-transform"
                  >
                    {s.icon}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-100 ring-1 ring-amber-300 text-amber-800 text-xs font-bold">
                    {s.tag}
                  </span>
                </div>
                <p className="text-zinc-700 leading-relaxed text-sm">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ 定價精簡 ============ */}
      <section className="max-w-6xl mx-auto px-5 sm:px-6 py-16 sm:py-24">
        <h2 className="font-serif-tc text-3xl sm:text-4xl font-bold text-center text-zinc-900">
          選一個適合你的方案
        </h2>
        <p className="mt-3 text-center text-zinc-600">
          先免費試做，覺得對胃口再升級。
        </p>
        <div className="mt-12 grid md:grid-cols-3 gap-5">
          <PricingCard
            tier="免費"
            price="0"
            unit=""
            highlight={false}
            features={[
              "方凳 + 筆筒 兩個模板",
              "3D、榫卯、三視圖、材料單全給",
              "PDF 列印無浮水印",
              "尺寸上限：方凳 35×35×45、筆筒 20×20×25",
            ]}
            cta={{ label: "免費試做", href: "/app" }}
          />
          <PricingCard
            tier="個人版"
            price="390"
            unit="/月"
            highlight={true}
            features={[
              "全 26 個家具模板",
              "天花板骨架 + 地板 + 和室架高平台",
              "PDF 列印 + 雲端儲存無限",
              "適合 DIY、自家裝潢、週末做家具的人",
            ]}
            cta={{ label: "升級個人版", href: "/pricing" }}
          />
          <PricingCard
            tier="專業版"
            price="890"
            unit="/月"
            highlight={false}
            features={[
              "個人版全部功能",
              "客戶報價系統 + 客戶資料管理",
              "STL / OBJ 輸出（CNC、雷射）",
              "設計師模式：尺寸無上限",
            ]}
            cta={{ label: "靠木工接案就上這個", href: "/pricing" }}
          />
        </div>
        <p className="mt-6 text-center text-sm text-zinc-500">
          年繳再省一個多月 · 木匠學院終身會員私訊拿專屬碼
        </p>

        {/* 單範本永久買斷 */}
        <div className="mt-10 rounded-2xl bg-stone-50 ring-1 ring-stone-200 p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="md:max-w-md">
              <h3 className="font-serif-tc text-xl sm:text-2xl font-bold text-zinc-900">
                🪵 不想訂閱？單範本永久買斷
              </h3>
              <p className="mt-2 text-zinc-700 text-sm leading-relaxed">
                只想做某張椅子？一次買斷，永久擁有那張藍圖。不訂閱也能用。
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3 md:flex md:gap-3">
              {(["beginner", "intermediate", "advanced"] as const).map((d) => (
                <div
                  key={d}
                  className="rounded-xl bg-white ring-1 ring-stone-200 px-4 py-3 text-center"
                >
                  <div className="text-xs text-zinc-500">
                    {DIFFICULTY_LABEL_ZH[d]}
                  </div>
                  <div className="mt-1 font-bold text-zinc-900">
                    NT$ {TEMPLATE_UNLOCK_PRICES[d]}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-5 text-center md:text-right">
            <Link
              href="/pricing"
              className="text-sm font-semibold text-amber-800 hover:text-amber-900 underline underline-offset-4"
            >
              → 看全部 26 個範本買斷價
            </Link>
          </div>
        </div>
      </section>

      {/* ============ FAQ ============ */}
      <section className="bg-stone-50 border-y border-stone-200">
        <div className="max-w-3xl mx-auto px-5 sm:px-6 py-16 sm:py-24">
          <h2 className="font-serif-tc text-3xl sm:text-4xl font-bold text-center text-zinc-900">
            常見問題
          </h2>
          <div className="mt-10 space-y-3">
            {FAQS.map((f) => (
              <details
                key={f.q}
                className="group rounded-2xl bg-white ring-1 ring-stone-200 p-5 shadow-sm open:shadow-md transition-shadow"
              >
                <summary className="cursor-pointer font-semibold text-zinc-900 list-none flex items-center justify-between gap-3">
                  <span>{f.q}</span>
                  <span className="text-amber-700 group-open:rotate-45 transition-transform text-xl shrink-0">
                    +
                  </span>
                </summary>
                <p className="mt-3 text-zinc-600 leading-relaxed text-sm whitespace-pre-line">
                  {f.a}
                </p>
              </details>
            ))}
          </div>
          <div className="mt-8 text-center">
            <Link
              href="/help"
              className="text-amber-700 hover:text-amber-900 font-semibold text-sm"
            >
              看完整 FAQ →
            </Link>
          </div>
        </div>
      </section>

      {/* ============ 底部 CTA ============ */}
      <section className="bg-gradient-to-br from-amber-700 to-amber-900 text-white">
        <div className="max-w-4xl mx-auto px-5 sm:px-6 py-16 sm:py-24 text-center">
          <h2 className="font-serif-tc text-3xl sm:text-4xl md:text-5xl font-bold leading-tight">
            先去做一張方凳<br className="sm:hidden" />
            <span className="text-amber-200">再決定要不要付費。</span>
          </h2>
          <p className="mt-5 text-amber-100 text-lg max-w-xl mx-auto leading-relaxed">
            這是我覺得最公平的方式——你先用，覺得真的有幫到你，再付。
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/app"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-white text-amber-800 font-bold shadow-xl hover:-translate-y-0.5 hover:bg-amber-50 transition-all"
            >
              開始設計 →
            </Link>
            <Link
              href="/about"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-white/10 text-white font-semibold ring-1 ring-white/30 hover:bg-white/20 transition-all"
            >
              關於木頭仁
            </Link>
          </div>
        </div>
      </section>

      <AcademyPromoBanner />
    </main>
  );
}

function PricingCard({
  tier,
  price,
  unit,
  highlight,
  features,
  cta,
}: {
  tier: string;
  price: string;
  unit: string;
  highlight: boolean;
  features: string[];
  cta: { label: string; href: string };
}) {
  return (
    <div
      className={`relative rounded-2xl p-6 shadow-sm transition-shadow ${
        highlight
          ? "bg-amber-50 ring-2 ring-amber-500 shadow-lg shadow-amber-700/10"
          : "bg-white ring-1 ring-stone-200"
      }`}
    >
      {highlight && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-amber-700 text-white text-xs font-bold shadow-md">
          最多人選
        </div>
      )}
      <div className="font-bold text-lg text-zinc-900 mb-2">{tier}</div>
      <div className="flex items-baseline gap-1 mb-5">
        <span className="text-zinc-500 text-sm">NT$</span>
        <span className="text-4xl font-bold text-zinc-900 tabular-nums">
          {price}
        </span>
        <span className="text-zinc-500 text-sm">{unit}</span>
      </div>
      <ul className="space-y-2 mb-6 min-h-[10rem]">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm text-zinc-700">
            <span className="text-emerald-600 mt-0.5 shrink-0">✓</span>
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <Link
        href={cta.href}
        className={`block text-center px-4 py-2.5 rounded-full font-semibold text-sm transition-all ${
          highlight
            ? "bg-amber-700 text-white shadow-md hover:bg-amber-800"
            : "bg-white text-zinc-800 ring-1 ring-stone-300 hover:ring-amber-500 hover:text-amber-800"
        }`}
      >
        {cta.label}
      </Link>
    </div>
  );
}
