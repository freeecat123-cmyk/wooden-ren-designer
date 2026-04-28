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
  topPanelPiecesOption,
  topPanelPiecesNote,
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
  ] },
  { group: "leg", type: "number", key: "legSize", label: "桌腳粗 (mm)", defaultValue: 70, min: 20, max: 120, step: 2 },
  { group: "leg", type: "number", key: "legInset", label: "桌腳內縮 (mm)", defaultValue: 0, min: 0, max: 400, step: 5, help: "桌腳往內移，形成 reveal。0 = 與桌面邊緣齊平" },
  // 桌面 (top)
  { group: "top", type: "number", key: "topThickness", label: "桌面厚 (mm)", defaultValue: 30, min: 12, max: 60, step: 2 },
  { group: "top", type: "number", key: "topOverhang", label: "桌面外伸 (mm)", defaultValue: 40, min: 0, max: 300, step: 5, help: "桌面超出桌腳外側，決定膝蓋空間" },
  seatEdgeOption("top", 5),
  seatEdgeStyleOption("top"),
  topPanelPiecesOption("top"),
  { group: "top", type: "checkbox", key: "withBreadboardEnds", label: "桌面端板（防翹曲）", defaultValue: false, help: "兩端加垂直木條 + 企口接合，傳統實木桌防止跨度大時翹曲。中央穿釘固定、兩側鬆配讓木材熱漲冷縮", wide: true },
  { group: "top", type: "checkbox", key: "liveEdge", label: "Live edge 原木邊（保留樹皮邊）", defaultValue: false, help: "桌面長邊不切直、保留原木有機曲線。需用單片大板或拼板後留外緣不修", wide: true },
  { group: "top", type: "select", key: "topPattern", label: "桌面拼板花紋", defaultValue: "straight", choices: [
    { value: "straight", label: "直拼（一般拼板）" },
    { value: "herringbone", label: "人字拼（herringbone，45° 互鎖）" },
    { value: "chevron", label: "魚骨拼（chevron，等高 45° 對接）" },
    { value: "book-match", label: "對稱書配拼（book-matched，鏡像拼板）" },
    { value: "end-grain", label: "端紋拼板（butcher block，砧板款）" },
  ], help: "桌面板的拼接花紋。herringbone/chevron 需大量短料 + 精確角度切割，工時 +50%" },
  { group: "top", type: "checkbox", key: "withExtensionLeaf", label: "中央延伸板（extension leaf）", defaultValue: false, help: "桌面從中央分開，可加 1-2 片活動延伸板（每片 400mm 寬），平時收在桌下", wide: true },
  { group: "top", type: "select", key: "dropLeaf", label: "翻板（drop-leaf）", defaultValue: "none", choices: [
    { value: "none", label: "無" },
    { value: "one-side", label: "單側翻板（一端可延伸）" },
    { value: "two-sides", label: "雙側翻板（兩端可延伸）" },
  ], help: "桌面兩端用蝶式鉸鏈加可摺疊延伸板，展開變大、收合變小。需配 1.5\" 鋼製蝶式鉸鏈" },
  { group: "top", type: "number", key: "dropLeafWidth", label: "翻板寬 (mm)", defaultValue: 250, min: 150, max: 500, step: 25, dependsOn: { key: "dropLeaf", notIn: ["none"] } },
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
  const topPanelPieces = parseInt(getOption<string>(input, opt(o, "topPanelPieces"))) || 1;
  const withBreadboardEnds = getOption<boolean>(input, opt(o, "withBreadboardEnds"));
  const liveEdge = getOption<boolean>(input, opt(o, "liveEdge"));
  const topPattern = getOption<string>(input, opt(o, "topPattern"));
  const withExtensionLeaf = getOption<boolean>(input, opt(o, "withExtensionLeaf"));
  const dropLeaf = getOption<string>(input, opt(o, "dropLeaf"));
  const dropLeafWidth = getOption<number>(input, opt(o, "dropLeafWidth"));
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
    topPanelPieces,
    withBreadboardEnds,
    liveEdge,
    dropLeaf: dropLeaf as "none" | "one-side" | "two-sides",
    dropLeafWidth,
    notes: `餐桌結構：桌腳 ${legSize}mm（${legShapeLabel(legShape)}）、牙板 ${apronWidth}×${apronThickness}mm、桌面 ${topThickness}mm 厚。${topPanelPiecesNote(topPanelPieces, input.width)}${withBreadboardEnds ? " 桌面兩端加端板（企口接合，中央穿釘 + 兩側鬆配吸收木材形變）。" : ""}${liveEdge ? " 桌面 live edge：保留原木樹皮邊，需用單片大板（>600mm 寬）或拼板後留外緣不修。" : ""}${dropLeaf !== "none" ? ` ${dropLeaf === "one-side" ? "單" : "雙"}側翻板（每片 ${dropLeafWidth}mm 寬，配 1.5" 鋼製蝶式鉸鏈一對 / 端）。` : ""}${topPattern === "herringbone" ? " 桌面採人字拼（herringbone）：短料 80×400mm 互相鎖合 45° 排列，工時 +50%。" : topPattern === "chevron" ? " 桌面採魚骨拼（chevron）：等高 45° 對接，視覺更有方向感、工時 +50%。" : topPattern === "book-match" ? " 桌面採對稱書配拼（book-matched）：中央剖板鏡像對拼，紋路成蝴蝶狀。" : topPattern === "end-grain" ? " 桌面採端紋拼板（butcher block）：木紋朝上、像砧板，不易刮痕、超耐磨。" : ""}${withExtensionLeaf ? " 桌面中央分開，含 1 片 400mm 寬活動延伸板（用桌下夾扣固定，平時可拆下平放收納）。" : ""}`,
  });
  applyStandardChecks(design, {
    minLength: 900, minWidth: 600, minHeight: 600,
    maxLength: 2400, maxWidth: 1200, maxHeight: 800,
  });
  return design;
};
