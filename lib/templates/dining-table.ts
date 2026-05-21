import type { FurnitureDesign, FurnitureTemplate, OptionSpec, Part } from "@/lib/types";
import { getOption, opt } from "@/lib/types";
import { simpleTable, LEG_FACE_INSET } from "./_builders/simple-table";
import {
  legShapeLabel,
  seatEdgeOption,
  seatEdgeStyleOption,
  legEdgeOption,
  legEdgeStyleOption,
  stretcherEdgeOption,
  stretcherEdgeStyleOption,
  apronEdgeOption,
  apronEdgeStyleOption,
} from "./_helpers";
import { applyStandardChecks } from "./_validators";

export const diningTableOptions: OptionSpec[] = [
  // 桌腳 (leg)
  { group: "leg", type: "select", key: "legShape", label: "桌腳樣式", defaultValue: "box", choices: [
    { value: "box", label: "方直腳" },
    { value: "tapered", label: "錐形腳（下方收窄）" },
    { value: "strong-taper", label: "方錐漸縮（大幅下收）" },
    { value: "inverted", label: "倒錐腳（下方更粗）" },
    { value: "splayed", label: "斜腳（四角對角外傾）" },
    { value: "splayed-length", label: "斜腳（沿長邊單向外傾）" },
    { value: "splayed-width", label: "斜腳（沿寬邊單向外傾）" },
    { value: "trestle", label: "對柱腳（兩端梁框 + 中央橫木）" },
  ] },
  { group: "leg", type: "number", key: "legSize", label: "桌腳粗 (mm)", defaultValue: 70, min: 20, max: 120, step: 2 },
  { group: "leg", type: "number", key: "legInset", label: "桌腳內縮 (mm)", defaultValue: 0, min: 0, max: 400, step: 5, help: "桌腳往內移，形成 reveal。0 = 與桌面邊緣齊平" },
  // 桌面 (top)
  { group: "top", type: "number", key: "topThickness", label: "桌面厚 (mm)", defaultValue: 30, min: 12, max: 60, step: 2 },
  { ...seatEdgeOption("top", 5), dependsOn: { key: "liveEdge", notIn: [true] } },
  { ...seatEdgeStyleOption("top"), dependsOn: { all: [{ key: "seatEdge", notIn: [0] }, { key: "liveEdge", notIn: [true] }] } },
  { group: "top", type: "checkbox", key: "liveEdge", label: "Live edge 原木邊（保留樹皮邊）", defaultValue: false, help: "桌面長邊不切直、保留原木有機曲線。需用單片大板或拼板後留外緣不修", wide: true },
  { group: "top", type: "select", key: "dropLeaf", label: "翻板（drop-leaf）", defaultValue: "none", choices: [
    { value: "none", label: "無" },
    { value: "one-side", label: "單側翻板（一端可延伸）" },
    { value: "two-sides", label: "雙側翻板（兩端可延伸）" },
  ], help: "桌面兩端用蝶式鉸鏈加可摺疊延伸板，展開變大、收合變小。需配 1.5\" 鋼製蝶式鉸鏈" },
  { group: "top", type: "number", key: "dropLeafWidth", label: "翻板寬 (mm)", defaultValue: 300, min: 150, max: 500, step: 25, dependsOn: { key: "dropLeaf", notIn: ["none"] } },
  legEdgeOption("leg", 1),
  legEdgeStyleOption("leg"),
  stretcherEdgeOption("stretcher", 1),
  stretcherEdgeStyleOption("stretcher"),
  // 牙板 (apron)
  { group: "apron", type: "number", key: "apronWidth", label: "牙板高 (mm)", defaultValue: 100, min: 30, max: 200, step: 5 },
  { group: "apron", type: "number", key: "apronThickness", label: "牙板厚 (mm)", defaultValue: 28, min: 10, max: 50, step: 2 },
  { group: "apron", type: "number", key: "apronOffset", label: "牙板距桌面 (mm)", defaultValue: 0, min: 0, max: 300, step: 5, help: "牙板頂緣往下退的距離" },
  apronEdgeOption("apron", 1),
  apronEdgeStyleOption("apron"),
  { group: "apron", type: "checkbox", key: "legPenetratingTenon", label: "腳上榫頭通透（明榫裝飾）", defaultValue: false, help: "勾選：牙板/下橫撐進腳改通榫（榫頭穿透到腳另一面），明式裝飾感；未勾：依母件厚度自動規則（≤25mm 通榫、>25mm 盲榫深度=厚度2/3）" },
  // 中央/下橫撐 (stretchers)
  { group: "stretcher", type: "checkbox", key: "withCenterStretcher", label: "中央橫撐", defaultValue: false, help: "明式 / 工業風款才用；現代北歐 / 日式風格不加。長桌（>1500mm）建議加防扭。注意：若下橫撐選 H 形，已自帶下層中央橫撐、不需再勾此項" },
  { group: "stretcher", type: "number", key: "centerStretcherWidth", label: "中央橫撐高 (mm)", defaultValue: 50, min: 20, max: 150, step: 5, dependsOn: { key: "withCenterStretcher" } },
  { group: "stretcher", type: "number", key: "centerStretcherThickness", label: "中央橫撐厚 (mm)", defaultValue: 25, min: 12, max: 50, step: 1, dependsOn: { key: "withCenterStretcher" } },
  { group: "stretcher", type: "number", key: "centerStretcherDrop", label: "中央橫撐距牙板頂 (mm)", defaultValue: 0, min: 0, max: 200, step: 5, help: "0 = 跟牙板上緣切齊（預設）", dependsOn: { key: "withCenterStretcher" } },
  { group: "stretcher", type: "checkbox", key: "withLowerStretchers", label: "下橫撐", defaultValue: false, dependsOn: { key: "legShape", notIn: ["trestle"] } },
  { group: "stretcher", type: "select", key: "lowerStretcherArrangement", label: "下橫撐排列", defaultValue: "box-frame", choices: [
    { value: "box-frame", label: "4 邊框（最穩，預設）" },
    { value: "h-frame", label: "H 形（左右 2 條 + 中央 1 條）" },
    { value: "pair-x", label: "雙條（前/後 2 條，無左右）" },
    { value: "pair-z", label: "雙條（左/右 2 條，無前後）" },
    { value: "double-rail", label: "雙環（4 邊框 + 低一層 4 條）" },
  ], dependsOn: { all: [{ key: "withLowerStretchers" }, { key: "legShape", notIn: ["trestle"] }] } },
  { group: "stretcher", type: "number", key: "lowerStretcherWidth", label: "下橫撐高 (mm)", defaultValue: 50, min: 20, max: 150, step: 5, dependsOn: { all: [{ key: "withLowerStretchers" }, { key: "legShape", notIn: ["trestle"] }] } },
  { group: "stretcher", type: "number", key: "lowerStretcherThickness", label: "下橫撐厚 (mm)", defaultValue: 28, min: 10, max: 50, step: 1, dependsOn: { all: [{ key: "withLowerStretchers" }, { key: "legShape", notIn: ["trestle"] }] } },
  { group: "stretcher", type: "number", key: "lowerStretcherHeight", label: "下橫撐離地高 (mm)", defaultValue: 0, min: 0, max: 700, step: 10, help: "設 0 = 自動（腳高的 22%）", dependsOn: { all: [{ key: "withLowerStretchers" }, { key: "legShape", notIn: ["trestle"] }] } },
  { group: "stretcher", type: "number", key: "lowerStretcherDoubleRailGap", label: "雙環下層距上層 (mm)", defaultValue: 100, min: 50, max: 300, step: 10, help: "雙環模式時，下層 4 條離上層的距離", dependsOn: { all: [{ key: "lowerStretcherArrangement", equals: "double-rail" }, { key: "legShape", notIn: ["trestle"] }] } },
];

