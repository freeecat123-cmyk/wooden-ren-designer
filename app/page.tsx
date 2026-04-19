import Link from "next/link";
import { FURNITURE_CATALOG } from "@/lib/templates";

const DIFFICULTY_LABEL = {
  beginner: "入門",
  intermediate: "中階",
  advanced: "進階",
} as const;

const DIFFICULTY_COLOR = {
  beginner: "bg-emerald-100 text-emerald-800",
  intermediate: "bg-amber-100 text-amber-800",
  advanced: "bg-rose-100 text-rose-800",
} as const;

export default function Home() {
  return (
    <main className="max-w-6xl mx-auto px-6 py-12">
      <header className="mb-10">
        <h1 className="text-3xl font-bold text-zinc-900">木頭仁家具設計生成器</h1>
        <p className="mt-2 text-zinc-600">
          選一個家具，輸入尺寸，自動產出三視圖、透視圖、榫卯細節、材料單與工具清單。
        </p>
      </header>

      <section>
        <h2 className="text-xl font-semibold mb-4 text-zinc-800">家具種類</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FURNITURE_CATALOG.map((item) => (
            <Link
              key={item.category}
              href={`/design/${item.category}`}
              className="group block rounded-xl border border-zinc-200 bg-white p-5 hover:border-zinc-400 hover:shadow-sm transition"
            >
              <div className="flex items-start justify-between">
                <h3 className="text-lg font-semibold text-zinc-900 group-hover:text-zinc-700">
                  {item.nameZh}
                </h3>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${DIFFICULTY_COLOR[item.difficulty]}`}
                >
                  {DIFFICULTY_LABEL[item.difficulty]}
                </span>
              </div>
              <p className="mt-2 text-sm text-zinc-600 leading-relaxed">
                {item.description}
              </p>
              <p className="mt-3 text-xs text-zinc-500">
                預設尺寸：{item.defaults.length} × {item.defaults.width} × {item.defaults.height} mm
              </p>
              {!item.template && (
                <p className="mt-2 text-xs text-amber-700">尚未實作（即將推出）</p>
              )}
            </Link>
          ))}
        </div>
      </section>

      <footer className="mt-16 pt-8 border-t border-zinc-200 text-sm text-zinc-500">
        <p>© 2026 木頭仁木匠學院 · 版本 v0.2.0 · 12 種家具範本全數實作</p>
      </footer>
    </main>
  );
}
