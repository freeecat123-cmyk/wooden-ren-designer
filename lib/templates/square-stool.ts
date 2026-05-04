import type {
  FurnitureDesign,
  FurnitureTemplate,
  OptionSpec,
  Part,
} from "@/lib/types";
import { getOption, opt } from "@/lib/types";
import { corners, rectLegShape, RECT_LEG_SHAPE_CHOICES, seatEdgeOption, seatEdgeStyleOption, seatEdgeNote, seatEdgeShape, seatProfileOption, seatProfileNote, seatScoopShape, legEdgeOption, legEdgeStyleOption, legEdgeShape, legEdgeNote, stretcherEdgeOption, stretcherEdgeStyleOption, stretcherEdgeNote, legShapeLabel, parseLegChamferMm, legBottomScale, legScaleAt } from "./_helpers";
import { applyStandardChecks, validateStoolStructure, appendWarnings, appendSuggestion } from "./_validators";
import { LOWER_STRETCHER_HEIGHT_RATIO } from "./_constants";
import { SPLAY_ANGLE } from "@/lib/knowledge/chair-geometry";
import { standardTenon, autoTenonType } from "@/lib/joinery/standards";

export const squareStoolOptions: OptionSpec[] = [
  { group: "leg", type: "select", key: "legShape", label: "腳樣式", defaultValue: "box", choices: RECT_LEG_SHAPE_CHOICES },
  { group: "leg", type: "number", key: "legSize", label: "腳粗 (mm)", defaultValue: 35, min: 20, max: 120, step: 1, unit: "mm" },
  { group: "leg", type: "number", key: "legInset", label: "腳內縮 (mm)", defaultValue: 0, min: 0, max: 200, step: 5, unit: "mm", help: "腳中心離座板邊緣的內縮量。> 0 讓座板外伸、視覺更俐落" },
  { group: "leg", type: "number", key: "splayAngle", label: "外斜角度 (°)", defaultValue: SPLAY_ANGLE.stoolDefaultDeg, min: 1, max: SPLAY_ANGLE.stoolMaxDeg, step: 0.5, unit: "°", help: `斜腳系列才有效——從垂直起算的外傾角度。預設 ${SPLAY_ANGLE.stoolDefaultDeg}° 適度外斜；10° 起明顯誇張（北歐風)；${SPLAY_ANGLE.stoolMaxDeg}° 極限` },
  legEdgeOption("leg", 0),
  legEdgeStyleOption("leg"),
  { group: "top", type: "number", key: "seatThickness", label: "座板厚 (mm)", defaultValue: 25, min: 12, max: 60, step: 1, unit: "mm" },
  seatEdgeOption("top", 5),
  seatEdgeStyleOption("top"),
  seatProfileOption("top"),
  { group: "top", type: "number", key: "seatBendMm", label: "椅面彎曲 (mm)", defaultValue: 0, min: 0, max: 25, step: 1, help: "整片椅面像彎合板那樣彎曲，中間下凹比較好坐；四角榫眼位置不受影響。>0 會覆蓋鞍形 / 邊緣 profile" },
  { group: "apron", type: "number", key: "apronWidth", label: "橫撐高度 (mm)", defaultValue: 60, min: 30, max: 200, step: 5, unit: "mm" },
  { group: "apron", type: "number", key: "apronThickness", label: "橫撐厚度 (mm)", defaultValue: 20, min: 10, max: 50, step: 1, unit: "mm" },
  { group: "apron", type: "number", key: "apronDropFromTop", label: "橫撐距座板 (mm)", defaultValue: 12, min: 0, max: 400, step: 5, unit: "mm", help: "橫撐頂面距座板下緣的距離；小凳子建議 10–15 才不會頭重腳輕" },
  { group: "apron", type: "number", key: "apronStaggerMm", label: "牙板錯開 (mm)", defaultValue: 0, min: 0, max: 80, step: 2, unit: "mm", help: "左右牙板相對前後牙板下移量。0 = 等高（系統自動上下半榫避免穿模）；> 牙板高 +2 = 視覺錯開、用整榫" },
  { group: "apron", type: "checkbox", key: "legPenetratingTenon", label: "腳上榫頭通透（明榫裝飾）", defaultValue: false, help: "勾選：牙板/下橫撐進腳改通榫（榫頭穿透到腳另一面），明式裝飾感；未勾：依母件厚度自動規則（≤25mm 通榫、>25mm 盲榫深度=厚度2/3）" },
  { group: "stretcher", type: "checkbox", key: "withLowerStretcher", label: "加下橫撐", defaultValue: true, help: "在腳下方 1/4 高加一圈橫撐，結構更穩；傳統方凳必備（取消勾選 = 簡約款）" },
  { group: "stretcher", type: "select", key: "lowerStretcherStyle", label: "下橫撐樣式", defaultValue: "h-frame", choices: [
    { value: "h-frame", label: "H 字形（4 條繞 1 圈，最穩）" },
    { value: "x-cross", label: "X 字交叉（2 條斜撐穿越中心，明清交杌做法）" },
  ], dependsOn: { key: "withLowerStretcher", equals: true } },
  { group: "stretcher", type: "number", key: "lowerStretcherWidth", label: "下橫撐高 (mm)", defaultValue: 40, min: 20, max: 150, step: 5, unit: "mm", dependsOn: { key: "withLowerStretcher", equals: true } },
  { group: "stretcher", type: "number", key: "lowerStretcherThickness", label: "下橫撐厚 (mm)", defaultValue: 20, min: 10, max: 50, step: 1, unit: "mm", dependsOn: { key: "withLowerStretcher", equals: true } },
  { group: "stretcher", type: "number", key: "lowerStretcherHeight", label: "下橫撐離地高 (mm)", defaultValue: 0, min: 0, max: 700, step: 10, unit: "mm", help: "0 = 自動（腳高的 22%）", dependsOn: { key: "withLowerStretcher", equals: true } },
  { group: "stretcher", type: "number", key: "lowerStretcherStaggerMm", label: "下橫撐錯開 (mm)", defaultValue: 0, min: 0, max: 80, step: 2, unit: "mm", help: "左右下橫撐相對前後下橫撐下移量。0 = 等高（系統自動上下半榫避免穿模）；> 下橫撐高 +2 = 視覺錯開、用整榫", dependsOn: { key: "withLowerStretcher", equals: true } },
  stretcherEdgeOption("stretcher", 0),
  stretcherEdgeStyleOption("stretcher"),
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

  const o = squareStoolOptions;
  const legShape = getOption<string>(input, opt(o, "legShape"));
  const legSize = getOption<number>(input, opt(o, "legSize"));
  const legInset = getOption<number>(input, opt(o, "legInset"));
  const splayAngle = getOption<number>(input, opt(o, "splayAngle"));
  const legEdge = getOption<string>(input, opt(o, "legEdge"));
  const legEdgeStyle = getOption<string>(input, opt(o, "legEdgeStyle"));
  const seatThickness = getOption<number>(input, opt(o, "seatThickness"));
  const seatEdge = getOption<string>(input, opt(o, "seatEdge"));
  const seatEdgeStyle = getOption<string>(input, opt(o, "seatEdgeStyle"));
  const seatProfile = getOption<string>(input, opt(o, "seatProfile"));
  const seatBendMm = getOption<number>(input, opt(o, "seatBendMm"));
  const stretcherEdge = getOption<string>(input, opt(o, "stretcherEdge"));
  const stretcherEdgeStyle = getOption<string>(input, opt(o, "stretcherEdgeStyle"));
  const apronWidth = getOption<number>(input, opt(o, "apronWidth"));
  const apronThickness = getOption<number>(input, opt(o, "apronThickness"));
  const apronDropFromTop = getOption<number>(input, opt(o, "apronDropFromTop"));
  const apronStaggerMm = getOption<number>(input, opt(o, "apronStaggerMm"));
  const legPenetratingTenon = getOption<boolean>(input, opt(o, "legPenetratingTenon"));
  const withLowerStretcher = getOption<boolean>(input, opt(o, "withLowerStretcher"));
  const lowerStretcherStyle = getOption<string>(input, opt(o, "lowerStretcherStyle"));
  const lowerStretcherWidth = getOption<number>(input, opt(o, "lowerStretcherWidth"));
  const lowerStretcherThickness = getOption<number>(input, opt(o, "lowerStretcherThickness"));
  const lowerStretcherHeightOpt = getOption<number>(input, opt(o, "lowerStretcherHeight"));
  const lowerStretcherStaggerMm = getOption<number>(input, opt(o, "lowerStretcherStaggerMm"));

  const legHeight = height - seatThickness;

  // 直榫標準（drafting-math.md §B2）：榫厚 = 公件厚 / 3、肩寬固定 5mm 4 邊全肩、
  // 盲榫長 = round(2/3 × 母厚, ≥25mm)、通榫長 = 母厚。
  // 自動類型規則：母厚 ≤ 25mm → 通榫；> 25mm → 盲榫
  // legPenetratingTenon = true 時強制牙板/下橫撐進腳通榫（明榫裝飾）

  // 1) leg ↔ seat：腳頂進座板，依自動規則（座板薄通榫、厚盲榫）
  const legTopTenonType = autoTenonType(seatThickness);
  const legTenonStd = standardTenon({
    type: legTopTenonType,
    childThickness: legSize,
    childWidth: legSize,
    motherThickness: seatThickness,
  });
  // 2) apron ↔ leg：依自動規則 + legPenetratingTenon override
  const apronTenonType = legPenetratingTenon ? "through-tenon" : autoTenonType(legSize);
  const apronTenonStd = standardTenon({
    type: apronTenonType === "through-tenon" ? "through-tenon" : "shouldered-tenon",
    childThickness: apronThickness,
    childWidth: apronWidth,
    motherThickness: legSize,
  });
  const apronTenonLength = apronTenonStd.length;
  const apronTenonThick = apronTenonStd.thickness;
  const apronTenonW = apronTenonStd.width;
  // 牙板錯開策略：
  //   B（視覺錯開）: stagger >= apronTenonW + 2 → 左右牙板整支下移、用整榫頭
  //   A（半榫錯位）: 否則（含 stagger=0）→ 上下半榫，新省料規則：
  //     - 上榫保留 5mm 上肩、無下肩
  //     - 下榫貼下緣無下肩、無上肩
  //     - 兩榫中央接觸無間隙
  //     → 上榫高 = 下榫高 = (apronWidth - 5) / 2
  const apronVisuallyStaggered = apronStaggerMm >= apronTenonW + 2;
  const APRON_TOP_SHOULDER = 10;
  const apronTotalTenonH = apronWidth - APRON_TOP_SHOULDER;  // 上下榫合計高
  const apronCanHalfStagger = !apronVisuallyStaggered && apronTotalTenonH >= 16;
  const apronUpperTenonH = apronCanHalfStagger ? Math.floor(apronTotalTenonH / 2) : apronTenonW;
  const apronLowerTenonH = apronCanHalfStagger ? apronTotalTenonH - apronUpperTenonH : apronTenonW;
  // part-local：apron Y 從 0 (底) 到 apronWidth (頂)；牙板 mesh 中心 Y = apronWidth/2
  // 上榫中心 Y = (apronWidth - 上肩) - 上榫高/2；下榫中心 Y = 下榫高/2
  // offsetWidth = 該榫中心 - apronWidth/2
  const apronUpperTenonOffset = apronCanHalfStagger
    ? (apronWidth - APRON_TOP_SHOULDER - apronUpperTenonH / 2) - apronWidth / 2
    : 0;
  const apronLowerTenonOffset = apronCanHalfStagger
    ? apronLowerTenonH / 2 - apronWidth / 2
    : 0;

  // 腳頂榫朝家具中心偏（X 軸），讓 tenon 內側緣貼腳內緣（內側無肩）。
  // 只有 legInset === 0（腳貼座板邊緣）時才偏，避免座板外側木材太薄破裂。
  // 偏移量 = (legSize − tenonWidth) / 2 — tenon 內側緣 = 腳內緣，外側留 SHOULDER 肩。
  const legTopType = legTopTenonType === "through-tenon" ? "through-tenon" : "blind-tenon";
  const legTopInsetX = legInset === 0
    ? Math.max(0, Math.round((legSize - legTenonStd.width) / 2))
    : 0;

  const seatPanel: Part = {
    id: "seat",
    nameZh: "座板",
    material,
    grainDirection: "length",
    visible: { length, width, thickness: seatThickness },
    origin: { x: 0, y: legHeight, z: 0 },
    shape: seatBendMm > 0
      ? { kind: "face-rounded" as const, cornerR: 0, bendMm: -seatBendMm, bendAxis: "y" as const }
      : seatScoopShape(seatProfile) ?? seatEdgeShape(seatEdge, seatEdgeStyle, legInset > 0),
    tenons: [],
    mortises: [
      // 座板四角榫眼：通榫（座板薄）或盲榫（座板厚 > 25），depth 跟 tenon length 同步
      // legInset=0 時 X 軸 origin 朝家具中心偏 legTopInsetX，mortise 內側貼腳內緣
      // 盲榫時 mortise 從座板下緣開挖（origin.y=0，從底進入），不穿頂
      ...corners(length, width, legSize, legInset).map((c) => ({
        origin: {
          x: c.x - Math.sign(c.x) * legTopInsetX,
          y: 0,
          z: c.z,
        },
        depth: legTenonStd.length,
        length: legTenonStd.width,
        width: legTenonStd.thickness,
        through: legTopTenonType === "through-tenon",
      })),
    ],
  };

  // 4 隻凳腳
  const legs: Part[] = corners(length, width, legSize, legInset).map((c, i) => ({
    id: `leg-${i + 1}`,
    nameZh: `凳腳 ${i + 1}`,
    material,
    grainDirection: "length",
    visible: { length: legSize, width: legSize, thickness: legHeight },
    origin: { x: c.x, y: 0, z: c.z },
    // box 走 legEdgeShape；splayed/tapered 系列把 chamfer 帶入組合（cross-section 八邊形）
    // splayMm 由 splayAngle 換算：tan(angle) × legHeight
    shape: rectLegShape(legShape, c, {
      splayedFrontOnly: false,
      splayMm: Math.round(Math.tan((splayAngle * Math.PI) / 180) * legHeight),
      chamferMm: parseLegChamferMm(legEdge),
      chamferStyle: legEdgeStyle === "rounded" ? "rounded" : "chamfered",
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
      },
    ],
    // 凳腳內側 2 面要挖橫撐的半榫眼（中段，距離地面 1/3 處）
    mortises: legMortisesForApron(c, length, width, {
      apronTenonLength,
      apronUpperTenonH,
      apronLowerTenonH,
      apronUpperTenonOffset,
      apronLowerTenonOffset,
      apronTenonThick,
      apronVisualStaggerMm: apronVisuallyStaggered ? apronStaggerMm : 0,
      apronWidth,
      legHeight,
      apronDropFromTop,
      apronThrough: apronTenonType === "through-tenon",
    }),
  }));

  // 4 條橫撐（凳腳之間）—— butt-joint 慣例：visible.length 兩端剛好頂在
  // 腳的內側面，組裝版渲染就是 final 幾何（不重疊）。joinery 模式靠 tenon[]
  // 加切料長度，3D 不視覺延伸（榫頭只在材料單上展現）。
  //
  // tapered 腳補償（drafting-math.md §A11）：腳的 cross-section 隨 Y 線性
  // 變化，apron / stretcher 端面要對到 apron Y 處的「實際」腳內面，不能用
  // legSize 常數，會跟腳貼不齊。apronLegSize = legSize × legScaleAt(apronY)。
  const bottomScale = legBottomScale(legShape);
  // 外斜支援 3 種：對角 splayed、單向 splayed-length（只 X）、splayed-width（只 Z）
  // splayDx/splayDz 拆開計算，axis-aware 牙板補償
  // splayMm = tan(splayAngle) × legHeight，跟 rectLegShape 內部用一致的角度
  const splayMm = Math.round(Math.tan((splayAngle * Math.PI) / 180) * legHeight);
  const splayDx =
    legShape === "splayed" || legShape === "splayed-length" ? splayMm : 0;
  const splayDz =
    legShape === "splayed" || legShape === "splayed-width" ? splayMm : 0;
  const isSplayed = splayDx > 0 || splayDz > 0;
  const apronY = legHeight - apronWidth - apronDropFromTop;
  // 牙板上下緣：以「中軸 Y」算 splay 基準位移，讓牙板中軸跟腳中軸對齊。
  // top 邊縮、bot 邊放，bevelAngle 補償讓上下面切平（跟地面平行）。
  const apronCenterY = apronY + apronWidth / 2;
  const apronBotShift = legHeight > 0 ? 1 - apronY / legHeight : 0;
  const apronTopShift = legHeight > 0 ? 1 - (apronY + apronWidth) / legHeight : 0;
  const apronCenterShift = legHeight > 0 ? 1 - apronCenterY / legHeight : 0;
  const apronSplayX = splayDx * apronCenterShift;     // 中心 X 偏移（基準）
  const apronSplayZ = splayDz * apronCenterShift;
  const apronSplayXBot = splayDx * apronBotShift;
  const apronSplayZBot = splayDz * apronBotShift;
  const apronSplayXTop = splayDx * apronTopShift;
  const apronSplayZTop = splayDz * apronTopShift;
  const tiltX = splayDx > 0 ? Math.atan(splayDx / legHeight) : 0;
  const tiltZ = splayDz > 0 ? Math.atan(splayDz / legHeight) : 0;
  const apronEdgeZ = width / 2 - legSize / 2 - legInset;
  const apronEdgeX = length / 2 - legSize / 2 - legInset;
  // tapered 補償：apron 三條 Y 位置（中、上、下）各自的腳寬
  const apronLegSizeCenter = legSize * legScaleAt(apronCenterY, legHeight, bottomScale);
  const apronLegSizeTop = legSize * legScaleAt(apronY + apronWidth, legHeight, bottomScale);
  const apronLegSizeBot = legSize * legScaleAt(apronY, legHeight, bottomScale);
  const apronInnerSpan = {
    x: 2 * apronEdgeX - apronLegSizeCenter,
    z: 2 * apronEdgeZ - apronLegSizeCenter,
  };
  // butt-joint 半長：apronEdgeX/Z 是「腳中心」距家具中心的水平距離；
  // 端面對接時，apron 端面 = 腳內面（在 apron Y 處）= 腳中心 − apronLegSize/2 + splay。
  const buttHalfX = (splay: number) => apronEdgeX + splay - apronLegSizeCenter / 2;
  const buttHalfZ = (splay: number) => apronEdgeZ + splay - apronLegSizeCenter / 2;
  // 牙板上/下緣的腳寬（給 apron-trapezoid scale 用，端面跟著腳的傾斜)
  const buttHalfXTop = (splay: number) => apronEdgeX + splay - apronLegSizeTop / 2;
  const buttHalfXBot = (splay: number) => apronEdgeX + splay - apronLegSizeBot / 2;
  const buttHalfZTop = (splay: number) => apronEdgeZ + splay - apronLegSizeTop / 2;
  const buttHalfZBot = (splay: number) => apronEdgeZ + splay - apronLegSizeBot / 2;
  const apronSides = [
    { id: "apron-front", nameZh: "前橫撐", visibleLength: apronInnerSpan.x + 2 * apronSplayX, axis: "x" as const, sx: 0, sz: -1, origin: { x: 0, z: -(apronEdgeZ + apronSplayZ) } },
    { id: "apron-back", nameZh: "後橫撐", visibleLength: apronInnerSpan.x + 2 * apronSplayX, axis: "x" as const, sx: 0, sz: 1, origin: { x: 0, z: apronEdgeZ + apronSplayZ } },
    { id: "apron-left", nameZh: "左橫撐", visibleLength: apronInnerSpan.z + 2 * apronSplayZ, axis: "z" as const, sx: -1, sz: 0, origin: { x: -(apronEdgeX + apronSplayX), z: 0 } },
    { id: "apron-right", nameZh: "右橫撐", visibleLength: apronInnerSpan.z + 2 * apronSplayZ, axis: "z" as const, sx: 1, sz: 0, origin: { x: apronEdgeX + apronSplayX, z: 0 } },
  ];
  const aprons: Part[] = apronSides.map((s) => {
    // x 軸牙板（前/後）補 tiltZ；z 軸牙板（左/右）補 tiltX
    const bevelAngle = isSplayed
      ? s.axis === "x" ? -s.sz * tiltZ : -s.sx * tiltX
      : 0;
    // 同軸有 splay 或 tapered → 梯形：以中軸對齊腳中軸，top/bot 各自算 scale。
    // 用 butt-joint 半長（= 腳內面在 apron 對應 Y 處）算比例，含 taper 補償。
    const hasShapeBend = splayDx > 0 || splayDz > 0 || bottomScale !== 1;
    const trapTopScale =
      s.axis === "x" && hasShapeBend
        ? buttHalfXTop(apronSplayXTop) / buttHalfX(apronSplayX)
        : s.axis === "z" && hasShapeBend
          ? buttHalfZTop(apronSplayZTop) / buttHalfZ(apronSplayZ)
          : null;
    const trapBotScale =
      s.axis === "x" && hasShapeBend
        ? buttHalfXBot(apronSplayXBot) / buttHalfX(apronSplayX)
        : s.axis === "z" && hasShapeBend
          ? buttHalfZBot(apronSplayZBot) / buttHalfZ(apronSplayZ)
          : 1;
    const partShape = trapTopScale !== null
      ? { kind: "apron-trapezoid" as const, topLengthScale: trapTopScale, bottomLengthScale: trapBotScale, bevelAngle: bevelAngle || undefined }
      : isSplayed
        ? { kind: "apron-beveled" as const, bevelAngle }
        : legEdgeShape(stretcherEdge, stretcherEdgeStyle);
    return {
      id: s.id,
      nameZh: s.nameZh,
      material,
      grainDirection: "length" as const,
      visible: {
        length: s.visibleLength,
        width: apronWidth,
        thickness: apronThickness,
      },
      // 視覺錯開（B）時，左右（z 軸）牙板整支下移 apronStaggerMm
      origin: { x: s.origin.x, y: apronY - (apronVisuallyStaggered && s.axis === "z" ? apronStaggerMm : 0), z: s.origin.z },
      rotation: s.axis === "z"
        ? { x: Math.PI / 2, y: Math.PI / 2, z: s.sx * tiltX }
        : { x: Math.PI / 2 + (-s.sz) * tiltZ, y: 0, z: 0 },
      shape: partShape,
      // A 模式：X 向 = 上榫（保留上肩、無下肩），Z 向 = 下榫（無上下肩）
      // B 模式：整榫頭，4 邊全肩
      // type 依自動規則 / legPenetratingTenon 決定
      tenons: (() => {
        const tenonType: "through-tenon" | "shouldered-tenon" =
          apronTenonType === "through-tenon" ? "through-tenon" : "shouldered-tenon";
        if (!apronCanHalfStagger) {
          // B 或 stagger 不可用 → 整榫頭
          const mk = (position: "start" | "end") => ({
            position,
            type: tenonType,
            length: apronTenonLength,
            width: apronTenonW,
            thickness: apronTenonThick,
            shoulderOn: [...apronTenonStd.shoulderOn],
          });
          return [mk("start"), mk("end")];
        }
        // A 半榫錯位 — 新省料規則
        // X 向（前後牙板）= 上榫；Z 向（左右牙板）= 下榫
        const isUpper = s.axis === "x";
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
          length: apronTenonLength,
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

  const parts: Part[] = [seatPanel, ...legs, ...aprons];

  if (withLowerStretcher) {
    const lowerY = lowerStretcherHeightOpt > 0
      ? lowerStretcherHeightOpt
      : Math.round(legHeight * LOWER_STRETCHER_HEIGHT_RATIO);
    const lowerW = lowerStretcherWidth;
    const lowerT = lowerStretcherThickness;
    // 下橫撐 ↔ 凳腳：依自動規則 + legPenetratingTenon override
    const lowerTenonType = legPenetratingTenon ? "through-tenon" : autoTenonType(legSize);
    const lowerTenonStd = standardTenon({
      type: lowerTenonType,
      childThickness: lowerT,
      childWidth: lowerW,
      motherThickness: legSize,
    });
    const lowerTenon = lowerTenonStd.length;
    const lowerTenonThick = lowerTenonStd.thickness;
    const lowerTenonW = lowerTenonStd.width;
    // 下橫撐錯開策略：
    //   B（視覺錯開）: stagger >= lowerTenonW + 2 → 整榫頭
    //   A（半榫錯位）: 否則 → 上下半榫，新省料規則：
    //     - 上榫貼上緣（無上肩）、無下肩
    //     - 下榫貼下緣（無下肩）、無上肩
    //     - 兩榫中央接觸無間隙
    //     → 上榫高 = 下榫高 = lowerW / 2（整個橫撐高都是榫頭）
    const lowerVisuallyStaggered = lowerStretcherStaggerMm >= lowerTenonW + 2;
    const lowerCanHalfStagger = !lowerVisuallyStaggered && lowerW >= 16;
    const lowerUpperTenonH = lowerCanHalfStagger ? Math.floor(lowerW / 2) : lowerTenonW;
    const lowerLowerTenonH = lowerCanHalfStagger ? lowerW - lowerUpperTenonH : lowerTenonW;
    // part-local：lowerW 是 Y 軸高度，中心 = lowerW/2
    // 上榫中心 Y = lowerW - lowerUpperTenonH/2，offset = lowerW/2 - lowerUpperTenonH/2
    const lowerUpperTenonOffset = lowerCanHalfStagger ? (lowerW / 2 - lowerUpperTenonH / 2) : 0;
    const lowerLowerTenonOffset = lowerCanHalfStagger ? (lowerLowerTenonH / 2 - lowerW / 2) : 0;
    // 下橫撐：以中軸對齊腳中軸，top/bot 都從中心向外/向內推
    const lsCenterY = lowerY + lowerW / 2;
    const lsBotShift = legHeight > 0 ? 1 - lowerY / legHeight : 0;
    const lsTopShift = legHeight > 0 ? 1 - (lowerY + lowerW) / legHeight : 0;
    const lsCenterShift = legHeight > 0 ? 1 - lsCenterY / legHeight : 0;
    const lsSplayX = splayDx * lsCenterShift;     // 中心
    const lsSplayZ = splayDz * lsCenterShift;
    const lsSplayXBot = splayDx * lsBotShift;
    const lsSplayZBot = splayDz * lsBotShift;
    const lsSplayXTop = splayDx * lsTopShift;
    const lsSplayZTop = splayDz * lsTopShift;
    // tapered 補償：下橫撐三條 Y 位置（中、上、下）各自的腳寬
    const lsLegSizeCenter = legSize * legScaleAt(lsCenterY, legHeight, bottomScale);
    const lsLegSizeTop = legSize * legScaleAt(lowerY + lowerW, legHeight, bottomScale);
    const lsLegSizeBot = legSize * legScaleAt(lowerY, legHeight, bottomScale);
    const lsInnerSpan = {
      x: 2 * apronEdgeX - lsLegSizeCenter,
      z: 2 * apronEdgeZ - lsLegSizeCenter,
    };
    const lsButtHalfX = (splay: number) => apronEdgeX + splay - lsLegSizeCenter / 2;
    const lsButtHalfZ = (splay: number) => apronEdgeZ + splay - lsLegSizeCenter / 2;
    const lsButtHalfXTop = (splay: number) => apronEdgeX + splay - lsLegSizeTop / 2;
    const lsButtHalfXBot = (splay: number) => apronEdgeX + splay - lsLegSizeBot / 2;
    const lsButtHalfZTop = (splay: number) => apronEdgeZ + splay - lsLegSizeTop / 2;
    const lsButtHalfZBot = (splay: number) => apronEdgeZ + splay - lsLegSizeBot / 2;
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
        { id: "ls-x1", nameZh: "X 撐 1（前左↔後右）", yRot: angle, yLift: 0 },
        { id: "ls-x2", nameZh: "X 撐 2（前右↔後左）", yRot: -angle, yLift: lowerT * 0.05 },
      ];
      for (const d of diagonals) {
        parts.push({
          id: d.id,
          nameZh: d.nameZh,
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
        { id: "ls-front", nameZh: "前下橫撐", visibleLength: lsInnerSpan.x + 2 * lsSplayX, axis: "x" as const, sx: 0, sz: -1, origin: { x: 0, z: -(apronEdgeZ + lsSplayZ) } },
        { id: "ls-back", nameZh: "後下橫撐", visibleLength: lsInnerSpan.x + 2 * lsSplayX, axis: "x" as const, sx: 0, sz: 1, origin: { x: 0, z: apronEdgeZ + lsSplayZ } },
        { id: "ls-left", nameZh: "左下橫撐", visibleLength: lsInnerSpan.z + 2 * lsSplayZ, axis: "z" as const, sx: -1, sz: 0, origin: { x: -(apronEdgeX + lsSplayX), z: 0 } },
        { id: "ls-right", nameZh: "右下橫撐", visibleLength: lsInnerSpan.z + 2 * lsSplayZ, axis: "z" as const, sx: 1, sz: 0, origin: { x: apronEdgeX + lsSplayX, z: 0 } },
      ];
      for (const s of sides) {
        const bevelAngle = isSplayed
          ? s.axis === "x" ? -s.sz * tiltZ : -s.sx * tiltX
          : 0;
        const hasShapeBend = splayDx > 0 || splayDz > 0 || bottomScale !== 1;
        const trapTopScale =
          s.axis === "x" && hasShapeBend
            ? lsButtHalfXTop(lsSplayXTop) / lsButtHalfX(lsSplayX)
            : s.axis === "z" && hasShapeBend
              ? lsButtHalfZTop(lsSplayZTop) / lsButtHalfZ(lsSplayZ)
              : null;
        const trapBotScale =
          s.axis === "x" && hasShapeBend
            ? lsButtHalfXBot(lsSplayXBot) / lsButtHalfX(lsSplayX)
            : s.axis === "z" && hasShapeBend
              ? lsButtHalfZBot(lsSplayZBot) / lsButtHalfZ(lsSplayZ)
              : 1;
        const lsShape = trapTopScale !== null
          ? { kind: "apron-trapezoid" as const, topLengthScale: trapTopScale, bottomLengthScale: trapBotScale, bevelAngle: bevelAngle || undefined }
          : isSplayed
            ? { kind: "apron-beveled" as const, bevelAngle }
            : legEdgeShape(stretcherEdge, stretcherEdgeStyle);
        parts.push({
          id: s.id,
          nameZh: s.nameZh,
          material,
          grainDirection: "length",
          visible: { length: s.visibleLength, width: lowerW, thickness: lowerT },
          // 視覺錯開（B）時左右（z 軸）下橫撐整支下移
          origin: { x: s.origin.x, y: lowerY - (lowerVisuallyStaggered && s.axis === "z" ? lowerStretcherStaggerMm : 0), z: s.origin.z },
          rotation: s.axis === "z"
            ? { x: Math.PI / 2, y: Math.PI / 2, z: s.sx * tiltX }
            : { x: Math.PI / 2 + (-s.sz) * tiltZ, y: 0, z: 0 },
          shape: lsShape,
          tenons: (() => {
            // type 依自動規則 / legPenetratingTenon 決定
            const lsType: "through-tenon" | "blind-tenon" =
              lowerTenonType === "through-tenon" ? "through-tenon" : "blind-tenon";
            if (!lowerCanHalfStagger) {
              // B 或不可用 → 整榫頭，4 邊全肩
              const mk = (position: "start" | "end") => ({
                position,
                type: lsType,
                length: lowerTenon,
                width: lowerTenonW,
                thickness: lowerTenonThick,
                shoulderOn: [...lowerTenonStd.shoulderOn],
              });
              return [mk("start"), mk("end")];
            }
            // A 半榫錯位 — 新省料規則：上榫貼上緣、下榫貼下緣、無上下肩
            const isUpper = s.axis === "x";
            const tenonH = isUpper ? lowerUpperTenonH : lowerLowerTenonH;
            // 同 apron 的世界 Y → mesh Z 反符號邏輯
            const worldOffset = isUpper ? lowerUpperTenonOffset : lowerLowerTenonOffset;
            // 下橫撐上下都不留肩，僅保留 left/right（thickness 軸）
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
        });
      }
      // 凳腳補 2 個下橫撐榫眼（前後 + 左右兩面）
      // X 向 = 上榫；Z 向 = 下榫；視覺錯開（B）時左右榫眼整支下移
      const lsXCenterY = lowerY + lowerW / 2;
      const lsZCenterY = lsXCenterY - (lowerVisuallyStaggered ? lowerStretcherStaggerMm : 0);
      const lsThrough = lowerTenonType === "through-tenon";
      for (const leg of legs) {
        const cx = leg.origin.x;
        const cz = leg.origin.z;
        if (lowerCanHalfStagger) {
          leg.mortises.push(
            {
              origin: { x: 0, y: lsXCenterY + lowerUpperTenonOffset, z: cz > 0 ? -1 : 1 },
              depth: lowerTenon,
              length: lowerUpperTenonH,
              width: lowerTenonThick,
              through: lsThrough,
            },
            {
              origin: { x: cx > 0 ? -1 : 1, y: lsZCenterY + lowerLowerTenonOffset, z: 0 },
              depth: lowerTenon,
              length: lowerLowerTenonH,
              width: lowerTenonThick,
              through: lsThrough,
            },
          );
        } else {
          leg.mortises.push(
            {
              origin: { x: 0, y: lsXCenterY, z: cz > 0 ? -1 : 1 },
              depth: lowerTenon,
              length: lowerTenonW,
              width: lowerTenonThick,
              through: lsThrough,
            },
            {
              origin: { x: cx > 0 ? -1 : 1, y: lsZCenterY, z: 0 },
              depth: lowerTenon,
              length: lowerTenonW,
              width: lowerTenonThick,
              through: lsThrough,
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
    notes:
      `腳樣式：${legShapeLabel(legShape)}。座板與凳腳用通榫，凳腳與橫撐用半榫。` +
      (withLowerStretcher
        ? lowerStretcherStyle === "x-cross"
          ? " 加 X 字交叉橫撐（明清交杌做法）。"
          : " 加 H 字下橫撐結構。"
        : "") +
      ` ${seatEdgeNote(seatEdge)}` +
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
    apronTenonLength: number;
    apronUpperTenonH: number;
    apronLowerTenonH: number;
    apronUpperTenonOffset: number;
    apronLowerTenonOffset: number;
    apronTenonThick: number;
    apronWidth: number;
    legHeight: number;
    apronDropFromTop: number;
    apronVisualStaggerMm?: number;
    apronThrough?: boolean;
  },
) {
  const {
    apronTenonLength, apronUpperTenonH, apronLowerTenonH,
    apronUpperTenonOffset, apronLowerTenonOffset,
    apronTenonThick, apronWidth, legHeight, apronDropFromTop,
  } = opts;
  const visualStagger = opts.apronVisualStaggerMm ?? 0;
  const through = opts.apronThrough ?? false;
  // 牙板中心 Y（leg-local）= legHeight − apronDropFromTop − apronWidth/2
  // X 向（前後牙板）= 上榫；Z 向（左右）= 下榫
  // 視覺錯開時 Z 向整支下移
  const xCenterY = legHeight - apronDropFromTop - apronWidth / 2;
  const zCenterY = xCenterY - visualStagger;
  return [
    // X 向 mortise（前後牙板插入）— 上榫
    {
      origin: { x: 0, y: xCenterY + apronUpperTenonOffset, z: corner.z > 0 ? -1 : 1 },
      depth: apronTenonLength,
      length: apronUpperTenonH,
      width: apronTenonThick,
      through,
    },
    // Z 向 mortise（左右牙板插入）— 下榫
    {
      origin: { x: corner.x > 0 ? -1 : 1, y: zCenterY + apronLowerTenonOffset, z: 0 },
      depth: apronTenonLength,
      length: apronLowerTenonH,
      width: apronTenonThick,
      through,
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
