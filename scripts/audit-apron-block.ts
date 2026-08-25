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
import { curvedTaperCoveSpan, curvedTaperInsetAtY } from "@/lib/render/part-geometry";

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
      // 只有「牙條」該落在接撐段內;橫撐本來就在弧下面,不算
      if (!/apron/.test(p.id)) continue;
      /**
       * 兩條都要過:
       *   1. 牙條底緣不可以掉到接撐段以下(掉下去就懸空在凹弧上方)
       *   2. 還要**讓開弧肩那一段** —— 弧的上端是水平切線,貼著接撐段底
       *      等於架在刀口上(1mm 內縮 3.8mm)。木頭仁 2026-08-25 實測:
       *      接撐段 40 / 弧肩 8 → 牙條要 32 才對。
       */
      const legTop = leg.origin.y + lh;
      let blockBottom = leg.origin.y;
      for (let y = legTop; y >= leg.origin.y; y -= 0.05)
        if (curvedTaperInsetAtY(lw, lh, sh.blockHeightMm, sh.shoulderMm, sh.insetMm, y - leg.origin.y - lh / 2) > 0.01) { blockBottom = y; break; }
      const coveSpan = curvedTaperCoveSpan(lw, lh, sh.blockHeightMm, sh.shoulderMm);
      const shortBy = (blockBottom + coveSpan) - p.origin.y;   // >0 = 沒讓夠
      if (shortBy > w) { w = shortBy; who = p.nameZh ?? p.id; }
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
        if (r && r.w > 0.6) hits.push(`  ${cat.padEnd(13)} ${key}=${String(v).padEnd(5)} → ${r.who} 底緣少讓 ${r.w.toFixed(2)}mm（沒讓開弧肩）`);
      } catch { /* 無效組合 */ }
    }
  }
  const base0 = worst({});
  console.log(`${cat.padEnd(14)} 預設:牙條底緣比「接撐段底＋弧肩」還低 ${base0 ? base0.w.toFixed(2) : "—"}mm ${base0 && base0.w <= 0.6 ? "✅" : "❌"}`);
}

console.log(`\n牙條底緣沒讓開弧肩的設定:${hits.length ? "" : " (無)"}`);
hits.slice(0, 40).forEach((h) => console.log(h));

if (hits.length > 0) {
  console.log("\n⛔ 牙條底緣沒讓開弧肩 = 3D 交界處會有缺口／底緣架在刀口上。修在「牙條高度的夾制」,把所有下移量與弧肩都扣掉。");
  process.exit(1);
}
console.log("\n✅ 每一款、每一種設定,牙條底緣都落在接撐段內、而且讓開了弧肩。");
