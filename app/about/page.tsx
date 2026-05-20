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

        {/* Hero 主視覺 — 真實 3D 渲染 */}
        <div className="mt-10 sm:mt-12 rounded-2xl overflow-hidden ring-1 ring-zinc-200 shadow-lg bg-gradient-to-br from-zinc-50 to-zinc-100">
          <Image
            src="/about-assets/hero-3d.png"
            alt="木作藍圖 3D 預覽 — 電視櫃實際生成畫面"
            width={1600}
            height={900}
            priority
            quality={85}
            sizes="(min-width: 1024px) 960px, 100vw"
            style={{ width: "100%", height: "auto" }}
          />
        </div>
        <p className="mt-3 text-xs text-zinc-500 text-center">
          ↑ 實際操作畫面：電視櫃 1500×400×500mm，松木，自動產出 3D 透視
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
        <div className="grid sm:grid-cols-3 gap-4">
          <FeatureCard emoji="🔩" title="榫卯細節" desc="通榫、盲榫、半榫位置自動計算，含公榫母榫對位圖。" />
          <FeatureCard emoji="🛠️" title="工具清單" desc="這件家具會用到哪些工具，新手不用瞎買。" />
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
    <div className="rounded-xl bg-white ring-1 ring-zinc-200 p-5 hover:ring-amber-300 transition">
      <div className="text-2xl mb-2">{emoji}</div>
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
    <div className="rounded-xl bg-white ring-1 ring-zinc-200 overflow-hidden hover:ring-amber-300 hover:shadow-md transition">
      <div className="aspect-[16/9] bg-gradient-to-br from-zinc-50 to-zinc-100 overflow-hidden">
        <Image
          src={src}
          alt={title}
          width={800}
          height={450}
          quality={78}
          loading="lazy"
          sizes="(min-width:768px) 480px, 100vw"
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </div>
      <div className="p-5">
        <h3 className="font-semibold text-zinc-900 mb-1.5">{title}</h3>
        <p className="text-sm text-zinc-600 leading-relaxed">{desc}</p>
      </div>
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
