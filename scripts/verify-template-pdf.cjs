#!/usr/bin/env node
// 「1:1 實尺樣板」下載流程的自動回歸驗證。
//
// 這支腳本要證明的三件事（不是「跑完就好」）：
//   1) 整條產生流程（字型子集 API → SVG → PDF）沒有任何錯誤
//   2) PDF 內嵌的中文是「這批樣板真正的文字」，不是被靜默換成 Helvetica 的亂碼——
//      這條管線踩過的雷是：字重 / 缺字時 svg2pdf 會靜默 fallback 或吞字，不報錯。
//      所以這裡不只檢查「有中文」，要比對抽出的文字含有預期的中文字串。
//   3) 兩種輸出模式都驗：printshop（選紙＋可能斜擺）與 A4 拼接（家用列印），
//      外加整包 zip 第一張的「印表機測試頁」——那張的 250mm 校正線量錯的話，
//      使用者會把錯的數字填回校正欄位，後面每一張樣板都跟著歪，比單張樣板錯更嚴重。
//   4) 樣板紙面那條 100mm 證明尺（測試頁是 250mm 校正線），用 pdf.js 光柵化後量出來的實際長度誤差 < 0.5mm
//      ——這是整個功能的命脈，木工照著這條尺描，尺寸錯了就切錯料。
//      尺的位置不固定（會自動避開內容、必要時轉成直式），量測位置讀 SVG 自報的
//      `data-ruler-box`；主線是灰色虛線，所以量的是兩端實線刻度之間的涵蓋範圍。
//
// 權限繞道說明（brief 沒交代、這裡補上判斷過程見 task-10-report.md）：
// 下載按鈕鎖在 `isAdmin || getPlanFeatures(profile).canDownloadPdf` 後面。專案
// 既有的 `?_shoot=1` dev-only 開關（app/[locale]/design/[type]/page.tsx 約 167
// 行）只繞過 `previewLocked`（範例預覽鎖），完全不影響 canDownloadPdf 的判斷式，
// 讀 code 可證：isThumbShoot 只出現在 previewLocked 那個條件式裡。也就是說
// `?_shoot=1` 開了也看不到下載按鈕，這條路不通。
//
// 因此改走「不經過 UI，直接在 Node + 真瀏覽器重現 downloadTemplatePack 的三段
// 管線」：
//   - SVG 產生（buildPackPlan / templateSheetSvg / indexSheetSvg）是純函式，
//     沒有 DOM 依賴，用 `tsx` 在 Node 端直接 import 專案原始 TS 模組執行
//     （跟 scripts/audit-overlaps.ts 用同一招：相對路徑 import，不吃
//     tsconfig 的 "@/..." alias，避免額外設定）。
//   - 字型子集：直接打真正在跑的 dev server 的 `/api/pdf-font`（跟前端
//     fetchFontSubset 走的是同一支 API，不是重新實作一份），確認這支路由
//     本身也沒有問題。
//   - SVG → PDF：**直接呼叫 pdf.ts 真正 export 的 svgsToPdf()**，不是拿
//     jsPDF/svg2pdf.js 手刻一份等效邏輯（第一版曾經這樣做，被複審抓到：手刻
//     版是「複製品」，驗證的不是生產環境真正在跑的程式碼，抓不到動過 pdf.ts
//     本體的迴歸）。用 esbuild（tsx 的相依，node_modules 已有）把
//     `lib/export/template-pack/pdf.ts` 連同它動態 import 的 jspdf /
//     svg2pdf.js 一起打包成瀏覽器可用的 IIFE（write:false，直接拿記憶體
//     內容），用 Playwright 的 `addScriptTag({ content })` 注入頁面，再呼叫
//     真正的 `window.TemplatePackPdf.svgsToPdf(svgs, pw, ph, fontB64)`。
//     （複審原本要求的示範案例是把隱藏容器的 `left:-99999px` 改成
//     `display:none`——pdf.ts 檔頭當時的註解警告這樣會讓 svg2pdf 依賴的 getBBox()
//     在沒參與版面的元素上回傳 0、整張圖崩掉（該註解已於 2026-08-19 依下述實測
//     結果改寫成誠實版本）。實測＋讀 svg2pdf.js 原始碼發現
//     這支腳本現在裝的版本（jspdf 4.2.1 / svg2pdf.js 2.7.0）文字測量走的是
//     TextMeasure 自己建立、另外掛在 document.body 下的量測用 SVG（可用
//     canvas measureText 或它自己 visibility:hidden 的節點），完全不依賴呼叫
//     端傳進去的容器可不可見，所以這個特定 mutation 對目前版本已經無效——
//     真的跑了兩次（合成 SVG + 全部四份真實 stool SVG）都是 byte-identical
//     輸出，只有時間戳／文件 ID 不同，證據見 task-10-report.md。這不代表
//     「複製品 vs 真代碼」的架構問題不重要：後面找到的字型註冊名稱不符
//     （`doc.addFont(..., "PackCJK-BROKEN", ...)` 對不上 SVG 的
//     `font-family="PackCJK"`）跟原本三個 brief mutation（字重 700→600、
//     PROOF_RULER_MM 100→95、collectChars 漏字）這支腳本現在都真的會擋下來，
//     證明架構本身是對的、只是 display:none 這個特定案例剛好在目前版本上
//     已經被上游修掉了。
//   - 逐字元覆蓋檢查：光比對幾個「具名」字串（設計名稱／零件名稱）會漏——
//     缺字未必掉在被比對的那幾個字上（例如標題「索引」的「引」、表頭
//     「件號」的「號」）。所以額外在 Node 端**獨立**（不重用 pdf.ts 的
//     collectChars，避免 collectChars 本身的 bug 同時把 expected 跟 actual
//     都算錯、互相遮掩）重新抽一次每張 SVG 應該出現的全部非空白字元，逐字
//     比對抽出的 PDF 文字，缺一個字元就報。
// 這樣任何人 clone 下來、npm install 後就能跑，不用手動建臨時頁面或臨時帳號。
//
// 用法：
//   npm run dev                                  # 另一個終端先起 dev server
//   node scripts/verify-template-pdf.cjs                                  # 用預設 http://localhost:3000 + stool
//   node scripts/verify-template-pdf.cjs http://localhost:3000/design/stool  # 也接受完整設計頁網址（只取 origin + 分類）
//   node scripts/verify-template-pdf.cjs http://localhost:3000 wardrobe   # 或分開指定 origin 跟分類

