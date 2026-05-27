/**
 * /floor — 訪客銷售頁
 *
 * 渲染條件:未登入 OR 已登入但沒解鎖。
 * 已登入有權限者由 page.tsx 直送 <FloorDevClient />。
 */
import Link from "next/link";
import Image from "next/image";
import { ShareButtons } from "@/components/ShareButtons";

type UserStatus = "guest" | "loggedInNoAccess";

interface Props {
  status: UserStatus;
}

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://designer.woodenren.com";

const PARAMETERS = [
  { label: "房間形狀（9 種）", desc: "矩形、L 形、ㄇ 形、十字、凸窗 + 挨柱 0–2 根，2D 編輯器拉一拉就好。" },
  { label: "面材規格", desc: "超耐磨 / 海島型 / 實木，片長片寬 mm 級調整，比比看哪款省料。" },
  { label: "拼板款式（5 種）", desc: "直鋪、1/2 錯縫、1/3 錯縫、人字拼 Herringbone、Chevron V 型。" },
  { label: "起鋪角度", desc: "0° / 30° / 45° / 90° 四檔，自動算切角廢料。" },
  { label: "長軸方向", desc: "依房間長邊或短邊鋪，視覺延伸感不同，損耗也不同。" },
  { label: "伸縮縫 mm 級", desc: "牆邊預留縫從 8mm 到 15mm 自由設，影響邊條材料用量。" },
  { label: "踢腳板（高度 / 門洞）", desc: "踢腳板高度可設，門洞位置標出後系統自動扣總長。" },
  { label: "防潮墊規格（選配）", desc: "PE / EPE / Tyvek 三種選一，卷長卷寬不同自動算卷數。" },
];

const AUTO_OUTPUTS = [
  { icon: "🪵", title: "面材片數", body: "起鋪角、伸縮縫、5 種拼板都算進損耗，超耐磨 / 海島型 / 實木同一條演算法。" },
  { icon: "📐", title: "排版預覽", body: "2D 即時顯示拼板效果，3D 透視看真實質感，客戶不用想像。" },
  { icon: "🔁", title: "5 種款式即比即看", body: "切換拼板款式 1 秒重算，「人字拼比直鋪多多少廢料」秒答。" },
  { icon: "📏", title: "踢腳板米數", body: "依房間周長自動算，門洞自動扣，木質 / PVC 線板都算。" },
  { icon: "🧾", title: "A4 估價單", body: "客戶資料 + 品項 + 總計 + 條款一頁印出，另存 PDF 直接寄客戶。" },
  { icon: "📊", title: "BOM CSV 匯出", body: "Excel 開沒亂碼，工班直接抓料用。" },
];

const SCENARIOS = [
  {
    tag: "🔨 接案現場",
    body: "客戶問「客廳鋪人字拼貴多少」當場切換款式比給看，2D 預覽 + 估價單秒重算，客戶當場決定花樣。",
  },
  {
    tag: "🪜 統包 / 設計師",
    body: "提案 3 房 2 廳，每間切不同款式、不同色，一頁 A4 全打包。改尺寸不用重畫，半小時的事 5 分鐘搞定。",
  },
  {
    tag: "🏠 DIY 換木地板",
    body: "舊房翻新自己鋪，畫房間 → 系統告訴你要訂幾片超耐磨、幾條踢腳板，直接去料行不用問人。",
  },
  {
    tag: "🎓 木匠學院學員",
    body: "課程學的鋪設邏輯、起鋪角、伸縮縫，這支工具讓你看「演算法怎麼算」，從練手到接案無縫接軌。",
  },
];

