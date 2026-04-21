import type { FurnitureTemplate, OptionSpec } from "@/lib/types";
import { getOption } from "@/lib/types";
import { caseFurniture } from "./_builders/case-furniture";

export const nightstandOptions: OptionSpec[] = [
  { group: "drawer", type: "number", key: "drawerCount", label: "抽屜排數", defaultValue: 1, min: 0, max: 4, step: 1 },
  { group: "drawer", type: "number", key: "drawerCols", label: "抽屜列數（左右）", defaultValue: 1, min: 1, max: 3, step: 1 },
  { group: "drawer", type: "number", key: "drawerHeight", label: "抽屜區高 (mm)", defaultValue: 180, min: 0, max: 500, step: 10 },
  { group: "top", type: "number", key: "shelfCount", label: "下方開放層板", defaultValue: 1, min: 0, max: 3, step: 1, help: "抽屜下方開放區的層板數" },
  { group: "top", type: "number", key: "panelThickness", label: "板材厚 (mm)", defaultValue: 18, min: 9, max: 30, step: 1 },
  { group: "leg", type: "number", key: "legHeight", label: "椅腳高 (mm)", defaultValue: 120, min: 0, max: 300, step: 10 },
  { group: "leg", type: "number", key: "legSize", label: "椅腳粗 (mm)", defaultValue: 35, min: 20, max: 70, step: 1 },
  { group: "leg", type: "select", key: "legShape", label: "腳樣式", defaultValue: "tapered", choices: [
    { value: "box", label: "直腳" },
    { value: "tapered", label: "錐形腳" },
    { value: "bracket", label: "帶托腳牙" },
  ] },
  { group: "leg", type: "number", key: "legInset", label: "腳內縮 (mm)", defaultValue: 0, min: 0, max: 150, step: 5 },
];

/**
 * 床頭櫃（nightstand）
 * 長 400–500、寬 350–400、高 500–650。常見 1 抽屜 + 下方開放層。
 */
export const nightstand: FurnitureTemplate = (input) => {
  const drawerCount = getOption<number>(input, nightstandOptions[0]);
  const drawerCols = getOption<number>(input, nightstandOptions[1]);
  const drawerHeight = getOption<number>(input, nightstandOptions[2]);
  const shelfCount = getOption<number>(input, nightstandOptions[3]);
  const panelThickness = getOption<number>(input, nightstandOptions[4]);
  const legHeight = getOption<number>(input, nightstandOptions[5]);
  const legSize = getOption<number>(input, nightstandOptions[6]);
  const legShape = getOption<string>(input, nightstandOptions[7]);
  const legInset = getOption<number>(input, nightstandOptions[8]);

  return caseFurniture({
    category: "nightstand",
    nameZh: "床頭櫃",
    length: input.length,
    width: input.width,
    height: input.height,
    material: input.material,
    shelfCount,
    drawerCount,
    drawerCols,
    drawerAreaHeight: drawerHeight,
    doorCount: 0,
    panelThickness,
    shelfThickness: panelThickness,
    backThickness: 6,
    legHeight,
    legSize,
    legShape: legShape as "box" | "tapered" | "bracket" | "plinth" | "panel-side",
    legInset,
    notes: `床頭櫃：${drawerCount} 排 × ${drawerCols} 列抽屜（共 ${drawerHeight}mm 高）+ 下方 ${shelfCount} 層開放區；腳高 ${legHeight}mm（${legShape}）${legInset > 0 ? `，內縮 ${legInset}mm` : ""}。`,
  });
};
