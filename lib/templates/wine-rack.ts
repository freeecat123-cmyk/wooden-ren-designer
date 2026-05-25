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
  { group: "structure", type: "number", key: "bottlesWide", label: "橫向瓶數", defaultValue: 4, min: 2, max: 8, step: 1 },
  { group: "structure", type: "number", key: "bottlesTall", label: "縱向層數", defaultValue: 3, min: 2, max: 6, step: 1 },
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
  { group: "structure", type: "select", key: "legStyle", label: "腳型", defaultValue: "none", choices: [
    { value: "none", label: "無腳（直接落地）" },
    { value: "post", label: `方柱腳（架高 ${LEG_HEIGHT}mm，離地通風防潮）` },
  ], help: "方柱腳在 4 角加 40mm 方料把酒架架高，底部離地好清掃、防潮" },
  { group: "structure", type: "checkbox", key: "withPullOutDrawer", label: "底部拉出抽屜（開瓶器/配件）", defaultValue: false, help: `底部加 ${DRAWER_ZONE_H}mm 高拉出抽屜，與斗櫃同一套抽屜系統（前後板 + 兩側板 + 底板 + 把手），放開瓶器/酒塞/濾酒器等配件`, wide: true },
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
  const bw = getOption<number>(input, opt(o, "bottlesWide"));
  const bt = getOption<number>(input, opt(o, "bottlesTall"));
  const bdRaw = getOption<number>(input, opt(o, "bottleDiameter"));
  // 瓶型 preset 強制蓋過 slider — 選 bordeaux/burgundy/champagne/magnum 一律
  // 套 preset 的 bd + clearance（slider 自訂值只在 bottleType="custom" 時生效）。
  // 之前用 `bdRaw === 80` gate 太嚴、slider 一動 preset 就失效，UI label 跟實際算
  // 對不上。preset/slider 互斥才不會視覺-實際分裂。
  const usePreset = bottleType !== "custom" && bottlePreset;
  const bd = usePreset ? bottlePreset.bottleDiameter : bdRaw;
  const cellClearance = usePreset ? bottlePreset.clearance : CELL_CLEARANCE;
  const panelT = getOption<number>(input, opt(o, "panelThickness"));
  const orientation = getOption<string>(input, opt(o, "bottleOrientation"));
  const gridLayout = getOption<string>(input, opt(o, "gridLayout"));
  const legStyle = getOption<string>(input, opt(o, "legStyle"));
  const withPullOutDrawer = getOption<boolean>(input, opt(o, "withPullOutDrawer"));

  // === 瓶位是否塞得下瓶子 — 只警告不自動拉 ===
  // 矩形格淨寬 = cellSize − panelT；菱形格內接圓直徑 ≈ cellSize/√2 − panelT。
  // 兩者都要 ≥ 瓶徑 bd + SAFETY 才放得舒服。
  // 不自動拉、user 看 slider / notes / warning 自己調 — 拉 slider 馬上看得到
  // 總尺寸跟著變、不會被「auto-fit clamp 到一樣」搞混。
  const FIT_SAFETY_MARGIN = 5; // mm
  const minCellSize = gridLayout === "diamond"
    ? Math.ceil(Math.SQRT2 * (bd + panelT + FIT_SAFETY_MARGIN))
    : bd + panelT + FIT_SAFETY_MARGIN;
  const cellSize = bd + cellClearance; // user 設定原值、不 auto-fit
  const fitTooSmall = cellSize < minCellSize;
  // 實際淨空間（給 notes 跟 warning 用）
  const rectNetCellW = cellSize - panelT;
  const diamondInscribed = cellSize / Math.SQRT2 - panelT;
  const netFitDim = gridLayout === "diamond" ? diamondInscribed : rectNetCellW;
  const netFitDesc = gridLayout === "diamond"
    ? `菱形內接圓直徑 ${diamondInscribed.toFixed(0)}mm`
    : `每格淨寬 ${rectNetCellW.toFixed(0)}mm`;

  const innerW = bw * cellSize;
  const innerH = bt * cellSize;
  const outerW = innerW + 2 * panelT;
  const outerH = innerH + 2 * panelT;
  const depth = orientation === "horizontal" ? HORIZONTAL_DEPTH : UPRIGHT_DEPTH;

  const totalBottles = bw * bt;
  const halfOuterW = outerW / 2;

  // —— 垂直分層：地面 → 方柱腳 → 抽屜室 → 瓶格箱體 ——
  // 方柱腳：y 0..legH。抽屜室：地板 panelT + 淨高 DRAWER_ZONE_H。
  // boxBaseY = 瓶格箱體「底板」origin.y（既有箱體幾何整組往上抬此量）。
  const hasLegs = legStyle === "post";
  const legH = hasLegs ? LEG_HEIGHT : 0;
  const drawerZoneH = withPullOutDrawer ? DRAWER_ZONE_H : 0;
  const boxBaseY = legH + (withPullOutDrawer ? panelT + drawerZoneH : 0);

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

  // —— 方柱腳：4 角 40mm 方料，y 0..legH（無旋轉，thickness 沿 +Y 鉛直） ——
  if (hasLegs) {
    const legCorners: Array<{ id: string; nameZh: string; xs: -1 | 1; zs: -1 | 1 }> = [
      { id: "leg-fl", nameZh: "前左腳", xs: -1, zs: 1 },
      { id: "leg-fr", nameZh: "前右腳", xs: 1, zs: 1 },
      { id: "leg-bl", nameZh: "後左腳", xs: -1, zs: -1 },
      { id: "leg-br", nameZh: "後右腳", xs: 1, zs: -1 },
    ];
    for (const c of legCorners) {
      parts.push({
        id: c.id,
        nameZh: c.nameZh,
        material,
        grainDirection: "width",
        visible: { length: LEG_SIZE, width: LEG_SIZE, thickness: legH },
        origin: {
          x: c.xs * (halfOuterW - LEG_SIZE / 2),
          y: 0,
          z: c.zs * (depth / 2 - LEG_SIZE / 2),
        },
        tenons: [],
        mortises: [],
      });
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
    // 共用抽屜系統：單列單抽，inset 入框。caseWidth=depth → 抽屜面板切齊架前緣。
    const drawerInnerD = Math.min(depth - 20, DRAWER_MAX_DEPTH);
    renderDrawerZone(
      {
        yStart: drawerFloorY + panelT,
        height: drawerZoneH,
        rows: 1,
        cols: 1,
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
      gridLayout === "diamond" ? `菱形款：${bw}×${bt} 個等距 45° 方菱形格、瓶身斜靠菱形 V 底；對角板切段、兩端 45° 斜角 butt 進 lattice corner 無縫，是經典酒窖陣列樣式（菱形可用空間 = pitch/√2 − 板厚、比矩形小、需要更大 pitch）。` : ""
    }${orientation === "horizontal" ? `深度 ${depth}mm 整支瓶身平躺，紅酒專用。` : `深度 ${depth}mm 適合裝直立的 750ml 標準波爾多瓶。`}${
      hasLegs ? ` 底部 4 角加 ${LEG_SIZE}mm 方柱腳架高 ${LEG_HEIGHT}mm，離地通風防潮、好清掃。` : ""
    }${withPullOutDrawer ? ` 底部加 ${DRAWER_ZONE_H}mm 高拉出抽屜（與斗櫃同一套抽屜系統：前後板 + 兩側板 + 底板 + 把手，裝側裝滑軌），放開瓶器、酒塞、濾酒器等配件。` : ""}`,
  };
};
