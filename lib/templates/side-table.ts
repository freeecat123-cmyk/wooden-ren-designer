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

export const sideTableOptions: OptionSpec[] = [
  { group: "leg", type: "select", key: "legShape", label: "腳樣式", defaultValue: "box", choices: [
    { value: "box", label: "直腳" },
    { value: "tapered", label: "錐形腳" },
  ] },
  { group: "leg", type: "number", key: "legSize", label: "腳粗 (mm)", defaultValue: 35, min: 20, max: 120, step: 1 },
  { group: "top", type: "number", key: "topThickness", label: "桌面厚 (mm)", defaultValue: 25, min: 12, max: 60, step: 1 },
  seatEdgeOption("top", 5),
  seatEdgeStyleOption("top"),
  topPanelPiecesOption("top"),
  legEdgeOption("leg", 1),
  legEdgeStyleOption("leg"),
  stretcherEdgeOption("stretcher", 1),
  stretcherEdgeStyleOption("stretcher"),
  { group: "apron", type: "number", key: "apronWidth", label: "牙板高 (mm)", defaultValue: 60, min: 30, max: 200, step: 5 },
  { group: "top", type: "number", key: "topOverhang", label: "桌面外伸 (mm)", defaultValue: 0, min: 0, max: 300, step: 5, help: "桌面超出桌腳外側的距離" },
  { group: "stretcher", type: "checkbox", key: "withLowerStretchers", label: "加下橫撐", defaultValue: false },
  { group: "leg", type: "number", key: "legInset", label: "桌腳內縮 (mm)", defaultValue: 0, min: 0, max: 300, step: 5 },
  { group: "apron", type: "number", key: "apronOffset", label: "牙板距桌面 (mm)", defaultValue: 8, min: 0, max: 200, step: 5, help: "邊桌總高約 600，5–10 比例適中" },
  { group: "stretcher", type: "number", key: "lowerStretcherHeight", label: "下橫撐離地高 (mm)", defaultValue: 0, min: 0, max: 500, step: 10, dependsOn: { key: "withLowerStretchers", equals: true } },
];

export const sideTable: FurnitureTemplate = (input) => {
  const o = sideTableOptions;
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
  const apronWidth = getOption<number>(input, opt(o, "apronWidth"));
  const topOverhang = getOption<number>(input, opt(o, "topOverhang"));
  const withLowerStretchers = getOption<boolean>(input, opt(o, "withLowerStretchers"));
  const legInset = getOption<number>(input, opt(o, "legInset"));
  const apronOffset = getOption<number>(input, opt(o, "apronOffset"));
  const lowerStretcherHeight = getOption<number>(input, opt(o, "lowerStretcherHeight"));
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
    seatEdge,
    seatEdgeStyle,
    legEdge,
    legEdgeStyle,
    stretcherEdge,
    stretcherEdgeStyle,
    topPanelPieces,
    notes: `床側收納用矮桌，可加下橫撐增穩定。${topPanelPiecesNote(topPanelPieces, input.width)}`,
  });
  applyStandardChecks(design, {
    minLength: 300, minWidth: 250, minHeight: 400,
    maxLength: 700, maxWidth: 550, maxHeight: 800,
  });
  if (input.length > 700 || input.width > 550) {
    appendSuggestion(design, {
      text: `${input.length}×${input.width}mm 已大於床頭櫃——抽屜櫃模板含完整抽屜結構。`,
      suggestedCategory: "chest-of-drawers",
      presetParams: { length: input.length, width: input.width, height: input.height, material: input.material },
    });
  }
  return design;
};
