import type {
  FurnitureDesign,
  FurnitureTemplate,
  OptionSpec,
  Part,
} from "@/lib/types";
import { getOption, opt } from "@/lib/types";
import { validateRoundLegJoinery, applyStandardChecks, appendSuggestion } from "./_validators";
import { legShapeLabel, computeSplayGeometry, seatEdgeOption, seatEdgeStyleOption, seatEdgeNote, legEdgeOption, legEdgeStyleOption, legEdgeNote, legEdgeShape, stretcherEdgeOption, stretcherEdgeStyleOption, stretcherEdgeNote, parseSeatChamferMm, parseLegChamferMm } from "./_helpers";

export const roundStoolOptions: OptionSpec[] = [
  { group: "top", type: "number", key: "seatThickness", label: "座板厚 (mm)", defaultValue: 25, min: 12, max: 60, step: 1, unit: "mm" },
  seatEdgeOption("top", 5),
  seatEdgeStyleOption("top"),
  legEdgeOption("leg", 1),
  legEdgeStyleOption("leg"),
  stretcherEdgeOption("stretcher", 1),
  stretcherEdgeStyleOption("stretcher"),
  { group: "leg", type: "number", key: "legSize", label: "腳粗 (mm)", defaultValue: 30, min: 20, max: 80, step: 1, unit: "mm" },
  { group: "leg", type: "number", key: "legInset", label: "腳離邊 (mm)", defaultValue: 40, min: 20, max: 200, step: 5, unit: "mm", help: "腳中心離座板圓周的內縮量" },
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
  { group: "leg", type: "number", key: "splayAngle", label: "外斜角度（°）", defaultValue: 8, min: 0, max: 20, step: 1, unit: "°", help: "整支腳外傾的角度，0=直立，max 20°。牙板/橫撐會跟著腳一起斜同角度。僅外斜系列有效", dependsOn: { key: "legShape", oneOf: ["splayed-tapered", "splayed-round-taper-down", "splayed-round-taper-up"] } },
  { group: "apron", type: "checkbox", key: "withApron", label: "加上橫撐", defaultValue: true, help: "座板下方接腳的橫撐，結構穩固" },
  { group: "apron", type: "number", key: "apronWidth", label: "上橫撐高 (mm)", defaultValue: 45, min: 25, max: 120, step: 5, unit: "mm", dependsOn: { key: "withApron", equals: true } },
  { group: "apron", type: "number", key: "apronThickness", label: "上橫撐厚 (mm)", defaultValue: 18, min: 10, max: 35, step: 1, unit: "mm", dependsOn: { key: "withApron", equals: true } },
  { group: "apron", type: "number", key: "apronDropFromTop", label: "上橫撐距座板 (mm)", defaultValue: 25, min: 0, max: 200, step: 5, unit: "mm", dependsOn: { key: "withApron", equals: true } },
  { group: "stretcher", type: "checkbox", key: "withLowerStretcher", label: "加下橫撐", defaultValue: false, help: "靠近地面的另一組橫撐，更耐絆腳但料較費" },
  { group: "stretcher", type: "number", key: "lowerStretcherWidth", label: "下橫撐高 (mm)", defaultValue: 30, min: 20, max: 100, step: 5, unit: "mm", dependsOn: { key: "withLowerStretcher", equals: true } },
  { group: "stretcher", type: "number", key: "lowerStretcherThickness", label: "下橫撐厚 (mm)", defaultValue: 16, min: 10, max: 30, step: 1, unit: "mm", dependsOn: { key: "withLowerStretcher", equals: true } },
  { group: "stretcher", type: "number", key: "lowerStretcherFromGround", label: "下橫撐離地 (mm)", defaultValue: 100, min: 30, max: 400, step: 10, unit: "mm", help: "下橫撐底面距離地面的高度", dependsOn: { key: "withLowerStretcher", equals: true } },
  { group: "stretcher", type: "number", key: "lowerStretcherStaggerMm", label: "2 對錯開 (mm)", defaultValue: 0, min: 0, max: 200, step: 5, unit: "mm", help: "左右一對比前後一對抬高的量，避免兩對橫撐在腳上的榫眼重疊。0 = 同高（榫頭會撞）；建議 ≥ lowerStretcherThickness", dependsOn: { key: "withLowerStretcher", equals: true } },
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
  const seatEdge = getOption<string>(input, opt(o, "seatEdge"));
  const seatEdgeStyle = getOption<string>(input, opt(o, "seatEdgeStyle"));
  const legEdge = getOption<number>(input, opt(o, "legEdge"));
  const legEdgeStyle = getOption<string>(input, opt(o, "legEdgeStyle"));
  const stretcherEdge = getOption<number>(input, opt(o, "stretcherEdge"));
  const stretcherEdgeStyle = getOption<string>(input, opt(o, "stretcherEdgeStyle"));
  const legSize = getOption<number>(input, opt(o, "legSize"));
  const legInset = getOption<number>(input, opt(o, "legInset"));
  const legShape = getOption<string>(input, opt(o, "legShape"));
  const withApron = getOption<boolean>(input, opt(o, "withApron"));
  const apronWidth = getOption<number>(input, opt(o, "apronWidth"));
  const apronThickness = getOption<number>(input, opt(o, "apronThickness"));
  const apronDropFromTop = getOption<number>(input, opt(o, "apronDropFromTop"));
  const splayAngle = getOption<number>(input, opt(o, "splayAngle"));
  const withLowerStretcher = getOption<boolean>(input, opt(o, "withLowerStretcher"));
  const lowerStretcherWidth = getOption<number>(input, opt(o, "lowerStretcherWidth"));
  const lowerStretcherThickness = getOption<number>(input, opt(o, "lowerStretcherThickness"));
  const lowerStretcherFromGround = getOption<number>(input, opt(o, "lowerStretcherFromGround"));
  const lowerStretcherStaggerMm = getOption<number>(input, opt(o, "lowerStretcherStaggerMm"));

  const radius = diameter / 2;
  const legHeight = height - seatThickness;
  // 4 隻腳於圓內接正方形的 4 個角，距中心 = (R - legInset) / sqrt(2)
  const cornerOffset = Math.max(legSize, (radius - legInset) / Math.SQRT2);
  // 外斜：底部偏移總長 = legHeight × tan(angle)，方向沿腳對角線（45°）外推
  const { splayMm, splayDx, splayDz } = computeSplayGeometry(legHeight, splayAngle);

  // 圓座板（shape: round；seatEdge > 0 時頂面外緣加倒角）
  const seatChamferMm = parseSeatChamferMm(seatEdge);
  const seat: Part = {
    id: "seat",
    nameZh: "圓座板",
    material,
    grainDirection: "length",
    visible: { length: diameter, width: diameter, thickness: seatThickness },
    origin: { x: 0, y: legHeight, z: 0 },
    shape:
      seatChamferMm > 0
        ? {
            kind: "round",
            chamferMm: seatChamferMm,
            chamferStyle: seatEdgeStyle === "rounded" ? "rounded" : "chamfered",
          }
        : { kind: "round" },
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

  // 4 隻腳——榫眼依上下橫撐動態加
  // 上橫撐 中心 Y + tenon 規格（腳跟 apron 共用）
  const apronY0 = legHeight - apronWidth - apronDropFromTop;
  const apronYCenter0 = apronY0 + apronWidth / 2;
  // 圓腳 tenon 寬度上限：legSize - 6（兩側留 3mm 木）避免 tenon 比腳直徑寬
  const apronTenonWidth = Math.max(15, Math.min(apronWidth - 12, legSize - 6));
  const apronTenonThick = Math.max(6, Math.min(apronThickness - 12, Math.round(legSize / 3)));
  const apronTenonLen = Math.round(legSize * 0.5);
  // 下橫撐 同樣公式（用 lowerStretcher* 數值）
  // 2 對錯開：X 軸（前/後）那對保持 lowerStretcherFromGround，Z 軸（左/右）那對抬高 staggerMm。
  // 對應的 leg mortise Y 也要分開，否則榫眼還是會撞。
  const lsY0 = lowerStretcherFromGround;
  const lsYCenter0 = lsY0 + lowerStretcherWidth / 2;
  const lsY0_z = lsY0 + lowerStretcherStaggerMm;
  const lsYCenter0_z = lsY0_z + lowerStretcherWidth / 2;
  const lsTenonWidth = Math.max(15, Math.min(lowerStretcherWidth - 12, legSize - 6));
  const lsTenonThick = Math.max(6, Math.min(lowerStretcherThickness - 12, Math.round(legSize / 3)));
  const lsTenonLen = Math.round(legSize * 0.5);

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
          ? ({
              kind: "tapered",
              bottomScale: 0.6,
              chamferMm: parseLegChamferMm(legEdge),
              chamferStyle: legEdgeStyle === "rounded" ? "rounded" : "chamfered",
            } as const)
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
          length: Math.round(Math.min(seatThickness * (2 / 3), seatThickness - 6)),
          width: Math.round(legSize * 0.6),
          thickness: Math.round(legSize * 0.6),
        },
      ],
      // 上下橫撐各自加 X + Z 軸 mortise；沒開的不加
      mortises: [
        ...(withApron
          ? [
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
            ]
          : []),
        ...(withLowerStretcher
          ? [
              // X 軸下橫撐（前/後對）的榫眼，留在 lsYCenter0
              {
                origin: { x: 0, y: lsYCenter0, z: -sz * (legSize / 2) },
                depth: lsTenonLen,
                length: lsTenonWidth,
                width: lsTenonThick,
                through: false,
              },
              // Z 軸下橫撐（左/右對）的榫眼抬高 staggerMm
              {
                origin: { x: -sx * (legSize / 2), y: lsYCenter0_z, z: 0 },
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

  const parts: Part[] = [seat, ...legs];

  // 4 條橫撐（兩兩腳之間）
  if (withApron) {
    const apronY = apronY0;
    // 外斜模式時 apron 也跟著腳一起斜
    // 注意：圓家具腳對角線 splay，腳在「正視/側視」這個平面的 Z 投影斜率
    // = splayMm/legHeight = tan(α)/√2，不是 tan(α) 本身
    // 所以 apron 的 tilt 應該是 arctan(tan(α)/√2)，不是 α
    const isSplayed = legShape.startsWith("splayed-");
    const tilt = isSplayed ? computeSplayGeometry(legHeight, splayAngle).apronTilt : 0;
    // 在 apron Y 中心位置算腳的真實中心——外斜時腳已從 corner 偏出去，
    // 榫頭要打在腳真正的中心，apron 才對齊（不會偏一側讓壁太薄爆掉）
    const apronYCenter = apronY + apronWidth / 2;
    const shiftFactor = legHeight > 0 ? 1 - apronYCenter / legHeight : 0;
    const apronSplayDx = isSplayed ? splayDx * shiftFactor : 0;
    const apronSplayDz = isSplayed ? splayDz * shiftFactor : 0;
    // butt-joint 慣例：visible.length 兩端剛好頂在腳的內側面
    // = 2 × (cornerOffset + splay) - legSize（每端各內縮 legSize/2）
    const apronSpan = 2 * (cornerOffset + apronSplayDx) - legSize;
    // 簡化：apron 也斜 α 度（matches leg），中心對到腳在 apron Y center 的中心
    // 不再做 trapezoid，apron 就是矩形 + tilt
    const sides = [
      { id: "apron-front", nameZh: "前橫撐", axis: "x" as const, sx: 0, sz: -1, origin: { x: 0, z: -(cornerOffset + apronSplayDz) } },
      { id: "apron-back", nameZh: "後橫撐", axis: "x" as const, sx: 0, sz: 1, origin: { x: 0, z: cornerOffset + apronSplayDz } },
      { id: "apron-left", nameZh: "左橫撐", axis: "z" as const, sx: -1, sz: 0, origin: { x: -(cornerOffset + apronSplayDx), z: 0 } },
      { id: "apron-right", nameZh: "右橫撐", axis: "z" as const, sx: 1, sz: 0, origin: { x: cornerOffset + apronSplayDx, z: 0 } },
    ];
    for (const s of sides) {
      // X 軸 apron（前後）：tilt = -sz * α 加到 X 軸 rotation；底部往 sz 方向斜
      // Z 軸 apron（左右）：tilt = +sx * α 加到 Z 軸 rotation；底部往 sx 方向斜
      const rotation =
        s.axis === "z"
          ? { x: Math.PI / 2, y: Math.PI / 2, z: s.sx * tilt }
          : { x: Math.PI / 2 + (-s.sz) * tilt, y: 0, z: 0 };
      // 上下緣切斜面，貼椅面 / 地面。bevelAngle = 繞 local X 軸的補償旋轉
      const bevelAngle = isSplayed
        ? s.axis === "x" ? -s.sz * tilt : -s.sx * tilt
        : 0;
      parts.push({
        id: s.id,
        nameZh: s.nameZh,
        material,
        grainDirection: "length",
        visible: { length: apronSpan, width: apronWidth, thickness: apronThickness },
        origin: { x: s.origin.x, y: apronY, z: s.origin.z },
        rotation,
        shape: isSplayed ? { kind: "apron-beveled", bevelAngle } : legEdgeShape(stretcherEdge, stretcherEdgeStyle),
        tenons: [
          { position: "start", type: "blind-tenon", length: apronTenonLen, width: apronTenonWidth, thickness: apronTenonThick },
          { position: "end", type: "blind-tenon", length: apronTenonLen, width: apronTenonWidth, thickness: apronTenonThick },
        ],
        mortises: [],
      });
    }
  }

  // 4 條下橫撐——同邏輯但用 lowerStretcher* 參數，靠近地面
  if (withLowerStretcher) {
    const isSplayed = legShape.startsWith("splayed-");
    const tilt = isSplayed ? computeSplayGeometry(legHeight, splayAngle).apronTilt : 0;
    const lsShiftFactor = legHeight > 0 ? 1 - lsYCenter0 / legHeight : 0;
    const lsSplayDx = isSplayed ? splayDx * lsShiftFactor : 0;
    const lsSplayDz = isSplayed ? splayDz * lsShiftFactor : 0;
    const lsSpan = 2 * (cornerOffset + lsSplayDx) - legSize;
    const lsSides = [
      { id: "lower-stretcher-front", nameZh: "前下橫撐", axis: "x" as const, sx: 0, sz: -1, origin: { x: 0, z: -(cornerOffset + lsSplayDz) } },
      { id: "lower-stretcher-back", nameZh: "後下橫撐", axis: "x" as const, sx: 0, sz: 1, origin: { x: 0, z: cornerOffset + lsSplayDz } },
      { id: "lower-stretcher-left", nameZh: "左下橫撐", axis: "z" as const, sx: -1, sz: 0, origin: { x: -(cornerOffset + lsSplayDx), z: 0 } },
      { id: "lower-stretcher-right", nameZh: "右下橫撐", axis: "z" as const, sx: 1, sz: 0, origin: { x: cornerOffset + lsSplayDx, z: 0 } },
    ];
    for (const s of lsSides) {
      const rotation =
        s.axis === "z"
          ? { x: Math.PI / 2, y: Math.PI / 2, z: s.sx * tilt }
          : { x: Math.PI / 2 + (-s.sz) * tilt, y: 0, z: 0 };
      const bevelAngle = isSplayed
        ? s.axis === "x" ? -s.sz * tilt : -s.sx * tilt
        : 0;
      parts.push({
        id: s.id,
        nameZh: s.nameZh,
        material,
        grainDirection: "length",
        visible: { length: lsSpan, width: lowerStretcherWidth, thickness: lowerStretcherThickness },
        origin: { x: s.origin.x, y: s.axis === "z" ? lsY0_z : lsY0, z: s.origin.z },
        rotation,
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
    id: `round-stool-${diameter}x${height}`,
    category: "round-stool",
    nameZh: "圓凳",
    overall: { length: diameter, width: diameter, thickness: height },
    parts,
    defaultJoinery: "blind-tenon",
    useButtJointConvention: true,
    primaryMaterial: material,
    notes: `圓凳直徑 ${diameter}mm × 高 ${height}mm，4 隻${legShapeLabel(legShape)}${withApron ? "含橫撐" : ""}。座板用實木拼板（>=300mm 直徑通常需 2-3 片拼）。${seatEdgeNote(seatEdge, seatEdgeStyle)}${legEdgeNote(legEdge, legEdgeStyle)}${stretcherEdgeNote(stretcherEdge, stretcherEdgeStyle)}`,
  };
  const w = validateRoundLegJoinery(design);
  if (w.length) design.warnings = [...(design.warnings ?? []), ...w];
  applyStandardChecks(design, {
    minLength: 200, minWidth: 200, minHeight: 350,
    maxLength: 600, maxWidth: 600, maxHeight: 550,
  });
  if (input.length > 600) {
    appendSuggestion(design, {
      text: `直徑 ${input.length}mm 比較像圓茶几——圓茶几模板有牙板、下橫撐選項。`,
      suggestedCategory: "round-tea-table",
      presetParams: { length: input.length, width: input.length, height: Math.min(input.height, 500), material: input.material },
    });
  }
  return design;
};
