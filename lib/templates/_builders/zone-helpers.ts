import type { OptionSpec, FurnitureTemplateInput } from "@/lib/types";
import { getOption, opt } from "@/lib/types";
import type { CabinetZone } from "./case-furniture";

/**
 * 共用選項：抽屜滑軌五金。
 * 三段式滑軌（ball bearing）安裝在櫃體側板 / 中柱與抽屜側板之間，
 * 業界標準左右各需 12.5mm 空隙。使用者勾選後所有抽屜總寬自動縮 25mm。
 */
/** 任一 zone 類型 = drawer 時才顯示（抽屜相關選項共用）。
 *  upperType 是 shoe-cabinet 的「上層」zone key（其他模板沒這 key，eval 時 v=undefined
 *  自然不 match，安全）。
 *  leftType/rightType/centerType 是媒體櫃 h-2col/h-3col 的欄 key。
 *  layoutMode="v-2layer" 是媒體櫃縱向 2 層模式（下層固定是抽屜）。 */
export const ANY_ZONE_IS_DRAWER = {
  any: [
    { key: "topType", equals: "drawer" },
    { key: "midType", equals: "drawer" },
    { key: "bottomType", equals: "drawer" },
    { key: "upperType", equals: "drawer" },
    { key: "leftType", equals: "drawer" },
    { key: "rightType", equals: "drawer" },
    { key: "centerType", equals: "drawer" },
    { key: "layoutMode", equals: "v-2layer" },
  ],
};

/** 任一 zone 類型 = door 時才顯示（門板相關選項共用）。
 *  leftType/rightType/centerType 是媒體櫃 h-2col/h-3col 的欄 key —— 縱向模式時
 *  那三個欄位是隱藏的、但預設值仍可能是 "door"，必須由 layoutMode 把它們排除掉。
 *  shoe-cabinet 的 upperType 沒有 layoutMode key，用 notIn 寬鬆條件讓它通過。 */
export const ANY_ZONE_IS_DOOR = {
  any: [
    { key: "topType", equals: "door" },
    { key: "midType", equals: "door" },
    { key: "bottomType", equals: "door" },
    { all: [{ key: "upperType", equals: "door" }, { key: "layoutMode", notIn: ["h-2col", "h-3col"] }] },
    { all: [{ key: "leftType", equals: "door" }, { key: "layoutMode", oneOf: ["h-2col", "h-3col"] }] },
    { all: [{ key: "rightType", equals: "door" }, { key: "layoutMode", oneOf: ["h-2col", "h-3col"] }] },
    { all: [{ key: "centerType", equals: "door" }, { key: "layoutMode", equals: "h-3col" }] },
  ],
};

export const drawerSlideOption: OptionSpec = {
  group: "drawer",
  type: "checkbox",
  key: "useDrawerSlide",
  label: "三段式滑軌（左右各 12.5mm 五金縫）",
  defaultValue: true,
  wide: true, // 佔整行，full help 攤開放裡面
  help:
    "勾選後：抽屜箱體總寬縮 25mm 留給滑軌五金；" +
    "另加一片「面板」蓋掉左右空隙（面板比抽屜格小 4mm，上下左右各 2mm 縫，與入柱門同規格）；" +
    "箱體（5 件）向後縮 18mm（面板厚）藏在面板後；" +
    "箱體高比抽屜格縮 10mm（上下各 5mm 滑軌行程空隙）；" +
    "箱體距背板留 10mm 防撞。不勾選視為傳統木製側拉 / 無滑軌。",
  dependsOn: ANY_ZONE_IS_DRAWER,
};

export const DRAWER_SLIDE_GAP_MM = 12.5;

export function resolveDrawerSlideGap(
  input: FurnitureTemplateInput,
  options: OptionSpec[],
): number {
  const on = getOption<boolean>(input, opt(options, "useDrawerSlide"));
  return on ? DRAWER_SLIDE_GAP_MM : 0;
}

/**
 * 共用選項：門板安裝方式（裝潢界三種標準作法，皆配西德鉸鏈不同蓋型）。
 * - overlay-6 全蓋（蓋 6 分=18mm，蓋滿框寬，雙門幾乎相觸）：最常見
 * - overlay-3 半蓋（蓋 3 分=9mm，蓋住框邊一半，留小縫看見框）
 * - inset 入柱（門埋進框內、與櫃面齊平，四周留 2mm 縫供開合）
 *   入柱模式會自動把內部層板/抽屜深度縮 23mm（門厚 + 5mm 安全空隙）。
 */
export const doorMountOption: OptionSpec = {
  group: "door",
  type: "select",
  key: "doorMount",
  label: "門板安裝方式",
  defaultValue: "overlay-6",
  choices: [
    { value: "overlay-6", label: "蓋 6 分（全蓋，蓋滿 18mm 框）— 全蓋西德鉸鏈" },
    { value: "overlay-3", label: "蓋 3 分（半蓋，蓋住 9mm 框）— 半蓋西德鉸鏈" },
    { value: "inset", label: "入柱（門埋進框內、齊平櫃面）— 入柱西德鉸鏈" },
  ],
  dependsOn: ANY_ZONE_IS_DOOR,
};

