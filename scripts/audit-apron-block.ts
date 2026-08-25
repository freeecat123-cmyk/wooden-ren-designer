/**
 * 稽核:弧肩斜腳的「牙條底緣」不可以掉出接撐段。
 *
 * 接撐段(ctBlockHeight)是腳頂端維持全寬、留給牙條接合的那一節。
 * 牙條底緣一旦低於它,底緣就懸空在凹弧上方 —— 3D 看得到一個缺口,
 * 榫頭也會露出來。
 *
 * 🩸 為什麼要有這支:2026-08-25 木頭仁連問三次「為什麼會接不起來 有落差」。
 *    牙條高度的夾制只扣了「牙條距座板」,**漏扣「牙條錯開」** ——
 *    錯開一樣是把前後那對牙條整支下移。錯開只要 2mm,底緣就懸空 5.3mm。
 *    我前兩輪只量「沒錯開」的情況,所以一直量到 0.00mm、跟他說「有對齊」。
 *    ⇒ 掃描要把**每一個會影響位置的選項**都推過一遍,不能只用預設值。
 */
import { FURNITURE_CATALOG } from "@/lib/templates";
import { curvedTaperInsetAtY } from "@/lib/render/part-geometry";

const CATS = ["stool", "bench", "side-table", "low-table", "dining-table", "desk", "dining-chair", "bar-stool", "tea-table"];
const hits: string[] = [];

for (const cat of CATS) {
  const e = (FURNITURE_CATALOG as any[]).find((x) => x.category === cat);
  if (!e) continue;
  const specs = (e.optionSchema ?? []) as any[];
  const base: any = specs.reduce((a: any, s: any) => ((a[s.key] = s.defaultValue), a), {});

  /** 回傳每一根牙條/橫撐底緣處,腳已經內縮多少（>0 = 底緣懸空、有縫） */
  const worst = (ov: any) => {
    const d = e.template({
      length: e.defaults.length, width: e.defaults.width, height: e.defaults.height, material: "pine",
      options: { ...base, legShape: "curved-taper", ...ov },
    });
    const leg = (d.parts as any[]).find((p) => p.shape?.kind === "curved-taper");
    if (!leg) return null;
    const sh = leg.shape, lh = leg.visible.thickness, lw = leg.visible.length;
    let w = 0, who = "";
    for (const p of d.parts as any[]) {
      if (!/apron|stretcher|^ls-/.test(p.id)) continue;
      const ins = curvedTaperInsetAtY(lw, lh, sh.blockHeightMm, sh.shoulderMm, sh.insetMm,
        p.origin.y - leg.origin.y - lh / 2);
      // 只有「牙條」該貼在接撐段上;橫撐本來就在弧下面,不算
      if (!/apron/.test(p.id)) continue;
      if (ins > w) { w = ins; who = p.nameZh ?? p.id; }
    }
    return { w, who };
  };

  // 只掃跟牙條位置有關的選項，逐一推到極值
  const KEYS = ["apronWidth", "ctBlockHeight", "apronDropFromTop", "apronStaggerMm", "ctShoulder", "ctInset", "legSize", "seatThickness", "apronThickness"];
  for (const key of KEYS) {
    const s = specs.find((x) => x.key === key);
    if (!s) continue;
    const vals = s.type === "number"
      ? [s.min, 2, 10, 20, Math.round(((s.min ?? 0) + (s.max ?? 0)) / 2), s.max]
      : s.type === "boolean" ? [true, false] : (s.choices ?? []).map((c: any) => c.value);
    for (const v of vals) {
      if (v === s.defaultValue) continue;
      try {
        const r = worst({ [key]: v });
        if (r && r.w > 0.3) hits.push(`  ${cat.padEnd(13)} ${key}=${String(v).padEnd(5)} → ${r.who} 底緣懸空 ${r.w.toFixed(2)}mm`);
      } catch { /* 無效組合 */ }
    }
  }
  const base0 = worst({});
  console.log(`${cat.padEnd(14)} 預設懸空 ${base0 ? base0.w.toFixed(2) : "—"}mm`);
}

console.log(`\n會讓牙條底緣懸空的設定:${hits.length ? "" : " (無)"}`);
hits.slice(0, 40).forEach((h) => console.log(h));

if (hits.length > 0) {
  console.log("\n⛔ 牙條底緣掉出接撐段 = 3D 交界處會有缺口。修在「牙條高度的夾制」,把所有下移量都扣掉。");
  process.exit(1);
}
console.log("\n✅ 每一款、每一種設定,牙條底緣都落在接撐段內。");
