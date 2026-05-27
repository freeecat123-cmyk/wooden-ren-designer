/**
 * /raised-floor — 訪客銷售頁
 *
 * 渲染條件:未登入 OR 已登入但沒解鎖。
 * 已登入有權限者由 page.tsx 直送 <RaisedFloorClient />。
 */
import Link from "next/link";
import Image from "next/image";
import { ShareButtons } from "@/components/ShareButtons";

type UserStatus = "guest" | "loggedInNoAccess";

interface Props {
  status: UserStatus;
}

const PRICE_PER_PING = 8500; // 市場行情粗估,展示用,實際以工具計算為準
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://designer.woodenren.com";

const PARAMETERS = [
  { label: "平台形狀（矩形 / L 形）", desc: "拉長寬即時看 3D，L 形可加凹角閃柱、樑、窗框。" },
  { label: "平台高度（H）", desc: "30–60cm 自由設，超過 60cm 系統會提示加副柱避免晃動。" },
  { label: "挨柱（0–2 根）", desc: "室內柱位置往內凹挖一塊矩形，柱邊預留 5mm 縫不卡。" },
  { label: "面材規格", desc: "超耐磨 / 海島型 / 實木三選一，片長片寬可調，比比看哪款省料。" },
  { label: "拼板款式（5 種）", desc: "直鋪、1/2 錯縫、1/3 錯縫、人字拼、Herringbone V 型，起鋪角獨立設。" },
  { label: "骨架主支間距", desc: "依夾板短邊 ÷ N 反推間距，板拼縫剛好落在主支中心線。" },
  { label: "骨架副支間距", desc: "30 / 40 / 45cm 三檔，跨距越大用越粗的角材。" },
  { label: "夾板規格（4×8 / 3×6）", desc: "兩種規格都能切換看哪款省料，自動 2D 拼板。" },
  { label: "防潮墊規格", desc: "PE / EPE / Tyvek 三種選一，卷長卷寬不同自動算卷數。" },
  { label: "踢腳板（高度 / 門洞）", desc: "踢腳板高度可設，門洞位置標出後系統自動扣總長。" },
];

const AUTO_OUTPUTS = [
  { icon: "🪵", title: "骨架 BOM", body: "頂框、底框、主支、副支各幾米幾根，台尺/英呎雙標。" },
  { icon: "📦", title: "夾板拼板圖", body: "2D guillotine FFD 自動拼，標料 1-2-3 編號，料行直接讀。" },
  { icon: "🛡️", title: "防潮墊卷數", body: "依平台坪數+卷規格無條件進位，門洞自動扣。" },
  { icon: "🎨", title: "面材片數", body: "起鋪角、伸縮縫、5 種拼板款式都算進損耗。" },
  { icon: "🧾", title: "A4 客戶報價單", body: "客戶資料 + 品項 + 總計 + 條款 + 簽章，一頁印出。" },
  { icon: "📊", title: "BOM CSV 匯出", body: "Excel 開沒亂碼，工班直接抓料用。" },
];

const SCENARIOS = [
  {
    tag: "🔨 接案現場",
    body: "客戶問「3 米 × 4 米和室一坪多少」，你掏手機 30 秒掃出 3D 跟 A4 報價單，當場 close。改尺寸馬上重算，不用回工作室再開 Excel。",
  },
  {
    tag: "🏠 DIY 自己做",
    body: "想做臥鋪、客房和室、收納地台，自己畫平台 → 系統告訴你要訂幾根 12 尺角材、幾片夾板、防潮墊幾卷，直接去料行不再問師傅。",
  },
  {
    tag: "🪜 設計師提案",
    body: "和室提案放 3D + 報價單，比競爭對手多一頁紙就贏一單。客戶喊「我要改 50cm 高」當場改，提案不過夜。",
  },
  {
    tag: "🎓 木匠學院學員",
    body: "課程學的骨架邏輯、夾板拼縫對齊、防潮層原理，這支工具讓你看「演算法怎麼算」，從練手到接案無縫接軌。",
  },
];

