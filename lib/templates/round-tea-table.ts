import type {
  FurnitureDesign,
  FurnitureTemplate,
  OptionSpec,
  Part,
} from "@/lib/types";
import { getOption, opt } from "@/lib/types";
import { validateRoundLegJoinery, applyStandardChecks, appendSuggestion } from "./_validators";
import { legShapeLabel, computeSplayGeometry, legEdgeOption, legEdgeStyleOption, legEdgeNote, legEdgeShape, stretcherEdgeOption, stretcherEdgeStyleOption, stretcherEdgeNote, legBottomScale, legProfileScaleAt } from "./_helpers";
import { standardTenon, autoTenonType } from "@/lib/joinery/standards";

export const roundTeaTableOptions: OptionSpec[] = [
  { group: "top", type: "number", key: "topThickness", label: "桌面厚 (mm)", defaultValue: 25, min: 15, max: 40, step: 1, unit: "mm" },
  { group: "leg", type: "number", key: "legSize", label: "腳粗 (mm)", defaultValue: 40, min: 25, max: 80, step: 1, unit: "mm" },
  legEdgeOption("leg", 1),
  legEdgeStyleOption("leg"),
  stretcherEdgeOption("stretcher", 1),
  stretcherEdgeStyleOption("stretcher"),
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
  { group: "stretcher", type: "select", key: "lowerStretcherStyle", label: "下橫撐樣式", defaultValue: "h-frame", choices: [
    { value: "h-frame", label: "H 字形（4 條繞 1 圈）" },
    { value: "x-cross", label: "X 字交叉（2 條斜撐穿越中心，明清交杌做法）" },
  ], dependsOn: { key: "withLowerStretcher", equals: true } },
  { group: "stretcher", type: "number", key: "lowerStretcherStaggerMm", label: "下橫撐錯開 (mm)", defaultValue: 0, min: 0, max: 80, step: 2, unit: "mm", help: "左右下橫撐（Z 軸）相對前後上移量。0 = 等高（自動上下半榫）", dependsOn: { key: "lowerStretcherStyle", equals: "h-frame" } },
  { group: "stretcher", type: "number", key: "lowerStretcherWidth", label: "下橫撐高 (mm)", defaultValue: 35, min: 20, max: 100, step: 5, unit: "mm", dependsOn: { key: "withLowerStretcher", equals: true } },
  { group: "stretcher", type: "number", key: "lowerStretcherThickness", label: "下橫撐厚 (mm)", defaultValue: 18, min: 10, max: 30, step: 1, unit: "mm", dependsOn: { key: "withLowerStretcher", equals: true } },
  { group: "stretcher", type: "number", key: "lowerStretcherFromGround", label: "下橫撐離地 (mm)", defaultValue: 100, min: 30, max: 400, step: 10, unit: "mm", dependsOn: { key: "withLowerStretcher", equals: true } },
  { group: "stretcher", type: "checkbox", key: "withLowerShelf", label: "下層圓棚板", defaultValue: false, help: "下橫撐上方放圓棚板，rest-on 設計，收納茶具/雜誌（直徑自動算嵌入 4 腳內）", dependsOn: { key: "withLowerStretcher", equals: true } },
  { group: "stretcher", type: "number", key: "lowerShelfThickness", label: "棚板厚 (mm)", defaultValue: 18, min: 12, max: 30, step: 1, unit: "mm", dependsOn: { key: "withLowerShelf", equals: true } },
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
  const withLazySusan = getOption<boolean>(input, opt(o, "withLazySusan"));
  const lazySusanDiameter = getOption<number>(input, opt(o, "lazySusanDiameter"));
  const legInset = getOption<number>(input, opt(o, "legInset"));
  const legShape = getOption<string>(input, opt(o, "legShape"));
  const apronWidth = getOption<number>(input, opt(o, "apronWidth"));
  const apronThickness = getOption<number>(input, opt(o, "apronThickness"));
  const apronDropFromTop = getOption<number>(input, opt(o, "apronDropFromTop"));
  const splayAngle = getOption<number>(input, opt(o, "splayAngle"));
  const withLowerStretcher = getOption<boolean>(input, opt(o, "withLowerStretcher"));
  const lowerStretcherStyle = getOption<string>(input, opt(o, "lowerStretcherStyle"));
  const lowerStretcherWidth = getOption<number>(input, opt(o, "lowerStretcherWidth"));
  const lowerStretcherThickness = getOption<number>(input, opt(o, "lowerStretcherThickness"));
  const lowerStretcherFromGround = getOption<number>(input, opt(o, "lowerStretcherFromGround"));
  const withLowerShelf = getOption<boolean>(input, opt(o, "withLowerShelf"));
  const lowerShelfThickness = getOption<number>(input, opt(o, "lowerShelfThickness"));
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
        // X-cross 模式：腳上不加軸對齊 mortise（對角榫頭做法手作端要自行決定，
        // 通常用 45° 盲榫或暗銷；3D 視覺仍接合，不影響材料單）
        ...(withLowerStretcher && lowerStretcherStyle === "h-frame"
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
  const apronBottomScale = legBottomScale(legShape);
  const hasTaper = apronBottomScale !== 1;
  // 牙條錯開時，X 軸（前後）牙條 Y 中心整支下移 apronStaggerMm；Z 軸（左右）保持原位
  // 外斜時腳在更低位置外傾更多，X 軸牙條的 splay 偏移、span、梯形比例都得用下移後的 Y 算，否則接不到腳
  const apronStaggerY = apronVisuallyStaggered ? apronStaggerMm : 0;
  const apronGeomFor = (yCenter: number) => {
    const shift = legHeight > 0 ? 1 - yCenter / legHeight : 0;
    const dx = isSplayed ? splayDx * shift : 0;
    const dz = isSplayed ? splayDz * shift : 0;
    const yTop = yCenter + apronWidth / 2;
    const yBot = yCenter - apronWidth / 2;
    const legSizeC = legSize * legProfileScaleAt(legShape, yCenter, legHeight);
    const legSizeTop = legSize * legProfileScaleAt(legShape, yTop, legHeight);
    const legSizeBot = legSize * legProfileScaleAt(legShape, yBot, legHeight);
    const span = 2 * (cornerOffset + dx) - legSizeC;
    const dxTop = isSplayed ? splayDx * (legHeight > 0 ? 1 - yTop / legHeight : 0) : 0;
    const dxBot = isSplayed ? splayDx * (legHeight > 0 ? 1 - yBot / legHeight : 0) : 0;
    const centerEdge = cornerOffset + dx - legSizeC / 2;
    const topEdge = cornerOffset + dxTop - legSizeTop / 2;
    const botEdge = cornerOffset + dxBot - legSizeBot / 2;
    const trapTop = hasTaper && centerEdge > 0 ? topEdge / centerEdge : 1;
    const trapBot = hasTaper && centerEdge > 0 ? botEdge / centerEdge : 1;
    return { dx, dz, span, trapTop, trapBot };
  };
  const apronGeomZ = apronGeomFor(apronYCenter0);
  const apronGeomX = apronGeomFor(apronYCenter0 - apronStaggerY);
  const aprons: Part[] = [
    { id: "apron-front", nameZh: "前牙板", axis: "x" as const, sx: 0, sz: -1, origin: { x: 0, z: -(cornerOffset + apronGeomX.dz) } },
    { id: "apron-back", nameZh: "後牙板", axis: "x" as const, sx: 0, sz: 1, origin: { x: 0, z: cornerOffset + apronGeomX.dz } },
    { id: "apron-left", nameZh: "左牙板", axis: "z" as const, sx: -1, sz: 0, origin: { x: -(cornerOffset + apronGeomZ.dx), z: 0 } },
    { id: "apron-right", nameZh: "右牙板", axis: "z" as const, sx: 1, sz: 0, origin: { x: cornerOffset + apronGeomZ.dx, z: 0 } },
  ].map((s) => {
    const geom = s.axis === "x" ? apronGeomX : apronGeomZ;
    const bevelAngle = isSplayed ? (s.axis === "x" ? -s.sz * tilt : -s.sx * tilt) : 0;
    const apronTopAtSeat = apronDropFromTop === 0;
    const useTopBevel = isSplayed && apronTopAtSeat;
    const partShape = hasTaper
      ? ({
          kind: "apron-trapezoid" as const,
          topLengthScale: geom.trapTop,
          bottomLengthScale: geom.trapBot,
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
      visible: { length: geom.span, width: apronWidth, thickness: apronThickness },
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

  // 下橫撐：h-frame（4 條繞 1 圈）或 x-cross（2 條對角穿越中心）
  const lowerStretchers: Part[] = [];
  if (withLowerStretcher && lowerStretcherStyle === "h-frame") {
    // 下橫撐錯開時，Z 軸（左右）整支上移 lowerStretcherStaggerMm；X 軸（前後）保持原位
    // 外斜時腳在更低位置外傾更多，上移後 Z 軸下橫撐 splay/span 要用上移後 Y 算才接得到腳
    const lsHasTaper = apronBottomScale !== 1;
    const lsGeomFor = (yCenter: number) => {
      const shift = legHeight > 0 ? 1 - yCenter / legHeight : 0;
      const dx = isSplayed ? splayDx * shift : 0;
      const dz = isSplayed ? splayDz * shift : 0;
      const yTop = yCenter + lowerStretcherWidth / 2;
      const yBot = yCenter - lowerStretcherWidth / 2;
      const legSizeC = legSize * legProfileScaleAt(legShape, yCenter, legHeight);
      const legSizeTop = legSize * legProfileScaleAt(legShape, yTop, legHeight);
      const legSizeBot = legSize * legProfileScaleAt(legShape, yBot, legHeight);
      const span = 2 * (cornerOffset + dx) - legSizeC;
      const dxTop = isSplayed ? splayDx * (legHeight > 0 ? 1 - yTop / legHeight : 0) : 0;
      const dxBot = isSplayed ? splayDx * (legHeight > 0 ? 1 - yBot / legHeight : 0) : 0;
      const centerEdge = cornerOffset + dx - legSizeC / 2;
      const topEdge = cornerOffset + dxTop - legSizeTop / 2;
      const botEdge = cornerOffset + dxBot - legSizeBot / 2;
      const trapTop = lsHasTaper && centerEdge > 0 ? topEdge / centerEdge : 1;
      const trapBot = lsHasTaper && centerEdge > 0 ? botEdge / centerEdge : 1;
      return { dx, dz, span, trapTop, trapBot };
    };
    const lsGeomX = lsGeomFor(lsYCenter0);
    const lsGeomZ = lsGeomFor(lsYCenter0_z);
    const lsSides = [
      { id: "lower-stretcher-front", nameZh: "前下橫撐", axis: "x" as const, sx: 0, sz: -1, origin: { x: 0, z: -(cornerOffset + lsGeomX.dz) } },
      { id: "lower-stretcher-back", nameZh: "後下橫撐", axis: "x" as const, sx: 0, sz: 1, origin: { x: 0, z: cornerOffset + lsGeomX.dz } },
      { id: "lower-stretcher-left", nameZh: "左下橫撐", axis: "z" as const, sx: -1, sz: 0, origin: { x: -(cornerOffset + lsGeomZ.dx), z: 0 } },
      { id: "lower-stretcher-right", nameZh: "右下橫撐", axis: "z" as const, sx: 1, sz: 0, origin: { x: cornerOffset + lsGeomZ.dx, z: 0 } },
    ];
    // 下橫撐：trapezoid 但無 bevel；左右（Z）整支上移 staggerMm
    for (const s of lsSides) {
      const geom = s.axis === "x" ? lsGeomX : lsGeomZ;
      const partShape = lsHasTaper
        ? { kind: "apron-trapezoid" as const, topLengthScale: geom.trapTop, bottomLengthScale: geom.trapBot }
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
        visible: { length: geom.span, width: lowerStretcherWidth, thickness: lowerStretcherThickness },
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

  // X 字交叉橫撐：兩條對角線連接 4 隻腳，過中心半搭接（明清交杌做法）
  // 外斜模式 fallback 走直立 X（對角斜撐 + 外斜要傾斜+扭轉太複雜，不支援）。
  // 視覺上 2 條交叉時可能 z-fight，第二條稍微抬高 1mm 避免（肉眼看不出）。
  if (withLowerStretcher && lowerStretcherStyle === "x-cross") {
    const isSplayedXcross = legShape.startsWith("splayed-");
    // 用 X 撐下緣 Y（lsY0）算腳位置：斜腳在更低 Y 處外傾更大，splay shift 更大
    // → 下緣端面要伸到那裡才接到腳。直梁上緣會略伸過腳但視覺較好（外凸 ≪ 內凹的縫）。
    const shiftX = legHeight > 0 ? 1 - lsY0 / legHeight : 0;
    const splayDxX = isSplayedXcross ? splayDx * shiftX : 0;
    const splayDzX = isSplayedXcross ? splayDz * shiftX : 0;
    const legSizeAtLs = legSize * legProfileScaleAt(legShape, lsY0, legHeight);
    // 圓料腳（包含 shaker 下半 + 全部 round 系列）：對角斜撐打到的是腳邊（半徑），
    // 不是方料的對角內角；中心到腳邊距 = 中心到腳中心距 − 半徑
    const isRoundLeg =
      legShape === "round" || legShape === "round-taper-down" || legShape === "round-taper-up" ||
      legShape === "shaker" ||
      legShape === "splayed-round-taper-down" || legShape === "splayed-round-taper-up";
    const legCenterDist = Math.sqrt(
      (cornerOffset + splayDxX) * (cornerOffset + splayDxX) +
      (cornerOffset + splayDzX) * (cornerOffset + splayDzX),
    );
    const diagLen = isRoundLeg
      ? 2 * (legCenterDist - legSizeAtLs / 2)
      : 2 * Math.sqrt(
          (cornerOffset + splayDxX - legSizeAtLs / 2) * (cornerOffset + splayDxX - legSizeAtLs / 2) +
          (cornerOffset + splayDzX - legSizeAtLs / 2) * (cornerOffset + splayDzX - legSizeAtLs / 2),
        );
    const angle = Math.atan2(cornerOffset + splayDzX, cornerOffset + splayDxX);  // 圓桌 4 腳對稱 = 45°
    const xcTenonType: "through-tenon" | "shouldered-tenon" =
      lowerTenonType === "through-tenon" ? "through-tenon" : "shouldered-tenon";
    const diagonals = [
      { id: "ls-xcross-1", nameZh: "X 撐 1（前左↔後右）", yRot: angle, yLift: 0 },
      { id: "ls-xcross-2", nameZh: "X 撐 2（前右↔後左）", yRot: -angle, yLift: lowerStretcherThickness * 0.05 },
    ];
    for (const d of diagonals) {
      lowerStretchers.push({
        id: d.id,
        nameZh: d.nameZh,
        material,
        grainDirection: "length",
        visible: { length: diagLen, width: lowerStretcherWidth, thickness: lowerStretcherThickness },
        origin: { x: 0, y: lsY0 + d.yLift, z: 0 },
        rotation: { x: Math.PI / 2, y: d.yRot, z: 0 },
        shape: legEdgeShape(stretcherEdge, stretcherEdgeStyle),
        tenons: [
          { position: "start", type: xcTenonType, length: lsTenonLen, width: lsTenonW, thickness: lsTenonThick, shoulderOn: [...lowerTenonStd.shoulderOn] as Array<"top" | "bottom" | "left" | "right"> },
          { position: "end", type: xcTenonType, length: lsTenonLen, width: lsTenonW, thickness: lsTenonThick, shoulderOn: [...lowerTenonStd.shoulderOn] as Array<"top" | "bottom" | "left" | "right"> },
        ],
        mortises: [],
      });
    }
  }

  // 下層圓棚板：放在 4 條下橫撐上面（rest-on，靠重力 + 木鞘卡住，橫撐不開槽）
  // 直徑取「腳內角對角距離 − 餘裕」，並確保至少蓋過下橫撐中心線（不然棚板沒地方擱）
  const lowerShelfParts: Part[] = [];
  if (withLowerStretcher && withLowerShelf) {
    const isSplayedShelf = legShape.startsWith("splayed-");
    const shelfBotY = lowerStretcherFromGround + lowerStretcherWidth;  // 棚板底面 = 下橫撐頂面
    const shiftAtShelf = legHeight > 0 ? 1 - shelfBotY / legHeight : 0;
    const splayShiftShelf = isSplayedShelf ? splayDx * shiftAtShelf : 0;
    const cornerOffsetAtShelf = cornerOffset + splayShiftShelf;
    const legSizeAtShelf = legSize * legProfileScaleAt(legShape, shelfBotY, legHeight);
    // 腳內角對角距離 = √2 × (corner − legSize/2)；棚板半徑取此值 − 10mm 餘裕
    const SHELF_CLEARANCE = 10;
    const maxRadius = Math.SQRT2 * (cornerOffsetAtShelf - legSizeAtShelf / 2) - SHELF_CLEARANCE;
    // 至少蓋過下橫撐中心線 + 半厚（讓棚板實際擱在橫撐上）
    const minRadius = cornerOffsetAtShelf + lowerStretcherThickness / 2;
    const shelfRadius = Math.max(minRadius, maxRadius);
    const shelfDiameter = Math.round(shelfRadius * 2);
    lowerShelfParts.push({
      id: "lower-shelf",
      nameZh: "下層圓棚板",
      material,
      grainDirection: "length",
      visible: { length: shelfDiameter, width: shelfDiameter, thickness: lowerShelfThickness },
      origin: { x: 0, y: shelfBotY, z: 0 },
      shape: { kind: "round" },
      tenons: [],
      mortises: [],
    });
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
      ...lowerShelfParts,
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
    notes: `圓茶几直徑 ${diameter}mm × 高 ${height}mm，4 隻${legShapeLabel(legShape)}含牙板。${legEdgeNote(legEdge, legEdgeStyle)}${stretcherEdgeNote(stretcherEdge, stretcherEdgeStyle)}${withLowerStretcher && withLowerShelf ? ` 下層圓棚板 ${lowerShelfParts[0]?.visible.length}mm × ${lowerShelfThickness}mm，rest-on 擱在 4 條下橫撐上。` : ""}${withLazySusan ? ` 中央旋轉盤 ${Math.min(lazySusanDiameter, diameter - 100)}mm，配 8-12 吋軸承一組。` : ""}`,
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
