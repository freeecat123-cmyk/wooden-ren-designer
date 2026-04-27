import type {
  FurnitureDesign,
  FurnitureTemplate,
  OptionSpec,
} from "@/lib/types";
import { getOption, opt } from "@/lib/types";
import { buildBox } from "./_builders/box-builder";

export const dovetailBoxOptions: OptionSpec[] = [
  { group: "structure", type: "number", key: "wallThickness", label: "壁厚 (mm)", defaultValue: 12, min: 8, max: 25, step: 1, unit: "mm" },
  { group: "structure", type: "number", key: "bottomThickness", label: "底厚 (mm)", defaultValue: 8, min: 5, max: 15, step: 1, unit: "mm" },
  { group: "structure", type: "checkbox", key: "withLid", label: "加蓋", defaultValue: true, help: "上方加滑入式或鉸鏈式蓋板" },
  { group: "structure", type: "select", key: "dovetailStyle", label: "鳩尾樣式", defaultValue: "through", choices: [
    { value: "through", label: "通鳩尾（through dovetail）—— 從外面看到指狀鳩尾紋" },
    { value: "half-blind", label: "半隱鳩尾（half-blind）—— 前面看不到，傳統抽屜做法" },
  ] },
];

/**
 * 鳩尾盒 — 4 壁鳩尾接合 + 槽底（選用蓋）
 * input: outerL × outerW × outerH
 */
export const dovetailBox: FurnitureTemplate = (input): FurnitureDesign => {
  const { length: outerL, width: outerW, height: outerH, material } = input;
  const o = dovetailBoxOptions;
  const wallT = getOption<number>(input, opt(o, "wallThickness"));
  const botT = getOption<number>(input, opt(o, "bottomThickness"));
  const withLid = getOption<boolean>(input, opt(o, "withLid"));
  const dovetailStyle = getOption<string>(input, opt(o, "dovetailStyle"));

  // 蓋板與壁同厚，方便共用同款料
  const lidT = withLid ? wallT : 0;

  const built = buildBox({
    outerL,
    outerW,
    outerH,
    wallT,
    botT,
    lidT,
    material,
    cornerJoinery: "dovetail",
    bottomFit: "grooved",
  });

  // 半隱鳩尾的 mortise 不貫穿
  if (dovetailStyle === "half-blind") {
    for (const p of built.parts) {
      if (p.id === "wall-left" || p.id === "wall-right") {
        for (const m of p.mortises) m.through = false;
      }
    }
  }

  // 重新貼上鳩尾盒的中文零件名（box-builder 預設叫 前壁/後壁/左壁/右壁）
  const nameMap: Record<string, string> = {
    "wall-front": "前壁（鳩尾公）",
    "wall-back": "後壁（鳩尾公）",
    "wall-left": "左壁（鳩尾母）",
    "wall-right": "右壁（鳩尾母）",
  };
  for (const p of built.parts) {
    if (nameMap[p.id]) p.nameZh = nameMap[p.id];
  }

  const design: FurnitureDesign = {
    id: `dovetail-box-${outerL}x${outerW}x${outerH}`,
    category: "dovetail-box",
    nameZh: "鳩尾盒",
    overall: { length: outerL, width: outerW, thickness: outerH },
    parts: built.parts,
    defaultJoinery: "dovetail",
    primaryMaterial: material,
    notes: `鳩尾盒 ${outerL}×${outerW}×${outerH}mm，${dovetailStyle === "through" ? "**通鳩尾**" : "**半隱鳩尾**"}接合。${dovetailStyle === "through" ? "通鳩尾從盒外能看到指狀鳩尾紋路，傳統工藝展示款。" : "半隱鳩尾從正面看不到鳩尾，盒身視覺乾淨——傳統抽屜做法，可同步學會。"}底板槽接 4 壁內側下緣，不上膠（讓底板可熱漲冷縮）。${withLid ? "蓋板可選滑入式（蓋兩側下緣鋸對稱凸條，前後壁內側上緣鋸對應槽，從前面滑入）或鉸鏈式（後壁裝小銅鉸鏈）。" : ""}**鳩尾盒是進階接合的入門練習**——先做這個再做抽屜，所有鳩尾技巧都會了。`,
  };
  if (built.warnings.length) design.warnings = built.warnings;
  return design;
};