const FAQS = [
  {
    q: "跟「地板施工模擬器」差在哪?",
    a: "地板模擬器算的是平鋪木地板(超耐磨 / 海島型)、無骨架。架高平台是 30cm 以上的台座,有頂框、底框、主支、副支、夾板、防潮墊、踢腳板,屬於和室 / 榻榻米下層 / 客房臥鋪的木工工法。兩者共用同一把解鎖鑰匙,買一個解兩個。",
  },
  {
    q: "夾板拼板真的省得到料嗎?",
    a: "實測:11 片裁切片走 2D guillotine 自動湊,3 米 × 4 米和室原本「8 片整片 + 11 片裁切」會被料行報「19 片夾板」,系統算完是「8 片整片 + 4 張新料切 11 片」共 12 張。省 7 張(約 35%),金額 NT$ 3,500 起跳。",
  },
  {
    q: "報價會準嗎?",
    a: "材料量算到的是 BOM 級準度(主支幾米、夾板幾片、防潮墊幾卷,單位都對)。單價用你自己料行的進價、工錢自己設。系統不偷塞「行情價」灌水,所有單價欄都是空白讓你填——你填多少就算多少。",
  },
  {
    q: "可以匯出 PDF / CSV 嗎?",
    a: "A4 報價單直接走瀏覽器列印 → 另存 PDF,LOGO / 公司資料 / 條款都在「品牌客製」面板填過一次就一直用。BOM 走 CSV 匯出,Excel 開沒亂碼。",
  },
  {
    q: "工具錢多少?",
    a: "個人版 NT$ 390/月,含全 26 個家具範本 + 天花板骨架 + 地板模擬器 + 架高平台,所有工具全給。專業版 NT$ 890/月 多了客戶報價系統 + STL/CNC 輸出 + 尺寸無上限。",
  },
  {
    q: "可以單買架高平台這個工具嗎?",
    a: "可以。架高平台跟地板模擬器共用「floor」這個解鎖鑰匙,單買解鎖兩個工具。價格在 /pricing 頁面。",
  },
  {
    q: "我家不是規矩矩形,L 形以外能算嗎?",
    a: "目前 v1 只支援矩形、L 形 + 最多 2 個挨柱凹陷。非正交多邊形(斜牆、ㄇ 字形、十字形)正在排,跟地板模擬器同一波會補上,屆時無痛升級。",
  },
  {
    q: "工具會持續更新嗎?",
    a: "會。本工具 2026-05 才上線,3D 圖層、夾板拼板演算法、施工步驟卡片、防潮墊 catalog 都是上線 2 週內補進去的。改進方向:多挨柱、斜邊平台、人字拼面材、現場開孔(燈具/插座)。",
  },
];

const RELATED_TOOLS = [
  {
    href: "/floor",
    emoji: "🪵",
    title: "地板施工模擬器",
    body: "平鋪木地板算料 + 5 種拼板款式 + A4 報價單。跟架高平台共用一把鑰匙。",
  },
  {
    href: "/ceiling",
    emoji: "🔨",
    title: "天花板骨架施工模擬器",
    body: "角材井字 + 矽酸鈣板拼板 + 吊筋。客戶要「天地一起做」一站搞定。",
  },
  {
    href: "/templates",
    emoji: "🪑",
    title: "26 件家具範本",
    body: "從筆筒到衣櫃，設計師接案常搭一起出。",
  },
];

