/**
 * Audit: 全螢幕浮層 (fixed inset-0) 不可以被「回報問題」浮動鈕 (.wr-fab) 蓋住。
 *
 * 2026-10-28 正式站實測過的 bug：客人在 /design/stool 把三視圖點開放大，
 * 右下角被回報鈕的白色膠囊蓋住，`document.elementFromPoint()` 最上層是浮動鈕，
 * 點下去跳出的是回報表單而不是圖面。修法是 app/globals.css 的
 * `body:has(.fixed.inset-0.z-50) .wr-fab { opacity:0; pointer-events:none }`。
 *
 * 那條 CSS 只認「class 字面上有 z-50」的浮層。這支稽核把不變條件釘住：
 * 每一個 `fixed inset-0` 浮層都必須至少滿足一項，否則報紅 ——
 *   (a) z 值 > 回報鈕的 z（50）→ 本來就贏
 *   (b) class 命中 globals.css 的隱藏規則 → 浮層打開時回報鈕會自己讓位
 *   (c) pointer-events-none → 不吃點擊，蓋不到東西
 *   (d) 原生 <dialog>（top layer，永遠在 z-index 之上）
 *   (e) 自己掛 body.wr-sheet-open（BugReportFab 另一套 variant 會收掉）
 *
 * 刻意不寫死 50 跟選字串：FAB 的 z 從 BugReportFab.tsx 讀、隱藏規則從
 * globals.css 讀。改了那兩邊，這支會跟著變，不會變成過期的註解。
 *
 * zModal 這種「z class 由 props 傳進來」的浮層，會回去掃元件預設值 + 每一個
 * 呼叫點傳的字面值，逐個檢查（昨天留的洞就是這個）。
 *
 * Run: npx tsx scripts/audit-overlay-fab.ts
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(__dirname, "..");
const FAB_FILE = join(ROOT, "components", "BugReportFab.tsx");
const CSS_FILE = join(ROOT, "app", "globals.css");
const SCAN_DIRS = ["app", "components"];

let fail = 0;
const ok: string[] = [];
function bad(msg: string) {
  console.error("❌", msg);
  fail++;
}

/** `z-50` / `z-[60]` → 50 / 60；`z-auto` 與認不出來的回 null */
function zValue(token: string): number | null {
  const m = /^z-(?:\[(\d+)\]|(\d+))$/.exec(token);
  if (!m) return null;
  return Number(m[1] ?? m[2]);
}
function zTokenOf(tokens: string[]): string | null {
  return tokens.find((t) => zValue(t) !== null) ?? null;
}

// ---- 1. 回報鈕自己的 z，從 BugReportFab.tsx 讀 ----------------------------
const fabSrc = readFileSync(FAB_FILE, "utf8");
// ⚠️ 要比對「完整的 class token」，不能用 includes("wr-fab")：
//    改名成 wr-fabx 也會 includes 成功，稽核就抓不到鉤子被拆掉（變異測試 M3 當場抓到）。
const fabLine = fabSrc
  .split("\n")
  .find((l) => l.split(/[\s`"'{}$]+/).includes("wr-fab"));
if (!fabLine) {
  bad(`${relative(ROOT, FAB_FILE)} 裡找不到完整的 wr-fab class —— globals.css 的讓位規則失去抓手，浮層打開時回報鈕不會再隱藏`);
}
const FAB_Z = fabLine ? (zTokenOf(fabLine.split(/[\s`"]+/)) ? zValue(zTokenOf(fabLine.split(/[\s`"]+/))!)! : null) : null;
if (FAB_Z === null) {
  bad("BugReportFab.tsx 的 wr-fab 那行讀不到 z-* class，無法判斷浮層誰在上面");
} else {
  ok.push(`回報鈕 z = ${FAB_Z}（從 BugReportFab.tsx 讀）`);
}

/**
 * 設計器裡的回報鈕在 <md 是 `relative`（排在文件流裡），只有 ≥md 才 `md:fixed`。
 * 2026-10-29 iPhone 13 實測正式站 /design/stool：position=relative、y=1352 在折線下方
 * ⇒ 手機上它根本沒浮起來，蓋不到任何浮層。
 * 這個前提是下面 MOBILE_ONLY_OVERLAYS 放行的依據，所以要機器驗、不能只寫註解。
 */
