import type { FurnitureTemplate, OptionSpec } from "@/lib/types";
import { getOption } from "@/lib/types";
import { caseFurniture } from "./_builders/case-furniture";

export const displayCabinetOptions: OptionSpec[] = [
  { group: "top", type: "number", key: "shelfCount", label: "層板數（不含頂底）", defaultValue: 3, min: 0, max: 20, step: 1 },
  { group: "door", type: "number", key: "doorCount", label: "門板數", defaultValue: 2, min: 0, max: 6, step: 1 },
  { group: "door", type: "select", key: "doorType", label: "門材質", defaultValue: "glass", choices: [
    { value: "glass", label: "玻璃門（需配 5mm 強化玻璃）" },
    { value: "wood", label: "木鑲板門" },
  ] },
  { group: "top", type: "number", key: "panelThickness", label: "板材厚 (mm)", defaultValue: 20, min: 9, max: 35, step: 1 },
  { group: "leg", type: "number", key: "legHeight", label: "底座腳高 (mm)", defaultValue: 0, min: 0, max: 400, step: 10 },
  { group: "leg", type: "number", key: "legSize", label: "腳粗 (mm)", defaultValue: 35, min: 20, max: 120, step: 5 },
  { group: "leg", type: "select", key: "legShape", label: "腳樣式", defaultValue: "box", choices: [
    { value: "box", label: "直腳（方料）" },
    { value: "tapered", label: "錐形腳" },
    { value: "bracket", label: "帶托腳牙" },
    { value: "plinth", label: "平台底座" },
    { value: "panel-side", label: "側板延伸落地" },
  ] },
  { group: "leg", type: "number", key: "legInset", label: "腳內縮 (mm)", defaultValue: 0, min: 0, max: 300, step: 5 },
];

export const displayCabinet: FurnitureTemplate = (input) => {
  const shelfCount = getOption<number>(input, displayCabinetOptions[0]);
  const doorCount = getOption<number>(input, displayCabinetOptions[1]);
  const doorType = getOption<string>(input, displayCabinetOptions[2]);
  const panelThickness = getOption<number>(input, displayCabinetOptions[3]);
  const legHeight = getOption<number>(input, displayCabinetOptions[4]);
  const legSize = getOption<number>(input, displayCabinetOptions[5]);
  const legShape = getOption<string>(input, displayCabinetOptions[6]);
  const legInset = getOption<number>(input, displayCabinetOptions[7]);
  return caseFurniture({
    category: "display-cabinet",
    nameZh: "玻璃展示櫃",
    length: input.length,
    width: input.width,
    height: input.height,
    material: input.material,
    shelfCount,
    doorCount,
    doorType: doorType === "wood" ? "wood" : "glass",
    panelThickness,
    shelfThickness: panelThickness - 2,
    backThickness: 8,
    legHeight,
    legSize,
    legShape: legShape as "box" | "tapered" | "bracket" | "plinth" | "panel-side",
    legInset,
    notes: `${shelfCount} 層展示空間 + ${doorCount} 扇${doorType === "wood" ? "木" : "玻璃"}門${legInset > 0 ? `；腳內縮 ${legInset}mm` : ""}。${doorType === "glass" ? "玻璃需另裁；建議 5mm 強化玻璃。" : ""}`,
  });
};