export function RaisedFloorMarketing({ status }: Props) {
  const primaryHref =
    status === "guest"
      ? "/login?next=/raised-floor"
      : "/pricing?upgrade=floor";
  const primaryLabel =
    status === "guest" ? "登入開始試算" : "升級個人版解鎖";
  const secondaryHref = "/pricing";
  const secondaryLabel = "查看方案";
  const pageUrl = `${SITE_URL}/raised-floor`;

  const productSchema = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: "和室架高平台估價工具",
    description:
      "畫平台 → 算骨架、夾板、面材、防潮、踢腳 → 出 A4 客戶報價單。木工師傅、統包、DIY 一次搞定。",
    image: `${SITE_URL}/thumbs/v2/ceiling.webp`,
    brand: { "@type": "Brand", name: "木頭仁木匠學院" },
    offers: {
      "@type": "Offer",
      price: "390",
      priceCurrency: "TWD",
      availability: "https://schema.org/InStock",
      url: `${SITE_URL}/pricing`,
    },
  };
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "首頁", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "範本介紹", item: `${SITE_URL}/templates` },
      { "@type": "ListItem", position: 3, name: "和室架高平台估價", item: pageUrl },
    ],
  };
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <main className="bg-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      {/* ============ Breadcrumb ============ */}
      <nav className="max-w-6xl mx-auto px-5 sm:px-6 pt-6 pb-2 text-sm text-zinc-500">
        <Link href="/" className="hover:text-amber-700">首頁</Link>
        <span className="mx-2">/</span>
        <Link href="/templates" className="hover:text-amber-700">範本介紹</Link>
        <span className="mx-2">/</span>
        <span className="text-zinc-700 font-medium">和室架高平台估價</span>
      </nav>

      {/* ============ Hero ============ */}
      <section className="relative overflow-hidden bg-gradient-to-br from-amber-50 via-white to-stone-100 border-b border-stone-200">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-24 w-96 h-96 rounded-full bg-amber-200/40 blur-3xl"
        />
        <div className="relative max-w-6xl mx-auto px-5 sm:px-6 py-12 sm:py-20">
          <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">
            <div>
              <div className="flex flex-wrap gap-2 mb-5">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 ring-1 ring-amber-300 text-amber-900 text-xs font-bold">
                  🏯 裝潢工具
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white ring-1 ring-stone-300 text-zinc-700 text-xs font-bold">
                  個人版 / 專業版
                </span>
              </div>
              <h1 className="font-serif-tc text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-zinc-900 leading-[1.15]">
                和室架高平台估價工具
              </h1>
              <p className="mt-4 text-xl text-amber-800 font-semibold leading-relaxed">
                畫出平台 → 自動算骨架、夾板、面材、防潮、踢腳板 →<br className="hidden sm:inline" />
                直接出 A4 客戶報價單。
              </p>
              <p className="mt-3 text-zinc-600 leading-relaxed">
                師傅算料一張紙慢慢加 30 分鐘的事,在這 30 秒結束。主支對齊夾板、
                2D 拼板自動湊餘料、防潮墊卷數無條件進位,連門洞扣踢腳板都自動算。
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link
                  href={primaryHref}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-amber-700 text-white font-semibold shadow-lg shadow-amber-700/30 hover:bg-amber-800 hover:-translate-y-0.5 transition-all"
                >
                  {primaryLabel} →
                </Link>
                <Link
                  href={secondaryHref}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white text-zinc-800 font-semibold ring-1 ring-stone-300 hover:ring-amber-500 hover:text-amber-800 transition-all"
                >
                  {secondaryLabel}
                </Link>
              </div>
              <p className="mt-4 text-xs text-zinc-500">
                跟「地板施工模擬器」共用解鎖鑰匙,買一個解兩個。
              </p>
              <div className="mt-5">
                <ShareButtons
                  url={pageUrl}
                  title="和室架高平台估價工具｜畫平台 → 算骨架夾板防潮 → 出 A4 報價單"
                />
              </div>
            </div>
            <div className="relative">
              <div className="rounded-3xl bg-white ring-1 ring-amber-200 shadow-2xl overflow-hidden p-8">
                <div className="aspect-[5/4] flex items-center justify-center bg-gradient-to-br from-stone-50 to-amber-50/30 rounded-2xl">
                  <svg
                    viewBox="0 0 200 160"
                    className="w-[88%] h-[88%]"
                    aria-label="架高平台側視示意"
                  >
                    {/* 平台板面 */}
                    <rect x={18} y={36} width={164} height={20} rx={1.5} fill="#e7d8ae" stroke="#bd9955" strokeWidth={1.5} />
                    {/* 骨架支柱 */}
                    {[26, 64, 104, 144, 174].map((x) => (
                      <rect key={x} x={x - 4} y={56} width={8} height={68} fill="#bd9955" />
                    ))}
                    {/* 地面 */}
                    <line x1={10} y1={124} x2={190} y2={124} stroke="#666" strokeWidth={2} />
                    {/* 內部骨架(虛線) */}
                    {[48, 70, 92, 114].map((y) => (
                      <line key={y} x1={18} y1={y} x2={182} y2={y} stroke="#c9a86b" strokeWidth={1} strokeDasharray="3 2" />
                    ))}
                    {/* 尺寸線 */}
                    <line x1={18} y1={142} x2={182} y2={142} stroke="#999" strokeWidth={1} markerEnd="url(#arr)" markerStart="url(#arr)" />
                    <text x={100} y={156} textAnchor="middle" fontSize={10} fill="#666" fontFamily="sans-serif">總長 W</text>
                    <line x1={195} y1={36} x2={195} y2={124} stroke="#999" strokeWidth={1} markerEnd="url(#arr)" markerStart="url(#arr)" />
                    <text x={199} y={84} textAnchor="start" fontSize={10} fill="#666" fontFamily="sans-serif">H</text>
                    <defs>
                      <marker id="arr" markerWidth={6} markerHeight={6} refX={3} refY={3} orient="auto">
                        <path d="M0,0 L6,3 L0,6 z" fill="#999" />
                      </marker>
                    </defs>
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ 痛點 ============ */}
      <section className="bg-white border-b border-stone-200">
        <div className="max-w-5xl mx-auto px-5 sm:px-6 py-14 sm:py-20">
          <h2 className="font-serif-tc text-2xl sm:text-3xl font-bold text-zinc-900 text-center mb-3">
            做和室、架高平台,你最頭痛這 4 件事
          </h2>
          <p className="text-center text-zinc-500 mb-10">
            這工具就是衝著它們做的
          </p>
          <div className="grid sm:grid-cols-2 gap-5">
            {[
              {
                emoji: "🤯",
                title: "算料燒腦,常多訂或漏訂",
                body: "主支幾根、副支幾根、夾板幾片、防潮墊幾卷,每樣不同單位、不同邏輯。一根筆一張紙加 30 分鐘還可能算錯。",
              },
              {
                emoji: "📐",
                title: "夾板接縫不落在骨架上",
                body: "主副支間距亂設,夾板拼到一半接縫飄在半空中、要再加角材補,木料浪費還浪費工時。",
              },
              {
                emoji: "📦",
                title: "夾板訂太多,剩料堆倉庫",
                body: "11 片裁切片明明可以拼 4 張新料,沒系統算 2D packing 就照「片數 × 1.2 損耗」訂 → 多訂 30%。",
              },
              {
                emoji: "📄",
                title: "客戶報價單還要 Excel 慢慢排",
                body: "算完料還要打 Excel、貼 LOGO、排 A4,大半天才一張。改個尺寸全部重來。",
              },
            ].map((p) => (
              <div
                key={p.title}
                className="rounded-2xl bg-stone-50 ring-1 ring-stone-200 p-6 hover:ring-amber-400 hover:bg-amber-50/40 transition-all"
              >
                <div className="text-3xl mb-2">{p.emoji}</div>
                <div className="font-bold text-zinc-900 mb-1.5">{p.title}</div>
                <div className="text-sm text-zinc-600 leading-relaxed">{p.body}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ 功能 ============ */}
      <section className="bg-gradient-to-b from-stone-50 to-white border-b border-stone-200">
        <div className="max-w-6xl mx-auto px-5 sm:px-6 py-14 sm:py-20">
          <h2 className="font-serif-tc text-2xl sm:text-3xl font-bold text-zinc-900 text-center mb-3">
            這支工具做什麼
          </h2>
          <p className="text-center text-zinc-500 mb-10">
            從平台形狀 → BOM → 報價單,一條龍
          </p>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              {
                emoji: "📐",
                title: "平台形狀:矩形 / L 形 + 挨柱",
                body: "拉長寬高、L 形凹角、0–2 根室內柱往內凹挖,3D 即時跟著變。",
              },
              {
                emoji: "🪵",
                title: "面材:超耐磨 / 海島型 / 實木",
                body: "片長片寬可調、5 種起鋪角、長短軸轉向、伸縮縫 mm 級設定。",
              },
              {
                emoji: "🧱",
                title: "骨架自動對齊夾板",
                body: "主支沿夾板短邊等分、副支沿長邊等分,夾板接縫剛好落在骨架中心,zero snap waste。",
              },
              {
                emoji: "📦",
                title: "夾板 2D 智慧拼板",
                body: "11 片裁切片自動 guillotine FFD 拼進 4 張新料,標料 1-2-3 編號,料行直接讀。",
              },
              {
                emoji: "🛡️",
                title: "防潮墊 + 踢腳板",
                body: "PE / EPE / Tyvek 三規格,卷數自動算。踢腳板自動扣門洞長度。",
              },
              {
                emoji: "🧾",
                title: "A4 報價單一鍵出",
                body: "客戶資料、品項、總計、條款、簽章,4 欄三表格一頁搞定。CSV 匯出 BOM 給工人。",
              },
            ].map((f) => (
              <div
                key={f.title}
                className="rounded-2xl bg-white ring-1 ring-stone-200 p-6 shadow-sm hover:shadow-lg hover:ring-amber-400 hover:-translate-y-0.5 transition-all"
              >
                <div className="text-3xl mb-2">{f.emoji}</div>
                <div className="font-bold text-zinc-900 mb-1.5">{f.title}</div>
                <div className="text-sm text-zinc-600 leading-relaxed">{f.body}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ 可調參數 ============ */}
      <section className="bg-white border-b border-stone-200">
        <div className="max-w-3xl mx-auto px-5 sm:px-6 py-14 sm:py-20">
          <h2 className="font-serif-tc text-2xl sm:text-3xl font-bold text-zinc-900 mb-3">
            你可以調整這些參數
          </h2>
          <p className="text-zinc-500 mb-7">
            演算法自動算骨架、夾板拼縫、面材排版、防潮卷數。
          </p>
          <div className="space-y-3">
            {PARAMETERS.map((p) => (
              <div
                key={p.label}
                className="rounded-xl bg-stone-50 ring-1 ring-stone-200 p-5 hover:ring-amber-300 transition-colors"
              >
                <div className="font-bold text-zinc-900 mb-1">{p.label}</div>
                <div className="text-sm text-zinc-600 leading-relaxed">{p.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ 自動產出 ============ */}
      <section className="bg-gradient-to-b from-white to-amber-50/30 border-b border-amber-100">
        <div className="max-w-3xl mx-auto px-5 sm:px-6 py-14 sm:py-20">
          <h2 className="font-serif-tc text-2xl sm:text-3xl font-bold text-zinc-900 mb-3">
            輸入完成,自動產出
          </h2>
          <p className="text-zinc-500 mb-7">
            6 件事一次出齊,列印 A4 直接帶進工坊或交給客戶。
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            {AUTO_OUTPUTS.map((o) => (
              <div key={o.title} className="rounded-xl bg-white ring-1 ring-stone-200 p-4">
                <div className="flex items-start gap-3">
                  <div className="text-2xl shrink-0">{o.icon}</div>
                  <div>
                    <div className="font-bold text-zinc-900 mb-0.5">{o.title}</div>
                    <div className="text-xs text-zinc-600 leading-relaxed">{o.body}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ 實際輸出畫面 ============ */}
      <section className="bg-white border-b border-stone-200">
        <div className="max-w-6xl mx-auto px-5 sm:px-6 py-14 sm:py-20">
          <h2 className="font-serif-tc text-2xl sm:text-3xl font-bold text-zinc-900 text-center mb-2">
            實際輸出畫面
          </h2>
          <p className="text-center text-zinc-500 mb-9">
            以下都是工具實際生成的畫面,套你的尺寸後即時更新。
          </p>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              {
                img: "/showcase/raised-floor-overview.png",
                label: "骨架 2D + 挨柱",
                desc: "矩形 / L 形 + 0~2 根挨柱凹陷,主支沿短邊、副支沿長邊自動等分。",
              },
              {
                img: "/showcase/raised-floor-3d.png",
                label: "3D 爆炸圖",
                desc: "頂框、底框、夾板、面材分層展開,客戶秒懂為什麼一坪要 NT$ 8,000+。",
              },
              {
                img: "/showcase/raised-floor-surface.png",
                label: "面材拼花 2D",
                desc: "起鋪角、伸縮縫、長短軸方向自動算進去,客戶選款式直接看。",
              },
            ].map((s) => (
              <figure
                key={s.label}
                className="group rounded-2xl bg-white ring-1 ring-stone-200 overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 hover:ring-amber-400 transition-all"
              >
                <div className="relative aspect-[4/3] bg-gradient-to-br from-stone-50 to-amber-50/20 overflow-hidden">
                  <Image
                    src={s.img}
                    alt={s.label}
                    fill
                    sizes="(min-width:1024px) 33vw, (min-width:768px) 50vw, 100vw"
                    className="object-contain p-2 group-hover:scale-[1.02] transition-transform duration-300"
                  />
                </div>
                <figcaption className="p-4 border-t border-amber-100 bg-amber-50">
                  <div className="font-bold text-zinc-900 mb-0.5">{s.label}</div>
                  <div className="text-xs text-zinc-600 leading-relaxed">{s.desc}</div>
                </figcaption>
              </figure>
            ))}
          </div>
          <p className="mt-6 text-center text-xs text-zinc-400">
            ※ 改尺寸 / 換面材 / 挨柱數量變化時,這些圖都會即時重算
          </p>
        </div>
      </section>

      {/* ============ 適合誰 ============ */}
      <section className="bg-stone-50 border-b border-stone-200">
        <div className="max-w-5xl mx-auto px-5 sm:px-6 py-14 sm:py-20">
          <h2 className="font-serif-tc text-2xl sm:text-3xl font-bold text-zinc-900 text-center mb-10">
            適合哪些人
          </h2>
          <div className="grid sm:grid-cols-2 gap-5">
            {[
              {
                emoji: "🔨",
                title: "木工師傅 / 統包",
                body: "客戶問「和室一坪多少」當場掏手機算,改尺寸馬上重出報價單。",
              },
              {
                emoji: "🏠",
                title: "DIY 自己做和室",
                body: "看完料表直接去料行,不用問師傅、不用 Excel,連夾板怎麼拼都告訴你。",
              },
              {
                emoji: "🪜",
                title: "裝潢設計師",
                body: "提案時放一張 3D + 報價單,客戶當場 close。",
              },
              {
                emoji: "🎓",
                title: "木匠學院學員",
                body: "把課程學到的骨架邏輯實際算一遍,從練手到接案無縫接軌。",
              },
            ].map((p) => (
              <div
                key={p.title}
                className="rounded-2xl bg-white ring-1 ring-stone-200 p-6 flex gap-4 items-start"
              >
                <div className="text-3xl shrink-0">{p.emoji}</div>
                <div>
                  <div className="font-bold text-zinc-900 mb-1">{p.title}</div>
                  <div className="text-sm text-zinc-600 leading-relaxed">{p.body}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-10 rounded-2xl bg-white ring-1 ring-stone-200 p-6">
            <div className="font-semibold text-zinc-900 mb-2">
              ⚠️ 這幾種狀況不要用
            </div>
            <ul className="text-sm text-zinc-600 space-y-1.5 list-disc pl-5">
              <li>非正交多邊形平台(斜牆、圓弧、不規則邊)— 目前只支援矩形跟 L 形</li>
              <li>挨柱超過 2 根 — 多柱要手動拆段</li>
              <li>需要榻榻米/疊蓆專用尺寸精算 — 本工具算骨架夾板,不算榻榻米</li>
              <li>已有 CAD/Revit 工作流程 — 本工具補的是「沒 CAD 但要算料」的洞</li>
            </ul>
          </div>
        </div>
      </section>

      {/* ============ 使用情境 ============ */}
      <section className="bg-white border-b border-stone-200">
        <div className="max-w-3xl mx-auto px-5 sm:px-6 py-14 sm:py-20">
          <h2 className="font-serif-tc text-2xl sm:text-3xl font-bold text-zinc-900 mb-7">
            什麼時候會用到
          </h2>
          <div className="space-y-3">
            {SCENARIOS.map((s) => (
              <div key={s.tag} className="rounded-2xl bg-stone-50 ring-1 ring-stone-200 p-5">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-100 ring-1 ring-amber-300 text-amber-800 text-xs font-bold mb-3">
                  {s.tag}
                </div>
                <p className="text-zinc-700 leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ FAQ ============ */}
      <section className="bg-stone-50 border-b border-stone-200">
        <div className="max-w-3xl mx-auto px-5 sm:px-6 py-14 sm:py-20">
          <h2 className="font-serif-tc text-2xl sm:text-3xl font-bold text-zinc-900 mb-8 text-center">
            常見問題
          </h2>
          <div className="space-y-3">
            {FAQS.map((f) => (
              <details
                key={f.q}
                className="rounded-xl bg-white ring-1 ring-stone-200 hover:ring-amber-300 transition-all group"
              >
                <summary className="cursor-pointer list-none px-5 py-4 flex items-center justify-between gap-3 text-zinc-900 font-semibold">
                  <span>{f.q}</span>
                  <span className="text-amber-700 text-sm shrink-0 group-open:rotate-180 transition-transform">
                    ▾
                  </span>
                </summary>
                <div className="px-5 pb-4 -mt-1 text-sm text-zinc-600 leading-relaxed">
                  {f.a}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ============ 如何取得 ============ */}
      <section className="bg-gradient-to-b from-amber-50/30 to-white border-b border-amber-100">
        <div className="max-w-4xl mx-auto px-5 sm:px-6 py-14 sm:py-20">
          <h2 className="font-serif-tc text-2xl sm:text-3xl font-bold text-zinc-900 text-center mb-2">
            如何取得「架高平台估價」
          </h2>
          <p className="text-center text-zinc-500 text-sm mb-9">
            三種解鎖方式擇一,跟地板模擬器共用鑰匙
          </p>
          <div className="grid md:grid-cols-3 gap-4">
            <PricingTier
              badge="單買"
              title="單工具買斷"
              price="NT$590"
              unit="永久"
              features={[
                "永久解鎖架高平台 + 地板模擬器",
                "不訂閱也能用",
                "未來功能改進自動拿到",
              ]}
              cta={{ label: "看單買方案", href: "/pricing?upgrade=floor" }}
            />
            <PricingTier
              badge="最多人選"
              title="個人版訂閱"
              price="NT$390"
              unit="/月"
              features={[
                "全 26 家具範本解鎖",
                "天花板 + 地板 + 架高平台",
                "PDF 列印 + 雲端儲存無限",
              ]}
              cta={{ label: "升級個人版", href: "/pricing" }}
              highlight
            />
            <PricingTier
              badge="接案級"
              title="專業版訂閱"
              price="NT$890"
              unit="/月"
              features={[
                "個人版全部功能",
                "客戶報價 + 客戶資料管理",
                "STL/OBJ 輸出 + 尺寸無上限",
              ]}
              cta={{ label: "升級專業版", href: "/pricing" }}
            />
          </div>
          <p className="mt-6 text-center text-xs text-zinc-500">
            年付方案再省一個多月 · 木匠學院終身會員私訊拿專屬碼 ·
            <Link href="/pricing" className="ml-1 text-amber-700 hover:text-amber-900 underline underline-offset-2">
              看完整方案比較
            </Link>
          </p>
        </div>
      </section>

      {/* ============ 相關工具 ============ */}
      <section className="bg-stone-50 border-b border-stone-200">
        <div className="max-w-6xl mx-auto px-5 sm:px-6 py-12 sm:py-16">
          <h2 className="font-serif-tc text-2xl sm:text-3xl font-bold text-zinc-900 text-center mb-2">
            你可能也想看
          </h2>
          <p className="text-center text-zinc-500 text-sm mb-9">
            一起接案、一起算料的好搭擋
          </p>
          <div className="grid sm:grid-cols-3 gap-4 max-w-4xl mx-auto">
            {RELATED_TOOLS.map((r) => (
              <Link
                key={r.href}
                href={r.href}
                className="group flex flex-col rounded-2xl bg-white ring-1 ring-stone-200 p-6 hover:ring-amber-400 hover:shadow-xl hover:-translate-y-1 transition-all"
              >
                <div className="text-3xl mb-3">{r.emoji}</div>
                <div className="font-bold text-zinc-900 group-hover:text-amber-900 mb-1.5">
                  {r.title}
                </div>
                <p className="text-xs text-zinc-600 leading-snug">{r.body}</p>
                <div className="mt-3 text-xs font-semibold text-amber-700 group-hover:text-amber-900 inline-flex items-center gap-1">
                  看詳細介紹 →
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ============ 最終 CTA ============ */}
      <section className="bg-gradient-to-br from-amber-700 via-amber-800 to-stone-900 text-white">
        <div className="max-w-4xl mx-auto px-5 sm:px-6 py-14 sm:py-20 text-center">
          <h2 className="font-serif-tc text-2xl sm:text-4xl font-bold mb-4">
            少花 30 分鐘算料、多賺一張報價單
          </h2>
          <p className="text-amber-100 text-base sm:text-lg mb-8 leading-relaxed">
            和室一張、客房一張、臥鋪一張——每月省幾小時、客戶 close 速度翻倍。
            <br />
            一杯咖啡的錢,一整套工具帶走。
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link
              href={primaryHref}
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-white text-amber-900 font-bold shadow-xl hover:-translate-y-0.5 hover:shadow-2xl transition-all"
            >
              {primaryLabel} →
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-white/10 text-white font-semibold ring-1 ring-white/30 hover:bg-white/20 transition-all"
            >
              看完整方案
            </Link>
          </div>
          <p className="mt-6 text-sm text-amber-200/80">
            個人版 NT$ 390/月 · 含全 26 家具模板 + 天花板 + 地板 + 架高平台
          </p>
          {/* 市場參考價提示(避免「行情價」誤導) */}
          <p className="mt-2 text-xs text-amber-200/60">
            參考:台灣和室架高市場行情約 NT$ {PRICE_PER_PING.toLocaleString()}/坪起,
            算錯一坪料就大於這工具半年訂閱費。
          </p>
        </div>
      </section>
    </main>
  );
}

function PricingTier({
  badge,
  title,
  price,
  unit,
  features,
  cta,
  highlight = false,
}: {
  badge: string;
  title: string;
  price: string;
  unit: string;
  features: string[];
  cta: { label: string; href: string };
  highlight?: boolean;
}) {
  return (
    <div
      className={`relative rounded-2xl p-5 shadow-sm transition-all hover:shadow-xl hover:-translate-y-1 ${
        highlight
          ? "bg-amber-50 ring-2 ring-amber-500 shadow-amber-700/10"
          : "bg-white ring-1 ring-stone-200"
      }`}
    >
      <div
        className={`absolute -top-2.5 left-4 px-2 py-0.5 rounded-full text-[10px] font-bold shadow-sm ${
          highlight ? "bg-amber-700 text-white" : "bg-zinc-700 text-white"
        }`}
      >
        {badge}
      </div>
      <h3 className="font-bold text-zinc-900 mb-2 mt-1">{title}</h3>
      <div className="flex items-baseline gap-1 mb-4">
        <span className="text-2xl font-bold text-zinc-900 tabular-nums">{price}</span>
        <span className="text-zinc-500 text-xs">{unit}</span>
      </div>
      <ul className="space-y-1.5 mb-5 min-h-[5rem]">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-1.5 text-xs text-zinc-700 leading-relaxed">
            <span className="text-emerald-600 mt-0.5 shrink-0">✓</span>
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <Link
        href={cta.href}
        className={`block w-full text-center px-3 py-2 rounded-full font-semibold text-xs transition-all ${
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