const fs = require("fs");
const path = require("path");
const http = require("http");
const { execFileSync } = require("child_process");
const { chromium } = require("playwright");
const esbuild = require("esbuild");

const ROOT = process.cwd();
const PDFJS_DIR = path.join(ROOT, "node_modules/pdfjs-dist/build");
const PDF_TS_ENTRY = path.join(ROOT, "lib/export/template-pack/pdf.ts");

const HELPER_PATH = path.join(ROOT, "scripts", ".verify-template-pdf-plan.mjs");
const PLAN_PATH = path.join(ROOT, "scripts", ".verify-template-pdf-plan.json");

function parseArgs() {
  const raw = process.argv[2] || "http://localhost:3000";
  let origin = raw;
  let category = process.argv[3] || null;
  try {
    const u = new URL(raw);
    origin = u.origin;
    if (!category) {
      const m = u.pathname.match(/\/design\/([a-z0-9-]+)/i);
      if (m) category = m[1];
    }
  } catch {
    // raw 不是合法 URL 就當成 origin 原樣用，讓後面 fetch 失敗時給出清楚錯誤。
  }
  return { origin, category: category || "stool" };
}

/** buildPackPlan / indexSheetSvg 是純函式，沒有 DOM 依賴，寫成臨時 helper 用 tsx 跑，
 *  跑完即刪——不留在 repo 裡（跟 scripts/audit-overlaps.ts 一樣用相對路徑 import，
 *  不吃 "@/..." alias）。 */
