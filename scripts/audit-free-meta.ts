import { FURNITURE_CATALOG } from "../lib/templates";
import { isPaidCategory, FREE_UNLOCKED_CATEGORIES } from "../lib/permissions";
import zh from "../messages/zh-TW.json";
import en from "../messages/en.json";

let bad = 0;
for (const loc of [["zh", zh], ["en", en]] as const) {
  const m = (loc[1] as any).design.metadata;
  for (const k of ["titleTemplate", "titleTemplateFree", "descriptionTemplate", "descriptionTemplateFree"]) {
    if (typeof m[k] !== "string" || !m[k]) { console.log(`❌ ${loc[0]} 缺 ${k}`); bad++; }
  }
  // 免費款那組不可以出現「改尺寸是付費」這種假話
  for (const k of ["titleTemplateFree", "descriptionTemplateFree"]) {
    const v: string = m[k] ?? "";
    if (/改尺寸[^。；]*付費|resizing[^.;]*paid/i.test(v)) { console.log(`❌ ${loc[0]}.${k} 又把「改尺寸」講成付費功能：${v}`); bad++; }
  }
  // 免費款描述要把「免費 / free」放在前 40 字（Google 截斷前）
  const d: string = m.descriptionTemplateFree ?? "";
  const body = d.replace("{description}。", "").replace("{description}. ", "");
  const idx = loc[0] === "zh" ? body.indexOf("免費") : body.toLowerCase().indexOf("free");
  if (idx < 0 || idx > 40) { console.log(`❌ ${loc[0]} 免費款描述的「免費」在第 ${idx} 字，會被截掉`); bad++; }
}

const free = FURNITURE_CATALOG.filter((e) => !isPaidCategory(e.category)).map((e) => e.category);
console.log(`免費款 ${free.length} 款：${free.join(", ")}`);
if (free.sort().join() !== [...FREE_UNLOCKED_CATEGORIES].sort().join()) { console.log("❌ 免費款名單跟 FREE_UNLOCKED_CATEGORIES 不一致"); bad++; }
console.log(`付費款 ${FURNITURE_CATALOG.length - free.length} 款（描述一字不動）`);
console.log(bad === 0 ? "✅ 0 問題" : `❌ ${bad} 問題`);
process.exit(bad === 0 ? 0 : 1);
