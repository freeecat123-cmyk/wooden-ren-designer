/**
 * 腳跟牙條 / 橫撐有沒有接上,還是中間有縫。
 *
 * ⛔ 弧肩斜腳的內面**會隨高度往內縮**。接在腳下半段的橫撐,如果還按「名目腳面」
 *    算長度,就會短一截 —— 組起來腳跟橫撐之間是一條縫,而且圖上看不太出來。
 *
 * 2026-08-24 逐接合點掃描抓到:茶几開兩向弧肩時,**沿 Z 走的下橫撐短了 14.7mm**。
 * 原因是補償只做了 X 方向(程式碼註解自己就寫「Z 不補償」——單向時對,兩向就錯)。
 * 同一輪還發現 9 款裡有 5 款的「兩向弧肩」選項根本沒接上(勾了沒作用)。
 *
 * 判準:零件端點座標 vs 該高度腳面的**實際**位置。負值 = 有縫。
 * ⚠️ 零件是帶旋轉的(牙條 rot.x=90°、左右牙條再 rot.y=90°),
 *    用 visible 大小猜方向會全錯 —— 要看 rotation.y。這個坑踩過。
 *
 * 跑:npx tsx scripts/audit-leg-joints.ts   基線硬 0。
 */
import { FURNITURE_CATALOG } from "../lib/templates";
import { curvedTaperInsetAtY } from "../lib/render/part-geometry";
const CATS = ["stool","bench","tea-table","side-table","low-table","dining-table","desk","dining-chair","bar-stool"];
const INJECT = !!process.env.NEG_CTL;   // 負向對照:注入 50mm 假縫,確認這支抓得到
const bad: string[] = [];
// 把弧肩相關的選項推到極值,看接合會不會裂開
const VARIANTS: [string|null, number][] = [
  [null,0], ["ctBlockHeight",10], ["ctBlockHeight",250],
  ["ctShoulder",0], ["ctShoulder",40], ["ctInset",0], ["ctInset",100],
];
let checked = 0;

for (const cat of CATS) {
  const e = (FURNITURE_CATALOG as any[]).find(x => x.category === cat)!;
  const base: any = (e.optionSchema ?? []).reduce((a: any, s: any) => ((a[s.key] = s.defaultValue), a), {});
  for (const lc of [false, true]) {
  for (const tw of [false, true]) {
    for (const [k, v] of VARIANTS) {
    const d = e.template({ length: e.defaults.length, width: e.defaults.width, height: e.defaults.height,
      material: "maple", options: { ...base, legShape: "curved-taper", ctTwoWay: tw, ctLowerCove: lc, ...(k ? { [k]: v } : {}) } });
    const legs = (d.parts as any[]).filter(p => p.shape?.kind === "curved-taper");
    if (!legs.length) continue;
    /**
     * ⚠️ 方凳/餐椅的下橫撐 id 是 `ls-front` —— 不含 "stretcher" 這個字,
     *    舊的 `/apron|stretcher/` **整組漏掃**。2026-08-25 做變異測試時發現:
     *    把補償改壞了稽核居然不吭聲。過濾條件寧可寬一點。
     */
    /**
     * ⚠️ 吧檯椅的下橫撐叫 `footrest-*`（腳踏）—— 也不含 stretcher 這個字。2026-09-02 三視圖實畫稽核
     *    抓到兩向弧肩時左右腳踏每端短 13mm，而這支一直綠燈就是因為它從沒掃到腳踏。
     */
    const conns = (d.parts as any[]).filter(p => /apron|stretcher|footrest|^ls-|^fr-/.test(p.id) && p.shape?.kind !== "curved-taper");
    for (const c of conns) {
      // 判斷這根是沿 X 還是沿 Z(取最長邊的方向)
      /**
       * ⚠️ 零件是**帶旋轉**的(牙條 rot.x=90°,左右牙條再 rot.y=90°)。
       *    用 visible 的大小猜方向會全錯 —— 要看 rotation.y 才知道長邊指向 X 還是 Z。
       */
      const ry = c.rotation?.y ?? 0;
      const alongX = Math.abs(Math.cos(ry)) > 0.5;
      const halfLen = c.visible.length / 2;
      const cy = c.origin.y + c.visible.width / 2;   // 高度中心
      for (const sgn of [-1, 1] as const) {
        // 這一端要接的腳:同一側、且另一軸最接近的
        const endPos = alongX ? c.origin.x + sgn * halfLen : c.origin.z + sgn * halfLen;
        const other  = alongX ? c.origin.z : c.origin.x;
        const cand = legs.filter(L => Math.sign(alongX ? L.origin.x : L.origin.z) === sgn)
          .sort((a,b)=>Math.abs((alongX?a.origin.z:a.origin.x)-other)-Math.abs((alongX?b.origin.z:b.origin.x)-other))[0];
        if (!cand) continue;
        checked++;
        const lw = cand.visible.length, ld = cand.visible.width, lh = cand.visible.thickness;
        const sh = cand.shape;
        const localY = cy - (cand.origin.y + lh / 2);
        if (localY > lh/2 || localY < -lh/2) continue;
        // 這一面的內縮量:沿 X 的零件看腳的 X 面、沿 Z 的看 Z 面(只有兩向才有)
        /**
         * ⚠️ 參考值一定要帶 `sh.lowerCove` —— 腳有第二道弧時,單道弧的輪廓
         *    在橫撐高度會少算,稽核就會誤報 0.7~1.1mm 的縫（2026-08-25 撞過）。
         *    直接讀零件自己的 shape,不要自己假設。
         */
        const inset = alongX
          ? curvedTaperInsetAtY(lw, lh, sh.blockHeightMm, sh.shoulderMm, sh.insetMm, localY, sh.lowerCove)
          : (tw ? curvedTaperInsetAtY(ld, lh, sh.blockHeightMm, sh.shoulderMm, sh.insetMm, localY, sh.lowerCove) : 0);
        const legCtr = alongX ? cand.origin.x : cand.origin.z;
        const legHalf = (alongX ? lw : ld) / 2;
        const faceActual = legCtr - sgn * legHalf + sgn * inset;   // 朝中心那面 + 內縮
        const gap = ((endPos - faceActual) * sgn) - (INJECT ? 50 : 0);   // 正=插進去 負=有縫
        if (gap < -0.5) bad.push(`${cat}[${tw?"兩向":"單向"}${lc?"+橫撐弧肩":""}${k?`/${k}=${v}`:""}] ${c.nameZh ?? c.id} 的${sgn>0?"右/後":"左/前"}端跟腳差 ${(-gap).toFixed(1)}mm 的縫`);
      }
    }
    }
    }
  }
}
console.log(`檢查 ${checked} 個端點`);
const u=[...new Set(bad)];
console.log(`接不到、有縫的:${u.length} 種`);
u.slice(0,20).forEach(x=>console.log("   "+x));
if (u.length > 0) {
  console.log("\n⛔ 這些接合處組起來會有縫。修在「算零件長度」的地方,讓它對到該高度的實際腳面。");
  process.exit(1);
}
console.log("✅ 每個接合處都貼到實際腳面。");
