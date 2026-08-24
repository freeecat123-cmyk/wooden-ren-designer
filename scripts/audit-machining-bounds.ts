/**
 * 「榫孔加工面」SVG 的每一條線都必須落在料件輪廓內。
 *
 * 為什麼要有這支:這些 SVG 是客人拿去 CNC 或照著手工鑿的加工圖。線畫到料件外面 =
 * 刀路從料外下刀打到夾具 / 犧牲板,手工則是把零件鑿穿。而且它**不會報錯**,
 * 圖照樣產得出來、ZIP 照樣下載得到,客人是在機台上才發現。
 *
 * 2026-08-24 大軍稽核抓到兩條:
 *   - 床:側板高 300 + 床板離地 250(兩個都在滑桿範圍內)→ 榫眼超出腳頂 40mm
 *   - 抽屜前板:底板入溝的溝槽比前板長 12mm(榫接版的預設路徑,5 款櫃體中招)
 *
 * 基線是硬 0。跑:npx tsx scripts/audit-machining-bounds.ts
 */
import { FURNITURE_CATALOG } from "../lib/templates";
import { joineryFacesSvgFiles } from "../lib/export/parts-svg";
import { applyEdgeProtection } from "../lib/joinery/edge-protection";

const TOL_MM = 0.5;
const hits: string[] = [];
let scanned = 0;

for (const e of FURNITURE_CATALOG as any[]) {
  if (!e.template) continue;
  const specs = (e.optionSchema ?? []) as any[];
  const base: any = specs.reduce((a: any, s: any) => ((a[s.key] = s.defaultValue), a), {});
  // 榫接版會把「釘底 / 釘背」自動升級成「入溝」(見 parse-search-params.ts),要一起掃
  const variants: [string, any][] = [
    ["預設", base],
    ["入溝", { ...base, drawerBottomMode: "rebated", backMode: "rebated" }],
  ];
  /**
   * ⚠️ 勾選框（boolean）也要掃。
   *
   * 原本只掃數字選項的極值 → **「兩向弧肩」這種 checkbox 完全沒被驗過**。
   * 2026-08-24 查新腳型的輸出時才發現這個漏洞。
   * 腳型是 select，也一併把弧肩斜腳掃進來（它是唯一會挖曲面的腳型）。
   */
  for (const s of specs) {
    if (s.type === "checkbox" || s.type === "boolean") {
      variants.push([`${s.key}=${!s.defaultValue}`, { ...base, [s.key]: !s.defaultValue }]);
    }
  }
  if (specs.some((s) => s.key === "legShape" && s.choices?.some((c: any) => c.value === "curved-taper"))) {
    for (const tw of [false, true]) {
      variants.push([`弧肩腳/兩向=${tw}`, { ...base, legShape: "curved-taper", ctTwoWay: tw }]);
    }
  }
  for (const s of specs) {
    if (s.type === "number" && s.min != null && s.max != null) {
      for (const v of [s.min, s.max]) variants.push([`${s.key}=${v}`, { ...base, [s.key]: v }]);
    }
  }
  for (const [tag, o] of variants) {
    let d: any;
    try {
      d = applyEdgeProtection(e.template({
        length: e.defaults.length, width: e.defaults.width, height: e.defaults.height,
        material: "maple", options: o,
      }));
    } catch { continue; }
    let files: Record<string, string>;
    try { files = joineryFacesSvgFiles(d); } catch { continue; }
    for (const [name, svg] of Object.entries(files)) {
      scanned++;
      const vb = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(svg);
      if (!vb) continue;
      const W = +vb[1], H = +vb[2];
      let worst = 0;
      for (const m of svg.matchAll(/(-?[\d.]+)[ ,](-?[\d.]+)/g)) {
        const x = +m[1], y = +m[2];
        if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
        worst = Math.max(worst, -x, -y, x - W, y - H);
      }
      if (worst > TOL_MM) hits.push(`${e.category} [${tag}] ${name} — 最遠跑出 ${worst.toFixed(1)}mm`);
    }
  }
}

console.log(`掃了 ${scanned} 張加工圖`);
if (hits.length) {
  console.log(`\n⛔ ${hits.length} 張把線畫到料件外面:`);
  for (const h of [...new Set(hits)].slice(0, 20)) console.log(`   ${h}`);
  console.log("\n   這些圖會被客人拿去 CNC。修在產生榫眼幾何的地方,不要在 SVG 那層裁掉。");
  process.exit(1);
}
console.log("✅ 每一條加工線都在料件輪廓內。");