const HELPER_SRC = `
import { FURNITURE_CATALOG } from "../lib/templates/index.ts";
import { buildPackPlan } from "../lib/export/template-pack/pack.ts";
import { indexSheetSvg } from "../lib/export/template-pack/index-sheet.ts";
import { printerTestPageSvg } from "../lib/export/template-pack/tile-sheet.ts";
import { CALIBRATION_TEST_LINE_MM } from "../lib/export/template-pack/tiling.ts";
import { partDrawingSvgs } from "../lib/export/template-pack/part-drawing-svg.tsx";
import { collectChars } from "../lib/export/template-pack/pdf.ts";

// 獨立於 pdf.ts 的 collectChars 之外，自己再抽一次每張 SVG「應該」出現的
// 非空白字元——刻意不重用 collectChars（那正是「collectChars 漏字」這種
// 回歸要抓的對象；用同一份邏輯算 expected 跟 actual，邏輯裡的 bug 會同時
// 錯在兩邊，測不出來）。跟 pdf.ts 的 extractTextBlocks 一樣要追蹤 <text>/
// </text> 巢狀深度，否則 <tspan> 混雜時會漏字。
function extractPlainChars(svgs) {
  const set = new Set();
  for (const svg of svgs) {
    const openTag = /<text\\b[^>]*>/g;
    let om;
    while ((om = openTag.exec(svg))) {
      const contentStart = om.index + om[0].length;
      const tagRe = /<\\/?text\\b[^>]*>/g;
      tagRe.lastIndex = contentStart;
      let depth = 1;
      let contentEnd = svg.length;
      let afterClose = svg.length;
      let tm;
      while ((tm = tagRe.exec(svg))) {
        if (tm[0].startsWith("</")) {
          depth--;
          if (depth === 0) {
            contentEnd = tm.index;
            afterClose = tm.index + tm[0].length;
            break;
          }
        } else {
          depth++;
        }
      }
      const raw = svg.slice(contentStart, contentEnd).replace(/<[^>]*>/g, "");
      const decoded = raw
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, "&");
      for (const ch of decoded) {
        if (!/\\s/.test(ch)) set.add(ch);
      }
      openTag.lastIndex = afterClose;
    }
  }
  return Array.from(set);
}

const category = process.argv[2];
const outPath = process.argv[3];

const entry = FURNITURE_CATALOG.find((e) => e.category === category);
if (!entry || !entry.template) {
  console.error(\`找不到分類 "\${category}" 的 template，可用分類：\${FURNITURE_CATALOG.filter((e) => e.template).map((e) => e.category).join(", ")}\`);
  process.exit(1);
}

const opts = (entry.optionSchema ?? []).reduce((acc, spec) => {
  acc[spec.key] = spec.defaultValue;
  return acc;
}, {});
const design = entry.template({
  length: entry.defaults.length,
  width: entry.defaults.width,
  height: entry.defaults.height,
  material: "maple",
  options: opts,
});

const plan = buildPackPlan(design);
if (plan.rows.length === 0) {
  console.error("buildPackPlan 沒有任何零件，測試資料有問題");
  process.exit(1);
}

// A4 拼接模式（家用列印那條路）。2026-08-21 補上——在此之前這支腳本只驗
// printshop 模式，A4 拼接的樣板與印表機測試頁「從來沒有被端對端驗過」，
// 使用者回報印出來的 250mm 校正線只有 239mm 時，沒有任何自動驗證能立刻排除
// 程式端的嫌疑（那次結論是列印設定，但這個缺口本身是真的）。
const a4Plan = buildPackPlan(design, "a4");
if (a4Plan.rows.length === 0) {
  console.error("buildPackPlan(a4) 沒有任何零件，測試資料有問題");
  process.exit(1);
}

/** 樣板 SVG 自報的證明尺保留框 —— 尺不再固定在左下角（會自動避開內容、必要時轉直式），
 *  光柵化端要照這個框去量，不能再假設位置。 */
function parseRulerBox(svg) {
  const m = svg.match(/data-ruler-box="([-\\d.]+) ([-\\d.]+) ([-\\d.]+) ([-\\d.]+)"/);
  return m ? { x0: +m[1], y0: +m[2], x1: +m[3], y1: +m[4] } : null;
}

const stem = design.nameZh.replace(/[\\\\/:*?"<>|]/g, "_");
const sheets = [];

/** 把一個 PackPlan 的索引頁＋各紙張樣板加進 sheets。prefix 用來區分兩種模式。 */
function pushPlanSheets(p, prefix) {
  const indexSvgs = indexSheetSvg(stem, p.rows);
  sheets.push({
    name: \`\${prefix}00_索引\`,
    pw: 210,
    ph: 297,
    svgs: indexSvgs,
    hasRuler: false,
    isIndex: true,
    expectedChars: extractPlainChars(indexSvgs),
  });

  let n = 1;
  for (const [key, list] of p.byPaper) {
    const { paper, swapped } = list[0].placement;
    const pw = swapped ? paper.h : paper.w;
    const ph = swapped ? paper.w : paper.h;
    const svgs = list.map((x) => x.svg);
    sheets.push({
      name: \`\${prefix}\${String(n).padStart(2, "0")}_樣板_\${key}\`,
      pw,
      ph,
      svgs,
      hasRuler: true,
      // 樣板上的是 100mm 證明尺；印表機測試頁另有一條 250mm 校正線（見下面）。
      rulerNominalMm: 100,
      rulerBox: parseRulerBox(svgs[0]),
      partNames: list.map((x) => x.row.nameZh),
      expectedChars: extractPlainChars(svgs),
    });
    n++;
  }
}

pushPlanSheets(plan, "");
pushPlanSheets(a4Plan, "a4_");

// 印表機測試頁：整包 zip 的第一張，使用者拿它量校正線決定要不要填校正。
// 這條線量錯 = 後面每一張樣板都跟著錯，所以它比任何一張樣板都更該被驗。
// 張數參數只影響文案，這裡帶 A4 模式真正的張數。
const a4SheetCount = Array.from(a4Plan.byPaper.values()).reduce((sum, a) => sum + a.length, 0);
const testPageSvg = printerTestPageSvg(a4SheetCount, 1);
sheets.push({
  name: "a4_00_印表機測試頁",
  pw: 297,
  ph: 210,
  svgs: [testPageSvg],
  hasRuler: true,
  rulerNominalMm: CALIBRATION_TEST_LINE_MM,
  rulerBox: parseRulerBox(testPageSvg),
  expectedChars: extractPlainChars([testPageSvg]),
});

// 零件圖:React 元件渲成 SVG 字串再進 PDF。這條路獨有的雷是字型——零件圖原本
// 寫 sans-serif / monospace,PDF 只嵌 PackCJK,svg2pdf 找不到字型會靜默掉回
// Helvetica,中文全變亂碼而且不報錯。逐字元比對就是在擋這件事。
const drawingSvgs = await partDrawingSvgs(design);
if (drawingSvgs.length) {
  sheets.push({
    name: "04_零件圖",
    pw: 297,
    ph: 210,
    svgs: drawingSvgs,
    hasRuler: false,
    partNames: Array.from(new Set(plan.rows.map((r) => r.nameZh))),
    expectedChars: extractPlainChars(drawingSvgs),
  });
}

const allSvgs = sheets.flatMap((s) => s.svgs);
const chars = collectChars(allSvgs);

const expectedNames = Array.from(new Set(plan.rows.map((r) => r.nameZh)));

fs.writeFileSync(
  outPath,
  JSON.stringify({ nameZh: design.nameZh, expectedNames, chars, sheets }, null, 0),
  "utf8",
);
`.replace("import { FURNITURE_CATALOG }", "import fs from \"node:fs\";\nimport { FURNITURE_CATALOG }");

