import type {
  FurnitureCategory,
  FurnitureDesign,
  MaterialId,
  Part,
} from "@/lib/types";

export interface CaseFurnitureOpts {
  category: FurnitureCategory;
  nameZh: string;
  length: number;
  width: number;
  height: number;
  material: MaterialId;
  /** Number of intermediate horizontal shelves/dividers (excludes top/bottom). */
  shelfCount: number;
  /** If > 0, render N drawer-front panels instead of (or in addition to) shelves. */
  drawerCount?: number;
  /** Horizontal drawer columns (default 1). Each row has drawerCols × drawerRows drawers. */
  drawerCols?: number;
  /** Limit total height of drawer stack (mm). Default = full innerH. */
  drawerAreaHeight?: number;
  /** Place the drawer stack at the TOP of innerH instead of the bottom. */
  drawerAtTop?: boolean;
  /** If > 0, add N door panels in front. */
  doorCount?: number;
  /** Vertical offset (mm) from the inner-bottom to the DOOR bottom edge.
   *  Use together with doorAreaHeight to confine doors to a partial zone
   *  (e.g. bottom 500mm only, leaving drawers/open space above). */
  doorYOffset?: number;
  /** Height (mm) of the door zone. Default = innerH (full front). */
  doorAreaHeight?: number;
  /** Door type for notes; "glass" implies optional glass + frame. */
  doorType?: "wood" | "glass";
  panelThickness?: number;
  shelfThickness?: number;
  backThickness?: number;
  /** Raise the case on 4 corner legs (e.g. sofa legs). When set, legHeight adds under the bottom panel. */
  legHeight?: number;
  legSize?: number;
  /** Leg shape: box (default), tapered (narrows toward bottom), bracket (triangular foot),
   *  plinth (continuous base frame), panel-side (side panels extend to floor). */
  legShape?: "box" | "tapered" | "bracket" | "plinth" | "panel-side";
  /** Inset legs (or plinth) inward from case outer edge (mm, each side). */
  legInset?: number;
  /** If provided, overrides equal-spacing with custom shelf Y fractions (0..1 from bottom). */
  customShelfFractions?: number[];
  /** Horizontal area (y fraction range) reserved for a hanging rod. Used by wardrobe. */
  hangingArea?: { yStart: number; yEnd: number };
  /**
   * Mixed-layout zones stacked from BOTTOM up. If provided, overrides
   * drawerCount / doorCount / shelfCount and renders each zone in order.
   * Remaining space (innerH - sum(zone.heightMm)) becomes an extra open
   * zone at the TOP.
   */
  zones?: CabinetZone[];
  /**
   * Horizontal columns (side-by-side). If provided, the cabinet is split
   * with full-height vertical partitions and each column's content is
   * rendered in its own X range. Width ratios default to equal split.
   * Columns OVERRIDE zones (zones apply only when columns is absent).
   */
  columns?: CabinetColumn[];
  notes?: string;
}

export interface CabinetColumn {
  /** Optional explicit width fraction (0..1). Default = equal split. */
  widthFrac?: number;
  /** Content type for this column. Uses the full innerH. */
  type: "drawer" | "door" | "shelves" | "open";
  /** drawer rows / door count / shelf layer count */
  count?: number;
  /** drawer horizontal subdivisions inside this column */
  cols?: number;
  /** Optional label prefix (e.g. "左櫃") */
  labelPrefix?: string;
}

export type CabinetZoneType = "drawer" | "door" | "shelves" | "open" | "hanging";

export interface CabinetZone {
  type: CabinetZoneType;
  /** Clear-height of this zone in mm (panel-to-panel). */
  heightMm: number;
  /** drawer: drawer rows; shelves: storage layer count (shelves = layers - 1). */
  count?: number;
  /** drawer / shelves can subdivide horizontally. */
  cols?: number;
  /** door: open direction label (top = flip-up 掀門, side = swing 開門). */
  doorOpen?: "top" | "side";
}

/**
 * Generic panel-construction case (cabinet/bookshelf/chest).
 * Used by open-bookshelf, chest-of-drawers, shoe-cabinet, display-cabinet.
 *
 * Construction:
 *  - 1 × 頂板, 1 × 底板, 2 × 側板（half-tenon into top/bottom）
 *  - N × 層板（半榫 or dado into sides）
 *  - 1 × 背板（薄板，tongue-and-groove into back grooves）
 *  - 抽屜面板/門板：簡化為前方面板，不模擬內箱與五金
 */
