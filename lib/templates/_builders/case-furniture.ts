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
  /** Door type:
   *  - "wood"  框 + 木鑲板（5 件 / 扇）
   *  - "glass" 框 + 5mm 強化玻璃（4 框 + 1 玻璃片，玻璃不計才）
   *  - "slab"  整片夾板貼皮（1 件 / 扇，無框，材積走 plywood billing） */
  doorType?: "wood" | "glass" | "slab";
  /** Door mount style — Taiwan 裝潢界 standard 3 modes (all use 西德 hinges):
   *  - "overlay-6" 全蓋（蓋 6 分=18mm）門蓋滿框寬，雙門幾乎相觸（最常見預設）
   *  - "overlay-3" 半蓋（蓋 3 分=9mm）門蓋住框邊一半，留小縫看見框
   *  - "inset"     入柱：門埋進框內、與櫃面齊平。會把內部層板/抽屜深度
   *                自動縮 23mm（門厚 18 + 5mm 安全空隙），給門板留位置。 */
  doorMount?: "overlay-6" | "overlay-3" | "inset";
  /** Drawer face mount style — 同三模式但獨立於門板控制：
   *  - "overlay-6" 全蓋：面板蓋滿框 + 抽屜間中柱
   *  - "overlay-3" 半蓋：面板蓋住框邊 9mm
   *  - "inset"     入柱：面板埋進 slot 內、與框齊平 */
  drawerMount?: "overlay-6" | "overlay-3" | "inset";
  panelThickness?: number;
  shelfThickness?: number;
  backThickness?: number;
  /** 抽屜底板作法：
   *  - "surface" 釘底：3mm 夾板從下方釘在箱底，側/前/後板下緣不開溝。
   *  - "rebated" 入溝：6mm 夾板四邊嵌進溝裡（傳統榫卯抽屜）。
   *  預設 "surface"。 */
  drawerBottomMode?: "surface" | "rebated";
  /** 背板作法：
   *  - "surface" 表面釘背：薄板（預設 3mm 夾板）直接釘/鎖在櫃體背面，
   *    尺寸 = 全外長 × 全外高（蓋過頂/底/側板背緣）。裝潢市場標準作法。
   *  - "rebated" 入溝背板：較厚（預設 9mm）嵌進側板內側溝槽，
   *    尺寸 = 內寬 × 內高。榫卯家具 / 鄉村風松杉木家具標準作法。
   *  - "none" 無背板：開放式櫃體（書櫃 / 陳列架）。
   *  預設 "surface"。 */
  backMode?: "surface" | "rebated" | "none";
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
  /**
   * 抽屜滑軌預留空隙（mm，每側）。使用三段式滑軌五金時需要 12.5mm 間隙；
   * 不使用（傳統木製側拉）填 0 即可。套用在所有抽屜 zone。
   */
  drawerSlideGap?: number;
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
  /** 從 resolveZones 等 helper 帶進來的設計參數警告，會原封不動傳到 design.warnings */
  warnings?: string[];
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
  /**
   * door 類型專用：門內藏的層板片數（0 = 全空）。
   * 門後方加 N 片層板將空間分成 N+1 層收納。
   */
  doorInnerShelves?: number;
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
  const backMode = opts.backMode ?? "surface";
  // 表面釘背預設 3mm 夾板（裝潢慣例）；入溝背板預設 9mm（足夠開溝又不過厚）；
  // 無背板模式 backT=0（內部空間 = 全深，跟 surface 模式幾何上等價，差別只是少一片背板）。
  const backT =
    backMode === "none"
      ? 0
      : opts.backThickness ?? (backMode === "surface" ? 3 : 9);
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
  // surface / none 背板都不佔內部深度；rebated 模式背板嵌在內部 → 扣掉背板厚。
  const innerD = backMode === "rebated" ? width - backT : width;
  const tenonLen = Math.round(panelT * 0.6);
  /**
   * 內部零件（側板 / 層板 / 分隔板 / 抽屜箱）的 Z 軸中心。
   * - surface：innerD = width，內部零件居中放 z=0（前後皆貼齊外緣）。
   * - rebated：innerD = width − backT，向前偏移 backT/2 讓前緣貼齊櫃前面 z=−width/2，
   *   後緣貼齊背板前面（不會跟背板撞）。
   */
  const caseInnerZ = backMode === "rebated" ? -backT / 2 : 0;

  // 門板安裝方式：只影響門板 z 位置 + 該門後方內藏層板的深度
  // 不影響其他 zone 的層板/抽屜/分隔板（那些保持原本 innerD）
  const doorMount = opts.doorMount ?? "overlay-6";
  // 入柱模式：門埋進框內，門後方內藏的層板需縮短深度
  // 門厚 = slab 18mm；wood/glass 框料 22mm
  const insetDoorThick = doorType === "slab" ? 18 : 22;
  // 抽屜面板厚度跟著門板樣式：木鑲板門 / 玻璃門 用 22mm 框料 → 抽屜面板也升 22mm
  // 維持門 / 面板前後緣齊平；平板門或無門時照舊 18mm
  const drawerFacePanelT = doorType === "wood" || doorType === "glass" ? 22 : 18;
  const insetClearance = 5; // 門背與層板之間的安全空隙
  const insetReducedDepth =
    doorMount === "inset" ? insetDoorThick + insetClearance : 0;
  // 抽屜面板安裝方式（與門板獨立設定）
  const drawerMount = opts.drawerMount ?? "overlay-6";

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

  // 背板：三種作法
  // - surface：3mm 夾板釘在櫃體背面，尺寸 = 全外長 × 全外高（蓋滿）
  // - rebated：嵌在側板溝裡，尺寸 = 內寬 × 內高 + 兩端各 6mm 舌頭
  // - none：略過背板（開放式櫃體）
  const isSurfaceBack = backMode === "surface";
  if (backMode !== "none") parts.push({
    id: "back",
    nameZh: isSurfaceBack ? "背板（釘背）" : "背板（入溝）",
    material,
    materialOverride: "plywood",
    grainDirection: "length",
    visible: isSurfaceBack
      ? { length: length, width: backT, thickness: caseHeight }
      : { length: innerW, width: backT, thickness: innerH },
    origin: isSurfaceBack
      ? { x: 0, y: caseBottomY, z: width / 2 + backT / 2 }
      : { x: 0, y: caseBottomY + panelT, z: width / 2 - backT / 2 },
    tenons: isSurfaceBack
      ? []
      : [
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
    /** Override drawer face overlay at bottom edge of zone (mm). When this
     *  zone has a drawer/door zone below, pass shelfT/2 - drawerGap so faces
     *  don't cross the boundary. Default = drawerOverlay. */
    overlayBottom?: number;
    /** Same as overlayBottom but for top edge. */
    overlayTop?: number;
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
    const drawerBottomMode = opts.drawerBottomMode ?? "surface";
    const isSurfaceDrawerBottom = drawerBottomMode === "surface";
    // 釘底 3mm 夾板（裝潢慣例）；入溝 6mm 夾板（傳統榫卯抽屜）
    const drawerBottomT = isSurfaceDrawerBottom ? 3 : 6;
    // 抽屜面板四周統一 2mm 縫隙（與入柱門板同規格）
    const drawerGap = 2;
    // 2 排以上抽屜需在中間插直立分隔板（中柱），供抽屜滑軌固定
    const partitionT = cols > 1 ? panelT : 0;
    const totalPartitionW = (cols - 1) * partitionT;
    const drawerSlotW = (zoneW - totalPartitionW) / cols;
    // 三段式滑軌要左右各留 gap；傳統木製側拉 = 0。
    const slideGap = opts.drawerSlideGap ?? 0;
    const hasSlide = slideGap > 0;
    // —— 抽屜面板安裝方式（mount）————————————————————————————
    // inset：面板在 slot 內、與框齊平；蓋門：面板蓋過框 / partition / 分隔板
    const isInsetDrawer = drawerMount === "inset";
    const drawerOverlay =
      drawerMount === "overlay-3" ? 9 :
      drawerMount === "overlay-6" ? panelT : 0;
    // hasFacePanel：是否需要單獨一片面板（slide 必有；overlay 任何模式必有；inset 無 slide 時面板=箱體前板）
    const hasFacePanel = hasSlide || !isInsetDrawer;
    // 面板厚度（單獨面板才有；inset 無 slide 時 = 0，由箱體前板兼任）
    // 跟門板樣式連動：木鑲板/玻璃門配 22mm 框料 → 抽屜面板也 22mm 對齊
    const faceT = hasFacePanel ? drawerFacePanelT : 0;
    // 「箱體要為了 face 後退多少」— 只有 inset+slide 才有（face 在櫃內前方占空間）
    const faceTBoxOffset = isInsetDrawer && hasSlide ? drawerFacePanelT : 0;
    // 使用滑軌時箱體與背板保留 10mm 空隙防撞；木製側拉維持原本 6mm
    const backClearance = hasSlide ? 10 : 6;
    // 抽屜箱外寬（扣掉滑軌 gap）；若無滑軌，箱體前板有可能直接 = 面板
    const drawerOuterW = drawerSlotW - 2 * slideGap;
    // 箱體實際外寬（位置/側板/back/bottom 都用這個）：
    // - 滑軌模式：直接 = drawerOuterW（slot 寬扣 25mm 滑軌即是箱體寬，不再扣縫）
    // - 無滑軌模式：drawerOuterW - 4（箱體前板兼任面板，左右各 2mm reveal）
    const boxExtW = hasSlide ? drawerOuterW : drawerOuterW - 4;
    const drawerInnerW = boxExtW - 2 * drawerSideT;
    // 箱體可用深度：櫃內深 − faceTBoxOffset − 前留 1mm − 背板空隙
    const drawerInnerD = innerD - faceTBoxOffset - drawerFrontT - drawerBackT - backClearance;
    // butt-joint：每個抽屜 slot 上方都會被一個 divider（相鄰抽屜間）或 zone-
    // boundary（最上一格 dividerFrom='above' 時）佔掉 shelfT 的高度。drawer 高
    // 度要扣 shelfT 才不會穿模到上方分隔板。
    // (最上一格 dividerFrom='none' 的 corner case 會 18mm 矮一點，視覺可接受)
    const drawerH = drawerSlotH - shelfT - drawerGap * 2;
    // 滑軌模式下箱體上下各留 5mm 給滑軌行程（與面板縫隙無關，硬體需求）
    const boxH = hasSlide ? drawerSlotH - shelfT - 10 : drawerH;
    // 滑軌模式 yBase 多縮 (5 - drawerGap) 把箱體推高到對齊滑軌中心
    const boxYOffset = hasSlide ? 5 - drawerGap : 0;
    const dovetailLen = drawerSideT;
    // —— 蓋門模式才用：面板總跨距 + 各面板尺寸 + 起點位置 ————————————
    const inColumn = cfg.colInnerW !== undefined;
    // 預設 zone 上下兩側都用 drawerOverlay 全量延伸；caller 在 zone 邊界
    // 時可傳 shelfT/2 - drawerGap 限制，避免相鄰 zone 的 face 互相蓋過。
    const overlayBot = cfg.overlayBottom ?? drawerOverlay;
    const overlayTop = cfg.overlayTop ?? drawerOverlay;
    const totalFaceW = isInsetDrawer
      ? 0
      : drawerMount === "overlay-6"
        ? (inColumn ? zoneW + 2 * panelT - 2 * drawerGap : length - 2 * drawerGap)
        : zoneW + 2 * drawerOverlay - 2 * drawerGap;
    const totalFaceH = isInsetDrawer
      ? 0
      : zoneH + overlayTop + overlayBot - 2 * drawerGap;
    const perFaceW_ov = isInsetDrawer ? 0 : (totalFaceW - (cols - 1) * drawerGap) / cols;
    const perFaceH_ov = isInsetDrawer ? 0 : (totalFaceH - (rows - 1) * drawerGap) / rows;

    // 先放直立分隔板（中柱）——butt-joint：每 col 邊界 × 每 row 一段，
    // 避開水平分隔板的厚度（不貫穿）
    if (cols > 1) {
      for (let j = 0; j < cols - 1; j++) {
        const partX =
          zoneCx -
          zoneW / 2 +
          (j + 1) * drawerSlotW +
          (j + 0.5) * partitionT;
        for (let r = 0; r < rows; r++) {
          const segYBot =
            r === 0
              ? drawerZoneBottomY
              : drawerZoneBottomY + r * drawerSlotH;
          const segYTop =
            r === rows - 1
              ? drawerZoneBottomY + zoneH
              : drawerZoneBottomY + (r + 1) * drawerSlotH - shelfT;
          const segH = segYTop - segYBot;
          if (segH <= 0) continue;
          parts.push({
            id: `${idPrefix}-col-partition-r${r + 1}-c${j + 1}`,
            nameZh: `${labelPrefix}直立分隔板 r${r + 1} c${j + 1}`,
            material,
            grainDirection: "length",
            visible: { length: partitionT, width: innerD, thickness: segH },
            origin: { x: partX, y: segYBot, z: caseInnerZ },
            tenons: [],
            mortises: [],
          });
        }
      }
    }

    for (let row = 0; row < rows; row++) {
     for (let col = 0; col < cols; col++) {
      const i = row * cols + col;
      const yBase = drawerZoneBottomY + row * drawerSlotH + drawerGap;
      const xCenter =
        zoneCx -
        zoneW / 2 +
        drawerSlotW / 2 +
        col * (drawerSlotW + partitionT);
      // 面板 z：入柱在櫃前內 1mm；蓋門突出櫃前 1mm
      const zFace = isInsetDrawer
        ? -width / 2 + faceT / 2 + 1
        : -width / 2 - faceT / 2 - 1;
      // 箱體前板 z：入柱+slide 退 faceTBoxOffset；其他直接在 slot 內
      const zFront = -width / 2 + faceTBoxOffset + drawerFrontT / 2 + 1;
      const zBack = zFront + drawerInnerD + drawerFrontT / 2 + drawerBackT / 2;

      // —— 外觀面板（slide 必有；overlay 任何模式必有；inset 無 slide 時跳過，由箱體前板兼任）
      if (hasFacePanel) {
        // 計算面板尺寸與位置（inset = slot 內；overlay = 跨多 slot 蓋過 partition/分隔板）
        let faceW: number, faceHeight: number, faceX: number, faceY: number;
        if (isInsetDrawer) {
          faceW = drawerSlotW - 2 * drawerGap;
          faceHeight = drawerSlotH - 2 * drawerGap;
          faceX = xCenter;
          faceY = drawerZoneBottomY + row * drawerSlotH + drawerGap;
        } else {
          faceW = perFaceW_ov;
          faceHeight = perFaceH_ov;
          // 蓋門 grid：起點位置 = 區中心 - totalFaceW/2，row 從 zone 底向下 overlay
          const blockStartX = zoneCx - totalFaceW / 2;
          const blockStartY = drawerZoneBottomY - overlayBot + drawerGap;
          faceX = blockStartX + col * (perFaceW_ov + drawerGap) + perFaceW_ov / 2;
          faceY = blockStartY + row * (perFaceH_ov + drawerGap);
        }
        parts.push({
          id: `${idPrefix}-${i + 1}-face`,
          nameZh: `${labelPrefix}${i + 1} 面板`,
          material,
          grainDirection: "length",
          visible: {
            length: faceW,
            width: faceHeight,
            thickness: faceT,
          },
          origin: { x: faceX, y: faceY, z: zFace },
          rotation: { x: Math.PI / 2, y: 0, z: 0 },
          tenons: [],
          mortises: [],
        });
      }

      // 箱體前板（有獨立面板時叫「箱體前板」；無獨立面板時兼任面板叫「面板」）
      // 左右燕尾榫接側板 — X 旋轉站立
      parts.push({
        id: `${idPrefix}-${i + 1}-front`,
        nameZh: hasFacePanel
          ? `${labelPrefix}${i + 1} 箱體前板`
          : `${labelPrefix}${i + 1} 面板`,
        material,
        grainDirection: "length",
        visible: {
          length: boxExtW,
          width: boxH,
          thickness: drawerFrontT,
        },
        origin: { x: xCenter, y: yBase + boxYOffset, z: zFront },
        rotation: { x: Math.PI / 2, y: 0, z: 0 },
        tenons: [
          {
            position: "start",
            type: "dovetail",
            length: dovetailLen,
            width: boxH - 6,
            thickness: drawerFrontT - 2,
          },
          {
            position: "end",
            type: "dovetail",
            length: dovetailLen,
            width: boxH - 6,
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
          width: boxH - drawerBottomT - 4,
          thickness: drawerBackT,
        },
        origin: { x: xCenter, y: yBase + boxYOffset + drawerBottomT + 2, z: zBack },
        rotation: { x: Math.PI / 2, y: 0, z: 0 },
        tenons: [
          {
            position: "start",
            type: "half-lap",
            length: drawerSideT * 0.5,
            width: boxH - 8,
            thickness: drawerBackT,
          },
          {
            position: "end",
            type: "half-lap",
            length: drawerSideT * 0.5,
            width: boxH - 8,
            thickness: drawerBackT,
          },
        ],
        mortises: [],
      });

      // 左右側板（中纖板／雜木）— 長度沿 Z，需 {x: π/2, y: π/2} 旋轉
      // butt-joint 慣例：side 端面剛好頂在 drawer-front/back 的內側面（不重疊）。
      //   drawer-front 後面 = zFront + drawerFrontT/2
      //   drawer-back 前面 = zBack - drawerBackT/2
      //   side 中心 = (兩面中點)，length = drawerInnerD
      const sideZCenter =
        (zFront + drawerFrontT / 2 + zBack - drawerBackT / 2) / 2;
      for (const side of [-1, 1] as const) {
        parts.push({
          id: `${idPrefix}-${i + 1}-side-${side < 0 ? "left" : "right"}`,
          nameZh: `${labelPrefix}${i + 1} ${side < 0 ? "左" : "右"}側板`,
          material,
          materialOverride: "mdf",
          grainDirection: "length",
          visible: {
            length: drawerInnerD,
            width: boxH,
            thickness: drawerSideT,
          },
          origin: {
            x: xCenter + side * (boxExtW / 2 - drawerSideT / 2),
            y: yBase + boxYOffset,
            z: sideZCenter,
          },
          rotation: { x: Math.PI / 2, y: Math.PI / 2, z: 0 },
          tenons: [],
          // 兩端各有燕尾榫眼接面板，背端有半搭接眼接後板
          // 燕尾深度 = 側板厚 → 通榫，through 標 true 才誠實
          mortises: [
            {
              origin: { x: 0, y: 0, z: -drawerInnerD / 2 - 1 },
              depth: dovetailLen,
              length: boxH - 6,
              width: drawerFrontT - 2,
              through: true,
            },
            {
              origin: { x: 0, y: 0, z: drawerInnerD / 2 + 1 },
              depth: drawerSideT * 0.5,
              length: boxH - 8,
              width: drawerBackT,
              through: false,
            },
            // 底板溝槽（只有入溝模式才有；釘底模式下緣直接釘 3mm 板）
            // 側板 rotation { x: π/2, y: π/2 } 後：local Z 變垂直軸 → 底端 = local +Z
            // （local +Z → world -Y）。原本用 local Y 是錯的——Y 是側板厚度才 ±7mm
            ...(isSurfaceDrawerBottom
              ? []
              : [
                  {
                    origin: { x: 0, y: 0, z: boxH / 2 - drawerBottomT / 2 },
                    depth: 4,
                    length: drawerInnerD - 4,
                    width: drawerBottomT + 1,
                    through: false,
                  },
                ]),
          ],
        });
      }

      // 底板：兩種作法
      // - surface 釘底：3mm 板貼在抽屜箱底，尺寸 = 外框長 × 外框深（蓋過四邊下緣）
      // - rebated 入溝：6mm 板四邊舌頭嵌入溝槽，尺寸 = 內寬+4 × 內深+4
      const drawerOuterD = drawerInnerD + drawerFrontT + drawerBackT;
      parts.push({
        id: `${idPrefix}-${i + 1}-bottom`,
        nameZh: isSurfaceDrawerBottom
          ? `${labelPrefix}${i + 1} 底板（釘底）`
          : `${labelPrefix}${i + 1} 底板（入溝）`,
        material,
        materialOverride: "plywood",
        grainDirection: "length",
        visible: isSurfaceDrawerBottom
          ? { length: boxExtW, width: drawerOuterD, thickness: drawerBottomT }
          : { length: drawerInnerW + 4, width: drawerInnerD + 4, thickness: drawerBottomT },
        origin: {
          x: xCenter,
          // 釘底：底板貼在側板/前後板下方（origin.y 是底面，y 範圍 = [origin.y, origin.y+thickness]）
          // 入溝：底板嵌在溝裡（中心 y = boxYOffset + drawerBottomT/2 + 2，origin.y = +2）
          y: isSurfaceDrawerBottom
            ? yBase + boxYOffset - drawerBottomT
            : yBase + boxYOffset + 2,
          z: (zFront + zBack) / 2,
        },
        tenons: isSurfaceDrawerBottom
          ? []
          : [
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
    doorType: "wood" | "glass" | "slab";
    idPrefix: string;
    labelPrefix: string;
    xCenter?: number;
    colInnerW?: number;
  }) => {
    const { idPrefix, labelPrefix } = cfg;
    const doorType = cfg.doorType;
    const inColumn = cfg.colInnerW !== undefined;
    const zoneCx = cfg.xCenter ?? 0;
    const zoneW = cfg.colInnerW ?? innerW;
    const stileW = 60; // 豎梃寬度
    const railW = 60; // 橫檔寬度
    const frameT = 22; // 框料厚度
    const slabT = 18; // 平板門厚
    const panelT_door = 12; // 木鑲板厚度（玻璃時不計）
    const cornerTenonLen = Math.round(stileW * 0.6);
    const grooveDepth = 8;
    const doorZoneH = cfg.height;
    const doorZoneBottomY = cfg.yStart;
    const doorThick = doorType === "slab" ? slabT : frameT;
    const middleGap = 2; // 雙門之間的縫
    const outerGap = 2; // 外緣留縫供開合
    const overlay3 = 9; // 蓋 3 分 = 9mm 蓋住框邊一半

    // X 軸總跨距：依 doorMount 決定門蓋多少
    // - inset: 門埋進開口內，左右各留 2mm 縫
    // - overlay-3: 門蓋住框邊 9mm，左右各蓋 9mm 後再留 2mm
    // - overlay-6: 門蓋滿全框，覆蓋整個櫃前 (column 模式覆蓋兩側分隔板厚)
    let totalSpan: number;
    if (doorMount === "inset") {
      totalSpan = zoneW - 2 * outerGap;
    } else if (doorMount === "overlay-3") {
      totalSpan = zoneW + 2 * overlay3 - 2 * outerGap;
    } else {
      totalSpan = inColumn
        ? zoneW + 2 * panelT - 2 * outerGap
        : length - 2 * outerGap;
    }
    const perDoorW = (totalSpan - (cfg.count - 1) * middleGap) / cfg.count;

    // Z 位置：入柱 → 門埋進框內（背面齊平櫃前）；蓋門 → 門在櫃前面
    const zFront =
      doorMount === "inset"
        ? -width / 2 + doorThick / 2
        : -width / 2 - doorThick / 2 - 1;

    for (let i = 0; i < cfg.count; i++) {
      const xCenter =
        zoneCx - totalSpan / 2 + i * (perDoorW + middleGap) + perDoorW / 2;
      const doorOuterW = perDoorW;
      const doorOuterH = doorZoneH - 4;
      const innerOpenW = doorOuterW - 2 * stileW;
      const innerOpenH = doorOuterH - 2 * railW;

      // —— Slab 平板門：直接一片夾板覆蓋整個 doorOuterW × doorOuterH ——
      // 表面用主木材色（貼皮），billing 走 plywood（夾板比實木便宜）。
      // 厚度 18mm 是裝潢界對櫃門的常用值。無框、無鑲板，1 件 / 扇。
      if (doorType === "slab") {
        parts.push({
          id: `${idPrefix}-${i + 1}-slab`,
          nameZh: `${labelPrefix}${i + 1} 平板門（夾板貼皮）`,
          material,
          materialOverride: "plywood",
          grainDirection: "length",
          visible: {
            length: doorOuterW,
            width: doorOuterH,
            thickness: slabT,
          },
          origin: {
            x: xCenter,
            y: doorZoneBottomY + 2,
            z: zFront,
          },
          rotation: { x: Math.PI / 2, y: 0, z: 0 },
          tenons: [],
          mortises: [],
        });
        continue; // 跳過下面所有框料 / 鑲板邏輯
      }

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
      // butt-joint 慣例：鑲板尺寸 = 內部開窗（剛好夾在 rails/stiles 之間，不入溝）。
      // 榫接版本可加 tongue-and-groove；組裝版用木釘 / 螺絲固定到框料背面。
      if (doorType === "wood") {
        parts.push({
          id: `${idPrefix}-${i + 1}-panel`,
          nameZh: `${labelPrefix}${i + 1} 木鑲板`,
          material,
          grainDirection: "length",
          visible: {
            length: innerOpenW,
            width: innerOpenH,
            thickness: panelT_door,
          },
          origin: {
            x: xCenter,
            y: doorZoneBottomY + railW,
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
    /** 中文名稱前綴，例：「下層」「上層門內」「左欄」。為空則只顯示「層板 N」（多 zone 易混淆） */
    labelPrefix?: string;
    xCenter?: number;
    colInnerW?: number;
    /** 入柱門後方的內藏層板：深度自動扣 insetReducedDepth 讓位給門 */
    behindInsetDoor?: boolean;
  }) => {
    const internalShelves = Math.max(0, cfg.count - 1);
    if (internalShelves === 0) return;
    const zoneCx = cfg.xCenter ?? 0;
    const zoneW = cfg.colInnerW ?? innerW;
    // 只有「入柱門後方層板」才縮深度，其他 zone 的層板維持 innerD
    const reduce = cfg.behindInsetDoor ? insetReducedDepth : 0;
    const shelfD = innerD - reduce;
    const shelfZ = caseInnerZ + reduce / 2;
    const prefix = cfg.labelPrefix ?? "";
    for (let i = 0; i < internalShelves; i++) {
      const y = cfg.yStart + ((i + 1) * cfg.height) / cfg.count;
      parts.push({
        id: `${cfg.idPrefix}-shelf-${i + 1}`,
        nameZh: `${prefix}層板 ${i + 1}`,
        material,
        grainDirection: "length",
        visible: { length: zoneW, width: shelfD, thickness: shelfT },
        origin: { x: zoneCx, y: y - shelfT, z: shelfZ },
        tenons: [
          { position: "start", type: "tongue-and-groove", length: tenonLen, width: shelfD - 10, thickness: shelfTongueT },
          { position: "end", type: "tongue-and-groove", length: tenonLen, width: shelfD - 10, thickness: shelfTongueT },
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
          labelPrefix: `${labelPrefix}欄`,
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
          : zones.length === 2
            ? i === 0 ? "下層" : "上層"
            : zones.length === 1
              ? ""
              : `區${i + 1}`;
      const idPrefix = `z${i + 1}`;
      // 區頂的 boundary 板（非最上層才有）會吃掉這個 zone 頂部 shelfT mm，
      // 所以傳給 renderer 的 height 要扣掉 boundary 厚度，避免門/抽屜面板的 Y 範圍
      // 撞進 boundary 板（入柱門尤其嚴重——門前緣與 boundary 前緣同 z，會物理穿模）。
      const usableH = isLast ? z.heightMm : z.heightMm - shelfT;
      if (z.type === "drawer") {
        // butt-joint at zone boundary：相鄰 zone（不論 drawer/door/shelves）共享
        // shelfT 厚的 boundary 板，每邊 face 最多延伸 shelfT/2 - drawerGap
        // (中間留 2*drawerGap 縫)。最外側 zone（碰 case top/bot）才用全量
        // drawerOverlay 蓋滿 case 端面。
        const drawerOverlayLocal =
          drawerMount === "overlay-6" ? panelT : drawerMount === "overlay-3" ? 9 : 0;
        // shelfT/2 - 2 (drawerGap) = 每邊 face 蓋過 boundary 多少；中間留
        // 2 + 2 = 4mm 縫不互相蓋過
        const halfBoundary = Math.max(0, Math.round(shelfT / 2) - 2);
        const isFirstZone = i === 0;
        const isTopZone = isLast;
        renderDrawerZone({
          yStart,
          height: usableH,
          rows: z.count ?? 1,
          cols: z.cols ?? 1,
          idPrefix: `${idPrefix}-drawer`,
          labelPrefix: `${labelPrefix}抽屜`,
          // 在 zones 模式下，區與區之間的邊界板由外層 loop 統一加，
          // 這裡不要重複（否則兩片同 Y 疊在一起 → 看起來厚 + 分解感）
          dividerFrom: "none",
          overlayBottom: isFirstZone ? drawerOverlayLocal : halfBoundary,
          overlayTop: isTopZone ? drawerOverlayLocal : halfBoundary,
        });
      } else if (z.type === "door") {
        // 蓋門模式下，門板要往外延伸覆蓋相鄰邊界（case 板 / boundary 板）：
        // - overlay-6：延伸 panelT 蓋滿 case 頂/底板
        // - overlay-3：延伸 9mm 蓋一半
        // - inset：不延伸（門埋在開口內）
        // 鄰居是 case 邊（i==0 / isLast）：延伸 doorOverlap
        // 鄰居是另一個門 zone：兩門共享 boundary，各延伸 shelfT/2 + 1，中間留 2mm reveal
        // 鄰居是非門 zone（shelves/drawer）：延伸 doorOverlap 蓋滿 boundary
        const doorOverlap =
          doorMount === "overlay-6" ? panelT : doorMount === "overlay-3" ? 9 : 0;
        const halfBoundary = Math.round(shelfT / 2 + 1);
        const isFirstZone = i === 0;
        const isTopZone = isLast;
        const neighborBelowIsDoor =
          !isFirstZone && zones[i - 1].type === "door";
        const neighborAboveIsDoor =
          !isTopZone && zones[i + 1].type === "door";
        const extendBottom = isFirstZone
          ? doorOverlap
          : neighborBelowIsDoor
            ? halfBoundary
            : doorOverlap;
        const extendTop = isTopZone
          ? doorOverlap
          : neighborAboveIsDoor
            ? halfBoundary
            : doorOverlap;
        renderDoorZone({
          yStart: yStart - extendBottom,
          height: usableH + extendBottom + extendTop,
          count: z.count ?? 2,
          doorType: (z as { doorTypeOverride?: "wood" | "glass" | "slab" }).doorTypeOverride ?? doorType ?? "wood",
          idPrefix: `${idPrefix}-door`,
          labelPrefix: `${labelPrefix}門`,
        });
        // 門板後方可加內層板（使用者勾選門內層板數時）
        // 入柱模式下這層深度自動扣掉門厚 + 5mm 空隙
        const innerShelves = z.doorInnerShelves ?? 0;
        if (innerShelves > 0) {
          renderShelvesZone({
            yStart,
            height: usableH,
            // renderShelvesZone 的 count 是「儲物層數」=（片數 + 1）
            count: innerShelves + 1,
            idPrefix: `${idPrefix}-door-inner`,
            labelPrefix: `${labelPrefix}門內`,
            behindInsetDoor: doorMount === "inset",
          });
        }
      } else if (z.type === "shelves") {
        renderShelvesZone({
          yStart,
          height: usableH,
          count: z.count ?? 1,
          idPrefix,
          labelPrefix,
        });
      } else if (z.type === "hanging") {
        // 吊衣桿：區中央加一根橫桿，其餘空間留給衣服懸掛
        const rodD = 28;
        const rodY = yStart + Math.min(60, usableH - 60); // 頂端下方 60mm
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
    warnings: opts.warnings && opts.warnings.length > 0 ? opts.warnings : undefined,
  };
}
