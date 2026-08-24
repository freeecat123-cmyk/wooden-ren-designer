/**
 * 腳型不准被改到。
 *
 * ⛔ 為什麼要有這支:木頭仁明講過「做新的時候不要改到舊的設定,不要影響到別的家具的
 *    腳的樣式,或者是有的美感」。
 *
 *    但既有的 audit 只驗**預設值**下的零件尺寸(`_snap-defaults` 那種比對),
 *    而腳型是**使用者選的**——預設值下每款家具只會用到一種腳型,
 *    其他 8 種腳型「加了新東西之後長什麼樣」完全沒有東西在看。
 *    改 `curved-taper` 的共用輪廓函式時，很容易順手動到 `tapered` 或 `splayed`。
 *
 * 這支把**每一款家具 × 每一種腳型**的零件尺寸與三視圖輪廓存成指紋。
 * 基線檔:`scripts/__baselines__/leg-shapes.json`
 *
 *   npx tsx scripts/audit-leg-shapes.ts            # 比對(CI 用)
 *   npx tsx scripts/audit-leg-shapes.ts --update   # 蓄意改造型時才更新基線
 *
 * ⚠️ `--update` 前一定要先看 diff 印出來的是不是**你打算改的那一款**。
 *    基線變動要跟程式改動一起 commit,審查時看得到「哪一款的腳被動到了」。
 */
import * as fs from "fs";
import * as path from "path";
import { FURNITURE_CATALOG } from "../lib/templates";
import { projectPartSilhouette } from "../lib/render/geometry";

const BASE = path.resolve(__dirname, "__baselines__/leg-shapes.json");

type Fp = Record<string, string>;

function fingerprint(): Fp {
  const out: Fp = {};
  for (const e of FURNITURE_CATALOG as never[] as any[]) {
    if (!e.template) continue;
    const specs = (e.optionSchema ?? []) as any[];
    const legSpec = specs.find((s) => s.key === "legShape");
    if (!legSpec?.choices) continue;
    const base: any = specs.reduce((a: any, s: any) => ((a[s.key] = s.defaultValue), a), {});
    for (const c of legSpec.choices) {
      let d: any;
      try {
        d = e.template({
          length: e.defaults.length, width: e.defaults.width, height: e.defaults.height,
          material: "maple", options: { ...base, legShape: c.value },
        });
      } catch (err: any) {
        out[`${e.category}|${c.value}`] = `THREW:${String(err?.message).slice(0, 60)}`;
        continue;
      }
      // 只看腳:尺寸 + shape 參數 + 三視圖輪廓點數與面積(造型改了這些一定變)
      const legs = (d.parts as any[])
        .filter((p) => /leg|post|column|foot/.test(p.id))
        .map((p) => {
          const v = p.visible;
          /**
           * ⚠️ 指紋要存**實際座標**,不能只存「點數 + 面積」。
           *    第一版只存點數與面積 → 把弧肩改深 1mm 竟然沒被抓到
           *    (點數不變、面積差被四捨五入吃掉)。稽核抓不到的改動 = 沒有防護。
           */
          const sil = (["front", "side", "top"] as const).map((view) => {
            const poly = projectPartSilhouette(p, view) as Array<{ x: number; y: number }>;
            return poly.map((q) => `${q.x.toFixed(2)},${q.y.toFixed(2)}`).join(";");
          });
          return `${p.id}:${v.length}x${v.width}x${v.thickness}:${p.shape?.kind ?? "box"}:${sil.join("|")}`;
        })
        .sort();
      out[`${e.category}|${c.value}`] = legs.join(" | ");
    }
  }
  return out;
}

const now = fingerprint();
const update = process.argv.includes("--update");

if (!fs.existsSync(BASE)) {
  fs.mkdirSync(path.dirname(BASE), { recursive: true });
  fs.writeFileSync(BASE, JSON.stringify(now, null, 1));
  console.log(`✅ 建立基線:${Object.keys(now).length} 組（家具 × 腳型）`);
  process.exit(0);
}

const prev: Fp = JSON.parse(fs.readFileSync(BASE, "utf8"));
const keys = [...new Set([...Object.keys(prev), ...Object.keys(now)])].sort();
const changed = keys.filter((k) => prev[k] !== now[k]);

console.log(`比對 ${keys.length} 組（家具 × 腳型）`);
if (changed.length === 0) {
  console.log("✅ 沒有任何腳型被改到。");
  process.exit(0);
}

console.log(`\n⚠️ ${changed.length} 組的腳變了：`);
for (const k of changed.slice(0, 20)) {
  console.log(`   ${k}`);
  console.log(`     舊 ${(prev[k] ?? "（新增）").slice(0, 110)}`);
  console.log(`     新 ${(now[k] ?? "（刪除）").slice(0, 110)}`);
}

if (update) {
  fs.writeFileSync(BASE, JSON.stringify(now, null, 1));
  console.log("\n✅ 基線已更新。請確認上面列出的正是你打算改的那幾款，並跟程式一起 commit。");
  process.exit(0);
}
console.log("\n⛔ 這些不該變。若是蓄意改造型，跑 `npx tsx scripts/audit-leg-shapes.ts --update` 更新基線。");
process.exit(1);