export type DoorMount = "overlay-3" | "overlay-6" | "inset";

export function resolveDoorMount(
  input: FurnitureTemplateInput,
  options: OptionSpec[],
): DoorMount {
  const v = getOption<string>(input, opt(options, "doorMount"));
  return v === "overlay-3" || v === "inset" ? v : "overlay-6";
}

export function doorMountLabel(mount: DoorMount): string {
  return mount === "overlay-6"
    ? "蓋 6 分全蓋"
    : mount === "overlay-3"
      ? "蓋 3 分半蓋"
      : "入柱（齊平）";
}

/**
 * 門框木條寬度 — 上下橫檔 + 左右豎梃同一寬度（傳統明清家具慣例）。
 * 預設 60mm（中小櫃常見），可調 40-100mm 視門大小與風格。
 */
export const doorFrameRailWidthOption: OptionSpec = {
  group: "door",
  type: "number",
  key: "doorFrameRailWidth",
  label: "門框木條寬 (mm)",
  defaultValue: 60,
  min: 30,
  max: 120,
  step: 5,
  unit: "mm",
  help: "上下橫檔 + 左右豎梃的「寬度」。40-50 細框現代風、60 標準、80+ 古典厚重感",
  dependsOn: ANY_ZONE_IS_DOOR,
};

/**
 * 門框木條厚度 — 框料 Z 軸厚度（凸出櫃面深度）。
 * 預設 22mm，可調 15-35mm。薄門配玻璃，厚門配傳統實木鑲板。
 */
export const doorFrameThicknessOption: OptionSpec = {
  group: "door",
  type: "number",
  key: "doorFrameThickness",
  label: "門框木條厚 (mm)",
  defaultValue: 22,
  min: 15,
  max: 35,
  step: 1,
  unit: "mm",
  help: "門框料的厚度（凸出櫃面深度）。15-18 薄門、22 標準、28+ 傳統厚重",
  dependsOn: ANY_ZONE_IS_DOOR,
};

/**
 * 抽屜面板安裝方式（與門板同三模式，獨立設定）。
 * - overlay-6 全蓋：面板蓋滿櫃前框 + 抽屜間中柱（最常見現代裝潢風格）
 * - overlay-3 半蓋：面板蓋住框邊 9mm
 * - inset 入柱：面板埋進開口內、與框齊平（傳統實木家具常見）
 */
export const drawerMountOption: OptionSpec = {
  group: "drawer",
  type: "select",
  key: "drawerMount",
  label: "抽屜面板安裝方式",
  defaultValue: "overlay-6",
  choices: [
    { value: "overlay-6", label: "蓋 6 分（全蓋，面板蓋滿）" },
    { value: "overlay-3", label: "蓋 3 分（半蓋，面板蓋 9mm）" },
    { value: "inset", label: "入柱（面板埋進框內、齊平）" },
  ],
  dependsOn: ANY_ZONE_IS_DRAWER,
};

export function resolveDrawerMount(
  input: FurnitureTemplateInput,
  options: OptionSpec[],
): DoorMount {
  const v = getOption<string>(input, opt(options, "drawerMount"));
  return v === "overlay-3" || v === "inset" ? v : "overlay-6";
}

/**
 * 共用選項：背板作法。
 * - surface（裝潢慣例）：3mm 夾板釘 / 鎖在櫃體背面，尺寸 = 全外長 × 全外高，
 *   蓋過頂底側板背緣。最快、最便宜，但側面看得到背板邊。
 * - rebated（榫卯 / 鄉村風家具標準）：背板嵌進側板內側溝槽，9mm 厚為主。
 *   側面看不到背板邊，結構更挺，但側板要開溝，工序多。
 * 概念上跟抽屜底板（卡進前後左右板的溝裡）相同——薄板靠四周框料的溝固定。
 */
export const backModeOption: OptionSpec = {
  group: "structure",
  type: "select",
  key: "backMode",
  label: "背板作法",
  defaultValue: "surface",
  choices: [
    { value: "surface", label: "釘背（3mm 夾板蓋滿背面）— 裝潢標準" },
    { value: "rebated", label: "入溝（9mm 嵌進側板溝裡）— 榫卯 / 鄉村風家具" },
    { value: "none", label: "無背板（開放式陳列櫃）" },
  ],
};

export type BackMode = "surface" | "rebated" | "none";

export function resolveBackMode(
  input: FurnitureTemplateInput,
  options: OptionSpec[],
): BackMode {
  const v = getOption<string>(input, opt(options, "backMode"));
  return v === "rebated" || v === "none" ? v : "surface";
}

/**
 * 抽屜底板作法（跟櫃體背板同概念，但用在抽屜上）：
 * - surface 釘底：3mm 夾板從下方釘在抽屜箱底，尺寸 = 抽屜外框長 × 外框深，
 *   側板/前後板下緣不開溝。裝潢市場最常見、最快、最便宜。
 * - rebated 入溝：6mm 夾板四邊舌頭嵌進前/後/左/右板下緣的溝裡。
 *   榫卯家具標準作法，無釘無膠靠木工接合，跟櫃體入溝背板同思路。
 * 預設 surface（裝潢慣例）。
 */
