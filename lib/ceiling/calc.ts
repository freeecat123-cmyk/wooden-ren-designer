/**
 * 木作天花板骨架算料引擎(階段 1 純邏輯,無 UI 無 3D)
 *
 * 公式對照表(每段對應 §CE 章節,見 docs/drafting-math.md):
 *   §CE.1  自動算    — 吊筋高度 / 房間面積 / 坪數
 *   §CE.2  主支根數  — floor(長邊 / 中心距) + 1
 *   §CE.3  排版基準  — 剩餘收邊分配
 *   §CE.4  支撐排序  — 邊框 + 主支
 *   §CE.5  副支分組  — 每 slot 各算長度與數量
 *   §CE.6  吊筋     — standard / minimal 兩種密度
 *   §CE.7  矽酸鈣板  — 90×180 鋪法 + 全/裁切分張數
 *
 * 設計假設(初版,用 // ASSUMPTION 標記,user 核對後鎖定):
 *   1. 角材寬度全模型統一(邊框 / 主支 / 副支同 timberWidthCm)
 *   2. 副支與兩端對接 = butt joint,長度 = slot 寬 − 兩側角材寬合(全寬)
 *      (兩側若都是角材,扣 timberWidth × 1;若一側是邊框、一側是主支,同樣兩寬合扣)
 *   3. 矽酸鈣板長(180)與主支方向(短邊)同向,板寬(90)沿長邊排
 *   4. 板邊「落在主支中心」用近似:板寬 90 ≈ 主支中心距 90.9(差 0.9 cm 忽略)
 *   5. 邊框吊筋未計(僅主支吊筋);邊框另有牆面固定 + 四角輔助吊筋,規格因案場
 *      不同,不在 v1 範圍。Material 表加 note 提醒。
 *   6. 吊筋 standard 模式:每主支沿長度 floor(L / hangerSpacing) + 1 支
 *      (兩端各一 + 中段每 hangerSpacing 補一支)
 *   7. 吊筋 minimal 模式:每主支固定 2 支(兩端各一)
 *   8. 主支與邊框幾何「對接」(主支單支長 = 短邊 − 2 × 邊框寬,容入內側)
 */

import type {
  AlignmentBase,
  AutoCalc,
  BomItem,
  CeilingBom,
  CeilingInput,
  SubAlignmentBase,
} from "./types";

const EPS = 0.01; // cm, 浮點容差

/**
 * 主入口:輸入 → 完整 BOM + 中間 trace
 */
