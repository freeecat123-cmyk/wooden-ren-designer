import type {
  FurnitureDesign,
  FurnitureTemplate,
  OptionSpec,
  Part,
} from "@/lib/types";
import { getOption, opt } from "@/lib/types";
import { validateRoundLegJoinery, applyStandardChecks, appendSuggestion } from "./_validators";
import { legShapeLabel, computeSplayGeometry, legEdgeOption, legEdgeStyleOption, legEdgeNote, legEdgeShape, stretcherEdgeOption, stretcherEdgeStyleOption, stretcherEdgeNote, topPanelPiecesOption, topPanelPiecesNote, legBottomScale, legScaleAt } from "./_helpers";
import { standardTenon, autoTenonType } from "@/lib/joinery/standards";

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
  { group: "apron", type: "number", key: "apronStaggerMm", label: "牙板錯開 (mm)", defaultValue: 0, min: 0, max: 80, step: 2, unit: "mm", help: "前後牙板（X 軸）相對左右牙板下移量，3D 即時顯示。0 = 等高（自動上下半榫）" },
  { group: "apron", type: "checkbox", key: "legPenetratingTenon", label: "腳上榫頭通透（明榫裝飾）", defaultValue: false, help: "勾選：牙板/下橫撐進腳改通榫；圓腳系列強制盲榫（曲面不能鑿穿）" },
  { group: "stretcher", type: "checkbox", key: "withLowerStretcher", label: "加下橫撐", defaultValue: false, help: "靠近地面的另一組橫撐連結 4 腳，更穩固" },
  { group: "stretcher", type: "number", key: "lowerStretcherStaggerMm", label: "下橫撐錯開 (mm)", defaultValue: 0, min: 0, max: 80, step: 2, unit: "mm", help: "左右下橫撐（Z 軸）相對前後上移量。0 = 等高（自動上下半榫）", dependsOn: { key: "withLowerStretcher", equals: true } },
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
  const apronStaggerMm = getOption<number>(input, opt(o, "apronStaggerMm"));
  const lowerStretcherStaggerMm = getOption<number>(input, opt(o, "lowerStretcherStaggerMm"));
  const legPenetratingTenonRaw = getOption<boolean>(input, opt(o, "legPenetratingTenon"));
  // 圓腳系列母件曲面不能開通榫
  const isRoundShapeLeg =
    legShape === "round" || legShape === "round-taper-down" || legShape === "round-taper-up" ||
    legShape === "shaker" || legShape === "splayed-round-taper-down" || legShape === "splayed-round-taper-up";
  const legPenetratingTenon = legPenetratingTenonRaw && !isRoundShapeLeg;

  const radius = diameter / 2;
  const legHeight = height - topThickness;
  const cornerOffset = Math.max(legSize, (radius - legInset) / Math.SQRT2);
  // 腳頂榫對圓桌面 radial 偏（X+Z 朝中心）— 圓桌面沒「端面」概念，4 隻腳一律保護
  const legTopTenonW_round = Math.round(legSize * 0.6);
  const legTopRadialInset = Math.max(0, Math.round((legSize - legTopTenonW_round) / 2));
  const { splayMm, splayDx, splayDz } = computeSplayGeometry(legHeight, splayAngle);
  // 套方凳榫卯規則
  const apronY0 = legHeight - apronWidth - apronDropFromTop;
  const apronYCenter0 = apronY0 + apronWidth / 2;
  const apronTenonType = legPenetratingTenon ? "through-tenon" : autoTenonType(legSize);
  const apronTenonStd = standardTenon({
    type: apronTenonType === "through-tenon" ? "through-tenon" : "shouldered-tenon",
    childThickness: apronThickness,
    childWidth: apronWidth,
    motherThickness: legSize,
  });
  const apronTenonW = Math.min(apronTenonStd.width, Math.max(8, legSize - 6));
  const apronTenonThick = apronTenonStd.thickness;
  const apronTenonLen = apronTenonStd.length + (apronTenonType === "through-tenon" ? 5 : 0);
  const APRON_TOP_SHOULDER = 10;
  const apronTotalTenonH = Math.max(0, apronWidth - APRON_TOP_SHOULDER);
  const apronCanHalfStagger = apronStaggerMm < apronTenonW && apronTotalTenonH >= 16;
  const APRON_HALF_TENON_GAP = 4;
  const apronHalfTenonH = apronCanHalfStagger
    ? Math.min(apronTenonW, Math.max(4, Math.floor((apronTotalTenonH + apronStaggerMm - APRON_HALF_TENON_GAP) / 2)))
    : apronTenonW;
  const apronUpperTenonOffset = apronCanHalfStagger
    ? (apronWidth - APRON_TOP_SHOULDER - apronHalfTenonH / 2) - apronWidth / 2
    : 0;
  const apronLowerTenonOffset = apronCanHalfStagger
    ? apronHalfTenonH / 2 - apronWidth / 2
    : 0;
  const apronVisuallyStaggered = apronStaggerMm > 0;

  const lsY0 = lowerStretcherFromGround;
  const lsYCenter0 = lsY0 + lowerStretcherWidth / 2;
  const lsY0_z = lsY0 + lowerStretcherStaggerMm;
  const lsYCenter0_z = lsY0_z + lowerStretcherWidth / 2;
  const lowerTenonType = legPenetratingTenon ? "through-tenon" : autoTenonType(legSize);
  const lowerTenonStd = standardTenon({
    type: lowerTenonType === "through-tenon" ? "through-tenon" : "shouldered-tenon",
    childThickness: lowerStretcherThickness,
    childWidth: lowerStretcherWidth,
    motherThickness: legSize,
  });
  const lsTenonW = Math.min(lowerTenonStd.width, Math.max(8, legSize - 6));
  const lsTenonThick = lowerTenonStd.thickness;
  const lsTenonLen = lowerTenonStd.length + (lowerTenonType === "through-tenon" ? 5 : 0);
  const lowerCanHalfStagger = lowerStretcherStaggerMm < lsTenonW && lowerStretcherWidth >= 16;
  const LOWER_HALF_TENON_GAP = 4;
  const lowerHalfTenonH = lowerCanHalfStagger
    ? Math.min(lsTenonW, Math.max(4, Math.floor((lowerStretcherWidth + lowerStretcherStaggerMm - LOWER_HALF_TENON_GAP) / 2)))
    : lsTenonW;
  const lowerUpperTenonOffset = lowerCanHalfStagger
    ? (lowerStretcherWidth / 2 - lowerHalfTenonH / 2)
    : 0;
  const lowerLowerTenonOffset = lowerCanHalfStagger
    ? (lowerHalfTenonH / 2 - lowerStretcherWidth / 2)
    : 0;
  const lowerVisuallyStaggered = lowerStretcherStaggerMm > 0;

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
          // 跟 tenon 一起 radial 朝中心偏
          origin: {
            x: sx * cornerOffset - sx * legTopRadialInset,
            y: 0,
            z: sz * cornerOffset - sz * legTopRadialInset,
          },
          // 跟 leg seat tenon length 同公式才能對位（drafting-math.md §B2）
          depth: Math.round(Math.min(topThickness * (2 / 3), topThickness - 6)),
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
          // 朝桌面中心 radial 偏；移除朝外 2 個肩
          offsetWidth: -sx * legTopRadialInset,
          offsetThickness: -sz * legTopRadialInset,
          shoulderOn: (() => {
            if (legTopRadialInset <= 0) return ["top", "bottom", "left", "right"] as const;
            const removeX: "left" | "right" = sx > 0 ? "left" : "right";
            const removeZ: "top" | "bottom" = sz > 0 ? "bottom" : "top";
            return (["top", "bottom", "left", "right"] as Array<"top" | "bottom" | "left" | "right">)
              .filter((s) => s !== removeX && s !== removeZ);
          })(),
        },
      ],
      mortises: [
        // Z 面（接 Z 軸 = 左右牙板, 靜止）— 上半榫
        {
          origin: {
            x: 0,
            y: apronYCenter0 + apronUpperTenonOffset,
            z: -sz * (legSize / 2),
          },
          depth: apronTenonLen,
          length: apronCanHalfStagger ? apronHalfTenonH : apronTenonW,
          width: apronTenonThick,
          through: apronTenonType === "through-tenon",
        },
        // X 面（接 X 軸 = 前後牙板, 下移）— 下半榫
        {
          origin: {
            x: -sx * (legSize / 2),
            y: apronYCenter0 + apronLowerTenonOffset - (apronVisuallyStaggered ? apronStaggerMm : 0),
            z: 0,
          },
          depth: apronTenonLen,
          length: apronCanHalfStagger ? apronHalfTenonH : apronTenonW,
          width: apronTenonThick,
          through: apronTenonType === "through-tenon",
        },
        ...(withLowerStretcher
          ? [
              // X 面（前後對, 靜止）— 下半榫
              {
                origin: {
                  x: -sx * (legSize / 2),
                  y: lsYCenter0 + lowerLowerTenonOffset,
                  z: 0,
                },
                depth: lsTenonLen,
                length: lowerCanHalfStagger ? lowerHalfTenonH : lsTenonW,
                width: lsTenonThick,
                through: lowerTenonType === "through-tenon",
              },
              // Z 面（左右對, 上移）— 上半榫
              {
                origin: {
                  x: 0,
                  y: lsYCenter0 + lowerUpperTenonOffset + (lowerVisuallyStaggered ? lowerStretcherStaggerMm : 0),
                  z: -sz * (legSize / 2),
                },
                depth: lsTenonLen,
                length: lowerCanHalfStagger ? lowerHalfTenonH : lsTenonW,
                width: lsTenonThick,
                through: lowerTenonType === "through-tenon",
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
  // tapered 補償（drafting-math §A11）：apron 端面 = 腳在 apron Y 處的內面
  const apronBottomScale = legBottomScale(legShape);
  const apronLegSizeCenter = legSize * legScaleAt(apronYCenter, legHeight, apronBottomScale);
  const apronLegSizeTop = legSize * legScaleAt(apronY + apronWidth, legHeight, apronBottomScale);
  const apronLegSizeBot = legSize * legScaleAt(apronY, legHeight, apronBottomScale);
  // butt-joint 慣例：visible.length 兩端剛好頂在腳的內側面（apron Y center）
  const apronSpan = 2 * (cornerOffset + apronSplayDx) - apronLegSizeCenter;
  // apron-trapezoid：上下緣腳寬不同 → apron 隨之梯形收縮
  const hasTaper = apronBottomScale !== 1;
  const apronShiftTop = legHeight > 0 ? 1 - (apronY + apronWidth) / legHeight : 0;
  const apronShiftBot = legHeight > 0 ? 1 - apronY / legHeight : 0;
  const apronSplayDxTop = isSplayed ? splayDx * apronShiftTop : 0;
  const apronSplayDxBot = isSplayed ? splayDx * apronShiftBot : 0;
  const apronSpanCenterEdge = cornerOffset + apronSplayDx - apronLegSizeCenter / 2;
  const apronSpanTopEdge = cornerOffset + apronSplayDxTop - apronLegSizeTop / 2;
  const apronSpanBotEdge = cornerOffset + apronSplayDxBot - apronLegSizeBot / 2;
  const trapTopScale = hasTaper && apronSpanCenterEdge > 0 ? apronSpanTopEdge / apronSpanCenterEdge : 1;
  const trapBotScale = hasTaper && apronSpanCenterEdge > 0 ? apronSpanBotEdge / apronSpanCenterEdge : 1;
  const aprons: Part[] = [
    { id: "apron-front", nameZh: "前牙板", axis: "x" as const, sx: 0, sz: -1, origin: { x: 0, z: -(cornerOffset + apronSplayDz) } },
    { id: "apron-back", nameZh: "後牙板", axis: "x" as const, sx: 0, sz: 1, origin: { x: 0, z: cornerOffset + apronSplayDz } },
    { id: "apron-left", nameZh: "左牙板", axis: "z" as const, sx: -1, sz: 0, origin: { x: -(cornerOffset + apronSplayDx), z: 0 } },
    { id: "apron-right", nameZh: "右牙板", axis: "z" as const, sx: 1, sz: 0, origin: { x: cornerOffset + apronSplayDx, z: 0 } },
  ].map((s) => {
    const bevelAngle = isSplayed ? (s.axis === "x" ? -s.sz * tilt : -s.sx * tilt) : 0;
    const apronTopAtSeat = apronDropFromTop === 0;
    const useTopBevel = isSplayed && apronTopAtSeat;
    const partShape = hasTaper
      ? ({
          kind: "apron-trapezoid" as const,
          topLengthScale: trapTopScale,
          bottomLengthScale: trapBotScale,
          bevelAngle: useTopBevel ? bevelAngle : undefined,
          bevelMode: useTopBevel ? ("half" as const) : undefined,
        })
      : isSplayed && apronTopAtSeat
        ? ({ kind: "apron-half-beveled" as const, bevelAngle })
        : legEdgeShape(stretcherEdge, stretcherEdgeStyle);
    const tenonType: "through-tenon" | "shouldered-tenon" =
      apronTenonType === "through-tenon" ? "through-tenon" : "shouldered-tenon";
    const tenons = (() => {
      if (!apronCanHalfStagger) {
        const mk = (position: "start" | "end") => ({
          position,
          type: tenonType,
          length: apronTenonLen,
          width: apronTenonW,
          thickness: apronTenonThick,
          shoulderOn: [...apronTenonStd.shoulderOn] as Array<"top" | "bottom" | "left" | "right">,
        });
        return [mk("start"), mk("end")];
      }
      const isUpper = s.axis === "z";
      const worldOffset = isUpper ? apronUpperTenonOffset : apronLowerTenonOffset;
      const shoulderOn: Array<"top" | "bottom" | "left" | "right"> = isUpper
        ? ["top", "left", "right"]
        : ["left", "right"];
      const mk = (position: "start" | "end") => ({
        position,
        type: tenonType,
        length: apronTenonLen,
        width: apronHalfTenonH,
        thickness: apronTenonThick,
        shoulderOn,
        offsetWidth: -worldOffset,
      });
      return [mk("start"), mk("end")];
    })();
    return {
      id: s.id,
      nameZh: s.nameZh,
      material,
      grainDirection: "length" as const,
      visible: { length: apronSpan, width: apronWidth, thickness: apronThickness },
      origin: { x: s.origin.x, y: apronY - (apronVisuallyStaggered && s.axis === "x" ? apronStaggerMm : 0), z: s.origin.z },
      rotation:
        s.axis === "z"
          ? { x: Math.PI / 2, y: Math.PI / 2, z: s.sx * tilt }
          : { x: Math.PI / 2 + (-s.sz) * tilt, y: 0, z: 0 },
      shape: partShape,
      tenons,
      mortises: [],
    };
  });

  // 4 條下橫撐——同邏輯，靠近地面
  const lowerStretchers: Part[] = [];
  if (withLowerStretcher) {
    const lsShiftFactor = legHeight > 0 ? 1 - lsYCenter0 / legHeight : 0;
    const lsSplayDx = isSplayed ? splayDx * lsShiftFactor : 0;
    const lsSplayDz = isSplayed ? splayDz * lsShiftFactor : 0;
    // tapered 補償：下橫撐 Y 處的腳寬
    const lsLegSizeCenter = legSize * legScaleAt(lsYCenter0, legHeight, apronBottomScale);
    const lsLegSizeTop = legSize * legScaleAt(lsYCenter0 + lowerStretcherWidth / 2, legHeight, apronBottomScale);
    const lsLegSizeBot = legSize * legScaleAt(lsYCenter0 - lowerStretcherWidth / 2, legHeight, apronBottomScale);
    const lsSpan = 2 * (cornerOffset + lsSplayDx) - lsLegSizeCenter;
    const lsHasTaper = apronBottomScale !== 1;
    const lsShiftTop = legHeight > 0 ? 1 - (lsYCenter0 + lowerStretcherWidth / 2) / legHeight : 0;
    const lsShiftBot = legHeight > 0 ? 1 - (lsYCenter0 - lowerStretcherWidth / 2) / legHeight : 0;
    const lsSplayDxTop = isSplayed ? splayDx * lsShiftTop : 0;
    const lsSplayDxBot = isSplayed ? splayDx * lsShiftBot : 0;
    const lsCenterEdge = cornerOffset + lsSplayDx - lsLegSizeCenter / 2;
    const lsTopEdge = cornerOffset + lsSplayDxTop - lsLegSizeTop / 2;
    const lsBotEdge = cornerOffset + lsSplayDxBot - lsLegSizeBot / 2;
    const lsTrapTopScale = lsHasTaper && lsCenterEdge > 0 ? lsTopEdge / lsCenterEdge : 1;
    const lsTrapBotScale = lsHasTaper && lsCenterEdge > 0 ? lsBotEdge / lsCenterEdge : 1;
    const lsSides = [
      { id: "lower-stretcher-front", nameZh: "前下橫撐", axis: "x" as const, sx: 0, sz: -1, origin: { x: 0, z: -(cornerOffset + lsSplayDz) } },
      { id: "lower-stretcher-back", nameZh: "後下橫撐", axis: "x" as const, sx: 0, sz: 1, origin: { x: 0, z: cornerOffset + lsSplayDz } },
      { id: "lower-stretcher-left", nameZh: "左下橫撐", axis: "z" as const, sx: -1, sz: 0, origin: { x: -(cornerOffset + lsSplayDx), z: 0 } },
      { id: "lower-stretcher-right", nameZh: "右下橫撐", axis: "z" as const, sx: 1, sz: 0, origin: { x: cornerOffset + lsSplayDx, z: 0 } },
    ];
    // 下橫撐：trapezoid 但無 bevel；左右（Z）整支上移 staggerMm
    for (const s of lsSides) {
      const partShape = lsHasTaper
        ? { kind: "apron-trapezoid" as const, topLengthScale: lsTrapTopScale, bottomLengthScale: lsTrapBotScale }
        : legEdgeShape(stretcherEdge, stretcherEdgeStyle);
      const lsType: "through-tenon" | "blind-tenon" =
        lowerTenonType === "through-tenon" ? "through-tenon" : "blind-tenon";
      const tenons = (() => {
        if (!lowerCanHalfStagger) {
          const mk = (position: "start" | "end") => ({
            position,
            type: lsType,
            length: lsTenonLen,
            width: lsTenonW,
            thickness: lsTenonThick,
            shoulderOn: [...lowerTenonStd.shoulderOn] as Array<"top" | "bottom" | "left" | "right">,
          });
          return [mk("start"), mk("end")];
        }
        const isUpper = s.axis === "z";
        const worldOffset = isUpper ? lowerUpperTenonOffset : lowerLowerTenonOffset;
        const shoulderOn: Array<"top" | "bottom" | "left" | "right"> = ["left", "right"];
        const mk = (position: "start" | "end") => ({
          position,
          type: lsType,
          length: lsTenonLen,
          width: lowerHalfTenonH,
          thickness: lsTenonThick,
          shoulderOn,
          offsetWidth: -worldOffset,
        });
        return [mk("start"), mk("end")];
      })();
      lowerStretchers.push({
        id: s.id,
        nameZh: s.nameZh,
        material,
        grainDirection: "length",
        visible: { length: lsSpan, width: lowerStretcherWidth, thickness: lowerStretcherThickness },
        origin: { x: s.origin.x, y: s.axis === "z" ? lsY0_z : lsY0, z: s.origin.z },
        rotation: s.axis === "z"
          ? { x: Math.PI / 2, y: Math.PI / 2, z: s.sx * tilt }
          : { x: Math.PI / 2 + (-s.sz) * tilt, y: 0, z: 0 },
        shape: partShape,
        tenons,
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
    useButtJointConvention: true,
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
