import type {
  FurnitureCategory,
  FurnitureDesign,
  MaterialId,
  Part,
} from "@/lib/types";
import { corners, seatEdgeShape, legEdgeShape } from "../_helpers";

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
   *   box         = 方直腳（預設）
   *   tapered     = 錐形腳（下方收窄）
   *   strong-taper = 方錐漸縮（大幅下收）
   *   inverted    = 倒錐腳（下方反而更粗）
   *   splayed     = 斜腳（整支向外傾）
   *   hoof        = 馬蹄腳（底部外撇） */
  legShape?: "box" | "tapered" | "strong-taper" | "inverted" | "splayed" | "hoof";
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
  // 正規榫卯比例（Fine Woodworking / Popular Woodworking 共識）：
  // - 榫厚 = 被開榫眼的母件（柱腳）厚度的 1/3
  //   但不能超過公件（牙板）厚度減兩側最小肩 6mm
  // - 榫長 = 母件厚度的 2/3（盲榫）
  // - 榫寬 = 牙板寬減上下各 6mm（固定肩，非比例）
  const MIN_SHOULDER = 6;
  const apronTenonLen = Math.round((legSize * 2) / 3);
  const apronTenonThick = Math.max(
    6,
    Math.min(
      apronThickness - 2 * MIN_SHOULDER,
      Math.round(legSize / 3),
    ),
  );
  const apronTenonWidth = Math.max(15, apronWidth - 2 * MIN_SHOULDER);
  const legTopTenonLen = topThickness;
  // Through tenon at leg top should be SMALLER than the leg so the shoulder
  // rests on the underside of the panel (locks the leg in place). Standard
  // proportion: tenon = 2/3 of leg cross-section, leaving shoulders on all 4 sides.
  const legTopTenonSize = Math.max(15, Math.round((legSize * 2) / 3));

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
    shape: seatEdgeShape(opts.seatEdge ?? "square", opts.seatEdgeStyle),
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
  const legShapeFor = (c: { x: number; z: number }): Part["shape"] => {
    if (legShape === "tapered") return { kind: "tapered", bottomScale: 0.55 };
    if (legShape === "strong-taper") return { kind: "tapered", bottomScale: 0.4 };
    if (legShape === "inverted") return { kind: "tapered", bottomScale: 1.3 };
    if (legShape === "splayed") {
      return {
        kind: "splayed",
        dxMm: Math.sign(c.x) * splayMm,
        dzMm: Math.sign(c.z) * splayMm,
      };
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

  // Aprons (4 sides) — visible body spans leg center to leg center so the
  // tenon portion inside the leg is visually represented in the three-view.
  // Beginner-mode post-processing shortens this to the inner-face butt span.
  const apronInnerSpan = {
    x: length - legSize - 2 * legInset,
    z: width - legSize - 2 * legInset,
  };
  const apronEdgeZ = width / 2 - legSize / 2 - legInset;
  const apronEdgeX = length / 2 - legSize / 2 - legInset;
  // 外斜模式：腳在 apron Y 高度的中心 = 頂端 corner + shiftFactor × splayMm
  // 牙板中心對到腳的真實中心（不然榫頭會偏一邊讓壁太薄爆掉）
  const isSplayed = legShape === "splayed";
  const apronYCenter = apronY + apronWidth / 2;
  const shiftFactor = legHeight > 0 ? 1 - apronYCenter / legHeight : 0;
  const apronSplay = isSplayed ? splayMm * shiftFactor : 0;
  // 牙板斜度 = arctan(每軸位移 / 腳高)。simpleTable 的 splayMm 本來就是每軸值
  const tilt = isSplayed ? Math.atan(splayMm / legHeight) : 0;
  const apronSides = [
    {
      key: "front",
      nameZh: "前牙板",
      visibleLength: apronInnerSpan.x + 2 * apronSplay,
      axis: "x" as const,
      sx: 0,
      sz: -1,
      origin: { x: 0, z: -(apronEdgeZ + apronSplay) },
    },
    {
      key: "back",
      nameZh: "後牙板",
      visibleLength: apronInnerSpan.x + 2 * apronSplay,
      axis: "x" as const,
      sx: 0,
      sz: 1,
      origin: { x: 0, z: apronEdgeZ + apronSplay },
    },
    {
      key: "left",
      nameZh: "左牙板",
      visibleLength: apronInnerSpan.z + 2 * apronSplay,
      axis: "z" as const,
      sx: -1,
      sz: 0,
      origin: { x: -(apronEdgeX + apronSplay), z: 0 },
    },
    {
      key: "right",
      nameZh: "右牙板",
      visibleLength: apronInnerSpan.z + 2 * apronSplay,
      axis: "z" as const,
      sx: 1,
      sz: 0,
      origin: { x: apronEdgeX + apronSplay, z: 0 },
    },
  ];
  const aprons: Part[] = apronSides.map((s) => {
    const bevelAngle = isSplayed
      ? s.axis === "x" ? -s.sz * tilt : -s.sx * tilt
      : 0;
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
        ? { x: Math.PI / 2, y: Math.PI / 2, z: s.sx * tilt }
        : { x: Math.PI / 2 + (-s.sz) * tilt, y: 0, z: 0 },
      // 外斜模式 apron-beveled 與倒角互斥；非外斜時才能套倒角
      shape: isSplayed
        ? { kind: "apron-beveled" as const, bevelAngle }
        : legEdgeShape(opts.stretcherEdge, opts.stretcherEdgeStyle),
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

  // Optional 4 lower stretchers (連腳橫撐), default ≈ 22% of leg height
  if (withLowerStretchers) {
    const stretcherY = opts.lowerStretcherHeight ?? Math.round(legHeight * 0.22);
    const stretcherWidth = opts.lowerStretcherWidth ?? 40;
    const stretcherThickness = opts.lowerStretcherThickness ?? 20;
    const tenonLen = Math.round((legSize * 2) / 3);
    const tenonThick = Math.max(
      6,
      Math.min(stretcherThickness - 2 * MIN_SHOULDER, Math.round(legSize / 3)),
    );
    const tenonW = Math.max(12, stretcherWidth - 2 * MIN_SHOULDER);
    // 外斜模式：橫撐在 stretcherY 高度的腳中心，shiftFactor 跟 apron 不同（更下方→更外）
    const stretcherYCenter = stretcherY + stretcherWidth / 2;
    const sShiftFactor = legHeight > 0 ? 1 - stretcherYCenter / legHeight : 0;
    const sSplay = isSplayed ? splayMm * sShiftFactor : 0;
    const lowerSides = [
      { key: "ls-front", nameZh: "前下橫撐", visibleLength: apronInnerSpan.x + 2 * sSplay, axis: "x" as const, sx: 0, sz: -1, origin: { x: 0, z: -(apronEdgeZ + sSplay) } },
      { key: "ls-back", nameZh: "後下橫撐", visibleLength: apronInnerSpan.x + 2 * sSplay, axis: "x" as const, sx: 0, sz: 1, origin: { x: 0, z: apronEdgeZ + sSplay } },
      { key: "ls-left", nameZh: "左下橫撐", visibleLength: apronInnerSpan.z + 2 * sSplay, axis: "z" as const, sx: -1, sz: 0, origin: { x: -(apronEdgeX + sSplay), z: 0 } },
      { key: "ls-right", nameZh: "右下橫撐", visibleLength: apronInnerSpan.z + 2 * sSplay, axis: "z" as const, sx: 1, sz: 0, origin: { x: apronEdgeX + sSplay, z: 0 } },
    ];
    for (const s of lowerSides) {
      const bevelAngle = isSplayed
        ? s.axis === "x" ? -s.sz * tilt : -s.sx * tilt
        : 0;
      parts.push({
        id: s.key,
        nameZh: s.nameZh,
        material,
        grainDirection: "length",
        visible: { length: s.visibleLength, width: stretcherWidth, thickness: stretcherThickness },
        origin: { x: s.origin.x, y: stretcherY, z: s.origin.z },
        rotation: s.axis === "z"
          ? { x: Math.PI / 2, y: Math.PI / 2, z: s.sx * tilt }
          : { x: Math.PI / 2 + (-s.sz) * tilt, y: 0, z: 0 },
        shape: isSplayed
          ? { kind: "apron-beveled", bevelAngle }
          : legEdgeShape(opts.stretcherEdge, opts.stretcherEdgeStyle),
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
      Math.min(stretcherThickness - 2 * MIN_SHOULDER, Math.round(apronThickness / 3)),
    );
    const cTenonW = Math.max(15, stretcherWidth - 2 * MIN_SHOULDER);
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
    primaryMaterial: material,
    notes:
      opts.notes ?? "桌腳與桌面通榫；牙板與桌腳半榫；長桌建議加中央橫撐防扭。",
  };
}
