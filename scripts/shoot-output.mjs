// 模板介紹頁「實際輸出畫面」截圖腳本
// 每個模板跑 4 個 URL：三視圖 / 排板 / 切料 / 工序
// （3D 已由 shoot-showcase.mjs 產出，不重做）
//
// 輸出 public/showcase/{slug}-{key}.png（1200px 寬）
//
// 跑：node scripts/shoot-output.mjs
//     node scripts/shoot-output.mjs stool wardrobe   # 只跑指定模板
// 前提：dev server 已開（http://localhost:3000）

import { chromium } from "playwright";
import sharp from "sharp";
import fs from "node:fs";

const BASE = process.env.SHOWCASE_BASE_URL || "http://localhost:3000";
const OUT_DIR = "public/showcase";
const VIEWPORT = { width: 1400, height: 1100 };
const FINAL_WIDTH = 1200;

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

// 某些模板用預設尺寸時，cutplan 會出現「超過原料」警告而不畫排板圖。
// 用小尺寸 override 強制能切料。
const PARAM_OVERRIDES = {
  "open-bookshelf": { length: "600", width: "250", height: "1200" },
};

const SHOTS = [
  {
    key: "threeview",
    path: (s) => `/design/${s}?_shoot=1`,
    sel: '[data-section="threeview"]',
    extraWait: 500,
  },
  {
    key: "cutplan",
    path: (s) => `/design/${s}/cut-plan?_shoot=1`,
    sel: '[data-cutplan-board="1"]',
    extraWait: 2500,
    selectorTimeout: 30000,
  },
  {
    key: "cutlist",
    path: (s) => `/design/${s}?_shoot=1`,
    sel: '[data-section="cutlist"]',
    extraWait: 500,
  },
  {
    key: "steps",
    path: (s) => `/design/${s}?_shoot=1`,
    sel: '[data-section="steps"]',
    extraWait: 500,
  },
];

const targets = process.argv.slice(2).length > 0
  ? process.argv.slice(2).filter((s) => CATEGORIES.includes(s))
  : CATEGORIES;

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2 });
const page = await ctx.newPage();

let ok = 0, fail = 0;

async function shoot(slug, shot) {
  const baseUrl = new URL(BASE + shot.path(slug));
  const ov = PARAM_OVERRIDES[slug];
  if (ov) for (const [k, v] of Object.entries(ov)) baseUrl.searchParams.set(k, v);
  const url = baseUrl.toString();
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForSelector(shot.sel, { timeout: shot.selectorTimeout ?? 15000 });
    await page.waitForTimeout(shot.extraWait);
    const el = page.locator(shot.sel).first();
    await el.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    const buf = await el.screenshot({ type: "png" });

    const outPath = `${OUT_DIR}/${slug}-${shot.key}.png`;
    await sharp(buf)
      .resize(FINAL_WIDTH, null, { fit: "inside", withoutEnlargement: true })
      .png({ compressionLevel: 9 })
      .toFile(outPath);

    const size = fs.statSync(outPath).size;
    console.log(`✓ ${slug.padEnd(20)} ${shot.key.padEnd(10)} ${(size / 1024).toFixed(1)} KB`);
    ok++;
  } catch (e) {
    console.error(`✗ ${slug} / ${shot.key}:`, e.message.split("\n")[0]);
    fail++;
  }
}

for (const slug of targets) {
  for (const shot of SHOTS) {
    await shoot(slug, shot);
  }
}

await browser.close();
console.log(`\nDone: ${ok} ok, ${fail} fail`);
