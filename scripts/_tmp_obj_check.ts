import { dovetailBox, dovetailBoxOptions } from "../lib/templates/dovetail-box";
import { validateDesignExport, buildGroup } from "../lib/export/three-d-export";
import { OBJExporter } from "three/examples/jsm/exporters/OBJExporter.js";
import type { MaterialId } from "../lib/types";

function build(over: Record<string, string | number | boolean>) {
  const opts = dovetailBoxOptions.reduce<Record<string, string | number | boolean>>(
    (a, s) => { a[s.key] = s.defaultValue; return a; }, {});
  Object.assign(opts, over);
  return dovetailBox({ length: 250, width: 150, height: 90, material: "maple" as MaterialId, options: opts });
}

const cases: Array<[string, Record<string, string | number | boolean>]> = [
  ["rect 嵌入式 rabbeted", { boxShape: "rect", withLid: true, lidType: "rabbeted" }],
  ["rect 掀蓋式 lift-off", { boxShape: "rect", withLid: true, lidType: "lift-off" }],
  ["rect 滑入式 sliding", { boxShape: "rect", withLid: true, lidType: "sliding" }],
  ["六角 hex", { boxShape: "hex", withLid: true }],
  ["八角 oct", { boxShape: "oct", withLid: true }],
  ["preset jewelry", { boxUse: "jewelry" }],
];

let allOk = true;
for (const [name, over] of cases) {
  try {
    const design = build(over);
    const v = validateDesignExport(design);
    const group = buildGroup(design, 1);
    const obj = new OBJExporter().parse(group);
    const vCount = (obj.match(/^v /gm) || []).length;
    const fCount = (obj.match(/^f /gm) || []).length;
    const hasNaN = /\bNaN\b/.test(obj);
    const ok = v.ok && vCount > 0 && fCount > 0 && !hasNaN;
    if (!ok) allOk = false;
    console.log(
      `${ok ? "✅" : "❌"} ${name}: parts=${design.parts.length} verts=${vCount} faces=${fCount} NaN=${hasNaN} validate=${v.ok}` +
        (v.ok ? "" : ` badParts=[${v.badParts.map((p) => p.partName).join(", ")}]`),
    );
  } catch (e) {
    allOk = false;
    console.log(`❌ ${name}: THREW ${(e as Error).message}`);
  }
}
console.log(allOk ? "\n🎉 OBJ 匯出全部正常" : "\n⚠ 有問題");
