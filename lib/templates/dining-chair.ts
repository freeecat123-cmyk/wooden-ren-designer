import type {
  FurnitureDesign,
  FurnitureTemplate,
  OptionSpec,
  Part,
} from "@/lib/types";
import { getOption, opt } from "@/lib/types";
import { RECT_LEG_SHAPE_CHOICES, seatEdgeOption, seatEdgeStyleOption, seatEdgeNote, seatEdgeShape, seatProfileOption, seatProfileNote, seatScoopShape, legEdgeOption, legEdgeStyleOption, legEdgeNote, legEdgeShape, stretcherEdgeOption, stretcherEdgeStyleOption, stretcherEdgeNote, backRakeOption, backRakeNote, legShapeLabel, legBottomScale, legScaleAt } from "./_helpers";
import { applyStandardChecks } from "./_validators";
import { DINING_CHAIR, SPLAY_ANGLE } from "@/lib/knowledge/chair-geometry";
import { standardTenon, autoTenonType } from "@/lib/joinery/standards";

export const diningChairOptions: OptionSpec[] = [
  // 腳
  { group: "leg", type: "select", key: "legShape", label: "椅腳樣式", defaultValue: "box", choices: RECT_LEG_SHAPE_CHOICES },
  { group: "leg", type: "number", key: "legSize", label: "椅腳粗 (mm)", defaultValue: 35, min: 20, max: 120, step: 1, help: "正方腳預設值。若下方寬/厚另填則優先使用" },
  { group: "leg", type: "number", key: "legWidthOverride", label: "椅腳寬 X (mm)", defaultValue: 0, min: 0, max: 120, step: 1, help: "0 = 用「椅腳粗」；填值 = 沿座板長邊 X 的尺寸（可做扁腳）" },
  { group: "leg", type: "number", key: "legDepthOverride", label: "椅腳厚 Z (mm)", defaultValue: 0, min: 0, max: 120, step: 1, help: "0 = 用「椅腳粗」；填值 = 沿座板寬邊 Z 的尺寸" },
  { group: "leg", type: "number", key: "legInset", label: "椅腳內縮 (mm)", defaultValue: 0, min: 0, max: 200, step: 5, help: "椅腳中心離座板邊緣的內縮量。> 0 讓座板外伸、視覺更俐落" },
  { group: "leg", type: "number", key: "splayAngle", label: "外斜角度 (°)", defaultValue: SPLAY_ANGLE.stoolDefaultDeg, min: 1, max: 10, step: 0.5, unit: "°", help: "斜腳系列才有效——從垂直起算的外傾角度。建議 3–8°；超過 10° 底盤太大不穩", dependsOn: { key: "legShape", oneOf: ["splayed", "splayed-length", "splayed-width"] } },
  { group: "leg", type: "select", key: "rearPostMode", label: "後腳/背柱接合", defaultValue: "split", choices: [
    { value: "split", label: "分離（後腳到座板 + 獨立背柱）" },
    { value: "continuous-straight", label: "一木連做（A 直料）" },
    { value: "continuous-bent", label: "一木連做（B 折角型，座面以上後仰）" },
  ], help: "split = 現行設計；continuous-* = 後腳延伸成背柱，座板不再接後腳（浮在牙板上）" },
  // 座板
  { group: "top", type: "number", key: "seatThickness", label: "座板厚 (mm)", defaultValue: 25, min: 12, max: 60, step: 1 },
  { group: "top", type: "number", key: "seatHeight", label: "坐高 (mm)", defaultValue: DINING_CHAIR.seatHeightMm, min: 150, max: 900, step: 10, help: `地面到座板上緣，一般 ${DINING_CHAIR.seatHeightRangeMm[0]}–${DINING_CHAIR.seatHeightRangeMm[1]}（FWW 共識）` },
  { group: "top", type: "number", key: "seatCornerR", label: "椅面四角圓角 (mm)", defaultValue: 0, min: 0, max: 100, step: 2, help: "俯視看，椅面 4 個角的圓弧半徑；0 = 直角，30~50 是常見柔角" },
  seatEdgeOption("top", 5),
  seatEdgeStyleOption("top"),
  legEdgeOption("leg", 1),
  legEdgeStyleOption("leg"),
  stretcherEdgeOption("stretcher", 1),
  stretcherEdgeStyleOption("stretcher"),
  // 座面舒適度
  seatProfileOption("top"),
  { group: "top", type: "checkbox", key: "seatFrontWaterfall", label: "座板前緣 waterfall 圓化", defaultValue: false, help: "座板前緣大圓化（R20-R30），減少對大腿後側壓迫，久坐不麻", wide: true },
  { group: "top", type: "number", key: "seatBendMm", label: "椅面彎曲 (mm)", defaultValue: 0, min: 0, max: 25, step: 1, help: "整片椅面像彎合板那樣彎曲，中間下凹比較好坐；四角榫眼位置不受影響。>0 會覆蓋鞍形 / 邊緣 profile / waterfall" },
  // 牙板
  { group: "apron", type: "number", key: "apronWidth", label: "牙板高 (mm)", defaultValue: 60, min: 30, max: 200, step: 5 },
  { group: "apron", type: "number", key: "apronThickness", label: "牙板厚 (mm)", defaultValue: 20, min: 10, max: 40, step: 1, help: "牙板的水平厚度（垂直於座板邊）" },
  { group: "apron", type: "number", key: "apronOffset", label: "牙板距座板 (mm)", defaultValue: 0, min: 0, max: 150, step: 5, help: "牙板頂緣往下退的距離；0 = 齊平座板下緣（最常見）。一木連做模式強制 0。", dependsOn: { key: "rearPostMode", equals: "split" } },
  { group: "apron", type: "number", key: "apronStaggerMm", label: "牙板錯開 (mm)", defaultValue: 0, min: 0, max: 60, step: 2, help: "前後牙板（X 軸）相對左右牙板下移量；0 = 等高（自動上下半榫避免穿模）" },
  { group: "apron", type: "checkbox", key: "legPenetratingTenon", label: "腳上榫頭通透（明榫裝飾）", defaultValue: false, help: "勾選：牙板/下橫撐進腳改通榫（榫頭穿透到腳另一面），明式裝飾感；未勾：依母件厚度自動規則（≤25mm 通榫、>25mm 盲榫深度=厚度2/3）" },
  // 椅背
  { group: "back", type: "select", key: "backStyle", label: "椅背樣式", defaultValue: "slats", choices: [
    { value: "slats", label: "直條式（垂直板條）" },
    { value: "ladder", label: "橫檔式（水平橫木 3–5 根）" },
    { value: "splat", label: "中板式（中央單片寬板）" },
    { value: "windsor", label: "Windsor spindle 風格（多支圓棒）" },
    { value: "curved-splat", label: "曲面中板（弧形貼合背部）" },
  ] },
  { group: "back", type: "number", key: "backSlats", label: "直條數（直條式用）", defaultValue: 3, min: 0, max: 10, step: 1, help: "backStyle=直條 時有效", dependsOn: { key: "backStyle", equals: "slats" } },
  { group: "back", type: "number", key: "slatWidth", label: "直條寬 (mm)", defaultValue: 50, min: 15, max: 200, step: 5, dependsOn: { key: "backStyle", equals: "slats" } },
  { group: "back", type: "number", key: "backSlatThickness", label: "直條厚 (mm)", defaultValue: 18, min: 8, max: 40, step: 1, dependsOn: { key: "backStyle", equals: "slats" } },
  { group: "back", type: "number", key: "ladderRungs", label: "橫檔數（橫檔式用）", defaultValue: 4, min: 2, max: 8, step: 1, dependsOn: { key: "backStyle", equals: "ladder" } },
  { group: "back", type: "number", key: "splatWidth", label: "中板寬 (mm)（中板式用）", defaultValue: 180, min: 80, max: 400, step: 10, dependsOn: { key: "backStyle", equals: "splat" } },
  { group: "back", type: "number", key: "curvedSplatWidth", label: "曲面中板寬 (mm)", defaultValue: 220, min: 100, max: 450, step: 10, help: "曲面中板的水平寬度", dependsOn: { key: "backStyle", equals: "curved-splat" } },
  { group: "back", type: "number", key: "curvedSplatBendMm", label: "曲面中板凹陷 (mm)", defaultValue: 20, min: -60, max: 60, step: 2, help: "正值往背面凹（貼合背部）；負值往前凸（外凸）；0 = 平板", dependsOn: { key: "backStyle", equals: "curved-splat" } },
  { group: "back", type: "number", key: "backTopRailHeight", label: "椅背頂橫木高 (mm)", defaultValue: 50, min: 20, max: 180, step: 5 },
  { group: "back", type: "number", key: "backTopRailThickness", label: "椅背頂橫木厚 (mm)", defaultValue: 22, min: 12, max: 50, step: 1 },
  { group: "back", type: "number", key: "backInsetFromRearMm", label: "椅背距座面後緣 (mm)", defaultValue: 0, min: 0, max: 200, step: 5, help: "椅背柱外緣往前縮多少；0 = 跟後腳齊（最常見）。> 0 時 slats/splat 會與後牙板脫開（建議改 ladder/windsor）", dependsOn: { key: "rearPostMode", equals: "split" } },
  { group: "back", type: "number", key: "backInsetFromEndMm", label: "椅背距座面端面 (mm)", defaultValue: 0, min: 0, max: 200, step: 5, help: "椅背柱外緣往內縮多少；0 = 跟後腳齊（最常見）。會同步縮短頂橫木與椅背元件可用寬", dependsOn: { key: "rearPostMode", equals: "split" } },
  backRakeOption("back"),
  // 扶手
  { group: "back", type: "checkbox", key: "withArmrest", label: "加扶手", defaultValue: false, help: "後腳延伸往前接到前腳上方的扶手（會增加木料 + 工時）" },
  { group: "back", type: "number", key: "armrestHeight", label: "扶手高（座板上）(mm)", defaultValue: 200, min: 150, max: 280, step: 10, help: "從座板上緣到扶手頂面", dependsOn: { key: "withArmrest", equals: true } },
  { group: "back", type: "number", key: "armrestPostWidth", label: "扶手前柱寬 X (mm)", defaultValue: 0, min: 0, max: 120, step: 1, help: "0 = 跟椅腳粗一樣", dependsOn: { key: "withArmrest", equals: true } },
  { group: "back", type: "number", key: "armrestPostThickness", label: "扶手前柱厚 Z (mm)", defaultValue: 0, min: 0, max: 120, step: 1, help: "0 = 跟椅腳厚一樣", dependsOn: { key: "withArmrest", equals: true } },
  { group: "back", type: "number", key: "armrestPlankWidth", label: "扶手板寬 (mm)", defaultValue: 50, min: 25, max: 120, step: 5, help: "扶手板的左右寬（手掌平面）", dependsOn: { key: "withArmrest", equals: true } },
  { group: "back", type: "number", key: "armrestPlankThickness", label: "扶手板厚 (mm)", defaultValue: 22, min: 14, max: 50, step: 1, help: "扶手板的垂直厚（從上方看到的厚度）", dependsOn: { key: "withArmrest", equals: true } },
  // 橫撐
  { group: "stretcher", type: "select", key: "stretcherStyle", label: "下橫撐樣式", defaultValue: "none", choices: [
    { value: "none", label: "無下橫撐" },
    { value: "h-frame", label: "H 形（左右 + 中央連接）" },
    { value: "box", label: "田字形（四周一圈）" },
    { value: "side-only", label: "雙側（左右兩條，前後不加）" },
  ] },
  { group: "stretcher", type: "number", key: "lowerStretcherHeight", label: "下橫撐離地高 (mm)", defaultValue: 0, min: 0, max: 400, step: 10, help: "0 = 自動（坐高的 25%）", dependsOn: { key: "stretcherStyle", notIn: ["none"] } },
  { group: "stretcher", type: "number", key: "lowerStretcherWidth", label: "下橫撐寬 (mm)", defaultValue: 35, min: 20, max: 60, step: 1, help: "下橫撐的垂直高（粗）", dependsOn: { key: "stretcherStyle", notIn: ["none"] } },
  { group: "stretcher", type: "number", key: "lowerStretcherThickness", label: "下橫撐厚 (mm)", defaultValue: 18, min: 12, max: 40, step: 1, help: "下橫撐的水平厚（深）", dependsOn: { key: "stretcherStyle", notIn: ["none"] } },
  { group: "stretcher", type: "number", key: "lowerStretcherStaggerMm", label: "下橫撐錯開 (mm)", defaultValue: 0, min: 0, max: 60, step: 2, help: "左右下橫撐（Z 軸）相對前後下橫撐上移量；0 = 等高（自動上下半榫避免穿模）", dependsOn: { key: "stretcherStyle", notIn: ["none"] } },
];

