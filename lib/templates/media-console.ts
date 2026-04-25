import type { FurnitureTemplate, OptionSpec } from "@/lib/types";
import { getOption, opt } from "@/lib/types";
import { caseFurniture, type CabinetZone, type CabinetColumn } from "./_builders/case-furniture";
import {
  doorMountLabel,
  doorMountOption,
  drawerSlideOption,
  resolveDoorMount,
  resolveDrawerSlideGap,
} from "./_builders/zone-helpers";

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
  // 橫向 2/3 欄模式：每欄的類型 + 數量 + 寬度
  { group: "col-left", type: "select", key: "leftType", label: "類型", defaultValue: "door", choices: COL_TYPE_CHOICES },
  { group: "col-left", type: "number", key: "leftCount", label: "數量（抽屜排 / 門扇 / 層數）", defaultValue: 1, min: 1, max: 6, step: 1 },
  { group: "col-left", type: "number", key: "leftWidthMm", label: "寬度 (mm)", defaultValue: 400, min: 100, max: 2000, step: 10 },
  { group: "col-mid", type: "select", key: "centerType", label: "類型（3 欄用，寬度自動填滿）", defaultValue: "shelves", choices: COL_TYPE_CHOICES },
  { group: "col-mid", type: "number", key: "centerCount", label: "數量", defaultValue: 2, min: 1, max: 6, step: 1 },
  { group: "col-right", type: "select", key: "rightType", label: "類型", defaultValue: "drawer", choices: COL_TYPE_CHOICES },
  { group: "col-right", type: "number", key: "rightCount", label: "數量（抽屜排 / 門扇 / 層數）", defaultValue: 2, min: 1, max: 6, step: 1 },
  { group: "col-right", type: "number", key: "rightWidthMm", label: "寬度 (mm)", defaultValue: 400, min: 100, max: 2000, step: 10 },
  // 門材質
  { group: "door", type: "select", key: "doorType", label: "門材質", defaultValue: "wood", choices: [
    { value: "wood", label: "木鑲板門（框 + 鑲板）" },
    { value: "glass", label: "玻璃門" },
    { value: "slab", label: "夾板貼皮平板門（裝潢常用）" },
  ] },
  doorMountOption,
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
  drawerSlideOption,
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
  const leftWidthMm = getOption<number>(input, opt(o, "leftWidthMm"));
  const centerType = getOption<string>(input, opt(o, "centerType")) as ColType;
  const centerCount = getOption<number>(input, opt(o, "centerCount"));
  const rightType = getOption<string>(input, opt(o, "rightType")) as ColType;
  const rightCount = getOption<number>(input, opt(o, "rightCount"));
  const rightWidthMm = getOption<number>(input, opt(o, "rightWidthMm"));
  const doorType = getOption<string>(input, opt(o, "doorType"));
  const legHeight = getOption<number>(input, opt(o, "legHeight"));
  const legSize = getOption<number>(input, opt(o, "legSize"));
  const legShape = getOption<string>(input, opt(o, "legShape"));
  const legInset = getOption<number>(input, opt(o, "legInset"));
  const doorMount = resolveDoorMount(input, o);

  const innerH = input.height - legHeight - 2 * panelThickness;

  let zones: CabinetZone[] | undefined;
  let columns: CabinetColumn[] | undefined;
  let noteParts: string[] = [];

  if (layoutMode === "v-1layer") {
    if (upperType === "door") {
      zones = [{ type: "door", heightMm: innerH, count: upperCount }];
      noteParts.push(`1 層 ${upperCount} 扇${doorType === "glass" ? "玻璃" : doorType === "slab" ? "平板" : "木"}門`);
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
    // 2 欄：左欄寬度使用者設定，右欄自動填滿剩餘。
    // 渲染順序反向：先右（渲染在 world -X = 視覺右），後左（world +X = 視覺左）。
    const innerW = input.length - 2 * panelThickness;
    const usableW = innerW - panelThickness;
    const leftFrac = Math.min(0.8, Math.max(0.2, leftWidthMm / usableW));
    const l = toColumn(leftType, leftCount);
    const r = toColumn(rightType, rightCount);
    if (l) l.widthFrac = leftFrac;
    const arr: CabinetColumn[] = [];
    if (r) arr.push({ ...r, labelPrefix: "右" });
    if (l) arr.push({ ...l, labelPrefix: "左" });
    columns = arr;
    const describe = (name: string, t: ColType, n: number) => {
      if (t === "none") return `${name}空區`;
      if (t === "drawer") return `${name} ${n} 抽屜`;
      if (t === "door") return `${name} ${n} 扇${doorType === "glass" ? "玻璃" : doorType === "slab" ? "平板" : "木"}門`;
      return `${name} ${n} 層開放`;
    };
    noteParts.push(`橫向 2 欄：${describe("左", leftType, leftCount)}｜${describe("右", rightType, rightCount)}`);
  } else if (layoutMode === "h-3col") {
    // 3 欄：左、右欄寬度可調，中欄自動填滿。渲染順序反向：右 → 中 → 左
    // 讓 cols[0]（world -X = 視覺右）是 rightType，cols[2]（+X = 視覺左）是 leftType。
    const innerW = input.length - 2 * panelThickness;
    const usableW = innerW - 2 * panelThickness;
    const leftFrac = Math.min(0.45, Math.max(0.1, leftWidthMm / usableW));
    const rightFrac = Math.min(0.45, Math.max(0.1, rightWidthMm / usableW));
    const l = toColumn(leftType, leftCount);
    const cCol = toColumn(centerType, centerCount);
    const r = toColumn(rightType, rightCount);
    if (l) l.widthFrac = leftFrac;
    if (r) r.widthFrac = rightFrac;
    const arr: CabinetColumn[] = [];
    if (r) arr.push({ ...r, labelPrefix: "右" });
    if (cCol) arr.push({ ...cCol, labelPrefix: "中" });
    if (l) arr.push({ ...l, labelPrefix: "左" });
    columns = arr;
    const describe = (name: string, t: ColType, n: number) => {
      if (t === "none") return `${name}空區`;
      if (t === "drawer") return `${name} ${n} 抽屜`;
      if (t === "door") return `${name} ${n} 扇${doorType === "glass" ? "玻璃" : doorType === "slab" ? "平板" : "木"}門`;
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
    doorType: doorType === "glass" ? "glass" : doorType === "slab" ? "slab" : "wood",
    panelThickness,
    shelfThickness: panelThickness,
    backThickness: 6,
    legHeight,
    legSize,
    legShape: legShape as "box" | "tapered" | "bracket" | "plinth" | "panel-side",
    legInset,
    doorMount,
    drawerSlideGap: resolveDrawerSlideGap(input, mediaConsoleOptions),
    notes: `電視櫃：${noteParts.join("；")}。門板：${doorMountLabel(doorMount)}（西德鉸鏈${doorMount === "inset" ? "入柱型" : doorMount === "overlay-3" ? "半蓋" : "全蓋"}）。底座腳 ${legHeight}mm（${legShape}）${legInset > 0 ? `，內縮 ${legInset}mm` : ""}。建議預留線孔走線。`,
  });
};
