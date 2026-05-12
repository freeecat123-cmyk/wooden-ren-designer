// Playwright 一次性腳本：開 localhost:3000/design/{type}，截 3D 卡片那塊，
// resize 到 320x240 webp 存 public/thumbs/{type}.webp。
//
// 跑：node scripts/shoot-thumbs.mjs
// 前提：dev server 已開（http://localhost:3000）+ 已 `npx playwright install chromium`

import { chromium } from "playwright";
import sharp from "sharp";
import fs from "node:fs";

const BASE = process.env.THUMBS_BASE_URL || "http://localhost:3000";
const OUT_DIR = "public/thumbs/v2";

// 已實作的 28 個 category（跟 FURNITURE_CATALOG 同步）
const CATEGORIES = [
  "stool", "dining-chair", "dining-table", "bed", "desk", "wardrobe",
  "nightstand", "shoe-cabinet", "display-cabinet", "open-bookshelf",
  "chest-of-drawers", "bench", "tea-table", "round-stool", "round-table",
  "round-tea-table", "side-table", "low-table", "bar-stool", "media-console",
  "chinese-cabinet", "pencil-holder", "bookend", "photo-frame", "tray",
  "dovetail-box", "wine-rack", "coat-rack",
];

// 視覺長相過近的家具用 query 參數差異化
const PARAM_OVERRIDES = {
  "round-tea-table": { legShape: "splayed-round-taper-down" },
  "round-table": { legShape: "trestle" },
};

const VIEWPORT = { width: 1400, height: 1100 };
const FINAL_SIZE = { width: 320, height: 240 };
const PAD_BG = "#f1f1f0";

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2 });
const page = await ctx.newPage();

let ok = 0, fail = 0;
for (const slug of CATEGORIES) {
  const u = new URL(`${BASE}/design/${slug}`);
  u.searchParams.set("_shoot", "1"); // dev-only paywall bypass
  const overrides = PARAM_OVERRIDES[slug] ?? {};
  for (const [k, v] of Object.entries(overrides)) u.searchParams.set(k, String(v));
  try {
    await page.goto(u.toString(), { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForSelector('[data-thumb="3d"]', { timeout: 15000 });
    // 讓 Three.js settle（frameloop demand → 拖滑鼠/wait 觸發 render）
    await page.waitForTimeout(1500);
    const card = page.locator('[data-thumb="3d"]').first();
    const buf = await card.screenshot({ type: "png" });

    // 內縮 ~85%（不要貼邊）+ extend padding 到固定 320x240
    const meta = await sharp(buf).metadata();
    const targetW = Math.floor(FINAL_SIZE.width * 0.85);
    const targetH = Math.floor(FINAL_SIZE.height * 0.85);
    const resized = await sharp(buf).resize(targetW, targetH, { fit: "inside" }).toBuffer();
    const rmeta = await sharp(resized).metadata();
    const padL = Math.floor((FINAL_SIZE.width - rmeta.width) / 2);
    const padR = FINAL_SIZE.width - rmeta.width - padL;
    const padT = Math.floor((FINAL_SIZE.height - rmeta.height) / 2);
    const padB = FINAL_SIZE.height - rmeta.height - padT;
    await sharp(resized)
      .extend({ top: padT, bottom: padB, left: padL, right: padR, background: PAD_BG })
      .webp({ quality: 82 })
      .toFile(`${OUT_DIR}/${slug}.webp`);

    const size = fs.statSync(`${OUT_DIR}/${slug}.webp`).size;
    console.log(`✓ ${slug.padEnd(20)} ${(size / 1024).toFixed(1)} KB  src ${meta.width}x${meta.height}`);
    ok++;
  } catch (e) {
    console.error(`✗ ${slug}:`, e.message);
    fail++;
  }
}

await browser.close();
console.log(`\nDone: ${ok} ok, ${fail} fail`);
