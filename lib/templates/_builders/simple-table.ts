import type {
  FurnitureCategory,
  FurnitureDesign,
  MaterialId,
  Part,
} from "@/lib/types";
import { corners, rectLegShape, seatEdgeShape, seatScoopShape, legEdgeShape, legBottomScale, legScaleAt, curvedTaperInnerScaleAt, computeCompoundSplayNormal, splayedLegMortiseGeom, xFaceApronMortiseRotZ } from "../_helpers";
import {
  LOWER_STRETCHER_HEIGHT_RATIO,
  TENON_THICKNESS_RATIO,
  BLIND_TENON_DEPTH_RATIO,
  MIN_SHOULDER_MM,
} from "../_constants";
import { autoTenonType, standardTenon } from "@/lib/joinery/standards";
import { curvedTaperCoveSpan } from "@/lib/render/part-geometry";
import { apronCenterOffset, apronMortiseOffset, resolveApronSetbackForLeg, resolveCtBlockForApron } from "../_helpers";

export interface SimpleTableOpts {
  category: FurnitureCategory;
  nameZh: string;
  length: number;
  width: number;
  height: number;
  material: MaterialId;
  /** Auto-scaled by height if omitted */
  legSize?: number;
  topThickness?: number;
  apronWidth?: number;
  /** 牙條外面離腳外面多遠。0 = 齊腳外面（預設）。 */
  apronSetback?: number;
  apronThickness?: number;
  /** Distance from top-underside down to the apron top edge. */
  apronOffset?: number;
  /** Skip the front apron (key="front"). Used by desk apron-drawer mode where
   *  the drawer face replaces the front apron strip. Back/left/right still rendered. */
  skipFrontApron?: boolean;
  /** Add a single mid-span stretcher (tie beam) between front and back aprons. */
  withCenterStretcher?: boolean;
  /** Center stretcher width (vertical dimension, mm). Default 50. */
  centerStretcherWidth?: number;
  /** Center stretcher thickness (horizontal dimension along table length, mm). Default 25. */
  centerStretcherThickness?: number;
  /** Y offset of center stretcher below apron top edge (mm). Default apronWidth/2 (centered in apron). */
  centerStretcherDrop?: number;
  /** Add 4 lower stretchers connecting legs at ~1/4 height (traditional style). */
  withLowerStretchers?: boolean;
  /** 下橫撐位置也做一節接撐段 + 第二道弧肩（A 案）。只對弧肩斜腳有意義。 */
  ctLowerCove?: boolean;
  /** 弧肩曲線改 S 形（兩端都垂直切線）。false = 圓弧（既有行為）。 */
  ctSCurve?: boolean;
  /** Overhang of top beyond leg outer face, mm. Default 0 (flush). */
  topOverhang?: number;
  /** Leg shape:
   *   box             = 方直腳（預設）
   *   tapered         = 錐形腳（下方收窄）
   *   strong-taper    = 方錐漸縮（大幅下收）
   *   inverted        = 倒錐腳（下方反而更粗）
   *   splayed         = 斜腳（四角對角整支外傾）
   *   splayed-length  = 單向斜腳（只沿長邊外傾）
   *   splayed-width   = 單向斜腳（只沿寬邊外傾）
   *   splayed-tapered = 方錐斜腳（方料 + 下收 + 整支外傾）
   *   splayed-round-tapered = 圓錐斜腳（圓料 + 下收 + 整支外傾）
   *   curved-taper    = 弧肩斜腳（上段接撐全寬 → 內凹弧肩 → 斜降；外面垂直）
   *   hoof            = 馬蹄腳（底部外撇） */
  legShape?:
    | "box"
    | "tapered"
    | "strong-taper"
    | "inverted"
    | "splayed"
    | "splayed-length"
    | "splayed-width"
    | "splayed-tapered"
    | "splayed-round-tapered"
    | "curved-taper"
    | "hoof"
    | "shaker";
  /** 弧肩斜腳（curved-taper）專屬：接撐段全寬高度 / 弧肩內收 / 外面斜降內縮（mm）。 */
  ctBlockHeight?: number;
  ctShoulder?: number;
  ctInset?: number;
  /** 兩向弧肩(§A9.9):兩個相鄰內面都做弧肩。預設 false = 既有行為 */
  ctTwoWay?: boolean;
  /** 弧肩斜腳選配外斜角度（度）。0 / undefined = 垂直（既有行為）。 */
  ctSplay?: number;
  /** 牙條／下橫撐造型（edge-profile 曲線）。"none"/undefined = 直邊（既有行為）。
   *  depth 0/undefined = 自動（該件高的 40%）。 */
  apronProfile?: "none" | "arch" | "arch-out" | "kunmen" | "wave" | "double-arch";
  apronProfileDepth?: number;
  stretcherProfile?: "none" | "arch" | "top-arch" | "kunmen" | "wave" | "double-arch";
  stretcherProfileDepth?: number;
  /** Inset legs inward from outer edge (mm, each side). Top overhang is separate. */
  legInset?: number;
  /** Y position of lower stretcher from floor (mm). Default ≈ 22% of leg height. */
  lowerStretcherHeight?: number;
  /** Lower stretcher width (vertical dim, mm). Default 40. */
  lowerStretcherWidth?: number;
  /** Lower stretcher thickness (horizontal, mm). Default 20. */
  lowerStretcherThickness?: number;
  /** 下橫撐置物條（grille slats）：在前後下橫撐之間架 N 條格柵，做置物層 */
  withSlatRack?: boolean;
  /** 置物條數量（沿 X 軸均分）。預設 5 */
  slatCount?: number;
  /** 置物條寬（沿 X 軸，mm）。預設 35 */
  slatWidth?: number;
  /** 置物條厚（沿 Y 軸，mm）。預設 18 */
  slatThickness?: number;
  /** 桌面 / 座板邊緣處理 — 'square' / 'chamfered' / 'rounded' / 'rounded-large'
   *  或直接傳數字 mm（搭配 seatEdgeStyle 控制 V 角 vs 圓角）。 */
  seatEdge?: string | number;
  /** 座面挖型 — "flat"(預設) / "saddle"(馬鞍挖座) / "scooped"(雙凹)。
   *  非 flat 時覆蓋 seatEdge shape，3D 渲染挖型曲面。 */
  seatProfile?: string;
  /** 座板邊緣樣式 — "chamfered"(45°) / "rounded"(圓刀)。預設 chamfered */
  seatEdgeStyle?: string;
  /** 桌面 / 座板「下緣」倒角量（mm）。undefined = 沿用 legInset/topOverhang
   *  自動鏡射上緣的舊行為；有傳值（含 0）就以明確值為準。 */
  seatEdgeBottom?: number;
  /** 腳邊緣倒角（mm）。0 = 直角。當 legShape 是 box 時生效，其他造型腳忽略 */
  legEdge?: string | number;
  /** 腳邊緣樣式 — "chamfered"(45°) / "rounded"(圓刀)。預設 chamfered */
  legEdgeStyle?: string;
  /** 牙板與下橫撐邊緣倒角（mm）。0 = 直角。外斜模式 (apron-beveled) 時忽略 */
  stretcherEdge?: string | number;
  /** 牙板/橫撐邊緣樣式 */
  stretcherEdgeStyle?: string;
  /** 牙板邊緣倒角（mm）— 獨立於 stretcherEdge。0 = 直角。未指定時 fallback 到 stretcherEdge */
  apronEdge?: string | number;
  /** 牙板邊緣樣式 — 未指定時 fallback 到 stretcherEdgeStyle */
  apronEdgeStyle?: string;
  /** 桌面拼板片數（1-4）。> 1 時材料單顯示 N 片小料、裁切器拆 N 片排料 */
  topPanelPieces?: number;
  /** 腳上榫頭通透（明榫裝飾）：勾選 → 牙板/下橫撐進腳改通榫（穿透腳另一面）。
   *  未勾選 → 依母件厚度自動規則（≤25mm 通榫、>25mm 盲榫深度=厚度2/3）。 */
  legPenetratingTenon?: boolean;
  /** 桌面兩端加 breadboard end（端板）—— 與桌面正交紋理的木條，
   *  傳統實木桌防止跨度太大時翹曲。預設 60mm 寬，與桌面厚度同。 */
  withBreadboardEnds?: boolean;
  /** Breadboard 端板寬（mm，沿桌面長度軸方向延伸）。預設 60 */
  breadboardWidth?: number;
  /** Live edge 桌面——長邊不規則波浪邊緣（保留樹皮的原木板桌）。
   *  跟倒角互斥（liveEdge 已含造型）。預設振幅 12mm。 */
  liveEdge?: boolean;
  /** Live edge 振幅（mm，預設 12） */
  liveEdgeAmplitude?: number;
  /** Drop-leaf 翻板：在桌面長度軸兩端各加一片可摺疊的延伸板。
   *  none / one-side（只 +X 端）/ two-sides。3D 渲染為展開狀態。 */
  dropLeaf?: "none" | "one-side" | "two-sides";
  /** Drop-leaf 寬度（沿桌面長度軸延伸，mm）。預設 250 */
  dropLeafWidth?: number;
  /** 腳頂榫頭兩側肩額外加厚（mm）。餐桌等承重大、桌面端頭沿 X 順紋方向有開裂風險，
   *  傳 5+ 讓榫寬縮成 legSize - 2*(SHOULDER + extra)，外側肩變厚。預設 0（沿用標準 5mm 肩）。 */
  legTopShoulderExtraMm?: number;
  /** 裙板／牙條「上肩」＝從它的頂邊到榫頭上緣留多少實料（mm）。
   *  預設 10（一般桌子的慣例）。腳頂另有貫穿榫、或裙板頂跟腳頂齊平時，
   *  10mm 的殼會在腳頂破口 → caller 傳大一點（工作桌傳 25）。 */
  apronTopShoulderMm?: number;
  /** 腳頂榫頭改**貫穿**桌面（Roubo 工作桌：榫頭端面露在桌面上）。
   *  undefined/false = 既有行為（autoTenonType：桌面 >25mm 一律盲榫）。 */
  legTopThroughTenon?: boolean;
  notes?: string;
}