export function computeCeilingBom(input: CeilingInput): CeilingBom {
  const auto = computeAutoCalc(input);
  const layout = computeMainJoistLayout(input, auto);
  const supports = computeSupportPositions(input, layout);
  const slots = computeSlots(input, supports);
  const subLayout = computeSubJoistYLayout(input);
  const hangerPerMainJoist = computeHangerCountPerJoist(input, layout.mainJoistLengthCm);
  const boardCalc = computeBoardLayout(input, layout.mainJoistCentersCm);

  const items: BomItem[] = [];

  // ────── 邊框 ──────
  // §CE.4 邊框總長 = 周長 = 2 × (長 + 短)
  const frameTotalCm = 2 * (input.longSideCm + input.shortSideCm);
  items.push({
    category: "frame",
    nameZh: "邊框角材",
    spec: `${input.timberWidthCm}×${input.timberThicknessCm} cm`,
    totalLengthM: cmToM(frameTotalCm),
    count: 1, // 視為一整套(總長表示)
    note: `周長 = 2 × (${input.longSideCm} + ${input.shortSideCm}) = ${frameTotalCm} cm`,
  });

  // ────── 主支 ──────
  if (layout.mainJoistTimberCount > 0) {
    items.push({
      category: "main-joist",
      nameZh: "主支角材",
      spec: `${input.timberWidthCm}×${input.timberThicknessCm} cm`,
      unitLengthCm: round1(layout.mainJoistLengthCm),
      count: layout.mainJoistTimberCount,
      note: input.frameDoublesAsSupport
        ? `主支位置 ${layout.mainPositionCount} 處,扣除與邊框重疊 ${layout.mainPositionCount - layout.mainJoistTimberCount} 處 = ${layout.mainJoistTimberCount} 支`
        : `主支根數 = floor(${input.longSideCm} / ${input.mainSpacingCm}) + 1 = ${layout.mainPositionCount} 支`,
    });
  }

  // ────── 副支(依長度分組) ──────
  // §CE.5 把所有 slot 的副支按 「單支長度」 group by, 同長度合併成一行
  const subGroups = new Map<number, { length: number; count: number }>();
  for (const s of slots) {
    if (s.subJoistCount <= 0) continue;
    if (s.subJoistLengthCm <= 0) continue;
    const key = round1(s.subJoistLengthCm);
    const existing = subGroups.get(key);
    if (existing) {
      existing.count += s.subJoistCount;
    } else {
      subGroups.set(key, { length: key, count: s.subJoistCount });
    }
  }
  // 依長度降冪輸出(長的在前)
  const subRows = [...subGroups.values()].sort((a, b) => b.length - a.length);
  for (const r of subRows) {
    items.push({
      category: "sub-joist",
      nameZh: "副支角材",
      spec: `${input.timberWidthCm}×${input.timberThicknessCm} cm`,
      unitLengthCm: r.length,
      count: r.count,
    });
  }

  // ────── 吊筋 ──────
  // §CE.6
  const totalHangers = layout.mainJoistTimberCount * hangerPerMainJoist;
  items.push({
    category: "hanger",
    nameZh: "吊筋",
    spec: `長度 ${round1(auto.hangerHeightCm)} cm (=板高 − 天花板高)`,
    unitLengthCm: round1(auto.hangerHeightCm),
    count: totalHangers,
    note:
      input.hangerDensity === "standard"
        ? `業界標準:每主支 floor(${round1(layout.mainJoistLengthCm)} / ${input.hangerSpacingCm}) + 1 = ${hangerPerMainJoist} 支 × ${layout.mainJoistTimberCount} 主支 = ${totalHangers} 支(邊框固定點另計)`
        : `圖示版:每主支 2 支 × ${layout.mainJoistTimberCount} 主支 = ${totalHangers} 支(邊框固定點另計)`,
  });

  // ────── 矽酸鈣板 ──────
  // §CE.7
  if (boardCalc.fullCount > 0) {
    items.push({
      category: "board-full",
      nameZh: "矽酸鈣板(整張)",
      spec: `${input.boardShortCm}×${input.boardLongCm} cm`,
      count: boardCalc.fullCount,
      note: `${boardCalc.fullCols} 全寬欄 × ${boardCalc.fullRows} 全長列 = ${boardCalc.fullCount} 張`,
    });
  }
  if (boardCalc.cutCount > 0) {
    items.push({
      category: "board-cut",
      nameZh: "矽酸鈣板(裁切)",
      spec: `${input.boardShortCm}×${input.boardLongCm} cm 剩料`,
      count: boardCalc.cutCount,
      note: `總位置 ${boardCalc.totalPositions} − 全張 ${boardCalc.fullCount} = ${boardCalc.cutCount} 張`,
    });
  }

  return {
    input,
    auto,
    items,
    trace: {
      mainJoistCentersCm: layout.mainJoistCentersCm.map(round1),
      mainJoistTimberCount: layout.mainJoistTimberCount,
      mainJoistLengthCm: round1(layout.mainJoistLengthCm),
      supportPositionsCm: supports.map(round1),
      slots: slots.map((s) => ({
        fromCm: round1(s.fromCm),
        toCm: round1(s.toCm),
        slotWidthCm: round1(s.slotWidthCm),
        subJoistLengthCm: round1(s.subJoistLengthCm),
        subJoistCount: s.subJoistCount,
      })),
      hangerPerMainJoist,
      boardRows: boardCalc.rows,
      boardCols: boardCalc.cols,
      boardLayoutDescription: boardCalc.description,
      subJoistYOffsetsCm: subLayout.offsetsCm.map(round1),
      subLeftoverCm: round1(subLayout.leftoverCm),
    },
  };
}

