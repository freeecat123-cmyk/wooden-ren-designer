import type {
  FurnitureDesign,
  FurnitureTemplate,
  OptionSpec,
  Part,
} from "@/lib/types";
import { getOption, opt } from "@/lib/types";

/** 每個瓶位的左右間隙（mm）—— 瓶徑 + 此值 = cellSize */
const CELL_CLEARANCE = 8;
/** 標準波爾多 750ml 直立放（瓶長 ≈ 300mm，預留 -20mm 露頭好取） */
const UPRIGHT_DEPTH = 280;
/** 橫躺放（瓶身水平指向架後，常見酒窖式） */
const HORIZONTAL_DEPTH = 1000;
/** 掛壁吊掛條的厚度（額外加在背面，協助螺絲鎖入牆面） */
const WALL_MOUNT_STRIP_T = 18;
/** 槽接層板的舌頭尺寸 */
const SHELF_TONGUE_LEN = 8;
const SHELF_TONGUE_THICKNESS_OFFSET = 6;

export const wineRackOptions: OptionSpec[] = [
  { group: "structure", type: "number", key: "bottlesWide", label: "橫向瓶數", defaultValue: 4, min: 2, max: 8, step: 1 },
  { group: "structure", type: "number", key: "bottlesTall", label: "縱向層數", defaultValue: 3, min: 2, max: 6, step: 1 },
  { group: "structure", type: "number", key: "bottleDiameter", label: "瓶身直徑 (mm)", defaultValue: 80, min: 70, max: 100, step: 5, help: "標準波爾多瓶 75mm，香檳瓶 90mm" },
  { group: "structure", type: "number", key: "panelThickness", label: "板厚 (mm)", defaultValue: 18, min: 12, max: 25, step: 1, unit: "mm" },
  { group: "structure", type: "select", key: "bottleOrientation", label: "瓶身擺放方向", defaultValue: "upright", choices: [
    { value: "upright", label: `直立式（深度 ${UPRIGHT_DEPTH}mm，省空間）` },
    { value: "horizontal", label: `橫躺式（深度 ${HORIZONTAL_DEPTH}mm，酒窖經典款）` },
  ] },
  { group: "structure", type: "select", key: "mountStyle", label: "安裝方式", defaultValue: "freestanding", choices: [
    { value: "freestanding", label: "立式（直接立於地面/桌上）" },
    { value: "wall-mount", label: "掛壁式（背面加吊掛條鎖牆）" },
    { value: "stackable", label: "可堆疊（上下加凹凸卡榫，多座往上疊）" },
  ] },
  { group: "structure", type: "checkbox", key: "withGlassRack", label: "頂部加掛酒杯架", defaultValue: false, help: "頂板下方加 4-6 道 30mm 寬槽軌（高腳杯倒掛），酒架同時是杯架。需為高腳杯預留至少 200mm 淨高", wide: true },
  { group: "structure", type: "checkbox", key: "withFelt", label: "瓶位內貼絨布", defaultValue: false, help: "每個瓶位四壁內側貼薄絨布，瓶身放入時不會碰撞瓶身刮花標籤", wide: true },
  { group: "structure", type: "checkbox", key: "withPullOutDrawer", label: "底部拉出抽屜（開瓶器/配件）", defaultValue: false, help: "底部加 100mm 高抽屜，放開瓶器/酒塞/濾酒器等配件", wide: true },
  { group: "structure", type: "number", key: "edgeChamfer", label: "外露邊倒角 (mm)", defaultValue: 2, min: 0, max: 8, step: 1, unit: "mm", help: "頂板 / 底板 / 側板外露邊倒角，2-3mm 防割手 + 美感" },
];

/**
 * 紅酒架 — 2 側板 + N 層水平板 + (N+1) 個垂直分隔
 * 整體尺寸由 bottlesWide/Tall × 瓶身直徑算出，input 維度被忽略
 */
