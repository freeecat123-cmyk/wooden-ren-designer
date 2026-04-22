import type { FurnitureTemplate, OptionSpec } from "@/lib/types";
import { getOption, opt } from "@/lib/types";
import { caseFurniture } from "./_builders/case-furniture";
import { makeZoneOptions, resolveZones } from "./_builders/zone-helpers";

export const shoeCabinetOptions: OptionSpec[] = [
  { group: "top", type: "number", key: "panelThickness", label: "板材厚 (mm)", defaultValue: 18, min: 9, max: 35, step: 1 },
  ...makeZoneOptions({
    // 傳統鞋櫃：上層開放收納 / 中層層板 / 下層門板藏鞋
    topType: "shelves", topHeight: 250, topCount: 1,
    midType: "shelves", midCount: 3,
    bottomType: "door", bottomHeight: 600, bottomCount: 2,
  }),
  { group: "leg", type: "number", key: "legHeight", label: "底座腳高 (mm)", defaultValue: 80, min: 0, max: 400, step: 10, help: "鞋櫃底部通常抬高防潮" },
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

export const shoeCabinet: FurnitureTemplate = (input) => {
  const o = shoeCabinetOptions;
  const panelThickness = getOption<number>(input, opt(o, "panelThickness"));
  const legHeight = getOption<number>(input, opt(o, "legHeight"));
  const legSize = getOption<number>(input, opt(o, "legSize"));
  const legShape = getOption<string>(input, opt(o, "legShape"));
  const legInset = getOption<number>(input, opt(o, "legInset"));

  const innerH = input.height - legHeight - 2 * panelThickness;
  const { zones, notesLine } = resolveZones(input, o, innerH, "木");

  return caseFurniture({
    category: "shoe-cabinet",
    nameZh: "鞋櫃",
    length: input.length,
    width: input.width,
    height: input.height,
    material: input.material,
    shelfCount: 0,
    zones,
    doorType: "wood",
    panelThickness,
    shelfThickness: panelThickness,
    backThickness: 6,
    legHeight,
    legSize,
    legShape: legShape as "box" | "tapered" | "bracket" | "plinth" | "panel-side",
    legInset,
    notes: `${notesLine}${legHeight > 0 ? `；加 ${legHeight}mm 底座腳（${legShape}）${legInset > 0 ? `，內縮 ${legInset}mm` : ""}` : ""}。層板可用層板釘做可調式。`,
  });
};
