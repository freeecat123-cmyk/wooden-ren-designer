import type {
  FurnitureDesign,
  FurnitureTemplate,
  OptionSpec,
  Part,
} from "@/lib/types";
import { getOption, opt } from "@/lib/types";
import { renderDrawerZone } from "./_builders/drawer-row";
import { worldExtents } from "@/lib/render/geometry";

/** 每個瓶位的左右間隙（mm）—— 瓶徑 + 此值 = cellSize */
const CELL_CLEARANCE = 8;
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
const BOTTLE_TYPE_PRESETS: Record<string, { bottleDiameter: number; clearance: number; label: string }> = {
  bordeaux: { bottleDiameter: 76, clearance: 12, label: "波爾多（細肩 ⌀76mm）" },
  burgundy: { bottleDiameter: 81, clearance: 12, label: "勃根地（粗肩 ⌀81mm）" },
  champagne: { bottleDiameter: 90, clearance: 12, label: "香檳（最粗 ⌀90mm）" },
  magnum: { bottleDiameter: 105, clearance: 12, label: "Magnum 1.5L（⌀105mm）" },
  custom: { bottleDiameter: 80, clearance: 8, label: "自訂瓶徑" },
};

export const wineRackOptions: OptionSpec[] = [
  { group: "preset", type: "select", key: "bottleType", label: "瓶型預設", defaultValue: "custom", choices: [
    { value: "custom", label: "自訂瓶徑" },
    { value: "bordeaux", label: "波爾多（⌀76mm，細肩）" },
    { value: "burgundy", label: "勃根地（⌀81mm，粗肩）" },
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
    { value: "diamond", label: "菱形格子陣列（每格放 X 斜板，酒窖經典）" },
  ], help: "菱形款保留方格框架，每個格子中央加一組 45° 交叉斜板（X），瓶子靠下方 V 槽（外尺寸跟方格一樣）" },
  { group: "structure", type: "select", key: "legStyle", label: "腳型", defaultValue: "none", choices: [
    { value: "none", label: "無腳（直接落地）" },
    { value: "post", label: `方柱腳（架高 ${LEG_HEIGHT}mm，離地通風防潮）` },
  ], help: "方柱腳在 4 角加 40mm 方料把酒架架高，底部離地好清掃、防潮" },
  { group: "structure", type: "checkbox", key: "withGlassRack", label: "頂部加掛酒杯架", defaultValue: false, help: "頂板下方加 4-6 道 30mm 寬槽軌（高腳杯倒掛），酒架同時是杯架。需為高腳杯預留至少 200mm 淨高", wide: true },
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
  // 若 user 仍是 default 80，套 preset 瓶徑
  const bd = bdRaw === 80 && bottlePreset && bottleType !== "custom" ? bottlePreset.bottleDiameter : bdRaw;
  // 套 preset clearance 蓋過 const CELL_CLEARANCE
  const cellClearance = bottlePreset && bottleType !== "custom" ? bottlePreset.clearance : CELL_CLEARANCE;
  const panelT = getOption<number>(input, opt(o, "panelThickness"));
  const orientation = getOption<string>(input, opt(o, "bottleOrientation"));
  const gridLayout = getOption<string>(input, opt(o, "gridLayout"));
  const legStyle = getOption<string>(input, opt(o, "legStyle"));
  const withGlassRack = getOption<boolean>(input, opt(o, "withGlassRack"));
  const withPullOutDrawer = getOption<boolean>(input, opt(o, "withPullOutDrawer"));

  const cellSize = bd + cellClearance;
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
    // 框架 = 跟 rect 模式相同的水平層板 + 垂直分隔，重用既有零件陣列。
    const diamondCrosses: Part[] = [];
    // 格子的「淨開口」= cellSize − panelT（4 條框料各佔 panelT/2）。斜板沿這
    // 個淨方塊的對角線跑，兩尖端剛好頂進 90° 內角。
    const clear = Math.max(8, cellSize - panelT);
    const diag = clear * Math.SQRT2;
    // pointed-ends 斜板：local length 沿 +X、thickness 沿 +Y、width 沿 +Z（深度）。
    // 繞 Z 軸轉 ±45° 把 length 旋到格子對角方向。
    // ⚠️ renderer 的 worldExtents() 只支援 90° quarter-turn（lib/render/geometry.ts）：
    // 45° 板的 |sin|>0.5 → 被 snap 成整個交換 xExt↔yExt → yExt 變成 diag 而非
    // 真實旋轉高。renderer 用 pcy = origin.y + worldExtents.yExt/2 定位，所以
    // origin.y 必須照 renderer「實際會算出的 yExt」反推，mesh 中心才會落在
    // 該格中心（mesh 幾何走真旋轉，旋轉後實高 = diag/√2 = clear 塞得進格子）。
    const mkCross = (
      id: string,
      nameZh: string,
      cx: number,
      cyCenter: number,
      rz: number,
    ): Part => {
      const p: Part = {
        id,
        nameZh,
        material,
        grainDirection: "length",
        visible: { length: diag, width: depth, thickness: panelT },
        origin: { x: cx, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: rz },
        shape: { kind: "pointed-ends" },
        tenons: [],
        mortises: [],
      };
      p.origin.y = cyCenter - worldExtents(p).yExt / 2;
      return p;
    };
    const q = Math.PI / 4;
    for (let row = 0; row < bt; row++) {
      // 該格中心 Y（箱體 local，未抬升）：底板上方 panelT + 第 row 格中心。
      const cyCenter = panelT + (row + 0.5) * cellSize;
      for (let col = 0; col < bw; col++) {
        // 該格中心 X：箱體中心對齊原點，innerW 置中。
        const cx = -innerW / 2 + (col + 0.5) * cellSize;
        diamondCrosses.push(
          mkCross(
            `diamond-r${row + 1}-c${col + 1}-a`,
            `第 ${row + 1} 排第 ${col + 1} 格斜板（／）`,
            cx,
            cyCenter,
            q,
          ),
        );
        diamondCrosses.push(
          mkCross(
            `diamond-r${row + 1}-c${col + 1}-b`,
            `第 ${row + 1} 排第 ${col + 1} 格斜板（＼）`,
            cx,
            cyCenter,
            -q,
          ),
        );
      }
    }
    layoutDividers = [...horizontalShelves, ...verticalDividers, ...diamondCrosses];
  } else {
    layoutDividers = [...horizontalShelves, ...verticalDividers];
  }

  // 瓶格箱體所有零件 —— 整組往上抬 boxBaseY（讓出方柱腳 + 抽屜室空間）
  const boxParts: Part[] = [bottom, top, leftSide, rightSide, ...layoutDividers];

  // 頂部杯軌：4 條 25mm 寬條沿 depth 方向跑，掛高腳杯倒立（屬箱體，一起抬）
  if (withGlassRack) {
    const railCount = 4;
    const railWidthMm = 25;
    const railThicknessMm = 12;
    const railSpacing = (outerW - 2 * panelT) / (railCount + 1);
    // 軌道貼在頂板下方、留 25mm 縫好掛高腳杯柱
    const railY = outerH - panelT - 25 - railThicknessMm / 2;
    for (let i = 0; i < railCount; i++) {
      const xPos = -outerW / 2 + panelT + railSpacing * (i + 1);
      boxParts.push({
        id: `glass-rail-${i + 1}`,
        nameZh: `杯軌 ${i + 1}`,
        material,
        grainDirection: "length",
        visible: { length: depth - 2 * panelT, width: railWidthMm, thickness: railThicknessMm },
        origin: { x: xPos, y: railY, z: 0 },
        rotation: { x: 0, y: Math.PI / 2, z: 0 },
        tenons: [],
        mortises: [],
      });
    }
  }

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

  return {
    id: `wine-rack-${bw}x${bt}-${orientation}`,
    category: "wine-rack",
    nameZh: `紅酒架 ${totalBottles} 瓶（${orientation === "horizontal" ? "橫躺" : "直立"}）`,
    overall: { length: outerW, width: depth, thickness: totalH },
    parts,
    defaultJoinery: "tongue-and-groove",
    useButtJointConvention: true,
    primaryMaterial: material,
    notes: `紅酒架 ${bw} 橫 × ${bt} 縱 = ${totalBottles} 瓶位，外尺寸 ${outerW}×${depth}×${totalH}mm。每瓶位 ${cellSize}×${cellSize}mm（瓶身 ${bd}mm + ${cellClearance}mm 緩衝）。內部分隔板用槽接（dado joint）卡入兩側板，不上膠也能穩固——拆卸方便、移動好搬。${
      gridLayout === "diamond" ? `菱形格子款：${totalBottles} 個方格內各加一組 45° 交叉斜板（X），斜板兩端切尖頂進格子內角，瓶身斜靠下方 V 槽，是經典酒窖收納樣式。` : ""
    }${orientation === "horizontal" ? `深度 ${depth}mm 整支瓶身平躺，紅酒專用。` : `深度 ${depth}mm 適合裝直立的 750ml 標準波爾多瓶。`}${
      hasLegs ? ` 底部 4 角加 ${LEG_SIZE}mm 方柱腳架高 ${LEG_HEIGHT}mm，離地通風防潮、好清掃。` : ""
    }${withGlassRack ? " 頂板下方加 4-6 道 30mm 寬軌道掛高腳杯（鋸軌或裝金屬杯軌條），酒架同時是杯架。" : ""}${withPullOutDrawer ? ` 底部加 ${DRAWER_ZONE_H}mm 高拉出抽屜（與斗櫃同一套抽屜系統：前後板 + 兩側板 + 底板 + 把手，裝側裝滑軌），放開瓶器、酒塞、濾酒器等配件。` : ""}`,
  };
};