const FAB_IN_FLOW_ON_MOBILE =
  !!fabLine && /inDesigner\s*\?[\s\S]{0,300}?\brelative\b[\s\S]{0,300}?\bmd:fixed\b/.test(fabLine);

// ---- 2. globals.css 的隱藏規則，解析成 class token 集合 --------------------
const cssSrc = readFileSync(CSS_FILE, "utf8");
const hideSelectors: string[][] = [];
for (const m of cssSrc.matchAll(/^([^{}\n]*\.wr-fab[^{}\n]*)\{([^}]*)\}/gm)) {
  const selector = m[1];
  const body = m[2];
  if (!/pointer-events\s*:\s*none/.test(body)) continue; // 只有擋點擊才算讓位
  for (const h of selector.matchAll(/:has\(([^)]+)\)/g)) {
    const tokens = h[1].split(".").map((s) => s.trim()).filter(Boolean);
    if (tokens.length) hideSelectors.push(tokens);
  }
}
if (!hideSelectors.length) {
  bad(`${relative(ROOT, CSS_FILE)} 找不到任何「浮層開著就收掉 .wr-fab」的規則（body:has(...) .wr-fab）`);
} else {
  ok.push(`CSS 隱藏規則 ${hideSelectors.length} 條：${hideSelectors.map((t) => "." + t.join(".")).join(" / ")}`);
}
const coveredByCss = (tokens: string[]) =>
  hideSelectors.some((need) => need.every((n) => tokens.includes(n)));

/**
 * 只在手機 (<md) 出現的浮層 —— 回報鈕在那個斷點是 relative，蓋不到。
 * `requires` 是放行的前提，前提一旦不成立就報紅（不是無條件跳過）。
 */
const MOBILE_ONLY_OVERLAYS: {
  file: string;
  why: string;
  requires: { ok: () => boolean; broke: string }[];
}[] = [
  {
    file: "components/mobile/MobileOverflowMenu.tsx",
    why: "只在 MobileShell 裡 render，而 MobileShell 根節點是 md:hidden",
    requires: [
      {
        ok: () => /className="md:hidden/.test(readFileSync(join(ROOT, "components/mobile/MobileShell.tsx"), "utf8")),
        broke: "MobileShell 根節點不再是 md:hidden —— 這個浮層可能在桌機也會出現，那邊的回報鈕是 fixed z-50，會蓋住它",
      },
      {
        ok: () => FAB_IN_FLOW_ON_MOBILE,
        broke: "BugReportFab 在設計器 <md 不再是 relative + md:fixed —— 手機上回報鈕會浮起來蓋住這個浮層",
      },
    ],
  },
];

// ---- 3. 掃出所有 fixed inset-0 浮層 ---------------------------------------
function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next" || name.startsWith(".")) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (name.endsWith(".tsx")) out.push(p);
  }
  return out;
}
const files = SCAN_DIRS.flatMap((d) => walk(join(ROOT, d)));

type Overlay = {
  file: string;
  line: number;
  tag: string;
  classStr: string;
  tokens: string[];
  /** class 字串裡的 ${...} 變數名（z 可能藏在裡面） */
  interps: string[];
};
const overlays: Overlay[] = [];

