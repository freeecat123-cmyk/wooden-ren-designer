import type {
  FurnitureDesign,
  FurnitureTemplate,
  OptionSpec,
  Part,
} from "@/lib/types";
import { getOption } from "@/lib/types";
import { corners } from "./_helpers";

export const squareStoolOptions: OptionSpec[] = [
  { type: "number", key: "legSize", label: "腳粗 (mm)", defaultValue: 35, min: 20, max: 120, step: 1, unit: "mm" },
  { type: "number", key: "seatThickness", label: "座板厚 (mm)", defaultValue: 25, min: 12, max: 60, step: 1, unit: "mm" },
  { type: "number", key: "apronWidth", label: "橫撐高度 (mm)", defaultValue: 60, min: 30, max: 200, step: 5, unit: "mm" },
  { type: "number", key: "apronThickness", label: "橫撐厚度 (mm)", defaultValue: 20, min: 10, max: 50, step: 1, unit: "mm" },
  { type: "number", key: "apronDropFromTop", label: "橫撐距座板 (mm)", defaultValue: 30, min: 0, max: 400, step: 5, unit: "mm", help: "橫撐頂面距座板下緣的距離" },
  { type: "checkbox", key: "withLowerStretcher", label: "加下橫撐（H形）", defaultValue: false, help: "在腳下方 1/4 高再加一圈橫撐，結構更穩" },
];

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

  const legSize = getOption<number>(input, squareStoolOptions[0]);
  const seatThickness = getOption<number>(input, squareStoolOptions[1]);
  const apronWidth = getOption<number>(input, squareStoolOptions[2]);
  const apronThickness = getOption<number>(input, squareStoolOptions[3]);
  const apronDropFromTop = getOption<number>(input, squareStoolOptions[4]);
  const withLowerStretcher = getOption<boolean>(input, squareStoolOptions[5]);

  const legTenonLength = seatThickness; // 通榫穿過座板
  // 正規比例：榫長 = 柱腳 2/3；榫厚 = 母件 1/3；榫肩 = 上下各 1/4
  const apronTenonLength = Math.round((legSize * 2) / 3);
  const apronTenonThick = Math.max(6, Math.round(apronThickness / 3));
  const apronTenonW = Math.max(15, apronWidth - Math.round(apronWidth / 4));

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
      apronTenonWidth: apronTenonW,
      apronTenonThick,
      apronWidth,
      legHeight,
      apronDropFromTop,
    }),
  }));

  // 4 條橫撐（凳腳之間）—— body 延伸到腳中心以視覺呈現榫頭位置
  const apronInnerSpan = {
    x: length - legSize,
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
        width: apronTenonW,
        thickness: apronTenonThick,
      },
      {
        position: "end" as const,
        type: "blind-tenon" as const,
        length: apronTenonLength,
        width: apronTenonW,
        thickness: apronTenonThick,
      },
    ],
    mortises: [],
    origin: { ...p.origin, y: legHeight - apronWidth - apronDropFromTop },
  }));

  const parts: Part[] = [seatPanel, ...legs, ...aprons];

  if (withLowerStretcher) {
    const lowerY = Math.round(legHeight * 0.22);
    const lowerW = 40;
    const lowerT = 20;
    const lowerTenon = Math.round((legSize * 2) / 3);
    const lowerTenonThick = Math.max(6, Math.round(lowerT / 3));
    const lowerTenonW = Math.max(12, lowerW - Math.round(lowerW / 4));
    const sides = [
      { id: "ls-front", nameZh: "前下橫撐", visibleLength: apronInnerSpan.x, axis: "x" as const, origin: { x: 0, z: -(width / 2 - legSize / 2) } },
      { id: "ls-back", nameZh: "後下橫撐", visibleLength: apronInnerSpan.x, axis: "x" as const, origin: { x: 0, z: width / 2 - legSize / 2 } },
      { id: "ls-left", nameZh: "左下橫撐", visibleLength: apronInnerSpan.z, axis: "z" as const, origin: { x: -(length / 2 - legSize / 2), z: 0 } },
      { id: "ls-right", nameZh: "右下橫撐", visibleLength: apronInnerSpan.z, axis: "z" as const, origin: { x: length / 2 - legSize / 2, z: 0 } },
    ];
    for (const s of sides) {
      parts.push({
        id: s.id,
        nameZh: s.nameZh,
        material,
        grainDirection: "length",
        visible: { length: s.visibleLength, width: lowerW, thickness: lowerT },
        origin: { x: s.origin.x, y: lowerY, z: s.origin.z },
        rotation: s.axis === "z" ? { x: Math.PI / 2, y: Math.PI / 2, z: 0 } : { x: Math.PI / 2, y: 0, z: 0 },
        tenons: [
          { position: "start", type: "blind-tenon", length: lowerTenon, width: lowerTenonW, thickness: lowerTenonThick },
          { position: "end", type: "blind-tenon", length: lowerTenon, width: lowerTenonW, thickness: lowerTenonThick },
        ],
        mortises: [],
      });
    }
  }

  return {
    id: `square-stool-${length}x${width}x${height}`,
    category: "stool",
    nameZh: "方凳",
    overall: { length, width, thickness: height },
    parts,
    defaultJoinery: "through-tenon",
    primaryMaterial: material,
    notes: "座板與凳腳用通榫，凳腳與橫撐用半榫。" + (withLowerStretcher ? " 加下橫撐 H 形結構。" : ""),
  };
};

// ----- helpers -----

function legMortisesForApron(
  corner: { x: number; z: number },
  length: number,
  width: number,
  opts: {
    apronTenonLength: number;
    apronTenonWidth: number;
    apronTenonThick: number;
    apronWidth: number;
    legHeight: number;
    apronDropFromTop: number;
  },
) {
  const { apronTenonLength, apronTenonWidth, apronTenonThick, apronWidth, legHeight, apronDropFromTop } = opts;
  const yOffset = legHeight - apronWidth - apronDropFromTop;
  return [
    // 內側 X 方向榫眼（前後橫撐插入）
    {
      origin: { x: 0, y: yOffset, z: corner.z > 0 ? -1 : 1 },
      depth: apronTenonLength,
      length: apronTenonWidth,
      width: apronTenonThick,
      through: false,
    },
    // 內側 Z 方向榫眼（左右橫撐插入）
    {
      origin: { x: corner.x > 0 ? -1 : 1, y: yOffset, z: 0 },
      depth: apronTenonLength,
      length: apronTenonWidth,
      width: apronTenonThick,
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
