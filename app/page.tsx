import Link from "next/link";
import { FURNITURE_CATALOG } from "@/lib/templates";

const DIFFICULTY_LABEL = {
  beginner: "入門",
  intermediate: "中階",
  advanced: "進階",
} as const;

const DIFFICULTY_COLOR = {
  beginner: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  intermediate: "bg-amber-100 text-amber-800 ring-amber-200",
  advanced: "bg-rose-100 text-rose-800 ring-rose-200",
} as const;

export default function Home() {
  const ready = FURNITURE_CATALOG.filter((f) => f.template).length;
  return (
    <main className="max-w-6xl mx-auto px-6 py-12">
      <header className="mb-12">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 ring-1 ring-amber-200 text-amber-800 text-xs font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          木頭仁木匠學院 · 工程圖生成器 v0.3
        </div>
        <h1 className="mt-4 text-4xl font-bold tracking-tight text-zinc-900">
          從尺寸到圖紙，三秒鐘完成
        </h1>
        <p className="mt-3 max-w-2xl text-zinc-600 leading-relaxed">
          選一件家具、輸入長寬高，自動生成 3D 透視圖、工程三視圖、榫卯細節、切料尺寸、
          工具清單與製作工序。所有尺寸以毫米為單位，切料長度已自動計算榫頭凸出量。
        </p>
        <div className="mt-5 flex gap-6 text-sm text-zinc-500">
          <span>
            <strong className="text-zinc-900 font-semibold">{ready}</strong> 種家具範本
          </span>
          <span>
            <strong className="text-zinc-900 font-semibold">6</strong> 種木材
          </span>
          <span>
            <strong className="text-zinc-900 font-semibold">10+</strong> 種榫卯結構
          </span>
        </div>
      </header>

      <section>
        <div className="flex items-baseline justify-between mb-5">
          <h2 className="text-xl font-semibold text-zinc-800">選擇家具</h2>
          <span className="text-xs text-zinc-500">點擊卡片進入設計器</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FURNITURE_CATALOG.map((item) => (
            <Link
              key={item.category}
              href={`/design/${item.category}`}
              className="group block rounded-xl border border-zinc-200 bg-white p-5 hover:border-amber-400 hover:shadow-md transition relative overflow-hidden"
            >
              <div className="absolute -right-6 -top-6 w-20 h-20 rounded-full bg-amber-50 opacity-0 group-hover:opacity-100 transition" />
              <div className="relative flex items-start justify-between gap-2">
                <h3 className="text-lg font-semibold text-zinc-900 group-hover:text-amber-900">
                  {item.nameZh}
                </h3>
                <span
                  className={`shrink-0 text-xs px-2 py-0.5 rounded-full ring-1 ${DIFFICULTY_COLOR[item.difficulty]}`}
                >
                  {DIFFICULTY_LABEL[item.difficulty]}
                </span>
              </div>
              <p className="relative mt-2 text-sm text-zinc-600 leading-relaxed line-clamp-2">
                {item.description}
              </p>
              <p className="relative mt-3 text-xs text-zinc-500 font-mono">
                {item.defaults.length} × {item.defaults.width} × {item.defaults.height} mm
              </p>
              {!item.template && (
                <p className="relative mt-2 text-xs text-amber-700">尚未實作</p>
              )}
            </Link>
          ))}
        </div>
      </section>

      <footer className="mt-20 pt-8 border-t border-zinc-200 text-sm text-zinc-500 flex flex-wrap justify-between gap-4">
        <p>© 2026 木頭仁木匠學院</p>
        <p className="text-xs">
          v0.3 · 12 種家具範本 · 專業工程圖標準輸出
        </p>
      </footer>
    </main>
  );
}