export const drawerBottomModeOption: OptionSpec = {
  group: "drawer",
  type: "select",
  key: "drawerBottomMode",
  label: "抽屜底板作法",
  defaultValue: "surface",
  choices: [
    { value: "surface", label: "釘底（3mm 夾板從下釘上）— 裝潢標準" },
    { value: "rebated", label: "入溝（6mm 嵌進四邊溝裡）— 榫卯家具" },
  ],
  dependsOn: ANY_ZONE_IS_DRAWER,
};

export type DrawerBottomMode = "surface" | "rebated";

export function resolveDrawerBottomMode(
  input: FurnitureTemplateInput,
  options: OptionSpec[],
): DrawerBottomMode {
  const v = getOption<string>(input, opt(options, "drawerBottomMode"));
  return v === "rebated" ? "rebated" : "surface";
}

/** 每個 zone 可選的類型 */
export const ZONE_TYPE_CHOICES = [
  { value: "none", label: "不設（空區）" },
  { value: "drawer", label: "抽屜" },
  { value: "door", label: "門板" },
  { value: "shelves", label: "開放層板（輸入=層數）" },
];

/** 衣櫃舊資料相容：保留 type，但 dropdown 不再出現「吊衣空間」獨立選項；
 *  改成在「門板」類型下用 checkbox 開啟「門內加吊衣桿」。 */
export const ZONE_TYPE_CHOICES_WITH_HANGING = ZONE_TYPE_CHOICES;

export type ZoneType = "none" | "drawer" | "door" | "shelves" | "hanging";

export interface ZoneDefaults {
  topType: ZoneType;
  topHeight: number;
  topCount: number;
  topCols?: number;
  midType: ZoneType;
  midCount: number;
  midCols?: number;
  bottomType: ZoneType;
  bottomHeight: number;
  bottomCount: number;
  bottomCols?: number;
}

/**
 * 產生每子欄獨立設定的欄位（Sub2/Sub3/Sub4，依 DoorCols 顯示）。
 * Sub1 走 zone 層級的 DoorShelves / DoorHanging / DoorHangingHeight；
 * 寬度方面 Sub1 自動 = 1 - 其他欄總和。
 */
function makeDoorSubColOptions(
  zonePrefix: "top" | "mid" | "bottom",
  group: "zone-top" | "zone-mid" | "zone-bot",
  allowHanging: boolean,
): OptionSpec[] {
  const typeKey = `${zonePrefix}Type`;
  const colsKey = `${zonePrefix}DoorCols`;
  const specs: OptionSpec[] = [];
  for (let n = 2; n <= 4; n++) {
    const baseDep = { all: [
      { key: typeKey, equals: "door" },
      { key: colsKey, oneOf: [n, n + 1, n + 2].filter((x) => x <= 4) },
    ] };
    specs.push(
      { group, type: "number", key: `${zonePrefix}DoorSub${n}Shelves`, label: `第${n}格 門內層板數`, defaultValue: 0, min: 0, max: 6, step: 1, help: "0=全空", dependsOn: baseDep },
      { group, type: "number", key: `${zonePrefix}DoorSub${n}Drawers`, label: `第${n}格 門內抽屜數`, defaultValue: 0, min: 0, max: 8, step: 1, help: "> 0 時用抽屜取代層板（均分剩餘空間，無水平分隔板）", dependsOn: baseDep },
      { group, type: "number", key: `${zonePrefix}DoorSub${n}DrawerHeight`, label: `第${n}格 每抽屜高度 (mm)`, defaultValue: 100, min: 80, max: 150, step: 5, help: "每個抽屜的高度", dependsOn: { all: [{ key: typeKey, equals: "door" }, { key: `${zonePrefix}DoorSub${n}Drawers`, notIn: [0] }, { key: colsKey, oneOf: [n, n + 1, n + 2].filter((x) => x <= 4) }] } },
    );
    if (allowHanging) {
      specs.push(
        { group, type: "checkbox", key: `${zonePrefix}DoorSub${n}Hanging`, label: `第${n}格 加吊衣桿`, defaultValue: false, wide: true, dependsOn: baseDep },
        { group, type: "number", key: `${zonePrefix}DoorSub${n}HangingHeight`, label: `第${n}格 吊衣空間高度 (mm)`, defaultValue: 1200, min: 200, max: 2200, step: 50, dependsOn: { all: [{ key: typeKey, equals: "door" }, { key: `${zonePrefix}DoorSub${n}Hanging`, equals: true }, { key: colsKey, oneOf: [n, n + 1, n + 2].filter((x) => x <= 4) }] } },
      );
    }
    specs.push(
      { group, type: "number", key: `${zonePrefix}DoorSub${n}WidthMm`, label: `第${n}格 寬度 (mm)`, defaultValue: 0, min: 0, max: 2000, step: 10, help: "0 = 平分剩餘空間；> 0 則用此寬度（其他未指定的子欄會平分剩餘）", dependsOn: baseDep },
    );
  }
  return specs;
}

