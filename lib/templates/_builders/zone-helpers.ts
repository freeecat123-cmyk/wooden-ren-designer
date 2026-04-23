import type { OptionSpec, FurnitureTemplateInput } from "@/lib/types";
import { getOption, opt } from "@/lib/types";
import type { CabinetZone } from "./case-furniture";

/**
 * 共用選項：抽屜滑軌五金。
 * 三段式滑軌（ball bearing）安裝在櫃體側板 / 中柱與抽屜側板之間，
 * 業界標準左右各需 12.5mm 空隙。使用者勾選後所有抽屜總寬自動縮 25mm。
 */
export const drawerSlideOption: OptionSpec = {
  group: "drawer",
  type: "checkbox",
  key: "useDrawerSlide",
  label: "使用三段式滑軌（左右各減 1.25cm）",
  defaultValue: false,
  help:
    "勾選後：抽屜箱體總寬縮 25mm 留給滑軌五金；" +
    "另加一片「面板」蓋掉左右空隙（面板尺寸只比抽屜格小 2mm，上下左右各 1mm 縫）；" +
    "箱體（5 件）向後縮 18mm（面板厚）藏在面板後；" +
    "箱體高比抽屜格縮 10mm（上下各 5mm 滑軌行程空隙）；" +
    "箱體距背板留 10mm 防撞。不勾選視為傳統木製側拉 / 無滑軌。",
};

export const DRAWER_SLIDE_GAP_MM = 12.5;

export function resolveDrawerSlideGap(
  input: FurnitureTemplateInput,
  options: OptionSpec[],
): number {
  const on = getOption<boolean>(input, opt(options, "useDrawerSlide"));
  return on ? DRAWER_SLIDE_GAP_MM : 0;
}

/** 每個 zone 可選的類型 */
export const ZONE_TYPE_CHOICES = [
  { value: "none", label: "不設（空區）" },
  { value: "drawer", label: "抽屜" },
  { value: "door", label: "門板" },
  { value: "shelves", label: "開放層板（輸入=層數）" },
];

/** 衣櫃等需要吊衣空間的櫃子額外支援 "hanging" */
export const ZONE_TYPE_CHOICES_WITH_HANGING = [
  ...ZONE_TYPE_CHOICES,
  { value: "hanging", label: "吊衣空間（含吊衣桿）" },
];

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
 * 產生 3-zone 櫃體的標準 option 表單。上/中/下各有 type 選單 + 數量/尺寸。
 * 中層高度自動填滿剩餘空間（= 內高 − 上層 − 下層），不需要使用者輸入。
 */
export function makeZoneOptions(defaults: ZoneDefaults, allowHanging = false): OptionSpec[] {
  const choices = allowHanging ? ZONE_TYPE_CHOICES_WITH_HANGING : ZONE_TYPE_CHOICES;
  return [
    // 上層
    { group: "zone-top", type: "select", key: "topType", label: "類型", defaultValue: defaults.topType, choices },
    { group: "zone-top", type: "number", key: "topHeight", label: "高度 (mm)", defaultValue: defaults.topHeight, min: 80, max: 1500, step: 10 },
    { group: "zone-top", type: "number", key: "topCount", label: "數量（抽屜排 / 門扇 / 層數）", defaultValue: defaults.topCount, min: 1, max: 8, step: 1 },
    { group: "zone-top", type: "number", key: "topCols", label: "抽屜列數（左右分）", defaultValue: defaults.topCols ?? 1, min: 1, max: 4, step: 1 },
    { group: "zone-top", type: "number", key: "topDoorShelves", label: "門內層板數（門類型用）", defaultValue: 0, min: 0, max: 6, step: 1, help: "類型=門板 時，門內藏的層板片數（0=全空）" },
    // 中層（自動填滿）
    { group: "zone-mid", type: "select", key: "midType", label: "類型", defaultValue: defaults.midType, choices, help: "高度自動填滿剩餘空間" },
    { group: "zone-mid", type: "number", key: "midCount", label: "數量（抽屜排 / 門扇 / 層數）", defaultValue: defaults.midCount, min: 1, max: 8, step: 1 },
    { group: "zone-mid", type: "number", key: "midCols", label: "抽屜列數（左右分）", defaultValue: defaults.midCols ?? 1, min: 1, max: 4, step: 1 },
    { group: "zone-mid", type: "number", key: "midDoorShelves", label: "門內層板數（門類型用）", defaultValue: 0, min: 0, max: 6, step: 1, help: "類型=門板 時，門內藏的層板片數（0=全空）" },
    // 下層
    { group: "zone-bot", type: "select", key: "bottomType", label: "類型", defaultValue: defaults.bottomType, choices },
    { group: "zone-bot", type: "number", key: "bottomHeight", label: "高度 (mm)", defaultValue: defaults.bottomHeight, min: 80, max: 1500, step: 10 },
    { group: "zone-bot", type: "number", key: "bottomCount", label: "數量（抽屜排 / 門扇 / 層數）", defaultValue: defaults.bottomCount, min: 1, max: 8, step: 1 },
    { group: "zone-bot", type: "number", key: "bottomCols", label: "抽屜列數（左右分）", defaultValue: defaults.bottomCols ?? 1, min: 1, max: 4, step: 1 },
    { group: "zone-bot", type: "number", key: "bottomDoorShelves", label: "門內層板數（門類型用）", defaultValue: 0, min: 0, max: 6, step: 1, help: "類型=門板 時，門內藏的層板片數（0=全空）" },
  ];
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
}

