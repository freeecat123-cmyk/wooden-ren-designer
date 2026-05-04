import type {
  FurnitureDesign,
  FurnitureTemplate,
  OptionSpec,
  Part,
} from "@/lib/types";
import { getOption, opt } from "@/lib/types";
import { corners, RECT_LEG_SHAPE_CHOICES, seatEdgeOption, seatEdgeStyleOption, seatEdgeNote, seatEdgeShape, seatProfileOption, seatProfileNote, seatScoopShape, legEdgeOption, legEdgeStyleOption, legEdgeNote, legEdgeShape, stretcherEdgeOption, stretcherEdgeStyleOption, stretcherEdgeNote, legShapeLabel, legBottomScale, legScaleAt } from "./_helpers";
import { applyStandardChecks, validateStoolStructure, appendWarnings } from "./_validators";
import { SPLAY_ANGLE } from "@/lib/knowledge/chair-geometry";
import { standardTenon, autoTenonType } from "@/lib/joinery/standards";
// 吧台椅尺寸範圍很穩定，沒明顯需要建議切換的目標模板（dining-chair 是椅背較大的不同物件）。

export const barStoolOptions: OptionSpec[] = [
  // 吧檯椅排除「方錐漸縮（大幅下收）」——重心高、下收太多會頭重腳輕
  { group: "leg", type: "select", key: "legShape", label: "椅腳樣式", defaultValue: "box", choices: RECT_LEG_SHAPE_CHOICES.filter((c) => c.value !== "strong-taper") },
  { group: "leg", type: "number", key: "legSize", label: "椅腳粗 (mm)", defaultValue: 35, min: 20, max: 80, step: 1, help: "正方腳預設值。若下方寬/厚另填則優先使用" },
  { group: "leg", type: "number", key: "legWidthOverride", label: "椅腳寬 X (mm)", defaultValue: 0, min: 0, max: 120, step: 1, help: "0 = 用「椅腳粗」；填值 = 沿座板長邊 X 的尺寸（可做扁腳）" },
  { group: "leg", type: "number", key: "legDepthOverride", label: "椅腳厚 Z (mm)", defaultValue: 0, min: 0, max: 120, step: 1, help: "0 = 用「椅腳粗」；填值 = 沿座板寬邊 Z 的尺寸" },
  { group: "leg", type: "number", key: "legInset", label: "椅腳內縮 (mm)", defaultValue: 0, min: 0, max: 150, step: 5, help: "椅腳從座板邊緣往內縮的距離（每邊）" },
  { group: "leg", type: "number", key: "splayAngle", label: "外斜角度 (°)", defaultValue: SPLAY_ANGLE.stoolDefaultDeg, min: 1, max: SPLAY_ANGLE.barStoolMaxDeg, step: 0.5, unit: "°", help: `斜腳系列才有效——從垂直起算的外傾角度。吧檯椅較高，建議不超過 8°，太斜底盤過大不穩（上限 ${SPLAY_ANGLE.barStoolMaxDeg}°）`, dependsOn: { key: "legShape", oneOf: ["splayed", "splayed-length", "splayed-width"] } },
  { group: "top", type: "number", key: "seatThickness", label: "座板厚 (mm)", defaultValue: 28, min: 15, max: 60, step: 1 },
  { group: "top", type: "number", key: "seatCornerR", label: "椅面四角圓角 (mm)", defaultValue: 0, min: 0, max: 100, step: 2, help: "俯視看，椅面 4 個角的圓弧半徑；0 = 直角，30~50 是常見柔角" },
  seatEdgeOption("top", 5),
  seatEdgeStyleOption("top"),
  seatProfileOption("top"),
  { group: "top", type: "number", key: "seatBendMm", label: "椅面彎曲 (mm)", defaultValue: 0, min: 0, max: 25, step: 1, help: "整片椅面像彎合板那樣彎曲，中間下凹比較好坐；四角榫眼位置不受影響。>0 會覆蓋鞍形 / 邊緣 profile，但保留四角圓角" },
  legEdgeOption("leg", 1),
  legEdgeStyleOption("leg"),
  stretcherEdgeOption("stretcher", 1),
  stretcherEdgeStyleOption("stretcher"),
  { group: "stretcher", type: "number", key: "footrestHeight", label: "腳踏高 (mm)", defaultValue: 350, min: 50, max: 700, step: 10, help: "腳踏離地高度。吧檯椅標準＝座面下 400–450mm（座面 750→腳踏 300–350；座面 800→腳踏 350–400）；counter stool 較矮，距座面約 300mm" },
  { group: "apron", type: "number", key: "apronWidth", label: "牙板高 (mm)", defaultValue: 50, min: 20, max: 150, step: 5 },
  { group: "apron", type: "number", key: "apronThickness", label: "牙板厚 (mm)", defaultValue: 18, min: 10, max: 40, step: 1, help: "牙板的水平厚度（垂直於座板邊）" },
  { group: "apron", type: "number", key: "apronOffset", label: "牙板距座板 (mm)", defaultValue: 5, min: 0, max: 300, step: 5, help: "牙板頂緣往下退的距離" },
  { group: "apron", type: "number", key: "apronStaggerMm", label: "牙板錯開 (mm)", defaultValue: 0, min: 0, max: 60, step: 2, help: "前後牙板（X 軸）相對左右牙板下移量，3D 即時顯示，榫頭整支跟著。0 = 等高（自動上下半榫避免穿模）" },
  { group: "apron", type: "checkbox", key: "legPenetratingTenon", label: "腳上榫頭通透（明榫裝飾）", defaultValue: false, help: "勾選：牙板/腳踏進腳改通榫（榫頭穿透到腳另一面），明式裝飾感；未勾：依母件厚度自動規則（≤25mm 通榫、>25mm 盲榫深度=厚度2/3）" },
  { group: "back", type: "select", key: "backStyle", label: "椅背樣式", defaultValue: "none", choices: [
    { value: "none", label: "無椅背" },
    { value: "rail", label: "短橫木（一根橫木）" },
    { value: "slats", label: "直條式（N 根垂直板條）" },
    { value: "panel", label: "弧形板（單片圓角板背）" },
  ] },
  { group: "back", type: "number", key: "backPanelHeight", label: "弧形板高 (mm)", defaultValue: 180, min: 100, max: 400, step: 10, help: "椅背板的垂直高（圓角矩形板）", dependsOn: { key: "backStyle", equals: "panel" } },
  { group: "back", type: "number", key: "backPanelThickness", label: "弧形板厚 (mm)", defaultValue: 18, min: 10, max: 30, step: 1, dependsOn: { key: "backStyle", equals: "panel" } },
  { group: "back", type: "number", key: "backPanelCornerR", label: "弧形板圓角 (mm)", defaultValue: 30, min: 0, max: 100, step: 2, help: "板的四角圓角半徑", dependsOn: { key: "backStyle", equals: "panel" } },
  { group: "back", type: "number", key: "backPanelTopArch", label: "上緣拱起 (mm)", defaultValue: 0, min: -80, max: 80, step: 2, help: "板上緣中央位移；正值往上拱（拱形頂），負值往下凹（凹弧頂）；0 = 平頂", dependsOn: { key: "backStyle", equals: "panel" } },
  { group: "back", type: "number", key: "backPanelBottomArch", label: "下緣拱起 (mm)", defaultValue: 0, min: -80, max: 80, step: 2, help: "板下緣中央位移；正值往上拱（D 形/月牙），負值往下延伸（裙擺）；0 = 平底", dependsOn: { key: "backStyle", equals: "panel" } },
  { group: "back", type: "number", key: "backPanelFaceBend", label: "弧形板大面彎曲 (mm)", defaultValue: 0, min: 0, max: 80, step: 2, help: "板的大面（前/後）凹陷量；0 = 平板，數值越大越彎（建議 10–30 做 lumbar 腰靠）", dependsOn: { key: "backStyle", equals: "panel" } },
  { group: "back", type: "number", key: "backPostDiameter", label: "圓形支撐柱直徑 (mm)", defaultValue: 25, min: 15, max: 50, step: 1, help: "支撐椅背板的兩支圓形垂直木", dependsOn: { key: "backStyle", equals: "panel" } },
  { group: "back", type: "number", key: "backPanelInset", label: "靠背距椅面後緣 (mm)", defaultValue: 0, min: 0, max: 200, step: 5, help: "圓柱後緣從椅面後緣往前的距離；0 = 圓柱後緣與椅面後緣對齊", dependsOn: { key: "backStyle", equals: "panel" } },
  { group: "back", type: "number", key: "backReclineDeg", label: "靠背後仰角 (°)", defaultValue: 0, min: 0, max: 20, step: 0.5, unit: "°", help: "靠背向後傾斜的角度；正視圖看仍是直的，側視圖才會看到斜度（圓柱與板同步傾斜）", dependsOn: { key: "backStyle", equals: "panel" } },
  { group: "back", type: "number", key: "backPostFromEdge", label: "圓柱距板端面 (mm)", defaultValue: 0, min: 0, max: 200, step: 5, help: "圓柱外緣到靠背板左/右端面的距離；0 = 圓柱外緣齊板端面", dependsOn: { key: "backStyle", equals: "panel" } },
  { group: "back", type: "number", key: "backPanelEmbed", label: "靠背卡入圓柱 (mm)", defaultValue: 6, min: 0, max: 30, step: 1, help: "靠背板嵌入圓柱的深度；接合處從圓柱扣掉同尺寸的平面", dependsOn: { key: "backStyle", equals: "panel" } },
  { group: "back", type: "number", key: "backHeight", label: "椅背高 (mm)", defaultValue: 200, min: 80, max: 500, step: 10, help: "從座板上緣到椅背頂", dependsOn: { key: "backStyle", notIn: ["none"] } },
  { group: "back", type: "number", key: "backSlats", label: "直條數（直條式用）", defaultValue: 3, min: 1, max: 8, step: 1, dependsOn: { key: "backStyle", equals: "slats" } },
  { group: "back", type: "number", key: "backSlatWidth", label: "直條寬 (mm)", defaultValue: 40, min: 15, max: 150, step: 5, dependsOn: { key: "backStyle", equals: "slats" } },
  { group: "back", type: "number", key: "backSlatThickness", label: "直條厚 (mm)", defaultValue: 16, min: 8, max: 40, step: 1, dependsOn: { key: "backStyle", equals: "slats" } },
  { group: "back", type: "number", key: "topRailHeight", label: "頂橫木寬 (mm)", defaultValue: 0, min: 0, max: 120, step: 5, help: "0 = 自動（椅背高的 1/3，最大 50）；自己填值會優先", dependsOn: { key: "backStyle", notIn: ["none", "panel"] } },
  { group: "back", type: "number", key: "topRailThickness", label: "頂橫木厚 (mm)", defaultValue: 22, min: 12, max: 50, step: 1, dependsOn: { key: "backStyle", notIn: ["none", "panel"] } },
  { group: "back", type: "number", key: "backRailInsetZ", label: "支撐柱距椅面後緣 (mm)", defaultValue: 0, min: 0, max: 200, step: 5, help: "椅背支撐柱後緣從椅面後緣往前的距離；0 = 柱後緣與椅面後緣對齊", dependsOn: { key: "backStyle", notIn: ["none", "panel"] } },
  { group: "back", type: "number", key: "backRailInsetX", label: "支撐柱距椅面端面 (mm)", defaultValue: 0, min: 0, max: 200, step: 5, help: "椅背支撐柱外緣從椅面左/右端面往內的距離；0 = 柱外緣與椅面端面對齊", dependsOn: { key: "backStyle", notIn: ["none", "panel"] } },
  { group: "back", type: "number", key: "backRailPostWidth", label: "支撐柱寬 X (mm)", defaultValue: 25, min: 0, max: 120, step: 1, help: "預設 25 比椅腳細，視覺上更分離（rail/slats 椅常見）；填 0 = 跟椅腳粗一樣", dependsOn: { key: "backStyle", notIn: ["none", "panel"] } },
  { group: "back", type: "number", key: "backRailPostThickness", label: "支撐柱厚 Z (mm)", defaultValue: 25, min: 0, max: 120, step: 1, help: "預設 25 比椅腳細；填 0 = 跟椅腳厚一樣", dependsOn: { key: "backStyle", notIn: ["none", "panel"] } },
  { group: "stretcher", type: "number", key: "footrestWidth", label: "腳踏寬 (mm)", defaultValue: 30, min: 20, max: 60, step: 1, help: "腳踏橫撐的垂直高（粗）" },
  { group: "stretcher", type: "number", key: "footrestThickness", label: "腳踏厚 (mm)", defaultValue: 22, min: 12, max: 40, step: 1, help: "腳踏橫撐的水平厚（深）" },
  { group: "stretcher", type: "number", key: "footrestStaggerMm", label: "下橫撐錯開 (mm)", defaultValue: 0, min: 0, max: 60, step: 2, help: "左右下橫撐（Z 軸）相對前後下橫撐上移量，3D 即時顯示，榫頭整支跟著。0 = 等高（自動上下半榫避免穿模）" },
];

