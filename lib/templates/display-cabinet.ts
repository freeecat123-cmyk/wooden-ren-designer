import type { FurnitureTemplate, OptionSpec } from "@/lib/types";
import { getOption, opt } from "@/lib/types";
import { caseFurniture } from "./_builders/case-furniture";

export const displayCabinetOptions: OptionSpec[] = [
  { group: "top", type: "number", key: "shelfCount", label: "中層層板數", defaultValue: 3, min: 0, max: 20, step: 1 },
  { group: "top", type: "number", key: "panelThickness", label: "板材厚 (mm)", defaultValue: 20, min: 9, max: 35, step: 1 },
  // 上層：抽屜 / 門 / 層板 / 無
  { group: "drawer", type: "select", key: "topZoneType", label: "上層類型", defaultValue: "none", choices: [
    { value: "none", label: "不設上層區（沿用中層層板）" },
    { value: "drawer", label: "上層抽屜" },
  ] },
  { group: "drawer", type: "number", key: "topDrawerRows", label: "上層抽屜排數", defaultValue: 2, min: 1, max: 6, step: 1 },
  { group: "drawer", type: "number", key: "topDrawerCols", label: "上層抽屜列數", defaultValue: 1, min: 1, max: 4, step: 1 },
  { group: "drawer", type: "number", key: "topZoneHeight", label: "上層區高度 (mm)", defaultValue: 300, min: 100, max: 800, step: 10 },
  // 下層：門 / 無
  { group: "door", type: "select", key: "bottomZoneType", label: "下層類型", defaultValue: "door", choices: [
    { value: "none", label: "不設下層門（沿用中層層板）" },
    { value: "door", label: "下層門板" },
  ] },
  { group: "door", type: "number", key: "doorCount", label: "下層門板數", defaultValue: 2, min: 1, max: 6, step: 1 },
  { group: "door", type: "select", key: "doorType", label: "門材質", defaultValue: "glass", choices: [
    { value: "glass", label: "玻璃門（需配 5mm 強化玻璃）" },
    { value: "wood", label: "木鑲板門" },
  ] },
  { group: "door", type: "number", key: "bottomZoneHeight", label: "下層區高度 (mm)", defaultValue: 500, min: 100, max: 1500, step: 10 },
  // 腳
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
  const o = displayCabinetOptions;
  const shelfCount = getOption<number>(input, opt(o, "shelfCount"));
  const panelThickness = getOption<number>(input, opt(o, "panelThickness"));
  const topZoneType = getOption<string>(input, opt(o, "topZoneType"));
  const topDrawerRows = getOption<number>(input, opt(o, "topDrawerRows"));
  const topDrawerCols = getOption<number>(input, opt(o, "topDrawerCols"));
  const topZoneHeight = getOption<number>(input, opt(o, "topZoneHeight"));
  const bottomZoneType = getOption<string>(input, opt(o, "bottomZoneType"));
  const doorCount = getOption<number>(input, opt(o, "doorCount"));
  const doorType = getOption<string>(input, opt(o, "doorType"));
  const bottomZoneHeight = getOption<number>(input, opt(o, "bottomZoneHeight"));
  const legHeight = getOption<number>(input, opt(o, "legHeight"));
  const legSize = getOption<number>(input, opt(o, "legSize"));
  const legShape = getOption<string>(input, opt(o, "legShape"));
  const legInset = getOption<number>(input, opt(o, "legInset"));

  const hasTopDrawers = topZoneType === "drawer";
  const hasBottomDoors = bottomZoneType === "door";

  return caseFurniture({
    category: "display-cabinet",
    nameZh: "玻璃展示櫃",
    length: input.length,
    width: input.width,
    height: input.height,
    material: input.material,
    shelfCount,
    doorCount: hasBottomDoors ? doorCount : 0,
    doorType: doorType === "wood" ? "wood" : "glass",
    doorAreaHeight: hasBottomDoors ? bottomZoneHeight : undefined,
    drawerCount: hasTopDrawers ? topDrawerRows : 0,
    drawerCols: topDrawerCols,
    drawerAreaHeight: hasTopDrawers ? topZoneHeight : undefined,
    drawerAtTop: true,
    panelThickness,
    shelfThickness: panelThickness - 2,
    backThickness: 8,
    legHeight,
    legSize,
    legShape: legShape as "box" | "tapered" | "bracket" | "plinth" | "panel-side",
    legInset,
    notes: `${hasTopDrawers ? `上層 ${topDrawerRows}×${topDrawerCols} 抽屜（${topZoneHeight}mm）；` : ""}中層 ${shelfCount} 層${hasBottomDoors ? `；下層 ${doorCount} 扇${doorType === "wood" ? "木" : "玻璃"}門（${bottomZoneHeight}mm）` : ""}${legInset > 0 ? `；腳內縮 ${legInset}mm` : ""}。`,
  });
};
