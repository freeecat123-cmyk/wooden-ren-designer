import type {
  FurnitureDesign,
  FurnitureTemplate,
  OptionSpec,
  Part,
} from "@/lib/types";
import { getOption, opt } from "@/lib/types";
import { renderDrawerZone } from "./_builders/drawer-row";
import { worldExtents } from "@/lib/render/geometry";

/** 每個瓶位的左右間隙（mm）—— 瓶徑 + 此值 = cellSize（格 pitch、含分隔板厚）。
 * panelT 預設 15mm + 5mm 餘量 = 20mm 起跳，確保 default 矩形格能塞下瓶子。
 * 菱形格需要 ≥ √2 倍空間、會在 warning 提示 user 拉大 pitch 或換瓶型。 */
const CELL_CLEARANCE = 20;
/** 標準波爾多 750ml 直立放（瓶長 ≈ 300mm，預留 -20mm 露頭好取） */
const UPRIGHT_DEPTH = 280;
/** 橫躺放（瓶身水平指向架後，常見酒窖式） */
const HORIZONTAL_DEPTH = 1000;
/** 槽接層板的舌頭尺寸 */
const SHELF_TONGUE_LEN = 8;
const SHELF_TONGUE_THICKNESS_OFFSET = 6;
/** 方柱腳：架高高度 + 斷面尺寸（mm） */
const LEG_HEIGHT = 140;
const LEG_SIZE = 40;
/** 底部拉出抽屜室的淨高（mm）—— 放開瓶器/酒塞/濾酒器等配件 */
const DRAWER_ZONE_H = 130;
/** 抽屜箱最大深度（橫躺架可達 1000mm，配件抽屜不需這麼深） */
const DRAWER_MAX_DEPTH = 420;

/** 瓶型 preset：依 5 瓶型自動套瓶徑 + cell clearance（研究 doc §2） */
// 瓶徑對齊 slider step 5（min 70 max 150 step 5）→ 視覺/實際同步、
// preset 切換時 UI slider 也跳到真實 preset 值（誤差 1mm 無感）。
// clearance ≥ panelT(15) + safety(5) + ~2mm 餘量 = 22mm 起、矩形格保證能塞下瓶子。
const BOTTLE_TYPE_PRESETS: Record<string, { bottleDiameter: number; clearance: number; label: string }> = {
  bordeaux: { bottleDiameter: 75, clearance: 22, label: "波爾多（細肩 ⌀75mm）" },
  burgundy: { bottleDiameter: 80, clearance: 22, label: "勃根地（粗肩 ⌀80mm）" },
  champagne: { bottleDiameter: 90, clearance: 22, label: "香檳（最粗 ⌀90mm）" },
  magnum: { bottleDiameter: 105, clearance: 22, label: "Magnum 1.5L（⌀105mm）" },
  custom: { bottleDiameter: 80, clearance: 20, label: "自訂瓶徑" },
};

