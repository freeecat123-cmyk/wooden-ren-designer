/**
 * 稽核：家具文案不可以把「報價」講成人人都有。
 *
 * 2026-10-07 建立。連兩天修同一類文案卻沒有常駐防護，所以焊成稽核。
 *
 * 事實依據（2026-10-07 實查）：
 *   app/[locale]/design/[type]/quote/page.tsx:140 吃 canUseQuoteSystem，
 *   lib/permissions.ts:PLAN_FEATURES free/personal 皆 false → 只有 pro/student/lifetime 有。
 *   ⇒ 任何家具（含免費的 workbench）的「你會拿到什麼」清單都不能列報價，
 *     除非同句標明專業版 / Pro。
 *
 * 判準：一段文字裡，報價/quote 與「交付物清單」詞（三視圖/材料單/工程圖/零件圖/
 * 榫卯圖 或 en 的 drawings/cut list）同時出現，且**沒有**專業版/Pro 限定詞 → 判紅。
 */
import fs from "node:fs";

const DELIVERABLE_ZH = /三視圖|材料單|工程圖|零件圖|榫卯圖|切料圖/;
const DELIVERABLE_EN = /\bdrawings?\b|\bcut list\b|\b3-views?\b/i;
const QUOTE_ZH = /報價/;
const QUOTE_EN = /\bquote[sd]?\b|\bquotation\b/i;
const QUALIFIER = /專業版|Pro 版|\bPro plan\b|\bPro\b|僅專業版/;
/** 「拿去給玻璃行報價」這種不是在講我們的功能 */
const EXTERNAL = /玻璃行|木材行|廠商|拿去報價|拿給.{0,6}報價|glass shop|lumber ?yard/i;

const FILES = [
  "lib/templates/marketing.ts",
  "lib/templates/marketing-en.ts",
  "app/api/og/route.tsx", // 家具分享卡頁尾

];

let bad = 0;
for (const f of FILES) {
  if (!fs.existsSync(f)) { console.log(`⚠️ 找不到 ${f}`); continue; }
  const lines = fs.readFileSync(f, "utf8").split("\n");
  lines.forEach((line, i) => {
    const hasQuote = QUOTE_ZH.test(line) || QUOTE_EN.test(line);
    if (!hasQuote) return;
    const hasDeliv = DELIVERABLE_ZH.test(line) || DELIVERABLE_EN.test(line);
    if (!hasDeliv) return;
    if (QUALIFIER.test(line)) return;
    if (EXTERNAL.test(line)) return;
    bad++;
    console.log(`❌ ${f}:${i + 1}`);
    console.log(`   ${line.trim().slice(0, 200)}`);
  });
}
console.log(bad === 0 ? "✅ 沒有把報價講成人人都有的文案" : `\n非綠：${bad} 處`);
process.exit(bad === 0 ? 0 : 1);
