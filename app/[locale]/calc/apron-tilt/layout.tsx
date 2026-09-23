import type { Metadata, ResolvingMetadata } from "next";

/**
 * ⛔ 這個目錄底下只有一個 `"use client"` 頁面、沒有任何 metadata export,
 *    於是整個繼承 `app/[locale]/layout.tsx` 的 alternates —— 而那份的
 *    canonical 指向**首頁**。實測正式站:
 *      /calc/apron-tilt → `<link rel="canonical" href="https://designer.woodenren.com"/>`
 *
 *    後果:sitemap 用 0.85 的權重把這頁提交給 Google,頁面卻自己宣告
 *    「我的正式版本是首頁」→ **永遠不會被收錄**,那個優先權等於白給。
 *
 * ⚠️ 這頁是 TW-only(見 app/sitemap.ts 的 TW_ONLY_ROUTES),所以只給 canonical、
 *    不給 languages —— 宣告一個不存在的英文版比沒宣告更糟。
 */
export async function generateMetadata(
  _props: unknown,
  parent: ResolvingMetadata,
): Promise<Metadata> {
  const p = await parent;
  return {
    ...(p.title ? {} : {}),
    alternates: { canonical: "/calc/apron-tilt" },
  };
}

export default function ApronTiltLayout({ children }: { children: React.ReactNode }) {
  return children;
}
