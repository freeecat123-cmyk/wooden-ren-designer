import type { FurnitureTemplate, OptionSpec } from "@/lib/types";
import { getOption, opt } from "@/lib/types";
import { simpleTable } from "./_builders/simple-table";
import { applyStandardChecks, appendSuggestion } from "./_validators";
import {
  seatEdgeOption,
  seatEdgeStyleOption,
  legEdgeOption,
  legEdgeStyleOption,
  stretcherEdgeOption,
  stretcherEdgeStyleOption,
  topPanelPiecesOption,
  topPanelPiecesNote,
} from "./_helpers";

export const lowTableOptions: OptionSpec[] = [
  { group: "leg", type: "select", key: "legShape", label: "腳樣式", defaultValue: "box", choices: [
    { value: "box", label: "直腳" },
    { value: "tapered", label: "錐形腳" },
  ] },
  { group: "leg", type: "number", key: "legSize", label: "腳粗 (mm)", defaultValue: 45, min: 20, max: 120, step: 1 },
  { group: "top", type: "number", key: "topThickness", label: "桌面厚 (mm)", defaultValue: 28, min: 12, max: 60, step: 1 },
  seatEdgeOption("top", 5),
  seatEdgeStyleOption("top"),
  topPanelPiecesOption("top"),
  { group: "top", type: "checkbox", key: "withBreadboardEnds", label: "桌面端板（防翹曲）", defaultValue: false, help: "兩端加垂直木條 + 企口接合，防止跨度大時翹曲", wide: true },
  { group: "top", type: "checkbox", key: "liveEdge", label: "Live edge 原木邊", defaultValue: false, help: "桌面長邊保留原木樹皮曲線", wide: true },
  { group: "top", type: "select", key: "dropLeaf", label: "翻板（drop-leaf）", defaultValue: "none", choices: [
    { value: "none", label: "無" },
    { value: "one-side", label: "單側翻板" },
    { value: "two-sides", label: "雙側翻板" },
  ], help: "兩端用蝶式鉸鏈加可摺疊延伸板" },
  { group: "top", type: "number", key: "dropLeafWidth", label: "翻板寬 (mm)", defaultValue: 200, min: 150, max: 400, step: 25, dependsOn: { key: "dropLeaf", notIn: ["none"] } },
  legEdgeOption("leg", 1),
  legEdgeStyleOption("leg"),
  stretcherEdgeOption("stretcher", 1),
  stretcherEdgeStyleOption("stretcher"),
  { group: "apron", type: "number", key: "apronWidth", label: "牙板高 (mm)", defaultValue: 70, min: 30, max: 200, step: 5 },
  { group: "top", type: "number", key: "topOverhang", label: "桌面外伸 (mm)", defaultValue: 20, min: 0, max: 300, step: 5 },
  { group: "stretcher", type: "checkbox", key: "withCenterStretcher", label: "加中央橫撐", defaultValue: false },
  { group: "stretcher", type: "checkbox", key: "withLowerStretchers", label: "加下橫撐", defaultValue: false },
  { group: "leg", type: "number", key: "legInset", label: "桌腳內縮 (mm)", defaultValue: 0, min: 0, max: 300, step: 5 },
  { group: "apron", type: "number", key: "apronOffset", label: "牙板距桌面 (mm)", defaultValue: 20, min: 0, max: 200, step: 5 },
  { group: "stretcher", type: "number", key: "lowerStretcherHeight", label: "下橫撐離地高 (mm)", defaultValue: 0, min: 0, max: 400, step: 10, dependsOn: { key: "withLowerStretchers", equals: true } },
];

export const lowTable: FurnitureTemplate = (input) => {
  const o = lowTableOptions;
  const legShape = getOption<string>(input, opt(o, "legShape"));
  const legSize = getOption<number>(input, opt(o, "legSize"));
  const topThickness = getOption<number>(input, opt(o, "topThickness"));
  const seatEdge = getOption<number>(input, opt(o, "seatEdge"));
  const seatEdgeStyle = getOption<string>(input, opt(o, "seatEdgeStyle"));
  const legEdge = getOption<number>(input, opt(o, "legEdge"));
  const legEdgeStyle = getOption<string>(input, opt(o, "legEdgeStyle"));
  const stretcherEdge = getOption<number>(input, opt(o, "stretcherEdge"));
  const stretcherEdgeStyle = getOption<string>(input, opt(o, "stretcherEdgeStyle"));
  const topPanelPieces = parseInt(getOption<string>(input, opt(o, "topPanelPieces"))) || 1;
  const withBreadboardEnds = getOption<boolean>(input, opt(o, "withBreadboardEnds"));
  const liveEdge = getOption<boolean>(input, opt(o, "liveEdge"));
  const dropLeaf = getOption<string>(input, opt(o, "dropLeaf"));
  const dropLeafWidth = getOption<number>(input, opt(o, "dropLeafWidth"));
  const apronWidth = getOption<number>(input, opt(o, "apronWidth"));
  const topOverhang = getOption<number>(input, opt(o, "topOverhang"));
  const withCenterStretcher = getOption<boolean>(input, opt(o, "withCenterStretcher"));
  const withLowerStretchers = getOption<boolean>(input, opt(o, "withLowerStretchers"));
  const legInset = getOption<number>(input, opt(o, "legInset"));
  const apronOffset = getOption<number>(input, opt(o, "apronOffset"));
  const lowerStretcherHeight = getOption<number>(input, opt(o, "lowerStretcherHeight"));
  const design = simpleTable({
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
    seatEdge,
    seatEdgeStyle,
    legEdge,
    legEdgeStyle,
    stretcherEdge,
    stretcherEdgeStyle,
    topPanelPieces,
    withBreadboardEnds,
    liveEdge,
    dropLeaf: dropLeaf as "none" | "one-side" | "two-sides",
    dropLeafWidth,
    notes: `和室矮桌、地板桌；席地而坐高度約 350mm。${topPanelPiecesNote(topPanelPieces, input.width)}${withBreadboardEnds ? " 桌面兩端加端板防翹。" : ""}${liveEdge ? " Live edge 原木邊。" : ""}${dropLeaf !== "none" ? ` 含${dropLeaf === "one-side" ? "單" : "雙"}側翻板（每片 ${dropLeafWidth}mm 寬）。` : ""}`,
  });
  applyStandardChecks(design, {
    minLength: 500, minWidth: 400, minHeight: 250,
    maxLength: 1400, maxWidth: 1000, maxHeight: 450,
  });
  if (input.height > 450) {
    appendSuggestion(design, {
      text: `桌高 ${input.height}mm 已超過矮桌範圍——餐桌模板適合站立 / 坐椅高度。`,
      suggestedCategory: "dining-table",
      presetParams: { length: input.length, width: input.width, height: input.height, material: input.material },
    });
  }
  return design;
};
