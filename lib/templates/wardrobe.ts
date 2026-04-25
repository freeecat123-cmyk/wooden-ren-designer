import type { FurnitureTemplate, OptionSpec } from "@/lib/types";
import { getOption, opt } from "@/lib/types";
import { caseFurniture } from "./_builders/case-furniture";
import {
  drawerSlideOption,
  makeZoneOptions,
  resolveDrawerSlideGap,
  resolveZones,
} from "./_builders/zone-helpers";

export const wardrobeOptions: OptionSpec[] = [
  { group: "top", type: "number", key: "panelThickness", label: "板材厚 (mm)", defaultValue: 18, min: 9, max: 35, step: 1 },
  ...makeZoneOptions({
    // 標準衣櫃：上層層板收納、中層吊衣、下層抽屜
    topType: "shelves", topHeight: 300, topCount: 2,
    midType: "hanging", midCount: 1,
    bottomType: "drawer", bottomHeight: 400, bottomCount: 2, bottomCols: 2,
  }, true),
  { group: "door", type: "number", key: "doorCount", label: "門板數", defaultValue: 2, min: 0, max: 6, step: 1 },
  { group: "door", type: "select", key: "doorType", label: "門材質", defaultValue: "slab", choices: [
    { value: "slab", label: "夾板貼皮平板門（裝潢常用，衣櫃首選）" },
    { value: "wood", label: "木鑲板門（框 + 鑲板）" },
    { value: "glass", label: "玻璃門（需配 5mm 強化玻璃）" },
  ] },
  { group: "leg", type: "number", key: "legHeight", label: "底座腳高 (mm)", defaultValue: 80, min: 0, max: 400, step: 10 },
  { group: "leg", type: "select", key: "legShape", label: "腳樣式", defaultValue: "plinth", choices: [
    { value: "box", label: "直腳" },
    { value: "tapered", label: "錐形腳" },
    { value: "bracket", label: "帶托腳牙" },
    { value: "plinth", label: "平台底座（衣櫃常見）" },
    { value: "panel-side", label: "側板延伸落地" },
  ] },
  { group: "leg", type: "number", key: "legInset", label: "腳內縮 (mm)", defaultValue: 0, min: 0, max: 300, step: 5 },
  drawerSlideOption,
];

export const wardrobe: FurnitureTemplate = (input) => {
  const o = wardrobeOptions;
  const panelThickness = getOption<number>(input, opt(o, "panelThickness"));
  const doorCount = getOption<number>(input, opt(o, "doorCount"));
  const doorType = getOption<string>(input, opt(o, "doorType"));
  const legHeight = getOption<number>(input, opt(o, "legHeight"));
  const legShape = getOption<string>(input, opt(o, "legShape"));
  const legInset = getOption<number>(input, opt(o, "legInset"));

  const innerH = input.height - legHeight - 2 * panelThickness;
  const doorLabel =
    doorType === "wood" ? "木" : doorType === "slab" ? "平板" : "玻璃";
  const { zones, notesLine } = resolveZones(input, o, innerH, doorLabel);

  return caseFurniture({
    category: "wardrobe",
    nameZh: "衣櫃",
    length: input.length,
    width: input.width,
    height: input.height,
    material: input.material,
    shelfCount: 0,
    zones,
    doorCount,
    doorType:
      doorType === "wood"
        ? "wood"
        : doorType === "slab"
          ? "slab"
          : "glass",
    panelThickness,
    shelfThickness: panelThickness,
    backThickness: 6,
    legHeight,
    legSize: 45,
    legShape: legShape as "box" | "tapered" | "bracket" | "plinth" | "panel-side",
    legInset,
    drawerSlideGap: resolveDrawerSlideGap(input, o),
    notes: `${notesLine}；${doorCount} 扇門${legHeight > 0 ? `；加 ${legHeight}mm ${legShape} 底座${legInset > 0 ? `（內縮 ${legInset}mm）` : ""}` : ""}。需配吊衣桿、門鉸鏈、抽屜滑軌。`,
  });
};
