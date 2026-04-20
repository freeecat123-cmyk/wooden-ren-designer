import type { FurnitureTemplate, OptionSpec } from "@/lib/types";
import { getOption } from "@/lib/types";
import { simpleTable } from "./_builders/simple-table";

export const lowTableOptions: OptionSpec[] = [
  { type: "select", key: "legShape", label: "腳樣式", defaultValue: "box", choices: [
    { value: "box", label: "直腳" },
    { value: "tapered", label: "錐形腳" },
  ] },
  { type: "number", key: "legSize", label: "腳粗 (mm)", defaultValue: 45, min: 20, max: 120, step: 1 },
  { type: "number", key: "topThickness", label: "桌面厚 (mm)", defaultValue: 28, min: 12, max: 60, step: 1 },
  { type: "number", key: "apronWidth", label: "牙板高 (mm)", defaultValue: 70, min: 30, max: 200, step: 5 },
  { type: "number", key: "topOverhang", label: "桌面外伸 (mm)", defaultValue: 20, min: 0, max: 300, step: 5 },
  { type: "checkbox", key: "withCenterStretcher", label: "加中央橫撐", defaultValue: false },
  { type: "checkbox", key: "withLowerStretchers", label: "加下橫撐", defaultValue: false },
  { type: "number", key: "legInset", label: "桌腳內縮 (mm)", defaultValue: 0, min: 0, max: 300, step: 5 },
  { type: "number", key: "apronOffset", label: "牙板距桌面 (mm)", defaultValue: 20, min: 0, max: 200, step: 5 },
  { type: "number", key: "lowerStretcherHeight", label: "下橫撐離地高 (mm)", defaultValue: 0, min: 0, max: 400, step: 10 },
];

export const lowTable: FurnitureTemplate = (input) => {
  const legShape = getOption<string>(input, lowTableOptions[0]);
  const legSize = getOption<number>(input, lowTableOptions[1]);
  const topThickness = getOption<number>(input, lowTableOptions[2]);
  const apronWidth = getOption<number>(input, lowTableOptions[3]);
  const topOverhang = getOption<number>(input, lowTableOptions[4]);
  const withCenterStretcher = getOption<boolean>(input, lowTableOptions[5]);
  const withLowerStretchers = getOption<boolean>(input, lowTableOptions[6]);
  const legInset = getOption<number>(input, lowTableOptions[7]);
  const apronOffset = getOption<number>(input, lowTableOptions[8]);
  const lowerStretcherHeight = getOption<number>(input, lowTableOptions[9]);
  return simpleTable({
    category: "low-table",
    nameZh: "矮桌",
    length: input.length,
    width: input.width,
    height: input.height,
    material: input.material,
    legSize,
    topThickness,
    apronWidth,
    topOverhang,
    withCenterStretcher: withCenterStretcher || input.length > 900,
    withLowerStretchers,
    legInset,
    apronOffset,
    lowerStretcherHeight: lowerStretcherHeight > 0 ? lowerStretcherHeight : undefined,
    legShape: legShape === "tapered" ? "tapered" : "box",
    notes: "和室矮桌、地板桌；席地而坐高度約 350mm。",
  });
};
