import type { FurnitureDesign, FurnitureTemplate, OptionSpec, Part } from "@/lib/types";
import { getOption, opt } from "@/lib/types";
import { applyStandardChecks } from "./_validators";
import { legEdgeOption, legEdgeStyleOption, stretcherEdgeOption, stretcherEdgeStyleOption, seatEdgeOption, seatEdgeStyleOption, parseSeatChamferMm } from "./_helpers";

export const circleChairOptions: OptionSpec[] = [
  // 基本尺寸（spec §8.1：只開座面高，其餘走 catalog defaults length/width/height）
  { group: "top", type: "number", key: "seatHeight", label: "座面高 (mm)", defaultValue: 480, min: 420, max: 520, step: 5, unit: "mm", help: "地面到座板上緣（人體工學 §O）" },
  // 風格 preset（spec §8.2）
  { group: "misc", type: "select", key: "stylePreset", label: "風格", defaultValue: "ming-plain", wide: true, choices: [
    { value: "ming-plain", label: "明式素圈椅（工作圖原型・胡桃木）" },
    { value: "huanghuali-slim", label: "黃花梨細秀款（截面收細・淺色硬木）" },
    { value: "jichimu-stout", label: "雞翅木壯實款（截面飽滿・深色木紋）" },
  ] },
  // 教材兩種做法（spec §8.3）
  { group: "structure", type: "select", key: "footRailJoint", label: "管腳棖榫型", defaultValue: "square-tenon", choices: [
    { value: "square-tenon", label: "椿榫（規矩方榫）" },
    { value: "duck-bill", label: "鴨母嘴（斜口勾掛榫）" },
  ], help: "魯班學堂教材提供兩種做法供對照" },
  { group: "structure", type: "select", key: "seatCornerStructure", label: "椅盤轉角", defaultValue: "structure-1", choices: [
    { value: "structure-1", label: "第一種結構" },
    { value: "structure-2", label: "第二種結構" },
  ], help: "魯班學堂教材提供兩種椅盤攢框轉角做法" },
  // 倒角（走 _helpers factory，不手寫）
  seatEdgeOption("top", 3),
  seatEdgeStyleOption("top"),
  legEdgeOption("leg", 2),
  legEdgeStyleOption("leg"),
  stretcherEdgeOption("stretcher", 1),
  stretcherEdgeStyleOption("stretcher"),
];

function buildSeatFrame(args: {
  material: import("@/lib/types").MaterialId;
  seatWidth: number;   // input.length
  seatDepth: number;   // input.width
  seatHeight: number;
  seatChamferMm: number;
  seatEdgeStyle: string;
}): Part[] {
  const { material, seatWidth, seatDepth, seatHeight, seatChamferMm, seatEdgeStyle } = args;
  // RAIL_W = 大邊/抹頭的可見高度（Y 方向）；RAIL_T = 厚度（Z/X 方向板料厚）
  const RAIL_W = 91, RAIL_T = 39, PANEL_T = 15, BATTEN = 35;
  // 大邊底面 Y：座框頂 = seatHeight，框高 = RAIL_W，所以底面 y = seatHeight - RAIL_W
  const railBottomY = seatHeight - RAIL_W;
  const parts: Part[] = [];

  // 前後大邊（沿 X，無旋轉）
  // visible: length(X) = 全寬 seatWidth；thickness(Y) = RAIL_W 高；width(Z) = RAIL_T 板料厚
  // origin.z：以座框外緣對齊，Z 中心 = ±(seatDepth/2 - RAIL_T/2)
  for (const sz of [-1, 1] as const) {
    parts.push({
      id: sz < 0 ? "seat-rail-front" : "seat-rail-back",
      nameZh: sz < 0 ? "前大邊" : "後大邊",
      material,
      grainDirection: "length",
      visible: { length: seatWidth, thickness: RAIL_W, width: RAIL_T },
      origin: { x: 0, y: railBottomY, z: sz * (seatDepth / 2 - RAIL_T / 2) },
      shape: { kind: "box" },
      tenons: [],
      mortises: [],
    });
  }
  // 左右抹頭（沿 Z，繞 Y 轉 90°）
  // 抹頭插入大邊之間，淨長 = seatDepth - 2*RAIL_T
  // visible: length(→Z after rot) = 淨跨距；thickness(Y) = RAIL_W；width(→X after rot) = RAIL_T
  // origin.x：以座框外緣對齊，X 中心 = ±(seatWidth/2 - RAIL_T/2)
  for (const sx of [-1, 1] as const) {
    parts.push({
      id: sx < 0 ? "seat-rail-left" : "seat-rail-right",
      nameZh: sx < 0 ? "左抹頭" : "右抹頭",
      material,
      grainDirection: "length",
      visible: { length: seatDepth - 2 * RAIL_T, thickness: RAIL_W, width: RAIL_T },
      origin: { x: sx * (seatWidth / 2 - RAIL_T / 2), y: railBottomY, z: 0 },
      rotation: { x: 0, y: Math.PI / 2, z: 0 },
      shape: { kind: "box" },
      tenons: [],
      mortises: [],
    });
  }
  // 座板（落在框內、頂面比座框頂低 6mm 模擬裝板槽）
  // visible: length(X) 及 width(Z) 縮進框內 4mm；thickness(Y) = PANEL_T
  parts.push({
    id: "seat-panel",
    nameZh: "座板",
    material,
    grainDirection: "length",
    visible: { length: seatWidth - 2 * RAIL_T - 8, width: seatDepth - 2 * RAIL_T - 8, thickness: PANEL_T },
    origin: { x: 0, y: seatHeight - 6 - PANEL_T, z: 0 },
    panelPieces: 2,
    shape: seatChamferMm > 0
      ? { kind: "chamfered-top", chamferMm: seatChamferMm, style: seatEdgeStyle === "rounded" ? "rounded" : "chamfered" }
      : { kind: "box" },
    tenons: [],
    mortises: [],
  });
  // 穿帶（座板下方、沿 Z 居中）
  // 繞 Y 轉 90°：visible.length(→Z) = 抹頭淨跨距；thickness(Y) = BATTEN；width(→X) = BATTEN
  parts.push({
    id: "seat-thru-batten",
    nameZh: "穿帶",
    material,
    grainDirection: "length",
    visible: { length: seatDepth - 2 * RAIL_T, thickness: BATTEN, width: BATTEN },
    origin: { x: 0, y: seatHeight - 6 - PANEL_T - BATTEN, z: 0 },
    rotation: { x: 0, y: Math.PI / 2, z: 0 },
    shape: { kind: "box" },
    tenons: [],
    mortises: [],
  });
  return parts;
}

