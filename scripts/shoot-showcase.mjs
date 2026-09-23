// 模板介紹頁「實機畫面」截圖腳本
// 每個模板跑 2~3 個 URL 變體：
//   A. 預設 3D
//   B. 榫接模式（joineryMode=true）
//   C. 殺手鐧細節（wireframe / explode / xray，依 SHOTS 表）
//
// 輸出 public/showcase/{slug}-{shot}.png（1200px 寬）
//
// 跑：node scripts/shoot-showcase.mjs
//     node scripts/shoot-showcase.mjs stool wardrobe   # 只跑指定模板
// 前提：dev server 已開（http://localhost:3000）+ `npx playwright install chromium`

import { chromium } from "playwright";
import sharp from "sharp";
import fs from "node:fs";

const BASE = process.env.SHOWCASE_BASE_URL || "http://localhost:3000";
const OUT_DIR = "public/showcase";
const VIEWPORT = { width: 1400, height: 1100 };
const FINAL_WIDTH = 1200;

// 24 個有介紹頁的模板（bed / coat-rack / chinese-cabinet 沒介紹頁排除）
const CATEGORIES = [
  "stool", "round-stool", "bar-stool", "bench",
  "dining-chair",
  "side-table", "tea-table", "low-table",
  "round-tea-table", "round-table", "dining-table",
  "desk",
  "open-bookshelf", "chest-of-drawers", "media-console",
  "wardrobe", "shoe-cabinet", "nightstand", "display-cabinet",
  "pencil-holder", "photo-frame", "tray", "dovetail-box", "wine-rack",
];

// 每模板的 C 鏡頭（沒列的就只截 A + B）
//   shot: 檔名後綴
//   params: 額外 URL 參數
//   wait: 額外 settle ms
const C_SHOTS = {
  // 抽屜類：藏抽屜面看內部抽屜結構
  "chest-of-drawers":  { shot: "drawers",   params: { xray: "face" } },
  "media-console":     { shot: "drawers",   params: { xray: "face" } },
  "side-table":        { shot: "drawers",   params: { xray: "face" } },
  "nightstand":        { shot: "drawers",   params: { xray: "face" } },
  // 鳩尾盒：掀蓋看內部 + 鳩尾接合
  "dovetail-box":      { shot: "lid",       params: { lidLift: "140" }, wait: 2000 },
};

const targets = process.argv.slice(2).length > 0
  ? process.argv.slice(2).filter((s) => CATEGORIES.includes(s))
  : CATEGORIES;

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2 });
const page = await ctx.newPage();

let ok = 0, fail = 0;

async function shoot(slug, shotName, extraParams = {}, extraWait = 0) {
  const u = new URL(`${BASE}/design/${slug}`);
  u.searchParams.set("_shoot", "1");
  for (const [k, v] of Object.entries(extraParams)) u.searchParams.set(k, String(v));

  try {
    await page.goto(u.toString(), { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForSelector('[data-thumb="3d"]', { timeout: 15000 });
    await page.waitForTimeout(1500 + extraWait);
    const card = page.locator('[data-thumb="3d"]').first();
    const buf = await card.screenshot({ type: "png" });

    const outPath = `${OUT_DIR}/${slug}-${shotName}.png`;
    await sharp(buf)
      .resize(FINAL_WIDTH, null, { fit: "inside", withoutEnlargement: true })
      .png({ compressionLevel: 9 })
      .toFile(outPath);

    const size = fs.statSync(outPath).size;
    console.log(`✓ ${slug.padEnd(20)} ${shotName.padEnd(10)} ${(size / 1024).toFixed(1)} KB`);
    ok++;
  } catch (e) {
    console.error(`✗ ${slug} / ${shotName}:`, e.message);
    fail++;
  }
}

for (const slug of targets) {
  // A. 預設 3D
  await shoot(slug, "3d");
  // B. 線框模式（看內部結構，對所有模板都有差異化）
  await shoot(slug, "wireframe", { wf: "1" });
  // C. 殺手鐧細節（如有）
  const c = C_SHOTS[slug];
  if (c) await shoot(slug, c.shot, c.params, c.wait ?? 0);
}

await browser.close();
console.log(`\nDone: ${ok} ok, ${fail} fail`);
