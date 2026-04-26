import type {
  FurnitureDesign,
  FurnitureTemplate,
  OptionSpec,
  Part,
} from "@/lib/types";
import { getOption, opt } from "@/lib/types";

export const wineRackOptions: OptionSpec[] = [
  { group: "structure", type: "number", key: "bottlesWide", label: "橫向瓶數", defaultValue: 4, min: 2, max: 8, step: 1 },
  { group: "structure", type: "number", key: "bottlesTall", label: "縱向層數", defaultValue: 3, min: 2, max: 6, step: 1 },
  { group: "structure", type: "number", key: "bottleDiameter", label: "瓶身直徑 (mm)", defaultValue: 80, min: 70, max: 100, step: 5, help: "標準波爾多瓶 75mm，香檳瓶 90mm" },
  { group: "structure", type: "number", key: "panelThickness", label: "板厚 (mm)", defaultValue: 18, min: 12, max: 25, step: 1, unit: "mm" },
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

  const cellSize = bd + 8; // 每瓶位 +4mm 左右間隙
  const innerW = bw * cellSize;
  const innerH = bt * cellSize;
  const outerW = innerW + 2 * panelT;
  const outerH = innerH + 2 * panelT;
  // 深度 = 瓶身長度（標準 300mm）+ 一點露出空間
  const depth = 280;

  const totalBottles = bw * bt;

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

  // 兩側板
  const leftSide: Part = {
    id: "side-left",
    nameZh: "左側板",
    material,
    grainDirection: "length",
    visible: { length: depth, width: innerH, thickness: panelT },
    origin: { x: -(outerW / 2 - panelT / 2), y: panelT, z: 0 },
    rotation: { x: Math.PI / 2, y: Math.PI / 2, z: 0 },
    tenons: [],
    mortises: [],
  };
  const rightSide: Part = {
    ...leftSide,
    id: "side-right",
    nameZh: "右側板",
    origin: { x: outerW / 2 - panelT / 2, y: panelT, z: 0 },
  };

  // 內部水平層板（bt-1 片）
  const horizontalShelves: Part[] = [];
  for (let row = 1; row < bt; row++) {
    horizontalShelves.push({
      id: `shelf-h-${row}`,
      nameZh: `第 ${row} 層水平板`,
      material,
      grainDirection: "length",
      visible: { length: innerW, width: depth, thickness: panelT },
      origin: { x: 0, y: panelT + row * cellSize - panelT / 2, z: 0 },
      tenons: [],
      mortises: [],
    });
  }

  // 內部垂直分隔（bw-1 片，每層都有）
  const verticalDividers: Part[] = [];
  for (let col = 1; col < bw; col++) {
    verticalDividers.push({
      id: `divider-v-${col}`,
      nameZh: `第 ${col} 縱向分隔`,
      material,
      grainDirection: "length",
      visible: { length: depth, width: innerH, thickness: panelT },
      origin: { x: -(outerW / 2 - panelT) + col * cellSize - panelT / 2, y: panelT, z: 0 },
      rotation: { x: Math.PI / 2, y: Math.PI / 2, z: 0 },
      tenons: [],
      mortises: [],
    });
  }

  return {
    id: `wine-rack-${bw}x${bt}`,
    category: "wine-rack",
    nameZh: `紅酒架 ${totalBottles} 瓶`,
    overall: { length: outerW, width: depth, thickness: outerH },
    parts: [bottom, top, leftSide, rightSide, ...horizontalShelves, ...verticalDividers],
    defaultJoinery: "tongue-and-groove",
    primaryMaterial: material,
    notes: `紅酒架 ${bw} 橫 × ${bt} 縱 = ${totalBottles} 瓶位，外尺寸 ${outerW}×${depth}×${outerH}mm。每瓶位 ${cellSize}×${cellSize}mm（瓶身 ${bd}mm + 8mm 緩衝）。內部分隔板用槽接（dado joint）卡入兩側板，不上膠也能穩固——拆卸方便、移動好搬。深度 ${depth}mm 適合裝 750ml 標準波爾多瓶。建議掛壁式安裝（後方加吊掛條）或加底座做立式。`,
  };
};
