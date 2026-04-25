import type {
  FurnitureDesign,
  FurnitureTemplate,
  OptionSpec,
  Part,
} from "@/lib/types";
import { getOption, opt } from "@/lib/types";
import { validateRoundLegJoinery } from "./_validators";

export const roundTableOptions: OptionSpec[] = [
  { group: "top", type: "number", key: "topThickness", label: "桌面厚 (mm)", defaultValue: 28, min: 18, max: 50, step: 1, unit: "mm" },
  { group: "leg", type: "number", key: "legSize", label: "腳粗 (mm)", defaultValue: 60, min: 30, max: 120, step: 1, unit: "mm" },
  { group: "leg", type: "number", key: "legInset", label: "腳離邊 (mm)", defaultValue: 150, min: 50, max: 400, step: 10, unit: "mm", help: "腳中心離桌面圓周的內縮量。內縮越大坐得越進去（膝蓋空間越大）" },
  { group: "leg", type: "select", key: "legShape", label: "腳樣式", defaultValue: "tapered", choices: [
    { value: "box", label: "直腳（方料）" },
    { value: "tapered", label: "方錐腳（方料下方收窄）" },
    { value: "round", label: "圓腳（直圓柱）" },
    { value: "round-taper-down", label: "圓錐腳（上粗下細）" },
    { value: "round-taper-up", label: "倒圓錐腳（上細下粗）" },
    { value: "shaker", label: "夏克風腳（方頂 + 圓錐）" },
    { value: "splayed-tapered", label: "外斜方錐腳（整支外傾）" },
    { value: "splayed-round-taper-down", label: "外斜圓錐腳（外傾 + 上粗下細）" },
    { value: "splayed-round-taper-up", label: "外斜倒圓錐腳（外傾 + 上細下粗）" },
  ] },
  { group: "leg", type: "number", key: "splayAngle", label: "外斜角度（°）", defaultValue: 5, min: 0, max: 20, step: 1, unit: "°", help: "整支腳外傾的角度，0=直立。僅外斜系列有效（餐桌 5° 內最自然，避免絆腳）" },
  { group: "apron", type: "number", key: "apronWidth", label: "牙板高 (mm)", defaultValue: 100, min: 50, max: 200, step: 5, unit: "mm" },
  { group: "apron", type: "number", key: "apronThickness", label: "牙板厚 (mm)", defaultValue: 25, min: 15, max: 40, step: 1, unit: "mm" },
  { group: "apron", type: "number", key: "apronDropFromTop", label: "牙板距桌面 (mm)", defaultValue: 30, min: 0, max: 200, step: 5, unit: "mm" },
];

/**
 * 圓餐桌（round dining table）— 圓桌面 + 4 隻腳 + 4 條牙板
 *
 * 尺寸：input.length = 直徑，預設 1000×1000×750mm（100cm 直徑、75cm 桌高）
 * 桌面 >= 900mm 通常需 4-5 片實木拼板（避免單片過寬翹曲）。
 */
