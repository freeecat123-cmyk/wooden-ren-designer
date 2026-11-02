/**
 * audit-seo-meta.ts — 介紹頁的 SERP 標題／描述有沒有被 Google 截掉
 *
 * 2026-11-02 起：GSC 量到 /templates/workbench（28 曝光 0 點擊）跟「木工桌」
 * （42 曝光排名 16.7）表現不如預期，回頭量 seoTitle 才發現中文站 30 支裡有 8 支
 * 標題寬度 66~98、6 支描述 168~236 —— 全部超過 Google 的 SERP 預算，
 * 等於品牌名跟後半段賣點在搜尋結果裡根本印不出來。中文站當天已修到全部合規。
 *
 * 量尺：全形字算 2 單位、半形算 1（SERP 像素預算的粗略代理）。
 *   標題 60 單位 ≈ 600px 桌機截斷點（約 30 個中文字 / 60 個英文字母）
 *   描述 160 單位 ≈ 約 80 個中文字
 * 這是**上限**，不是指紋基線 —— 寫短一點不會紅，只有超過才紅。
 *
 * ⚠️ 英文站（marketing-en.ts）2026-11-02 量到 25 支全部超標（標題 68~131、
 * 描述 162~287），一天內改不完也不該機翻帶過。所以英文站走 EN_KNOWN 名單：
 * **用當天實測值當上限**，只要不變更長就不判紅，但會印出來提醒還沒修。
 * 修好一支就把它從 EN_KNOWN 刪掉（刪掉之後就吃 60/160 的真上限）。
 */
import { TEMPLATE_MARKETING } from "../lib/templates/marketing";
import { TEMPLATE_MARKETING_EN } from "../lib/templates/marketing-en";

const TITLE_MAX = 60;
const DESC_MAX = 160;
/** 太短也是問題：描述只有幾個字 Google 會自己改寫，等於文案白寫 */
const DESC_MIN = 60;

/** 英文站待修清單：值＝2026-11-02 實測寬度，當成「不准再變長」的上限 */
const EN_KNOWN: Record<string, { t: number; d: number }> = {
  "stool": { t: 85, d: 178 },
  "pencil-holder": { t: 83, d: 165 },
  "side-table": { t: 77, d: 167 },
  "bench": { t: 68, d: 165 },
  "dining-chair": { t: 80, d: 191 },
  "desk": { t: 69, d: 162 },
  "open-bookshelf": { t: 82, d: 171 },
  "dining-table": { t: 75, d: 163 },
  "tea-table": { t: 76, d: 139 },
  "nightstand": { t: 73, d: 132 },
  "chest-of-drawers": { t: 76, d: 156 },
  "media-console": { t: 83, d: 152 },
  "wardrobe": { t: 81, d: 145 },
  "shoe-cabinet": { t: 76, d: 143 },
  "bar-stool": { t: 78, d: 153 },
  "round-stool": { t: 68, d: 142 },
  "low-table": { t: 75, d: 137 },
  "round-tea-table": { t: 78, d: 138 },
  "round-table": { t: 75, d: 153 },
  "display-cabinet": { t: 95, d: 203 },
  "tray": { t: 79, d: 154 },
  "workbench": { t: 131, d: 287 },
  "photo-frame": { t: 71, d: 152 },
  "dovetail-box": { t: 76, d: 135 },
  "wine-rack": { t: 75, d: 144 },
};

const FULLWIDTH =
  /[\u1100-\u115F\u2E80-\uA4CF\uAC00-\uD7A3\uF900-\uFAFF\uFE30-\uFE4F\uFF00-\uFF60\uFFE0-\uFFE6]/;

function width(s: string): number {
  let n = 0;
  for (const ch of s) n += FULLWIDTH.test(ch) ? 2 : 1;
  return n;
}

const hard: string[] = [];
const todo: string[] = [];
const stale: string[] = [];
let checked = 0;

for (const [locale, table] of [
  ["zh", TEMPLATE_MARKETING],
  ["en", TEMPLATE_MARKETING_EN],
] as const) {
  for (const [key, m] of Object.entries(table)) {
    if (!m) continue;
    checked += 1;
    const known = locale === "en" ? EN_KNOWN[key] : undefined;
    const t = width(m.seoTitle ?? "");
    const d = width(m.seoDescription ?? "");

    const tCap = known ? Math.max(known.t, TITLE_MAX) : TITLE_MAX;
    const dCap = known ? Math.max(known.d, DESC_MAX) : DESC_MAX;

    if (t > tCap)
      hard.push(`[${locale}] ${key} seoTitle 寬度 ${t} > 上限 ${tCap}\n     ${m.seoTitle}`);
    else if (known && t > TITLE_MAX)
      todo.push(`[${locale}] ${key} seoTitle ${t}（真上限 ${TITLE_MAX}，待修）`);

    if (d > dCap)
      hard.push(`[${locale}] ${key} seoDescription 寬度 ${d} > 上限 ${dCap}\n     ${m.seoDescription}`);
    else if (known && d > DESC_MAX)
      todo.push(`[${locale}] ${key} seoDescription ${d}（真上限 ${DESC_MAX}，待修）`);
    else if (!known && d < DESC_MIN)
      hard.push(`[${locale}] ${key} seoDescription 只有 ${d} 單位 < 下限 ${DESC_MIN}，Google 會自己改寫\n     ${m.seoDescription}`);

    // 已經修到合規卻還留在名單裡 → 提醒刪掉，但不判紅
    if (known && t <= TITLE_MAX && d <= DESC_MAX)
      stale.push(`[${locale}] ${key} 已經合規了，請把它從 EN_KNOWN 刪掉`);
  }
}

console.log(`== SEO meta 寬度稽核：掃 ${checked} 支介紹頁（zh + en）==`);
for (const s of stale) console.log(`⚠️ ${s}`);
if (todo.length) {
  console.log(`\n待修（英文站 ${todo.length} 項，用現值當上限、不判紅）：`);
  for (const s of todo) console.log(`   · ${s}`);
}
if (hard.length === 0) {
  console.log(`\n✅ 沒有新的超標：中文站標題 ≤ ${TITLE_MAX}、描述 ${DESC_MIN}~${DESC_MAX}，英文站沒有比 11-02 更長`);
} else {
  console.log("");
  for (const s of hard) console.log(`❌ ${s}`);
  console.log(`\n非綠 ${hard.length} 項 —— 超上限的會在搜尋結果被截掉後半段。`);
}
process.exit(hard.length === 0 ? 0 : 1);
