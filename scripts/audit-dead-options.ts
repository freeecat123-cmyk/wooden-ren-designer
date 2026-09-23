/**
 * 「改了沒反應、又沒被藏起來」的控制項。
 *
 * 使用者拉一個滑桿 / 勾一個框,產出完全沒變 —— 他會以為網站壞掉。
 * 這種東西有兩種正當情況:
 *   (a) 有 `dependsOn` → 條件不成立時 UI 會把它藏起來,使用者根本看不到
 *   (b) `help` 裡明講了生效條件(例:「tapered/splayed 腳形時倒角無效」)
 * 兩者皆無 = 死控制項。
 *
 * 2026-08-24 首次掃描:966 個控制項裡 14 個中招 —— 補了 6 個 dependsOn、1 個 help,
 * 其餘 7 個 help 早就寫了生效條件。開發中分類(DEV_CATEGORIES)排除。基線硬 0。
 *
 * ⚠️ 這支只掃「預設值狀態」。父選項要打開才生效的控制項,在這裡本來就會被
 *    列出來 —— 所以判準是「有沒有 dependsOn 或 help 交代」,不是「有沒有作用」。
 */
import { FURNITURE_CATALOG, isDevCategory } from "../lib/templates";

const BASELINE = 0;
const offenders: string[] = [];
let total = 0;

for (const e of FURNITURE_CATALOG as any[]) {
  if (!e.template) continue;
  // 開發中分類目錄不列、sitemap 不收,使用者碰不到 → 不算死控制項
  if (isDevCategory(e.category)) continue;
  const specs = (e.optionSchema ?? []) as any[];
  const base: any = specs.reduce((a: any, s: any) => ((a[s.key] = s.defaultValue), a), {});
  const mk = (o: any) =>
    JSON.stringify(e.template({
      length: e.defaults.length, width: e.defaults.width, height: e.defaults.height,
      material: "maple", options: o,
    }).parts);
  let ref: string;
  try { ref = mk(base); } catch { continue; }

  for (const s of specs) {
    // 負向對照:NEG_CTL=1 時,把每個模板的第一個選項的 dependsOn / help 拿掉,
    // 看這支稽核抓不抓得到。
    if (process.env.NEG_CTL && s === specs.find((x: any) => x.type === "number" && x.min != null)) {
      delete s.dependsOn; delete s.help;
    }
    let alt: unknown;
    if (s.type === "checkbox" || s.type === "boolean") alt = !s.defaultValue;
    else if (s.type === "number" && s.min != null && s.max != null) {
      alt = s.defaultValue === s.max ? s.min : s.max;
    } else continue;
    total++;
    let out: string;
    try { out = mk({ ...base, [s.key]: alt }); } catch { continue; }
    if (out !== ref) continue;                 // 有作用
    if (s.dependsOn) continue;                 // UI 會藏起來
    if (s.help && s.help.length > 0) continue; // help 交代過生效條件
    offenders.push(`${e.category}.${s.key}（${s.label}）改 ${s.defaultValue}→${alt} 沒反應`);
  }
}

console.log(`掃了 ${total} 個數字/勾選控制項`);
console.log(`「改了沒反應、沒 dependsOn、也沒 help」的:${offenders.length}(基線 ${BASELINE})`);
for (const o of offenders.slice(0, 20)) console.log(`   ${o}`);
if (offenders.length > BASELINE) {
  console.log("\n⛔ 比基線多了。要嘛補 dependsOn 把它藏起來,要嘛在 help 講清楚什麼時候才生效。");
  process.exit(1);
}
console.log("✅ 沒有比基線更多。");
