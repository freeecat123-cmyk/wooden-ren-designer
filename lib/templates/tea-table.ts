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
  legBottomScale,
  legScaleAt,
} from "./_helpers";
import { applyStandardChecks, appendSuggestion } from "./_validators";
import { standardTenon, autoTenonType } from "@/lib/joinery/standards";

export const teaTableOptions: OptionSpec[] = [
  { group: "leg", type: "select", key: "legShape", label: "腳樣式", defaultValue: "box", choices: [
    { value: "box", label: "直腳（方料）" },
    { value: "tapered", label: "錐形腳" },
  ] },
  { group: "leg", type: "number", key: "legSize", label: "桌腳粗 (mm)", defaultValue: 40, min: 20, max: 120, step: 2 },
  { group: "leg", type: "number", key: "legInset", label: "桌腳內縮 (mm)", defaultValue: 0, min: 0, max: 200, step: 5, help: "桌腳往內移，形成 reveal。0 = 與桌面邊緣齊平" },
  { group: "top", type: "number", key: "topThickness", label: "桌面厚 (mm)", defaultValue: 25, min: 12, max: 60, step: 1 },
  { group: "top", type: "select", key: "dropLeaf", label: "翻板（drop-leaf）", defaultValue: "none", choices: [
    { value: "none", label: "無" },
    { value: "one-side", label: "單側翻板" },
    { value: "two-sides", label: "雙側翻板" },
  ], help: "桌面長邊用蝶式鉸鏈加可摺疊延伸板。配 1.5\" 鋼製蝶式鉸鏈" },
  { group: "top", type: "number", key: "dropLeafWidth", label: "翻板寬 (mm)", defaultValue: 200, min: 150, max: 400, step: 25, dependsOn: { key: "dropLeaf", notIn: ["none"] } },
  seatEdgeOption("top", 5),
  seatEdgeStyleOption("top"),
  legEdgeOption("leg", 1),
  legEdgeStyleOption("leg"),
  stretcherEdgeOption("stretcher", 1),
  stretcherEdgeStyleOption("stretcher"),
  { group: "apron", type: "number", key: "upperApronWidth", label: "上橫撐高 (mm)", defaultValue: 70, min: 30, max: 200, step: 5 },
  { group: "apron", type: "number", key: "upperApronThickness", label: "上橫撐厚 (mm)", defaultValue: 22, min: 12, max: 50, step: 1 },
  { group: "apron", type: "number", key: "apronOffset", label: "牙板距桌面 (mm)", defaultValue: 0, min: 0, max: 200, step: 5, help: "牙板頂緣往下退離桌面下緣的距離。0 = 貼齊" },
  { group: "apron", type: "checkbox", key: "legPenetratingTenon", label: "腳上榫頭通透（明榫裝飾）", defaultValue: false, help: "勾選：上下橫撐進腳改通榫（榫頭穿透到腳另一面），明式裝飾感；未勾：依母件厚度自動規則（≤25mm 通榫、>25mm 盲榫深度=厚度2/3）" },
  { group: "apron", type: "number", key: "apronStaggerMm", label: "牙板錯開 (mm)", defaultValue: 0, min: 0, max: 80, step: 2, unit: "mm", help: "前後牙板（X 軸）相對左右下移量。0 = 等高（自動上下半榫）" },
  { group: "stretcher", type: "number", key: "lowerStretcherWidth", label: "下橫撐高 (mm)", defaultValue: 50, min: 20, max: 150, step: 5 },
  { group: "stretcher", type: "number", key: "lowerStretcherThickness", label: "下橫撐厚 (mm)", defaultValue: 22, min: 12, max: 50, step: 1 },
  { group: "stretcher", type: "number", key: "lowerStretcherHeight", label: "下橫撐離地高 (mm)", defaultValue: 80, min: 10, max: 400, step: 10, help: "下橫撐底面距地高度" },
  { group: "stretcher", type: "number", key: "lowerStretcherStaggerMm", label: "下橫撐錯開 (mm)", defaultValue: 0, min: 0, max: 80, step: 2, unit: "mm", help: "左右下橫撐（Z 軸）相對前後上移量。0 = 等高（自動上下半榫）；> 0 時下棚板四邊長槽會跟著移動，建議搭配關閉下棚板" },
  { group: "top", type: "checkbox", key: "hasLowerShelf", label: "下棚板", defaultValue: true, help: "關閉則只保留下橫撐" },
  { group: "top", type: "checkbox", key: "liveEdge", label: "Live edge 原木邊", defaultValue: false, help: "桌面長邊保留原木樹皮曲線（風潮款，需用單片大板）", wide: true },
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
  const liveEdge = getOption<boolean>(input, opt(o, "liveEdge"));
  const legEdge = getOption<number>(input, opt(o, "legEdge"));
  const legEdgeStyle = getOption<string>(input, opt(o, "legEdgeStyle"));
  const stretcherEdge = getOption<number>(input, opt(o, "stretcherEdge"));
  const stretcherEdgeStyle = getOption<string>(input, opt(o, "stretcherEdgeStyle"));
  const upperApronWidth = getOption<number>(input, opt(o, "upperApronWidth"));
  const upperApronThickness = getOption<number>(input, opt(o, "upperApronThickness"));
  const apronOffset = getOption<number>(input, opt(o, "apronOffset"));
  const stretcherFloorOffset = getOption<number>(input, opt(o, "lowerStretcherHeight"));
  const hasLowerShelf = getOption<boolean>(input, opt(o, "hasLowerShelf"));
  const legPenetratingTenon = getOption<boolean>(input, opt(o, "legPenetratingTenon"));
  const apronStaggerMm = getOption<number>(input, opt(o, "apronStaggerMm"));
  const lowerStretcherStaggerMm = getOption<number>(input, opt(o, "lowerStretcherStaggerMm"));
  const lowerStretcherWidth = getOption<number>(input, opt(o, "lowerStretcherWidth"));
  const lowerStretcherThickness = getOption<number>(input, opt(o, "lowerStretcherThickness"));
  const legInset = getOption<number>(input, opt(o, "legInset"));
  const dropLeaf = getOption<string>(input, opt(o, "dropLeaf"));
  const dropLeafWidth = getOption<number>(input, opt(o, "dropLeafWidth"));
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
  // legInset === 0（腳跟桌面端切齊）→ tenon 沿 X 軸朝中心偏；legInset > 0 不偏
  const legTopInsetX = legInset === 0
    ? Math.max(0, Math.round((legSize - legTenonStd.width) / 2))
    : 0;

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
  // 半榫錯位（連續位移）：
  //   stagger > 0 → 前後牙板（X 軸）整支物理下移，榫頭整支跟著（中心榫）
  //   stagger == 0 → 自動上下半榫錯位避免同位撞
  const APRON_TOP_SHOULDER = 10;
  const APRON_HALF_TENON_GAP = 4;
  const apronTotalTenonH = upperApronWidth - APRON_TOP_SHOULDER;
  const apronVisuallyStaggered = apronStaggerMm > 0;
  const apronCanHalfStagger = apronStaggerMm < apronTenonW && apronTotalTenonH >= 16;
  const apronHalfTenonH = apronCanHalfStagger
    ? Math.min(apronTenonW, Math.floor((apronTotalTenonH + apronStaggerMm - APRON_HALF_TENON_GAP) / 2))
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
  // 下橫撐半榫錯位（連續位移）：
  //   stagger > 0 → 左右下橫撐（Z 軸）整支物理上移，榫頭整支跟著
  //   stagger == 0 → 自動上下半榫錯位
  const LOWER_HALF_TENON_GAP = 4;
  const lowerVisuallyStaggered = lowerStretcherStaggerMm > 0;
  const lowerCanHalfStagger = lowerStretcherStaggerMm < lowerTenonW && lowerStretcherWidth >= 16;
  const lowerHalfTenonH = lowerCanHalfStagger
    ? Math.min(lowerTenonW, Math.floor((lowerStretcherWidth + lowerStretcherStaggerMm - LOWER_HALF_TENON_GAP) / 2))
    : lowerTenonW;
  const lowerUpperTenonOffset = lowerCanHalfStagger
    ? (lowerStretcherWidth / 2 - lowerHalfTenonH / 2)
    : 0;
  const lowerLowerTenonOffset = lowerCanHalfStagger
    ? (lowerHalfTenonH / 2 - lowerStretcherWidth / 2)
    : 0;

  const legHeight = height - topThickness;
  const upperApronY = legHeight - upperApronWidth - apronOffset;
  // 半榫指派的世界 Y 中心
  const apronCenterY = upperApronY + upperApronWidth / 2;
  const lowerCenterY = stretcherFloorOffset + lowerStretcherWidth / 2;

  const cornerPts = corners(length, width, legSize, legInset);

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
  const topLen = length;
  const topWid = width;
  const topPanel: Part = {
    id: "top",
    nameZh: "桌面板",
    material,
    grainDirection: "length",
    visible: { length: topLen, width: topWid, thickness: topThickness },
    origin: { x: 0, y: legHeight, z: 0 },
    shape: liveEdge ? { kind: "live-edge", amplitudeMm: 12 } : seatEdgeShape(seatEdge, seatEdgeStyle),
    tenons: [],
    mortises: cornerPts.map((c) => ({
      // legInset=0 → mortise 跟 tenon 一起朝中心偏
      origin: { x: c.x - Math.sign(c.x) * legTopInsetX, y: 0, z: c.z },
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
        // legInset=0 → tenon 朝家具中心偏，移除內側肩
        shoulderOn: (() => {
          if (legTopInsetX <= 0 || c.x === 0) return [...legTenonStd.shoulderOn];
          const innerSide: "left" | "right" = c.x > 0 ? "left" : "right";
          return [...legTenonStd.shoulderOn].filter((s) => s !== innerSide);
        })(),
        offsetWidth: -Math.sign(c.x) * legTopInsetX,
      },
    ],
    mortises: [
      // 上橫撐 Z 面（接左右上橫撐, 靜止）— 上半榫
      {
        origin: { x: 0, y: apronCenterY + apronUpperTenonOffset, z: c.z > 0 ? -1 : 1 },
        depth: apronTenonLength,
        length: apronCanHalfStagger ? apronHalfTenonH : apronTenonW,
        width: apronTenonThick,
        through: apronThrough,
      },
      // 上橫撐 X 面（接前後上橫撐, 物理下移 apronStaggerMm）— 下半榫
      {
        origin: { x: c.x > 0 ? -1 : 1, y: apronCenterY - apronStaggerMm + apronLowerTenonOffset, z: 0 },
        depth: apronTenonLength,
        length: apronCanHalfStagger ? apronHalfTenonH : apronTenonW,
        width: apronTenonThick,
        through: apronThrough,
      },
      // 下橫撐 Z 面（接左右下橫撐, 物理上移 lowerStretcherStaggerMm）— 上半榫
      {
        origin: { x: 0, y: lowerCenterY + lowerStretcherStaggerMm + lowerUpperTenonOffset, z: c.z > 0 ? -1 : 1 },
        depth: lowerTenonLength,
        length: lowerCanHalfStagger ? lowerHalfTenonH : lowerTenonW,
        width: lowerTenonThick,
        through: lowerThrough,
      },
      // 下橫撐 X 面（接前後下橫撐, 靜止）— 下半榫
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
  // legInset > 0 時腳中心向內移，apronEdge（= 腳中心 X）對應減
  const apronEdgeX = length / 2 - legSize / 2 - legInset;
  const apronEdgeZ = width / 2 - legSize / 2 - legInset;

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

  // butt-joint span：兩端各扣「leg 中心點 X 距離 + leg 在該 Y 的半寬」
  //   = length/2 - legSize/2（leg 中心）+ legSizeAtY/2（leg 半寬）
  //   → length - legSize - legSizeAtY
  // 上橫撐用 apron Y 位置的 leg 寬（高處幾乎=legSize）；下橫撐用 stretcher Y
  // 位置的 leg 寬（錐形腳在低處變細，要扣較少才會頂到 leg 內側）
  // 兩端各扣（leg 中心 X 距離 + leg 該 Y 半寬）= length/2 - legSize/2 - legInset + legSizeAtY/2
  // → length - legSize - 2*legInset - legSizeAtY
  const apronInnerSpan = {
    x: length - legSize - 2 * legInset - apronLegSizeCenter,
    z: width - legSize - 2 * legInset - apronLegSizeCenter,
  };
  const lowerInnerSpan = {
    x: length - legSize - 2 * legInset - lowerLegSizeCenter,
    z: width - legSize - 2 * legInset - lowerLegSizeCenter,
  };

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
    // 前後牙板（X 軸）整支物理下移 apronStaggerMm；左右（Z 軸）不動
    xAxisYDelta: -apronStaggerMm,
    zAxisYDelta: 0,
    legInset,
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
    // 棚板放在橫撐上面（rest-on，跟 bench under-shelf 同設計）→ 橫撐不開槽
    extraMortises: () => [],
    // 左右下橫撐（Z 軸）整支物理上移 lowerStretcherStaggerMm；前後（X 軸）不動
    xAxisYDelta: 0,
    zAxisYDelta: lowerStretcherStaggerMm,
    legInset,
  });

  // ----- 下棚板 -----
  // 設計：棚板放在四向下橫撐的「上面」，跟 bench under-shelf 同概念（rest-on）。
  // 棚板長/寬 = 橫撐 outer-to-outer 距離（橫撐外側面=length/2-legSize/2+thickness/2），
  // 四角缺角 (notched-corners) 讓開腳柱位置。橫撐不開槽，棚板靠重力 + 木鞘卡住。
  // 橫撐 outer face X = 腳中心 X + 橫撐厚/2，腳中心已含 legInset 偏移
  const stretcherOuterX = length / 2 - legSize / 2 - legInset + lowerStretcherThickness / 2;
  const stretcherOuterZ = width / 2 - legSize / 2 - legInset + lowerStretcherThickness / 2;
  const shelfLength = 2 * stretcherOuterX; // = length - legSize + lowerStretcherThickness
  const shelfWidth = 2 * stretcherOuterZ;
  // 缺角尺寸：腳的 X/Z 範圍跟棚板邊緣 overlap = (legSize + stretcherThickness)/2
  const notchLen = (legSize + lowerStretcherThickness) / 2;
  const notchWid = (legSize + lowerStretcherThickness) / 2;
  // 棚板 Y = 橫撐頂面（origin.y 是棚板 bottom 在 world 的位置）
  const shelfY = stretcherFloorOffset + lowerStretcherWidth;

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
    shape: { kind: "notched-corners", notchLengthMm: notchLen, notchWidthMm: notchWid },
    tenons: [],
    mortises: [],
  };

  // 翻板（drop-leaf）：沿 length 軸 ±X 端延伸，蝶式鉸鏈接
  const dropLeafParts: Part[] = [];
  if (dropLeaf !== "none") {
    const sides = dropLeaf === "two-sides" ? [-1, 1] as const : [1] as const;
    for (const sx of sides) {
      dropLeafParts.push({
        id: `drop-leaf-${sx < 0 ? "left" : "right"}`,
        nameZh: `${sx < 0 ? "左" : "右"}翻板`,
        material,
        grainDirection: "length",
        visible: { length: topWid, width: dropLeafWidth, thickness: topThickness },
        origin: { x: sx * (topLen / 2 + dropLeafWidth / 2), y: legHeight, z: 0 },
        rotation: { x: 0, y: Math.PI / 2, z: 0 },
        tenons: [],
        mortises: [],
      });
    }
  }

  const design: FurnitureDesign = {
    id: `tea-table-${length}x${width}x${height}`,
    category: "tea-table",
    nameZh: "邊桌/床邊桌",
    overall: { length, width, thickness: height },
    parts: [
      topPanel,
      ...legs,
      ...upperAprons,
      ...lowerStretchers,
      ...(hasLowerShelf ? [lowerShelf] : []),
      ...dropLeafParts,
    ],
    defaultJoinery: "blind-tenon",
    useButtJointConvention: true,
    primaryMaterial: material,
    notes:
      `桌面與桌腳依母厚自動榫；上下橫撐與桌腳半榫錯位（Z 上半 / X 下半）；下棚板四邊出舌嵌入下橫撐長槽。${seatEdgeNote(seatEdge, seatEdgeStyle)}${legEdgeNote(legEdge, legEdgeStyle)}${stretcherEdgeNote(stretcherEdge, stretcherEdgeStyle)}${dropLeaf !== "none" ? ` ${dropLeaf === "one-side" ? "單" : "雙"}側翻板（每片 ${dropLeafWidth}mm 寬，配 1.5\" 蝶式鉸鏈）。` : ""}${liveEdge ? " Live edge 原木邊（保留樹皮曲線）。" : ""}`,
  };
  // 拼板花紋（herringbone / chevron / book-match / end-grain）：3D 視覺化做法
  applyStandardChecks(design, {
    minLength: 400, minWidth: 400, minHeight: 250,
    maxLength: 1200, maxWidth: 900, maxHeight: 500,
  });
  if (input.height > 500) {
    appendSuggestion(design, {
      text: `桌高 ${input.height}mm 已超出邊桌範圍——餐桌模板有完整中央橫撐 / 牙板厚度等選項。`,
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
  /** Y delta for X-axis sides (front/back). Default 0. 牙板用 -apronStaggerMm 下移 */
  xAxisYDelta?: number;
  /** Y delta for Z-axis sides (left/right). Default 0. 下橫撐用 +lowerStretcherStaggerMm 上移 */
  zAxisYDelta?: number;
  legInset?: number;
}

function makeApronRing(o: ApronRingOpts): Part[] {
  // 牙板/橫撐位置 = 腳中心軸對齊：腳中心 X = length/2 - legSize/2 - legInset
  const inset = o.legInset ?? 0;
  const edgeX = o.overallLength / 2 - o.legSize / 2 - inset;
  const edgeZ = o.overallWidth / 2 - o.legSize / 2 - inset;
  const sides = [
    {
      key: "front",
      nameZh: "前",
      visibleLength: o.span.x,
      axis: "x" as const,
      origin: { x: 0, z: -edgeZ },
    },
    {
      key: "back",
      nameZh: "後",
      visibleLength: o.span.x,
      axis: "x" as const,
      origin: { x: 0, z: edgeZ },
    },
    {
      key: "left",
      nameZh: "左",
      visibleLength: o.span.z,
      axis: "z" as const,
      origin: { x: -edgeX, z: 0 },
    },
    {
      key: "right",
      nameZh: "右",
      visibleLength: o.span.z,
      axis: "z" as const,
      origin: { x: edgeX, z: 0 },
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
      origin: {
        x: s.origin.x,
        y: o.y + (s.axis === "x" ? (o.xAxisYDelta ?? 0) : (o.zAxisYDelta ?? 0)),
        z: s.origin.z,
      },
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
