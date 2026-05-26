import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Fragment } from "react";
import {
  TEMPLATE_UNLOCK_PRICES,
  DIFFICULTY_LABEL_ZH,
} from "@/lib/pricing/template-unlock";
import { AcademyPromoBanner } from "@/components/AcademyPromoBanner";
export const metadata: Metadata = {
  title: "關於 木頭仁 木作藍圖｜輸入尺寸 3 秒生工程圖",
  description:
    "木頭仁木匠學院出品。超過 25 種家具範本，輸入長寬高自動產出三視圖、透視圖、榫卯細節、材料單、工序、A4 PDF 工程圖紙。給 DIY 木工愛好者、木匠師傅、設計接案、學員用。",
  alternates: { canonical: "/about" },
  openGraph: {
    title: "關於 木頭仁 木作藍圖｜輸入尺寸 3 秒生工程圖",
    description:
      "木頭仁木匠學院出品。25+ 家具範本、自動三視圖、榫卯、材料單、PDF 工程圖。",
    url: "/about",
    type: "website",
    images: [{ url: "/og.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "關於 木頭仁 木作藍圖",
    description:
      "輸入尺寸 3 秒生工程圖、材料單、報價。木頭仁木匠學院出品。",
    images: ["/og.png"],
  },
};

/** 裝潢專區 — 7 件最常用櫃體 + 第 8 格放「持續新增中」（直接連到 /design/[slug]） */
const INTERIOR_CABINETS: Array<{ slug: string; nameZh: string }> = [
  { slug: "wardrobe", nameZh: "衣櫃" },
  { slug: "shoe-cabinet", nameZh: "鞋櫃" },
  { slug: "media-console", nameZh: "電視櫃" },
  { slug: "open-bookshelf", nameZh: "書櫃" },
  { slug: "display-cabinet", nameZh: "展示櫃" },
  { slug: "nightstand", nameZh: "床頭櫃" },
  { slug: "chest-of-drawers", nameZh: "斗櫃" },
];

/** Hero 下方 thumb mosaic 用 — 挑視覺好認的 12 件，類別均衡 */
const MOSAIC_THUMBS = [
  "stool",
  "dining-chair",
  "tea-table",
  "desk",
  "open-bookshelf",
  "shoe-cabinet",
  "wardrobe",
  "wine-rack",
  "pencil-holder",
  "dovetail-box",
  "bookend",
  "tray",
];

export default function AboutPage() {
  return (
    <main className="max-w-5xl mx-auto px-5 sm:px-6 py-10 sm:py-14">
      {/* ============ Hero ============ */}
      <section className="relative text-center">
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-0 w-[34rem] max-w-full h-72 rounded-full bg-amber-200/35 blur-3xl"
        />
        <Image
          src="/brand-logo-text.png"
          alt="木頭仁 木作藍圖"
          width={1254}
          height={1254}
          className="relative mx-auto mb-7 sm:mb-9 rounded-3xl shadow-xl ring-1 ring-amber-200/60 w-40 h-40 sm:w-56 sm:h-56"
          priority
        />
        <div className="relative inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white ring-1 ring-amber-300 text-amber-800 text-xs font-semibold mb-5 shadow-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          木頭仁木匠學院出品
        </div>
        <h1 className="relative font-serif-tc text-3xl sm:text-5xl font-bold tracking-tight text-zinc-900 leading-[1.18]">
          畫圖算料的時間<br />
          <span className="text-amber-700">交給工具</span>
        </h1>
        <p className="relative mt-5 max-w-2xl mx-auto text-lg text-zinc-700 leading-relaxed">
          選一件家具、填長寬高，<strong className="text-zinc-900">3 秒鐘</strong>
          自動產出 3D 透視圖、工程三視圖、榫卯細節、材料單、工序與 A4 PDF 工程圖紙。
        </p>

        {/* Social proof bar */}
        <div className="relative mt-7 inline-flex flex-wrap items-center justify-center gap-x-6 gap-y-2 rounded-2xl bg-white/70 ring-1 ring-amber-200 py-3.5 px-7 shadow-sm text-sm text-zinc-600">
          <span className="inline-flex items-baseline gap-1.5">
            <strong className="font-serif-tc text-xl text-amber-800">20 萬</strong>
            <span>YouTube 訂閱</span>
          </span>
          <span aria-hidden className="w-px h-5 bg-amber-200" />
          <span className="inline-flex items-baseline gap-1.5">
            <strong className="font-serif-tc text-xl text-amber-800">600+</strong>
            <span>學員教過</span>
          </span>
          <span aria-hidden className="w-px h-5 bg-amber-200" />
          <span className="inline-flex items-baseline gap-1.5">
            <strong className="font-serif-tc text-xl text-amber-800">25+</strong>
            <span>家具範本</span>
          </span>
        </div>

        <div className="relative mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center px-7 py-3 rounded-xl bg-amber-700 text-white font-semibold shadow-md shadow-amber-700/25 transition-all duration-200 hover:bg-amber-800 hover:-translate-y-0.5 hover:shadow-lg"
          >
            開始設計（免費試用）→
          </Link>
          <Link
            href="/pricing"
            className="inline-flex items-center px-7 py-3 rounded-xl bg-white text-zinc-900 font-semibold ring-1 ring-stone-300 transition-all duration-200 hover:bg-amber-50 hover:ring-amber-500 hover:-translate-y-0.5"
          >
            看付費方案
          </Link>
        </div>
        {/* Hero 主視覺 — 真實 3D 渲染 */}
        {/* Hero 三聯主視覺 — 一個輸入 → 三種輸出 */}
        <HeroTriptych />
        <p className="mt-3 text-xs text-zinc-500 text-center">
          ↑ 同一件家具，三秒鐘同步產出 3D 透視 · 工程三視圖 · 切料清單
        </p>
      </section>

      {/* ============ Thumb mosaic：26 件視覺證明 ============ */}
      <section className="mt-16 sm:mt-20">
        <p className="text-center text-zinc-600 mb-6 text-sm sm:text-base">
          目前內建 <strong className="text-zinc-900">超過 25 種</strong>家具範本，
          從筆筒到衣櫃，都能直接拖滑桿改尺寸——
        </p>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 sm:gap-3">
          {MOSAIC_THUMBS.map((slug) => (
            <div
              key={slug}
              className="aspect-square rounded-lg bg-gradient-to-br from-zinc-50 to-zinc-100 ring-1 ring-zinc-200 flex items-center justify-center p-2"
            >
              <Image
                src={`/thumbs/v2/${slug}.webp`}
                alt=""
                width={120}
                height={120}
                quality={70}
                loading="lazy"
                style={{ objectFit: "contain", maxHeight: "100%", maxWidth: "100%" }}
              />
            </div>
          ))}
        </div>
        <p className="text-center text-zinc-500 text-xs mt-4">
          這只是其中 12 件，<Link href="/" className="underline hover:text-zinc-900">看完整圖庫</Link>
        </p>
      </section>

      {/* ============ 痛點 ============ */}
      <section className="mt-20 sm:mt-24">
        <Eyebrow>為什麼做這個工具</Eyebrow>
        <h2 className="mt-4 font-serif-tc text-2xl sm:text-3xl font-bold text-zinc-900 text-center">
          做木工最花時間的，從來不是動手。
        </h2>
        <p className="mt-4 max-w-2xl mx-auto text-zinc-700 leading-relaxed text-center">
          是先把圖畫對、料算準、工序排好。
          一張凳子的設計圖通常要花 2~3 小時、一個櫃子半天起跳——
          還沒進工坊，就已經先燒掉一個下午。
        </p>
        <div className="mt-10 grid sm:grid-cols-3 gap-4 sm:gap-6">
          <PainPoint
            emoji="📐"
            title="畫圖卡關"
            desc="尺寸算來算去總有一個數字怪怪的，三視圖跟透視圖兜不起來。"
          />
          <PainPoint
            emoji="🪵"
            title="算料卡關"
            desc="長度、寬度、厚度三個一組，加上榫頭預留、損耗、刨光——掐指一算半天就過了。"
          />
          <PainPoint
            emoji="🔨"
            title="工序卡關"
            desc="先做哪、後做哪，哪一步先上膠哪一步先夾——做錯順序拆都拆不開。"
          />
        </div>
        <p className="mt-10 text-center text-lg text-amber-800 font-semibold">
          木作藍圖把這三件事壓進 3 秒鐘 ——<br className="sm:hidden" />
          省下的兩個晚上，夠你多接一張單。
        </p>
      </section>

      {/* ============ 三步驟 ============ */}
      <section className="mt-20 sm:mt-24">
        <Eyebrow>怎麼用</Eyebrow>
        <h2 className="mt-4 font-serif-tc text-2xl sm:text-3xl font-bold text-zinc-900 text-center mb-12">
          三步驟，從零到工坊
        </h2>
        <div className="grid md:grid-cols-3 gap-6 sm:gap-8">
          <StepCard
            no="1"
            title="選範本"
            desc="從超過 25 種家具範本選一件。方凳、餐椅、書桌、衣櫃、紅酒架、筆筒…從入門到進階都有。"
            visual={<StepVisualCatalog />}
          />
          <StepCard
            no="2"
            title="填尺寸"
            desc="長寬高、木材厚度、榫卯類型，拖滑桿即時看到 3D 模型變形。"
            visual={<StepVisualSliders />}
          />
          <StepCard
            no="3"
            title="拿圖紙進工坊"
            desc="A4 PDF 工程圖紙、切料尺寸表、工具清單、製作工序——印出來就能動鋸。"
            visual={<StepVisualPdf />}
          />
        </div>
      </section>

      {/* ============ 能做什麼 ============ */}
      <section className="mt-20 sm:mt-24">
        <Eyebrow>產出內容</Eyebrow>
        <h2 className="mt-4 font-serif-tc text-2xl sm:text-3xl font-bold text-zinc-900 text-center mb-3">
          每一件家具都附這些
        </h2>
        <p className="text-center text-zinc-600 mb-10">
          不只是設計圖，是一整套可以直接開工的施作包。
        </p>

        {/* 主要 6 件含截圖 */}
        <div className="grid md:grid-cols-2 gap-5 sm:gap-6 mb-6">
          <ImageFeatureCard
            src="/about-assets/feat-threeview.png"
            title="📐 工程三視圖"
            desc="正視、側視、俯視圖，含完整尺寸標註——符合台灣木匠製圖慣例，印出來就能照做。"
          />
          <ImageFeatureCard
            src="/about-assets/feat-cutlist.png"
            title="📋 切料清單"
            desc="每塊料的長寬厚、編號、3D 對應位置一目瞭然，工坊裡邊裁邊勾，不會出錯。"
          />
          <ImageFeatureCard
            src="/about-assets/feat-cutplan-full.png"
            title="🪵 排板裁切圖"
            desc="自動算出最省料的排板方式並顯示利用率，連 5 米德製升級捲尺要從哪邊下刀都標好。"
          />
          <ImageFeatureCard
            src="/about-assets/feat-steps.png"
            title="📑 製作工序"
            desc={`完整 19 步工序、預估工時、選料注意事項、含水率、刨削方向——比自學書還細。`}
          />
          <ImageFeatureCard
            src="/about-assets/feat-quote.png"
            title="💰 客製報價"
            desc="家具報價、含稅金額、訂金尾款分配、付款分期、客戶資料表，接案直接列印當報價單。"
          />
          <ImageFeatureCard
            src="/about-assets/hero-3d.png"
            title="🪑 3D 透視預覽"
            desc="逼真木紋渲染，可拖曳旋轉檢視任何角度，把成品先看清楚再下鋸。"
          />
        </div>

        {/* 補充 3 件 emoji-only */}
        <div className="grid sm:grid-cols-3 gap-4 mb-6">
          <FeatureCard emoji="🔩" title="榫卯細節" desc="通榫、盲榫、半榫位置自動計算，含公榫母榫對位圖。" />
          <FeatureCard emoji="🛠️" title="工具清單" desc="這件家具會用到哪些工具，新手不用瞎買。" />
          <FeatureCard emoji="🎲" title="STL 3D 輸出" desc="可在 SketchUp、3D 列印機開啟，做縮小模型先打樣。" />
        </div>

      </section>

      {/* ============ 裝潢專區 ============ */}
      <section className="mt-20 sm:mt-24">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-700 text-white text-xs font-semibold mb-4">
          🔨 裝潢專區
        </div>
        <h2 className="font-serif-tc text-2xl sm:text-3xl font-bold text-zinc-900 mb-3">
          量房一次、清單一次列印
        </h2>
        <p className="text-zinc-700 leading-relaxed mb-8 max-w-2xl">
          裝潢師傅最常燒時間的不是釘工——是現場拿筆估料、回家畫圖、隔天還要二次跑工地補料。
          從天花板到收納櫃，輸入空間尺寸就出整套清單。
        </p>

        {/* 主打：天花板骨架 寬卡（個人版以上） */}
        <div className="block rounded-2xl bg-gradient-to-br from-amber-50 to-stone-100 ring-1 ring-amber-200 p-6 sm:p-8 mb-6">
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-xl bg-white ring-1 ring-amber-200 flex items-center justify-center p-3 shrink-0">
              <Image
                src="/thumbs/v2/ceiling.webp"
                alt="天花板骨架 3D 爆炸圖"
                width={160}
                height={160}
                quality={75}
                loading="lazy"
                style={{ objectFit: "contain", maxHeight: "100%", maxWidth: "100%" }}
              />
            </div>
            <div className="flex-1 text-center md:text-left">
              <div className="inline-flex items-center gap-1.5 mb-2">
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-600 text-white font-semibold">
                  個人版
                </span>
                <span className="text-xs text-amber-800 font-medium">已上線</span>
              </div>
              <h3 className="font-bold text-zinc-900 text-xl mb-2">
                🪜 天花板骨架計算
              </h3>
              <p className="text-zinc-700 leading-relaxed text-sm sm:text-base">
                量好房型輸入長寬高，自動配主骨 / 副骨 / 吊筋，
                算出每根料長度、矽酸鈣板切幾片、釘子幾顆、整套用料與工時——
                清單列印帶到工地，不再現場拿筆算到頭暈。
              </p>
            </div>
          </div>
        </div>

        {/* 7 件裝潢櫃體 */}
        <h3 className="font-bold text-zinc-900 text-lg mb-3">
          裝潢櫃體一條龍 — {INTERIOR_CABINETS.length} 種常用櫃自動產圖紙 + 切料單
        </h3>
        <div className="grid grid-cols-4 md:grid-cols-7 gap-2 sm:gap-3 mb-2">
          {INTERIOR_CABINETS.map((c) => (
            <div
              key={c.slug}
              title={c.nameZh}
              className="block aspect-square rounded-lg bg-white ring-1 ring-zinc-200 flex items-center justify-center p-2"
            >
              <Image
                src={`/thumbs/v2/${c.slug}.webp`}
                alt={c.nameZh}
                width={120}
                height={120}
                quality={70}
                loading="lazy"
                style={{ objectFit: "contain", maxHeight: "100%", maxWidth: "100%" }}
              />
            </div>
          ))}
        </div>
        <p className="text-xs text-zinc-500">
          {INTERIOR_CABINETS.map((c) => c.nameZh).join(" · ")}
        </p>
      </section>

      {/* ============ 適合誰 ============ */}
      <section className="mt-20 sm:mt-24">
        <Eyebrow>適合誰</Eyebrow>
        <h2 className="mt-4 font-serif-tc text-2xl sm:text-3xl font-bold text-zinc-900 text-center mb-12">
          給這五種人用
        </h2>
        <div className="grid sm:grid-cols-2 gap-5">
          <PersonaCard
            emoji="🪚"
            title="DIY 木工愛好者"
            desc="不會畫工程圖也想做家具給家裡用。範本選下去、尺寸對自家環境調一調，剩下交給工具產出。"
          />
          <PersonaCard
            emoji="👷"
            title="木匠師傅 / 接案"
            desc="客戶 LINE 問「做一個這樣的櫃子多少」，5 分鐘出設計 + 報價 + 工序——回得比同行快，單就是你的。算料一次到位，也不會多訂虧本。"
          />
          <PersonaCard
            emoji="🔨"
            title="裝潢師傅 / 室內裝修"
            desc="量好房型、輸入長寬高，天花板骨架（主骨/副骨/支撐）自動算料、矽酸鈣板用幾片、釘子幾顆，整套清單列印帶到工地。"
          />
          <PersonaCard
            emoji="🎨"
            title="設計師"
            desc="家具設計拿到工程圖、切料表，可以直接外包給木工施作，溝通成本降到最低。"
          />
          <PersonaCard
            emoji="🎓"
            title="木匠學院學員 / 自學者"
            desc="課堂作品改變尺寸、改用不同榫卯，立刻看到 3D 怎麼變化——比書本快十倍。"
          />
        </div>
      </section>

      {/* ============ 木頭仁是誰 ============ */}
      <section className="mt-20 sm:mt-24 rounded-2xl bg-gradient-to-br from-amber-50 to-stone-100 ring-1 ring-amber-200 p-8 sm:p-12">
        <div className="flex flex-col md:flex-row items-center gap-8">
          <Image
            src="/brand-logo.png"
            alt="木頭仁"
            width={160}
            height={160}
            className="rounded-2xl shadow-md ring-1 ring-amber-200 shrink-0"
          />
          <div className="flex-1 text-center md:text-left">
            <h2 className="font-serif-tc text-2xl sm:text-3xl font-bold text-zinc-900">
              我是木頭仁
            </h2>
            <p className="mt-4 text-zinc-800 leading-relaxed text-lg">
              YouTube <strong>二十萬人</strong>看我做木工，
              木匠學院線上+實體教過<strong>六百多位學員</strong>。
            </p>
            <p className="mt-3 text-zinc-800 leading-relaxed">
              這十年我最常被問的就是——
              <br />
              <span className="text-amber-900 italic">「仁哥，這個尺寸要怎麼抓？」</span>
            </p>
            <p className="mt-3 text-zinc-700 leading-relaxed">
              木作藍圖就是我把那些「<strong>怎麼抓</strong>」寫成的工具。
              家具尺寸慣例、榫卯規則、工序邏輯——每一條背後都有實際做過、被學員問到爛的經驗。
            </p>
            <div className="mt-5 flex flex-wrap gap-2 justify-center md:justify-start">
              <a
                href="https://www.youtube.com/@WoodenRen"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="木頭仁 YouTube 頻道"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700"
              >
                <span aria-hidden>▶</span> YouTube
              </a>
              <a
                href="https://www.facebook.com/woodenren99/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="木頭仁 Facebook 粉絲團"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700"
              >
                <span aria-hidden className="font-bold">f</span> Facebook
              </a>
              <a
                href="https://www.instagram.com/wooden_ren/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="木頭仁 Instagram"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-white text-sm font-semibold bg-gradient-to-tr from-amber-500 via-pink-500 to-purple-600 hover:opacity-90"
              >
                <span aria-hidden>📷</span> Instagram
              </a>
              <a
                href="https://woodenrenclass.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="木匠學院"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white text-zinc-900 text-sm font-semibold ring-1 ring-zinc-300 hover:bg-zinc-50"
              >
                <span aria-hidden>🎓</span> 木匠學院
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ============ 方案 CTA ============ */}
      <section className="mt-20 sm:mt-24">
        <Eyebrow>方案</Eyebrow>
        <h2 className="mt-4 font-serif-tc text-2xl sm:text-3xl font-bold text-zinc-900 text-center">
          先免費試，需要再升級
        </h2>
        <p className="mt-4 max-w-xl mx-auto text-zinc-700 leading-relaxed text-center">
          月付 NT$390 起，年付直接省兩個月。<br className="sm:hidden" />
          接案多接一張單、或算錯一次料 ——<br className="sm:hidden" />
          訂閱費早就回本。
        </p>

        {/* 三方案 mini cards */}
        <div className="mt-10 grid md:grid-cols-3 gap-4 sm:gap-5 max-w-4xl mx-auto">
          <MiniPlanCard
            name="免費版"
            price="$0"
            unit=""
            features={["3 件範本不限次", "3D 預覽 + 三視圖", "材料單 + 工序"]}
            cta="開始試做"
            ctaHref="/"
            highlight={false}
          />
          <MiniPlanCard
            name="個人版"
            price="$390"
            unit="/月"
            features={[
              "全部家具範本解鎖",
              "天花板骨架 / 地板模擬器",
              "PDF 列印 / 雲端儲存",
            ]}
            cta="升級個人版"
            ctaHref="/pricing"
            highlight
          />
          <MiniPlanCard
            name="專業版"
            price="$890"
            unit="/月"
            features={[
              "個人版全部內容",
              "客製報價 + 客戶資料管理",
              "STL / OBJ 輸出 + 尺寸無上限",
            ]}
            cta="升級專業版"
            ctaHref="/pricing"
            highlight={false}
          />
        </div>

        {/* 單範本永久買斷 */}
        <div className="mt-8 max-w-4xl mx-auto rounded-2xl bg-stone-50 ring-1 ring-stone-200 p-6 sm:p-7 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
            <div className="md:max-w-sm">
              <h3 className="font-serif-tc text-xl font-bold text-zinc-900">
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
          <div className="mt-4 text-center md:text-right">
            <Link
              href="/pricing"
              className="text-sm font-semibold text-amber-800 hover:text-amber-900 underline underline-offset-4"
            >
              → 看全部 26 個範本買斷價
            </Link>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap justify-center gap-x-5 gap-y-1.5 text-xs text-zinc-600">
          <span className="inline-flex items-center gap-1">
            <span className="text-emerald-600">✓</span> 免費版不用信用卡
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="text-emerald-600">✓</span> 月扣可隨時取消
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="text-emerald-600">✓</span> 取消後當期權限保留到到期
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="text-emerald-600">✓</span> 年付 = 月付 × 10
          </span>
        </div>

        <p className="mt-6 text-xs text-zinc-500 text-center">
          有問題？看 <Link href="/help" className="underline hover:text-zinc-900">常見問題</Link>
          {" · "}
          或<Link href="/contact" className="underline hover:text-zinc-900">聯絡我們</Link>
        </p>

        {/* 問題回報指引 */}
        <div className="mt-8 max-w-xl mx-auto rounded-xl bg-amber-50 ring-1 ring-amber-200 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="shrink-0 w-12 h-12 rounded-full bg-white ring-1 ring-amber-300 shadow-sm flex items-center justify-center">
              <Image
                src="/logo-mark.png"
                alt="木頭仁圖示"
                width={36}
                height={36}
                style={{ objectFit: "contain" }}
              />
            </div>
            <p className="text-sm text-zinc-800 leading-relaxed">
              用到 bug 或卡關？點頁面<strong>右下角的木頭仁圖示</strong>
              <span className="text-zinc-500"> (像左邊這個) </span>
              直接回報，會自動帶上當前頁面跟瀏覽器資訊，我看到信就知道怎麼修。
            </p>
          </div>
        </div>
      </section>

      <AcademyPromoBanner />
    </main>
  );
}

/**
 * Hero 三聯主視覺：一個輸入 → 三種輸出
 *   左：3D 透視（同一張原素材，最大張）
 *   中：工程三視圖
 *   右：切料清單
 * 桌面三欄並列、箭頭連接；手機改三段垂直 + ↓ 箭頭。
 * 各 panel hover 微浮起 + amber ring 強調。
 */
function HeroTriptych() {
  const panels = [
    {
      src: "/about-assets/hero-3d.png",
      alt: "3D 透視 — 胡桃色電視櫃實際生成畫面",
      label: "① 3D 透視",
      sub: "拖曳旋轉、看清榫卯",
    },
    {
      src: "/about-assets/feat-threeview.png",
      alt: "工程三視圖含尺寸標註",
      label: "② 工程三視圖",
      sub: "正/側/俯，全尺寸標註",
    },
    {
      src: "/about-assets/feat-cutlist.png",
      alt: "切料清單與排板",
      label: "③ 切料清單",
      sub: "編號 + 長寬厚，直接開鋸",
    },
  ];

  return (
    <div className="mt-10 sm:mt-12">
      {/* 流程標籤：輸入 → 同步生成三件 */}
      <div className="mb-4 flex items-center justify-center gap-2 sm:gap-3 text-xs sm:text-sm text-zinc-600">
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-zinc-900 text-white font-semibold">
          <span aria-hidden>📏</span> 一次輸入長寬高
        </span>
        <span aria-hidden className="text-amber-700 font-bold">→</span>
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-700 text-white font-semibold">
          <span aria-hidden>⚡</span> 3 秒同步生成
        </span>
      </div>

      {/* 三聯 grid：桌面 3 欄、手機垂直堆疊 */}
      <div className="grid md:grid-cols-[1.4fr_auto_1fr_auto_1fr] gap-3 sm:gap-4 items-center">
        {panels.map((p, i) => {
          const isLast = i === panels.length - 1;
          return (
            <Fragment key={p.src}>
              <HeroPanel {...p} primary={i === 0} />
              {!isLast && (
                <span
                  aria-hidden
                  className="hidden md:flex justify-center text-amber-700 text-2xl font-bold"
                >
                  →
                </span>
              )}
              {!isLast && (
                <span
                  aria-hidden
                  className="md:hidden flex justify-center text-amber-700 text-2xl font-bold py-1"
                >
                  ↓
                </span>
              )}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}

function HeroPanel({
  src,
  alt,
  label,
  sub,
  primary,
}: {
  src: string;
  alt: string;
  label: string;
  sub: string;
  primary: boolean;
}) {
  return (
    <div
      className={`group rounded-xl overflow-hidden ring-1 transition hover:-translate-y-1 hover:shadow-lg ${
        primary
          ? "bg-gradient-to-br from-amber-50 to-stone-100 ring-amber-300 shadow-md"
          : "bg-white ring-zinc-200 shadow-sm hover:ring-amber-300"
      }`}
    >
      <div className="aspect-[4/3] bg-gradient-to-br from-zinc-50 to-zinc-100 overflow-hidden">
        <Image
          src={src}
          alt={alt}
          width={800}
          height={600}
          priority={primary}
          quality={primary ? 88 : 80}
          sizes={
            primary
              ? "(min-width:1024px) 480px, 100vw"
              : "(min-width:1024px) 320px, 100vw"
          }
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </div>
      <div className="px-3 py-2.5 sm:px-4 sm:py-3 text-center">
        <div
          className={`text-sm sm:text-base font-bold ${
            primary ? "text-amber-900" : "text-zinc-900"
          }`}
        >
          {label}
        </div>
        <div className="text-[11px] sm:text-xs text-zinc-600 mt-0.5">{sub}</div>
      </div>
    </div>
  );
}

function MiniPlanCard({
  name,
  price,
  unit,
  features,
  cta,
  ctaHref,
  highlight,
}: {
  name: string;
  price: string;
  unit: string;
  features: string[];
  cta: string;
  ctaHref: string;
  highlight: boolean;
}) {
  return (
    <div
      className={`relative rounded-2xl p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 ${
        highlight
          ? "bg-amber-50 ring-2 ring-amber-500 shadow-md hover:shadow-lg"
          : "bg-white ring-1 ring-stone-200 hover:ring-amber-300 hover:shadow-md"
      }`}
    >
      {highlight && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-amber-700 text-white text-xs font-semibold whitespace-nowrap shadow-sm">
          最多人選
        </span>
      )}
      <div className="text-center">
        <h3 className="font-semibold text-zinc-900 text-lg">{name}</h3>
        <div className="mt-3 flex items-baseline justify-center">
          <span className="font-serif-tc text-4xl font-bold text-amber-800">{price}</span>
          <span className="ml-1 text-sm text-zinc-500">{unit}</span>
        </div>
      </div>
      <ul className="mt-5 space-y-2 text-sm text-zinc-700">
        {features.map((f, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className="text-emerald-600 mt-0.5">✓</span>
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <Link
        href={ctaHref}
        className={`mt-6 block text-center py-2.5 rounded-lg font-semibold text-sm transition ${
          highlight
            ? "bg-amber-700 text-white hover:bg-amber-800 shadow-sm"
            : "bg-zinc-900 text-white hover:bg-zinc-800"
        }`}
      >
        {cta}
      </Link>
    </div>
  );
}


/** section 小標籤 — 木刻感的 eyebrow，置中或靠左 */
function Eyebrow({
  children,
  align = "center",
}: {
  children: React.ReactNode;
  align?: "center" | "left";
}) {
  return (
    <div className={align === "center" ? "text-center" : ""}>
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 ring-1 ring-amber-300 text-amber-800 text-xs font-semibold tracking-wide">
        <span aria-hidden className="w-1.5 h-1.5 rounded-full bg-amber-500" />
        {children}
      </span>
    </div>
  );
}

function PainPoint({ emoji, title, desc }: { emoji: string; title: string; desc: string }) {
  return (
    <div className="group rounded-xl bg-white ring-1 ring-stone-200 shadow-sm p-5 transition-all duration-200 hover:-translate-y-1 hover:shadow-md hover:ring-amber-300">
      <div className="w-12 h-12 rounded-xl bg-amber-50 ring-1 ring-amber-200 flex items-center justify-center text-2xl mb-3">
        {emoji}
      </div>
      <h3 className="font-semibold text-zinc-900 mb-1">{title}</h3>
      <p className="text-sm text-zinc-600 leading-relaxed">{desc}</p>
    </div>
  );
}

function StepCard({
  no,
  title,
  desc,
  visual,
}: {
  no: string;
  title: string;
  desc: string;
  visual?: React.ReactNode;
}) {
  return (
    <div className="group relative rounded-2xl bg-white ring-1 ring-stone-200 shadow-sm p-6 sm:p-7 transition-all duration-200 hover:-translate-y-1 hover:ring-amber-300 hover:shadow-lg">
      <div className="absolute -top-4 left-6 w-10 h-10 rounded-full bg-gradient-to-br from-amber-600 to-amber-800 text-white font-serif-tc font-bold text-lg flex items-center justify-center shadow-md ring-2 ring-white">
        {no}
      </div>
      {visual && (
        <div className="mt-3 mb-4 h-32 rounded-lg bg-gradient-to-br from-zinc-50 to-zinc-100 ring-1 ring-zinc-200/60 overflow-hidden flex items-center justify-center">
          {visual}
        </div>
      )}
      <h3 className="text-lg font-semibold text-zinc-900 group-hover:text-amber-900 transition-colors">
        {title}
      </h3>
      <p className="mt-2 text-sm text-zinc-700 leading-relaxed">{desc}</p>
    </div>
  );
}

/** Step 1 視覺：四個家具縮圖 2×2 */
function StepVisualCatalog() {
  const thumbs = ["stool", "tea-table", "open-bookshelf", "pencil-holder"];
  return (
    <div className="grid grid-cols-2 gap-1.5 p-2 w-full h-full">
      {thumbs.map((s) => (
        <div
          key={s}
          className="rounded bg-white ring-1 ring-zinc-200 flex items-center justify-center p-1"
        >
          <Image
            src={`/thumbs/v2/${s}.webp`}
            alt=""
            width={56}
            height={56}
            quality={70}
            loading="lazy"
            style={{ objectFit: "contain", maxHeight: "100%", maxWidth: "100%" }}
          />
        </div>
      ))}
    </div>
  );
}

/** Step 2 視覺：實際設定面板 + 3D 預覽截圖 */
function StepVisualSliders() {
  return (
    <Image
      src="/about-assets/step-design.png"
      alt="設定面板拉滑桿、3D 即時更新"
      width={600}
      height={300}
      quality={75}
      loading="lazy"
      sizes="(min-width:768px) 320px, 100vw"
      style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center" }}
    />
  );
}

/** Step 3 視覺：實際三視圖截圖 */
function StepVisualPdf() {
  return (
    <Image
      src="/about-assets/feat-threeview.png"
      alt="工程三視圖含尺寸標註"
      width={600}
      height={300}
      quality={75}
      loading="lazy"
      sizes="(min-width:768px) 320px, 100vw"
      style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center" }}
    />
  );
}

function FeatureCard({ emoji, title, desc }: { emoji: string; title: string; desc: string }) {
  return (
    <div className="group rounded-xl bg-amber-50/60 ring-1 ring-amber-200 p-5 transition-all duration-200 hover:-translate-y-1 hover:bg-white hover:ring-amber-300 hover:shadow-md">
      <div className="w-10 h-10 rounded-lg bg-white ring-1 ring-amber-200 flex items-center justify-center text-xl mb-2.5">
        {emoji}
      </div>
      <h3 className="font-semibold text-zinc-900 mb-1 text-sm">{title}</h3>
      <p className="text-xs text-zinc-600 leading-relaxed">{desc}</p>
    </div>
  );
}

function ImageFeatureCard({
  src,
  title,
  desc,
}: {
  src: string;
  title: string;
  desc: string;
}) {
  return (
    <div className="group rounded-xl bg-white ring-1 ring-stone-200 shadow-sm overflow-hidden transition-all duration-200 hover:-translate-y-1 hover:ring-amber-400 hover:shadow-lg">
      <div className="aspect-[16/9] bg-gradient-to-br from-zinc-50 to-zinc-100 overflow-hidden">
        <Image
          src={src}
          alt={title}
          width={800}
          height={450}
          quality={78}
          loading="lazy"
          sizes="(min-width:768px) 480px, 100vw"
          className="transition-transform duration-300 ease-out group-hover:scale-[1.04]"
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </div>
      <div className="p-5">
        <h3 className="font-semibold text-zinc-900 mb-1.5 group-hover:text-amber-900 transition-colors">
          {title}
        </h3>
        <p className="text-sm text-zinc-600 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

function PersonaCard({ emoji, title, desc }: { emoji: string; title: string; desc: string }) {
  return (
    <div className="group rounded-xl bg-white ring-1 ring-stone-200 shadow-sm p-6 transition-all duration-200 hover:-translate-y-1 hover:ring-amber-300 hover:shadow-md">
      <div className="flex items-center gap-3 mb-3">
        <span className="w-12 h-12 rounded-xl bg-amber-50 ring-1 ring-amber-200 flex items-center justify-center text-2xl shrink-0">
          {emoji}
        </span>
        <h3 className="font-semibold text-zinc-900 text-lg">{title}</h3>
      </div>
      <p className="text-sm text-zinc-700 leading-relaxed">{desc}</p>
    </div>
  );
}