/**
 * 對柱腳餐桌（trestle dining table）：兩端梁框 + 中央連接橫木
 * - 2 個端框（在桌長 X 軸的 ±frameX 位置）
 * - 每框 = 2 支粗腳 + 1 條頂橫木 + 1 條底足
 * - 1 條中央橫木（沿 X 軸）連接兩框中心
 * 大餐桌經典做法（坐人膝蓋空間大、無 4 腳干擾）。
 *
 * 註：trestle 的桌面是「坐」在 top-rail 上（用木釘 + 螺絲鎖定），不是直接
 * 進腳的盲榫——所以 simpleTable 的 legTopShoulderExtraMm 規則對 trestle
 * 不適用。承重靠的是 top-rail × 2 跟 leg 的肩榫，這條才是關鍵接合。
 */
function buildTrestleDiningTable(input: {
  length: number; width: number; height: number; material: string;
  topThickness: number; legSize: number;
}): FurnitureDesign {
  const { length, width, height, material, topThickness, legSize } = input;
  const legHeight = height - topThickness;
  // 端框位置：x = ±frameX（沿長邊內縮 22%，工程經驗值）
  const frameX = Math.round(length * 0.28);
  // 每框 2 腳沿 Z 間距 = 桌深 × 0.55
  const frameLegSpacing = Math.round(width * 0.55);
  const trestleLegSize = Math.round(legSize * 1.3);
  // 頂橫木 + 底足跨越框內 2 腳，稍長
  const frameRailLen = frameLegSpacing + trestleLegSize;
  const frameRailWidth = trestleLegSize;
  const frameRailThickness = Math.round(trestleLegSize * 0.6);
  // 底足：比腳寬 10mm 一點點突出做穩定，厚 50 比較有結構感
  const frameFootWidth = trestleLegSize + 10;
  const frameFootThickness = 50;
  // 中央橫木：跨越 2 框中心，落在底足 Y 範圍內
  const centerStretcherLen = 2 * frameX - frameFootWidth;
  const centerStretcherWidth = 30;
  const centerStretcherThickness = 35;
  const centerStretcherY = (frameFootThickness - centerStretcherWidth) / 2;

  const top: Part = {
    id: "top",
    nameZh: "桌面",
    material: material as "maple",
    grainDirection: "length",
    visible: { length, width, thickness: topThickness },
    origin: { x: 0, y: legHeight, z: 0 },
    tenons: [],
    mortises: [],
  };

  // 腳上下榫：腳 ↔ 頂橫木（top）、腳 ↔ 底足（bottom）。盲榫，肩 8mm。
  const legTenonThick = Math.round(trestleLegSize / 3);
  // 沿木紋方向（世界 Z）的榫寬：腳粗 - 30mm（每側 15mm 肩），約佔腳寬 2/3，
  // 橫木/底足端頭沿 Z 順紋方向有足夠肩防裂。
  const legTenonW = trestleLegSize - 30;
  const legTopTenonLen = Math.round(frameRailThickness * 2 / 3);
  const legBotTenonLen = Math.round(frameFootThickness * 2 / 3);

  const parts: Part[] = [top];
  // 兩個端框（沿 X 軸對稱）
  for (const fx of [-frameX, frameX] as const) {
    const fid = fx < 0 ? "left" : "right";
    const fLabel = fx < 0 ? "左" : "右";
    // 2 支腳（沿 Z 軸）
    for (const fz of [-frameLegSpacing / 2, frameLegSpacing / 2] as const) {
      const sid = fz < 0 ? "front" : "back";
      const sLabel = fz < 0 ? "前" : "後";
      parts.push({
        id: `trestle-${fid}-${sid}-leg`,
        nameZh: `${fLabel}框${sLabel}腳`,
        material: material as "maple",
        grainDirection: "length",
        visible: { length: trestleLegSize, width: trestleLegSize, thickness: legHeight - frameFootThickness - frameRailThickness },
        origin: { x: fx, y: frameFootThickness, z: fz },
        // 榫頭寬邊（thickness 沿 leg 的 part-Z = 世界 Z）= 沿橫木/底足木紋方向（世界 Z）
        // → 黏合面落在橫木/底足的長紋（long-grain glue），結構強度最佳。
        // 反過來會讓榫的寬邊沿世界 X = 橫木/底足的端紋（end-grain glue 弱）。
        tenons: [
          { position: "top", type: "blind-tenon", length: legTopTenonLen, width: legTenonThick, thickness: legTenonW },
          { position: "bottom", type: "blind-tenon", length: legBotTenonLen, width: legTenonThick, thickness: legTenonW },
        ],
        mortises: [],
      });
    }
    // 頂橫木（沿 Z 軸）：底面 2 個 mortise 接 2 腳的 top 榫
    parts.push({
      id: `trestle-${fid}-top-rail`,
      nameZh: `${fLabel}框頂橫木`,
      material: material as "maple",
      grainDirection: "length",
      visible: { length: frameRailLen, width: frameRailWidth, thickness: frameRailThickness },
      origin: { x: fx, y: legHeight - frameRailThickness, z: 0 },
      rotation: { x: 0, y: Math.PI / 2, z: 0 },
      tenons: [],
      // top-rail rotation y=π/2：part-local X (length) → 世界 Z；part-local Z (width) → 世界 X
      // 接 2 腳：腳在世界 Z = ±frameLegSpacing/2 → part-local x = ∓frameLegSpacing/2
      mortises: [
        { origin: { x: -frameLegSpacing / 2, y: -frameRailThickness / 2 + LEG_FACE_INSET, z: 0 }, depth: legTopTenonLen, length: legTenonW, width: legTenonThick, through: false },
        { origin: { x: +frameLegSpacing / 2, y: -frameRailThickness / 2 + LEG_FACE_INSET, z: 0 }, depth: legTopTenonLen, length: legTenonW, width: legTenonThick, through: false },
      ],
    });
    // 底足（沿 Z 軸，含中央橫木 mortise + 2 腳 bottom 榫眼）
    parts.push({
      id: `trestle-${fid}-foot`,
      nameZh: `${fLabel}框底足`,
      material: material as "maple",
      grainDirection: "length",
      visible: { length: frameRailLen + 40, width: frameFootWidth, thickness: frameFootThickness },
      origin: { x: fx, y: 0, z: 0 },
      rotation: { x: 0, y: Math.PI / 2, z: 0 },
      tenons: [],
      mortises: [
        // 中央橫木 mortise（內側 X 面）
        {
          origin: { x: fx < 0 ? +frameFootWidth / 2 - 17 : -frameFootWidth / 2 + 17, y: frameFootThickness / 2, z: 0 },
          depth: 35,
          length: centerStretcherWidth - 12,
          width: 18,
          through: false,
        },
        // 2 腳 bottom 榫眼（頂面，朝 +Y）
        { origin: { x: -frameLegSpacing / 2, y: frameFootThickness / 2 - LEG_FACE_INSET, z: 0 }, depth: legBotTenonLen, length: legTenonW, width: legTenonThick, through: false },
        { origin: { x: +frameLegSpacing / 2, y: frameFootThickness / 2 - LEG_FACE_INSET, z: 0 }, depth: legBotTenonLen, length: legTenonW, width: legTenonThick, through: false },
      ],
    });
  }
  // 中央橫木（沿 X 軸跨越兩框中心）
  parts.push({
    id: "trestle-center-stretcher",
    nameZh: "中央連接橫木",
    material: material as "maple",
    grainDirection: "length",
    visible: { length: centerStretcherLen, width: centerStretcherWidth, thickness: centerStretcherThickness },
    origin: { x: 0, y: centerStretcherY, z: 0 },
    rotation: { x: Math.PI / 2, y: 0, z: 0 },
    tenons: [
      { position: "start", type: "shouldered-tenon", length: 35, width: centerStretcherWidth - 12, thickness: 18 },
      { position: "end", type: "shouldered-tenon", length: 35, width: centerStretcherWidth - 12, thickness: 18 },
    ],
    mortises: [],
  });

  return {
    id: `dining-table-trestle-${length}x${width}x${height}`,
    category: "dining-table",
    nameZh: "餐桌（對柱腳）",
    overall: { length, width, thickness: height },
    parts,
    defaultJoinery: "shouldered-tenon",
    primaryMaterial: material as "maple",
    notes: `對柱腳餐桌：兩端梁框（左/右 各 2 腳 + 頂橫木 + 底足）+ 中央連接橫木。腳粗 ${trestleLegSize}mm（base × 1.3）。框長 ${frameRailLen}mm，框間距 ${2 * frameX}mm。坐人膝蓋空間大、無 4 腳干擾，建議桌長 ≥ 1500mm 才用此結構。`,
  };
}

