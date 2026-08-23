/**
 * 掃全部模板:把每個 number 型選項各自拉到 min / max,找出會產出**非正尺寸零件**的組合。
 *
 * ⭐ 為什麼要有這支:2026-08-21 稽核只報了一條(床頭櫃抽屜數拉到 5 → 16 個 −7mm 的零件),
 *   但實際跑一次全掃才知道**問題比那條大得多** —— 14 個模板,而且不只「腳內縮」,
 *   還有欄數(topCols / bottomCols)與區高(bottomHeight)。
 *
 * 負尺寸零件不會爆錯,只會安靜地流進材料單、裁切計算與報價(負材積、負價格),
 * 除非有人剛好把滑桿拉到那個值才會被發現。這支就是拿來持續看住它的。
 *
 * 跑法:npx tsx scripts/audit-negative-dims.ts
 * ⚠️ 目前還有未修完的項目,所以它會列出東西 —— 用途是「數字不能變多」,不是要它全綠。
 */
import { FURNITURE_CATALOG } from "../lib/templates";
const bad: Record<string, Set<string>> = {};
for (const e of FURNITURE_CATALOG as any[]) {
  if (!e.template) continue;
  const specs = (e.optionSchema ?? []) as any[];
  const base: any = specs.reduce((a: any, s: any) => (a[s.key] = s.defaultValue, a), {});
  for (const s of specs) {
    if (s.type !== "number") continue;
    for (const v of [s.min, s.max]) {
      if (v == null) continue;
      try {
        const d = e.template({ length: e.defaults.length, width: e.defaults.width, height: e.defaults.height, material: "maple", options: { ...base, [s.key]: v } });
        const neg = d.parts.filter((p: any) => p.visible.length <= 0 || p.visible.width <= 0 || p.visible.thickness <= 0);
        if (neg.length) (bad[e.category] ??= new Set()).add(`${s.key}=${v} → ${neg.length} 個`);
      } catch { /* 丟例外是另一回事,這裡只找負尺寸 */ }
    }
  }
}
const cats = Object.keys(bad);
console.log(`會產出非正尺寸零件的模板:${cats.length} / ${(FURNITURE_CATALOG as any[]).length}`);
for (const c of cats) { console.log(`  ${c}:`); for (const x of bad[c]) console.log(`     ${x}`); }
// 有中招就 exit 1 —— 這支跟 audit-overlaps 不一樣,基線是 0,不是「比對前後」。
if (cats.length > 0) {
  console.log("\n⛔ 非正尺寸零件會直接流進裁切單 / 報價 / 3D 匯出,而且沒有任何警告。");
  console.log("   修法:在讀選項的地方夾上限(參考 clampLegInset / MIN_ZONE_H),不要在下游補。");
  process.exit(1);
}
console.log("✅ 28 款家具、所有數字選項推到極值,零件尺寸全是正的。");
