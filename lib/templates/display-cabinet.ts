import type { FurnitureTemplate, OptionSpec } from "@/lib/types";
import { getOption, opt } from "@/lib/types";
import { caseFurniture } from "./_builders/case-furniture";
import type { CabinetZone } from "./_builders/case-furniture";

// 每層可選 4 種類型：不設 / 抽屜 / 門板 / 層板
const ZONE_TYPE_CHOICES = [
  { value: "none", label: "不設（空區）" },
  { value: "drawer", label: "抽屜" },
  { value: "door", label: "門板" },
  { value: "shelves", label: "開放層板（輸入=層數）" },
];

export const displayCabinetOptions: OptionSpec[] = [
  { group: "top", type: "number", key: "panelThickness", label: "板材厚 (mm)", defaultValue: 20, min: 9, max: 35, step: 1 },
  // 上層
  { group: "top", type: "select", key: "topType", label: "上層類型", defaultValue: "shelves", choices: ZONE_TYPE_CHOICES },
  { group: "top", type: "number", key: "topHeight", label: "上層高度 (mm)", defaultValue: 400, min: 80, max: 1500, step: 10 },
  { group: "top", type: "number", key: "topCount", label: "上層數量（抽屜排 / 門扇 / 層板 = 層數）", defaultValue: 2, min: 1, max: 8, step: 1 },
  { group: "top", type: "number", key: "topCols", label: "上層抽屜列數", defaultValue: 1, min: 1, max: 4, step: 1 },
  // 中層（高度自動填滿剩餘 = 內高 − 上層 − 下層）
  { group: "top", type: "select", key: "midType", label: "中層類型", defaultValue: "shelves", choices: ZONE_TYPE_CHOICES, help: "高度自動填滿剩餘空間" },
  { group: "top", type: "number", key: "midCount", label: "中層數量", defaultValue: 2, min: 1, max: 8, step: 1 },
  { group: "top", type: "number", key: "midCols", label: "中層抽屜列數", defaultValue: 1, min: 1, max: 4, step: 1 },
  // 下層
  { group: "top", type: "select", key: "bottomType", label: "下層類型", defaultValue: "door", choices: ZONE_TYPE_CHOICES },
  { group: "top", type: "number", key: "bottomHeight", label: "下層高度 (mm)", defaultValue: 500, min: 80, max: 1500, step: 10 },
  { group: "top", type: "number", key: "bottomCount", label: "下層數量", defaultValue: 2, min: 1, max: 8, step: 1 },
  { group: "top", type: "number", key: "bottomCols", label: "下層抽屜列數", defaultValue: 1, min: 1, max: 4, step: 1 },
  // 門
  { group: "door", type: "select", key: "doorType", label: "門材質", defaultValue: "glass", choices: [
    { value: "glass", label: "玻璃門（需配 5mm 強化玻璃）" },
    { value: "wood", label: "木鑲板門" },
  ] },
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

type ZoneType = "none" | "drawer" | "door" | "shelves";

const toCabinetZone = (
  t: ZoneType,
  heightMm: number,
  count: number,
  cols: number,
): CabinetZone | null => {
  if (t === "none") return { type: "shelves", heightMm, count: 0 }; // empty open
  if (t === "drawer") return { type: "drawer", heightMm, count, cols };
  if (t === "door") return { type: "door", heightMm, count };
  if (t === "shelves") return { type: "shelves", heightMm, count };
  return null;
};

export const displayCabinet: FurnitureTemplate = (input) => {
  const o = displayCabinetOptions;
  const panelThickness = getOption<number>(input, opt(o, "panelThickness"));
  const topType = getOption<string>(input, opt(o, "topType")) as ZoneType;
  const topHeight = getOption<number>(input, opt(o, "topHeight"));
  const topCount = getOption<number>(input, opt(o, "topCount"));
  const topCols = getOption<number>(input, opt(o, "topCols"));
  const midType = getOption<string>(input, opt(o, "midType")) as ZoneType;
  const midCount = getOption<number>(input, opt(o, "midCount"));
  const midCols = getOption<number>(input, opt(o, "midCols"));
  const bottomType = getOption<string>(input, opt(o, "bottomType")) as ZoneType;
  const bottomHeight = getOption<number>(input, opt(o, "bottomHeight"));
  const bottomCount = getOption<number>(input, opt(o, "bottomCount"));
  const bottomCols = getOption<number>(input, opt(o, "bottomCols"));
  const doorType = getOption<string>(input, opt(o, "doorType"));
  const legHeight = getOption<number>(input, opt(o, "legHeight"));
  const legSize = getOption<number>(input, opt(o, "legSize"));
  const legShape = getOption<string>(input, opt(o, "legShape"));
  const legInset = getOption<number>(input, opt(o, "legInset"));

  // 計算可用內高。caseFurniture 把 zone boundary 分隔板畫在「下方 zone」的
  // 最上端 shelfT 之內（不另佔空間），所以 3 個 zone 的高度總和 = innerH，
  // 不是 innerH - 2 × shelfT。之前扣了 boundary 導致最上方多出 ~36mm 空隙。
  const innerH = input.height - legHeight - 2 * panelThickness;
  const available = innerH;

  // 中層高度 = 剩餘空間。若上+下已超過 available，等比壓縮上+下，留最小 80mm 給中層。
  const MIN_MID = 80;
  let topH = topHeight;
  let botH = bottomHeight;
  if (topH + botH > available - MIN_MID) {
    const scale = Math.max(0, available - MIN_MID) / (topH + botH);
    topH = Math.round(topH * scale);
    botH = Math.round(botH * scale);
  }
  const midH = Math.max(MIN_MID, available - topH - botH);

  // zones are stacked BOTTOM-up in caseFurniture's internal ordering
  const zones: CabinetZone[] = [];
  const b = toCabinetZone(bottomType, botH, bottomCount, bottomCols);
  const m = toCabinetZone(midType, midH, midCount, midCols);
  const t = toCabinetZone(topType, topH, topCount, topCols);
  if (b) zones.push(b);
  if (m) zones.push(m);
  if (t) zones.push(t);

  const describe = (name: string, ty: ZoneType, h: number, n: number, c: number) => {
    if (ty === "none") return `${name} 空區 ${h}mm`;
    if (ty === "drawer") return `${name} ${n}×${c} 抽屜 ${h}mm`;
    if (ty === "door") return `${name} ${n} 扇${doorType === "wood" ? "木" : "玻璃"}門 ${h}mm`;
    if (ty === "shelves") return `${name} ${n} 層開放 ${h}mm（${Math.max(0, n - 1)} 片內部層板）`;
    return "";
  };

  return caseFurniture({
    category: "display-cabinet",
    nameZh: "玻璃展示櫃",
    length: input.length,
    width: input.width,
    height: input.height,
    material: input.material,
    shelfCount: 0,
    doorType: doorType === "wood" ? "wood" : "glass",
    zones,
    panelThickness,
    shelfThickness: panelThickness - 2,
    backThickness: 8,
    legHeight,
    legSize,
    legShape: legShape as "box" | "tapered" | "bracket" | "plinth" | "panel-side",
    legInset,
    notes: `三層組合：${describe("上層", topType, topH, topCount, topCols)}；${describe("中層", midType, midH, midCount, midCols)}（自動填滿）；${describe("下層", bottomType, botH, bottomCount, bottomCols)}${legInset > 0 ? `；腳內縮 ${legInset}mm` : ""}。`,
  });
};