// ─────────────────────────────────────────────────────────
// §CE.1 自動算
// ─────────────────────────────────────────────────────────
function computeAutoCalc(input: CeilingInput): AutoCalc {
  // 吊筋高度 = 板高 − 天花板高
  const hangerHeightCm = input.slabHeightCm - input.ceilingHeightCm;
  // 房間面積(m²)= 長 × 短 / 10000
  const roomAreaM2 = (input.longSideCm * input.shortSideCm) / 10000;
  // 坪數 = 房間面積 / 3.305  (1 坪 = 3.305 m²)
  const pingShu = roomAreaM2 / 3.305;
  // 剩餘收邊 = 長邊 − 主支佔用 span
  const nMainPositions = Math.floor(input.longSideCm / input.mainSpacingCm) + 1;
  const usedSpan = (nMainPositions - 1) * input.mainSpacingCm;
  const leftoverCm = input.longSideCm - usedSpan;

  return {
    hangerHeightCm,
    roomAreaM2,
    pingShu,
    leftoverCm,
    mainPositionCount: nMainPositions,
  };
}

// ─────────────────────────────────────────────────────────
// §CE.2 + §CE.3 主支根數與排版位置
// ─────────────────────────────────────────────────────────
interface MainJoistLayout {
  mainPositionCount: number;
  mainJoistCentersCm: number[];
  mainJoistLengthCm: number;
  mainJoistTimberCount: number;
}

function computeMainJoistLayout(
  input: CeilingInput,
  auto: AutoCalc,
): MainJoistLayout {
  const n = auto.mainPositionCount;
  // 第一支主支的中心位置(沿長邊,從牆內=0 起算)
  // 排版基準 → 決定剩餘收邊留哪側
  const firstCenter = computeFirstCenterByAlignment(
    auto.leftoverCm,
    input.alignmentBase,
  );
  const centers: number[] = [];
  for (let i = 0; i < n; i++) {
    centers.push(firstCenter + i * input.mainSpacingCm);
  }

  // 主支單支長度 = 短邊 − 2 × 邊框寬(對接邊框內側)
  // ASSUMPTION#1 邊框寬與角材寬同 timberWidthCm
  const mainJoistLengthCm = input.shortSideCm - 2 * input.timberWidthCm;

  // 主支實際下料根數:
  //   邊框兼支撐 = true → 與邊框重疊位置不下料(用邊框替代)
  //   邊框兼支撐 = false → 全部下料
  let timberCount = n;
  if (input.frameDoublesAsSupport) {
    // 與兩端邊框重疊計算(容差 timberWidth/2 內視為重疊)
    const tol = input.timberWidthCm / 2 + EPS;
    let overlap = 0;
    if (centers.length > 0 && Math.abs(centers[0] - 0) <= tol) overlap++;
    if (
      centers.length > 0 &&
      Math.abs(centers[centers.length - 1] - input.longSideCm) <= tol
    ) {
      overlap++;
    }
    // 一般 frameDoublesAsSupport=true 預設視為兩端各有 1 處重疊(共 2)
    // 若 alignment 沒讓主支貼邊框,還是視為前後各 1 處被邊框取代(用近似邏輯)
    if (overlap === 0) overlap = Math.min(2, n);
    timberCount = Math.max(0, n - overlap);
  }

  return {
    mainPositionCount: n,
    mainJoistCentersCm: centers,
    mainJoistLengthCm,
    mainJoistTimberCount: timberCount,
  };
}

function computeFirstCenterByAlignment(
  leftoverCm: number,
  alignment: AlignmentBase,
): number {
  switch (alignment) {
    case "left":
      return 0; // 第一主支貼左牆內(注意:0 = 邊框內側面位置)
    case "center":
      return leftoverCm / 2;
    case "right":
      return leftoverCm;
  }
}

// ─────────────────────────────────────────────────────────
// §CE.4 支撐排序(邊框 + 主支去重排序)
// ─────────────────────────────────────────────────────────
function computeSupportPositions(
  input: CeilingInput,
  layout: MainJoistLayout,
): number[] {
  const positions = [0, ...layout.mainJoistCentersCm, input.longSideCm];
  positions.sort((a, b) => a - b);
  // 去除距離 < EPS 的重複(主支恰落在邊框上時)
  const uniq: number[] = [];
  for (const p of positions) {
    if (uniq.length === 0 || p - uniq[uniq.length - 1] > EPS) {
      uniq.push(p);
    }
  }
  return uniq;
}

// ─────────────────────────────────────────────────────────
// §CE.5 副支分 slot
// ─────────────────────────────────────────────────────────
interface SlotCalc {
  fromCm: number;
  toCm: number;
  slotWidthCm: number;
  subJoistLengthCm: number;
  subJoistCount: number;
}