export const diningTable: FurnitureTemplate = (input) => {
  const o = diningTableOptions;
  const legShape = getOption<string>(input, opt(o, "legShape"));
  const legSize = getOption<number>(input, opt(o, "legSize"));
  const legInset = getOption<number>(input, opt(o, "legInset"));
  const topThickness = getOption<number>(input, opt(o, "topThickness"));
  // trestle 走獨立 builder（不走 simpleTable 4 腳結構）
  if (legShape === "trestle") {
    const design = buildTrestleDiningTable({
      length: input.length,
      width: input.width,
      height: input.height,
      material: input.material,
      topThickness,
      legSize,
    });
    applyStandardChecks(design, {
      minLength: 900, minWidth: 600, minHeight: 600,
      maxLength: 2400, maxWidth: 1200, maxHeight: 800,
    });
    return design;
  }
  const apronWidth = getOption<number>(input, opt(o, "apronWidth"));
  const apronThickness = getOption<number>(input, opt(o, "apronThickness"));
  const apronOffset = getOption<number>(input, opt(o, "apronOffset"));
  const legPenetratingTenon = getOption<boolean>(input, opt(o, "legPenetratingTenon"));
  const withCenterStretcher = getOption<boolean>(input, opt(o, "withCenterStretcher"));
  const centerStretcherWidth = getOption<number>(input, opt(o, "centerStretcherWidth"));
  const centerStretcherThickness = getOption<number>(input, opt(o, "centerStretcherThickness"));
  const centerStretcherDrop = getOption<number>(input, opt(o, "centerStretcherDrop"));
  const withLowerStretchers = getOption<boolean>(input, opt(o, "withLowerStretchers"));
  const lowerStretcherWidth = getOption<number>(input, opt(o, "lowerStretcherWidth"));
  const lowerStretcherThickness = getOption<number>(input, opt(o, "lowerStretcherThickness"));
  const lowerStretcherHeight = getOption<number>(input, opt(o, "lowerStretcherHeight"));
  const lowerStretcherArrangement = getOption<string>(input, opt(o, "lowerStretcherArrangement"));
  const lowerStretcherDoubleRailGap = getOption<number>(input, opt(o, "lowerStretcherDoubleRailGap"));
  const seatEdge = getOption<number>(input, opt(o, "seatEdge"));
  const seatEdgeStyle = getOption<string>(input, opt(o, "seatEdgeStyle"));
  const legEdge = getOption<number>(input, opt(o, "legEdge"));
  const legEdgeStyle = getOption<string>(input, opt(o, "legEdgeStyle"));
  const stretcherEdge = getOption<number>(input, opt(o, "stretcherEdge"));
  const stretcherEdgeStyle = getOption<string>(input, opt(o, "stretcherEdgeStyle"));
  const apronEdge = getOption<number>(input, opt(o, "apronEdge"));
  const apronEdgeStyle = getOption<string>(input, opt(o, "apronEdgeStyle"));
  const liveEdge = getOption<boolean>(input, opt(o, "liveEdge"));
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
    legPenetratingTenon,
    withCenterStretcher,
    centerStretcherWidth,
    centerStretcherThickness,
    centerStretcherDrop: centerStretcherDrop > 0 ? centerStretcherDrop : undefined,
    withLowerStretchers,
    lowerStretcherWidth,
    lowerStretcherThickness,
    legInset,
    apronOffset,
    // 餐桌承重大、桌面端頭沿 X 順紋方向，標準 10mm 外側肩有開裂風險。
    // 額外 5mm 肩：榫寬縮成 legSize - 20，外側肩變 15mm。
    legTopShoulderExtraMm: 5,
    lowerStretcherHeight: lowerStretcherHeight > 0 ? lowerStretcherHeight : undefined,
    legShape: legShape as "box" | "tapered" | "strong-taper" | "inverted" | "splayed" | "splayed-length" | "splayed-width" | "hoof" | "shaker",
    seatEdge,
    seatEdgeStyle,
    legEdge,
    legEdgeStyle,
    stretcherEdge,
    stretcherEdgeStyle,
    apronEdge,
    apronEdgeStyle,
    liveEdge,
    dropLeaf: dropLeaf as "none" | "one-side" | "two-sides",
    dropLeafWidth,
    notes: `餐桌結構：桌腳 ${legSize}mm（${legShapeLabel(legShape)}）、牙板 ${apronWidth}×${apronThickness}mm、桌面 ${topThickness}mm 厚。${liveEdge ? " 桌面 live edge：保留原木樹皮邊，需用單片大板（>600mm 寬）或拼板後留外緣不修。" : ""}${dropLeaf !== "none" ? ` ${dropLeaf === "one-side" ? "單" : "雙"}側翻板（每片 ${dropLeafWidth}mm 寬，配 1.5" 鋼製蝶式鉸鏈一對 / 端）。` : ""}`,
  });
  // 下橫撐排列方式（box-frame 預設無動作）
  if (withLowerStretchers && lowerStretcherArrangement !== "box-frame") {
    applyLowerStretcherArrangement(design, lowerStretcherArrangement, {
      length: input.length,
      width: input.width,
      legSize,
      legInset,
      material: input.material as string,
      lowerStretcherWidth,
      lowerStretcherThickness,
      doubleRailGap: lowerStretcherDoubleRailGap,
    });
  }

  applyStandardChecks(design, {
    minLength: 900, minWidth: 600, minHeight: 600,
    maxLength: 2400, maxWidth: 1200, maxHeight: 800,
  });
  return design;
};