function buildLegs(args: {
  material: import("@/lib/types").MaterialId;
  seatWidth: number; seatDepth: number; seatHeight: number;
  ringHeight: number;          // input.height（椅圈總高）
}): Part[] {
  const { material, seatWidth, seatDepth, seatHeight, ringHeight } = args;
  const FRONT_D = 50, REAR_D = 36;
  // 腿中心離座框：前腿在前緣、後腿在後緣，內縮一個腿半徑
  const legXOff = seatWidth / 2 - FRONT_D / 2 - 6;
  const legZOffFront = -(seatDepth / 2 - FRONT_D / 2 - 6);
  const legZOffRear = seatDepth / 2 - REAR_D / 2 - 6;
  const parts: Part[] = [];

  // 前腳（含鵝脖）：地面 → 鵝脖頂；P1 用 arch-bent，bendMm 負 = 往 -Z（前）彎
  // visible 慣例：length(X)=直徑、width(Z)=直徑、thickness(Y)=腿高；與 round-stool.ts:213 一致
  for (const sx of [-1, 1] as const) {
    const frontLegTop = seatHeight + 180; // 鵝脖頂大約座面上 180mm 接椅圈前段
    parts.push({
      id: sx < 0 ? "leg-front-l" : "leg-front-r",
      nameZh: `前${sx < 0 ? "左" : "右"}腳（含鵝脖）`,
      material,
      grainDirection: "length",
      visible: { length: FRONT_D, width: FRONT_D, thickness: frontLegTop },
      origin: { x: sx * legXOff, y: 0, z: legZOffFront },
      shape: { kind: "arch-bent", bendMm: -28 }, // 上段往前彎模擬鵝脖
      tenons: [],
      mortises: [],
    });
  }
  // 後腳（一木連做穿座盤接椅圈）：bendMm 正 = 往 +Z（後）彎
  // visible 慣例：length(X)=直徑、width(Z)=直徑、thickness(Y)=腿全高（地面到椅圈頂）
  for (const sx of [-1, 1] as const) {
    parts.push({
      id: sx < 0 ? "leg-rear-l" : "leg-rear-r",
      nameZh: `後${sx < 0 ? "左" : "右"}腳`,
      material,
      grainDirection: "length",
      visible: { length: REAR_D, width: REAR_D, thickness: ringHeight },
      origin: { x: sx * legXOff, y: 0, z: legZOffRear },
      shape: { kind: "arch-bent", bendMm: 22 }, // 上段後傾
      tenons: [],
      mortises: [],
    });
  }
  return parts;
}

/**
 * 明式圈椅（circle-chair）— Phase 1 直線化框架版
 * input.length = 座寬、input.width = 座深、input.height = 椅圈總高
 * 預設 610 × 497 × 720mm（台南魯班學堂工作圖實尺）
 */
export const circleChair: FurnitureTemplate = (input): FurnitureDesign => {
  const { material } = input;
  const o = circleChairOptions;
  const seatHeight = getOption<number>(input, opt(o, "seatHeight"));
  const seatChamferMm = parseSeatChamferMm(getOption<string>(input, opt(o, "seatEdge")));
  const seatEdgeStyle = getOption<string>(input, opt(o, "seatEdgeStyle"));

  const parts: Part[] = [];
  parts.push(...buildSeatFrame({
    material, seatWidth: input.length, seatDepth: input.width, seatHeight,
    seatChamferMm, seatEdgeStyle,
  }));
  parts.push(...buildLegs({
    material, seatWidth: input.length, seatDepth: input.width, seatHeight,
    ringHeight: input.height,
  }));

  const design: FurnitureDesign = {
    id: `circle-chair-${input.length}x${input.height}`,
    category: "circle-chair",
    nameZh: "明式圈椅",
    overall: { length: input.length, width: input.width, thickness: input.height },
    parts,
    defaultJoinery: "blind-tenon",
    useButtJointConvention: true,
    primaryMaterial: material,
    notes: `明式圈椅（Phase 1 框架版）座寬 ${input.length}mm × 座深 ${input.width}mm × 椅圈高 ${input.height}mm。`,
  };
  applyStandardChecks(design, {
    minLength: 550, minWidth: 440, minHeight: 650,
    maxLength: 750, maxWidth: 600, maxHeight: 1150,
  });
  return design;
};
