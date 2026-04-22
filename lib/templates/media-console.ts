import type { FurnitureTemplate, OptionSpec } from "@/lib/types";
import { getOption, opt } from "@/lib/types";
import { caseFurniture, type CabinetZone } from "./_builders/case-furniture";

export const mediaConsoleOptions: OptionSpec[] = [
  { group: "top", type: "number", key: "panelThickness", label: "板材厚 (mm)", defaultValue: 18, min: 9, max: 35, step: 1 },
  // 層數模式：1 層 or 2 層
  { group: "top", type: "select", key: "layerMode", label: "層數", defaultValue: "double", choices: [
    { value: "single", label: "1 層（整個內部都一種）" },
    { value: "double", label: "2 層（上層板 + 下抽屜）" },
  ] },
  // 上層（1 層模式 = 整個；2 層模式 = 上面那層）
  { group: "top", type: "select", key: "upperType", label: "上層類型", defaultValue: "shelves", choices: [
    { value: "shelves", label: "開放層板（輸入=層數）" },
    { value: "door", label: "門板（可鎖藏線 / 影音器材）" },
  ] },
  { group: "top", type: "number", key: "upperCount", label: "上層數量（層數 / 門扇）", defaultValue: 2, min: 1, max: 8, step: 1 },
  // 下層抽屜（只在 2 層模式用到）
  { group: "drawer", type: "number", key: "drawerRows", label: "下層抽屜排數", defaultValue: 1, min: 1, max: 3, step: 1 },
  { group: "drawer", type: "number", key: "drawerCols", label: "下層抽屜列數", defaultValue: 2, min: 1, max: 6, step: 1 },
  { group: "drawer", type: "number", key: "drawerHeight", label: "下層抽屜區高 (mm)", defaultValue: 180, min: 80, max: 500, step: 10 },
  // 門的材質（上層選門時才用到）
  { group: "door", type: "select", key: "doorType", label: "門材質", defaultValue: "wood", choices: [
    { value: "wood", label: "木板門" },
    { value: "glass", label: "玻璃門" },
  ] },
  // 腳
  { group: "leg", type: "number", key: "legHeight", label: "底座腳高 (mm)", defaultValue: 120, min: 0, max: 400, step: 10, help: "電視櫃常見 100–150mm 底座" },
  { group: "leg", type: "number", key: "legSize", label: "腳粗 (mm)", defaultValue: 40, min: 20, max: 120, step: 5 },
  { group: "leg", type: "select", key: "legShape", label: "腳樣式", defaultValue: "box", choices: [
    { value: "box", label: "直腳（方料）" },
    { value: "tapered", label: "錐形腳" },
    { value: "bracket", label: "帶托腳牙" },
    { value: "plinth", label: "平台底座" },
    { value: "panel-side", label: "側板延伸落地" },
  ] },
  { group: "leg", type: "number", key: "legInset", label: "腳內縮 (mm)", defaultValue: 0, min: 0, max: 300, step: 5 },
];

/**
 * 電視櫃 / 長型矮櫃（media console）
 * 長 1200–2000，高 450–600，深 400。1 層或 2 層配置。
 */
export const mediaConsole: FurnitureTemplate = (input) => {
  const o = mediaConsoleOptions;
  const panelThickness = getOption<number>(input, opt(o, "panelThickness"));
  const layerMode = getOption<string>(input, opt(o, "layerMode"));
  const upperType = getOption<string>(input, opt(o, "upperType"));
  const upperCount = getOption<number>(input, opt(o, "upperCount"));
  const drawerRows = getOption<number>(input, opt(o, "drawerRows"));
  const drawerCols = getOption<number>(input, opt(o, "drawerCols"));
  const drawerHeight = getOption<number>(input, opt(o, "drawerHeight"));
  const doorType = getOption<string>(input, opt(o, "doorType"));
  const legHeight = getOption<number>(input, opt(o, "legHeight"));
  const legSize = getOption<number>(input, opt(o, "legSize"));
  const legShape = getOption<string>(input, opt(o, "legShape"));
  const legInset = getOption<number>(input, opt(o, "legInset"));

  const innerH = input.height - legHeight - 2 * panelThickness;

  const zones: CabinetZone[] = [];
  let noteParts: string[] = [];
  if (layerMode === "single") {
    if (upperType === "door") {
      zones.push({ type: "door", heightMm: innerH, count: upperCount });
      noteParts.push(`1 層 ${upperCount} 扇${doorType === "glass" ? "玻璃" : "木"}門`);
    } else {
      zones.push({ type: "shelves", heightMm: innerH, count: upperCount });
      noteParts.push(`1 層 ${upperCount} 層開放層板（${Math.max(0, upperCount - 1)} 片內部層板）`);
    }
  } else {
    // 2 層：下抽屜在前（bottom-up 順序），上層在後
    const upperH = Math.max(80, innerH - drawerHeight);
    zones.push({ type: "drawer", heightMm: drawerHeight, count: drawerRows, cols: drawerCols });
    if (upperType === "door") {
      zones.push({ type: "door", heightMm: upperH, count: upperCount });
      noteParts.push(`上層 ${upperCount} 扇${doorType === "glass" ? "玻璃" : "木"}門 ${upperH}mm`);
    } else {
      zones.push({ type: "shelves", heightMm: upperH, count: upperCount });
      noteParts.push(`上層 ${upperCount} 層開放 ${upperH}mm`);
    }
    noteParts.push(`下層 ${drawerRows}×${drawerCols} 抽屜 ${drawerHeight}mm`);
  }

  return caseFurniture({
    category: "media-console",
    nameZh: "電視櫃",
    length: input.length,
    width: input.width,
    height: input.height,
    material: input.material,
    shelfCount: 0,
    zones,
    doorType: doorType === "glass" ? "glass" : "wood",
    panelThickness,
    shelfThickness: panelThickness,
    backThickness: 6,
    legHeight,
    legSize,
    legShape: legShape as "box" | "tapered" | "bracket" | "plinth" | "panel-side",
    legInset,
    notes: `電視櫃：${noteParts.join("；")}。底座腳 ${legHeight}mm（${legShape}）${legInset > 0 ? `，內縮 ${legInset}mm` : ""}。建議預留線孔走線。`,
  });
};
