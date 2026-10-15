/** 稽核：/raised-floor、/ceiling 的 meta description 數字必須跟程式預設值一致
 *  放進 repo 的位置：scripts/audit-tool-meta.ts（⚠️ 新增 scripts/audit-* 會讓 ship 變 HOLD）*/
import zh from "../messages/zh-TW.json";
import en from "../messages/en.json";
import { DEFAULT_RAISED_FLOOR_INPUT as D } from "../lib/raised-floor/types";

const errs: string[] = [];
const rfZh = (zh as any).engineeringToolPages.raisedFloor.metaDescription as string;
const rfEn = (en as any).engineeringToolPages.raisedFloor.metaDescription as string;
const must = [
  `${D.joistSpacingCm}cm`,
  `${D.subJoistSpacingCm}cm`,
  `${D.mainJoist.widthMm}×${D.mainJoist.thicknessMm}mm`,
  `${D.subJoist.widthMm}×${D.subJoist.thicknessMm}mm`,
  `${D.plywood.thicknessMm}mm`,
  `${D.heightCm}cm`,
];
for (const m of must) {
  if (!rfZh.includes(m)) errs.push(`zh raisedFloor 描述缺「${m}」`);
  if (!rfEn.includes(m)) errs.push(`en raisedFloor 描述缺「${m}」`);
}
if (rfZh.indexOf("間距") > 20) errs.push(`zh raisedFloor「間距」落在第 ${rfZh.indexOf("間距")} 字，太後面`);
const ceZh = (zh as any).engineeringToolPages.ceiling.metaDescription as string;
for (const w of ["間距", "距離"]) if (!ceZh.includes(w)) errs.push(`zh ceiling 描述缺「${w}」`);
const terms = (zh as any).terms.sec4Li1 as string;
if (/；改尺寸與列印工程包需付費方案/.test(terms)) errs.push("terms sec4Li1 仍把三款免費範本的改尺寸講成付費");
if (!terms.includes("其餘範本")) errs.push("terms sec4Li1 沒講清楚是「其餘範本」才要付費");

if (errs.length) { errs.forEach((e) => console.error("❌ " + e)); process.exit(1); }
console.log("✅ meta 數字與程式預設值一致，條款敘述與實測行為一致");
