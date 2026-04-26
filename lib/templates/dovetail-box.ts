import type {
  FurnitureDesign,
  FurnitureTemplate,
  OptionSpec,
  Part,
} from "@/lib/types";
import { getOption, opt } from "@/lib/types";

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

  // 壁高 = 整體高 - 底厚 - (有蓋時的)蓋厚
  const lidT = withLid ? wallT : 0;
  const wallH = outerH - botT - lidT;

  const innerL = outerL - 2 * wallT;
  const innerW = outerW - 2 * wallT;

  const bottom: Part = {
    id: "bottom",
    nameZh: "底板",
    material,
    grainDirection: "length",
    visible: { length: outerL - 2 * 4, width: outerW - 2 * 4, thickness: botT },
    origin: { x: 0, y: 0, z: 0 },
    tenons: [],
    mortises: [],
  };

  // 4 壁，全用鳩尾接合
  const longWall = (id: string, nameZh: string, z: number): Part => ({
    id,
    nameZh,
    material,
    grainDirection: "length",
    visible: { length: outerL, width: wallH, thickness: wallT },
    origin: { x: 0, y: botT, z },
    rotation: { x: Math.PI / 2, y: 0, z: 0 },
    tenons: [
      { position: "start", type: "dovetail", length: wallT, width: wallH - 4, thickness: wallT - 2 },
      { position: "end", type: "dovetail", length: wallT, width: wallH - 4, thickness: wallT - 2 },
    ],
    mortises: [],
  });
  const shortWall = (id: string, nameZh: string, x: number): Part => ({
    id,
    nameZh,
    material,
    grainDirection: "length",
    visible: { length: innerW, width: wallH, thickness: wallT },
    origin: { x, y: botT, z: 0 },
    rotation: { x: Math.PI / 2, y: Math.PI / 2, z: 0 },
    tenons: [],
    mortises: [
      { origin: { x: 0, y: 0, z: -innerW / 2 - 1 }, depth: wallT, length: wallH - 4, width: wallT - 2, through: dovetailStyle === "through" },
      { origin: { x: 0, y: 0, z: innerW / 2 + 1 }, depth: wallT, length: wallH - 4, width: wallT - 2, through: dovetailStyle === "through" },
    ],
  });

  const parts: Part[] = [
    bottom,
    longWall("wall-front", "前壁（鳩尾）", -(outerW / 2 - wallT / 2)),
    longWall("wall-back", "後壁（鳩尾）", outerW / 2 - wallT / 2),
    shortWall("wall-left", "左壁（鳩尾母）", -(outerL / 2 - wallT / 2)),
    shortWall("wall-right", "右壁（鳩尾母）", outerL / 2 - wallT / 2),
  ];

  if (withLid) {
    parts.push({
      id: "lid",
      nameZh: "蓋板",
      material,
      grainDirection: "length",
      visible: { length: outerL, width: outerW, thickness: lidT },
      origin: { x: 0, y: outerH - lidT, z: 0 },
      tenons: [],
      mortises: [],
    });
  }

  return {
    id: `dovetail-box-${outerL}x${outerW}x${outerH}`,
    category: "dovetail-box",
    nameZh: "鳩尾盒",
    overall: { length: outerL, width: outerW, thickness: outerH },
    parts,
    defaultJoinery: "dovetail",
    primaryMaterial: material,
    notes: `鳩尾盒 ${outerL}×${outerW}×${outerH}mm，${dovetailStyle === "through" ? "**通鳩尾**" : "**半隱鳩尾**"}接合。${dovetailStyle === "through" ? "通鳩尾從盒外能看到指狀鳩尾紋路，傳統工藝展示款。" : "半隱鳩尾從正面看不到鳩尾，盒身視覺乾淨——傳統抽屜做法，可同步學會。"}底板槽接 4 壁內側下緣，不上膠（讓底板可熱漲冷縮）。${withLid ? "蓋板可選滑入式（蓋兩側下緣鋸對稱凸條，前後壁內側上緣鋸對應槽，從前面滑入）或鉸鏈式（後壁裝小銅鉸鏈）。" : ""}**鳩尾盒是進階接合的入門練習**——先做這個再做抽屜，所有鳩尾技巧都會了。`,
  };
};
