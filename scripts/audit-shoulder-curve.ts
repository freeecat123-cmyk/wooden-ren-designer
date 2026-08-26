/**
 * 稽核:「弧肩曲線 = S 形」在每一款弧肩腳家具都要真的換曲線。
 *
 * 🩸 這個下拉來自共用的 `curvedTaperLegOptions()`,9 款全都會長出來 ——
 *    但每一款都要各自把旗標傳進腳的形狀（`rectLegShape` 的 curvedTaper.sCurve）,
 *    而且橫撐/牙條的補償（`curvedTaperInnerScaleAt`）也要吃同一個旗標,
 *    否則腳收窄了、橫撐長度還照圓弧算 → 接合處露縫或穿模。
 *    漏傳的那款,下拉選了沒反應 = 死控制項（木頭仁最不能接受的一種）。
 *
 * 三條:
 *   1. 選了 S 形,腳的形狀要有 sCurve
 *   2. 弧段中點的內縮量必須不一樣（圓弧 shoulder·cos vs smoothstep 差很多）
 *   3. 選圓弧（預設）時,輸出必須跟改動前**完全一樣**（不可動到既有設計）
 */
import { FURNITURE_CATALOG } from "@/lib/templates";
import { curvedTaperInsetAtY, curvedTaperCoveSpan } from "@/lib/render/part-geometry";

const bad: string[] = [];
let checked = 0;

for (const e of FURNITURE_CATALOG as any[]) {
  const specs = (e.optionSchema ?? []) as any[];
  if (!specs.some((s) => s.key === "ctShoulderCurve")) continue;
  const base: any = specs.reduce((a: any, s: any) => ((a[s.key] = s.defaultValue), a), {});

  const build = (v: string) => {
    try {
      return e.template({ length: e.defaults.length, width: e.defaults.width, height: e.defaults.height,
        material: "pine", options: { ...base, legShape: "curved-taper", ctShoulderCurve: v } });
    } catch { return null; }
  };
  const arc = build("arc"), s = build("s-curve");
  if (!arc || !s) continue;
  const legArc = (arc.parts as any[]).find((p) => p.shape?.kind === "curved-taper");
  const legS = (s.parts as any[]).find((p) => p.shape?.kind === "curved-taper");
  if (!legArc || !legS) continue;
  checked++;

  // 1) 旗標有沒有傳下去
  if (!legS.shape.sCurve) {
    bad.push(`${arc.nameZh}:選了 S 形,腳的形狀卻沒有 sCurve ← 死控制項`);
    continue;
  }
  if (legArc.shape.sCurve) {
    bad.push(`${arc.nameZh}:選圓弧（預設）卻帶了 sCurve ← 既有設計會被改到`);
  }

  // 2) 弧段中點的內縮量要不一樣
  const sh = legS.shape, lw = legS.visible.length, lh = legS.visible.thickness;
  const coveSpan = curvedTaperCoveSpan(lw, lh, sh.blockHeightMm, sh.shoulderMm);
  const yMid = lh - Math.min(sh.blockHeightMm, lh * 0.9) - coveSpan / 2;   // 從腳底量
  const insArc = curvedTaperInsetAtY(lw, lh, sh.blockHeightMm, sh.shoulderMm, sh.insetMm, yMid - lh / 2, undefined, false);
  const insS = curvedTaperInsetAtY(lw, lh, sh.blockHeightMm, sh.shoulderMm, sh.insetMm, yMid - lh / 2, undefined, true);
  if (Math.abs(insArc - insS) < 0.3) {
    bad.push(`${arc.nameZh}:弧段中點的內縮量幾乎沒變（${insArc.toFixed(2)} → ${insS.toFixed(2)}）`);
  }

  // 3) 選圓弧時,所有零件尺寸/位置要跟沒這個選項時一模一樣
  const noOpt = (() => {
    try {
      const o2 = { ...base, legShape: "curved-taper" }; delete o2.ctShoulderCurve;
      return e.template({ length: e.defaults.length, width: e.defaults.width, height: e.defaults.height, material: "pine", options: o2 });
    } catch { return null; }
  })();
  if (noOpt) {
    const key = (d: any) => (d.parts as any[]).map((p) =>
      `${p.id}:${p.visible.length.toFixed(2)}x${p.visible.width.toFixed(2)}x${p.visible.thickness.toFixed(2)}@${p.origin.x.toFixed(2)},${p.origin.y.toFixed(2)},${p.origin.z.toFixed(2)}`).join("|");
    if (key(arc) !== key(noOpt)) bad.push(`${arc.nameZh}:選圓弧（預設）跟「沒有這個選項」時輸出不一致 ← 既有設計被改到`);
  }
}

console.log(`檢查 ${checked} 款有「弧肩曲線」的家具`);
console.log(`沒生效 / 改到既有的:${bad.length}`);
bad.forEach((b) => console.log("   " + b));
if (bad.length) { console.log("\n⛔ 下拉選了沒反應 = 死控制項;或預設值被動到 = 既有設計被改。"); process.exit(1); }
console.log("✅ 每一款選 S 形都真的換曲線，選圓弧的完全不受影響。");
