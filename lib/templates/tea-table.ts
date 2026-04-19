import type {
  FurnitureDesign,
  FurnitureTemplate,
  OptionSpec,
  Part,
} from "@/lib/types";
import { getOption } from "@/lib/types";
import { corners } from "./_helpers";

export const teaTableOptions: OptionSpec[] = [
  { type: "number", key: "legSize", label: "桌腳粗 (mm)", defaultValue: 40, min: 30, max: 60, step: 2 },
  { type: "number", key: "topThickness", label: "桌面厚 (mm)", defaultValue: 25, min: 20, max: 40, step: 1 },
  { type: "number", key: "upperApronWidth", label: "上橫撐高 (mm)", defaultValue: 70, min: 50, max: 100, step: 5 },
  { type: "number", key: "shelfFloorOffset", label: "下棚板離地 (mm)", defaultValue: 80, min: 30, max: 200, step: 10 },
  { type: "checkbox", key: "hasLowerShelf", label: "下棚板", defaultValue: true, help: "關閉則只保留下橫撐" },
];

/**
 * 茶几（tea-table）
 *
 * 結構：
 *  - 1 × 桌面板（top panel）
 *  - 4 × 桌腳（legs）
 *  - 4 × 上橫撐（upper aprons），桌面下方一圈
 *  - 4 × 下橫撐（lower stretchers），距地約 80mm
 *  - 1 × 下棚板（lower shelf），四邊出舌嵌入下橫撐凹槽
 *
 * 接合：
 *  - 桌腳 ↔ 桌面：通榫（through tenon）
 *  - 上橫撐 / 下橫撐 ↔ 桌腳：半榫（blind tenon）
 *  - 下棚板 ↔ 下橫撐：四邊出舌+槽（tongue and groove）
 */
export const teaTable: FurnitureTemplate = (input): FurnitureDesign => {
  const { length, width, height, material } = input;

  const legSize = getOption<number>(input, teaTableOptions[0]);
  const topThickness = getOption<number>(input, teaTableOptions[1]);
  const upperApronWidth = getOption<number>(input, teaTableOptions[2]);
  const stretcherFloorOffset = getOption<number>(input, teaTableOptions[3]);
  const hasLowerShelf = getOption<boolean>(input, teaTableOptions[4]);
  const upperApronThickness = 22;
  const lowerStretcherWidth = 50;
  const lowerStretcherThickness = 22;
  const shelfThickness = 18;
  const shelfTongueLen = 8;

  const legTopTenonLen = topThickness;
  const apronTenonLen = Math.round(legSize * 0.65);
  const stretcherTenonLen = apronTenonLen;

  const legHeight = height - topThickness;
  const upperApronY = legHeight - upperApronWidth - 20;

  const cornerPts = corners(length, width, legSize);

  // ----- 桌面板 -----
  const topPanel: Part = {
    id: "top",
    nameZh: "桌面板",
    material,
    grainDirection: "length",
    visible: { length, width, thickness: topThickness },
    origin: { x: 0, y: legHeight, z: 0 },
    tenons: [],
    mortises: cornerPts.map((c) => ({
      origin: { x: c.x, y: 0, z: c.z },
      depth: topThickness,
      length: legSize,
      width: legSize,
      through: true,
    })),
  };

  // ----- 4 桌腳 -----
  const legs: Part[] = cornerPts.map((c, i) => ({
    id: `leg-${i + 1}`,
    nameZh: `桌腳 ${i + 1}`,
    material,
    grainDirection: "length",
    visible: { length: legSize, width: legSize, thickness: legHeight },
    origin: { x: c.x, y: 0, z: c.z },
    tenons: [
      {
        position: "top",
        type: "through-tenon",
        length: legTopTenonLen,
        width: legSize,
        thickness: legSize,
      },
    ],
    mortises: [
      // 上橫撐 X 向
      {
        origin: { x: 0, y: upperApronY, z: c.z > 0 ? -1 : 1 },
        depth: apronTenonLen,
        length: upperApronWidth - 10,
        width: upperApronThickness - 5,
        through: false,
      },
      // 上橫撐 Z 向
      {
        origin: { x: c.x > 0 ? -1 : 1, y: upperApronY, z: 0 },
        depth: apronTenonLen,
        length: upperApronWidth - 10,
        width: upperApronThickness - 5,
        through: false,
      },
      // 下橫撐 X 向
      {
        origin: { x: 0, y: stretcherFloorOffset, z: c.z > 0 ? -1 : 1 },
        depth: stretcherTenonLen,
        length: lowerStretcherWidth - 8,
        width: lowerStretcherThickness - 5,
        through: false,
      },
      // 下橫撐 Z 向
      {
        origin: { x: c.x > 0 ? -1 : 1, y: stretcherFloorOffset, z: 0 },
        depth: stretcherTenonLen,
        length: lowerStretcherWidth - 8,
        width: lowerStretcherThickness - 5,
        through: false,
      },
    ],
  }));

  // ----- 上橫撐 / 下橫撐 共用建構 -----
  const apronInnerSpan = {
    x: length - legSize,
    z: width - legSize,
  };

  const upperAprons: Part[] = makeApronRing({
    idPrefix: "upper-apron",
    nameZhPrefix: "上橫撐",
    span: apronInnerSpan,
    legSize,
    overallLength: length,
    overallWidth: width,
    material,
    apronWidth: upperApronWidth,
    apronThickness: upperApronThickness,
    tenonLength: apronTenonLen,
    y: upperApronY,
    extraMortises: () => [],
  });

  const lowerStretchers: Part[] = makeApronRing({
    idPrefix: "lower-stretcher",
    nameZhPrefix: "下橫撐",
    span: apronInnerSpan,
    legSize,
    overallLength: length,
    overallWidth: width,
    material,
    apronWidth: lowerStretcherWidth,
    apronThickness: lowerStretcherThickness,
    tenonLength: stretcherTenonLen,
    y: stretcherFloorOffset,
    // 內側面開長槽，棚板舌頭嵌入
    extraMortises: (visibleLength) => [
      {
        origin: { x: 0, y: 0, z: 0 },
        depth: shelfTongueLen,
        length: visibleLength - 20,
        width: shelfThickness + 1,
        through: false,
      },
    ],
  });

  // ----- 下棚板 -----
  const shelfLength = length - 2 * legSize - 4;
  const shelfWidth = width - 2 * legSize - 4;
  const shelfY =
    stretcherFloorOffset + lowerStretcherWidth / 2 - shelfThickness / 2;

  const lowerShelf: Part = {
    id: "shelf",
    nameZh: "下棚板",
    material,
    grainDirection: "length",
    visible: {
      length: shelfLength,
      width: shelfWidth,
      thickness: shelfThickness,
    },
    origin: { x: 0, y: shelfY, z: 0 },
    tenons: [
      {
        position: "start",
        type: "tongue-and-groove",
        length: shelfTongueLen,
        width: shelfWidth,
        thickness: shelfThickness,
      },
      {
        position: "end",
        type: "tongue-and-groove",
        length: shelfTongueLen,
        width: shelfWidth,
        thickness: shelfThickness,
      },
      {
        position: "left",
        type: "tongue-and-groove",
        length: shelfTongueLen,
        width: shelfLength,
        thickness: shelfThickness,
      },
      {
        position: "right",
        type: "tongue-and-groove",
        length: shelfTongueLen,
        width: shelfLength,
        thickness: shelfThickness,
      },
    ],
    mortises: [],
  };

  return {
    id: `tea-table-${length}x${width}x${height}`,
    category: "tea-table",
    nameZh: "茶几",
    overall: { length, width, thickness: height },
    parts: hasLowerShelf
      ? [topPanel, ...legs, ...upperAprons, ...lowerStretchers, lowerShelf]
      : [topPanel, ...legs, ...upperAprons, ...lowerStretchers],
    defaultJoinery: "blind-tenon",
    primaryMaterial: material,
    notes:
      "桌面與桌腳通榫；上下橫撐與桌腳半榫；下棚板四邊出舌嵌入下橫撐長槽。",
  };
};

