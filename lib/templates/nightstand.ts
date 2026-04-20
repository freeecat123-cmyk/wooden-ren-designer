import type { FurnitureTemplate, OptionSpec } from "@/lib/types";
import { getOption } from "@/lib/types";
import { caseFurniture } from "./_builders/case-furniture";

export const nightstandOptions: OptionSpec[] = [
  { type: "number", key: "drawerCount", label: "抽屜數", defaultValue: 1, min: 0, max: 4, step: 1 },
  { type: "number", key: "drawerHeight", label: "抽屜區高 (mm)", defaultValue: 180, min: 0, max: 500, step: 10 },
  { type: "number", key: "shelfCount", label: "下方開放層板", defaultValue: 1, min: 0, max: 3, step: 1, help: "抽屜下方開放區的層板數" },
  { type: "number", key: "panelThickness", label: "板材厚 (mm)", defaultValue: 18, min: 9, max: 30, step: 1 },
  { type: "number", key: "legHeight", label: "椅腳高 (mm)", defaultValue: 120, min: 0, max: 300, step: 10 },
  { type: "number", key: "legSize", label: "椅腳粗 (mm)", defaultValue: 35, min: 20, max: 70, step: 1 },
];

/**
 * 床頭櫃（nightstand）
 * 長 400–500、寬 350–400、高 500–650。常見 1 抽屜 + 下方開放層。
 */
export const nightstand: FurnitureTemplate = (input) => {
  const drawerCount = getOption<number>(input, nightstandOptions[0]);
  const drawerHeight = getOption<number>(input, nightstandOptions[1]);
  const shelfCount = getOption<number>(input, nightstandOptions[2]);
  const panelThickness = getOption<number>(input, nightstandOptions[3]);
  const legHeight = getOption<number>(input, nightstandOptions[4]);
  const legSize = getOption<number>(input, nightstandOptions[5]);

  return caseFurniture({
    category: "nightstand",
    nameZh: "床頭櫃",
    length: input.length,
    width: input.width,
    height: input.height,
    material: input.material,
    shelfCount,
    drawerCount,
    drawerCols: 1,
    drawerAreaHeight: drawerHeight,
    doorCount: 0,
    panelThickness,
    shelfThickness: panelThickness,
    backThickness: 6,
    legHeight,
    legSize,
    notes: `床頭櫃：${drawerCount} 抽屜（共 ${drawerHeight}mm 高）+ 下方 ${shelfCount} 層開放區；腳高 ${legHeight}mm。`,
  });
};
