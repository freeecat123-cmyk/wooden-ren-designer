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
  THROUGH_TENON_RATIO,
  MIN_SHOULDER_MM,
} from "../_constants";

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
    | "hoof";
  /** Inset legs inward from outer edge (mm, each side). Top overhang is separate. */
  legInset?: number;
  /** Y position of lower stretcher from floor (mm). Default ≈ 22% of leg height. */
  lowerStretcherHeight?: number;
  /** Lower stretcher width (vertical dim, mm). Default 40. */
  lowerStretcherWidth?: number;
  /** Lower stretcher thickness (horizontal, mm). Default 20. */
  lowerStretcherThickness?: number;
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
  const apronThickness = opts.apronThickness ?? 22;
  const apronOffset = opts.apronOffset ?? 20;
  const topOverhang = opts.topOverhang ?? 0;
  const withLowerStretchers = opts.withLowerStretchers ?? false;
  // 榫卯比例 — 全部從 _constants.ts 取（連回 wood-master/knowledge/joinery.md §2）
  const apronTenonLen = Math.round(legSize * BLIND_TENON_DEPTH_RATIO);
  const apronTenonThick = Math.max(
    6,
    Math.min(
      apronThickness - 2 * MIN_SHOULDER_MM,
      Math.round(legSize * TENON_THICKNESS_RATIO),
    ),
  );
  const apronTenonWidth = Math.max(15, apronWidth - 2 * MIN_SHOULDER_MM);
  const legTopTenonLen = topThickness;
  // 通榫從上方插入：榫頭=母件 2/3，留四面肩。
  const legTopTenonSize = Math.max(15, Math.round(legSize * THROUGH_TENON_RATIO));

  const legHeight = height - topThickness;
  const apronY = legHeight - apronWidth - apronOffset;
  const legInset = opts.legInset ?? 0;

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
      origin: { x: c.x, y: 0, z: c.z },
      depth: topThickness,
      length: legTopTenonSize,
      width: legTopTenonSize,
      through: true,
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
        type: "through-tenon",
        length: legTopTenonLen,
        width: legTopTenonSize,
        thickness: legTopTenonSize,
      },
    ],
    mortises: [
      {
        origin: { x: 0, y: apronY, z: c.z > 0 ? -1 : 1 },
        depth: apronTenonLen,
        length: apronTenonWidth,
        width: apronTenonThick,
        through: false,
      },
      {
        origin: { x: c.x > 0 ? -1 : 1, y: apronY, z: 0 },
        depth: apronTenonLen,
        length: apronTenonWidth,
        width: apronTenonThick,
        through: false,
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
  const aprons: Part[] = apronSides.map((s) => {
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
    const partShape = trapTopScale !== null
      ? { kind: "apron-trapezoid" as const, topLengthScale: trapTopScale, bottomLengthScale: trapBotScale, bevelAngle: bevelAngle || undefined }
      : isSplayed
        ? { kind: "apron-beveled" as const, bevelAngle }
        : legEdgeShape(opts.stretcherEdge, opts.stretcherEdgeStyle);
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
          type: "shouldered-tenon" as const,
          length: apronTenonLen,
          width: apronTenonWidth,
          thickness: apronTenonThick,
        },
        {
          position: "end" as const,
          type: "shouldered-tenon" as const,
          length: apronTenonLen,
          width: apronTenonWidth,
          thickness: apronTenonThick,
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
    const tenonLen = Math.round(legSize * BLIND_TENON_DEPTH_RATIO);
    const tenonThick = Math.max(
      6,
      Math.min(stretcherThickness - 2 * MIN_SHOULDER_MM, Math.round(legSize * TENON_THICKNESS_RATIO)),
    );
    const tenonW = Math.max(12, stretcherWidth - 2 * MIN_SHOULDER_MM);
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
      const lsShape = trapTopScale !== null
        ? { kind: "apron-trapezoid" as const, topLengthScale: trapTopScale, bottomLengthScale: trapBotScale, bevelAngle: bevelAngle || undefined }
        : isSplayed
          ? { kind: "apron-beveled" as const, bevelAngle }
          : legEdgeShape(opts.stretcherEdge, opts.stretcherEdgeStyle);
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
          { position: "start", type: "blind-tenon", length: tenonLen, width: tenonW, thickness: tenonThick },
          { position: "end", type: "blind-tenon", length: tenonLen, width: tenonW, thickness: tenonThick },
        ],
        mortises: [],
      });
    }
  }

  // Optional center stretcher (for long tables)
  if (withCenterStretcher) {
    const stretcherWidth = opts.centerStretcherWidth ?? 50;
    const stretcherThickness = opts.centerStretcherThickness ?? 25;
    // Tenon length must fit INSIDE the apron (apron is the mother here), not
    // poke through to the outside. Leave 4mm wood behind the mortise.
    const stretcherTenonLen = Math.max(6, Math.min(apronTenonLen, apronThickness - 4));
    // Body length: from front-apron INNER face to back-apron INNER face.
    // (Tenon protrudes INTO each apron by stretcherTenonLen beyond this body.)
    const bodyLen = Math.max(
      50,
      width - legSize - 2 * legInset - apronThickness,
    );
    // Center stretcher's mother = apron, so base tenon thickness on apron thickness
    const cTenonThick = Math.max(
      6,
      Math.min(stretcherThickness - 2 * MIN_SHOULDER_MM, Math.round(apronThickness * TENON_THICKNESS_RATIO)),
    );
    const cTenonW = Math.max(15, stretcherWidth - 2 * MIN_SHOULDER_MM);
    // centerStretcherDrop (label = "距牙板頂") 的語意：stretcher 頂面距牙板頂
    // 的距離。bigger drop → stretcher lower → farther from tabletop. 預設
    // 把 stretcher 壓到牙板底緣附近（居中 + 額外往下），避免緊貼桌面。
    const dropFromApronTop =
      opts.centerStretcherDrop ??
      Math.max(15, Math.round((apronWidth - stretcherWidth) / 2) + 10);
    const originY = Math.max(
      apronY,
      apronY + apronWidth - dropFromApronTop - stretcherWidth,
    );
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
      shape: legEdgeShape(opts.stretcherEdge, opts.stretcherEdgeStyle),
      tenons: [
        {
          position: "start",
          type: "blind-tenon",
          length: stretcherTenonLen,
          width: cTenonW,
          thickness: cTenonThick,
        },
        {
          position: "end",
          type: "blind-tenon",
          length: stretcherTenonLen,
          width: cTenonW,
          thickness: cTenonThick,
        },
      ],
      mortises: [],
    });
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