export const wineRack: FurnitureTemplate = (input): FurnitureDesign => {
  const { material } = input;
  const o = wineRackOptions;
  const bw = getOption<number>(input, opt(o, "bottlesWide"));
  const bt = getOption<number>(input, opt(o, "bottlesTall"));
  const bd = getOption<number>(input, opt(o, "bottleDiameter"));
  const panelT = getOption<number>(input, opt(o, "panelThickness"));
  const orientation = getOption<string>(input, opt(o, "bottleOrientation"));
  const mountStyle = getOption<string>(input, opt(o, "mountStyle"));
  const withGlassRack = getOption<boolean>(input, opt(o, "withGlassRack"));
  const withFelt = getOption<boolean>(input, opt(o, "withFelt"));
  const withPullOutDrawer = getOption<boolean>(input, opt(o, "withPullOutDrawer"));
  const edgeChamfer = getOption<number>(input, opt(o, "edgeChamfer"));

  const cellSize = bd + CELL_CLEARANCE;
  const innerW = bw * cellSize;
  const innerH = bt * cellSize;
  const outerW = innerW + 2 * panelT;
  const outerH = innerH + 2 * panelT;
  const depth = orientation === "horizontal" ? HORIZONTAL_DEPTH : UPRIGHT_DEPTH;

  const totalBottles = bw * bt;
  const halfOuterW = outerW / 2;

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
  const shelfMortises = (xSign: -1 | 1) =>
    Array.from({ length: bt - 1 }, (_, idx) => {
      const row = idx + 1;
      const yMid = panelT + row * cellSize - panelT / 2;
      return {
        origin: { x: xSign * (panelT / 2), y: yMid, z: 0 },
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

  // 內部垂直分隔（bw-1 片，每層都有）
  // origin 簡化：x 坐標 = 第 col 個格子的右邊界 - halfOuterW
  const verticalDividers: Part[] = [];
  for (let col = 1; col < bw; col++) {
    verticalDividers.push({
      id: `divider-v-${col}`,
      nameZh: `第 ${col} 縱向分隔`,
      material,
      grainDirection: "length",
      visible: { length: depth, width: innerH, thickness: panelT },
      origin: {
        x: -halfOuterW + panelT + col * cellSize - panelT / 2,
        y: panelT,
        z: 0,
      },
      rotation: { x: Math.PI / 2, y: Math.PI / 2, z: 0 },
      tenons: [],
      mortises: [],
    });
  }

  const parts: Part[] = [bottom, top, leftSide, rightSide, ...horizontalShelves, ...verticalDividers];

  // 底部拉出抽屜（高 100mm）
  if (withPullOutDrawer) {
    const drawerH = 100;
    parts.push({
      id: "drawer-front",
      nameZh: "底部抽屜面板",
      material,
      grainDirection: "length",
      visible: { length: outerW, width: drawerH, thickness: panelT },
      origin: { x: 0, y: -drawerH / 2 - panelT / 2, z: depth / 2 - panelT / 2 },
      rotation: { x: Math.PI / 2, y: 0, z: 0 },
      tenons: [],
      mortises: [],
    });
    parts.push({
      id: "drawer-bottom",
      nameZh: "底部抽屜底板",
      material,
      grainDirection: "length",
      visible: { length: outerW - 30, width: depth - 30, thickness: 8 },
      origin: { x: 0, y: -drawerH - 4, z: 0 },
      tenons: [],
      mortises: [],
    });
  }

  if (mountStyle === "wall-mount") {
    // 背面加一條全寬吊掛條，鎖到牆內龍骨上
    parts.push({
      id: "wall-mount-strip",
      nameZh: "吊掛條（鎖牆用）",
      material,
      grainDirection: "length",
      visible: { length: outerW, width: 80, thickness: WALL_MOUNT_STRIP_T },
      origin: { x: 0, y: outerH - 100, z: -(depth / 2 - WALL_MOUNT_STRIP_T / 2) },
      rotation: { x: Math.PI / 2, y: 0, z: 0 },
      tenons: [],
      mortises: [],
    });
  }

  return {
    id: `wine-rack-${bw}x${bt}-${orientation}`,
    category: "wine-rack",
    nameZh: `紅酒架 ${totalBottles} 瓶（${orientation === "horizontal" ? "橫躺" : "直立"}）`,
    overall: { length: outerW, width: depth, thickness: outerH },
    parts,
    defaultJoinery: "tongue-and-groove",
    primaryMaterial: material,
    notes: `紅酒架 ${bw} 橫 × ${bt} 縱 = ${totalBottles} 瓶位，外尺寸 ${outerW}×${depth}×${outerH}mm。每瓶位 ${cellSize}×${cellSize}mm（瓶身 ${bd}mm + ${CELL_CLEARANCE}mm 緩衝）。內部分隔板用槽接（dado joint）卡入兩側板，不上膠也能穩固——拆卸方便、移動好搬。${orientation === "horizontal" ? `深度 ${depth}mm 整支瓶身平躺，紅酒專用。` : `深度 ${depth}mm 適合裝直立的 750ml 標準波爾多瓶。`}${
      mountStyle === "wall-mount"
        ? "已加背面吊掛條，鎖到牆內龍骨上即可。"
        : mountStyle === "stackable"
          ? "頂底加凹凸卡榫，多座可往上疊（每座頂面挖 4 個 8×20mm 凹孔，下座底面凸 4 個對應榫）。"
          : "可直接立於地面或桌上。"
    }${withGlassRack ? " 頂板下方加 4-6 道 30mm 寬軌道掛高腳杯（鋸軌或裝金屬杯軌條），酒架同時是杯架。" : ""}${withFelt ? " 每個瓶位四壁內側貼 1mm 絨布（B&Q 自黏絨布裁好黏入），瓶身不會撞傷標籤。" : ""}${withPullOutDrawer ? " 底部加 100mm 高拉出抽屜（裝側裝滑軌），放開瓶器、酒塞、濾酒器等配件。" : ""}${edgeChamfer > 0 ? ` 頂底板及側板外露邊倒 ${edgeChamfer}mm 防割。` : ""}`,
  };
};
