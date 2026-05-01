import type {
  FurnitureDesign,
  FurnitureTemplate,
  OptionSpec,
  Part,
} from "@/lib/types";
import { getOption, opt } from "@/lib/types";
import { validateRoundLegJoinery, applyStandardChecks, appendSuggestion } from "./_validators";
import { legShapeLabel, computeSplayGeometry, legEdgeOption, legEdgeStyleOption, legEdgeNote, legEdgeShape, stretcherEdgeOption, stretcherEdgeStyleOption, stretcherEdgeNote, topPanelPiecesOption, topPanelPiecesNote } from "./_helpers";

export const roundTeaTableOptions: OptionSpec[] = [
  { group: "top", type: "number", key: "topThickness", label: "桌面厚 (mm)", defaultValue: 25, min: 15, max: 40, step: 1, unit: "mm" },
  { group: "leg", type: "number", key: "legSize", label: "腳粗 (mm)", defaultValue: 40, min: 25, max: 80, step: 1, unit: "mm" },
  legEdgeOption("leg", 1),
  legEdgeStyleOption("leg"),
  stretcherEdgeOption("stretcher", 1),
  stretcherEdgeStyleOption("stretcher"),
  topPanelPiecesOption("top"),
  { group: "top", type: "checkbox", key: "withLazySusan", label: "中央旋轉盤", defaultValue: false, help: "中央加可旋轉小圓盤——需配 8-12 吋軸承", wide: true },
  { group: "top", type: "number", key: "lazySusanDiameter", label: "旋轉盤直徑 (mm)", defaultValue: 350, min: 200, max: 600, step: 25, dependsOn: { key: "withLazySusan", equals: true } },
  { group: "leg", type: "number", key: "legInset", label: "腳離邊 (mm)", defaultValue: 80, min: 30, max: 300, step: 10, unit: "mm", help: "腳中心離桌面圓周的內縮量" },
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
  { group: "leg", type: "number", key: "splayAngle", label: "外斜角度（°）", defaultValue: 6, min: 0, max: 20, step: 1, unit: "°", help: "整支腳外傾的角度，0=直立，max 20°。牙板會跟著腳一起斜同角度。僅外斜系列有效", dependsOn: { key: "legShape", oneOf: ["splayed-tapered", "splayed-round-taper-down", "splayed-round-taper-up"] } },
  { group: "apron", type: "number", key: "apronWidth", label: "牙板高 (mm)", defaultValue: 60, min: 30, max: 150, step: 5, unit: "mm" },
  { group: "apron", type: "number", key: "apronThickness", label: "牙板厚 (mm)", defaultValue: 20, min: 12, max: 35, step: 1, unit: "mm" },
  { group: "apron", type: "number", key: "apronDropFromTop", label: "牙板距桌面 (mm)", defaultValue: 12, min: 0, max: 200, step: 5, unit: "mm", help: "茶几較矮，10–15 視覺整體感較佳" },
  { group: "stretcher", type: "checkbox", key: "withLowerStretcher", label: "加下橫撐", defaultValue: false, help: "靠近地面的另一組橫撐連結 4 腳，更穩固" },
  { group: "stretcher", type: "number", key: "lowerStretcherWidth", label: "下橫撐高 (mm)", defaultValue: 35, min: 20, max: 100, step: 5, unit: "mm", dependsOn: { key: "withLowerStretcher", equals: true } },
  { group: "stretcher", type: "number", key: "lowerStretcherThickness", label: "下橫撐厚 (mm)", defaultValue: 18, min: 10, max: 30, step: 1, unit: "mm", dependsOn: { key: "withLowerStretcher", equals: true } },
  { group: "stretcher", type: "number", key: "lowerStretcherFromGround", label: "下橫撐離地 (mm)", defaultValue: 100, min: 30, max: 400, step: 10, unit: "mm", dependsOn: { key: "withLowerStretcher", equals: true } },
  { group: "top", type: "select", key: "topPattern", label: "桌面拼板花紋", defaultValue: "straight", choices: [
    { value: "straight", label: "直拼（一般）" },
    { value: "radial", label: "放射狀" },
    { value: "concentric", label: "同心環" },
    { value: "star-match", label: "星形對拼" },
  ] },
];

/**
 * 圓茶几（round tea / coffee table）— 圓桌面 + 4 隻腳 + 4 條牙板
 *
 * 尺寸：input.length = 直徑，預設 700×700×450mm（70cm 直徑、45cm 高）
 */