/**
 * 產生 3-zone 櫃體的標準 option 表單。上/中/下各有 type 選單 + 數量/尺寸。
 * 中層高度自動填滿剩餘空間（= 內高 − 上層 − 下層），不需要使用者輸入。
 */
export function makeZoneOptions(
  defaults: ZoneDefaults,
  allowHanging = false,
  opts: { skipMid?: boolean; autoFillSide?: "top" | "bottom" } = {},
): OptionSpec[] {
  const choices = allowHanging ? ZONE_TYPE_CHOICES_WITH_HANGING : ZONE_TYPE_CHOICES;
  // skipMid 模式下，預設「上層自動填滿」（使用者設下層高度，上層吃剩）
  const autoSide: "top" | "bottom" = opts.skipMid ? (opts.autoFillSide ?? "top") : "bottom";
  const topHeightHelp = opts.skipMid && autoSide === "top" ? "高度自動填滿剩餘空間" : undefined;
  const botHeightHelp = opts.skipMid && autoSide === "bottom" ? "高度自動填滿剩餘空間" : undefined;
  const specs: OptionSpec[] = [
    // 上層
    { group: "zone-top", type: "select", key: "topType", label: "類型", defaultValue: defaults.topType, choices, help: topHeightHelp },
  ];
  // skipMid + 上層自動填滿時，不顯示高度欄位
  if (!(opts.skipMid && autoSide === "top")) {
    specs.push({ group: "zone-top", type: "number", key: "topHeight", label: "高度 (mm)", defaultValue: defaults.topHeight, min: 80, max: 1500, step: 10 });
  }
  specs.push(
    { group: "zone-top", type: "number", key: "topCount", label: "數量", help: "抽屜=排數 / 門板=扇數 / 開放層板=層數", defaultValue: defaults.topCount, min: 1, max: 8, step: 1 },
    { group: "zone-top", type: "number", key: "topCols", label: "抽屜列數（左右分）", defaultValue: defaults.topCols ?? 1, min: 1, max: 4, step: 1, dependsOn: { key: "topType", equals: "drawer" } },
    { group: "zone-top", type: "number", key: "topDoorShelves", label: "門內層板數（門類型用）", defaultValue: 0, min: 0, max: 6, step: 1, help: "類型=門板 時，門內藏的層板片數（0=全空）", dependsOn: { key: "topType", equals: "door" } },
    { group: "zone-top", type: "number", key: "topDoorDrawers", label: "門內抽屜數（門類型用）", defaultValue: 0, min: 0, max: 8, step: 1, help: "> 0 時用抽屜取代層板（均分剩餘空間，無水平分隔板）", dependsOn: { key: "topType", equals: "door" } },
    { group: "zone-top", type: "number", key: "topDoorDrawerHeight", label: "門內每抽屜高度 (mm)", defaultValue: 100, min: 80, max: 150, step: 5, help: "每個抽屜的高度，80–150mm 範圍。總抽屜區 = 抽屜數 × 此高度", dependsOn: { all: [{ key: "topType", equals: "door" }, { key: "topDoorDrawers", notIn: [0] }] } },
    { group: "zone-top", type: "number", key: "topDoorCols", label: "門板橫向分隔數（門類型用）", defaultValue: 1, min: 1, max: 4, step: 1, help: "類型=門板 時，欄內切 N 個獨立子櫃。子欄 1 用上方 zone 層級設定，子欄 2/3/4 各自獨立", dependsOn: { key: "topType", equals: "door" } },
    ...(allowHanging ? [
      { group: "zone-top" as const, type: "checkbox" as const, key: "topDoorHanging", label: "加吊衣桿", defaultValue: false, wide: true, help: "類型=門板 時，子欄 1 後加一根吊衣桿（衣櫃用）。多欄門時子欄 2/3/4 各自獨立開關", dependsOn: { key: "topType", equals: "door" } },
      { group: "zone-top" as const, type: "number" as const, key: "topDoorHangingHeight", label: "吊衣空間高度 (mm)", defaultValue: 1200, min: 200, max: 2200, step: 50, help: "rod 距 zone 頂端 60mm，吊衣空間從頂端往下延伸這個高度；下方剩餘給門內層板", dependsOn: { all: [{ key: "topType", equals: "door" }, { key: "topDoorHanging", equals: true }] } },
    ] : []),
    ...makeDoorSubColOptions("top", "zone-top", allowHanging),
  );
  if (!opts.skipMid) {
    specs.push(
      // 中層（自動填滿）
      { group: "zone-mid", type: "select", key: "midType", label: "類型", defaultValue: defaults.midType, choices, help: "高度自動填滿剩餘空間" },
      { group: "zone-mid", type: "number", key: "midCount", label: "數量", help: "抽屜=排數 / 門板=扇數 / 開放層板=層數", defaultValue: defaults.midCount, min: 1, max: 8, step: 1 },
      { group: "zone-mid", type: "number", key: "midCols", label: "抽屜列數（左右分）", defaultValue: defaults.midCols ?? 1, min: 1, max: 4, step: 1, dependsOn: { key: "midType", equals: "drawer" } },
      { group: "zone-mid", type: "number", key: "midDoorShelves", label: "門內層板數（門類型用）", defaultValue: 0, min: 0, max: 6, step: 1, help: "類型=門板 時，門內藏的層板片數（0=全空）", dependsOn: { key: "midType", equals: "door" } },
      { group: "zone-mid", type: "number", key: "midDoorDrawers", label: "門內抽屜數（門類型用）", defaultValue: 0, min: 0, max: 8, step: 1, help: "> 0 時用抽屜取代層板（均分剩餘空間，無水平分隔板）", dependsOn: { key: "midType", equals: "door" } },
      { group: "zone-mid", type: "number", key: "midDoorDrawerHeight", label: "門內每抽屜高度 (mm)", defaultValue: 100, min: 80, max: 150, step: 5, help: "每個抽屜的高度，80–150mm 範圍。總抽屜區 = 抽屜數 × 此高度", dependsOn: { all: [{ key: "midType", equals: "door" }, { key: "midDoorDrawers", notIn: [0] }] } },
      { group: "zone-mid", type: "number", key: "midDoorCols", label: "門板橫向分隔數（門類型用）", defaultValue: 1, min: 1, max: 4, step: 1, help: "類型=門板 時，欄內切 N 個獨立子櫃。子欄 1 用上方 zone 層級設定，子欄 2/3/4 各自獨立", dependsOn: { key: "midType", equals: "door" } },
      ...(allowHanging ? [
        { group: "zone-mid" as const, type: "checkbox" as const, key: "midDoorHanging", label: "加吊衣桿", defaultValue: false, wide: true, help: "類型=門板 時，子欄 1 後加一根吊衣桿（衣櫃用）", dependsOn: { key: "midType", equals: "door" } },
        { group: "zone-mid" as const, type: "number" as const, key: "midDoorHangingHeight", label: "吊衣空間高度 (mm)", defaultValue: 1200, min: 200, max: 2200, step: 50, help: "rod 距 zone 頂端 60mm，吊衣空間從頂端往下延伸這個高度", dependsOn: { all: [{ key: "midType", equals: "door" }, { key: "midDoorHanging", equals: true }] } },
      ] : []),
      ...makeDoorSubColOptions("mid", "zone-mid", allowHanging),
    );
  }
  specs.push(
    // 下層
    { group: "zone-bot", type: "select", key: "bottomType", label: "類型", defaultValue: defaults.bottomType, choices, help: botHeightHelp },
  );
  if (!(opts.skipMid && autoSide === "bottom")) {
    specs.push({ group: "zone-bot", type: "number", key: "bottomHeight", label: "高度 (mm)", defaultValue: defaults.bottomHeight, min: 80, max: 1500, step: 10 });
  }
  specs.push(
    { group: "zone-bot", type: "number", key: "bottomCount", label: "數量", help: "抽屜=排數 / 門板=扇數 / 開放層板=層數", defaultValue: defaults.bottomCount, min: 1, max: 8, step: 1 },
    { group: "zone-bot", type: "number", key: "bottomCols", label: "抽屜列數（左右分）", defaultValue: defaults.bottomCols ?? 1, min: 1, max: 4, step: 1, dependsOn: { key: "bottomType", equals: "drawer" } },
    { group: "zone-bot", type: "number", key: "bottomDoorShelves", label: "門內層板數（門類型用）", defaultValue: 0, min: 0, max: 6, step: 1, help: "類型=門板 時，門內藏的層板片數（0=全空）", dependsOn: { key: "bottomType", equals: "door" } },
    { group: "zone-bot", type: "number", key: "bottomDoorDrawers", label: "門內抽屜數（門類型用）", defaultValue: 0, min: 0, max: 8, step: 1, help: "> 0 時用抽屜取代層板（均分剩餘空間，無水平分隔板）", dependsOn: { key: "bottomType", equals: "door" } },
    { group: "zone-bot", type: "number", key: "bottomDoorDrawerHeight", label: "門內每抽屜高度 (mm)", defaultValue: 100, min: 80, max: 150, step: 5, help: "每個抽屜的高度，80–150mm 範圍。總抽屜區 = 抽屜數 × 此高度", dependsOn: { all: [{ key: "bottomType", equals: "door" }, { key: "bottomDoorDrawers", notIn: [0] }] } },
    { group: "zone-bot", type: "number", key: "bottomDoorCols", label: "門板橫向分隔數（門類型用）", defaultValue: 1, min: 1, max: 4, step: 1, help: "類型=門板 時，欄內切 N 個獨立子櫃。子欄 1 用上方 zone 層級設定，子欄 2/3/4 各自獨立", dependsOn: { key: "bottomType", equals: "door" } },
    ...(allowHanging ? [
      { group: "zone-bot" as const, type: "checkbox" as const, key: "bottomDoorHanging", label: "加吊衣桿", defaultValue: false, wide: true, help: "類型=門板 時，子欄 1 後加一根吊衣桿（衣櫃用）", dependsOn: { key: "bottomType", equals: "door" } },
      { group: "zone-bot" as const, type: "number" as const, key: "bottomDoorHangingHeight", label: "吊衣空間高度 (mm)", defaultValue: 1200, min: 200, max: 2200, step: 50, help: "rod 距 zone 頂端 60mm，吊衣空間從頂端往下延伸這個高度", dependsOn: { all: [{ key: "bottomType", equals: "door" }, { key: "bottomDoorHanging", equals: true }] } },
    ] : []),
    ...makeDoorSubColOptions("bottom", "zone-bot", allowHanging),
  );
  return specs;
}

