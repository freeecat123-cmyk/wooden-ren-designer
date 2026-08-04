import type {
  FurnitureDesign,
  FurnitureTemplate,
  OptionSpec,
  Part,
} from "@/lib/types";
import { getOption, opt } from "@/lib/types";
import { rectLegShape, RECT_LEG_SHAPE_CHOICES_WITH_CURVED_TAPER, curvedTaperLegOptions, seatEdgeOption, seatEdgeBottomOption, seatEdgeStyleOption, seatEdgeNote, seatEdgeShape, seatProfileOption, seatProfileNote, seatScoopShape, legEdgeOption, legEdgeStyleOption, legEdgeShape, legEdgeNote, stretcherEdgeOption, stretcherEdgeStyleOption, stretcherEdgeNote, apronEdgeOption, apronEdgeStyleOption, legShapeLabel, parseLegChamferMm, legBottomScale, legScaleAt, curvedTaperInnerScaleAt, computeCompoundSplayNormal, splayedLegMortiseGeom } from "./_helpers";
import { formatMm } from "@/lib/units/format";
import { applyStandardChecks, validateStoolStructure, appendWarnings, appendSuggestion } from "./_validators";
import { LOWER_STRETCHER_HEIGHT_RATIO } from "./_constants";
import { SPLAY_ANGLE } from "@/lib/knowledge/chair-geometry";
import { standardTenon, autoTenonType } from "@/lib/joinery/standards";

export const squareStoolOptions: OptionSpec[] = [
  { group: "leg", type: "select", key: "legShape", label: "腳樣式", defaultValue: "box", choices: RECT_LEG_SHAPE_CHOICES_WITH_CURVED_TAPER },
  { group: "leg", type: "number", key: "legSize", label: "腳粗", defaultValue: 35, min: 20, max: 120, step: 1, unit: "mm", help: "正方腳預設值。下方另填寬/厚則優先" },
  { group: "leg", type: "number", key: "legWidthOverride", label: "腳寬 X", defaultValue: 0, min: 0, max: 120, step: 1, unit: "mm", help: "0 = 用「腳粗」；填值 = 沿座板長邊 X 的尺寸（可做扁腳）。弧肩斜腳＝總寬" },
  { group: "leg", type: "number", key: "legDepthOverride", label: "腳厚 Z", defaultValue: 0, min: 0, max: 120, step: 1, unit: "mm", help: "0 = 用「腳粗」；填值 = 沿座板寬邊 Z 的尺寸（前後厚度）" },
  { group: "leg", type: "number", key: "legInset", label: "腳內縮", defaultValue: 0, min: 0, max: 200, step: 5, unit: "mm", help: "腳中心離座板邊緣的內縮量。> 0 讓座板外伸、視覺更俐落" },
  // 弧肩斜腳時隱藏（curved-taper 用自己的 ctSplay 欄，兩欄同名「外斜角度」會混淆）
  { group: "leg", type: "number", key: "splayAngle", label: "外斜角度 (°)", defaultValue: SPLAY_ANGLE.stoolDefaultDeg, min: 1, max: SPLAY_ANGLE.stoolMaxDeg, step: 0.5, unit: "°", help: `斜腳系列才有效——從垂直起算的外傾角度。預設 ${SPLAY_ANGLE.stoolDefaultDeg}° 適度外斜；10° 起明顯誇張（北歐風)；${SPLAY_ANGLE.stoolMaxDeg}° 極限`, dependsOn: { key: "legShape", notIn: ["curved-taper"] } },
  legEdgeOption("leg", 0),
  legEdgeStyleOption("leg"),
  ...curvedTaperLegOptions("leg"),  // 含 ctSplay 外斜角度（共用欄，預設 0=垂直）
  { group: "top", type: "number", key: "seatThickness", label: "座板厚", defaultValue: 25, min: 12, max: 60, step: 1, unit: "mm" },
  seatEdgeOption("top", 5),
  { ...seatEdgeBottomOption("top"), dependsOn: { key: "legInset", notIn: [0] } },
  { ...seatEdgeStyleOption("top"), dependsOn: { any: [{ key: "seatEdge", notIn: [0] }, { key: "seatEdgeBottom", notIn: [0] }] } },
  seatProfileOption("top"),
  { group: "top", type: "number", key: "seatBendMm", label: "椅面彎曲", defaultValue: 0, min: 0, max: 25, step: 1, help: "整片椅面像彎合板那樣彎曲，中間下凹比較好坐；四角榫眼位置不受影響。>0 會覆蓋鞍形 / 邊緣 profile" },
  { group: "apron", type: "number", key: "apronWidth", label: "牙條高度", defaultValue: 60, min: 30, max: 200, step: 5, unit: "mm", help: "弧肩斜腳時自動＝接撐段高，此欄不顯示", dependsOn: { key: "legShape", notIn: ["curved-taper"] } },
  { group: "apron", type: "number", key: "apronThickness", label: "牙條厚度", defaultValue: 20, min: 10, max: 50, step: 1, unit: "mm" },
  { group: "apron", type: "number", key: "apronDropFromTop", label: "牙條距座板", defaultValue: 0, min: 0, max: 400, step: 5, unit: "mm", help: "牙條頂面距座板下緣的距離；小凳子建議 10–15 才不會頭重腳輕" },
  { group: "apron", type: "number", key: "apronStaggerMm", label: "牙條錯開", defaultValue: 0, min: 0, max: 80, step: 2, unit: "mm", help: "前後牙條（正視圖看到全寬的那對）相對左右牙條下移量，3D 即時顯示，榫頭整支跟著。0 = 等高（自動上下半榫避免穿模）" },
  // 選了牙條造型時隱藏倒角欄（造型件一件一種 shape、倒角無效——user 2026-08-04 被混淆過）
  { ...apronEdgeOption("apron", 1), dependsOn: { key: "apronProfile", oneOf: ["none"] } },
  { ...apronEdgeStyleOption("apron"), dependsOn: { all: [{ key: "apronEdge", notIn: [0] }, { key: "apronProfile", oneOf: ["none"] }] } },
  // 牙條造型（下緣/上下緣內凹曲線）。外斜（斜腳系列或弧肩斜腳外斜>0）時牙板需
  // 梯形補償（一件一 shape），造型暫不套用——help 註明。
  { group: "apron", type: "select", key: "apronProfile", label: "牙條造型", defaultValue: "none", choices: [
    { value: "none", label: "無（直邊）" },
    { value: "arch", label: "下緣圓弧" },
    { value: "arch-out", label: "下緣外圓弧（凸弧垂邊）" },
    { value: "kunmen", label: "壸門曲線（明式）" },
    { value: "wave", label: "波浪連續弧" },
    { value: "double-arch", label: "上下內凹弧（束腰）" },
  ], help: "牙板下緣（束腰款含上緣）的造型。兩端自動留腳肩不吃榫。選造型後牙條倒角不套用（一件一種造型）" },
  { group: "apron", type: "number", key: "apronProfileDepth", label: "牙條造型深度", defaultValue: 0, min: 0, max: 100, step: 1, unit: "mm", help: "0 = 自動（牙條高的 40%）", dependsOn: { key: "apronProfile", notIn: ["none"] } },
  { group: "apron", type: "checkbox", key: "legPenetratingTenon", label: "腳上榫頭通透（明榫裝飾）", defaultValue: false, help: "勾選：牙條/下橫撐進腳改通榫（榫頭穿透到腳另一面），明式裝飾感；未勾：依母件厚度自動規則（≤25mm 通榫、>25mm 盲榫深度=厚度2/3）" },
  { group: "top", type: "checkbox", key: "seatPenetratingTenon", label: "椅面通透（腳頂穿透）", defaultValue: false, help: "勾選：腳頂榫穿透座板上面（明式装饰）；未勾：盲榫，深度上限座板厚 × 4/5、不穿透" },
  { group: "stretcher", type: "checkbox", key: "withLowerStretcher", label: "加下橫撐", defaultValue: true, help: "在腳下方 1/4 高加一圈橫撐，結構更穩；傳統方凳必備（取消勾選 = 簡約款）" },
  { group: "stretcher", type: "select", key: "lowerStretcherStyle", label: "下橫撐樣式", defaultValue: "h-frame", choices: [
    { value: "h-frame", label: "H 字形（4 條繞 1 圈，最穩）" },
    { value: "x-cross", label: "X 字交叉（2 條斜撐穿越中心，明清交杌做法）" },
  ], dependsOn: { key: "withLowerStretcher", equals: true } },
  { group: "stretcher", type: "number", key: "lowerStretcherWidth", label: "下橫撐高", defaultValue: 40, min: 20, max: 150, step: 5, unit: "mm", dependsOn: { key: "withLowerStretcher", equals: true } },
  { group: "stretcher", type: "number", key: "lowerStretcherThickness", label: "下橫撐厚", defaultValue: 20, min: 10, max: 50, step: 1, unit: "mm", dependsOn: { key: "withLowerStretcher", equals: true } },
  { group: "stretcher", type: "number", key: "lowerStretcherHeight", label: "下橫撐離地高", defaultValue: 0, min: 0, max: 700, step: 10, unit: "mm", help: "0 = 自動（腳高的 22%）", dependsOn: { key: "withLowerStretcher", equals: true } },
  { group: "stretcher", type: "number", key: "lowerStretcherStaggerMm", label: "下橫撐錯開", defaultValue: 0, min: 0, max: 80, step: 2, unit: "mm", help: "左右下橫撐（側視圖看到全寬的那對）相對前後下橫撐上移量，3D 即時顯示，榫頭整支跟著。0 = 等高（自動上下半榫避免穿模）", dependsOn: { key: "withLowerStretcher", equals: true } },
  // 選了下橫撐造型時隱藏倒角欄（同牙條）
  { ...stretcherEdgeOption("stretcher", 0), dependsOn: { key: "stretcherProfile", oneOf: ["none"] } },
  { ...stretcherEdgeStyleOption("stretcher"), dependsOn: { all: [{ key: "stretcherEdge", notIn: [0] }, { key: "stretcherProfile", oneOf: ["none"] }] } },
  // 下橫撐造型（同牙條那組曲線；X 字交叉款斜料不適用故僅 H 字形顯示）
  { group: "stretcher", type: "select", key: "stretcherProfile", label: "下橫撐造型", defaultValue: "none", choices: [
    { value: "none", label: "無（直邊）" },
    { value: "arch", label: "下緣圓弧" },
    { value: "top-arch", label: "上緣圓弧" },
    { value: "kunmen", label: "壸門曲線（明式）" },
    { value: "wave", label: "波浪連續弧" },
    { value: "double-arch", label: "上下內凹弧（束腰）" },
  ], help: "下橫撐緣的造型。選造型後下橫撐倒角不套用（一件一種造型）", dependsOn: { all: [{ key: "withLowerStretcher", equals: true }, { key: "lowerStretcherStyle", notIn: ["x-cross"] }] } },
  { group: "stretcher", type: "number", key: "stretcherProfileDepth", label: "下橫撐造型深度", defaultValue: 0, min: 0, max: 80, step: 1, unit: "mm", help: "0 = 自動（下橫撐高的 40%）", dependsOn: { all: [{ key: "withLowerStretcher", equals: true }, { key: "stretcherProfile", notIn: ["none"] }] } },
];

