import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "方案 · 木頭仁工程圖生成器",
  description: "從免費試用到專業接案，挑一個適合你的方案。",
};

interface PlanCard {
  id: "free" | "personal" | "pro" | "lifetime";
  name: string;
  price: string;
  priceUnit?: string;
  audience: string[];
  features: Array<{ ok: boolean; text: string }>;
  highlight?: boolean;
  cta: string;
  ctaDisabled?: boolean;
}

const PLANS: PlanCard[] = [
  {
    id: "free",
    name: "免費版",
    price: "NT$ 0",
    audience: ["想先試試看的", "偶爾畫一張就好的", "做小物件練手的"],
    features: [
      { ok: true, text: "全部 19 種家具範本" },
      { ok: true, text: "3D 透視圖預覽" },
      { ok: true, text: "工程三視圖（含浮水印）" },
      { ok: false, text: "下載 PDF" },
      { ok: false, text: "客製家具報價" },
      { ok: false, text: "儲存超過 1 件設計" },
    ],
    cta: "立即免費使用",
  },
  {
    id: "personal",
    name: "個人版",
    price: "NT$ 290",
    priceUnit: "/ 月",
    audience: ["DIY 木工玩家", "週末做家具的人", "自己家裡用的"],
    features: [
      { ok: true, text: "無限儲存設計" },
      { ok: true, text: "下載 PDF（無浮水印）" },
      { ok: true, text: "完整裁切計算器" },
      { ok: true, text: "全部範本 + 3D 預覽" },
      { ok: false, text: "客製家具報價系統" },
      { ok: false, text: "客戶資料管理" },
    ],
    cta: "選擇個人版",
  },
  {
    id: "pro",
    name: "專業版",
    price: "NT$ 890",
    priceUnit: "/ 月",
    audience: ["接案木工師傅", "獨立傢俱設計師", "工作室經營者"],
    features: [
      { ok: true, text: "個人版全部功能" },
      { ok: true, text: "客製家具報價系統" },
      { ok: true, text: "自訂報價單抬頭 / LOGO" },
      { ok: true, text: "客戶資料管理" },
      { ok: true, text: "PDF 報價單一鍵產出" },
      { ok: true, text: "LINE / Email 一鍵分享" },
    ],
    highlight: true,
    cta: "選擇專業版",
  },
  {
    id: "lifetime",
    name: "終身版",
    price: "NT$ 8,900",
    priceUnit: "（一次付清）",
    audience: ["長期經營的師傅", "想一次到位的", "支持木頭仁工具的"],
    features: [
      { ok: true, text: "專業版全部功能" },
      { ok: true, text: "終身使用、不再付月費" },
      { ok: true, text: "未來新增功能免費升級" },
      { ok: true, text: "優先 email 客服支援" },
      { ok: true, text: "適合 8 個月以上常用者" },
      { ok: true, text: "支持木頭仁繼續開發工具" },
    ],
    cta: "選擇終身版",
  },
];

export default function PricingPage() {
  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
      <div className="text-center mb-10 sm:mb-14">
        <Link
          href="/"
          className="inline-block text-sm text-zinc-500 hover:text-zinc-700 mb-4"
        >
          ← 回家具列表
        </Link>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-zinc-900">
          選一個適合你的方案
        </h1>
        <p className="mt-3 text-zinc-600 text-sm sm:text-base">
          不論你是 DIY 玩家、接案師傅，還是設計師，都有對應方案
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {PLANS.map((p) => (
          <PlanCard key={p.id} plan={p} />
        ))}
      </div>

      <div className="mt-12 text-center text-xs text-zinc-500 max-w-2xl mx-auto leading-relaxed">
        <p>
          所有方案皆可隨時升降級。月費方案到期未續訂自動降為免費版（你的設計、客戶資料保留 90 天）。
        </p>
        <p className="mt-2">
          學員版限 木匠學院 / Hahow 課程學員，註冊後 email 自動帶入白名單。
        </p>
      </div>
    </main>
  );
}

function PlanCard({ plan }: { plan: PlanCard }) {
  return (
    <div
      className={`relative rounded-xl border-2 bg-white p-5 sm:p-6 flex flex-col ${
        plan.highlight ? "border-[#8b4513] shadow-lg" : "border-zinc-200"
      }`}
    >
      {plan.highlight && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-[#8b4513] text-white text-xs font-semibold">
          ★ 推薦
        </div>
      )}

      <h2 className="text-lg sm:text-xl font-bold text-zinc-900">{plan.name}</h2>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="text-2xl sm:text-3xl font-bold text-zinc-900">{plan.price}</span>
        {plan.priceUnit && (
          <span className="text-sm text-zinc-500">{plan.priceUnit}</span>
        )}
      </div>

      <ul className="mt-3 text-xs text-zinc-600 space-y-0.5">
        {plan.audience.map((a) => (
          <li key={a}>· {a}</li>
        ))}
      </ul>

      <hr className="my-4 border-zinc-200" />

      <ul className="flex-1 space-y-2 text-sm">
        {plan.features.map((f, i) => (
          <li
            key={i}
            className={`flex items-start gap-2 ${
              f.ok ? "text-zinc-700" : "text-zinc-400 line-through"
            }`}
          >
            <span className="mt-0.5 leading-none">{f.ok ? "✓" : "✗"}</span>
            <span>{f.text}</span>
          </li>
        ))}
      </ul>

      <button
        type="button"
        disabled={plan.ctaDisabled}
        className={`mt-5 w-full px-4 py-2.5 rounded-lg font-medium text-sm transition-colors ${
          plan.highlight
            ? "bg-[#8b4513] text-white hover:bg-[#6f370f]"
            : "bg-zinc-900 text-white hover:bg-zinc-700"
        } disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        {plan.cta}
      </button>
      <p className="mt-2 text-[11px] text-zinc-400 text-center">
        付款功能即將開放
      </p>
    </div>
  );
}