export interface ResolvedZones {
  zones: CabinetZone[];
  topH: number;
  midH: number;
  botH: number;
  topType: ZoneType;
  midType: ZoneType;
  bottomType: ZoneType;
  topCount: number;
  midCount: number;
  bottomCount: number;
  topCols: number;
  midCols: number;
  bottomCols: number;
  /** 人類可讀備註，會列出三層設定（實際高度） */
  notesLine: string;
  /** 高度被自動修正時的警告訊息（給設計頁顯示用） */
  warnings: string[];
}

const toCabinetZone = (
  t: ZoneType,
  heightMm: number,
  count: number,
  cols: number,
  doorInnerShelves = 0,
  doorInnerHanging = false,
  doorCols = 1,
  doorInnerHangingHeight = 1200,
  doorSubCols?: CabinetZone["doorSubCols"],
  doorInnerDrawers = 0,
  doorInnerDrawerHeight = 100,
): CabinetZone | null => {
  if (t === "none") return { type: "shelves", heightMm, count: 0 };
  if (t === "drawer") return { type: "drawer", heightMm, count, cols };
  if (t === "door") return { type: "door", heightMm, count, cols: Math.max(1, doorCols), doorInnerShelves, doorInnerHanging, doorInnerHangingHeight, doorSubCols, doorInnerDrawers, doorInnerDrawerHeight };
  if (t === "shelves") return { type: "shelves", heightMm, count };
  if (t === "hanging") return { type: "hanging", heightMm, count: 1 };
  return null;
};

