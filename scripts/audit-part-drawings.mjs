// Playwright 批次截圖：對 28 個家具模板各截 5 張圖
//   - panel.png        — PartDrawings 區整段（cards grid）
//   - modal-1.png      — 第 1 個 part 的 modal
//   - modal-mid.png    — 中間 part 的 modal（idx = floor(len/2)）
//   - 3d.png           — 3D 透視圖整塊
//   - three-views.png  — 工程三視圖 SVG 區整段
//
// 輸出：/tmp/audit-parts/{template}/*.png
// 跑：node scripts/audit-part-drawings.mjs
// 前提：dev server 已開（http://localhost:3000）

import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.AUDIT_BASE_URL || "http://localhost:3000";
const OUT_ROOT = "/tmp/audit-parts";

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
const summary = []; // {slug, groups, shots:[...]}

async function closeModalIfOpen() {
  // try Escape first, then click backdrop
  try {
    const modal = page.locator("div.fixed.inset-0").filter({ has: page.locator(".bg-white") }).first();
    if (await modal.count() > 0 && await modal.isVisible()) {
      await page.keyboard.press("Escape");
      await page.waitForTimeout(200);
    }
  } catch (_) {}
}

async function shootPanel(outDir) {
  const panel = page.locator("section").filter({ hasText: "零件圖" }).first();
  if ((await panel.count()) === 0) return { ok: false, reason: "no panel" };
  await panel.scrollIntoViewIfNeeded({ timeout: 3000 });
  await page.waitForTimeout(250);
  await panel.screenshot({ path: path.join(outDir, "panel.png"), timeout: 8000 });
  return { ok: true };
}

async function shootThreeViews(outDir) {
  const sec = page.locator("section").filter({ hasText: "工程三視圖" }).first();
  if ((await sec.count()) === 0) return { ok: false, reason: "no three-views section" };
  await sec.scrollIntoViewIfNeeded({ timeout: 3000 });
  await page.waitForTimeout(250);
  await sec.screenshot({ path: path.join(outDir, "three-views.png"), timeout: 8000 });
  return { ok: true };
}

async function shoot3D(outDir) {
  let target = page.locator('[data-thumb="3d"]').first();
  if ((await target.count()) === 0) {
    target = page.locator("canvas").first();
  }
  if ((await target.count()) === 0) return { ok: false, reason: "no 3d" };
  await target.scrollIntoViewIfNeeded({ timeout: 3000 });
  await page.waitForTimeout(250);
  await target.screenshot({ path: path.join(outDir, "3d.png"), timeout: 8000 });
  return { ok: true };
}

async function countPartCards() {
  const cards = page.locator("section").filter({ hasText: "零件圖" }).first().locator('button[type="button"]');
  return await cards.count();
}

async function shootModal(outDir, fileBase, partIdx) {
  // click the Nth card (0-based)
  const cards = page.locator("section").filter({ hasText: "零件圖" }).first().locator('button[type="button"]');
  const target = cards.nth(partIdx);
  if ((await target.count()) === 0) return { ok: false, reason: `no card idx=${partIdx}` };
  await target.scrollIntoViewIfNeeded({ timeout: 3000 });
  await target.click({ timeout: 5000 });
  // wait for modal
  const modal = page.locator("div.fixed.inset-0").filter({ has: page.locator(".bg-white") }).first();
  await modal.waitFor({ state: "visible", timeout: 5000 });
  await page.waitForTimeout(700); // let SVG render
  // screenshot the modal content (full overlay incl. backdrop is fine)
  await modal.screenshot({ path: path.join(outDir, `${fileBase}.png`), timeout: 10000 });
  // close modal
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  // fallback: if still visible, click backdrop top-left
  if (await modal.isVisible().catch(() => false)) {
    try { await modal.click({ position: { x: 5, y: 5 }, timeout: 2000 }); } catch (_) {}
    await page.waitForTimeout(200);
  }
  return { ok: true };
}

