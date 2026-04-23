import type { FurnitureTemplate, OptionSpec } from "@/lib/types";
import { getOption, opt } from "@/lib/types";
import { caseFurniture } from "./_builders/case-furniture";
import {
  drawerSlideOption,
  makeZoneOptions,
  resolveDrawerSlideGap,
  resolveZones,
} from "./_builders/zone-helpers";

export const chestOfDrawersOptions: OptionSpec[] = [
  { group: "top", type: "number", key: "panelThickness", label: "板材厚 (mm)", defaultValue: 18, min: 9, max: 35, step: 1 },
  { group: "back", type: "number", key: "backThickness", label: "背板厚 (mm)", defaultValue: 6, min: 0, max: 18, step: 1 },
  ...makeZoneOptions({
    // 傳統斗櫃：三層都是抽屜（經典 6 抽）
    topType: "drawer", topHeight: 300, topCount: 2, topCols: 1,
    midType: "drawer", midCount: 2, midCols: 1,
    bottomType: "drawer", bottomHeight: 300, bottomCount: 2, bottomCols: 1,
  }),
  { group: "leg", type: "number", key: "legHeight", label: "底座腳高 (mm)", defaultValue: 0, min: 0, max: 400, step: 10, help: "設 0 則貼地，>0 則加 4 隻沙發腳" },
  { group: "leg", type: "number", key: "legSize", label: "腳粗 (mm)", defaultValue: 40, min: 20, max: 120, step: 5 },
  { group: "leg", type: "select", key: "legShape", label: "腳樣式", defaultValue: "box", choices: [
    { value: "box", label: "直腳（方料）" },
    { value: "tapered", label: "錐形腳（下方收窄）" },
    { value: "bracket", label: "帶托腳牙" },
    { value: "plinth", label: "平台底座（連板）" },
    { value: "panel-side", label: "側板延伸落地（中間空心）" },
  ] },
  { group: "leg", type: "number", key: "legInset", label: "腳內縮 (mm)", defaultValue: 0, min: 0, max: 300, step: 5 },
  drawerSlideOption,
];

export const chestOfDrawers: FurnitureTemplate = (input) => {
  const o = chestOfDrawersOptions;
  const panelThickness = getOption<number>(input, opt(o, "panelThickness"));
  const backThickness = getOption<number>(input, opt(o, "backThickness"));
  const legHeight = getOption<number>(input, opt(o, "legHeight"));
  const legSize = getOption<number>(input, opt(o, "legSize"));
  const legShape = getOption<string>(input, opt(o, "legShape"));
  const legInset = getOption<number>(input, opt(o, "legInset"));

  const innerH = input.height - legHeight - 2 * panelThickness;
  const { zones, notesLine } = resolveZones(input, o, innerH, "木");

  return caseFurniture({
    category: "chest-of-drawers",
    nameZh: "斗櫃",
    length: input.length,
    width: input.width,
    height: input.height,
    material: input.material,
    shelfCount: 0,
    zones,
    panelThickness,
    shelfThickness: panelThickness,
    backThickness,
    legHeight,
    legSize,
    legShape: legShape as "box" | "tapered" | "bracket" | "plinth" | "panel-side",
    legInset,
    drawerSlideGap: resolveDrawerSlideGap(input, o),
    notes: `${notesLine}${legHeight > 0 ? `；底座加 ${legHeight}mm ${legShape} 腳${legInset > 0 ? `（內縮 ${legInset}mm）` : ""}` : ""}。抽屜需配側拉滑軌或木製滑軌。`,
  });
};
