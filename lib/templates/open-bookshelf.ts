import type { FurnitureTemplate, OptionSpec } from "@/lib/types";
import { getOption } from "@/lib/types";
import { caseFurniture } from "./_builders/case-furniture";

export const openBookshelfOptions: OptionSpec[] = [
  { type: "number", key: "shelfCount", label: "層板數（不含頂底）", defaultValue: 4, min: 1, max: 8, step: 1 },
  { type: "number", key: "panelThickness", label: "板材厚 (mm)", defaultValue: 18, min: 15, max: 28, step: 1 },
  { type: "number", key: "backThickness", label: "背板厚 (mm)", defaultValue: 6, min: 0, max: 12, step: 1, help: "設 0 則無背板" },
  { type: "number", key: "legHeight", label: "底座腳高 (mm)", defaultValue: 0, min: 0, max: 200, step: 10 },
];

export const openBookshelf: FurnitureTemplate = (input) => {
  const shelfCount = getOption<number>(input, openBookshelfOptions[0]);
  const panelThickness = getOption<number>(input, openBookshelfOptions[1]);
  const backThickness = getOption<number>(input, openBookshelfOptions[2]);
  const legHeight = getOption<number>(input, openBookshelfOptions[3]);
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
    notes: `${shelfCount + 2} 層開放式書櫃（含頂底板）。`,
  });
};