for (const slug of CATEGORIES) {
  const outDir = path.join(OUT_ROOT, slug);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const u = new URL(`${BASE}/design/${slug}`);
  u.searchParams.set("_shoot", "1");

  const row = { slug, groups: 0, shots: [], skipped: [] };

  try {
    await page.goto(u.toString(), { waitUntil: "networkidle", timeout: 30000 });
  } catch (e) {
    console.error(`[${slug}] navigate fail: ${e.message}`);
    for (const v of ["panel", "modal-1", "modal-mid", "3d", "three-views"]) {
      failures.push(`${slug}/${v}`);
      failCount++;
    }
    summary.push({ ...row, error: e.message });
    continue;
  }

  try { await page.waitForSelector('[data-thumb="3d"]', { timeout: 15000 }); } catch (_) {}
  await page.waitForTimeout(1500);
  await closeModalIfOpen();

  // count parts first (for modal targeting)
  let nParts = 0;
  try { nParts = await countPartCards(); } catch (_) {}
  row.groups = nParts;
  process.stdout.write(`[${slug}] groups=${nParts}\n`);

  // (1) panel.png
  try {
    const r = await shootPanel(outDir);
    if (r.ok) { okCount++; row.shots.push("panel"); process.stdout.write(`  ✓ ${slug}/panel\n`); }
    else { failures.push(`${slug}/panel`); failCount++; row.skipped.push(`panel:${r.reason}`); process.stdout.write(`  · ${slug}/panel skip (${r.reason})\n`); }
  } catch (e) {
    failures.push(`${slug}/panel`); failCount++;
    process.stdout.write(`  ✗ ${slug}/panel: ${e.message.split("\n")[0]}\n`);
  }

  // (2) modal-1.png
  if (nParts > 0) {
    try {
      const r = await shootModal(outDir, "modal-1", 0);
      if (r.ok) { okCount++; row.shots.push("modal-1"); process.stdout.write(`  ✓ ${slug}/modal-1\n`); }
      else { failures.push(`${slug}/modal-1`); failCount++; process.stdout.write(`  · ${slug}/modal-1 skip (${r.reason})\n`); }
    } catch (e) {
      failures.push(`${slug}/modal-1`); failCount++;
      process.stdout.write(`  ✗ ${slug}/modal-1: ${e.message.split("\n")[0]}\n`);
      await closeModalIfOpen();
    }
  } else {
    row.skipped.push("modal-1:no parts");
    process.stdout.write(`  · ${slug}/modal-1 skip (no parts)\n`);
  }

  // (3) modal-mid.png
  if (nParts > 1) {
    const midIdx = Math.floor(nParts / 2);
    try {
      const r = await shootModal(outDir, "modal-mid", midIdx);
      if (r.ok) { okCount++; row.shots.push(`modal-mid(idx=${midIdx})`); process.stdout.write(`  ✓ ${slug}/modal-mid (idx=${midIdx})\n`); }
      else { failures.push(`${slug}/modal-mid`); failCount++; process.stdout.write(`  · ${slug}/modal-mid skip (${r.reason})\n`); }
    } catch (e) {
      failures.push(`${slug}/modal-mid`); failCount++;
      process.stdout.write(`  ✗ ${slug}/modal-mid: ${e.message.split("\n")[0]}\n`);
      await closeModalIfOpen();
    }
  } else {
    row.skipped.push("modal-mid:not enough parts");
    process.stdout.write(`  · ${slug}/modal-mid skip (parts=${nParts})\n`);
  }

  // (4) 3d.png
  try {
    const r = await shoot3D(outDir);
    if (r.ok) { okCount++; row.shots.push("3d"); process.stdout.write(`  ✓ ${slug}/3d\n`); }
    else { failures.push(`${slug}/3d`); failCount++; process.stdout.write(`  · ${slug}/3d skip (${r.reason})\n`); }
  } catch (e) {
    failures.push(`${slug}/3d`); failCount++;
    process.stdout.write(`  ✗ ${slug}/3d: ${e.message.split("\n")[0]}\n`);
  }

  // (5) three-views.png
  try {
    const r = await shootThreeViews(outDir);
    if (r.ok) { okCount++; row.shots.push("three-views"); process.stdout.write(`  ✓ ${slug}/three-views\n`); }
    else { failures.push(`${slug}/three-views`); failCount++; process.stdout.write(`  · ${slug}/three-views skip (${r.reason})\n`); }
  } catch (e) {
    failures.push(`${slug}/three-views`); failCount++;
    process.stdout.write(`  ✗ ${slug}/three-views: ${e.message.split("\n")[0]}\n`);
  }

  summary.push(row);
}

await browser.close();

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
console.log(`==== Summary ====`);
for (const r of summary) {
  console.log(`  ${r.slug.padEnd(20)} groups=${String(r.groups).padStart(2)} shots=[${r.shots.join(", ")}]${r.skipped.length ? "  skipped=[" + r.skipped.join(", ") + "]" : ""}${r.error ? "  ERROR=" + r.error : ""}`);
}
console.log("");
console.log(`Done: ${okCount} ok / ${failCount} fail`);
if (failures.length > 0) {
  console.log(`Failures:\n  ${failures.join("\n  ")}`);
}
console.log(`Output: ${OUT_ROOT}  (${totalMB} MB)`);
console.log("Phase 1 done");
