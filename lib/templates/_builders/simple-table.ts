import type {
  FurnitureCategory,
  FurnitureDesign,
  MaterialId,
  Part,
} from "@/lib/types";
import { corners, seatEdgeShape, seatScoopShape, legEdgeShape, legBottomScale, legScaleAt } from "../_helpers";
import {
  LOWER_STRETCHER_HEIGHT_RATIO,
  TENON_THICKNESS_RATIO,
  BLIND_TENON_DEPTH_RATIO,
  MIN_SHOULDER_MM,
} from "../_constants";
import { autoTenonType, standardTenon } from "@/lib/joinery/standards";

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
  apronThickness?: number;
  /** Distance from top-underside down to the apron top edge. */
  apronOffset?: number;
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
   *   hoof            = 馬蹄腳（底部外撇） */
  legShape?:
    | "box"
    | "tapered"
    | "strong-taper"
    | "inverted"
    | "splayed"
    | "splayed-length"
    | "splayed-width"
    | "hoof"
    | "shaker";
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
  /** 腳邊緣倒角（mm）。0 = 直角。當 legShape 是 box 時生效，其他造型腳忽略 */
  legEdge?: string | number;
  /** 腳邊緣樣式 — "chamfered"(45°) / "rounded"(圓刀)。預設 chamfered */
  legEdgeStyle?: string;
  /** 牙板與下橫撐邊緣倒角（mm）。0 = 直角。外斜模式 (apron-beveled) 時忽略 */
  stretcherEdge?: string | number;
  /** 牙板/橫撐邊緣樣式 */
  stretcherEdgeStyle?: string;
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
  notes?: string;
}

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
  const apronWidth = opts.apronWidth ?? 70;
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
  const apronTenonType = legPenetratingTenon ? "through-tenon" : autoTenonType(legSize);
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
  const APRON_TOP_SHOULDER = 10;
  const APRON_HALF_TENON_GAP = 4;
  const apronTotalTenonH = apronWidth - APRON_TOP_SHOULDER;
  const apronCanHalfStagger = apronTotalTenonH >= 16;
  const apronHalfTenonH = apronCanHalfStagger
    ? Math.min(apronTenonWidth, Math.floor((apronTotalTenonH - APRON_HALF_TENON_GAP) / 2))
    : apronTenonWidth;
  // part-local：apron Y 從 0 (底) 到 apronWidth (頂)；中心 = apronWidth/2
  // 上榫中心 Y = (apronWidth - 上肩) - 上榫高/2；下榫中心 Y = 下榫高/2
  const apronUpperTenonOffset = apronCanHalfStagger
    ? (apronWidth - APRON_TOP_SHOULDER - apronHalfTenonH / 2) - apronWidth / 2
    : 0;
  const apronLowerTenonOffset = apronCanHalfStagger
    ? apronHalfTenonH / 2 - apronWidth / 2
    : 0;
  // 腳頂榫：用 standardTenon 出 thickness=legSize/3、width=legSize-10（4 邊各 5mm 肩）
  // 比舊版 legSize * 2/3 細，避免側視圖看到 1/2 寬度的厚榫。跟 square-stool 同規則。
  const legTopTenonType = autoTenonType(topThickness);
  const legTopStd = standardTenon({
    type: legTopTenonType,
    childThickness: legSize,
    childWidth: legSize,
    motherThickness: topThickness,
  });
  const legTopTenonLen = legTopStd.length;
  const legTopTenonW = legTopStd.width;       // 沿 part-X，較寬（≈ legSize - 10）
  const legTopTenonT = legTopStd.thickness;   // 沿 part-Z，較薄（≈ legSize/3）

  const legHeight = height - topThickness;
  const apronY = legHeight - apronWidth - apronOffset;
  const legInset = opts.legInset ?? 0;
  // legInset=0 時 tenon 沿 X 軸朝家具中心偏，內側緣貼腳內緣 → 內側無肩、外側多留肩
  // 防止桌面端頭沿 X 木紋方向破裂。跟 square-stool / dining-chair 同規則。
  const legTopInsetX = legInset === 0
    ? Math.max(0, Math.round((legSize - legTopTenonW) / 2))
    : 0;

  const cornerPts = corners(length, width, legSize, legInset);
  const topLen = length + 2 * topOverhang;
  const topWid = width + 2 * topOverhang;

  // Top
  const topPanel: Part = {
    id: "top",
    nameZh: "桌面板",
    material,
    grainDirection: "length",
    visible: { length: topLen, width: topWid, thickness: topThickness },
    origin: { x: 0, y: legHeight, z: 0 },
    shape: opts.liveEdge
      ? { kind: "live-edge", amplitudeMm: opts.liveEdgeAmplitude ?? 12 }
      : opts.seatProfile === "waterfall"
        // 瀑布前緣：座板下緣前後兩面大圓角（22mm），上緣維持 seatEdge 設定
        ? { kind: "chamfered-top", chamferMm: typeof opts.seatEdge === "number" ? opts.seatEdge : 5, bottomChamferMm: 22, style: "rounded" }
        : (seatScoopShape(opts.seatProfile ?? "flat") ?? seatEdgeShape(opts.seatEdge ?? "square", opts.seatEdgeStyle, legInset > 0 || topOverhang > 0)),
    panelPieces: opts.topPanelPieces,
    tenons: [],
    mortises: cornerPts.map((c) => ({
      // legInset=0：mortise 跟 tenon 一起朝中心偏（榫眼軸對齊榫頭）
      origin: { x: c.x - Math.sign(c.x) * legTopInsetX, y: 0, z: c.z },
      depth: legTopTenonLen,
      length: legTopTenonW,
      width: legTopTenonT,
      through: legTopTenonType === "through-tenon",
    })),
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
    if (legShape === "hoof") return { kind: "hoof", hoofMm, hoofScale: 1.35 };
    if (legShape === "shaker") return { kind: "shaker" };
    return undefined;
  };
  const legs: Part[] = cornerPts.map((c, i) => ({
    id: `leg-${i + 1}`,
    nameZh: `桌腳 ${i + 1}`,
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
      },
    ],
    mortises: !withApron ? [] : [
      // Z 面 mortise（接 Z 軸 = 左右牙板）— 上半榫
      {
        origin: { x: 0, y: apronY + apronWidth / 2 + apronUpperTenonOffset, z: c.z > 0 ? -1 : 1 },
        depth: apronTenonLen,
        length: apronHalfTenonH,
        width: apronTenonThick,
        through: apronTenonType === "through-tenon",
      },
      // X 面 mortise（接 X 軸 = 前後牙板）— 下半榫
      {
        origin: { x: c.x > 0 ? -1 : 1, y: apronY + apronWidth / 2 + apronLowerTenonOffset, z: 0 },
        depth: apronTenonLen,
        length: apronHalfTenonH,
        width: apronTenonThick,
        through: apronTenonType === "through-tenon",
      },
    ],
  }));

  // Aprons (4 sides) — butt-joint 慣例：visible.length 兩端剛好頂在腳的內側
  // 面，組裝版渲染就是 final 幾何（不重疊、不留縫）。joinery 模式靠 tenon[]
  // 加切料長度，3D 不視覺延伸。
  // 內側面距離 = length - 2*legSize - 2*legInset，再依 tapered 腳補償（drafting-math.md §A11）。
  const bottomScale = legBottomScale(legShape);
  const apronEdgeZ = width / 2 - legSize / 2 - legInset;
  const apronEdgeX = length / 2 - legSize / 2 - legInset;
  // 外斜支援 3 種：對角 splayed、單向 splayed-length（只沿 X）、splayed-width（只沿 Z）
  // splayDx/splayDz 分別記錄該軸是否啟用外斜，給 apron 計算對應的位移和傾角
  const splayDx =
    legShape === "splayed" || legShape === "splayed-length" ? splayMm : 0;
  const splayDz =
    legShape === "splayed" || legShape === "splayed-width" ? splayMm : 0;
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
  const apronLegSizeCenter = legSize * legScaleAt(apronCenterY, legHeight, bottomScale);
  const apronLegSizeTop = legSize * legScaleAt(apronY + apronWidth, legHeight, bottomScale);
  const apronLegSizeBot = legSize * legScaleAt(apronY, legHeight, bottomScale);
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
      nameZh: "前牙板",
      // 前後牙板沿 X 軸 → 跨距受 X 軸外斜影響
      visibleLength: apronInnerSpan.x + 2 * apronSplayX,
      axis: "x" as const,
      sx: 0,
      sz: -1,
      // Z 位移由 Z 軸外斜決定
      origin: { x: 0, z: -(apronEdgeZ + apronSplayZ) },
    },
    {
      key: "back",
      nameZh: "後牙板",
      visibleLength: apronInnerSpan.x + 2 * apronSplayX,
      axis: "x" as const,
      sx: 0,
      sz: 1,
      origin: { x: 0, z: apronEdgeZ + apronSplayZ },
    },
    {
      key: "left",
      nameZh: "左牙板",
      // 左右牙板沿 Z 軸 → 跨距受 Z 軸外斜影響
      visibleLength: apronInnerSpan.z + 2 * apronSplayZ,
      axis: "z" as const,
      sx: -1,
      sz: 0,
      origin: { x: -(apronEdgeX + apronSplayX), z: 0 },
    },
    {
      key: "right",
      nameZh: "右牙板",
      visibleLength: apronInnerSpan.z + 2 * apronSplayZ,
      axis: "z" as const,
      sx: 1,
      sz: 0,
      origin: { x: apronEdgeX + apronSplayX, z: 0 },
    },
  ];
  const aprons: Part[] = !withApron ? [] : apronSides.map((s) => {
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
    const partShape = trapTopScale !== null
      ? { kind: "apron-trapezoid" as const, topLengthScale: trapTopScale, bottomLengthScale: trapBotScale, bevelAngle: apronBevelAngle || undefined, bevelMode: useHalfBevel ? "half" as const : undefined }
      : isSplayed && useHalfBevel
        ? { kind: "apron-beveled" as const, bevelAngle }
        : legEdgeShape(opts.stretcherEdge, opts.stretcherEdgeStyle);
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
        },
        {
          position: "end" as const,
          type: tenonType,
          length: apronTenonLen,
          width: tenonH,
          thickness: apronTenonThick,
          shoulderOn,
          offsetWidth: -worldOffset,
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
    const stretcherWidth = opts.lowerStretcherWidth ?? 40;
    const stretcherThickness = opts.lowerStretcherThickness ?? 20;
    // 下橫撐 ↔ 腳：autoTenonType + legPenetratingTenon override + 通榫補 +5mm（同 square-stool）
    const lowerTenonType = legPenetratingTenon ? "through-tenon" : autoTenonType(legSize);
    const lowerTenonStd = standardTenon({
      type: lowerTenonType,
      childThickness: stretcherThickness,
      childWidth: stretcherWidth,
      motherThickness: legSize,
    });
    const tenonLen = lowerTenonStd.length + (lowerTenonType === "through-tenon" ? 5 : 0);
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
    const sLegSizeCenter = legSize * legScaleAt(sCenterY, legHeight, bottomScale);
    const sLegSizeTop = legSize * legScaleAt(stretcherY + stretcherWidth, legHeight, bottomScale);
    const sLegSizeBot = legSize * legScaleAt(stretcherY, legHeight, bottomScale);
    const sInnerSpan = {
      x: 2 * apronEdgeX - sLegSizeCenter,
      z: 2 * apronEdgeZ - sLegSizeCenter,
    };
    const sButtHalfX = (splay: number) => apronEdgeX + splay - sLegSizeCenter / 2;
    const sButtHalfZ = (splay: number) => apronEdgeZ + splay - sLegSizeCenter / 2;
    const sButtHalfXTop = (splay: number) => apronEdgeX + splay - sLegSizeTop / 2;
    const sButtHalfXBot = (splay: number) => apronEdgeX + splay - sLegSizeBot / 2;
    const sButtHalfZTop = (splay: number) => apronEdgeZ + splay - sLegSizeTop / 2;
    const sButtHalfZBot = (splay: number) => apronEdgeZ + splay - sLegSizeBot / 2;
    const lowerSides = [
      { key: "ls-front", nameZh: "前下橫撐", visibleLength: sInnerSpan.x + 2 * sSplayX, axis: "x" as const, sx: 0, sz: -1, origin: { x: 0, z: -(apronEdgeZ + sSplayZ) } },
      { key: "ls-back", nameZh: "後下橫撐", visibleLength: sInnerSpan.x + 2 * sSplayX, axis: "x" as const, sx: 0, sz: 1, origin: { x: 0, z: apronEdgeZ + sSplayZ } },
      { key: "ls-left", nameZh: "左下橫撐", visibleLength: sInnerSpan.z + 2 * sSplayZ, axis: "z" as const, sx: -1, sz: 0, origin: { x: -(apronEdgeX + sSplayX), z: 0 } },
      { key: "ls-right", nameZh: "右下橫撐", visibleLength: sInnerSpan.z + 2 * sSplayZ, axis: "z" as const, sx: 1, sz: 0, origin: { x: apronEdgeX + sSplayX, z: 0 } },
    ];
    for (const s of lowerSides) {
      const bevelAngle = isSplayed
        ? s.axis === "x" ? -s.sz * tiltZ : -s.sx * tiltX
        : 0;
      const hasShapeBend = splayDx > 0 || splayDz > 0 || bottomScale !== 1;
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
      const lsShape = trapTopScale !== null
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
          { position: "start", type: lsTenonType, length: tenonLen, width: lsTenonH, thickness: tenonThick, shoulderOn: lsShoulderOn, offsetWidth: -lsWorldOffset },
          { position: "end", type: lsTenonType, length: tenonLen, width: lsTenonH, thickness: tenonThick, shoulderOn: lsShoulderOn, offsetWidth: -lsWorldOffset },
        ],
        mortises: [],
      });
    }
    // 補腳上下橫撐 mortise（簡單 simple-table 原本沒加，現在加齊）
    // Z 面 mortise 接 Z apron（左右下橫撐）— 上半榫
    // X 面 mortise 接 X apron（前後下橫撐）— 下半榫
    const lsCenterY = stretcherY + stretcherWidth / 2;
    const lsThrough = lowerTenonType === "through-tenon";
    for (const leg of legs) {
      const cx = leg.origin.x;
      const cz = leg.origin.z;
      leg.mortises.push(
        {
          origin: { x: 0, y: lsCenterY + lowerUpperTenonOffset, z: cz > 0 ? -1 : 1 },
          depth: tenonLen,
          length: lowerCanHalfStagger ? lowerHalfTenonH : tenonW,
          width: tenonThick,
          through: lsThrough,
        },
        {
          origin: { x: cx > 0 ? -1 : 1, y: lsCenterY + lowerLowerTenonOffset, z: 0 },
          depth: tenonLen,
          length: lowerCanHalfStagger ? lowerHalfTenonH : tenonW,
          width: tenonThick,
          through: lsThrough,
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
      const slatCount = Math.max(2, Math.min(20, opts.slatCount ?? 5));
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
      for (let i = 0; i < slatCount; i++) {
        const slatX = -slatXSpan / 2 + gap + slatWidth / 2 + i * (gap + slatWidth);
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
          tenons: [],
          mortises: [],
        });
      }
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
      nameZh: "中央橫撐",
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
      opts.notes ?? "桌腳與桌面通榫；牙板與桌腳半榫；長桌建議加中央橫撐防扭。",
  };
}
