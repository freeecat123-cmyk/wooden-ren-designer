import type { FurnitureDesign, FurnitureTemplate, MaterialId, OptionSpec, Part } from "@/lib/types";
import { getOption, opt } from "@/lib/types";
import { validateRoundLegJoinery, applyStandardChecks } from "./_validators";
import { legEdgeOption, legEdgeStyleOption, stretcherEdgeOption, stretcherEdgeStyleOption, seatEdgeOption, seatEdgeStyleOption, parseSeatChamferMm } from "./_helpers";

/** 座框大邊/抹頭斷面高（visible.thickness） */
const RAIL_W = 91;
/** 腿中心離座框外緣的內縮量 */
const LEG_INSET = 6;
/** 橫飾棖斷面高（visible.thickness）— buildStretchers / buildCornerBraces 共用 */
const DECOR_H = 48;
/** 聯幫棍中心離座框側外緣內縮量（聯幫棍 origin.x 偏移量） */
const SPINDLE_INSET = 25;
/** 前腳角牙高（visible.thickness）— buildCornerBraces 前腳角牙 braceY 算式共用 */
const FRONT_BRACE_H = 55;
/** 橫飾棖角牙高（visible.thickness）— buildCornerBraces 橫飾棖角牙 braceOriginY 算式共用 */
const DECOR_BRACE_H = 60;

/** 四腿的斷面尺寸與 X/Z 平面錨點位置（buildLegs / buildStretchers / 後續 sub-function 共用） */
function legAnchors(seatWidth: number, seatDepth: number) {
  const FRONT_D = 50;
  const REAR_D = 36;
  const legXOff = seatWidth / 2 - FRONT_D / 2 - LEG_INSET;
  const legZFront = -(seatDepth / 2 - FRONT_D / 2 - LEG_INSET);
  const legZRear = seatDepth / 2 - REAR_D / 2 - LEG_INSET;
  return { FRONT_D, REAR_D, legXOff, legZFront, legZRear };
}

/**
 * 座框錨點（buildSeatFrame / buildSCurveMembers / buildCornerBraces 共用）
 *   RAIL_T_SEAT  = 座框板料厚（mm）
 *   railBottomY  = 座框底面 Y（地面到座框底）
 *   seatFrontZ   = 前大邊 origin.z
 *   seatBackZ    = 後大邊 origin.z（= seatDepth/2 − RAIL_T_SEAT/2）
 */
function seatFrameAnchors(seatDepth: number, seatHeight: number) {
  const RAIL_T_SEAT = 39;
  const railBottomY = seatHeight - RAIL_W;
  const seatFrontZ = -(seatDepth / 2 - RAIL_T_SEAT / 2);
  const seatBackZ  =   seatDepth / 2 - RAIL_T_SEAT / 2;
  return { RAIL_T_SEAT, railBottomY, seatFrontZ, seatBackZ };
}

/**
 * 椅圈錨點（buildArmRail / buildSCurveMembers 共用）
 *   RING_T   = 椅圈斷面厚（垂直 Y 方向，mm）
 *   ringY    = 椅圈底面 Y（= ringHeight − RING_T）
 *   backZ    = 椅圈後段 origin.z（座框後緣外後凸偏移量）
 */
function armRingAnchors(seatDepth: number, ringHeight: number) {
  const RING_T = 36;
  const ringY = ringHeight - RING_T;
  const backZ = seatDepth / 2 + 28;
  return { RING_T, ringY, backZ };
}

/** 共用 build args type（sub-function 各自 pick / extend 所需欄位） */
type CircleChairBuildArgs = {
  material: MaterialId;
  seatWidth: number;
  seatDepth: number;
  seatHeight: number;
  ringHeight: number;
  sectionScale: number;
  legScale: number;
  seatChamferMm: number;
  seatEdgeStyle: string;
};

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

