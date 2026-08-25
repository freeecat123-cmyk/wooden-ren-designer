/**
 * 稽核:「橫撐處也做弧肩」在每一款弧肩腳家具都要真的生效。
 *
 * 🩸 這個勾選框來自共用的 `curvedTaperLegOptions()`,9 款全都會長出來 ——
 *    但每一款都要各自把「橫撐的高度區間」算出來傳進腳的形狀。
 *    漏傳的那款,勾選框按了沒反應 = 死控制項（木頭仁最不能接受的一種）。
 *
 * 檢查:勾選前後,腳在**橫撐中心高度**的內縮量必須不一樣（多了第二道弧）。
 */
import { FURNITURE_CATALOG } from "@/lib/templates";
import { curvedTaperInsetAtY } from "@/lib/render/part-geometry";

const bad: string[] = [];
let checked = 0;

for (const e of FURNITURE_CATALOG as any[]) {
  const specs = (e.optionSchema ?? []) as any[];
  if (!specs.some((s) => s.key === "ctLowerCove")) continue;
  const base: any = specs.reduce((a: any, s: any) => ((a[s.key] = s.defaultValue), a), {});

  /**
   * ⚠️ 有些家具預設**沒有下橫撐**（長凳/床邊桌/矮桌/餐桌/書桌）——
   *    沒有橫撐當然不會有第二道弧,那不是死控制項。先把橫撐打開再驗。
   */
  const stretcherKeys = ["withLowerStretcher", "withLowerStretchers"].filter((k) => specs.some((x) => x.key === k));
  const force: any = {};
  for (const k of stretcherKeys) force[k] = true;
  if (specs.some((x) => x.key === "stretcherStyle")) force.stretcherStyle = "h-frame";
  const build = (lc: boolean) => {
    try {
      return e.template({ length: e.defaults.length, width: e.defaults.width, height: e.defaults.height,
        material: "pine", options: { ...base, ...force, legShape: "curved-taper", ctLowerCove: lc } });
    } catch { return null; }
  };
  const off = build(false), on = build(true);
  if (!off || !on) continue;
  const legOff = (off.parts as any[]).find((p) => p.shape?.kind === "curved-taper");
  const legOn = (on.parts as any[]).find((p) => p.shape?.kind === "curved-taper");
  if (!legOff || !legOn) continue;
  checked++;

  // 1) 形狀真的有帶下去嗎
  if (!legOn.shape.lowerCove) {
    bad.push(`${off.nameZh}:勾了「橫撐處也做弧肩」,腳的形狀卻沒有 lowerCove ← 死控制項`);
    continue;
  }
  // 2) 橫撐中心高度的內縮量必須不同
  const lc = legOn.shape.lowerCove;
  const yMid = (lc.botMm + lc.topMm) / 2;
  const lw = legOn.visible.length, lh = legOn.visible.thickness;
  const sh = legOn.shape;
  const insOff = curvedTaperInsetAtY(lw, lh, sh.blockHeightMm, sh.shoulderMm, sh.insetMm, yMid - lh / 2);
  const insOn = curvedTaperInsetAtY(lw, lh, sh.blockHeightMm, sh.shoulderMm, sh.insetMm, yMid - lh / 2, lc);
  if (Math.abs(insOn - insOff) < 0.2) {
    bad.push(`${off.nameZh}:橫撐高度 ${yMid.toFixed(0)}mm 的內縮量沒變（${insOff.toFixed(2)} → ${insOn.toFixed(2)}）`);
  }
  // 3) 沒勾的時候形狀不可以動到
  if (legOff.shape.lowerCove) {
    bad.push(`${off.nameZh}:沒勾卻帶了 lowerCove ← 既有設計會被改到`);
  }
}

console.log(`檢查 ${checked} 款有「橫撐處也做弧肩」的家具`);
console.log(`沒生效的:${bad.length}`);
bad.forEach((b) => console.log("   " + b));
if (bad.length) { console.log("\n⛔ 勾選框按了沒反應 = 死控制項。每一款都要把橫撐的高度區間傳進腳的形狀。"); process.exit(1); }
console.log("✅ 每一款勾了都真的多一道弧，沒勾的完全不受影響。");
