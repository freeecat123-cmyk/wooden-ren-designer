import { Link } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";

/**
 * 木匠學院活動 banner — 報名學院送 2 年木作藍圖
 *
 * 共用 component，目前用於 /about 與 / 首頁底部。
 *
 * 國際版規則：木匠學院是台灣業務（中文課程綁定），英文版完全隱藏此 banner
 * （不翻譯）。Master plan project_designer_international.md 已記錄此決策。
 */
export async function AcademyPromoBanner() {
  const locale = await getLocale();
  if (locale !== "zh-TW") return null;

  return (
    <section className="bg-gradient-to-br from-zinc-900 via-amber-950 to-zinc-900 text-white">
      <div className="max-w-5xl mx-auto px-5 sm:px-6 py-14 sm:py-20">
        <div className="text-center">
          <span className="inline-block px-3 py-1 rounded-full bg-amber-600 text-white text-xs font-bold tracking-wider mb-5 shadow-lg">
            🎁 限時活動
          </span>
          <h2 className="font-serif-tc text-3xl sm:text-4xl md:text-5xl font-bold leading-[1.2]">
            報名木匠學院
            <br className="sm:hidden" />
            <span className="text-amber-400"> 送 2 年木作藍圖</span>
          </h2>
          <p className="mt-6 text-amber-100/90 leading-loose max-w-2xl mx-auto text-base sm:text-lg">
            上課學手藝、24 個月藍圖讓你出圖設計
            <span className="block mt-2 text-amber-300/80 text-sm">
              學完技術馬上能用藍圖設計家具動工——下了課就進工坊開鋸
            </span>
          </p>
          <div className="mt-6 inline-flex flex-col items-center gap-1 px-5 py-3 rounded-xl bg-black/30 ring-1 ring-amber-500/40">
            <div className="text-xs text-amber-300 font-semibold tracking-wider">
              藍圖訂閱價值
            </div>
            <div className="text-2xl font-bold text-white tabular-nums">
              NT$890 × 24 個月 ={" "}
              <span className="text-amber-400">NT$21,360</span>
            </div>
          </div>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <a
              href="https://woodenrenclass.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-amber-500 text-zinc-900 font-bold shadow-2xl shadow-amber-500/40 hover:bg-amber-400 hover:-translate-y-0.5 transition-all"
            >
              看木匠學院課程 →
            </a>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-white/10 ring-1 ring-white/30 text-white font-semibold hover:bg-white/20 transition-all"
            >
              看藍圖訂閱方案
            </Link>
          </div>
          <p className="mt-6 text-xs text-amber-200/60">
            ※ 報名學院任一課程即享，2 年內藍圖全 26 模板無限次使用
          </p>
        </div>
      </div>
    </section>
  );
}