/** 從 spec 讀取每子欄 (Sub2/3/4) 設定並組成 doorSubCols 陣列。
 *  Sub1 永遠 undefined（讓 render 用 zone 層級設定當預設）；
 *  Sub2/3/4 只在對應 index 存在時填值。長度 = nCols。 */
function buildDoorSubCols(
  input: FurnitureTemplateInput,
  options: OptionSpec[],
  zonePrefix: "top" | "mid" | "bottom",
  nCols: number,
  innerW: number,
): CabinetZone["doorSubCols"] | undefined {
  if (nCols < 2) return undefined;
  const subs: NonNullable<CabinetZone["doorSubCols"]> = [{}]; // Sub1 留空（走 zone 層級）
  for (let n = 2; n <= nCols; n++) {
    const shelvesKey = `${zonePrefix}DoorSub${n}Shelves`;
    const hangingKey = `${zonePrefix}DoorSub${n}Hanging`;
    const hangingHeightKey = `${zonePrefix}DoorSub${n}HangingHeight`;
    const widthKey = `${zonePrefix}DoorSub${n}WidthMm`;
    const drawersKey = `${zonePrefix}DoorSub${n}Drawers`;
    const hasShelves = options.some((s) => s.key === shelvesKey);
    const sub: { shelves?: number; hanging?: boolean; hangingHeight?: number; widthFrac?: number; drawers?: number; drawerHeight?: number } = {};
    if (hasShelves) sub.shelves = getOption<number>(input, opt(options, shelvesKey));
    if (options.some((s) => s.key === hangingKey)) sub.hanging = getOption<boolean>(input, opt(options, hangingKey));
    if (options.some((s) => s.key === hangingHeightKey)) sub.hangingHeight = getOption<number>(input, opt(options, hangingHeightKey));
    if (options.some((s) => s.key === drawersKey)) sub.drawers = getOption<number>(input, opt(options, drawersKey));
    const drawerHKey = `${zonePrefix}DoorSub${n}DrawerHeight`;
    if (options.some((s) => s.key === drawerHKey)) sub.drawerHeight = getOption<number>(input, opt(options, drawerHKey));
    if (options.some((s) => s.key === widthKey)) {
      const w = getOption<number>(input, opt(options, widthKey));
      if (w && w > 0 && innerW > 0) sub.widthFrac = Math.min(0.9, w / innerW);
    }
    subs.push(sub);
  }
  return subs;
}

/**
 * 讀取 template input 的 3-zone 設定，算出符合櫃體內高的 zones 陣列。
 * 中層高度 = 內高 − 上層 − 下層；若總和超過內高，上+下按比例壓縮留最少 80mm 給中層。
 */
