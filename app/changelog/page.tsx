import Link from "next/link";
import type { Metadata } from "next";

/**
 * /changelog — 木作藍圖更新日誌
 *
 * 給用戶知道我們在改什麼。維護方式：每次有用戶會感受到的改動，
 * 在這檔最上方加一筆。技術 refactor、內部 bug 修不用寫。
 *
 * 排序：最新在最上方。
 */

export const metadata: Metadata = {
  title: "更新日誌｜木頭仁 木作藍圖",
  description:
    "木作藍圖每一版的功能新增與改進。介紹頁、新模板、AI 功能、結帳系統的所有變化都在這。",
  alternates: { canonical: "/changelog" },
};

interface ChangelogEntry {
  date: string;
  badge: "new" | "improve" | "fix" | "design";
  title: string;
  body: string[];
}

const BADGE_STYLE: Record<ChangelogEntry["badge"], { label: string; cls: string }> = {
  new: { label: "新功能", cls: "bg-emerald-100 ring-emerald-300 text-emerald-800" },
  improve: { label: "改進", cls: "bg-amber-100 ring-amber-300 text-amber-800" },
  fix: { label: "修正", cls: "bg-rose-100 ring-rose-300 text-rose-800" },
  design: { label: "介面", cls: "bg-blue-100 ring-blue-300 text-blue-800" },
};

const CHANGELOG: ChangelogEntry[] = [
  {
    date: "2026-05-25",
    badge: "new",
    title: "完整模板介紹網站上線",
    body: [
      "全新「範本介紹」層（/templates）：24 個家具範本各有獨立詳細介紹頁。",
      "每頁含：Hero / 設計細節透視 / 設計重點 highlights / 能做什麼 / 適合誰 / 參數 / 6 圖實際輸出 / 使用情境 / Preset / FAQ / 相關模板 / 分享按鈕。",
      "/ 改為行銷 landing、/app 為老貨架（給已登入老用戶），middleware 自動導流。",
      "Footer 加 4 社群連結（YT/IG/FB/木匠學院）、/pricing 加 8 條方案 FAQ。",
      "首發櫃類模板 + 長凳掛上實際設計細節截圖。後續會持續補。",
    ],
  },
  {
    date: "2026-05-21",
    badge: "new",
    title: "designer 正式開賣",
    body: [
      "個人版 NT$390/月（全 26 模板 + 裝潢工具）、專業版 NT$890/月（多客戶報價、CNC 輸出、尺寸無上限）。",
      "免費版開放方凳 + 筆筒（功能跟付費一樣，只是模板數量跟尺寸有上限）。",
      "綠界 ECPay 串接：信用卡 / ATM / 超商代碼，可開電子發票。",
      "學員身份驗證有專屬碼，私訊木頭仁取得。",
    ],
  },
  {
    date: "2026-05-20",
    badge: "improve",
    title: "開賣前防爆 hardening",
    body: [
      "綠界 webhook 並發雙退款防護、寄信改 Resend Pro + retry queue。",
      "歡迎信、付費前二次確認 modal、儲存設計 modal、admin SQL 文件。",
      "InvoicePreflightModal：開立發票前再確認一次抬頭、統編。",
    ],
  },
  {
    date: "2026-05-18",
    badge: "new",
    title: "綠界 ECPay 一次性付款",
    body: [
      "Phase 1：月扣 30 天、年扣 365 天到期模式。",
      "AioCheckOut + webhook + CheckMacValue 驗證，正式憑證已串好。",
    ],
  },
  {
    date: "2026-05-15",
    badge: "design",
    title: "右三角形與 45° 對接 shape 系統",
    body: [
      "新 right-triangle shape kind：書擋 brace、屋頂角等斜面結構支援。",
      "新 mitered-corner shape kind：picture-frame 風的隱形對接，書擋底板/背板套用。",
      "新 joineryView 覆寫：組裝版 vs 榫接版兩種幾何並存，書擋首發。",
    ],
  },
  {
    date: "2026-05-12",
    badge: "new",
    title: "designer.woodenren.com 自有網域 + 學生 beta 上線",
    body: [
      "GoDaddy CNAME → Vercel，正式網域上線。",
      "Resend SMTP 接 Supabase 寄信，4 份信件範本中文化。",
      "Magic Link 登入、條款隱私頁、webview 偵測、學員版 6 個月 SOP。",
      "AI 端點每日限額：free 3 / personal 10 / 付費 50 次。",
    ],
  },
  {
    date: "2026-05-04",
    badge: "improve",
    title: "方凳榫卯規則基礎版",
    body: [
      "autoTenonType：≤25mm 通榫、>25mm 盲榫 2/3 自動切換。",
      "X 上 Z 下半榫錯位 stagger A/B 雙模。",
      "legInset=0 腳頂榫朝心偏內側無肩。",
      "Splayed leg 自延伸、top view entry+exit 雙 rect。",
    ],
  },
  {
    date: "2026-05-01",
    badge: "new",
    title: "三大新功能：身高→桌高、分享 + OG、照片轉設計",
    body: [
      "身高 → 自動建議座高、桌高、椅背高度。",
      "分享按鈕 + 動態 OG 縮圖（含家具圖 + 尺寸）。",
      "照片轉設計：上傳家具照片，Claude vision 反推參數。",
    ],
  },
];