// ----- helpers -----

interface ApronRingOpts {
  idPrefix: string;
  nameZhPrefix: string;
  span: { x: number; z: number };
  legSize: number;
  overallLength: number;
  overallWidth: number;
  material: Part["material"];
  apronWidth: number;
  apronThickness: number;
  tenonLength: number;
  y: number;
  extraMortises: (visibleLength: number) => Part["mortises"];
}

function makeApronRing(o: ApronRingOpts): Part[] {
  const sides = [
    {
      key: "front",
      nameZh: "前",
      visibleLength: o.span.x,
      axis: "x" as const,
      origin: { x: 0, z: -(o.overallWidth / 2 - o.legSize / 2) },
    },
    {
      key: "back",
      nameZh: "後",
      visibleLength: o.span.x,
      axis: "x" as const,
      origin: { x: 0, z: o.overallWidth / 2 - o.legSize / 2 },
    },
    {
      key: "left",
      nameZh: "左",
      visibleLength: o.span.z,
      axis: "z" as const,
      origin: { x: -(o.overallLength / 2 - o.legSize / 2), z: 0 },
    },
    {
      key: "right",
      nameZh: "右",
      visibleLength: o.span.z,
      axis: "z" as const,
      origin: { x: o.overallLength / 2 - o.legSize / 2, z: 0 },
    },
  ];

  return sides.map((s) => ({
    id: `${o.idPrefix}-${s.key}`,
    nameZh: `${s.nameZh}${o.nameZhPrefix}`,
    material: o.material,
    grainDirection: "length",
    visible: {
      length: s.visibleLength,
      width: o.apronWidth,
      thickness: o.apronThickness,
    },
    origin: { x: s.origin.x, y: o.y, z: s.origin.z },
    rotation: s.axis === "z"
      ? { x: Math.PI / 2, y: Math.PI / 2, z: 0 }
      : { x: Math.PI / 2, y: 0, z: 0 },
    tenons: [
      {
        position: "start",
        type: "blind-tenon",
        length: o.tenonLength,
        width: o.apronWidth - 10,
        thickness: o.apronThickness - 5,
      },
      {
        position: "end",
        type: "blind-tenon",
        length: o.tenonLength,
        width: o.apronWidth - 10,
        thickness: o.apronThickness - 5,
      },
    ],
    mortises: o.extraMortises(s.visibleLength),
  }));
}