/**
 * 方凳（square stool）
 *
 * 結構：
 *  - 1 × 座板（top panel）
 *  - 4 × 凳腳（legs）
 *  - 4 × 橫撐（stretchers/aprons），凳腳之間連接
 *
 * 接合：
 *  - 凳腳 ↔ 座板：通榫（凳腳上端凸出穿過座板）
 *  - 橫撐 ↔ 凳腳：半榫（橫撐兩端凸入凳腳側面榫眼）
 *
 * 預設尺寸假設：
 *  - 座板 = length × width × thickness（含 4 個榫眼）
 *  - 凳腳 = leg × leg × height（上端有通榫，側面有 2 個半榫眼）
 *  - 橫撐 = (length - 2*legSize) × apronWidth × apronThickness
 */
export const squareStool: FurnitureTemplate = (input): FurnitureDesign => {
  const {
    length,
    width,
    height,
    material,
  } = input;
  const locale = input.locale ?? "zh-TW";
  const isEn = locale === "en";

  const o = squareStoolOptions;
  const legShape = getOption<string>(input, opt(o, "legShape"));
  const legSize = getOption<number>(input, opt(o, "legSize"));
  const legWidthOverride = getOption<number>(input, opt(o, "legWidthOverride"));
  const legDepthOverride = getOption<number>(input, opt(o, "legDepthOverride"));
  const legW = legWidthOverride > 0 ? legWidthOverride : legSize; // 沿 X（座板長邊）
  const legD = legDepthOverride > 0 ? legDepthOverride : legSize; // 沿 Z（座板寬邊）＝前後厚
  const legShortDim = Math.min(legW, legD); // 榫接母件厚取較薄面
  const legInset = getOption<number>(input, opt(o, "legInset"));
  const splayAngle = getOption<number>(input, opt(o, "splayAngle"));
  const legEdge = getOption<string>(input, opt(o, "legEdge"));
  const legEdgeStyle = getOption<string>(input, opt(o, "legEdgeStyle"));
  const ctBlockHeight = getOption<number>(input, opt(o, "ctBlockHeight"));
  const ctShoulder = getOption<number>(input, opt(o, "ctShoulder"));
  const ctInset = getOption<number>(input, opt(o, "ctInset"));
  const ctSplayAngle = getOption<number>(input, opt(o, "ctSplay"));
  const apronProfile = getOption<string>(input, opt(o, "apronProfile"));
  const apronProfileDepth = getOption<number>(input, opt(o, "apronProfileDepth"));
  const stretcherProfile = getOption<string>(input, opt(o, "stretcherProfile"));
  const stretcherProfileDepth = getOption<number>(input, opt(o, "stretcherProfileDepth"));
  const seatThickness = getOption<number>(input, opt(o, "seatThickness"));
  const seatEdge = getOption<string>(input, opt(o, "seatEdge"));
  const seatEdgeStyle = getOption<string>(input, opt(o, "seatEdgeStyle"));
  const seatEdgeBottom = getOption<number>(input, opt(o, "seatEdgeBottom"));
  const seatEdgeBottomClamped = Math.min(seatEdgeBottom, legInset);
  const seatProfile = getOption<string>(input, opt(o, "seatProfile"));
  const seatBendMm = getOption<number>(input, opt(o, "seatBendMm"));
  const stretcherEdge = getOption<string>(input, opt(o, "stretcherEdge"));
  const stretcherEdgeStyle = getOption<string>(input, opt(o, "stretcherEdgeStyle"));
  const apronEdge = getOption<number>(input, opt(o, "apronEdge"));
  const apronEdgeStyle = getOption<string>(input, opt(o, "apronEdgeStyle"));
  const _apronWidthRaw = getOption<number>(input, opt(o, "apronWidth"));
  // 弧肩斜腳：牙條高度自動＝接撐段高，讓牙板剛好填滿全寬接撐段（其下才是弧肩收窄）
  const apronWidth = legShape === "curved-taper" ? ctBlockHeight : _apronWidthRaw;
  // apronWidth=0 = 「無牙板」（windsor / industrial preset 故意這樣設）
  const withApron = apronWidth > 0;
  const apronThickness = getOption<number>(input, opt(o, "apronThickness"));
  const apronDropFromTop = getOption<number>(input, opt(o, "apronDropFromTop"));
  const apronStaggerMm = getOption<number>(input, opt(o, "apronStaggerMm"));
  const legPenetratingTenon = getOption<boolean>(input, opt(o, "legPenetratingTenon"));
  const seatPenetratingTenon = getOption<boolean>(input, opt(o, "seatPenetratingTenon"));
  const withLowerStretcher = getOption<boolean>(input, opt(o, "withLowerStretcher"));
  const lowerStretcherStyle = getOption<string>(input, opt(o, "lowerStretcherStyle"));
  const lowerStretcherWidth = getOption<number>(input, opt(o, "lowerStretcherWidth"));
  const lowerStretcherThickness = getOption<number>(input, opt(o, "lowerStretcherThickness"));
  const lowerStretcherHeightOpt = getOption<number>(input, opt(o, "lowerStretcherHeight"));
  const lowerStretcherStaggerMm = getOption<number>(input, opt(o, "lowerStretcherStaggerMm"));

  const legHeight = height - seatThickness;
  // 非方腳：X 用 legW、Z 用 legD 各自算角落內縮（取代 corners() 的方腳假設）
  const _halfLx = length / 2 - legW / 2 - legInset;
  const _halfWz = width / 2 - legD / 2 - legInset;
  const legCorners = [
    { x: -_halfLx, z: -_halfWz },
    { x: _halfLx, z: -_halfWz },
    { x: -_halfLx, z: _halfWz },
    { x: _halfLx, z: _halfWz },
  ];

  // 直榫標準（drafting-math.md §B2）：榫厚 = 公件厚 / 3、肩寬固定 5mm 4 邊全肩、
  // 盲榫長 = round(2/3 × 母厚, ≥25mm)、通榫長 = 母厚。
  // 自動類型規則：母厚 ≤ 25mm → 通榫；> 25mm → 盲榫
  // legPenetratingTenon = true 時強制牙板/下橫撐進腳通榫（明榫裝飾）

  // 1) leg ↔ seat：腳頂進座板
  //    - seatPenetratingTenon=true (明式裝飾)：通榫、tenon 凸出座板上面
  //    - seatPenetratingTenon=false (預設)：盲榫、depth 上限 = 座板厚 × 4/5、不穿透
  //    (user 2026-05-26：「腳接椅面預設不穿透、最多 4/5 椅面厚」+ 拆獨立 toggle)
  const legTopTenonType: "through-tenon" | "blind-tenon" =
    seatPenetratingTenon ? "through-tenon" : "blind-tenon";
  const _legTenonStdRaw = standardTenon({
    type: legTopTenonType,
    childThickness: legD,
    childWidth: legW,
    motherThickness: seatThickness,
  });
  // 盲榫上限：standardTenon 對 25mm 母厚回 25mm (= 穿透)、要 clamp 到 20mm 才合 4/5
  const _legTenonMaxDepth = Math.floor(seatThickness * 4 / 5);
  const legTenonStd = seatPenetratingTenon
    ? _legTenonStdRaw  // through 直接用 length = seatThickness
    : {
        ..._legTenonStdRaw,
        length: Math.min(_legTenonStdRaw.length, _legTenonMaxDepth),
      };
  // 2) apron ↔ leg：依自動規則 + legPenetratingTenon override
  const apronTenonType = legPenetratingTenon ? "through-tenon" : autoTenonType(legShortDim);
  const apronTenonStd = standardTenon({
    type: apronTenonType === "through-tenon" ? "through-tenon" : "shouldered-tenon",
    childThickness: apronThickness,
    childWidth: apronWidth,
    motherThickness: legShortDim,
  });
  // 通榫加 5mm 補償斜腳 rotation tilt 在世界軸投影的 cos(tilt) 損失（避免榫頭差一點點才穿出腳）
  const apronTenonLength = apronTenonStd.length + (apronTenonType === "through-tenon" ? 5 : 0);
  const apronTenonThick = apronTenonStd.thickness;
  const apronTenonW = apronTenonStd.width;
  // 非方腳（legW≠legD）時，X 牙板（前/後）進腳的母件厚 = legW、Z 牙板（左/右）= legD，
  // 兩軸各自判 through/blind 與榫長（用 legShortDim 共用會讓較厚軸那面榫長不足、型別誤標）。
  // 榫厚/榫寬只看牙板斷面、與母厚無關，故 apronTenonThick/W 維持共用。方腳時兩軸值相同＝無迴歸。
  // 非方腳的「薄軸」強制盲榫：否則 autoTenonType(≤25) 會自動通榫、穿透薄面＝破口。
  // 方腳（legW===legD）兩軸都不觸發 → 維持 autoTenonType 原行為、無迴歸。legPenetratingTenon
  // (明榫)是 user 主動要通透，照舊。
  // 牙條進腳：沒勾「明榫通透」一律盲榫，不再用 autoTenonType 對薄腳（母厚≤25）自動轉通榫
  // ——自動通榫會讓榫頭戳出腳外側＝使用者看到的「破口」紅塊。改盲榫後由 clampBlindDepth
  // 依實際腳厚縮榫深（留 8mm 背牆），薄腳也能安全盲接、不穿出。母厚≥33 時 clamp 無作用，
  // autoTenonType(≥33) 本來也回盲榫，故預設 legSize=35 與各腳型基準版輸出不變（byte 一致）。
  const apronTenonTypeX = legPenetratingTenon ? "through-tenon" : "blind-tenon";
  const apronTenonTypeZ = legPenetratingTenon ? "through-tenon" : "blind-tenon";
  // 盲榫深度留背牆 ≥ 8mm，避免薄腳（腳粗/腳寬/腳厚改小）榫眼快穿透＝破口。
  // standardTenon 盲榫 = max(MIN_BLIND_TENON_LEN=25, 母厚×2/3)，母厚 30 時被 25 撐到只剩
  // 5mm 背牆 → 這裡夾回。腳粗 35(→27) / 50(→42) 背牆足夠、不受影響。通榫本來就穿透不夾。
  const LEG_MORTISE_BACK_WALL = 8;
  // 對「所有腳型 + 方腳/非方腳」一律夾背牆——只要盲榫、母厚不夠就 clamp（＝依實際母厚
  // 縮榫深，user 明確要求「改厚度不會破口」而非限制功能）。母厚 ≥33 時 clamp 無作用
  // （min(25, ≥25)=25），故預設 legSize=35 與各腳型基準版輸出不變、byte 一致。通榫不夾。
  const clampBlindDepth = (raw: number, motherT: number, isThrough: boolean) =>
    isThrough ? raw : Math.min(raw, Math.max(6, motherT - LEG_MORTISE_BACK_WALL));
  const apronTenonLenFor = (motherT: number, isThrough: boolean) =>
    clampBlindDepth(
      standardTenon({
        type: isThrough ? "through-tenon" : "shouldered-tenon",
        childThickness: apronThickness,
        childWidth: apronWidth,
        motherThickness: motherT,
      }).length + (isThrough ? 5 : 0),
      motherT,
      isThrough,
    );
  const apronThroughX = apronTenonTypeX === "through-tenon";
  const apronThroughZ = apronTenonTypeZ === "through-tenon";
  const apronTenonLengthX = apronTenonLenFor(legW, apronThroughX);
  const apronTenonLengthZ = apronTenonLenFor(legD, apronThroughZ);
  // 牙板錯開策略（連續位移）：
  //   stagger > 0 → 前後牙板（X 軸，正視圖全寬）整支物理下移，榫頭整支跟著（中心榫）
  //   stagger == 0 → 自動上下半榫錯位避免同位撞：
  //     - 靜止 Z（左右）拿上榫；移動 X（前後，下移）拿下榫
  //     - 上榫保留 10mm 上肩、無下肩；下榫貼下緣無下肩、無上肩
  //     → 上榫高 = 下榫高 = (apronWidth - 10) / 2
  const apronVisuallyStaggered = apronStaggerMm > 0;
  const APRON_TOP_SHOULDER = 10;
  // 弧肩斜腳：牙板底緣＝接撐段底＝弧起點，榫直接開到底會破進弧裡。加底肩把榫往上移，
  // 讓榫眼留在上面全寬實體區、避開弧起點（＝user「榫應該要上移」）。方腳無此需求＝0。
  // 牙條造型「下緣外圓弧」（arch-out）兩端上收 = 造型深度 → 貼下緣的下半榫會露出
  // （user 2026-08-04 截圖紅點），底肩同步抬到 ≥ 造型深度把榫上移進實體。
  const apronProfileDepthEff =
    apronProfile !== "none"
      ? (apronProfileDepth > 0 ? apronProfileDepth : Math.round(apronWidth * 0.4))
      : 0;
  const apronBottomShoulder = Math.max(
    legShape === "curved-taper" ? 6 : 0,
    apronProfile === "arch-out" ? apronProfileDepthEff : 0,
  );
  const apronTotalTenonH = apronWidth - APRON_TOP_SHOULDER - apronBottomShoulder;  // 上下榫合計高
  // 錯開不夠大讓整榫頭岔開時走半榫錯位避免榫眼撞
  // 半榫高度依 stagger 連續成長：combined ≤ apronTotalTenonH + stagger（兩榫剛好接觸不撞）
  // 每邊上限為整榫高 apronTenonW
  const apronCanHalfStagger = apronStaggerMm < apronTenonW && apronTotalTenonH >= 16;
  // 中央留 4mm 間隙避免兩半榫在 rotation tilt 後視覺重疊
  const APRON_HALF_TENON_GAP = 4;
  const apronHalfTenonH = apronCanHalfStagger
    ? Math.min(apronTenonW, Math.floor((apronTotalTenonH + apronStaggerMm - APRON_HALF_TENON_GAP) / 2))
    : apronTenonW;
  const apronUpperTenonH = apronHalfTenonH;
  const apronLowerTenonH = apronHalfTenonH;
  // part-local：apron Y 從 0 (底) 到 apronWidth (頂)；牙板 mesh 中心 Y = apronWidth/2
  // 上榫中心 Y = (apronWidth - 上肩) - 上榫高/2；下榫中心 Y = 下榫高/2
  // offsetWidth = 該榫中心 - apronWidth/2
  const apronUpperTenonOffset = apronCanHalfStagger
    ? (apronWidth - APRON_TOP_SHOULDER - apronUpperTenonH / 2) - apronWidth / 2
    : 0;
  const apronLowerTenonOffset = apronCanHalfStagger
    ? apronBottomShoulder + apronLowerTenonH / 2 - apronWidth / 2
    : (apronBottomShoulder > 0 ? apronBottomShoulder / 2 : 0);

  // 腳頂榫朝家具中心偏（X 軸），讓 tenon 內側緣貼腳內緣（內側無肩）。
  // 只有 legInset === 0（腳貼座板邊緣）時才偏，避免座板外側木材太薄破裂。
  // 偏移量 = (legSize − tenonWidth) / 2 — tenon 內側緣 = 腳內緣，外側留 SHOULDER 肩。
  const legTopType: "through-tenon" | "blind-tenon" = legTopTenonType;
  const legTopInsetX = legInset === 0
    ? Math.max(0, Math.round((legW - legTenonStd.width) / 2))
    : 0;

  // 預計算 splay 數據（seatPanel 的 mortise.axis 跟 legs 共用）
  const _splayMmForLegs = Math.round(Math.tan((splayAngle * Math.PI) / 180) * legHeight);
  // 弧肩斜腳的選配外斜（ctSplay 欄，預設 0=垂直）：對角外踢，同 "splayed"。
  // 用獨立角度不共用 splayAngle（splayAngle 預設 5° 會讓既有 curved-taper 設計突變）。
  const ctSplayMm =
    legShape === "curved-taper" && ctSplayAngle > 0
      ? Math.round(Math.tan((ctSplayAngle * Math.PI) / 180) * legHeight)
      : 0;
  const _splayDxForLegs =
    legShape === "splayed" || legShape === "splayed-length" ? _splayMmForLegs : ctSplayMm;
  const _splayDzForLegs =
    legShape === "splayed" || legShape === "splayed-width" ? _splayMmForLegs : ctSplayMm;
  const _isSplayedForLegs = _splayDxForLegs > 0 || _splayDzForLegs > 0;

  const seatPanel: Part = {
    id: "seat",
    nameZh: "座板",
    nameEn: "Seat",
    material,
    grainDirection: "length",
    visible: { length, width, thickness: seatThickness },
    origin: { x: 0, y: legHeight, z: 0 },
    shape: seatBendMm > 0
      ? { kind: "face-rounded" as const, cornerR: 0, bendMm: -seatBendMm, bendAxis: "y" as const }
      : seatScoopShape(seatProfile) ?? seatEdgeShape(seatEdge, seatEdgeStyle, seatEdgeBottomClamped),
    tenons: [],
    mortises: [
      // 座板四角榫眼：通榫（座板薄）或盲榫（座板厚 > 25），depth 跟 tenon length 同步
      // legInset=0 時 X 軸 origin 朝家具中心偏 legTopInsetX，mortise 內側貼腳內緣
      // 盲榫時 mortise 從座板下緣開挖（origin.y=0，從底進入），不穿頂
      // splay 時 mortise.axis = 腳 top 榫頭世界軸的反向（座板的孔朝下開向腳）
      ...legCorners.map((c) => {
        const mortiseAxis = _isSplayedForLegs
          ? (() => {
              const dx = c.x > 0 ? _splayDxForLegs : (c.x < 0 ? -_splayDxForLegs : 0);
              const dz = c.z > 0 ? _splayDzForLegs : (c.z < 0 ? -_splayDzForLegs : 0);
              // mortise axis = opposite of tenon axis = (dx, -legHeight, dz)
              const x = dx, y = -legHeight, z = dz;
              const mag = Math.hypot(x, y, z) || 1;
              return { x: x / mag, y: y / mag, z: z / mag };
            })()
          : undefined;
        return {
          origin: {
            x: c.x - Math.sign(c.x) * legTopInsetX,
            y: 0,
            z: c.z,
          },
          depth: legTenonStd.length,
          length: legTenonStd.width,
          width: legTenonStd.thickness,
          through: seatPenetratingTenon,  // 椅面通透＝穿透座板、否則盲榫
          ...(mortiseAxis ? { axis: mortiseAxis } : {}),
        };
      }),
    ],
  };

  // 4 隻凳腳
  const legs: Part[] = legCorners.map((c, i) => {
    // Top tenon enters seat upward; splayed legs lean outward at bottom, so
    // tenon axis = opposite of leg's downward direction.
    // leg downward (top→bottom) world = (sign(c.x)*splayDx, -legHeight, sign(c.z)*splayDz)
    // top tenon axis (up into seat) = (-sign(c.x)*splayDx, +legHeight, -sign(c.z)*splayDz)
    const legTopAxis = _isSplayedForLegs
      ? (() => {
          const dx = c.x > 0 ? _splayDxForLegs : (c.x < 0 ? -_splayDxForLegs : 0);
          const dz = c.z > 0 ? _splayDzForLegs : (c.z < 0 ? -_splayDzForLegs : 0);
          const x = -dx, y = legHeight, z = -dz;
          const mag = Math.hypot(x, y, z) || 1;
          return { x: x / mag, y: y / mag, z: z / mag };
        })()
      : undefined;
    return ({
    id: `leg-${i + 1}`,
    nameZh: `凳腳 ${i + 1}`,
    nameEn: `Leg ${i + 1}`,
    material,
    grainDirection: "length",
    visible: { length: legW, width: legD, thickness: legHeight },
    origin: { x: c.x, y: 0, z: c.z },
    // box 走 legEdgeShape；splayed/tapered 系列把 chamfer 帶入組合（cross-section 八邊形）
    // splayMm 由 splayAngle 換算：tan(angle) × legHeight
    shape: rectLegShape(legShape, c, {
      splayedFrontOnly: false,
      splayMm: Math.round(Math.tan((splayAngle * Math.PI) / 180) * legHeight),
      chamferMm: parseLegChamferMm(legEdge),
      chamferStyle: legEdgeStyle === "rounded" ? "rounded" : "chamfered",
      curvedTaper: { blockHeightMm: ctBlockHeight, shoulderMm: ctShoulder, insetMm: ctInset, splayMm: ctSplayMm },
    }) ?? legEdgeShape(legEdge, legEdgeStyle),
    // tenon X 軸朝家具中心偏，內側無肩（朝中心那邊貼腳邊 → 移除對應 shoulderOn）
    tenons: [
      {
        position: "top",
        type: legTopType,
        length: legTenonStd.length,
        width: legTenonStd.width,
        thickness: legTenonStd.thickness,
        shoulderOn: (() => {
          if (legTopInsetX <= 0 || c.x === 0) return [...legTenonStd.shoulderOn];
          // top position：shoulderOn left/right = ±width 軸 = ±part-local X
          // 朝家具中心偏 = -sign(c.x) → tenon 在 part-local 沿 -sign(c.x) 方向偏
          // 偏 -X (右腳, c.x > 0) → tenon part-local -X 邊貼腳邊 → 移除 "left" 肩
          // 偏 +X (左腳, c.x < 0) → tenon part-local +X 邊貼腳邊 → 移除 "right" 肩
          const innerSide: "left" | "right" = c.x > 0 ? "left" : "right";
          return [...legTenonStd.shoulderOn].filter((s) => s !== innerSide);
        })(),
        offsetWidth: -Math.sign(c.x) * legTopInsetX,
        ...(legTopAxis ? { axis: legTopAxis } : {}),
      },
    ],
    // 凳腳內側 2 面要挖牙板的半榫眼（中段）
    // 無牙板（apronWidth=0）→ 不開榫眼
    // 腳面上的牙板母榫孔在「非方腳（legW≠legD，腳面比牙條厚寬）」或「弧肩斜腳」時，會露在
    // 牙條外緣＝使用者看到的紅/白小方塊「破口」。跟下橫撐同一處理：這兩種情況不在腳上挖牙板
    // 母榫、靠實體遮，榫頭埋進實體腳身（apronTenonLengthX/Z 已 clamp 留背牆、確保埋得住）→
    // 腳面乾淨無孔。方腳（legW===legD 且非弧肩）維持挖榫眼＝與基準版 byte 一致、無迴歸。
    // 公榫因此無對應母榫（audit 已於 EXPECTED_FAILS_VARIANT 登記 stool:curved-taper 豁免；
    // 方腳仍有母榫故 audit 照樣涵蓋）。
    mortises: (!withApron || legShape === "curved-taper" || legW !== legD)
      ? []
      : legMortisesForApron(c, length, width, {
      // X 面榫眼（接前後牙板）用 legW-衍生值、Z 面榫眼（接左右牙板）用 legD-衍生值
      apronTenonLengthX,
      apronTenonLengthZ,
      apronThroughX,
      apronThroughZ,
      apronUpperTenonH,
      apronLowerTenonH,
      apronUpperTenonOffset,
      apronLowerTenonOffset,
      apronTenonThick,
      apronVisualStaggerMm: apronVisuallyStaggered ? apronStaggerMm : 0,
      apronWidth,
      legHeight,
      apronDropFromTop,
      splayDx: _splayDxForLegs,
      splayDz: _splayDzForLegs,
    }),
  });
  });

  // 4 條橫撐（凳腳之間）—— butt-joint 慣例：visible.length 兩端剛好頂在
  // 腳的內側面，組裝版渲染就是 final 幾何（不重疊）。joinery 模式靠 tenon[]
  // 加切料長度，3D 不視覺延伸（榫頭只在材料單上展現）。
  //
  // tapered 腳補償（drafting-math.md §A11）：腳的 cross-section 隨 Y 線性
  // 變化，apron / stretcher 端面要對到 apron Y 處的「實際」腳內面，不能用
  // legSize 常數，會跟腳貼不齊。apronLegSize = legSize × legScaleAt(apronY)。
  const bottomScale = legBottomScale(legShape);
  // 腳在高度 y 的等效 legSize scale：curved-taper 走內面 recession 補償（§A11），
  // 其餘走既有線性 legScaleAt。牙板/橫撐長度都靠這個對到腳的實際內面。
  const legSizeScaleAt = (y: number): number =>
    legShape === "curved-taper"
      ? curvedTaperInnerScaleAt(y, legHeight, legW, ctBlockHeight, ctShoulder, ctInset)
      : legScaleAt(y, legHeight, bottomScale);
  // 外斜支援 3 種：對角 splayed、單向 splayed-length（只 X）、splayed-width（只 Z）
  // splayDx/splayDz 拆開計算，axis-aware 牙板補償
  // splayMm = tan(splayAngle) × legHeight，跟 rectLegShape 內部用一致的角度
  const splayMm = Math.round(Math.tan((splayAngle * Math.PI) / 180) * legHeight);
  // 弧肩斜腳選配外斜：牙板/橫撐長度與榫軸補償跟 splayed 走同一套（ctSplayMm=0 時不生效）。
  const splayDx =
    legShape === "splayed" || legShape === "splayed-length" ? splayMm : ctSplayMm;
  const splayDz =
    legShape === "splayed" || legShape === "splayed-width" ? splayMm : ctSplayMm;
  const isSplayed = splayDx > 0 || splayDz > 0;
  const apronY = legHeight - apronWidth - apronDropFromTop;
  const apronCenterY = apronY + apronWidth / 2;
  const tiltX = splayDx > 0 ? Math.atan(splayDx / legHeight) : 0;
  const tiltZ = splayDz > 0 ? Math.atan(splayDz / legHeight) : 0;
  const apronEdgeZ = width / 2 - legD / 2 - legInset;
  const apronEdgeX = length / 2 - legW / 2 - legInset;
  // 牙條錯開時 X 軸（前後）下移 apronStaggerMm；外斜時腳在更低處 splay 更大——
  // X 軸 / Z 軸 各用各自的 Y 中心算 splay/legSize/innerSpan，否則接不到腳。
  // legDim：X 牙板接腳的 X 面用 legW、Z 牙板接 Z 面用 legD。
  // compensate：是否對「內面沿高度收窄」補償牙板長度。
  //   X 牙板接腳的 X 面 → curved-taper 內面在此軸收窄，要補償（compensate=true，走 legSizeScaleAt）。
  //   Z 牙板接腳的 Z 面 → curved-taper 是 2D 側輪廓沿 Z 擠出、Z 面任何高度全寬不收窄，
  //     不可用 X 內面收縮 scale 補償（否則 apronDropFromTop>0 時左右牙板每端多伸插進腳），
  //     故 compensate=false → 走 legScaleAt(bottomScale)（curved-taper bottomScale=1＝不補償）。
  //   對非 curved-taper 腳形，legSizeScaleAt === legScaleAt(y,legHeight,bottomScale)，兩者等價 → 無迴歸。
  const apronGeomFor = (yCenter: number, legDim: number, compensate: boolean) => {
    const scaleFn = (y: number): number =>
      compensate ? legSizeScaleAt(y) : legScaleAt(y, legHeight, bottomScale);
    const yTop = yCenter + apronWidth / 2;
    const yBot = yCenter - apronWidth / 2;
    const centerShift = legHeight > 0 ? 1 - yCenter / legHeight : 0;
    const topShift = legHeight > 0 ? 1 - yTop / legHeight : 0;
    const botShift = legHeight > 0 ? 1 - yBot / legHeight : 0;
    return {
      splayX: splayDx * centerShift,
      splayZ: splayDz * centerShift,
      splayXTop: splayDx * topShift,
      splayZTop: splayDz * topShift,
      splayXBot: splayDx * botShift,
      splayZBot: splayDz * botShift,
      legSizeCenter: legDim * scaleFn(yCenter),
      legSizeTop: legDim * scaleFn(yTop),
      legSizeBot: legDim * scaleFn(yBot),
    };
  };
  const apronGeomZ = apronGeomFor(apronCenterY, legD, false);  // 左右（Z）牙板，靜止，接腳 Z 面（不補償）
  const apronGeomX = apronGeomFor(apronCenterY - (apronVisuallyStaggered ? apronStaggerMm : 0), legW, true);  // 前後（X）牙板，下移後，接腳 X 面（補償內面收窄）
  const apronSides = [
    { id: "apron-front", nameZh: "前牙條", nameEn: "Front apron",
      visibleLength: 2 * apronEdgeX - apronGeomX.legSizeCenter + 2 * apronGeomX.splayX,
      axis: "x" as const, sx: 0, sz: -1,
      origin: { x: 0, z: -(apronEdgeZ + apronGeomX.splayZ) } },
    { id: "apron-back", nameZh: "後牙條", nameEn: "Back apron",
      visibleLength: 2 * apronEdgeX - apronGeomX.legSizeCenter + 2 * apronGeomX.splayX,
      axis: "x" as const, sx: 0, sz: 1,
      origin: { x: 0, z: apronEdgeZ + apronGeomX.splayZ } },
    { id: "apron-left", nameZh: "左牙條", nameEn: "Left apron",
      visibleLength: 2 * apronEdgeZ - apronGeomZ.legSizeCenter + 2 * apronGeomZ.splayZ,
      axis: "z" as const, sx: -1, sz: 0,
      origin: { x: -(apronEdgeX + apronGeomZ.splayX), z: 0 } },
    { id: "apron-right", nameZh: "右牙條", nameEn: "Right apron",
      visibleLength: 2 * apronEdgeZ - apronGeomZ.legSizeCenter + 2 * apronGeomZ.splayZ,
      axis: "z" as const, sx: 1, sz: 0,
      origin: { x: apronEdgeX + apronGeomZ.splayX, z: 0 } },
  ];
  const aprons: Part[] = !withApron ? [] : apronSides.map((s) => {
    const geom = s.axis === "x" ? apronGeomX : apronGeomZ;
    // 該支牙板進腳的母件厚依軸別（X→legW、Z→legD）決定 through/blind 與榫長
    const axisThrough = s.axis === "x" ? apronThroughX : apronThroughZ;
    const axisTenonLength = s.axis === "x" ? apronTenonLengthX : apronTenonLengthZ;
    // Compound splay only — single-axis splay is fully carried by part.rotation.
    // For 4-corner splay (compound 或 single)，apron 端面是斜的 → tenon 需要 axis
    // 才能渲染成 sheared box、root 貼 miter。axis-specific：
    //   axis="x" 牙條只受 splayDx 影響、axis="z" 牙條只受 splayDz 影響
    const hasAxisSplay = (s.axis === "x" && splayDx > 0) || (s.axis === "z" && splayDz > 0);
    // axis="x" 牙條: start at part-local -X → world -X (Rx(π/2) 不動 X)。cornerSx=-1 ✓
    // axis="z" 牙條: start at part-local -X → world +Z (Rx(π/2) Ry(π/2) 後 -X→+Z)。cornerSz=+1（不是 -1）
    const startCornerSx = (s.axis === "x" ? -1 : s.sx) as -1 | 0 | 1;
    const startCornerSz = (s.axis === "z" ? +1 : s.sz) as -1 | 0 | 1;
    const endCornerSx = (s.axis === "x" ? +1 : s.sx) as -1 | 0 | 1;
    const endCornerSz = (s.axis === "z" ? -1 : s.sz) as -1 | 0 | 1;
    const tenonAxisStart = hasAxisSplay
      ? computeCompoundSplayNormal({ apronAxis: s.axis, cornerSx: startCornerSx, cornerSz: startCornerSz, splayAngleDeg: splayAngle })
      : null;
    const tenonAxisEnd = hasAxisSplay
      ? computeCompoundSplayNormal({ apronAxis: s.axis, cornerSx: endCornerSx, cornerSz: endCornerSz, splayAngleDeg: splayAngle })
      : null;
    // x 軸牙板（前/後）補 tiltZ；z 軸牙板（左/右）補 tiltX
    const bevelAngle = isSplayed
      ? s.axis === "x" ? -s.sz * tiltZ : -s.sx * tiltX
      : 0;
    // trapezoid 必要：兩端縮到腳實際寬度，避免接合縫；上下不同 scale
    const hasShapeBend = splayDx > 0 || splayDz > 0 || bottomScale !== 1 || legShape === "curved-taper";
    const buttHalfXCenter = apronEdgeX + geom.splayX - geom.legSizeCenter / 2;
    const buttHalfZCenter = apronEdgeZ + geom.splayZ - geom.legSizeCenter / 2;
    const buttHalfXTop = apronEdgeX + geom.splayXTop - geom.legSizeTop / 2;
    const buttHalfXBot = apronEdgeX + geom.splayXBot - geom.legSizeBot / 2;
    const buttHalfZTop = apronEdgeZ + geom.splayZTop - geom.legSizeTop / 2;
    const buttHalfZBot = apronEdgeZ + geom.splayZBot - geom.legSizeBot / 2;
    const trapTopScale =
      s.axis === "x" && hasShapeBend
        ? buttHalfXTop / buttHalfXCenter
        : s.axis === "z" && hasShapeBend
          ? buttHalfZTop / buttHalfZCenter
          : null;
    const trapBotScale =
      s.axis === "x" && hasShapeBend
        ? buttHalfXBot / buttHalfXCenter
        : s.axis === "z" && hasShapeBend
          ? buttHalfZBot / buttHalfZCenter
          : 1;
    // bevel 規則：頂面跟椅面重疊（dropFromTop=0）才半 bevel 讓頂面水平；其他情況無 bevel
    const apronTopAtSeat = apronDropFromTop === 0;
    const useTopBevel = isSplayed && apronTopAtSeat;
    // 牙條造型（edge-profile）：梯形補償以 topLengthScale/bottomLengthScale 合成進輪廓
    // （斜腳/弧肩斜腳的牙板長度補償與造型同時成立）。外斜的頂面斜切（useTopBevel）
    // 無法合成 → 造型優先、捨棄斜切：牙板頂緣外角微陷座板底 ~2mm、藏在座板內看不見
    // （比「造型整個沒反應」好——user 2026-08-04 回報外斜時選了造型沒反應）。
    // profile=none 時走原路 → byte 不變。
    const partShape = apronProfile !== "none"
      ? { kind: "edge-profile" as const, style: apronProfile as "arch" | "arch-out" | "top-arch" | "kunmen" | "wave" | "corner-round" | "double-arch", depthMm: apronProfileDepthEff, waveCount: 4, topLengthScale: trapTopScale ?? 1, bottomLengthScale: trapBotScale ?? 1 }
      : trapTopScale !== null
        ? { kind: "apron-trapezoid" as const, topLengthScale: trapTopScale, bottomLengthScale: trapBotScale, bevelAngle: useTopBevel ? bevelAngle : undefined, bevelMode: useTopBevel ? "half" as const : undefined }
        : legEdgeShape(apronEdge, apronEdgeStyle);
    return {
      id: s.id,
      nameZh: s.nameZh,
      nameEn: s.nameEn,
      material,
      grainDirection: "length" as const,
      visible: {
        length: s.visibleLength,
        width: apronWidth,
        thickness: apronThickness,
      },
      // 前後（x 軸）牙板物理下移 apronStaggerMm；左右（z）不動
      origin: { x: s.origin.x, y: apronY - (apronVisuallyStaggered && s.axis === "x" ? apronStaggerMm : 0), z: s.origin.z },
      rotation: s.axis === "z"
        ? { x: Math.PI / 2, y: Math.PI / 2, z: s.sx * tiltX }
        : { x: Math.PI / 2 + (-s.sz) * tiltZ, y: 0, z: 0 },
      shape: partShape,
      // A 模式：X 向 = 上榫（保留上肩、無下肩），Z 向 = 下榫（無上下肩）
      // B 模式：整榫頭，4 邊全肩
      // type 依自動規則 / legPenetratingTenon 決定
      tenons: (() => {
        const tenonType: "through-tenon" | "shouldered-tenon" =
          axisThrough ? "through-tenon" : "shouldered-tenon";
        if (!apronCanHalfStagger) {
          // B 或 stagger 不可用 → 整榫頭
          const mk = (position: "start" | "end") => ({
            position,
            type: tenonType,
            length: axisTenonLength,
            width: apronTenonW,
            thickness: apronTenonThick,
            shoulderOn: [...apronTenonStd.shoulderOn],
            ...(position === "start" && tenonAxisStart ? { axis: tenonAxisStart } : {}),
            ...(position === "end" && tenonAxisEnd ? { axis: tenonAxisEnd } : {}),
          });
          return [mk("start"), mk("end")];
        }
        // A 半榫錯位 — 靜止 Z（左右）= 上榫；移動 X（前後，下移）= 下榫
        const isUpper = s.axis === "z";
        const tenonH = isUpper ? apronUpperTenonH : apronLowerTenonH;
        // tenon.offsetWidth 是 mesh local Z 軸方向；牙板 rotation x:π/2 把 mesh +Z 轉到世界 -Y
        // 所以世界「上方」需要 offsetWidth < 0，反符號傳入
        const worldOffset = isUpper ? apronUpperTenonOffset : apronLowerTenonOffset;
        // 上榫：保留 top + left/right 肩；下榫：只有 left/right
        const shoulderOn: Array<"top" | "bottom" | "left" | "right"> = isUpper
          ? ["top", "left", "right"]
          : ["left", "right"];
        const mk = (position: "start" | "end") => ({
          position,
          type: tenonType,
          length: axisTenonLength,
          width: tenonH,
          thickness: apronTenonThick,
          shoulderOn,
          offsetWidth: -worldOffset,
          ...(position === "start" && tenonAxisStart ? { axis: tenonAxisStart } : {}),
          ...(position === "end" && tenonAxisEnd ? { axis: tenonAxisEnd } : {}),
        });
        return [mk("start"), mk("end")];
      })(),
      mortises: [],
    };
  });

  const parts: Part[] = [seatPanel, ...legs, ...aprons];

  if (withLowerStretcher) {
    const lowerY = lowerStretcherHeightOpt > 0
      ? lowerStretcherHeightOpt
      : Math.round(legHeight * LOWER_STRETCHER_HEIGHT_RATIO);
    const lowerW = lowerStretcherWidth;
    const lowerT = lowerStretcherThickness;
    // 下橫撐 ↔ 凳腳：依自動規則 + legPenetratingTenon override
    const lowerTenonType = legPenetratingTenon ? "through-tenon" : autoTenonType(legShortDim);
    const lowerTenonStd = standardTenon({
      type: lowerTenonType,
      childThickness: lowerT,
      childWidth: lowerW,
      motherThickness: legShortDim,
    });
    // 通榫加 5mm 補償斜腳 tilt 投影損失
    const lowerTenon = lowerTenonStd.length + (lowerTenonType === "through-tenon" ? 5 : 0);
    const lowerTenonThick = lowerTenonStd.thickness;
    const lowerTenonW = lowerTenonStd.width;
    // 非方腳：X 向下橫撐（前/後）進腳母厚=legW、Z 向（左/右）=legD，各軸分開判 through/blind + 榫長。
    // 榫厚/榫寬只看橫撐斷面、與母厚無關 → 共用 lowerTenonThick/W。x-cross 對角撐打腳角、母厚曖昧，
    // 維持共用（legShortDim）。方腳時兩軸值相同＝無迴歸。
    // 弧肩斜腳：下橫撐落在斜降區、腳 X 向料已收窄（inner 面內縮 recession）。
    // 母厚要用「該高度實際 X 料厚」＝ legW×(1+scale)/2，且強制盲榫，否則 33mm 榫頭
    // 會戳出腳外面（榫接版看到紅榫頭凸出）。Z 面是平的全寬擠出蓋、不收 → 照舊 legD。
    const legXDepthLS =
      legShape === "curved-taper"
        ? Math.max(8, (legW * (1 + legSizeScaleAt(lowerY + lowerW / 2))) / 2)
        : legW;
    const lowerTenonTypeX = legPenetratingTenon
      ? "through-tenon"
      : legShape === "curved-taper" || legW < legD
        ? "blind-tenon"
        : autoTenonType(legW);
    const lowerTenonTypeZ = legPenetratingTenon ? "through-tenon" : (legD < legW ? "blind-tenon" : autoTenonType(legD));
    const lowerTenonLenFor = (motherT: number, isThrough: boolean) =>
      clampBlindDepth(
        standardTenon({ type: isThrough ? "through-tenon" : "blind-tenon", childThickness: lowerT, childWidth: lowerW, motherThickness: motherT }).length + (isThrough ? 5 : 0),
        motherT,
        isThrough,
      );
    const lowerThroughX = lowerTenonTypeX === "through-tenon";
    const lowerThroughZ = lowerTenonTypeZ === "through-tenon";
    // curved-taper 不挖榫眼、靠實體遮，榫頭必須確實埋在料厚內（留 3mm）才不露出腳面。
    // 這裡用未經背牆 clamp 的 raw 榫長 + 自己的「legXDepthLS − 3」上限（本來就防破口）——
    // 不吃 clampBlindDepth 的 8mm 通用背牆，否則會把已達標的下橫撐再縮 5mm、無謂改動 curved-taper 輸出。
    const lowerRawLenX = standardTenon({
      type: "blind-tenon", childThickness: lowerT, childWidth: lowerW, motherThickness: legXDepthLS,
    }).length;
    const lowerTenonX =
      legShape === "curved-taper"
        ? Math.max(6, Math.min(lowerRawLenX, Math.floor(legXDepthLS - 3)))
        : lowerTenonLenFor(legXDepthLS, lowerThroughX);
    const lowerTenonZ = lowerTenonLenFor(legD, lowerThroughZ);
    // 下橫撐錯開策略（連續位移）：
    //   stagger > 0 → 左右下橫撐（Z 軸，側視圖全寬）整支物理上移，榫頭跟著
    //   stagger == 0 → 自動上下半榫錯位：靜止 X（前後）下榫；移動 Z（左右，上移）上榫
    const lowerVisuallyStaggered = lowerStretcherStaggerMm > 0;
    // 半榫高度依 stagger 連續成長：combined ≤ lowerW + stagger，每邊上限 lowerTenonW
    const lowerCanHalfStagger = lowerStretcherStaggerMm < lowerTenonW && lowerW >= 16;
    // 中央留 4mm 間隙避免兩半榫在 rotation tilt 後視覺重疊
    const LOWER_HALF_TENON_GAP = 4;
    const lowerHalfTenonH = lowerCanHalfStagger
      ? Math.min(lowerTenonW, Math.floor((lowerW + lowerStretcherStaggerMm - LOWER_HALF_TENON_GAP) / 2))
      : lowerTenonW;
    // 弧肩斜腳：左右(Z)橫撐＝上半榫、腳上不挖榫眼(靠實體遮)，沒有榫眼相撞問題，
    // 故上半榫可往下長 GAP、剛好碰到下半榫(前後 X)，Z 榫加寬不留縫（user 要求）。
    const lowerUpperTenonH =
      legShape === "curved-taper" && lowerCanHalfStagger
        ? lowerHalfTenonH + LOWER_HALF_TENON_GAP
        : lowerHalfTenonH;
    const lowerLowerTenonH = lowerHalfTenonH;
    // part-local：lowerW 是 Y 軸高度，中心 = lowerW/2
    // 上榫中心 Y = lowerW - lowerUpperTenonH/2，offset = lowerW/2 - lowerUpperTenonH/2
    const lowerUpperTenonOffset = lowerCanHalfStagger ? (lowerW / 2 - lowerUpperTenonH / 2) : 0;
    const lowerLowerTenonOffset = lowerCanHalfStagger ? (lowerLowerTenonH / 2 - lowerW / 2) : 0;
    // 下橫撐：以中軸對齊腳中軸，top/bot 都從中心向外/向內推
    // X 靜止用 lsCenterY；Z 上移用 lsZCenterY = lsCenterY + stagger
    const lsCenterY = lowerY + lowerW / 2;
    const lsZShiftedY = lsCenterY + (lowerVisuallyStaggered ? lowerStretcherStaggerMm : 0);
    // 弧肩斜腳：左右(Z)橫撐坐在腳中線會踩空（內面收過中線）。往外挪 recession/2，
    // 坐到「腳收窄後實際 X 料」的中點上（recession = legW×(1−scale)/2）。
    const ctZShift = legShape === "curved-taper"
      ? (legW * (1 - legSizeScaleAt(lsZShiftedY))) / 4
      : 0;
    const lsBotShift = legHeight > 0 ? 1 - lowerY / legHeight : 0;
    const lsTopShift = legHeight > 0 ? 1 - (lowerY + lowerW) / legHeight : 0;
    const lsCenterShift = legHeight > 0 ? 1 - lsCenterY / legHeight : 0;
    const lsZShiftedCenterShift = legHeight > 0 ? 1 - lsZShiftedY / legHeight : 0;
    const lsZShiftedBotShift = legHeight > 0 ? 1 - (lsZShiftedY - lowerW / 2) / legHeight : 0;
    const lsZShiftedTopShift = legHeight > 0 ? 1 - (lsZShiftedY + lowerW / 2) / legHeight : 0;
    // X 靜止下橫撐用的 splay
    const lsSplayX = splayDx * lsCenterShift;
    const lsSplayZ = splayDz * lsCenterShift;
    const lsSplayXBot = splayDx * lsBotShift;
    const lsSplayZBot = splayDz * lsBotShift;
    const lsSplayXTop = splayDx * lsTopShift;
    const lsSplayZTop = splayDz * lsTopShift;
    // Z 上移下橫撐用的 splay（在新 Y 重算）
    const lsZSplayX = splayDx * lsZShiftedCenterShift;
    const lsZSplayZ = splayDz * lsZShiftedCenterShift;
    const lsZSplayXBot = splayDx * lsZShiftedBotShift;
    const lsZSplayZBot = splayDz * lsZShiftedBotShift;
    const lsZSplayXTop = splayDx * lsZShiftedTopShift;
    const lsZSplayZTop = splayDz * lsZShiftedTopShift;
    // tapered 補償：下橫撐三條 Y 位置各自的腳寬
    // X 向下橫撐接腳的「X 內面」（curved-taper 的弧+斜線在此面）→ 用補償版
    const lsLegSizeCenter = legW * legSizeScaleAt(lsCenterY);
    const lsLegSizeTop = legW * legSizeScaleAt(lowerY + lowerW);
    const lsLegSizeBot = legW * legSizeScaleAt(lowerY);
    // Z 向下橫撐接腳的「Z 面」＝平的全寬擠出蓋（curved-taper 不在此面收窄）→ 不補償
    const lsZLegSizeCenter = legD * legScaleAt(lsZShiftedY, legHeight, bottomScale);
    const lsZLegSizeTop = legD * legScaleAt(lsZShiftedY + lowerW / 2, legHeight, bottomScale);
    const lsZLegSizeBot = legD * legScaleAt(lsZShiftedY - lowerW / 2, legHeight, bottomScale);
    const lsInnerSpan = {
      x: 2 * apronEdgeX - lsLegSizeCenter,
      z: 2 * apronEdgeZ - lsZLegSizeCenter,
    };
    const lsButtHalfX = (splay: number) => apronEdgeX + splay - lsLegSizeCenter / 2;
    const lsButtHalfZ = (splay: number) => apronEdgeZ + splay - lsZLegSizeCenter / 2;
    const lsButtHalfXTop = (splay: number) => apronEdgeX + splay - lsLegSizeTop / 2;
    const lsButtHalfXBot = (splay: number) => apronEdgeX + splay - lsLegSizeBot / 2;
    const lsButtHalfZTop = (splay: number) => apronEdgeZ + splay - lsZLegSizeTop / 2;
    const lsButtHalfZBot = (splay: number) => apronEdgeZ + splay - lsZLegSizeBot / 2;
    if (lowerStretcherStyle === "x-cross") {
      // X 字交叉橫撐：兩條對角線連接 4 隻腳，過中心半搭接。
      // 外斜模式時對角橫撐做法太複雜（要傾斜+扭轉），先不支援；fallback 走直立 X。
      // 視覺上 2 條交叉時可能有 z-fight，第二條稍微抬高 1mm 避免（肉眼看不出）。
      const halfX = apronEdgeX + lsSplayX;
      const halfZ = apronEdgeZ + lsSplayZ;
      const diagLen = 2 * Math.sqrt(halfX * halfX + halfZ * halfZ);
      // 對角斜撐尺寸跟一般下橫撐相同（標準 1/3 法則 + 5mm 4 邊全肩）
      const xTenonW = lowerTenonW;
      const xTenonThick = lowerTenonThick;
      // 角度：atan2(halfZ, halfX)，方型凳 = 45°
      const angle = Math.atan2(halfZ, halfX);
      const diagonals = [
        { id: "ls-x1", nameZh: "X 撐 1（前左↔後右）", nameEn: "X-stretcher 1 (FL↔BR)", yRot: angle, yLift: 0 },
        { id: "ls-x2", nameZh: "X 撐 2（前右↔後左）", nameEn: "X-stretcher 2 (FR↔BL)", yRot: -angle, yLift: lowerT * 0.05 },
      ];
      for (const d of diagonals) {
        parts.push({
          id: d.id,
          nameZh: d.nameZh,
          nameEn: d.nameEn,
          material,
          grainDirection: "length",
          visible: { length: diagLen, width: lowerW, thickness: lowerT },
          origin: { x: 0, y: lowerY + d.yLift, z: 0 },
          rotation: { x: Math.PI / 2, y: d.yRot, z: 0 },
          shape: legEdgeShape(stretcherEdge, stretcherEdgeStyle),
          tenons: [
            { position: "start", type: lowerTenonType === "through-tenon" ? "through-tenon" : "blind-tenon", length: lowerTenon, width: xTenonW, thickness: xTenonThick, shoulderOn: [...lowerTenonStd.shoulderOn] },
            { position: "end", type: lowerTenonType === "through-tenon" ? "through-tenon" : "blind-tenon", length: lowerTenon, width: xTenonW, thickness: xTenonThick, shoulderOn: [...lowerTenonStd.shoulderOn] },
          ],
          mortises: [],
        });
      }
    } else {
      // h-frame: 4 條繞 1 圈
      const sides = [
        // 前後（X 軸, 靜止）用原 lsSplay
        { id: "ls-front", nameZh: "前下橫撐", nameEn: "Front lower stretcher", visibleLength: lsInnerSpan.x + 2 * lsSplayX, axis: "x" as const, sx: 0, sz: -1, origin: { x: 0, z: -(apronEdgeZ + lsSplayZ) } },
        { id: "ls-back", nameZh: "後下橫撐", nameEn: "Back lower stretcher", visibleLength: lsInnerSpan.x + 2 * lsSplayX, axis: "x" as const, sx: 0, sz: 1, origin: { x: 0, z: apronEdgeZ + lsSplayZ } },
        // 左右（Z 軸, 上移）用 lsZSplay（在上移後 Y 重算的腳位置）
        { id: "ls-left", nameZh: "左下橫撐", nameEn: "Left lower stretcher", visibleLength: lsInnerSpan.z + 2 * lsZSplayZ, axis: "z" as const, sx: -1, sz: 0, origin: { x: -(apronEdgeX + lsZSplayX + ctZShift), z: 0 } },
        { id: "ls-right", nameZh: "右下橫撐", nameEn: "Right lower stretcher", visibleLength: lsInnerSpan.z + 2 * lsZSplayZ, axis: "z" as const, sx: 1, sz: 0, origin: { x: apronEdgeX + lsZSplayX + ctZShift, z: 0 } },
      ];
      for (const s of sides) {
        // splay tenon axis（axis-specific：單向斜也觸發、axis="z" 反轉 cornerSz）
        const hasAxisSplay = (s.axis === "x" && splayDx > 0) || (s.axis === "z" && splayDz > 0);
        const startCornerSx = (s.axis === "x" ? -1 : s.sx) as -1 | 0 | 1;
        const startCornerSz = (s.axis === "z" ? +1 : s.sz) as -1 | 0 | 1;
        const endCornerSx = (s.axis === "x" ? +1 : s.sx) as -1 | 0 | 1;
        const endCornerSz = (s.axis === "z" ? -1 : s.sz) as -1 | 0 | 1;
        const lsTenonAxisStart = hasAxisSplay
          ? computeCompoundSplayNormal({ apronAxis: s.axis, cornerSx: startCornerSx, cornerSz: startCornerSz, splayAngleDeg: splayAngle })
          : null;
        const lsTenonAxisEnd = hasAxisSplay
          ? computeCompoundSplayNormal({ apronAxis: s.axis, cornerSx: endCornerSx, cornerSz: endCornerSz, splayAngleDeg: splayAngle })
          : null;
        // 下橫撐：trapezoid 是腳幾何要求（兩端縮到腳寬避免縫），但不 bevel（上下都跟腳斜，自由邊）
        const hasShapeBend = splayDx > 0 || splayDz > 0 || bottomScale !== 1 || legShape === "curved-taper";
        const trapTopScale =
          s.axis === "x" && hasShapeBend
            ? lsButtHalfXTop(lsSplayXTop) / lsButtHalfX(lsSplayX)
            : s.axis === "z" && hasShapeBend
              ? lsButtHalfZTop(lsZSplayZTop) / lsButtHalfZ(lsZSplayZ)
              : null;
        const trapBotScale =
          s.axis === "x" && hasShapeBend
            ? lsButtHalfXBot(lsSplayXBot) / lsButtHalfX(lsSplayX)
            : s.axis === "z" && hasShapeBend
              ? lsButtHalfZBot(lsZSplayZBot) / lsButtHalfZ(lsZSplayZ)
              : 1;
        // 下橫撐造型：梯形補償合成進輪廓（弧肩斜腳斜降區的長度補償與造型同時成立）
        const lsShape = stretcherProfile !== "none"
          ? { kind: "edge-profile" as const, style: stretcherProfile as "arch" | "arch-out" | "top-arch" | "kunmen" | "wave" | "corner-round" | "double-arch", depthMm: stretcherProfileDepth > 0 ? stretcherProfileDepth : Math.round(lowerW * 0.4), waveCount: 4, topLengthScale: trapTopScale ?? 1, bottomLengthScale: trapBotScale ?? 1 }
          : trapTopScale !== null
            ? { kind: "apron-trapezoid" as const, topLengthScale: trapTopScale, bottomLengthScale: trapBotScale }
            : legEdgeShape(stretcherEdge, stretcherEdgeStyle);
        parts.push({
          id: s.id,
          nameZh: s.nameZh,
          nameEn: s.nameEn,
          material,
          grainDirection: "length",
          visible: { length: s.visibleLength, width: lowerW, thickness: lowerT },
          // 左右（z 軸）下橫撐整支上移；前後（x）不動
          origin: { x: s.origin.x, y: lowerY + (lowerVisuallyStaggered && s.axis === "z" ? lowerStretcherStaggerMm : 0), z: s.origin.z },
          rotation: s.axis === "z"
            ? { x: Math.PI / 2, y: Math.PI / 2, z: s.sx * tiltX }
            : { x: Math.PI / 2 + (-s.sz) * tiltZ, y: 0, z: 0 },
          shape: lsShape,
          tenons: (() => {
            // type / 榫長 依該支軸別的母件厚（X→legW、Z→legD）
            const axisThrough = s.axis === "x" ? lowerThroughX : lowerThroughZ;
            const axisLen = s.axis === "x" ? lowerTenonX : lowerTenonZ;
            const lsType: "through-tenon" | "blind-tenon" =
              axisThrough ? "through-tenon" : "blind-tenon";
            if (!lowerCanHalfStagger) {
              // B 或不可用 → 整榫頭，4 邊全肩
              const mk = (position: "start" | "end") => ({
                position,
                type: lsType,
                length: axisLen,
                width: lowerTenonW,
                thickness: lowerTenonThick,
                shoulderOn: [...lowerTenonStd.shoulderOn],
                ...(position === "start" && lsTenonAxisStart ? { axis: lsTenonAxisStart } : {}),
                ...(position === "end" && lsTenonAxisEnd ? { axis: lsTenonAxisEnd } : {}),
              });
              return [mk("start"), mk("end")];
            }
            // A 半榫錯位 — 靜止 X（前後）= 下榫；移動 Z（左右，上移）= 上榫
            const isUpper = s.axis === "z";
            const tenonH = isUpper ? lowerUpperTenonH : lowerLowerTenonH;
            // 同 apron 的世界 Y → mesh Z 反符號邏輯
            const worldOffset = isUpper ? lowerUpperTenonOffset : lowerLowerTenonOffset;
            // 下橫撐上下都不留肩，僅保留 left/right（thickness 軸）
            const shoulderOn: Array<"top" | "bottom" | "left" | "right"> = ["left", "right"];
            const mk = (position: "start" | "end") => ({
              position,
              type: lsType,
              length: axisLen,
              width: tenonH,
              thickness: lowerTenonThick,
              shoulderOn,
              offsetWidth: -worldOffset,
              ...(position === "start" && lsTenonAxisStart ? { axis: lsTenonAxisStart } : {}),
              ...(position === "end" && lsTenonAxisEnd ? { axis: lsTenonAxisEnd } : {}),
            });
            return [mk("start"), mk("end")];
          })(),
          mortises: [],
        });
      }
      // 凳腳補 2 個下橫撐榫眼（前後 + 左右兩面）
      // 靜止 X（前後）= 下榫；移動 Z（左右）= 上榫；Z 整支上移
      // ⚠️ 未套 splay 補償：是 latent bug 但無法用 builder origin 修。
      // splayed 腳在 stretcherY=100 高度 splayShift_X = 75 × (1-100/425) = 57mm、
      // 已比 legHalfX (17) 大、deformed inner face 跑到 leg-local 負側、若用
      // 「sgn × (legHalfX - splayShift)」shift origin、值變負被 mortiseLocalBox
      // 誤判為「另一面 mortise」、cut box 開到錯的面、跟 leg material 還是不重疊。
      // 治本：CSG 層 deform shift（23b0563 風格、已 revert）。
      // 現況：下橫撐 mortise cut box 不在 leg material 範圍內、CSG 沒挖到孔、
      // tenon mesh z-fight 在 leg material 裡視覺上看不出缺陷。詳見
      // memory project_wrd_splayed_apron_mortise_fix.md「沒解的長期問題」。
      const lsXCenterY = lowerY + lowerW / 2;
      const lsZCenterY = lsXCenterY + (lowerVisuallyStaggered ? lowerStretcherStaggerMm : 0);
      // 榫眼深/通榫依軸別：Z 面（接左右橫撐）用 legD-衍生、X 面（接前後橫撐）用 legW-衍生
      for (const leg of legs) {
        const cx = leg.origin.x;
        const cz = leg.origin.z;
        // 不挖下橫撐榫眼的兩種情況（跟牙板 legMortisesForApron 同條件）：
        // ① 弧肩斜腳：斜降薄腳區挖榫眼會露出破口（榫眼口 + 紅榫頭外露，且內面收過中線
        //    讓榫眼位置對不上橫撐肩）。
        // ② 非方腳（legW≠legD，腳面比下橫撐厚寬）：榫眼孔露在橫撐外緣＝使用者看到的紅方塊。
        // 兩者都改「不挖榫眼」→ 腳保持實體、下橫撐盲榫直接埋進實體被遮住（榫頭已 clamp 在
        // 料厚內留背牆）。沒破口、沒露榫。方腳（legW===legD 且非弧肩）維持挖榫眼＝byte 一致。
        if (legShape === "curved-taper" || legW !== legD) continue;
        // 斜腳：下橫撐 mortise 跟 apron 同軸別約定
        // Z 面榫 → rotX（FRONT 看不到 tilt、entry 維持直矩形）
        // X 面榫 → rotZ（FRONT 看得到 tilt、透視過去變平行四邊形）
        const lsZRotX = (_splayDzForLegs !== 0 && legHeight > 0)
          ? Math.sign(cz || 1) * Math.atan(Math.abs(_splayDzForLegs) / legHeight)
          : 0;
        // 同 legMortisesForApron 的 xFaceRotZ:rotZ 應 -sign(cx)(user 2026-05-27 斜錯方向)
        const lsXRotZ = (_splayDxForLegs !== 0 && legHeight > 0)
          ? -Math.sign(cx || 1) * Math.atan(Math.abs(_splayDxForLegs) / legHeight)
          : 0;
        if (lowerCanHalfStagger) {
          leg.mortises.push(
            // Z 面 mortise（接 Z 軸 = 左右下橫撐, 上移）— 上榫
            {
              // curved-taper 左右橫撐外挪 ctZShift → 榫眼跟著挪,肩才蓋得住榫眼口
              origin: { x: Math.sign(cx || 1) * ctZShift, y: lsZCenterY + lowerUpperTenonOffset, z: cz > 0 ? -1 : 1 },
              depth: lowerTenonZ,
              length: lowerUpperTenonH,
              width: lowerTenonThick,
              through: lowerThroughZ,
              ...(lsZRotX ? { rotX: lsZRotX } : {}),
            },
            // X 面 mortise（接 X 軸 = 前後下橫撐, 靜止）— 下榫
            {
              origin: { x: cx > 0 ? -1 : 1, y: lsXCenterY + lowerLowerTenonOffset, z: 0 },
              depth: lowerTenonX,
              length: lowerLowerTenonH,
              width: lowerTenonThick,
              through: lowerThroughX,
              ...(lsXRotZ ? { rotZ: lsXRotZ } : {}),
            },
          );
        } else {
          leg.mortises.push(
            {
              origin: { x: Math.sign(cx || 1) * ctZShift, y: lsZCenterY, z: cz > 0 ? -1 : 1 },
              depth: lowerTenonZ,
              length: lowerTenonW,
              width: lowerTenonThick,
              through: lowerThroughZ,
              ...(lsZRotX ? { rotX: lsZRotX } : {}),
            },
            {
              origin: { x: cx > 0 ? -1 : 1, y: lsXCenterY, z: 0 },
              depth: lowerTenonX,
              length: lowerTenonW,
              width: lowerTenonThick,
              through: lowerThroughX,
              ...(lsXRotZ ? { rotZ: lsXRotZ } : {}),
            },
          );
        }
      }
    }
  }

  const design: FurnitureDesign = {
    id: `square-stool-${length}x${width}x${height}`,
    category: "stool",
    nameZh: "方凳",
    overall: { length, width, thickness: height },
    parts,
    defaultJoinery: "through-tenon",
    useButtJointConvention: true,
    primaryMaterial: material,
    notes: isEn
      ? `Leg style: ${legShapeLabel(legShape)}. Seat-to-leg through tenon, leg-to-stretcher blind tenon.` +
        (withLowerStretcher
          ? lowerStretcherStyle === "x-cross"
            ? " Plus X-cross stretchers (Ming/Qing folding-stool style)."
            : " Plus H-form lower stretchers."
          : "") +
        ` ${seatEdgeNote(seatEdge, undefined, locale)}` +
        (seatProfileNote(seatProfile) ? ` ${seatProfileNote(seatProfile)}` : "")
      : `腳樣式：${legShapeLabel(legShape)}。座板與凳腳用通榫，凳腳與橫撐用半榫。` +
        (withLowerStretcher
          ? lowerStretcherStyle === "x-cross"
            ? " 加 X 字交叉橫撐（明清交杌做法）。"
            : " 加 H 字下橫撐結構。"
          : "") +
        ` ${seatEdgeNote(seatEdge, undefined, locale)}` +
        (seatProfileNote(seatProfile) ? ` ${seatProfileNote(seatProfile)}` : ""),
  };
  applyStandardChecks(design, {
    minLength: 250, minWidth: 250, minHeight: 350,
    maxLength: 600, maxWidth: 600, maxHeight: 550,
  });
  // 尺寸明顯比較像桌類 → 建議切茶几模板
  if (length > 600 || width > 600) {
    appendSuggestion(design, {
      text: `${length}×${width}mm 比較像茶几尺寸——茶几模板有專屬選項（下棚板、牙板距桌面、外伸）。`,
      suggestedCategory: "tea-table",
      presetParams: { length, width, height: Math.min(height, 500), material },
    });
  }
  appendWarnings(
    design,
    validateStoolStructure({
      legSize,
      height,
      seatThickness,
      seatSpan: Math.max(length, width),
      lowerStretcherHeight: withLowerStretcher
        ? lowerStretcherHeightOpt > 0
          ? lowerStretcherHeightOpt
          : Math.round(legHeight * LOWER_STRETCHER_HEIGHT_RATIO)
        : undefined,
      hasLowerStretcher: withLowerStretcher,
    }),
  );
  return design;
};

