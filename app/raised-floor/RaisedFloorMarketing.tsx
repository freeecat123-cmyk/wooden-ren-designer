/**
 * /raised-floor — 訪客銷售頁
 *
 * 渲染條件:未登入 OR 已登入但沒解鎖。
 * 已登入有權限者由 page.tsx 直送 <RaisedFloorClient />。
 */
import Link from "next/link";

type UserStatus = "guest" | "loggedInNoAccess";

interface Props {
  status: UserStatus;
}

const PRICE_PER_PING = 8500; // 市場行情粗估,展示用,實際以工具計算為準

export function RaisedFloorMarketing({ status }: Props) {
  const primaryHref =
    status === "guest"
      ? "/login?next=/raised-floor"
      : "/pricing?upgrade=floor";
  const primaryLabel =
    status === "guest" ? "登入開始試算" : "升級個人版解鎖";
  const secondaryHref = "/pricing";
  const secondaryLabel = "查看方案";

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

      {/* ============ FAQ ============ */}
      <section className="bg-white border-b border-stone-200">
        <div className="max-w-3xl mx-auto px-5 sm:px-6 py-14 sm:py-20">
          <h2 className="font-serif-tc text-2xl sm:text-3xl font-bold text-zinc-900 mb-8 text-center">
            常見問題
          </h2>
          <div className="space-y-3">
            {[
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
