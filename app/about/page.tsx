import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { FURNITURE_CATALOG } from "@/lib/templates";

export const metadata: Metadata = {
  title: "關於 木頭仁 木作藍圖｜輸入尺寸 3 秒生工程圖",
  description:
    "木頭仁木匠學院出品。26 種家具範本，輸入長寬高自動產出三視圖、透視圖、榫卯細節、材料單、工序、A4 PDF 工程圖紙。給 DIY 木工愛好者、木匠師傅、設計接案、學員用。",
  alternates: { canonical: "/about" },
};

const READY_COUNT = FURNITURE_CATALOG.filter((f) => f.template).length;

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
      <section className="text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 ring-1 ring-amber-200 text-amber-800 text-xs font-medium mb-5">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          木頭仁木匠學院 · 木作藍圖
        </div>
        <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-zinc-900 leading-tight">
          從尺寸到圖紙，三秒鐘完成。
        </h1>
        <p className="mt-5 max-w-2xl mx-auto text-lg text-zinc-700 leading-relaxed">
          選一件家具，填長寬高，自動產出 3D 透視圖、工程三視圖、榫卯細節、
          材料單、工序與 A4 PDF 工程圖紙。
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center px-6 py-3 rounded-lg bg-amber-700 text-white font-semibold hover:bg-amber-800 shadow-sm"
          >
            開始設計（免費試用）→
          </Link>
          <Link
            href="/pricing"
            className="inline-flex items-center px-6 py-3 rounded-lg bg-white text-zinc-900 font-semibold ring-1 ring-zinc-300 hover:bg-zinc-50"
          >
            看付費方案
          </Link>
        </div>
        <p className="mt-3 text-xs text-zinc-500">
          免費版可試用 3 件家具範本，不需信用卡。
        </p>
      </section>

      {/* ============ Thumb mosaic：26 件視覺證明 ============ */}
      <section className="mt-16 sm:mt-20">
        <p className="text-center text-zinc-600 mb-6 text-sm sm:text-base">
          目前內建 <strong className="text-zinc-900">{READY_COUNT}</strong> 種家具範本，
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
          這只是其中 12 件，<Link href="/" className="underline hover:text-zinc-900">看全部 {READY_COUNT} 種</Link>
        </p>
      </section>

      {/* ============ 痛點 ============ */}
      <section className="mt-20 sm:mt-24">
        <h2 className="text-2xl sm:text-3xl font-bold text-zinc-900 text-center">
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
          木作藍圖把這三件事壓進 3 秒鐘。
        </p>
      </section>

      {/* ============ 三步驟 ============ */}
      <section className="mt-20 sm:mt-24">
        <h2 className="text-2xl sm:text-3xl font-bold text-zinc-900 text-center mb-12">
          三步驟，從零到工坊
        </h2>
        <div className="grid md:grid-cols-3 gap-6 sm:gap-8">
          <StepCard
            no="1"
            title="選範本"
            desc={`從 ${READY_COUNT} 種家具範本選一件。方凳、餐椅、書桌、衣櫃、紅酒架、筆筒…從入門到進階都有。`}
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
        <h2 className="text-2xl sm:text-3xl font-bold text-zinc-900 text-center mb-3">
          每一件家具都附這些
        </h2>
        <p className="text-center text-zinc-600 mb-10">
          不只是設計圖，是一整套可以直接開工的施作包。
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <FeatureCard emoji="🪑" title="3D 透視圖" desc="即時 3D 預覽，可拖曳旋轉、放大檢視榫卯細節。" />
          <FeatureCard emoji="📐" title="三視圖" desc="正面、側面、上視，含尺寸標註，符合工程製圖慣例。" />
          <FeatureCard emoji="🔩" title="榫卯細節" desc="通榫、盲榫、半榫位置自動計算，含公榫母榫對位圖。" />
          <FeatureCard emoji="📋" title="切料清單" desc="每塊料的長寬厚、台才數，已內建台灣木匠慣例預留。" />
          <FeatureCard emoji="🛠️" title="工具清單" desc="這件家具會用到哪些工具，新手不用瞎買。" />
          <FeatureCard emoji="📑" title="製作工序" desc="先做哪、後做哪、何時上膠夾合，按順序往下做就對。" />
          <FeatureCard emoji="📄" title="A4 PDF 圖紙" desc="一鍵列印施工圖，工坊牆上一貼就能照做。" />
          <FeatureCard emoji="💰" title="工時報價" desc="家具報價、人工估算、塗裝費，接案直接拿給客戶看。" />
          <FeatureCard emoji="🎲" title="STL 3D 輸出" desc="可在 SketchUp、3D 列印機開啟，做縮小模型先打樣。" />
        </div>
      </section>

      {/* ============ 適合誰 ============ */}
      <section className="mt-20 sm:mt-24">
        <h2 className="text-2xl sm:text-3xl font-bold text-zinc-900 text-center mb-12">
          給這四種人用
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
            desc="客戶來問「做一個這樣的櫃子要多少」，5 分鐘出設計+報價+工序，回得比同行快。"
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
            <h2 className="text-2xl sm:text-3xl font-bold text-zinc-900">
              木頭仁 是誰
            </h2>
            <p className="mt-4 text-zinc-800 leading-relaxed">
              台灣木工 YouTuber「<strong>木頭仁 Wooden Ren</strong>」，
              YouTube 頻道約 <strong>20 萬訂閱</strong>，
              專注木工教學與工具評測超過十年。
              旗下「<strong>木頭仁木匠學院</strong>」開設線上線下木工課程，
              學員遍及全台灣。
            </p>
            <p className="mt-3 text-zinc-700 leading-relaxed text-sm">
              木作藍圖是把多年教學累積的「家具尺寸慣例 / 榫卯規則 / 工序邏輯」
              寫成的工具——每一條規則背後都有實際做過的木工經驗。
            </p>
            <div className="mt-5 flex flex-wrap gap-3 justify-center md:justify-start">
              <a
                href="https://www.youtube.com/@WoodenRen"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700"
              >
                YouTube 頻道 →
              </a>
              <a
                href="https://woodenrenclass.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-4 py-2 rounded-lg bg-white text-zinc-900 text-sm font-semibold ring-1 ring-zinc-300 hover:bg-zinc-50"
              >
                木匠學院 →
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ============ 方案 CTA ============ */}
      <section className="mt-20 sm:mt-24 text-center">
        <h2 className="text-2xl sm:text-3xl font-bold text-zinc-900">
          從免費開始，需要再升級
        </h2>
        <p className="mt-4 max-w-xl mx-auto text-zinc-700 leading-relaxed">
          免費版可試用 3 件家具範本不限次數。
          想用完整 {READY_COUNT} 件、開放儲存設計、進階家具（衣櫃、餐桌…），再升級個人版或專業版。
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center px-6 py-3 rounded-lg bg-amber-700 text-white font-semibold hover:bg-amber-800 shadow-sm"
          >
            立刻開始設計 →
          </Link>
          <Link
            href="/pricing"
            className="inline-flex items-center px-6 py-3 rounded-lg bg-white text-zinc-900 font-semibold ring-1 ring-zinc-300 hover:bg-zinc-50"
          >
            看方案與價格
          </Link>
        </div>
        <p className="mt-6 text-xs text-zinc-500">
          有問題？看 <Link href="/help" className="underline hover:text-zinc-900">常見問題</Link>
          {" · "}
          或<Link href="/contact" className="underline hover:text-zinc-900">聯絡我們</Link>
        </p>
      </section>
    </main>
  );
}

