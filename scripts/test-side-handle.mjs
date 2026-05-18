import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const SLUGS = ["nightstand", "media-console", "chest-of-drawers", "shoe-cabinet"];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1400, height: 1100 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();

const VIEW_TITLES = { front: "正視圖", side: "側視圖", top: "俯視圖" };

for (const slug of SLUGS) {
  const u = new URL(`${BASE}/design/${slug}`);
  u.searchParams.set("_shoot", "1");
  await page.goto(u.toString(), { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(2500);
  for (const [v, title] of Object.entries(VIEW_TITLES)) {
    try {
      const svg = page.locator('svg').filter({ hasText: title }).first();
      if (await svg.count() === 0) throw new Error(`no svg with "${title}"`);
      await svg.scrollIntoViewIfNeeded({ timeout: 3000 });
      await page.waitForTimeout(300);
      await svg.screenshot({ path: `/tmp/test-${slug}-${v}.png`, timeout: 8000 });
      console.log(`OK ${slug}/${v}`);
    } catch (e) {
      console.log(`FAIL ${slug}/${v}: ${e.message.split("\n")[0]}`);
    }
  }
}

await browser.close();