export const roundTable: FurnitureTemplate = (input): FurnitureDesign => {
  const { height, material } = input;
  const diameter = input.length;

  const o = roundTableOptions;
  const topThickness = getOption<number>(input, opt(o, "topThickness"));
  const legSize = getOption<number>(input, opt(o, "legSize"));
  const legInset = getOption<number>(input, opt(o, "legInset"));
  const legShape = getOption<string>(input, opt(o, "legShape"));
  const apronWidth = getOption<number>(input, opt(o, "apronWidth"));
  const apronThickness = getOption<number>(input, opt(o, "apronThickness"));
  const apronDropFromTop = getOption<number>(input, opt(o, "apronDropFromTop"));
  const splayAngle = getOption<number>(input, opt(o, "splayAngle"));

  const radius = diameter / 2;
  const legHeight = height - topThickness;
  const cornerOffset = Math.max(legSize, (radius - legInset) / Math.SQRT2);
  const splayMm = legHeight * Math.tan((splayAngle * Math.PI) / 180);
  const splayDx = splayMm / Math.SQRT2;
  const splayDz = splayMm / Math.SQRT2;

  // 圓桌面
  const top: Part = {
    id: "top",
    nameZh: "圓桌面",
    material,
    grainDirection: "length",
    visible: { length: diameter, width: diameter, thickness: topThickness },
    origin: { x: 0, y: legHeight, z: 0 },
    shape: { kind: "round" },
    tenons: [],
    mortises: [
      ...[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => ({
          origin: { x: sx * cornerOffset, y: 0, z: sz * cornerOffset },
          depth: Math.min(topThickness * 0.6, 20),
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
          ? ({ kind: "tapered", bottomScale: 0.55 } as const)
          : legShape === "round"
            ? ({ kind: "round" } as const)
            : legShape === "round-taper-down"
              ? ({ kind: "round-tapered", bottomScale: 0.55 } as const)
              : legShape === "round-taper-up"
                ? ({ kind: "round-tapered", bottomScale: 1.4 } as const)
                : legShape === "shaker"
                  ? ({ kind: "shaker" } as const)
                  : legShape === "splayed-tapered"
                    ? ({ kind: "splayed-tapered", bottomScale: 0.55, dxMm: sx * splayDx, dzMm: sz * splayDz } as const)
                    : legShape === "splayed-round-taper-down"
                      ? ({ kind: "splayed-round-tapered", bottomScale: 0.55, dxMm: sx * splayDx, dzMm: sz * splayDz } as const)
                      : legShape === "splayed-round-taper-up"
                        ? ({ kind: "splayed-round-tapered", bottomScale: 1.4, dxMm: sx * splayDx, dzMm: sz * splayDz } as const)
                        : undefined,
      tenons: [
        {
          position: "top" as const,
          type: "blind-tenon" as const,
          length: Math.min(topThickness * 0.6, 20),
          width: Math.round(legSize * 0.6),
          thickness: Math.round(legSize * 0.6),
        },
      ],
      mortises: [],
    })),
  );

  // 4 條牙板（餐桌結構承重，用帶肩榫）
  const apronY = legHeight - apronWidth - apronDropFromTop;
  const isSplayed = legShape.startsWith("splayed-");
  const tilt = isSplayed ? (splayAngle * Math.PI) / 180 : 0;
  // 在 apron Y 中心位置算腳的真實中心——外斜時腳已從 corner 偏出去，
  // 榫頭要打在腳真正的中心，apron 才對齊（不會偏一側讓壁太薄爆掉）
  const apronYCenter = apronY + apronWidth / 2;
  const shiftFactor = legHeight > 0 ? 1 - apronYCenter / legHeight : 0;
  const apronSplayDx = isSplayed ? splayDx * shiftFactor : 0;
  const apronSplayDz = isSplayed ? splayDz * shiftFactor : 0;
  // 慣例：visible.length = 腳中心到腳中心（apron Y 的腳中心，不是頂端 corner）
  const apronSpan = 2 * (cornerOffset + Math.max(apronSplayDx, apronSplayDz));
  const aprons: Part[] = [
    { id: "apron-front", nameZh: "前牙板", axis: "x" as const, sx: 0, sz: -1, origin: { x: 0, z: -(cornerOffset + apronSplayDz) } },
    { id: "apron-back", nameZh: "後牙板", axis: "x" as const, sx: 0, sz: 1, origin: { x: 0, z: cornerOffset + apronSplayDz } },
    { id: "apron-left", nameZh: "左牙板", axis: "z" as const, sx: -1, sz: 0, origin: { x: -(cornerOffset + apronSplayDx), z: 0 } },
    { id: "apron-right", nameZh: "右牙板", axis: "z" as const, sx: 1, sz: 0, origin: { x: cornerOffset + apronSplayDx, z: 0 } },
  ].map((s) => ({
    id: s.id,
    nameZh: s.nameZh,
    material,
    grainDirection: "length" as const,
    visible: { length: apronSpan, width: apronWidth, thickness: apronThickness },
    origin: { x: s.origin.x, y: apronY, z: s.origin.z },
    // 外斜模式時牙板跟著腳一起斜（同角度）
    rotation:
      s.axis === "z"
        ? { x: Math.PI / 2, y: Math.PI / 2, z: s.sx * tilt }
        : { x: Math.PI / 2 + (-s.sz) * tilt, y: 0, z: 0 },
    tenons: [
      { position: "start" as const, type: "shouldered-tenon" as const, length: Math.round(legSize * 0.6), width: Math.max(30, apronWidth - 12), thickness: Math.max(6, Math.min(apronThickness - 12, Math.round(legSize / 3))) },
      { position: "end" as const, type: "shouldered-tenon" as const, length: Math.round(legSize * 0.6), width: Math.max(30, apronWidth - 12), thickness: Math.max(6, Math.min(apronThickness - 12, Math.round(legSize / 3))) },
    ],
    mortises: [],
  }));

  const design: FurnitureDesign = {
    id: `round-table-${diameter}x${height}`,
    category: "round-table",
    nameZh: "圓餐桌",
    overall: { length: diameter, width: diameter, thickness: height },
    parts: [top, ...legs, ...aprons],
    defaultJoinery: "shouldered-tenon",
    primaryMaterial: material,
    notes: `圓餐桌直徑 ${diameter}mm × 高 ${height}mm，4 隻${legShape === "tapered" ? "錐形" : "方"}腳含帶肩牙板。桌面通常需 ${diameter >= 1100 ? "5" : diameter >= 900 ? "4" : "3"} 片實木拼板（每片寬 150-200mm，避免單片過寬翹曲）。`,
  };
  const w = validateRoundLegJoinery(design);
  if (w.length) design.warnings = [...(design.warnings ?? []), ...w];
  return design;
};
