import type { FurnitureTemplate, OptionSpec } from "@/lib/types";
import { getOption } from "@/lib/types";
import { simpleTable } from "./_builders/simple-table";

export const deskOptions: OptionSpec[] = [
  { type: "number", key: "legSize", label: "桌腳粗 (mm)", defaultValue: 55, min: 40, max: 80, step: 2 },
  { type: "number", key: "topThickness", label: "桌面厚 (mm)", defaultValue: 28, min: 22, max: 45, step: 2 },
  { type: "number", key: "apronWidth", label: "牙板高 (mm)", defaultValue: 90, min: 60, max: 130, step: 5 },
  { type: "number", key: "apronThickness", label: "牙板厚 (mm)", defaultValue: 25, min: 18, max: 35, step: 2 },
  { type: "number", key: "topOverhang", label: "桌面外伸 (mm)", defaultValue: 30, min: 0, max: 120, step: 5 },
  { type: "checkbox", key: "withCenterStretcher", label: "中央橫撐", defaultValue: true },
  { type: "checkbox", key: "withLowerStretchers", label: "下橫撐", defaultValue: false },
];

export const desk: FurnitureTemplate = (input) => {
  const legSize = getOption<number>(input, deskOptions[0]);
  const topThickness = getOption<number>(input, deskOptions[1]);
  const apronWidth = getOption<number>(input, deskOptions[2]);
  const apronThickness = getOption<number>(input, deskOptions[3]);
  const topOverhang = getOption<number>(input, deskOptions[4]);
  const withCenterStretcher = getOption<boolean>(input, deskOptions[5]);
  const withLowerStretchers = getOption<boolean>(input, deskOptions[6]);
  return simpleTable({
    category: "desk",
    nameZh: "書桌",
    length: input.length,
    width: input.width,
    height: input.height,
    material: input.material,
    legSize,
    topThickness,
    apronWidth,
    apronThickness,
    topOverhang,
    withCenterStretcher,
    withLowerStretchers,
    notes: `書桌：桌腳 ${legSize}mm、牙板 ${apronWidth}×${apronThickness}mm。`,
  });
};
