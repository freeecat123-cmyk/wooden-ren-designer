import type { FurnitureTemplate, OptionSpec } from "@/lib/types";
import { getOption, opt } from "@/lib/types";
import { caseFurniture, type CabinetZone, type CabinetColumn } from "./_builders/case-furniture";

const COL_TYPE_CHOICES = [
  { value: "none", label: "不設（空區）" },
  { value: "drawer", label: "抽屜" },
  { value: "door", label: "門板" },
  { value: "shelves", label: "開放層板（輸入=層數）" },
];

export const mediaConsoleOptions: OptionSpec[] = [
  { group: "top", type: "number", key: "panelThickness", label: "板材厚 (mm)", defaultValue: 18, min: 9, max: 35, step: 1 },
  // 佈局模式
  { group: "top", type: "select", key: "layoutMode", label: "佈局模式", defaultValue: "v-2layer", choices: [
    { value: "v-1layer", label: "縱向 1 層（整個一種）" },
    { value: "v-2layer", label: "縱向 2 層（上層板 + 下抽屜）" },
    { value: "h-2col", label: "橫向 2 欄（左右各一種）" },
    { value: "h-3col", label: "橫向 3 欄（左中右各一種）" },
  ] },
  // 縱向模式的類型
  { group: "top", type: "select", key: "upperType", label: "縱向 1 層類型 / 2 層的上層類型", defaultValue: "shelves", choices: [
    { value: "shelves", label: "開放層板（輸入=層數）" },
    { value: "door", label: "門板" },
  ] },
  { group: "top", type: "number", key: "upperCount", label: "上層數量（層數 / 門扇）", defaultValue: 2, min: 1, max: 8, step: 1 },
  // 縱向 2 層的抽屜
  { group: "drawer", type: "number", key: "drawerRows", label: "下層抽屜排數", defaultValue: 1, min: 1, max: 3, step: 1 },
  { group: "drawer", type: "number", key: "drawerCols", label: "下層抽屜列數", defaultValue: 2, min: 1, max: 6, step: 1 },
  { group: "drawer", type: "number", key: "drawerHeight", label: "下層抽屜區高 (mm)", defaultValue: 180, min: 80, max: 500, step: 10 },
  // 橫向 2/3 欄模式：每欄的類型 + 數量
  { group: "top", type: "select", key: "leftType", label: "左欄類型", defaultValue: "door", choices: COL_TYPE_CHOICES },
  { group: "top", type: "number", key: "leftCount", label: "左欄數量（抽屜排 / 門扇 / 層數）", defaultValue: 1, min: 1, max: 6, step: 1 },
  { group: "top", type: "select", key: "centerType", label: "中欄類型（3 欄用）", defaultValue: "shelves", choices: COL_TYPE_CHOICES },
  { group: "top", type: "number", key: "centerCount", label: "中欄數量", defaultValue: 2, min: 1, max: 6, step: 1 },
  { group: "top", type: "select", key: "rightType", label: "右欄類型", defaultValue: "drawer", choices: COL_TYPE_CHOICES },
  { group: "top", type: "number", key: "rightCount", label: "右欄數量", defaultValue: 2, min: 1, max: 6, step: 1 },
  // 門材質
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

type ColType = "none" | "drawer" | "door" | "shelves";

const toColumn = (t: ColType, count: number): CabinetColumn | null => {
  if (t === "none") return { type: "open", count: 0 };
  if (t === "drawer") return { type: "drawer", count, cols: 1 };
  if (t === "door") return { type: "door", count };
  if (t === "shelves") return { type: "shelves", count };
  return null;
};

/**
 * 電視櫃（media console）— 縱向 1/2 層或橫向 2/3 欄分區。
 */
export const mediaConsole: FurnitureTemplate = (input) => {
  const o = mediaConsoleOptions;
  const panelThickness = getOption<number>(input, opt(o, "panelThickness"));
  const layoutMode = getOption<string>(input, opt(o, "layoutMode"));
  const upperType = getOption<string>(input, opt(o, "upperType"));
  const upperCount = getOption<number>(input, opt(o, "upperCount"));
  const drawerRows = getOption<number>(input, opt(o, "drawerRows"));
  const drawerCols = getOption<number>(input, opt(o, "drawerCols"));
  const drawerHeight = getOption<number>(input, opt(o, "drawerHeight"));
  const leftType = getOption<string>(input, opt(o, "leftType")) as ColType;
  const leftCount = getOption<number>(input, opt(o, "leftCount"));
  const centerType = getOption<string>(input, opt(o, "centerType")) as ColType;
  const centerCount = getOption<number>(input, opt(o, "centerCount"));
  const rightType = getOption<string>(input, opt(o, "rightType")) as ColType;
  const rightCount = getOption<number>(input, opt(o, "rightCount"));
  const doorType = getOption<string>(input, opt(o, "doorType"));
  const legHeight = getOption<number>(input, opt(o, "legHeight"));
  const legSize = getOption<number>(input, opt(o, "legSize"));
  const legShape = getOption<string>(input, opt(o, "legShape"));
  const legInset = getOption<number>(input, opt(o, "legInset"));

  const innerH = input.height - legHeight - 2 * panelThickness;

  let zones: CabinetZone[] | undefined;
  let columns: CabinetColumn[] | undefined;
  let noteParts: string[] = [];

  if (layoutMode === "v-1layer") {
    if (upperType === "door") {
      zones = [{ type: "door", heightMm: innerH, count: upperCount }];
      noteParts.push(`1 層 ${upperCount} 扇${doorType === "glass" ? "玻璃" : "木"}門`);
    } else {
      zones = [{ type: "shelves", heightMm: innerH, count: upperCount }];
      noteParts.push(`1 層 ${upperCount} 層開放`);
    }
  } else if (layoutMode === "v-2layer") {
    const upperH = Math.max(80, innerH - drawerHeight);
    zones = [
      { type: "drawer", heightMm: drawerHeight, count: drawerRows, cols: drawerCols },
      upperType === "door"
        ? { type: "door", heightMm: upperH, count: upperCount }
        : { type: "shelves", heightMm: upperH, count: upperCount },
    ];
    noteParts.push(`上層 ${upperType === "door" ? `${upperCount} 扇門` : `${upperCount} 層開放`} ${upperH}mm`);
    noteParts.push(`下層 ${drawerRows}×${drawerCols} 抽屜 ${drawerHeight}mm`);
  } else if (layoutMode === "h-2col") {
    const l = toColumn(leftType, leftCount);
    const r = toColumn(rightType, rightCount);
    columns = [l, r].filter((c): c is CabinetColumn => c !== null).map((c, i) => ({ ...c, labelPrefix: i === 0 ? "左" : "右" }));
    const describe = (name: string, t: ColType, n: number) => {
      if (t === "none") return `${name}空區`;
      if (t === "drawer") return `${name} ${n} 抽屜`;
      if (t === "door") return `${name} ${n} 扇${doorType === "glass" ? "玻璃" : "木"}門`;
      return `${name} ${n} 層開放`;
    };
    noteParts.push(`橫向 2 欄：${describe("左", leftType, leftCount)}｜${describe("右", rightType, rightCount)}`);
  } else if (layoutMode === "h-3col") {
    const l = toColumn(leftType, leftCount);
    const c = toColumn(centerType, centerCount);
    const r = toColumn(rightType, rightCount);
    columns = [l, c, r]
      .filter((x): x is CabinetColumn => x !== null)
      .map((x, i) => ({ ...x, labelPrefix: i === 0 ? "左" : i === 1 ? "中" : "右" }));
    const describe = (name: string, t: ColType, n: number) => {
      if (t === "none") return `${name}空區`;
      if (t === "drawer") return `${name} ${n} 抽屜`;
      if (t === "door") return `${name} ${n} 扇${doorType === "glass" ? "玻璃" : "木"}門`;
      return `${name} ${n} 層開放`;
    };
    noteParts.push(`橫向 3 欄：${describe("左", leftType, leftCount)}｜${describe("中", centerType, centerCount)}｜${describe("右", rightType, rightCount)}`);
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
    columns,
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