const toCabinetZone = (
  t: ZoneType,
  heightMm: number,
  count: number,
  cols: number,
  doorInnerShelves = 0,
): CabinetZone | null => {
  if (t === "none") return { type: "shelves", heightMm, count: 0 };
  if (t === "drawer") return { type: "drawer", heightMm, count, cols };
  if (t === "door") return { type: "door", heightMm, count, doorInnerShelves };
  if (t === "shelves") return { type: "shelves", heightMm, count };
  if (t === "hanging") return { type: "hanging", heightMm, count: 1 };
  return null;
};

/**
 * 讀取 template input 的 3-zone 設定，算出符合櫃體內高的 zones 陣列。
 * 中層高度 = 內高 − 上層 − 下層；若總和超過內高，上+下按比例壓縮留最少 80mm 給中層。
 */
export function resolveZones(
  input: FurnitureTemplateInput,
  options: OptionSpec[],
  innerH: number,
  doorLabel: "玻璃" | "木" = "木",
): ResolvedZones {
  const topType = getOption<string>(input, opt(options, "topType")) as ZoneType;
  const topH0 = getOption<number>(input, opt(options, "topHeight"));
  const topCount = getOption<number>(input, opt(options, "topCount"));
  const topCols = getOption<number>(input, opt(options, "topCols"));
  const topDoorShelves = getOption<number>(input, opt(options, "topDoorShelves"));
  const midType = getOption<string>(input, opt(options, "midType")) as ZoneType;
  const midCount = getOption<number>(input, opt(options, "midCount"));
  const midCols = getOption<number>(input, opt(options, "midCols"));
  const midDoorShelves = getOption<number>(input, opt(options, "midDoorShelves"));
  const bottomType = getOption<string>(input, opt(options, "bottomType")) as ZoneType;
  const botH0 = getOption<number>(input, opt(options, "bottomHeight"));
  const bottomCount = getOption<number>(input, opt(options, "bottomCount"));
  const bottomCols = getOption<number>(input, opt(options, "bottomCols"));
  const bottomDoorShelves = getOption<number>(input, opt(options, "bottomDoorShelves"));

  const MIN_MID = 80;
  let topH = topH0;
  let botH = botH0;
  const available = innerH;
  if (topH + botH > available - MIN_MID) {
    const scale = Math.max(0, available - MIN_MID) / (topH + botH);
    topH = Math.round(topH * scale);
    botH = Math.round(botH * scale);
  }
  const midH = Math.max(MIN_MID, available - topH - botH);

  const zones: CabinetZone[] = [];
  const b = toCabinetZone(bottomType, botH, bottomCount, bottomCols, bottomDoorShelves);
  const m = toCabinetZone(midType, midH, midCount, midCols, midDoorShelves);
  const t = toCabinetZone(topType, topH, topCount, topCols, topDoorShelves);
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
  const notesLine = `三層組合：${describe("上層", topType, topH, topCount, topCols, topDoorShelves)}；${describe("中層", midType, midH, midCount, midCols, midDoorShelves)}（自動填滿）；${describe("下層", bottomType, botH, bottomCount, bottomCols, bottomDoorShelves)}`;

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
  };
}
