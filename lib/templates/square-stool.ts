import type {
  FurnitureDesign,
  FurnitureTemplate,
  Part,
} from "@/lib/types";
import { corners } from "./_helpers";

/**
 * 方凳（square stool）
 *
 * 結構：
 *  - 1 × 座板（top panel）
 *  - 4 × 凳腳（legs）
 *  - 4 × 橫撐（stretchers/aprons），凳腳之間連接
 *
 * 接合：
 *  - 凳腳 ↔ 座板：通榫（凳腳上端凸出穿過座板）
 *  - 橫撐 ↔ 凳腳：半榫（橫撐兩端凸入凳腳側面榫眼）
 *
 * 預設尺寸假設：
 *  - 座板 = length × width × thickness（含 4 個榫眼）
 *  - 凳腳 = leg × leg × height（上端有通榫，側面有 2 個半榫眼）
 *  - 橫撐 = (length - 2*legSize) × apronWidth × apronThickness
 */
export const squareStool: FurnitureTemplate = (input): FurnitureDesign => {
  const {
    length,
    width,
    height,
    material,
  } = input;

  // 標準參數（之後可由 input 客製化）
  const seatThickness = 25;
  const legSize = 35;
  const apronWidth = 60;
  const apronThickness = 20;
  const legTenonLength = seatThickness; // 通榫穿過座板
  const apronTenonLength = Math.round(legSize * 0.6); // 半榫，深度 = 凳腳厚的 60%

  const legHeight = height - seatThickness;

  const seatPanel: Part = {
    id: "seat",
    nameZh: "座板",
    material,
    grainDirection: "length",
    visible: { length, width, thickness: seatThickness },
    origin: { x: 0, y: legHeight, z: 0 },
    tenons: [],
    mortises: [
      // 4 個通孔：座板四角放凳腳通榫
      ...corners(length, width, legSize).map((c) => ({
        origin: { x: c.x, y: 0, z: c.z },
        depth: seatThickness,
        length: legSize,
        width: legSize,
        through: true,
      })),
    ],
  };

  // 4 隻凳腳
  const legs: Part[] = corners(length, width, legSize).map((c, i) => ({
    id: `leg-${i + 1}`,
    nameZh: `凳腳 ${i + 1}`,
    material,
    grainDirection: "length",
    visible: { length: legSize, width: legSize, thickness: legHeight },
    origin: { x: c.x, y: 0, z: c.z },
    tenons: [
      {
        position: "top",
        type: "through-tenon",
        length: legTenonLength,
        width: legSize,
        thickness: legSize,
      },
    ],
    // 凳腳內側 2 面要挖橫撐的半榫眼（中段，距離地面 1/3 處）
    mortises: legMortisesForApron(c, length, width, {
      apronTenonLength,
      apronWidth,
      apronThickness,
      legHeight,
    }),
  }));

  // 4 條橫撐（凳腳之間）
  const apronInnerSpan = {
    x: length - legSize, // 兩腳中心距離 = length - legSize
    z: width - legSize,
  };
  const aprons: Part[] = [
    // 前後兩條（沿 X 方向）
    apron("apron-front", "前橫撐", apronInnerSpan.x, "x", { z: -(width / 2 - legSize / 2) }),
    apron("apron-back", "後橫撐", apronInnerSpan.x, "x", { z: width / 2 - legSize / 2 }),
    // 左右兩條（沿 Z 方向）
    apron("apron-left", "左橫撐", apronInnerSpan.z, "z", { x: -(length / 2 - legSize / 2) }),
    apron("apron-right", "右橫撐", apronInnerSpan.z, "z", { x: length / 2 - legSize / 2 }),
  ].map((p) => ({
    ...p,
    material,
    grainDirection: "length" as const,
    visible: {
      length: p.visibleLength,
      width: apronWidth,
      thickness: apronThickness,
    },
    rotation: p.axis === "z"
      ? { x: Math.PI / 2, y: Math.PI / 2, z: 0 }
      : { x: Math.PI / 2, y: 0, z: 0 },
    tenons: [
      {
        position: "start" as const,
        type: "blind-tenon" as const,
        length: apronTenonLength,
        width: apronWidth - 10,
        thickness: apronThickness - 5,
      },
      {
        position: "end" as const,
        type: "blind-tenon" as const,
        length: apronTenonLength,
        width: apronWidth - 10,
        thickness: apronThickness - 5,
      },
    ],
    mortises: [],
    origin: { ...p.origin, y: legHeight - apronWidth - 30 },
  }));

  return {
    id: `square-stool-${length}x${width}x${height}`,
    category: "stool",
    nameZh: "方凳",
    overall: { length, width, thickness: height },
    parts: [seatPanel, ...legs, ...aprons],
    defaultJoinery: "through-tenon",
    primaryMaterial: material,
    notes: "座板與凳腳用通榫，凳腳與橫撐用半榫。",
  };
};

// ----- helpers -----

function legMortisesForApron(
  corner: { x: number; z: number },
  length: number,
  width: number,
  opts: {
    apronTenonLength: number;
    apronWidth: number;
    apronThickness: number;
    legHeight: number;
  },
) {
  const { apronTenonLength, apronWidth, apronThickness, legHeight } = opts;
  // 距離凳腳底部 1/3 高度處挖榫眼
  const yOffset = legHeight - apronWidth - 30;
  return [
    // 內側 X 方向榫眼（前後橫撐插入）
    {
      origin: { x: 0, y: yOffset, z: corner.z > 0 ? -1 : 1 },
      depth: apronTenonLength,
      length: apronWidth - 10,
      width: apronThickness - 5,
      through: false,
    },
    // 內側 Z 方向榫眼（左右橫撐插入）
    {
      origin: { x: corner.x > 0 ? -1 : 1, y: yOffset, z: 0 },
      depth: apronTenonLength,
      length: apronWidth - 10,
      width: apronThickness - 5,
      through: false,
    },
  ];
}

function apron(
  id: string,
  nameZh: string,
  visibleLength: number,
  axis: "x" | "z",
  origin: { x?: number; z?: number },
) {
  return {
    id,
    nameZh,
    visibleLength,
    axis,
    origin: { x: origin.x ?? 0, z: origin.z ?? 0 },
  };
}
