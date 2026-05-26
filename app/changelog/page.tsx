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
    date: "2026-05-26",
    badge: "new",
    title: "和室架高平台估價工具 + 零件圖大改版",
    body: [
      "新增「和室架高平台」估價工具：自動算副支撐角材、夾板層、表面板數量，附 3D 爆炸圖 + 2D 拼花預覽。",
      "零件圖 modal 改成單張可獨立放大檢視，每張視圖配獨立倍率工具列，看細節不再被整體縮放卡住。",
      "零件圖加「桌鋸設定表」：每個榫接、斜切、溝槽的桌鋸角度、深度、靠山距離一次列出，照表設機台。",
      "複斜腳零件圖加端面 1:2 放大 detail view，端面斜切角看得更清楚。",
    ],
  },
  {
    date: "2026-05-25",
    badge: "improve",
    title: "紅酒架模板大幅優化",
    body: [
      "新增「鎖瓶數」或「鎖總尺寸」兩種設計模式，二擇一切換。",
      "拉瓶身直徑、橫向瓶數、縱向層數時，整體外型尺寸即時跟著變，不再要自己反推。",
      "preset 真的吃進設計（先前部分 preset 沒套上）；菱形對角板 wireframe 修正，瓶子實際塞得下。",
    ],
  },
  {
    date: "2026-05-25",
    badge: "new",
    title: "每張家具都有獨立介紹頁",
    body: [
      "24 個家具範本各有專屬詳細介紹頁，含設計重點、可調參數、實際輸出畫面、使用情境、FAQ。",
      "櫃類模板新增「櫃體內部透視」設計細節截圖；衣櫃多一張「配置變化展示」；長凳加曲面靠背樣式。",
      "每張介紹頁可一鍵分享到 LINE / Facebook 或複製連結。",
    ],
  },
  {
    date: "2026-05-21",
    badge: "new",
    title: "正式開賣 26 個家具範本",
    body: [
      "免費版：方凳、筆筒（功能跟付費一樣，只有模板數量跟尺寸有上限）。",
      "個人版：全 26 模板 + 天花板骨架 + 地板模擬器 + PDF 列印。",
      "專業版：個人版全部 + 客戶報價系統 + STL/OBJ 輸出 + 設計師模式（尺寸無上限）。",
      "支援單範本買斷（永久解鎖某一個模板，不訂閱也能用）。",
    ],
  },
  {
    date: "2026-05-15",
    badge: "improve",
    title: "書擋模板強化",
    body: [
      "支援斜面結構（右三角形）跟 picture-frame 風的 45° 隱形對接。",
      "新增「組裝版 vs 榫接版」兩種視圖切換，方便看內部結構。",
    ],
  },
  {
    date: "2026-05-12",
    badge: "new",
    title: "designer.woodenren.com 正式網域上線",
    body: [
      "獨立網域、Magic Link 登入、AI 功能、PWA 安裝。",
      "木匠學院學員可拿專屬碼，享 6 個月免費試用。",
    ],
  },
  {
    date: "2026-05-04",
    badge: "improve",
    title: "方凳模板的榫卯邏輯升級",
    body: [
      "依腳粗細自動切通榫／盲榫，方凳結構更穩固。",
      "X／Z 軸牙板自動錯位，不會卡到對面榫頭。",
      "外撇腳支援複斜計算，給出真實腿長與鋸台設定值。",
    ],
  },
  {
    date: "2026-05-01",
    badge: "new",
    title: "身高自動建議桌高、照片轉設計",
    body: [
      "輸入身高 → 自動建議桌高、椅高、椅背高度。",
      "上傳家具照片 → AI 反推參數，幫你做出類似的家具。",
      "每個設計可一鍵分享，分享出去自動產出含家具圖跟尺寸的預覽圖。",
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
