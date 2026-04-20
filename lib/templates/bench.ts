import type { FurnitureTemplate, OptionSpec } from "@/lib/types";
import { getOption } from "@/lib/types";
import { simpleTable } from "./_builders/simple-table";

export const benchOptions: OptionSpec[] = [
  { type: "select", key: "legShape", label: "腳樣式", defaultValue: "box", choices: [
    { value: "box", label: "直腳" },
    { value: "tapered", label: "錐形腳" },
  ] },
  { type: "number", key: "legSize", label: "腳粗 (mm)", defaultValue: 40, min: 20, max: 120, step: 1 },
  { type: "number", key: "topThickness", label: "座板厚 (mm)", defaultValue: 30, min: 12, max: 60, step: 1 },
  { type: "number", key: "apronWidth", label: "牙板高 (mm)", defaultValue: 80, min: 30, max: 200, step: 5 },
  { type: "number", key: "apronOffset", label: "牙板距座板 (mm)", defaultValue: 20, min: 0, max: 400, step: 5 },
  { type: "checkbox", key: "withCenterStretcher", label: "加中央橫撐", defaultValue: false, help: "超過 1.2m 建議加" },
  { type: "checkbox", key: "withLowerStretchers", label: "加 4 邊下橫撐", defaultValue: false, help: "H 字形結構，更穩但費料" },
];

export const bench: FurnitureTemplate = (input) => {
  const legShape = getOption<string>(input, benchOptions[0]);
  const legSize = getOption<number>(input, benchOptions[1]);
  const topThickness = getOption<number>(input, benchOptions[2]);
  const apronWidth = getOption<number>(input, benchOptions[3]);
  const apronOffset = getOption<number>(input, benchOptions[4]);
  const withCenterStretcher = getOption<boolean>(input, benchOptions[5]);
  const withLowerStretchers = getOption<boolean>(input, benchOptions[6]);
  return simpleTable({
    category: "bench",
    nameZh: "長凳",
    length: input.length,
    width: input.width,
    height: input.height,
    material: input.material,
    legSize,
    topThickness,
    apronWidth,
    apronOffset,
    withCenterStretcher: withCenterStretcher || input.length > 1200,
    withLowerStretchers,
    legShape: legShape === "tapered" ? "tapered" : "box",
    notes: "長凳腳粗越大越穩；超過 1.2m 建議開啟中央橫撐防扭。",
  });
};
