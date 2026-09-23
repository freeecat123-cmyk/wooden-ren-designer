import type { FurnitureDesign, FurnitureTemplate, JoineryType, MaterialId, OptionSpec, Part, TenonPosition } from "@/lib/types";
import { getOption, opt } from "@/lib/types";
import { rotateXYZ, partWorldCenter, positionRootWorld } from "@/lib/assembly/joint-world";
import { worldExtents } from "@/lib/render/geometry";
import {
  interpolateBSpline,
  profileWidthAt,
  sampleCenterline,
  subCurveByArcLength,
  sweptArcLength,
  sweptCrossings,
  sweptDistanceToSolid,
  sweptPartFromWorldPoints,
  sweptWorldToLocal,
  type SweptCurveShape,
  type SweptProfile,
} from "@/lib/geometry/swept-curve";
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
 * 椅圈楔釘榫搭口長（設計規格，沿弧量；進 buildCircleChairJoints 的 tenon.length / mortise.depth，
 * 同時也是 P3 五段曲線彼此在同一條中心線上重疊的弧長）。
 * 原本 32mm 轉角搭口太窄，木料沒有餘量開楔釘榫（傳統比例 75~100mm），改 85。
 */
const RING_JOINT_OVERLAP = 85;
/**
 * 椅圈後半圓半徑（中心線，座寬 610 時；其他座寬等比）。§S7：圈椅椅圈＝clamped cubic
 * B-spline 繞圓心橢圓化。R=342 讓圓恰好通過後腳頂（legXOff=274, legZRear=224.5 →
 * 圓心 z≈20、後正中 z≈362），俯視外徑 ≈ 700 × 685，跟工作圖材料單
 *（上靠桿 625 + 中桿 410×2 + 左右桿 350×2 − 4×85 ≈ 1805 弧長）同一級。
 */
const RING_R_REF = 342;
/**
 * 扶手出頭（鱔魚頭）尾端往下垂的量（mm）。目前 0＝整圈水平：
 * 下垂會讓 C² 內插把斜度帶進前面 2~3 個 span（實測 180mm 內慢慢降 1.3mm），
 * 鵝脖／聯幫棍頂端貼不平（一角戳進、一角懸空 ~1mm，audit-overlaps 容差 1mm 剛好抓到）。
 * 要做真的鱔魚頭下捲，得把下垂段獨立成短 span（tip 前 40mm 加密經過點）再開，留 P4。
 */
const RING_TIP_DROP = 0;
/**
 * 四腿側腳收分：側向 4°、前後 2°（spec §3「側腳收分約 4°」）。腿在座框處固定，
 * 腳底往外踢 tan(θ)×seatHeight。0 = 直腿（下盤幾何回到 P1）。
 */
const LEG_SPLAY_DEG = 4;
/**
 * 前後向收分（rake）先關：腿下段往前傾、上段鵝脖又往前彎，C² 內插會在穿椅盤的直段
 * 往後鼓 5~9mm（腳心離開座框角），俯視圖棖端面跟腿面對不上（audit-2d-joints 4mm）。
 * 側向 4° 收分沒這問題（鵝脖是往外撇，同向）。要開 rake 得先把穿椅盤段做成真直線（多段曲線）。
 */
const LEG_RAKE_DEG = 0;

/** 四腿的斷面尺寸與 X/Z 平面錨點位置（腿在座框處的中心；buildLegs / buildStretchers 共用） */
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
 * 椅圈錨點（buildRingCurve / buildSCurveMembers 共用）
 *   RING_T   = 椅圈斷面厚（垂直 Y 方向，mm）
 *   ringY    = 椅圈底面 Y（= ringHeight − RING_T）
 */