// ----- helpers -----

function legMortisesForApron(
  corner: { x: number; z: number },
  length: number,
  width: number,
  opts: {
    // 榫眼深度/通榫依軸別（X 面接前後牙板=legW、Z 面接左右牙板=legD）分開帶入
    apronTenonLengthX: number;
    apronTenonLengthZ: number;
    apronThroughX?: boolean;
    apronThroughZ?: boolean;
    apronUpperTenonH: number;
    apronLowerTenonH: number;
    apronUpperTenonOffset: number;
    apronLowerTenonOffset: number;
    apronTenonThick: number;
    apronWidth: number;
    legHeight: number;
    apronDropFromTop: number;
    apronVisualStaggerMm?: number;
    /** 已停用：以前 splayed 腳給 mortise 加 splayShift/rotation 對齊 deformed
     *  leg material + apron tenon 世界位置、但 user 2026-05-26 確認 maker 製作
     *  優先 > 3D 視覺對齊，要求 mortise 回到腳中心軸（對稱 12.5/12.5 肩位、乾淨
     *  垂直矩形）。所以這兩個參數忽略。3D 上 splay 腳會看到接合缺口，是接受的
     *  trade-off。詳見 memory [[project-wrd-splayed-apron-mortise-fix]]。 */
    splayDx?: number;
    splayDz?: number;
  },
) {
  const {
    apronTenonLengthX, apronTenonLengthZ, apronUpperTenonH, apronLowerTenonH,
    apronUpperTenonOffset, apronLowerTenonOffset,
    apronTenonThick, apronWidth, legHeight, apronDropFromTop,
  } = opts;
  const visualStagger = opts.apronVisualStaggerMm ?? 0;
  const throughX = opts.apronThroughX ?? false;
  const throughZ = opts.apronThroughZ ?? false;
  const splayDx = opts.splayDx ?? 0;
  const splayDz = opts.splayDz ?? 0;
  // 斜腳：榫眼跟著牙板斜（user 2026-05-27）
  // - Z 面榫（entry 在 ±Z 面，FRONT 視圖直接看到的小矩形）：
  //   physically 牙板在 Z-Y 平面內傾斜 → mortise 繞 part-local X 軸轉 (rotX)
  //   在 FRONT 視圖看不到 tilt（Z 被視圖深度方向 collapse）→ 維持直矩形 ✓
  // - X 面榫（entry 在 ±X 面，FRONT 視圖透視過去看到的大矩形）：
  //   physically 牙板在 X-Y 平面內傾斜 → mortise 繞 part-local Z 軸轉 (rotZ)
  //   在 FRONT 視圖看到 tilt（X-Y 平面投影）→ 變成平行四邊形 ✓
  const zFaceRotX = (splayDz !== 0 && legHeight > 0)
    ? Math.sign(corner.z || 1) * Math.atan(Math.abs(splayDz) / legHeight)
    : 0;
  // X 面 mortise rotZ:apron tenon 在 world 沿 -X 方向、leg 軸傾後 leg-local
  // frame 看 apron 方向是(-cos θ, sin θ),從 mortise 自然軸 -X 旋轉到此是
  // **clockwise**(負 rotZ around Z),符號要 -sign(corner.x)(user 2026-05-27
  // 「斜錯方向」)。
  const xFaceRotZ = (splayDx !== 0 && legHeight > 0)
    ? -Math.sign(corner.x || 1) * Math.atan(Math.abs(splayDx) / legHeight)
    : 0;
  // 牙板中心 Y（leg-local）= legHeight − apronDropFromTop − apronWidth/2
  // 靜止 Z（左右）= 上榫；移動 X（前後，下移）= 下榫
  // 視覺錯開時 X 向整支下移
  const zCenterY = legHeight - apronDropFromTop - apronWidth / 2;
  const xCenterY = zCenterY - visualStagger;
  return [
    // Z 面 mortise（接 Z 軸 = 左右牙板, 靜止）— 上榫
    // origin.x = 0 / origin.z = ±LEG_FACE_INSET (=1) → 腳中心軸、對稱 12.5/12.5 肩位
    {
      origin: { x: 0, y: zCenterY + apronUpperTenonOffset, z: corner.z > 0 ? -1 : 1 },
      depth: apronTenonLengthZ,
      length: apronUpperTenonH,
      width: apronTenonThick,
      through: throughZ,
      rotX: zFaceRotX || undefined,
    },
    // X 面 mortise（接 X 軸 = 前後牙板, 下移）— 下榫
    {
      origin: { x: corner.x > 0 ? -1 : 1, y: xCenterY + apronLowerTenonOffset, z: 0 },
      depth: apronTenonLengthX,
      length: apronLowerTenonH,
      width: apronTenonThick,
      through: throughX,
      rotZ: xFaceRotZ || undefined,
    },
  ];
}

function apron(
  id: string,
  nameZh: string,
  visibleLength: number,
  axis: "x" | "z",
  origin: { x?: number; z?: number },
) {
  return {
    id,
    nameZh,
    visibleLength,
    axis,
    origin: { x: origin.x ?? 0, z: origin.z ?? 0 },
  };
}