/**
 * 下橫撐排列 post-process。simpleTable 預設出 4 條 box-frame，這函式根據
 * arrangement 過濾 / 新增零件 + 連帶處理 leg 上的孤兒 mortise。
 */
export function applyLowerStretcherArrangement(
  design: FurnitureDesign,
  arrangement: string,
  params: {
    length: number; width: number; legSize: number; legInset: number;
    material: string;
    lowerStretcherWidth: number;
    lowerStretcherThickness: number;
    doubleRailGap: number;
  },
) {
  const { lowerStretcherWidth: lsW, lowerStretcherThickness: lsT } = params;
  // 從現有 ls-front 抓 stretcherY
  const lsFront = design.parts.find((p) => p.id === "ls-front");
  if (!lsFront) return;
  const stretcherY = lsFront.origin.y;
  const lsCenterY = stretcherY + lsW / 2;
  // 是否為下橫撐高度的 mortise（Y 在 stretcherY 區段）
  const isLowerStretcherMortise = (m: { origin: { x: number; y: number; z: number } }) =>
    m.origin.y >= stretcherY - 2 && m.origin.y <= stretcherY + lsW + 2;
  // 移除 leg 上「特定 face」的下橫撐 mortise
  const stripLegMortises = (face: "x" | "z" | "all") => {
    for (const leg of design.parts.filter((p) => p.id.startsWith("leg-"))) {
      leg.mortises = leg.mortises.filter((m) => {
        if (!isLowerStretcherMortise(m)) return true;
        if (face === "all") return false;
        if (face === "x") return Math.abs(m.origin.x) < 0.5; // 留 Z-face 母榫
        if (face === "z") return Math.abs(m.origin.z) < 0.5; // 留 X-face 母榫
        return true;
      });
    }
  };
  const lsParts = ["ls-front", "ls-back", "ls-left", "ls-right"];

  // 雙條 / H 形時保留的下橫撐沒有同伴佔腳面，可以從半榫 (~lsW/2)
  // 升級到全寬榫 (lsW - 10) — 接合更牢。
  const fullTenonW = Math.max(15, params.lowerStretcherWidth - 10);
  const widenLsTenons = (
    keepIds: string[],
    legFaceMatch: (m: { origin: { x: number; y: number; z: number } }) => boolean,
  ) => {
    for (const id of keepIds) {
      const ls = design.parts.find((p) => p.id === id);
      if (!ls) continue;
      for (const t of ls.tenons) {
        t.width = fullTenonW;
        t.offsetWidth = 0;
      }
    }
    for (const p of design.parts) {
      if (!p.id.startsWith("leg-")) continue;
      for (const m of p.mortises) {
        if (legFaceMatch(m)) {
          m.length = fullTenonW;
          m.origin = { ...m.origin, y: lsCenterY };
        }
      }
    }
  };

  // 腳面榫眼偵測：origin.x（或 z）== ±LEG_FACE_INSET、另一軸 == 0
  const isXFaceMortise = (m: { origin: { x: number; z: number } }) =>
    m.origin.z === 0 && Math.abs(m.origin.x) === LEG_FACE_INSET;
  const isZFaceMortise = (m: { origin: { x: number; z: number } }) =>
    m.origin.x === 0 && Math.abs(m.origin.z) === LEG_FACE_INSET;

  if (arrangement === "pair-x") {
    // 只留前/後（X 軸）
    design.parts = design.parts.filter((p) => !["ls-left", "ls-right"].includes(p.id));
    stripLegMortises("z");
    widenLsTenons(["ls-front", "ls-back"], isXFaceMortise);
    return;
  }
  if (arrangement === "pair-z") {
    design.parts = design.parts.filter((p) => !["ls-front", "ls-back"].includes(p.id));
    stripLegMortises("x");
    widenLsTenons(["ls-left", "ls-right"], isZFaceMortise);
    return;
  }
  if (arrangement === "h-frame") {
    // 留 ls-left, ls-right；移除 ls-front, ls-back；加中央橫撐（X 軸）接到 ls-left/right
    design.parts = design.parts.filter((p) => !["ls-front", "ls-back"].includes(p.id));
    stripLegMortises("x");
    widenLsTenons(["ls-left", "ls-right"], isZFaceMortise);
    const lsLeft = design.parts.find((p) => p.id === "ls-left");
    const lsRight = design.parts.find((p) => p.id === "ls-right");
    if (lsLeft && lsRight) {
      // 中央橫撐 X 範圍：左右 ls 內側面間距
      // ls-left/right.origin.x = ±apronEdgeX；inner face 距 origin.x = lsT/2
      const lsLeftInnerX = lsLeft.origin.x + lsT / 2;
      const lsRightInnerX = lsRight.origin.x - lsT / 2;
      const centerLen = lsRightInnerX - lsLeftInnerX;
      const centerThick = lsT;
      const centerWidth = lsW;
      // 中央橫撐沿 X 軸（rotation x:π/2 y:0）跟前後下橫撐同軸，但前後 ls 已被
       // 刪除——回頭從 ls-left/ls-right 借形（同 stretcherEdge chamfer 結果一致）。
      // ls-left/right 受 stretcherEdge option 影響的形狀通常是 chamfered-edges，
      // 直接複用、保留橫撐倒角在 h-frame 模式仍可見。
      const lsCenterShape = lsLeft.shape?.kind === "chamfered-edges"
        ? { ...lsLeft.shape }
        : undefined;
      design.parts.push({
        id: "ls-center",
        nameZh: "中央下橫撐",
        material: params.material as "maple",
        grainDirection: "length",
        visible: { length: centerLen, width: centerWidth, thickness: centerThick },
        origin: { x: 0, y: stretcherY, z: 0 },
        rotation: { x: Math.PI / 2, y: 0, z: 0 },
        shape: lsCenterShape,
        tenons: [
          { position: "start", type: "shouldered-tenon", length: 18, width: lsW - 8, thickness: Math.round(centerThick / 2) },
          { position: "end", type: "shouldered-tenon", length: 18, width: lsW - 8, thickness: Math.round(centerThick / 2) },
        ],
        mortises: [],
      });
      // 在 ls-left / ls-right 中央加 mortise 接受中央橫撐
      // ls-* 是 axis="z"（rotation x:PI/2 y:PI/2），visible.length 沿 Z；中心=Z=0 → mortise 在 part-local X 軸上
      // mortise depth=X, origin.x 在 +/-lz/2 一側（朝家具中心方向）
      for (const ls of [lsLeft, lsRight]) {
        const innerSide = ls.origin.x < 0 ? +1 : -1; // 朝中心
        ls.mortises.push({
          // ls-* visible: length=lsLengthZ, width=lsW (世界Y), thickness=lsT (世界X)
          // mortiseLocalBox 以最近表面決定 depthAxis；origin.z 設成 ±some 讓 z 軸成為 depth
          // 簡化：ls-* part-local X axis（visible.length）= 世界 Z；Y=世界Y；Z=世界 X (因 rotation y:PI/2)
          // 但 mortise.origin 是 part-local，這邊直接給：origin.z = 朝家具中心方向（part-local Z 一側）
          origin: { x: 0, y: lsW / 2, z: innerSide * (lsT / 2 - 1) },
          depth: 18,
          length: lsW - 8,
          width: Math.round(lsT / 2),
          through: false,
        });
      }
    }
    return;
  }
  if (arrangement === "double-rail") {
    // 在現有 4 條下方再加 4 條（離 stretcherY - doubleRailGap）
    const lowerY = stretcherY - params.doubleRailGap;
    if (lowerY < lsW / 2) return; // 太低就不加
    const lowerCenterY = lowerY + lsW / 2;
    const refs: Part[] = [];
    for (const id of lsParts) {
      const ref = design.parts.find((p) => p.id === id);
      if (ref) refs.push(ref);
    }
    for (const ref of refs) {
      design.parts.push({
        ...ref,
        id: `${ref.id}-low`,
        nameZh: `${ref.nameZh}（下層）`,
        origin: { ...ref.origin, y: lowerY },
        // tenons 跟原本一樣，mortise 對應加在 leg 上
      });
    }
    // 在 leg 上加對應 mortise（複製原本 stretcher mortise，y 改成 lowerCenterY）
    for (const leg of design.parts.filter((p) => p.id.startsWith("leg-"))) {
      const newMs: typeof leg.mortises = [];
      for (const m of leg.mortises) {
        if (isLowerStretcherMortise(m)) {
          newMs.push({ ...m, origin: { ...m.origin, y: lowerCenterY } });
        }
      }
      leg.mortises.push(...newMs);
    }
    return;
  }
}
