import type { FurnitureTemplate, OptionSpec } from "@/lib/types";
import { getOption } from "@/lib/types";
import { caseFurniture } from "./_builders/case-furniture";

export const wardrobeOptions: OptionSpec[] = [
  { type: "number", key: "hangingHeight", label: "吊衣空間高 (mm)", defaultValue: 1100, min: 600, max: 1600, step: 50, help: "長外套建議 1100+，短衫 900 即可" },
  { type: "number", key: "shelfCount", label: "上方層板數", defaultValue: 1, min: 0, max: 4, step: 1, help: "吊衣空間上方的收納層板" },
  { type: "number", key: "bottomDrawerCount", label: "下方抽屜數", defaultValue: 2, min: 0, max: 4, step: 1 },
  { type: "number", key: "bottomDrawerHeight", label: "抽屜區總高 (mm)", defaultValue: 400, min: 0, max: 800, step: 50, help: "多個抽屜平分此高度；設 0 則無抽屜" },
  { type: "number", key: "doorCount", label: "門板數", defaultValue: 2, min: 0, max: 4, step: 1 },
  { type: "number", key: "panelThickness", label: "板材厚 (mm)", defaultValue: 18, min: 15, max: 25, step: 1 },
  { type: "number", key: "legHeight", label: "底座腳高 (mm)", defaultValue: 80, min: 0, max: 200, step: 10 },
];

export const wardrobe: FurnitureTemplate = (input) => {
  const hangingHeight = getOption<number>(input, wardrobeOptions[0]);
  const shelfCount = getOption<number>(input, wardrobeOptions[1]);
  const bottomDrawerCount = getOption<number>(input, wardrobeOptions[2]);
  const bottomDrawerHeight = getOption<number>(input, wardrobeOptions[3]);
  const doorCount = getOption<number>(input, wardrobeOptions[4]);
  const panelThickness = getOption<number>(input, wardrobeOptions[5]);
  const legHeight = getOption<number>(input, wardrobeOptions[6]);

  const caseHeight = input.height - legHeight;
  const innerH = caseHeight - 2 * panelThickness;

  // Y positions as fractions of innerH (bottom=0, top=1)
  const drawerFrac = bottomDrawerCount > 0 ? bottomDrawerHeight / innerH : 0;
  const hangingFrac = hangingHeight / innerH;
  const fractions: number[] = [];

  // 抽屜上方的水平分隔板（分開抽屜區與吊衣區）
  if (drawerFrac > 0 && drawerFrac < 1) fractions.push(drawerFrac);

  // 吊衣區上方的分隔（分開吊衣與上層層板）
  const topDividerFrac = Math.min(0.98, drawerFrac + hangingFrac);
  if (topDividerFrac < 0.98 && shelfCount > 0) fractions.push(topDividerFrac);

  // 上方層板分隔
  if (shelfCount > 0) {
    const topArea = 1 - topDividerFrac;
    for (let i = 1; i < shelfCount; i++) {
      fractions.push(topDividerFrac + (topArea * i) / shelfCount);
    }
  }

  fractions.sort((a, b) => a - b);

  return caseFurniture({
    category: "wardrobe",
    nameZh: "衣櫃",
    length: input.length,
    width: input.width,
    height: input.height,
    material: input.material,
    shelfCount: 0, // use customShelfFractions instead
    customShelfFractions: fractions,
    drawerCount: bottomDrawerCount,
    drawerCols: 1,
    drawerAreaHeight: bottomDrawerHeight,
    doorCount,
    doorType: "wood",
    panelThickness,
    shelfThickness: panelThickness,
    backThickness: 6,
    legHeight,
    legSize: 45,
    hangingArea: { yStart: drawerFrac, yEnd: topDividerFrac },
    notes: `衣櫃：吊衣空間 ${hangingHeight}mm；下方 ${bottomDrawerCount} 抽屜；上方 ${shelfCount} 層板；${doorCount} 扇門。需配吊衣桿、門鉸鏈、抽屜滑軌。`,
  });
};