function armRingAnchors(ringHeight: number) {
  const RING_T = 36;
  const ringY = ringHeight - RING_T;
  return { RING_T, ringY };
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

type W3 = { x: number; y: number; z: number };

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

// ─────────────────────────────────────────────────────────────────────────────
// 椅圈中心線（整圈一條 clamped cubic B-spline，世界座標；§S7）
// ─────────────────────────────────────────────────────────────────────────────

type RingCurve = {
  /** 整圈中心線（世界座標的 swept-curve shape，斷面只是佔位） */
  world: SweptCurveShape;
  /** 弧長總長 */
  length: number;
  R: number;
  zc: number;
  ringMidY: number;
  /** 弧長比例 → 斷面寬（apex 最寬、扶手頭最窄） */
  widthAt: (t01: number) => number;
  /** 椅圈中心線在某個 z 的左（sx<0）/右（sx>0）側交點（世界）；bottomY = 該處椅圈實體最低點 */
  attachAtZ: (sx: -1 | 1, z: number) => { point: W3; t01: number; bottomY: number };
  /** 後正中點（靠背板上端） */
  apex: W3;
};

/**
 * 椅圈幾何鏈：後半圓（圓心 (0,zc)、半徑 R，恰通過後腳頂）+ 兩側扶手往前微外撇到鱔魚頭。
 * 曲線「經過點」→ interpolateBSpline（§S2）→ 一條 B-spline；五段零件再從這條線切（見 buildArmRail）。
 */
function buildRingCurve(args: Pick<CircleChairBuildArgs, "seatWidth" | "seatDepth" | "ringHeight" | "sectionScale">): RingCurve {
  const { seatWidth, seatDepth, ringHeight, sectionScale } = args;
  const { RING_T, ringY } = armRingAnchors(ringHeight);
  const { legXOff, legZRear } = legAnchors(seatWidth, seatDepth);
  const k = seatWidth / 610;
  const ringMidY = ringY + RING_T / 2;
  let R = RING_R_REF * k;
  if (R <= legXOff + 5) R = legXOff + 5; // 極窄座寬保護：圓一定要罩得住後腳
  const zc = legZRear - Math.sqrt(R * R - legXOff * legXOff);
  const tipZ = -seatDepth / 2 - 8 * k;
  // 右半邊經過點：apex → 22.5°/45°/67.5°/90° → 扶手 → 鱔魚頭（尾端下垂 RING_TIP_DROP）
  const right: W3[] = [];
  for (const deg of [22.5, 45, 67.5, 90]) {
    const th = (deg * Math.PI) / 180;
    right.push({ x: R * Math.sin(th), y: ringMidY, z: zc + R * Math.cos(th) });
  }
  // 扶手段保持水平到鵝脖接點之後（legZFront+6 附近），最後 ~40mm 才往下捲成鱔魚頭——
  // 鵝脖／聯幫棍頂端要貼的是水平的椅圈底，下垂段留在它們前面。
  const { legZFront } = legAnchors(seatWidth, seatDepth);
  right.push({ x: R + 3 * k, y: ringMidY, z: zc - 92 * k });
  right.push({ x: R + 5 * k, y: ringMidY, z: zc - 184 * k });
  right.push({ x: R + 6 * k, y: ringMidY, z: legZFront - 2 });
  right.push({ x: R + 8 * k, y: ringMidY - RING_TIP_DROP, z: tipZ });
  const apex: W3 = { x: 0, y: ringMidY, z: zc + R };
  const left = right.map((p) => ({ x: -p.x, y: p.y, z: p.z })).reverse();
  const through = [...left, apex, ...right];
  const fit = interpolateBSpline(through);
  // 椅圈除了鱔魚頭下垂段以外要「絕對水平」：C² 內插會讓下垂段把鄰近幾個 span 帶出 ±0.1mm 漣漪，
  // 鵝脖／聯幫棍頂端貼上去就變成一邊戳進 0.1、一邊懸空 0.1。控制點 y 離 ringMidY 不到 1.5 的
  // 一律壓回 ringMidY——B-spline 是控制點的凸組合，整段控制點都在 702 的 span 就恰好是 702。
  fit.controlPoints = fit.controlPoints.map((c) => (Math.abs(c.y - ringMidY) < 1.5 ? { ...c, y: ringMidY } : c));
  // 斷面佔位：整圈的寬度由 widthAt 決定，切段時才寫進各段 profile
  const world: SweptCurveShape = {
    kind: "swept-curve",
    controlPoints: fit.controlPoints,
    knots: fit.knots,
    profile: { type: "rect", widthStart: 30, widthEnd: 30, thickness: RING_T },
  };
  const length = sweptArcLength(world);
  // 斷面寬：扶手頭 30 → 扶手 40 → 後腳處 50 → 後正中 60（工作圖：上靠桿最寬、左右桿最窄）
  const widthAt = (t01: number) => {
    const g = Math.min(t01, 1 - t01);
    const table: Array<[number, number]> = [[0, 30], [0.12, 40], [0.3, 50], [0.5, 60]];
    let w = 60;
    for (let i = 0; i + 1 < table.length; i++) {
      const [g0, w0] = table[i], [g1, w1] = table[i + 1];
      if (g >= g0 && g <= g1) { w = w0 + ((w1 - w0) * (g - g0)) / (g1 - g0); break; }
    }
    return w * sectionScale;
  };
  // 椅圈斷面在該處的最低點：扶手往下垂時斷面跟著傾 θ，最低角 = 中心 − (T/2)cosθ − (w/2)sinθ
  const bottomOf = (c: { point: W3; tangent: W3; t01: number }) => {
    const sinT = Math.min(1, Math.abs(c.tangent.y));
    const cosT = Math.sqrt(1 - sinT * sinT);
    return c.point.y - (RING_T / 2) * cosT - (widthAt(c.t01) / 2) * sinT;
  };
  const attachAtZ = (sx: -1 | 1, z: number) => {
    const cs = sweptCrossings(world, "z", z).filter((c) => (sx < 0 ? c.point.x < 0 : c.point.x > 0));
    if (cs.length === 0) {
      // 超出椅圈 z 範圍：退到最近的端點（不該發生，保護用）
      const s = sampleCenterline(world);
      const i = sx < 0 ? 0 : s.points.length - 1;
      const c = { point: s.points[i], tangent: s.tangents[i], t01: sx < 0 ? 0 : 1 };
      return { point: c.point, t01: c.t01, bottomY: bottomOf(c) };
    }
    // 同側可能有兩個交點（扶手 + 後半圓）：取離座面中心線較近（|x| 大＝扶手側）的那個
    cs.sort((a, b) => Math.abs(b.point.x) - Math.abs(a.point.x));
    return { point: cs[0].point, t01: cs[0].t01, bottomY: bottomOf(cs[0]) };
  };
  return { world, length, R, zc, ringMidY, widthAt, attachAtZ, apex };
}

// ─────────────────────────────────────────────────────────────────────────────
// 曲料零件 helper
// ─────────────────────────────────────────────────────────────────────────────

const UP: W3 = { x: 0, y: 1, z: 0 };

function sweptPart(
  id: string,
  nameZh: string,
  material: MaterialId,
  throughWorld: W3[],
  profile: SweptProfile,
  opts?: { controlPointsWorld?: W3[]; knots?: number[]; nameEn?: string; startTangent?: W3; endTangent?: W3 },
): Part {
  const g = sweptPartFromWorldPoints(throughWorld, profile, opts);
  return {
    id,
    nameZh,
    ...(opts?.nameEn ? { nameEn: opts.nameEn } : {}),
    material,
    grainDirection: "length",
    visible: g.visible,
    origin: g.origin,
    shape: g.shape,
    tenons: [],
    mortises: [],
  };
}

/** 曲料腿：某高度 y 的中心（世界）與半徑 */
function legLine(leg: Part) {
  const shape = leg.shape;
  if (shape?.kind !== "swept-curve") {
    // 直圓料退路（LEG_SPLAY_DEG=0 且沒有曲線時不會用到，保留相容）
    const r = leg.visible.length / 2;
    return {
      centerAt: () => ({ x: leg.origin.x, z: leg.origin.z }),
      radiusAt: () => r,
    };
  }
  const centerAt = (y: number) => {
    const local = sweptWorldToLocal(leg, { x: 0, y, z: 0 });
    const cs = sweptCrossings(shape, "y", local.y);
    if (cs.length === 0) return { x: leg.origin.x, z: leg.origin.z };
    const c = cs[0];
    return { x: leg.origin.x + c.point.x, z: leg.origin.z + c.point.z };
  };
  const radiusAt = (y: number) => {
    const local = sweptWorldToLocal(leg, { x: 0, y, z: 0 });
    const cs = sweptCrossings(shape, "y", local.y);
    const t01 = cs.length ? cs[0].t01 : 0;
    return profileWidthAt(shape.profile, t01) / 2;
  };
  return { centerAt, radiusAt };
}

/**
 * 腿在 [y0,y1] 高度區間內、朝 dir 方向「最內側」的面（接棖／角牙的端面貼這裡）。
 * 收分腿的面是斜的：橫撐是直料，端面只能貼到最內側那一點，其餘留 ≤ tan(4°)×棖高 的楔形縫
 * （木工實作是把肩線鋸成 4°；模型端寧可留縫也不穿模——audit-overlaps 容差只有 1mm）。
 */
function legFace(leg: Part, axis: "x" | "z", dir: -1 | 1, y0: number, y1: number): number {
  const L = legLine(leg);
  // dir>0：面朝 +axis（左腿內側、前腳背面），「最內側」= 最大值；dir<0 反之。
  let best = dir > 0 ? -Infinity : Infinity;
  const N = 6;
  for (let i = 0; i <= N; i++) {
    const y = y0 + ((y1 - y0) * i) / N;
    const c = L.centerAt(y);
    const r = L.radiusAt(y);
    const v = (axis === "x" ? c.x : c.z) + dir * r;
    best = dir > 0 ? Math.max(best, v) : Math.min(best, v);
  }
  return best;
}

// ─────────────────────────────────────────────────────────────────────────────
// 四腿（一木連做，swept-curve 圓料）
// ─────────────────────────────────────────────────────────────────────────────

function buildLegs(args: Pick<CircleChairBuildArgs, "material" | "seatWidth" | "seatDepth" | "seatHeight" | "ringHeight" | "legScale">, ring: RingCurve): Part[] {
  const { material, seatWidth, seatDepth, seatHeight, ringHeight, legScale } = args;
  const { FRONT_D, REAR_D, legXOff, legZFront, legZRear } = legAnchors(seatWidth, seatDepth);
  const { railBottomY } = seatFrameAnchors(seatDepth, seatHeight);
  const { RING_T, ringY } = armRingAnchors(ringHeight);
  const dxSplay = Math.tan((LEG_SPLAY_DEG * Math.PI) / 180) * seatHeight;
  const dzRake = Math.tan((LEG_RAKE_DEG * Math.PI) / 180) * seatHeight;
  const parts: Part[] = [];

  // 座框以下直線段的經過點：腳底（外踢）→ 座框底 → 座面高（腿穿椅盤的區段垂直，
  // 大進大出的通孔才是圓的；多放幾個共線點讓內插保持直線）
  // 座框以下：腳底（外踢）直線到座框底，穿椅盤區段垂直；腳底端面靠 startTangent 鎖水平落地。
  const straightBelow = (gx: number, gz: number, sx0: number, sz0: number): W3[] => {
    const pts: W3[] = [{ x: gx, y: 0, z: gz }];
    for (const f of [0.35, 0.7]) {
      const y = railBottomY * f;
      pts.push({ x: gx + (sx0 - gx) * f, y, z: gz + (sz0 - gz) * f });
    }
    pts.push({ x: sx0, y: railBottomY, z: sz0 });
    pts.push({ x: sx0, y: (railBottomY + seatHeight) / 2, z: sz0 });
    pts.push({ x: sx0, y: seatHeight, z: sz0 });
    return pts;
  };

  for (const sx of [-1, 1] as const) {
    // ── 前腳 + 鵝脖（715×60×39 一木連做）──────────────────────────────────
    // 座面以上彎成 S 形鵝脖：先往前外撇、再往後回收，頂端圓榫頂住椅圈左右桿底面。
    const gx = sx * (legXOff + dxSplay);
    const gz = legZFront - dzRake;
    const seatX = sx * legXOff;
    const attach = ring.attachAtZ(sx, legZFront + 6);
    // 椅圈在接點處的實體最低點（扶手頭往下垂，斷面跟著傾，不是整圈同一個高度）
    const attachY = attach.bottomY;
    const neckH = attachY - seatHeight;
    const front: W3[] = [
      ...straightBelow(gx, gz, seatX, legZFront),
      { x: sx * (legXOff + 6), y: seatHeight + neckH * 0.3, z: legZFront - 20 },
      { x: sx * (legXOff + 30), y: seatHeight + neckH * 0.62, z: legZFront - 30 },
      { x: sx * (Math.abs(attach.point.x) - 10), y: attachY - 40, z: legZFront - 14 },
      { x: attach.point.x, y: attachY, z: attach.point.z }, // 端切線鎖垂直（endTangent）：端面水平貼椅圈底
    ];
    parts.push(sweptPart(
      sx < 0 ? "leg-front-l" : "leg-front-r",
      `前${sx < 0 ? "左" : "右"}腳（含鵝脖）`,
      material,
      front,
      { type: "round", radiusStart: (FRONT_D / 2) * legScale, radiusEnd: (FRONT_D / 2) * 0.8 * legScale },
      { nameEn: `Front ${sx < 0 ? "left" : "right"} leg (with gooseneck)`, startTangent: UP, endTangent: UP },
    ));

    // ── 後腳（985×36×39 一木連做穿椅盤）────────────────────────────────────
    // 穿過椅盤繼續上延到椅圈底；椅圈後半圓恰好通過後腳頂（見 buildRingCurve），上段垂直。
    const rgx = sx * (legXOff + dxSplay);
    const rgz = legZRear + dzRake;
    const rseatX = sx * legXOff;
    const rAttach = ring.attachAtZ(sx, legZRear);
    const rAttachY = rAttach.bottomY;
    void RING_T;
    const rear: W3[] = [
      ...straightBelow(rgx, rgz, rseatX, legZRear),
      { x: rseatX, y: seatHeight + (rAttachY - seatHeight) * 0.5, z: legZRear },
      { x: rAttach.point.x, y: rAttachY, z: rAttach.point.z },
    ];
    void ringY;
    parts.push(sweptPart(
      sx < 0 ? "leg-rear-l" : "leg-rear-r",
      `後${sx < 0 ? "左" : "右"}腳`,
      material,
      rear,
      { type: "round", radiusStart: (REAR_D / 2) * legScale, radiusEnd: (REAR_D / 2) * 0.9 * legScale },
      { nameEn: `Rear ${sx < 0 ? "left" : "right"} leg (through seat)`, startTangent: UP, endTangent: UP },
    ));
  }
  return parts;
}

// ─────────────────────────────────────────────────────────────────────────────
// 下盤橫撐（box，端面貼腿面）
// ─────────────────────────────────────────────────────────────────────────────

function buildStretchers(args: Pick<CircleChairBuildArgs, "material" | "seatWidth" | "seatDepth" | "seatHeight">, legs: Record<string, Part>): Part[] {
  const { material, seatHeight } = args;
  const parts: Part[] = [];
  const L = (id: string) => legs[id];

  // 橫飾棖斷面：高 48mm（Y）× 深 21mm（Z or X）
  // 緊貼座框底面下方（座框底 y = seatHeight - RAIL_W），棖頂面在座框底，所以棖底面 y = seatHeight - RAIL_W - 48
  const DECOR_T = 21;
  const decorY = seatHeight - RAIL_W - DECOR_H; // 棖底面 Y（part origin = 底部中心）

  // 橫撐跨距一律 face-to-face（腿面到腿面），由 legFace 依棖的高度區間取腿的最內側面。
  // 收分腿（LEG_SPLAY_DEG）讓腿面斜，端面貼最內側點、其餘留小楔形縫，不穿模。
  const spanX = (legL: Part, legR: Part, y0: number, y1: number) => {
    const xL = legFace(legL, "x", +1, y0, y1);
    const xR = legFace(legR, "x", -1, y0, y1);
    return { length: xR - xL, x: (xL + xR) / 2 };
  };
  const spanZ = (legF: Part, legB: Part, y0: number, y1: number) => {
    const zF = legFace(legF, "z", +1, y0, y1);
    const zB = legFace(legB, "z", -1, y0, y1);
    return { length: zB - zF, z: (zF + zB) / 2 };
  };
  const legZAt = (leg: Part, y: number) => legLine(leg).centerAt(y).z;
  const legXAt = (leg: Part, y: number) => legLine(leg).centerAt(y).x;

  // 前後橫飾棖：沿 X，緊貼座框底面，棖端面接腳面
  // visible: length(X)=face-to-face 跨距；thickness(Y)=48 斷面高；width(Z)=21 斷面深
  for (const sz of [-1, 1] as const) {
    const legL = L(sz < 0 ? "leg-front-l" : "leg-rear-l");
    const legR = L(sz < 0 ? "leg-front-r" : "leg-rear-r");
    const sp = spanX(legL, legR, decorY, decorY + DECOR_H);
    parts.push({
      id: sz < 0 ? "decor-rail-front" : "decor-rail-back",
      nameZh: sz < 0 ? "前橫飾棖" : "後橫飾棖",
      material,
      grainDirection: "length",
      visible: { length: sp.length, thickness: DECOR_H, width: DECOR_T },
      origin: { x: sp.x, y: decorY, z: legZAt(legL, decorY + DECOR_H / 2) },
      shape: { kind: "box" },
      tenons: [],
      mortises: [],
    });
  }

  // 左右橫飾棖：沿 Z，繞 Y 轉 90°，face-to-face 前後跨距
  for (const sx of [-1, 1] as const) {
    const legF = L(sx < 0 ? "leg-front-l" : "leg-front-r");
    const legB = L(sx < 0 ? "leg-rear-l" : "leg-rear-r");
    const sp = spanZ(legF, legB, decorY, decorY + DECOR_H);
    parts.push({
      id: sx < 0 ? "decor-rail-left" : "decor-rail-right",
      nameZh: sx < 0 ? "左橫飾棖" : "右橫飾棖",
      material,
      grainDirection: "length",
      visible: { length: sp.length, thickness: DECOR_H, width: DECOR_T },
      origin: { x: legXAt(legF, decorY + DECOR_H / 2), y: decorY, z: sp.z },
      rotation: { x: 0, y: Math.PI / 2, z: 0 },
      shape: { kind: "box" },
      tenons: [],
      mortises: [],
    });
  }

  // 前腳棖（踏腳棖）：沿 X，斷面 65mm 高 × 36mm 深，離地 75mm（棖底面）
  const FRONT_RAIL_H = 65, FRONT_RAIL_T = 36;
  {
    const sp = spanX(L("leg-front-l"), L("leg-front-r"), 75, 75 + FRONT_RAIL_H);
    parts.push({
      id: "foot-rail-front",
      nameZh: "前腳棖（踏腳棖）",
      material,
      grainDirection: "length",
      visible: { length: sp.length, thickness: FRONT_RAIL_H, width: FRONT_RAIL_T },
      origin: { x: sp.x, y: 75, z: legZAt(L("leg-front-l"), 75 + FRONT_RAIL_H / 2) },
      shape: { kind: "box" },
      tenons: [],
      mortises: [],
    });
  }

  // 左/右步步高側棖：沿 Z，繞 Y 轉 90°，27×27 方斷面，離地 120mm（棖底面）
  const SIDE_RAIL_SZ = 27;
  for (const sx of [-1, 1] as const) {
    const legF = L(sx < 0 ? "leg-front-l" : "leg-front-r");
    const legB = L(sx < 0 ? "leg-rear-l" : "leg-rear-r");
    const sp = spanZ(legF, legB, 120, 120 + SIDE_RAIL_SZ);
    parts.push({
      id: sx < 0 ? "foot-rail-side-l" : "foot-rail-side-r",
      nameZh: `${sx < 0 ? "左" : "右"}步步高側棖`,
      material,
      grainDirection: "length",
      visible: { length: sp.length, thickness: SIDE_RAIL_SZ, width: SIDE_RAIL_SZ },
      origin: { x: legXAt(legF, 120 + SIDE_RAIL_SZ / 2), y: 120, z: sp.z },
      rotation: { x: 0, y: Math.PI / 2, z: 0 },
      shape: { kind: "box" },
      tenons: [],
      mortises: [],
    });
  }

  // 步步高後棖：沿 X，27×27 方斷面，離地 150mm（棖底面）
  const BACK_RAIL_SZ = 27;
  {
    const sp = spanX(L("leg-rear-l"), L("leg-rear-r"), 150, 150 + BACK_RAIL_SZ);
    parts.push({
      id: "foot-rail-back",
      nameZh: "步步高後棖",
      material,
      grainDirection: "length",
      visible: { length: sp.length, thickness: BACK_RAIL_SZ, width: BACK_RAIL_SZ },
      origin: { x: sp.x, y: 150, z: legZAt(L("leg-rear-l"), 150 + BACK_RAIL_SZ / 2) },
      shape: { kind: "box" },
      tenons: [],
      mortises: [],
    });
  }

  return parts;
}

// ─────────────────────────────────────────────────────────────────────────────
// 椅圈五段（楔釘榫攢接；每段是同一條中心線切出來的 swept-curve）
// ─────────────────────────────────────────────────────────────────────────────

/** 五段在整圈弧長上的範圍（含 RING_JOINT_OVERLAP 搭口） */
function ringSegmentRanges(ring: RingCurve, seatWidth: number) {
  const k = seatWidth / 610;
  const lap = RING_JOINT_OVERLAP;
  const sideNet = 350 * k, midNet = 410 * k, backNet = 625 * k;
  const specL = 2 * sideNet + 2 * midNet + backNet - 4 * lap;
  const f = ring.length / specL;
  const J1 = f * (sideNet - lap / 2);
  const J2 = J1 + f * (midNet - lap);
  const L = ring.length;
  const J3 = L - J2, J4 = L - J1;
  const h = lap / 2;
  return {
    "arm-rail-side-l": [0, J1 + h] as const,
    "arm-rail-mid-l": [J1 - h, J2 + h] as const,
    "arm-rail-back": [J2 - h, J3 + h] as const,
    "arm-rail-mid-r": [J3 - h, J4 + h] as const,
    "arm-rail-side-r": [J4 - h, L] as const,
  };
}

function buildArmRail(args: Pick<CircleChairBuildArgs, "material" | "seatWidth" | "ringHeight">, ring: RingCurve): Part[] {
  const { material, seatWidth, ringHeight } = args;
  const { RING_T } = armRingAnchors(ringHeight);
  const ranges = ringSegmentRanges(ring, seatWidth);
  const names: Record<keyof typeof ranges, [string, string]> = {
    "arm-rail-side-l": ["椅圈左桿", "Arm ring left rail"],
    "arm-rail-mid-l": ["椅圈中桿（左）", "Arm ring middle rail (left)"],
    "arm-rail-back": ["椅圈上靠桿", "Arm ring top back rail"],
    "arm-rail-mid-r": ["椅圈中桿（右）", "Arm ring middle rail (right)"],
    "arm-rail-side-r": ["椅圈右桿", "Arm ring right rail"],
  };
  const parts: Part[] = [];
  for (const id of Object.keys(ranges) as Array<keyof typeof ranges>) {
    const [s0, s1] = ranges[id];
    const sub = subCurveByArcLength(ring.world, s0, s1, 11);
    const tA = s0 / ring.length, tB = s1 / ring.length, tM = (s0 + s1) / 2 / ring.length;
    const profile: SweptProfile = {
      type: "rect",
      widthStart: ring.widthAt(tA),
      widthEnd: ring.widthAt(tB),
      widthMid: ring.widthAt(tM),
      thickness: RING_T,
      cornerR: 6,
      thicknessAlong: "y",
    };
    parts.push(sweptPart(id, names[id][0], material, [], profile, {
      controlPointsWorld: sub.controlPoints,
      knots: sub.knots,
      nameEn: names[id][1],
    }));
  }
  return parts;
}

// ─────────────────────────────────────────────────────────────────────────────
// S 曲線三件：聯幫棍 ×2 + 靠背板
// ─────────────────────────────────────────────────────────────────────────────

function buildSCurveMembers(args: Pick<CircleChairBuildArgs, "material" | "seatWidth" | "seatDepth" | "seatHeight" | "ringHeight" | "sectionScale">, ring: RingCurve): Part[] {
  const { material, seatWidth, seatDepth, seatHeight, ringHeight, sectionScale } = args;
  const parts: Part[] = [];
  const { RING_T, ringY } = armRingAnchors(ringHeight);
  const { RAIL_T_SEAT, seatBackZ } = seatFrameAnchors(seatDepth, seatHeight);

  // 聯幫棍 ×2（380×50×30）：鐮刀把三彎——從抹頭頂面起、往外鼓、再收回垂直插進椅圈左右桿底。
  // 下粗上細（radius 16 → 12）。
  const spindleZ = -seatDepth * 0.08;
  for (const sx of [-1, 1] as const) {
    const x0 = seatWidth / 2 - RAIL_T_SEAT / 2; // 抹頭斷面中心
    void SPINDLE_INSET;
    const attach = ring.attachAtZ(sx, spindleZ - 20);
    const attachY = attach.bottomY; // 椅圈在接點處的實體最低點
    void RING_T;
    const H = attachY - seatHeight;
    const ax = Math.abs(attach.point.x);
    const pts: W3[] = [
      { x: sx * x0, y: seatHeight, z: spindleZ },
      { x: sx * (x0 + 7), y: seatHeight + H * 0.2, z: spindleZ - 2 },
      { x: sx * (x0 + (ax - x0) * 0.55), y: seatHeight + H * 0.47, z: spindleZ - 10 },
      { x: sx * (ax - 4), y: seatHeight + H * 0.72, z: spindleZ - 17 },
      { x: attach.point.x, y: seatHeight + H * 0.9, z: attach.point.z },
      { x: attach.point.x, y: attachY, z: attach.point.z }, // 端切線鎖垂直（endTangent）
    ];
    parts.push(sweptPart(
      sx < 0 ? "side-spindle-l" : "side-spindle-r",
      "聯幫棍",
      material,
      pts,
      { type: "round", radiusStart: 16 * sectionScale, radiusEnd: 12 * sectionScale },
      { nameEn: "Side spindle (S-curved)", startTangent: UP, endTangent: UP },
    ));
  }

  // 靠背板（500×185×40 素獨板）：S 曲面、梯形上窄下寬（185 → 166）。
  // 下端垂直坐在後大邊頂面（帶肩扁榫入大邊），中段往後鼓，上段回收、垂直入椅圈上靠桿底。
  {
    const zTop = ring.apex.z;
    const dz = zTop - seatBackZ;
    const HH = ringY - seatHeight;
    // 兩端切線鎖垂直（startTangent/endTangent）：下端面水平坐在大邊頂面、上端面水平貼椅圈底
    const pts: W3[] = [
      { x: 0, y: seatHeight, z: seatBackZ },
      { x: 0, y: seatHeight + HH * 0.22, z: seatBackZ + dz * 0.03 },
      { x: 0, y: seatHeight + HH * 0.44, z: seatBackZ + dz * 0.25 },
      { x: 0, y: seatHeight + HH * 0.69, z: seatBackZ + dz * 0.67 },
      { x: 0, y: seatHeight + HH * 0.86, z: seatBackZ + dz * 0.92 },
      { x: 0, y: ringY, z: zTop },
    ];
    parts.push(sweptPart(
      "back-splat",
      "靠背板",
      material,
      pts,
      { type: "rect", widthStart: 185 * sectionScale, widthEnd: 166 * sectionScale, thickness: 40 * sectionScale, cornerR: 6, widthAlong: "x" },
      { nameEn: "Back splat (S-curved)", startTangent: UP, endTangent: UP },
    ));
  }
  return parts;
}

// ─────────────────────────────────────────────────────────────────────────────
// 角牙 8 件（box 佔位；終態 face-rounded 壼門/雲紋）
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 前腳角牙 ×2（鵝脖角牙，rotY=0，板面在 XY 平面，座面之上）：
 *   length(X)=115、thickness(Y)=FRONT_BRACE_H=55、width(Z)=10
 * 橫飾棖角牙 ×6：前 2 片 rotY=0；側 4 片 rotY=±π/2（X↔Z swap）
 * 所有角牙一律「入腿」：外端貼腿面（legFace 取角牙高度區間內最內側的腿面），薄片置中在所屬棖的斷面裡。
 */
function buildCornerBraces(args: Pick<CircleChairBuildArgs, "material" | "seatWidth" | "seatDepth" | "seatHeight">, legs: Record<string, Part>): Part[] {
  const { material, seatHeight } = args;
  const parts: Part[] = [];
  const L = (id: string) => legs[id];
  const decorY = seatHeight - RAIL_W - DECOR_H; // 橫飾棖底面 Y

  // ── 前腳角牙 ×2（鵝脖角牙）：座面之上、鵝脖內側 × 前大邊頂面的夾角 ──────
  // 舊版塞在座框底下，但那裡整根被前橫飾棖佔滿；spec §5 也載明椅盤下方無獨立牙條，
  // 「前腳 × 前大邊夾角」唯一空著的位置是座面上方鵝脖根部（傳統鵝脖角牙）。
  // ⚠️ 這是幾何判斷不是圖紙實證，列入回報請他複查。
  const FRONT_BRACE_L = 115;
  for (const sx of [-1, 1] as const) {
    const leg = L(sx < 0 ? "leg-front-l" : "leg-front-r");
    const braceY = seatHeight; // 底面坐在前大邊頂面
    const faceX = legFace(leg, "x", sx < 0 ? +1 : -1, braceY, braceY + FRONT_BRACE_H); // 腿內側面
    const braceX = faceX + (sx < 0 ? +1 : -1) * (FRONT_BRACE_L / 2);
    const braceZ = legLine(leg).centerAt(braceY + FRONT_BRACE_H / 2).z;
    parts.push({
      id: sx < 0 ? "corner-brace-front-l" : "corner-brace-front-r",
      nameZh: "前腳角牙",
      material, grainDirection: "length",
      visible: { length: FRONT_BRACE_L, thickness: FRONT_BRACE_H, width: 10 },
      origin: { x: braceX, y: braceY, z: braceZ },
      shape: { kind: "box" }, tenons: [], mortises: [],
    });
  }

  // ── 橫飾棖角牙 ×6：掛在橫飾棖正下方，外端入腿 ────────────────────────
  const DECOR_BRACE_L = 76;
  const decorBraceOriginY = decorY - DECOR_BRACE_H;
  for (const sx of [-1, 1] as const) {
    const leg = L(sx < 0 ? "leg-front-l" : "leg-front-r");
    const faceX = legFace(leg, "x", sx < 0 ? +1 : -1, decorBraceOriginY, decorY);
    parts.push({
      id: `decor-brace-${sx < 0 ? 1 : 2}`,
      nameZh: "橫飾棖角牙",
      material, grainDirection: "length",
      visible: { length: DECOR_BRACE_L, thickness: DECOR_BRACE_H, width: 10 },
      origin: { x: faceX + (sx < 0 ? +1 : -1) * (DECOR_BRACE_L / 2), y: decorBraceOriginY, z: legLine(leg).centerAt(decorY - DECOR_BRACE_H / 2).z },
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
    const leg = L(`leg-${which}-${sx < 0 ? "l" : "r"}`);
    // 前腳：貼後面（+z）往後延伸；後腳：貼前面（−z）往前延伸
    const faceZ = legFace(leg, "z", which === "front" ? +1 : -1, decorBraceOriginY, decorY);
    const braceZ = faceZ + (which === "front" ? +1 : -1) * (DECOR_BRACE_L / 2);
    parts.push({
      id,
      nameZh: "橫飾棖角牙",
      material, grainDirection: "length",
      // rotY=π/2：local length(76)→Z_world；thickness(Y)=DECOR_BRACE_H=60；width(10)→X_world（薄片）
      visible: { length: DECOR_BRACE_L, thickness: DECOR_BRACE_H, width: 10 },
      origin: { x: legLine(leg).centerAt(decorY - DECOR_BRACE_H / 2).x, y: decorBraceOriginY, z: braceZ },
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
//    沒有任何一個數字是目測填的。曲料（swept-curve）的端面中心＝曲線端點
//    （joint-world.positionRootWorld，跟稽核同一支）。
//
// ⚠️ 位置對不對，跟 tenon.length 是兩件事，絕對不能混成一個數字：
//    gapMm = 公榫件端面中心 到 母件實體 的距離，只用來算 measuredGap／engagementLength
//    這兩個「量出來的事實」，寫進 design.warnings 給人看；tenon.length／mortise.depth
//    永遠維持設計規格（j.depth）不動——那是製造資料，會流到材料表／CSV／排料／報價／
//    零件圖／工序／CNC 加工面，買藍圖的人會照這個數字做出接不起來的椅子且無警告。
//    （09-17 阿嚴審核退回過「用 gap 縮短 tenon.length 讓 audit-joints 報紅」的舊寫法。）
// ─────────────────────────────────────────────────────────────────────────────

/** 兩件之間可容忍的空隙（mm）。超過就視為「根本沒接到」。 */
const JOINT_GAP_TOL = 10;
/** 榫肩寬（跟 lib/joinery/standards.ts 的 SHOULDER_MM 一致） */
const CC_SHOULDER = 5;

/** 零件中心（世界座標）——直接用 joint-world 的同一支，稽核跟模板算出來的點才會一致 */
function ccPartCenter(p: Part): W3 {
  return partWorldCenter(p);
}
/** 世界方向 → part-local（rotateXYZ 的反轉：先 −Z、再 −Y、最後 −X） */
function ccRotInv(p: Part, v: W3): W3 {
  const r = p.rotation ?? { x: 0, y: 0, z: 0 };
  let o = rotateXYZ(0, 0, -(r.z ?? 0), v.x, v.y, v.z);
  o = rotateXYZ(0, -(r.y ?? 0), 0, o.x, o.y, o.z);
  o = rotateXYZ(-(r.x ?? 0), 0, 0, o.x, o.y, o.z);
  return o;
}
/** 公榫件端面中心的世界座標（曲料＝曲線端點；跟 joint-world.tenonWorld 同一支） */
function ccTenonRoot(p: Part, pos: TenonPosition): W3 {
  return positionRootWorld(p, pos).root;
}
/** 榫頭往外（插進母件）的世界方向單位向量 */
function ccTenonOut(p: Part, pos: TenonPosition): W3 {
  return positionRootWorld(p, pos).outUnit;
}
/** 世界座標 → 母件 local（x/z 以斷面中心為原點、y 以底面為 0） */
function ccWorldToLocal(mother: Part, w: W3): W3 {
  const c = ccPartCenter(mother);
  const d = { x: w.x - c.x, y: w.y - c.y, z: w.z - c.z };
  const l = ccRotInv(mother, d);
  return { x: l.x, y: l.y + mother.visible.thickness / 2, z: l.z };
}
/**
 * 點到母件實體的距離（0 = 在母件裡面或貼在面上）。
 * box 母件用 OBB；曲料母件用 sweptDistanceToSolid——AABB 對馬蹄弧整個內側都算「在裡面」，
 * 榫頭搬進弧內 100mm 也量不到。
 */
function ccGapToPart(mother: Part, w: W3): number {
  if (mother.shape?.kind === "swept-curve") {
    return sweptDistanceToSolid(mother.shape, sweptWorldToLocal(mother, w));
  }
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
  /** 公榫長在公榫件的哪個端面（曲料：start/bottom/left＝曲線起點、end/top/right＝終點） */
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
    // 榫頭方向不貼世界軸（楔釘榫 45°、或曲料端切線斜著插）才明示 axis；
    // 貼軸的（鵝脖／聯幫棍／靠背板兩端都鎖垂直）維持不帶 axis——
    // 3D 精確匯出（mortise-accurate / joinery-accurate）不支援 world-axis 榫眼。
    const childCurved = child.shape?.kind === "swept-curve";
    const axisAligned = Math.max(Math.abs(out.x), Math.abs(out.y), Math.abs(out.z)) > 0.9998;
    const needAxis = !!j.diagonal || !axisAligned;
    child.tenons.push({
      position: j.pos,
      type: j.type,
      // ⭐ 永遠用設計規格 j.depth，不管 gap 多少——榫長是製造資料，位置對不對
      // 由上面的 warnings 另外報，不縮短這個數字騙 audit-joints 的維度比對。
      length: j.depth,
      width: j.w,
      thickness: j.t,
      shoulderOn: ["top", "bottom", "left", "right"],
      ...(needAxis ? { axis: out } : {}),
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
    // 曲料母件：visible 是 AABB，「貼齊到 AABB 的面」會把榫眼貼到根本沒有木頭的地方，
    // 一律保留反算座標（榫頭端點就在木頭表面上）。
    const motherCurved = mother.shape?.kind === "swept-curve";
    let ox = motherCurved ? l.x : ccSoftClamp(l.x, mlx / 2);
    let oy = motherCurved ? l.y : ccSoftClamp(l.y - mly / 2, mly / 2) + mly / 2;
    let oz = motherCurved ? l.z : ccSoftClamp(l.z, mlz / 2);
    // 開口面 = 榫頭來的那一側（跟行進方向相反）。
    // 45° 斜接／曲料沒有單一「開口面」，保留反算座標讓 joint-world 自己挑最近的面。
    if (!j.diagonal && !motherCurved) {
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
      ...(needAxis ? { axis: { x: -out.x, y: -out.y, z: -out.z } } : {}),
    });
    void childCurved;
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
/** 腳在某高度的直徑（曲料腿從斷面取；直圓料退回 visible.length） */
function ccLegD(leg: Part, y: number): number {
  return legLine(leg).radiusAt(y) * 2;
}
/**
 * 收分腿的「斜肩留量」：直料棖／角牙的端面貼在腿面最內側那一點（legFace），
 * 端面中心離腿面還差 tan(收分角) × 半個棖高——這是刻意的（實作時肩線鋸成收分角），
 * 進 expectedGapMm 不當「沒接到」。量法：端面中心到腿在同高度的面的距離（沿榫頭方向）。
 */
function ccSplayShoulder(child: Part, pos: TenonPosition, leg: Part): number {
  const { root, outUnit } = positionRootWorld(child, pos);
  const L = legLine(leg);
  const c = L.centerAt(root.y);
  const r = L.radiusAt(root.y);
  const axis: "x" | "z" = Math.abs(outUnit.x) >= Math.abs(outUnit.z) ? "x" : "z";
  const dir = axis === "x" ? Math.sign(outUnit.x) : Math.sign(outUnit.z);
  const face = (axis === "x" ? c.x : c.z) - dir * r; // 面向榫頭來向的腿面
  const gap = dir * (face - root[axis]);
  return Math.max(0, Math.min(6, gap));
}

/**
 * spec §9.1 的 23 處接合點 → 實際公母榫清單。
 * 所有斷面尺寸都從 parts 自己的 visible / 斷面讀，preset 改截面時自動跟著變。
 */
export function buildCircleChairJoints(parts: Part[]): CcJoint[] {
  const by = new Map(parts.map((p) => [p.id, p]));
  const P = (id: string) => by.get(id)!;
  const J: CcJoint[] = [];
  const sh2 = 2 * CC_SHOULDER;
  const ringT = P("arm-rail-back").visible.thickness;      // 椅圈斷面厚（Y）
  const ringW = (id: string) => {
    const s = P(id).shape;
    return s?.kind === "swept-curve" ? profileWidthAt(s.profile, 0.5) : P(id).visible.width;
  };

  // ── ① 椅圈段 ↔ 椅圈段（4 處）· 楔釘榫 ────────────────────────────────────
  // 楔釘榫＝兩段弧料勾搭半疊、再橫向打入楔形釘。repo 的 JoineryType union 沒有
  // 中式榫名（spec §9.3 路徑 B），取語意最近的 half-lap；榫厚 = 椅圈厚/2（半疊）。
  // 榫長 = 搭口 RING_JOINT_OVERLAP，五段曲線在中心線上彼此重疊的弧長也是它。
  // 五段都沿「左扶手頭 → 後正中 → 右扶手頭」同一方向切：
  //   mid-l：start 朝左桿、end 朝上靠桿；mid-r：start 朝上靠桿、end 朝右桿。
  const RING_LAP = RING_JOINT_OVERLAP;
  for (const side of ["l", "r"] as const) {
    const mid = P(`arm-rail-mid-${side}`);
    const midW = ringW(mid.id);
    const toBack: TenonPosition = side === "l" ? "end" : "start";
    const toSide: TenonPosition = side === "l" ? "start" : "end";
    J.push({
      child: mid.id, pos: toBack, mother: "arm-rail-back", type: "half-lap",
      w: Math.max(15, Math.round(midW - sh2)), t: Math.round(ringT / 2), depth: RING_LAP,
      diagonal: true, nameZh: "椅圈楔釘榫（上靠桿↔中桿）",
    });
    J.push({
      child: mid.id, pos: toSide, mother: `arm-rail-side-${side}`, type: "half-lap",
      w: Math.max(15, Math.round(midW - sh2 - 6)), t: Math.round(ringT / 2), depth: RING_LAP,
      diagonal: true, nameZh: "椅圈楔釘榫（中桿↔左右桿）",
    });
  }

  // ── ② 椅後腳頂 ↔ 椅圈底（2 處）· 圓榫（盲榫）────────────────────────────
  // ── ③ 鵝脖頂（椅前腳頂）↔ 椅圈底（2 處）· 圓榫（盲榫）──────────────────
  // 圓榫直徑 = 腳頂直徑 × 0.6；榫深 ≤ 椅圈厚 − 11 留底。
  // 後腳頂落在椅圈「中桿」段（後半圓上）、鵝脖頂落在「左右桿」段（扶手）——依曲線位置。
  const ringBlind = Math.max(15, Math.round((ringT * 2) / 3));
  const ringY = P("arm-rail-back").origin.y;
  for (const side of ["l", "r"] as const) {
    for (const which of ["rear", "front"] as const) {
      const leg = P(`leg-${which}-${side}`);
      const d = Math.round(ccLegD(leg, ringY - 5) * 0.6);
      J.push({
        child: leg.id, pos: "top", mother: which === "rear" ? `arm-rail-mid-${side}` : `arm-rail-side-${side}`,
        type: "blind-tenon", w: d, t: d, depth: ringBlind, round: true,
        nameZh: which === "rear" ? "後腳頂圓榫入椅圈" : "鵝脖頂圓榫入椅圈",
      });
    }
  }

  // ── ④ 聯幫棍上下端 ↔ 椅圈 / 椅盤（4 處）· 圓榫 ──────────────────────────
  for (const side of ["l", "r"] as const) {
    const sp = P(`side-spindle-${side}`);
    const s = sp.shape;
    const dTop = Math.round((s?.kind === "swept-curve" ? profileWidthAt(s.profile, 1) : sp.visible.length) * 0.6);
    const dBot = Math.round((s?.kind === "swept-curve" ? profileWidthAt(s.profile, 0) : sp.visible.length) * 0.6);
    J.push({
      child: sp.id, pos: "top", mother: `arm-rail-side-${side}`, type: "blind-tenon",
      w: dTop, t: dTop, depth: ringBlind, round: true, nameZh: "聯幫棍上端圓榫入椅圈",
    });
    J.push({
      child: sp.id, pos: "bottom", mother: `seat-rail-${side === "l" ? "left" : "right"}`,
      type: "blind-tenon", w: dBot, t: dBot, depth: 30, round: true,
      nameZh: "聯幫棍下端圓榫入椅盤抹頭",
    });
  }

  // ── ⑤ 靠背板上下端 ↔ 椅圈 / 後大邊（2 處）· 帶肩扁榫 ────────────────────
  {
    const sp = P("back-splat");
    const s = sp.shape;
    const wTop = s?.kind === "swept-curve" ? profileWidthAt(s.profile, 1) : sp.visible.length;
    const wBot = s?.kind === "swept-curve" ? profileWidthAt(s.profile, 0) : sp.visible.length;
    const thick = s?.kind === "swept-curve" && s.profile.type === "rect" ? s.profile.thickness : sp.visible.width;
    const t = Math.max(6, Math.round(thick / 3)); // 榫厚 = 板厚/3
    J.push({ child: sp.id, pos: "top", mother: "arm-rail-back", type: "shouldered-tenon",
      w: Math.max(15, Math.round(wTop - sh2)), t, depth: ringBlind, nameZh: "靠背板上端帶肩扁榫入椅圈" });
    // 下端若不是垂直入大邊，要切斜肩：板底面中心離大邊頂面 (T/2)·sinθ，是設計量不是沒接到
    const outBot = ccTenonOut(sp, "bottom");
    const tilt = Math.acos(Math.min(1, Math.abs(outBot.y)));
    const shoulderGap = (thick / 2) * Math.sin(tilt);
    J.push({ child: sp.id, pos: "bottom", mother: "seat-rail-back", type: "shouldered-tenon",
      w: Math.max(15, Math.round(wBot - sh2)), t, depth: 30, expectedGapMm: shoulderGap, nameZh: "靠背板下端帶肩扁榫入後大邊" });
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
    // 座板四邊本來就刻意離框內面 4mm（打槽裝板留伸縮縫，木工正確做法），
    // expectedGapMm:4 讓 gap 檢查把這 4mm 當「設計好的縫」，不誤報。
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
  // ── ⑩ 管腳棖 ↔ 腿（8 處）· 椿榫 / 鴨母嘴（教材兩選項，只影響文案）────────
  const railToLeg = (
    childId: string, pos: TenonPosition, legId: string, type: JoineryType, nameZh: string,
  ) => {
    const c = P(childId), leg = P(legId);
    const legD = ccLegD(leg, c.origin.y + c.visible.thickness / 2); // 棖中高處的腳徑
    // start/end：榫寬軸 = local Z（斷面深）、榫厚軸 = local Y（斷面高）
    const w = Math.max(15, c.visible.width - sh2);
    const t = ccLegSlot(legD, Math.max(6, Math.round(c.visible.thickness / 3)));
    J.push({ child: childId, pos, mother: legId, type, w, t, depth: ccLegDepth(legD), nameZh,
      expectedGapMm: ccSplayShoulder(c, pos, leg) });
  };
  for (const side of ["l", "r"] as const) {
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
    const legD = ccLegD(leg, b.origin.y + b.visible.thickness / 2);
    J.push({
      child: b.id, pos: side === "l" ? "start" : "end", mother: leg.id, type: "shouldered-tenon",
      w: b.visible.width,                                   // 10mm 薄牙片整片入槽、不留肩
      t: ccLegSlot(legD, Math.max(10, b.visible.thickness - sh2)),
      depth: Math.min(12, ccLegDepth(legD)), nameZh: "前腳角牙夾頭榫入腿",
      expectedGapMm: ccSplayShoulder(b, side === "l" ? "start" : "end", leg),
    });
    // 鵝脖角牙坐在前大邊頂面上 → 下端（bottom）入大邊（見 buildCornerBraces 位置註解）
    J.push({
      child: b.id, pos: "bottom", mother: "seat-rail-front", type: "shouldered-tenon",
      w: Math.max(15, b.visible.length - sh2), t: b.visible.width, depth: 12,
      nameZh: "前腳角牙夾頭榫入大邊",
    });
  }

  // ── ⑫ 橫飾棖角牙 ↔ 棖 + 腿（8 處）· 夾頭榫式角牙 ────────────────────────
  for (const [id, side] of [["decor-brace-1", "l"], ["decor-brace-2", "r"]] as const) {
    const b = P(id);
    const leg = P(`leg-front-${side}`);
    const legD = ccLegD(leg, b.origin.y + b.visible.thickness / 2);
    J.push({
      child: id, pos: side === "l" ? "start" : "end", mother: leg.id, type: "shouldered-tenon",
      w: b.visible.width,
      t: ccLegSlot(legD, Math.max(10, b.visible.thickness - sh2)),
      depth: Math.min(12, ccLegDepth(legD)), nameZh: "橫飾棖角牙夾頭榫入前腳",
      expectedGapMm: ccSplayShoulder(b, side === "l" ? "start" : "end", leg),
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
    const legD = ccLegD(leg, b.origin.y + b.visible.thickness / 2);
    // 跟 decor-rail-left/right 同一套旋轉慣例：local +X(end)→世界前(-Z)、-X(start)→世界後(+Z)
    J.push({
      child: id, pos: which === "front" ? "end" : "start", mother: leg.id, type: "shouldered-tenon",
      w: b.visible.width,
      t: ccLegSlot(legD, Math.max(10, b.visible.thickness - sh2)),
      depth: Math.min(12, ccLegDepth(legD)), nameZh: "側橫飾棖角牙夾頭榫入腿",
      expectedGapMm: ccSplayShoulder(b, which === "front" ? "end" : "start", leg),
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
 * 資料結構：只在母件（座框大邊）上記一個 mortise（圓孔、through:true、
 * `passThroughChildId` 指回那隻腳），不推對應的 tenon——腳本身不縮小，沒有可比對的
 * 榫頭端面。`passThroughChildId`（`lib/types/index.ts` Mortise interface）是這個模板
 * 新加的欄位，spec §9.1 沒有前例，建議複查。
 * 孔位取腳的曲線在大邊中高處的中心（腳穿椅盤的區段是垂直的）、孔徑取該高度的腳徑。
 * ⚠️ 目前只有資料記錄，3D／CSG 渲染還沒接（腳跟座框看起來仍是兩個零件互穿）。
 */
function applyLegPassThroughs(parts: Part[]): void {
  const by = new Map(parts.map((p) => [p.id, p]));
  const P = (id: string) => by.get(id)!;
  const railFront = P("seat-rail-front");
  const railBack = P("seat-rail-back");
  const push = (rail: Part, leg: Part) => {
    const yMid = rail.origin.y + rail.visible.thickness / 2;
    const c = legLine(leg).centerAt(yMid);
    const d = ccLegD(leg, yMid);
    rail.mortises.push({
      origin: { x: c.x - rail.origin.x, y: rail.visible.thickness / 2, z: c.z - rail.origin.z },
      depth: rail.visible.thickness, length: d, width: d,
      through: true, shape: "round", passThroughChildId: leg.id,
    });
  };
  for (const side of ["l", "r"] as const) {
    push(railFront, P(`leg-front-${side}`));
    push(railBack, P(`leg-rear-${side}`));
  }
}

/**
 * 明式圈椅（circle-chair）— P3 曲線版（swept-curve 椅圈／鵝脖／聯幫棍／靠背板）
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

  // preset → 截面倍率表（只改料的粗細，不改長度與位置）
  const PRESET: Record<string, { sectionScale: number; legScale: number }> = {
    "ming-plain":       { sectionScale: 1.0,  legScale: 1.0  },
    "huanghuali-slim":  { sectionScale: 0.85, legScale: 0.88 },
    "jichimu-stout":    { sectionScale: 1.15, legScale: 1.18 },
  };
  const preset = PRESET[stylePreset] ?? PRESET["ming-plain"];

  const base = {
    material, seatWidth: input.length, seatDepth: input.width, seatHeight,
    ringHeight: input.height, sectionScale: preset.sectionScale, legScale: preset.legScale,
  };
  const ring = buildRingCurve(base);

  const parts: Part[] = [];
  parts.push(...buildSeatFrame({ ...base, seatChamferMm, seatEdgeStyle }));
  const legParts = buildLegs(base, ring);
  parts.push(...legParts);
  const legs: Record<string, Part> = Object.fromEntries(legParts.map((p) => [p.id, p]));
  parts.push(...buildStretchers(base, legs));
  parts.push(...buildArmRail(base, ring));
  parts.push(...buildSCurveMembers(base, ring));
  parts.push(...buildCornerBraces(base, legs));

  // 整張椅子沿 Z 置中：椅圈後正中比座面後緣多出 ~145、扶手頭只比座面前緣多 ~10，
  // 以座面為原點時包絡不對稱。audit-floating-parts（以及 3D 鏡頭對焦）都假設
  // overall 是以原點為中心的盒子，所以最後把所有零件平移到包絡中心。
  // 建構期的幾何全部相對（腿錨點、椅圈接點），平移在榫卯資料之前做，joints 照樣用世界座標。
  {
    let z0 = Infinity, z1 = -Infinity;
    for (const p of parts) {
      const { zExt } = worldExtents(p);
      z0 = Math.min(z0, p.origin.z - zExt / 2);
      z1 = Math.max(z1, p.origin.z + zExt / 2);
    }
    const shift = (z0 + z1) / 2;
    for (const p of parts) p.origin.z -= shift;
  }

  // ── 榫卯資料（spec §9.1）──────────────────────────────────────────────
  const jointWarnings = applyCircleChairJoinery(parts, buildCircleChairJoints(parts));
  applyLegPassThroughs(parts); // 腳大進大出貫穿椅盤角（見函式註解）

  // 管腳棖榫型說明（只影響 notes，幾何不變）
  const footRailJointNotes: Record<string, string> = {
    "duck-bill": "管腳棖用「鴨母嘴（斜口勾掛榫）」——斜口精度高，初學建議先練方榫。",
    "square-tenon": "管腳棖用「椿榫（規矩方榫）」——結構牢靠、加工友善。",
  };
  const footRailJointNote = footRailJointNotes[footRailJoint] ?? footRailJointNotes["square-tenon"];

  // 椅盤轉角說明（只影響 notes，幾何不變）
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
    topViewFullHiddenLines: true, // 開放框架，俯視圖座框下的棖／角牙要全畫虛線（見 types 註解）
    primaryMaterial: material,
    notes: [
      `明式圈椅 座寬 ${input.length}mm × 座深 ${input.width}mm × 椅圈高 ${input.height}mm；椅圈後半圓 R≈${Math.round(ring.R)}mm、五段楔釘榫攢接（搭口 ${RING_JOINT_OVERLAP}mm）、腿側腳收分 ${LEG_SPLAY_DEG}°。`,
      presetNote,
      footRailJointNote,
      seatCornerNote,
    ].join(" "),
  };
  if (jointWarnings.length) design.warnings = [...(design.warnings ?? []), ...jointWarnings];
  const roundLegWarnings = validateRoundLegJoinery(design);
  if (roundLegWarnings.length) design.warnings = [...(design.warnings ?? []), ...roundLegWarnings];
  // 上限是「含椅圈」的整體包絡（椅圈比座面寬 ~130、深 ~190），不是座面尺寸
  applyStandardChecks(design, {
    minLength: 550, minWidth: 440, minHeight: 650,
    maxLength: 900, maxWidth: 800, maxHeight: 1150,
  });
  return design;
};

/** 測試／稽核用：整圈中心線與各段弧長範圍（不進 design） */
export function circleChairRingDebug(seatWidth = 610, seatDepth = 497, ringHeight = 720, sectionScale = 1) {
  const ring = buildRingCurve({ seatWidth, seatDepth, ringHeight, sectionScale });
  return { ring, ranges: ringSegmentRanges(ring, seatWidth) };
}