/**
 * 腳上 mortise origin 的 face inset：origin.x 或 origin.z 設成 ±LEG_FACE_INSET
 * 讓 mortiseLocalBox 用「最近表面」決定 depthAxis（避免落在腳中心、depthAxis 不確定）。
 * Post-process（dining-table h-frame 等）偵測腳面榫眼也用這個值。
 */
export const LEG_FACE_INSET = 1;

/**
 * Generic 4-leg + apron + top table.
 * Used by bench, side-table, low-table, dining-table, desk.
 */
export function simpleTable(opts: SimpleTableOpts): FurnitureDesign {
  const {
    length,
    width,
    height,
    material,
    category,
    nameZh,
    withCenterStretcher = false,
  } = opts;

  const topThickness = opts.topThickness ?? 25;
  const legSize =
    opts.legSize ?? Math.max(35, Math.min(70, Math.round(height / 12)));
  // 弧肩斜腳（curved-taper）：接撐段全寬高度 / 弧肩內收 / 外面斜降內縮
  const isCurvedTaper = (opts.legShape ?? "box") === "curved-taper";
  const ctBlockHeight = opts.ctBlockHeight ?? 55;
  const ctShoulder = opts.ctShoulder ?? 8;
  const ctInset = opts.ctInset ?? 12;
  const ctTwoWay = opts.ctTwoWay ?? false;
  const ctSCurve = opts.ctSCurve ?? false;
  /**
   * 弧肩斜腳的牙板高度：**夾上限**，不是無條件覆寫。
   *
   * 幾何約束（docs/drafting-math.md §A10 butt-joint 慣例／「榫眼只能落在全寬實體區」）：
   * 牙板要整片落在腳頂部的全寬接撐段內，再往下腳就開始收弧，榫眼會切到已內縮的斜面而露出。
   * 但這只擋得住「太高」——**比接撐段矮完全安全**。
   *
   * ⛔ 原本寫成 `isCurvedTaper ? ctBlockHeight : ...` 是無條件覆寫：使用者在 UI 把「牙條高」
   *    調小完全沒作用，而這些模板的欄位**並沒有隱藏**（不像 square-stool 曾經隱藏過），
   *    看得到、調得動、卻毫無效果 ＝ 死控制項。user 2026-08-03 已明確反對這種
   *    「用限制代替修正」的做法，square-stool 那批四款當時改成夾上限，走共用 builder 的
   *    這 7 款（bench / dining-chair / desk / dining-table / low-table / tea-table /
   *    side-table）漏掉了。2026-08-21 稽核抓到。
   *
   * ⚠️ 預設輸出不變：7 款的 apronWidth 預設是 60~100，ctBlockHeight 預設 40，
   *    `Math.min(≥60, 40)` 仍然是 40 ＝ 與原本的硬鎖結果逐值相同。
   */
  const apronWidthWanted = opts.apronWidth ?? 70;
  /**
   * ⭐ 牙條底緣還要**讓開弧肩那一段**,不能貼著接撐段底。
   *
   * 接撐段是全寬的沒錯,所以牙條做滿接撐段高「幾何上」撐得住 —— 但弧的上端是
   * 水平切線(§A11.8),一離開接撐段底就立刻往內切(1mm 內縮 3.8mm),
   * 牙條底緣等於架在一道刀口上。
   * 木頭仁 2026-08-25 實測:接撐段 40 / 弧肩內收 8 → 牙條要 **32** 才對,
   * 差的正好就是弧肩那一段。
   *
   * 🩸 這 5 款(長凳 / 邊桌 / 矮桌 / 餐桌 / 書桌)走這支共用 builder,
   *    原本只夾到 ctBlockHeight,所以預設就少讓 7.95mm。
   */
  const ctCoveSpan = curvedTaperCoveSpan(legSize, opts.height, ctBlockHeight, ctShoulder);
  /**
   * ⭐ 反過來:**接撐段長高去容納牙條**,不要把牙條砍掉。
   *    (2026-08-25 木頭仁「牙條高度又卡住了」—— 餐桌預設牙條 100 被砍成 32、
   *     書桌 90 → 32,整個比例都毀了。牙條高是使用者的設計決定,接撐段跟著它長。)
   */
  const ctBlockEff = isCurvedTaper
    // ⚠️ 上限要用**腳高**(height − 面板厚),不是家具總高 —— 用總高會讓接撐段超過腳
    ? resolveCtBlockForApron(ctBlockHeight, apronWidthWanted, 0, 0, opts.height - topThickness)
    : ctBlockHeight;
  /** 🩸 這裡以前是 `ctBlockEff − ctCoveSpan`,接撐段不再自動加高後會**反過來砍牙條 8mm**。 */
  const apronWidth = isCurvedTaper
    ? Math.max(0, Math.min(apronWidthWanted, ctBlockEff))
    : apronWidthWanted;
  /**
   * 🧷 夾了要出聲（§A10.11 第 2 條）。
   *
   * ⛔ 這個夾制本身是對的（牙條不能長過接撐段，否則下緣會蓋到弧肩），
   *    但它**默默**把使用者設的 200mm 改成 40mm，畫面上一句話都沒有 ——
   *    使用者會以為滑桿壞了。自己寫進 doc 的規矩自己漏做。（2026-08-24）
   */
  const apronClampWarnings: string[] =
    isCurvedTaper && apronWidth < apronWidthWanted
      ? [`牙條高 ${apronWidthWanted}mm 放不進弧肩斜腳的接撐段（接撐段 ${ctBlockEff}mm − 弧肩 ${ctCoveSpan}mm = 可用 ${ctBlockEff - ctCoveSpan}mm），已收到 ${apronWidth}mm。` +
         `牙條下緣要讓開弧肩,否則底緣會架在弧的起點上、交界處看起來像一個缺口。要更高的牙條，請把「接撐段高」一起調高、或把「弧肩內收」調小。`]
      : [];
  // apronWidth=0 = 「無牙板」（windsor / industrial preset 故意這樣設）；
  // 整段牙板 + leg 對應榫眼都 skip，腳頂 through-tenon 直接拉桌面/座板
  const withApron = apronWidth > 0;
  const apronThickness = opts.apronThickness ?? 22;
  const apronOffset = opts.apronOffset ?? 20;
  const topOverhang = opts.topOverhang ?? 0;
  const withLowerStretchers = opts.withLowerStretchers ?? false;
  // 桌類榫卯規則（套自方凳 square-stool）：
  //  - apron / lower stretcher 進腳：autoTenonType（legSize ≤ 25mm 通榫；> 25 盲榫 = round(legSize × 2/3)）
  //  - 通榫補 +5mm 補償斜腳 rotation tilt 在世界軸投影的損失
  //  - 半榫錯位：Z（左右）= 上半榫（保留 10mm 上肩）、X（前後）= 下半榫（無上下肩）
  //  - apronOffset === 0 + isSplayed → apron-trapezoid.bevelMode = "half"（頂面貼桌面水平）
  //  - legPenetratingTenon = true → 強制牙板/下橫撐進腳通榫（明榫裝飾，覆寫 autoTenonType）
  const legPenetratingTenon = opts.legPenetratingTenon ?? false;
  // 弧肩斜腳非明榫時強制盲榫（不讓 autoTenonType 對細腳自動通榫戳出腳外＝破口）。
  const apronTenonType = legPenetratingTenon
    ? "through-tenon"
    : isCurvedTaper
      ? "blind-tenon"
      : autoTenonType(legSize);
  const apronTenonStd = standardTenon({
    type: apronTenonType === "through-tenon" ? "through-tenon" : "shouldered-tenon",
    childThickness: apronThickness,
    childWidth: apronWidth,
    motherThickness: legSize,
  });
  const apronTenonLen = apronTenonStd.length + (apronTenonType === "through-tenon" ? 5 : 0);
  const apronTenonThick = apronTenonStd.thickness;
  const apronTenonWidth = apronTenonStd.width;
  // 半榫錯位（stagger 預設 0 → 走半榫）
  const APRON_TOP_SHOULDER = Math.max(10, opts.apronTopShoulderMm ?? 10);
  const APRON_HALF_TENON_GAP = 4;
  // 牙條造型（edge-profile）：深度 0=自動 40%。「下緣外圓弧」（arch-out）兩端上收＝深度
  // → 貼下緣的下半榫會露出，底肩自動抬 = 深度把榫上移進實體（同 square-stool）。
  const apronProfile = opts.apronProfile ?? "none";
  const apronProfileDepthEff =
    apronProfile !== "none"
      ? ((opts.apronProfileDepth ?? 0) > 0 ? (opts.apronProfileDepth ?? 0) : Math.round(apronWidth * 0.4))
      : 0;
  const apronBottomShoulder = apronProfile === "arch-out" ? apronProfileDepthEff : 0;
  const apronTotalTenonH = apronWidth - APRON_TOP_SHOULDER - apronBottomShoulder;
  const apronCanHalfStagger = apronTotalTenonH >= 16;
  const apronHalfTenonH = apronCanHalfStagger
    ? Math.min(apronTenonWidth, Math.floor((apronTotalTenonH - APRON_HALF_TENON_GAP) / 2))
    : apronTenonWidth;
  // part-local：apron Y 從 0 (底) 到 apronWidth (頂)；中心 = apronWidth/2
  // 上榫中心 Y = (apronWidth - 上肩) - 上榫高/2；下榫中心 Y = 底肩 + 下榫高/2
  const apronUpperTenonOffset = apronCanHalfStagger
    ? (apronWidth - APRON_TOP_SHOULDER - apronHalfTenonH / 2) - apronWidth / 2
    : 0;
  const apronLowerTenonOffset = apronCanHalfStagger
    ? apronBottomShoulder + apronHalfTenonH / 2 - apronWidth / 2
    : (apronBottomShoulder > 0 ? apronBottomShoulder / 2 : 0);
  // 腳頂榫：用 standardTenon 出 thickness=legSize/3、width=legSize-10（4 邊各 5mm 肩）
  // 比舊版 legSize * 2/3 細，避免側視圖看到 1/2 寬度的厚榫。跟 square-stool 同規則。
  const legTopTenonType = opts.legTopThroughTenon ? "through-tenon" : autoTenonType(topThickness);
  const legTopShoulderExtra = Math.max(0, opts.legTopShoulderExtraMm ?? 0);
  const legTopStd = standardTenon({
    type: legTopTenonType,
    childThickness: legSize,
    // 餐桌等承重大時 caller 傳 legTopShoulderExtraMm，把虛擬 childWidth 縮小，
    // standardTenon 算出來的 width 跟著變窄 → 兩側肩各多 legTopShoulderExtra mm。
    childWidth: legSize - 2 * legTopShoulderExtra,
    motherThickness: topThickness,
  });
  const legTopTenonLen = legTopStd.length;
  const legTopTenonW = legTopStd.width;       // 沿 part-X，較寬（≈ legSize - 10 - 2*extra）
  const legTopTenonT = legTopStd.thickness;   // 沿 part-Z，較薄（≈ legSize/3）

  const legHeight = height - topThickness;
  /**
   * 「橫撐處也做弧肩」的高度區間（leg-local,從腳底量）。
   * ⚠️ 要跟下面 `stretcherY` / `stretcherWidth` 用**完全一樣**的式子,
   *    不一致的話弧會跑到橫撐旁邊。沒有下橫撐或沒勾就給 undefined = 維持單道弧。
   */
  const ctLowerCoveRange = (opts.ctLowerCove ?? false) && (opts.withLowerStretchers ?? false) && isCurvedTaper
    ? (() => {
        const y0 = opts.lowerStretcherHeight ?? Math.round(legHeight * LOWER_STRETCHER_HEIGHT_RATIO);
        return { botMm: y0, topMm: y0 + (opts.lowerStretcherWidth ?? 30) };
      })()
    : undefined;
  const apronY = legHeight - apronWidth - apronOffset;
  const legInset = opts.legInset ?? 0;
  const apronSetback = resolveApronSetbackForLeg(opts.apronSetback ?? 0, opts.legShape ?? "box", legSize, apronThickness);
  /** 腳上的牙條榫眼要離開腳中心軸多少(腳的外側為正) */
  const apronMortiseOff = apronMortiseOffset(legSize, apronThickness, apronSetback);
  /**
   * ⭐ 下橫撐也齊腳外面（木頭仁 2026-08-26:「穿帶這還是有段差」）。
   *    只對弧肩腳生效,其他腳型維持置中。用**橫撐自己的厚度**算。
   */
  const _lsThk = opts.lowerStretcherThickness ?? 18;
  const lsSetback = resolveApronSetbackForLeg(opts.apronSetback ?? 0, opts.legShape ?? "box", legSize, _lsThk);
  const lsAxisZ = apronCenterOffset(width / 2, legInset, _lsThk, lsSetback);
  const lsAxisX = apronCenterOffset(length / 2, legInset, _lsThk, lsSetback);
  const lsMortiseOff = apronMortiseOffset(legSize, _lsThk, lsSetback);
  // legInset=0 時 tenon 沿 X 軸朝家具中心偏，內側緣貼腳內緣 → 內側無肩、外側多留肩
  // 防止桌面端頭沿 X 木紋方向破裂。跟 square-stool / dining-chair 同規則。
  const legTopInsetX = legInset === 0
    ? Math.max(0, Math.round((legSize - legTopTenonW) / 2))
    : 0;

  const cornerPts = corners(length, width, legSize, legInset);
  const topLen = length + 2 * topOverhang;
  const topWid = width + 2 * topOverhang;

  // Lift splay axis flags so both topPanel mortises and legs can use them.
  const _legShapePre = opts.legShape ?? "box";
  const _splayMmPre = 40;
  // 弧肩斜腳選配外斜（ctSplay 度數欄，預設 0=垂直）：對角外踢，角度換算 tan×腳高。
  const ctSplayMm =
    isCurvedTaper && (opts.ctSplay ?? 0) > 0
      ? Math.round(Math.tan(((opts.ctSplay ?? 0) * Math.PI) / 180) * legHeight)
      : 0;
  const _isSplayedAllAxesPre =
    _legShapePre === "splayed" ||
    _legShapePre === "splayed-tapered" ||
    _legShapePre === "splayed-round-tapered";
  const _splayDxPre =
    _isSplayedAllAxesPre || _legShapePre === "splayed-length" ? _splayMmPre : ctSplayMm;
  const _splayDzPre =
    _isSplayedAllAxesPre || _legShapePre === "splayed-width" ? _splayMmPre : ctSplayMm;
  const _isSplayedPre = _splayDxPre > 0 || _splayDzPre > 0;

  // category-aware part naming：bench 用「座板/凳腳」、其他桌類用「桌面板/桌腳」
  const isBench = opts.category === "bench";
  const topNameZh = isBench ? "座板" : "桌面板";
  const legNameZh = isBench ? "凳腳" : "桌腳";

  // Top
  const topPanel: Part = {
    id: "top",
    nameZh: topNameZh,
    material,
    grainDirection: "length",
    visible: { length: topLen, width: topWid, thickness: topThickness },
    origin: { x: 0, y: legHeight, z: 0 },
    shape: opts.liveEdge
      ? { kind: "live-edge", amplitudeMm: opts.liveEdgeAmplitude ?? 12 }
      : opts.seatProfile === "waterfall"
        // 瀑布前緣：座板下緣前後兩面大圓角（22mm），上緣維持 seatEdge 設定
        ? { kind: "chamfered-top", chamferMm: typeof opts.seatEdge === "number" ? opts.seatEdge : 5, bottomChamferMm: 22, style: "rounded" }
        : (seatScoopShape(opts.seatProfile ?? "flat") ?? seatEdgeShape(
            opts.seatEdge ?? "square",
            opts.seatEdgeStyle,
            opts.seatEdgeBottom !== undefined
              ? opts.seatEdgeBottom
              : ((legInset > 0 || topOverhang > 0) ? (opts.seatEdge ?? "square") : 0),
          )),
    panelPieces: opts.topPanelPieces,
    tenons: [],
    mortises: cornerPts.map((c) => {
      // splay 時 mortise.axis = 腳 top 榫頭世界軸的反向（桌面孔朝下開向腳）
      const mortiseAxis = _isSplayedPre
        ? (() => {
            const dx = c.x > 0 ? _splayDxPre : (c.x < 0 ? -_splayDxPre : 0);
            const dz = c.z > 0 ? _splayDzPre : (c.z < 0 ? -_splayDzPre : 0);
            const x = dx, y = -legHeight, z = dz;
            const mag = Math.hypot(x, y, z) || 1;
            return { x: x / mag, y: y / mag, z: z / mag };
          })()
        : undefined;
      return {
        // legInset=0：mortise 跟 tenon 一起朝中心偏（榫眼軸對齊榫頭）
        origin: { x: c.x - Math.sign(c.x) * legTopInsetX, y: 0, z: c.z },
        depth: legTopTenonLen,
        length: legTopTenonW,
        width: legTopTenonT,
        through: legTopTenonType === "through-tenon",
        ...(mortiseAxis ? { axis: mortiseAxis } : {}),
      };
    }),
  };

  // Legs
  const legShape = opts.legShape ?? "box";
  // Each corner leg splays outward toward ITS corner, so dx/dz signs come
  // from the leg's position (c.x, c.z).
  const splayMm = 40; // bottom offset for splayed style — tune if needed
  const hoofMm = Math.max(30, Math.round(legHeight * 0.08)); // flare height
  // splayed 系列把 legEdge 帶入做組合（外斜腳同時帶倒角）
  const legChamferMm =
    typeof opts.legEdge === "number" ? opts.legEdge : Number(opts.legEdge ?? 0) || 0;
  const legChamferStyle: "chamfered" | "rounded" =
    opts.legEdgeStyle === "rounded" ? "rounded" : "chamfered";
  const legShapeFor = (c: { x: number; z: number }): Part["shape"] => {
    if (legShape === "tapered") return { kind: "tapered", bottomScale: 0.55 };
    if (legShape === "strong-taper") return { kind: "tapered", bottomScale: 0.4 };
    if (legShape === "inverted") return { kind: "tapered", bottomScale: 1.3 };
    if (legShape === "splayed") {
      return {
        kind: "splayed",
        dxMm: Math.sign(c.x) * splayMm,
        dzMm: Math.sign(c.z) * splayMm,
        chamferMm: legChamferMm > 0 ? legChamferMm : undefined,
        chamferStyle: legChamferStyle,
      };
    }
    if (legShape === "splayed-length") {
      return { kind: "splayed", dxMm: Math.sign(c.x) * splayMm, dzMm: 0, chamferMm: legChamferMm > 0 ? legChamferMm : undefined, chamferStyle: legChamferStyle };
    }
    if (legShape === "splayed-width") {
      return { kind: "splayed", dxMm: 0, dzMm: Math.sign(c.z) * splayMm, chamferMm: legChamferMm > 0 ? legChamferMm : undefined, chamferStyle: legChamferStyle };
    }
    if (legShape === "splayed-tapered") {
      return {
        kind: "splayed-tapered",
        dxMm: Math.sign(c.x) * splayMm,
        dzMm: Math.sign(c.z) * splayMm,
        bottomScale: 0.55,
      };
    }
    if (legShape === "splayed-round-tapered") {
      return {
        kind: "splayed-round-tapered",
        dxMm: Math.sign(c.x) * splayMm,
        dzMm: Math.sign(c.z) * splayMm,
        bottomScale: 0.55,
      };
    }
    if (legShape === "curved-taper") {
      return rectLegShape("curved-taper", c, { curvedTaper: { blockHeightMm: ctBlockEff, shoulderMm: ctShoulder, insetMm: ctInset, splayMm: ctSplayMm, twoWay: ctTwoWay, lowerCove: ctLowerCoveRange, sCurve: ctSCurve } });
    }
    if (legShape === "hoof") return { kind: "hoof", hoofMm, hoofScale: 1.35 };
    if (legShape === "shaker") return { kind: "shaker" };
    return undefined;
  };
  const legs: Part[] = cornerPts.map((c, i) => {
    // Splayed legs lean outward at bottom → top tenon tilts INTO seat opposite.
    const legTopAxis = _isSplayedPre
      ? (() => {
          const dx = c.x > 0 ? _splayDxPre : (c.x < 0 ? -_splayDxPre : 0);
          const dz = c.z > 0 ? _splayDzPre : (c.z < 0 ? -_splayDzPre : 0);
          const x = -dx, y = legHeight, z = -dz;
          const mag = Math.hypot(x, y, z) || 1;
          return { x: x / mag, y: y / mag, z: z / mag };
        })()
      : undefined;
    // Apron mortise：套 square-stool b3f09ad 公約
    //   Z 面（左右牙板）→ rotX based on splayDz（FRONT 看不到 tilt，維持直矩形）
    //   X 面（前後牙板）→ rotZ based on splayDx（FRONT 看到 tilt，平行四邊形）
    // origin 鎖回腳中心軸（不做 splayShift offset），讓 maker 製作見對稱矩形
    const zCenterY = legHeight - apronOffset - apronWidth / 2;
    const zFaceGeom = splayedLegMortiseGeom({
      corner: c,
      splayDz: _splayDzPre,
      legHeight,
      legSize,
      zCenterY,
      tenonOffset: apronUpperTenonOffset,
      fallbackZ: LEG_FACE_INSET,
    });
    const xFaceRotZ = xFaceApronMortiseRotZ(c, _splayDxPre, legHeight);
    return ({
    id: `leg-${i + 1}`,
    nameZh: `${legNameZh} ${i + 1}`,
    material,
    grainDirection: "length",
    visible: { length: legSize, width: legSize, thickness: legHeight },
    origin: { x: c.x, y: 0, z: c.z },
    // legShape (tapered/splayed/...) 與 legEdge (chamfered-edges) 互斥；
    // 造型腳優先，box 腳才能套倒角。
    shape: legShapeFor(c) ?? legEdgeShape(opts.legEdge, opts.legEdgeStyle),
    tenons: [
      {
        position: "top",
        type: legTopTenonType === "through-tenon" ? "through-tenon" : "blind-tenon",
        length: legTopTenonLen,
        width: legTopTenonW,
        thickness: legTopTenonT,
        // legInset=0 時 tenon 朝家具中心偏，移除內側肩
        shoulderOn: (() => {
          if (legTopInsetX <= 0 || c.x === 0) return [...legTopStd.shoulderOn];
          const innerSide: "left" | "right" = c.x > 0 ? "left" : "right";
          return [...legTopStd.shoulderOn].filter((s) => s !== innerSide);
        })(),
        offsetWidth: -Math.sign(c.x) * legTopInsetX,
        ...(legTopAxis ? { axis: legTopAxis } : {}),
      },
    ],
    // 弧肩斜腳：3D 挖牙板母榫孔會從斜降薄區破出＝破口。2026-08-21 改法跟方凳同步：
    // **榫眼照建、標 Mortise.axis**——資料層有真實孔位給 1:1 樣板／零件圖／CNC 用
    // （木工在方料階段就要把孔鑿好），而 joineryMode 的 CSG 過濾器看到 axis 就跳過
    // 不挖，3D 外觀跟舊版一樣乾淨。axis 同時讓 mortiseLocalBox 不必猜入榫面
    // （這種腳的榫眼位置會讓「哪一軸離表面最近」判錯，孔會被畫到錯的面上）。
    mortises: !withApron ? [] : [
      // Z 面 mortise（接 Z 軸 = 左右牙板）— 上半榫，rotX 跟 splayDz
      {
        // ⭐ x 要跟著「牙條縮進」位移;牙條置中(舊行為)時 apronMortiseOff = 0
        origin: { x: zFaceGeom.x + Math.sign(c.x || 1) * apronMortiseOff, y: zFaceGeom.y, z: zFaceGeom.z },
        depth: apronTenonLen,
        length: apronHalfTenonH,
        width: apronTenonThick,
        through: apronTenonType === "through-tenon",
        ...(zFaceGeom.rotX !== undefined && Math.abs(zFaceGeom.rotX) > 0.001 ? { rotX: zFaceGeom.rotX } : {}),
        ...(isCurvedTaper ? { axis: { x: 0, y: 0, z: c.z > 0 ? -1 : 1 } } : {}),
      },
      // X 面 mortise（接 X 軸 = 前後牙板）— 下半榫，rotZ 跟 splayDx
      {
        origin: { x: c.x > 0 ? -LEG_FACE_INSET : LEG_FACE_INSET, y: apronY + apronWidth / 2 + apronLowerTenonOffset, z: Math.sign(c.z || 1) * apronMortiseOff },
        depth: apronTenonLen,
        length: apronHalfTenonH,
        width: apronTenonThick,
        through: apronTenonType === "through-tenon",
        ...(Math.abs(xFaceRotZ) > 0.001 ? { rotZ: xFaceRotZ } : {}),
        ...(isCurvedTaper ? { axis: { x: c.x > 0 ? -1 : 1, y: 0, z: 0 } } : {}),
      },
    ],
  });
  });

  // Aprons (4 sides) — butt-joint 慣例：visible.length 兩端剛好頂在腳的內側
  // 面，組裝版渲染就是 final 幾何（不重疊、不留縫）。joinery 模式靠 tenon[]
  // 加切料長度，3D 不視覺延伸。
  // 內側面距離 = length - 2*legSize - 2*legInset，再依 tapered 腳補償（drafting-math.md §A11）。
  /**
   * ⛔ 補償用的 bottomScale 必須跟**腳自己的 shape** 同一個值。
   *    這個 builder 的 tapered 腳幾何是 0.55、inverted 是 1.3（見上面 legShapeFor），
   *    但共用的 legBottomScale() 是 0.6 / 1.25 —— 兩邊各算各的，下橫撐兩端就短 0.7~1.2mm
   *    （2026-09-02 三視圖實畫稽核抓到：茶几/圓桌/餐桌錐腳下橫撐都差不到 1mm 的縫）。
   *    直接從 shape 讀，腳的幾何不動（audit-leg-shapes 指紋才不會變）。
   */
  const bottomScale = (() => {
    const sh = legShapeFor({ x: 1, z: 1 });
    return sh && "bottomScale" in sh && typeof sh.bottomScale === "number" ? sh.bottomScale : legBottomScale(legShape);
  })();
  const apronEdgeZ = width / 2 - legSize / 2 - legInset;
  const apronEdgeX = length / 2 - legSize / 2 - legInset;
  /**
   * 牙條自己的中心線(受「牙條縮進」影響),**只用在 origin**。
   * ⚠️ 長度計算(apronInnerSpan / buttHalf*)一律用上面的 apronEdge*(＝腳的中心線),
   *    把縮進算進長度會讓牙條變長、插進腳裡。
   * 0 = 齊腳外面(預設);setback = (腳寬 − 牙條厚)/2 時 === apronEdge*(舊的置中)。
   */
  const apronAxisZ = apronCenterOffset(width / 2, legInset, apronThickness, apronSetback);
  const apronAxisX = apronCenterOffset(length / 2, legInset, apronThickness, apronSetback);
  // 外斜支援 5 種：對角 splayed、單向 splayed-length（只沿 X）、splayed-width
  // （只沿 Z）、splayed-tapered（雙軸+下收）、splayed-round-tapered（圓料雙軸+下收）
  // splayDx/splayDz 分別記錄該軸是否啟用外斜，給 apron 計算對應的位移和傾角
  const isSplayedAllAxes = legShape === "splayed" || legShape === "splayed-tapered" || legShape === "splayed-round-tapered";
  // 弧肩斜腳選配外斜：牙板/橫撐長度與榫軸補償跟 splayed 走同一套（ctSplayMm=0 時不生效）。
  const splayDx =
    isSplayedAllAxes || legShape === "splayed-length" ? splayMm : ctSplayMm;
  const splayDz =
    isSplayedAllAxes || legShape === "splayed-width" ? splayMm : ctSplayMm;
  const isSplayed = splayDx > 0 || splayDz > 0;
  // 牙板上下緣：以「中軸 Y」算 splay 基準位移，讓牙板中軸跟腳中軸對齊。
  // top 邊縮、bot 邊放，bevelAngle 補償讓上下面切平（跟地面平行）。
  const apronCenterY = apronY + apronWidth / 2;
  const apronBotShift = legHeight > 0 ? 1 - apronY / legHeight : 0;
  const apronTopShift = legHeight > 0 ? 1 - (apronY + apronWidth) / legHeight : 0;
  const apronCenterShift = legHeight > 0 ? 1 - apronCenterY / legHeight : 0;
  const apronSplayX = splayDx * apronCenterShift;     // 中心（基準）
  const apronSplayZ = splayDz * apronCenterShift;
  const apronSplayXBot = splayDx * apronBotShift;
  const apronSplayZBot = splayDz * apronBotShift;
  const apronSplayXTop = splayDx * apronTopShift;
  const apronSplayZTop = splayDz * apronTopShift;
  const tiltX = splayDx > 0 ? Math.atan(splayDx / legHeight) : 0;
  const tiltZ = splayDz > 0 ? Math.atan(splayDz / legHeight) : 0;
  // tapered 補償：apron 三條 Y 位置（中、上、下）各自的腳寬
  // 圓腳（splayed-round-tapered）：apron 端面延伸到腳中心，藏進圓柱內 →
  // 從外面看不到方圓接縫（apronLegSize 設 0 表示不縮回腳邊）
  const isRoundLeg = legShape === "splayed-round-tapered";
  const apronLegSizeCenter = isRoundLeg ? 0 : legSize * legScaleAt(apronCenterY, legHeight, bottomScale);
  const apronLegSizeTop = isRoundLeg ? 0 : legSize * legScaleAt(apronY + apronWidth, legHeight, bottomScale);
  const apronLegSizeBot = isRoundLeg ? 0 : legSize * legScaleAt(apronY, legHeight, bottomScale);
  const apronInnerSpan = {
    x: 2 * apronEdgeX - apronLegSizeCenter,
    z: 2 * apronEdgeZ - apronLegSizeCenter,
  };
  // butt-joint 半長：腳中心 + splay 偏移 - apronLegSize/2 = 腳內面（在 apron Y 處）位置
  const buttHalfX = (splay: number) => apronEdgeX + splay - apronLegSizeCenter / 2;
  const buttHalfZ = (splay: number) => apronEdgeZ + splay - apronLegSizeCenter / 2;
  const buttHalfXTop = (splay: number) => apronEdgeX + splay - apronLegSizeTop / 2;
  const buttHalfXBot = (splay: number) => apronEdgeX + splay - apronLegSizeBot / 2;
  const buttHalfZTop = (splay: number) => apronEdgeZ + splay - apronLegSizeTop / 2;
  const buttHalfZBot = (splay: number) => apronEdgeZ + splay - apronLegSizeBot / 2;
  const apronSides = [
    {
      key: "front",
      nameZh: "前牙條",
      // 前後牙板沿 X 軸 → 跨距受 X 軸外斜影響
      visibleLength: apronInnerSpan.x + 2 * apronSplayX,
      axis: "x" as const,
      sx: 0,
      sz: -1,
      // Z 位移由 Z 軸外斜決定
      origin: { x: 0, z: -(apronAxisZ + apronSplayZ) },
    },
    {
      key: "back",
      nameZh: "後牙條",
      visibleLength: apronInnerSpan.x + 2 * apronSplayX,
      axis: "x" as const,
      sx: 0,
      sz: 1,
      origin: { x: 0, z: apronAxisZ + apronSplayZ },
    },
    {
      key: "left",
      nameZh: "左牙條",
      // 左右牙板沿 Z 軸 → 跨距受 Z 軸外斜影響
      visibleLength: apronInnerSpan.z + 2 * apronSplayZ,
      axis: "z" as const,
      sx: -1,
      sz: 0,
      origin: { x: -(apronAxisX + apronSplayX), z: 0 },
    },
    {
      key: "right",
      nameZh: "右牙條",
      visibleLength: apronInnerSpan.z + 2 * apronSplayZ,
      axis: "z" as const,
      sx: 1,
      sz: 0,
      origin: { x: apronAxisX + apronSplayX, z: 0 },
    },
  ];
  const aprons: Part[] = !withApron ? [] : apronSides
    .filter((s) => !(opts.skipFrontApron && s.key === "front"))
    .map((s) => {
    // axis-specific：單向斜也觸發 tenon axis（axis="x" 牙條只受 splayDx、axis="z" 只受 splayDz）
    const hasAxisSplay = (s.axis === "x" && splayDx > 0) || (s.axis === "z" && splayDz > 0);
    const startCornerSx = (s.axis === "x" ? -1 : s.sx) as -1 | 0 | 1;
    // axis="z" 牙條 start at part-local -X → world +Z（Rx π/2 + Ry π/2 後）
    const startCornerSz = (s.axis === "z" ? +1 : s.sz) as -1 | 0 | 1;
    const endCornerSx = (s.axis === "x" ? +1 : s.sx) as -1 | 0 | 1;
    // axis="z" 牙條 end at part-local +X → world -Z
    const endCornerSz = (s.axis === "z" ? -1 : s.sz) as -1 | 0 | 1;
    const splayAngleDegLocal = legHeight > 0 ? Math.atan(splayMm / legHeight) * 180 / Math.PI : 0;
    const tenonAxisStart = hasAxisSplay
      ? computeCompoundSplayNormal({ apronAxis: s.axis, cornerSx: startCornerSx, cornerSz: startCornerSz, splayAngleDeg: splayAngleDegLocal })
      : null;
    const tenonAxisEnd = hasAxisSplay
      ? computeCompoundSplayNormal({ apronAxis: s.axis, cornerSx: endCornerSx, cornerSz: endCornerSz, splayAngleDeg: splayAngleDegLocal })
      : null;
    const bevelAngle = isSplayed
      ? s.axis === "x" ? -s.sz * tiltZ : -s.sx * tiltX
      : 0;
    // 同軸有 splay 或 tapered → 梯形：以中軸對齊腳中軸，top/bot 各算 scale。
    // 用 butt-joint 半長算比例，跟 visible.length 慣例一致（含 taper 補償）。
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
    // bevel 規則：
    //   apronOffset === 0（牙板頂面貼座板）+ isSplayed → half-bevel（頂面水平、底面跟腳斜）
    //   apronOffset > 0（牙板離座板有縫）→ 不套 bevelAngle，跟下橫撐一樣只用
    //     trapezoid + rotation tilt（否則 full bevel 會跟 rotation tilt 抵消，
    //     視覺看起來牙板是水平矩形，沒跟著腳斜）
    const apronTopAtTop = apronOffset === 0;
    const useHalfBevel = isSplayed && apronTopAtTop;
    const apronBevelAngle = useHalfBevel ? bevelAngle : 0;
    // 牙條造型優先（同 square-stool）：梯形補償以 top/bottomLengthScale 合成進輪廓；
    // 外斜頂面斜切無法合成 → 捨棄（頂緣外角微陷桌面底、藏在板內看不見）。none 走原路 byte 不變。
    const partShape = apronProfile !== "none"
      ? { kind: "edge-profile" as const, style: apronProfile as "arch" | "arch-out" | "kunmen" | "wave" | "double-arch", depthMm: apronProfileDepthEff, waveCount: 4, topLengthScale: trapTopScale ?? 1, bottomLengthScale: trapBotScale ?? 1 }
      : trapTopScale !== null
      ? { kind: "apron-trapezoid" as const, topLengthScale: trapTopScale, bottomLengthScale: trapBotScale, bevelAngle: apronBevelAngle || undefined, bevelMode: useHalfBevel ? "half" as const : undefined }
      : isSplayed && useHalfBevel
        ? { kind: "apron-beveled" as const, bevelAngle }
        : legEdgeShape(
            opts.apronEdge ?? opts.stretcherEdge,
            opts.apronEdgeStyle ?? opts.stretcherEdgeStyle,
          );
    // 半榫指派：靜止 Z（左右）= 上半榫（保留 top 肩 + 10mm 上肩）；移動 X（前後）= 下半榫（無上下肩）
    const tenonType: "through-tenon" | "shouldered-tenon" =
      apronTenonType === "through-tenon" ? "through-tenon" : "shouldered-tenon";
    const isUpper = s.axis === "z";
    const tenonH = apronCanHalfStagger ? apronHalfTenonH : apronTenonWidth;
    const worldOffset = apronCanHalfStagger
      ? (isUpper ? apronUpperTenonOffset : apronLowerTenonOffset)
      : 0;
    const shoulderOn: Array<"top" | "bottom" | "left" | "right"> = apronCanHalfStagger
      ? (isUpper ? ["top", "left", "right"] : ["left", "right"])
      : ["top", "bottom", "left", "right"];
    return {
      id: `apron-${s.key}`,
      nameZh: s.nameZh,
      material,
      grainDirection: "length" as const,
      visible: {
        length: s.visibleLength,
        width: apronWidth,
        thickness: apronThickness,
      },
      origin: { x: s.origin.x, y: apronY, z: s.origin.z },
      rotation: s.axis === "z"
        ? { x: Math.PI / 2, y: Math.PI / 2, z: s.sx * tiltX }
        : { x: Math.PI / 2 + (-s.sz) * tiltZ, y: 0, z: 0 },
      shape: partShape,
      tenons: [
        {
          position: "start" as const,
          type: tenonType,
          length: apronTenonLen,
          width: tenonH,
          thickness: apronTenonThick,
          shoulderOn,
          offsetWidth: -worldOffset,
          ...(tenonAxisStart ? { axis: tenonAxisStart } : {}),
        },
        {
          position: "end" as const,
          type: tenonType,
          length: apronTenonLen,
          width: tenonH,
          thickness: apronTenonThick,
          shoulderOn,
          offsetWidth: -worldOffset,
          ...(tenonAxisEnd ? { axis: tenonAxisEnd } : {}),
        },
      ],
      mortises: [],
    };
  });

  const parts: Part[] = [topPanel, ...legs, ...aprons];

  // Breadboard ends（端板）—— 與桌面正交紋理，防止跨度大時翹曲
  // 端板擺在桌面長度方向兩端，紋理沿桌面寬度方向（grainDirection: "width"）
  // 接合：tongue-and-groove，中央用一根穿釘固定、其餘鬆配讓桌面熱漲冷縮
  if (opts.withBreadboardEnds) {
    const bbWidth = opts.breadboardWidth ?? 60;
    const bbThickness = topThickness; // 跟桌面齊平
    // 端板 length = 桌面寬（width 軸），width = bbWidth（沿桌面 length 軸延伸），thickness = 桌面厚
    // 沒 rotation：local length=X, width=Z, thickness=Y。要讓 length 方向跑 Z 軸 → rotation y=π/2
    const bbY = topPanel.origin.y;
    for (const sx of [-1, 1] as const) {
      parts.push({
        id: `breadboard-${sx < 0 ? "left" : "right"}`,
        nameZh: sx < 0 ? "左端板" : "右端板",
        material,
        grainDirection: "length",
        visible: { length: topWid, width: bbWidth, thickness: bbThickness },
        origin: { x: sx * (topLen / 2 + bbWidth / 2), y: bbY, z: 0 },
        rotation: { x: 0, y: Math.PI / 2, z: 0 },
        tenons: [],
        mortises: [],
      });
    }
  }

  // Drop-leaf 翻板（沿 length 軸 ±X 端延伸）。展開狀態下 = 與主桌面共面
  // 接合：蝶式鉸鏈一對 / 端面一條，使用者收合時可垂下
  if (opts.dropLeaf && opts.dropLeaf !== "none") {
    const leafLen = opts.dropLeafWidth ?? 250;
    const leafSides = opts.dropLeaf === "two-sides" ? [-1, 1] : [1];
    for (const sx of leafSides) {
      parts.push({
        id: `drop-leaf-${sx < 0 ? "left" : "right"}`,
        nameZh: `${sx < 0 ? "左" : "右"}翻板`,
        material,
        grainDirection: "length",
        // 翻板 length = 桌面寬（width 軸），width = leafLen（沿長度軸延伸），thickness = topT
        visible: { length: topWid, width: leafLen, thickness: topThickness },
        origin: { x: sx * (topLen / 2 + leafLen / 2), y: legHeight, z: 0 },
        rotation: { x: 0, y: Math.PI / 2, z: 0 },
        tenons: [],
        mortises: [],
      });
    }
  }

  // Optional 4 lower stretchers (連腳橫撐), default ≈ 22% of leg height
  if (withLowerStretchers) {
    // 用常數而非 hardcode，bench 的 under-shelf 才能算對 stretcher 頂面位置
    const stretcherY = opts.lowerStretcherHeight ?? Math.round(legHeight * LOWER_STRETCHER_HEIGHT_RATIO);
    const stretcherWidth = opts.lowerStretcherWidth ?? 30;
    const stretcherThickness = opts.lowerStretcherThickness ?? 18;
    // 下橫撐 ↔ 腳：autoTenonType + legPenetratingTenon override + 通榫補 +5mm（同 square-stool）
    // 弧肩斜腳非明榫時強制盲榫（不自動通榫戳出斜面）。
    const lowerTenonType = legPenetratingTenon
      ? "through-tenon"
      : isCurvedTaper
        ? "blind-tenon"
        : autoTenonType(legSize);
    const lowerTenonStd = standardTenon({
      type: lowerTenonType,
      childThickness: stretcherThickness,
      childWidth: stretcherWidth,
      motherThickness: legSize,
    });
    const tenonLenRaw = lowerTenonStd.length + (lowerTenonType === "through-tenon" ? 5 : 0);
    // 弧肩斜腳：下橫撐接在斜降窄區，把榫長 clamp 到「該高度實際腳寬 − 3mm」內才不戳出斜面
    // （legXDepthLS 公式照搬 square-stool：外面垂直、只內面收窄，材料 X 深 = legSize×(1+scale)/2）。
    const ctStretcherNarrow = isCurvedTaper
      ? Math.max(8, (legSize * (1 + curvedTaperInnerScaleAt(stretcherY + stretcherWidth / 2, legHeight, legSize, ctBlockEff, ctShoulder, ctInset, ctLowerCoveRange, ctSCurve))) / 2)
      : legSize;
    const tenonLen = isCurvedTaper
      ? Math.max(6, Math.min(tenonLenRaw, Math.floor(ctStretcherNarrow - 3)))
      : tenonLenRaw;
    const tenonThick = lowerTenonStd.thickness;
    const tenonW = lowerTenonStd.width;
    // 半榫錯位（stagger 預設 0）：靜止 X（前後）= 下半榫；移動 Z（左右）= 上半榫
    // 下橫撐上下都不留肩
    const LOWER_HALF_TENON_GAP = 4;
    const lowerCanHalfStagger = stretcherWidth >= 16;
    const lowerHalfTenonH = lowerCanHalfStagger
      ? Math.min(tenonW, Math.floor((stretcherWidth - LOWER_HALF_TENON_GAP) / 2))
      : tenonW;
    // part-local：stretcherWidth 是 Y 軸；中心 = stretcherWidth/2
    const lowerUpperTenonOffset = lowerCanHalfStagger ? (stretcherWidth / 2 - lowerHalfTenonH / 2) : 0;
    const lowerLowerTenonOffset = lowerCanHalfStagger ? (lowerHalfTenonH / 2 - stretcherWidth / 2) : 0;
    // 下橫撐：以中軸對齊腳中軸，top/bot 都從中心向外/向內推
    const sCenterY = stretcherY + stretcherWidth / 2;
    const sBotShift = legHeight > 0 ? 1 - stretcherY / legHeight : 0;
    const sTopShift = legHeight > 0 ? 1 - (stretcherY + stretcherWidth) / legHeight : 0;
    const sCenterShift = legHeight > 0 ? 1 - sCenterY / legHeight : 0;
    const sSplayX = splayDx * sCenterShift;       // 中心
    const sSplayZ = splayDz * sCenterShift;
    const sSplayXBot = splayDx * sBotShift;
    const sSplayZBot = splayDz * sBotShift;
    const sSplayXTop = splayDx * sTopShift;
    const sSplayZTop = splayDz * sTopShift;
    // tapered 補償：下橫撐三條 Y 位置（中、上、下）各自的腳寬
    // 圓腳：sLegSize 設 0 → 下橫撐端伸進腳中心藏接縫（同 apron 處理）
    // visible.length 一律算到腳內面（leg-inner-to-leg-inner），與 apron 同慣例
    // (§A10 butt-joint)。3D 防 z-fighting 的插入量屬渲染細節、不烤進 visible.length，
    // 否則三視圖會把橫撐實體畫進腳裡。
    // 弧肩斜腳（curved-taper）：內面收窄只發生在腳的 X 面（2D 側輪廓沿 Z 擠出、Z 面全寬）。
    // X 下橫撐長度要用 curvedTaperInnerScaleAt 對到「該高度實際內面」（§A11），Z 不補償。
    // 上面榫長 clamp（ctStretcherNarrow）早就按窄面算，這裡是漏掉的長度補償
    // （bench 弧肩斜腳下橫撐兩端懸空，user 2026-08-05 截圖回報）。
    // 非 curved-taper 時兩式等價（走 legScaleAt）→ 既有輸出 byte 不變。
    const sScaleAtX = (y: number): number =>
      isCurvedTaper
        ? curvedTaperInnerScaleAt(y, legHeight, legSize, ctBlockEff, ctShoulder, ctInset, ctLowerCoveRange, ctSCurve)
        : legScaleAt(y, legHeight, bottomScale);
    const sLegSizeCenterX = isRoundLeg ? 0 : legSize * sScaleAtX(sCenterY);
    const sLegSizeTopX = isRoundLeg ? 0 : legSize * sScaleAtX(stretcherY + stretcherWidth);
    const sLegSizeBotX = isRoundLeg ? 0 : legSize * sScaleAtX(stretcherY);
    const sLegSizeCenter = isRoundLeg ? 0 : legSize * legScaleAt(sCenterY, legHeight, bottomScale);
    const sLegSizeTop = isRoundLeg ? 0 : legSize * legScaleAt(stretcherY + stretcherWidth, legHeight, bottomScale);
    const sLegSizeBot = isRoundLeg ? 0 : legSize * legScaleAt(stretcherY, legHeight, bottomScale);
    const sInnerSpan = {
      x: 2 * apronEdgeX - sLegSizeCenterX,
      z: 2 * apronEdgeZ - sLegSizeCenter,
    };
    const sButtHalfX = (splay: number) => apronEdgeX + splay - sLegSizeCenterX / 2;
    const sButtHalfZ = (splay: number) => apronEdgeZ + splay - sLegSizeCenter / 2;
    const sButtHalfXTop = (splay: number) => apronEdgeX + splay - sLegSizeTopX / 2;
    const sButtHalfXBot = (splay: number) => apronEdgeX + splay - sLegSizeBotX / 2;
    const sButtHalfZTop = (splay: number) => apronEdgeZ + splay - sLegSizeTop / 2;
    const sButtHalfZBot = (splay: number) => apronEdgeZ + splay - sLegSizeBot / 2;
    const lowerSides = [
      { key: "ls-front", nameZh: "前下橫撐", visibleLength: sInnerSpan.x + 2 * sSplayX, axis: "x" as const, sx: 0, sz: -1, origin: { x: 0, z: -(lsAxisZ + sSplayZ) } },
      { key: "ls-back", nameZh: "後下橫撐", visibleLength: sInnerSpan.x + 2 * sSplayX, axis: "x" as const, sx: 0, sz: 1, origin: { x: 0, z: lsAxisZ + sSplayZ } },
      { key: "ls-left", nameZh: "左下橫撐", visibleLength: sInnerSpan.z + 2 * sSplayZ, axis: "z" as const, sx: -1, sz: 0, origin: { x: -(lsAxisX + sSplayX), z: 0 } },
      { key: "ls-right", nameZh: "右下橫撐", visibleLength: sInnerSpan.z + 2 * sSplayZ, axis: "z" as const, sx: 1, sz: 0, origin: { x: lsAxisX + sSplayX, z: 0 } },
    ];
    for (const s of lowerSides) {
      const bevelAngle = isSplayed
        ? s.axis === "x" ? -s.sz * tiltZ : -s.sx * tiltX
        : 0;
      // curved-taper 的 X 下橫撐端面要貼「隨高度收窄的斜面」→ 也走梯形補償
      const hasShapeBend = splayDx > 0 || splayDz > 0 || bottomScale !== 1 || (isCurvedTaper && s.axis === "x");
      const trapTopScale =
        s.axis === "x" && hasShapeBend
          ? sButtHalfXTop(sSplayXTop) / sButtHalfX(sSplayX)
          : s.axis === "z" && hasShapeBend
            ? sButtHalfZTop(sSplayZTop) / sButtHalfZ(sSplayZ)
            : null;
      const trapBotScale =
        s.axis === "x" && hasShapeBend
          ? sButtHalfXBot(sSplayXBot) / sButtHalfX(sSplayX)
          : s.axis === "z" && hasShapeBend
            ? sButtHalfZBot(sSplayZBot) / sButtHalfZ(sSplayZ)
            : 1;
      // 下橫撐：保留 trapezoid（避免接縫），完全沒 bevel（上下自由邊跟腳斜）
      // 造型優先：梯形補償合成進輪廓（同牙條）。none 走原路 byte 不變。
      const stretcherProfile = opts.stretcherProfile ?? "none";
      const stretcherProfileDepthEff =
        stretcherProfile !== "none"
          ? ((opts.stretcherProfileDepth ?? 0) > 0 ? (opts.stretcherProfileDepth ?? 0) : Math.round(stretcherWidth * 0.4))
          : 0;
      const lsShape = stretcherProfile !== "none"
        ? { kind: "edge-profile" as const, style: stretcherProfile as "arch" | "top-arch" | "kunmen" | "wave" | "double-arch", depthMm: stretcherProfileDepthEff, waveCount: 4, topLengthScale: trapTopScale ?? 1, bottomLengthScale: trapBotScale ?? 1 }
        : trapTopScale !== null
        ? { kind: "apron-trapezoid" as const, topLengthScale: trapTopScale, bottomLengthScale: trapBotScale }
        : legEdgeShape(opts.stretcherEdge, opts.stretcherEdgeStyle);
      // 半榫指派：靜止 X（前後）= 下半榫；移動 Z（左右）= 上半榫；上下都不留肩
      const lsTenonType: "through-tenon" | "blind-tenon" =
        lowerTenonType === "through-tenon" ? "through-tenon" : "blind-tenon";
      const isUpperLs = s.axis === "z";
      const lsTenonH = lowerCanHalfStagger ? lowerHalfTenonH : tenonW;
      const lsWorldOffset = lowerCanHalfStagger
        ? (isUpperLs ? lowerUpperTenonOffset : lowerLowerTenonOffset)
        : 0;
      const lsShoulderOn: Array<"top" | "bottom" | "left" | "right"> = ["left", "right"];
      // splay tenon axis（axis-specific：單向斜也觸發、axis="z" 反轉 cornerSz）
      const lsHasAxisSplay = (s.axis === "x" && splayDx > 0) || (s.axis === "z" && splayDz > 0);
      const lsStartCornerSx = (s.axis === "x" ? -1 : s.sx) as -1 | 0 | 1;
      const lsStartCornerSz = (s.axis === "z" ? +1 : s.sz) as -1 | 0 | 1;
      const lsEndCornerSx = (s.axis === "x" ? +1 : s.sx) as -1 | 0 | 1;
      const lsEndCornerSz = (s.axis === "z" ? -1 : s.sz) as -1 | 0 | 1;
      const lsSplayAngleDegLocal = legHeight > 0 ? Math.atan(splayMm / legHeight) * 180 / Math.PI : 0;
      const lsTenonAxisStart = lsHasAxisSplay
        ? computeCompoundSplayNormal({ apronAxis: s.axis, cornerSx: lsStartCornerSx, cornerSz: lsStartCornerSz, splayAngleDeg: lsSplayAngleDegLocal })
        : null;
      const lsTenonAxisEnd = lsHasAxisSplay
        ? computeCompoundSplayNormal({ apronAxis: s.axis, cornerSx: lsEndCornerSx, cornerSz: lsEndCornerSz, splayAngleDeg: lsSplayAngleDegLocal })
        : null;
      parts.push({
        id: s.key,
        nameZh: s.nameZh,
        material,
        grainDirection: "length",
        visible: { length: s.visibleLength, width: stretcherWidth, thickness: stretcherThickness },
        origin: { x: s.origin.x, y: stretcherY, z: s.origin.z },
        rotation: s.axis === "z"
          ? { x: Math.PI / 2, y: Math.PI / 2, z: s.sx * tiltX }
          : { x: Math.PI / 2 + (-s.sz) * tiltZ, y: 0, z: 0 },
        shape: lsShape,
        tenons: [
          { position: "start", type: lsTenonType, length: tenonLen, width: lsTenonH, thickness: tenonThick, shoulderOn: lsShoulderOn, offsetWidth: -lsWorldOffset, ...(lsTenonAxisStart ? { axis: lsTenonAxisStart } : {}) },
          { position: "end", type: lsTenonType, length: tenonLen, width: lsTenonH, thickness: tenonThick, shoulderOn: lsShoulderOn, offsetWidth: -lsWorldOffset, ...(lsTenonAxisEnd ? { axis: lsTenonAxisEnd } : {}) },
        ],
        mortises: [],
      });
    }
    // 補腳上下橫撐 mortise（套 b3f09ad 公約跟 apron 一致）
    // Z 面 mortise 接 Z 軸下橫撐（左右）— 上半榫，rotX 跟 splayDz
    // X 面 mortise 接 X 軸下橫撐（前後）— 下半榫，rotZ 跟 splayDx
    const lsCenterY = stretcherY + stretcherWidth / 2;
    const lsThrough = lowerTenonType === "through-tenon";
    for (const leg of legs) {
      const cx = leg.origin.x;
      const cz = leg.origin.z;
      // 弧肩斜腳：3D 挖下橫撐母榫會從斜降窄區破出。跟牙板同處理——榫眼照建、標
      // Mortise.axis，3D 靠 CSG 過濾器跳過維持乾淨，圖面拿回真實孔位（見上方註解）。
      const lsZRotX = (splayDz > 0 && legHeight > 0)
        ? Math.sign(cz || 1) * Math.atan(splayDz / legHeight)
        : 0;
      const lsXRotZ = (splayDx > 0 && legHeight > 0)
        ? -Math.sign(cx || 1) * Math.atan(splayDx / legHeight)
        : 0;
      leg.mortises.push(
        {
          origin: { x: Math.sign(cx || 1) * lsMortiseOff, y: lsCenterY + lowerUpperTenonOffset, z: cz > 0 ? -LEG_FACE_INSET : LEG_FACE_INSET },
          depth: tenonLen,
          length: lowerCanHalfStagger ? lowerHalfTenonH : tenonW,
          width: tenonThick,
          through: lsThrough,
          ...(Math.abs(lsZRotX) > 0.001 ? { rotX: lsZRotX } : {}),
          ...(isCurvedTaper ? { axis: { x: 0, y: 0, z: cz > 0 ? -1 : 1 } } : {}),
        },
        {
          origin: { x: cx > 0 ? -LEG_FACE_INSET : LEG_FACE_INSET, y: lsCenterY + lowerLowerTenonOffset, z: Math.sign(cz || 1) * lsMortiseOff },
          depth: tenonLen,
          length: lowerCanHalfStagger ? lowerHalfTenonH : tenonW,
          width: tenonThick,
          through: lsThrough,
          ...(Math.abs(lsXRotZ) > 0.001 ? { rotZ: lsXRotZ } : {}),
          ...(isCurvedTaper ? { axis: { x: cx > 0 ? -1 : 1, y: 0, z: 0 } } : {}),
        },
      );
    }

    // 下橫撐置物條（slat rack）：在前後下橫撐之間架 N 條格柵
    // 條嵌在前後 stretcher 中間，中心軸跟 stretcher 中心軸對齊
    // 條 X 位置在 leg 內側等距分佈（N+1 個 gap 等寬）
    //
    // 斜腳補償：stretcher 是 tilted 的（top 內、bot 外）。slat 兩端要梯形：
    //   top edge 短到 stretcher inner face 在 slat top Y 的位置
    //   bot edge 長到 stretcher inner face 在 slat bot Y 的位置
    // 用 apron-trapezoid shape；rotation { x: π/2, y: π/2 } 讓 local Z 對應
    // 世界 Y 軸（trapezoid 沿 local Z 內插 = 沿世界 Y 內插）。
    // visible 慣例改成 length=slatLen / width=slatThickness / thickness=slatWidth，
    // 配合 rotation 才會 yExt=slatThickness、xExt=slatWidth、zExt=slatLen。
    if (opts.withSlatRack) {
      // slatCount 預設依桌長自動算：每 ~150mm 一條（min 3、max 12）。
      // option spec 預設值 0 = 用此自動公式；> 0 = 使用者指定。
      const slatCountAuto = Math.max(3, Math.min(12, Math.round(length / 150)));
      const slatCountInput = opts.slatCount ?? 0;
      const slatCount = slatCountInput > 0
        ? Math.max(2, Math.min(20, slatCountInput))
        : slatCountAuto;
      const slatWidth = Math.max(15, opts.slatWidth ?? 35);
      const slatThickness = Math.max(8, opts.slatThickness ?? 18);
      const slatCenterY = stretcherY + stretcherWidth / 2;
      const slatY = slatCenterY - slatThickness / 2;
      const slatTopY = slatY + slatThickness;
      const slatBotY = slatY;
      const slatTopShift = legHeight > 0 ? 1 - slatTopY / legHeight : 0;
      const slatBotShift = legHeight > 0 ? 1 - slatBotY / legHeight : 0;
      const slatHalfAtTop = apronEdgeZ + splayDz * slatTopShift - stretcherThickness / 2;
      const slatHalfAtBot = apronEdgeZ + splayDz * slatBotShift - stretcherThickness / 2;
      const slatRefHalf = Math.max(slatHalfAtTop, slatHalfAtBot, 25);
      const slatLen = 2 * slatRefHalf;
      const slatTopLengthScale = slatRefHalf > 0 ? slatHalfAtTop / slatRefHalf : 1;
      const slatBotLengthScale = slatRefHalf > 0 ? slatHalfAtBot / slatRefHalf : 1;
      const slatNeedsTrapezoid = splayDz > 0 && Math.abs(slatTopLengthScale - slatBotLengthScale) > 0.001;
      // X span：從左腳內面到右腳內面（apronInnerSpan.x）
      const slatXSpan = 2 * apronEdgeX - legSize;
      // 等距分佈：N+1 個 gap（兩端到腳 + 條跟條之間）全部等寬，避免兩端條貼腳
      const gapCount = slatCount + 1;
      const gap = Math.max(0, (slatXSpan - slatCount * slatWidth) / gapCount);
      // apron-trapezoid 沿 local Z 內插（zL=-lz/2 → topLengthScale，zL=+lz/2 → bot）。
      // 我們的 slat rotation 後 local Z 映射到 world -Y（local Z=+ → world Y=−）。
      // 所以 local Z=-lz/2（trapezoid 的 "top"）對應 world Y top（slat 高處）。
      const slatShape = slatNeedsTrapezoid
        ? { kind: "apron-trapezoid" as const, topLengthScale: slatTopLengthScale, bottomLengthScale: slatBotLengthScale }
        : undefined;
      // slat → stretcher 盲榫：橫向 cross-section（world X 方向，跟 ly=slatWidth 對應）
      // 用 slatWidth-12（兩端各 6mm 肩）；垂直 cross-section（world Y 方向，跟
      // lz=slatThickness 對應）用 min(slatThickness-4, 12)；榫深 8mm。
      const slatTenonLen = 8;
      const slatTenonThick = Math.max(8, slatWidth - 12);
      const slatTenonW = Math.max(6, Math.min(slatThickness - 4, 12));
      const slatXs: number[] = [];
      for (let i = 0; i < slatCount; i++) {
        const slatX = -slatXSpan / 2 + gap + slatWidth / 2 + i * (gap + slatWidth);
        slatXs.push(slatX);
        parts.push({
          id: `slat-${i + 1}`,
          nameZh: `置物條 ${i + 1}`,
          material,
          grainDirection: "length",
          // visible 慣例（搭配 rotation x=π/2, y=π/2）：
          //   length=slatLen → world Z（前後跨）
          //   width=slatThickness → 經 rotation 後成 world Y（垂直厚）
          //   thickness=slatWidth → 經 rotation 後成 world X（橫）
          visible: { length: slatLen, width: slatThickness, thickness: slatWidth },
          origin: { x: slatX, y: slatY, z: 0 },
          rotation: { x: Math.PI / 2, y: Math.PI / 2, z: 0 },
          shape: slatShape,
          tenons: [
            {
              position: "start",
              type: "blind-tenon",
              length: slatTenonLen,
              width: slatTenonW,
              thickness: slatTenonThick,
              shoulderOn: ["top", "bottom", "left", "right"],
            },
            {
              position: "end",
              type: "blind-tenon",
              length: slatTenonLen,
              width: slatTenonW,
              thickness: slatTenonThick,
              shoulderOn: ["top", "bottom", "left", "right"],
            },
          ],
          mortises: [],
        });
      }
      // 對應母榫 mortises 加在前後下橫撐 (ls-front, ls-back)
      const lsFront = parts.find((p) => p.id === "ls-front");
      const lsBack = parts.find((p) => p.id === "ls-back");
      const lsCenterYWorld = stretcherY + stretcherWidth / 2;
      // stretcher local 軸：local +Y 對 ls-front 是 inner（指向中心 +Z）；對
      // ls-back 是 outer（指向 +Z 外）。對 back 來說 inner = local -Y。
      // mortise.origin.z（stretcher local Z）對應世界 -Y，slat 在世界 Y =
      // lsCenterYWorld 處，跟 stretcher 中心 Y 一樣 → local z = 0。
      for (const slatX of slatXs) {
        if (lsFront) {
          lsFront.mortises.push({
            origin: { x: slatX, y: stretcherThickness / 2 - slatTenonLen / 2, z: 0 },
            depth: slatTenonLen,
            length: slatTenonThick,
            width: slatTenonW,
            through: false,
          });
        }
        if (lsBack) {
          lsBack.mortises.push({
            origin: { x: slatX, y: -stretcherThickness / 2 + slatTenonLen / 2, z: 0 },
            depth: slatTenonLen,
            length: slatTenonThick,
            width: slatTenonW,
            through: false,
          });
        }
      }
      // 用掉 lsCenterYWorld 變數（為了未來擴充非 center-aligned slat）
      void lsCenterYWorld;
    }
  }

  // Optional center stretcher (for long tables)
  // 中央橫撐母件 = 牙板，沒牙板就沒地方接 → skip
  if (withCenterStretcher && withApron) {
    const stretcherWidth = opts.centerStretcherWidth ?? 50;
    const stretcherThickness = opts.centerStretcherThickness ?? 25;
    // Tenon length must fit INSIDE the apron (apron is the mother here), not
    // poke through to the outside. 改 ≤ apronThickness × 2/3，留 ~7mm 木料而非 4mm，
    // 視覺上不再像穿透；標準盲榫深度也是 mother × 2/3。
    const stretcherTenonLen = Math.max(6, Math.min(apronTenonLen, Math.floor(apronThickness * 2 / 3)));
    // Body length: from front-apron INNER face to back-apron INNER face.
    // (Tenon protrudes INTO each apron by stretcherTenonLen beyond this body.)
    // 斜腳補償（splayDz）：apron 在 stretcher Y 高度被外推 splayDz*shift，body 跟著
    // 拉長才能 butt 到 apron inner face。但 apron 是 tilted（apron-trapezoid +
    // tiltZ）：inner face 在 stretcher TOP Y 最內側、BOTTOM Y 最外側。
    //
    // 模仿下橫撐 (line 575-589)：bodyLen 用 BOTTOM Y 算（最寬處），再套
    // apron-trapezoid 讓 top edge 縮短 = halfAtTop / halfAtBot。這樣 stretcher
    // 兩端都剛好 butt apron inner face，沒 gap 也沒 overlap。
    // 預設 drop=0 → stretcher 頂面跟牙板上緣切齊（4-leg 桌子最常見的工法、視覺
    // 上跟牙板連成一氣）。dining-table 仍可透過 centerStretcherDrop option 自訂
    // 往下偏移。
    const dropFromApronTop = opts.centerStretcherDrop ?? 0;
    const originY = Math.max(
      apronY,
      apronY + apronWidth - dropFromApronTop - stretcherWidth,
    );
    const csTopShift = legHeight > 0 ? 1 - (originY + stretcherWidth) / legHeight : 0;
    const csBotShift = legHeight > 0 ? 1 - originY / legHeight : 0;
    const csHalfAtTop = apronEdgeZ + splayDz * csTopShift - apronThickness / 2;
    const csHalfAtBot = apronEdgeZ + splayDz * csBotShift - apronThickness / 2;
    const csReferenceHalf = Math.max(csHalfAtTop, csHalfAtBot, 25);
    const bodyLen = Math.max(50, 2 * csReferenceHalf);
    const csTopLengthScale = csReferenceHalf > 0 ? csHalfAtTop / csReferenceHalf : 1;
    const csBotLengthScale = csReferenceHalf > 0 ? csHalfAtBot / csReferenceHalf : 1;
    const csNeedsTrapezoid = splayDz > 0 && Math.abs(csTopLengthScale - csBotLengthScale) > 0.001;
    // 橫撐 → 牙板：榫頭兩軸的尺寸+肩位指派
    //   tenon.thickness 走 stretcher local Y = world 水平 = 25mm（橫撐 thickness）
    //     橫向**不開肩**（用 stretcherThickness 全值，shoulderOn 移除 top/bottom）。
    //     開肩會把橫向縮到 15mm 太窄，木紋脆弱。
    //   tenon.width 走 stretcher local Z = world 垂直 = 50mm（橫撐 width）
    //     縱向開肩，用 1/3 母件牙板高（apronWidth/3 ≈ 17），結構強度足夠。
    const cTenonThick = Math.max(8, stretcherThickness); // 全跨無肩
    const cTenonW = Math.max(
      8,
      Math.min(stretcherWidth - 2 * MIN_SHOULDER_MM, Math.round(apronWidth * TENON_THICKNESS_RATIO)),
    ); // 1/3 母件 + 上下肩
    parts.push({
      id: "center-stretcher",
      nameZh: "中央牙條",
      material,
      grainDirection: "length",
      visible: {
        length: bodyLen,
        width: stretcherWidth,
        thickness: stretcherThickness,
      },
      origin: { x: 0, y: originY, z: 0 },
      rotation: { x: Math.PI / 2, y: Math.PI / 2, z: 0 },
      shape: csNeedsTrapezoid
        ? { kind: "apron-trapezoid" as const, topLengthScale: csTopLengthScale, bottomLengthScale: csBotLengthScale }
        : legEdgeShape(opts.stretcherEdge, opts.stretcherEdgeStyle),
      tenons: [
        {
          position: "start",
          type: "blind-tenon",
          length: stretcherTenonLen,
          width: cTenonW,
          thickness: cTenonThick,
          // 橫向（top/bottom = ±thickness 軸）無肩，全跨橫撐橫向
          shoulderOn: ["left", "right"],
        },
        {
          position: "end",
          type: "blind-tenon",
          length: stretcherTenonLen,
          width: cTenonW,
          thickness: cTenonThick,
          shoulderOn: ["left", "right"],
        },
      ],
      mortises: [],
    });
    // Apron-front / apron-back 加 mortise 接 center-stretcher 兩端 tenon。
    // apron 的 part-local 慣例（rotation x=π/2）：local +Y → world +Z。
    //   apron-front (world Z<0) 的 inner face = local +Y → origin.y 靠 +Y face
    //   apron-back  (world Z>0) 的 inner face = local -Y → origin.y 靠 -Y face
    // mortise.length × .width 對應 stretcher tenon.width × .thickness。
    const apronFrontPart = parts.find((p) => p.id === "apron-front");
    const apronBackPart = parts.find((p) => p.id === "apron-back");
    if (apronFrontPart && apronBackPart) {
      const stretcherCenterY = originY + stretcherWidth / 2;
      const apronCenterY = apronY + apronWidth / 2;
      // apron-local +Z → world -Y，所以 stretcher 在 world Y 高於 apron 中心
      // → apron-local Z 為負；low-table 預設 stretcher 跟 apron 中心線基本對齊
      // 但有 dropFromApronTop 偏移時這個 zOffset 才不為 0。
      const zOffset = apronCenterY - stretcherCenterY;
      // mortise.length → apron local X = world 水平 → 對應 tenon.thickness（橫撐橫向 25）
      // mortise.width → apron local Z = world 垂直 → 對應 tenon.width（17，1/3 母件）
      apronFrontPart.mortises = [
        ...apronFrontPart.mortises,
        {
          origin: { x: 0, y: apronThickness - stretcherTenonLen / 2, z: zOffset },
          depth: stretcherTenonLen,
          length: cTenonThick,
          width: cTenonW,
          through: false,
        },
      ];
      apronBackPart.mortises = [
        ...apronBackPart.mortises,
        {
          origin: { x: 0, y: stretcherTenonLen / 2, z: zOffset },
          depth: stretcherTenonLen,
          length: cTenonThick,
          width: cTenonW,
          through: false,
        },
      ];
    }
  }

  return {
    id: `${category}-${length}x${width}x${height}`,
    category,
    nameZh,
    overall: { length, width, thickness: height },
    parts,
    defaultJoinery: "blind-tenon",
    useButtJointConvention: true,
    primaryMaterial: material,
    notes:
      opts.notes ?? "桌腳與桌面通榫；牙板與桌腳半榫；長桌建議加中央牙條防扭。",
    ...(apronClampWarnings.length > 0 ? { warnings: apronClampWarnings } : {}),
  };
}
