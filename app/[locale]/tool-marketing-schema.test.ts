import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";

/**
 * 裝潢工具行銷頁的 Product 結構化資料：`image` 必須指到**自己**的縮圖。
 *
 * ⛔ 為什麼要有這支：floor / raised-floor 兩頁的 productSchema.image 長期都寫
 *    `/thumbs/v2/ceiling.webp`（複製 CeilingMarketing.tsx 時一起帶過來的）。
 *    Google 的商品摘要會拿這個欄位當商品圖 → 搜「架高地板計算」看到的是天花板
 *    角材圖。這是客人看得到的錯，而且三支 Marketing.tsx 長得幾乎一樣，
 *    下次再複製一份就會再錯一次，所以用機器守住而不是靠人記得。
 */
const TOOLS = [
  { dir: "ceiling", file: "CeilingMarketing.tsx", thumb: "ceiling" },
  { dir: "floor", file: "FloorMarketing.tsx", thumb: "floor" },
  { dir: "raised-floor", file: "RaisedFloorMarketing.tsx", thumb: "raised-floor" },
];

describe("裝潢工具行銷頁 productSchema.image", () => {
  for (const tool of TOOLS) {
    it(`${tool.dir} 指到自己的縮圖，而且檔案真的存在`, () => {
      const src = readFileSync(`app/[locale]/${tool.dir}/${tool.file}`, "utf8");
      const m = src.match(/image:\s*`\$\{SITE_URL\}(\/thumbs\/v2\/[a-z0-9-]+\.webp)`/);
      expect(m, `${tool.file} 找不到 productSchema 的 image 欄位`).not.toBeNull();
      expect(m![1]).toBe(`/thumbs/v2/${tool.thumb}.webp`);
      expect(existsSync(`public${m![1]}`), `public${m![1]} 不存在`).toBe(true);
    });
  }
});
