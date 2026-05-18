import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = "http://localhost:3000";
const OUT = "/tmp/audit-pip-fix";
const CATEGORIES = ["nightstand", "media-console", "wardrobe", "open-bookshelf"];

if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1400, height: 1400 } });
const page = await ctx.newPage();

page.on("console", (m) => {
  if (m.type() === "error") console.log("  [console.error]", m.text().slice(0, 200));
});

for (const slug of CATEGORIES) {
  const outDir = path.join(OUT, slug);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  console.log(`\n=== ${slug} ===`);
  try {
    await page.goto(`${BASE}/design/${slug}?_shoot=1`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(3000);

    // Scroll all the way down to make sure PartDrawings section renders
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1500);

    const title = await page.title();
    console.log(`  title: ${title}`);

    // Try multiple ways to find the panel
    const panel = page.locator('section:has-text("零件圖")').first();
    const panelN = await panel.count();
    console.log(`  panel count: ${panelN}`);

    // Save full page screenshot for diagnosis if no panel found
    if (panelN === 0) {
      await page.screenshot({ path: path.join(outDir, "page-full.png"), fullPage: true });
      console.log(`  ! saved full-page diag at page-full.png`);
      continue;
    }

    await panel.scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(500);

    const cards = panel.locator("ul > li button");
    const n = await cards.count();
    console.log(`  cards: ${n}`);
    if (n === 0) continue;

    await cards.first().click();
    await page.waitForTimeout(1200);

    await page.screenshot({ path: path.join(outDir, "modal-1.png"), fullPage: false });

    const pip = page.locator(".install-hint-mini").first();
    const pipN = await pip.count();
    console.log(`  pip count: ${pipN}`);
    if (pipN > 0) {
      await pip.screenshot({ path: path.join(outDir, "pip-1.png") });
    }

    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);

    const mid = Math.floor(n / 2);
    if (mid !== 0 && mid < n) {
      await cards.nth(mid).click();
      await page.waitForTimeout(900);
      const pip2 = page.locator(".install-hint-mini").first();
      if (await pip2.count() > 0) {
        await pip2.screenshot({ path: path.join(outDir, "pip-mid.png") });
      }
      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);
    }
  } catch (e) {
    console.log(`  ERROR: ${e.message}`);
  }
}

await browser.close();
console.log(`\nDone. Output: ${OUT}`);