export const wineRackOptions: OptionSpec[] = [
  { group: "preset", type: "select", key: "bottleType", label: "瓶型預設", defaultValue: "custom", choices: [
    { value: "custom", label: "自訂瓶徑" },
    { value: "bordeaux", label: "波爾多（⌀75mm，細肩）" },
    { value: "burgundy", label: "勃根地（⌀80mm，粗肩）" },
    { value: "champagne", label: "香檳（⌀90mm，最粗）" },
    { value: "magnum", label: "Magnum 1.5L（⌀105mm）" },
  ], help: "選瓶型自動套瓶徑 + 瓶位間距（user 改瓶徑後仍以 user 值為準）" },
  { group: "structure", type: "select", key: "sizingMode", label: "尺寸決定方式", defaultValue: "byCount", choices: [
    { value: "byCount", label: "鎖瓶數（總尺寸算出）" },
    { value: "byOverall", label: "鎖總長（橫向瓶數算出）" },
  ], help: "byCount=user 設橫/縱瓶數、總尺寸自動算（預設）；byOverall=user 設總長 + 縱向層數、橫向瓶數自動算。總高永遠由 bt × cellSize 算出（兩維共用正方格、無法同時鎖兩維）", wide: true },
  { group: "structure", type: "number", key: "bottlesWide", label: "橫向瓶數", defaultValue: 4, min: 2, max: 8, step: 1, help: "byCount 模式 = 直接決定寬度；byOverall 模式 = 在固定總長內均分多少格（拉大瓶數每格變小、可能塞不下需警告）" },
  { group: "structure", type: "number", key: "bottlesTall", label: "縱向層數", defaultValue: 3, min: 2, max: 6, step: 1 },
  { group: "structure", type: "number", key: "totalLength", label: "總長 (mm)", defaultValue: 500, min: 200, max: 2000, step: 10, unit: "mm", help: "byOverall 模式：外框總寬（含兩側板 panelT×2）。bw 從 (totalLength − 2×panelT) / cellSize 取整算出", dependsOn: { key: "sizingMode", equals: "byOverall" } },
  { group: "structure", type: "number", key: "bottleDiameter", label: "瓶身直徑 (mm)", defaultValue: 80, min: 70, max: 150, step: 5, help: "波爾多 75mm，香檳 90mm，Magnum 1.5L 105mm，Jeroboam 3L 145mm" },
  { group: "structure", type: "number", key: "panelThickness", label: "板厚 (mm)", defaultValue: 15, min: 12, max: 25, step: 1, unit: "mm", help: "酒架本來就輕量，15 比 18 視覺更輕巧" },
  { group: "structure", type: "select", key: "bottleOrientation", label: "瓶身擺放方向", defaultValue: "upright", choices: [
    { value: "upright", label: `直立式（深度 ${UPRIGHT_DEPTH}mm，省空間）` },
    { value: "horizontal", label: `橫躺式（深度 ${HORIZONTAL_DEPTH}mm，酒窖經典款）` },
  ] },
  { group: "structure", type: "select", key: "gridLayout", label: "格子佈局", defaultValue: "rect", choices: [
    { value: "rect", label: "方格陣列（橫直交錯，最多瓶位）" },
    { value: "diamond", label: "菱形陣列（bw×bt 等距方菱形，酒窖經典）" },
  ], help: "菱形款用連續 ／ ＼ 對角板交織成 bw×bt 個等距 45° 方菱形，每格放 1 瓶；對角板在每個 lattice corner 切段、兩端 45° 切角 butt 進 90° 內角無縫" },
  { group: "leg", type: "checkbox", key: "withLegs", label: "🦿 安裝櫃腳（關掉 = 貼地）", defaultValue: false, wide: true, help: "勾起：加底座櫃腳，可選腳高 / 樣式；不勾：酒架直接貼地" },
  { group: "leg", type: "number", key: "legHeight", label: "底座腳高 (mm)", defaultValue: LEG_HEIGHT, min: 0, max: 400, step: 10, dependsOn: { key: "withLegs", equals: true } },
  { group: "leg", type: "number", key: "legInset", label: "腳內縮 (mm)", defaultValue: 0, min: 0, max: 300, step: 5, dependsOn: { all: [{ key: "withLegs", equals: true }, { key: "legHeight", notIn: [0] }] } },
  { group: "leg", type: "select", key: "legShape", label: "腳樣式", defaultValue: "box", choices: [
    { value: "box", label: "直腳" },
    { value: "tapered", label: "錐形腳（方料）" },
    { value: "round", label: "圓柱腳" },
    { value: "round-tapered", label: "圓錐腳" },
    { value: "bracket", label: "帶托腳牙" },
    { value: "plinth", label: "平台底座（衣櫃常見）" },
    { value: "panel-side", label: "側板延伸落地" },
  ], dependsOn: { all: [{ key: "withLegs", equals: true }, { key: "legHeight", notIn: [0] }] } },
  { group: "structure", type: "checkbox", key: "withPullOutDrawer", label: "底部拉出抽屜（開瓶器/配件）", defaultValue: false, help: `底部加抽屜層，與斗櫃同一套抽屜系統（前後板 + 兩側板 + 底板 + 把手），放開瓶器/酒塞/濾酒器等配件`, wide: true },
  { group: "structure", type: "number", key: "drawerZoneHeight", label: "抽屜層總高 (mm)", defaultValue: DRAWER_ZONE_H, min: 60, max: 400, step: 10, dependsOn: { key: "withPullOutDrawer", equals: true } },
  { group: "structure", type: "number", key: "drawerRows", label: "抽屜層數（縱向）", defaultValue: 1, min: 1, max: 4, step: 1, dependsOn: { key: "withPullOutDrawer", equals: true } },
  { group: "structure", type: "number", key: "drawerCols", label: "抽屜橫向切割數", defaultValue: 1, min: 1, max: 6, step: 1, help: "每一層橫向再切幾個抽屜（1=整列、2=左右兩個、3=三等分…）", dependsOn: { key: "withPullOutDrawer", equals: true } },
  { group: "structure", type: "checkbox", key: "drawerBackPanel", label: "抽屜層背板（封後緣）", defaultValue: false, help: "勾起：抽屜層後緣加一片背板封住，灰塵不會掉進去；不勾：背面開放（裝側裝滑軌也能直接從後面塞物）", dependsOn: { key: "withPullOutDrawer", equals: true } },
];

