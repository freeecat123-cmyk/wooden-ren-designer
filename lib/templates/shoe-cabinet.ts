import type { FurnitureTemplate, OptionSpec } from "@/lib/types";
import { getOption } from "@/lib/types";
import { caseFurniture } from "./_builders/case-furniture";

export const shoeCabinetOptions: OptionSpec[] = [
  { type: "number", key: "shelfCount", label: "層板數（不含頂底）", defaultValue: 4, min: 0, max: 20, step: 1 },
  { type: "number", key: "doorCount", label: "門板數", defaultValue: 2, min: 0, max: 6, step: 1 },
  { type: "number", key: "panelThickness", label: "板材厚 (mm)", defaultValue: 18, min: 9, max: 35, step: 1 },
  { type: "number", key: "legHeight", label: "底座腳高 (mm)", defaultValue: 80, min: 0, max: 400, step: 10, help: "鞋櫃底部通常抬高防潮" },
  { type: "number", key: "legSize", label: "腳粗 (mm)", defaultValue: 35, min: 20, max: 120, step: 5 },
];

export const shoeCabinet: FurnitureTemplate = (input) => {
  const shelfCount = getOption<number>(input, shoeCabinetOptions[0]);
  const doorCount = getOption<number>(input, shoeCabinetOptions[1]);
  const panelThickness = getOption<number>(input, shoeCabinetOptions[2]);
  const legHeight = getOption<number>(input, shoeCabinetOptions[3]);
  const legSize = getOption<number>(input, shoeCabinetOptions[4]);
  return caseFurniture({
    category: "shoe-cabinet",
    nameZh: "鞋櫃",
    length: input.length,
    width: input.width,
    height: input.height,
    material: input.material,
    shelfCount,
    doorCount,
    doorType: "wood",
    panelThickness,
    shelfThickness: panelThickness,
    backThickness: 6,
    legHeight,
    legSize,
    notes: `${shelfCount} 層層板 + ${doorCount} 扇門${legHeight > 0 ? `；加 ${legHeight}mm 底座腳` : ""}。層板可用層板釘做可調式。`,
  });
};