export default function ChangelogPage() {
  return (
    <main className="bg-[#fafaf7] min-h-screen">
      <section className="bg-gradient-to-br from-amber-50 via-white to-stone-100 border-b border-stone-200">
        <div className="max-w-3xl mx-auto px-5 sm:px-6 py-14 sm:py-20 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white ring-1 ring-amber-300 text-amber-800 text-xs font-semibold mb-5 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            木作藍圖 更新日誌
          </div>
          <h1 className="font-serif-tc text-4xl sm:text-5xl font-bold tracking-tight text-zinc-900">
            我們改了什麼
          </h1>
          <p className="mt-5 text-zinc-600 leading-relaxed max-w-xl mx-auto">
            木作藍圖每次有用戶會感受到的新功能、改進、修正都會記在這。
            <br />
            最新的在最上面。
          </p>
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-5 sm:px-6 py-12 sm:py-16">
        <ol className="relative border-l-2 border-amber-200 ml-3 space-y-10">
          {CHANGELOG.map((e) => (
            <li key={`${e.date}-${e.title}`} className="ml-6 sm:ml-8">
              <div className="absolute -left-[7px] w-3 h-3 rounded-full bg-amber-500 ring-4 ring-amber-100 mt-2" />
              <div className="flex flex-wrap items-baseline gap-3 mb-2">
                <time className="text-xs font-mono text-zinc-400 tabular-nums">
                  {e.date}
                </time>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ring-1 ${BADGE_STYLE[e.badge].cls}`}
                >
                  {BADGE_STYLE[e.badge].label}
                </span>
              </div>
              <h2 className="font-serif-tc text-xl sm:text-2xl font-bold text-zinc-900 mb-3">
                {e.title}
              </h2>
              <ul className="space-y-2">
                {e.body.map((b, i) => (
                  <li key={i} className="text-sm text-zinc-700 leading-relaxed flex gap-2">
                    <span aria-hidden className="text-amber-700 shrink-0 mt-1">·</span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </section>

      <section className="border-t border-stone-200 bg-stone-50">
        <div className="max-w-3xl mx-auto px-5 sm:px-6 py-12 text-center">
          <p className="text-sm text-zinc-600 mb-2">
            想要新功能或回報問題？
          </p>
          <Link
            href="/contact"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-700 hover:text-amber-900"
          >
            聯絡我們 →
          </Link>
          <div className="mt-8 flex flex-wrap justify-center gap-3 text-sm">
            <Link
              href="/templates"
              className="px-4 py-2 rounded-full bg-white text-zinc-700 ring-1 ring-stone-300 hover:ring-amber-500 hover:text-amber-800 transition-colors"
            >
              範本介紹
            </Link>
            <Link
              href="/app"
              className="px-4 py-2 rounded-full bg-amber-700 text-white font-semibold hover:bg-amber-800 transition-colors"
            >
              開始設計 →
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
