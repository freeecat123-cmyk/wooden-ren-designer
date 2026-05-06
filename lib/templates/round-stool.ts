import type {
  FurnitureDesign,
  FurnitureTemplate,
  OptionSpec,
  Part,
} from "@/lib/types";
import { getOption, opt } from "@/lib/types";
import { validateRoundLegJoinery, applyStandardChecks, appendSuggestion } from "./_validators";
import { legShapeLabel, computeSplayGeometry, seatEdgeOption, seatEdgeStyleOption, seatEdgeNote, legEdgeOption, legEdgeStyleOption, legEdgeNote, legEdgeShape, stretcherEdgeOption, stretcherEdgeStyleOption, stretcherEdgeNote, parseSeatChamferMm, parseLegChamferMm, legBottomScale, legScaleAt } from "./_helpers";
import { standardTenon, autoTenonType } from "@/lib/joinery/standards";

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
  { group: "apron", type: "number", key: "apronStaggerMm", label: "牙板錯開 (mm)", defaultValue: 0, min: 0, max: 80, step: 2, unit: "mm", help: "前後牙板（X 軸）相對左右牙板下移量，3D 即時顯示。0 = 等高（自動上下半榫避免穿模）", dependsOn: { key: "withApron", equals: true } },
  { group: "apron", type: "checkbox", key: "legPenetratingTenon", label: "腳上榫頭通透（明榫裝飾）", defaultValue: false, help: "勾選：牙板/下橫撐進腳改通榫；圓腳系列強制盲榫（曲面不能鑿穿）", dependsOn: { key: "withApron", equals: true } },
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
  const withApronOpt = getOption<boolean>(input, opt(o, "withApron"));
  const apronWidth = getOption<number>(input, opt(o, "apronWidth"));
  // apronWidth=0 也視為「無橫撐」——windsor / industrial preset 直接寫 0 bypass UI checkbox
  const withApron = withApronOpt && apronWidth > 0;
  const apronThickness = getOption<number>(input, opt(o, "apronThickness"));
  const apronDropFromTop = getOption<number>(input, opt(o, "apronDropFromTop"));
  const splayAngle = getOption<number>(input, opt(o, "splayAngle"));
  const withLowerStretcher = getOption<boolean>(input, opt(o, "withLowerStretcher"));
  const lowerStretcherWidth = getOption<number>(input, opt(o, "lowerStretcherWidth"));
  const lowerStretcherThickness = getOption<number>(input, opt(o, "lowerStretcherThickness"));
  const lowerStretcherFromGround = getOption<number>(input, opt(o, "lowerStretcherFromGround"));
  const lowerStretcherStaggerMm = getOption<number>(input, opt(o, "lowerStretcherStaggerMm"));
  const apronStaggerMm = getOption<number>(input, opt(o, "apronStaggerMm"));
  const legPenetratingTenonRaw = getOption<boolean>(input, opt(o, "legPenetratingTenon"));
  // 圓腳系列（round/round-tapered/shaker/lathe-turned 與其 splayed 變體）的母件
  // 是曲面，不能開通榫——強制忽略 legPenetratingTenon。詳 _validators.validateRoundLegJoinery。
  const isRoundShapeLeg =
    legShape === "round" ||
    legShape === "round-taper-down" ||
    legShape === "round-taper-up" ||
    legShape === "shaker" ||
    legShape === "splayed-round-taper-down" ||
    legShape === "splayed-round-taper-up";
  const legPenetratingTenon = legPenetratingTenonRaw && !isRoundShapeLeg;

  const radius = diameter / 2;
  const legHeight = height - seatThickness;
  // 4 隻腳於圓內接正方形的 4 個角，距中心 = (R - legInset) / sqrt(2)
  const cornerOffset = Math.max(legSize, (radius - legInset) / Math.SQRT2);
  // 腳頂榫對圓座板做 radial 偏（X + Z 同時朝中心）— 圓座板沒「端面」概念，
  // grain 跟 leg 位置不對應，4 隻腳都當「靠端面」一律保護。
  // 偏移量比照方件規則：(legSize - tenonWidth) / 2，tenon = legSize × 0.6 → inset ≈ legSize × 0.2
  const legTopTenonW_round = Math.round(legSize * 0.6);
  const legTopRadialInset = Math.max(0, Math.round((legSize - legTopTenonW_round) / 2));
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
      // depth 跟 leg seat tenon length 同公式，audit 才對位
      // 圓座板：tenon + mortise 都朝中心 radial 偏 — 不像方板能預測哪面是端面
      // （grain 方向跟使用者 X 對齊，圓邊到 leg 的距離隨方位變），4 隻腳一律保護
      ...[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => ({
          origin: {
            x: sx * cornerOffset - sx * legTopRadialInset,
            y: 0,
            z: sz * cornerOffset - sz * legTopRadialInset,
          },
          depth: Math.round(Math.min(seatThickness * (2 / 3), seatThickness - 6)),
          length: Math.round(legSize * 0.6),
          width: Math.round(legSize * 0.6),
          through: false,
        })),
      ),
    ],
  };

  // 4 隻腳——榫眼依上下橫撐動態加
  // 上橫撐 中心 Y + tenon 規格（腳跟 apron 共用，依方凳規則）
  const apronY0 = legHeight - apronWidth - apronDropFromTop;
  const apronYCenter0 = apronY0 + apronWidth / 2;
  // 自動榫類型：母件（腳）厚 ≤ 25mm 通榫、>25mm 盲榫 2/3。圓腳系列已強制 blind。
  const apronTenonType = legPenetratingTenon ? "through-tenon" : autoTenonType(legSize);
  const apronTenonStd = standardTenon({
    type: apronTenonType === "through-tenon" ? "through-tenon" : "shouldered-tenon",
    childThickness: apronThickness,
    childWidth: apronWidth,
    motherThickness: legSize,
  });
  // tenon 寬上限再 clamp 到 legSize - 6（圓腳兩側留 3mm 木，避免 tenon 比腳直徑寬）
  const apronTenonW = Math.min(apronTenonStd.width, Math.max(8, legSize - 6));
  const apronTenonThick = apronTenonStd.thickness;
  // 通榫 +5mm 補償斜腳 tilt 投影損失
  const apronTenonLen = apronTenonStd.length + (apronTenonType === "through-tenon" ? 5 : 0);
  // 牙板半榫錯位（同方凳）：靜止 Z（左右）= 上半榫；移動 X（前後，下移）= 下半榫
  const APRON_TOP_SHOULDER = 10;
  const apronTotalTenonH = Math.max(0, apronWidth - APRON_TOP_SHOULDER);
  const apronCanHalfStagger = apronStaggerMm < apronTenonW && apronTotalTenonH >= 16;
  const APRON_HALF_TENON_GAP = 4;
  const apronHalfTenonH = apronCanHalfStagger
    ? Math.min(apronTenonW, Math.max(4, Math.floor((apronTotalTenonH + apronStaggerMm - APRON_HALF_TENON_GAP) / 2)))
    : apronTenonW;
  // part-local：apron Y 從 0 (底) 到 apronWidth (頂)，中心 = apronWidth/2
  const apronUpperTenonOffset = apronCanHalfStagger
    ? (apronWidth - APRON_TOP_SHOULDER - apronHalfTenonH / 2) - apronWidth / 2
    : 0;
  const apronLowerTenonOffset = apronCanHalfStagger
    ? apronHalfTenonH / 2 - apronWidth / 2
    : 0;
  const apronVisuallyStaggered = apronStaggerMm > 0;

  // 下橫撐 同樣套規則
  const lsY0 = lowerStretcherFromGround;
  const lsYCenter0 = lsY0 + lowerStretcherWidth / 2;
  // 2 對錯開：X 軸（前/後）那對保持 lowerStretcherFromGround，Z 軸（左/右）那對抬高 staggerMm
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
  // 下橫撐半榫錯位：靜止 X（前後）= 下榫；移動 Z（左右，上移）= 上榫；上下都不留肩
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
          // tenon 朝座板中心 radial 偏（X 軸=offsetWidth、Z 軸=offsetThickness）
          // 移除朝外那兩個肩，讓內側 2 邊貼腳邊、外側留肩防裂。
          offsetWidth: -sx * legTopRadialInset,
          offsetThickness: -sz * legTopRadialInset,
          shoulderOn: (() => {
            if (legTopRadialInset <= 0) return ["top", "bottom", "left", "right"] as const;
            // top position：left/right 對應 ±width(=X)；top/bottom 對應 ±thickness(=Z)
            const removeX: "left" | "right" = sx > 0 ? "left" : "right";
            const removeZ: "top" | "bottom" = sz > 0 ? "bottom" : "top";
            return (["top", "bottom", "left", "right"] as Array<"top" | "bottom" | "left" | "right">)
              .filter((s) => s !== removeX && s !== removeZ);
          })(),
        },
      ],
      // 上下橫撐各自加 X + Z 軸 mortise；沒開的不加
      // 牙板：靜止 Z（左右）= 上半榫；移動 X（前後，下移）= 下半榫
      // 下橫撐：靜止 X（前後）= 下半榫；移動 Z（左右，上移）= 上半榫
      // 圓腳系列強制 blind（曲面不可穿）；only 方/方錐/splayed-tapered 才允許 through
      mortises: [
        ...(withApron
          ? [
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
            ]
          : []),
        ...(withLowerStretcher
          ? [
              // X 面（前/後對, 靜止）— 下半榫
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
              // Z 面（左/右對, 抬高 staggerMm）— 上半榫
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
    const apronBottomScale = legBottomScale(legShape);
    const hasTaper = apronBottomScale !== 1;
    // 牙條錯開時 X 軸（前後）下移 apronStaggerMm；外斜時腳在更低處外傾更多——
    // X 軸跟 Z 軸要分別用各自的 Y 中心算 splay/span/trapezoid，否則接不到腳
    const apronStaggerY = apronVisuallyStaggered ? apronStaggerMm : 0;
    const apronGeomFor = (yCenter: number) => {
      const shift = legHeight > 0 ? 1 - yCenter / legHeight : 0;
      const dx = isSplayed ? splayDx * shift : 0;
      const dz = isSplayed ? splayDz * shift : 0;
      const yTop = yCenter + apronWidth / 2;
      const yBot = yCenter - apronWidth / 2;
      const legSizeC = legSize * legScaleAt(yCenter, legHeight, apronBottomScale);
      const legSizeTop = legSize * legScaleAt(yTop, legHeight, apronBottomScale);
      const legSizeBot = legSize * legScaleAt(yBot, legHeight, apronBottomScale);
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
    const sides = [
      { id: "apron-front", nameZh: "前橫撐", axis: "x" as const, sx: 0, sz: -1, origin: { x: 0, z: -(cornerOffset + apronGeomX.dz) } },
      { id: "apron-back", nameZh: "後橫撐", axis: "x" as const, sx: 0, sz: 1, origin: { x: 0, z: cornerOffset + apronGeomX.dz } },
      { id: "apron-left", nameZh: "左橫撐", axis: "z" as const, sx: -1, sz: 0, origin: { x: -(cornerOffset + apronGeomZ.dx), z: 0 } },
      { id: "apron-right", nameZh: "右橫撐", axis: "z" as const, sx: 1, sz: 0, origin: { x: cornerOffset + apronGeomZ.dx, z: 0 } },
    ];
    // half-bevel 條件：apronDropFromTop===0（牙板頂面貼椅面）才用 half-bevel 讓頂面水平
    const apronTopAtSeat = apronDropFromTop === 0;
    for (const s of sides) {
      const geom = s.axis === "x" ? apronGeomX : apronGeomZ;
      const rotation =
        s.axis === "z"
          ? { x: Math.PI / 2, y: Math.PI / 2, z: s.sx * tilt }
          : { x: Math.PI / 2 + (-s.sz) * tilt, y: 0, z: 0 };
      const bevelAngle = isSplayed
        ? s.axis === "x" ? -s.sz * tilt : -s.sx * tilt
        : 0;
      const useTopBevel = isSplayed && apronTopAtSeat;
      const partShape = hasTaper
        ? { kind: "apron-trapezoid" as const, topLengthScale: geom.trapTop, bottomLengthScale: geom.trapBot, bevelAngle: useTopBevel ? bevelAngle : undefined, bevelMode: useTopBevel ? "half" as const : undefined }
        : isSplayed && apronTopAtSeat
          ? { kind: "apron-half-beveled" as const, bevelAngle }
          : legEdgeShape(stretcherEdge, stretcherEdgeStyle);
      // tenon：A 半榫錯位 — 靜止 Z（左右）= 上榫；移動 X（前後，下移）= 下榫
      // tenon type 依自動規則 / legPenetratingTenon
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
      parts.push({
        id: s.id,
        nameZh: s.nameZh,
        material,
        grainDirection: "length",
        visible: { length: geom.span, width: apronWidth, thickness: apronThickness },
        // 前後（X 軸）牙板物理下移 apronStaggerMm；左右（Z）不動
        origin: { x: s.origin.x, y: apronY - (apronVisuallyStaggered && s.axis === "x" ? apronStaggerMm : 0), z: s.origin.z },
        rotation,
        shape: partShape,
        tenons,
        mortises: [],
      });
    }
  }

  // 4 條下橫撐——同邏輯但用 lowerStretcher* 參數，靠近地面
  if (withLowerStretcher) {
    const isSplayed = legShape.startsWith("splayed-");
    const tilt = isSplayed ? computeSplayGeometry(legHeight, splayAngle).apronTilt : 0;
    const lsBottomScale = legBottomScale(legShape);
    const lsHasTaper = lsBottomScale !== 1;
    // 下橫撐錯開時 Z 軸（左右）整支上移 lowerStretcherStaggerMm；X 軸（前後）保持原位
    // 外斜時腳在更高處外傾較少，Z 軸的 splay/span 要用上移後 Y 算
    const lsGeomFor = (yCenter: number) => {
      const shift = legHeight > 0 ? 1 - yCenter / legHeight : 0;
      const dx = isSplayed ? splayDx * shift : 0;
      const dz = isSplayed ? splayDz * shift : 0;
      const yTop = yCenter + lowerStretcherWidth / 2;
      const yBot = yCenter - lowerStretcherWidth / 2;
      const legSizeC = legSize * legScaleAt(yCenter, legHeight, lsBottomScale);
      const legSizeTop = legSize * legScaleAt(yTop, legHeight, lsBottomScale);
      const legSizeBot = legSize * legScaleAt(yBot, legHeight, lsBottomScale);
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
    // 下橫撐：trapezoid 是腳幾何要求（兩端縮到腳寬），但**永遠不 bevel**——
    // 上下都跟腳斜（自由邊），客戶手作不用切複合斜面。
    for (const s of lsSides) {
      const geom = s.axis === "x" ? lsGeomX : lsGeomZ;
      const rotation =
        s.axis === "z"
          ? { x: Math.PI / 2, y: Math.PI / 2, z: s.sx * tilt }
          : { x: Math.PI / 2 + (-s.sz) * tilt, y: 0, z: 0 };
      const partShape = lsHasTaper
        ? { kind: "apron-trapezoid" as const, topLengthScale: geom.trapTop, bottomLengthScale: geom.trapBot }
        : legEdgeShape(stretcherEdge, stretcherEdgeStyle);
      // 下橫撐 tenon：A 半榫錯位 — 靜止 X（前後）= 下榫；移動 Z（左右，上移）= 上榫
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
      parts.push({
        id: s.id,
        nameZh: s.nameZh,
        material,
        grainDirection: "length",
        visible: { length: geom.span, width: lowerStretcherWidth, thickness: lowerStretcherThickness },
        origin: { x: s.origin.x, y: s.axis === "z" ? lsY0_z : lsY0, z: s.origin.z },
        rotation,
        shape: partShape,
        tenons,
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