const FAQS = [
  {
    q: "超耐磨、海島型、實木有什麼差?",
    a: "超耐磨是密集板印木紋表層,耐磨耐刮便宜,但泡水會壞;海島型是密集板上貼 1-2mm 實木皮,有實木質感、耐潮,主流選擇;實木地板是 100% 實木,最有質感但最貴、會脹縮。本工具 3 種都吃,自動套對應規格跟單價。",
  },
  {
    q: "人字拼的損耗真的會這麼高嗎?",
    a: "人字拼直鋪損耗 12-22%,直鋪只有 1.5-6.6%。但人字拼好看貴氣、客單價高。本工具算人字拼會把斜切餘料反向拼回去(一刀切兩片共板),實際損耗算給你看,料行報價隨便加 20% 你能省下 5-10%。",
  },
  {
    q: "中央起鋪是什麼意思?要不要選?",
    a: "中央起鋪 = 從房間中心線往兩邊鋪,首末排寬度對稱。優點:左右兩邊餘量等寬,視覺最平衡。缺點:中間有一條接縫。一般客廳推薦中央起鋪,小房間就左上起鋪即可。",
  },
  {
    q: "跟「和室架高平台估價」差在哪?",
    a: "地板模擬器算的是平鋪木地板（超耐磨 / 海島型 / 實木）、無骨架，貼地直接鋪。架高平台是 30cm 以上的台座，有頂框、底框、主支、副支、夾板、防潮墊、踢腳板。兩者共用同一把解鎖鑰匙，買一個解兩個。",
  },
  {
    q: "可以匯出 PDF / CSV 嗎?",
    a: "A4 估價單直接走瀏覽器列印 → 另存 PDF,LOGO / 公司資料 / 條款都在「品牌客製」面板填過一次就一直用。BOM 走 CSV 匯出,Excel 開沒亂碼。",
  },
  {
    q: "工具錢多少?",
    a: "個人版 NT$ 390/月,含全 26 個家具範本 + 天花板骨架 + 地板模擬器 + 和室架高平台,所有工具全給。專業版 NT$ 890/月 多了客戶報價系統 + STL/CNC 輸出 + 尺寸無上限。",
  },
  {
    q: "可以單買地板模擬器嗎?",
    a: "可以。地板模擬器跟和室架高平台共用「floor」這把解鎖鑰匙,單買解鎖兩個工具。價格在 /pricing 頁面。",
  },
  {
    q: "我家不是規矩矩形,L 形以外能算嗎?",
    a: "v1 已支援矩形、L、T、ㄇ、十字、Z、六角 7 種正交多邊形,以及自訂多邊形。斜牆、圓弧未支援,但正在排路線圖。",
  },
  {
    q: "工具會持續更新嗎?",
    a: "會。人字拼演算法、9 房間形狀、5 起鋪角、餘料 2D 配對都是上線後逐步補進去的。改進方向:斜牆/圓弧、3D 透視、地板熱漲冷縮提示、整合廠商規格資料庫。",
  },
];

const RELATED_TOOLS = [
  {
    href: "/raised-floor",
    emoji: "🏯",
    title: "和室架高平台估價",
    body: "30cm 以上的台座，骨架 + 夾板 + 防潮 + 踢腳一條龍。跟地板共用一把鑰匙。",
  },
  {
    href: "/ceiling",
    emoji: "🔨",
    title: "天花板骨架施工模擬器",
    body: "角材井字 + 矽酸鈣板拼板。客戶要「天地一起做」一站搞定。",
  },
  {
    href: "/templates",
    emoji: "🪑",
    title: "26 件家具範本",
    body: "從筆筒到衣櫃，裝潢工程常搭一起出。",
  },
];

