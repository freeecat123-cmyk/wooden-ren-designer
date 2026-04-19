import type { FurnitureTemplate, OptionSpec } from "@/lib/types";
import { getOption } from "@/lib/types";
import { caseFurniture } from "./_builders/case-furniture";

export const chestOfDrawersOptions: OptionSpec[] = [
  { type: "number", key: "drawerRows", label: "抽屜排數（上下）", defaultValue: 4, min: 1, max: 8, step: 1 },
  { type: "number", key: "drawerCols", label: "抽屜列數（左右）", defaultValue: 1, min: 1, max: 4, step: 1, help: "每排可切成 2/3 個小抽屜" },
  { type: "number", key: "panelThickness", label: "板材厚 (mm)", defaultValue: 18, min: 12, max: 25, step: 1 },
  { type: "number", key: "backThickness", label: "背板厚 (mm)", defaultValue: 6, min: 4, max: 12, step: 1 },
  { type: "number", key: "legHeight", label: "底座腳高 (mm)", defaultValue: 0, min: 0, max: 300, step: 10, help: "設 0 則貼地，>0 則加 4 隻沙發腳" },
  { type: "number", key: "legSize", label: "腳粗 (mm)", defaultValue: 40, min: 25, max: 70, step: 5 },
];

export const chestOfDrawers: FurnitureTemplate = (input) => {
  const drawerRows = getOption<number>(input, chestOfDrawersOptions[0]);
  const drawerCols = getOption<number>(input, chestOfDrawersOptions[1]);
  const panelThickness = getOption<number>(input, chestOfDrawersOptions[2]);
  const backThickness = getOption<number>(input, chestOfDrawersOptions[3]);
  const legHeight = getOption<number>(input, chestOfDrawersOptions[4]);
  const legSize = getOption<number>(input, chestOfDrawersOptions[5]);
  return caseFurniture({
    category: "chest-of-drawers",
    nameZh: "斗櫃",
    length: input.length,
    width: input.width,
    height: input.height,
    material: input.material,
    shelfCount: drawerRows - 1,
    drawerCount: drawerRows,
    drawerCols,
    panelThickness,
    shelfThickness: panelThickness,
    backThickness,
    legHeight,
    legSize,
    notes: `${drawerRows} 排 × ${drawerCols} 列 共 ${drawerRows * drawerCols} 個抽屜${legHeight > 0 ? `；底座加 ${legHeight}mm 沙發腳` : ""}。抽屜需配側拉滑軌或木製滑軌。`,
  });
};
