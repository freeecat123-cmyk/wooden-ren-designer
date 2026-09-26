import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";

/**
 * /calc 入口頁。
 *
 * ⛔ 這個目錄底下本來只有 `calc/apron-tilt` 一個子頁、沒有任何 index，
 *    designer.woodenren.com/calc 因此連續 404（aiseo 稽核 09-23~09-25 連續
 *    3 天同一結論：不是被下架、也不是誤刪，是入口頁本來就沒建）。
 *
 * ⚠️ TW-only（同 apron-tilt，見 app/sitemap.ts 的 TW_ONLY_ROUTES）：
 *    這裡只給 canonical、不給 languages —— 宣告一個不存在的英文版比沒宣告更糟。
 *    canonical 直接寫死 `/calc`，不繼承 layout 的首頁 canonical
 *    （apron-tilt 曾經因為沒宣告自己的 canonical、被 Google 當成首頁的重複內容
 *    而永遠不被收錄，見 `calc/apron-tilt/layout.tsx` 開頭那段記錄）。
 *
 * 目前只有一個工具：先做出一個誠實的小 index，不要為了「像個 hub」硬湊排版
 * 或誇大成好幾款工具——之後真的加了新的幾何計算器，再擴充這個清單即可。
 */
export const metadata: Metadata = {
  title: "小工具 · 木作藍圖",
  description:
    "木作藍圖附帶的木工幾何小計算器，目前收錄：外斜腳家具的牙條斜度計算器。",
  alternates: { canonical: "/calc" },
};

const TOOLS = [
  {
    href: "/calc/apron-tilt",
    title: "外斜腳家具 · 牙條斜度計算器",
    intro:
      "4 隻腳對角線 splay 的家具，apron／牙條的斜度不是腳的整體斜度，而是「前／側視看到的腳投影斜度」——輸入腳的外斜角度跟腳高，直接算出牙條要鋸的角度。",
  },
];

export default function CalcIndex() {
  return (
    <main className="max-w-2xl mx-auto px-6 py-10">
      <Link href="/" className="text-sm text-zinc-500 hover:underline">
        ← 回首頁
      </Link>

      <h1 className="text-2xl font-bold mt-3 mb-2 text-zinc-900">小工具</h1>
      <p className="text-sm text-zinc-600 mb-8 leading-relaxed">
        木作藍圖裡順手做的木工幾何小計算器，跟主要的家具設計器分開放這裡。
        目前只有一個，之後有新的會加進來。
      </p>

      <ul className="space-y-4">
        {TOOLS.map((tool) => (
          <li key={tool.href}>
            <Link
              href={tool.href}
              className="block rounded-lg border border-zinc-200 bg-white p-5 hover:border-amber-300 hover:bg-amber-50/50 transition-colors"
            >
              <div className="font-semibold text-zinc-900">{tool.title}</div>
              <p className="text-sm text-zinc-600 mt-1.5 leading-relaxed">
                {tool.intro}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
