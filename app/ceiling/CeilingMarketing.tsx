/**
 * /ceiling — 訪客銷售頁
 *
 * 渲染條件:未登入 OR 已登入但沒解鎖。
 * 已登入有權限者由 page.tsx 直送 <CeilingDevClient />。
 */
import Link from "next/link";

type UserStatus = "guest" | "loggedInNoAccess";

interface Props {
  status: UserStatus;
}

export function CeilingMarketing({ status }: Props) {
  const primaryHref =
    status === "guest"
      ? "/login?next=/ceiling"
      : "/pricing?upgrade=ceiling";
  const primaryLabel =
    status === "guest" ? "登入開始試算" : "升級個人版解鎖";

  return (
    <main className="bg-white">
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
                  🔨 裝潢工具
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white ring-1 ring-stone-300 text-zinc-700 text-xs font-bold">
                  個人版 / 專業版
                </span>
              </div>
              <h1 className="font-serif-tc text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-zinc-900 leading-[1.15]">
                木作天花板骨架施工模擬器
              </h1>
              <p className="mt-4 text-xl text-amber-800 font-semibold leading-relaxed">
                畫出房間 → 自動算角材、矽酸鈣板、吊筋 →<br className="hidden sm:inline" />
                直接出 A4 估價單。
              </p>
              <p className="mt-3 text-zinc-600 leading-relaxed">
                客廳一張、餐廳一張、走廊一張——以前一個下午算的料,現在 30 秒。
                井字主副角材自動對齊矽酸鈣板拼縫,吊筋等分自動分佈,連 4×8 / 3×6
                兩種規格的板都能比一比哪個省料。
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
                個人版開放,跟全 26 家具範本一起用一把鑰匙。
              </p>
            </div>
            <div className="relative">
              <div className="rounded-3xl bg-white ring-1 ring-amber-200 shadow-2xl overflow-hidden p-8">
                <div className="aspect-[5/4] flex items-center justify-center bg-gradient-to-br from-stone-50 to-amber-50/30 rounded-2xl">
                  <svg
                    viewBox="0 0 200 160"
                    className="w-[88%] h-[88%]"
                    aria-label="天花板骨架剖視示意"
                  >
                    {/* 樓板(原始天花) */}
                    <rect x={10} y={10} width={180} height={10} fill="#999" />
                    {/* 吊筋 */}
                    {[40, 80, 120, 160].map((x) => (
                      <line key={x} x1={x} y1={20} x2={x} y2={58} stroke="#666" strokeWidth={2} />
                    ))}
                    {/* 主角材 */}
                    <rect x={20} y={56} width={160} height={6} fill="#bd9955" />
                    {/* 副角材(垂直, 略大) */}
                    {[30, 60, 90, 120, 150, 180].map((x) => (
                      <rect key={x} x={x - 3} y={62} width={6} height={6} fill="#a67d3f" />
                    ))}
                    {/* 矽酸鈣板 */}
                    <rect x={14} y={68} width={172} height={6} fill="#e7d8ae" stroke="#bd9955" strokeWidth={1.2} />
                    {/* 板拼縫 */}
                    {[60, 120].map((x) => (
                      <line key={x} x1={x} y1={68} x2={x} y2={74} stroke="#fff" strokeWidth={1.2} />
                    ))}
                    {/* 標註 */}
                    <text x={100} y={90} textAnchor="middle" fontSize={9} fill="#666" fontFamily="sans-serif">主角材 + 副角材 + 矽酸鈣板</text>
                    <text x={100} y={104} textAnchor="middle" fontSize={9} fill="#999" fontFamily="sans-serif">吊筋固定到樓板</text>
                    {/* 房間平面提示 */}
                    <rect x={28} y={118} width={144} height={30} rx={2} fill="none" stroke="#bd9955" strokeWidth={1.2} strokeDasharray="3 2" />
                    <text x={100} y={138} textAnchor="middle" fontSize={9} fill="#bd9955" fontFamily="sans-serif">房間平面 → 自動排骨架</text>
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
            做木作天花板,你最頭痛這 4 件事
          </h2>
          <p className="text-center text-zinc-500 mb-10">
            這工具就是衝著它們做的
          </p>
          <div className="grid sm:grid-cols-2 gap-5">
            {[
              {
                emoji: "🧮",
                title: "算角材總公尺,加得頭暈",
                body: "主角材一支 12 尺、副角材井字一條一條加,房間還不是規矩矩形。漏一條就要再跑一趟料行。",
              },
              {
                emoji: "📐",
                title: "板拼縫沒對到角材",
                body: "矽酸鈣板拼縫飄在角材之間 → 板邊沒支撐、年底就裂。要拼準得手算間距、累。",
              },
              {
                emoji: "📦",
                title: "板要訂 4×8 還是 3×6?",
                body: "兩種規格價差、損耗都不同。光憑直覺訂常多 20%。",
              },
              {
                emoji: "📄",
                title: "估價要再開 Excel 排",
                body: "算完料還要打 Excel、貼 LOGO、排 A4。改個尺寸又重排,半天就過了。",
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
            從房間形狀 → 角材 BOM → 估價單,一條龍
          </p>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              {
                emoji: "📐",
                title: "房間形狀:矩形 / L / ㄇ / 凸窗",
                body: "拉長寬、L 形凹角、ㄇ 字形,凸窗單獨拉出來,2D 即時算料、3D 即時看結構。",
              },
              {
                emoji: "🪵",
                title: "主副角材自動井字",
                body: "主角材 60×30、副角材 30×30、間距 30/45/60cm 可調,自動鋪滿房間。",
              },
              {
                emoji: "📦",
                title: "矽酸鈣板自動拼板",
                body: "4×8 / 3×6 兩種規格切換比比看,拼縫自動落在角材中心線上,板邊永遠有支撐。",
              },
              {
                emoji: "🔗",
                title: "吊筋等分自動分佈",
                body: "依房間長寬自動排吊筋,間距 60–90cm 一抓,十字接頭加粗強化視覺,3D 真看得見。",
              },
              {
                emoji: "🎛️",
                title: "3D 8 圖層獨立 toggle",
                body: "樓板 / 吊筋 / 主角材 / 副角材 / 板 / 接點全可開關。施工順序客戶看一遍就懂。",
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
                title: "木工 / 輕鋼架師傅",
                body: "客戶問「客廳天花一坪多少」當場掏手機算,改尺寸馬上重出估價單。",
              },
              {
                emoji: "🪜",
                title: "裝潢統包 / 室內設計",
                body: "提案時放一張 3D + 估價單,客戶當場 close。改方案不用重畫。",
              },
              {
                emoji: "🏠",
                title: "DIY 自己做木作天花",
                body: "畫房間 → 系統告訴你要訂幾支 12 尺角材、幾片矽酸鈣板,直接去料行。",
              },
              {
                emoji: "🎓",
                title: "木匠學院學員",
                body: "把課程學到的木作骨架算一遍,從練手到接案無縫接軌。",
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
              <li>輕鋼架(石膏板系統)— 本工具算的是木作骨架,不算輕鋼架 T-bar</li>
              <li>非正交多邊形房間(斜牆、圓弧、大量凸窗)— v1 只支援矩形、L 形跟少量凸出</li>
              <li>需要算冷氣出風口/燈具開孔位置精算 — 本工具算骨架跟板,不算開孔</li>
              <li>已有 CAD/Revit 工作流程 — 本工具補的是「沒 CAD 但要算料」的洞</li>
            </ul>
          </div>
        </div>
      </section>

      {/* ============ FAQ ============ */}
      <section className="bg-white border-b border-stone-200">
        <div className="max-w-3xl mx-auto px-5 sm:px-6 py-14 sm:py-20">
          <h2 className="font-serif-tc text-2xl sm:text-3xl font-bold text-zinc-900 mb-8 text-center">
            常見問題
          </h2>
          <div className="space-y-3">
            {[
              {
                q: "木作天花板跟輕鋼架天花板差在哪?",
                a: "木作走「角材井字 + 矽酸鈣板」,角材一支 12 尺木料,板用螺絲鎖上去,可承重燈具、可造型。輕鋼架走 T-bar + 礦纖板,模組化好拆,但載重弱、不耐造型。本工具算的是木作。",
              },
              {
                q: "矽酸鈣板要訂 4×8 還是 3×6?",
                a: "4×8(122×244cm)是台灣最通用、單張面積大、適合大客廳餐廳;3×6(91×183cm)單張小、小空間少廢料、車載好搬。本工具兩種規格都能切換看哪個剩料少,自動比給你看。",
              },
              {
                q: "拼縫真的會自動對齊角材嗎?",
                a: "會。系統用「夾板短邊 ÷ N」反算主角材間距,確保板拼縫剛好落在角材中心線上,板邊永遠有支撐、不會年底裂。換板規格(4×8 / 3×6)主角材間距自動跟著變。",
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
                q: "可以單買這個工具嗎?",
                a: "可以。在 /pricing 頁面找天花板單買斷選項。但個人版含全 26 家具 + 3 套裝潢工具更划算,大部分人會直接訂個人版。",
              },
              {
                q: "我家凸窗、斜牆怎麼算?",
                a: "目前 v1 支援矩形、L 形 + 少量凸出。非正交多邊形(斜牆、圓弧)正在排路線圖,屆時無痛升級。",
              },
              {
                q: "工具會持續更新嗎?",
                a: "會。從 3D 圖層 toggle、矽酸鈣板拼板、十字接頭強化都是上線後逐步補進去的。改進方向:多燈具/出風口開孔、自動算載重、整合 RC 樓板實測數據。",
              },
            ].map((f) => (
              <details
                key={f.q}
                className="rounded-xl bg-stone-50 ring-1 ring-stone-200 hover:ring-amber-300 transition-all group"
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

      {/* ============ 最終 CTA ============ */}
      <section className="bg-gradient-to-br from-amber-700 via-amber-800 to-stone-900 text-white">
        <div className="max-w-4xl mx-auto px-5 sm:px-6 py-14 sm:py-20 text-center">
          <h2 className="font-serif-tc text-2xl sm:text-4xl font-bold mb-4">
            少一個下午算料、多一張報價單
          </h2>
          <p className="text-amber-100 text-base sm:text-lg mb-8 leading-relaxed">
            一杯咖啡的錢,一整套工具帶走。
            <br />
            含家具範本 + 地板 + 架高平台,所有裝潢算料一站搞定。
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