/**
 * 餐椅（dining-chair）
 *
 * 結構（簡化版）：
 *  - 1 × 座板
 *  - 4 × 椅腳（前 2 短至座面，後 2 延伸至椅背頂）
 *  - 4 × 座面下牙板（半榫接椅腳）
 *  - 1 × 椅背頂橫木（連接後 2 椅腳上端）
 *  - 2 × 椅背板條（直立，半榫接座面後牙板與頂橫木）
 *
 * 已知簡化：後腳以直料表示。實際舒適餐椅會有後仰曲線（10–15°），需後腳上半段
 * 後傾或鋸成 S 形。SVG/3D 渲染目前以 axis-aligned box 為主，無法表現曲線；
 * 製作時請依工序文件以樣板鋸出後腳曲線後再鑿榫眼。
 */
export const diningChair: FurnitureTemplate = (input): FurnitureDesign => {
  const { length, width, height, material } = input;
  const o = diningChairOptions;

  const legShape = getOption<string>(input, opt(o, "legShape"));
  const legSize = getOption<number>(input, opt(o, "legSize"));
  const legWidthOverride = getOption<number>(input, opt(o, "legWidthOverride"));
  const legDepthOverride = getOption<number>(input, opt(o, "legDepthOverride"));
  const legW = legWidthOverride > 0 ? legWidthOverride : legSize;
  const legD = legDepthOverride > 0 ? legDepthOverride : legSize;
  const legShortDim = Math.min(legW, legD);
  const legInset = getOption<number>(input, opt(o, "legInset"));
  const splayAngle = getOption<number>(input, opt(o, "splayAngle"));
  const rearPostMode = getOption<string>(input, opt(o, "rearPostMode"));
  const isContinuous = rearPostMode !== "split";
  // 一木連做（A 直料）強制 backRake=0；B/C 用使用者設的角度
  // continuous 模式 backInsetFromRear/End 強制歸零（背柱已跟後腳對齊）

  const seatThickness = getOption<number>(input, opt(o, "seatThickness"));
  const seatHeight = getOption<number>(input, opt(o, "seatHeight"));
  const seatEdge = getOption<string>(input, opt(o, "seatEdge"));
  const seatEdgeStyle = getOption<string>(input, opt(o, "seatEdgeStyle"));
  const legEdge = getOption<number>(input, opt(o, "legEdge"));
  const legEdgeStyle = getOption<string>(input, opt(o, "legEdgeStyle"));
  const stretcherEdge = getOption<number>(input, opt(o, "stretcherEdge"));
  const stretcherEdgeStyle = getOption<string>(input, opt(o, "stretcherEdgeStyle"));
  const seatProfile = getOption<string>(input, opt(o, "seatProfile"));
  const seatFrontWaterfall = getOption<boolean>(input, opt(o, "seatFrontWaterfall"));
  const seatBendMm = getOption<number>(input, opt(o, "seatBendMm"));
  const seatCornerR = getOption<number>(input, opt(o, "seatCornerR"));
  const apronWidth = getOption<number>(input, opt(o, "apronWidth"));
  const apronThickness = getOption<number>(input, opt(o, "apronThickness"));
  const apronOffsetRaw = getOption<number>(input, opt(o, "apronOffset"));
  // 一木連做：牙板強制貼齊座板下緣（apronOffset = 0），讓椅背直立件能直接
  // 接到牙板頂緣形成連續視覺
  const apronOffset = isContinuous ? 0 : apronOffsetRaw;
  const apronStaggerMm = getOption<number>(input, opt(o, "apronStaggerMm"));
  const legPenetratingTenon = getOption<boolean>(input, opt(o, "legPenetratingTenon"));
  const backStyle = getOption<string>(input, opt(o, "backStyle"));
  const backRakeRaw = getOption<number>(input, opt(o, "backRake"));
  // continuous-straight 模式強制 rake=0；其他模式用使用者設定
  const backRake = rearPostMode === "continuous-straight" ? 0 : backRakeRaw;
  const withArmrest = getOption<boolean>(input, opt(o, "withArmrest"));
  const armrestHeight = getOption<number>(input, opt(o, "armrestHeight"));
  const armrestPostWidthOpt = getOption<number>(input, opt(o, "armrestPostWidth"));
  const armrestPostThicknessOpt = getOption<number>(input, opt(o, "armrestPostThickness"));
  const armrestPlankWidth = getOption<number>(input, opt(o, "armrestPlankWidth"));
  const armrestPlankThickness = getOption<number>(input, opt(o, "armrestPlankThickness"));
  const slatCount = getOption<number>(input, opt(o, "backSlats"));
  const slatWidth = getOption<number>(input, opt(o, "slatWidth"));
  const slatThickness = getOption<number>(input, opt(o, "backSlatThickness"));
  const ladderRungs = getOption<number>(input, opt(o, "ladderRungs"));
  const splatWidth = getOption<number>(input, opt(o, "splatWidth"));
  const curvedSplatBendMm = getOption<number>(input, opt(o, "curvedSplatBendMm"));
  const curvedSplatWidth = getOption<number>(input, opt(o, "curvedSplatWidth"));
  const topRailHeightOpt = getOption<number>(input, opt(o, "backTopRailHeight"));
  const topRailThickness = getOption<number>(input, opt(o, "backTopRailThickness"));
  const backInsetFromRearMm = getOption<number>(input, opt(o, "backInsetFromRearMm"));
  const backInsetFromEndMm = getOption<number>(input, opt(o, "backInsetFromEndMm"));
  const stretcherStyle = getOption<string>(input, opt(o, "stretcherStyle"));
  const lowerStretcherHeightOpt = getOption<number>(input, opt(o, "lowerStretcherHeight"));
  const lowerStretcherWidthOpt = getOption<number>(input, opt(o, "lowerStretcherWidth"));
  const lowerStretcherThicknessOpt = getOption<number>(input, opt(o, "lowerStretcherThickness"));
  const lowerStretcherStaggerMmOpt = getOption<number>(input, opt(o, "lowerStretcherStaggerMm"));
  const backHeight = height - seatHeight;
  // 正規比例（standardTenon 規則）：榫厚 = T/3、肩寬 5mm、盲榫長 = round(2/3 × M, ≥25)、通榫長 = M
  const MIN_SHOULDER = 6;
  // 1) leg ↔ seat：腳頂進座板，依自動規則（座板薄 → 通榫；厚 → 盲榫）
  const legTopTenonType = autoTenonType(seatThickness);
  const legTenonStd = standardTenon({
    type: legTopTenonType,
    childThickness: legShortDim,
    childWidth: legShortDim,
    motherThickness: seatThickness,
  });
  const legTopTenonSize = legTenonStd.width;
  // 2) apron ↔ leg：依自動規則 + legPenetratingTenon override
  const apronTenonType = legPenetratingTenon ? "through-tenon" : autoTenonType(legShortDim);
  const apronTenonStd = standardTenon({
    type: apronTenonType === "through-tenon" ? "through-tenon" : "shouldered-tenon",
    childThickness: apronThickness,
    childWidth: apronWidth,
    motherThickness: legShortDim,
  });
  // 通榫加 5mm 補償斜腳 rotation tilt 在世界軸投影損失
  const apronTenonLen = apronTenonStd.length + (apronTenonType === "through-tenon" ? 5 : 0);
  const apronTenonThick = apronTenonStd.thickness;
  const apronTenonW = apronTenonStd.width;
  // 牙板半榫錯位（apronStaggerMm 從 UI 讀；0 = 等高自動上下半榫）
  // 靜止 Z（左右）= 上半榫；移動 X（前後）= 下半榫
  // apronOffset = 0 → 牙板頂貼座板下緣 → 上半榫保留 10mm 上肩；> 0 → 同樣保留以維持半榫錯位
  const APRON_TOP_SHOULDER = 10;
  const apronTotalTenonH = Math.max(0, apronWidth - APRON_TOP_SHOULDER);
  const apronCanHalfStagger = apronStaggerMm < apronTenonW && apronTotalTenonH >= 16;
  const APRON_HALF_TENON_GAP = 4;
  const apronHalfTenonH = apronCanHalfStagger
    ? Math.min(apronTenonW, Math.floor((apronTotalTenonH + apronStaggerMm - APRON_HALF_TENON_GAP) / 2))
    : apronTenonW;
  const apronUpperTenonH = apronHalfTenonH;
  const apronLowerTenonH = apronHalfTenonH;
  // part-local：apron Y 從 0(底) 到 apronWidth(頂)；mesh 中心 Y = apronWidth/2
  const apronUpperTenonOffset = apronCanHalfStagger
    ? (apronWidth - APRON_TOP_SHOULDER - apronUpperTenonH / 2) - apronWidth / 2
    : 0;
  const apronLowerTenonOffset = apronCanHalfStagger
    ? apronLowerTenonH / 2 - apronWidth / 2
    : 0;
  const seatTopTenonLen = legTenonStd.length;

  // 椅背 joinery 位置事先算好，腳/頂橫木/後牙板 都會引用
  const topRailHeight = topRailHeightOpt;
  const topRailY = height - topRailHeight;
  const topRailYCenter = topRailY + topRailHeight / 2;
  const topRailTenonThick = Math.max(
    6,
    Math.min(topRailThickness - 2 * MIN_SHOULDER, Math.round(legShortDim / 3)),
  );
  const topRailTenonW = Math.max(15, topRailHeight - 2 * MIN_SHOULDER);
  const apronY = seatHeight - seatThickness - apronWidth - apronOffset;
  const backZonHeight = topRailY - seatHeight;
  // 椅背元件位置：slat / splat 用 X，rung 用 Y
  const ladderRungWidth = 55;
  const ladderRungThickness = 18;
  const slatXs: number[] = [];
  if (backStyle === "slats" && slatCount > 0) {
    const availableWidth = length - legW - 40;
    const slotPitch = availableWidth / (slatCount + 1);
    for (let i = 0; i < slatCount; i++) {
      slatXs.push(-availableWidth / 2 + slotPitch * (i + 1));
    }
  }
  const rungYs: number[] = [];
  if (backStyle === "ladder") {
    for (let i = 0; i < ladderRungs; i++) {
      rungYs.push(
        seatHeight + ((i + 1) * backZonHeight) / (ladderRungs + 1) -
          ladderRungWidth / 2,
      );
    }
  }
  // slat / splat tenon 規格（給 rail / apron 的母榫眼用）
  const slatTenonLen = 15;
  const slatTenonW = (w: number) => Math.max(10, w - Math.round(w / 4));
  const slatTenonT = Math.max(5, Math.round(slatThickness / 3));
  const splatThicknessConst = 18;
  const splatTenonW = Math.max(12, splatWidth - 20);
  const splatTenonT = Math.max(5, Math.round(splatThicknessConst / 3));
  // ladder rung tenon（給後腳的母榫眼用）
  const rungTenonW = Math.max(12, ladderRungWidth - 2 * MIN_SHOULDER);
  const rungTenonT = Math.max(5, Math.round(ladderRungThickness / 3));

  // 自製 corners（替代 helpers.corners）— 支援 legW != legD（扁腳）
  const halfL = length / 2 - legW / 2 - legInset;
  const halfW = width / 2 - legD / 2 - legInset;
  const cornerPts = [
    { x: -halfL, z: -halfW },
    { x: halfL, z: -halfW },
    { x: -halfL, z: halfW },
    { x: halfL, z: halfW },
  ];

  // Leg shape mapping (reused from simple-table conventions)
  const splayMm = Math.round(Math.tan((splayAngle * Math.PI) / 180) * (seatHeight - seatThickness));
  const hoofMm = 35;
  const legShapeFor = (c: { x: number; z: number }): Part["shape"] => {
    if (legShape === "tapered") return { kind: "tapered", bottomScale: 0.6 };
    if (legShape === "strong-taper") return { kind: "tapered", bottomScale: 0.4 };
    if (legShape === "inverted") return { kind: "tapered", bottomScale: 1.25 };
    const cs: "chamfered" | "rounded" = legEdgeStyle === "rounded" ? "rounded" : "chamfered";
    const cm = legEdge > 0 ? legEdge : undefined;
    if (legShape === "splayed") {
      // 對稱 splay（同 bar-stool）：4 腳都往外傾，配合 buildSides 的對稱數學
      return {
        kind: "splayed",
        dxMm: Math.sign(c.x) * splayMm,
        dzMm: Math.sign(c.z) * splayMm,
        chamferMm: cm,
        chamferStyle: cs,
      };
    }
    if (legShape === "splayed-length") {
      return { kind: "splayed", dxMm: Math.sign(c.x) * splayMm, dzMm: 0, chamferMm: cm, chamferStyle: cs };
    }
    if (legShape === "splayed-width") {
      return { kind: "splayed", dxMm: 0, dzMm: Math.sign(c.z) * splayMm, chamferMm: cm, chamferStyle: cs };
    }
    if (legShape === "hoof") return { kind: "hoof", hoofMm, hoofScale: 1.3 };
    return undefined;
  };

  // butt-joint 慣例：腳本身只到座板下緣（前後都一樣），後腳的「上半段」用
  // 獨立的「背柱」零件 (back-post)，讓座板可以乾乾淨淨坐在 4 隻腳上面，
  // 不會跟後腳穿模。
  const legBaseHeight = seatHeight - seatThickness;
  // 一木連做：後腳延伸到座面上緣（過座板），跟背柱對接；前腳維持 legBaseHeight
  const legs: Part[] = cornerPts.map((c, i) => {
    const isBack = c.z > 0;
    const isBackContinuous = isBack && isContinuous;
    return {
      id: `leg-${i + 1}`,
      nameZh: isBack ? `後椅腳 ${i + 1}` : `前椅腳 ${i + 1}`,
      material,
      grainDirection: "length",
      visible: { length: legW, width: legD, thickness: isBackContinuous ? seatHeight : legBaseHeight },
      origin: { x: c.x, y: 0, z: c.z },
      shape: legShapeFor(c) ?? legEdgeShape(legEdge, legEdgeStyle),
      tenons: isBackContinuous ? [] : [
        {
          position: "top",
          type: legTopTenonType === "through-tenon" ? "through-tenon" : "blind-tenon",
          length: legTenonStd.length,
          width: legTenonStd.width,
          thickness: legTenonStd.thickness,
        },
      ],
      mortises: (() => {
        // 牙板中心 Y（leg-local）；靜止 Z（左右）= 上榫；移動 X（前後）= 下榫
        // 餐椅 apronStaggerMm 固定為 0，xCenterY = zCenterY
        const zCenterY = apronY + apronWidth / 2;
        const xCenterY = zCenterY - apronStaggerMm;
        const apronThrough = apronTenonType === "through-tenon";
        if (apronCanHalfStagger) {
          return [
            // Z 面 mortise（接 Z 軸 = 左右牙板，靜止）— 上榫
            {
              origin: { x: 0, y: zCenterY + apronUpperTenonOffset, z: c.z > 0 ? -1 : 1 },
              depth: apronTenonLen,
              length: apronUpperTenonH,
              width: apronTenonThick,
              through: apronThrough,
            },
            // X 面 mortise（接 X 軸 = 前後牙板，下移）— 下榫
            {
              origin: { x: c.x > 0 ? -1 : 1, y: xCenterY + apronLowerTenonOffset, z: 0 },
              depth: apronTenonLen,
              length: apronLowerTenonH,
              width: apronTenonThick,
              through: apronThrough,
            },
          ];
        }
        return [
          {
            origin: { x: 0, y: zCenterY, z: c.z > 0 ? -1 : 1 },
            depth: apronTenonLen,
            length: apronTenonW,
            width: apronTenonThick,
            through: apronThrough,
          },
          {
            origin: { x: c.x > 0 ? -1 : 1, y: xCenterY, z: 0 },
            depth: apronTenonLen,
            length: apronTenonW,
            width: apronTenonThick,
            through: apronThrough,
          },
        ];
      })(),
    };
  });

  // 後腳延伸出來的「背柱」(back-post) — 座板上方支撐椅背
  // 背柱位置基準 = 座板邊緣（不受 legInset 影響），只吃 backInsetFromEnd/RearMm
  // 這樣調 legInset 只動腳，椅背不會跟著飄
  const backPostBaseX = length / 2 - legW / 2;
  const backPostBaseZ = width / 2 - legD / 2;
  // continuous 模式：背柱位置 = 後腳位置（同 X/Z），看起來像一木連做
  // split 模式：背柱跟後腳脫鉤，受 backInsetFromRear/EndMm 控制
  const backPostX = (c: { x: number; z: number }) => isContinuous ? c.x : Math.sign(c.x) * (backPostBaseX - backInsetFromEndMm);
  const backPostZ = (c: { x: number; z: number }) => isContinuous ? c.z : backPostBaseZ - backInsetFromRearMm;
  const backPostShape = (): NonNullable<Part["shape"]> | undefined => legEdgeShape(legEdge, legEdgeStyle);
  const backPosts: Part[] = cornerPts
    .filter((c) => c.z > 0)
    .map((c, i) => ({
      id: `back-post-${i + 1}`,
      nameZh: `背柱 ${i + 1}`,
      material,
      grainDirection: "length",
      visible: { length: legW, width: legD, thickness: height - seatHeight },
      origin: { x: backPostX(c), y: seatHeight, z: backPostZ(c) },
      shape: backPostShape(),
      // continuous 模式背柱底端不再進座板（後腳已延伸到座面），不需要榫
      tenons: isContinuous ? [] : [
        // 背柱底端進座板，與前腳頂端共用同一個座板榫眼 → dims 必須一致
        {
          position: "bottom",
          type: legTopTenonType === "through-tenon" ? "through-tenon" : "blind-tenon",
          length: legTenonStd.length,
          width: legTenonStd.width,
          thickness: legTenonStd.thickness,
        },
      ],
      mortises: [
        // 頂橫木的母榫眼
        {
          origin: { x: c.x > 0 ? -1 : 1, y: topRailYCenter - seatHeight, z: 0 },
          depth: apronTenonLen,
          length: topRailTenonW,
          width: topRailTenonThick,
          through: false,
        },
        // 橫檔（ladder rung）的母榫眼
        ...(backStyle === "ladder"
          ? rungYs.map((ry) => ({
              origin: { x: c.x > 0 ? -1 : 1, y: ry + ladderRungWidth / 2 - seatHeight, z: 0 },
              depth: apronTenonLen,
              length: rungTenonW,
              width: rungTenonT,
              through: false,
            }))
          : []),
      ],
    }));
  // 背柱位置與後腳已脫鉤——legInset > 0 時兩者也錯開，需給背柱獨立座板榫眼
  const backPostOffset = legInset > 0 || backInsetFromEndMm > 0 || backInsetFromRearMm > 0;

  // 一木連做：座板後緣縮到後腳前緣，避免穿模（後腳延伸到 seatHeight，會跟座板共
  // 用 y 範圍）。縮 legD + legInset 是幾何最小值，不留多餘 margin 才不會有大缺口。
  const seatBackShrink = isContinuous ? legD + legInset : 0;
  const seatPanelWidth = width - seatBackShrink;
  const seatPanelZOffset = -seatBackShrink / 2;
  // 座板（前腳通榫進來）
  const seatPanel: Part = {
    id: "seat",
    nameZh: "座板",
    material,
    grainDirection: "length",
    visible: { length, width: seatPanelWidth, thickness: seatThickness },
    origin: { x: 0, y: seatHeight - seatThickness, z: seatPanelZOffset },
    shape: (() => {
      if (seatBendMm > 0) {
        return { kind: "face-rounded" as const, cornerR: seatCornerR, bendMm: -seatBendMm, bendAxis: "y" as const };
      }
      const scoop = seatScoopShape(seatProfile);
      if (scoop) return scoop;
      // waterfall：座板上下緣同時大圓化（egg edge）。chamferMm 受 seatThickness×0.45
      // 上限制約，所以這裡直接設成 seatThickness（讓引擎 clamp 到最大可能），
      // 並補 bottomChamferMm 把下緣一起做出來——視覺上跟預設 5mm 倒邊明顯區分
      const edge = seatFrontWaterfall
        ? { kind: "chamfered-top" as const, chamferMm: seatThickness, bottomChamferMm: seatThickness, style: "rounded" as const }
        : seatEdgeShape(seatEdge, seatEdgeStyle);
      if (edge && seatCornerR > 0) return { ...edge, cornerR: seatCornerR };
      if (edge) return edge;
      if (seatCornerR > 0) return { kind: "chamfered-top" as const, chamferMm: 0, cornerR: seatCornerR };
      return undefined;
    })(),
    tenons: [],
    // 4 腳通榫進來（榫頭從下方刺穿座板，背柱也從上方接，共用同一個榫眼）
    // mortise depth + through 跟 tenon type 同步（座板薄→通榫穿透；厚→盲榫不穿頂）
    // backInset > 0 時，背柱已偏離後腳角，需另外給背柱獨立的座板榫眼
    mortises: [
      // continuous 模式：只給前 2 腳座板榫眼（後腳已過座板，背柱也不再進座板）
      // origin.z 是 part-local，需扣掉 seat 自己的 z origin 偏移
      ...cornerPts
        .filter((c) => isContinuous ? c.z < 0 : true)
        .map((c) => ({
          origin: { x: c.x, y: 0, z: c.z - seatPanelZOffset },
          depth: legTenonStd.length,
          length: legTenonStd.width,
          width: legTenonStd.thickness,
          through: legTopTenonType === "through-tenon",
        })),
      ...(backPostOffset && !isContinuous
        ? cornerPts.filter((c) => c.z > 0).map((c) => ({
            origin: { x: backPostX(c), y: 0, z: backPostZ(c) - seatPanelZOffset },
            depth: legTenonStd.length,
            length: legTenonStd.width,
            width: legTenonStd.thickness,
            through: legTopTenonType === "through-tenon",
          }))
        : []),
    ],
  };

  // 4 座面下牙板 —— 套 bar-stool buildSides 算法（端面軸心對齊腳軸、上下緣保持水平、
  // splay 椅腳時端面斜成腳的傾角）
  const bottomScale = legBottomScale(legShape);
  const apronCenterY = apronY + apronWidth / 2;
  void backHeight;

  const apronIsLengthSplay = legShape === "splayed" || legShape === "splayed-length";
  const apronIsWidthSplay = legShape === "splayed" || legShape === "splayed-width";
  const apronSplayDx = apronIsLengthSplay ? splayMm : 0;
  const apronSplayDz = apronIsWidthSplay ? splayMm : 0;
  const apronIsSplayed = apronSplayDx > 0 || apronSplayDz > 0;
  const apronTiltX = apronSplayDx > 0 ? Math.atan(apronSplayDx / Math.max(1, legBaseHeight)) : 0;
  const apronTiltZ = apronSplayDz > 0 ? Math.atan(apronSplayDz / Math.max(1, legBaseHeight)) : 0;
  const apronInnerSpanX = length - legW - 2 * legInset;
  const apronInnerSpanZ = width - legD - 2 * legInset;
  const apronLegEdgeX = length / 2 - legW / 2 - legInset;
  const apronLegEdgeZ = width / 2 - legD / 2 - legInset;

  const apronShiftAt = (yMm: number) => legBaseHeight > 0 ? Math.max(0, 1 - yMm / legBaseHeight) : 0;
  const apronTopY = apronY + apronWidth;
  const apronBotY = apronY;
  const aSC = apronShiftAt(apronCenterY);
  const aST = apronShiftAt(apronTopY);
  const aSB = apronShiftAt(apronBotY);
  const apronSplayXc = apronSplayDx * aSC;
  const apronSplayZc = apronSplayDz * aSC;
  const apronSplayXt = apronSplayDx * aST;
  const apronSplayZt = apronSplayDz * aST;
  const apronSplayXb = apronSplayDx * aSB;
  const apronSplayZb = apronSplayDz * aSB;
  // X-axis 牙板用 legW（沿 X 的腳尺寸）；Z-axis 牙板用 legD
  const apronLwC = legW * legScaleAt(apronCenterY, legBaseHeight, bottomScale);
  const apronLwT = legW * legScaleAt(apronTopY, legBaseHeight, bottomScale);
  const apronLwB = legW * legScaleAt(apronBotY, legBaseHeight, bottomScale);
  const apronLdC = legD * legScaleAt(apronCenterY, legBaseHeight, bottomScale);
  const apronLdT = legD * legScaleAt(apronTopY, legBaseHeight, bottomScale);
  const apronLdB = legD * legScaleAt(apronBotY, legBaseHeight, bottomScale);

  type ApronSideDef = {
    key: string; nameZh: string; visibleLength: number;
    axis: "x" | "z"; sx: number; sz: number;
    origin: { x: number; z: number };
  };
  const apronSides: ApronSideDef[] = [
    { key: "front", nameZh: "前牙板", visibleLength: apronInnerSpanX - apronLwC + 2 * apronSplayXc, axis: "x", sx: 0, sz: -1, origin: { x: 0, z: -(apronLegEdgeZ + apronSplayZc) } },
    { key: "back",  nameZh: "後牙板", visibleLength: apronInnerSpanX - apronLwC + 2 * apronSplayXc, axis: "x", sx: 0, sz: 1,  origin: { x: 0, z: apronLegEdgeZ + apronSplayZc } },
    { key: "left",  nameZh: "左牙板", visibleLength: apronInnerSpanZ - apronLdC + 2 * apronSplayZc, axis: "z", sx: -1, sz: 0, origin: { x: -(apronLegEdgeX + apronSplayXc), z: 0 } },
    { key: "right", nameZh: "右牙板", visibleLength: apronInnerSpanZ - apronLdC + 2 * apronSplayZc, axis: "z", sx: 1, sz: 0,  origin: { x: apronLegEdgeX + apronSplayXc, z: 0 } },
  ];

  // apron-trapezoid 上下緣縮放與 bevelAngle 計算（X 軸用 lwC、Z 軸用 ldC）
  const apronHalfX_C = apronLegEdgeX + apronSplayXc - apronLwC / 2;
  const apronHalfX_T = apronLegEdgeX + apronSplayXt - apronLwT / 2;
  const apronHalfX_B = apronLegEdgeX + apronSplayXb - apronLwB / 2;
  const apronHalfZ_C = apronLegEdgeZ + apronSplayZc - apronLdC / 2;
  const apronHalfZ_T = apronLegEdgeZ + apronSplayZt - apronLdT / 2;
  const apronHalfZ_B = apronLegEdgeZ + apronSplayZb - apronLdB / 2;
  const apronHasShapeBend = apronSplayDx > 0 || apronSplayDz > 0 || bottomScale !== 1;

  const aprons: Part[] = apronSides.map((s) => {
    const trapTopScale =
      s.axis === "x" && apronHasShapeBend ? apronHalfX_T / apronHalfX_C
      : s.axis === "z" && apronHasShapeBend ? apronHalfZ_T / apronHalfZ_C
      : null;
    const trapBotScale =
      s.axis === "x" && apronHasShapeBend ? apronHalfX_B / apronHalfX_C
      : s.axis === "z" && apronHasShapeBend ? apronHalfZ_B / apronHalfZ_C
      : 1;
    const bevelAngle = apronIsSplayed
      ? s.axis === "x" ? -s.sz * apronTiltZ : -s.sx * apronTiltX
      : 0;
    // bevel 規則：apronOffset === 0（牙板貼座板下緣）→ half-bevel 頂面水平；其他無 bevel
    const apronTopAtSeat = apronOffset === 0;
    const useTopBevel = apronIsSplayed && apronTopAtSeat;
    const partShape = trapTopScale !== null
      ? { kind: "apron-trapezoid" as const, topLengthScale: trapTopScale, bottomLengthScale: trapBotScale, bevelAngle: useTopBevel ? bevelAngle : undefined, bevelMode: useTopBevel ? "half" as const : undefined }
      : legEdgeShape(stretcherEdge, stretcherEdgeStyle);
    return {
      id: `apron-${s.key}`,
      nameZh: s.nameZh,
      material,
      grainDirection: "length" as const,
      visible: { length: s.visibleLength, width: apronWidth, thickness: apronThickness },
      origin: { x: s.origin.x, y: apronY, z: s.origin.z },
      rotation: s.axis === "z"
        ? { x: Math.PI / 2, y: Math.PI / 2, z: s.sx * apronTiltX }
        : { x: Math.PI / 2 + (-s.sz) * apronTiltZ, y: 0, z: 0 },
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
            shoulderOn: [...apronTenonStd.shoulderOn] as Array<"top" | "bottom" | "left" | "right">,
          });
          return [mk("start"), mk("end")];
        }
        // 半榫錯位：靜止 Z（左右）= 上半榫；移動 X（前後）= 下半榫
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
      // 後牙板：上緣加 slat / splat 母榫眼。世界上方 = local -Z 面（rotation x:π/2）
      mortises:
        s.key === "back" && backStyle === "slats" && slatXs.length > 0
          ? slatXs.map((sx) => ({
              origin: { x: sx, y: 0, z: -1 },
              depth: slatTenonLen,
              length: slatTenonW(slatWidth),
              width: slatTenonT,
              through: false,
            }))
          : s.key === "back" && backStyle === "splat"
            ? [
                {
                  origin: { x: 0, y: 0, z: -1 },
                  depth: slatTenonLen,
                  length: splatTenonW,
                  width: splatTenonT,
                  through: false,
                },
              ]
            : [],
    };
  });

  // 扶手（withArmrest=true）：每側 2 件 = 1 前支柱（直立）+ 1 水平扶手板
  // post 尺寸：0 = 跟椅腳一樣；plank 尺寸從 UI 讀
  const armrestPostW = armrestPostWidthOpt > 0 ? armrestPostWidthOpt : legW;
  const armrestPostD = armrestPostThicknessOpt > 0 ? armrestPostThicknessOpt : legD;
  const armrestParts: Part[] = [];
  if (withArmrest) {
    const frontLegPair = cornerPts.filter((c) => c.z < 0);
    for (const fl of frontLegPair) {
      const sideKey = fl.x > 0 ? "right" : "left";
      const sideZh = fl.x > 0 ? "右" : "左";
      const bpX = Math.sign(fl.x) * (length / 2 - legW / 2 - backInsetFromEndMm);
      const bpZ = width / 2 - legD / 2 - backInsetFromRearMm;
      const postH = Math.max(0, armrestHeight - armrestPlankThickness);
      // 前支柱：座板上緣 → 扶手底
      if (postH > 0) {
        armrestParts.push({
          id: `armrest-front-post-${sideKey}`,
          nameZh: `${sideZh}扶手前支柱`,
          material,
          grainDirection: "length",
          visible: { length: armrestPostW, width: armrestPostD, thickness: postH },
          origin: { x: fl.x, y: seatHeight, z: fl.z },
          shape: legEdgeShape(legEdge, legEdgeStyle),
          tenons: [],
          mortises: [],
        });
      }
      // 水平扶手板：前支柱外緣 → 背柱前緣（butt joint，不穿過背柱避免組裝版重疊）
      const startZ = fl.z - legD / 2;
      const endZ = bpZ - legD / 2;
      const plankCenterZ = (startZ + endZ) / 2;
      const plankLength = endZ - startZ;
      const plankX = (fl.x + bpX) / 2;
      armrestParts.push({
        id: `armrest-plank-${sideKey}`,
        nameZh: `${sideZh}扶手板`,
        material,
        grainDirection: "length",
        visible: { length: plankLength, width: armrestPlankWidth, thickness: armrestPlankThickness },
        origin: { x: plankX, y: seatHeight + armrestHeight - armrestPlankThickness, z: plankCenterZ },
        rotation: { x: 0, y: Math.PI / 2, z: 0 },
        shape: legEdgeShape(stretcherEdge, stretcherEdgeStyle),
        tenons: [],
        mortises: [],
      });
    }
  }

  // 椅背頂橫木（連接後 2 椅腳）
  let backTopRail: Part = {
    id: "back-top-rail",
    nameZh: "椅背頂橫木",
    material,
    grainDirection: "length",
    // 連做模式背柱跟著 legInset 內縮，分離模式背柱獨立於 legInset，length / z 都要分開
    visible: { length: length - 2 * legW - (isContinuous ? 2 * legInset : 0) - 2 * backInsetFromEndMm, width: topRailThickness, thickness: topRailHeight },
    origin: { x: 0, y: topRailY, z: (isContinuous ? width / 2 - legD / 2 - legInset : width / 2 - legD / 2) - backInsetFromRearMm },
    tenons: [
      {
        position: "start",
        type: "shouldered-tenon",
        length: apronTenonLen,
        width: topRailTenonW,
        thickness: topRailTenonThick,
      },
      {
        position: "end",
        type: "shouldered-tenon",
        length: apronTenonLen,
        width: topRailTenonW,
        thickness: topRailTenonThick,
      },
    ],
    // 椅背頂橫木：下緣加 slat / splat 母榫眼。底面 = local Y=0
    mortises:
      backStyle === "slats" && slatXs.length > 0
        ? slatXs.map((sx) => ({
            origin: { x: sx, y: 0, z: 0 },
            depth: slatTenonLen,
            length: slatTenonW(slatWidth),
            width: slatTenonT,
            through: false,
          }))
        : backStyle === "splat"
          ? [
              {
                origin: { x: 0, y: 0, z: 0 },
                depth: slatTenonLen,
                length: splatTenonW,
                width: splatTenonT,
                through: false,
              },
            ]
          : [],
  };

  // 下橫撐——依 stretcherStyle 決定組態
  const lowerStretchers: Part[] = [];
  if (stretcherStyle !== "none") {
    const lowerY =
      lowerStretcherHeightOpt > 0
        ? lowerStretcherHeightOpt
        : Math.round(seatHeight * 0.25);
    const lowerW = lowerStretcherWidthOpt;
    const lowerT = lowerStretcherThicknessOpt;
    // 下橫撐 ↔ 椅腳：依自動規則 + legPenetratingTenon override
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
    // 下橫撐半榫錯位（從 UI 讀；0 = 等高自動上下半榫）
    const lowerStretcherStaggerMm = lowerStretcherStaggerMmOpt;
    const lowerCanHalfStagger = lowerStretcherStaggerMm < lowerTenonW && lowerW >= 16;
    const LOWER_HALF_TENON_GAP = 4;
    const lowerHalfTenonH = lowerCanHalfStagger
      ? Math.min(lowerTenonW, Math.floor((lowerW + lowerStretcherStaggerMm - LOWER_HALF_TENON_GAP) / 2))
      : lowerTenonW;
    const lowerUpperTenonH = lowerHalfTenonH;
    const lowerLowerTenonH = lowerHalfTenonH;
    const lowerUpperTenonOffset = lowerCanHalfStagger ? (lowerW / 2 - lowerUpperTenonH / 2) : 0;
    const lowerLowerTenonOffset = lowerCanHalfStagger ? (lowerLowerTenonH / 2 - lowerW / 2) : 0;

    // ---- 參考 bar-stool buildSides 算法 ----
    // splay 規則：dining-chair 「splayed」原本後腳 z 不外傾，但下橫撐用對稱 splay 算
    // （視覺上前後一致；後腳 z 在 leg shape 仍是直立，stretcher 端面對齊腳的中軸面足以接合）
    const isLengthSplay = legShape === "splayed" || legShape === "splayed-length";
    const isWidthSplay = legShape === "splayed" || legShape === "splayed-width";
    const splayDx = isLengthSplay ? splayMm : 0;
    const splayDz = isWidthSplay ? splayMm : 0;
    const isSplayed = splayDx > 0 || splayDz > 0;
    const tiltX = splayDx > 0 ? Math.atan(splayDx / Math.max(1, legBaseHeight)) : 0;
    const tiltZ = splayDz > 0 ? Math.atan(splayDz / Math.max(1, legBaseHeight)) : 0;
    const innerSpanX = length - legW - 2 * legInset; // 中心-中心
    const innerSpanZ = width - legD - 2 * legInset;
    const legEdgeX = length / 2 - legW / 2 - legInset;
    const legEdgeZ = width / 2 - legD / 2 - legInset;

    const lowerCenterY = lowerY + lowerW / 2;
    const lowerBotY = lowerY;
    const lowerTopY = lowerY + lowerW;
    const shiftAt = (yMm: number) => legBaseHeight > 0 ? Math.max(0, 1 - yMm / legBaseHeight) : 0;
    const sCenter = shiftAt(lowerCenterY);
    const sBot = shiftAt(lowerBotY);
    const sTop = shiftAt(lowerTopY);
    const splayXc = splayDx * sCenter;
    const splayZc = splayDz * sCenter;
    const splayXt = splayDx * sTop;
    const splayZt = splayDz * sTop;
    const splayXb = splayDx * sBot;
    const splayZb = splayDz * sBot;
    const lwC = legW * legScaleAt(lowerCenterY, legBaseHeight, bottomScale);
    const lwT = legW * legScaleAt(lowerTopY, legBaseHeight, bottomScale);
    const lwB = legW * legScaleAt(lowerBotY, legBaseHeight, bottomScale);
    const ldC = legD * legScaleAt(lowerCenterY, legBaseHeight, bottomScale);
    const ldT = legD * legScaleAt(lowerTopY, legBaseHeight, bottomScale);
    const ldB = legD * legScaleAt(lowerBotY, legBaseHeight, bottomScale);

    type SideDef = {
      key: string; nameZh: string; visibleLength: number;
      axis: "x" | "z"; sx: number; sz: number;
      origin: { x: number; z: number };
    };
    const sides: SideDef[] = [
      { key: "front", nameZh: "前下橫撐", visibleLength: innerSpanX - lwC + 2 * splayXc, axis: "x", sx: 0, sz: -1, origin: { x: 0, z: -(legEdgeZ + splayZc) } },
      { key: "back",  nameZh: "後下橫撐", visibleLength: innerSpanX - lwC + 2 * splayXc, axis: "x", sx: 0, sz: 1,  origin: { x: 0, z: legEdgeZ + splayZc } },
      { key: "left",  nameZh: "左下橫撐", visibleLength: innerSpanZ - ldC + 2 * splayZc, axis: "z", sx: -1, sz: 0, origin: { x: -(legEdgeX + splayXc), z: 0 } },
      { key: "right", nameZh: "右下橫撐", visibleLength: innerSpanZ - ldC + 2 * splayZc, axis: "z", sx: 1, sz: 0,  origin: { x: legEdgeX + splayXc, z: 0 } },
    ];

    const buildLowerPart = (s: SideDef): Part => {
      const halfX_C = legEdgeX + splayXc - lwC / 2;
      const halfX_T = legEdgeX + splayXt - lwT / 2;
      const halfX_B = legEdgeX + splayXb - lwB / 2;
      const halfZ_C = legEdgeZ + splayZc - ldC / 2;
      const halfZ_T = legEdgeZ + splayZt - ldT / 2;
      const halfZ_B = legEdgeZ + splayZb - ldB / 2;
      const hasShapeBend = splayDx > 0 || splayDz > 0 || bottomScale !== 1;
      const trapTopScale =
        s.axis === "x" && hasShapeBend ? halfX_T / halfX_C
        : s.axis === "z" && hasShapeBend ? halfZ_T / halfZ_C
        : null;
      const trapBotScale =
        s.axis === "x" && hasShapeBend ? halfX_B / halfX_C
        : s.axis === "z" && hasShapeBend ? halfZ_B / halfZ_C
        : 1;
      // 下橫撐 trapezoid 是腳幾何要求（端面縮到腳寬避免縫），但不 bevel
      const partShape = trapTopScale !== null
        ? { kind: "apron-trapezoid" as const, topLengthScale: trapTopScale, bottomLengthScale: trapBotScale }
        : legEdgeShape(stretcherEdge, stretcherEdgeStyle);
      const lsType: "through-tenon" | "blind-tenon" =
        lowerTenonType === "through-tenon" ? "through-tenon" : "blind-tenon";
      return {
        id: `ls-${s.key}`,
        nameZh: s.nameZh,
        material,
        grainDirection: "length",
        visible: { length: s.visibleLength, width: lowerW, thickness: lowerT },
        origin: { x: s.origin.x, y: lowerY, z: s.origin.z },
        rotation: s.axis === "z"
          ? { x: Math.PI / 2, y: Math.PI / 2, z: s.sx * tiltX }
          : { x: Math.PI / 2 + (-s.sz) * tiltZ, y: 0, z: 0 },
        shape: partShape,
        tenons: (() => {
          if (!lowerCanHalfStagger) {
            const mk = (position: "start" | "end") => ({
              position,
              type: lsType,
              length: lowerTenon,
              width: lowerTenonW,
              thickness: lowerTenonThick,
              shoulderOn: [...lowerTenonStd.shoulderOn] as Array<"top" | "bottom" | "left" | "right">,
            });
            return [mk("start"), mk("end")];
          }
          // 半榫錯位：靜止 X（前後）= 下榫；移動 Z（左右）= 上榫
          const isUpper = s.axis === "z";
          const tenonH = isUpper ? lowerUpperTenonH : lowerLowerTenonH;
          const worldOffset = isUpper ? lowerUpperTenonOffset : lowerLowerTenonOffset;
          const shoulderOn: Array<"top" | "bottom" | "left" | "right"> = ["left", "right"];
          const mk = (position: "start" | "end") => ({
            position,
            type: lsType,
            length: lowerTenon,
            width: tenonH,
            thickness: lowerTenonThick,
            shoulderOn,
            offsetWidth: -worldOffset,
          });
          return [mk("start"), mk("end")];
        })(),
        mortises: [],
      };
    };

    // 順便給 4 椅腳補下橫撐母榫眼（靜止 X 面=下榫；移動 Z 面=上榫）
    const lsXCenterY = lowerY + lowerW / 2;
    const lsZCenterY = lsXCenterY + lowerStretcherStaggerMm;
    const lsThrough = lowerTenonType === "through-tenon";
    const stretcherSidesUsed = new Set<string>();
    if (stretcherStyle === "box") ["front","back","left","right"].forEach(k => stretcherSidesUsed.add(k));
    else if (stretcherStyle === "side-only") ["left","right"].forEach(k => stretcherSidesUsed.add(k));
    else if (stretcherStyle === "h-frame") ["left","right"].forEach(k => stretcherSidesUsed.add(k));
    const needZFace = stretcherSidesUsed.has("left") || stretcherSidesUsed.has("right");
    const needXFace = stretcherSidesUsed.has("front") || stretcherSidesUsed.has("back");
    for (const leg of legs) {
      const cx = leg.origin.x;
      const cz = leg.origin.z;
      if (lowerCanHalfStagger) {
        if (needZFace) {
          leg.mortises.push({
            origin: { x: 0, y: lsZCenterY + lowerUpperTenonOffset, z: cz > 0 ? -1 : 1 },
            depth: lowerTenon,
            length: lowerUpperTenonH,
            width: lowerTenonThick,
            through: lsThrough,
          });
        }
        if (needXFace) {
          leg.mortises.push({
            origin: { x: cx > 0 ? -1 : 1, y: lsXCenterY + lowerLowerTenonOffset, z: 0 },
            depth: lowerTenon,
            length: lowerLowerTenonH,
            width: lowerTenonThick,
            through: lsThrough,
          });
        }
      } else {
        if (needZFace) {
          leg.mortises.push({
            origin: { x: 0, y: lsZCenterY, z: cz > 0 ? -1 : 1 },
            depth: lowerTenon,
            length: lowerTenonW,
            width: lowerTenonThick,
            through: lsThrough,
          });
        }
        if (needXFace) {
          leg.mortises.push({
            origin: { x: cx > 0 ? -1 : 1, y: lsXCenterY, z: 0 },
            depth: lowerTenon,
            length: lowerTenonW,
            width: lowerTenonThick,
            through: lsThrough,
          });
        }
      }
    }

    const sideMap: Record<string, SideDef> = Object.fromEntries(sides.map(s => [s.key, s]));
    if (stretcherStyle === "box") {
      ["front", "back", "left", "right"].forEach(k => lowerStretchers.push(buildLowerPart(sideMap[k])));
    } else if (stretcherStyle === "side-only") {
      ["left", "right"].forEach(k => lowerStretchers.push(buildLowerPart(sideMap[k])));
    } else if (stretcherStyle === "h-frame") {
      ["left", "right"].forEach(k => lowerStretchers.push(buildLowerPart(sideMap[k])));
      // 中央橫撐：跨左右側橫撐 inner face；左右側橫撐中心 X = ±(legEdgeX + splayXc)，厚度 lowerT
      const sideCenterX = legEdgeX + splayXc;
      const midBodyLen = Math.max(50, 2 * sideCenterX - lowerT);
      lowerStretchers.push({
        id: "ls-center",
        nameZh: "中央連接橫撐",
        material,
        grainDirection: "length",
        visible: { length: midBodyLen, width: lowerW, thickness: lowerT },
        origin: { x: 0, y: lowerY, z: 0 },
        rotation: { x: Math.PI / 2, y: 0, z: 0 },
        tenons: [
          { position: "start", type: "blind-tenon", length: Math.min(12, lowerTenon), width: lowerTenonW, thickness: lowerTenonThick },
          { position: "end", type: "blind-tenon", length: Math.min(12, lowerTenon), width: lowerTenonW, thickness: lowerTenonThick },
        ],
        mortises: [],
      });
    }
  }

  // 椅背部件——依 backStyle 生成（backZonHeight 已在頂部宣告）
  const backParts: Part[] = [];
  // 軸心對齊：slat / splat / spindle / curved-splat 中心 z 跟 apron 中心 z 對齊
  // apron z = width/2 - legD/2 - legInset，所以 backZ 也要扣 legInset
  // 軸心對齊背柱：連做模式背柱 = 後腳位置（z 受 legInset 影響）；分離模式背柱
  // 用 backPostBaseZ（不受 legInset 影響）。slat / splat / spindle 必須跟背柱同 z。
  const backZ = isContinuous
    ? width / 2 - legD / 2 - legInset - backInsetFromRearMm
    : width / 2 - legD / 2 - backInsetFromRearMm;
  const backUsableLengthOffset = 2 * backInsetFromEndMm;
  // 一木連做：座板已縮回（不會跟背直立件穿模），slat/splat/spindle 可以
  // 延伸到後牙板頂緣 = apronY + apronWidth；split 模式維持原 seatHeight 起算
  const backStartY = isContinuous ? (apronY + apronWidth) : seatHeight;
  const backSpan = isContinuous ? (topRailY - (apronY + apronWidth)) : backZonHeight;
  // 椅面彎曲時，座面在 x 處的下凹量（face-rounded bendAxis="y" 公式）
  // 把 back parts 的 bottom 跟著座面下降，避免懸空
  const seatHx = length / 2;
  const seatBendDipAt = (x: number): number => {
    if (seatBendMm <= 0) return 0;
    const t = seatHx > 0 ? x / seatHx : 0;
    return seatBendMm * Math.max(0, 1 - t * t);
  };
  if (backStyle === "slats" && slatCount > 0) {
    const availableWidth = length - legW - 40 - backUsableLengthOffset;
    const slotPitch = availableWidth / (slatCount + 1);
    for (let i = 0; i < slatCount; i++) {
      const xCenter = -availableWidth / 2 + slotPitch * (i + 1);
      const dip = seatBendDipAt(xCenter);
      backParts.push({
        id: `back-slat-${i + 1}`,
        nameZh: `椅背板條 ${i + 1}`,
        material,
        grainDirection: "length",
        visible: { length: backSpan + dip, width: slatWidth, thickness: slatThickness },
        origin: { x: xCenter, y: backStartY - dip, z: backZ },
        // 軸心對齊：slat 寬面 (slatWidth=50) 朝前後，厚面 (slatThickness=18) 朝
        // 左右深度——這樣 slat 中心 z 跟牙板中心 z 對齊（牙板厚 20 也是窄面）
        rotation: { x: Math.PI / 2, y: 0, z: Math.PI / 2 },
        tenons: [
          { position: "start", type: "blind-tenon", length: 15, width: Math.max(10, slatWidth - Math.round(slatWidth / 4)), thickness: Math.max(5, Math.round(slatThickness / 3)) },
          { position: "end", type: "blind-tenon", length: 15, width: Math.max(10, slatWidth - Math.round(slatWidth / 4)), thickness: Math.max(5, Math.round(slatThickness / 3)) },
        ],
        mortises: [],
      });
    }
  } else if (backStyle === "ladder") {
    // N 根水平橫木，均勻分佈於 seatHeight → topRailY 之間
    const rungWidth = 55;
    const rungThickness = 18;
    // rungBodyLen 應該 = 兩支背柱 inner-to-inner 距離（中間跨越，端面對接背柱內緣）
    // 背柱中心 X = ±(length/2 - legW/2 - legInset[*split時還要-backInsetFromEndMm])
    // 內面 = 中心 ∓ legW/2，inner-to-inner = length - 2*legW - 2*legInset - 2*backInsetFromEndMm
    const rungBodyLen = length - 2 * legW - 2 * legInset - 2 * backInsetFromEndMm;
    const rungTenonThick = Math.max(5, Math.round(rungThickness / 3));
    const rungTenonW = Math.max(12, rungWidth - 2 * MIN_SHOULDER);
    for (let i = 0; i < ladderRungs; i++) {
      const y = seatHeight + ((i + 1) * backZonHeight) / (ladderRungs + 1) - rungWidth / 2;
      backParts.push({
        id: `back-rung-${i + 1}`,
        nameZh: `椅背橫檔 ${i + 1}`,
        material,
        grainDirection: "length",
        visible: { length: rungBodyLen, width: rungWidth, thickness: rungThickness },
        origin: { x: 0, y, z: backZ },
        rotation: { x: Math.PI / 2, y: 0, z: 0 },
        tenons: [
          { position: "start", type: "blind-tenon", length: apronTenonLen, width: rungTenonW, thickness: rungTenonThick },
          { position: "end", type: "blind-tenon", length: apronTenonLen, width: rungTenonW, thickness: rungTenonThick },
        ],
        mortises: [],
      });
    }
  } else if (backStyle === "splat") {
    // 中央單片寬板：直立 + 寬面朝前後
    // rotation (π/2, 0, π/2) 做循環置換：length→Y vertical, width→X 左右, thickness→Z 深度
    const splatThickness = 18;
    const splatDip = seatBendDipAt(0);
    backParts.push({
      id: "back-splat",
      nameZh: "椅背中板",
      material,
      grainDirection: "length",
      visible: { length: backSpan + splatDip, width: splatWidth, thickness: splatThickness },
      origin: { x: 0, y: backStartY - splatDip, z: backZ },
      rotation: { x: Math.PI / 2, y: 0, z: Math.PI / 2 },
      tenons: [
        { position: "start", type: "blind-tenon", length: 15, width: Math.max(12, splatWidth - 20), thickness: Math.max(5, Math.round(splatThickness / 3)) },
        { position: "end", type: "blind-tenon", length: 15, width: Math.max(12, splatWidth - 20), thickness: Math.max(5, Math.round(splatThickness / 3)) },
      ],
      mortises: [],
    });
  } else if (backStyle === "windsor") {
    // Windsor spindle：6 支圓棒（直徑 18mm）由座板上方插入頂橫木
    const spindleCount = 6;
    const spindleDia = 18;
    const availableWidth = length - legW - 60 - backUsableLengthOffset;
    const slotPitch = availableWidth / (spindleCount + 1);
    for (let i = 0; i < spindleCount; i++) {
      const xCenter = -availableWidth / 2 + slotPitch * (i + 1);
      const dip = seatBendDipAt(xCenter);
      backParts.push({
        id: `back-spindle-${i + 1}`,
        nameZh: `椅背圓棒 ${i + 1}`,
        material,
        grainDirection: "length",
        visible: { length: spindleDia, width: spindleDia, thickness: backSpan + dip },
        origin: { x: xCenter, y: backStartY - dip, z: backZ },
        shape: { kind: "round" },
        tenons: [
          { position: "top", type: "blind-tenon", length: 15, width: Math.round(spindleDia * 0.6), thickness: Math.round(spindleDia * 0.6) },
          { position: "bottom", type: "blind-tenon", length: 15, width: Math.round(spindleDia * 0.6), thickness: Math.round(spindleDia * 0.6) },
        ],
        mortises: [],
      });
    }
  } else if (backStyle === "curved-splat") {
    // 曲面中板：較厚（25mm），寬度由 curvedSplatWidth 設定，bendMm 控制凹陷深度
    const cThickness = 25;
    const cWidth = curvedSplatWidth;
    const cDip = seatBendDipAt(0);
    backParts.push({
      id: "back-curved-splat",
      nameZh: "椅背曲面中板",
      material,
      grainDirection: "length",
      visible: { length: backSpan + cDip, width: cWidth, thickness: cThickness },
      origin: { x: 0, y: backStartY - cDip, z: backZ },
      rotation: { x: Math.PI / 2, y: 0, z: Math.PI / 2 },
      // 大面凹陷：thickness 才是薄軸，所以 bendAxis="y"；正值往背面凹、負值往前凸
      shape: { kind: "face-rounded", cornerR: 0, bendMm: curvedSplatBendMm, bendAxis: "y" },
      tenons: [
        { position: "start", type: "blind-tenon", length: 15, width: Math.max(12, cWidth - 20), thickness: Math.max(5, Math.round(cThickness / 3)) },
        { position: "end", type: "blind-tenon", length: 15, width: Math.max(12, cWidth - 20), thickness: Math.max(5, Math.round(cThickness / 3)) },
      ],
      mortises: [],
    });
  }
  const slats = backParts; // 向下相容：後面 parts 陣列仍引用 slats 變數

  // ---- 椅背後仰 (backRake) ----
  // 所有椅背部件繞 (seatHeight, backZ) X 軸傾斜 reclineRad
  const reclineRad = (backRake * Math.PI) / 180;
  if (Math.abs(reclineRad) > 1e-6) {
    // 折角型：傾斜後背柱底面前緣會抬高 (legD/2)·sin(rake)，產生縫隙。
    // 預先把背柱往下延長 Δ = (legD/2)·tan(rake) → 傾斜後前緣剛好落在 seatHeight，
    // 後緣下沉進後腳 AABB 內（折角內側本來就重疊，視覺被遮）。頂端不變。
    const isBent = rearPostMode === "continuous-bent";
    if (isBent) {
      const overshoot = (legD / 2) * Math.abs(Math.tan(reclineRad));
      for (let i = 0; i < backPosts.length; i++) {
        const bp = backPosts[i];
        backPosts[i] = {
          ...bp,
          origin: { ...bp.origin, y: bp.origin.y - overshoot },
          visible: { ...bp.visible, thickness: bp.visible.thickness + overshoot },
        };
      }
    }
    const cosR = Math.cos(reclineRad);
    const sinR = Math.sin(reclineRad);
    const yExtOf = (p: Part): number => {
      // back-rung: rotation x:π/2 → width 垂直
      if (p.id.startsWith("back-rung-")) return p.visible.width;
      // slat / splat / curved-splat: rotation 讓 length 垂直
      if (p.id.startsWith("back-slat-") || p.id === "back-splat" || p.id === "back-curved-splat") return p.visible.length;
      // back-post / back-top-rail / back-spindle: thickness 垂直
      return p.visible.thickness;
    };
    const tilt = (p: Part): Part => {
      const yExt = yExtOf(p);
      const cy = p.origin.y + yExt / 2;
      const cz = p.origin.z;
      const dy = cy - seatHeight;
      const dz = cz - backZ;
      const newCy = seatHeight + dy * cosR - dz * sinR;
      const newCz = backZ + dy * sinR + dz * cosR;
      // 加 world-X 旋轉 reclineRad（renderer Euler order = ZYX intrinsic）：
      // - 若 existing Rz ≈ π/2（slat/splat/curved-splat）→ 等效解 rotation.y -= rx
      //   （推導：Rx_world(rx) * Rz(π/2) = ZYX(0, -rx, π/2)；splat 的 Rx 保留）
      // - 否則直接加到 rotation.x（無 Z rot 的情形：post/rail/rung/spindle）
      const ex = p.rotation?.x ?? 0;
      const ey = p.rotation?.y ?? 0;
      const ez = p.rotation?.z ?? 0;
      const hasZQuarter = Math.abs(Math.abs(ez) - Math.PI / 2) < 0.01;
      // 中板（splat / curved-splat）跳過 clamp——讓底端真的貼座面，傾斜時
      // bottom-back corner 自然下沉進座板 AABB（視覺被座板遮住，不影響）。
      // 沒這個 skip 中板會被推高 wHalf×sin(rake) 並砍掉等量長度，3D 看到上下都有縫。
      // 一木連做折角型：背柱底端要跟後腳頂端在折角點對接，不能 clamp 上抬，
      // 否則折角處會有 wHalf×sin(rake) 的縫隙；slat / top-rail 也跟著一起傾斜
      const skipClamp = p.id === "back-splat" || p.id === "back-curved-splat" || isBent;
      // 錨在座面上的部件，傾斜後 bottom corner 要 ≥ seatHeight（避免與 seat AABB 重疊）
      const wHalf = p.visible.width / 2;
      const extraLift = hasZQuarter ? wHalf * Math.abs(sinR) : 0;
      const yLowerBound = skipClamp ? -Infinity : seatHeight + extraLift;
      const rawOriginY = newCy - yExt / 2;
      const isSeatAnchored = p.origin.y >= seatHeight - 0.01;
      const clampedOriginY = isSeatAnchored ? Math.max(yLowerBound, rawOriginY) : rawOriginY;
      // clamp 把 slat 抬高的量 → 同步從 length / thickness（垂直軸）扣掉，避免頂端撞到 top-rail
      const liftedBy = clampedOriginY - rawOriginY;
      let newVisible = p.visible;
      if (liftedBy > 0.01) {
        // back-rung 用 width 為 yExt；slat/splat/curved-splat 用 length；其他用 thickness
        if (p.id.startsWith("back-rung-")) {
          newVisible = { ...p.visible, width: Math.max(1, p.visible.width - liftedBy) };
        } else if (p.id.startsWith("back-slat-") || p.id === "back-splat" || p.id === "back-curved-splat") {
          newVisible = { ...p.visible, length: Math.max(1, p.visible.length - liftedBy) };
        } else {
          newVisible = { ...p.visible, thickness: Math.max(1, p.visible.thickness - liftedBy) };
        }
      }
      return {
        ...p,
        visible: newVisible,
        origin: { x: p.origin.x, y: clampedOriginY, z: newCz },
        rotation: hasZQuarter
          ? { x: ex, y: ey - reclineRad, z: ez }
          : { x: ex + reclineRad, y: ey, z: ez },
      };
    };
    // 椅背是剛性框架：後柱、上橫條、slat / splat / spindle 全部一起繞 (seatHeight, backZ)
    // 傾斜，不論 split / 直料 / 折角型。Z 軸對齊靠 backZ 公式（= apron z），不是靠「不轉」。
    for (let i = 0; i < backPosts.length; i++) backPosts[i] = tilt(backPosts[i]);
    backTopRail = tilt(backTopRail);
    for (let i = 0; i < backParts.length; i++) backParts[i] = tilt(backParts[i]);
  }

  const design: FurnitureDesign = {
    id: `dining-chair-${length}x${width}x${height}`,
    category: "dining-chair",
    nameZh: "餐椅",
    overall: { length, width, thickness: height },
    parts: [seatPanel, ...legs, ...backPosts, ...aprons, ...lowerStretchers, backTopRail, ...slats, ...armrestParts],
    defaultJoinery: "blind-tenon",
    useButtJointConvention: true,
    primaryMaterial: material,
    notes:
      `腳樣式：${legShapeLabel(legShape)}。前椅腳通榫接座板；後椅腳延伸成椅背支柱；牙板與椅腳半榫；椅背板條上下半榫接頂橫木與後牙板。` +
      ` ${backRakeNote(backRake)} ${seatEdgeNote(seatEdge, seatEdgeStyle)}${legEdgeNote(legEdge, legEdgeStyle)}${stretcherEdgeNote(stretcherEdge, stretcherEdgeStyle)}` +
      (seatProfileNote(seatProfile) ? ` ${seatProfileNote(seatProfile)}` : "") +
      (seatFrontWaterfall ? " 座板前緣 R25 大圓化（waterfall edge），減少對大腿後側壓迫。" : "") +
      (backStyle === "windsor" ? " Windsor spindle 椅背：5-7 支車旋圓棒由座板上緣插入頂橫木。" : "") +
      (backStyle === "curved-splat" ? " 曲面中板：中央單片寬板用蒸彎木 R600 弧度成型，貼合背部曲線。" : "") +
      (withArmrest ? ` 加扶手：扶手前端接前腳上方加高柱（${armrestHeight}mm 處），後端半榫接後腳。會增加 4 件零件 + 2-3 小時工時。` : "") +
      " 後腳於圖面以直料呈現，實作建議依樣板鋸出 10–15° 後仰曲線以提升坐感。",
  };
  applyStandardChecks(design, {
    minLength: 350, minWidth: 350, minHeight: 700,
    maxLength: 600, maxWidth: 650, maxHeight: 1100,
  });
  return design;
};