function buildPlan(category) {
  fs.writeFileSync(HELPER_PATH, HELPER_SRC, "utf8");
  try {
    // Windows 上 npx 是 .cmd，execFileSync 沒有 shell:true 會直接 EINVAL；
    // 這裡的參數都是腳本自己組的（固定路徑 + CLI category 字串），不是外部
    // 不受信任輸入，shell:true 的轉義警告可以接受。
    execFileSync("npx", ["tsx", HELPER_PATH, category, PLAN_PATH], {
      cwd: ROOT,
      stdio: "inherit",
      shell: true,
    });
    const json = JSON.parse(fs.readFileSync(PLAN_PATH, "utf8"));
    return json;
  } finally {
    for (const p of [HELPER_PATH, PLAN_PATH]) {
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
  }
}

async function fetchFontSubsetB64(origin, chars) {
  const res = await fetch(`${origin}/api/pdf-font`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chars }),
  });
  if (!res.ok) {
    throw new Error(`/api/pdf-font 回應 ${res.status}——請確認 dev server 有在跑（npm run dev），且此路由沒有壞掉。`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  return buf.toString("base64");
}

// 不打包 zip——直接驗證每份 PDF，比對照 UI 下載再解壓更直接，省一層
// zip round-trip 的變數；zipStore 本身是純函式，跟這裡要驗證的三件事無關。

/** 用 esbuild 把 pdf.ts（連同它動態 import 的 jspdf / svg2pdf.js）打包成
 *  瀏覽器可用的 IIFE，globalName 是 TemplatePackPdf，export 出
 *  svgsToPdf / collectChars / fetchFontSubset / FontSubsetError。
 *  write:false 直接拿記憶體內容，不落地成檔案。 */
async function bundlePdfTs() {
  const result = await esbuild.build({
    entryPoints: [PDF_TS_ENTRY],
    bundle: true,
    format: "iife",
    globalName: "TemplatePackPdf",
    platform: "browser",
    write: false,
    absWorkingDir: ROOT,
  });
  return result.outputFiles[0].text;
}

/** 呼叫真正的 window.TemplatePackPdf.svgsToPdf(...)（不是手刻等效邏輯），
 *  回傳 base64。這是這支腳本對「SVG → PDF」這一步唯一的迴歸保護：任何
 *  動過 pdf.ts 本體（DOM 隱藏方式、字型註冊順序……）的問題都會在這裡冒出來。 */
async function buildPdfB64(page, sheet, fontB64) {
  return page.evaluate(
    async ([svgs, pw, ph, fontB64, title]) => {
      const bytes = await window.TemplatePackPdf.svgsToPdf(svgs, pw, ph, fontB64, { title });
      let s = "";
      for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
      return btoa(s);
    },
    [sheet.svgs, sheet.pw, sheet.ph, fontB64, `驗證 — ${sheet.name}`],
  );
}

/** 起本地 http server 供 pdf.js ESM 模組載入（file:// 會被 CORS 擋，pdf.js 內部
 *  worker 的 import 也需要真實 URL）。回傳 { srv, port }。 */
function startPdfjsServer() {
  const srv = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split("?")[0]).replace(/^\/+/, "");
    if (rel === "blank.html") {
      res.writeHead(200, { "Content-Type": "text/html" });
      return res.end("<canvas id=c></canvas>");
    }
    const fp = path.join(PDFJS_DIR, path.basename(rel));
    fs.readFile(fp, (e, d) => {
      if (e) {
        res.writeHead(404);
        return res.end();
      }
      res.writeHead(200, { "Content-Type": "text/javascript" });
      res.end(d);
    });
  });
  return new Promise((resolve) => {
    srv.listen(0, () => resolve({ srv, port: srv.address().port }));
  });
}

