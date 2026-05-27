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
export function computeCeilingBom(
  rawInput: CeilingInput,
  locale: string = "zh-TW",
): CeilingBom {
  const isEn = locale === "en";
  // 自動依板規算間距(若 useAutoSpacing=true):
  //   mainSpacing = boardShortCm + jointGap (cm)  // 板放間距裡 + 接縫
  //   subSpacing  = boardLongCm / round(boardLongCm / 36) // 板長均分,目標 ~36cm
  // 否則用使用者 form 自填值。
  const input: CeilingInput = rawInput.useAutoSpacing
    ? {
        ...rawInput,
        mainSpacingCm: rawInput.boardShortCm + rawInput.jointGapMm / 10,
        subSpacingCm:
          rawInput.boardLongCm /
          Math.max(1, Math.round(rawInput.boardLongCm / 36)),
      }
    : rawInput;

  const auto = computeAutoCalc(input);
  const layout = computeMainJoistLayout(input, auto);
  const supports = computeSupportPositions(input, layout);
  const slots = computeSlots(input, supports, layout);
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
    nameEn: "Perimeter furring",
    spec: `${input.timberWidthCm}×${input.timberThicknessCm} cm`,
    totalLengthM: cmToM(frameTotalCm),
    count: 1, // 視為一整套(總長表示)
    note: `周長 = 2 × (${input.longSideCm} + ${input.shortSideCm}) = ${frameTotalCm} cm`,
    noteEn: isEn
      ? `Perimeter = 2 × (${input.longSideCm} + ${input.shortSideCm}) = ${frameTotalCm} cm`
      : undefined,
  });

  // ────── 主支 ──────
  if (layout.mainJoistTimberCount > 0) {
    items.push({
      category: "main-joist",
      nameZh: "主支角材",
      nameEn: "Main joists",
      spec: `${input.timberWidthCm}×${input.timberThicknessCm} cm`,
      unitLengthCm: round1(layout.mainJoistLengthCm),
      count: layout.mainJoistTimberCount,
      note: input.frameDoublesAsSupport
        ? `主支位置 ${layout.mainPositionCount} 處,扣除與邊框重疊 ${layout.mainPositionCount - layout.mainJoistTimberCount} 處 = ${layout.mainJoistTimberCount} 支`
        : `主支根數 = floor(${input.longSideCm} / ${input.mainSpacingCm}) + 1 = ${layout.mainPositionCount} 支`,
      noteEn: isEn
        ? input.frameDoublesAsSupport
          ? `${layout.mainPositionCount} main-joist positions, minus ${layout.mainPositionCount - layout.mainJoistTimberCount} that overlap the frame = ${layout.mainJoistTimberCount} pieces`
          : `Main joist count = floor(${input.longSideCm} / ${input.mainSpacingCm}) + 1 = ${layout.mainPositionCount} pieces`
        : undefined,
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
      nameEn: "Sub-joists",
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
    nameEn: "Hangers",
    spec: isEn
      ? `Length ${round1(auto.hangerHeightCm)} cm (= slab height − ceiling height)`
      : `長度 ${round1(auto.hangerHeightCm)} cm (=板高 − 天花板高)`,
    unitLengthCm: round1(auto.hangerHeightCm),
    count: totalHangers,
    note:
      input.hangerDensity === "standard"
        ? `業界標準:每主支 floor(${round1(layout.mainJoistLengthCm)} / ${input.hangerSpacingCm}) + 1 = ${hangerPerMainJoist} 支 × ${layout.mainJoistTimberCount} 主支 = ${totalHangers} 支(邊框固定點另計)`
        : `圖示版:每主支 2 支 × ${layout.mainJoistTimberCount} 主支 = ${totalHangers} 支(邊框固定點另計)`,
    noteEn: isEn
      ? input.hangerDensity === "standard"
        ? `Standard: per main joist floor(${round1(layout.mainJoistLengthCm)} / ${input.hangerSpacingCm}) + 1 = ${hangerPerMainJoist} × ${layout.mainJoistTimberCount} joists = ${totalHangers} (perimeter anchors counted separately)`
        : `Diagram-spec: 2 hangers per main joist × ${layout.mainJoistTimberCount} joists = ${totalHangers} (perimeter anchors counted separately)`
      : undefined,
  });

  // ────── 矽酸鈣板 ──────
  // §CE.7
  if (boardCalc.fullCount > 0) {
    items.push({
      category: "board-full",
      nameZh: "矽酸鈣板(整張)",
      nameEn: "Calcium silicate board (full)",
      spec: `${input.boardShortCm}×${input.boardLongCm} cm`,
      count: boardCalc.fullCount,
      note: `${boardCalc.fullCols} 全寬欄 × ${boardCalc.fullRows} 全長列 = ${boardCalc.fullCount} 張`,
      noteEn: isEn
        ? `${boardCalc.fullCols} full-width cols × ${boardCalc.fullRows} full-length rows = ${boardCalc.fullCount} sheets`
        : undefined,
    });
  }
  if (boardCalc.cutCount > 0) {
    items.push({
      category: "board-cut",
      nameZh: "矽酸鈣板(裁切)",
      nameEn: "Calcium silicate board (cut pieces)",
      spec: isEn
        ? `${input.boardShortCm}×${input.boardLongCm} cm offcuts`
        : `${input.boardShortCm}×${input.boardLongCm} cm 剩料`,
      count: boardCalc.cutCount,
      note: `總位置 ${boardCalc.totalPositions} − 全張 ${boardCalc.fullCount} = ${boardCalc.cutCount} 張`,
      noteEn: isEn
        ? `Total positions ${boardCalc.totalPositions} − full sheets ${boardCalc.fullCount} = ${boardCalc.cutCount} sheets`
        : undefined,
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
  // 「靠左/靠右」會把主支貼邊框內側不重疊;「置中」保持對稱
  const firstCenter = computeFirstCenterByAlignment(input, auto.leftoverCm, n);
  const centers: number[] = [];
  for (let i = 0; i < n; i++) {
    centers.push(firstCenter + i * input.mainSpacingCm);
  }

  // 主支單支長度 = 短邊 − 2 × 邊框寬(對接邊框內側)
  // ASSUMPTION#1 邊框寬與角材寬同 timberWidthCm
  const mainJoistLengthCm = input.shortSideCm - 2 * input.timberWidthCm;

  // 主支實際下料根數:
  //   frameDoublesAsSupport = true → 邊框作為最外側 2 處支撐替代(BOM -2)
  //   frameDoublesAsSupport = false → 全部下料
  // BUG 2 fix 2026-05-18:之前用 overlap 偵測 + 強制 fallback 寫得繞,
  // 實際行為就是 -2。改用直接 -2 表達語意清楚(behavior 不變)。
  let timberCount = n;
  if (input.frameDoublesAsSupport && n >= 2) {
    timberCount = n - 2;
  }

  return {
    mainPositionCount: n,
    mainJoistCentersCm: centers,
    mainJoistLengthCm,
    mainJoistTimberCount: timberCount,
  };
}

function computeFirstCenterByAlignment(
  input: CeilingInput,
  leftoverCm: number,
  n: number,
): number {
  // 主支 center 必須 ≥ frameW + tw/2(貼邊框內側不重疊)
  const frameW = input.timberWidthCm;
  const halfTw = input.timberWidthCm / 2;
  switch (input.alignmentBase) {
    case "left":
      // 第一支主支貼邊框內側 + 半角材避免重疊
      return frameW + halfTw;
    case "center":
      // 對稱:firstCenter = leftover/2,符合「房間中央」的視覺
      return leftoverCm / 2;
    case "right":
      // 最後一支主支貼右邊框內側,由 lastCenter 反推 firstCenter
      return (input.longSideCm - frameW - halfTw) - (n - 1) * input.mainSpacingCm;
  }
}

// ─────────────────────────────────────────────────────────
// §CE.4 支撐排序(邊框 + 主支去重排序)
// ─────────────────────────────────────────────────────────
function computeSupportPositions(
  input: CeilingInput,
  layout: MainJoistLayout,
): number[] {
  // Model B(BUG 3 fix 2026-05-18):端點用「邊框內側面」位置(= frameW)
  // 而非「邊框外側」(=0)。讓 trace 顯示更接近實際幾何。
  // 副支 slot 寬度由 computeSlots 用 face-aware 公式自算,不依賴此 array。
  const frameW = input.timberWidthCm;
  const positions = [frameW, ...layout.mainJoistCentersCm, input.longSideCm - frameW];
  positions.sort((a, b) => a - b);
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
  _supports: number[],
  layout: MainJoistLayout,
): SlotCalc[] {
  // BUG 3 fix 2026-05-18 — Model B face-based:
  //   slot.fromCm / toCm 都是「對接面」位置(邊框內側面 或 主支內側面)
  //   slotWidthCm 直接 = 副支長度,不需再扣
  //   修正前(Model A)edge slot 副支會多 1.8 cm(邊框 outside 當 support)
  const frameW = input.timberWidthCm;
  const halfTw = input.timberWidthCm / 2;
  const shortInnerCm = input.shortSideCm - 2 * frameW;
  const subPerSlot = Math.max(0, Math.floor(shortInnerCm / input.subSpacingCm) + 1);
  const mainCenters = layout.mainJoistCentersCm;

  const slots: SlotCalc[] = [];
  const pushSlot = (fromCm: number, toCm: number) => {
    const w = toCm - fromCm;
    if (w < EPS) return;
    slots.push({
      fromCm,
      toCm,
      slotWidthCm: w,
      subJoistLengthCm: w,
      subJoistCount: subPerSlot,
    });
  };

  if (mainCenters.length === 0) {
    // 無主支 → 1 個 slot 從左邊框內側到右邊框內側
    pushSlot(frameW, input.longSideCm - frameW);
    return slots;
  }

  // 第一 edge slot:左邊框內側 → 第一支主支左面
  pushSlot(frameW, mainCenters[0] - halfTw);
  // 中間 inner slots:主支[i] 右面 → 主支[i+1] 左面
  for (let i = 0; i < mainCenters.length - 1; i++) {
    pushSlot(mainCenters[i] + halfTw, mainCenters[i + 1] - halfTw);
  }
  // 最後 edge slot:最後主支右面 → 右邊框內側
  pushSlot(
    mainCenters[mainCenters.length - 1] + halfTw,
    input.longSideCm - frameW,
  );

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
  // 業界標準:每主支沿線間距 ≤ hangerSpacing
  //   N 支 = N-1 個區段,要 (L / (N-1)) ≤ hangerSpacing
  //   → N ≥ ceil(L / hangerSpacing) + 1
  // 公式 floor+1 會讓實際間距 > user 設定值(BUG 1 fix 2026-05-18)
  return Math.ceil(mainJoistLengthCm / input.hangerSpacingCm) + 1;
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

function computeBoardLayout(input: CeilingInput, _mainCentersCm: number[]): BoardCalc {
  // 面積估算法(2026-05-18 修正):
  // 之前按主支中心切欄,baseline 細邊欄 24.25 cm 被當獨立裁切板 → 5+9=14 板過多。
  // 改 naive:cols=ceil(L/板寬), rows=ceil(S/板長), 全張=floor × floor。
  // SVG 視覺仍可依主支對齊(藍 tick),BOM 用估算數,實務細條可從同板 cut。
  const cols = Math.ceil(input.longSideCm / input.boardShortCm);
  const fullCols = Math.floor(input.longSideCm / input.boardShortCm);
  const rows = Math.ceil(input.shortSideCm / input.boardLongCm);
  const fullRows = Math.floor(input.shortSideCm / input.boardLongCm);

  const totalPositions = cols * rows;
  const fullCount = fullCols * fullRows;
  const cutCount = totalPositions - fullCount;

  const description =
    `沿長邊 ${input.longSideCm} cm 鋪 ${cols} 欄(板寬 ${input.boardShortCm} cm,${fullCols} 整 + ${cols - fullCols} 邊裁切)` +
    `;沿短邊 ${input.shortSideCm} cm 鋪 ${rows} 列(板長 ${input.boardLongCm} cm,${fullRows} 整 + ${rows - fullRows} 短列)` +
    `;細邊條可從同片板裁,實務 BOM 已合併估算`;

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
