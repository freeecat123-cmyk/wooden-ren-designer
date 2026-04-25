import type {
  FurnitureDesign,
  FurnitureTemplate,
  OptionSpec,
  Part,
} from "@/lib/types";
import { getOption, opt } from "@/lib/types";

export const roundStoolOptions: OptionSpec[] = [
  { group: "top", type: "number", key: "seatThickness", label: "座板厚 (mm)", defaultValue: 25, min: 12, max: 60, step: 1, unit: "mm" },
  { group: "leg", type: "number", key: "legSize", label: "腳粗 (mm)", defaultValue: 30, min: 20, max: 80, step: 1, unit: "mm" },
  { group: "leg", type: "number", key: "legInset", label: "腳離邊 (mm)", defaultValue: 40, min: 20, max: 200, step: 5, unit: "mm", help: "腳中心離座板圓周的內縮量" },
  { group: "leg", type: "select", key: "legShape", label: "腳樣式", defaultValue: "tapered", choices: [
    { value: "box", label: "直腳（方料）" },
    { value: "tapered", label: "錐形腳（下方收窄）" },
  ] },
  { group: "apron", type: "checkbox", key: "withApron", label: "加橫撐", defaultValue: true, help: "腳之間用橫撐連結，結構穩固" },
  { group: "apron", type: "number", key: "apronWidth", label: "橫撐高 (mm)", defaultValue: 45, min: 25, max: 120, step: 5, unit: "mm" },
  { group: "apron", type: "number", key: "apronThickness", label: "橫撐厚 (mm)", defaultValue: 18, min: 10, max: 35, step: 1, unit: "mm" },
  { group: "apron", type: "number", key: "apronDropFromTop", label: "橫撐距座板 (mm)", defaultValue: 25, min: 0, max: 200, step: 5, unit: "mm" },
];

/**
 * 圓凳（round stool）— 圓座板 + 4 隻腳（內接於圓內）+ 4 條橫撐
 *
 * 尺寸：input.length = 直徑（input.width 自動 = 直徑，深度欄位忽略）
 * 預設 350×350×450mm（35cm 直徑、45cm 高）
 */
export const roundStool: FurnitureTemplate = (input): FurnitureDesign => {
  const { height, material } = input;
  const diameter = input.length;

  const o = roundStoolOptions;
  const seatThickness = getOption<number>(input, opt(o, "seatThickness"));
  const legSize = getOption<number>(input, opt(o, "legSize"));
  const legInset = getOption<number>(input, opt(o, "legInset"));
  const legShape = getOption<string>(input, opt(o, "legShape"));
  const withApron = getOption<boolean>(input, opt(o, "withApron"));
  const apronWidth = getOption<number>(input, opt(o, "apronWidth"));
  const apronThickness = getOption<number>(input, opt(o, "apronThickness"));
  const apronDropFromTop = getOption<number>(input, opt(o, "apronDropFromTop"));

  const radius = diameter / 2;
  const legHeight = height - seatThickness;
  // 4 隻腳於圓內接正方形的 4 個角，距中心 = (R - legInset) / sqrt(2)
  const cornerOffset = Math.max(legSize, (radius - legInset) / Math.SQRT2);

  // 圓座板（用 shape: round 渲染為圓盤）
  const seat: Part = {
    id: "seat",
    nameZh: "圓座板",
    material,
    grainDirection: "length",
    visible: { length: diameter, width: diameter, thickness: seatThickness },
    origin: { x: 0, y: legHeight, z: 0 },
    shape: { kind: "round" },
    tenons: [],
    mortises: [
      // 4 個盲榫眼接腳頂（圓座板下方四個內接位置）
      ...[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => ({
          origin: { x: sx * cornerOffset, y: 0, z: sz * cornerOffset },
          depth: Math.min(seatThickness * 0.6, 15),
          length: Math.round(legSize * 0.6),
          width: Math.round(legSize * 0.6),
          through: false,
        })),
      ),
    ],
  };

  // 4 隻腳
  const legs: Part[] = [-1, 1].flatMap((sx) =>
    [-1, 1].map((sz) => ({
      id: `leg-${sx < 0 ? "l" : "r"}${sz < 0 ? "f" : "b"}`,
      nameZh: `${sz < 0 ? "前" : "後"}${sx < 0 ? "左" : "右"}腳`,
      material,
      grainDirection: "length" as const,
      visible: { length: legSize, width: legSize, thickness: legHeight },
      origin: { x: sx * cornerOffset, y: 0, z: sz * cornerOffset },
      shape:
        legShape === "tapered"
          ? ({ kind: "tapered", bottomScale: 0.6 } as const)
          : undefined,
      tenons: [
        {
          position: "top" as const,
          type: "blind-tenon" as const,
          length: Math.min(seatThickness * 0.6, 15),
          width: Math.round(legSize * 0.6),
          thickness: Math.round(legSize * 0.6),
        },
      ],
      mortises: [],
    })),
  );

  const parts: Part[] = [seat, ...legs];

  // 4 條橫撐（兩兩腳之間）
  if (withApron) {
    const apronY = legHeight - apronWidth - apronDropFromTop;
    const apronSpan = 2 * cornerOffset - legSize; // 兩腳中心距離 - 腳粗
    const sides = [
      { id: "apron-front", nameZh: "前橫撐", axis: "x" as const, origin: { x: 0, z: -cornerOffset } },
      { id: "apron-back", nameZh: "後橫撐", axis: "x" as const, origin: { x: 0, z: cornerOffset } },
      { id: "apron-left", nameZh: "左橫撐", axis: "z" as const, origin: { x: -cornerOffset, z: 0 } },
      { id: "apron-right", nameZh: "右橫撐", axis: "z" as const, origin: { x: cornerOffset, z: 0 } },
    ];
    for (const s of sides) {
      parts.push({
        id: s.id,
        nameZh: s.nameZh,
        material,
        grainDirection: "length",
        visible: { length: apronSpan, width: apronWidth, thickness: apronThickness },
        origin: { x: s.origin.x, y: apronY, z: s.origin.z },
        rotation:
          s.axis === "z"
            ? { x: Math.PI / 2, y: Math.PI / 2, z: 0 }
            : { x: Math.PI / 2, y: 0, z: 0 },
        tenons: [
          { position: "start", type: "blind-tenon", length: Math.round(legSize * 0.5), width: Math.max(15, apronWidth - 12), thickness: Math.max(6, Math.min(apronThickness - 12, Math.round(legSize / 3))) },
          { position: "end", type: "blind-tenon", length: Math.round(legSize * 0.5), width: Math.max(15, apronWidth - 12), thickness: Math.max(6, Math.min(apronThickness - 12, Math.round(legSize / 3))) },
        ],
        mortises: [],
      });
    }
  }

  return {
    id: `round-stool-${diameter}x${height}`,
    category: "round-stool",
    nameZh: "圓凳",
    overall: { length: diameter, width: diameter, thickness: height },
    parts,
    defaultJoinery: "blind-tenon",
    primaryMaterial: material,
    notes: `圓凳直徑 ${diameter}mm × 高 ${height}mm，4 隻${legShape === "tapered" ? "錐形" : "方"}腳${withApron ? "含橫撐" : ""}。座板用實木拼板（>=300mm 直徑通常需 2-3 片拼）。`,
  };
};
