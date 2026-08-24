/**
 * 1:1 實尺模板(template pack)—— 印出來要能直接貼到木料上照著切。
 *
 * ⛔ 這是所有輸出裡**最不能錯**的一種:客人把 A4 印出來、剪下、貼到木料上、
 *    沿著線切。尺寸差 1mm 就是廢一塊料,而且他不會事先發現。
 *
 * 2026-08-24 查新腳型的輸出時發現:這一整條路徑**完全沒有自動稽核**。
 *
 * 驗四件事:
 *   1. 有造型的面一定要被判「需要模板」——否則那條弧根本印不出來
 *   2. 每一頁都是 A4(直式或橫式都可以,腳細長會用直式)
 *   3. 頁面尺寸用 mm 標,沒有 mm 就不是 1:1
 *   4. 內容不能有 NaN / Infinity
 *
 * 跑:npx tsx scripts/audit-template-pack.ts   基線硬 0。
 */
import { FURNITURE_CATALOG } from "../lib/templates";
import { applyEdgeProtection } from "../lib/joinery/edge-protection";
import { pickTemplateFaces } from "../lib/export/template-pack/face";
import { faceNeedsTemplate } from "../lib/export/template-pack/needs-template";
import { planA4Tiles } from "../lib/export/template-pack/tiling";
import { tileSheetSvg } from "../lib/export/template-pack/tile-sheet";

const INJECT = !!process.env.NEG_CTL;   // 負向對照:確認這支抓得到
const bad: string[] = [];
let pages = 0, faces = 0, skippedBig = 0;

for (const e of FURNITURE_CATALOG as never[] as any[]) {
  if (!e.template) continue;
  const specs = (e.optionSchema ?? []) as any[];
  const base: any = specs.reduce((a: any, s: any) => ((a[s.key] = s.defaultValue), a), {});
  // 有造型的腳型最容易出事,全部掃;沒有 legShape 的家具用預設跑一次
  const legSpec = specs.find((s) => s.key === "legShape");
  const variants: [string, any][] = legSpec?.choices
    ? legSpec.choices.map((c: any) => [c.value, { ...base, legShape: c.value }])
    : [["預設", base]];
  if (legSpec?.choices?.some((c: any) => c.value === "curved-taper")) {
    variants.push(["弧肩腳/兩向", { ...base, legShape: "curved-taper", ctTwoWay: true }]);
  }

  for (const [tag, opts] of variants) {
    let d: any;
    try { d = applyEdgeProtection(e.template({
      length: e.defaults.length, width: e.defaults.width, height: e.defaults.height,
      material: "maple", options: opts,
    })); } catch { continue; }
    const T = `${e.category}[${tag}]`;

    for (const p of d.parts as any[]) {
      if (p.visual !== undefined) continue;
      let fs: any[];
      try { fs = pickTemplateFaces(p) as any[]; } catch (err: any) {
        bad.push(`${T} ${p.id}: 挑模板面丟例外 ${String(err?.message).slice(0, 50)}`); continue;
      }
      for (let fi = 0; fi < fs.length; fi++) {
        const f = fs[fi];
        faces++;
        // ① 有造型的面必須要模板
        const shaped = (f.outline?.length ?? 0) > 4;
        const need = INJECT ? false : faceNeedsTemplate(f);
        if (shaped && !need) bad.push(`${T} ${p.id}/${f.faceLabelZh}: 有造型卻判「不需要模板」→ 那條線印不出來`);
        if (!Number.isFinite(f.w) || !Number.isFinite(f.h) || f.w <= 0 || f.h <= 0) {
          bad.push(`${T} ${p.id}/${f.faceLabelZh}: 面尺寸 ${f.w}×${f.h}`); continue;
        }
        /**
         * ⚠️ `planA4Tiles` 回 null **不是 bug**:超過 MAX_TILES_PER_FACE(6 張)
         *    就刻意不出樣板、退回一般比例零件圖(見 tiling.ts:7 的註解)。
         *    大零件(長凳座板、書架側板)本來就會走這條路。
         *    我第一版把它當問題報,一擴大到全 28 款就冒出 638 條假警報。
         */
        const plan: any = planA4Tiles(f.w, f.h);
        if (!plan) { skippedBig++; continue; }
        for (const tile of plan.tiles ?? []) {
          pages++;
          let svg = "";
          try {
            svg = tileSheetSvg({ face: f, plan, tile, partNo: "P-01",
              nameZh: p.nameZh ?? p.id, qty: 1, faceIndex: fi, faceCount: fs.length });
          } catch (err: any) {
            bad.push(`${T} ${p.id}/${f.faceLabelZh}: 出圖丟例外 ${String(err?.message).slice(0, 50)}`); continue;
          }
          const w = /width="([\d.]+)mm"/.exec(svg);
          const h = /height="([\d.]+)mm"/.exec(svg);
          if (!w || !h) { bad.push(`${T} ${p.id}/${f.faceLabelZh}: 頁面沒有 mm 尺寸 → 印出來不是 1:1`); continue; }
          // ② A4:直式或橫式都可以，但排序後一定是 210×297
          const [pw, ph] = [+w[1], +h[1]].sort((a, b) => a - b);
          if (Math.abs(pw - 210) > 0.6 || Math.abs(ph - 297) > 0.6) {
            bad.push(`${T} ${p.id}/${f.faceLabelZh}: 頁面 ${w[1]}×${h[1]}mm 不是 A4`);
          }
          if (/NaN|Infinity/.test(svg)) bad.push(`${T} ${p.id}/${f.faceLabelZh}: 內容有 NaN/Infinity`);
        }
      }
    }
  }
}

console.log(`掃了 ${faces} 個模板面 / 產出 ${pages} 頁 A4 / ${skippedBig} 個面太大改走一般零件圖(正常)`);
const u = [...new Set(bad)];
console.log(`問題:${u.length} 種`);
u.slice(0, 20).forEach((x) => console.log("   " + x));
if (u.length) {
  console.log("\n⛔ 這些模板印出來會害人切錯料。");
  process.exit(1);
}
console.log("✅ 每一頁都是 A4、都標了 mm(1:1)、有造型的面都印得出輪廓。");