export const roundTeaTable: FurnitureTemplate = (input): FurnitureDesign => {
  const { height, material } = input;
  const diameter = input.length;

  const o = roundTeaTableOptions;
  const topThickness = getOption<number>(input, opt(o, "topThickness"));
  const legSize = getOption<number>(input, opt(o, "legSize"));
  const legEdge = getOption<number>(input, opt(o, "legEdge"));
  const legEdgeStyle = getOption<string>(input, opt(o, "legEdgeStyle"));
  const stretcherEdge = getOption<number>(input, opt(o, "stretcherEdge"));
  const stretcherEdgeStyle = getOption<string>(input, opt(o, "stretcherEdgeStyle"));
  const topPanelPieces = parseInt(getOption<string>(input, opt(o, "topPanelPieces"))) || 1;
  const withLazySusan = getOption<boolean>(input, opt(o, "withLazySusan"));
  const lazySusanDiameter = getOption<number>(input, opt(o, "lazySusanDiameter"));
  const legInset = getOption<number>(input, opt(o, "legInset"));
  const legShape = getOption<string>(input, opt(o, "legShape"));
  const apronWidth = getOption<number>(input, opt(o, "apronWidth"));
  const apronThickness = getOption<number>(input, opt(o, "apronThickness"));
  const apronDropFromTop = getOption<number>(input, opt(o, "apronDropFromTop"));
  const splayAngle = getOption<number>(input, opt(o, "splayAngle"));
  const withLowerStretcher = getOption<boolean>(input, opt(o, "withLowerStretcher"));
  const lowerStretcherWidth = getOption<number>(input, opt(o, "lowerStretcherWidth"));
  const lowerStretcherThickness = getOption<number>(input, opt(o, "lowerStretcherThickness"));
  const lowerStretcherFromGround = getOption<number>(input, opt(o, "lowerStretcherFromGround"));

  const radius = diameter / 2;
  const legHeight = height - topThickness;
  const cornerOffset = Math.max(legSize, (radius - legInset) / Math.SQRT2);
  const { splayMm, splayDx, splayDz } = computeSplayGeometry(legHeight, splayAngle);
  // 圓家具 apron 公用尺寸，腳跟 apron 共用以對得起來
  const apronY0 = legHeight - apronWidth - apronDropFromTop;
  const apronYCenter0 = apronY0 + apronWidth / 2;
  const apronTenonWidth = Math.max(20, Math.min(apronWidth - 12, legSize - 6));
  const apronTenonThick = Math.max(6, Math.min(apronThickness - 12, Math.round(legSize / 3)));
  const apronTenonLen = Math.round(legSize * 0.6);
  // 下橫撐 同樣公式
  const lsY0 = lowerStretcherFromGround;
  const lsYCenter0 = lsY0 + lowerStretcherWidth / 2;
  const lsTenonWidth = Math.max(20, Math.min(lowerStretcherWidth - 12, legSize - 6));
  const lsTenonThick = Math.max(6, Math.min(lowerStretcherThickness - 12, Math.round(legSize / 3)));
  const lsTenonLen = Math.round(legSize * 0.6);

  // 圓桌面
  const top: Part = {
    id: "top",
    nameZh: "圓桌面",
    material,
    grainDirection: "length",
    visible: { length: diameter, width: diameter, thickness: topThickness },
    origin: { x: 0, y: legHeight, z: 0 },
    shape: { kind: "round" },
    panelPieces: topPanelPieces,
    tenons: [],
    mortises: [
      ...[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => ({
          origin: { x: sx * cornerOffset, y: 0, z: sz * cornerOffset },
          depth: Math.min(topThickness * 0.6, 18),
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
          : legShape === "round"
            ? ({ kind: "round" } as const)
            : legShape === "round-taper-down"
              ? ({ kind: "round-tapered", bottomScale: 0.6 } as const)
              : legShape === "round-taper-up"
                ? ({ kind: "round-tapered", bottomScale: 1.4 } as const)
                : legShape === "shaker"
                  ? ({ kind: "shaker" } as const)
                  : legShape === "splayed-tapered"
                    ? ({ kind: "splayed-tapered", bottomScale: 0.6, dxMm: sx * splayDx, dzMm: sz * splayDz } as const)
                    : legShape === "splayed-round-taper-down"
                      ? ({ kind: "splayed-round-tapered", bottomScale: 0.6, dxMm: sx * splayDx, dzMm: sz * splayDz } as const)
                      : legShape === "splayed-round-taper-up"
                        ? ({ kind: "splayed-round-tapered", bottomScale: 1.4, dxMm: sx * splayDx, dzMm: sz * splayDz } as const)
                        : legEdgeShape(legEdge, legEdgeStyle),
      tenons: [
        {
          position: "top" as const,
          type: "blind-tenon" as const,
          length: Math.round(Math.min(topThickness * (2 / 3), topThickness - 6)),
          width: Math.round(legSize * 0.6),
          thickness: Math.round(legSize * 0.6),
        },
      ],
      mortises: [
        {
          origin: { x: 0, y: apronYCenter0, z: -sz * (legSize / 2) },
          depth: apronTenonLen,
          length: apronTenonWidth,
          width: apronTenonThick,
          through: false,
        },
        {
          origin: { x: -sx * (legSize / 2), y: apronYCenter0, z: 0 },
          depth: apronTenonLen,
          length: apronTenonWidth,
          width: apronTenonThick,
          through: false,
        },
        ...(withLowerStretcher
          ? [
              {
                origin: { x: 0, y: lsYCenter0, z: -sz * (legSize / 2) },
                depth: lsTenonLen,
                length: lsTenonWidth,
                width: lsTenonThick,
                through: false,
              },
              {
                origin: { x: -sx * (legSize / 2), y: lsYCenter0, z: 0 },
                depth: lsTenonLen,
                length: lsTenonWidth,
                width: lsTenonThick,
                through: false,
              },
            ]
          : []),
      ],
    })),
  );

  // 4 條牙板
  const apronY = apronY0;
  const isSplayed = legShape.startsWith("splayed-");
  // 圓家具腳對角線 splay，apron 在前/側視平面看到的 Z 斜率 = tan(α)/√2
  const tilt = isSplayed ? computeSplayGeometry(legHeight, splayAngle).apronTilt : 0;
  // 在 apron Y 中心位置算腳的真實中心——外斜時腳已從 corner 偏出去，
  // 榫頭要打在腳真正的中心，apron 才對齊（不會偏一側讓壁太薄爆掉）
  const apronYCenter = apronY + apronWidth / 2;
  const shiftFactor = legHeight > 0 ? 1 - apronYCenter / legHeight : 0;
  const apronSplayDx = isSplayed ? splayDx * shiftFactor : 0;
  const apronSplayDz = isSplayed ? splayDz * shiftFactor : 0;
  // 慣例：visible.length = 腳中心到腳中心（apron Y 的腳中心，不是頂端 corner）
  const apronSpan = 2 * (cornerOffset + apronSplayDx);
  // 簡化：apron 也斜 α 度（matches leg），中心對到腳在 apron Y center 的中心
  // 不做 trapezoid，apron 就是矩形 + tilt
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
    // 上下緣切斜面，貼桌面 / 地面
    shape: isSplayed
      ? ({
          kind: "apron-beveled" as const,
          bevelAngle: s.axis === "x" ? -s.sz * tilt : -s.sx * tilt,
        })
      : legEdgeShape(stretcherEdge, stretcherEdgeStyle),
    tenons: [
      { position: "start" as const, type: "shouldered-tenon" as const, length: apronTenonLen, width: apronTenonWidth, thickness: apronTenonThick },
      { position: "end" as const, type: "shouldered-tenon" as const, length: apronTenonLen, width: apronTenonWidth, thickness: apronTenonThick },
    ],
    mortises: [],
  }));

  // 4 條下橫撐——同邏輯，靠近地面
  const lowerStretchers: Part[] = [];
  if (withLowerStretcher) {
    const lsShiftFactor = legHeight > 0 ? 1 - lsYCenter0 / legHeight : 0;
    const lsSplayDx = isSplayed ? splayDx * lsShiftFactor : 0;
    const lsSplayDz = isSplayed ? splayDz * lsShiftFactor : 0;
    const lsSpan = 2 * (cornerOffset + lsSplayDx);
    const lsSides = [
      { id: "lower-stretcher-front", nameZh: "前下橫撐", axis: "x" as const, sx: 0, sz: -1, origin: { x: 0, z: -(cornerOffset + lsSplayDz) } },
      { id: "lower-stretcher-back", nameZh: "後下橫撐", axis: "x" as const, sx: 0, sz: 1, origin: { x: 0, z: cornerOffset + lsSplayDz } },
      { id: "lower-stretcher-left", nameZh: "左下橫撐", axis: "z" as const, sx: -1, sz: 0, origin: { x: -(cornerOffset + lsSplayDx), z: 0 } },
      { id: "lower-stretcher-right", nameZh: "右下橫撐", axis: "z" as const, sx: 1, sz: 0, origin: { x: cornerOffset + lsSplayDx, z: 0 } },
    ];
    for (const s of lsSides) {
      const bevelAngle = isSplayed
        ? s.axis === "x" ? -s.sz * tilt : -s.sx * tilt
        : 0;
      lowerStretchers.push({
        id: s.id,
        nameZh: s.nameZh,
        material,
        grainDirection: "length",
        visible: { length: lsSpan, width: lowerStretcherWidth, thickness: lowerStretcherThickness },
        origin: { x: s.origin.x, y: lsY0, z: s.origin.z },
        rotation: s.axis === "z"
          ? { x: Math.PI / 2, y: Math.PI / 2, z: s.sx * tilt }
          : { x: Math.PI / 2 + (-s.sz) * tilt, y: 0, z: 0 },
        shape: isSplayed ? { kind: "apron-beveled", bevelAngle } : legEdgeShape(stretcherEdge, stretcherEdgeStyle),
        tenons: [
          { position: "start", type: "blind-tenon", length: lsTenonLen, width: lsTenonWidth, thickness: lsTenonThick },
          { position: "end", type: "blind-tenon", length: lsTenonLen, width: lsTenonWidth, thickness: lsTenonThick },
        ],
        mortises: [],
      });
    }
  }

  const design: FurnitureDesign = {
    id: `round-tea-table-${diameter}x${height}`,
    category: "round-tea-table",
    nameZh: "圓茶几",
    overall: { length: diameter, width: diameter, thickness: height },
    parts: [
      top,
      ...legs,
      ...aprons,
      ...lowerStretchers,
      ...(withLazySusan
        ? [{
            id: "lazy-susan",
            nameZh: `旋轉盤 (${Math.min(lazySusanDiameter, diameter - 100)}mm)`,
            material,
            grainDirection: "length" as const,
            visible: { length: Math.min(lazySusanDiameter, diameter - 100), width: Math.min(lazySusanDiameter, diameter - 100), thickness: 18 },
            origin: { x: 0, y: legHeight + 20, z: 0 },
            shape: { kind: "round" as const },
            tenons: [],
            mortises: [],
          }]
        : []),
    ],
    defaultJoinery: "shouldered-tenon",
    primaryMaterial: material,
    notes: `圓茶几直徑 ${diameter}mm × 高 ${height}mm，4 隻${legShapeLabel(legShape)}含牙板。${legEdgeNote(legEdge, legEdgeStyle)}${stretcherEdgeNote(stretcherEdge, stretcherEdgeStyle)}${topPanelPiecesNote(topPanelPieces, diameter)}${withLazySusan ? ` 中央旋轉盤 ${Math.min(lazySusanDiameter, diameter - 100)}mm，配 8-12 吋軸承一組。` : ""}${(() => { const tp = getOption<string>(input, opt(o, "topPattern")); return tp === "radial" ? " 桌面採放射狀拼板。" : tp === "concentric" ? " 桌面採同心環拼板。" : tp === "star-match" ? " 桌面採星形對拼。" : ""; })()}`,
  };
  const w = validateRoundLegJoinery(design);
  if (w.length) design.warnings = [...(design.warnings ?? []), ...w];
  applyStandardChecks(design, {
    minLength: 400, minWidth: 400, minHeight: 250,
    maxLength: 1100, maxWidth: 1100, maxHeight: 500,
  });
  if (input.length > 1100 || input.height > 500) {
    appendSuggestion(design, {
      text: `直徑 ${input.length}mm × 高 ${input.height}mm 已不算茶几——圓餐桌支援獨柱 / 端梁等大型結構。`,
      suggestedCategory: "round-table",
      presetParams: { length: input.length, width: input.length, height: Math.max(input.height, 700), material: input.material },
    });
  }
  return design;
};
