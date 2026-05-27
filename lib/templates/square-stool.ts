import type {
  FurnitureDesign,
  FurnitureTemplate,
  OptionSpec,
  Part,
} from "@/lib/types";
import { getOption, opt } from "@/lib/types";
import { corners, rectLegShape, RECT_LEG_SHAPE_CHOICES, seatEdgeOption, seatEdgeBottomOption, seatEdgeStyleOption, seatEdgeNote, seatEdgeShape, seatProfileOption, seatProfileNote, seatScoopShape, legEdgeOption, legEdgeStyleOption, legEdgeShape, legEdgeNote, stretcherEdgeOption, stretcherEdgeStyleOption, stretcherEdgeNote, apronEdgeOption, apronEdgeStyleOption, legShapeLabel, parseLegChamferMm, legBottomScale, legScaleAt, computeCompoundSplayNormal, splayedLegMortiseGeom } from "./_helpers";
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
  { ...seatEdgeBottomOption("top"), dependsOn: { key: "legInset", notIn: [0] } },
  { ...seatEdgeStyleOption("top"), dependsOn: { any: [{ key: "seatEdge", notIn: [0] }, { key: "seatEdgeBottom", notIn: [0] }] } },
  seatProfileOption("top"),
  { group: "top", type: "number", key: "seatBendMm", label: "椅面彎曲 (mm)", defaultValue: 0, min: 0, max: 25, step: 1, help: "整片椅面像彎合板那樣彎曲，中間下凹比較好坐；四角榫眼位置不受影響。>0 會覆蓋鞍形 / 邊緣 profile" },
  { group: "apron", type: "number", key: "apronWidth", label: "牙條高度 (mm)", defaultValue: 60, min: 30, max: 200, step: 5, unit: "mm" },
  { group: "apron", type: "number", key: "apronThickness", label: "牙條厚度 (mm)", defaultValue: 20, min: 10, max: 50, step: 1, unit: "mm" },
  { group: "apron", type: "number", key: "apronDropFromTop", label: "牙條距座板 (mm)", defaultValue: 0, min: 0, max: 400, step: 5, unit: "mm", help: "牙條頂面距座板下緣的距離；小凳子建議 10–15 才不會頭重腳輕" },
  { group: "apron", type: "number", key: "apronStaggerMm", label: "牙條錯開 (mm)", defaultValue: 0, min: 0, max: 80, step: 2, unit: "mm", help: "前後牙條（正視圖看到全寬的那對）相對左右牙條下移量，3D 即時顯示，榫頭整支跟著。0 = 等高（自動上下半榫避免穿模）" },
  apronEdgeOption("apron", 1),
  apronEdgeStyleOption("apron"),
  { group: "apron", type: "checkbox", key: "legPenetratingTenon", label: "腳上榫頭通透（明榫裝飾）", defaultValue: false, help: "勾選：牙條/下橫撐進腳改通榫（榫頭穿透到腳另一面），明式裝飾感；未勾：依母件厚度自動規則（≤25mm 通榫、>25mm 盲榫深度=厚度2/3）" },
  { group: "top", type: "checkbox", key: "seatPenetratingTenon", label: "椅面通透（腳頂穿透）", defaultValue: false, help: "勾選：腳頂榫穿透座板上面（明式装饰）；未勾：盲榫，深度上限座板厚 × 4/5、不穿透" },
  { group: "stretcher", type: "checkbox", key: "withLowerStretcher", label: "加下橫撐", defaultValue: true, help: "在腳下方 1/4 高加一圈橫撐，結構更穩；傳統方凳必備（取消勾選 = 簡約款）" },
  { group: "stretcher", type: "select", key: "lowerStretcherStyle", label: "下橫撐樣式", defaultValue: "h-frame", choices: [
    { value: "h-frame", label: "H 字形（4 條繞 1 圈，最穩）" },
    { value: "x-cross", label: "X 字交叉（2 條斜撐穿越中心，明清交杌做法）" },
  ], dependsOn: { key: "withLowerStretcher", equals: true } },
  { group: "stretcher", type: "number", key: "lowerStretcherWidth", label: "下橫撐高 (mm)", defaultValue: 40, min: 20, max: 150, step: 5, unit: "mm", dependsOn: { key: "withLowerStretcher", equals: true } },
  { group: "stretcher", type: "number", key: "lowerStretcherThickness", label: "下橫撐厚 (mm)", defaultValue: 20, min: 10, max: 50, step: 1, unit: "mm", dependsOn: { key: "withLowerStretcher", equals: true } },
  { group: "stretcher", type: "number", key: "lowerStretcherHeight", label: "下橫撐離地高 (mm)", defaultValue: 0, min: 0, max: 700, step: 10, unit: "mm", help: "0 = 自動（腳高的 22%）", dependsOn: { key: "withLowerStretcher", equals: true } },
  { group: "stretcher", type: "number", key: "lowerStretcherStaggerMm", label: "下橫撐錯開 (mm)", defaultValue: 0, min: 0, max: 80, step: 2, unit: "mm", help: "左右下橫撐（側視圖看到全寬的那對）相對前後下橫撐上移量，3D 即時顯示，榫頭整支跟著。0 = 等高（自動上下半榫避免穿模）", dependsOn: { key: "withLowerStretcher", equals: true } },
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
  const seatEdgeBottom = getOption<number>(input, opt(o, "seatEdgeBottom"));
  const seatEdgeBottomClamped = Math.min(seatEdgeBottom, legInset);
  const seatProfile = getOption<string>(input, opt(o, "seatProfile"));
  const seatBendMm = getOption<number>(input, opt(o, "seatBendMm"));
  const stretcherEdge = getOption<string>(input, opt(o, "stretcherEdge"));
  const stretcherEdgeStyle = getOption<string>(input, opt(o, "stretcherEdgeStyle"));
  const apronEdge = getOption<number>(input, opt(o, "apronEdge"));
  const apronEdgeStyle = getOption<string>(input, opt(o, "apronEdgeStyle"));
  const apronWidth = getOption<number>(input, opt(o, "apronWidth"));
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
    childThickness: legSize,
    childWidth: legSize,
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
  const apronTenonType = legPenetratingTenon ? "through-tenon" : autoTenonType(legSize);
  const apronTenonStd = standardTenon({
    type: apronTenonType === "through-tenon" ? "through-tenon" : "shouldered-tenon",
    childThickness: apronThickness,
    childWidth: apronWidth,
    motherThickness: legSize,
  });
  // 通榫加 5mm 補償斜腳 rotation tilt 在世界軸投影的 cos(tilt) 損失（避免榫頭差一點點才穿出腳）
  const apronTenonLength = apronTenonStd.length + (apronTenonType === "through-tenon" ? 5 : 0);
  const apronTenonThick = apronTenonStd.thickness;
  const apronTenonW = apronTenonStd.width;
  // 牙板錯開策略（連續位移）：
  //   stagger > 0 → 前後牙板（X 軸，正視圖全寬）整支物理下移，榫頭整支跟著（中心榫）
  //   stagger == 0 → 自動上下半榫錯位避免同位撞：
  //     - 靜止 Z（左右）拿上榫；移動 X（前後，下移）拿下榫
  //     - 上榫保留 10mm 上肩、無下肩；下榫貼下緣無下肩、無上肩
  //     → 上榫高 = 下榫高 = (apronWidth - 10) / 2
  const apronVisuallyStaggered = apronStaggerMm > 0;
  const APRON_TOP_SHOULDER = 10;
  const apronTotalTenonH = apronWidth - APRON_TOP_SHOULDER;  // 上下榫合計高
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
    ? apronLowerTenonH / 2 - apronWidth / 2
    : 0;

  // 腳頂榫朝家具中心偏（X 軸），讓 tenon 內側緣貼腳內緣（內側無肩）。
  // 只有 legInset === 0（腳貼座板邊緣）時才偏，避免座板外側木材太薄破裂。
  // 偏移量 = (legSize − tenonWidth) / 2 — tenon 內側緣 = 腳內緣，外側留 SHOULDER 肩。
  const legTopType: "through-tenon" | "blind-tenon" = legTopTenonType;
  const legTopInsetX = legInset === 0
    ? Math.max(0, Math.round((legSize - legTenonStd.width) / 2))
    : 0;

  // 預計算 splay 數據（seatPanel 的 mortise.axis 跟 legs 共用）
  const _splayMmForLegs = Math.round(Math.tan((splayAngle * Math.PI) / 180) * legHeight);
  const _splayDxForLegs =
    legShape === "splayed" || legShape === "splayed-length" ? _splayMmForLegs : 0;
  const _splayDzForLegs =
    legShape === "splayed" || legShape === "splayed-width" ? _splayMmForLegs : 0;
  const _isSplayedForLegs = _splayDxForLegs > 0 || _splayDzForLegs > 0;

  const seatPanel: Part = {
    id: "seat",
    nameZh: "座板",
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
      ...corners(length, width, legSize, legInset).map((c) => {
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
  const legs: Part[] = corners(length, width, legSize, legInset).map((c, i) => {
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
        ...(legTopAxis ? { axis: legTopAxis } : {}),
      },
    ],
    // 凳腳內側 2 面要挖橫撐的半榫眼（中段，距離地面 1/3 處）
    // 無牙板（apronWidth=0）→ 不開榫眼
    mortises: !withApron ? [] : legMortisesForApron(c, length, width, {
      apronTenonLength,
      apronUpperTenonH,
      apronLowerTenonH,
      apronUpperTenonOffset,
      apronLowerTenonOffset,
      apronTenonThick,
      apronVisualStaggerMm: apronVisuallyStaggered ? apronStaggerMm : 0,
      apronWidth,
      legHeight,
      legSize,
      apronDropFromTop,
      apronThrough: apronTenonType === "through-tenon",
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
  const apronCenterY = apronY + apronWidth / 2;
  const tiltX = splayDx > 0 ? Math.atan(splayDx / legHeight) : 0;
  const tiltZ = splayDz > 0 ? Math.atan(splayDz / legHeight) : 0;
  const apronEdgeZ = width / 2 - legSize / 2 - legInset;
  const apronEdgeX = length / 2 - legSize / 2 - legInset;
  // 牙條錯開時 X 軸（前後）下移 apronStaggerMm；外斜時腳在更低處 splay 更大——
  // X 軸 / Z 軸 各用各自的 Y 中心算 splay/legSize/innerSpan，否則接不到腳
  const apronGeomFor = (yCenter: number) => {
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
      legSizeCenter: legSize * legScaleAt(yCenter, legHeight, bottomScale),
      legSizeTop: legSize * legScaleAt(yTop, legHeight, bottomScale),
      legSizeBot: legSize * legScaleAt(yBot, legHeight, bottomScale),
    };
  };
  const apronGeomZ = apronGeomFor(apronCenterY);  // 左右（Z）牙板，靜止
  const apronGeomX = apronGeomFor(apronCenterY - (apronVisuallyStaggered ? apronStaggerMm : 0));  // 前後（X）牙板，下移後
  const apronSides = [
    { id: "apron-front", nameZh: "前牙條",
      visibleLength: 2 * apronEdgeX - apronGeomX.legSizeCenter + 2 * apronGeomX.splayX,
      axis: "x" as const, sx: 0, sz: -1,
      origin: { x: 0, z: -(apronEdgeZ + apronGeomX.splayZ) } },
    { id: "apron-back", nameZh: "後牙條",
      visibleLength: 2 * apronEdgeX - apronGeomX.legSizeCenter + 2 * apronGeomX.splayX,
      axis: "x" as const, sx: 0, sz: 1,
      origin: { x: 0, z: apronEdgeZ + apronGeomX.splayZ } },
    { id: "apron-left", nameZh: "左牙條",
      visibleLength: 2 * apronEdgeZ - apronGeomZ.legSizeCenter + 2 * apronGeomZ.splayZ,
      axis: "z" as const, sx: -1, sz: 0,
      origin: { x: -(apronEdgeX + apronGeomZ.splayX), z: 0 } },
    { id: "apron-right", nameZh: "右牙條",
      visibleLength: 2 * apronEdgeZ - apronGeomZ.legSizeCenter + 2 * apronGeomZ.splayZ,
      axis: "z" as const, sx: 1, sz: 0,
      origin: { x: apronEdgeX + apronGeomZ.splayX, z: 0 } },
  ];
  const aprons: Part[] = !withApron ? [] : apronSides.map((s) => {
    const geom = s.axis === "x" ? apronGeomX : apronGeomZ;
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
    const hasShapeBend = splayDx > 0 || splayDz > 0 || bottomScale !== 1;
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
    const partShape = trapTopScale !== null
      ? { kind: "apron-trapezoid" as const, topLengthScale: trapTopScale, bottomLengthScale: trapBotScale, bevelAngle: useTopBevel ? bevelAngle : undefined, bevelMode: useTopBevel ? "half" as const : undefined }
      : legEdgeShape(apronEdge, apronEdgeStyle);
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
          length: apronTenonLength,
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
    const lowerTenonType = legPenetratingTenon ? "through-tenon" : autoTenonType(legSize);
    const lowerTenonStd = standardTenon({
      type: lowerTenonType,
      childThickness: lowerT,
      childWidth: lowerW,
      motherThickness: legSize,
    });
    // 通榫加 5mm 補償斜腳 tilt 投影損失
    const lowerTenon = lowerTenonStd.length + (lowerTenonType === "through-tenon" ? 5 : 0);
    const lowerTenonThick = lowerTenonStd.thickness;
    const lowerTenonW = lowerTenonStd.width;
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
    const lowerUpperTenonH = lowerHalfTenonH;
    const lowerLowerTenonH = lowerHalfTenonH;
    // part-local：lowerW 是 Y 軸高度，中心 = lowerW/2
    // 上榫中心 Y = lowerW - lowerUpperTenonH/2，offset = lowerW/2 - lowerUpperTenonH/2
    const lowerUpperTenonOffset = lowerCanHalfStagger ? (lowerW / 2 - lowerUpperTenonH / 2) : 0;
    const lowerLowerTenonOffset = lowerCanHalfStagger ? (lowerLowerTenonH / 2 - lowerW / 2) : 0;
    // 下橫撐：以中軸對齊腳中軸，top/bot 都從中心向外/向內推
    // X 靜止用 lsCenterY；Z 上移用 lsZCenterY = lsCenterY + stagger
    const lsCenterY = lowerY + lowerW / 2;
    const lsZShiftedY = lsCenterY + (lowerVisuallyStaggered ? lowerStretcherStaggerMm : 0);
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
    const lsLegSizeCenter = legSize * legScaleAt(lsCenterY, legHeight, bottomScale);
    const lsLegSizeTop = legSize * legScaleAt(lowerY + lowerW, legHeight, bottomScale);
    const lsLegSizeBot = legSize * legScaleAt(lowerY, legHeight, bottomScale);
    const lsZLegSizeCenter = legSize * legScaleAt(lsZShiftedY, legHeight, bottomScale);
    const lsZLegSizeTop = legSize * legScaleAt(lsZShiftedY + lowerW / 2, legHeight, bottomScale);
    const lsZLegSizeBot = legSize * legScaleAt(lsZShiftedY - lowerW / 2, legHeight, bottomScale);
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
        // 前後（X 軸, 靜止）用原 lsSplay
        { id: "ls-front", nameZh: "前下橫撐", visibleLength: lsInnerSpan.x + 2 * lsSplayX, axis: "x" as const, sx: 0, sz: -1, origin: { x: 0, z: -(apronEdgeZ + lsSplayZ) } },
        { id: "ls-back", nameZh: "後下橫撐", visibleLength: lsInnerSpan.x + 2 * lsSplayX, axis: "x" as const, sx: 0, sz: 1, origin: { x: 0, z: apronEdgeZ + lsSplayZ } },
        // 左右（Z 軸, 上移）用 lsZSplay（在上移後 Y 重算的腳位置）
        { id: "ls-left", nameZh: "左下橫撐", visibleLength: lsInnerSpan.z + 2 * lsZSplayZ, axis: "z" as const, sx: -1, sz: 0, origin: { x: -(apronEdgeX + lsZSplayX), z: 0 } },
        { id: "ls-right", nameZh: "右下橫撐", visibleLength: lsInnerSpan.z + 2 * lsZSplayZ, axis: "z" as const, sx: 1, sz: 0, origin: { x: apronEdgeX + lsZSplayX, z: 0 } },
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
        const hasShapeBend = splayDx > 0 || splayDz > 0 || bottomScale !== 1;
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
        const lsShape = trapTopScale !== null
          ? { kind: "apron-trapezoid" as const, topLengthScale: trapTopScale, bottomLengthScale: trapBotScale }
          : legEdgeShape(stretcherEdge, stretcherEdgeStyle);
        parts.push({
          id: s.id,
          nameZh: s.nameZh,
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
              length: lowerTenon,
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
      const lsThrough = lowerTenonType === "through-tenon";
      for (const leg of legs) {
        const cx = leg.origin.x;
        const cz = leg.origin.z;
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
              origin: { x: 0, y: lsZCenterY + lowerUpperTenonOffset, z: cz > 0 ? -1 : 1 },
              depth: lowerTenon,
              length: lowerUpperTenonH,
              width: lowerTenonThick,
              through: lsThrough,
              ...(lsZRotX ? { rotX: lsZRotX } : {}),
            },
            // X 面 mortise（接 X 軸 = 前後下橫撐, 靜止）— 下榫
            {
              origin: { x: cx > 0 ? -1 : 1, y: lsXCenterY + lowerLowerTenonOffset, z: 0 },
              depth: lowerTenon,
              length: lowerLowerTenonH,
              width: lowerTenonThick,
              through: lsThrough,
              ...(lsXRotZ ? { rotZ: lsXRotZ } : {}),
            },
          );
        } else {
          leg.mortises.push(
            {
              origin: { x: 0, y: lsZCenterY, z: cz > 0 ? -1 : 1 },
              depth: lowerTenon,
              length: lowerTenonW,
              width: lowerTenonThick,
              through: lsThrough,
              ...(lsZRotX ? { rotX: lsZRotX } : {}),
            },
            {
              origin: { x: cx > 0 ? -1 : 1, y: lsXCenterY, z: 0 },
              depth: lowerTenon,
              length: lowerTenonW,
              width: lowerTenonThick,
              through: lsThrough,
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
    legSize: number;
    apronDropFromTop: number;
    apronVisualStaggerMm?: number;
    apronThrough?: boolean;
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
    apronTenonLength, apronUpperTenonH, apronLowerTenonH,
    apronUpperTenonOffset, apronLowerTenonOffset,
    apronTenonThick, apronWidth, legHeight, legSize, apronDropFromTop,
  } = opts;
  const visualStagger = opts.apronVisualStaggerMm ?? 0;
  const through = opts.apronThrough ?? false;
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
      depth: apronTenonLength,
      length: apronUpperTenonH,
      width: apronTenonThick,
      through,
      rotX: zFaceRotX || undefined,
    },
    // X 面 mortise（接 X 軸 = 前後牙板, 下移）— 下榫
    {
      origin: { x: corner.x > 0 ? -1 : 1, y: xCenterY + apronLowerTenonOffset, z: 0 },
      depth: apronTenonLength,
      length: apronLowerTenonH,
      width: apronTenonThick,
      through,
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
