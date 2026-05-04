import type {
  FurnitureDesign,
  FurnitureTemplate,
  OptionSpec,
  Part,
} from "@/lib/types";
import { getOption, opt } from "@/lib/types";
import {
  corners,
  seatEdgeOption,
  seatEdgeStyleOption,
  seatEdgeNote,
  seatEdgeShape,
  legEdgeOption,
  legEdgeStyleOption,
  legEdgeNote,
  legEdgeShape,
  stretcherEdgeOption,
  stretcherEdgeStyleOption,
  stretcherEdgeNote,
  topPanelPiecesOption,
  topPanelPiecesNote,
  legBottomScale,
  legScaleAt,
} from "./_helpers";
import { APRON_OFFSET_DEFAULT_MM } from "./_constants";
import { applyStandardChecks, appendSuggestion } from "./_validators";
import { standardTenon, autoTenonType } from "@/lib/joinery/standards";

export const teaTableOptions: OptionSpec[] = [
  { group: "leg", type: "select", key: "legShape", label: "腳樣式", defaultValue: "box", choices: [
    { value: "box", label: "直腳（方料）" },
    { value: "tapered", label: "錐形腳" },
  ] },
  { group: "leg", type: "number", key: "legSize", label: "桌腳粗 (mm)", defaultValue: 40, min: 20, max: 120, step: 2 },
  { group: "top", type: "number", key: "topThickness", label: "桌面厚 (mm)", defaultValue: 25, min: 12, max: 60, step: 1 },
  seatEdgeOption("top", 5),
  seatEdgeStyleOption("top"),
  topPanelPiecesOption("top"),
  legEdgeOption("leg", 1),
  legEdgeStyleOption("leg"),
  stretcherEdgeOption("stretcher", 1),
  stretcherEdgeStyleOption("stretcher"),
  { group: "apron", type: "number", key: "upperApronWidth", label: "上橫撐高 (mm)", defaultValue: 70, min: 30, max: 200, step: 5 },
  { group: "apron", type: "checkbox", key: "legPenetratingTenon", label: "腳上榫頭通透（明榫裝飾）", defaultValue: false, help: "勾選：上下橫撐進腳改通榫（榫頭穿透到腳另一面），明式裝飾感；未勾：依母件厚度自動規則（≤25mm 通榫、>25mm 盲榫深度=厚度2/3）" },
  { group: "top", type: "number", key: "shelfFloorOffset", label: "下棚板離地 (mm)", defaultValue: 80, min: 10, max: 400, step: 10 },
  { group: "top", type: "checkbox", key: "hasLowerShelf", label: "下棚板", defaultValue: true, help: "關閉則只保留下橫撐" },
  { group: "drawer", type: "select", key: "drawerCount", label: "前緣抽屜", defaultValue: "0", choices: [
    { value: "0", label: "無" },
    { value: "1", label: "1 個（全寬）" },
    { value: "2", label: "2 個（左右各一）" },
  ], help: "茶几前緣淺抽屜，藏遙控器、雜物。深度 50mm" },
  { group: "top", type: "checkbox", key: "liftTop", label: "升降桌面", defaultValue: false, help: "桌面可氣壓桿升起變小餐桌——需配 lift-top 五金組（兩支氣壓桿 + 摺疊鉸鏈，五金行有售）", wide: true },
  { group: "top", type: "checkbox", key: "liveEdge", label: "Live edge 原木邊", defaultValue: false, help: "桌面長邊保留原木樹皮曲線（風潮款，需用單片大板）", wide: true },
  { group: "top", type: "checkbox", key: "withCoasterInsets", label: "桌面嵌磁石杯墊孔", defaultValue: false, help: "桌面四角各挖 ⌀100×3mm 圓凹放磁石杯墊（防止杯子滑動）", wide: true },
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
 * 接合（套方凳 square-stool 規則）：
 *  - 桌腳 ↔ 桌面：autoTenonType（≤25mm 通榫、>25mm 盲榫）
 *  - 上下橫撐 ↔ 桌腳：autoTenonType + legPenetratingTenon override
 *  - 半榫錯位：Z（左右）= 上半榫（保留 10mm 上肩）、X（前後）= 下半榫（無上下肩）
 *  - 下棚板 ↔ 下橫撐：四邊出舌+槽（tongue and groove）
 */
export const teaTable: FurnitureTemplate = (input): FurnitureDesign => {
  const { length, width, height, material } = input;

  const o = teaTableOptions;
  const legShape = getOption<string>(input, opt(o, "legShape"));
  const legSize = getOption<number>(input, opt(o, "legSize"));
  const topThickness = getOption<number>(input, opt(o, "topThickness"));
  const seatEdge = getOption<number>(input, opt(o, "seatEdge"));
  const seatEdgeStyle = getOption<string>(input, opt(o, "seatEdgeStyle"));
  const topPanelPieces = parseInt(getOption<string>(input, opt(o, "topPanelPieces"))) || 1;
  const drawerCount = parseInt(getOption<string>(input, opt(o, "drawerCount"))) || 0;
  const liftTop = getOption<boolean>(input, opt(o, "liftTop"));
  const liveEdge = getOption<boolean>(input, opt(o, "liveEdge"));
  const legEdge = getOption<number>(input, opt(o, "legEdge"));
  const legEdgeStyle = getOption<string>(input, opt(o, "legEdgeStyle"));
  const stretcherEdge = getOption<number>(input, opt(o, "stretcherEdge"));
  const stretcherEdgeStyle = getOption<string>(input, opt(o, "stretcherEdgeStyle"));
  const upperApronWidth = getOption<number>(input, opt(o, "upperApronWidth"));
  const stretcherFloorOffset = getOption<number>(input, opt(o, "shelfFloorOffset"));
  const hasLowerShelf = getOption<boolean>(input, opt(o, "hasLowerShelf"));
  const legPenetratingTenon = getOption<boolean>(input, opt(o, "legPenetratingTenon"));
  const upperApronThickness = 22;
  const lowerStretcherWidth = 50;
  const lowerStretcherThickness = 22;
  const shelfThickness = 18;
  const shelfTongueLen = 8;

  // ---- 榫卯標準（套自 square-stool / simple-table builder）----
  // 1) leg ↔ top：依自動規則（topThickness ≤ 25 → 通榫；> 25 → 盲榫深 2/3）
  const legTopTenonType = autoTenonType(topThickness);
  const legTenonStd = standardTenon({
    type: legTopTenonType,
    childThickness: legSize,
    childWidth: legSize,
    motherThickness: topThickness,
  });

  // 2) upper apron ↔ leg：依自動規則 + legPenetratingTenon override
  const apronTenonType = legPenetratingTenon ? "through-tenon" : autoTenonType(legSize);
  const apronTenonStd = standardTenon({
    type: apronTenonType === "through-tenon" ? "through-tenon" : "shouldered-tenon",
    childThickness: upperApronThickness,
    childWidth: upperApronWidth,
    motherThickness: legSize,
  });
  // 通榫補 +5mm 補償斜腳 rotation tilt（茶几沒 splay，但保留規則一致）
  const apronTenonLength = apronTenonStd.length + (apronTenonType === "through-tenon" ? 5 : 0);
  const apronTenonThick = apronTenonStd.thickness;
  const apronTenonW = apronTenonStd.width;
  // 半榫錯位（無 stagger UI，預設 0 → 直接走半榫）
  const APRON_TOP_SHOULDER = 10;
  const APRON_HALF_TENON_GAP = 4;
  const apronTotalTenonH = upperApronWidth - APRON_TOP_SHOULDER;
  const apronCanHalfStagger = apronTotalTenonH >= 16;
  const apronHalfTenonH = apronCanHalfStagger
    ? Math.min(apronTenonW, Math.floor((apronTotalTenonH - APRON_HALF_TENON_GAP) / 2))
    : apronTenonW;
  // part-local：apron Y 從 0 (底) 到 apronWidth (頂)；中心 = apronWidth/2
  const apronUpperTenonOffset = apronCanHalfStagger
    ? (upperApronWidth - APRON_TOP_SHOULDER - apronHalfTenonH / 2) - upperApronWidth / 2
    : 0;
  const apronLowerTenonOffset = apronCanHalfStagger
    ? apronHalfTenonH / 2 - upperApronWidth / 2
    : 0;

  // 3) lower stretcher ↔ leg：同自動規則 + legPenetratingTenon override
  const lowerTenonType = legPenetratingTenon ? "through-tenon" : autoTenonType(legSize);
  const lowerTenonStd = standardTenon({
    type: lowerTenonType,
    childThickness: lowerStretcherThickness,
    childWidth: lowerStretcherWidth,
    motherThickness: legSize,
  });
  const lowerTenonLength = lowerTenonStd.length + (lowerTenonType === "through-tenon" ? 5 : 0);
  const lowerTenonThick = lowerTenonStd.thickness;
  const lowerTenonW = lowerTenonStd.width;
  // 下橫撐半榫錯位（上下都無肩）
  const LOWER_HALF_TENON_GAP = 4;
  const lowerCanHalfStagger = lowerStretcherWidth >= 16;
  const lowerHalfTenonH = lowerCanHalfStagger
    ? Math.min(lowerTenonW, Math.floor((lowerStretcherWidth - LOWER_HALF_TENON_GAP) / 2))
    : lowerTenonW;
  const lowerUpperTenonOffset = lowerCanHalfStagger
    ? (lowerStretcherWidth / 2 - lowerHalfTenonH / 2)
    : 0;
  const lowerLowerTenonOffset = lowerCanHalfStagger
    ? (lowerHalfTenonH / 2 - lowerStretcherWidth / 2)
    : 0;

  const legHeight = height - topThickness;
  const upperApronY = legHeight - upperApronWidth - APRON_OFFSET_DEFAULT_MM;
  // 半榫指派的世界 Y 中心
  const apronCenterY = upperApronY + upperApronWidth / 2;
  const lowerCenterY = stretcherFloorOffset + lowerStretcherWidth / 2;

  const cornerPts = corners(length, width, legSize);

  // tapered 補償（apron 三條 Y 位置各自的腳寬）
  const bottomScale = legBottomScale(legShape);
  const apronLegSizeCenter = legSize * legScaleAt(apronCenterY, legHeight, bottomScale);
  const apronLegSizeTop = legSize * legScaleAt(upperApronY + upperApronWidth, legHeight, bottomScale);
  const apronLegSizeBot = legSize * legScaleAt(upperApronY, legHeight, bottomScale);
  const lowerLegSizeCenter = legSize * legScaleAt(lowerCenterY, legHeight, bottomScale);
  const lowerLegSizeTop = legSize * legScaleAt(stretcherFloorOffset + lowerStretcherWidth, legHeight, bottomScale);
  const lowerLegSizeBot = legSize * legScaleAt(stretcherFloorOffset, legHeight, bottomScale);
  const hasShapeBend = bottomScale !== 1;

  // ----- 桌面板 -----
  const topPanel: Part = {
    id: "top",
    nameZh: "桌面板",
    material,
    grainDirection: "length",
    visible: { length, width, thickness: topThickness },
    origin: { x: 0, y: legHeight, z: 0 },
    shape: liveEdge ? { kind: "live-edge", amplitudeMm: 12 } : seatEdgeShape(seatEdge, seatEdgeStyle),
    panelPieces: topPanelPieces,
    tenons: [],
    mortises: cornerPts.map((c) => ({
      origin: { x: c.x, y: 0, z: c.z },
      depth: legTenonStd.length,
      length: legTenonStd.width,
      width: legTenonStd.thickness,
      through: legTopTenonType === "through-tenon",
    })),
  };

  // ----- 4 桌腳 -----
  // mortise 半榫指派：Z 面（接左右橫撐）= 上半榫；X 面（接前後橫撐）= 下半榫
  const apronThrough = apronTenonType === "through-tenon";
  const lowerThrough = lowerTenonType === "through-tenon";
  const legs: Part[] = cornerPts.map((c, i) => ({
    id: `leg-${i + 1}`,
    nameZh: `桌腳 ${i + 1}`,
    material,
    grainDirection: "length",
    visible: { length: legSize, width: legSize, thickness: legHeight },
    origin: { x: c.x, y: 0, z: c.z },
    shape: legShape === "tapered" ? { kind: "tapered", bottomScale: 0.55 } : legEdgeShape(legEdge, legEdgeStyle),
    tenons: [
      {
        position: "top",
        type: legTopTenonType === "through-tenon" ? "through-tenon" : "blind-tenon",
        length: legTenonStd.length,
        width: legTenonStd.width,
        thickness: legTenonStd.thickness,
      },
    ],
    mortises: [
      // 上橫撐 Z 面（接左右上橫撐）— 上半榫
      {
        origin: { x: 0, y: apronCenterY + apronUpperTenonOffset, z: c.z > 0 ? -1 : 1 },
        depth: apronTenonLength,
        length: apronCanHalfStagger ? apronHalfTenonH : apronTenonW,
        width: apronTenonThick,
        through: apronThrough,
      },
      // 上橫撐 X 面（接前後上橫撐）— 下半榫
      {
        origin: { x: c.x > 0 ? -1 : 1, y: apronCenterY + apronLowerTenonOffset, z: 0 },
        depth: apronTenonLength,
        length: apronCanHalfStagger ? apronHalfTenonH : apronTenonW,
        width: apronTenonThick,
        through: apronThrough,
      },
      // 下橫撐 Z 面（接左右下橫撐）— 上半榫
      {
        origin: { x: 0, y: lowerCenterY + lowerUpperTenonOffset, z: c.z > 0 ? -1 : 1 },
        depth: lowerTenonLength,
        length: lowerCanHalfStagger ? lowerHalfTenonH : lowerTenonW,
        width: lowerTenonThick,
        through: lowerThrough,
      },
      // 下橫撐 X 面（接前後下橫撐）— 下半榫
      {
        origin: { x: c.x > 0 ? -1 : 1, y: lowerCenterY + lowerLowerTenonOffset, z: 0 },
        depth: lowerTenonLength,
        length: lowerCanHalfStagger ? lowerHalfTenonH : lowerTenonW,
        width: lowerTenonThick,
        through: lowerThrough,
      },
    ],
  }));

  // ----- 上橫撐 / 下橫撐 共用建構 -----
  const apronEdgeX = length / 2 - legSize / 2;
  const apronEdgeZ = width / 2 - legSize / 2;

  // butt-half 計算（給 trapezoid scale 用）
  const apronButtHalfX = apronEdgeX - apronLegSizeCenter / 2;
  const apronButtHalfZ = apronEdgeZ - apronLegSizeCenter / 2;
  const apronButtHalfXTop = apronEdgeX - apronLegSizeTop / 2;
  const apronButtHalfXBot = apronEdgeX - apronLegSizeBot / 2;
  const apronButtHalfZTop = apronEdgeZ - apronLegSizeTop / 2;
  const apronButtHalfZBot = apronEdgeZ - apronLegSizeBot / 2;
  const apronTrapTopScaleX = hasShapeBend ? apronButtHalfXTop / apronButtHalfX : null;
  const apronTrapBotScaleX = hasShapeBend ? apronButtHalfXBot / apronButtHalfX : 1;
  const apronTrapTopScaleZ = hasShapeBend ? apronButtHalfZTop / apronButtHalfZ : null;
  const apronTrapBotScaleZ = hasShapeBend ? apronButtHalfZBot / apronButtHalfZ : 1;

  const lowerButtHalfX = apronEdgeX - lowerLegSizeCenter / 2;
  const lowerButtHalfZ = apronEdgeZ - lowerLegSizeCenter / 2;
  const lowerButtHalfXTop = apronEdgeX - lowerLegSizeTop / 2;
  const lowerButtHalfXBot = apronEdgeX - lowerLegSizeBot / 2;
  const lowerButtHalfZTop = apronEdgeZ - lowerLegSizeTop / 2;
  const lowerButtHalfZBot = apronEdgeZ - lowerLegSizeBot / 2;
  const lowerTrapTopScaleX = hasShapeBend ? lowerButtHalfXTop / lowerButtHalfX : null;
  const lowerTrapBotScaleX = hasShapeBend ? lowerButtHalfXBot / lowerButtHalfX : 1;
  const lowerTrapTopScaleZ = hasShapeBend ? lowerButtHalfZTop / lowerButtHalfZ : null;
  const lowerTrapBotScaleZ = hasShapeBend ? lowerButtHalfZBot / lowerButtHalfZ : 1;

  // butt-joint span：用 legSize（非 taper 補償後寬度），維持與下棚板 tongue 長度耦合
  // tapered 補償交給 trapezoid topScale/botScale 處理（兩端視覺收窄）
  const apronInnerSpan = {
    x: length - 2 * legSize,
    z: width - 2 * legSize,
  };
  const lowerInnerSpan = apronInnerSpan;

  const upperAprons: Part[] = makeApronRing({
    idPrefix: "upper-apron",
    nameZhPrefix: "上橫撐",
    span: apronInnerSpan,
    overallLength: length,
    overallWidth: width,
    legSize,
    material,
    apronWidth: upperApronWidth,
    apronThickness: upperApronThickness,
    tenonLength: apronTenonLength,
    tenonThickness: apronTenonThick,
    tenonWidth: apronTenonW,
    tenonType: apronTenonType === "through-tenon" ? "through-tenon" : "shouldered-tenon",
    canHalfStagger: apronCanHalfStagger,
    halfTenonH: apronHalfTenonH,
    upperTenonOffset: apronUpperTenonOffset,
    lowerTenonOffset: apronLowerTenonOffset,
    // 上橫撐：上半榫保留 top + left/right 肩；下半榫只有 left/right
    upperShoulderOn: ["top", "left", "right"],
    lowerShoulderOn: ["left", "right"],
    y: upperApronY,
    trapTopScaleX: apronTrapTopScaleX,
    trapBotScaleX: apronTrapBotScaleX,
    trapTopScaleZ: apronTrapTopScaleZ,
    trapBotScaleZ: apronTrapBotScaleZ,
    fallbackShape: legEdgeShape(stretcherEdge, stretcherEdgeStyle),
    extraMortises: () => [],
  });

  const lowerStretchers: Part[] = makeApronRing({
    idPrefix: "lower-stretcher",
    nameZhPrefix: "下橫撐",
    span: lowerInnerSpan,
    overallLength: length,
    overallWidth: width,
    legSize,
    material,
    apronWidth: lowerStretcherWidth,
    apronThickness: lowerStretcherThickness,
    tenonLength: lowerTenonLength,
    tenonThickness: lowerTenonThick,
    tenonWidth: lowerTenonW,
    tenonType: lowerTenonType === "through-tenon" ? "through-tenon" : "shouldered-tenon",
    canHalfStagger: lowerCanHalfStagger,
    halfTenonH: lowerHalfTenonH,
    upperTenonOffset: lowerUpperTenonOffset,
    lowerTenonOffset: lowerLowerTenonOffset,
    // 下橫撐：上下都不留肩，僅 left/right
    upperShoulderOn: ["left", "right"],
    lowerShoulderOn: ["left", "right"],
    y: stretcherFloorOffset,
    trapTopScaleX: lowerTrapTopScaleX,
    trapBotScaleX: lowerTrapBotScaleX,
    trapTopScaleZ: lowerTrapTopScaleZ,
    trapBotScaleZ: lowerTrapBotScaleZ,
    fallbackShape: legEdgeShape(stretcherEdge, stretcherEdgeStyle),
    // 內側面開長槽，棚板舌頭嵌入
    extraMortises: (visibleLength) => [
      {
        origin: { x: 0, y: 0, z: 0 },
        depth: shelfTongueLen,
        length: visibleLength - 4,
        width: shelfThickness,
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

  // 茶几前緣抽屜（淺型，藏遙控器）。掛在前牙板下方
  const drawerParts: Part[] = [];
  if (drawerCount > 0) {
    const drawerHeight = 50;
    const drawerDepth = Math.min(width - 80, 280); // Z 方向深度
    const drawerY = upperApronY - drawerHeight - 5; // 牙板下緣 -5mm 留間隙
    const drawerFaceThick = 18;
    // 抽屜面板 Z 位置：與前牙板前面平齊
    const apronFrontZ = -(width / 2 - legSize / 2) - upperApronThickness / 2;
    const drawerFaceZ = apronFrontZ - drawerFaceThick / 2;
    const innerSpan = length - 2 * legSize - 20;
    const slotW = drawerCount === 1 ? innerSpan : innerSpan / 2 - 5;
    for (let i = 0; i < drawerCount; i++) {
      const xCenter = drawerCount === 1
        ? 0
        : (i === 0 ? -1 : 1) * (slotW / 2 + 2.5);
      drawerParts.push({
        id: `tea-drawer-${i + 1}-front`,
        nameZh: `淺抽屜${i + 1} 面板`,
        material,
        grainDirection: "length",
        visible: { length: slotW - 4, width: drawerHeight - 4, thickness: drawerFaceThick },
        origin: { x: xCenter, y: drawerY + 2, z: drawerFaceZ },
        rotation: { x: Math.PI / 2, y: 0, z: 0 },
        tenons: [],
        mortises: [],
      });
    }
  }

  const design: FurnitureDesign = {
    id: `tea-table-${length}x${width}x${height}`,
    category: "tea-table",
    nameZh: "茶几",
    overall: { length, width, thickness: height },
    parts: [
      topPanel,
      ...legs,
      ...upperAprons,
      ...lowerStretchers,
      ...(hasLowerShelf ? [lowerShelf] : []),
      ...drawerParts,
    ],
    defaultJoinery: "blind-tenon",
    useButtJointConvention: true,
    primaryMaterial: material,
    notes:
      `桌面與桌腳依母厚自動榫；上下橫撐與桌腳半榫錯位（Z 上半 / X 下半）；下棚板四邊出舌嵌入下橫撐長槽。${seatEdgeNote(seatEdge, seatEdgeStyle)}${legEdgeNote(legEdge, legEdgeStyle)}${stretcherEdgeNote(stretcherEdge, stretcherEdgeStyle)}${topPanelPiecesNote(topPanelPieces, width)}${drawerCount > 0 ? ` 含 ${drawerCount} 個前緣淺抽屜（每個配 350mm 塑膠滑軌一對）。` : ""}${liftTop ? " 桌面可升降——需配 lift-top 五金組（兩支氣壓桿 + 摺疊鉸鏈一對，五金行有售）。" : ""}${liveEdge ? " Live edge 原木邊（保留樹皮曲線）。" : ""}${(() => { const ci = getOption<boolean>(input, opt(o, "withCoasterInsets")); return ci ? " 桌面四角各挖 ⌀100×3mm 圓凹嵌磁石杯墊。" : ""; })()}`,
  };
  // 桌面磁石杯墊孔：4 角各挖 ⌀100×3mm 圓凹
  const withCoasterInsets = getOption<boolean>(input, opt(o, "withCoasterInsets"));
  if (withCoasterInsets) {
    const topPart = design.parts.find((p) => p.id === "top");
    if (topPart) {
      const topL = topPart.visible.length;
      const topW = topPart.visible.width;
      const off = 70;
      const newM = [...topPart.mortises];
      for (const sx of [-1, 1])
        for (const sz of [-1, 1])
          newM.push({ origin: { x: sx * (topL / 2 - off), y: 0, z: sz * (topW / 2 - off) }, depth: 3, length: 100, width: 100, through: false });
      topPart.mortises = newM;
    }
  }

  applyStandardChecks(design, {
    minLength: 400, minWidth: 400, minHeight: 250,
    maxLength: 1200, maxWidth: 900, maxHeight: 500,
  });
  if (input.height > 500) {
    appendSuggestion(design, {
      text: `桌高 ${input.height}mm 已不算茶几——餐桌模板有完整中央橫撐 / 牙板厚度等選項。`,
      suggestedCategory: "dining-table",
      presetParams: { length: input.length, width: input.width, height: input.height, material: input.material },
    });
  } else if (input.length > 1200 || input.width > 900) {
    appendSuggestion(design, {
      text: `${input.length}×${input.width}mm 較大——矮桌模板支援更大尺寸 + 中央橫撐。`,
      suggestedCategory: "low-table",
      presetParams: { length: input.length, width: input.width, height: input.height, material: input.material },
    });
  }
  return design;
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
  tenonThickness: number;
  tenonWidth: number;
  tenonType: "through-tenon" | "shouldered-tenon";
  canHalfStagger: boolean;
  halfTenonH: number;
  upperTenonOffset: number;
  lowerTenonOffset: number;
  upperShoulderOn: Array<"top" | "bottom" | "left" | "right">;
  lowerShoulderOn: Array<"top" | "bottom" | "left" | "right">;
  y: number;
  trapTopScaleX: number | null;
  trapBotScaleX: number;
  trapTopScaleZ: number | null;
  trapBotScaleZ: number;
  fallbackShape?: Part["shape"];
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

  return sides.map((s) => {
    // 半榫指派：Z 軸（左右）= 上半榫；X 軸（前後）= 下半榫
    const isUpper = s.axis === "z";
    const tenonH = o.canHalfStagger ? o.halfTenonH : o.tenonWidth;
    const worldOffset = o.canHalfStagger
      ? (isUpper ? o.upperTenonOffset : o.lowerTenonOffset)
      : 0;
    const shoulderOn = o.canHalfStagger
      ? (isUpper ? o.upperShoulderOn : o.lowerShoulderOn)
      : ["top", "bottom", "left", "right"] as Array<"top" | "bottom" | "left" | "right">;
    // trapezoid 形狀（如有 tapered）
    const trapTopScale = s.axis === "x" ? o.trapTopScaleX : o.trapTopScaleZ;
    const trapBotScale = s.axis === "x" ? o.trapBotScaleX : o.trapBotScaleZ;
    const partShape: Part["shape"] = trapTopScale !== null
      ? { kind: "apron-trapezoid" as const, topLengthScale: trapTopScale, bottomLengthScale: trapBotScale }
      : o.fallbackShape;
    return {
      id: `${o.idPrefix}-${s.key}`,
      nameZh: `${s.nameZh}${o.nameZhPrefix}`,
      material: o.material,
      grainDirection: "length" as const,
      visible: {
        length: s.visibleLength,
        width: o.apronWidth,
        thickness: o.apronThickness,
      },
      origin: { x: s.origin.x, y: o.y, z: s.origin.z },
      rotation: s.axis === "z"
        ? { x: Math.PI / 2, y: Math.PI / 2, z: 0 }
        : { x: Math.PI / 2, y: 0, z: 0 },
      shape: partShape,
      tenons: [
        {
          position: "start",
          type: o.tenonType,
          length: o.tenonLength,
          width: tenonH,
          thickness: o.tenonThickness,
          shoulderOn: [...shoulderOn],
          offsetWidth: -worldOffset,
        },
        {
          position: "end",
          type: o.tenonType,
          length: o.tenonLength,
          width: tenonH,
          thickness: o.tenonThickness,
          shoulderOn: [...shoulderOn],
          offsetWidth: -worldOffset,
        },
      ],
      mortises: o.extraMortises(s.visibleLength),
    };
  });
}