function computeSlots(
  input: CeilingInput,
  supports: number[],
): SlotCalc[] {
  // 短邊內側距離 = 短邊 − 2 × 邊框寬
  const shortInnerCm = input.shortSideCm - 2 * input.timberWidthCm;
  // 每 slot 的副支數量 = floor(短邊內側距離 / 副支中心距) + 1
  //   跟主支 §CE.2 同公式邏輯,確保「N 根 ≤ inner 空間」極大化,
  //   靠上模式底部不會空一截、靠下模式頂部也不會空一截
  const subPerSlot = Math.max(0, Math.floor(shortInnerCm / input.subSpacingCm) + 1);

  const slots: SlotCalc[] = [];
  for (let i = 0; i < supports.length - 1; i++) {
    const fromCm = supports[i];
    const toCm = supports[i + 1];
    const slotWidthCm = toCm - fromCm;
    // ASSUMPTION#2 副支長 = slot 寬 − 兩側角材寬合
    // (兩側不論是邊框還是主支,寬度都用 timberWidthCm)
    const subJoistLengthCm = slotWidthCm - input.timberWidthCm;
    if (slotWidthCm < EPS || subJoistLengthCm < EPS) continue;
    slots.push({
      fromCm,
      toCm,
      slotWidthCm,
      subJoistLengthCm,
      subJoistCount: subPerSlot,
    });
  }
  return slots;
}

// ─────────────────────────────────────────────────────────
// §CE.5b 副支 Y 位置(沿短邊,套 subAlignmentBase)
// ─────────────────────────────────────────────────────────
interface SubJoistYLayout {
  /** 副支中心 Y 偏移陣列,相對 innerY0(= 邊框內側)單位 cm */
  offsetsCm: number[];
  /** 短邊內側未被副支佔的剩餘空間 */
  leftoverCm: number;
}

function computeSubJoistYLayout(input: CeilingInput): SubJoistYLayout {
  // 短邊內側可用空間
  const shortInnerCm = input.shortSideCm - 2 * input.timberWidthCm;
  // 副支根數 = floor(short inner / 副支中心距) + 1 (跟 computeSlots 公式一致)
  const n = Math.max(0, Math.floor(shortInnerCm / input.subSpacingCm) + 1);
  // 副支從第一根中心到最後一根中心的 span = (n-1) × spacing
  const usedSpan = n > 0 ? (n - 1) * input.subSpacingCm : 0;
  // 剩餘空間 = 短邊內側 − usedSpan
  const leftoverCm = shortInnerCm - usedSpan;
  // 第一根副支的 Y 偏移(從 innerY0 起算)依 subAlignmentBase 決定
  const firstOffset = computeSubFirstOffset(leftoverCm, input.subAlignmentBase);

  const offsetsCm: number[] = [];
  for (let i = 0; i < n; i++) {
    offsetsCm.push(firstOffset + i * input.subSpacingCm);
  }
  return { offsetsCm, leftoverCm };
}

function computeSubFirstOffset(leftoverCm: number, base: SubAlignmentBase): number {
  switch (base) {
    case "top":    return 0;
    case "middle": return leftoverCm / 2;
    case "bottom": return leftoverCm;
  }
}

// ─────────────────────────────────────────────────────────
// §CE.6 吊筋密度
// ─────────────────────────────────────────────────────────
function computeHangerCountPerJoist(
  input: CeilingInput,
  mainJoistLengthCm: number,
): number {
  if (input.hangerDensity === "minimal") {
    // 圖示版:每主支兩端各一
    return 2;
  }
  // 業界標準:每主支沿線 floor(L / hangerSpacing) + 1
  return Math.floor(mainJoistLengthCm / input.hangerSpacingCm) + 1;
}

// ─────────────────────────────────────────────────────────
// §CE.7 矽酸鈣板鋪法
// ─────────────────────────────────────────────────────────
interface BoardCalc {
  rows: number;       // 沿短邊方向(板長 180 那一軸)
  cols: number;       // 沿長邊方向(板寬 90 那一軸)
  fullRows: number;
  fullCols: number;
  fullCount: number;
  cutCount: number;
  totalPositions: number;
  description: string;
}

// 板寬「可塞入欄寬」的容差:|欄寬 − boardShortCm| ≤ FULL_WIDTH_TOL_CM 視為全張
// (例:主支中心距 90.9,板寬 90,差 0.9 cm 在容差內 → 整片擺進去剩 0.9 cm 縫,
//  打 AB 膠或矽利康填,算「全張」不算裁切)
const FULL_WIDTH_TOL_CM = 5;