function buildSeatFrame(args: Pick<CircleChairBuildArgs, "material" | "seatWidth" | "seatDepth" | "seatHeight" | "seatChamferMm" | "seatEdgeStyle">): Part[] {
  const { material, seatWidth, seatDepth, seatHeight, seatChamferMm, seatEdgeStyle } = args;
  // RAIL_W（模組常數 91）= 大邊/抹頭的可見高度（Y 方向）；RAIL_T_SEAT = 厚度（Z/X 方向板料厚）
  const { RAIL_T_SEAT, railBottomY } = seatFrameAnchors(seatDepth, seatHeight);
  const PANEL_T = 15, BATTEN = 35;
  const parts: Part[] = [];

  // 前後大邊（沿 X，無旋轉）
  // visible: length(X) = 全寬 seatWidth；thickness(Y) = RAIL_W 高；width(Z) = RAIL_T_SEAT 板料厚
  // origin.z：以座框外緣對齊，Z 中心 = ±(seatDepth/2 - RAIL_T_SEAT/2)
  for (const sz of [-1, 1] as const) {
    parts.push({
      id: sz < 0 ? "seat-rail-front" : "seat-rail-back",
      nameZh: sz < 0 ? "前大邊" : "後大邊",
      material,
      grainDirection: "length",
      visible: { length: seatWidth, thickness: RAIL_W, width: RAIL_T_SEAT },
      origin: { x: 0, y: railBottomY, z: sz * (seatDepth / 2 - RAIL_T_SEAT / 2) },
      shape: { kind: "box" },
      tenons: [],
      mortises: [],
    });
  }
  // 左右抹頭（沿 Z，繞 Y 轉 90°）
  // 抹頭插入大邊之間，淨長 = seatDepth - 2*RAIL_T_SEAT
  // visible: length(→Z after rot) = 淨跨距；thickness(Y) = RAIL_W；width(→X after rot) = RAIL_T_SEAT
  // origin.x：以座框外緣對齊，X 中心 = ±(seatWidth/2 - RAIL_T_SEAT/2)
  for (const sx of [-1, 1] as const) {
    parts.push({
      id: sx < 0 ? "seat-rail-left" : "seat-rail-right",
      nameZh: sx < 0 ? "左抹頭" : "右抹頭",
      material,
      grainDirection: "length",
      visible: { length: seatDepth - 2 * RAIL_T_SEAT, thickness: RAIL_W, width: RAIL_T_SEAT },
      origin: { x: sx * (seatWidth / 2 - RAIL_T_SEAT / 2), y: railBottomY, z: 0 },
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
    visible: { length: seatWidth - 2 * RAIL_T_SEAT - 8, width: seatDepth - 2 * RAIL_T_SEAT - 8, thickness: PANEL_T },
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
    visible: { length: seatDepth - 2 * RAIL_T_SEAT, thickness: BATTEN, width: BATTEN },
    origin: { x: 0, y: seatHeight - 6 - PANEL_T - BATTEN, z: 0 },
    rotation: { x: 0, y: Math.PI / 2, z: 0 },
    shape: { kind: "box" },
    tenons: [],
    mortises: [],
  });
  return parts;
}

function buildLegs(args: Pick<CircleChairBuildArgs, "material" | "seatWidth" | "seatDepth" | "seatHeight" | "ringHeight" | "legScale">): Part[] {
  const { material, seatWidth, seatDepth, seatHeight, ringHeight, legScale } = args;
  const { FRONT_D, REAR_D, legXOff, legZFront, legZRear } = legAnchors(seatWidth, seatDepth);
  // 前腳（鵝脖）一木連做：頂端必須抵達椅圈才能真正承托。
  // frontLegTop = ringHeight → 前腳像後腳一樣貫穿到椅圈頂（椅圈 Y 範圍 ringHeight-RING_T..ringHeight）。
  // （舊版 seatHeight+180 是憑空數字、比椅圈底面矮 24mm → 前腳浮空沒接到椅圈。）
  const frontLegTop = ringHeight;
  const parts: Part[] = [];

  // P1 直線化框架版：前腳用直立圓料（round）。
  // 鵝脖前彎曲線留 P2(BATT)/P3(swept-curve) 實作；arch-bent 沿 length 軸彎，
  // 而腿的 length 只是直徑(50mm)、腿高在 thickness，所以 arch-bent 對腿高方向無效。
  // visible 慣例：length(X)=直徑、width(Z)=直徑、thickness(Y)=腿高；與 round-stool.ts:213 一致
  for (const sx of [-1, 1] as const) {
    parts.push({
      id: sx < 0 ? "leg-front-l" : "leg-front-r",
      nameZh: `前${sx < 0 ? "左" : "右"}腳（含鵝脖）`,
      material,
      grainDirection: "length",
      // legScale 只乘截面直徑（length/width），不乘腿高（thickness）與 origin
      visible: { length: FRONT_D * legScale, width: FRONT_D * legScale, thickness: frontLegTop },
      origin: { x: sx * legXOff, y: 0, z: legZFront },
      shape: { kind: "round" }, // P1 直立圓料；鵝脖前彎留 P2/P3
      tenons: [],
      mortises: [],
    });
  }
  // P1 直線化框架版：後腳用直立圓料（round）。
  // 後腿後傾曲線留 P2(BATT)/P3(swept-curve) 實作；理由同前腳，arch-bent 對垂直件腿高方向無效。
  // visible 慣例：length(X)=直徑、width(Z)=直徑、thickness(Y)=腿全高（地面到椅圈頂）
  for (const sx of [-1, 1] as const) {
    parts.push({
      id: sx < 0 ? "leg-rear-l" : "leg-rear-r",
      nameZh: `後${sx < 0 ? "左" : "右"}腳`,
      material,
      grainDirection: "length",
      // legScale 只乘截面直徑（length/width），不乘腿高（thickness）與 origin
      visible: { length: REAR_D * legScale, width: REAR_D * legScale, thickness: ringHeight },
      origin: { x: sx * legXOff, y: 0, z: legZRear },
      shape: { kind: "round" }, // P1 直立圓料；後傾曲線留 P2/P3
      tenons: [],
      mortises: [],
    });
  }
  return parts;
}

function buildStretchers(args: Pick<CircleChairBuildArgs, "material" | "seatWidth" | "seatDepth" | "seatHeight">): Part[] {
  const { material, seatWidth, seatDepth, seatHeight } = args;
  const parts: Part[] = [];

  // 腳中心內縮距（與 buildLegs 共用 legAnchors helper）
  // 橫飾棖/管腳棖端面對腳中心，跨距 = 兩腳中心距
  const { FRONT_D, REAR_D, legXOff, legZFront, legZRear } = legAnchors(seatWidth, seatDepth);

  // 橫飾棖斷面：高 48mm（Y）× 深 21mm（Z or X）
  // 緊貼座框底面下方（座框底 y = seatHeight - RAIL_W），棖頂面在座框底，所以棖底面 y = seatHeight - RAIL_W - 48
  const DECOR_T = 21;
  const decorY = seatHeight - RAIL_W - DECOR_H; // 棖底面 Y（part origin = 底部中心）

  // 橫撐跨距：face-to-face（腳外緣到腳外緣），避免棖端面進入腳 AABB。
  // X 方向：左右均為前腳 FRONT_D=50，face-to-face = 2*legXOff - FRONT_D
  const xSpan = 2 * legXOff - FRONT_D;
  // Z 方向：前腳 FRONT_D=50、後腳 REAR_D=36，face-to-face = zRear−zFront − (FRONT_D/2+REAR_D/2)
  const zSpanFaceToFace = (legZRear - legZFront) - (FRONT_D / 2 + REAR_D / 2);
  // 左右棖中心在前後腳中心的中點（face-to-face 跨距的幾何中心）
  const zMid = (legZFront + FRONT_D / 2 + legZRear - REAR_D / 2) / 2;

  // 前後橫飾棖：沿 X，緊貼座框底面，棖端面接腳面（face-to-face）
  // visible: length(X)=face-to-face 跨距；thickness(Y)=48 斷面高；width(Z)=21 斷面深
  for (const sz of [-1, 1] as const) {
    // sz=-1 前（前腳 z 為負），sz=+1 後
    // origin.z：前棖對齊前腳中心、後棖對齊後腳中心
    const zPos = sz < 0 ? legZFront : legZRear;
    parts.push({
      id: sz < 0 ? "decor-rail-front" : "decor-rail-back",
      nameZh: sz < 0 ? "前橫飾棖" : "後橫飾棖",
      material,
      grainDirection: "length",
      // length(X)=face-to-face 跨距；thickness(Y)=48 斷面高；width(Z)=21 斷面深
      visible: { length: xSpan, thickness: DECOR_H, width: DECOR_T },
      origin: { x: 0, y: decorY, z: zPos },
      shape: { kind: "box" },
      tenons: [],
      mortises: [],
    });
  }

  // 左右橫飾棖：沿 Z，繞 Y 轉 90°，face-to-face 前後跨距
  // visible: length(→Z after rot)=face-to-face 跨距；thickness(Y)=48；width(→X after rot)=21
  for (const sx of [-1, 1] as const) {
    parts.push({
      id: sx < 0 ? "decor-rail-left" : "decor-rail-right",
      nameZh: sx < 0 ? "左橫飾棖" : "右橫飾棖",
      material,
      grainDirection: "length",
      // length(→Z after rot)=face-to-face 前後跨距；thickness(Y)=48；width(→X after rot)=21
      visible: { length: zSpanFaceToFace, thickness: DECOR_H, width: DECOR_T },
      origin: { x: sx * legXOff, y: decorY, z: zMid },
      rotation: { x: 0, y: Math.PI / 2, z: 0 },
      shape: { kind: "box" },
      tenons: [],
      mortises: [],
    });
  }

  // 前腳棖（踏腳棖）：沿 X，斷面 65mm 高 × 36mm 深，離地 75mm（棖底面）
  // visible: length(X)=face-to-face xSpan；thickness(Y)=65；width(Z)=36
  const FRONT_RAIL_H = 65, FRONT_RAIL_T = 36;
  parts.push({
    id: "foot-rail-front",
    nameZh: "前腳棖（踏腳棖）",
    material,
    grainDirection: "length",
    // length(X)=face-to-face 跨距；thickness(Y)=65 斷面高；width(Z)=36 斷面深
    visible: { length: xSpan, thickness: FRONT_RAIL_H, width: FRONT_RAIL_T },
    origin: { x: 0, y: 75, z: legZFront },
    shape: { kind: "box" },
    tenons: [],
    mortises: [],
  });

  // 左/右步步高側棖：沿 Z，繞 Y 轉 90°，27×27 方斷面，離地 120mm（棖底面）
  // visible: length(→Z after rot)=face-to-face zSpan；thickness(Y)=27；width(→X after rot)=27
  const SIDE_RAIL_SZ = 27;
  for (const sx of [-1, 1] as const) {
    parts.push({
      id: sx < 0 ? "foot-rail-side-l" : "foot-rail-side-r",
      nameZh: `${sx < 0 ? "左" : "右"}步步高側棖`,
      material,
      grainDirection: "length",
      // length(→Z after rot)=face-to-face 前後跨距；thickness(Y)=27；width(→X after rot)=27
      visible: { length: zSpanFaceToFace, thickness: SIDE_RAIL_SZ, width: SIDE_RAIL_SZ },
      origin: { x: sx * legXOff, y: 120, z: zMid },
      rotation: { x: 0, y: Math.PI / 2, z: 0 },
      shape: { kind: "box" },
      tenons: [],
      mortises: [],
    });
  }

  // 步步高後棖：沿 X，27×27 方斷面，離地 150mm（棖底面）
  // visible: length(X)=face-to-face xSpan；thickness(Y)=27；width(Z)=27
  const BACK_RAIL_SZ = 27;
  parts.push({
    id: "foot-rail-back",
    nameZh: "步步高後棖",
    material,
    grainDirection: "length",
    // length(X)=face-to-face 跨距；thickness(Y)=27；width(Z)=27
    visible: { length: xSpan, thickness: BACK_RAIL_SZ, width: BACK_RAIL_SZ },
    origin: { x: 0, y: 150, z: legZRear },
    shape: { kind: "box" },
    tenons: [],
    mortises: [],
  });

  return parts;
}

function buildArmRail(args: Pick<CircleChairBuildArgs, "material" | "seatWidth" | "seatDepth" | "ringHeight" | "sectionScale">): Part[] {
  const { material, seatWidth, seatDepth, ringHeight, sectionScale } = args;
  // 椅圈斷面：厚 36（垂直 → thickness）、寬 ~45–55（水平徑向 → width）
  // visible 慣例（geometry.ts:6）：length→X、thickness→Y(高)、width→Z(深)
  const { RING_T, ringY, backZ } = armRingAnchors(seatDepth, ringHeight);
  // 椅圈錨定支撐件：side rail 跑在後腿正上方、中-側轉角接點落在後腿頂，
  // 椅圈才真正「掛」在腿上（舊版 sideX 自己算、跟後腿差 7mm 又靠 audit clause 蓋掉 → 浮空沒接上）。
  const { legXOff, legZRear } = legAnchors(seatWidth, seatDepth);

  // 椅圈斷面寬（水平徑向，→ visible.width）
  const W_BACK = 55, W_MID = 50, W_SIDE = 45;

  // 馬蹄圈幾何鏈（5 段多邊近似），錨定 legAnchors：
  //   側桿 X = 後腿中心 X（legXOff）；中-側轉角接點 J_midside =(legXOff, legZRear)= 後腿頂正上方；
  //   後段沿 X 在最後緣 backZ；中桿 45° 斜接「後段端點 J_backmid」與「後腿頂 J_midside」。
  const sideX = legXOff;                              // 椅圈側桿 X = 後腿中心 X（後腿一木連做接此）
  const sideRearZ = legZRear;                         // 中-側轉角接點 Z = 後腿中心 Z
  const sideFrontZ = -seatDepth / 2 + 20;             // 側桿前端 Z（扶手出頭，自由端）
  const CORNER_D = backZ - sideRearZ;                 // 45° 斜角段 X/Z 投影邊長（後段 Z → 後腿 Z）
  const backHalf = sideX - CORNER_D;                  // 後段端點 X（保中桿 45°）
  // 接點：J_backmid=(backHalf, backZ)、J_midside=(sideX, sideRearZ)=後腿頂正上方。
  // box 斷面在 135° 轉角無法「斜接面對接」——改讓相鄰段端部互相延伸 JOINT_OVERLAP、
  // box 互穿填滿轉角（消 V 形縫；arm-rail×arm-rail 結構性 overlap 已由 audit clause 放行）。
  const JOINT_OVERLAP = 32;
  // 後段：兩端各延伸 JOINT_OVERLAP 越過 J_backmid
  const backLen = 2 * backHalf + 2 * JOINT_OVERLAP;
  // 中桿：J_backmid → J_midside 滿長 + 兩端各延伸 JOINT_OVERLAP；origin 落兩接點中點
  const midLen = Math.hypot(CORNER_D, CORNER_D) + 2 * JOINT_OVERLAP;
  const midOriginX = (backHalf + sideX) / 2;
  const midOriginZ = (backZ + sideRearZ) / 2;
  // 側桿：後端越過 J_midside 延伸 JOINT_OVERLAP、前端維持自由端 sideFrontZ
  const sideLen = (sideRearZ - sideFrontZ) + JOINT_OVERLAP;
  const sideMidZ = (sideFrontZ + sideRearZ + JOINT_OVERLAP) / 2;
  const parts: Part[] = [];

  // 後正中段（椅圈上靠桿）：沿 X、不旋轉、arch-bent 往 +Z 後凸
  // sectionScale 只乘水平截面寬（width），不乘垂直深（thickness=RING_T）與 origin
  parts.push({
    id: "arm-rail-back",
    nameZh: "椅圈上靠桿",
    material,
    grainDirection: "length",
    visible: { length: backLen, width: W_BACK * sectionScale, thickness: RING_T },
    origin: { x: 0, y: ringY, z: backZ },
    shape: { kind: "arch-bent", bendMm: 26 }, // 後段往 +Z 後凸的弧度（mm）
    tenons: [],
    mortises: [],
  });

  // 中桿 ×2（椅圈中桿）：繞 Y 斜置 ±45°，接「後段端點」到「左右桿後端」
  // mid-r：local +X(length) → 世界 (+X,−Z)，故 rotY = +π/4；local +Z(bend) → 世界 (+X,+Z) 外凸
  // sectionScale 只乘 width，不乘 thickness 與 origin
  for (const sx of [-1, 1] as const) {
    parts.push({
      id: sx < 0 ? "arm-rail-mid-l" : "arm-rail-mid-r",
      nameZh: "椅圈中桿",
      material,
      grainDirection: "length",
      visible: { length: midLen, width: W_MID * sectionScale, thickness: RING_T },
      origin: { x: sx * midOriginX, y: ringY, z: midOriginZ },
      rotation: { x: 0, y: sx * Math.PI / 4, z: 0 },
      shape: { kind: "arch-bent", bendMm: 14 }, // 中桿弧度較小（短段，連接後段與左右桿）
      tenons: [],
      mortises: [],
    });
  }

  // 左右桿 ×2（椅圈左右桿，鱔魚頭扶手）：繞 Y 轉 ±90° 沿 Z 向前
  // side-r：local +X(length) → 世界 −Z（往前），local +Z(bend) → 世界 +X（外撇）
  // sectionScale 只乘 width，不乘 thickness 與 origin
  for (const sx of [-1, 1] as const) {
    parts.push({
      id: sx < 0 ? "arm-rail-side-l" : "arm-rail-side-r",
      nameZh: "椅圈左右桿",
      material,
      grainDirection: "length",
      visible: { length: sideLen, width: W_SIDE * sectionScale, thickness: RING_T },
      origin: { x: sx * sideX, y: ringY, z: sideMidZ },
      rotation: { x: 0, y: sx * Math.PI / 2, z: 0 },
      shape: { kind: "arch-bent", bendMm: 28 }, // 左右桿弧度（鱔魚頭往前外撇）
      tenons: [],
      mortises: [],
    });
  }
  return parts;
}

/**
 * S 曲線三件：聯幫棍 ×2（side-spindle-l/r）+ 靠背板（back-splat）
 *
 * 聯幫棍：椅圈左右桿與座框側邊之間的彎棍。
 *   P1 用 splayed-round-tapered（圓料外斜，dzMm 底面沿 +Z 偏移、頂面不動）。
 *   ⚠️ splayed-round-tapered 是圓料 shape，length 必須 === width（直徑）。
 *   計畫的 50×30 非正方，P1 簡化為 40×40 圓棍（~40mm 直徑，合理近似）。
 *
 * 靠背板：素獨板 S 形，下接後大邊、上接椅圈後段。
 *   face-rounded + bendMm + bendAxis:"z"。
 *   visible 慣例：length(X)=185 板寬、thickness(Y)=splatH 板高、width(Z)=40 板厚。
 *   （注意：計畫圖原文 width/thickness 標注相反，此處已依 geometry.ts:6 慣例—length→X, thickness→Y, width→Z—修正）
 */
function buildSCurveMembers(args: Pick<CircleChairBuildArgs, "material" | "seatWidth" | "seatDepth" | "seatHeight" | "ringHeight" | "sectionScale">): Part[] {
  const { material, seatWidth, seatDepth, seatHeight, ringHeight, sectionScale } = args;
  const parts: Part[] = [];
  // 椅圈底面 Y（armRingAnchors helper：ringHeight - RING_T, RING_T=36，= buildArmRail.ringY）
  const { ringY, backZ: ARM_BACK_Z } = armRingAnchors(seatDepth, ringHeight);
  // 後大邊 Z 中心（seatFrameAnchors helper，= buildSeatFrame.seatBackZ）
  const { seatBackZ: SEAT_BACK_Z } = seatFrameAnchors(seatDepth, seatHeight);

  // 聯幫棍 ×2：座框側邊 → 椅圈左右桿；P1 用斜圓料近似弓形
  // splayed-round-tapered 要求 length === width（=圓料直徑），故 P1 取 40mm 正方
  // sectionScale 只乘截面直徑（length/width），不乘棍高（thickness）與 origin
  // SPINDLE_INSET：聯幫棍中心離座框側外緣內縮量（模組常數）
  const SPINDLE_D = 40; // 聯幫棍直徑（mm），P1 簡化為正方斷面圓料
  for (const sx of [-1, 1] as const) {
    const spindleH = ringY - seatHeight;
    parts.push({
      id: sx < 0 ? "side-spindle-l" : "side-spindle-r",
      nameZh: "聯幫棍",
      material, grainDirection: "length",
      // length(X)=直徑、width(Z)=直徑、thickness(Y)=棍高（geometry.ts:6 慣例）
      // sectionScale 乘截面（length/width），不乘高度（thickness）
      visible: { length: SPINDLE_D * sectionScale, width: SPINDLE_D * sectionScale, thickness: spindleH },
      origin: { x: sx * (seatWidth / 2 - SPINDLE_INSET), y: seatHeight, z: -seatDepth * 0.08 },
      shape: { kind: "splayed-round-tapered", bottomScale: 1.1, dxMm: 0, dzMm: 38 },
      tenons: [], mortises: [],
    });
  }

  // 靠背板：素獨板 S 形，下接後大邊、上接椅圈後段
  // visible 慣例：length(X)=板寬 185、thickness(Y)=板高 splatH、width(Z)=板厚 40
  // （注意：計畫圖原文 width/thickness 標注相反，此處已依 geometry.ts:6 慣例—length→X, thickness→Y, width→Z—修正）
  //
  // 連接邏輯（origin.z）：
  //   後大邊（seat-rail-back）SEAT_BACK_Z = seatDepth/2 - RAIL_T_SEAT/2 → Z 中心 ≈ 229mm（seatFrameAnchors.seatBackZ）
  //   椅圈後段（arm-rail-back）ARM_BACK_Z = seatDepth/2+28 → Z 中心 ≈ 276.5mm（armRingAnchors.backZ）
  //   靠背板 width=40（Z±20），origin.z 取兩者中心的中點 → AABB 同時與兩者重疊。
  //
  // 連接邏輯（thickness/Y）：
  //   splatH 加長 +15mm，讓靠背板頂端 Y 略高於椅圈後段底面（ringY），真正插進椅圈後段。
  // sectionScale 只乘截面（length=板寬, width=板厚），不乘板高（thickness=splatH）與 origin
  const splatZ = (SEAT_BACK_Z + ARM_BACK_Z) / 2;   // 兩 Z 中心的中點 → AABB overlap 兩者
  const splatBottomY = seatHeight;
  const splatH = ringY - splatBottomY + 15;         // +15mm：讓頂端插進椅圈後段（不再浮空相切）
  parts.push({
    id: "back-splat",
    nameZh: "靠背板",
    material, grainDirection: "length",
    // sectionScale 乘板寬（length）與板厚（width），不乘板高（thickness）
    visible: { length: 185 * sectionScale, thickness: splatH, width: 40 * sectionScale },
    origin: { x: 0, y: splatBottomY, z: splatZ },
    rotation: { x: 0, y: 0, z: 0 },
    shape: { kind: "face-rounded", cornerR: 12, bendMm: 32, bendAxis: "z" },
    tenons: [], mortises: [],
  });
  return parts;
}

/**
 * 角牙 8 件（P1 box 佔位；終態 face-rounded 壼門/雲紋）
 *
 * visible 慣例（geometry.ts:6）：length→X、thickness→Y(高)、width→Z(深)
 *
 * 前腳角牙 ×2（rotY=0，板面在 XY 平面）：
 *   length(X)=115（沿座寬方向）、thickness(Y)=FRONT_BRACE_H=55（板高）、width(Z)=10（薄片貼角，深度方向 10mm）
 *
 * 橫飾棖角牙 ×6：
 *   前後 ×2（rotY=0，板面在 XY 平面）：
 *     length(X)=76、thickness(Y)=DECOR_BRACE_H=60、width(Z)=10
 *   左右側 ×4（rotY=±π/2，X←→Z swap after rot）：
 *     local length(→Z_world)=76、thickness(Y)=DECOR_BRACE_H=60、width(→X_world)=10
 *     → visible: { length: 76, thickness: 60, width: 10 }（同上，旋轉後 width=10 變世界 X 薄片方向）
 */
function buildCornerBraces(args: Pick<CircleChairBuildArgs, "material" | "seatWidth" | "seatDepth" | "seatHeight">): Part[] {
  const { material, seatWidth, seatDepth, seatHeight } = args;
  const parts: Part[] = [];
  const { FRONT_D, REAR_D, legXOff, legZFront, legZRear } = legAnchors(seatWidth, seatDepth);

  // 橫飾棖底面 Y（與 buildStretchers 的 decorY 同步，DECOR_H 為模組常數）
  const decorY = seatHeight - RAIL_W - DECOR_H; // 橫飾棖底面 Y = part origin Y

  // ── 前腳角牙 ×2：前腳內側、貼座框前大邊底 ──────────────────────────────
  // 擺在座框前緣（z ≈ legZFront）附近，X 緊靠前腳內側
  // visible: length(X)=115、thickness(Y)=FRONT_BRACE_H=55、width(Z)=10（薄片方向 = Z）
  for (const sx of [-1, 1] as const) {
    // X 中心：腳中心內移 40mm（角牙橫跨腳內側到大邊接角）
    const braceX = sx * (legXOff - 40);
    // Y 底面：座框底 - RAIL_W 落在座框底，角牙頂接座框底（座框底 y = seatHeight - RAIL_W）
    // FRONT_BRACE_H = 角牙高（visible.thickness），origin = 底面
    const braceY = seatHeight - RAIL_W - FRONT_BRACE_H;
    // Z 中心：前腳中心（legZFront）稍微內移 5mm（貼大邊後緣）
    const braceZ = legZFront + 5;
    parts.push({
      id: sx < 0 ? "corner-brace-front-l" : "corner-brace-front-r",
      nameZh: "前腳角牙",
      material, grainDirection: "length",
      // length(X)=115 沿座寬；thickness(Y)=FRONT_BRACE_H=55 板高；width(Z)=10 薄片貼角
      visible: { length: 115, thickness: FRONT_BRACE_H, width: 10 },
      origin: { x: braceX, y: braceY, z: braceZ },
      shape: { kind: "box" }, tenons: [], mortises: [],
    });
  }

  // ── 橫飾棖角牙 ×6：貼橫飾棖與腿夾角 ────────────────────────────────────
  // decorY = 橫飾棖底面 Y；角牙底面對齊橫飾棖底面
  // 前 ×2（rotY=0）：visible length(X)=76、thickness(Y)=DECOR_BRACE_H=60、width(Z)=10（薄片方向 Z）
  // 左右 ×4（rotY=±π/2）：swap X↔Z，visible length(→Z)=76、thickness(Y)=DECOR_BRACE_H=60、width(→X)=10（薄片方向 X_world）

  // 前橫飾棖角牙（緊貼前腳 × 前橫飾棖下緣，rotY=0，各 2 件）
  // 位置：掛在橫飾棖底面以下，頂面對齊橫飾棖底面 (decorY)，角牙向下展開
  // Y_top = decorY，Y_bottom = decorY - DECOR_BRACE_H=60；與前腳角牙 Y_bottom(seatHeight-RAIL_W-FRONT_BRACE_H=55) 不重疊
  // Z 中心：比前腳角牙更靠前（legZFront - 12），讓兩角牙在 Z 向也清楚分離
  for (const sx of [-1, 1] as const) {
    // X 中心：腳中心內移 38mm（角牙約跨腳內側~棖端）
    const braceX = sx * (legXOff - 38);
    // Y 底面：decorY - DECOR_BRACE_H（頂面 = decorY，掛在橫飾棖正下方）
    const braceOriginY = decorY - DECOR_BRACE_H;
    // Z 中心：前腳中心稍往前（legZFront - 12），避免與 corner-brace-front Z 重疊
    const braceZ = legZFront - 12;
    parts.push({
      id: `decor-brace-${sx < 0 ? 1 : 2}`,
      nameZh: "橫飾棖角牙",
      material, grainDirection: "length",
      visible: { length: 76, thickness: DECOR_BRACE_H, width: 10 },
      origin: { x: braceX, y: braceOriginY, z: braceZ },
      shape: { kind: "box" }, tenons: [], mortises: [],
    });
  }

  // 左右側橫飾棖角牙（左右腳位，rotY=π/2，各 2 件）
  // rotY=π/2 後 X↔Z swap：local length(76)→Z_world（棖長方向）、width(10)→X_world（薄片）
  // zMid：前後腳 Z 中點（= buildStretchers.zMid，數學等價）
  const zMidFront = legZFront + FRONT_D / 2; // 前腳後緣 Z
  const zMidRear  = legZRear  - REAR_D  / 2; // 後腳前緣 Z
  const sideBraceZMid = (zMidFront + zMidRear) / 2; // 側棖中點 Z（= buildStretchers.zMid，數學等價）

  let decorBraceIdx = 3; // decor-brace-3 ~ decor-brace-6
  for (const sx of [-1, 1] as const) {       // 左(-1) / 右(+1)
    for (const zOff of [-1, 1] as const) {   // 前(-1) / 後(+1) 各一
      // Z 中心：側棖中點偏前或偏後（分置於側棖前後段附近的腳側夾角）
      const braceZ = sideBraceZMid + zOff * (zMidRear - sideBraceZMid) * 0.5;
      // X 中心：腳外緣（legXOff = 腳中心 X），薄片貼腳面，X 中心 = ±legXOff（腳中心）
      const braceX = sx * legXOff;
      parts.push({
        id: `decor-brace-${decorBraceIdx++}`,
        nameZh: "橫飾棖角牙",
        material, grainDirection: "length",
        // rotY=π/2：local length(76)→Z_world；thickness(Y)=DECOR_BRACE_H=60；width(10)→X_world（薄片）
        visible: { length: 76, thickness: DECOR_BRACE_H, width: 10 },
        origin: { x: braceX, y: decorY, z: braceZ },
        rotation: { x: 0, y: Math.PI / 2, z: 0 },
        shape: { kind: "box" }, tenons: [], mortises: [],
      });
    }
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

  // 風格 preset（spec §8.2）：讀取三個教材選項
  const stylePreset = getOption<string>(input, opt(o, "stylePreset"));
  const footRailJoint = getOption<string>(input, opt(o, "footRailJoint"));
  const seatCornerStructure = getOption<string>(input, opt(o, "seatCornerStructure"));

  // 倍率依據 spec §8.2
  // preset → 截面倍率表（只改料的粗細，不改長度與位置）
  const PRESET: Record<string, { sectionScale: number; legScale: number }> = {
    "ming-plain":       { sectionScale: 1.0,  legScale: 1.0  },
    "huanghuali-slim":  { sectionScale: 0.85, legScale: 0.88 },
    "jichimu-stout":    { sectionScale: 1.15, legScale: 1.18 },
  };
  const preset = PRESET[stylePreset] ?? PRESET["ming-plain"];

  const parts: Part[] = [];
  parts.push(...buildSeatFrame({
    material, seatWidth: input.length, seatDepth: input.width, seatHeight,
    seatChamferMm, seatEdgeStyle,
  }));
  parts.push(...buildLegs({
    material, seatWidth: input.length, seatDepth: input.width, seatHeight,
    ringHeight: input.height,
    legScale: preset.legScale,
  }));
  parts.push(...buildStretchers({
    material, seatWidth: input.length, seatDepth: input.width, seatHeight,
  }));
  parts.push(...buildArmRail({
    material, seatWidth: input.length, seatDepth: input.width, ringHeight: input.height,
    sectionScale: preset.sectionScale,
  }));
  parts.push(...buildSCurveMembers({
    material, seatWidth: input.length, seatDepth: input.width, seatHeight, ringHeight: input.height,
    sectionScale: preset.sectionScale,
  }));
  parts.push(...buildCornerBraces({
    material, seatWidth: input.length, seatDepth: input.width, seatHeight,
  }));

  // 管腳棖榫型說明（P1 只影響 notes，幾何不變）
  const footRailJointNotes: Record<string, string> = {
    "duck-bill": "管腳棖用「鴨母嘴（斜口勾掛榫）」——斜口精度高，初學建議先練方榫。",
    "square-tenon": "管腳棖用「椿榫（規矩方榫）」——結構牢靠、加工友善。",
  };
  const footRailJointNote = footRailJointNotes[footRailJoint] ?? footRailJointNotes["square-tenon"];

  // 椅盤轉角說明（P1 只影響 notes，幾何不變）
  const seatCornerNotes: Record<string, string> = {
    "structure-2": "椅盤轉角採「第二種結構」——魯班學堂教材對照版本 B。",
    "structure-1": "椅盤轉角採「第一種結構」——魯班學堂教材對照版本 A。",
  };
  const seatCornerNote = seatCornerNotes[seatCornerStructure] ?? seatCornerNotes["structure-1"];

  // 風格說明（倍率值從 preset 物件帶入，避免改 PRESET 表忘改 note 文字）
  const presetNotes: Record<string, string> = {
    "huanghuali-slim": `黃花梨細秀款：椅圈截面收細（×${preset.sectionScale}）、腿料收細（×${preset.legScale}），展現明式纖秀風格。`,
    "jichimu-stout":   `雞翅木壯實款：椅圈截面放大（×${preset.sectionScale}）、腿料放大（×${preset.legScale}），凸顯雞翅木厚實木紋。`,
    "ming-plain":      "明式素圈椅工作圖原型（胡桃木，截面比例 1:1）。",
  };
  const presetNote = presetNotes[stylePreset] ?? presetNotes["ming-plain"];

  const design: FurnitureDesign = {
    id: `circle-chair-${input.length}x${input.height}`,
    category: "circle-chair",
    nameZh: "明式圈椅",
    overall: { length: input.length, width: input.width, thickness: input.height },
    parts,
    defaultJoinery: "blind-tenon",
    useButtJointConvention: true,
    primaryMaterial: material,
    notes: [
      `明式圈椅（Phase 1 框架版）座寬 ${input.length}mm × 座深 ${input.width}mm × 椅圈高 ${input.height}mm。`,
      presetNote,
      footRailJointNote,
      seatCornerNote,
    ].join(" "),
  };
  const roundLegWarnings = validateRoundLegJoinery(design);
  if (roundLegWarnings.length) design.warnings = [...(design.warnings ?? []), ...roundLegWarnings];
  applyStandardChecks(design, {
    minLength: 550, minWidth: 440, minHeight: 650,
    maxLength: 750, maxWidth: 600, maxHeight: 1150,
  });
  return design;
};
