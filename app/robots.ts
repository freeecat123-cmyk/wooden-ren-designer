import type { MetadataRoute } from "next";

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://designer.woodenren.com";

/**
 * 把每一條規則再補一份 `/en` 前綴的。
 *
 * ⛔ robots.txt 是**前綴比對**:帶萬用字元的設計頁規則(print / quote / cut-plan)
 *    比不到 `/en/design/stool/quote` 這種網址。
 *    原本的清單全是中文站路徑,英文站那一整組對應頁面(報價、列印、裁切、
 *    後台、聊天、我的訂閱)**完全沒有被擋**,Google 會照爬照收。
 *    實測正式站 robots.txt 確認過:12 條規則沒有任何一條帶 /en。
 *
 * ⚠️ `/api/` 與 `/auth/` 不是 locale 路由(沒有 /en/api),但多擋一條無害;
 *    寧可整齊一致,也不要下次新增規則時又忘記哪些要配 /en。
 */
function withEnglishPaths(paths: string[]): string[] {
  return [...paths, ...paths.map((p) => `/en${p}`)];
}

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: withEnglishPaths([
          "/admin",
          "/admin/",
          "/api/",
          "/auth/",
          "/chat",
          "/my-subscription",
          "/my-designs",
          "/design/*/print",
          "/design/*/quote",
          "/design/*/quote/print",
          "/design/*/cut-plan",
        ]),
      },
    ],
    sitemap: `${BASE}/sitemap.xml`,
    host: BASE,
  };
}
