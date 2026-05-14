import type { FurnitureTemplate, OptionSpec } from "@/lib/types";
import { getOption, opt } from "@/lib/types";
import { caseFurniture, type CabinetZone, type CabinetColumn } from "./_builders/case-furniture";
import {
  backModeOption,
  doorMountLabel,
  ANY_ZONE_IS_DOOR,
  doorMountOption,
  doorFrameRailWidthOption,
  doorFrameThicknessOption,
  drawerBottomModeOption,
  drawerMountOption,
  drawerSlideOption,
  resolveBackMode,
  resolveDoorMount,
  resolveDrawerBottomMode,
  resolveDrawerMount,
  resolveDrawerSlideGap,
} from "./_builders/zone-helpers";
import { applyStandardChecks, validateCabinetStructure, appendWarnings, appendSuggestion } from "./_validators";
import {
  toeKickOptions,
  toeKickNote,
  crownMoldingOptions,
  crownMoldingNote,
  backPanelMaterialOption,
  backPanelMaterialNote,
  pullStyleOption,
  pullStyleNote,
  doorPullStyleOption,
} from "./_helpers";

const COL_TYPE_CHOICES = [
  { value: "none", label: "不設（空區）" },
  { value: "drawer", label: "抽屜" },
  { value: "door", label: "門板" },
  { value: "shelves", label: "開放層板（輸入=層數）" },
];