export function caseFurniture(opts: CaseFurnitureOpts): FurnitureDesign {
  const {
    length,
    width,
    height,
    material,
    category,
    nameZh,
    shelfCount,
    drawerCount = 0,
    drawerAtTop = false,
    doorCount = 0,
    doorType = "wood",
    doorYOffset = 0,
  } = opts;

  const panelT = opts.panelThickness ?? 18;
  const shelfT = opts.shelfThickness ?? 18;
  const backT = opts.backThickness ?? 6;
  // 企口榫舌頭厚度 = 板厚 / 3（正規比例，18mm 板 → 6mm 舌）
  const panelTongueT = Math.max(4, Math.round(panelT / 3));
  const shelfTongueT = Math.max(4, Math.round(shelfT / 3));
  const drawerCols = Math.max(1, opts.drawerCols ?? 1);
  const rawLegHeight = opts.legHeight ?? 0;
  const legShapeRaw = opts.legShape ?? "box";
  const legHeight =
    rawLegHeight === 0 && legShapeRaw !== "box"
      ? legShapeRaw === "plinth"
        ? 80
        : 100
      : rawLegHeight;
  const legSize = opts.legSize ?? 35;
  const caseBottomY = legHeight; // bottom panel of cabinet sits at this Y

  const caseHeight = height - legHeight;
  const innerW = length - 2 * panelT;
  const innerH = caseHeight - 2 * panelT;
  const innerD = width - backT;
  const tenonLen = Math.round(panelT * 0.6);
  /**
   * 內部零件（側板 / 層板 / 分隔板 / 抽屜箱）的 Z 軸中心。
   * 它們深度 = innerD = width − backT，若放在 z=0 會 4mm 短於櫃體前緣
   * （頂板是全寬 width），造成「左右 / 前端有縫」的分解感。
   * 向前偏移 backT/2 → 前緣貼齊櫃前面 z=−width/2，後緣貼齊背板前面。
   */
  const caseInnerZ = -backT / 2;

  const parts: Part[] = [];

  // Drawer area occupies the bottom portion of innerH (fraction 0..drawerTopFrac).
  // User-supplied shelves go in the remainder (above the drawer area), unless
  // customShelfFractions overrides positions explicitly.
  const drawerAreaH = drawerCount > 0 ? (opts.drawerAreaHeight ?? innerH) : 0;
  const drawerTopFrac = Math.min(1, drawerAreaH / innerH);
  const shelfFractions: number[] =
    opts.customShelfFractions !== undefined
      ? opts.customShelfFractions.filter((f) => f > 0 && f < 1)
      : shelfCount > 0
      ? Array.from({ length: shelfCount }, (_, i) => {
          const remaining = 1 - drawerTopFrac;
          return drawerTopFrac + (remaining * (i + 1)) / (shelfCount + 1);
        })
      : [];

  // Auto-populate shelfFractions from zones so sides get mortises that
  // match internal dividers / shelves. The mirror-pair skip in extract.ts
  // prevents the false positive where a side's own tongue would match its
  // mirror sibling's added mortise.
  if (opts.zones && opts.zones.length > 0) {
    let cursor = 0;
    for (let i = 0; i < opts.zones.length; i++) {
      const z = opts.zones[i];
      const zBottom = cursor;
      const zTop = cursor + z.heightMm;
      if (z.type === "drawer") {
        const rows = z.count ?? 1;
        for (let d = 0; d < rows - 1; d++) {
          const y = zBottom + ((d + 1) * z.heightMm) / rows;
          shelfFractions.push(y / innerH);
        }
      } else if (z.type === "shelves") {
        const layers = z.count ?? 1;
        for (let d = 0; d < layers - 1; d++) {
          const y = zBottom + ((d + 1) * z.heightMm) / layers;
          shelfFractions.push(y / innerH);
        }
      }
      if (i < opts.zones.length - 1) {
        shelfFractions.push(zTop / innerH);
      }
      cursor = zTop;
    }
  }

  // Optional 4 corner legs (raise the case)
  const legShape = legShapeRaw;
  const legInset = opts.legInset ?? 0;
  if (legHeight > 0) {
    if (legShape === "panel-side") {
      // 側板延伸落地：左右加兩片延伸板，中間空心
      const insetZ = 10;
      for (const sx of [-1, 1] as const) {
        parts.push({
          id: `side-extension-${sx < 0 ? "left" : "right"}`,
          nameZh: `${sx < 0 ? "左" : "右"}側板延伸腳`,
          material,
          grainDirection: "length",
          visible: { length: width - 2 * insetZ, width: legHeight, thickness: panelT },
          origin: { x: sx * (length / 2 - panelT / 2), y: 0, z: 0 },
          rotation: { x: Math.PI / 2, y: Math.PI / 2, z: 0 },
          tenons: [],
          mortises: [],
        });
      }
    } else if (legShape === "plinth") {
      // 平台式底座：四邊連板底座
      const plinthT = 18;
      const insetX = 10 + legInset;
      const insetZ = 10 + legInset;
      const frontBack = [-1, 1] as const;
      // 前後長板
      for (const sz of frontBack) {
        parts.push({
          id: `plinth-${sz < 0 ? "front" : "back"}`,
          nameZh: `${sz < 0 ? "前" : "後"}底座板`,
          material,
          grainDirection: "length",
          visible: { length: length - 2 * insetX, width: legHeight, thickness: plinthT },
          origin: { x: 0, y: 0, z: sz * (width / 2 - plinthT / 2 - insetZ) },
          rotation: { x: Math.PI / 2, y: 0, z: 0 },
          tenons: [],
          mortises: [],
        });
      }
      for (const sx of frontBack) {
        parts.push({
          id: `plinth-${sx < 0 ? "left" : "right"}`,
          nameZh: `${sx < 0 ? "左" : "右"}底座板`,
          material,
          grainDirection: "length",
          visible: { length: width - 2 * insetZ - 2 * plinthT, width: legHeight, thickness: plinthT },
          origin: { x: sx * (length / 2 - plinthT / 2 - insetX), y: 0, z: 0 },
          rotation: { x: Math.PI / 2, y: Math.PI / 2, z: 0 },
          tenons: [],
          mortises: [],
        });
      }
    } else {
      const legOffsetX = length / 2 - legSize / 2 - legInset;
      const legOffsetZ = width / 2 - legSize / 2 - legInset;
      const shape: Part["shape"] =
        legShape === "tapered"
          ? { kind: "tapered", bottomScale: 0.55 }
          : undefined;
      for (const sx of [-1, 1] as const) {
        for (const sz of [-1, 1] as const) {
          parts.push({
            id: `leg-${sx < 0 ? "l" : "r"}${sz < 0 ? "f" : "b"}`,
            nameZh: `${sz < 0 ? "前" : "後"}${sx < 0 ? "左" : "右"}腳`,
            material,
            grainDirection: "length",
            visible: { length: legSize, width: legSize, thickness: legHeight },
            origin: { x: sx * legOffsetX, y: 0, z: sz * legOffsetZ },
            shape,
            tenons: [
              { position: "top", type: "blind-tenon", length: Math.min(tenonLen, legHeight), width: legSize - 10, thickness: legSize - 10 },
            ],
            mortises: [],
          });
          if (legShape === "bracket") {
            // 托腳牙板：從腳內側斜向支撐底板
            const bracketLen = Math.min(legHeight * 1.4, 80);
            parts.push({
              id: `bracket-${sx < 0 ? "l" : "r"}${sz < 0 ? "f" : "b"}`,
              nameZh: `${sz < 0 ? "前" : "後"}${sx < 0 ? "左" : "右"}托腳牙`,
              material,
              grainDirection: "length",
              visible: { length: bracketLen, width: legHeight * 0.7, thickness: 14 },
              origin: {
                x: sx * (legOffsetX - legSize / 2 - bracketLen / 2 + 2),
                y: legHeight * 0.3,
                z: sz * legOffsetZ,
              },
              rotation: { x: Math.PI / 2, y: 0, z: 0 },
              tenons: [],
              mortises: [],
            });
          }
        }
      }
    }
  }

  // 頂板
  parts.push({
    id: "top",
    nameZh: "頂板",
    material,
    grainDirection: "length",
    visible: { length, width, thickness: panelT },
    origin: { x: 0, y: caseBottomY + caseHeight - panelT, z: 0 },
    tenons: [],
    mortises: [
      // 兩端各一個榫眼接側板
      {
        origin: { x: -length / 2 + panelT / 2, y: 0, z: 0 },
        depth: tenonLen,
        length: width - backT,
        width: panelTongueT,
        through: false,
      },
      {
        origin: { x: length / 2 - panelT / 2, y: 0, z: 0 },
        depth: tenonLen,
        length: width - backT,
        width: panelTongueT,
        through: false,
      },
    ],
  });

  // 底板。若有底座腳（legHeight > 0 且非 plinth/panel-side）則加 4 個角落
  // 榫眼接腳頂盲榫。這讓 extract.ts 能把「前左腳 → 底板」配對起來。
  const legTenonLen = Math.min(tenonLen, Math.max(5, (opts.legHeight ?? 0)));
  const legMortiseSize = legSize - 10;
  const hasCornerLegs =
    legHeight > 0 && legShapeRaw !== "plinth" && legShapeRaw !== "panel-side";
  parts.push({
    id: "bottom",
    nameZh: "底板",
    material,
    grainDirection: "length",
    visible: { length, width, thickness: panelT },
    origin: { x: 0, y: caseBottomY, z: 0 },
    tenons: [],
    mortises: [
      {
        origin: { x: -length / 2 + panelT / 2, y: 0, z: 0 },
        depth: tenonLen,
        length: width - backT,
        width: panelTongueT,
        through: false,
      },
      {
        origin: { x: length / 2 - panelT / 2, y: 0, z: 0 },
        depth: tenonLen,
        length: width - backT,
        width: panelTongueT,
        through: false,
      },
      // 4 角腳榫眼
      ...(hasCornerLegs
        ? ([-1, 1] as const).flatMap((sx) =>
            ([-1, 1] as const).map((sz) => ({
              origin: {
                x: sx * (length / 2 - legSize / 2 - (opts.legInset ?? 0)),
                y: 0,
                z: sz * (width / 2 - legSize / 2 - (opts.legInset ?? 0)),
              },
              depth: legTenonLen,
              length: legMortiseSize,
              width: legMortiseSize,
              through: false,
            })),
          )
        : []),
    ],
  });

  // 側板 (左右) — local length points up (innerH), so rotate Z by 90° to stand it
  for (const side of [-1, 1]) {
    parts.push({
      id: side < 0 ? "side-left" : "side-right",
      nameZh: side < 0 ? "左側板" : "右側板",
      material,
      grainDirection: "length",
      visible: { length: innerH, width: innerD, thickness: panelT },
      origin: { x: side * (length / 2 - panelT / 2), y: caseBottomY + panelT, z: caseInnerZ },
      rotation: { x: 0, y: 0, z: Math.PI / 2 },
      tenons: [
        // start/end = local length axis (innerH); after Z-rotation this is
        // the vertical axis (top/bottom of the cabinet). Using "top"/"bottom"
        // here would add the tongue to `thickness` instead of `length`,
        // making the cut sheet list a 40mm-thick panel for 18mm side stock.
        {
          position: "start",
          type: "tongue-and-groove",
          length: tenonLen,
          width: innerD - 8,
          thickness: panelTongueT,
        },
        {
          position: "end",
          type: "tongue-and-groove",
          length: tenonLen,
          width: innerD - 8,
          thickness: panelTongueT,
        },
      ],
      // 內側面挖層板/抽屜分隔板的榫眼（簡化為一個示意榫眼）
      mortises: shelfFractions.map((f) => ({
        origin: { x: 0, y: f * innerH, z: 0 },
        depth: tenonLen,
        length: innerD - 10,
        width: shelfTongueT,
        through: false,
      })),
    });
  }

  // 中間層板/抽屜分隔板。Skip when zones mode is active — renderDrawerZone
  // / renderShelvesZone / zone-boundary code already creates these panels,
  // and shelfFractions here is kept solely to populate SIDE PANEL mortises
  // so extract.ts can pair the divider tongues to 左側板/右側板.
  const suppressLegacyShelfRender = !!(opts.zones && opts.zones.length > 0);
  for (let i = 0; i < shelfFractions.length && !suppressLegacyShelfRender; i++) {
    const y = caseBottomY + panelT + shelfFractions[i] * innerH;
    parts.push({
      id: `shelf-${i + 1}`,
      nameZh: drawerCount > 0 ? `抽屜分隔板 ${i + 1}` : `層板 ${i + 1}`,
      material,
      grainDirection: "length",
      visible: { length: innerW, width: innerD, thickness: shelfT },
      origin: { x: 0, y, z: caseInnerZ },
      tenons: [
        {
          position: "start",
          type: "tongue-and-groove",
          length: tenonLen,
          width: innerD - 10,
          thickness: shelfTongueT,
        },
        {
          position: "end",
          type: "tongue-and-groove",
          length: tenonLen,
          width: innerD - 10,
          thickness: shelfTongueT,
        },
      ],
      mortises: [],
    });
  }

  // 背板（6mm 夾板——不吃主材）
  parts.push({
    id: "back",
    nameZh: "背板",
    material,
    materialOverride: "plywood",
    grainDirection: "length",
    visible: { length: innerW, width: backT, thickness: innerH },
    origin: { x: 0, y: caseBottomY + panelT, z: width / 2 - backT / 2 },
    tenons: [
      {
        position: "start",
        type: "tongue-and-groove",
        length: 6,
        width: innerH,
        thickness: backT,
      },
      {
        position: "end",
        type: "tongue-and-groove",
        length: 6,
        width: innerH,
        thickness: backT,
      },
    ],
    mortises: [],
  });

  // Drawer zone renderer — can be called multiple times for multi-zone cabinets.
  const renderDrawerZone = (cfg: {
    yStart: number;
    height: number;
    rows: number;
    cols: number;
    idPrefix: string;
    labelPrefix: string;
    dividerFrom: "above" | "below" | "none";
    /** Optional X center and width when rendering inside a column. */
    xCenter?: number;
    colInnerW?: number;
  }) => {
    const { yStart, height: zoneH, rows, cols, idPrefix, labelPrefix, dividerFrom } = cfg;
    const zoneCx = cfg.xCenter ?? 0;
    const zoneW = cfg.colInnerW ?? innerW;
    const drawerSlotH = zoneH / rows;
    const drawerZoneBottomY = yStart;
    const drawerZoneTopY = yStart + zoneH;
    for (let d = 0; d < rows - 1; d++) {
      const dividerY = drawerZoneBottomY + (d + 1) * drawerSlotH;
      parts.push({
        id: `${idPrefix}-divider-${d + 1}`,
        nameZh: `${labelPrefix}分隔板 ${d + 1}`,
        material,
        grainDirection: "length",
        visible: { length: zoneW, width: innerD, thickness: shelfT },
        origin: { x: zoneCx, y: dividerY - shelfT, z: caseInnerZ },
        tenons: [
          { position: "start", type: "tongue-and-groove", length: tenonLen, width: innerD - 10, thickness: shelfTongueT },
          { position: "end", type: "tongue-and-groove", length: tenonLen, width: innerD - 10, thickness: shelfTongueT },
        ],
        mortises: [],
      });
    }
    // 抽屜區邊界分隔板
    if (dividerFrom !== "none") {
      const boundaryY = dividerFrom === "below" ? drawerZoneBottomY : drawerZoneTopY;
      parts.push({
        id: `${idPrefix}-zone-boundary`,
        nameZh: dividerFrom === "below" ? `${labelPrefix}區底板` : `${labelPrefix}區頂板`,
        material,
        grainDirection: "length",
        visible: { length: zoneW, width: innerD, thickness: shelfT },
        origin: { x: zoneCx, y: boundaryY - shelfT, z: caseInnerZ },
        tenons: [
          { position: "start", type: "tongue-and-groove", length: tenonLen, width: innerD - 10, thickness: shelfTongueT },
          { position: "end", type: "tongue-and-groove", length: tenonLen, width: innerD - 10, thickness: shelfTongueT },
        ],
        mortises: [],
      });
    }

    const drawerFrontT = 18;
    const drawerSideT = 14;
    const drawerBackT = 12;
    const drawerBottomT = 6;
    const drawerGap = 4;
    const colPitch = zoneW / cols;
    const drawerInnerW = colPitch - 4 - 2 * drawerSideT;
    const drawerInnerD = innerD - drawerFrontT - drawerBackT - 6;
    const drawerH = drawerSlotH - drawerGap * 2;
    const dovetailLen = drawerSideT;

    for (let row = 0; row < rows; row++) {
     for (let col = 0; col < cols; col++) {
      const i = row * cols + col;
      const yBase = drawerZoneBottomY + row * drawerSlotH + drawerGap;
      const xCenter = zoneCx - zoneW / 2 + colPitch * col + colPitch / 2;
      const zFront = -width / 2 + drawerFrontT / 2 + 1;
      const zBack = zFront + drawerInnerD + drawerFrontT / 2 + drawerBackT / 2;

      // 面板：左右兩端燕尾榫接側板 — X 旋轉站立
      parts.push({
        id: `${idPrefix}-${i + 1}-front`,
        nameZh: `${labelPrefix}${i + 1} 面板`,
        material,
        grainDirection: "length",
        visible: {
          length: colPitch - 4,
          width: drawerH,
          thickness: drawerFrontT,
        },
        origin: { x: xCenter, y: yBase, z: zFront },
        rotation: { x: Math.PI / 2, y: 0, z: 0 },
        tenons: [
          {
            position: "start",
            type: "dovetail",
            length: dovetailLen,
            width: drawerH - 6,
            thickness: drawerFrontT - 2,
          },
          {
            position: "end",
            type: "dovetail",
            length: dovetailLen,
            width: drawerH - 6,
            thickness: drawerFrontT - 2,
          },
        ],
        mortises: [],
      });

      // 後板（中纖板／雜木）：兩端半搭接（half-lap）入側板 — X 旋轉站立
      parts.push({
        id: `${idPrefix}-${i + 1}-back`,
        nameZh: `${labelPrefix}${i + 1} 後板`,
        material,
        materialOverride: "mdf",
        grainDirection: "length",
        visible: {
          length: drawerInnerW + 2 * drawerSideT,
          width: drawerH - drawerBottomT - 4,
          thickness: drawerBackT,
        },
        origin: { x: xCenter, y: yBase + drawerBottomT + 2, z: zBack },
        rotation: { x: Math.PI / 2, y: 0, z: 0 },
        tenons: [
          {
            position: "start",
            type: "half-lap",
            length: drawerSideT * 0.5,
            width: drawerH - 8,
            thickness: drawerBackT,
          },
          {
            position: "end",
            type: "half-lap",
            length: drawerSideT * 0.5,
            width: drawerH - 8,
            thickness: drawerBackT,
          },
        ],
        mortises: [],
      });

      // 左右側板（中纖板／雜木）— 長度沿 Z，需 {x: π/2, y: π/2} 旋轉
      for (const side of [-1, 1] as const) {
        parts.push({
          id: `${idPrefix}-${i + 1}-side-${side < 0 ? "left" : "right"}`,
          nameZh: `${labelPrefix}${i + 1} ${side < 0 ? "左" : "右"}側板`,
          material,
          materialOverride: "mdf",
          grainDirection: "length",
          visible: {
            length: drawerInnerD + drawerFrontT + drawerBackT - 4,
            width: drawerH,
            thickness: drawerSideT,
          },
          origin: {
            x: xCenter + side * (drawerInnerW / 2 + drawerSideT / 2 + 2),
            y: yBase,
            z: (zFront + zBack) / 2,
          },
          rotation: { x: Math.PI / 2, y: Math.PI / 2, z: 0 },
          tenons: [],
          // 兩端各有燕尾榫眼接面板，背端有半搭接眼接後板
          mortises: [
            {
              origin: { x: 0, y: 0, z: -drawerInnerD / 2 - 1 },
              depth: dovetailLen,
              length: drawerH - 6,
              width: drawerFrontT - 2,
              through: false,
            },
            {
              origin: { x: 0, y: 0, z: drawerInnerD / 2 + 1 },
              depth: drawerSideT * 0.5,
              length: drawerH - 8,
              width: drawerBackT,
              through: false,
            },
            // 底板溝槽
            {
              origin: { x: 0, y: -(drawerH / 2) + drawerBottomT, z: 0 },
              depth: 4,
              length: drawerInnerD - 4,
              width: drawerBottomT + 1,
              through: false,
            },
          ],
        });
      }

      // 底板（6mm 夾板）：四邊舌頭嵌入溝槽
      parts.push({
        id: `${idPrefix}-${i + 1}-bottom`,
        nameZh: `${labelPrefix}${i + 1} 底板`,
        material,
        materialOverride: "plywood",
        grainDirection: "length",
        visible: {
          length: drawerInnerW + 4,
          width: drawerInnerD + 4,
          thickness: drawerBottomT,
        },
        origin: {
          x: xCenter,
          y: yBase + drawerBottomT / 2 + 2,
          z: (zFront + zBack) / 2,
        },
        tenons: [
          {
            position: "start",
            type: "tongue-and-groove",
            length: 4,
            width: drawerInnerD + 4,
            thickness: drawerBottomT,
          },
          {
            position: "end",
            type: "tongue-and-groove",
            length: 4,
            width: drawerInnerD + 4,
            thickness: drawerBottomT,
          },
          {
            position: "left",
            type: "tongue-and-groove",
            length: 4,
            width: drawerInnerW + 4,
            thickness: drawerBottomT,
          },
          {
            position: "right",
            type: "tongue-and-groove",
            length: 4,
            width: drawerInnerW + 4,
            thickness: drawerBottomT,
          },
        ],
        mortises: [],
      });
     }
    }
  };

  // Door zone renderer — can be called multiple times for multi-zone cabinets.
  const renderDoorZone = (cfg: {
    yStart: number;
    height: number;
    count: number;
    doorType: "wood" | "glass";
    idPrefix: string;
    labelPrefix: string;
    xCenter?: number;
    colInnerW?: number;
  }) => {
    const { idPrefix, labelPrefix } = cfg;
    const doorType = cfg.doorType;
    const zoneCx = cfg.xCenter ?? 0;
    const zoneW = cfg.colInnerW ?? innerW;
    const doorW = zoneW / cfg.count;
    const stileW = 60; // 豎梃寬度
    const railW = 60; // 橫檔寬度
    const frameT = 22; // 框料厚度
    const panelT_door = 12; // 木鑲板厚度（玻璃時不計）
    const cornerTenonLen = Math.round(stileW * 0.6);
    const grooveDepth = 8;
    const doorZoneH = cfg.height;
    const doorZoneBottomY = cfg.yStart;

    for (let i = 0; i < cfg.count; i++) {
      const xCenter = zoneCx - zoneW / 2 + i * doorW + doorW / 2;
      const zFront = -width / 2 - frameT / 2 - 1;
      const doorOuterW = doorW - 4;
      const doorOuterH = doorZoneH - 4;
      const innerOpenW = doorOuterW - 2 * stileW;
      const innerOpenH = doorOuterH - 2 * railW;

      // 上橫檔 — 橫放但垂直站立（X 軸旋轉）
      parts.push({
        id: `${idPrefix}-${i + 1}-rail-top`,
        nameZh: `${labelPrefix}${i + 1} 上橫檔`,
        material,
        grainDirection: "length",
        visible: {
          length: innerOpenW,
          width: railW,
          thickness: frameT,
        },
        origin: {
          x: xCenter,
          y: doorZoneBottomY + doorOuterH - railW,
          z: zFront,
        },
        rotation: { x: Math.PI / 2, y: 0, z: 0 },
        tenons: [
          {
            position: "start",
            type: "blind-tenon",
            length: cornerTenonLen,
            width: railW - 10,
            thickness: frameT - 6,
          },
          {
            position: "end",
            type: "blind-tenon",
            length: cornerTenonLen,
            width: railW - 10,
            thickness: frameT - 6,
          },
        ],
        // 內側面開鑲板/玻璃溝槽
        mortises: [
          {
            origin: { x: 0, y: -railW / 2, z: 0 },
            depth: grooveDepth,
            length: innerOpenW - 4,
            width: panelT_door + 1,
            through: false,
          },
        ],
      });

      // 下橫檔
      parts.push({
        id: `${idPrefix}-${i + 1}-rail-bottom`,
        nameZh: `${labelPrefix}${i + 1} 下橫檔`,
        material,
        grainDirection: "length",
        visible: {
          length: innerOpenW,
          width: railW,
          thickness: frameT,
        },
        origin: {
          x: xCenter,
          y: doorZoneBottomY,
          z: zFront,
        },
        rotation: { x: Math.PI / 2, y: 0, z: 0 },
        tenons: [
          {
            position: "start",
            type: "blind-tenon",
            length: cornerTenonLen,
            width: railW - 10,
            thickness: frameT - 6,
          },
          {
            position: "end",
            type: "blind-tenon",
            length: cornerTenonLen,
            width: railW - 10,
            thickness: frameT - 6,
          },
        ],
        mortises: [
          {
            origin: { x: 0, y: railW / 2, z: 0 },
            depth: grooveDepth,
            length: innerOpenW - 4,
            width: panelT_door + 1,
            through: false,
          },
        ],
      });

      // 左右豎梃 — 長度方向是垂直（width=doorOuterH），需要 X 軸旋轉站立
      for (const side of [-1, 1] as const) {
        parts.push({
          id: `${idPrefix}-${i + 1}-stile-${side < 0 ? "left" : "right"}`,
          nameZh: `${labelPrefix}${i + 1} ${side < 0 ? "左" : "右"}豎梃`,
          material,
          grainDirection: "length",
          visible: {
            length: stileW,
            width: doorOuterH,
            thickness: frameT,
          },
          origin: {
            x: xCenter + (side * (doorOuterW / 2 - stileW / 2)),
            y: doorZoneBottomY,
            z: zFront,
          },
          rotation: { x: Math.PI / 2, y: 0, z: 0 },
          tenons: [],
          // 上下端各一個榫眼接橫檔；內側長槽接鑲板
          mortises: [
            {
              origin: {
                x: side > 0 ? -stileW / 2 + 2 : stileW / 2 - 2,
                y: doorOuterH / 2 - railW / 2,
                z: 0,
              },
              depth: cornerTenonLen,
              length: railW - 10,
              width: frameT - 6,
              through: false,
            },
            {
              origin: {
                x: side > 0 ? -stileW / 2 + 2 : stileW / 2 - 2,
                y: -doorOuterH / 2 + railW / 2,
                z: 0,
              },
              depth: cornerTenonLen,
              length: railW - 10,
              width: frameT - 6,
              through: false,
            },
            {
              origin: {
                x: side > 0 ? -stileW / 2 + 2 : stileW / 2 - 2,
                y: 0,
                z: 0,
              },
              depth: grooveDepth,
              length: innerOpenH - 4,
              width: panelT_door + 1,
              through: false,
            },
          ],
        });
      }

      // 鑲板（木門）或玻璃片（玻璃門 — 標記為 part 但材質虛擬）
      if (doorType === "wood") {
        parts.push({
          id: `${idPrefix}-${i + 1}-panel`,
          nameZh: `${labelPrefix}${i + 1} 木鑲板`,
          material,
          grainDirection: "length",
          visible: {
            length: innerOpenW + 2 * grooveDepth - 2,
            width: innerOpenH + 2 * grooveDepth - 2,
            thickness: panelT_door,
          },
          origin: {
            x: xCenter,
            y: doorZoneBottomY + railW - grooveDepth,
            z: zFront,
          },
          rotation: { x: Math.PI / 2, y: 0, z: 0 },
          tenons: [
            {
              position: "start",
              type: "tongue-and-groove",
              length: grooveDepth - 2,
              width: innerOpenH,
              thickness: panelT_door,
            },
            {
              position: "end",
              type: "tongue-and-groove",
              length: grooveDepth - 2,
              width: innerOpenH,
              thickness: panelT_door,
            },
            {
              position: "left",
              type: "tongue-and-groove",
              length: grooveDepth - 2,
              width: innerOpenW,
              thickness: panelT_door,
            },
            {
              position: "right",
              type: "tongue-and-groove",
              length: grooveDepth - 2,
              width: innerOpenW,
              thickness: panelT_door,
            },
          ],
          mortises: [],
        });
      }
      // 玻璃門：加一片透明玻璃給 3D 顯示（不入材料單、不計才）
      if (doorType === "glass") {
        parts.push({
          id: `${idPrefix}-${i + 1}-glass`,
          nameZh: `${labelPrefix}${i + 1} 玻璃片`,
          material,
          grainDirection: "length",
          visible: {
            length: innerOpenW + 2 * grooveDepth - 2,
            width: innerOpenH + 2 * grooveDepth - 2,
            thickness: 5, // 5mm 強化玻璃
          },
          origin: {
            x: xCenter,
            y: doorZoneBottomY + railW - grooveDepth,
            z: zFront,
          },
          rotation: { x: Math.PI / 2, y: 0, z: 0 },
          tenons: [],
          mortises: [],
          visual: "glass",
        });
      }
    }
  };

  // Optional shelves zone — `count` is the number of STORAGE LAYERS (spaces),
  // not shelf panels. Top + bottom boundary dividers (or case panels) already
  // bracket the zone, so we only need `count - 1` internal shelves to split
  // the zone into `count` layers.
  const renderShelvesZone = (cfg: {
    yStart: number;
    height: number;
    count: number;
    idPrefix: string;
    xCenter?: number;
    colInnerW?: number;
  }) => {
    const internalShelves = Math.max(0, cfg.count - 1);
    if (internalShelves === 0) return;
    const zoneCx = cfg.xCenter ?? 0;
    const zoneW = cfg.colInnerW ?? innerW;
    for (let i = 0; i < internalShelves; i++) {
      const y = cfg.yStart + ((i + 1) * cfg.height) / cfg.count;
      parts.push({
        id: `${cfg.idPrefix}-shelf-${i + 1}`,
        nameZh: `層板 ${i + 1}`,
        material,
        grainDirection: "length",
        visible: { length: zoneW, width: innerD, thickness: shelfT },
        origin: { x: zoneCx, y: y - shelfT, z: caseInnerZ },
        tenons: [
          { position: "start", type: "tongue-and-groove", length: tenonLen, width: innerD - 10, thickness: shelfTongueT },
          { position: "end", type: "tongue-and-groove", length: tenonLen, width: innerD - 10, thickness: shelfTongueT },
        ],
        mortises: [],
      });
    }
  };

  // === Dispatch: columns (horizontal split) > zones (vertical) > legacy. ===
  if (opts.columns && opts.columns.length > 0) {
    const cols = opts.columns;
    // Resolve widths: missing widthFrac values split the remainder equally.
    const totalSpec = cols.reduce((a, c) => a + (c.widthFrac ?? 0), 0);
    const unset = cols.filter((c) => c.widthFrac === undefined).length;
    const widths = cols.map((c) => {
      if (c.widthFrac !== undefined) return c.widthFrac;
      return unset > 0 ? (1 - totalSpec) / unset : 1 / cols.length;
    });
    // Partition wall thickness (use panel thickness)
    const partitionW = panelT;
    const totalPartitions = (cols.length - 1) * partitionW;
    const usableW = innerW - totalPartitions;

    // Render each column + vertical partition between columns
    let cursorX = -innerW / 2;
    for (let i = 0; i < cols.length; i++) {
      const col = cols[i];
      const colW = usableW * widths[i];
      const colCx = cursorX + colW / 2;
      const colYStart = caseBottomY + panelT;
      const colH = innerH;
      const idPrefix = `col${i + 1}`;
      const labelPrefix = col.labelPrefix ?? (cols.length === 2 ? (i === 0 ? "左" : "右") : i === 0 ? "左" : i === 1 ? "中" : "右");

      if (col.type === "drawer") {
        renderDrawerZone({
          yStart: colYStart, height: colH,
          rows: col.count ?? 1, cols: col.cols ?? 1,
          idPrefix: `${idPrefix}-drawer`, labelPrefix: `${labelPrefix}抽屜`,
          dividerFrom: "none",
          xCenter: colCx, colInnerW: colW,
        });
      } else if (col.type === "door") {
        renderDoorZone({
          yStart: colYStart, height: colH,
          count: col.count ?? 1, doorType: doorType ?? "wood",
          idPrefix: `${idPrefix}-door`, labelPrefix: `${labelPrefix}門`,
          xCenter: colCx, colInnerW: colW,
        });
      } else if (col.type === "shelves") {
        renderShelvesZone({
          yStart: colYStart, height: colH,
          count: col.count ?? 1, idPrefix,
          xCenter: colCx, colInnerW: colW,
        });
      }
      // "open" → nothing

      cursorX += colW;

      // Add a full-height vertical partition after this column (except last)
      if (i < cols.length - 1) {
        parts.push({
          id: `col-partition-${i + 1}`,
          nameZh: `直立分隔板 ${i + 1}`,
          material,
          grainDirection: "length",
          visible: { length: partitionW, width: innerD, thickness: innerH },
          origin: { x: cursorX + partitionW / 2, y: caseBottomY + panelT, z: caseInnerZ },
          tenons: [],
          mortises: [],
        });
        cursorX += partitionW;
      }
    }
  } else if (opts.zones && opts.zones.length > 0) {
    const zones = opts.zones;
    // Stack zones from bottom up, adding a boundary divider between each
    let cursorY = caseBottomY + panelT;
    for (let i = 0; i < zones.length; i++) {
      const z = zones[i];
      const yStart = cursorY;
      const yEnd = cursorY + z.heightMm;
      const isLast = i === zones.length - 1;
      const labelPrefix =
        zones.length === 3
          ? i === 0 ? "下層" : i === 1 ? "中層" : "上層"
          : `區${i + 1}`;
      const idPrefix = `z${i + 1}`;
      if (z.type === "drawer") {
        renderDrawerZone({
          yStart,
          height: z.heightMm,
          rows: z.count ?? 1,
          cols: z.cols ?? 1,
          idPrefix: `${idPrefix}-drawer`,
          labelPrefix: `${labelPrefix}抽屜`,
          // 在 zones 模式下，區與區之間的邊界板由外層 loop 統一加，
          // 這裡不要重複（否則兩片同 Y 疊在一起 → 看起來厚 + 分解感）
          dividerFrom: "none",
        });
      } else if (z.type === "door") {
        renderDoorZone({
          yStart,
          height: z.heightMm,
          count: z.count ?? 2,
          doorType: (z as { doorTypeOverride?: "wood" | "glass" }).doorTypeOverride ?? doorType ?? "wood",
          idPrefix: `${idPrefix}-door`,
          labelPrefix: `${labelPrefix}門`,
        });
      } else if (z.type === "shelves") {
        renderShelvesZone({
          yStart,
          height: z.heightMm,
          count: z.count ?? 1,
          idPrefix,
        });
      } else if (z.type === "hanging") {
        // 吊衣桿：區中央加一根橫桿，其餘空間留給衣服懸掛
        const rodD = 28;
        const rodY = yStart + Math.min(60, z.heightMm - 60); // 頂端下方 60mm
        parts.push({
          id: `${idPrefix}-rod`,
          nameZh: `${labelPrefix}吊衣桿`,
          material,
          grainDirection: "length",
          visible: { length: innerW, width: rodD, thickness: rodD },
          origin: { x: 0, y: rodY, z: caseInnerZ },
          tenons: [
            { position: "start", type: "blind-tenon", length: 8, width: rodD, thickness: rodD },
            { position: "end", type: "blind-tenon", length: 8, width: rodD, thickness: rodD },
          ],
          mortises: [],
        });
      }
      // zone boundary divider (except above the topmost zone — that uses case top panel)
      if (!isLast) {
        parts.push({
          id: `${idPrefix}-boundary`,
          nameZh: `${labelPrefix}區頂板`,
          material,
          grainDirection: "length",
          visible: { length: innerW, width: innerD, thickness: shelfT },
          origin: { x: 0, y: yEnd - shelfT, z: caseInnerZ },
          tenons: [
            { position: "start", type: "tongue-and-groove", length: tenonLen, width: innerD - 10, thickness: shelfTongueT },
            { position: "end", type: "tongue-and-groove", length: tenonLen, width: innerD - 10, thickness: shelfTongueT },
          ],
          mortises: [],
        });
      }
      cursorY = yEnd;
    }
  } else {
    // Legacy single-zone behavior
    if (drawerCount > 0) {
      const drawerZoneBottomY = drawerAtTop
        ? caseBottomY + panelT + innerH - drawerAreaH
        : caseBottomY + panelT;
      const needBoundary = drawerAreaH < innerH - 1;
      renderDrawerZone({
        yStart: drawerZoneBottomY,
        height: drawerAreaH,
        rows: drawerCount,
        cols: drawerCols,
        idPrefix: "drawer",
        labelPrefix: "抽屜",
        dividerFrom: needBoundary ? (drawerAtTop ? "below" : "above") : "none",
      });
    }
    if (doorCount > 0) {
      renderDoorZone({
        yStart: caseBottomY + panelT + doorYOffset,
        height: opts.doorAreaHeight ?? innerH,
        count: doorCount,
        doorType,
        idPrefix: "door",
        labelPrefix: "門",
      });
    }
  }

  // 吊衣桿（若指定 hangingArea）
  if (opts.hangingArea) {
    const { yStart, yEnd } = opts.hangingArea;
    const rodY = caseBottomY + panelT + (yStart + yEnd) / 2 * innerH;
    const rodD = 28;
    parts.push({
      id: "hanging-rod",
      nameZh: "吊衣桿",
      material,
      grainDirection: "length",
      visible: { length: innerW, width: rodD, thickness: rodD },
      origin: { x: 0, y: rodY, z: 0 },
      tenons: [
        { position: "start", type: "blind-tenon", length: 8, width: rodD, thickness: rodD },
        { position: "end", type: "blind-tenon", length: 8, width: rodD, thickness: rodD },
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
      opts.notes ??
      "頂板/底板/側板半榫接合；層板半榫入側板；背板薄板入兩側溝槽；抽屜/門板需另配五金（滑軌/鉸鏈）。",
  };
}