/**
 * 紅酒架 — 2 側板 + N 層水平板 + (N+1) 個垂直分隔
 * 整體尺寸由 bottlesWide/Tall × 瓶身直徑算出，input 維度被忽略。
 * 可選方柱腳架高、底部拉出抽屜（用共用 renderDrawerZone 抽屜系統）。
 */
export const wineRack: FurnitureTemplate = (input): FurnitureDesign => {
  const { material } = input;
  const o = wineRackOptions;
  const bottleType = getOption<string>(input, opt(o, "bottleType"));
  const bottlePreset = BOTTLE_TYPE_PRESETS[bottleType];
  const sizingMode = getOption<string>(input, opt(o, "sizingMode"));
  const bdRaw = getOption<number>(input, opt(o, "bottleDiameter"));
  // bd 一律以 slider 為準（user 拉就生效、立刻看到總尺寸變）。
  // bottleType preset 不再 force-override bd——改成切 preset 時透過
  // `DesignFormShell.PRESET_INPUT_SYNC` 把 slider 自動跳到 preset 對應值
  // （走 ClampedNumberInput 的 defaultValue useEffect 真實同步），slider 仍是
  // 真實 source of truth。preset 只繼續影響 cellClearance（瓶位間距 hint）。
  // 之前「preset force-override slider」設計讓 user 看 slider 沒效果，違反直覺。
  const usePresetClearance = bottleType !== "custom" && bottlePreset;
  const bd = bdRaw;
  const cellClearance = usePresetClearance ? bottlePreset.clearance : CELL_CLEARANCE;
  const panelT = getOption<number>(input, opt(o, "panelThickness"));
  const orientation = getOption<string>(input, opt(o, "bottleOrientation"));
  const gridLayout = getOption<string>(input, opt(o, "gridLayout"));
  const withLegs = getOption<boolean>(input, opt(o, "withLegs"));
  const legShape = getOption<string>(input, opt(o, "legShape"));
  const legHeightOpt = getOption<number>(input, opt(o, "legHeight"));
  const legInset = getOption<number>(input, opt(o, "legInset"));
  const withPullOutDrawer = getOption<boolean>(input, opt(o, "withPullOutDrawer"));
  const drawerZoneHeightOpt = getOption<number>(input, opt(o, "drawerZoneHeight"));
  const drawerRows = getOption<number>(input, opt(o, "drawerRows"));
  const drawerCols = getOption<number>(input, opt(o, "drawerCols"));
  const drawerBackPanel = getOption<boolean>(input, opt(o, "drawerBackPanel"));

  // === 瓶位塞得下瓶子的最小 cellSize ===
  // 矩形格淨寬 = cellSize − panelT；菱形格內接圓直徑 ≈ cellSize/√2 − panelT。
  // 兩者都要 ≥ 瓶徑 bd + SAFETY 才放得舒服。
  const FIT_SAFETY_MARGIN = 5; // mm
  const minCellSize = gridLayout === "diamond"
    ? Math.ceil(Math.SQRT2 * (bd + panelT + FIT_SAFETY_MARGIN))
    : bd + panelT + FIT_SAFETY_MARGIN;
  // requestedCellSize：byCount mode 直接用、byOverall mode 反算 usableW/bw。
  // 菱形 layout 自動把 pitch × √2，讓內接圓 ≥ bd（不然選 80mm 瓶卻只塞得下
  // 57mm 內接圓會誤導 user）。byOverall mode 不自動拉、warning 提示。
  const requestedCellSize = gridLayout === "diamond"
    ? Math.ceil(Math.SQRT2 * (bd + cellClearance))
    : bd + cellClearance;

  // —— 垂直分層：地面 → 方柱腳 → 抽屜室 → 瓶格箱體 ——
  // 方柱腳：y 0..legH。抽屜室：地板 panelT + 淨高 DRAWER_ZONE_H。
  // boxBaseY = 瓶格箱體「底板」origin.y（既有箱體幾何整組往上抬此量）。
  // 提前計算（byOverall 模式需要扣這些算 lattice 可用高度）。
  const hasLegs = withLegs && legHeightOpt > 0;
  const legH = hasLegs ? legHeightOpt : 0;
  const drawerZoneH = withPullOutDrawer ? drawerZoneHeightOpt : 0;
  const boxBaseY = legH + (withPullOutDrawer ? panelT + drawerZoneH : 0);

  // === sizing mode 二擇一：byCount（user 設件數）或 byOverall（user 設總長） ===
  // ⭐ byOverall mode hard-lock outerW = user totalLength：
  //   user 設 totalLength + bw + bt 三者、cellSize 反算成 floor(usableW/bw)
  //   均分填滿、outerW = innerW + 2*panelT ≈ totalLength（差 < bw mm）。
  //   user 拉 bw 整體尺寸不變、但每格寬度跟著變（瓶子相對變大/變小）。
  //   user 拉 totalLength 整體尺寸跟著變、每格寬度跟著變。
  //   bt 兩 mode 都直接 user-set、outerH = bt × cellSize + 框 + 腳。
  //   bd 影響 fit check warning、不影響 cellSize（byOverall mode）。
  const bw = getOption<number>(input, opt(o, "bottlesWide"));
  const bt = getOption<number>(input, opt(o, "bottlesTall"));
  let cellSize: number;
  let targetTotalL: number | null = null;
  if (sizingMode === "byOverall") {
    targetTotalL = getOption<number>(input, opt(o, "totalLength"));
    const usableW = targetTotalL - 2 * panelT;
    // cellSize 反算成 floor(usableW/bw) 均分填滿、user 拉 bw 自動分配
    cellSize = Math.max(20, Math.floor(usableW / bw)); // min 20mm 保底
  } else {
    cellSize = requestedCellSize;
  }

  const innerW = bw * cellSize;
  const innerH = bt * cellSize;
  const outerW = innerW + 2 * panelT;
  const outerH = innerH + 2 * panelT;
  const depth = orientation === "horizontal" ? HORIZONTAL_DEPTH : UPRIGHT_DEPTH;

  const totalBottles = bw * bt;
  const halfOuterW = outerW / 2;

  // 等 cellSize / outerW 算完後再算「塞不下」/「淨格寬」（給 notes 跟 warning 用）。
  // byOverall 模式下 cellSize 可能被拉伸到比 requestedCellSize 大、淨空間反而比較鬆。
  const fitTooSmall = cellSize < minCellSize;
  const rectNetCellW = cellSize - panelT;
  const diamondInscribed = cellSize / Math.SQRT2 - panelT;
  const netFitDim = gridLayout === "diamond" ? diamondInscribed : rectNetCellW;
  const netFitDesc = gridLayout === "diamond"
    ? `菱形內接圓直徑 ${diamondInscribed.toFixed(0)}mm`
    : `每格淨寬 ${rectNetCellW.toFixed(0)}mm`;

  // 上下板（水平，貫穿全寬）
  const top: Part = {
    id: "top",
    nameZh: "頂板",
    material,
    grainDirection: "length",
    visible: { length: outerW, width: depth, thickness: panelT },
    origin: { x: 0, y: outerH - panelT, z: 0 },
    tenons: [],
    mortises: [],
  };
  const bottom: Part = {
    ...top,
    id: "bottom",
    nameZh: "底板",
    origin: { x: 0, y: 0, z: 0 },
  };

  // 兩側板（內側鋸層板槽）
  // §M1: side panel visible {length:depth, width:innerH, thickness:panelT}
  // 鉛直方向 = mesh local Z（width 軸）。yMid 是世界鉛直，需轉成 mesh-local z：
  // panel.origin.y = panelT，panel.length(=depth) 沿水平，width(=innerH) 沿鉛直。
  // 但 part rotation {x:π/2, y:π/2} → mesh local Z 投到世界鉛直軸。
  // local z = (yMid - panel.origin.y) - innerH/2 = yMid - panelT - innerH/2
  // side-aware origin.y：LEFT(xSign=1, side at -halfOuterW+panelT/2)用 y=0；RIGHT 用 y=panelT。
  const shelfMortises = (xSign: -1 | 1) =>
    Array.from({ length: bt - 1 }, (_, idx) => {
      const row = idx + 1;
      const yMid = panelT + row * cellSize - panelT / 2;
      const zLocal = yMid - panelT - innerH / 2;
      return {
        origin: { x: 0, y: xSign > 0 ? 0 : panelT, z: zLocal },
        depth: SHELF_TONGUE_LEN,
        length: depth - SHELF_TONGUE_THICKNESS_OFFSET,
        width: panelT,
        through: false,
      };
    });

  const leftSide: Part = {
    id: "side-left",
    nameZh: "左側板",
    material,
    grainDirection: "length",
    visible: { length: depth, width: innerH, thickness: panelT },
    origin: { x: -(halfOuterW - panelT / 2), y: panelT, z: 0 },
    rotation: { x: Math.PI / 2, y: Math.PI / 2, z: 0 },
    tenons: [],
    mortises: shelfMortises(1),
  };
  const rightSide: Part = {
    ...leftSide,
    id: "side-right",
    nameZh: "右側板",
    origin: { x: halfOuterW - panelT / 2, y: panelT, z: 0 },
    mortises: shelfMortises(-1),
  };

  // 內部水平層板（bt-1 片）—— 兩端有 tongue 卡入側板
  const horizontalShelves: Part[] = [];
  for (let row = 1; row < bt; row++) {
    horizontalShelves.push({
      id: `shelf-h-${row}`,
      nameZh: `第 ${row} 層水平板`,
      material,
      grainDirection: "length",
      visible: { length: innerW, width: depth, thickness: panelT },
      origin: { x: 0, y: panelT + row * cellSize - panelT / 2, z: 0 },
      tenons: [
        { position: "start", type: "tongue-and-groove", length: SHELF_TONGUE_LEN, width: depth - SHELF_TONGUE_THICKNESS_OFFSET, thickness: panelT },
        { position: "end", type: "tongue-and-groove", length: SHELF_TONGUE_LEN, width: depth - SHELF_TONGUE_THICKNESS_OFFSET, thickness: panelT },
      ],
      mortises: [],
    });
  }

  // 內部垂直分隔——butt-joint 慣例：切成段，每段位於相鄰 2 條水平板之間
  // （或最上 / 最下層位於水平板與頂 / 底板之間），不再貫穿水平板。
  // 每排 (bw-1) 個分隔板 × bt 排 = (bw-1)×bt 段。
  const verticalDividers: Part[] = [];
  for (let row = 0; row < bt; row++) {
    // 該排頂底 Y（避開水平板厚度）
    const yMin = row === 0
      ? panelT
      : panelT + row * cellSize + panelT / 2;
    const yMax = row === bt - 1
      ? panelT + bt * cellSize
      : panelT + (row + 1) * cellSize - panelT / 2;
    const segH = yMax - yMin;
    for (let col = 1; col < bw; col++) {
      verticalDividers.push({
        id: `divider-v-r${row + 1}-c${col}`,
        nameZh: `第 ${row + 1} 排第 ${col} 縱向分隔`,
        material,
        grainDirection: "length",
        visible: { length: depth, width: segH, thickness: panelT },
        origin: {
          x: -halfOuterW + panelT + col * cellSize - panelT / 2,
          y: yMin,
          z: 0,
        },
        rotation: { x: Math.PI / 2, y: Math.PI / 2, z: 0 },
        tenons: [],
        mortises: [],
      });
    }
  }

  // 菱形格子陣列（經典酒窖款）：保留矩形格子框架（horizontalShelves +
  // verticalDividers），再於「每個」正方形格子中央放一組 ±45° 交叉斜板，
  // 把每格變成菱形酒窖格（瓶子靠下方 V 槽）。
  let layoutDividers: Part[] = [];
  if (gridLayout === "diamond") {
    // 等距 45° 菱形 lattice：bw × bt 個等邊正方菱形（45° 旋轉方形）。
    // pointed-ends shape 必為 45° 才能在世界座標形成「鉛直 + 水平」面 butt 進 90° 內角。
    // → 用 D = min(innerW/bw, innerH/bt) 當菱形對角線；較長軸方向 lattice 留 margin（置中）。
    // ⭐ FRAME_CLEAR：tip POINT 若剛好在框內側面，pointed-ends wedge 有一面跟框面 coincident
    //   → 3D z-fight。把 lattice 整體往內縮 0.5mm，視覺上仍貼齊框、但無 coincident 面。
    const FRAME_CLEAR = 0;
    const D = Math.min((innerW - 2 * FRAME_CLEAR) / bw, (innerH - 2 * FRAME_CLEAR) / bt);
    const latticeW = bw * D;
    const latticeH = bt * D;
    const offsetX = (innerW - latticeW) / 2; // ≥ FRAME_CLEAR
    const offsetY = (innerH - latticeH) / 2; // ≥ FRAME_CLEAR
    const angle = Math.PI / 4; // 強制 45°
    const diamonds: Part[] = [];

    // 連續對角板版本（前一步）：每條 ／ 或 ＼ 從 lattice 一邊跨到另一邊。
    // 交叉點 z-fighting 已知問題、暫接受（user 要求回到此版）。
    let idCounter = 0;
    const mkSlat = (
      ax: number, ay: number, bx: number, by: number, rz: number,
    ): Part | null => {
      const len = Math.hypot(bx - ax, by - ay);
      if (len < 8) return null;
      idCounter += 1;
      const cxLocal = (ax + bx) / 2;
      const cyLocal = (ay + by) / 2;
      const cx = cxLocal + offsetX - innerW / 2;
      const cyTarget = panelT + offsetY + cyLocal;
      const p: Part = {
        id: `diamond-${rz > 0 ? "pos" : "neg"}-${idCounter}`,
        nameZh: `對角分隔板 ${idCounter}`,
        material,
        grainDirection: "length",
        visible: { length: len, width: depth, thickness: panelT },
        origin: { x: cx, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: rz },
        shape: { kind: "pointed-ends" },
        tenons: [],
        mortises: [],
      };
      p.origin.y = cyTarget - worldExtents(p).yExt / 2;
      return p;
    };

    // ／ 對角板（斜率 +1）：方程 y = x + k*D，k ∈ [-bw, bt]；端點為線跟 lattice 矩形交點
    for (let k = -bw; k <= bt; k++) {
      const ax = k >= 0 ? 0 : -k * D;
      const ay = k >= 0 ? k * D : 0;
      const yAtRight = latticeW + k * D;
      const bx = yAtRight <= latticeH ? latticeW : latticeH - k * D;
      const by = yAtRight <= latticeH ? yAtRight : latticeH;
      const part = mkSlat(ax, ay, bx, by, +angle);
      if (part) diamonds.push(part);
    }
    // ＼ 對角板（斜率 -1）：水平鏡射 ／
    for (let k = -bw; k <= bt; k++) {
      const ax = k >= 0 ? 0 : -k * D;
      const ay = k >= 0 ? k * D : 0;
      const yAtRight = latticeW + k * D;
      const bx = yAtRight <= latticeH ? latticeW : latticeH - k * D;
      const by = yAtRight <= latticeH ? yAtRight : latticeH;
      const part = mkSlat(ax, latticeH - ay, bx, latticeH - by, -angle);
      if (part) diamonds.push(part);
    }
    layoutDividers = diamonds;
  } else {
    layoutDividers = [...horizontalShelves, ...verticalDividers];
  }

  // 瓶格箱體所有零件 —— 整組往上抬 boxBaseY（讓出方柱腳 + 抽屜室空間）
  const boxParts: Part[] = [bottom, top, leftSide, rightSide, ...layoutDividers];

  for (const part of boxParts) part.origin.y += boxBaseY;

  const parts: Part[] = [...boxParts];

  // —— 櫃腳（沿用 case-furniture 同款 7 種樣式：box / tapered / round /
  //     round-tapered / bracket / plinth / panel-side） ——
  // legShape = "plinth" → 4 邊連板底座、"panel-side" → 兩側板延伸落地、
  // 其他 → 4 角柱腳（依 shape 選錐/圓/圓錐），bracket 多加 4 片托腳牙。
  if (hasLegs) {
    if (legShape === "panel-side") {
      const insetZ = 10;
      for (const sx of [-1, 1] as const) {
        parts.push({
          id: `side-extension-${sx < 0 ? "left" : "right"}`,
          nameZh: `${sx < 0 ? "左" : "右"}側板延伸腳`,
          material,
          grainDirection: "length",
          visible: { length: depth - 2 * insetZ, width: legH, thickness: panelT },
          origin: { x: sx * (halfOuterW - panelT / 2), y: 0, z: 0 },
          rotation: { x: Math.PI / 2, y: Math.PI / 2, z: 0 },
          tenons: [],
          mortises: [],
        });
      }
    } else if (legShape === "plinth") {
      const plinthT = 18;
      const insetX = 10 + legInset;
      const insetZ = 10 + legInset;
      for (const sz of [-1, 1] as const) {
        parts.push({
          id: `plinth-${sz < 0 ? "front" : "back"}`,
          nameZh: `${sz < 0 ? "前" : "後"}底座板`,
          material,
          grainDirection: "length",
          visible: { length: outerW - 2 * insetX, width: legH, thickness: plinthT },
          origin: { x: 0, y: 0, z: sz * (depth / 2 - plinthT / 2 - insetZ) },
          rotation: { x: Math.PI / 2, y: 0, z: 0 },
          tenons: [],
          mortises: [],
        });
      }
      for (const sx of [-1, 1] as const) {
        parts.push({
          id: `plinth-${sx < 0 ? "left" : "right"}`,
          nameZh: `${sx < 0 ? "左" : "右"}底座板`,
          material,
          grainDirection: "length",
          visible: { length: depth - 2 * insetZ - 2 * plinthT, width: legH, thickness: plinthT },
          origin: { x: sx * (outerW / 2 - plinthT / 2 - insetX), y: 0, z: 0 },
          rotation: { x: Math.PI / 2, y: Math.PI / 2, z: 0 },
          tenons: [],
          mortises: [],
        });
      }
    } else {
      const legOffsetX = halfOuterW - LEG_SIZE / 2 - legInset;
      const legOffsetZ = depth / 2 - LEG_SIZE / 2 - legInset;
      const shape: Part["shape"] =
        legShape === "tapered"
          ? { kind: "tapered", bottomScale: 0.55 }
          : legShape === "round"
            ? { kind: "round" }
            : legShape === "round-tapered"
              ? { kind: "round-tapered", bottomScale: 0.55 }
              : undefined;
      for (const sx of [-1, 1] as const) {
        for (const sz of [-1, 1] as const) {
          parts.push({
            id: `leg-${sx < 0 ? "l" : "r"}${sz < 0 ? "f" : "b"}`,
            nameZh: `${sz < 0 ? "前" : "後"}${sx < 0 ? "左" : "右"}腳`,
            material,
            grainDirection: "width",
            visible: { length: LEG_SIZE, width: LEG_SIZE, thickness: legH },
            origin: { x: sx * legOffsetX, y: 0, z: sz * legOffsetZ },
            shape,
            tenons: [],
            mortises: [],
          });
          if (legShape === "bracket") {
            const bracketLen = Math.min(legH * 1.4, 80);
            parts.push({
              id: `bracket-${sx < 0 ? "l" : "r"}${sz < 0 ? "f" : "b"}`,
              nameZh: `${sz < 0 ? "前" : "後"}${sx < 0 ? "左" : "右"}托腳牙`,
              material,
              grainDirection: "length",
              visible: { length: bracketLen, width: legH * 0.7, thickness: 14 },
              origin: {
                x: sx * (legOffsetX - LEG_SIZE / 2 - bracketLen / 2),
                y: legH * 0.3,
                z: sz * legOffsetZ,
              },
              rotation: { x: Math.PI / 2, y: 0, z: 0 },
              tenons: [],
              mortises: [],
            });
          }
        }
      }
    }
  }

  // —— 底部拉出抽屜：抽屜室地板 + 兩側牆 + 共用抽屜系統（renderDrawerZone） ——
  if (withPullOutDrawer) {
    const drawerFloorY = legH;
    // 抽屜室地板（瓶格箱體底板當天花板）
    parts.push({
      id: "drawer-floor",
      nameZh: "抽屜室地板",
      material,
      grainDirection: "length",
      visible: { length: outerW, width: depth, thickness: panelT },
      origin: { x: 0, y: drawerFloorY, z: 0 },
      tenons: [],
      mortises: [],
    });
    // 抽屜室兩側牆（與瓶格側板等厚，補滿 drawerZoneH 高）
    for (const xs of [-1, 1] as const) {
      parts.push({
        id: xs < 0 ? "drawer-side-left" : "drawer-side-right",
        nameZh: xs < 0 ? "抽屜室左側牆" : "抽屜室右側牆",
        material,
        grainDirection: "length",
        visible: { length: depth, width: drawerZoneH, thickness: panelT },
        origin: { x: xs * (halfOuterW - panelT / 2), y: drawerFloorY + panelT, z: 0 },
        rotation: { x: Math.PI / 2, y: Math.PI / 2, z: 0 },
        tenons: [],
        mortises: [],
      });
    }
    // 共用抽屜系統：rows × cols 等分，inset 入框。caseWidth=depth → 抽屜面板切齊架前緣。
    // 背板開啟時抽屜深度扣 panelT，避免抽屜後緣撞背板。
    const drawerInnerD = Math.min(
      depth - 20 - (drawerBackPanel ? panelT : 0),
      DRAWER_MAX_DEPTH,
    );
    // 後緣背板（選配）：抽屜層的後牆，灰塵不會掉進去。
    // 抽屜面板在 -Z（前）、所以背板要放 +Z（後）。沿用 case-furniture surface back
    // 的軸別慣例：thickness=vertical（沿 Y）、width=panel-thickness（沿 Z），不轉旋。
    if (drawerBackPanel) {
      parts.push({
        id: "drawer-back",
        nameZh: "抽屜層背板",
        material,
        grainDirection: "length",
        visible: { length: outerW - 2 * panelT, width: panelT, thickness: drawerZoneH },
        origin: { x: 0, y: drawerFloorY + panelT, z: depth / 2 - panelT / 2 },
        tenons: [],
        mortises: [],
      });
    }
    renderDrawerZone(
      {
        yStart: drawerFloorY + panelT,
        height: drawerZoneH,
        rows: drawerRows,
        cols: drawerCols,
        idPrefix: "drawer",
        labelPrefix: "配件抽屜 ",
        dividerFrom: "none",
        xCenter: 0,
        colInnerW: innerW,
        material,
        panelT,
        shelfT: 0,
        shelfTongueT: 0,
        tenonLen: 0,
        caseLength: outerW,
        caseWidth: depth,
        innerW,
        innerD: drawerInnerD,
        caseInnerZ: 0,
        drawerFacePanelT: 18,
        drawerMount: "inset",
        drawerBottomMode: "rebated",
        drawerBottomThickness: 9,
        pullStyle: "knob",
        skipCaseDividers: true,
      },
      parts,
    );
  }

  const totalH = boxBaseY + outerH;

  const warnings: string[] = [];
  if (fitTooSmall) {
    const need = minCellSize - cellSize;
    warnings.push(
      `⚠ 瓶子塞不下：${bd}mm 瓶徑在現在的 ${cellSize}mm pitch 下、${netFitDesc} ${netFitDim.toFixed(0)}mm < 瓶徑 ${bd}mm。建議瓶位 pitch ≥ ${minCellSize}mm（差 ${need}mm）— 把「瓶身直徑」拉大 ${need}mm 或選別的「瓶型預設」。${gridLayout === "diamond" ? "（菱形可用空間 = pitch/√2 − 板厚、比矩形小很多）" : ""}`,
    );
  }
  // byOverall 模式：實際做出來總長跟目標可能有餘數差、提示 user
  if (sizingMode === "byOverall" && targetTotalL !== null) {
    const diffL = targetTotalL - outerW;
    if (Math.abs(diffL) > 5) {
      warnings.push(
        `📐 目標總長 ${targetTotalL}mm、實際做出來 ${outerW}mm（${bw} 格 × ${cellSize}mm pitch + 兩側板）。差額是 cellSize 不整除剩下的餘數空間、可微調「瓶身直徑」/「板厚」/「橫向瓶數預期值」吃掉差額。總高 ${totalH}mm 由 ${bt} 層 × ${cellSize}mm pitch 算出。`,
      );
    }
  }

  return {
    id: `wine-rack-${bw}x${bt}-${orientation}`,
    category: "wine-rack",
    nameZh: `紅酒架 ${totalBottles} 瓶（${orientation === "horizontal" ? "橫躺" : "直立"}）`,
    overall: { length: outerW, width: depth, thickness: totalH },
    parts,
    defaultJoinery: "tongue-and-groove",
    useButtJointConvention: true,
    primaryMaterial: material,
    warnings: warnings.length ? warnings : undefined,
    notes: `紅酒架 ${bw} 橫 × ${bt} 縱 = ${totalBottles} 瓶位，外尺寸 ${outerW}×${depth}×${totalH}mm。**${netFitDesc} vs 瓶徑 ${bd}mm**（餘量 ${(netFitDim - bd).toFixed(0)}mm${fitTooSmall ? "、⚠ 塞不下" : ""}）。每瓶位 ${cellSize}×${cellSize}mm pitch（瓶身 ${bd}mm + ${cellClearance}mm 間距）。內部分隔板用槽接（dado joint）卡入兩側板，不上膠也能穩固——拆卸方便、移動好搬。${
      gridLayout === "diamond" ? `菱形款：${bw}×${bt} 個等距 45° 方菱形格、瓶身斜靠菱形 V 底；對角板切段、兩端 45° 斜角 butt 進 lattice corner 無縫，是經典酒窖陣列樣式。為讓 ${bd}mm 瓶身塞得進菱形內接圓，pitch 自動拉大到 ${cellSize}mm（外尺寸比方格款大約 ${Math.round((Math.SQRT2 - 1) * 100)}%）。` : ""
    }${orientation === "horizontal" ? `深度 ${depth}mm 整支瓶身平躺，紅酒專用。` : `深度 ${depth}mm 適合裝直立的 750ml 標準波爾多瓶。`}${
      hasLegs ? ` 底部加${legShape === "plinth" ? "平台底座" : legShape === "panel-side" ? "側板延伸落地" : legShape === "bracket" ? "帶托腳牙的方柱腳" : legShape === "tapered" ? "錐形方柱腳" : legShape === "round" ? "圓柱腳" : legShape === "round-tapered" ? "圓錐腳" : "方柱腳"}架高 ${legH}mm，離地通風防潮、好清掃。` : ""
    }${withPullOutDrawer ? ` 底部加 ${DRAWER_ZONE_H}mm 高拉出抽屜（與斗櫃同一套抽屜系統：前後板 + 兩側板 + 底板 + 把手，裝側裝滑軌），放開瓶器、酒塞、濾酒器等配件。` : ""}`,
  };
};
