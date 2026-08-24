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
        /**
         * ⛔ `Disallow: /api/` 把 `/api/og` 也一起擋掉了 —— 那是**自己的分享預覽圖
         *    產生器**。設計頁與範本頁的 og:image 全部指向它
         *    (`app/[locale]/design/[type]/page.tsx:101`、
         *     `app/[locale]/templates/[type]/page.tsx:55`)。
         *    Facebook / LINE / Twitter 的爬蟲都會遵守 robots.txt,
         *    所以貼到社群的卡片只剩一行字、沒有圖。
         *    圖本身是好的(實測 /api/og 回 200、81KB PNG),
         *    是我們自己在門口貼了禁止進入。
         *
         * robots.txt 是「最長前綴優先」,所以這條 Allow 會蓋過下面的
         * `Disallow: /api/`,而其他 /api/* 端點仍然擋著。(2026-08-24)
         */
        allow: ["/", "/api/og"],
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