for (const file of files) {
  const src = readFileSync(file, "utf8");
  // className="..."  /  className={`...`}  （只取字面字串；夠了，Tailwind class 本來就要字面才會被掃進 CSS）
  for (const m of src.matchAll(/className=\{?[`"]((?:[^`"\\]|\\.)*)[`"]/g)) {
    const classStr = m[1];
    if (!/fixed\s+inset-0|inset-0\s+fixed/.test(classStr)) continue;
    const idx = m.index!;
    const line = src.slice(0, idx).split("\n").length;
    // 往前找最近的開標籤，判斷是不是原生 <dialog>
    const before = src.slice(0, idx);
    const tagM = [...before.matchAll(/<([A-Za-z][\w.]*)/g)].pop();
    overlays.push({
      file,
      line,
      tag: tagM ? tagM[1] : "?",
      classStr,
      tokens: classStr.split(/\s+/).filter(Boolean),
      interps: [...classStr.matchAll(/\$\{(\w+)\}/g)].map((i) => i[1]),
    });
  }
}
if (overlays.length < 5) {
  bad(`只掃到 ${overlays.length} 個 fixed inset-0 浮層，掃描器大概壞了（正常 20 個上下）`);
} else {
  ok.push(`掃到 ${overlays.length} 個 fixed inset-0 浮層`);
}

// z class 由 props 傳進來時：收集元件預設值 + 所有呼叫點傳的字面值
function dynamicZCandidates(o: Overlay, varName: string): { label: string; token: string }[] {
  const out: { label: string; token: string }[] = [];
  const src = readFileSync(o.file, "utf8");
  const compName = /([A-Za-z0-9_]+)\.tsx$/.exec(o.file)?.[1] ?? "";
  // 元件簽名的預設值： zModal = "z-50"
  for (const m of src.matchAll(new RegExp(`\\b${varName}\\s*=\\s*"([^"]+)"`, "g"))) {
    out.push({ label: `${relative(ROOT, o.file)} 預設值`, token: m[1] });
  }
  // 所有呼叫點： zModal="z-[70]"
  for (const f of files) {
    if (f === o.file) continue;
    const s = readFileSync(f, "utf8");
    if (!s.includes(`<${compName}`)) continue;
    for (const m of s.matchAll(new RegExp(`\\b${varName}\\s*=\\s*"([^"]+)"`, "g"))) {
      out.push({ label: `${relative(ROOT, f)}:${s.slice(0, m.index!).split("\n").length}`, token: m[1] });
    }
  }
  return out;
}

/** 回傳 null = 這個 z 值安全；回傳字串 = 為什麼不安全 */
function judgeZ(tokens: string[], zTok: string | null): string | null {
  if (coveredByCss(tokens)) return null;
  if (zTok === null) return "沒有 z-* class（stacking 等於 0）";
  const z = zValue(zTok)!;
  if (FAB_Z !== null && z > FAB_Z) return null;
  return `z=${z} 沒贏過回報鈕 z=${FAB_Z}，class 也沒命中 CSS 隱藏規則`;
}

for (const o of overlays) {
  const where = `${relative(ROOT, o.file)}:${o.line}`;
  if (o.tokens.includes("pointer-events-none")) {
    ok.push(`${where} pointer-events-none，蓋不到東西`);
    continue;
  }
  if (o.tag.toLowerCase() === "dialog") {
    ok.push(`${where} 原生 <dialog>（top layer，贏過所有 z-index）`);
    continue;
  }
  const mobileOnly = MOBILE_ONLY_OVERLAYS.find((m) => o.file.endsWith(m.file));
  if (mobileOnly) {
    const broken = mobileOnly.requires.filter((r) => !r.ok());
    if (broken.length) {
      for (const r of broken) bad(`${where} 原本因「${mobileOnly.why}」放行，但前提破了：${r.broke}`);
    } else {
      ok.push(`${where} ${mobileOnly.why}，手機上回報鈕是 relative 在流裡 → 安全`);
    }
    continue;
  }

  const zTok = zTokenOf(o.tokens);
  if (zTok === null && o.interps.length) {
    // z 藏在 props 裡 —— 預設值跟每個呼叫點都要查
    let checked = 0;
    for (const v of o.interps) {
      for (const c of dynamicZCandidates(o, v)) {
        checked++;
        const why = judgeZ([...o.tokens.filter((t) => !t.includes("${")), ...c.token.split(/\s+/)], zTokenOf(c.token.split(/\s+/)));
        if (why) bad(`${where} 的 ${v} 在 ${c.label} 傳 "${c.token}"：${why} —— 浮層打開時客人右下角會被回報鈕吃掉點擊`);
        else ok.push(`${where} ${v}="${c.token}"（${c.label}）安全`);
      }
    }
    if (!checked) bad(`${where} 的 z class 由 ${o.interps.join("/")} 傳入，但找不到任何字面值可查 —— 無法判斷會不會被回報鈕蓋住`);
    continue;
  }
  const why = judgeZ(o.tokens, zTok);
  if (why) bad(`${where} <${o.tag}>：${why} —— 浮層打開時客人右下角會被回報鈕吃掉點擊`);
  else ok.push(`${where} <${o.tag}> ${zTok ?? "(CSS 規則涵蓋)"} 安全`);
}

for (const line of ok) console.log("✓", line);
if (fail) {
  console.error(`\n❌ audit-overlay-fab: ${fail} 個問題`);
  process.exit(1);
}
console.log(`\n✅ audit-overlay-fab: ${overlays.length} 個全螢幕浮層都不會被回報鈕蓋住`);
