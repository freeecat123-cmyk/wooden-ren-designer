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
  "cert-c1", "cert-c2", "cert-c3", "cert-b1",
];

// 某些模板用預設尺寸時，cutplan 會出現「超過原料」警告而不畫排板圖。
// 用小尺寸 override 強制能切料。
const PARAM_OVERRIDES = {
  "open-bookshelf": { length: "600", width: "250", height: "1200" },
};

// 套組題（丙級檢定）：預設尺寸就是考題答案，介紹頁截圖要把所有帶數字的文字糊掉
// （木頭仁 2026-09-08：「介紹頁不要把重點尺寸都放出來，不然別人就不用買了」）。線條／版面照舊，只糊字。
const BLUR_DIGITS = new Set(["cert-c1", "cert-c2", "cert-c3", "cert-b1"]);
async function blurDigits(page) {
  await page.evaluate(() => {
    const hasDigit = (t) => /\d/.test(t || "");
    // SVG <text>：整個元素糊
    for (const el of document.querySelectorAll("svg text")) {
      if (hasDigit(el.textContent)) el.style.filter = "blur(2.5px)";
    }
    // HTML 文字節點：含數字的整段包起來糊
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) {
      const n = walker.currentNode;
      if (n.parentElement && !n.parentElement.closest("svg") && hasDigit(n.nodeValue)) nodes.push(n);
    }
    for (const n of nodes) {
      const span = document.createElement("span");
      span.style.filter = "blur(4px)";
      span.textContent = n.nodeValue;
      n.parentNode.replaceChild(span, n);
    }
  });
}

const SHOTS = [
  {
    key: "threeview",
    path: (s) => `/design/${s}?_shoot=1`,
    tab: "drawings",
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
    tab: "materials",
    sel: '[data-section="cutlist"]',
    extraWait: 500,
  },
  {
    key: "steps",
    path: (s) => `/design/${s}?_shoot=1`,
    tab: "build",
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
    // 2026-09 新版設計工作室把三視圖／材料／工序放進分頁（role=tab），沒點分頁區塊是 hidden、waitForSelector 會逾時
    if (shot.tab) {
      const tabSel = `[role="tab"][id$="-tab-${shot.tab}"]`;
      await page.waitForSelector(tabSel, { timeout: 30000 });
      // hydration 前點下去沒反應（SSR 的按鈕還沒掛 onClick）→ 點到 aria-selected=true 為止
      for (let i = 0; i < 40; i++) {
        await page.click(tabSel);
        await page.waitForTimeout(500);
        if ((await page.getAttribute(tabSel, "aria-selected")) === "true") break;
      }
    }
    await page.waitForSelector(shot.sel, { timeout: shot.selectorTimeout ?? 15000 });
    await page.waitForTimeout(shot.extraWait);
    if (BLUR_DIGITS.has(slug)) await blurDigits(page);
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
