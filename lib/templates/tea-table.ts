import type {
  FurnitureDesign,
  FurnitureTemplate,
  OptionSpec,
  Part,
} from "@/lib/types";
import { getOption, opt } from "@/lib/types";
import {
  corners,
  rectLegShape,
  curvedTaperLegOptions,
  curvedTaperInnerScaleAt,
  seatEdgeOption,
  seatEdgeStyleOption,
  seatEdgeNote,
  seatEdgeShape,
  seatOutlineOption,
  seatOutlineSizeOption,
  seatOutlineNote,
  seatOutlineDetailOptions,
  readSeatOutlineParams,
  resolveTopOutlineShape,
  ovalMinLegInset,
  legEdgeOption,
  legEdgeStyleOption,
  legEdgeNote,
  legEdgeShape,
  computeCompoundSplayNormal,
  stretcherEdgeOption,
  stretcherEdgeStyleOption,
  stretcherEdgeNote,
  apronEdgeOption,
  apronEdgeStyleOption,
  apronProfileOptions,
  stretcherProfileOptions,
  legBottomScale,
  legScaleAt,
} from "./_helpers";
import { applyStandardChecks, appendSuggestion, appendWarnings } from "./_validators";
import { standardTenon, autoTenonType } from "@/lib/joinery/standards";
import { formatMm } from "@/lib/units/format";

