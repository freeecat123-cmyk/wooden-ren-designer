import type { FurnitureTemplate, OptionSpec } from "@/lib/types";
import { getOption } from "@/lib/types";
import { caseFurniture } from "./_builders/case-furniture";

export const openBookshelfOptions: OptionSpec[] = [
  { group: "top", type: "number", key: "shelfCount", label: "層板數（不含頂底）", defaultValue: 4, min: 0, max: 20, step: 1 },
  { group: "top", type: "number", key: "panelThickness", label: "板材厚 (mm)", defaultValue: 18, min: 9, max: 35, step: 1 },
  { group: "back", type: "number", key: "backThickness", label: "背板厚 (mm)", defaultValue: 6, min: 0, max: 18, step: 1, help: "設 0 則無背板" },
  { group: "leg", type: "number", key: "legHeight", label: "底座腳高 (mm)", defaultValue: 0, min: 0, max: 400, step: 10 },
  { group: "leg", type: "number", key: "legSize", label: "腳粗 (mm)", defaultValue: 35, min: 20, max: 120, step: 5 },
  { group: "leg", type: "select", key: "legShape", label: "腳樣式", defaultValue: "box", choices: [
    { value: "box", label: "直腳" },
    { value: "tapered", label: "錐形腳" },
    { value: "bracket", label: "帶托腳牙" },
    { value: "plinth", label: "平台底座" },
    { value: "panel-side", label: "側板延伸落地（書櫃常見）" },
  ] },
  { group: "leg", type: "number", key: "legInset", label: "腳內縮 (mm)", defaultValue: 0, min: 0, max: 300, step: 5 },
];

export const openBookshelf: FurnitureTemplate = (input) => {
  const shelfCount = getOption<number>(input, openBookshelfOptions[0]);
  const panelThickness = getOption<number>(input, openBookshelfOptions[1]);
  const backThickness = getOption<number>(input, openBookshelfOptions[2]);
  const legHeight = getOption<number>(input, openBookshelfOptions[3]);
  const legSize = getOption<number>(input, openBookshelfOptions[4]);
  const legShape = getOption<string>(input, openBookshelfOptions[5]);
  const legInset = getOption<number>(input, openBookshelfOptions[6]);
  return caseFurniture({
    category: "open-bookshelf",
    nameZh: "開放書櫃",
    length: input.length,
    width: input.width,
    height: input.height,
    material: input.material,
    shelfCount,
    panelThickness,
    shelfThickness: panelThickness,
    backThickness,
    legHeight,
    legSize,
    legShape: legShape as "box" | "tapered" | "bracket" | "plinth" | "panel-side",
    legInset,
    notes: `${shelfCount + 2} 層開放式書櫃（含頂底板）${legHeight > 0 ? `；加 ${legHeight}mm ${legShape} 腳${legInset > 0 ? `（內縮 ${legInset}mm）` : ""}` : ""}。`,
  });
};