/** 光柵化一份 PDF：抽全部頁的文字，並在第一頁量 100mm 證明尺（若 hasRuler）。 */
async function rasterizeAndMeasure(page, port, b64, hasRuler, rulerBox) {
  return page.evaluate(
    async ([b64, port, hasRuler, rulerBox]) => {
      const pdfjs = await import(`http://localhost:${port}/pdf.mjs`);
      pdfjs.GlobalWorkerOptions.workerSrc = `http://localhost:${port}/pdf.worker.mjs`;
      const raw = atob(b64);
      const u8 = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i++) u8[i] = raw.charCodeAt(i);
      const doc = await pdfjs.getDocument({ data: u8 }).promise;

      let fullText = "";
      let rulerMm = null;

      for (let pageNo = 1; pageNo <= doc.numPages; pageNo++) {
        const pdfPage = await doc.getPage(pageNo);
        const SCALE = 4;
        const vp = pdfPage.getViewport({ scale: SCALE });
        const c = document.getElementById("c");
        c.width = vp.width;
        c.height = vp.height;
        const ctx = c.getContext("2d");
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, c.width, c.height);
        await pdfPage.render({ canvasContext: ctx, viewport: vp }).promise;

        const text = (await pdfPage.getTextContent()).items.map((i) => i.str).join("|");
        fullText += text + "|";

        if (hasRuler && pageNo === 1 && rulerBox) {
          // 尺不再固定在左下角、也可能是直式，位置由 SVG 的 data-ruler-box 告訴我們。
          // 主線是虛線（灰色，跟要描的黑色輪廓區隔），所以不能量「最長連續深色段」
          // ——那只會量到一小節虛線。改量兩端實線刻度之間的「涵蓋範圍」：
          // 沿尺的軸向掃 ±2.5mm 的窄帶（正好含主線與端點刻度，排除上方那行說明字），
          // 取最外側兩個深色像素的距離。
          const pxPerMm = (SCALE * 72) / 25.4;
          const vertical = rulerBox.y1 - rulerBox.y0 > rulerBox.x1 - rulerBox.x0;
          // 主線軸：橫式在框底往上 2.5mm，直式在框右往左 2.5mm
          const axis = vertical ? rulerBox.x1 - 2.5 : rulerBox.y1 - 2.5;
          const band = Math.round(2.5 * pxPerMm);
          const axisPx = Math.round(axis * pxPerMm);
          // 沿軸向只掃「尺自己那一段 ± 6mm」。掃整條線會撈到別處的內容（斜擺的腳
          // 下端剛好落在同一個 y，量出來變成腳到尺的距離 244mm）；留 6mm 餘裕是
          // 為了讓「線畫得比宣告的框還長」這種錯誤仍然量得出來。
          const spanLo = Math.max(0, Math.floor(((vertical ? rulerBox.y0 : rulerBox.x0) - 6) * pxPerMm));
          const spanHi = Math.ceil(((vertical ? rulerBox.y1 : rulerBox.x1) + 6) * pxPerMm);
          let lo = Infinity;
          let hi = -Infinity;
          for (let k = axisPx - band; k <= axisPx + band; k++) {
            if (k < 0) continue;
            const line = vertical
              ? (k < c.width ? ctx.getImageData(k, 0, 1, c.height).data : null)
              : (k < c.height ? ctx.getImageData(0, k, c.width, 1).data : null);
            if (!line) continue;
            const n = Math.min(vertical ? c.height : c.width, spanHi + 1);
            for (let i = spanLo; i < n; i++) {
              const dark = line[i * 4] < 160 && line[i * 4 + 1] < 160 && line[i * 4 + 2] < 160;
              if (!dark) continue;
              if (i < lo) lo = i;
              if (i > hi) hi = i;
            }
          }
          rulerMm = hi >= lo ? (hi - lo) / pxPerMm : null;
        }
      }
      return { text: fullText, rulerMm, numPages: doc.numPages };
    },
    [b64, port, hasRuler, rulerBox || null],
  );
}

