import type { FurnitureTemplate, OptionSpec } from "@/lib/types";
import { getOption, opt } from "@/lib/types";
import { simpleTable } from "./_builders/simple-table";
import {
  legShapeLabel,
  seatEdgeOption,
  seatEdgeStyleOption,
  legEdgeOption,
  legEdgeStyleOption,
  stretcherEdgeOption,
  stretcherEdgeStyleOption,
} from "./_helpers";
import { applyStandardChecks } from "./_validators";

export const diningTableOptions: OptionSpec[] = [
  // 桌腳 (leg)
  { group: "leg", type: "select", key: "legShape", label: "桌腳樣式", defaultValue: "box", choices: [
    { value: "box", label: "方直腳" },
    { value: "tapered", label: "錐形腳（下方收窄）" },
    { value: "strong-taper", label: "方錐漸縮（大幅下收）" },
    { value: "inverted", label: "倒錐腳（下方更粗）" },
    { value: "splayed", label: "斜腳（整支外傾）" },
    { value: "hoof", label: "馬蹄腳（底部外撇）" },
  ] },
  { group: "leg", type: "number", key: "legSize", label: "桌腳粗 (mm)", defaultValue: 70, min: 20, max: 120, step: 2 },
  { group: "leg", type: "number", key: "legInset", label: "桌腳內縮 (mm)", defaultValue: 0, min: 0, max: 400, step: 5, help: "桌腳往內移，形成 reveal。0 = 與桌面邊緣齊平" },
  // 桌面 (top)
  { group: "top", type: "number", key: "topThickness", label: "桌面厚 (mm)", defaultValue: 30, min: 12, max: 60, step: 2 },
  { group: "top", type: "number", key: "topOverhang", label: "桌面外伸 (mm)", defaultValue: 40, min: 0, max: 300, step: 5, help: "桌面超出桌腳外側，決定膝蓋空間" },
  seatEdgeOption("top", 5),
  seatEdgeStyleOption("top"),
  legEdgeOption("leg", 1),
  legEdgeStyleOption("leg"),
  stretcherEdgeOption("stretcher", 1),
  stretcherEdgeStyleOption("stretcher"),
  // 牙板 (apron)
  { group: "apron", type: "number", key: "apronWidth", label: "牙板高 (mm)", defaultValue: 100, min: 30, max: 200, step: 5 },
  { group: "apron", type: "number", key: "apronThickness", label: "牙板厚 (mm)", defaultValue: 28, min: 10, max: 50, step: 2 },
  { group: "apron", type: "number", key: "apronOffset", label: "牙板距桌面 (mm)", defaultValue: 20, min: 0, max: 300, step: 5, help: "牙板頂緣往下退的距離" },
  // 中央/下橫撐 (stretchers)
  { group: "stretcher", type: "checkbox", key: "withCenterStretcher", label: "中央橫撐", defaultValue: true, help: "長桌必備，防扭" },
  { group: "stretcher", type: "number", key: "centerStretcherWidth", label: "中央橫撐高 (mm)", defaultValue: 50, min: 20, max: 150, step: 5, dependsOn: { key: "withCenterStretcher" } },
  { group: "stretcher", type: "number", key: "centerStretcherThickness", label: "中央橫撐厚 (mm)", defaultValue: 25, min: 12, max: 50, step: 1, dependsOn: { key: "withCenterStretcher" } },
  { group: "stretcher", type: "number", key: "centerStretcherDrop", label: "中央橫撐距牙板頂 (mm)", defaultValue: 0, min: 0, max: 200, step: 5, help: "0 = 自動置中於牙板", dependsOn: { key: "withCenterStretcher" } },
  { group: "stretcher", type: "checkbox", key: "withLowerStretchers", label: "下橫撐（明式結構）", defaultValue: false },
  { group: "stretcher", type: "number", key: "lowerStretcherWidth", label: "下橫撐高 (mm)", defaultValue: 40, min: 20, max: 150, step: 5, dependsOn: { key: "withLowerStretchers" } },
  { group: "stretcher", type: "number", key: "lowerStretcherThickness", label: "下橫撐厚 (mm)", defaultValue: 20, min: 10, max: 50, step: 1, dependsOn: { key: "withLowerStretchers" } },
  { group: "stretcher", type: "number", key: "lowerStretcherHeight", label: "下橫撐離地高 (mm)", defaultValue: 0, min: 0, max: 700, step: 10, help: "設 0 = 自動（腳高的 22%）", dependsOn: { key: "withLowerStretchers" } },
];

export const diningTable: FurnitureTemplate = (input) => {
  const o = diningTableOptions;
  const legShape = getOption<string>(input, opt(o, "legShape"));
  const legSize = getOption<number>(input, opt(o, "legSize"));
  const legInset = getOption<number>(input, opt(o, "legInset"));
  const topThickness = getOption<number>(input, opt(o, "topThickness"));
  const topOverhang = getOption<number>(input, opt(o, "topOverhang"));
  const apronWidth = getOption<number>(input, opt(o, "apronWidth"));
  const apronThickness = getOption<number>(input, opt(o, "apronThickness"));
  const apronOffset = getOption<number>(input, opt(o, "apronOffset"));
  const withCenterStretcher = getOption<boolean>(input, opt(o, "withCenterStretcher"));
  const centerStretcherWidth = getOption<number>(input, opt(o, "centerStretcherWidth"));
  const centerStretcherThickness = getOption<number>(input, opt(o, "centerStretcherThickness"));
  const centerStretcherDrop = getOption<number>(input, opt(o, "centerStretcherDrop"));
  const withLowerStretchers = getOption<boolean>(input, opt(o, "withLowerStretchers"));
  const lowerStretcherWidth = getOption<number>(input, opt(o, "lowerStretcherWidth"));
  const lowerStretcherThickness = getOption<number>(input, opt(o, "lowerStretcherThickness"));
  const lowerStretcherHeight = getOption<number>(input, opt(o, "lowerStretcherHeight"));
  const seatEdge = getOption<number>(input, opt(o, "seatEdge"));
  const seatEdgeStyle = getOption<string>(input, opt(o, "seatEdgeStyle"));
  const legEdge = getOption<number>(input, opt(o, "legEdge"));
  const legEdgeStyle = getOption<string>(input, opt(o, "legEdgeStyle"));
  const stretcherEdge = getOption<number>(input, opt(o, "stretcherEdge"));
  const stretcherEdgeStyle = getOption<string>(input, opt(o, "stretcherEdgeStyle"));
  const design = simpleTable({
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
    centerStretcherWidth,
    centerStretcherThickness,
    centerStretcherDrop: centerStretcherDrop > 0 ? centerStretcherDrop : undefined,
    withLowerStretchers,
    lowerStretcherWidth,
    lowerStretcherThickness,
    legInset,
    apronOffset,
    lowerStretcherHeight: lowerStretcherHeight > 0 ? lowerStretcherHeight : undefined,
    legShape: legShape as "box" | "tapered" | "strong-taper" | "inverted" | "splayed" | "hoof",
    seatEdge,
    seatEdgeStyle,
    legEdge,
    legEdgeStyle,
    stretcherEdge,
    stretcherEdgeStyle,
    notes: `餐桌結構：桌腳 ${legSize}mm（${legShapeLabel(legShape)}）、牙板 ${apronWidth}×${apronThickness}mm、桌面 ${topThickness}mm 厚。`,
  });
  applyStandardChecks(design, {
    minLength: 900, minWidth: 600, minHeight: 600,
    maxLength: 2400, maxWidth: 1200, maxHeight: 800,
  });
  return design;
};
