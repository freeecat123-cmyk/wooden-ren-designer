#!/usr/bin/env node
/**
 * 驗證 stripOpenAction:用 jsPDF 在 node 產一份真的 PDF,證明覆蓋之後
 *   ① /OpenAction 真的不見了
 *   ② 檔案長度一個位元組都沒變
 *   ③ xref 表裡每一個偏移仍然精準落在對應的 "N 0 obj" 上(沒把結構寫壞)
 *   ④ 其他該有的東西都還在(/Type /Catalog、/PageLayout、trailer、%%EOF)
 *
 * 跑法:node scripts/verify-pdf-openaction.cjs
 *
 * ⚠️ 這支刻意**不從 lib/ 匯入**(那是 .ts + 瀏覽器環境),而是把 stripOpenAction
 *    的實作原封不動抄一份在下面。兩邊若不同步,第 ⑤ 項會抓出來。
 */
const { readFileSync } = require("node:fs");
const { join } = require("node:path");

// ── 與 lib/export/template-pack/pdf.ts 的 stripOpenAction 必須逐字相同 ──
function stripOpenAction(bytes) {
  const text = new TextDecoder("latin1").decode(bytes);
  const cat = text.lastIndexOf("/Type /Catalog");
  if (cat < 0) return bytes;
  const endObj = text.indexOf("endobj", cat);
  const seg = text.slice(cat, endObj < 0 ? Math.min(text.length, cat + 2000) : endObj);
  const m = /\/OpenAction\s*\[[^\]]*\]/.exec(seg);
  if (!m) return bytes;
  const out = new Uint8Array(bytes);
  const start = cat + m.index;
  for (let i = 0; i < m[0].length; i++) out[start + i] = 0x20;
  return out;
}

let failed = 0;
const ok = (cond, msg, detail) => {
  if (cond) { console.log("  PASS  " + msg); }
  else { failed++; console.log("  FAIL  " + msg + (detail ? "\n        " + detail : "")); }
};