/**
 * 吧檯椅（bar stool）
 * 高度 700–800mm，一圈腳踏橫撐在較低位置；可選加短椅背。
 */
export const barStool: FurnitureTemplate = (input): FurnitureDesign => {
  const { length, width, height, material } = input;
  const o = barStoolOptions;
  const legShape = getOption<string>(input, opt(o, "legShape"));
  const legSize = getOption<number>(input, opt(o, "legSize"));
  const legWidthOverride = getOption<number>(input, opt(o, "legWidthOverride"));
  const legDepthOverride = getOption<number>(input, opt(o, "legDepthOverride"));
  const legW = legWidthOverride > 0 ? legWidthOverride : legSize;
  const legD = legDepthOverride > 0 ? legDepthOverride : legSize;
  const legInset = getOption<number>(input, opt(o, "legInset"));
  const apronStaggerMm = getOption<number>(input, opt(o, "apronStaggerMm"));
  const footrestStaggerMm = getOption<number>(input, opt(o, "footrestStaggerMm"));
  const legPenetratingTenon = getOption<boolean>(input, opt(o, "legPenetratingTenon"));
  const seatThickness = getOption<number>(input, opt(o, "seatThickness"));
  const seatEdge = getOption<string>(input, opt(o, "seatEdge"));
  const seatEdgeStyle = getOption<string>(input, opt(o, "seatEdgeStyle"));
  const seatProfile = getOption<string>(input, opt(o, "seatProfile"));
  const seatCornerR = getOption<number>(input, opt(o, "seatCornerR"));
  const seatBendMm = getOption<number>(input, opt(o, "seatBendMm"));
  const legEdge = getOption<number>(input, opt(o, "legEdge"));
  const legEdgeStyle = getOption<string>(input, opt(o, "legEdgeStyle"));
  const stretcherEdge = getOption<number>(input, opt(o, "stretcherEdge"));
  const stretcherEdgeStyle = getOption<string>(input, opt(o, "stretcherEdgeStyle"));
  const footrestHeight = getOption<number>(input, opt(o, "footrestHeight"));
  const apronWidth = getOption<number>(input, opt(o, "apronWidth"));
  const apronOffset = getOption<number>(input, opt(o, "apronOffset"));
  const backStyle = getOption<string>(input, opt(o, "backStyle"));
  const backHeightOpt = getOption<number>(input, opt(o, "backHeight"));
  const backSlatCount = getOption<number>(input, opt(o, "backSlats"));
  const backSlatWidth = getOption<number>(input, opt(o, "backSlatWidth"));
  const backPanelHeight = getOption<number>(input, opt(o, "backPanelHeight"));
  const backPanelThickness = getOption<number>(input, opt(o, "backPanelThickness"));
  const backPanelCornerR = getOption<number>(input, opt(o, "backPanelCornerR"));
  const backPanelFaceBend = getOption<number>(input, opt(o, "backPanelFaceBend"));
  const backPanelTopArch = getOption<number>(input, opt(o, "backPanelTopArch"));
  const backPanelBottomArch = getOption<number>(input, opt(o, "backPanelBottomArch"));
  const backPostDiameter = getOption<number>(input, opt(o, "backPostDiameter"));
  const backPanelInset = getOption<number>(input, opt(o, "backPanelInset"));
  const backReclineDeg = getOption<number>(input, opt(o, "backReclineDeg"));
  const backPostFromEdge = getOption<number>(input, opt(o, "backPostFromEdge"));
  const backPanelEmbed = getOption<number>(input, opt(o, "backPanelEmbed"));
  const backRailInsetZ = getOption<number>(input, opt(o, "backRailInsetZ"));
  const backRailInsetX = getOption<number>(input, opt(o, "backRailInsetX"));
  const backRailPostWidthOpt = getOption<number>(input, opt(o, "backRailPostWidth"));
  const backRailPostThicknessOpt = getOption<number>(input, opt(o, "backRailPostThickness"));
  const footRestWidth = getOption<number>(input, opt(o, "footrestWidth"));
  const footRestThickness = getOption<number>(input, opt(o, "footrestThickness"));
  const splayAngle = getOption<number>(input, opt(o, "splayAngle"));
  const withBack = backStyle !== "none";

  const apronThickness = getOption<number>(input, opt(o, "apronThickness"));
  // 直榫標準（drafting-math.md §B2）：榫厚 = 公件厚 / 3、肩寬固定 5mm 4 邊全肩、
  // 盲榫長 = round(2/3 × 母厚, ≥25mm)、通榫長 = 母厚。
  // 自動類型規則：母厚 ≤ 25mm → 通榫；> 25mm → 盲榫
  // legPenetratingTenon = true 時強制牙板/腳踏進腳通榫（明榫裝飾）
  // 母件厚度用 min(legW, legD)（取較薄面決定通/盲）
  const legShortDim = Math.min(legW, legD);
  // 1) leg ↔ seat：腳頂進座板，依自動規則
  const legTopTenonType = autoTenonType(seatThickness);
  const legTenonStd = standardTenon({
    type: legTopTenonType,
    childThickness: legShortDim,
    childWidth: legShortDim,
    motherThickness: seatThickness,
  });
  const seatTopTenonLen = legTenonStd.length;
  const legTopTenonSize = legTenonStd.width;  // 跟 standardTenon 一致
  // 2) apron ↔ leg：依自動規則 + legPenetratingTenon override
  const apronTenonType = legPenetratingTenon ? "through-tenon" : autoTenonType(legShortDim);
  const apronTenonStd = standardTenon({
    type: apronTenonType === "through-tenon" ? "through-tenon" : "shouldered-tenon",
    childThickness: apronThickness,
    childWidth: apronWidth,
    motherThickness: legShortDim,
  });
  // 通榫加 5mm 補償斜腳 rotation tilt 的世界軸投影損失
  const apronTenonLen = apronTenonStd.length + (apronTenonType === "through-tenon" ? 5 : 0);
  const apronTenonThick = apronTenonStd.thickness;
  const apronTenonW = apronTenonStd.width;
  // 3) footrest ↔ leg：依自動規則 + legPenetratingTenon override
  const frTenonType = legPenetratingTenon ? "through-tenon" : autoTenonType(legShortDim);
  const frTenonStd = standardTenon({
    type: frTenonType === "through-tenon" ? "through-tenon" : "shouldered-tenon",
    childThickness: footRestThickness,
    childWidth: footRestWidth,
    motherThickness: legShortDim,
  });
  const frTenonLen = frTenonStd.length + (frTenonType === "through-tenon" ? 5 : 0);
  const frTenonThick = frTenonStd.thickness;
  const frTenonW = frTenonStd.width;

  // 牙板錯開策略（連續位移 — 套用方凳基礎規則）：
  //   stagger > 0 → 前後牙板（X 軸，正視圖全寬）整支物理下移，榫頭整支跟著
  //   stagger == 0 → 自動上下半榫錯位避免同位撞：
  //     - 靜止 Z（左右）拿上榫；移動 X（前後，下移）拿下榫
  const apronVisuallyStaggered = apronStaggerMm > 0;
  const APRON_TOP_SHOULDER = 10;
  const apronTotalTenonH = apronWidth - APRON_TOP_SHOULDER;
  const apronCanHalfStagger = apronStaggerMm < apronTenonW && apronTotalTenonH >= 16;
  const APRON_HALF_TENON_GAP = 4;
  const apronHalfTenonH = apronCanHalfStagger
    ? Math.min(apronTenonW, Math.floor((apronTotalTenonH + apronStaggerMm - APRON_HALF_TENON_GAP) / 2))
    : apronTenonW;
  const apronUpperTenonH = apronHalfTenonH;
  const apronLowerTenonH = apronHalfTenonH;
  const apronUpperTenonOffset = apronCanHalfStagger
    ? (apronWidth - APRON_TOP_SHOULDER - apronUpperTenonH / 2) - apronWidth / 2
    : 0;
  const apronLowerTenonOffset = apronCanHalfStagger
    ? apronLowerTenonH / 2 - apronWidth / 2
    : 0;

  // 腳踏錯開策略（連續位移 — 同方凳下橫撐規則）：
  //   stagger > 0 → 左右腳踏（Z 軸，側視圖全寬）整支物理上移
  //   stagger == 0 → 自動半榫錯位：靜止 X（前後）= 下榫；移動 Z（左右）= 上榫
  const frVisuallyStaggered = footrestStaggerMm > 0;
  const frCanHalfStagger = footrestStaggerMm < frTenonW && footRestWidth >= 16;
  const FR_HALF_TENON_GAP = 4;
  const frHalfTenonH = frCanHalfStagger
    ? Math.min(frTenonW, Math.floor((footRestWidth + footrestStaggerMm - FR_HALF_TENON_GAP) / 2))
    : frTenonW;
  const frUpperTenonH = frHalfTenonH;
  const frLowerTenonH = frHalfTenonH;
  const frUpperTenonOffset = frCanHalfStagger ? (footRestWidth / 2 - frUpperTenonH / 2) : 0;
  const frLowerTenonOffset = frCanHalfStagger ? (frLowerTenonH / 2 - footRestWidth / 2) : 0;

  // 腳頂榫朝家具中心偏（X 軸），legInset === 0 才偏（避免座板外側木材太薄破裂）
  const legTopType: "through-tenon" | "blind-tenon" =
    legTopTenonType === "through-tenon" ? "through-tenon" : "blind-tenon";
  const legTopInsetX = legInset === 0
    ? Math.max(0, Math.round((legW - legTenonStd.width) / 2))
    : 0;

  const seatY = height - seatThickness;
  const backHeight = withBack ? backHeightOpt : 0;
  const halfL = length / 2 - legW / 2 - legInset;
  const halfW = width / 2 - legD / 2 - legInset;
  const cornerPts = [
    { x: -halfL, z: -halfW },
    { x: halfL, z: -halfW },
    { x: -halfL, z: halfW },
    { x: halfL, z: halfW },
  ];
  const innerSpanX = length - legW - 2 * legInset;
  const innerSpanZ = width - legD - 2 * legInset;
  const legEdgeZ = halfW;
  const legEdgeX = halfL;

  // Leg shape mapping (same set as dining-table / dining-chair)
  // splayMm = tan(splayAngle) × seatY，腳底向外偏移量
  //
  // 前後腳幾何規則（rail / slats 後腳延伸到椅背頂時）：
  //   X 軸（左右）：前腳左右距離 = 後腳左右距離 → X 偏移用 constant splayMm
  //                 （不依腳高放大），讓 4 腳左右對齊在地面
  //   Z 軸（前後）：前後腳要平行（同斜角）→ Z 偏移依該腳實際高度放大，
  //                 確保 atan(dz/H) 對前/後腳相同
  // 弧形板（panel）背：後腳本來就只到 seatY、跟前腳同高，自動兩條件都成立。
  const splayMm = Math.round(Math.tan((splayAngle * Math.PI) / 180) * seatY);
  const splayAngleRad = (splayAngle * Math.PI) / 180;
  const splayMmFor = (c: { x: number; z: number }): { x: number; z: number } => {
    const isTallBack = c.z > 0 && withBack && backStyle !== "panel";
    const legH = isTallBack ? seatY + backHeight : seatY;
    return {
      x: splayMm, // X 等距：4 腳同 offset
      z: Math.round(Math.tan(splayAngleRad) * legH), // Z 平行：依高度縮放
    };
  };
  const hoofMm = 30;
  const legShapeFor = (c: { x: number; z: number }): Part["shape"] => {
    if (legShape === "tapered") return { kind: "tapered", bottomScale: 0.6 };
    if (legShape === "strong-taper") return { kind: "tapered", bottomScale: 0.4 };
    if (legShape === "inverted") return { kind: "tapered", bottomScale: 1.25 };
    const sm = splayMmFor(c);
    if (legShape === "splayed") {
      return {
        kind: "splayed",
        dxMm: Math.sign(c.x) * sm.x,
        dzMm: Math.sign(c.z) * sm.z,
        chamferMm: legEdge > 0 ? legEdge : undefined,
        chamferStyle: legEdgeStyle === "rounded" ? "rounded" : "chamfered",
      };
    }
    if (legShape === "splayed-length") {
      return { kind: "splayed", dxMm: Math.sign(c.x) * sm.x, dzMm: 0, chamferMm: legEdge > 0 ? legEdge : undefined, chamferStyle: legEdgeStyle === "rounded" ? "rounded" : "chamfered" };
    }
    if (legShape === "splayed-width") {
      return { kind: "splayed", dxMm: 0, dzMm: Math.sign(c.z) * sm.z, chamferMm: legEdge > 0 ? legEdge : undefined, chamferStyle: legEdgeStyle === "rounded" ? "rounded" : "chamfered" };
    }
    if (legShape === "hoof") return { kind: "hoof", hoofMm, hoofScale: 1.3 };
    return undefined;
  };

  // 椅背 joinery 位置：頂橫木 + 板條 X 座標——legs / rail / apron / seat 都要引用
  const topRailHOverride = getOption<number>(input, opt(o, "topRailHeight"));
  const topRailH = withBack
    ? (topRailHOverride > 0 ? topRailHOverride : Math.min(50, Math.round(backHeight / 3)))
    : 0;
  const topRailThickness = getOption<number>(input, opt(o, "topRailThickness"));
  const topRailY = withBack ? seatY + backHeight - topRailH : 0;
  const topRailYCenter = topRailY + topRailH / 2;
  const topRailTenonW = withBack ? Math.max(12, topRailH - 10) : 0;
  const topRailTenonThick = 17;
  const slatXs: number[] = [];
  const slatThicknessConst = getOption<number>(input, opt(o, "backSlatThickness"));
  const slatTenonLen = 12;
  const slatTenonW = (w: number) => Math.max(10, w - 10);
  const slatTenonT = Math.max(5, Math.round(slatThicknessConst / 3));
  // 椅背支撐柱尺寸：0 = 沿用椅腳粗厚，否則自訂
  const postW = backRailPostWidthOpt > 0 ? backRailPostWidthOpt : legW;
  const postD = backRailPostThicknessOpt > 0 ? backRailPostThicknessOpt : legD;
  if (withBack && backStyle === "slats" && backSlatCount > 0) {
    // 直條寬度 = 兩支 back-post 內側之間（受 backRailInsetX + 柱寬影響），
    // 留 40mm 邊距防榫眼太靠近端面
    const availableW = length - postW - 40 - 2 * backRailInsetX;
    const pitch = availableW / (backSlatCount + 1);
    for (let i = 0; i < backSlatCount; i++) {
      slatXs.push(-availableW / 2 + pitch * (i + 1));
    }
  }

  const legs: Part[] = cornerPts.map((c, i) => {
    // 所有椅腳統一只到 seatY；rail / slats / panel 的椅背支撐都由獨立垂直木處理
    // （之前 rail/slats 讓後腳延伸到 seatY+backHeight，配上 splayed 會造成
    //  後腳左右距離跟前腳不等距、正視也不重疊。改用獨立支撐木分離）
    const isBack = false;
    const legTotalH = seatY;
    return {
      id: `leg-${i + 1}`,
      nameZh: isBack ? `後椅腳 ${i + 1}` : `椅腳 ${i + 1}`,
      material,
      grainDirection: "length",
      visible: { length: legW, width: legD, thickness: legTotalH },
      origin: { x: c.x, y: 0, z: c.z },
      shape: legShapeFor(c) ?? legEdgeShape(legEdge, legEdgeStyle),
      tenons: isBack ? [] : [
        // 腳頂進座板：tenon X 軸朝家具中心偏（legInset=0 才偏），內側無肩
        {
          position: "top",
          type: legTopType,
          length: legTenonStd.length,
          width: legTenonStd.width,
          thickness: legTenonStd.thickness,
          shoulderOn: (() => {
            if (legTopInsetX <= 0 || c.x === 0) return [...legTenonStd.shoulderOn];
            const innerSide: "left" | "right" = c.x > 0 ? "left" : "right";
            return [...legTenonStd.shoulderOn].filter((s) => s !== innerSide);
          })(),
          offsetWidth: -Math.sign(c.x) * legTopInsetX,
        },
      ],
      // 牙板：靜止 Z（左右）= 上半榫；移動 X（前後，下移）= 下半榫
      // 腳踏：靜止 X（前後）= 下半榫；移動 Z（左右，上移）= 上半榫
      mortises: [
        // === 牙板 ===
        // Z 面 mortise（接 Z 軸 = 左右牙板, 靜止）— 上榫
        {
          origin: {
            x: 0,
            y: (seatY - apronWidth / 2 - apronOffset) + (apronCanHalfStagger ? apronUpperTenonOffset : 0),
            z: c.z > 0 ? -1 : 1,
          },
          depth: apronTenonLen,
          length: apronCanHalfStagger ? apronUpperTenonH : apronTenonW,
          width: apronTenonThick,
          through: apronTenonType === "through-tenon",
        },
        // X 面 mortise（接 X 軸 = 前後牙板, 下移）— 下榫
        {
          origin: {
            x: c.x > 0 ? -1 : 1,
            y: (seatY - apronWidth / 2 - apronOffset) - (apronVisuallyStaggered ? apronStaggerMm : 0)
              + (apronCanHalfStagger ? apronLowerTenonOffset : 0),
            z: 0,
          },
          depth: apronTenonLen,
          length: apronCanHalfStagger ? apronLowerTenonH : apronTenonW,
          width: apronTenonThick,
          through: apronTenonType === "through-tenon",
        },
        // === 腳踏 ===
        // Z 面 mortise（接 Z 軸 = 左右腳踏, 上移）— 上榫
        {
          origin: {
            x: 0,
            y: (footrestHeight + footRestWidth / 2) + (frVisuallyStaggered ? footrestStaggerMm : 0)
              + (frCanHalfStagger ? frUpperTenonOffset : 0),
            z: c.z > 0 ? -1 : 1,
          },
          depth: frTenonLen,
          length: frCanHalfStagger ? frUpperTenonH : frTenonW,
          width: frTenonThick,
          through: frTenonType === "through-tenon",
        },
        // X 面 mortise（接 X 軸 = 前後腳踏, 靜止）— 下榫
        {
          origin: {
            x: c.x > 0 ? -1 : 1,
            y: (footrestHeight + footRestWidth / 2) + (frCanHalfStagger ? frLowerTenonOffset : 0),
            z: 0,
          },
          depth: frTenonLen,
          length: frCanHalfStagger ? frLowerTenonH : frTenonW,
          width: frTenonThick,
          through: frTenonType === "through-tenon",
        },
        // 背腳：椅背頂橫木的母榫眼
        ...(isBack
          ? [
              {
                origin: { x: c.x > 0 ? -1 : 1, y: topRailYCenter, z: 0 },
                depth: apronTenonLen,
                length: topRailTenonW,
                width: topRailTenonThick,
                through: false,
              },
            ]
          : []),
      ],
    };
  });

  const seatPanel: Part = {
    id: "seat",
    nameZh: "座板",
    material,
    grainDirection: "length",
    visible: { length, width, thickness: seatThickness },
    origin: { x: 0, y: seatY, z: 0 },
    shape: (() => {
      // 椅面整片彎曲（bent plywood 視覺）：face-rounded.bendMm 是唯一支援大面 bend 的形狀。
      // 啟用會覆蓋 scoop / edge profile，但保留 cornerR；負值讓中央往 -Z（下）凹陷
      if (seatBendMm > 0) {
        return { kind: "face-rounded" as const, cornerR: seatCornerR, bendMm: -seatBendMm, bendAxis: "y" as const };
      }
      const scoop = seatScoopShape(seatProfile);
      if (scoop) return scoop;
      // chamfered-top 加上 cornerR（4 角圓角，俯視）。即使 seatEdge=0 也建一個帶 cornerR 的 chamfered-top。
      const edge = seatEdgeShape(seatEdge, seatEdgeStyle);
      if (edge && seatCornerR > 0) return { ...edge, cornerR: seatCornerR };
      if (edge) return edge;
      if (seatCornerR > 0) return { kind: "chamfered-top" as const, chamferMm: 0, cornerR: seatCornerR };
      return undefined;
    })(),
    tenons: [],
    // 前腳通榫進來；後腳穿過座板高度範圍，要開大孔讓腳通過。
    // slats 從座板上面立起到頂橫木 → 座板上緣加 slat 母榫眼
    mortises: [
      ...cornerPts
        .filter((c) => !(withBack && c.z > 0))
        .map((c) => ({
          origin: { x: c.x - Math.sign(c.x) * legTopInsetX, y: 0, z: c.z },
          depth: legTenonStd.length,
          length: legTenonStd.width,
          width: legTenonStd.thickness,
          through: legTopTenonType === "through-tenon",
        })),
      ...cornerPts
        .filter((c) => withBack && c.z > 0)
        .map((c) => ({
          origin: { x: c.x, y: 0, z: c.z },
          depth: seatThickness,
          length: legSize,
          width: legSize,
          through: true,
        })),
      ...slatXs.map((sx) => ({
        origin: { x: sx, y: seatThickness, z: legEdgeZ },
        depth: slatTenonLen,
        length: slatTenonW(backSlatWidth),
        width: slatTenonT,
        through: false,
      })),
    ],
  };

  const ringY = seatY - apronWidth - apronOffset;

  // 斜腳補償（同 square-stool）：以橫撐中軸 Y 為基準算 splay 偏移 → 中軸跟腳中軸對齊；
  // 上下緣縮放成 trapezoid → 端面跟著腳傾斜；rotation 帶 tilt → 橫撐軸與腳軸平行。
  // tapered 補償（drafting-math.md §A11）：legW × legScaleAt(centerY) 算實際腳寬。
  const isLengthSplay = legShape === "splayed" || legShape === "splayed-length";
  const isWidthSplay = legShape === "splayed" || legShape === "splayed-width";
  const splayDx = isLengthSplay ? splayMm : 0;
  const splayDz = isWidthSplay ? splayMm : 0;
  const isSplayed = splayDx > 0 || splayDz > 0;
  const bottomScale = legBottomScale(legShape);
  const tiltX = splayDx > 0 ? Math.atan(splayDx / seatY) : 0;
  const tiltZ = splayDz > 0 ? Math.atan(splayDz / seatY) : 0;

  // 通用：給定該層橫撐的「橫撐料」中軸 Y 與料厚 W，產生四面 sides。
  const buildSides = (centerY: number, beamWidth: number, namePrefix: string) => {
    const botY = centerY - beamWidth / 2;
    const topY = centerY + beamWidth / 2;
    const shiftAt = (yMm: number) => seatY > 0 ? 1 - yMm / seatY : 0;
    const sCenter = shiftAt(centerY);
    const sBot = shiftAt(botY);
    const sTop = shiftAt(topY);
    const splayXc = splayDx * sCenter;
    const splayZc = splayDz * sCenter;
    const splayXt = splayDx * sTop;
    const splayZt = splayDz * sTop;
    const splayXb = splayDx * sBot;
    const splayZb = splayDz * sBot;
    // 該 Y 位置的腳寬（含 taper 補償）
    const lwC = legW * legScaleAt(centerY, seatY, bottomScale);
    const lwT = legW * legScaleAt(topY, seatY, bottomScale);
    const lwB = legW * legScaleAt(botY, seatY, bottomScale);
    const ldC = legD * legScaleAt(centerY, seatY, bottomScale);
    const ldT = legD * legScaleAt(topY, seatY, bottomScale);
    const ldB = legD * legScaleAt(botY, seatY, bottomScale);
    return {
      sides: [
        // butt-joint 慣例：visible.length 兩端剛好頂在腳的內側面（含 taper 補償）
        // = innerSpan(中心到中心) − legW@centerY(扣兩半邊腳) + 2×splayXc（外斜補償）
        // joinery 模式靠 cut-dimensions 加 tenon，3D 不延伸到腳裡。
        { key: "front", nameZh: `前${namePrefix}`, visibleLength: innerSpanX - lwC + 2 * splayXc, axis: "x" as const, sx: 0, sz: -1, origin: { x: 0, z: -(legEdgeZ + splayZc) } },
        { key: "back", nameZh: `後${namePrefix}`, visibleLength: innerSpanX - lwC + 2 * splayXc, axis: "x" as const, sx: 0, sz: 1, origin: { x: 0, z: legEdgeZ + splayZc } },
        { key: "left", nameZh: `左${namePrefix}`, visibleLength: innerSpanZ - ldC + 2 * splayZc, axis: "z" as const, sx: -1, sz: 0, origin: { x: -(legEdgeX + splayXc), z: 0 } },
        { key: "right", nameZh: `右${namePrefix}`, visibleLength: innerSpanZ - ldC + 2 * splayZc, axis: "z" as const, sx: 1, sz: 0, origin: { x: legEdgeX + splayXc, z: 0 } },
      ],
      splayXc, splayZc, splayXt, splayZt, splayXb, splayZb,
      lwC, lwT, lwB, ldC, ldT, ldB,
    };
  };

  const apronCenterY = ringY + apronWidth / 2;
  const apronB = buildSides(apronCenterY, apronWidth, "牙板");
  const aprons: Part[] = apronB.sides.map((s) => {
    // butt-joint 半長 = legEdge + splay − legW@Y / 2，trapezoid 上下 scale 用 top/bot
    const halfX_C = legEdgeX + apronB.splayXc - apronB.lwC / 2;
    const halfX_T = legEdgeX + apronB.splayXt - apronB.lwT / 2;
    const halfX_B = legEdgeX + apronB.splayXb - apronB.lwB / 2;
    const halfZ_C = legEdgeZ + apronB.splayZc - apronB.ldC / 2;
    const halfZ_T = legEdgeZ + apronB.splayZt - apronB.ldT / 2;
    const halfZ_B = legEdgeZ + apronB.splayZb - apronB.ldB / 2;
    const hasShapeBend = splayDx > 0 || splayDz > 0 || bottomScale !== 1;
    const trapTopScale =
      s.axis === "x" && hasShapeBend
        ? halfX_T / halfX_C
        : s.axis === "z" && hasShapeBend
          ? halfZ_T / halfZ_C
          : null;
    const trapBotScale =
      s.axis === "x" && hasShapeBend
        ? halfX_B / halfX_C
        : s.axis === "z" && hasShapeBend
          ? halfZ_B / halfZ_C
          : 1;
    const bevelAngle = isSplayed
      ? s.axis === "x" ? -s.sz * tiltZ : -s.sx * tiltX
      : 0;
    // bevel 規則：頂面跟椅面重疊（apronOffset=0）才半 bevel 讓頂面水平；其他情況無 bevel
    const apronTopAtSeat = apronOffset === 0;
    const useTopBevel = isSplayed && apronTopAtSeat;
    const partShape = trapTopScale !== null
      ? { kind: "apron-trapezoid" as const, topLengthScale: trapTopScale, bottomLengthScale: trapBotScale, bevelAngle: useTopBevel ? bevelAngle : undefined, bevelMode: useTopBevel ? "half" as const : undefined }
      : legEdgeShape(stretcherEdge, stretcherEdgeStyle);
    return {
      id: `apron-${s.key}`,
      nameZh: s.nameZh,
      material,
      grainDirection: "length" as const,
      visible: { length: s.visibleLength, width: apronWidth, thickness: apronThickness },
      // 前後（x 軸）牙板物理下移 apronStaggerMm；左右（z）不動
      origin: { x: s.origin.x, y: ringY - (apronVisuallyStaggered && s.axis === "x" ? apronStaggerMm : 0), z: s.origin.z },
      rotation: s.axis === "z"
        ? { x: Math.PI / 2, y: Math.PI / 2, z: s.sx * tiltX }
        : { x: Math.PI / 2 + (-s.sz) * tiltZ, y: 0, z: 0 },
      shape: partShape,
      tenons: (() => {
        const tenonType: "through-tenon" | "shouldered-tenon" =
          apronTenonType === "through-tenon" ? "through-tenon" : "shouldered-tenon";
        if (!apronCanHalfStagger) {
          const mk = (position: "start" | "end") => ({
            position,
            type: tenonType,
            length: apronTenonLen,
            width: apronTenonW,
            thickness: apronTenonThick,
            shoulderOn: [...apronTenonStd.shoulderOn],
          });
          return [mk("start"), mk("end")];
        }
        // A 半榫錯位 — 靜止 Z（左右）= 上榫；移動 X（前後，下移）= 下榫
        const isUpper = s.axis === "z";
        const tenonH = isUpper ? apronUpperTenonH : apronLowerTenonH;
        const worldOffset = isUpper ? apronUpperTenonOffset : apronLowerTenonOffset;
        const shoulderOn: Array<"top" | "bottom" | "left" | "right"> = isUpper
          ? ["top", "left", "right"]
          : ["left", "right"];
        const mk = (position: "start" | "end") => ({
          position,
          type: tenonType,
          length: apronTenonLen,
          width: tenonH,
          thickness: apronTenonThick,
          shoulderOn,
          offsetWidth: -worldOffset,
        });
        return [mk("start"), mk("end")];
      })(),
      mortises: [],
    };
  });

  const frCenterY = footrestHeight + footRestWidth / 2;
  const frB = buildSides(frCenterY, footRestWidth, "腳踏");
  const footRests: Part[] = frB.sides.map((s) => {
    // butt-joint 半長 = legEdge + splay − legW@Y / 2，trapezoid 上下 scale 用 top/bot
    const halfX_C = legEdgeX + frB.splayXc - frB.lwC / 2;
    const halfX_T = legEdgeX + frB.splayXt - frB.lwT / 2;
    const halfX_B = legEdgeX + frB.splayXb - frB.lwB / 2;
    const halfZ_C = legEdgeZ + frB.splayZc - frB.ldC / 2;
    const halfZ_T = legEdgeZ + frB.splayZt - frB.ldT / 2;
    const halfZ_B = legEdgeZ + frB.splayZb - frB.ldB / 2;
    const hasShapeBend = splayDx > 0 || splayDz > 0 || bottomScale !== 1;
    const trapTopScale =
      s.axis === "x" && hasShapeBend
        ? halfX_T / halfX_C
        : s.axis === "z" && hasShapeBend
          ? halfZ_T / halfZ_C
          : null;
    const trapBotScale =
      s.axis === "x" && hasShapeBend
        ? halfX_B / halfX_C
        : s.axis === "z" && hasShapeBend
          ? halfZ_B / halfZ_C
          : 1;
    // 下橫撐（腳踏）：trapezoid 是腳幾何要求（兩端縮到腳寬避免縫），但不 bevel（上下都跟腳斜，自由邊）
    const partShape = trapTopScale !== null
      ? { kind: "apron-trapezoid" as const, topLengthScale: trapTopScale, bottomLengthScale: trapBotScale }
      : legEdgeShape(stretcherEdge, stretcherEdgeStyle);
    return {
      id: `footrest-${s.key}`,
      nameZh: `腳踏-${s.nameZh.replace("腳踏", "")}`,
      material,
      grainDirection: "length" as const,
      visible: { length: s.visibleLength, width: footRestWidth, thickness: footRestThickness },
      // 左右（z 軸）腳踏整支上移；前後（x）不動
      origin: { x: s.origin.x, y: footrestHeight + (frVisuallyStaggered && s.axis === "z" ? footrestStaggerMm : 0), z: s.origin.z },
      rotation: s.axis === "z"
        ? { x: Math.PI / 2, y: Math.PI / 2, z: s.sx * tiltX }
        : { x: Math.PI / 2 + (-s.sz) * tiltZ, y: 0, z: 0 },
      shape: partShape,
      tenons: (() => {
        const frType: "through-tenon" | "blind-tenon" =
          frTenonType === "through-tenon" ? "through-tenon" : "blind-tenon";
        if (!frCanHalfStagger) {
          const mk = (position: "start" | "end") => ({
            position,
            type: frType,
            length: frTenonLen,
            width: frTenonW,
            thickness: frTenonThick,
            shoulderOn: [...frTenonStd.shoulderOn],
          });
          return [mk("start"), mk("end")];
        }
        // A 半榫錯位 — 靜止 X（前後）= 下榫；移動 Z（左右，上移）= 上榫
        const isUpper = s.axis === "z";
        const tenonH = isUpper ? frUpperTenonH : frLowerTenonH;
        const worldOffset = isUpper ? frUpperTenonOffset : frLowerTenonOffset;
        // 下橫撐上下都不留肩，僅保留 left/right（thickness 軸）
        const shoulderOn: Array<"top" | "bottom" | "left" | "right"> = ["left", "right"];
        const mk = (position: "start" | "end") => ({
          position,
          type: frType,
          length: frTenonLen,
          width: tenonH,
          thickness: frTenonThick,
          shoulderOn,
          offsetWidth: -worldOffset,
        });
        return [mk("start"), mk("end")];
      })(),
      mortises: [],
    };
  });

  const parts: Part[] = [seatPanel, ...legs, ...aprons, ...footRests];

  if (withBack) {
    if (backStyle !== "panel") {
    // rail / slats 模式的椅背支撐柱：2 根方截面，從 seatY 起到 seatY+backHeight。
    // 獨立於椅腳，這樣腳可以隨意 splay、正視也能跟前腳重疊。
    // backRailInsetZ：柱後緣從椅面後緣往前的距離（0 = 對齊）
    // backRailInsetX：柱外緣從椅面端面往內的距離（0 = 對齊）
    // postW / postD：柱寬厚（可獨立於椅腳粗）
    const backCorners = cornerPts.filter((c) => c.z > 0);
    const postZ = width / 2 - postD / 2 - backRailInsetZ;
    backCorners.forEach((c, i) => {
      const postX = Math.sign(c.x) * (length / 2 - postW / 2 - backRailInsetX);
      parts.push({
        id: `back-post-${i + 1}`,
        nameZh: `椅背支撐柱 ${i + 1}`,
        material,
        grainDirection: "length",
        visible: { length: postW, width: postD, thickness: backHeight },
        origin: { x: postX, y: seatY, z: postZ },
        shape: legEdgeShape(legEdge, legEdgeStyle),
        tenons: [],
        mortises: [
          {
            origin: { x: postX > 0 ? -1 : 1, y: topRailYCenter - seatY, z: 0 },
            depth: apronTenonLen,
            length: topRailTenonW,
            width: topRailTenonThick,
            through: false,
          },
        ],
      });
    });
    // 頂橫木：跨在兩支 back-post 上方。length 跟 X/Z 都跟著 back-post 走。
    const railLen = length - postW - 2 * backRailInsetX + 2 * apronTenonLen;
    parts.push({
      id: "back-rail",
      nameZh: "椅背頂橫木",
      material,
      grainDirection: "length",
      visible: { length: railLen, width: topRailThickness, thickness: topRailH },
      origin: { x: 0, y: topRailY, z: postZ },
      tenons: [
        { position: "start", type: "blind-tenon", length: apronTenonLen, width: topRailTenonW, thickness: topRailTenonThick },
        { position: "end", type: "blind-tenon", length: apronTenonLen, width: topRailTenonW, thickness: topRailTenonThick },
      ],
      mortises: slatXs.map((sx) => ({
        origin: { x: sx, y: 0, z: 0 },
        depth: slatTenonLen,
        length: slatTenonW(backSlatWidth),
        width: slatTenonT,
        through: false,
      })),
    });
    }
    if (backStyle === "panel") {
      // 弧形板背：板跨左右後腳間，圓柱貼在板背面，距板端面 backPostFromEdge
      // 板沒有榫（tenons: []），所以不加 apronTenonLen；同時上限 = 椅面 length，避免板突出椅面
      const panelLen = Math.min(innerSpanX + 2 * apronTenonLen, length);
      // 參照物 = 圓柱「接座板處」的後緣（圓柱底端）。inset=0 → 圓柱底後緣對齊椅面後緣
      // 後仰時圓柱底端會往 -Z 偏 reclineDz，故 postZ（中心，頂端在此 Z）需 +reclineDz 補回
      const reclineRad = (backReclineDeg * Math.PI) / 180;
      const reclineDz = Math.tan(reclineRad) * backHeight;
      const postBottomBackZ = width / 2 - backPanelInset; // 圓柱底端後緣 Z（基準）
      const postZ_calc = postBottomBackZ - backPostDiameter / 2 + reclineDz;
      const postX = panelLen / 2 - backPostFromEdge - backPostDiameter / 2;
      const postZ = postZ_calc;
      const postBottomY = seatY;
      const postH = backHeight;
      const panelTopY = seatY + backHeight;
      const panelOriginY = panelTopY - backPanelHeight;
      // 兩支圓柱：正視圖直立（X 不斜），側視圖跟著靠背後仰角度斜（Z 方向）；reclineRad/reclineDz 已在上面定義
      [-1, 1].forEach((sx) => {
        parts.push({
          id: `back-post-${sx > 0 ? "right" : "left"}`,
          nameZh: `椅背圓柱-${sx > 0 ? "右" : "左"}`,
          material,
          grainDirection: "length",
          visible: { length: backPostDiameter, width: backPostDiameter, thickness: postH },
          // round + rotation 讓圓柱後仰；之前用 splayed 會 fallback 成方柱（splayed 不在 isRound）
          // rotation 繞 mesh 中心，所以 origin.z 要往後偏 halfPostH×sin θ 讓底端回到原位
          origin: { x: sx * postX, y: postBottomY - (postH / 2) * (1 - Math.cos(reclineRad)), z: (postBottomBackZ - backPostDiameter / 2) + (postH / 2) * Math.sin(reclineRad) },
          rotation: reclineRad > 0 ? { x: reclineRad, y: 0, z: 0 } : undefined,
          shape: { kind: "round" },
          tenons: [
            { position: "bottom", type: "blind-tenon", length: 25, width: Math.round(backPostDiameter * 0.6), thickness: Math.round(backPostDiameter * 0.6) },
            { position: "top", type: "blind-tenon", length: 20, width: Math.round(backPostDiameter * 0.6), thickness: Math.round(backPostDiameter * 0.6) },
          ],
          mortises: [],
        });
      });
      // 弧形板：跟著圓柱一起後仰。圓柱用 splayed shape，底端在 -Z 偏 reclineDz、頂在 origin。
      // rotation.x = reclineRad 是繞「板自己的中心」轉，所以對齊基準要用「板中心 Y」處的圓柱位置，
      // 不是板底 Y——用板底會讓板頂過頭、板底跑出來，整片扭曲。
      // 板中心 Y 距圓柱頂端的距離 = backPanelHeight/2；圓柱頂後仰 reclineDz，所以中心 Y 處後仰 reclineDz × (1 − halfPanelH/postH)。
      const postZAtPanelCenter = postZ - reclineDz * (backPanelHeight / 2 / Math.max(1, postH));
      // bend 把 vertex 推 +Z，dz = bendMm × (1 − (x/hx)²)；圓柱在 x = postX 不在中央，
      // 所以補償用「圓柱位置的 bend 量」，不是中央最大值，否則 embed=0 會留出空隙
      const halfPanelLen = panelLen / 2;
      const postT = halfPanelLen > 0 ? Math.min(1, Math.abs(postX) / halfPanelLen) : 0;
      const bendAtPost = backPanelFaceBend * Math.max(0, 1 - postT * postT);
      // backPanelEmbed: 板再往 +Z 推這麼多 mm（卡進圓柱內部）
      const panelBottomZ = postZAtPanelCenter - backPostDiameter / 2 - backPanelThickness / 2 - bendAtPost + backPanelEmbed;
      // bend + recline 視覺修正：彎板把幾何中心推到 +Z（centroid ≈ bendMm × 2/3），
      // 但 mesh.rotation.x 是繞 mesh 局部 (0,0,0) 轉，不是繞 centroid。
      // 結果：recline 後板會往下沉、視覺上頂緣比底緣更彎、整片像扭一下。
      // 修法：補上「繞 centroid 旋轉」等價的 origin 偏移：
      //   newOrigin = origin + (I − R) × centroid
      //   對 X 軸旋轉 + centroid (0,0,c)：偏移 = (0, c·sinθ, c·(1−cosθ))
      const bendCentroidZ = (backPanelFaceBend * 2) / 3;
      const compensationY = bendCentroidZ * Math.sin(reclineRad);
      const compensationZ = bendCentroidZ * (1 - Math.cos(reclineRad));
      parts.push({
        id: "back-panel",
        nameZh: "椅背弧形板",
        material,
        grainDirection: "length",
        visible: { length: panelLen, width: backPanelThickness, thickness: backPanelHeight },
        origin: { x: 0, y: panelOriginY + compensationY, z: panelBottomZ + compensationZ },
        rotation: reclineDz > 0 ? { x: reclineRad, y: 0, z: 0 } : undefined,
        shape: { kind: "face-rounded", cornerR: backPanelCornerR, topArchMm: backPanelTopArch, bottomArchMm: backPanelBottomArch, bendMm: backPanelFaceBend },
        tenons: [],
        mortises: [],
      });
    } else if (backStyle === "slats" && backSlatCount > 0) {
      const slatLen = backHeight - topRailH;
      const slatZ = width / 2 - postD / 2 - backRailInsetZ;
      slatXs.forEach((xCenter, i) => {
        parts.push({
          id: `back-slat-${i + 1}`,
          nameZh: `椅背板條 ${i + 1}`,
          material,
          grainDirection: "length",
          visible: { length: slatLen, width: backSlatWidth, thickness: slatThicknessConst },
          origin: { x: xCenter, y: seatY, z: slatZ },
          rotation: { x: 0, y: 0, z: Math.PI / 2 },
          tenons: [
            { position: "start", type: "blind-tenon", length: slatTenonLen, width: slatTenonW(backSlatWidth), thickness: slatTenonT },
            { position: "end", type: "blind-tenon", length: slatTenonLen, width: slatTenonW(backSlatWidth), thickness: slatTenonT },
          ],
          mortises: [],
        });
      });
    }
  }

  // overall.thickness 需含椅背，否則三視圖 viewBox 會切到椅背頂端
  // height = 座面高（不含椅背）；總高 = seatY + backHeight = height + backHeight - seatThickness
  const overallH = withBack ? height + backHeight - seatThickness : height;
  const design: FurnitureDesign = {
    id: `bar-stool-${length}x${width}x${height}`,
    category: "bar-stool",
    nameZh: "吧檯椅",
    overall: { length, width, thickness: overallH },
    parts,
    defaultJoinery: "blind-tenon",
    useButtJointConvention: true,
    primaryMaterial: material,
    notes:
      `吧檯椅：高度 ${height}mm（建議 700–800）；腳樣式 ${legShapeLabel(legShape)}；` +
      `四面腳踏（離地 ${footrestHeight}mm）；` +
      `${withBack ? "含短椅背" : "無椅背"}。座板與椅腳通榫，牙板/腳踏與椅腳半榫。${seatEdgeNote(seatEdge, seatEdgeStyle)}${legEdgeNote(legEdge, legEdgeStyle)}${stretcherEdgeNote(stretcherEdge, stretcherEdgeStyle)}${seatProfileNote(seatProfile) ? ` ${seatProfileNote(seatProfile)}` : ""}`,
  };

  applyStandardChecks(design, {
    minLength: 300, minWidth: 300, minHeight: 600,
    maxLength: 550, maxWidth: 550, maxHeight: 900,
  });
  appendWarnings(
    design,
    validateStoolStructure({
      legSize,
      height,
      seatThickness,
      seatSpan: Math.max(length, width),
      lowerStretcherHeight: footrestHeight > 0 ? footrestHeight : undefined,
      hasLowerStretcher: true, // bar-stool 一定有腳踏圈，視為下橫撐結構
    }),
  );
  return design;
};