export function resolveZones(
  input: FurnitureTemplateInput,
  options: OptionSpec[],
  innerH: number,
  doorLabel: "玻璃" | "木" | "平板" = "木",
): ResolvedZones {
  const topType = getOption<string>(input, opt(options, "topType")) as ZoneType;
  const hasTopHeight = options.some((s) => s.key === "topHeight");
  const topH0 = hasTopHeight ? getOption<number>(input, opt(options, "topHeight")) : 0;
  const topCount = getOption<number>(input, opt(options, "topCount"));
  const topCols = getOption<number>(input, opt(options, "topCols"));
  const topDoorShelves = getOption<number>(input, opt(options, "topDoorShelves"));
  const hasTopDoorDrawers = options.some((s) => s.key === "topDoorDrawers");
  const topDoorDrawers = hasTopDoorDrawers ? getOption<number>(input, opt(options, "topDoorDrawers")) : 0;
  const hasTopDoorDrawerHeight = options.some((s) => s.key === "topDoorDrawerHeight");
  const topDoorDrawerHeight = hasTopDoorDrawerHeight ? getOption<number>(input, opt(options, "topDoorDrawerHeight")) : 100;
  const hasTopDoorCols = options.some((s) => s.key === "topDoorCols");
  const topDoorCols = hasTopDoorCols ? getOption<number>(input, opt(options, "topDoorCols")) : 1;
  const hasTopDoorHanging = options.some((s) => s.key === "topDoorHanging");
  const topDoorHanging = hasTopDoorHanging ? getOption<boolean>(input, opt(options, "topDoorHanging")) : false;
  const hasTopDoorHangingHeight = options.some((s) => s.key === "topDoorHangingHeight");
  const topDoorHangingHeight = hasTopDoorHangingHeight ? getOption<number>(input, opt(options, "topDoorHangingHeight")) : 1200;
  const hasMid = options.some((s) => s.key === "midType");
  const midType = (hasMid ? getOption<string>(input, opt(options, "midType")) : "none") as ZoneType;
  const midCount = hasMid ? getOption<number>(input, opt(options, "midCount")) : 0;
  const midCols = hasMid ? getOption<number>(input, opt(options, "midCols")) : 1;
  const midDoorShelves = hasMid ? getOption<number>(input, opt(options, "midDoorShelves")) : 0;
  const hasMidDoorDrawers = options.some((s) => s.key === "midDoorDrawers");
  const midDoorDrawers = hasMidDoorDrawers ? getOption<number>(input, opt(options, "midDoorDrawers")) : 0;
  const hasMidDoorDrawerHeight = options.some((s) => s.key === "midDoorDrawerHeight");
  const midDoorDrawerHeight = hasMidDoorDrawerHeight ? getOption<number>(input, opt(options, "midDoorDrawerHeight")) : 100;
  const hasMidDoorCols = options.some((s) => s.key === "midDoorCols");
  const midDoorCols = hasMidDoorCols ? getOption<number>(input, opt(options, "midDoorCols")) : 1;
  const hasMidDoorHanging = options.some((s) => s.key === "midDoorHanging");
  const midDoorHanging = hasMidDoorHanging ? getOption<boolean>(input, opt(options, "midDoorHanging")) : false;
  const hasMidDoorHangingHeight = options.some((s) => s.key === "midDoorHangingHeight");
  const midDoorHangingHeight = hasMidDoorHangingHeight ? getOption<number>(input, opt(options, "midDoorHangingHeight")) : 1200;
  const bottomType = getOption<string>(input, opt(options, "bottomType")) as ZoneType;
  const hasBotHeight = options.some((s) => s.key === "bottomHeight");
  const botH0 = hasBotHeight ? getOption<number>(input, opt(options, "bottomHeight")) : 0;
  const bottomCount = getOption<number>(input, opt(options, "bottomCount"));
  const bottomCols = getOption<number>(input, opt(options, "bottomCols"));
  const bottomDoorShelves = getOption<number>(input, opt(options, "bottomDoorShelves"));
  const hasBotDoorDrawers = options.some((s) => s.key === "bottomDoorDrawers");
  const bottomDoorDrawers = hasBotDoorDrawers ? getOption<number>(input, opt(options, "bottomDoorDrawers")) : 0;
  const hasBotDoorDrawerHeight = options.some((s) => s.key === "bottomDoorDrawerHeight");
  const bottomDoorDrawerHeight = hasBotDoorDrawerHeight ? getOption<number>(input, opt(options, "bottomDoorDrawerHeight")) : 100;
  const hasBotDoorCols = options.some((s) => s.key === "bottomDoorCols");
  const bottomDoorCols = hasBotDoorCols ? getOption<number>(input, opt(options, "bottomDoorCols")) : 1;
  const hasBotDoorHanging = options.some((s) => s.key === "bottomDoorHanging");
  const bottomDoorHanging = hasBotDoorHanging ? getOption<boolean>(input, opt(options, "bottomDoorHanging")) : false;
  const hasBotDoorHangingHeight = options.some((s) => s.key === "bottomDoorHangingHeight");
  const bottomDoorHangingHeight = hasBotDoorHangingHeight ? getOption<number>(input, opt(options, "bottomDoorHangingHeight")) : 1200;

  const MIN_MID = 80;
  let topH = topH0;
  let botH = botH0;
  let midH: number;
  const available = innerH;
  const warnings: string[] = [];
  if (available < 160) {
    warnings.push(
      `櫃內可用高度只有 ${Math.max(0, available)}mm（總高 − 腳高 − 上下板 2×板厚），太矮塞不下兩層收納。請降低腳高或增加總高。`,
    );
  }
  if (!hasMid) {
    // 兩段式：哪邊有 height 欄位就吃使用者設定，另一邊吃剩
    midH = 0;
    if (hasTopHeight && !hasBotHeight) {
      if (topH > available - 80) {
        warnings.push(`上層高度 ${topH}mm 超過可用空間，已自動修正為 ${Math.max(80, available - 80)}mm（下層至少留 80mm）。`);
        topH = Math.max(80, available - 80);
      }
      botH = Math.max(80, available - topH);
    } else if (hasBotHeight && !hasTopHeight) {
      if (botH > available - 80) {
        warnings.push(`下層高度 ${botH}mm 超過可用空間（內高 ${available}mm − 上層至少 80mm），已自動修正為 ${Math.max(80, available - 80)}mm。請降低下層高度、降低腳高或增加總高。`);
        botH = Math.max(80, available - 80);
      }
      topH = Math.max(80, available - botH);
    } else {
      if (topH + botH > available) {
        warnings.push(`上層 ${topH} + 下層 ${botH} = ${topH + botH}mm 超過內高 ${available}mm，已按比例壓縮。`);
        const scale = available / (topH + botH);
        topH = Math.round(topH * scale);
        botH = available - topH;
      }
    }
  } else {
    if (topH + botH > available - MIN_MID) {
      warnings.push(`上層 ${topH} + 下層 ${botH} = ${topH + botH}mm 超過內高 ${available}mm − 中層最少 ${MIN_MID}mm，已按比例壓縮。`);
      const scale = Math.max(0, available - MIN_MID) / (topH + botH);
      topH = Math.round(topH * scale);
      botH = Math.round(botH * scale);
    }
    midH = Math.max(MIN_MID, available - topH - botH);
  }

  const zones: CabinetZone[] = [];
  // input.length 給 buildDoorSubCols 算 widthFrac 用；需先讀 panelThickness
  const panelThicknessForSub = options.some((s) => s.key === "panelThickness")
    ? getOption<number>(input, opt(options, "panelThickness"))
    : 18;
  const innerWForSub = Math.max(0, input.length - 2 * panelThicknessForSub);
  const bSubCols = bottomType === "door" ? buildDoorSubCols(input, options, "bottom", bottomDoorCols, innerWForSub) : undefined;
  const mSubCols = (hasMid && midType === "door") ? buildDoorSubCols(input, options, "mid", midDoorCols, innerWForSub) : undefined;
  const tSubCols = topType === "door" ? buildDoorSubCols(input, options, "top", topDoorCols, innerWForSub) : undefined;
  const b = toCabinetZone(bottomType, botH, bottomCount, bottomCols, bottomDoorShelves, bottomDoorHanging, bottomDoorCols, bottomDoorHangingHeight, bSubCols, bottomDoorDrawers, bottomDoorDrawerHeight);
  const m = hasMid ? toCabinetZone(midType, midH, midCount, midCols, midDoorShelves, midDoorHanging, midDoorCols, midDoorHangingHeight, mSubCols, midDoorDrawers, midDoorDrawerHeight) : null;
  const t = toCabinetZone(topType, topH, topCount, topCols, topDoorShelves, topDoorHanging, topDoorCols, topDoorHangingHeight, tSubCols, topDoorDrawers, topDoorDrawerHeight);
  if (b) zones.push(b);
  if (m) zones.push(m);
  if (t) zones.push(t);

  const describe = (
    name: string,
    ty: ZoneType,
    h: number,
    n: number,
    c: number,
    ds = 0,
  ) => {
    if (ty === "none") return `${name} 空區 ${h}mm`;
    if (ty === "drawer") return `${name} ${n}×${c} 抽屜 ${h}mm`;
    if (ty === "door") {
      const innerNote = ds > 0 ? `（內藏 ${ds} 片層板）` : "";
      return `${name} ${n} 扇${doorLabel}門 ${h}mm${innerNote}`;
    }
    if (ty === "shelves") return `${name} ${n} 層開放 ${h}mm（${Math.max(0, n - 1)} 片內部層板）`;
    if (ty === "hanging") return `${name} 吊衣空間 ${h}mm（含 1 根吊衣桿）`;
    return "";
  };
  const notesLine = hasMid
    ? `三層組合：${describe("上層", topType, topH, topCount, topCols, topDoorShelves)}；${describe("中層", midType, midH, midCount, midCols, midDoorShelves)}（自動填滿）；${describe("下層", bottomType, botH, bottomCount, bottomCols, bottomDoorShelves)}`
    : `兩層組合：${describe("上層", topType, topH, topCount, topCols, topDoorShelves)}；${describe("下層", bottomType, botH, bottomCount, bottomCols, bottomDoorShelves)}（自動填滿）`;

  return {
    zones,
    topH,
    midH,
    botH,
    topType,
    midType,
    bottomType,
    topCount,
    midCount,
    bottomCount,
    topCols,
    midCols,
    bottomCols,
    notesLine,
    warnings,
  };
}