export const mediaConsoleOptions: OptionSpec[] = [
  { group: "structure", type: "number", key: "panelThickness", label: "板材厚 (mm)", defaultValue: 18, min: 9, max: 35, step: 1 },
  // 佈局模式
  { group: "structure", type: "select", key: "layoutMode", label: "佈局模式", defaultValue: "v-2layer", choices: [
    { value: "v-1layer", label: "縱向 1 層（整個一種）" },
    { value: "v-2layer", label: "縱向 2 層（上層板 + 下抽屜）" },
    { value: "h-2col", label: "橫向 2 欄（左右各一種）" },
    { value: "h-3col", label: "橫向 3 欄（左中右各一種）" },
  ] },
  // 縱向模式：上層內容（zone-top）—— 只在縱向 1/2 層用到
  { group: "zone-top", type: "select", key: "upperType", label: "上層類型（縱向 1 / 2 層）", defaultValue: "shelves", choices: [
    { value: "shelves", label: "開放層板（輸入=層數）" },
    { value: "door", label: "門板" },
  ], dependsOn: { key: "layoutMode", oneOf: ["v-1layer", "v-2layer"] } },
  { group: "zone-top", type: "number", key: "upperCount", label: "上層數量（層數 / 門扇）", defaultValue: 2, min: 1, max: 8, step: 1, dependsOn: { key: "layoutMode", oneOf: ["v-1layer", "v-2layer"] } },
  // 縱向 1 層：橫向分欄（每欄同 upperType）。要不同類型請用 h-2col / h-3col。
  { group: "zone-top", type: "select", key: "singleLayerCols", label: "橫向分欄（上層用）", defaultValue: "1", choices: [
    { value: "1", label: "不分欄（整層連通）" },
    { value: "2", label: "2 欄（中間 1 片直立分隔）" },
    { value: "3", label: "3 欄（2 片直立分隔）" },
  ], help: "縱向 1 層 = 整片分欄、可指定左右欄寬；縱向 2 層 = 上層分欄（均分）。要不同類型請改用橫向 2/3 欄模式。", dependsOn: { key: "layoutMode", oneOf: ["v-1layer", "v-2layer"] } },
  { group: "zone-top", type: "number", key: "singleLayerLeftWidthMm", label: "左欄寬度 (mm)", defaultValue: 400, min: 100, max: 2000, step: 10, help: "右/中欄自動填滿剩餘", dependsOn: { all: [{ key: "singleLayerCols", oneOf: ["2", "3"] }, { key: "layoutMode", oneOf: ["v-1layer", "v-2layer"] }] } },
  { group: "zone-top", type: "number", key: "singleLayerRightWidthMm", label: "右欄寬度 (mm)", defaultValue: 400, min: 100, max: 2000, step: 10, help: "中欄自動填滿剩餘", dependsOn: { all: [{ key: "singleLayerCols", equals: "3" }, { key: "layoutMode", oneOf: ["v-1layer", "v-2layer"] }] } },
  // 縱向 2 層：下層抽屜（zone-bot）—— 只在 v-2layer
  { group: "zone-bot", type: "number", key: "drawerRows", label: "下層抽屜排數", defaultValue: 1, min: 1, max: 3, step: 1, dependsOn: { key: "layoutMode", equals: "v-2layer" } },
  { group: "zone-bot", type: "number", key: "drawerCols", label: "下層抽屜列數", defaultValue: 2, min: 1, max: 6, step: 1, dependsOn: { key: "layoutMode", equals: "v-2layer" } },
  { group: "zone-bot", type: "number", key: "drawerHeight", label: "下層抽屜區高 (mm)", defaultValue: 180, min: 80, max: 500, step: 10, dependsOn: { key: "layoutMode", equals: "v-2layer" } },
  { group: "zone-bot", type: "select", key: "drawerRowRatio", label: "抽屜分區比例（排數 ≥ 2 才生效）", defaultValue: "equal", choices: [
    { value: "equal", label: "均分（預設）" },
    { value: "shallow-deep", label: "上淺下深 2:3（淺抽放遙控器、深抽放線材）" },
    { value: "deep-shallow", label: "上深下淺 3:2" },
    { value: "shallow-mid-deep", label: "淺-中-深 2:3:4（3 排專用）" },
  ], help: "rows=2 時用 2:3 / 3:2；rows=3 時用 2:3:4。rows=1 時忽略。", dependsOn: { key: "layoutMode", equals: "v-2layer" } },
  // 橫向 2/3 欄模式：每欄的類型 + 數量 + 寬度
  { group: "col-left", type: "select", key: "leftType", label: "類型", defaultValue: "door", choices: COL_TYPE_CHOICES, dependsOn: { key: "layoutMode", oneOf: ["h-2col", "h-3col"] } },
  { group: "col-left", type: "number", key: "leftCount", label: "數量（抽屜排 / 門扇 / 層數）", defaultValue: 1, min: 1, max: 6, step: 1, dependsOn: { key: "layoutMode", oneOf: ["h-2col", "h-3col"] } },
  { group: "col-left", type: "number", key: "leftWidthMm", label: "寬度 (mm)", defaultValue: 400, min: 100, max: 2000, step: 10, dependsOn: { key: "layoutMode", oneOf: ["h-2col", "h-3col"] } },
  // 中欄只 3 欄用
  { group: "col-mid", type: "select", key: "centerType", label: "類型（3 欄用，寬度自動填滿）", defaultValue: "shelves", choices: COL_TYPE_CHOICES, dependsOn: { key: "layoutMode", equals: "h-3col" } },
  { group: "col-mid", type: "number", key: "centerCount", label: "數量", defaultValue: 2, min: 1, max: 6, step: 1, dependsOn: { key: "layoutMode", equals: "h-3col" } },
  { group: "col-right", type: "select", key: "rightType", label: "類型", defaultValue: "drawer", choices: COL_TYPE_CHOICES, dependsOn: { key: "layoutMode", oneOf: ["h-2col", "h-3col"] } },
  { group: "col-right", type: "number", key: "rightCount", label: "數量（抽屜排 / 門扇 / 層數）", defaultValue: 2, min: 1, max: 6, step: 1, dependsOn: { key: "layoutMode", oneOf: ["h-2col", "h-3col"] } },
  { group: "col-right", type: "number", key: "rightWidthMm", label: "寬度 (mm)", defaultValue: 400, min: 100, max: 2000, step: 10, dependsOn: { key: "layoutMode", oneOf: ["h-2col", "h-3col"] } },
  // 門材質
  { group: "door", type: "select", key: "doorType", label: "門材質", defaultValue: "wood", choices: [
    { value: "wood", label: "木鑲板門（框 + 鑲板）" },
    { value: "glass", label: "玻璃門" },
    { value: "slab", label: "夾板貼皮平板門（裝潢常用）" },
  ], dependsOn: ANY_ZONE_IS_DOOR },
  doorMountOption,
  doorFrameRailWidthOption,
  doorFrameThicknessOption,
  drawerMountOption,
  drawerBottomModeOption,
  backModeOption,
  // 腳
  { group: "leg", type: "number", key: "legHeight", label: "底座腳高 (mm)", defaultValue: 120, min: 0, max: 400, step: 10, help: "電視櫃常見 100–150mm 底座" },
  { group: "leg", type: "number", key: "legSize", label: "腳粗 (mm)", defaultValue: 40, min: 20, max: 120, step: 5, dependsOn: { key: "legHeight", notIn: [0] } },
  { group: "leg", type: "select", key: "legShape", label: "腳樣式", defaultValue: "box", choices: [
    { value: "box", label: "直腳（方料）" },
    { value: "tapered", label: "錐形腳（方料）" },
    { value: "round", label: "圓柱腳" },
    { value: "round-tapered", label: "圓錐腳" },
    { value: "bracket", label: "帶托腳牙" },
    { value: "plinth", label: "平台底座" },
    { value: "panel-side", label: "側板延伸落地" },
  ] , dependsOn: { key: "legHeight", notIn: [0] } },
  { group: "leg", type: "number", key: "legInset", label: "腳內縮 (mm)", defaultValue: 0, min: 0, max: 300, step: 5, dependsOn: { key: "legHeight", notIn: [0] } },
  drawerSlideOption,
  ...toeKickOptions("structure"),
  ...crownMoldingOptions("structure"),
  backPanelMaterialOption("structure"),
  pullStyleOption("door"),
  doorPullStyleOption("door"),
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
  const singleLayerColsRaw = getOption<string>(input, opt(o, "singleLayerCols"));
  const singleLayerCols = Math.max(1, Math.min(3, parseInt(String(singleLayerColsRaw ?? "1"), 10) || 1));
  const singleLayerLeftWidthMm = getOption<number>(input, opt(o, "singleLayerLeftWidthMm"));
  const singleLayerRightWidthMm = getOption<number>(input, opt(o, "singleLayerRightWidthMm"));
  const drawerRows = getOption<number>(input, opt(o, "drawerRows"));
  const drawerCols = getOption<number>(input, opt(o, "drawerCols"));
  const drawerHeight = getOption<number>(input, opt(o, "drawerHeight"));
  const drawerRowRatio = getOption<string>(input, opt(o, "drawerRowRatio"));
  // 將 ratio 字串 + drawerRows 轉成 fraction 陣列；長度不符走 undefined（drawer-row 會 fallback 均分）
  const drawerRowHeights: number[] | undefined = (() => {
    if (drawerRows < 2) return undefined;
    // rowHeights[0] = 最底排；label 用「上→下」描述，所以這裡反向寫
    if (drawerRowRatio === "shallow-deep" && drawerRows === 2) return [3 / 5, 2 / 5]; // 上淺(2) 下深(3)
    if (drawerRowRatio === "deep-shallow" && drawerRows === 2) return [2 / 5, 3 / 5]; // 上深(3) 下淺(2)
    if (drawerRowRatio === "shallow-mid-deep" && drawerRows === 3) return [4 / 9, 3 / 9, 2 / 9]; // 上淺-中-下深
    return undefined;
  })();
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
  const drawerMount = resolveDrawerMount(input, o);
  const withToeKick = getOption<boolean>(input, opt(o, "withToeKick"));
  const toeKickHeight = getOption<number>(input, opt(o, "toeKickHeight"));
  const toeKickRecess = getOption<number>(input, opt(o, "toeKickRecess"));
  const withCrownMolding = getOption<boolean>(input, opt(o, "withCrownMolding"));
  const crownProjection = getOption<number>(input, opt(o, "crownProjection"));
  const backPanelMaterial = getOption<string>(input, opt(o, "backPanelMaterial"));
  const pullStyle = getOption<string>(input, opt(o, "pullStyle"));
  const doorPullStyleRaw = getOption<string>(input, opt(o, "doorPullStyle"));
  const doorPullStyle = !doorPullStyleRaw || doorPullStyleRaw === "inherit" ? pullStyle : doorPullStyleRaw;

  const innerH = input.height - legHeight - 2 * panelThickness;

  let zones: CabinetZone[] | undefined;
  let columns: CabinetColumn[] | undefined;
  let noteParts: string[] = [];

  if (layoutMode === "v-1layer") {
    if (singleLayerCols >= 2) {
      // 縱向 1 層 + 橫向分欄：可指定左/右欄寬度，其他欄自動填滿
      const colSpec = (): CabinetColumn => upperType === "door"
        ? { type: "door", count: upperCount }
        : { type: "shelves", count: upperCount };
      const innerW = input.length - 2 * panelThickness;
      if (singleLayerCols === 2) {
        const usableW = innerW - panelThickness;
        const leftFrac = Math.min(0.8, Math.max(0.2, singleLayerLeftWidthMm / usableW));
        // 反向渲染順序：cols[0]=右(無寬度=填滿)、cols[1]=左(指定寬度)
        const right = { ...colSpec(), labelPrefix: "右" };
        const left: CabinetColumn = { ...colSpec(), widthFrac: leftFrac, labelPrefix: "左" };
        columns = [right, left];
      } else {
        const usableW = innerW - 2 * panelThickness;
        const leftFrac = Math.min(0.45, Math.max(0.1, singleLayerLeftWidthMm / usableW));
        const rightFrac = Math.min(0.45, Math.max(0.1, singleLayerRightWidthMm / usableW));
        const right: CabinetColumn = { ...colSpec(), widthFrac: rightFrac, labelPrefix: "右" };
        const mid = { ...colSpec(), labelPrefix: "中" };
        const left: CabinetColumn = { ...colSpec(), widthFrac: leftFrac, labelPrefix: "左" };
        columns = [right, mid, left];
      }
      const typeText = upperType === "door"
        ? `每欄 ${upperCount} 扇${doorType === "glass" ? "玻璃" : doorType === "slab" ? "平板" : "木"}門`
        : `每欄 ${upperCount} 層開放`;
      const widthsText = singleLayerCols === 2
        ? `左 ${singleLayerLeftWidthMm}mm / 右自動`
        : `左 ${singleLayerLeftWidthMm}mm / 右 ${singleLayerRightWidthMm}mm / 中自動`;
      noteParts.push(`1 層橫向 ${singleLayerCols} 欄（${widthsText}）：${typeText}`);
    } else if (upperType === "door") {
      zones = [{ type: "door", heightMm: innerH, count: upperCount }];
      noteParts.push(`1 層 ${upperCount} 扇${doorType === "glass" ? "玻璃" : doorType === "slab" ? "平板" : "木"}門`);
    } else {
      zones = [{ type: "shelves", heightMm: innerH, count: upperCount }];
      noteParts.push(`1 層 ${upperCount} 層開放`);
    }
  } else if (layoutMode === "v-2layer") {
    const upperH = Math.max(80, innerH - drawerHeight);
    const upperColsN = singleLayerCols >= 2 ? singleLayerCols : 1;
    // 計算上層欄寬比例（門板 / 開放層板共用：扣掉分隔板 panelT 後依使用者左/右欄寬切）
    let upperColWidths: number[] | undefined;
    let upperWidthsText = "";
    if (upperColsN >= 2) {
      const innerWtv = input.length - 2 * panelThickness;
      if (upperColsN === 2) {
        const usableW = innerWtv - panelThickness;
        const leftFrac = Math.min(0.8, Math.max(0.2, singleLayerLeftWidthMm / usableW));
        upperColWidths = [leftFrac, 1 - leftFrac];
        upperWidthsText = `左 ${singleLayerLeftWidthMm}mm / 右自動`;
      } else {
        const usableW = innerWtv - 2 * panelThickness;
        const leftFrac = Math.min(0.45, Math.max(0.1, singleLayerLeftWidthMm / usableW));
        const rightFrac = Math.min(0.45, Math.max(0.1, singleLayerRightWidthMm / usableW));
        upperColWidths = [leftFrac, Math.max(0.1, 1 - leftFrac - rightFrac), rightFrac];
        upperWidthsText = `左 ${singleLayerLeftWidthMm}mm / 中自動 / 右 ${singleLayerRightWidthMm}mm`;
      }
    }
    zones = [
      { type: "drawer", heightMm: drawerHeight, count: drawerRows, cols: drawerCols, rowHeights: drawerRowHeights },
      upperType === "door"
        ? { type: "door", heightMm: upperH, count: upperCount, cols: upperColsN, colWidths: upperColWidths }
        : { type: "shelves", heightMm: upperH, count: upperCount, cols: upperColsN, colWidths: upperColWidths },
    ];
    const upperColsNote = upperColsN >= 2
      ? `（橫向 ${upperColsN} 欄${upperWidthsText ? "，" + upperWidthsText : ""}）`
      : "";
    const upperKindLabel = upperType === "door"
      ? `${upperCount} 扇門 / 欄${upperColsN >= 2 ? "" : ""}`
      : `${upperCount} 層開放`;
    noteParts.push(`上層 ${upperKindLabel}${upperColsNote} ${upperH}mm`);
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

  const design = caseFurniture({
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
    backMode: resolveBackMode(input, mediaConsoleOptions),
    legHeight,
    legSize,
    legShape: legShape as "box" | "tapered" | "bracket" | "plinth" | "panel-side" | "round" | "round-tapered",
    legInset,
    doorMount,
    doorFrameRailWidth: getOption<number>(input, opt(o, "doorFrameRailWidth")),
    doorFrameThickness: getOption<number>(input, opt(o, "doorFrameThickness")),
    drawerMount,
    drawerBottomMode: resolveDrawerBottomMode(input, mediaConsoleOptions),
    drawerSlideGap: resolveDrawerSlideGap(input, mediaConsoleOptions),
    pullStyle,
    doorPullStyle,
    notes: [
      `電視櫃：${noteParts.join("；")}。`,
      `門板：${doorMountLabel(doorMount)}（西德鉸鏈${doorMount === "inset" ? "入柱型" : doorMount === "overlay-3" ? "半蓋" : "全蓋"}）。`,
      `底座腳 ${legHeight}mm（${legShape}）${legInset > 0 ? `，內縮 ${legInset}mm` : ""}。`,
      pullStyleNote(pullStyle),
      toeKickNote(withToeKick, toeKickHeight, toeKickRecess),
      crownMoldingNote(withCrownMolding, crownProjection),
      backPanelMaterialNote(backPanelMaterial),
    ].filter((s) => s && s.trim()).join(" ").trim(),
  });

  applyStandardChecks(design, {
    minLength: 800, minWidth: 300, minHeight: 300,
    maxLength: 3000, maxWidth: 700, maxHeight: 900,
  });
  appendWarnings(
    design,
    validateCabinetStructure({
      panelThickness,
      height: input.height,
      shelfSpan: input.length - 2 * panelThickness,
    }),
  );
  if (input.height > 900 || input.length > 3000) {
    appendSuggestion(design, {
      text: `${input.length}×${input.height}mm 已不算電視矮櫃——展示櫃模板支援更高尺寸。`,
      suggestedCategory: "display-cabinet",
      presetParams: { length: input.length, width: input.width, height: input.height, material: input.material },
    });
  }
  return design;
};