/** 跑完整驗證，回傳 { failures, results }；不在這裡 process.exit，讓呼叫端統一
 *  處理，確保 browser / http server 一定會在 finally 收尾。 */
async function runVerification(browser, plan, fontB64) {
  const buildErrors = [];
  const buildPage = await browser.newPage();
  buildPage.on("pageerror", (e) => buildErrors.push(String(e)));
  buildPage.on("console", (msg) => {
    if (msg.type() === "error") buildErrors.push(msg.text());
  });
  await buildPage.setContent("<!doctype html><html><body></body></html>");
  const pdfTsBundle = await bundlePdfTs();
  await buildPage.addScriptTag({ content: pdfTsBundle });

  const pdfB64ByName = {};
  for (const sheet of plan.sheets) {
    pdfB64ByName[sheet.name] = await buildPdfB64(buildPage, sheet, fontB64);
    console.log(`  ✓ ${sheet.name}.pdf（${sheet.svgs.length} 頁）`);
  }
  await buildPage.close();

  if (buildErrors.length) {
    return { failures: buildErrors.map((e) => `✕ 產生 PDF 過程中瀏覽器回報錯誤：${e}`), results: [] };
  }

  console.log("[4/4] 用 pdf.js 光柵化每份 PDF，驗證中文文字與 100mm 證明尺 …");
  const { srv, port } = await startPdfjsServer();
  try {
    const checkPage = await browser.newPage();
    const pageErrors = [];
    checkPage.on("pageerror", (e) => pageErrors.push(String(e)));
    await checkPage.goto(`http://localhost:${port}/blank.html`);

    const failures = [];
    const results = [];

    for (const sheet of plan.sheets) {
      const result = await rasterizeAndMeasure(checkPage, port, pdfB64ByName[sheet.name], sheet.hasRuler, sheet.rulerBox);
      results.push({ name: sheet.name, ...result });

      // 文件屬性不可以是空的:空白 metadata + 程式產生器是防毒啟發式的加分項,
      // 使用者的 Avast 就因此把樣板 PDF 誤判成 PDF:MalwareX-gen 丟進隔離區
      // (拆檔掃過,無任何可執行構件)。同時順手確認沒有混進可執行構件。
      const rawPdf = Buffer.from(pdfB64ByName[sheet.name], "base64").toString("latin1");
      for (const key of ["/Title", "/Author", "/Creator"]) {
        if (!rawPdf.includes(key)) {
          failures.push(`✕ ${sheet.name}.pdf 缺少文件屬性 ${key} —— 空白 metadata 容易被防毒誤判`);
        }
      }
      for (const bad of ["/JavaScript", "/JS", "/Launch", "/EmbeddedFile", "/XFA",
        "/SubmitForm", "/RichMedia", "/GoToR", "/ImportData", "/AA", "/URI"]) {
        if (rawPdf.includes(bad)) {
          failures.push(`✕ ${sheet.name}.pdf 出現可執行構件 ${bad} —— 樣板 PDF 不該有這種東西`);
        }
      }
      // /OpenAction:這裡的它只是「開檔顯示第一頁」的目的地陣列、不是動作字典,但只做
      // 字串比對的啟發式引擎分不出來,所以 stripOpenAction 會把它用等長空白蓋掉
      // (2026-08-21:補完 metadata 之後 Avast 仍然誤判,這是最後一個可疑 token)。
      // 這條同時是 stripOpenAction 的端到端保險:哪天它失效了,這裡會先紅。
      if (rawPdf.includes("/OpenAction")) {
        failures.push(`✕ ${sheet.name}.pdf 仍含 /OpenAction —— stripOpenAction 沒生效(見 lib/export/template-pack/pdf.ts)`);
      }

      const cjkOk = /[一-鿿]/.test(result.text);
      if (!cjkOk) {
        failures.push(`✕ ${sheet.name}.pdf 抽不到任何中文字 —— 字型嵌入可能整個失敗`);
        continue;
      }

      // 逐一比對這份 PDF「應該」出現的中文字串，缺字是靜默的，只查「有中文」查不出來。
      const expectedForThisSheet = sheet.isIndex
        ? plan.expectedNames.concat(plan.nameZh)
        : sheet.partNames || [];
      for (const name of expectedForThisSheet) {
        if (!result.text.includes(name)) {
          failures.push(
            `✕ ${sheet.name}.pdf 抽出的文字裡找不到預期字串「${name}」—— 可能缺字或字重亂碼\n` +
              `     實際抽出：${result.text.slice(0, 300)}`,
          );
        }
      }

      // 逐字元比對，不只查具名字串——字重/字型子集漏字時，掉的字未必落在上面
      // 挑的那幾個名稱裡（例如標題「索引」的「引」、表頭「件號」的「號」），
      // 只查具名字串會漏抓。expectedChars 是在 Node 端獨立重新抽取的（不共用
      // pdf.ts 的 collectChars），才不會「算 expected 跟算 actual 用同一份
      // 有 bug 的邏輯」而互相遮掩。
      const missingChars = (sheet.expectedChars || []).filter((ch) => !result.text.includes(ch));
      if (missingChars.length) {
        failures.push(
          `✕ ${sheet.name}.pdf 抽出的文字裡完全找不到這些字元：「${missingChars.join("")}」—— 可能被字型子集或 svg2pdf 靜默吞掉\n` +
            `     實際抽出：${result.text.slice(0, 300)}`,
        );
      }

      // 樣板是 100mm 證明尺、印表機測試頁是 250mm 校正線，容差都是 ±0.5mm。
      // 測試頁那條線量錯的後果比樣板還嚴重（使用者會把錯的數字填回校正欄位，
      // 讓後面每一張都跟著歪），所以它一樣不能放行。
      const nominal = sheet.rulerNominalMm || 100;
      if (sheet.hasRuler && (result.rulerMm == null || Math.abs(result.rulerMm - nominal) >= 0.5)) {
        failures.push(
          `✕ ${sheet.name}.pdf 證明尺量到 ${result.rulerMm?.toFixed(2)}mm，超出 ${nominal}±0.5mm`,
        );
      }
    }

    await checkPage.close();
    if (pageErrors.length) {
      failures.push(...pageErrors.map((e) => `✕ 光柵化過程中瀏覽器回報錯誤：${e}`));
    }
    return { failures, results };
  } finally {
    srv.close();
  }
}

