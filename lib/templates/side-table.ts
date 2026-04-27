import type { FurnitureTemplate, OptionSpec } from "@/lib/types";
import { getOption } from "@/lib/types";
import { simpleTable } from "./_builders/simple-table";
import { applyStandardChecks } from "./_validators";

export const sideTableOptions: OptionSpec[] = [
  { group: "leg", type: "select", key: "legShape", label: "腳樣式", defaultValue: "box", choices: [
    { value: "box", label: "直腳" },
    { value: "tapered", label: "錐形腳" },
  ] },
  { group: "leg", type: "number", key: "legSize", label: "腳粗 (mm)", defaultValue: 35, min: 20, max: 120, step: 1 },
  { group: "top", type: "number", key: "topThickness", label: "桌面厚 (mm)", defaultValue: 25, min: 12, max: 60, step: 1 },
  { group: "apron", type: "number", key: "apronWidth", label: "牙板高 (mm)", defaultValue: 60, min: 30, max: 200, step: 5 },
  { group: "top", type: "number", key: "topOverhang", label: "桌面外伸 (mm)", defaultValue: 0, min: 0, max: 300, step: 5, help: "桌面超出桌腳外側的距離" },
  { group: "stretcher", type: "checkbox", key: "withLowerStretchers", label: "加下橫撐", defaultValue: false },
  { group: "leg", type: "number", key: "legInset", label: "桌腳內縮 (mm)", defaultValue: 0, min: 0, max: 300, step: 5 },
  { group: "apron", type: "number", key: "apronOffset", label: "牙板距桌面 (mm)", defaultValue: 20, min: 0, max: 200, step: 5 },
  { group: "stretcher", type: "number", key: "lowerStretcherHeight", label: "下橫撐離地高 (mm)", defaultValue: 0, min: 0, max: 500, step: 10, dependsOn: { key: "withLowerStretchers", equals: true } },
];

export const sideTable: FurnitureTemplate = (input) => {
  const legShape = getOption<string>(input, sideTableOptions[0]);
  const legSize = getOption<number>(input, sideTableOptions[1]);
  const topThickness = getOption<number>(input, sideTableOptions[2]);
  const apronWidth = getOption<number>(input, sideTableOptions[3]);
  const topOverhang = getOption<number>(input, sideTableOptions[4]);
  const withLowerStretchers = getOption<boolean>(input, sideTableOptions[5]);
  const legInset = getOption<number>(input, sideTableOptions[6]);
  const apronOffset = getOption<number>(input, sideTableOptions[7]);
  const lowerStretcherHeight = getOption<number>(input, sideTableOptions[8]);
  const design = simpleTable({
    category: "side-table",
    nameZh: "邊桌 / 床頭櫃",
    length: input.length,
    width: input.width,
    height: input.height,
    material: input.material,
    legSize,
    topThickness,
    apronWidth,
    topOverhang,
    withLowerStretchers,
    legInset,
    apronOffset,
    lowerStretcherHeight: lowerStretcherHeight > 0 ? lowerStretcherHeight : undefined,
    legShape: legShape === "tapered" ? "tapered" : "box",
    notes: "床側收納用矮桌，可加下橫撐增穩定。",
  });
  applyStandardChecks(design, { minLength: 300, minWidth: 250, minHeight: 400 });
  return design;
};
