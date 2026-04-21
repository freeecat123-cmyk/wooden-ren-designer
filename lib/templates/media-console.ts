import type { FurnitureTemplate, OptionSpec } from "@/lib/types";
import { getOption } from "@/lib/types";
import { caseFurniture } from "./_builders/case-furniture";

export const mediaConsoleOptions: OptionSpec[] = [
  { group: "door", type: "number", key: "doorCount", label: "櫃門數", defaultValue: 2, min: 0, max: 6, step: 1 },
  { group: "drawer", type: "number", key: "drawerRows", label: "抽屜排數（上下）", defaultValue: 1, min: 0, max: 3, step: 1 },
  { group: "drawer", type: "number", key: "drawerCols", label: "抽屜列數（左右）", defaultValue: 2, min: 1, max: 6, step: 1 },
  { group: "drawer", type: "number", key: "drawerHeight", label: "抽屜區高 (mm)", defaultValue: 150, min: 0, max: 500, step: 10 },
  { group: "top", type: "number", key: "shelfCount", label: "內部隔板數", defaultValue: 1, min: 0, max: 5, step: 1, help: "櫃門後方的中層隔板" },
  { group: "top", type: "number", key: "panelThickness", label: "板材厚 (mm)", defaultValue: 18, min: 9, max: 35, step: 1 },
  { group: "leg", type: "number", key: "legHeight", label: "底座腳高 (mm)", defaultValue: 120, min: 0, max: 400, step: 10, help: "電視櫃常見 100–150mm 底座" },
  { group: "leg", type: "number", key: "legSize", label: "腳粗 (mm)", defaultValue: 40, min: 20, max: 120, step: 5 },
  { group: "leg", type: "select", key: "legShape", label: "腳樣式", defaultValue: "box", choices: [
    { value: "box", label: "直腳（方料）" },
    { value: "tapered", label: "錐形腳" },
    { value: "bracket", label: "帶托腳牙" },
    { value: "plinth", label: "平台底座" },
    { value: "panel-side", label: "側板延伸落地" },
  ] },
  { group: "door", type: "select", key: "doorType", label: "門板類型", defaultValue: "wood", choices: [
    { value: "wood", label: "木板門" },
    { value: "glass", label: "玻璃門" },
  ] },
  { group: "leg", type: "number", key: "legInset", label: "腳內縮 (mm)", defaultValue: 0, min: 0, max: 300, step: 5 },
];

/**
 * 電視櫃 / 長型矮櫃（media console）
 * 長 1200–2000，高 450–600，深 400。頂排可加抽屜，下排櫃門+層板。
 */
export const mediaConsole: FurnitureTemplate = (input) => {
  const doorCount = getOption<number>(input, mediaConsoleOptions[0]);
  const drawerRows = getOption<number>(input, mediaConsoleOptions[1]);
  const drawerCols = getOption<number>(input, mediaConsoleOptions[2]);
  const drawerHeight = getOption<number>(input, mediaConsoleOptions[3]);
  const shelfCount = getOption<number>(input, mediaConsoleOptions[4]);
  const panelThickness = getOption<number>(input, mediaConsoleOptions[5]);
  const legHeight = getOption<number>(input, mediaConsoleOptions[6]);
  const legSize = getOption<number>(input, mediaConsoleOptions[7]);
  const legShape = getOption<string>(input, mediaConsoleOptions[8]);
  const doorType = getOption<string>(input, mediaConsoleOptions[9]);
  const legInset = getOption<number>(input, mediaConsoleOptions[10]);

  return caseFurniture({
    category: "media-console",
    nameZh: "電視櫃",
    length: input.length,
    width: input.width,
    height: input.height,
    material: input.material,
    shelfCount,
    drawerCount: drawerRows,
    drawerCols,
    drawerAreaHeight: drawerHeight,
    doorCount,
    doorType: doorType === "glass" ? "glass" : "wood",
    panelThickness,
    shelfThickness: panelThickness,
    backThickness: 6,
    legHeight,
    legSize,
    legShape: legShape as "box" | "tapered" | "bracket" | "plinth" | "panel-side",
    legInset,
    notes: `電視櫃：${doorCount} 扇${doorType === "glass" ? "玻璃" : "木"}門、${drawerRows} 排 × ${drawerCols} 列（共 ${drawerRows * drawerCols}）抽屜、內部 ${shelfCount} 層板。底座腳 ${legHeight}mm（${legShape}）${legInset > 0 ? `，內縮 ${legInset}mm` : ""}。建議預留線孔走線。`,
  });
};
