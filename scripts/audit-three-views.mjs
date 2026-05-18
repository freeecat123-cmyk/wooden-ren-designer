// Playwright 批次截圖：對 28 個家具模板各截 4 張圖（3D + 正/側/俯三視圖）
// 輸出：/tmp/audit-views/{template}/{view}.png （view ∈ 3d, front, side, top）
//
// 跑：node scripts/audit-three-views.mjs
// 前提：dev server 已開（http://localhost:3000）

import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.AUDIT_BASE_URL || "http://localhost:3000";
const OUT_ROOT = "/tmp/audit-views";

const CATEGORIES = [
  "stool", "dining-chair", "dining-table", "bed", "desk", "wardrobe",
  "nightstand", "shoe-cabinet", "display-cabinet", "open-bookshelf",
  "chest-of-drawers", "bench", "tea-table", "round-stool", "round-table",
  "round-tea-table", "side-table", "low-table", "bar-stool", "media-console",
  "chinese-cabinet", "pencil-holder", "bookend", "photo-frame", "tray",
  "dovetail-box", "wine-rack", "coat-rack",
];

const VIEWPORT = { width: 1400, height: 1100 };

if (!fs.existsSync(OUT_ROOT)) fs.mkdirSync(OUT_ROOT, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 });
const page = await ctx.newPage();

let okCount = 0;
let failCount = 0;
const failures = [];

// View 對應 SVG 標題文字
const VIEW_TITLES = {
  front: "正視圖",
  side: "側視圖",
  top: "俯視圖",
};

for (const slug of CATEGORIES) {
  const outDir = path.join(OUT_ROOT, slug);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const u = new URL(`${BASE}/design/${slug}`);
  u.searchParams.set("_shoot", "1"); // paywall bypass

  try {
    await page.goto(u.toString(), { waitUntil: "networkidle", timeout: 30000 });
  } catch (e) {
    console.error(`[${slug}] navigate fail: ${e.message}`);
    for (const v of ["3d", "front", "side", "top"]) {
      failures.push(`${slug}/${v}`);
      failCount++;
    }
    continue;
  }

  // 等 Three.js & SVG 都 render 出來
  try {
    await page.waitForSelector('[data-thumb="3d"]', { timeout: 15000 });
  } catch (e) {
    // 3D 失敗不影響其他 view 嘗試
  }
  await page.waitForTimeout(1500);

  // (1) 3D 透視圖
  try {
    let target = page.locator('[data-thumb="3d"]').first();
    if (await target.count() === 0) {
      target = page.locator('canvas').first();
    }
    await target.screenshot({ path: path.join(outDir, "3d.png"), timeout: 8000 });
    okCount++;
    process.stdout.write(`  ✓ ${slug}/3d\n`);
  } catch (e) {
    failures.push(`${slug}/3d`);
    failCount++;
    process.stdout.write(`  ✗ ${slug}/3d: ${e.message.split("\n")[0]}\n`);
  }

  // (2)(3)(4) 三視圖 SVG
  for (const [viewKey, title] of Object.entries(VIEW_TITLES)) {
    try {
      const svg = page.locator('svg').filter({ hasText: title }).first();
      if (await svg.count() === 0) {
        throw new Error(`no svg with text "${title}"`);
      }
      await svg.scrollIntoViewIfNeeded({ timeout: 3000 });
      await page.waitForTimeout(200);
      await svg.screenshot({ path: path.join(outDir, `${viewKey}.png`), timeout: 8000 });
      okCount++;
      process.stdout.write(`  ✓ ${slug}/${viewKey}\n`);
    } catch (e) {
      failures.push(`${slug}/${viewKey}`);
      failCount++;
      process.stdout.write(`  ✗ ${slug}/${viewKey}: ${e.message.split("\n")[0]}\n`);
    }
  }
}

await browser.close();

// 計算輸出目錄大小
function dirSize(dir) {
  let total = 0;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) total += dirSize(p);
    else total += fs.statSync(p).size;
  }
  return total;
}

const totalBytes = fs.existsSync(OUT_ROOT) ? dirSize(OUT_ROOT) : 0;
const totalMB = (totalBytes / 1024 / 1024).toFixed(2);

console.log("");
console.log(`Done: ${okCount} ok / ${failCount} fail`);
if (failures.length > 0) {
  console.log(`Failures:\n  ${failures.join("\n  ")}`);
}
console.log(`Output: ${OUT_ROOT}  (${totalMB} MB)`);
console.log("Phase 1 done");