function computeBoardLayout(input: CeilingInput, mainCentersCm: number[]): BoardCalc {
  // ASSUMPTION#3 板長 boardLongCm(180)對齊短邊方向, 板寬 boardShortCm(90)對齊長邊方向
  // 修正:板邊「落在主支中心線」(施工 step 5),沿長邊的欄寬不再是固定 boardShortCm,
  //       改成「邊框外側 → 第一根主支中心 → 第二根主支中心 → ... → 邊框外側」的實際距離

  // ────── 沿長邊欄寬(由主支中心切) ──────
  const colWidthsCm: number[] = [];
  if (mainCentersCm.length === 0) {
    colWidthsCm.push(input.longSideCm);
  } else {
    // 第一欄:邊框外側 → 第一根主支中心
    colWidthsCm.push(mainCentersCm[0]);
    // 中間欄:相鄰主支中心之距(= mainSpacing,通常 = 90.9 cm)
    for (let i = 1; i < mainCentersCm.length; i++) {
      colWidthsCm.push(mainCentersCm[i] - mainCentersCm[i - 1]);
    }
    // 最後欄:最後主支中心 → 邊框外側
    colWidthsCm.push(input.longSideCm - mainCentersCm[mainCentersCm.length - 1]);
  }

  const cols = colWidthsCm.length;
  // 全寬欄 = 欄寬接近 boardShortCm(在容差內)
  const fullCols = colWidthsCm.filter(
    (w) => Math.abs(w - input.boardShortCm) <= FULL_WIDTH_TOL_CM,
  ).length;
  const cutCols = cols - fullCols;

  // ────── 沿短邊列(板邊對齊副支 5×spacing) ──────
  // 副支間距 36.36 cm × 5 = 181.8 cm ≈ 板長 180 cm,差 1.8 cm
  // 板邊改放在副支多倍位置(板邊有副支撐,不懸空)
  // 實際擺板長 180 cm,中間每片剩 1.8 cm 縫(矽利康/接縫帶填,跟長邊同邏輯)
  const effectiveBoardLongCm =
    Math.round(input.boardLongCm / input.subSpacingCm) * input.subSpacingCm;
  const rows = Math.ceil(input.shortSideCm / effectiveBoardLongCm);
  const fullRows = Math.floor(input.shortSideCm / effectiveBoardLongCm);

  const totalPositions = cols * rows;
  // 「全張」= 全寬欄 × 全長列(兩方向都不需裁切)
  const fullCount = fullCols * fullRows;
  // 「裁切」= 其餘
  const cutCount = totalPositions - fullCount;

  const widthsLabel = colWidthsCm.map((w) => Math.round(w * 10) / 10).join(", ");
  const description =
    `沿長邊欄寬(板邊落主支中心):[${widthsLabel}] cm — ${fullCols} 全寬欄 + ${cutCols} 邊裁切欄(板寬 ${input.boardShortCm} cm,容差 ${FULL_WIDTH_TOL_CM} cm)` +
    `;沿短邊列:${rows} 列(${fullRows} 全長 + ${rows - fullRows} 短列,板長 ${input.boardLongCm} cm)` +
    `;全寬欄與板寬差(若 < 1 cm 為矽利康/AB 膠縫)`;

  return {
    rows,
    cols,
    fullRows,
    fullCols,
    fullCount,
    cutCount,
    totalPositions,
    description,
  };
}

// ─────────────────────────────────────────────────────────
// helpers
// ─────────────────────────────────────────────────────────
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function cmToM(cm: number): number {
  return Math.round(cm) / 100; // 1 位數小數(到 m)
}

/** 給 CSV 用:把 BOM 攤平成可讀文字 */
export function bomToCsvRows(bom: CeilingBom): string[][] {
  const header = ["類別", "名稱", "規格", "單支長度(cm)", "總長(m)", "數量", "備註"];
  const rows = bom.items.map((it) => [
    it.category,
    it.nameZh,
    it.spec,
    it.unitLengthCm != null ? String(it.unitLengthCm) : "",
    it.totalLengthM != null ? String(it.totalLengthM) : "",
    String(it.count),
    it.note ?? "",
  ]);
  return [header, ...rows];
}
