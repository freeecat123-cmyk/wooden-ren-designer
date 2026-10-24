import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { brandFromHeaders, neutralOrigin, normalizeHost } from "@/lib/brand-hosts";

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

function mainRobots(): MetadataRoute.Robots {
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
        /**
         * 2026-10-18 拿掉 `/my-designs`:該路由早就不存在(全 repo 只剩這條規則
         * 提到它,`app/[locale]/my-designs` 沒有這個資料夾)。死規則留著不會壞事,
         * 但會讓人以為站上還有那一頁,下次要改 robots 時先去找一個不存在的路由。
         *
         * ⚠️ 裝潢工具的報價／列印頁(`/ceiling|floor|raised-floor/quote`)**故意不加**
         *    Disallow:那幾頁的 `noindex` 還在 `robot/2026-10-17` 等點頭,還沒進 main。
         *    先 Disallow 的話 Google 爬不到那一頁 → 讀不到 noindex,反而把
         *    「網址本身被收錄」這條路留著(網址裡就有客戶姓名)。
         *    要等 noindex 上線、Google 重爬過之後才輪到 Disallow。
         */
        disallow: withEnglishPaths([
          "/admin",
          "/admin/",
          "/api/",
          "/auth/",
          "/chat",
          "/my-subscription",
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

/**
 * 中性品牌網域（Furniture Blueprints）：同一套擋法，但 sitemap / host 指向中性網域自己。
 * ⛔ 不能指回 designer.woodenren.com（爬蟲會把兩個網域連在一起）。
 */
function neutralRobots(origin: string): MetadataRoute.Robots {
  const base = mainRobots();
  return { ...base, sitemap: `${origin}/sitemap.xml`, host: origin };
}

export default async function robots(): Promise<MetadataRoute.Robots> {
  let neutral = false;
  let host: string | null = null;
  try {
    const h = await headers();
    neutral = brandFromHeaders(h) === "neutral";
    host = h.get("host");
  } catch {
    // 非請求情境（測試 / build）→ 主站
  }
  return neutral ? neutralRobots(neutralOrigin(normalizeHost(host))) : mainRobots();
}