async function main() {
  const { jsPDF } = require("jspdf");

  // 多頁 + 有內容,盡量貼近實際樣板檔的結構
  const doc = new jsPDF({ unit: "mm", format: [297, 210], orientation: "landscape" });
  doc.setProperties({
    title: "驗證用 — 1:1 實尺樣板",
    subject: "verify-pdf-openaction",
    author: "木頭仁 木作藍圖",
    creator: "木作藍圖 designer.woodenren.com",
    keywords: "木工,家具,1:1 實尺樣板",
  });
  doc.setLineWidth(0.5);
  doc.rect(15, 15, 267, 180);
  doc.line(15, 15, 282, 195);
  doc.addPage([297, 210], "landscape");
  doc.rect(20, 20, 100, 100);
  doc.addPage([297, 210], "landscape");
  doc.circle(100, 100, 40);

  const before = new Uint8Array(doc.output("arraybuffer"));
  const after = stripOpenAction(before);

  const sBefore = new TextDecoder("latin1").decode(before);
  const sAfter = new TextDecoder("latin1").decode(after);

  console.log("原始 " + before.length + " bytes / 處理後 " + after.length + " bytes\n");

  console.log("① /OpenAction 移除");
  ok(/\/OpenAction/.test(sBefore), "處理前確實有 /OpenAction(否則這支測試沒在測東西)",
    "jsPDF 版本可能變了,或預設行為改了 —— 要重看 putCatalog");
  ok(!/\/OpenAction/.test(sAfter), "處理後全檔不再出現 /OpenAction");

  console.log("\n② 位元組數不變(xref 偏移的命脈)");
  ok(before.length === after.length,
    "長度一致 " + before.length + " = " + after.length,
    "長度變了就代表 xref 全部失準");

  console.log("\n③ xref 偏移仍然精準");
  // startxref -> xref 表 -> 逐筆偏移必須落在 "<n> 0 obj"
  const mStart = /startxref\s+(\d+)/.exec(sAfter);
  ok(!!mStart, "找得到 startxref");
  if (mStart) {
    const xrefPos = Number(mStart[1]);
    ok(sAfter.startsWith("xref", xrefPos), "startxref 指到的位置真的是 xref 表",
      "指到:" + JSON.stringify(sAfter.slice(xrefPos, xrefPos + 20)));
    const head = /^xref\s+(\d+)\s+(\d+)\s/.exec(sAfter.slice(xrefPos, xrefPos + 64));
    ok(!!head, "xref 表頭格式正確");
    if (head) {
      const first = Number(head[1]);
      const count = Number(head[2]);
      const tableStart = xrefPos + head[0].length;
      let bad = 0, checked = 0;
      for (let i = 0; i < count; i++) {
        const entry = sAfter.slice(tableStart + i * 20, tableStart + i * 20 + 20);
        const em = /^(\d{10}) (\d{5}) ([nf])/.exec(entry);
        if (!em || em[3] === "f") continue; // f = 空閒物件,沒有偏移可查
        const off = Number(em[1]);
        const objNo = first + i;
        checked++;
        const re = new RegExp("^" + objNo + "\\s+0\\s+obj");
        if (!re.test(sAfter.slice(off, off + 24))) {
          bad++;
          if (bad <= 3) {
            console.log("        物件 " + objNo + " 偏移 " + off + " 指到:"
              + JSON.stringify(sAfter.slice(off, off + 24)));
          }
        }
      }
      ok(checked > 0, "有實際檢查到物件(" + checked + " 個)");
      ok(bad === 0, "全部 " + checked + " 個物件偏移都精準落在 'N 0 obj'",
        bad + " 個對不上 —— 結構被寫壞了,絕對不能出貨");
    }
  }

  console.log("\n④ 該留的都還在");
  ok(/\/Type \/Catalog/.test(sAfter), "/Type /Catalog 還在");
  ok(/\/PageLayout/.test(sAfter), "/PageLayout 還在(證明只蓋掉 OpenAction,沒有多吃鄰居)");
  ok(/\/Title/.test(sAfter) && /\/Author/.test(sAfter) && /\/Creator/.test(sAfter),
    "文件屬性 /Title /Author /Creator 還在");
  ok(/trailer/.test(sAfter) && /%%EOF/.test(sAfter), "trailer 與 %%EOF 還在");

  console.log("\n⑤ 沒有任何可執行構件(這才是防毒真正該看的)");
  for (const bad of ["/JavaScript", "/JS", "/Launch", "/EmbeddedFile", "/XFA",
    "/SubmitForm", "/RichMedia", "/GoToR", "/ImportData", "/AA", "/URI"]) {
    ok(!sAfter.includes(bad), bad + " 不存在");
  }

  console.log("\n⑥ 與 lib 的實作沒有走鐘");
  const libSrc = readFileSync(join(__dirname, "..", "lib", "export", "template-pack", "pdf.ts"), "utf8");
  // 比的是「程式碼」不是註解:兩邊的行內註解本來就不必一樣(lib 那份寫得詳細)。
  const norm = (s) => s.replace(/\/\/[^\n]*/g, " ").replace(/\s+/g, " ").trim();
  const libBody = /export function stripOpenAction\(bytes: Uint8Array\): Uint8Array \{([\s\S]*?)\n\}/.exec(libSrc);
  ok(!!libBody, "在 pdf.ts 找得到 stripOpenAction");
  if (libBody) {
    const mine = /function stripOpenAction\(bytes\) \{([\s\S]*?)\n\}/.exec(
      readFileSync(__filename, "utf8"));
    ok(norm(libBody[1]) === norm(mine[1]),
      "本檔抄的那份與 pdf.ts 的實作逐字相同",
      "兩邊不同步了 —— 這支測的就不是正式碼在做的事");
  }

  console.log("\n" + (failed ? "❌ " + failed + " 項未通過" : "✅ 全部通過"));
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