async function main() {
  const { origin, category } = parseArgs();
  console.log(`目標：${origin}（分類：${category}）`);

  // 健康檢查：dev server 沒開就給清楚訊息，不要讓 playwright 卡在 timeout。
  try {
    const ping = await fetch(origin, { method: "GET" });
    if (!ping.ok && ping.status >= 500) {
      throw new Error(`origin 回應 ${ping.status}`);
    }
  } catch (e) {
    console.error(`✕ 連不到 ${origin} —— 請先在另一個終端跑 npm run dev。(${e.message || e})`);
    process.exit(1);
  }

  console.log("[1/4] 用 tsx 在 Node 端執行真正的 buildPackPlan / templateSheetSvg / indexSheetSvg …");
  const plan = buildPlan(category);
  const totalSvgs = plan.sheets.reduce((s, sh) => s + sh.svgs.length, 0);
  console.log(`  設計：${plan.nameZh}，${plan.sheets.length} 份 PDF（含索引），共 ${totalSvgs} 頁 SVG`);

  console.log("[2/4] 打真正的 /api/pdf-font 要字型子集 …");
  const fontB64 = await fetchFontSubsetB64(origin, plan.chars);
  console.log(`  字型子集：${Buffer.from(fontB64, "base64").length} bytes（原始請求 ${plan.chars.length} 個字元）`);

  console.log("[3/4] 用 esbuild 打包真正的 pdf.ts、開真瀏覽器呼叫真正的 svgsToPdf() 產生每份 PDF …");
  const browser = await chromium.launch();
  let failures, results;
  try {
    ({ failures, results } = await runVerification(browser, plan, fontB64));
  } finally {
    // 不管成功或中途丟例外都要收尾——留下孤兒 chromium 進程比腳本本身失敗還糟。
    await browser.close();
  }

  console.log("");
  for (const r of results) {
    if (r.rulerMm != null) {
      const sheet = plan.sheets.find((s) => s.name === r.name);
      console.log(`  ${r.name}.pdf：尺量到 ${r.rulerMm.toFixed(3)}mm（標稱 ${sheet?.rulerNominalMm || 100}mm）`);
    }
  }
  const indexResult = results.find((r) => r.name === "00_索引");
  console.log(`  抽出的中文字串樣本（索引頁）：${indexResult ? indexResult.text.slice(0, 200) : ""}`);

  if (failures.length) {
    console.error("");
    console.error(`✕ ${failures.length} 項驗證失敗：`);
    for (const f of failures) console.error("  " + f);
    process.exit(1);
  }

  console.log("");
  console.log(
    `✓ 全部 ${plan.sheets.length} 份 PDF（printshop ＋ A4 拼接 ＋ 印表機測試頁）：` +
      `無錯誤、中文完整、證明尺／校正線誤差 < 0.5mm`,
  );
}

main().catch((e) => {
  console.error("ERR", e.stack || e.message || e);
  process.exit(1);
});
