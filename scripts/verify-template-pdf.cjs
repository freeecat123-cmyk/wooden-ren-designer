#!/usr/bin/env node
// 「1:1 實尺樣板」下載流程的自動回歸驗證。
//
// 這支腳本要證明的三件事（不是「跑完就好」）：
//   1) 整條產生流程（字型子集 API → SVG → PDF）沒有任何錯誤
//   2) PDF 內嵌的中文是「這批樣板真正的文字」，不是被靜默換成 Helvetica 的亂碼——
//      這條管線踩過的雷是：字重 / 缺字時 svg2pdf 會靜默 fallback 或吞字，不報錯。
//      所以這裡不只檢查「有中文」，要比對抽出的文字含有預期的中文字串。
//   3) 樣板紙面左下角那條 100mm 證明尺，用 pdf.js 光柵化後量出來的實際長度
//      誤差 < 0.5mm——這是整個功能的命脈，木工照著這條尺描，尺寸錯了就切錯料。
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
//   - SVG → PDF：pdf.ts 的 svgsToPdf() 需要 DOM（document.createElement /
//     getBBox），所以這段必須在真瀏覽器裡跑。用 Playwright 開一個空白頁，
//     把 jspdf / svg2pdf.js 的 UMD build（node_modules 內建，已裝好）用
//     addScriptTag 注入（不需要另外起 http server），依 pdf.ts 原本的呼叫順序
//     （addFileToVFS → addFont → svg2pdf）重建每一份 PDF。
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

const ROOT = process.cwd();
const PDFJS_DIR = path.join(ROOT, "node_modules/pdfjs-dist/build");
const JSPDF_UMD = require.resolve("jspdf/dist/jspdf.umd.js");
const SVG2PDF_UMD = require.resolve("svg2pdf.js/dist/svg2pdf.umd.js");

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
import { collectChars } from "../lib/export/template-pack/pdf.ts";

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

const indexSvgs = indexSheetSvg(design.nameZh.replace(/[\\\\/:*?"<>|]/g, "_"), plan.rows);

const sheets = [];
sheets.push({ name: "00_索引", pw: 210, ph: 297, svgs: indexSvgs, hasRuler: false });

let n = 1;
for (const [key, list] of plan.byPaper) {
  const { paper, swapped } = list[0].placement;
  const pw = swapped ? paper.h : paper.w;
  const ph = swapped ? paper.w : paper.h;
  sheets.push({
    name: \`\${String(n).padStart(2, "0")}_樣板_\${key}\`,
    pw,
    ph,
    svgs: list.map((x) => x.svg),
    hasRuler: true,
    partNames: list.map((x) => x.row.nameZh),
  });
  n++;
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

/** 用 jsPDF + svg2pdf.js（UMD build，跟 pdf.ts 用的是同一個 npm 套件）在真瀏覽器
 *  裡重建一份 PDF，回傳 base64。呼叫順序完全對齊 pdf.ts 的 svgsToPdf()。 */
async function buildPdfB64(page, sheet, fontB64) {
  return page.evaluate(
    async ([svgs, pw, ph, fontB64]) => {
      const { jsPDF } = window.jspdf;
      const { svg2pdf } = window.svg2pdf;

      const doc = new jsPDF({
        unit: "mm",
        format: [pw, ph],
        orientation: pw >= ph ? "landscape" : "portrait",
      });
      doc.addFileToVFS("PackCJK.ttf", fontB64);
      doc.addFont("PackCJK.ttf", "PackCJK", "normal");
      doc.addFont("PackCJK.ttf", "PackCJK", "bold");
      doc.setFont("PackCJK");

      const box = document.createElement("div");
      box.style.cssText = "position:absolute;left:-99999px;top:0";
      document.body.appendChild(box);
      try {
        for (let i = 0; i < svgs.length; i++) {
          if (i > 0) doc.addPage([pw, ph], pw >= ph ? "landscape" : "portrait");
          box.innerHTML = svgs[i];
          const el = box.querySelector("svg");
          if (!el) throw new Error("SVG 解析失敗");
          await svg2pdf(el, doc, { x: 0, y: 0, width: pw, height: ph });
          await new Promise((r) => setTimeout(r, 0));
        }
      } finally {
        box.remove();
      }
      const bytes = new Uint8Array(doc.output("arraybuffer"));
      let s = "";
      for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
      return btoa(s);
    },
    [sheet.svgs, sheet.pw, sheet.ph, fontB64],
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
async function rasterizeAndMeasure(page, port, b64, hasRuler) {
  return page.evaluate(
    async ([b64, port, hasRuler]) => {
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

        if (hasRuler && pageNo === 1) {
          // 證明尺畫在 y = pageH-10mm、x = 10..110mm。掃該處上下各 3mm 的帶狀區，
          // 找最長的水平深色連續段。
          const pxPerMm = (SCALE * 72) / 25.4;
          const pageHmm = vp.height / pxPerMm;
          const yc = Math.round((pageHmm - 10) * pxPerMm);
          const band = Math.round(3 * pxPerMm);
          let best = 0;
          for (let y = yc - band; y <= yc + band; y++) {
            if (y < 0 || y >= c.height) continue;
            const row = ctx.getImageData(0, y, c.width, 1).data;
            let run = 0;
            for (let x = 0; x < c.width; x++) {
              const dark = row[x * 4] < 128 && row[x * 4 + 1] < 128 && row[x * 4 + 2] < 128;
              run = dark ? run + 1 : 0;
              if (run > best) best = run;
            }
          }
          rulerMm = best / pxPerMm;
        }
      }
      return { text: fullText, rulerMm, numPages: doc.numPages };
    },
    [b64, port, hasRuler],
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
  await buildPage.addScriptTag({ path: JSPDF_UMD });
  await buildPage.addScriptTag({ path: SVG2PDF_UMD });

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
      const result = await rasterizeAndMeasure(checkPage, port, pdfB64ByName[sheet.name], sheet.hasRuler);
      results.push({ name: sheet.name, ...result });

      const cjkOk = /[一-鿿]/.test(result.text);
      if (!cjkOk) {
        failures.push(`✕ ${sheet.name}.pdf 抽不到任何中文字 —— 字型嵌入可能整個失敗`);
        continue;
      }

      // 逐一比對這份 PDF「應該」出現的中文字串，缺字是靜默的，只查「有中文」查不出來。
      const expectedForThisSheet =
        sheet.name === "00_索引" ? plan.expectedNames.concat(plan.nameZh) : sheet.partNames || [];
      for (const name of expectedForThisSheet) {
        if (!result.text.includes(name)) {
          failures.push(
            `✕ ${sheet.name}.pdf 抽出的文字裡找不到預期字串「${name}」—— 可能缺字或字重亂碼\n` +
              `     實際抽出：${result.text.slice(0, 300)}`,
          );
        }
      }

      if (sheet.hasRuler && (result.rulerMm == null || Math.abs(result.rulerMm - 100) >= 0.5)) {
        failures.push(`✕ ${sheet.name}.pdf 證明尺量到 ${result.rulerMm?.toFixed(2)}mm，超出 100±0.5mm`);
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

  console.log("[3/4] 開真瀏覽器，用專案實際用的 jsPDF + svg2pdf.js（UMD build）產生每份 PDF …");
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
      console.log(`  ${r.name}.pdf：證明尺 ${r.rulerMm.toFixed(3)}mm`);
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
  console.log(`✓ 全部 ${plan.sheets.length} 份 PDF：無錯誤、中文完整、100mm 證明尺誤差 < 0.5mm`);
}

main().catch((e) => {
  console.error("ERR", e.stack || e.message || e);
  process.exit(1);
});