function PainPoint({ emoji, title, desc }: { emoji: string; title: string; desc: string }) {
  return (
    <div className="rounded-xl bg-white ring-1 ring-zinc-200 p-5">
      <div className="text-3xl mb-2">{emoji}</div>
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
    <div className="relative rounded-xl bg-white ring-1 ring-zinc-200 p-6 sm:p-7 hover:ring-amber-300 hover:shadow-md transition">
      <div className="absolute -top-4 left-6 w-9 h-9 rounded-full bg-amber-700 text-white font-bold text-lg flex items-center justify-center shadow">
        {no}
      </div>
      {visual && (
        <div className="mt-2 mb-4 h-32 rounded-lg bg-gradient-to-br from-zinc-50 to-zinc-100 ring-1 ring-zinc-200/60 overflow-hidden flex items-center justify-center">
          {visual}
        </div>
      )}
      <h3 className="text-lg font-semibold text-zinc-900">{title}</h3>
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

/** Step 2 視覺：滑桿 + 3D 縮圖示意（SVG） */
function StepVisualSliders() {
  return (
    <svg
      viewBox="0 0 200 110"
      className="w-full h-full p-3"
      aria-hidden
    >
      {/* 三個滑桿 */}
      {[20, 45, 70].map((y, i) => (
        <g key={i}>
          <rect x="14" y={y} width="80" height="3" rx="1.5" fill="#e4e4e7" />
          <rect x="14" y={y} width={[55, 30, 65][i]} height="3" rx="1.5" fill="#b45309" />
          <circle cx={14 + [55, 30, 65][i]} cy={y + 1.5} r="4" fill="#b45309" />
          <text x="14" y={y - 4} fontSize="6" fill="#71717a" fontFamily="system-ui">
            {["長", "寬", "高"][i]}
          </text>
        </g>
      ))}
      {/* 3D 凳子示意 */}
      <g transform="translate(125 25)">
        <polygon
          points="0,15 50,0 60,5 10,20"
          fill="#d6a87a"
          stroke="#92400e"
          strokeWidth="0.8"
        />
        <polygon
          points="10,20 60,5 60,55 10,70"
          fill="#a0784c"
          stroke="#92400e"
          strokeWidth="0.8"
        />
        <polygon
          points="0,15 10,20 10,70 0,65"
          fill="#7a5837"
          stroke="#92400e"
          strokeWidth="0.8"
        />
        {/* 腳 */}
        <line x1="6" y1="65" x2="6" y2="78" stroke="#5c3e26" strokeWidth="2" />
        <line x1="56" y1="55" x2="56" y2="68" stroke="#5c3e26" strokeWidth="2" />
      </g>
    </svg>
  );
}

/** Step 3 視覺：A4 圖紙 + 三視圖示意（SVG） */
function StepVisualPdf() {
  return (
    <svg viewBox="0 0 200 110" className="w-full h-full p-3" aria-hidden>
      {/* A4 紙 */}
      <rect
        x="10"
        y="10"
        width="180"
        height="90"
        rx="2"
        fill="white"
        stroke="#a1a1aa"
        strokeWidth="0.6"
      />
      {/* 標題列 */}
      <line x1="10" y1="22" x2="190" y2="22" stroke="#d4d4d8" strokeWidth="0.4" />
      <rect x="14" y="14" width="40" height="4" fill="#71717a" />
      {/* 三視圖：俯/正/側 */}
      <rect x="18" y="30" width="48" height="32" fill="none" stroke="#52525b" strokeWidth="0.6" />
      <rect x="74" y="30" width="48" height="32" fill="none" stroke="#52525b" strokeWidth="0.6" />
      <rect x="130" y="30" width="48" height="32" fill="none" stroke="#52525b" strokeWidth="0.6" />
      {/* 凳子 silhouette in middle */}
      <g transform="translate(82 38)">
        <rect x="0" y="0" width="32" height="3" fill="#92400e" />
        <line x1="4" y1="3" x2="4" y2="20" stroke="#92400e" strokeWidth="1.5" />
        <line x1="28" y1="3" x2="28" y2="20" stroke="#92400e" strokeWidth="1.5" />
        <line x1="4" y1="14" x2="28" y2="14" stroke="#92400e" strokeWidth="0.8" />
      </g>
      {/* 標註線 */}
      <line x1="74" y1="68" x2="122" y2="68" stroke="#b45309" strokeWidth="0.4" />
      <line x1="74" y1="66" x2="74" y2="70" stroke="#b45309" strokeWidth="0.4" />
      <line x1="122" y1="66" x2="122" y2="70" stroke="#b45309" strokeWidth="0.4" />
      <text x="92" y="76" fontSize="5" fill="#b45309" fontFamily="system-ui">350mm</text>
      {/* 切料清單列 */}
      <rect x="14" y="74" width="172" height="2" fill="#e4e4e7" />
      <rect x="14" y="80" width="120" height="2" fill="#e4e4e7" />
      <rect x="14" y="86" width="150" height="2" fill="#e4e4e7" />
      <rect x="14" y="92" width="90" height="2" fill="#e4e4e7" />
    </svg>
  );
}

function FeatureCard({ emoji, title, desc }: { emoji: string; title: string; desc: string }) {
  return (
    <div className="rounded-xl bg-white ring-1 ring-zinc-200 p-5 hover:ring-amber-300 transition">
      <div className="text-2xl mb-2">{emoji}</div>
      <h3 className="font-semibold text-zinc-900 mb-1 text-sm">{title}</h3>
      <p className="text-xs text-zinc-600 leading-relaxed">{desc}</p>
    </div>
  );
}

function PersonaCard({ emoji, title, desc }: { emoji: string; title: string; desc: string }) {
  return (
    <div className="rounded-xl bg-white ring-1 ring-zinc-200 p-6 hover:ring-amber-300 transition">
      <div className="flex items-center gap-3 mb-3">
        <span className="text-3xl">{emoji}</span>
        <h3 className="font-semibold text-zinc-900 text-lg">{title}</h3>
      </div>
      <p className="text-sm text-zinc-700 leading-relaxed">{desc}</p>
    </div>
  );
}
