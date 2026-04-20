import type { FurnitureTemplate, OptionSpec } from "@/lib/types";
import { getOption } from "@/lib/types";
import { simpleTable } from "./_builders/simple-table";

export const diningTableOptions: OptionSpec[] = [
  { type: "select", key: "legShape", label: "桌腳樣式", defaultValue: "box", choices: [
    { value: "box", label: "直腳（方料）" },
    { value: "tapered", label: "錐形腳（下方收窄）" },
  ] },
  { type: "number", key: "legSize", label: "桌腳粗 (mm)", defaultValue: 70, min: 20, max: 120, step: 2 },
  { type: "number", key: "topThickness", label: "桌面厚 (mm)", defaultValue: 30, min: 12, max: 60, step: 2 },
  { type: "number", key: "apronWidth", label: "牙板高 (mm)", defaultValue: 100, min: 30, max: 200, step: 5 },
  { type: "number", key: "apronThickness", label: "牙板厚 (mm)", defaultValue: 28, min: 10, max: 50, step: 2 },
  { type: "number", key: "topOverhang", label: "桌面外伸 (mm)", defaultValue: 40, min: 0, max: 300, step: 5, help: "桌面超出桌腳外側，決定膝蓋空間" },
  { type: "checkbox", key: "withCenterStretcher", label: "中央橫撐", defaultValue: true, help: "長桌必備，防扭" },
  { type: "checkbox", key: "withLowerStretchers", label: "下橫撐（明式結構）", defaultValue: false },
];

export const diningTable: FurnitureTemplate = (input) => {
  const legShape = getOption<string>(input, diningTableOptions[0]);
  const legSize = getOption<number>(input, diningTableOptions[1]);
  const topThickness = getOption<number>(input, diningTableOptions[2]);
  const apronWidth = getOption<number>(input, diningTableOptions[3]);
  const apronThickness = getOption<number>(input, diningTableOptions[4]);
  const topOverhang = getOption<number>(input, diningTableOptions[5]);
  const withCenterStretcher = getOption<boolean>(input, diningTableOptions[6]);
  const withLowerStretchers = getOption<boolean>(input, diningTableOptions[7]);
  return simpleTable({
    category: "dining-table",
    nameZh: "餐桌",
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
    legShape: legShape === "tapered" ? "tapered" : "box",
    notes: `餐桌結構：桌腳 ${legSize}mm（${legShape === "tapered" ? "錐形" : "方料"}）、牙板 ${apronWidth}×${apronThickness}mm、桌面 ${topThickness}mm 厚。`,
  });
};
