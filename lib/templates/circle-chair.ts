import type { FurnitureDesign, FurnitureTemplate, JoineryType, MaterialId, OptionSpec, Part, TenonPosition } from "@/lib/types";
import { getOption, opt } from "@/lib/types";
import { rotateXYZ, partWorldCenter } from "@/lib/assembly/joint-world";
import { worldExtents } from "@/lib/render/geometry";
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
/**
 * 椅圈楔釘榫搭口長（設計規格，沿弧量；進 buildCircleChairJoints 的 tenon.length / mortise.depth）。
 * ⭐ 修過的缺陷：原本 32mm，轉角搭口太窄（中桿端面離側桿外緣只剩 0.1mm），木料
 * 沒有餘量開楔釘榫（傳統比例搭口要 75~100mm）。改成 85mm，落在傳統比例區間內。
 * ⚠️ 這個數字「不是」P1 box 幾何的端部延伸量——延伸量在 buildArmRail 依鄰段寬另算，
 *    否則直段 box 會戳出椅圈輪廓外（見 buildArmRail 註解）。
 */
const RING_JOINT_OVERLAP = 85;

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
  // X 方向：兩端接同一排腳，兩腳直徑相同才能對半減；前排用 FRONT_D、後排用 REAR_D
  // ⭐ 修過的缺陷：後橫飾棖／步步高後棖以前誤用 FRONT_D(50) 算跨距，但兩端接的是
  //   REAR_D(36) 的後腳，跨距算短了 (FRONT_D-REAR_D)=14mm，兩端各差 7mm 接不到腳。
  const xSpan = 2 * legXOff - FRONT_D;
  const xSpanRear = 2 * legXOff - REAR_D;
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
      // 前棖接前腳(FRONT_D)用 xSpan；後棖接後腳(REAR_D)用 xSpanRear
      visible: { length: sz < 0 ? xSpan : xSpanRear, thickness: DECOR_H, width: DECOR_T },
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
    // length(X)=face-to-face 跨距（接後腳 REAR_D，不是前腳 FRONT_D）；thickness(Y)=27；width(Z)=27
    visible: { length: xSpanRear, thickness: BACK_RAIL_SZ, width: BACK_RAIL_SZ },
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
  // box 斷面在 135° 轉角無法「斜接面對接」——讓相鄰段端部互相延伸、box 互穿填滿轉角
  // （消 V 形縫；arm-rail×arm-rail 結構性 overlap 已由 audit clause 放行）。
  //
  // ⭐ 缺陷 4 的取捨：楔釘榫搭口 RING_JOINT_OVERLAP(85) 是「設計規格」，只進榫卯資料
  //   （tenon.length / mortise.depth，沿弧量）。P1 直段 box 的「端部延伸量」要另外算：
  //   端面中心落在鄰段外緣內側 LAP_END_INSET 處——延伸量 = (鄰段半寬 − inset)/sin45°。
  //   直接拿 85 當延伸量會讓中桿端頭探出上靠桿外緣 32mm、上靠桿端頭戳出側桿外 10mm，
  //   看起來搭口很長其實是零件伸到椅圈輪廓外面（AABB 量過），端面反而離鄰段更遠。
  //   舊版 32 則是端面剛好貼在側桿外緣（0.1mm），兩邊都不對。真正的連續弧搭口要等
  //   P3 swept-curve 椅圈，P1 只保證：端面在鄰段料內、榫卯資料帶正確搭口長度。
  const LAP_END_INSET = 3;
  const s45 = Math.SQRT1_2;
  const wBack = W_BACK * sectionScale, wMid = W_MID * sectionScale, wSide = W_SIDE * sectionScale;
  const extInto = (neighborW: number) => (neighborW / 2 - LAP_END_INSET) / s45;
  const extBackEnd = extInto(wMid);   // 上靠桿兩端越過 J_backmid（伸進中桿料內）
  const extMidBack = extInto(wBack);  // 中桿越過 J_backmid（伸進上靠桿料內）
  const extMidSide = extInto(wSide);  // 中桿越過 J_midside（伸進側桿料內）
  const extSideRear = extInto(wMid);  // 側桿後端越過 J_midside（伸進中桿料內）
  // 後段：兩端各延伸 extBackEnd 越過 J_backmid
  const backLen = 2 * backHalf + 2 * extBackEnd;
  // 中桿：J_backmid → J_midside 滿長 LJ + 兩端各自的延伸量；box 中心沿軸偏離兩接點中點
  const LJ = Math.hypot(CORNER_D, CORNER_D);
  const midLen = LJ + extMidBack + extMidSide;
  const midAxisT = (LJ + extMidSide - extMidBack) / 2;        // box 中心在軸上的位置（從 J_backmid 起算）
  const midOriginX = backHalf + s45 * midAxisT;               // 乘 sx 後用；軸向 (sx·s45, −s45)
  const midOriginZ = backZ - s45 * midAxisT;
  // 側桿：後端越過 J_midside 延伸 extSideRear、前端維持自由端 sideFrontZ
  const sideLen = (sideRearZ - sideFrontZ) + extSideRear;
  const sideMidZ = (sideFrontZ + sideRearZ + extSideRear) / 2;
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
  // 連接邏輯：
  //   後大邊（seat-rail-back）SEAT_BACK_Z ≈ 229mm；椅圈後段（arm-rail-back）ARM_BACK_Z ≈ 276.5mm
  //   （兩者 Z 相差 47.5mm，椅圈整圈在座面後緣外 28mm）。
  //   ⭐ 修過的缺陷 3：原本取兩者中點 splatZ≈252.75，靠背板(width=40) 對後大邊只搭 15.7mm、
  //   大半懸空；前一版改成對齊後大邊，換來頂端離椅圈 20mm 接不到——兩頭都要接上，
  //   直板唯一的解是「後仰」：下端中心對齊後大邊中心、上端中心對齊椅圈上靠桿中心，
  //   板繞 X 後仰 atan(47.5/219)≈12°（明式靠背板本來就是後仰的 S 形，P2 真 S 曲線
  //   會把這個直板換掉，P1 先用斜直板把兩端都真的接進料裡）。
  //   rotation.x 小角度跟餐椅椅背 rung 同一套（rotateXYZ 先 X 再 Y 再 Z；+θ 把 +Y 轉向 +Z=後）。
  //   part 繞「中心」旋轉，所以 origin 要反推：下端中心 =(0, seatHeight, SEAT_BACK_Z)。
  //   板底最低角會比下端中心低 (T/2)·sinθ≈4mm——那是斜肩要切掉的三角，origin 再抬
  //   這一段讓最低角剛好落在大邊頂面（不穿進大邊）；下端榫的 expectedGapMm 就是這個斜肩量。
  //   splatTopY = ringY + 15：頂端插進椅圈上靠桿 15mm（不再浮空相切）。
  // sectionScale 只乘截面（length=板寬, width=板厚），不乘板高（thickness=splatH）與 origin
  const SPLAT_T = 40 * sectionScale;
  const splatBottomY = seatHeight;
  const splatTopY = ringY + 15;
  const splatDy = splatTopY - splatBottomY;
  const splatDz = ARM_BACK_Z - SEAT_BACK_Z;
  const splatH = Math.hypot(splatDy, splatDz);            // 板高沿板身量（斜長）
  const splatTilt = Math.atan2(splatDz, splatDy);         // 後仰角（rad）
  const shoulderLift = (SPLAT_T / 2) * Math.sin(splatTilt); // 斜肩量：最低角抬到大邊頂面
  parts.push({
    id: "back-splat",
    nameZh: "靠背板",
    material, grainDirection: "length",
    // sectionScale 乘板寬（length）與板厚（width），不乘板高（thickness）
    visible: { length: 185 * sectionScale, thickness: splatH, width: SPLAT_T },
    origin: {
      x: 0,
      y: splatBottomY - (splatH / 2) * (1 - Math.cos(splatTilt)) + shoulderLift,
      z: SEAT_BACK_Z + (splatH / 2) * Math.sin(splatTilt),
    },
    rotation: { x: splatTilt, y: 0, z: 0 },
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
 * 前腳角牙 ×2（鵝脖角牙，rotY=0，板面在 XY 平面，座面之上）：
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

  // ── 前腳角牙 ×2（鵝脖角牙）：座面之上、鵝脖內側 × 前大邊頂面的夾角 ──────
  // ⭐ 修過的缺陷：舊版把它塞在座框底下（Y 334~389），但那個位置整根被前橫飾棖
  //   （Y 341~389、貼座框底）佔滿，兩件在 72×48×10 的體積裡互穿；spec §5 也載明
  //   椅盤下方「無獨立牙條」——壼門輪廓全由橫飾棖 + 橫飾棖角牙合成。前腳一木連做
  //   穿過椅盤後上段就是鵝脖，「前腳 × 前大邊夾角」唯一空著的位置是座面上方
  //   鵝脖根部（傳統鵝脖角牙），所以搬到 Y = seatHeight 起算、坐在前大邊頂面上。
  //   ⚠️ 這是幾何判斷不是圖紙實證（沒拿到工作圖原檔），列入回報請他複查。
  // 位置一律 face-to-face：外端貼鵝脖內側圓面（legXOff − FRONT_D/2），往座中心延伸 115。
  // visible: length(X)=115、thickness(Y)=FRONT_BRACE_H=55、width(Z)=10（薄片方向 = Z）
  const FRONT_BRACE_L = 115;
  for (const sx of [-1, 1] as const) {
    const braceX = sx * (legXOff - FRONT_D / 2 - FRONT_BRACE_L / 2);
    const braceY = seatHeight; // 底面坐在前大邊頂面（座框頂 = seatHeight）
    const braceZ = legZFront;  // 對齊鵝脖中心；落在前大邊 Z 範圍內（大邊板厚 39 > 腳徑一半 + 5）
    parts.push({
      id: sx < 0 ? "corner-brace-front-l" : "corner-brace-front-r",
      nameZh: "前腳角牙",
      material, grainDirection: "length",
      visible: { length: FRONT_BRACE_L, thickness: FRONT_BRACE_H, width: 10 },
      origin: { x: braceX, y: braceY, z: braceZ },
      shape: { kind: "box" }, tenons: [], mortises: [],
    });
  }

  // ── 橫飾棖角牙 ×6：貼橫飾棖與腿夾角 ────────────────────────────────────
  // decorY = 橫飾棖底面 Y；角牙底面對齊橫飾棖底面
  // 前 ×2（rotY=0）：visible length(X)=76、thickness(Y)=DECOR_BRACE_H=60、width(Z)=10（薄片方向 Z）
  // 左右 ×4（rotY=±π/2）：swap X↔Z，visible length(→Z)=76、thickness(Y)=DECOR_BRACE_H=60、width(→X)=10（薄片方向 X_world）

  // 6 片橫飾棖角牙統一做法（⭐ 修過的缺陷 2 / 7）：
  //   • 掛在橫飾棖正下方：頂面 = decorY（橫飾棖底面）、往下展開 DECOR_BRACE_H
  //   • 「入腿」：外端貼在腳的圓面上（face-to-face，跟棖的跨距同一套算法），
  //     不再讓角牙穿過腳中心（舊版 decor-brace-1/2 X 從腳中心起算、側面 4 片更是
  //     跨過腳中心兩側各 30mm，還跟前腳角牙／彼此互撞——角牙×角牙 audit 不放行）
  //   • 薄片方向置中在所屬橫飾棖的斷面裡（Z／X 中心 = 棖中心），頂端整片搭進棖底，
  //     舊版 −12／−8 的偏移都讓薄片有一部分探出棖外（缺陷 7 的 1.5mm 就是這樣來的）
  // 前 2 片（decor-brace-1/2）：rotY=0，沿 X 從前腳內側面往座中心延伸
  // 側 4 片（decor-brace-3~6）：rotY=π/2，沿 Z 從前／後腳面往棖中段延伸，
  //   左前／左後／右前／右後 4 個腳角各一片（spec §5：橫飾棖角牙前 2 + 左右各 2，後棖無）
  const DECOR_BRACE_L = 76;
  const decorBraceOriginY = decorY - DECOR_BRACE_H;
  for (const sx of [-1, 1] as const) {
    parts.push({
      id: `decor-brace-${sx < 0 ? 1 : 2}`,
      nameZh: "橫飾棖角牙",
      material, grainDirection: "length",
      visible: { length: DECOR_BRACE_L, thickness: DECOR_BRACE_H, width: 10 },
      origin: { x: sx * (legXOff - FRONT_D / 2 - DECOR_BRACE_L / 2), y: decorBraceOriginY, z: legZFront },
      shape: { kind: "box" }, tenons: [], mortises: [],
    });
  }
  const sideBraceCorners: Array<{ id: string; sx: -1 | 1; which: "front" | "rear" }> = [
    { id: "decor-brace-3", sx: -1, which: "front" },
    { id: "decor-brace-4", sx: -1, which: "rear" },
    { id: "decor-brace-5", sx: 1, which: "front" },
    { id: "decor-brace-6", sx: 1, which: "rear" },
  ];
  for (const { id, sx, which } of sideBraceCorners) {
    // 前腳面 Z = legZFront + FRONT_D/2（往後延伸）；後腳面 Z = legZRear − REAR_D/2（往前延伸）
    const braceZ = which === "front"
      ? legZFront + FRONT_D / 2 + DECOR_BRACE_L / 2
      : legZRear - REAR_D / 2 - DECOR_BRACE_L / 2;
    parts.push({
      id,
      nameZh: "橫飾棖角牙",
      material, grainDirection: "length",
      // rotY=π/2：local length(76)→Z_world；thickness(Y)=DECOR_BRACE_H=60；width(10)→X_world（薄片）
      visible: { length: DECOR_BRACE_L, thickness: DECOR_BRACE_H, width: 10 },
      origin: { x: sx * legXOff, y: decorBraceOriginY, z: braceZ },
      rotation: { x: 0, y: Math.PI / 2, z: 0 },
      shape: { kind: "box" }, tenons: [], mortises: [],
    });
  }

  return parts;
}


// ─────────────────────────────────────────────────────────────────────────────
// 榫卯資料（spec §9.1 的 23 處接合點）
//
// ⚠️ 位置一律「算」出來：每一處榫眼的 part-local 座標，都是把公榫件端面中心的
//    世界座標，反算回母件的 local frame 得到的（worldToMotherLocal），
//    沒有任何一個數字是目測填的。
//
// ⚠️ 位置對不對，跟 tenon.length 是兩件事，絕對不能混成一個數字：
//    gapMm = 公榫件端面中心 到 母件 OBB 的距離，只用來算 measuredGap／engagementLength
//    這兩個「量出來的事實」，寫進 design.warnings 給人看；tenon.length／mortise.depth
//    永遠維持設計規格（j.depth）不動——那是製造資料，會流到材料表／CSV／排料／報價／
//    零件圖／工序／CNC 加工面，買藍圖的人會照這個數字做出接不起來的椅子且無警告。
//    （09-17 阿嚴審核退回過「用 gap 縮短 tenon.length 讓 audit-joints 報紅」的舊寫法，
//    這裡不再那樣做；audit-joints.ts 本來就只比對 tenon/mortise 維度，不比位置，
//    位置正確與否完全靠這裡的 gap 計算 + warnings，不靠污染 tenon.length 讓維度對不上。）
// ─────────────────────────────────────────────────────────────────────────────

/** 兩件之間可容忍的空隙（mm）。超過就視為「根本沒接到」。 */
const JOINT_GAP_TOL = 10;
/** 榫肩寬（跟 lib/joinery/standards.ts 的 SHOULDER_MM 一致） */
const CC_SHOULDER = 5;

type W3 = { x: number; y: number; z: number };

/** 零件中心（世界座標）——直接用 joint-world 的同一支，稽核跟模板算出來的點才會一致 */
function ccPartCenter(p: Part): W3 {
  return partWorldCenter(p);
}
/** part-local → 世界方向（joint-world.rotateXYZ 同一套：先 X 再 Y 再 Z；靠背板有 rotation.x 後仰） */
function ccRot(p: Part, v: W3): W3 {
  const r = p.rotation ?? { x: 0, y: 0, z: 0 };
  return rotateXYZ(r.x ?? 0, r.y ?? 0, r.z ?? 0, v.x, v.y, v.z);
}
/** 世界方向 → part-local（rotateXYZ 的反轉：先 −Z、再 −Y、最後 −X） */
function ccRotInv(p: Part, v: W3): W3 {
  const r = p.rotation ?? { x: 0, y: 0, z: 0 };
  let o = rotateXYZ(0, 0, -(r.z ?? 0), v.x, v.y, v.z);
  o = rotateXYZ(0, -(r.y ?? 0), 0, o.x, o.y, o.z);
  o = rotateXYZ(-(r.x ?? 0), 0, 0, o.x, o.y, o.z);
  return o;
}
const CC_LOCAL_OUT: Record<TenonPosition, W3> = {
  start: { x: -1, y: 0, z: 0 },
  end: { x: 1, y: 0, z: 0 },
  top: { x: 0, y: 1, z: 0 },
  bottom: { x: 0, y: -1, z: 0 },
  left: { x: 0, y: 0, z: -1 },
  right: { x: 0, y: 0, z: 1 },
};
/** 公榫件端面中心的世界座標（跟 joint-world.tenonWorld 的 root 同一套算法） */
function ccTenonRoot(p: Part, pos: TenonPosition): W3 {
  const { length: lx, thickness: ly, width: lz } = p.visible;
  const u = CC_LOCAL_OUT[pos];
  const off = { x: (u.x * lx) / 2, y: (u.y * ly) / 2, z: (u.z * lz) / 2 };
  const w = ccRot(p, off);
  const c = ccPartCenter(p);
  return { x: c.x + w.x, y: c.y + w.y, z: c.z + w.z };
}
/** 榫頭往外（插進母件）的世界方向單位向量 */
function ccTenonOut(p: Part, pos: TenonPosition): W3 {
  return ccRot(p, CC_LOCAL_OUT[pos]);
}
/** 世界座標 → 母件 local（x/z 以斷面中心為原點、y 以底面為 0） */
function ccWorldToLocal(mother: Part, w: W3): W3 {
  const c = ccPartCenter(mother);
  const d = { x: w.x - c.x, y: w.y - c.y, z: w.z - c.z };
  const l = ccRotInv(mother, d);
  return { x: l.x, y: l.y + mother.visible.thickness / 2, z: l.z };
}
/** 點到母件 OBB 的距離（0 = 在母件裡面或貼在面上） */
function ccGapToPart(mother: Part, w: W3): number {
  const l = ccWorldToLocal(mother, w);
  const { length: lx, thickness: ly, width: lz } = mother.visible;
  const dx = Math.max(0, Math.abs(l.x) - lx / 2);
  const dy = Math.max(0, Math.abs(l.y - ly / 2) - ly / 2);
  const dz = Math.max(0, Math.abs(l.z) - lz / 2);
  return Math.hypot(dx, dy, dz);
}
/** 斷面座標微量超出母件時貼齊到面；超過容差就原樣留著讓 audit-mortise-spec 抓出來 */
function ccSoftClamp(v: number, half: number): number {
  const over = Math.abs(v) - half;
  if (over <= 0) return v;
  if (over <= JOINT_GAP_TOL) return Math.sign(v) * half;
  return v;
}

export interface CcJoint {
  /** 公榫件 id */
  child: string;
  /** 公榫長在公榫件的哪個端面 */
  pos: TenonPosition;
  /** 母件 id */
  mother: string;
  type: JoineryType;
  /** 榫寬（沿榫頭 width 軸）、榫厚（沿榫頭 thickness 軸） */
  w: number;
  t: number;
  /** 標準榫長 = 榫眼深（mm） */
  depth: number;
  /** 圓榫 → 榫眼挖圓孔 */
  round?: boolean;
  /**
   * 45° 斜接（楔釘榫）：dominantAxis 分不出 x/z，要明示世界軸向，
   * 並且榫眼保留反算出來的 local 座標（不貼齊到某個面——45° 沒有「面」可貼）。
   */
  diagonal?: boolean;
  /** 中文榫名，進 design.notes / warnings 用 */
  nameZh: string;
  /**
   * 刻意設計的間隙（mm，預設 0）——例如攢邊打槽裝板留的伸縮縫。
   * gap 超過這個值才算「沒到位」；≤ 這個值是正常木工做法，不報警告。
   * ⭐ 修過的缺陷：座板打槽裝板本來就該留 4mm 伸縮縫，之前沒有這個欄位，
   * gap 檢查拿「跟母件貼死」當唯一基準，把正確的留縫誤判成「沒接到位」。
   */
  expectedGapMm?: number;
}

/**
 * 把 joint 清單寫進 parts 的 tenons / mortises。
 * 回傳 gap 警告（兩件沒貼合的清單）。
 */
export function applyCircleChairJoinery(parts: Part[], joints: CcJoint[]): string[] {
  const byId = new Map(parts.map((p) => [p.id, p]));
  const warnings: string[] = [];
  for (const j of joints) {
    const child = byId.get(j.child);
    const mother = byId.get(j.mother);
    if (!child || !mother) {
      warnings.push(`榫卯資料引用了不存在的零件：${j.child} → ${j.mother}`);
      continue;
    }
    const root = ccTenonRoot(child, j.pos);
    const out = ccTenonOut(child, j.pos);
    const gap = ccGapToPart(mother, root);
    const expectedGap = j.expectedGapMm ?? 0;
    // measuredGap：實際量到的世界座標間隙；engagementLength：扣掉刻意留縫後、
    // 榫頭真正咬進母件的長度——這兩個是「量出來的事實」，只進 warnings 給人看，
    // 不寫回 tenon.length（見上方大段註解）。
    const measuredGap = gap;
    const engagementLength = Math.max(0, j.depth - Math.max(0, gap - expectedGap));
    const overTol = gap - expectedGap;
    if (overTol > 0.5) {
      warnings.push(
        `${j.nameZh}：「${child.nameZh}」的${j.pos}端離「${mother.nameZh}」還差 ${overTol.toFixed(1)}mm` +
          (overTol > JOINT_GAP_TOL ? "——位置不合，兩件沒到位，榫接不成立。" : "，榫頭要加長補這段。") +
          ` [measuredGap=${measuredGap.toFixed(1)}mm engagementLength=${engagementLength.toFixed(1)}mm]`,
      );
    }
    child.tenons.push({
      position: j.pos,
      type: j.type,
      // ⭐ 永遠用設計規格 j.depth，不管 gap 多少——榫長是製造資料，位置對不對
      // 由上面的 warnings 另外報，不縮短這個數字騙 audit-joints 的維度比對。
      length: j.depth,
      width: j.w,
      thickness: j.t,
      shoulderOn: ["top", "bottom", "left", "right"],
      ...(j.diagonal ? { axis: out } : {}),
    });
    // 榫眼 local 座標：把公榫端面中心反算進母件 local frame
    const l = ccWorldToLocal(mother, root);
    const { length: mlx, thickness: mly, width: mlz } = mother.visible;
    // 榫頭在母件 local frame 的行進方向 → 決定榫眼開在哪一面
    const dir = ccRotInv(mother, out);
    const ax = Math.abs(dir.x) >= Math.abs(dir.y) && Math.abs(dir.x) >= Math.abs(dir.z)
      ? "x"
      : Math.abs(dir.y) >= Math.abs(dir.z)
        ? "y"
        : "z";
    let ox = ccSoftClamp(l.x, mlx / 2);
    let oy = ccSoftClamp(l.y - mly / 2, mly / 2) + mly / 2;
    let oz = ccSoftClamp(l.z, mlz / 2);
    // 開口面 = 榫頭來的那一側（跟行進方向相反）。
    // 45° 斜接沒有單一「開口面」，保留反算座標讓 joint-world 自己挑最近的面。
    if (!j.diagonal) {
      if (ax === "x") ox = dir.x > 0 ? -mlx / 2 : mlx / 2;
      else if (ax === "y") oy = dir.y > 0 ? 0 : mly;
      else oz = dir.z > 0 ? -mlz / 2 : mlz / 2;
    }
    mother.mortises.push({
      origin: { x: ox, y: oy, z: oz },
      depth: j.depth,
      length: j.w,
      width: j.t,
      through: false, // 圓腳 / 曲面件一律盲榫（_validators.validateRoundLegJoinery）
      ...(j.round ? { shape: "round" as const } : {}),
      ...(j.diagonal ? { axis: { x: -out.x, y: -out.y, z: -out.z } } : {}),
    });
  }
  return warnings;
}


/** 圓腳盲榫深：不可超過半徑再留 4mm 保護（圓腳曲面不可通榫，見 _validators） */
function ccLegDepth(legDiameter: number): number {
  return Math.max(8, Math.round(legDiameter / 2) - 4);
}
/** 圓腳上的榫眼高（沿腳軸）不可等於直徑，兩側各留 4mm */
function ccLegSlot(legDiameter: number, want: number): number {
  return Math.min(want, Math.max(10, Math.round(legDiameter) - 8));
}

/**
 * spec §9.1 的 23 處接合點 → 實際 52 對公母榫。
 * 所有斷面尺寸都從 parts 自己的 visible 讀，preset 改截面時自動跟著變。
 */
export function buildCircleChairJoints(parts: Part[]): CcJoint[] {
  const by = new Map(parts.map((p) => [p.id, p]));
  const P = (id: string) => by.get(id)!;
  const J: CcJoint[] = [];
  const sh2 = 2 * CC_SHOULDER;

  // ── ① 椅圈段 ↔ 椅圈段（4 處）· 楔釘榫 ────────────────────────────────────
  // 楔釘榫＝兩段弧料勾搭半疊、再橫向打入楔形釘。repo 的 JoineryType union 沒有
  // 中式榫名（spec §9.3 路徑 B），取語意最近的 half-lap；榫厚 = 椅圈厚/2（半疊）。
  // 榫長 = 模板自己建的搭接量 JOINT_OVERLAP(32)。
  const ringT = P("arm-rail-back").visible.thickness;      // 椅圈斷面厚（Y）
  const RING_LAP = RING_JOINT_OVERLAP;                      // 跟 buildArmRail 的搭接量同一個常數，不重複寫死
  for (const side of ["l", "r"] as const) {
    const mid = P(`arm-rail-mid-${side}`);
    const midW = mid.visible.width;
    // mid-l：local +X（end）指向後段、local −X（start）指向側桿；mid-r 相反。
    const toBack: TenonPosition = side === "l" ? "end" : "start";
    const toSide: TenonPosition = side === "l" ? "start" : "end";
    J.push({
      child: mid.id, pos: toBack, mother: "arm-rail-back", type: "half-lap",
      w: Math.max(15, midW - sh2), t: Math.round(ringT / 2), depth: RING_LAP,
      diagonal: true, nameZh: "椅圈楔釘榫（上靠桿↔中桿）",
    });
    J.push({
      child: mid.id, pos: toSide, mother: `arm-rail-side-${side}`, type: "half-lap",
      w: Math.max(15, midW - sh2 - 6), t: Math.round(ringT / 2), depth: RING_LAP,
      diagonal: true, nameZh: "椅圈楔釘榫（中桿↔左右桿）",
    });
  }

  // ── ② 椅後腳頂 ↔ 椅圈底（2 處）· 圓榫（盲榫）────────────────────────────
  // ── ③ 鵝脖頂（椅前腳頂）↔ 椅圈底（2 處）· 圓榫（盲榫）──────────────────
  // 圓榫直徑 = 腳徑 × 0.6（同 round-stool 的腿頂榫慣例）；榫深 ≤ 椅圈厚 − 11 留底。
  const ringBlind = Math.max(15, Math.round((ringT * 2) / 3));   // 36 → 24…用標準 2/3
  for (const side of ["l", "r"] as const) {
    for (const which of ["rear", "front"] as const) {
      const leg = P(`leg-${which}-${side}`);
      const d = Math.round(leg.visible.length * 0.6);
      J.push({
        child: leg.id, pos: "top", mother: `arm-rail-side-${side}`, type: "blind-tenon",
        w: d, t: d, depth: ringBlind, round: true,
        nameZh: which === "rear" ? "後腳頂圓榫入椅圈" : "鵝脖頂圓榫入椅圈",
      });
    }
  }

  // ── ④ 聯幫棍上下端 ↔ 椅圈 / 椅盤（4 處）· 圓榫 ──────────────────────────
  for (const side of ["l", "r"] as const) {
    const sp = P(`side-spindle-${side}`);
    const d = Math.round(sp.visible.length * 0.6);
    J.push({
      child: sp.id, pos: "top", mother: `arm-rail-side-${side}`, type: "blind-tenon",
      w: d, t: d, depth: ringBlind, round: true, nameZh: "聯幫棍上端圓榫入椅圈",
    });
    J.push({
      child: sp.id, pos: "bottom", mother: `seat-rail-${side === "l" ? "left" : "right"}`,
      type: "blind-tenon", w: d, t: d, depth: 30, round: true,
      nameZh: "聯幫棍下端圓榫入椅盤抹頭",
    });
  }

  // ── ⑤ 靠背板上下端 ↔ 椅圈 / 後大邊（2 處）· 帶肩扁榫 ────────────────────
  {
    const sp = P("back-splat");
    const w = Math.max(15, sp.visible.length - sh2);   // top/bottom 榫寬沿 local X = 板寬
    const t = Math.max(6, Math.round(sp.visible.width / 3)); // 榫厚沿 local Z = 板厚/3
    J.push({ child: sp.id, pos: "top", mother: "arm-rail-back", type: "shouldered-tenon",
      w, t, depth: ringBlind, nameZh: "靠背板上端帶肩扁榫入椅圈" });
    // 靠背板後仰（rotation.x）→ 下端要切斜肩：板底面中心離大邊頂面 (T/2)·sinθ，是設計量不是沒接到
    const shoulderGap = (sp.visible.width / 2) * Math.sin(Math.abs(sp.rotation?.x ?? 0));
    J.push({ child: sp.id, pos: "bottom", mother: "seat-rail-back", type: "shouldered-tenon",
      w, t, depth: 30, expectedGapMm: shoulderGap, nameZh: "靠背板下端帶肩扁榫入後大邊" });
  }

  // ── ⑥ 椅盤大邊 ↔ 抹頭（4 角）· 格角榫（攢邊 45° 割角）──────────────────
  {
    const stile = P("seat-rail-left");
    const railT = stile.visible.width;      // 板料厚 39（榫寬軸 = local Z）
    const railH = stile.visible.thickness;  // 斷面高 91（榫厚軸 = local Y）
    const w = Math.max(15, railT - sh2);
    const t = Math.max(6, Math.round(railH / 3));
    const depth = Math.max(15, Math.round((railT * 2) / 3));
    for (const side of ["left", "right"] as const) {
      // 抹頭 local +X → 世界 −Z（前大邊）；local −X → 世界 +Z（後大邊）
      J.push({ child: `seat-rail-${side}`, pos: "end", mother: "seat-rail-front", type: "mitered-spline",
        w, t, depth, nameZh: "椅盤攢邊格角榫（前角）" });
      J.push({ child: `seat-rail-${side}`, pos: "start", mother: "seat-rail-back", type: "mitered-spline",
        w, t, depth, nameZh: "椅盤攢邊格角榫（後角）" });
    }
  }

  // ── ⑦ 椅盤框 ↔ 座板（4 邊）· 攢邊打槽裝板 ──────────────────────────────
  {
    const pan = P("seat-panel");
    const t = Math.max(6, Math.round(pan.visible.thickness / 2)); // 薄板舌厚 = T/2
    const GROOVE = 10;
    // ⭐ 修過的缺陷：座板四邊本來就刻意離框內面 4mm（打槽裝板留伸縮縫，木工正確做法），
    // 不是接不到位；expectedGapMm:4 讓 gap 檢查把這 4mm 當「設計好的縫」，不再誤報。
    J.push({ child: pan.id, pos: "start", mother: "seat-rail-left", type: "tongue-and-groove",
      w: Math.max(15, pan.visible.width - sh2), t, depth: GROOVE, expectedGapMm: 4, nameZh: "座板打槽裝板（左）" });
    J.push({ child: pan.id, pos: "end", mother: "seat-rail-right", type: "tongue-and-groove",
      w: Math.max(15, pan.visible.width - sh2), t, depth: GROOVE, expectedGapMm: 4, nameZh: "座板打槽裝板（右）" });
    J.push({ child: pan.id, pos: "left", mother: "seat-rail-front", type: "tongue-and-groove",
      w: Math.max(15, pan.visible.length - sh2), t, depth: GROOVE, expectedGapMm: 4, nameZh: "座板打槽裝板（前）" });
    J.push({ child: pan.id, pos: "right", mother: "seat-rail-back", type: "tongue-and-groove",
      w: Math.max(15, pan.visible.length - sh2), t, depth: GROOVE, expectedGapMm: 4, nameZh: "座板打槽裝板（後）" });
  }

  // ── ⑧ 椅盤框 ↔ 穿帶（2 處）· 直榫 ───────────────────────────────────────
  {
    const b = P("seat-thru-batten");
    const w = Math.max(15, b.visible.width - sh2);
    const t = Math.max(6, Math.round(b.visible.thickness / 3));
    const depth = Math.max(15, Math.round((P("seat-rail-front").visible.width * 2) / 3));
    J.push({ child: b.id, pos: "start", mother: "seat-rail-back", type: "blind-tenon",
      w, t, depth, nameZh: "穿帶直榫入後大邊" });
    J.push({ child: b.id, pos: "end", mother: "seat-rail-front", type: "blind-tenon",
      w, t, depth, nameZh: "穿帶直榫入前大邊" });
  }

  // ── ⑨ 橫飾棖 ↔ 腿（8 處）· 格肩榫 ───────────────────────────────────────
  // ── ⑩ 管腳棖 ↔ 腿（8 處）· 椿榫 / 鴨母嘴（教材兩選項，P1 只影響文案）────
  const railToLeg = (
    childId: string, pos: TenonPosition, legId: string, type: JoineryType, nameZh: string,
  ) => {
    const c = P(childId), leg = P(legId);
    const legD = leg.visible.length;                 // 圓腳直徑
    // start/end：榫寬軸 = local Z（斷面深）、榫厚軸 = local Y（斷面高）
    const w = Math.max(15, c.visible.width - sh2);
    const t = ccLegSlot(legD, Math.max(6, Math.round(c.visible.thickness / 3)));
    J.push({ child: childId, pos, mother: legId, type, w, t, depth: ccLegDepth(legD), nameZh });
  };
  for (const side of ["l", "r"] as const) {
    const L = side === "l" ? -1 : 1;
    void L;
    // 前後橫飾棖：沿 X，兩端各進一隻同排的腳
    railToLeg("decor-rail-front", side === "l" ? "start" : "end", `leg-front-${side}`,
      "shouldered-tenon", "前橫飾棖格肩榫入前腳");
    railToLeg("decor-rail-back", side === "l" ? "start" : "end", `leg-rear-${side}`,
      "shouldered-tenon", "後橫飾棖格肩榫入後腳");
    // 左右橫飾棖：rotY=+π/2 → local +X 指世界 −Z（前腳）、local −X 指世界 +Z（後腳）
    railToLeg(`decor-rail-${side === "l" ? "left" : "right"}`, "end", `leg-front-${side}`,
      "shouldered-tenon", "側橫飾棖格肩榫入前腳");
    railToLeg(`decor-rail-${side === "l" ? "left" : "right"}`, "start", `leg-rear-${side}`,
      "shouldered-tenon", "側橫飾棖格肩榫入後腳");
    // 前腳棖（踏腳棖）
    railToLeg("foot-rail-front", side === "l" ? "start" : "end", `leg-front-${side}`,
      "blind-tenon", "踏腳棖椿榫入前腳");
    // 步步高側棖
    railToLeg(`foot-rail-side-${side}`, "end", `leg-front-${side}`,
      "blind-tenon", "步步高側棖椿榫入前腳");
    railToLeg(`foot-rail-side-${side}`, "start", `leg-rear-${side}`,
      "blind-tenon", "步步高側棖椿榫入後腳");
    // 步步高後棖
    railToLeg("foot-rail-back", side === "l" ? "start" : "end", `leg-rear-${side}`,
      "blind-tenon", "步步高後棖椿榫入後腳");
  }

  // ── ⑪ 前腳角牙 ↔ 腿 + 椅盤（2 處）· 夾頭榫 ─────────────────────────────
  for (const side of ["l", "r"] as const) {
    const b = P(`corner-brace-front-${side}`);
    const leg = P(`leg-front-${side}`);
    const legD = leg.visible.length;
    J.push({
      child: b.id, pos: side === "l" ? "start" : "end", mother: leg.id, type: "shouldered-tenon",
      w: b.visible.width,                                   // 10mm 薄牙片整片入槽、不留肩
      t: ccLegSlot(legD, Math.max(10, b.visible.thickness - sh2)),
      depth: Math.min(12, ccLegDepth(legD)), nameZh: "前腳角牙夾頭榫入腿",
    });
    // 鵝脖角牙坐在前大邊頂面上 → 下端（bottom）入大邊（見 buildCornerBraces 位置註解）
    J.push({
      child: b.id, pos: "bottom", mother: "seat-rail-front", type: "shouldered-tenon",
      w: Math.max(15, b.visible.length - sh2), t: b.visible.width, depth: 12,
      nameZh: "前腳角牙夾頭榫入大邊",
    });
  }

  // ── ⑫ 橫飾棖角牙 ↔ 棖 + 腿（8 處）· 夾頭榫式角牙 ────────────────────────
  // 前面 2 片（decor-brace-1/2）掛在前橫飾棖下、內端進前腳；
  // 側面 4 片（decor-brace-3~6）⭐ 已修：統一成同一種做法（入腿 + 頂端入側橫飾棖），
  // 不再只寫「頂端入抹頭」那一條（見 buildCornerBraces 同一條缺陷的位置修正）。
  for (const [id, side] of [["decor-brace-1", "l"], ["decor-brace-2", "r"]] as const) {
    const b = P(id);
    const leg = P(`leg-front-${side}`);
    const legD = leg.visible.length;
    J.push({
      child: id, pos: side === "l" ? "start" : "end", mother: leg.id, type: "shouldered-tenon",
      w: b.visible.width,
      t: ccLegSlot(legD, Math.max(10, b.visible.thickness - sh2)),
      depth: Math.min(12, ccLegDepth(legD)), nameZh: "橫飾棖角牙夾頭榫入前腳",
    });
    J.push({
      child: id, pos: "top", mother: "decor-rail-front", type: "shouldered-tenon",
      w: Math.max(15, b.visible.length - sh2), t: b.visible.width, depth: 12,
      nameZh: "橫飾棖角牙夾頭榫入前橫飾棖",
    });
  }
  for (const [id, side, which] of [
    ["decor-brace-3", "l", "front"], ["decor-brace-4", "l", "rear"],
    ["decor-brace-5", "r", "front"], ["decor-brace-6", "r", "rear"],
  ] as const) {
    const b = P(id);
    const leg = P(`leg-${which}-${side}`);
    const legD = leg.visible.length;
    // 跟 decor-rail-left/right 同一套旋轉慣例：local +X(end)→世界前(-Z)、-X(start)→世界後(+Z)
    J.push({
      child: id, pos: which === "front" ? "end" : "start", mother: leg.id, type: "shouldered-tenon",
      w: b.visible.width,
      t: ccLegSlot(legD, Math.max(10, b.visible.thickness - sh2)),
      depth: Math.min(12, ccLegDepth(legD)), nameZh: "側橫飾棖角牙夾頭榫入腿",
    });
    J.push({
      child: id, pos: "top", mother: `decor-rail-${side === "l" ? "left" : "right"}`, type: "shouldered-tenon",
      w: Math.max(15, b.visible.length - sh2), t: b.visible.width, depth: 12,
      nameZh: "側橫飾棖角牙夾頭榫入側橫飾棖",
    });
  }

  return J;
}

/**
 * 大進大出：前／後腳一木連做，從地面貫穿椅盤角（座框大邊）繼續往上到椅圈——
 * 不是端面榫接，是「原始斷面（不縮小成榫頭）貫穿母件」。
 *
 * ⭐ 缺陷 5 的資料結構：現有 Tenon/Mortise 只能表達「公榫件端面插入母件」，沒有
 * 「子件中段貫穿母件、兩端都露出」這種關係，所以只在母件（座框大邊）上記一個
 * mortise（圓孔、through:true、`passThroughChildId` 指回那隻腳），不推對應的
 * tenon——腳本身不縮小，沒有可比對的榫頭端面。`passThroughChildId` 這個欄位
 * （`lib/types/index.ts` Mortise interface）跟這個函式都是這次新加的，spec §9.1
 * 沒有前例，建議他複查。
 * ⚠️ 目前只有資料記錄，3D／CSG 渲染還沒接（腳跟座框看起來仍是兩個零件互穿，
 * 沒有真的挖洞），這步留給下一輪接渲染。
 */
function applyLegPassThroughs(parts: Part[]): void {
  const by = new Map(parts.map((p) => [p.id, p]));
  const P = (id: string) => by.get(id)!;
  const railFront = P("seat-rail-front");
  const railBack = P("seat-rail-back");
  for (const side of ["l", "r"] as const) {
    const front = P(`leg-front-${side}`);
    const rear = P(`leg-rear-${side}`);
    // local x：rail 沒有旋轉、origin.x=0，local x = 腳的世界 X；
    // local y：從 rail 底面量，取斷面中高（visible.thickness/2）；
    // local z：腳跟 rail 中心的世界 Z 差（腳中心離 rail 中心 <19.5mm，落在 rail 板料內）。
    railFront.mortises.push({
      origin: { x: front.origin.x, y: railFront.visible.thickness / 2, z: front.origin.z - railFront.origin.z },
      depth: railFront.visible.thickness, length: front.visible.length, width: front.visible.length,
      through: true, shape: "round", passThroughChildId: front.id,
    });
    railBack.mortises.push({
      origin: { x: rear.origin.x, y: railBack.visible.thickness / 2, z: rear.origin.z - railBack.origin.z },
      depth: railBack.visible.thickness, length: rear.visible.length, width: rear.visible.length,
      through: true, shape: "round", passThroughChildId: rear.id,
    });
  }
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

  // ── 榫卯資料（spec §9.1）──────────────────────────────────────────────
  const jointWarnings = applyCircleChairJoinery(parts, buildCircleChairJoints(parts));
  applyLegPassThroughs(parts); // 缺陷 5：腳大進大出貫穿椅盤角（見函式註解）

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

  // 外框尺寸用零件實際包絡算：椅圈整圈比座面大（spec §5 俯視外徑 ~698×690 > 座 610×497），
  // 寫成座面尺寸會讓 audit-floating-parts 把椅圈上靠桿當「浮在家具外 56mm」。
  const env = parts.reduce(
    (a, p) => {
      const { xExt, yExt, zExt } = worldExtents(p);
      return {
        x0: Math.min(a.x0, p.origin.x - xExt / 2), x1: Math.max(a.x1, p.origin.x + xExt / 2),
        z0: Math.min(a.z0, p.origin.z - zExt / 2), z1: Math.max(a.z1, p.origin.z + zExt / 2),
        y1: Math.max(a.y1, p.origin.y + yExt),
      };
    },
    { x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity, y1: -Infinity },
  );
  const design: FurnitureDesign = {
    id: `circle-chair-${input.length}x${input.height}`,
    category: "circle-chair",
    nameZh: "明式圈椅",
    overall: { length: env.x1 - env.x0, width: env.z1 - env.z0, thickness: env.y1 },
    parts,
    defaultJoinery: "blind-tenon",
    useButtJointConvention: true,
    topViewFullHiddenLines: true, // 缺陷 8：開放框架，俯視圖座框下的棖／角牙要全畫虛線（見 types 註解）
    primaryMaterial: material,
    notes: [
      `明式圈椅（Phase 1 框架版）座寬 ${input.length}mm × 座深 ${input.width}mm × 椅圈高 ${input.height}mm。`,
      presetNote,
      footRailJointNote,
      seatCornerNote,
    ].join(" "),
  };
  if (jointWarnings.length) design.warnings = [...(design.warnings ?? []), ...jointWarnings];
  const roundLegWarnings = validateRoundLegJoinery(design);
  if (roundLegWarnings.length) design.warnings = [...(design.warnings ?? []), ...roundLegWarnings];
  applyStandardChecks(design, {
    minLength: 550, minWidth: 440, minHeight: 650,
    maxLength: 750, maxWidth: 600, maxHeight: 1150,
  });
  return design;
};
