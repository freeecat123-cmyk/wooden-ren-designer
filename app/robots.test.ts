import { describe, it, expect } from "vitest";
import robots from "./robots";

/**
 * 2026-08-24 大軍稽核抓到：`Disallow: /api/` 把 `/api/og` 也擋掉了 ——
 * 那是**自己的分享預覽圖產生器**，設計頁與範本頁的 og:image 全指向它。
 * 社群爬蟲（facebookexternalhit / Twitterbot / LINE）都會遵守 robots.txt，
 * 所以貼到社群的卡片只剩一行字沒有圖。圖本身是好的（實測 200 / 81KB PNG）。
 */
describe("robots.txt 不能擋掉自己的分享預覽圖", () => {
  const rule = () => {
    const r = robots();
    return Array.isArray(r.rules) ? r.rules[0] : r.rules!;
  };

  it("/api/og 要明確放行", () => {
    const allow = rule().allow;
    const list = Array.isArray(allow) ? allow : [allow];
    expect(list).toContain("/api/og");
  });

  it("其他 /api/* 端點還是要擋著（別把門開太大）", () => {
    const dis = rule().disallow as string[];
    expect(dis).toContain("/api/");
  });

  it("後台 / 登入 / 付費頁一律擋，中英文都要擋", () => {
    const dis = rule().disallow as string[];
    for (const p of ["/admin", "/auth/", "/my-subscription", "/design/*/quote"]) {
      expect(dis, `中文站 ${p}`).toContain(p);
      expect(dis, `英文站 /en${p}`).toContain(`/en${p}`);
    }
  });

  it("sitemap 指向自己的網域", () => {
    expect(robots().sitemap).toMatch(/^https?:\/\/.+\/sitemap\.xml$/);
  });
});