export function FloorMarketing({ status }: Props) {
  const primaryHref =
    status === "guest"
      ? "/login?next=/floor"
      : "/pricing?upgrade=floor";
  const primaryLabel =
    status === "guest" ? "登入開始試算" : "升級個人版解鎖";
  const pageUrl = `${SITE_URL}/floor`;

  const productSchema = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: "地板施工模擬器",
    description:
      "畫房間 → 直鋪 / 錯縫 / 人字拼自動排版 → 算片數、損耗、估價一頁出。木地板算料 30 秒搞定。",
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
      { "@type": "ListItem", position: 3, name: "地板施工模擬器", item: pageUrl },
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
        <span className="text-zinc-700 font-medium">地板施工模擬器</span>
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
                  🪵 裝潢工具
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white ring-1 ring-stone-300 text-zinc-700 text-xs font-bold">
                  個人版 / 專業版
                </span>
              </div>
              <h1 className="font-serif-tc text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-zinc-900 leading-[1.15]">
                地板施工模擬器
              </h1>
              <p className="mt-4 text-xl text-amber-800 font-semibold leading-relaxed">
                畫出房間 → 直鋪 / 錯縫 / 人字拼自動排版 →<br className="hidden sm:inline" />
                算片數、損耗、估價一頁出。
              </p>
              <p className="mt-3 text-zinc-600 leading-relaxed">
                超耐磨、海島型、實木 3 大材路都吃。9 種房間形狀(矩形 / L / ㄇ /
                十字 / Z / 六角)拉一拉,人字拼斜切餘料一刀兩用,起鋪角中央置中
                自動算對稱餘量。
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link
                  href={primaryHref}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-amber-700 text-white font-semibold shadow-lg shadow-amber-700/30 hover:bg-amber-800 hover:-translate-y-0.5 transition-all"
                >
                  {primaryLabel} →
                </Link>
                <Link
                  href="/pricing"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white text-zinc-800 font-semibold ring-1 ring-stone-300 hover:ring-amber-500 hover:text-amber-800 transition-all"
                >
                  查看方案
                </Link>
              </div>
              <p className="mt-4 text-xs text-zinc-500">
                跟「和室架高平台」共用解鎖鑰匙,買一個解兩個。
              </p>
              <div className="mt-5">
                <ShareButtons
                  url={pageUrl}
                  title="地板施工模擬器｜畫房間 → 5 種拼板自動排版 → 算片數損耗估價"
                />
              </div>
            </div>
            <div className="relative">
              <div className="rounded-3xl bg-white ring-1 ring-amber-200 shadow-2xl overflow-hidden p-8">
                <div className="aspect-[5/4] flex items-center justify-center bg-gradient-to-br from-stone-50 to-amber-50/30 rounded-2xl">
                  <svg
                    viewBox="0 0 200 160"
                    className="w-[88%] h-[88%]"
                    aria-label="地板錯縫鋪設示意"
                  >
                    {/* 房間邊框 */}
                    <rect x={10} y={10} width={180} height={140} fill="none" stroke="#666" strokeWidth={1.5} />
                    {/* 地板片(錯縫鋪) */}
                    {[0, 1, 2, 3, 4, 5].map((r) => (
                      <g key={r}>
                        {[-1, 0, 1, 2, 3, 4].map((c) => (
                          <rect
                            key={c}
                            x={10 + c * 60 + (r % 2) * 30}
                            y={14 + r * 22}
                            width={56}
                            height={18}
                            rx={2}
                            fill="#e7d8ae"
                            stroke="#bd9955"
                            strokeWidth={1}
                          />
                        ))}
                      </g>
                    ))}
                    {/* 房間邊框最上層 */}
                    <rect x={10} y={10} width={180} height={140} fill="none" stroke="#666" strokeWidth={1.5} />
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
            鋪地板算料,你最頭痛這 4 件事
          </h2>
          <p className="text-center text-zinc-500 mb-10">
            這工具就是衝著它們做的
          </p>
          <div className="grid sm:grid-cols-2 gap-5">
            {[
              {
                emoji: "🤯",
                title: "算片數常多訂或漏訂",
                body: "房間 4 米 × 3 米、地板片 121×19.5cm，到底要訂幾片?半天加完還忘了算門洞。",
              },
              {
                emoji: "🌀",
                title: "人字拼算料燒腦,料行喊不出價",
                body: "人字拼的損耗到底是 15% 還是 22%?斜切餘料能不能拼回去?光想就頭痛,料行通常隨便加 20%。",
              },
              {
                emoji: "📐",
                title: "起鋪角設錯,整片要重排",
                body: "從左上角還是中央起鋪? 60cm 還是 40cm 錯縫?設一次錯就要全部重畫一遍,看圖才知道對不對。",
              },
              {
                emoji: "📄",
                title: "估價要再開 Excel 排",
                body: "算完片數還要打 Excel、貼 LOGO、排 A4。客戶改尺寸又要重排,半天就過了。",
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
            從房間形狀 → 排版 → 估價單,一條龍
          </p>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              {
                emoji: "📐",
                title: "9 種房間形狀",
                body: "矩形 / L / T / ㄇ / 十字 / Z / 六角 / 自訂多邊形,拉長寬即時算料。",
              },
              {
                emoji: "🪵",
                title: "3 大材路 + 多規格",
                body: "超耐磨 121×19.5、海島型、實木 3寸 / 5寸 / 2寸,單價單位都跟料行對齊。",
              },
              {
                emoji: "🌀",
                title: "4 種排版方式",
                body: "直鋪、half 錯縫、random 錯縫、人字拼。人字拼斜切餘料一刀切兩片共板。",
              },
              {
                emoji: "🎯",
                title: "5 種起鋪角",
                body: "左上 / 右上 / 左下 / 右下 / 中央置中(對稱餘量自動算)。每片配料告訴你從哪邊鋸。",
              },
              {
                emoji: "🚪",
                title: "門洞 / 收邊扣料",
                body: "門口扣多少 cm、踢腳板要不要算,直接設,系統幫你扣完算淨用量。",
              },
              {
                emoji: "🧾",
                title: "A4 估價單 + CSV 下料表",
                body: "客戶資料、品項、總計、條款,一頁 A4 印出。BOM 同步匯 CSV 給工班。",
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
            演算法自動算片數、廢料、踢腳板米數。
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
          <div className="grid md:grid-cols-2 gap-5">
            {[
              {
                img: "/showcase/floor-overview.png",
                label: "9 種房間 + 5 種拼板款式",
                desc: "拉房間外框 → 即時看排版,直鋪/錯縫/人字拼一鍵切換比。",
              },
              {
                img: "/showcase/floor-patterns.png",
                label: "面材規格 + 起鋪角",
                desc: "8 種常用面材一鍵套,起鋪角 / 伸縮縫 / 長軸方向都可調。",
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
                    sizes="(min-width:768px) 50vw, 100vw"
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
            ※ 改尺寸 / 換款式 / 切換面材時,這些圖都會即時重算
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
                title: "木地板師傅 / 統包",
                body: "客戶問「客廳鋪到底要幾箱」當場掏手機算,改尺寸馬上重出估價單。",
              },
              {
                emoji: "🏠",
                title: "DIY 自己換地板",
                body: "看完料表直接去 HOLA / 特力屋,不用問師傅、不用 Excel,連起鋪角都告訴你。",
              },
              {
                emoji: "🪜",
                title: "裝潢設計師",
                body: "提案放一張排版圖 + 估價單,客戶當場 close。改材路不用重畫。",
              },
              {
                emoji: "🎓",
                title: "木匠學院學員",
                body: "課程學的鋪設工法實際算一次,從練手到接案無縫接軌。",
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
              <li>磁磚、石材、塑膠地板 — 本工具算木地板,不算硬質材料</li>
              <li>樓梯、踢腳板專案 — 本工具算地板鋪設,踢腳板只能扣長度</li>
              <li>圓弧形/不規則房間 — v1 支援正交多邊形 9 種,圓弧未支援</li>
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
            如何取得「地板施工模擬器」
          </h2>
          <p className="text-center text-zinc-500 text-sm mb-9">
            三種解鎖方式擇一,跟和室架高共用鑰匙
          </p>
          <div className="grid md:grid-cols-3 gap-4">
            <PricingTier
              badge="單買"
              title="單工具買斷"
              price="NT$590"
              unit="永久"
              features={[
                "永久解鎖地板 + 架高平台",
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
            少花半天算料、多接一個案子
          </h2>
          <p className="text-amber-100 text-base sm:text-lg mb-8 leading-relaxed">
            客廳一張、餐廳一張、書房一張——每月多接幾個案子,訂閱費當場回本。
            <br />
            一杯咖啡的錢,一整套裝潢工具帶走。
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