export const teaTableOptions: OptionSpec[] = [
  { group: "leg", type: "select", key: "legShape", label: "腳樣式", defaultValue: "box", choices: [
    { value: "box", label: "直腳（方料）" },
    { value: "tapered", label: "錐形腳" },
    { value: "curved-taper", label: "弧肩斜腳（上段全寬→內凹弧肩→斜降）" },
  ] },
  { group: "leg", type: "number", key: "legSize", label: "桌腳粗", defaultValue: 50, unit: "mm", min: 20, max: 120, step: 2 },
  { group: "leg", type: "number", key: "legInset", label: "桌腳內縮", defaultValue: 0, unit: "mm", min: 0, max: 200, step: 5, help: "桌腳往內移，形成 reveal。0 = 與桌面邊緣齊平" },
  { group: "top", type: "number", key: "topThickness", label: "桌面厚", defaultValue: 25, unit: "mm", min: 12, max: 60, step: 1 },
  { group: "top", type: "select", key: "dropLeaf", label: "翻板（drop-leaf）", defaultValue: "none", choices: [
    { value: "none", label: "無" },
    { value: "one-side", label: "單側翻板" },
    { value: "two-sides", label: "雙側翻板" },
  ], help: "桌面長邊用蝶式鉸鏈加可摺疊延伸板。配 1.5\" 鋼製蝶式鉸鏈" },
  { group: "top", type: "number", key: "dropLeafWidth", label: "翻板寬", defaultValue: 200, unit: "mm", min: 150, max: 400, step: 25, dependsOn: { key: "dropLeaf", notIn: ["none"] } },
  // 桌面俯視輪廓造型（top-outline）：與 liveEdge 互斥、非方形時倒角欄隱藏（一件一 shape）
  { ...seatOutlineOption("top", "桌面"), dependsOn: { all: [{ key: "liveEdge", notIn: [true] }, { key: "dropLeaf", oneOf: ["none"] }] } },
  seatOutlineSizeOption("top"),
  ...seatOutlineDetailOptions("top"),
  { ...seatEdgeOption("top", 5), dependsOn: { all: [{ key: "liveEdge", notIn: [true] }, { key: "seatOutline", oneOf: ["rect"] }] } },
  { ...seatEdgeStyleOption("top"), dependsOn: { all: [{ key: "seatEdge", notIn: [0] }, { key: "liveEdge", notIn: [true] }, { key: "seatOutline", oneOf: ["rect"] }] } },
  legEdgeOption("leg", 1),
  legEdgeStyleOption("leg"),
  ...curvedTaperLegOptions("leg"),
  // 選了下橫撐造型時隱藏倒角欄（造型件一件一種 shape、倒角無效——同 square-stool）
  { ...stretcherEdgeOption("stretcher", 1), dependsOn: { key: "stretcherProfile", oneOf: ["none"] } },
  { ...stretcherEdgeStyleOption("stretcher"), dependsOn: { all: [{ key: "stretcherEdge", notIn: [0] }, { key: "stretcherProfile", oneOf: ["none"] }] } },
  // 下橫撐造型（茶几下橫撐環恆存在——無 withLowerStretcher 開關，故無額外顯示條件）
  ...stretcherProfileOptions("stretcher"),
  { group: "apron", type: "number", key: "upperApronWidth", label: "牙條高", defaultValue: 90, unit: "mm", min: 30, max: 200, step: 5, help: "弧肩斜腳時自動＝接撐段高，此欄不顯示", dependsOn: { key: "legShape", notIn: ["curved-taper"] } },
  { group: "apron", type: "number", key: "upperApronThickness", label: "牙條厚", defaultValue: 22, unit: "mm", min: 12, max: 50, step: 1 },
  { group: "apron", type: "number", key: "apronOffset", label: "牙條距桌面", defaultValue: 0, unit: "mm", min: 0, max: 200, step: 5, help: "牙條頂緣往下退離桌面下緣的距離。0 = 貼齊" },
  { group: "apron", type: "checkbox", key: "legPenetratingTenon", label: "腳上榫頭通透（明榫裝飾）", defaultValue: false, help: "勾選：上下橫撐進腳改通榫（榫頭穿透到腳另一面），明式裝飾感；未勾：依母件厚度自動規則（≤25mm 通榫、>25mm 盲榫深度=厚度2/3）" },
  { group: "apron", type: "number", key: "apronStaggerMm", label: "牙條錯開", defaultValue: 0, min: 0, max: 80, step: 2, unit: "mm", help: "前後牙條（X 軸）相對左右下移量。0 = 等高（自動上下半榫）" },
  // 選了牙條造型時隱藏倒角欄（同 square-stool）
  { ...apronEdgeOption("apron", 1), dependsOn: { key: "apronProfile", oneOf: ["none"] } },
  { ...apronEdgeStyleOption("apron"), dependsOn: { all: [{ key: "apronEdge", notIn: [0] }, { key: "apronProfile", oneOf: ["none"] }] } },
  ...apronProfileOptions("apron"),
  { group: "stretcher", type: "number", key: "lowerStretcherWidth", label: "下橫撐高", defaultValue: 50, unit: "mm", min: 20, max: 150, step: 5 },
  { group: "stretcher", type: "number", key: "lowerStretcherThickness", label: "下橫撐厚", defaultValue: 22, unit: "mm", min: 12, max: 50, step: 1 },
  { group: "stretcher", type: "number", key: "lowerStretcherHeight", label: "下橫撐離地高", defaultValue: 120, unit: "mm", min: 10, max: 400, step: 10, help: "下橫撐底面距地高度" },
  { group: "stretcher", type: "number", key: "lowerStretcherStaggerMm", label: "下橫撐錯開", defaultValue: 0, min: 0, max: 80, step: 2, unit: "mm", help: "左右下橫撐（Z 軸）相對前後上移量。0 = 等高（自動上下半榫）；> 0 時下棚板四邊長槽會跟著移動，建議搭配關閉下棚板" },
  { group: "top", type: "checkbox", key: "hasLowerShelf", label: "下棚板", defaultValue: true, help: "關閉則只保留下橫撐" },
  { group: "top", type: "select", key: "shelfOrientation", label: "下棚條方向", defaultValue: "length", choices: [
    { value: "length", label: "沿長邊（slat 跨前後橫撐）" },
    { value: "width", label: "沿短邊（slat 跨左右橫撐，旋轉 90°）" },
  ], help: "改變棚條鋪設方向。預設沿長邊（length），切換到 width 等於整片棚板旋轉 90°", dependsOn: { key: "hasLowerShelf", equals: true } },
  { group: "top", type: "number", key: "shelfSlatWidth", label: "下棚條寬", defaultValue: 60, min: 20, max: 200, step: 5, unit: "mm", help: "每根棚條的寬度。寬度越大、所需根數越少", dependsOn: { key: "hasLowerShelf", equals: true } },
  { group: "top", type: "number", key: "shelfSlatThickness", label: "下棚條厚", defaultValue: 18, min: 10, max: 40, step: 1, unit: "mm", dependsOn: { key: "hasLowerShelf", equals: true } },
  { group: "top", type: "number", key: "shelfSlatEdge", label: "下棚條倒角", defaultValue: 0, min: 0, max: 15, step: 1, unit: "mm", help: "棚條 4 條長邊倒角；0 = 無倒角；3-5 細倒邊；8 起明顯八角斷面", dependsOn: { key: "hasLowerShelf", equals: true } },
  { group: "top", type: "select", key: "shelfSlatEdgeStyle", label: "下棚條倒角樣式", defaultValue: "chamfered", choices: [
    { value: "chamfered", label: "45° 倒角 (V 型刀)" },
    { value: "rounded", label: "圓角 (R 角刀)" },
  ], dependsOn: { all: [{ key: "hasLowerShelf", equals: true }, { key: "shelfSlatEdge", notIn: [0] }] } },
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
 *  - N × 下棚條 slat（lower shelf slats），平鋪在下橫撐上面（自動依空間算根數）
 *
 * 接合（套方凳 square-stool 規則）：
 *  - 桌腳 ↔ 桌面：autoTenonType（≤25mm 通榫、>25mm 盲榫）
 *  - 上下橫撐 ↔ 桌腳：autoTenonType + legPenetratingTenon override
 *  - 半榫錯位：Z（左右）= 上半榫（保留 10mm 上肩）、X（前後）= 下半榫（無上下肩）
 *  - 下棚條 ↔ 下橫撐：rest-on（不開榫，靠重力 + slat 兩端被左右橫撐限位）
 */
export const teaTable: FurnitureTemplate = (input): FurnitureDesign => {
  const { length, width, height, material } = input;
  const locale = input.locale ?? "zh-TW";
  const isEn = locale === "en";

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
  const apronEdge = getOption<number>(input, opt(o, "apronEdge"));
  const apronEdgeStyle = getOption<string>(input, opt(o, "apronEdgeStyle"));
  const apronProfile = getOption<string>(input, opt(o, "apronProfile"));
  const apronProfileDepth = getOption<number>(input, opt(o, "apronProfileDepth"));
  const stretcherProfile = getOption<string>(input, opt(o, "stretcherProfile"));
  const stretcherProfileDepth = getOption<number>(input, opt(o, "stretcherProfileDepth"));
  const _upperApronWidthRaw = getOption<number>(input, opt(o, "upperApronWidth"));
  const upperApronThickness = getOption<number>(input, opt(o, "upperApronThickness"));
  const apronOffset = getOption<number>(input, opt(o, "apronOffset"));
  const stretcherFloorOffset = getOption<number>(input, opt(o, "lowerStretcherHeight"));
  const hasLowerShelf = getOption<boolean>(input, opt(o, "hasLowerShelf"));
  const legPenetratingTenon = getOption<boolean>(input, opt(o, "legPenetratingTenon"));
  const apronStaggerMm = getOption<number>(input, opt(o, "apronStaggerMm"));
  const lowerStretcherStaggerMm = getOption<number>(input, opt(o, "lowerStretcherStaggerMm"));
  const lowerStretcherWidth = getOption<number>(input, opt(o, "lowerStretcherWidth"));
  const lowerStretcherThickness = getOption<number>(input, opt(o, "lowerStretcherThickness"));
  const legInsetRaw = getOption<number>(input, opt(o, "legInset"));
  const { outline: seatOutline, params: seatOutlineParams } = readSeatOutlineParams(input, o);
  // 滿版圓／橢圓桌面：自動抬高桌腳內縮讓腳（含頂榫）落在橢圓內、防露榫
  const legInset = (seatOutline === "oval" || seatOutline === "petal") && !liveEdge && getOption<string>(input, opt(o, "dropLeaf")) === "none"
    ? ovalMinLegInset(input.length, input.width, legInsetRaw, 5 + (seatOutline === "petal" ? seatOutlineParams.sizeMm : 0))
    : legInsetRaw;
  const dropLeaf = getOption<string>(input, opt(o, "dropLeaf"));
  const dropLeafWidth = getOption<number>(input, opt(o, "dropLeafWidth"));
  const shelfOrientation = getOption<string>(input, opt(o, "shelfOrientation")) as "length" | "width";
  const shelfSlatWidth = getOption<number>(input, opt(o, "shelfSlatWidth"));
  const shelfThickness = getOption<number>(input, opt(o, "shelfSlatThickness"));
  const shelfSlatEdge = getOption<number>(input, opt(o, "shelfSlatEdge"));
  const shelfSlatEdgeStyle = getOption<string>(input, opt(o, "shelfSlatEdgeStyle"));

  // 弧肩斜腳（curved-taper）：接撐段全寬高度 / 弧肩內收 / 外面斜降內縮
  const ctBlockHeight = getOption<number>(input, opt(o, "ctBlockHeight"));
  const ctShoulder = getOption<number>(input, opt(o, "ctShoulder"));
  const ctInset = getOption<number>(input, opt(o, "ctInset"));
  const ctSplayAngle = getOption<number>(input, opt(o, "ctSplay"));
  const isCurvedTaper = legShape === "curved-taper";
  // 弧肩斜腳：牙條高自動＝接撐段高（牙條填滿上段全寬實體區、其下才收弧）
  const upperApronWidth = isCurvedTaper ? ctBlockHeight : _upperApronWidthRaw;
  const legHeight = height - topThickness;
  const lowerCenterY = stretcherFloorOffset + lowerStretcherWidth / 2;
  // 弧肩斜腳的選配外斜（ctSplay 欄，預設 0=垂直）：對角外踢，同 "splayed" 慣例。
  // 用獨立角度不共用 splayAngle（茶几本無 splayAngle 欄；共用欄見 _helpers.curvedTaperLegOptions）。
  const ctSplayMm =
    isCurvedTaper && ctSplayAngle > 0
      ? Math.round(Math.tan((ctSplayAngle * Math.PI) / 180) * legHeight)
      : 0;
  // 腳在高度 y 的中心外移量 = ctSplayMm × (1 − y/legHeight)（頂 0、底最大）。
  // 牙條/下橫撐環的長度補償與環位置外移都用「該環中心高」的這個值。
  const ctSplayOutAt = (yCenter: number): number =>
    ctSplayMm > 0 && legHeight > 0 ? ctSplayMm * (1 - yCenter / legHeight) : 0;

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

  // 盲榫深度留背牆 ≥ 8mm（薄腳不破口）；通榫不夾。母厚 ≥33 時 clamp 無作用＝方腳基準版 byte 一致。
  const LEG_MORTISE_BACK_WALL = 8;
  const clampBlindDepth = (raw: number, motherT: number, isThrough: boolean) =>
    isThrough ? raw : Math.min(raw, Math.max(6, motherT - LEG_MORTISE_BACK_WALL));

  // 2) upper apron ↔ leg：依自動規則 + legPenetratingTenon override
  // 弧肩斜腳非明榫時強制盲榫（不讓 autoTenonType 對細腳自動通榫戳出腳外＝破口）。
  const apronTenonType = legPenetratingTenon
    ? "through-tenon"
    : isCurvedTaper
      ? "blind-tenon"
      : autoTenonType(legSize);
  const apronTenonStd = standardTenon({
    type: apronTenonType === "through-tenon" ? "through-tenon" : "shouldered-tenon",
    childThickness: upperApronThickness,
    childWidth: upperApronWidth,
    motherThickness: legSize,
  });
  // 通榫補 +5mm 補償斜腳 rotation tilt（茶几沒 splay，但保留規則一致）；盲榫夾背牆 8mm。
  const apronTenonLength = clampBlindDepth(
    apronTenonStd.length + (apronTenonType === "through-tenon" ? 5 : 0),
    legSize,
    apronTenonType === "through-tenon",
  );
  const apronTenonThick = apronTenonStd.thickness;
  const apronTenonW = apronTenonStd.width;
  // 半榫錯位（連續位移）：
  //   stagger > 0 → 前後牙板（X 軸）整支物理下移，榫頭整支跟著（中心榫）
  //   stagger == 0 → 自動上下半榫錯位避免同位撞
  const APRON_TOP_SHOULDER = 10;
  const APRON_HALF_TENON_GAP = 4;
  // 牙條/下橫撐造型深度（0 = 自動：該環高的 40%），照 square-stool 現行版
  const apronProfileDepthEff =
    apronProfile !== "none"
      ? (apronProfileDepth > 0 ? apronProfileDepth : Math.round(upperApronWidth * 0.4))
      : 0;
  const stretcherProfileDepthEff =
    stretcherProfile !== "none"
      ? (stretcherProfileDepth > 0 ? stretcherProfileDepth : Math.round(lowerStretcherWidth * 0.4))
      : 0;
  // 牙條造型「下緣外圓弧」（arch-out）兩端上收 = 造型深度 → 貼下緣的下半榫會露出，
  // 底肩抬到 ≥ 造型深度把榫上移進實體（同 square-stool apronBottomShoulder 機制）。
  // 茶几下半榫原本貼牙條下緣（lowerTenonOffset = halfH/2 − W/2），確有此需求。
  const apronBottomShoulder = apronProfile === "arch-out" ? apronProfileDepthEff : 0;
  const apronTotalTenonH = upperApronWidth - APRON_TOP_SHOULDER - apronBottomShoulder;
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
    ? apronBottomShoulder + apronHalfTenonH / 2 - upperApronWidth / 2
    : (apronBottomShoulder > 0 ? apronBottomShoulder / 2 : 0);

  // 3) lower stretcher ↔ leg：同自動規則 + legPenetratingTenon override
  // 弧肩斜腳非明榫時強制盲榫（不自動通榫戳出斜面）。
  const lowerTenonType = legPenetratingTenon
    ? "through-tenon"
    : isCurvedTaper
      ? "blind-tenon"
      : autoTenonType(legSize);
  const lowerTenonStd = standardTenon({
    type: lowerTenonType,
    childThickness: lowerStretcherThickness,
    childWidth: lowerStretcherWidth,
    motherThickness: legSize,
  });
  const _lowerTenonLenRaw = lowerTenonStd.length + (lowerTenonType === "through-tenon" ? 5 : 0);
  // 弧肩斜腳：下橫撐接在斜降窄區，把榫長 clamp 到「該高度實際腳寬 − 3mm」內才不戳出斜面。
  // （公式照搬 square-stool / simple-table：外面垂直、只內面收窄，材料 X 深 = legSize×(1+scale)/2）。
  const ctStretcherNarrow = isCurvedTaper
    ? Math.max(8, (legSize * (1 + curvedTaperInnerScaleAt(lowerCenterY, legHeight, legSize, ctBlockHeight, ctShoulder, ctInset))) / 2)
    : legSize;
  const lowerTenonLength = isCurvedTaper
    ? Math.max(6, Math.min(_lowerTenonLenRaw, Math.floor(ctStretcherNarrow - 3)))
    : clampBlindDepth(_lowerTenonLenRaw, legSize, lowerTenonType === "through-tenon");
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

  const upperApronY = legHeight - upperApronWidth - apronOffset;
  // 半榫指派的世界 Y 中心
  const apronCenterY = upperApronY + upperApronWidth / 2;

  const cornerPts = corners(length, width, legSize, legInset);

  // tapered 補償（apron 三條 Y 位置各自的腳寬）
  const bottomScale = legBottomScale(legShape);
  const apronLegSizeCenter = legSize * legScaleAt(apronCenterY, legHeight, bottomScale);
  const apronLegSizeTop = legSize * legScaleAt(upperApronY + upperApronWidth, legHeight, bottomScale);
  const apronLegSizeBot = legSize * legScaleAt(upperApronY, legHeight, bottomScale);
  const lowerLegSizeCenter = legSize * legScaleAt(lowerCenterY, legHeight, bottomScale);
  const lowerLegSizeTop = legSize * legScaleAt(stretcherFloorOffset + lowerStretcherWidth, legHeight, bottomScale);
  const lowerLegSizeBot = legSize * legScaleAt(stretcherFloorOffset, legHeight, bottomScale);
  // 弧肩斜腳（curved-taper）：內面收窄只發生在腳的 X 面（2D 側輪廓沿 Z 擠出、Z 面全寬）。
  // X 下橫撐長度用 curvedTaperInnerScaleAt 對到「該高度實際內面」（§A11），Z 不補償
  // （榫長 clamp ctStretcherNarrow 早就按窄面算，這裡補漏掉的長度；同 simple-table 修法）。
  const lowerScaleAtX = (y: number): number =>
    isCurvedTaper
      ? curvedTaperInnerScaleAt(y, legHeight, legSize, ctBlockHeight, ctShoulder, ctInset)
      : legScaleAt(y, legHeight, bottomScale);
  const lowerLegSizeCenterX = legSize * lowerScaleAtX(lowerCenterY);
  const lowerLegSizeTopX = legSize * lowerScaleAtX(stretcherFloorOffset + lowerStretcherWidth);
  const lowerLegSizeBotX = legSize * lowerScaleAtX(stretcherFloorOffset);
  const hasShapeBend = bottomScale !== 1;
  // X 下橫撐端面要貼收窄斜面 → 梯形補償也要開
  const hasShapeBendLowerX = hasShapeBend || isCurvedTaper;

  // ----- 桌面板 -----
  const topLen = length;
  const topWid = width;
  const topPanel: Part = {
    id: "top",
    nameZh: "桌面板",
    nameEn: "Top panel",
    material,
    grainDirection: "length",
    visible: { length: topLen, width: topWid, thickness: topThickness },
    origin: { x: 0, y: legHeight, z: 0 },
    shape: liveEdge ? { kind: "live-edge", amplitudeMm: 12 } : seatEdgeShape(seatEdge, seatEdgeStyle),
    tenons: [],
    // ctSplay 外斜時 mortise.axis = 腳 top 榫頭世界軸的反向（桌面的孔朝下開向腳），
    // 跟 square-stool splayed 系列同 pattern。
    mortises: cornerPts.map((c) => {
      const mortiseAxis = ctSplayMm > 0
        ? (() => {
            const dx = Math.sign(c.x) * ctSplayMm;
            const dz = Math.sign(c.z) * ctSplayMm;
            const x = dx, y = -legHeight, z = dz;
            const mag = Math.hypot(x, y, z) || 1;
            return { x: x / mag, y: y / mag, z: z / mag };
          })()
        : undefined;
      return {
        // legInset=0 → mortise 跟 tenon 一起朝中心偏
        origin: { x: c.x - Math.sign(c.x) * legTopInsetX, y: 0, z: c.z },
        depth: legTenonStd.length,
        length: legTenonStd.width,
        width: legTenonStd.thickness,
        through: legTopTenonType === "through-tenon",
        ...(mortiseAxis ? { axis: mortiseAxis } : {}),
      };
    }),
  };

  // ----- 4 桌腳 -----
  // mortise 半榫指派：Z 面（接左右橫撐）= 上半榫；X 面（接前後橫撐）= 下半榫
  const apronThrough = apronTenonType === "through-tenon";
  const lowerThrough = lowerTenonType === "through-tenon";
  const legs: Part[] = cornerPts.map((c, i) => {
    // ctSplay 外斜：腳底外踢、頂榫進桌面方向 = 腳向下方向的反向（同 square-stool legTopAxis pattern）。
    // leg downward (top→bottom) world = (sign(c.x)*ctSplayMm, -legHeight, sign(c.z)*ctSplayMm)
    // top tenon axis (up into top panel) = 反向
    const legTopAxis = ctSplayMm > 0
      ? (() => {
          const dx = Math.sign(c.x) * ctSplayMm;
          const dz = Math.sign(c.z) * ctSplayMm;
          const x = -dx, y = legHeight, z = -dz;
          const mag = Math.hypot(x, y, z) || 1;
          return { x: x / mag, y: y / mag, z: z / mag };
        })()
      : undefined;
    return ({
    id: `leg-${i + 1}`,
    nameZh: `桌腳 ${i + 1}`,
    nameEn: `Leg ${i + 1}`,
    material,
    grainDirection: "length",
    visible: { length: legSize, width: legSize, thickness: legHeight },
    origin: { x: c.x, y: 0, z: c.z },
    // ctSplayMm > 0 → curvedTaper.splayMm 讓腳 3D/投影對角外踢（頂固定、底外移）
    shape: legShape === "curved-taper"
      ? rectLegShape("curved-taper", c, { curvedTaper: { blockHeightMm: ctBlockHeight, shoulderMm: ctShoulder, insetMm: ctInset, splayMm: ctSplayMm } })
      : legShape === "tapered"
        ? { kind: "tapered", bottomScale: 0.55 }
        : legEdgeShape(legEdge, legEdgeStyle),
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
        ...(legTopAxis ? { axis: legTopAxis } : {}),
      },
    ],
    // 弧肩斜腳：腳面上開牙板/下橫撐母榫孔會露在橫料外緣＝破口，改「不挖榫眼、靠實體遮」，
    // 盲榫直接埋進實體腳身（榫長已 clamp、埋得住）。跟方凳 / simple-table 同處理。公榫因此無對應
    // 母榫（audit 已於 EXPECTED_FAILS_VARIANT 登記 tea-table:curved-taper 豁免）。
    mortises: isCurvedTaper ? [] : [
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
  });
  });

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

  const lowerButtHalfX = apronEdgeX - lowerLegSizeCenterX / 2;
  const lowerButtHalfZ = apronEdgeZ - lowerLegSizeCenter / 2;
  const lowerButtHalfXTop = apronEdgeX - lowerLegSizeTopX / 2;
  const lowerButtHalfXBot = apronEdgeX - lowerLegSizeBotX / 2;
  const lowerButtHalfZTop = apronEdgeZ - lowerLegSizeTop / 2;
  const lowerButtHalfZBot = apronEdgeZ - lowerLegSizeBot / 2;
  const lowerTrapTopScaleX = hasShapeBendLowerX ? lowerButtHalfXTop / lowerButtHalfX : null;
  const lowerTrapBotScaleX = hasShapeBendLowerX ? lowerButtHalfXBot / lowerButtHalfX : 1;
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
    x: length - legSize - 2 * legInset - lowerLegSizeCenterX,
    z: width - legSize - 2 * legInset - lowerLegSizeCenter,
  };

  const upperAprons: Part[] = makeApronRing({
    idPrefix: "upper-apron",
    nameZhPrefix: "牙條",
    nameEnSuffix: "apron",
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
    // 牙條造型：選了造型時整環套 edge-profile（倒角欄已隱藏不套用）
    profile: apronProfile !== "none"
      ? { style: apronProfile as "arch" | "arch-out" | "top-arch" | "kunmen" | "wave" | "corner-round" | "double-arch", depthMm: apronProfileDepthEff }
      : undefined,
    fallbackShape: legEdgeShape(apronEdge, apronEdgeStyle),
    extraMortises: () => [],
    // 前後牙板（X 軸）整支物理下移 apronStaggerMm；左右（Z 軸）不動
    xAxisYDelta: -apronStaggerMm,
    zAxisYDelta: 0,
    legInset,
    // 弧肩斜腳選配外斜：X 環（下移後）/ Z 環各用各自中心高的腳外移量補償長度 + 環位置外移
    ctSplay: ctSplayMm > 0
      ? { outX: ctSplayOutAt(apronCenterY - apronStaggerMm), outZ: ctSplayOutAt(apronCenterY), angleDeg: ctSplayAngle }
      : undefined,
  });

  const lowerStretchers: Part[] = makeApronRing({
    idPrefix: "lower-stretcher",
    nameZhPrefix: "下橫撐",
    nameEnSuffix: "lower stretcher",
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
    // 下橫撐造型：同牙條（倒角欄已隱藏不套用）
    profile: stretcherProfile !== "none"
      ? { style: stretcherProfile as "arch" | "arch-out" | "top-arch" | "kunmen" | "wave" | "corner-round" | "double-arch", depthMm: stretcherProfileDepthEff }
      : undefined,
    fallbackShape: legEdgeShape(stretcherEdge, stretcherEdgeStyle),
    // 棚板放在橫撐上面（rest-on，跟 bench under-shelf 同設計）→ 橫撐不開槽
    extraMortises: () => [],
    // 左右下橫撐（Z 軸）整支物理上移 lowerStretcherStaggerMm；前後（X 軸）不動
    xAxisYDelta: 0,
    zAxisYDelta: lowerStretcherStaggerMm,
    legInset,
    // 弧肩斜腳選配外斜：下橫撐在低處、外移量更大（頂 0 底最大）
    ctSplay: ctSplayMm > 0
      ? { outX: ctSplayOutAt(lowerCenterY), outZ: ctSplayOutAt(lowerCenterY + lowerStretcherStaggerMm), angleDeg: ctSplayAngle }
      : undefined,
  });

  // ----- 下棚板（slat 條板） -----
  // 設計：棚板拆成多條 slat 平鋪在四向下橫撐的「上面」（rest-on），跟 bench under-shelf 同概念。
  // shelfOrientation:
  //   "length"（預設）→ slat 沿 X 軸走、跨前後（X 軸）橫撐上面，slats 沿 Z 軸排列、兩端緊貼左右（Z 軸）橫撐內側
  //   "width" → 整片棚板旋轉 90°：slat 沿 Z 軸走（rotation.y=π/2 把 part-local length 從 X 轉到 Z）、
  //             跨左右（Z 軸）橫撐上面，slats 沿 X 軸排列、兩端緊貼前後（X 軸）橫撐內側
  // ctSplay 外斜時下橫撐環整體外移（左右環 X 外移 outZ、前後環 Z 外移 outX）→ slat 跨距/鋪設區間跟著補
  const lowerOutX = ctSplayMm > 0 ? ctSplayOutAt(lowerCenterY) : 0;
  const lowerOutZ = ctSplayMm > 0 ? ctSplayOutAt(lowerCenterY + lowerStretcherStaggerMm) : 0;
  const stretcherOuterX = length / 2 - legSize / 2 - legInset + lowerStretcherThickness / 2 + lowerOutZ;
  const stretcherOuterZ = width / 2 - legSize / 2 - legInset + lowerStretcherThickness / 2 + lowerOutX;
  // shelfOrientation 決定「跨距軸」與「排列軸」：
  //   length → slat 跨 X、排列 Z；width → slat 跨 Z、排列 X
  const slatSpanAxisOuter = shelfOrientation === "width" ? stretcherOuterZ : stretcherOuterX;
  const slatLayoutAxisOuter = shelfOrientation === "width" ? stretcherOuterX : stretcherOuterZ;
  // slat 長度：跨到對應軸（X 或 Z）橫撐外側面
  const slatLength = 2 * slatSpanAxisOuter;
  // slat 鋪設區間：兩端 slat 緊貼排列軸方向橫撐的內側面（內側 = outer - lowerStretcherThickness）
  const slatInnerSpan = 2 * (slatLayoutAxisOuter - lowerStretcherThickness);
  const slatGapMm = 10;
  // 自動決定 slat 數量：(span + gap) / (slatWidth + gap)
  const slatCount = Math.max(3, Math.round((slatInnerSpan + slatGapMm) / (shelfSlatWidth + slatGapMm)));
  // 重算實際 gap 讓 slats 兩端齊平橫撐內側
  const actualGap = slatCount > 1
    ? (slatInnerSpan - slatCount * shelfSlatWidth) / (slatCount - 1)
    : 0;
  // 棚板 Y = 橫撐頂面（origin.y 是 slat bottom 在 world 的位置）
  const shelfY = stretcherFloorOffset + lowerStretcherWidth;

  const slatParts: Part[] = [];
  for (let i = 0; i < slatCount; i++) {
    // 排列軸上的中心位置：從 -span/2 + slatWidth/2 起、每步 (slatWidth + actualGap)
    const layoutPos = slatCount === 1
      ? 0
      : -slatInnerSpan / 2 + shelfSlatWidth / 2 + i * (shelfSlatWidth + actualGap);
    const slatOrigin = shelfOrientation === "width"
      ? { x: layoutPos, y: shelfY, z: 0 }
      : { x: 0, y: shelfY, z: layoutPos };
    slatParts.push({
      id: `shelf-slat-${i + 1}`,
      nameZh: `下棚條 ${i + 1}`,
      nameEn: `Lower shelf slat ${i + 1}`,
      material,
      grainDirection: "length",
      visible: {
        length: slatLength,
        width: shelfSlatWidth,
        thickness: shelfThickness,
      },
      origin: slatOrigin,
      // width 模式：旋轉 90°（繞 Y 軸）把 part-local X（length）轉到世界 Z 軸
      ...(shelfOrientation === "width"
        ? { rotation: { x: 0, y: Math.PI / 2, z: 0 } }
        : {}),
      // 下棚條 4 條長邊倒角（user 要求加開關，hasLowerShelf=true 才出現）
      ...(shelfSlatEdge > 0
        ? { shape: { kind: "chamfered-edges" as const, chamferMm: shelfSlatEdge, style: shelfSlatEdgeStyle === "rounded" ? "rounded" as const : "chamfered" as const } }
        : {}),
      tenons: [],
      mortises: [],
    });
  }

  // 翻板（drop-leaf）：沿 length 軸 ±X 端延伸，蝶式鉸鏈接
  const dropLeafParts: Part[] = [];
  if (dropLeaf !== "none") {
    const sides = dropLeaf === "two-sides" ? [-1, 1] as const : [1] as const;
    for (const sx of sides) {
      dropLeafParts.push({
        id: `drop-leaf-${sx < 0 ? "left" : "right"}`,
        nameZh: `${sx < 0 ? "左" : "右"}翻板`,
        nameEn: `${sx < 0 ? "Left" : "Right"} drop leaf`,
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
    nameZh: "邊桌",
    overall: { length, width, thickness: height },
    parts: [
      topPanel,
      ...legs,
      ...upperAprons,
      ...lowerStretchers,
      ...(hasLowerShelf ? slatParts : []),
      ...dropLeafParts,
    ],
    defaultJoinery: "blind-tenon",
    useButtJointConvention: true,
    primaryMaterial: material,
    notes: isEn
      ? `Top tenons sized off material thickness; upper/lower stretchers half-lap-staggered into legs (Z upper / X lower); the lower shelf is broken into ${slatCount} slats resting on the lower stretchers (no joinery — gravity-held).${seatEdgeNote(seatEdge, seatEdgeStyle, locale)}${legEdgeNote(legEdge, legEdgeStyle, locale)}${stretcherEdgeNote(stretcherEdge, stretcherEdgeStyle, locale)}${dropLeaf !== "none" ? ` ${dropLeaf === "one-side" ? "Single" : "Double"}-side drop leaf (each ${formatMm(dropLeafWidth, "inch")} wide, 1.5\" butterfly hinges).` : ""}${liveEdge ? " Live edge (bark-line kept)." : ""}`
      : `桌面與桌腳依母厚自動榫；上下橫撐與桌腳半榫錯位（Z 上半 / X 下半）；下棚板拆 ${slatCount} 條 slat 平鋪在下橫撐上面（不開榫，靠重力卡位）。${seatEdgeNote(seatEdge, seatEdgeStyle, locale)}${legEdgeNote(legEdge, legEdgeStyle, locale)}${stretcherEdgeNote(stretcherEdge, stretcherEdgeStyle, locale)}${dropLeaf !== "none" ? ` ${dropLeaf === "one-side" ? "單" : "雙"}側翻板（每片 ${dropLeafWidth}mm 寬，配 1.5\" 蝶式鉸鏈）。` : ""}${liveEdge ? " Live edge 原木邊（保留樹皮曲線）。" : ""}`,
  };
  // 桌面俯視輪廓造型：對 top part 的「最終榫眼」clamp 後套用
  // （octagon/arch 縮尺寸防露榫;oval 塞不下退方形＋警告;liveEdge 已由 UI 互斥）
  if (!liveEdge && dropLeaf === "none" && seatOutline !== "rect") {
    const topPartOutline = design.parts.find((p) => p.id === "top");
    if (topPartOutline) {
      const resolvedOutline = resolveTopOutlineShape(
        seatOutline,
        seatOutlineParams,
        topPartOutline.visible.length,
        topPartOutline.visible.width,
        topPartOutline.mortises,
      );
      if (resolvedOutline !== null) {
        topPartOutline.shape = resolvedOutline;
        design.notes += seatOutlineNote(seatOutline, resolvedOutline.sizeMm, locale, "桌面");
      } else {
        appendWarnings(design, [
          isEn
            ? "The full-span curved top outline (oval / petal) conflicts with existing top mortises — reverted to a rectangular top. Increase leg inset to enable it."
            : "滿版曲線桌面（圓／橢圓／海棠）與桌面既有榫眼衝突，已退回方形。加大「桌腳內縮」即可啟用。",
        ]);
      }
    }
  }

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
  // 付費鉤子：當使用者調出「適合加抽屜」的設定（牙板高且桌面夠厚）→ 推邊桌付費模板
  if (upperApronWidth >= 100 && topThickness >= 22 && input.length <= 1000) {
    appendSuggestion(design, {
      text: "🔒 想加「前抽屜」收納嗎？邊桌（side-table）模板有完整抽屜 + 滑軌 + 把手組態（付費版解鎖）。",
      suggestedCategory: "side-table",
      presetParams: { length: input.length, width: input.width, height: input.height, material: input.material },
    });
  }
  // 付費鉤子：方形 + 有下棚板 → 推圓形茶几（旋轉盤、X 字下橫撐、明清風）
  if (hasLowerShelf && Math.abs(input.length - input.width) <= 100) {
    appendSuggestion(design, {
      text: "🔒 改做圓形茶几？圓茶几（round-tea-table）模板支援中央旋轉盤、X 字交叉下橫撐、明清風腳樣式（付費版解鎖）。",
      suggestedCategory: "round-tea-table",
      presetParams: { length: Math.min(input.length, input.width), width: Math.min(input.length, input.width), height: input.height, material: input.material },
    });
  }
  return design;
};

// ----- helpers -----

interface ApronRingOpts {
  idPrefix: string;
  nameZhPrefix: string;
  nameEnSuffix: string;
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
  /** 環造型（edge-profile 曲線）：有值時優先於 trapezoid 補償 / fallbackShape；
   *  梯形補償以 topLengthScale/bottomLengthScale 合成進輪廓（同 square-stool）。
   *  undefined = 不生效（既有行為 byte 不變）。 */
  profile?: {
    style: "arch" | "arch-out" | "top-arch" | "kunmen" | "wave" | "corner-round" | "double-arch";
    depthMm: number;
  };
  fallbackShape?: Part["shape"];
  extraMortises: (visibleLength: number) => Part["mortises"];
  /** Y delta for X-axis sides (front/back). Default 0. 牙板用 -apronStaggerMm 下移 */
  xAxisYDelta?: number;
  /** Y delta for Z-axis sides (left/right). Default 0. 下橫撐用 +lowerStretcherStaggerMm 上移 */
  zAxisYDelta?: number;
  legInset?: number;
  /** 弧肩斜腳選配外斜（ctSplay）補償：
   *  outX / outZ = X 環（前後）/ Z 環（左右）各自「環中心高」的腳中心外移量（mm）。
   *  每端 visible.length 加該值（腳內側面外移）、環本身沿外法線外移該值（貼回腳中軸）。
   *  angleDeg 給端面榫頭 axis（computeCompoundSplayNormal，同 square-stool pattern）。
   *  undefined = 不生效（既有行為 byte 不變）。 */
  ctSplay?: { outX: number; outZ: number; angleDeg: number };
}

function makeApronRing(o: ApronRingOpts): Part[] {
  // 牙板/橫撐位置 = 腳中心軸對齊：腳中心 X = length/2 - legSize/2 - legInset
  const inset = o.legInset ?? 0;
  const edgeX = o.overallLength / 2 - o.legSize / 2 - inset;
  const edgeZ = o.overallWidth / 2 - o.legSize / 2 - inset;
  // ctSplay 外斜補償：X 環（前後）長度每端 +outX、環 Z 位置外移 outX；Z 環（左右）同理用 outZ。
  const ctOutX = o.ctSplay?.outX ?? 0;
  const ctOutZ = o.ctSplay?.outZ ?? 0;
  const sides = [
    {
      key: "front",
      nameZh: "前",
      nameEn: "Front",
      visibleLength: o.span.x + 2 * ctOutX,
      axis: "x" as const,
      sx: 0 as const, sz: -1 as const,
      origin: { x: 0, z: -(edgeZ + ctOutX) },
    },
    {
      key: "back",
      nameZh: "後",
      nameEn: "Back",
      visibleLength: o.span.x + 2 * ctOutX,
      axis: "x" as const,
      sx: 0 as const, sz: 1 as const,
      origin: { x: 0, z: edgeZ + ctOutX },
    },
    {
      key: "left",
      nameZh: "左",
      nameEn: "Left",
      visibleLength: o.span.z + 2 * ctOutZ,
      axis: "z" as const,
      sx: -1 as const, sz: 0 as const,
      origin: { x: -(edgeX + ctOutZ), z: 0 },
    },
    {
      key: "right",
      nameZh: "右",
      nameEn: "Right",
      visibleLength: o.span.z + 2 * ctOutZ,
      axis: "z" as const,
      sx: 1 as const, sz: 0 as const,
      origin: { x: edgeX + ctOutZ, z: 0 },
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
    // 造型（edge-profile）優先：梯形補償合成進輪廓（tapered 的長度補償與造型同時成立）；
    // 無造型時走原路（trapezoid / fallback 倒角）→ byte 不變。
    const partShape: Part["shape"] = o.profile
      ? { kind: "edge-profile" as const, style: o.profile.style, depthMm: o.profile.depthMm, waveCount: 4, topLengthScale: trapTopScale ?? 1, bottomLengthScale: trapBotScale ?? 1 }
      : trapTopScale !== null
        ? { kind: "apron-trapezoid" as const, topLengthScale: trapTopScale, bottomLengthScale: trapBotScale }
        : o.fallbackShape;
    // ctSplay 外斜：端面榫頭沿腳傾角傾斜（compound splay normal，corner 符號映射同 square-stool：
    // axis="x" 環 start 在世界 -X；axis="z" 環 rotation Rx(π/2)Ry(π/2) 後 start 在世界 +Z）
    const startCornerSx = (s.axis === "x" ? -1 : s.sx) as -1 | 0 | 1;
    const startCornerSz = (s.axis === "z" ? +1 : s.sz) as -1 | 0 | 1;
    const endCornerSx = (s.axis === "x" ? +1 : s.sx) as -1 | 0 | 1;
    const endCornerSz = (s.axis === "z" ? -1 : s.sz) as -1 | 0 | 1;
    const tenonAxisStart = o.ctSplay
      ? computeCompoundSplayNormal({ apronAxis: s.axis, cornerSx: startCornerSx, cornerSz: startCornerSz, splayAngleDeg: o.ctSplay.angleDeg })
      : null;
    const tenonAxisEnd = o.ctSplay
      ? computeCompoundSplayNormal({ apronAxis: s.axis, cornerSx: endCornerSx, cornerSz: endCornerSz, splayAngleDeg: o.ctSplay.angleDeg })
      : null;
    return {
      id: `${o.idPrefix}-${s.key}`,
      nameZh: `${s.nameZh}${o.nameZhPrefix}`,
      nameEn: `${s.nameEn} ${o.nameEnSuffix}`,
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
          ...(tenonAxisStart ? { axis: tenonAxisStart } : {}),
        },
        {
          position: "end",
          type: o.tenonType,
          length: o.tenonLength,
          width: tenonH,
          thickness: o.tenonThickness,
          shoulderOn: [...shoulderOn],
          offsetWidth: -worldOffset,
          ...(tenonAxisEnd ? { axis: tenonAxisEnd } : {}),
        },
      ],
      mortises: o.extraMortises(s.visibleLength),
    };
  });
}
