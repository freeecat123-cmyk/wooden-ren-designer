import type {
  FurnitureCategory,
  FurnitureDesign,
  MaterialId,
  Part,
} from "@/lib/types";
import { renderDrawerZone as renderDrawerZoneShared, makePullParts as makePullPartsShared } from "./drawer-row";

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
  /** 門框木條寬（橫檔+豎梃同寬），預設 60mm */
  doorFrameRailWidth?: number;
  /** 門框木條厚（凸出櫃面深度），預設 22mm */
  doorFrameThickness?: number;
  /** 玻璃門木格分隔（mullion）樣式；只在 doorType==="glass" 生效 */
  doorMullion?: "none" | "cross" | "vertical-3" | "colonial" | "art-deco";
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
  /** 後板計價材料：
   *  - "inherit" / undefined / "solid" → 跟主材料同（不設 materialOverride）
   *  - "plywood" / "mdf" → 計價走板材
   *  影響材料單分類 + 報價。3D 視覺仍用主材料顏色。 */
  backPanelMaterial?: "inherit" | "plywood" | "mdf" | "solid";
  /** Raise the case on 4 corner legs (e.g. sofa legs). When set, legHeight adds under the bottom panel. */
  legHeight?: number;
  legSize?: number;
  /** Leg shape: box (default), tapered (narrows toward bottom), bracket (triangular foot),
   *  plinth (continuous base frame), panel-side (side panels extend to floor). */
  legShape?: "box" | "tapered" | "bracket" | "plinth" | "panel-side" | "round" | "round-tapered";
  /** Inset legs (or plinth) inward from case outer edge (mm, each side). */
  legInset?: number;
  /** If provided, overrides equal-spacing with custom shelf Y fractions (0..1 from bottom). */
  customShelfFractions?: number[];
  /**
   * 抽屜滑軌預留空隙（mm，每側）。使用三段式滑軌五金時需要 12.5mm 間隙；
   * 不使用（傳統木製側拉）填 0 即可。套用在所有抽屜 zone。
   */
  drawerSlideGap?: number;
  /** 抽屜/門板把手樣式：knob/bar/cup/finger-pull/push-to-open/edge-bevel/none */
  pullStyle?: string;
  /** 門板把手樣式（獨立於抽屜）；undefined = 跟 pullStyle 一樣 */
  doorPullStyle?: string;
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
  /** drawer / door / shelves 橫向再分隔（欄內子欄數） */
  cols?: number;
  /** door / shelves 子欄各欄寬度比例（總和≈1）。長度需 = cols；未傳走均分。 */
  colWidths?: number[];
  /** drawer 類型專用：各排高度比例（fraction 陣列、總和=1）。長度需 = count；未傳走均分。
   *  rowHeights[0] = 最底排（同 CabinetZone.rowHeights 慣例）。 */
  rowHeights?: number[];
  /** door 類型專用：門內藏的層板片數（0 = 全空）。
   *  門後方加 N 片層板將空間分成 N+1 層收納。 */
  doorInnerShelves?: number;
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
  /** shelves only：各欄的「寬度比例」（總和≈1）。長度需 = cols。未傳走均分。
   *  允許使用者指定例如左寬 0.45 / 右自動 0.55 的非等分排版。 */
  colWidths?: number[];
  /** door: open direction label (top = flip-up 掀門, side = swing 開門). */
  doorOpen?: "top" | "side";
  /**
   * door 類型專用：門內藏的層板片數（0 = 全空）。
   * 門後方加 N 片層板將空間分成 N+1 層收納。
   */
  doorInnerShelves?: number;
  /** door 類型專用：門內加吊衣桿（衣櫃用）。true 時門後方加一根吊衣桿，
   *  兩側板加母榫眼。跟 doorInnerShelves 可共存：吊衣空間在 zone 上方、shelves 在下方。 */
  doorInnerHanging?: boolean;
  /** door 類型專用：門內裝抽屜。> 0 時門後方放這麼多排抽屜（取代 shelves）。
   *  抽屜均分整個門內可用高度（與 doorInnerShelves 同邏輯），無水平分隔板。 */
  doorInnerDrawers?: number;
  /** door 類型專用：吊衣空間高度（mm）。doorInnerHanging=true 時生效；
   *  rod 在 zone 頂端 60mm，吊衣空間從頂端往下延伸這個高度。
   *  下方剩餘空間給 doorInnerShelves 用，並會加一片水平隔板做分界。 */
  doorInnerHangingHeight?: number;
  /** door 類型 + cols >= 2 時：每子欄獨立配置。長度需 = cols。
   *  未傳或對應索引為 undefined 走 zone 層級的 doorInnerShelves / Hanging / HangingHeight / Drawers。
   *  widthFrac 未指定的子欄會按剩餘空間平分。
   *  drawers > 0 時取代 shelves（抽屜均分整個子欄門內可用高度、無分隔板）。 */
  doorSubCols?: Array<{
    shelves?: number;
    hanging?: boolean;
    hangingHeight?: number;
    widthFrac?: number;
    drawers?: number;
  }>;
  /** drawer 類型專用：各排高度比例（fraction 陣列、總和=1）。
   *  未傳走均分；長度需 = count。
   *  例：count=2 + [0.4, 0.6] → 下排 = 40% 高、上排 = 60% 高（淺抽放遙控器、深抽放線材）。 */
  rowHeights?: number[];
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
  // legHeight=0 = 明確「不裝腳」，不再自動補；避免 withLegs=false 但 legShape
  // URL 仍是非 box 時被反補成 80/100mm。
  const legHeight = rawLegHeight;
  const legSize = opts.legSize ?? 35;
  const caseBottomY = legHeight; // bottom panel of cabinet sits at this Y

  const caseHeight = height - legHeight;
  const innerW = length - 2 * panelT;
  const innerH = caseHeight - 2 * panelT;
  // 入溝背板用 stopped dado（停止式槽）：
  // - 框體後緣保持完整 panelT 厚（不切到後緣，外觀乾淨）
  // - 內側面開 backT 寬 × 6mm 深的槽，槽位「離後緣 backRecess 處」開始往前延伸 backT
  // - 背板 9mm 整片坐進槽內，後緣陷 backRecess(6mm) 形成可見內凹
  const rebateDepth = backMode === "rebated" ? 6 : 0;       // 切進框板 thickness 的距離
  const backRecess = backMode === "rebated" ? 6 : 0;        // 背板後緣比框體後緣陷的距離
  const innerD = backMode === "rebated" ? width - backT - backRecess : width;
  const tenonLen = Math.round(panelT * 0.6);
  /**
   * 內部零件（側板 / 層板 / 分隔板 / 抽屜箱）的 Z 軸中心。
   * - surface：innerD = width，內部零件居中放 z=0（前後皆貼齊外緣）。
   * - rebated：內部零件後緣貼齊背板前緣，向前偏移 (backT + backRecess)/2。
   */
  const caseInnerZ = backMode === "rebated" ? -(backT + backRecess) / 2 : 0;

  // 門板安裝方式：只影響門板 z 位置 + 該門後方內藏層板的深度
  // 不影響其他 zone 的層板/抽屜/分隔板（那些保持原本 innerD）
  const doorMount = opts.doorMount ?? "overlay-6";
  const pullStyle = opts.pullStyle ?? "none";
  const doorPullStyle = opts.doorPullStyle ?? pullStyle;

  // 把手 helper：依 pullStyle 在 face 前方加一塊把手 part
  // makePullParts 已抽到 _builders/drawer-row.ts；這層包裝餵 closure 的 material/pullStyle
  // idPrefix 帶 -door/-slab 時自動切到 doorPullStyle，否則用 pullStyle（抽屜）
  const makePullParts = (
    idPrefix: string,
    faceX: number,
    faceY: number,
    faceWidth: number,
    faceHeight: number,
    zFaceFront: number,
    pullX?: number,
  ): Part[] => {
    const isDoor = idPrefix.includes("-door") || idPrefix.includes("-slab");
    const style = isDoor ? doorPullStyle : pullStyle;
    return makePullPartsShared(material, style, idPrefix, faceX, faceY, faceWidth, faceHeight, zFaceFront, pullX);
  };
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
          : legShape === "round"
            ? { kind: "round" }
            : legShape === "round-tapered"
              ? { kind: "round-tapered", bottomScale: 0.55 }
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
            // 托腳牙板：從腳內側水平延伸支撐櫃底（butt-joint 慣例：端面貼
            // 腳內面，不嵌入；joinery 模式可在 leg 內側挖盲榫眼搭配，這裡
            // 預設無榫，screw / dowel 鎖固即可）
            const bracketLen = Math.min(legHeight * 1.4, 80);
            parts.push({
              id: `bracket-${sx < 0 ? "l" : "r"}${sz < 0 ? "f" : "b"}`,
              nameZh: `${sz < 0 ? "前" : "後"}${sx < 0 ? "左" : "右"}托腳牙`,
              material,
              grainDirection: "length",
              visible: { length: bracketLen, width: legHeight * 0.7, thickness: 14 },
              origin: {
                x: sx * (legOffsetX - legSize / 2 - bracketLen / 2),
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

  // 頂板。rebated：底面開 stopped dado（離後緣 backRecess 處往前延伸 backT，深 6mm），
  // 槽不切到後緣保持外觀乾淨，背板 9mm 完整方形坐進槽內後緣陷 6mm。
  // dado length = back panel length (innerW + 2*rebateDepth)，不延伸到外端
  // 不然 corner 12mm 沒 back panel 蓋住會露洞。
  const topBottomDado: Part["mortises"] =
    backMode === "rebated"
      ? [
          {
            origin: { x: 0, y: 0, z: width / 2 - backRecess - backT / 2 },
            depth: rebateDepth,
            length: innerW + 2 * rebateDepth,
            width: backT,
            through: false,
            cosmetic: true,
            shape: "rect",
          },
        ]
      : [];
  parts.push({
    id: "top",
    nameZh: "頂板",
    material,
    grainDirection: "length",
    visible: { length, width, thickness: panelT },
    origin: { x: 0, y: caseBottomY + caseHeight - panelT, z: 0 },
    tenons: [],
    mortises: [
      // 兩端各一個榫眼接側板：dim 跟 side panel tongue 對齊（innerD − 8）才能 audit 對位
      {
        origin: { x: -length / 2 + panelT / 2, y: 0, z: 0 },
        depth: tenonLen,
        length: innerD - 8,
        width: panelTongueT,
        through: false,
      },
      {
        origin: { x: length / 2 - panelT / 2, y: 0, z: 0 },
        depth: tenonLen,
        length: innerD - 8,
        width: panelTongueT,
        through: false,
      },
      ...topBottomDado,
    ],
  });

  // 底板。若有底座腳（legHeight > 0 且非 plinth/panel-side）則加 4 個角落
  // 榫眼接腳頂盲榫。這讓 extract.ts 能把「前左腳 → 底板」配對起來。
  // 使用 local legHeight（已含 tapered/bracket 預設 100）而非原始 opts.legHeight
  // （0），audit 才能跟 leg 的 top tenon length 對位。
  const legTenonLen = Math.min(tenonLen, Math.max(5, legHeight));
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
        length: innerD - 8,
        width: panelTongueT,
        through: false,
      },
      {
        origin: { x: length / 2 - panelT / 2, y: 0, z: 0 },
        depth: tenonLen,
        length: innerD - 8,
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
      // rebated 槽在底板「朝上那面」（part-local y=panelT）開
      ...topBottomDado.map((m) => ({ ...m, origin: { ...m.origin, y: panelT } })),
    ],
  });

  // 側板 (左右) — local length points up (innerH), so rotate Z by 90° to stand it
  // 側板深度永遠 = 全 width（rebated 模式也是全深度，背板嵌進來不縮側板）
  for (const side of [-1, 1]) {
    parts.push({
      id: side < 0 ? "side-left" : "side-right",
      nameZh: side < 0 ? "左側板" : "右側板",
      material,
      grainDirection: "length",
      visible: { length: innerH, width: width, thickness: panelT },
      origin: { x: side * (length / 2 - panelT / 2), y: caseBottomY + panelT, z: 0 },
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
      // side-aware origin.y：side panel rotation z=π/2 讓 mesh +Y → world -X
      // 所以 LEFT 用 origin.y=0 (mesh -Y face → world +X = 內側) /
      // RIGHT 用 origin.y=panelT (mesh +Y face → world -X = 內側)。兩邊
      // mortise CSG 都切在 INNER face（朝櫃中心）= shelf tongue 真實入榫面。
      // origin.x 用 fractional position 沿 length (innerH) 軸排
      mortises: [
        ...shelfFractions.map((f) => ({
          origin: {
            x: f * innerH - innerH / 2,
            y: side < 0 ? 0 : panelT,
            z: 0,
          },
          depth: tenonLen,
          length: innerD - 10,
          width: shelfTongueT,
          through: false,
        })),
        // rebated：內側面開 stopped dado（離後緣 backRecess 處往前延伸 backT × 全 innerH 高 × 6mm 深）
        ...(backMode === "rebated"
          ? [
              {
                origin: {
                  x: 0,
                  y: side < 0 ? 0 : panelT,
                  z: width / 2 - backRecess - backT / 2,
                },
                depth: rebateDepth,
                length: innerH,
                width: backT,
                through: false,
                cosmetic: true,
                shape: "rect" as const,
              },
            ]
          : []),
      ],
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
  // 後板計價材料：plywood/mdf 設 override；inherit/solid/undefined 不設 override → 用主材料
  const backBillable = opts.backPanelMaterial;
  const backOverride: "plywood" | "mdf" | undefined =
    backBillable === "plywood" || backBillable === "mdf" ? backBillable : undefined;
  if (backMode !== "none") parts.push({
    id: "back",
    nameZh: isSurfaceBack ? "背板（釘背）" : "背板（入溝）",
    material,
    ...(backOverride ? { materialOverride: backOverride } : {}),
    grainDirection: "length",
    // rebated：背板是完整方形 9mm 厚，body 各方向 +12mm 進 4 框 stopped dado
    // 後緣陷 backRecess(6mm) 形成可見內凹—框體後緣保持完整不切，外觀乾淨
    visible: isSurfaceBack
      ? { length: length, width: backT, thickness: caseHeight }
      : { length: innerW + 2 * rebateDepth, width: backT, thickness: innerH + 2 * rebateDepth },
    origin: isSurfaceBack
      ? { x: 0, y: caseBottomY, z: width / 2 + backT / 2 }
      : { x: 0, y: caseBottomY + panelT - rebateDepth, z: width / 2 - backRecess - backT / 2 },
    tenons: [],
    mortises: [],
  });

  // Drawer zone renderer — 抽到 _builders/drawer-row.ts 共用，這裡只是把
  // closure 內的 host 幾何 (material/panelT/innerW/innerD/width/length…) 餵進去。
  const renderDrawerZone = (cfg: {
    yStart: number;
    height: number;
    rows: number;
    cols: number;
    idPrefix: string;
    labelPrefix: string;
    dividerFrom: "above" | "below" | "none";
    xCenter?: number;
    colInnerW?: number;
    overlayBottom?: number;
    overlayTop?: number;
    extendLeft?: number;
    extendRight?: number;
    rowHeights?: number[];
    skipCaseDividers?: boolean;
  }) => {
    renderDrawerZoneShared({
      ...cfg,
      material,
      panelT,
      shelfT,
      shelfTongueT,
      tenonLen,
      caseLength: length,
      caseWidth: width,
      innerW,
      innerD,
      caseInnerZ,
      drawerFacePanelT,
      drawerMount,
      drawerBottomMode: opts.drawerBottomMode,
      drawerSlideGap: opts.drawerSlideGap,
      pullStyle,
    }, parts);
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
    /** 蓋門 X 軸延伸（單側）。未傳時走原本邏輯（inColumn=panelT、非 inColumn=full case）。
     *  column 模式下需依鄰居計算：邊角 = full overlay，鄰 face = halfBoundary，鄰 shelves = full overlay。 */
    extendLeft?: number;
    extendRight?: number;
    /** 蓋門 Y 軸延伸。zone 模式下由上層算好；column 模式單欄門需自己延伸。 */
    extendBottom?: number;
    extendTop?: number;
    /** 單門時把手位置：left = 靠左豎梃，right = 靠右豎梃，center / 未傳 = 板心 */
    pullSide?: "left" | "right" | "center";
  }) => {
    const { idPrefix, labelPrefix } = cfg;
    const doorType = cfg.doorType;
    const inColumn = cfg.colInnerW !== undefined;
    const zoneCx = cfg.xCenter ?? 0;
    const zoneW = cfg.colInnerW ?? innerW;
    // 門框木條寬度（橫檔+豎梃同寬，傳統明清家具慣例）+ 厚度，可透過 option 覆寫
    const stileW = opts.doorFrameRailWidth ?? 60;
    const railW = opts.doorFrameRailWidth ?? 60;
    const frameT = opts.doorFrameThickness ?? 22;
    const slabT = 18; // 平板門厚
    const panelT_door = 12; // 木鑲板厚度（玻璃時不計）
    const cornerTenonLen = Math.round(stileW * 0.6);
    // 門框榫卯尺寸（正規 cabinet door joinery）：
    // 榫寬（沿 rail width 方向） = railW × 2/3 = 40mm，留 1/6 雙肩各 10mm
    // 榫厚（沿 frameT 方向） = frameT / 3 ≈ 7mm，留約 1/3 雙肩各 7.5mm（防豎梃挖太空）
    const doorTenonW = Math.round((railW * 2) / 3);
    const doorTenonT = Math.round(frameT / 3);
    const grooveDepth = 8;
    const doorZoneH = cfg.height;
    const doorZoneBottomY = cfg.yStart;
    const doorThick = doorType === "slab" ? slabT : frameT;
    const middleGap = 2; // 雙門之間的縫
    const outerGap = 2; // 外緣留縫供開合
    const overlay3 = 9; // 蓋 3 分 = 9mm 蓋住框邊一半

    // X 軸總跨距：依 doorMount 決定門蓋多少
    // - inset: 門埋進開口內，左右各留 2mm 縫
    // - overlay-3: 門蓋住框邊 9mm（單側可由 extendLeft/Right 覆寫）
    // - overlay-6: 門蓋滿全框；column 模式邊角 / 分隔板由 caller 透過 extendLeft/Right 指定
    const overlayBaseSide =
      doorMount === "overlay-6" ? panelT :
      doorMount === "overlay-3" ? overlay3 :
      0;
    const extendLeft = cfg.extendLeft ?? overlayBaseSide;
    const extendRight = cfg.extendRight ?? overlayBaseSide;
    let totalSpan: number;
    if (doorMount === "inset") {
      totalSpan = zoneW - 2 * outerGap;
    } else {
      totalSpan = zoneW + extendLeft + extendRight - 2 * outerGap;
    }
    const perDoorW = (totalSpan - (cfg.count - 1) * middleGap) / cfg.count;
    // X 中心修正：左右延伸不對稱時，整組門需位移 (extendRight - extendLeft) / 2
    const zoneCxAdj = zoneCx + (extendRight - extendLeft) / 2;

    // Z 位置：入柱 → 門埋進框內（背面齊平櫃前）；蓋門 → 門在櫃前面
    const zFront =
      doorMount === "inset"
        ? -width / 2 + doorThick / 2
        : -width / 2 - doorThick / 2 - 1;

    // 門板 Y 範圍：zone 內 outerGap × 2 緊縮 + caller 指定 extendBottom/Top 額外延伸
    const extendBottom = cfg.extendBottom ?? 0;
    const extendTop = cfg.extendTop ?? 0;
    const doorYBase = doorZoneBottomY + outerGap - extendBottom;
    const doorOuterHFull = doorZoneH - 4 + extendBottom + extendTop;

    for (let i = 0; i < cfg.count; i++) {
      const xCenter =
        zoneCxAdj - totalSpan / 2 + i * (perDoorW + middleGap) + perDoorW / 2;
      const doorOuterW = perDoorW;
      const doorOuterH = doorOuterHFull;
      const innerOpenW = doorOuterW - 2 * stileW;
      const innerOpenH = doorOuterH - 2 * railW;

      // —— Slab 平板門：直接一片夾板覆蓋整個 doorOuterW × doorOuterH ——
      // 表面用主木材色（貼皮），billing 走 plywood（夾板比實木便宜）。
      // 厚度 18mm 是裝潢界對櫃門的常用值。無框、無鑲板，1 件 / 扇。
      if (doorType === "slab") {
        // finger-pull 在門板挖 cosmetic mortise（同 drawer face 邏輯）
        const slabPullMortises: Part["mortises"] =
          doorPullStyle === "finger-pull"
            ? [{
                origin: { x: 0, y: 0, z: -doorOuterH / 2 + 14 },
                depth: 12,
                length: Math.min(80, doorOuterW - 20),
                width: 25,
                through: false,
                cosmetic: true,
                shape: "rect",
              }]
            : [];
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
            y: doorYBase,
            z: zFront,
          },
          rotation: { x: Math.PI / 2, y: 0, z: 0 },
          tenons: [],
          mortises: slabPullMortises,
        });
        // 把手：門前緣（z 軸往負前進方向，inset 跟 overlay 都是 zFront - slabT/2）
        // 雙開門 → 把手靠近中縫（內側 40mm 處），跟玻璃/框門邏輯一致；
        // 單門 → 依 pullSide 決定（column 模式靠內側）；多門 → 居中
        const slabPullInset = 40;
        const slabPullOffset = doorOuterW / 2 - slabPullInset;
        const slabPullX =
          cfg.count === 2
            ? i === 0
              ? xCenter + slabPullOffset
              : xCenter - slabPullOffset
            : cfg.count === 1 && cfg.pullSide === "left"
              ? xCenter - slabPullOffset
              : cfg.count === 1 && cfg.pullSide === "right"
                ? xCenter + slabPullOffset
                : xCenter;
        parts.push(...makePullParts(
          `${idPrefix}-${i + 1}-slab`,
          xCenter, doorYBase, doorOuterW, doorOuterH,
          zFront - slabT / 2,
          slabPullX,
        ));
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
          y: doorYBase + doorOuterH - railW,
          z: zFront,
        },
        rotation: { x: Math.PI / 2, y: 0, z: 0 },
        tenons: [
          {
            position: "start",
            type: "blind-tenon",
            length: cornerTenonLen,
            width: doorTenonW,
            thickness: doorTenonT,
          },
          {
            position: "end",
            type: "blind-tenon",
            length: cornerTenonLen,
            width: doorTenonW,
            thickness: doorTenonT,
          },
        ],
        // 鑲板溝槽 mortise 取消（panel 本體已含舌部，無對應公榫）
        mortises: [],
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
          y: doorYBase,
          z: zFront,
        },
        rotation: { x: Math.PI / 2, y: 0, z: 0 },
        tenons: [
          {
            position: "start",
            type: "blind-tenon",
            length: cornerTenonLen,
            width: doorTenonW,
            thickness: doorTenonT,
          },
          {
            position: "end",
            type: "blind-tenon",
            length: cornerTenonLen,
            width: doorTenonW,
            thickness: doorTenonT,
          },
        ],
        // 鑲板溝槽 mortise 取消（panel 本體已含舌部，無對應公榫）
        mortises: [],
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
            y: doorYBase,
            z: zFront,
          },
          rotation: { x: Math.PI / 2, y: 0, z: 0 },
          tenons: [],
          // 上下端各一個榫眼接橫檔；內側長槽接鑲板
          // §M1: stile visible {length:stileW, width:doorOuterH, thickness:frameT}，
          // 後 X-rotation 後 mesh local Z = doorOuterH 軸 = 鉛直軸。
          // 上下端 origin 用 origin.z = ±(doorOuterH/2 - railW/2)（不是 y）。
          // depth 軸 = X（朝 stile 內邊鑽入）；length(railW-10) → Z, width(frameT-6) → Y。
          mortises: [
            {
              origin: {
                x: side > 0 ? -stileW / 2 + 2 : stileW / 2 - 2,
                y: frameT / 2,
                z: doorOuterH / 2 - railW / 2,
              },
              depth: cornerTenonLen,
              length: doorTenonW,
              width: doorTenonT,
              through: false,
            },
            {
              origin: {
                x: side > 0 ? -stileW / 2 + 2 : stileW / 2 - 2,
                y: frameT / 2,
                z: -doorOuterH / 2 + railW / 2,
              },
              depth: cornerTenonLen,
              length: doorTenonW,
              width: doorTenonT,
              through: false,
            },
            // 內側長槽 mortise 取消（panel 本體已含舌部，無對應公榫）
          ],
        });
      }

      // 鑲板（木門）或玻璃片（玻璃門 — 標記為 part 但材質虛擬）
      // butt-joint 慣例：鑲板尺寸 = 內部開窗（剛好夾在 rails/stiles 之間，不入溝）。
      // 榫接版本可加 tongue-and-groove；組裝版用木釘 / 螺絲固定到框料背面。
      if (doorType === "wood") {
        // 整塊矩形鑲板，4 邊各往外伸 grooveDepth 進凹槽（不切角，整片板卡進框）
        // 鑲板本體已涵蓋舌部 → 不再額外掛 tongue-and-groove tenons（避免渲染重複紅虛線）
        const panelOuterW = innerOpenW + 2 * grooveDepth;
        const panelOuterH = innerOpenH + 2 * grooveDepth;
        parts.push({
          id: `${idPrefix}-${i + 1}-panel`,
          nameZh: `${labelPrefix}${i + 1} 木鑲板`,
          material,
          grainDirection: "length",
          visible: {
            length: panelOuterW,
            width: panelOuterH,
            thickness: panelT_door,
          },
          origin: {
            x: xCenter,
            y: doorYBase + railW - grooveDepth,
            z: zFront,
          },
          rotation: { x: Math.PI / 2, y: 0, z: 0 },
          tenons: [],
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
            y: doorYBase + railW - grooveDepth,
            z: zFront,
          },
          rotation: { x: Math.PI / 2, y: 0, z: 0 },
          // 玻璃片本體尺寸已含舌部（+2*grooveDepth），不再掛 tenon metadata
          tenons: [],
          mortises: [],
          visual: "glass",
        });

        // —— 玻璃門木格分隔（mullion） ——
        // 木條面寬 22mm（沿垂直/水平方向），厚 frameT/2（沿 Z 軸，比門框淺一半），
        // Z 位置略 proud 1mm 避免跟玻璃 z-fight。木格只在內開窗範圍內（innerOpenW×innerOpenH）。
        const mullionMode = opts.doorMullion ?? "none";
        if (mullionMode !== "none" && innerOpenW > 30 && innerOpenH > 30) {
          const muleW = 22;          // 木條面寬
          const muleT = Math.max(6, Math.round(frameT / 2)); // Z 軸厚（淺於門框）
          const muleZ = zFront + 1;  // proud 1mm
          const winCx = xCenter;
          const winYBase = doorYBase + railW; // 內框底
          const winYTop = winYBase + innerOpenH;
          const winYMid = winYBase + innerOpenH / 2;
          const mullionMat = material;

          // 水平木格：跟 rail 同樣 X 軸旋轉，length 沿 X，width 沿垂直（=muleW），thickness 沿 Z
          // origin.y 取「條的底邊 y」（rotation 後 width 軸往 +Y 延伸）
          const pushHoriz = (idx: number, centerY: number) => {
            parts.push({
              id: `${idPrefix}-${i + 1}-mullion-${mullionMode}-${idx}`,
              nameZh: `${labelPrefix}${i + 1} 木格 (${mullionMode}) ${idx}`,
              material: mullionMat,
              grainDirection: "length",
              visible: { length: innerOpenW, width: muleW, thickness: muleT },
              origin: { x: winCx, y: centerY - muleW / 2, z: muleZ },
              rotation: { x: Math.PI / 2, y: 0, z: 0 },
              tenons: [],
              mortises: [],
            });
          };
          // 垂直木格：跟 stile 同樣 X 軸旋轉，length 沿 X（=muleW），width 沿垂直（=innerOpenH），thickness 沿 Z
          // origin.y = winYBase（width 軸往 +Y 延伸到 winYTop）
          const pushVert = (idx: number, centerX: number) => {
            parts.push({
              id: `${idPrefix}-${i + 1}-mullion-${mullionMode}-${idx}`,
              nameZh: `${labelPrefix}${i + 1} 木格 (${mullionMode}) ${idx}`,
              material: mullionMat,
              grainDirection: "length",
              visible: { length: muleW, width: innerOpenH, thickness: muleT },
              origin: { x: centerX, y: winYBase, z: muleZ },
              rotation: { x: Math.PI / 2, y: 0, z: 0 },
              tenons: [],
              mortises: [],
            });
          };

          if (mullionMode === "cross") {
            // 1 條垂直（中央）+ 1 條水平（中央）→ 4 格
            pushVert(1, winCx);
            pushHoriz(2, winYMid);
          } else if (mullionMode === "vertical-3") {
            // 2 條垂直，把 X 分 3 等份（X = 1/3、2/3）
            pushVert(1, winCx - innerOpenW / 6);
            pushVert(2, winCx + innerOpenW / 6);
          } else if (mullionMode === "colonial") {
            // 1 條垂直 + 2 條水平（2 欄 × 3 列 = 6 格）
            pushVert(1, winCx);
            pushHoriz(2, winYBase + innerOpenH / 3);
            pushHoriz(3, winYBase + (innerOpenH * 2) / 3);
          } else if (mullionMode === "art-deco") {
            // 「太陽輻射」造型：中央一個正方塊 + 4 個正交方向短木條伸到內框邊緣。
            // 全用單軸 X 軸旋轉（同 rail/stile），避免雙軸 ZYX Euler 撞 worldExtents bug。
            // 中央方塊：muleW × muleW，置於視窗中心
            parts.push({
              id: `${idPrefix}-${i + 1}-mullion-art-deco-center`,
              nameZh: `${labelPrefix}${i + 1} 木格 (art-deco) 中心`,
              material: mullionMat,
              grainDirection: "length",
              visible: { length: muleW, width: muleW, thickness: muleT },
              origin: { x: winCx, y: winYMid - muleW / 2, z: muleZ },
              rotation: { x: Math.PI / 2, y: 0, z: 0 },
              tenons: [],
              mortises: [],
            });
            // 垂直方向：上、下短木條（從中央方塊邊到內框上/下緣）
            const halfV = innerOpenH / 2 - muleW / 2;
            if (halfV > 5) {
              // 下射：origin.y=winYBase，往上長 halfV
              parts.push({
                id: `${idPrefix}-${i + 1}-mullion-art-deco-down`,
                nameZh: `${labelPrefix}${i + 1} 木格 (art-deco) 下射`,
                material: mullionMat,
                grainDirection: "length",
                visible: { length: muleW, width: halfV, thickness: muleT },
                origin: { x: winCx, y: winYBase, z: muleZ },
                rotation: { x: Math.PI / 2, y: 0, z: 0 },
                tenons: [],
                mortises: [],
              });
              // 上射：origin.y=winYMid+muleW/2，往上長 halfV
              parts.push({
                id: `${idPrefix}-${i + 1}-mullion-art-deco-up`,
                nameZh: `${labelPrefix}${i + 1} 木格 (art-deco) 上射`,
                material: mullionMat,
                grainDirection: "length",
                visible: { length: muleW, width: halfV, thickness: muleT },
                origin: { x: winCx, y: winYMid + muleW / 2, z: muleZ },
                rotation: { x: Math.PI / 2, y: 0, z: 0 },
                tenons: [],
                mortises: [],
              });
            }
            // 水平方向：左、右短木條
            const halfH = innerOpenW / 2 - muleW / 2;
            if (halfH > 5) {
              parts.push({
                id: `${idPrefix}-${i + 1}-mullion-art-deco-left`,
                nameZh: `${labelPrefix}${i + 1} 木格 (art-deco) 左射`,
                material: mullionMat,
                grainDirection: "length",
                visible: { length: halfH, width: muleW, thickness: muleT },
                origin: { x: winCx - muleW / 2 - halfH / 2, y: winYMid - muleW / 2, z: muleZ },
                rotation: { x: Math.PI / 2, y: 0, z: 0 },
                tenons: [],
                mortises: [],
              });
              parts.push({
                id: `${idPrefix}-${i + 1}-mullion-art-deco-right`,
                nameZh: `${labelPrefix}${i + 1} 木格 (art-deco) 右射`,
                material: mullionMat,
                grainDirection: "length",
                visible: { length: halfH, width: muleW, thickness: muleT },
                origin: { x: winCx + muleW / 2 + halfH / 2, y: winYMid - muleW / 2, z: muleZ },
                rotation: { x: Math.PI / 2, y: 0, z: 0 },
                tenons: [],
                mortises: [],
              });
            }
          }
        }
      }
      // 框門 / 玻璃門把手：鎖在門板正面（ring-chinese / drop-bail 中式或古典款專用）
      // 雙開門：把手鎖在「內側豎梃中央」（兩扇相對的那條邊框，把手在中縫處）。
      // 單門 / 3 扇以上：沒有明確「內外」概念，把手回到面板中央。
      const innerStileOffset = doorOuterW / 2 - stileW / 2;
      const pullX =
        cfg.count === 2
          ? i === 0
            ? xCenter + innerStileOffset // 左門 → 把手在右側內框
            : xCenter - innerStileOffset // 右門 → 把手在左側內框
          : cfg.count === 1 && cfg.pullSide === "left"
            ? xCenter - innerStileOffset
            : cfg.count === 1 && cfg.pullSide === "right"
              ? xCenter + innerStileOffset
              : xCenter;
      parts.push(...makePullParts(
        `${idPrefix}-${i + 1}-door`,
        xCenter, doorYBase, doorOuterW, doorOuterH,
        zFront - frameT / 2,
        pullX,
      ));
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
    // 鄰居感知：邊角 = 完整 overlay 蓋 case 側板；
    // 鄰 face 欄（drawer/door）= halfBoundary 兩邊各蓋一半 partition + 1mm reveal；
    // 鄰非 face 欄（shelves/none）= 完整 overlay 蓋 partition（讓 face 視覺連續）
    const isFaceCol = (t: string) => t === "drawer" || t === "door";
    const doorOverlay = doorMount === "overlay-6" ? panelT : doorMount === "overlay-3" ? 9 : 0;
    const drawerOverlayCol = drawerMount === "overlay-6" ? panelT : drawerMount === "overlay-3" ? 9 : 0;
    const halfBoundaryDoor = Math.max(0, Math.round(panelT / 2 - 1));
    const halfBoundaryDrawer = Math.max(0, Math.round(panelT / 2 - 1));
    let cursorX = -innerW / 2;
    for (let i = 0; i < cols.length; i++) {
      const col = cols[i];
      const colW = usableW * widths[i];
      const colCx = cursorX + colW / 2;
      const colYStart = caseBottomY + panelT;
      const colH = innerH;
      const idPrefix = `col${i + 1}`;
      const labelPrefix = col.labelPrefix ?? (cols.length === 2 ? (i === 0 ? "左" : "右") : i === 0 ? "左" : i === 1 ? "中" : "右");
      // 鄰居：i-1 = 世界 -X 鄰居（drawer/door cursorX 較小）；i+1 = +X 鄰居
      const leftNeighbor = i > 0 ? cols[i - 1].type : null;
      const rightNeighbor = i < cols.length - 1 ? cols[i + 1].type : null;

      if (col.type === "drawer") {
        const extL = leftNeighbor === null
          ? drawerOverlayCol
          : isFaceCol(leftNeighbor) ? halfBoundaryDrawer : drawerOverlayCol;
        const extR = rightNeighbor === null
          ? drawerOverlayCol
          : isFaceCol(rightNeighbor) ? halfBoundaryDrawer : drawerOverlayCol;
        renderDrawerZone({
          yStart: colYStart, height: colH,
          rows: col.count ?? 1, cols: col.cols ?? 1,
          idPrefix: `${idPrefix}-drawer`, labelPrefix: `${labelPrefix}抽屜`,
          dividerFrom: "none",
          xCenter: colCx, colInnerW: colW,
          extendLeft: extL, extendRight: extR,
          overlayBottom: drawerOverlayCol, overlayTop: drawerOverlayCol,
          rowHeights: col.rowHeights,
        });
      } else if (col.type === "door") {
        const extL = leftNeighbor === null
          ? doorOverlay
          : isFaceCol(leftNeighbor) ? halfBoundaryDoor : doorOverlay;
        const extR = rightNeighbor === null
          ? doorOverlay
          : isFaceCol(rightNeighbor) ? halfBoundaryDoor : doorOverlay;
        const nDoorSubCols = Math.max(1, col.cols ?? 1);
        if (nDoorSubCols < 2) {
          // 單門時把手位置：靠內側（中欄→中央、邊欄→朝中央方向）
          const pullSide: "left" | "right" | "center" =
            (col.count ?? 1) !== 1 || cols.length === 1
              ? "center"
              : i === 0
                ? "right" // 最 -X 欄（世界右）→ 內側在 +X
                : i === cols.length - 1
                  ? "left" // 最 +X 欄（世界左）→ 內側在 -X
                  : "center";
          renderDoorZone({
            yStart: colYStart, height: colH,
            count: col.count ?? 1, doorType: doorType ?? "wood",
            idPrefix: `${idPrefix}-door`, labelPrefix: `${labelPrefix}門`,
            xCenter: colCx, colInnerW: colW,
            extendLeft: extL, extendRight: extR,
            extendBottom: doorOverlay, extendTop: doorOverlay,
            pullSide,
          });
          const innerShelvesCol = col.doorInnerShelves ?? 0;
          if (innerShelvesCol > 0) {
            renderShelvesZone({
              yStart: colYStart, height: colH,
              count: innerShelvesCol + 1,
              idPrefix: `${idPrefix}-door-inner`,
              labelPrefix: `${labelPrefix}門內`,
              xCenter: colCx, colInnerW: colW,
              behindInsetDoor: doorMount === "inset",
            });
          }
        } else {
          // 多子欄門：欄內再切 N 個子欄，每子欄 count 扇門 + 子欄間直立分隔板
          const subPartW = panelT;
          const totalSubPart = (nDoorSubCols - 1) * subPartW;
          const subUsableW = colW - totalSubPart;
          let subFracs: number[];
          if (col.colWidths && col.colWidths.length === nDoorSubCols && col.colWidths.every((f) => f > 0)) {
            const s = col.colWidths.reduce((a, b) => a + b, 0);
            subFracs = col.colWidths.map((f) => f / s);
          } else {
            subFracs = new Array(nDoorSubCols).fill(1 / nDoorSubCols);
          }
          // sub 排序與 cols 一致：cursorX 由 colCx - colW/2 起遞增（世界左→右）
          let subCursorX = colCx - colW / 2;
          for (let sc = 0; sc < nDoorSubCols; sc++) {
            const subW = subUsableW * subFracs[sc];
            const subCx = subCursorX + subW / 2;
            const subL = sc === 0 ? extL : halfBoundaryDoor;
            const subR = sc === nDoorSubCols - 1 ? extR : halfBoundaryDoor;
            renderDoorZone({
              yStart: colYStart, height: colH,
              count: col.count ?? 1, doorType: doorType ?? "wood",
              idPrefix: `${idPrefix}-sub${sc + 1}-door`,
              labelPrefix: `${labelPrefix}子${sc + 1}門`,
              xCenter: subCx, colInnerW: subW,
              extendLeft: subL, extendRight: subR,
              extendBottom: doorOverlay, extendTop: doorOverlay,
              pullSide: "center",
            });
            const subInnerShelves = col.doorInnerShelves ?? 0;
            if (subInnerShelves > 0) {
              renderShelvesZone({
                yStart: colYStart, height: colH,
                count: subInnerShelves + 1,
                idPrefix: `${idPrefix}-sub${sc + 1}-door-inner`,
                labelPrefix: `${labelPrefix}子${sc + 1}門內`,
                xCenter: subCx, colInnerW: subW,
                behindInsetDoor: doorMount === "inset",
              });
            }
            subCursorX += subW;
            if (sc < nDoorSubCols - 1) {
              parts.push({
                id: `${idPrefix}-sub-partition-${sc + 1}`,
                nameZh: `${labelPrefix}子欄分隔板 ${sc + 1}`,
                material,
                grainDirection: "length",
                visible: { length: subPartW, width: innerD, thickness: innerH },
                origin: { x: subCursorX + subPartW / 2, y: caseBottomY + panelT, z: caseInnerZ },
                tenons: [],
                mortises: [],
              });
              subCursorX += subPartW;
            }
          }
        }
      } else if (col.type === "shelves") {
        const nShelvesSubCols = Math.max(1, col.cols ?? 1);
        if (nShelvesSubCols < 2) {
          renderShelvesZone({
            yStart: colYStart, height: colH,
            count: col.count ?? 1, idPrefix,
            labelPrefix: `${labelPrefix}欄`,
            xCenter: colCx, colInnerW: colW,
          });
        } else {
          const subPartW = panelT;
          const totalSubPart = (nShelvesSubCols - 1) * subPartW;
          const subUsableW = colW - totalSubPart;
          let subFracs: number[];
          if (col.colWidths && col.colWidths.length === nShelvesSubCols && col.colWidths.every((f) => f > 0)) {
            const s = col.colWidths.reduce((a, b) => a + b, 0);
            subFracs = col.colWidths.map((f) => f / s);
          } else {
            subFracs = new Array(nShelvesSubCols).fill(1 / nShelvesSubCols);
          }
          let subCursorX = colCx - colW / 2;
          for (let sc = 0; sc < nShelvesSubCols; sc++) {
            const subW = subUsableW * subFracs[sc];
            const subCx = subCursorX + subW / 2;
            renderShelvesZone({
              yStart: colYStart, height: colH,
              count: col.count ?? 1,
              idPrefix: `${idPrefix}-sub${sc + 1}`,
              labelPrefix: `${labelPrefix}欄子${sc + 1}`,
              xCenter: subCx, colInnerW: subW,
            });
            subCursorX += subW;
            if (sc < nShelvesSubCols - 1) {
              parts.push({
                id: `${idPrefix}-shelves-sub-partition-${sc + 1}`,
                nameZh: `${labelPrefix}子欄分隔板 ${sc + 1}`,
                material,
                grainDirection: "length",
                visible: { length: subPartW, width: innerD, thickness: innerH },
                origin: { x: subCursorX + subPartW / 2, y: caseBottomY + panelT, z: caseInnerZ },
                tenons: [],
                mortises: [],
              });
              subCursorX += subPartW;
            }
          }
        }
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
          rowHeights: z.rowHeights,
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
        // 鄰 face zone（door 或 drawer 都會生面板）→ 共享 boundary 各覆蓋一半 +
        // 留 4mm reveal；鄰非 face zone（shelves）→ 全延伸蓋住 boundary。
        const isFaceZone = (t: string) => t === "door" || t === "drawer";
        const neighborBelowIsFace =
          !isFirstZone && isFaceZone(zones[i - 1].type);
        const neighborAboveIsFace =
          !isTopZone && isFaceZone(zones[i + 1].type);
        const extendBottom = isFirstZone
          ? doorOverlap
          : neighborBelowIsFace
            ? halfBoundary
            : doorOverlap;
        const extendTop = isTopZone
          ? doorOverlap
          : neighborAboveIsFace
            ? halfBoundary
            : doorOverlap;
        const effectiveDoorType = (z as { doorTypeOverride?: "wood" | "glass" | "slab" }).doorTypeOverride ?? doorType ?? "wood";
        const innerShelves = z.doorInnerShelves ?? 0;
        const doorHasHanging = z.doorInnerHanging === true;
        const nDoorCols = Math.max(1, z.cols ?? 1);
        if (nDoorCols < 2) {
          renderDoorZone({
            yStart, height: usableH,
            count: z.count ?? 2,
            doorType: effectiveDoorType,
            idPrefix: `${idPrefix}-door`,
            labelPrefix: `${labelPrefix}門`,
            extendBottom, extendTop,
          });
          // 計算吊衣空間切分點：doorHasHanging 時 zone 上方留 hangingHeight 給掛衣，
          // 下方剩餘空間給 doorInnerShelves 或 doorInnerDrawers
          const hangingHeightRaw = z.doorInnerHangingHeight ?? 1200;
          const hangingHeight = doorHasHanging
            ? Math.min(Math.max(200, hangingHeightRaw), usableH)
            : 0;
          const shelvesAreaH = doorHasHanging ? usableH - hangingHeight : usableH;
          const shelvesAreaYStart = yStart;
          const innerDrawers = z.doorInnerDrawers ?? 0;
          if (innerDrawers > 0 && shelvesAreaH > 0) {
            // 抽屜均分整個門內可用高度（與 renderShelvesZone 一致），無分隔板。
            renderDrawerZone({
              yStart: shelvesAreaYStart,
              height: shelvesAreaH,
              rows: innerDrawers, cols: 1,
              idPrefix: `${idPrefix}-doordr`,
              labelPrefix: `${labelPrefix}門內抽屜`,
              dividerFrom: "none",
              overlayBottom: 0, overlayTop: 0,
              skipCaseDividers: true,
            });
          } else if (innerShelves > 0 && shelvesAreaH > 0) {
            renderShelvesZone({
              yStart: shelvesAreaYStart,
              height: shelvesAreaH,
              count: innerShelves + 1,
              idPrefix: `${idPrefix}-door-inner`,
              labelPrefix: `${labelPrefix}門內`,
              behindInsetDoor: doorMount === "inset",
            });
          }
          if (doorHasHanging) {
            // 吊衣 / shelves 分界：水平隔板（hangingHeight < usableH 才生）
            // id 故意不含 "-door-" 避免 xray face 模式誤把它當門板隱藏。
            if (hangingHeight < usableH) {
              const dividerY = yStart + shelvesAreaH;
              parts.push({
                id: `${idPrefix}-hang-divider`,
                nameZh: `${labelPrefix}門內吊衣分界板`,
                material,
                grainDirection: "length",
                visible: { length: innerW, width: innerD, thickness: shelfT },
                origin: { x: 0, y: dividerY, z: caseInnerZ },
                tenons: [
                  { position: "start", type: "tongue-and-groove", length: tenonLen, width: innerD - 10, thickness: shelfTongueT },
                  { position: "end", type: "tongue-and-groove", length: tenonLen, width: innerD - 10, thickness: shelfTongueT },
                ],
                mortises: [],
              });
            }
            // 吊衣桿：在吊衣空間頂端下方 60mm
            const rodD = 28;
            const rodY = yStart + Math.max(60, usableH - 60);
            parts.push({
              id: `${idPrefix}-hang-rod`,
              nameZh: `${labelPrefix}門內吊衣桿`,
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
            const sidePanels = parts.filter(
              (p) => p.id === "side-left" || p.id === "side-right",
            );
            for (const sp of sidePanels) {
              const sideIsLeft = sp.id === "side-left";
              const rodLocalX = rodY - (caseBottomY + panelT) - innerH / 2;
              sp.mortises = [
                ...sp.mortises,
                {
                  origin: { x: rodLocalX, y: sideIsLeft ? 0 : panelT, z: 0 },
                  depth: 8,
                  length: rodD,
                  width: rodD,
                  through: false,
                },
              ];
            }
          }
        } else {
          // 多欄門：每欄一個獨立 renderDoorZone + 中間直立分隔板
          const partitionW = panelT;
          const totalPartitions = (nDoorCols - 1) * partitionW;
          const subUsableW = innerW - totalPartitions;
          // 寬度比例：先讀 doorSubCols[i].widthFrac（使用者個別指定），
          // 沒指定的子欄平分剩餘空間。
          let fracs: number[];
          const subs = z.doorSubCols ?? [];
          if (z.colWidths && z.colWidths.length === nDoorCols && z.colWidths.every((f) => f > 0)) {
            const sum = z.colWidths.reduce((a, b) => a + b, 0);
            fracs = z.colWidths.map((f) => f / sum);
          } else if (subs.some((s) => s.widthFrac && s.widthFrac > 0)) {
            const specified: number[] = [];
            const unsetIdx: number[] = [];
            let specSum = 0;
            for (let i = 0; i < nDoorCols; i++) {
              const w = subs[i]?.widthFrac;
              if (w && w > 0) {
                specified[i] = w;
                specSum += w;
              } else {
                unsetIdx.push(i);
              }
            }
            const remaining = Math.max(0.05, 1 - specSum);
            const eachUnset = unsetIdx.length > 0 ? remaining / unsetIdx.length : 0;
            fracs = new Array(nDoorCols).fill(0).map((_, i) =>
              specified[i] !== undefined ? specified[i] : eachUnset,
            );
          } else {
            fracs = new Array(nDoorCols).fill(1 / nDoorCols);
          }
          const doorOverlayCol = doorMount === "overlay-6" ? panelT : doorMount === "overlay-3" ? 9 : 0;
          const halfBoundaryCol = Math.max(0, Math.round(panelT / 2 - 1));
          let subCursorX = -innerW / 2;
          for (let ci = 0; ci < nDoorCols; ci++) {
            const colW = subUsableW * fracs[ci];
            const colCx = subCursorX + colW / 2;
            const colLabel = nDoorCols === 2
              ? (ci === 0 ? "左" : "右")
              : ci === 0 ? "左" : ci === 1 && nDoorCols === 3 ? "中" : "右";
            const extL = ci === 0 ? doorOverlayCol : halfBoundaryCol;
            const extR = ci === nDoorCols - 1 ? doorOverlayCol : halfBoundaryCol;
            renderDoorZone({
              yStart, height: usableH,
              count: z.count ?? 1,
              doorType: effectiveDoorType,
              idPrefix: `${idPrefix}-col${ci + 1}-door`,
              labelPrefix: `${labelPrefix}${colLabel}欄門`,
              xCenter: colCx, colInnerW: colW,
              extendLeft: extL, extendRight: extR,
              extendBottom, extendTop,
            });
            // 子欄獨立設定：subs[i] 沒有則 fallback 到 zone 層級
            const subCfg = subs[ci] ?? {};
            const subShelvesCnt = subCfg.shelves ?? innerShelves;
            const subDrawers = subCfg.drawers ?? (z.doorInnerDrawers ?? 0);
            const subHasHanging = subCfg.hanging ?? doorHasHanging;
            const subHangingHeightRaw = subCfg.hangingHeight ?? (z.doorInnerHangingHeight ?? 1200);
            const subHangingHeight = subHasHanging
              ? Math.min(Math.max(200, subHangingHeightRaw), usableH)
              : 0;
            const subShelvesAreaH = subHasHanging ? usableH - subHangingHeight : usableH;
            if (subDrawers > 0 && subShelvesAreaH > 0) {
              // 抽屜均分整個子欄門內可用高度（與 renderShelvesZone 一致），無分隔板。
              renderDrawerZone({
                yStart,
                height: subShelvesAreaH,
                rows: subDrawers, cols: 1,
                idPrefix: `${idPrefix}-col${ci + 1}-doordr`,
                labelPrefix: `${labelPrefix}${colLabel}欄門內抽屜`,
                dividerFrom: "none",
                xCenter: colCx, colInnerW: colW,
                overlayBottom: 0, overlayTop: 0,
                skipCaseDividers: true,
              });
            } else if (subShelvesCnt > 0 && subShelvesAreaH > 0) {
              renderShelvesZone({
                yStart,
                height: subShelvesAreaH,
                count: subShelvesCnt + 1,
                idPrefix: `${idPrefix}-col${ci + 1}-door-inner`,
                labelPrefix: `${labelPrefix}${colLabel}欄門內`,
                xCenter: colCx, colInnerW: colW,
                behindInsetDoor: doorMount === "inset",
              });
            }
            if (subHasHanging) {
              if (subHangingHeight < usableH) {
                const subDividerY = yStart + subShelvesAreaH;
                parts.push({
                  id: `${idPrefix}-col${ci + 1}-hang-divider`,
                  nameZh: `${labelPrefix}${colLabel}欄門內吊衣分界板`,
                  material,
                  grainDirection: "length",
                  visible: { length: colW, width: innerD, thickness: shelfT },
                  origin: { x: colCx, y: subDividerY, z: caseInnerZ },
                  tenons: [],
                  mortises: [],
                });
              }
              const subRodD = 28;
              const subRodY = yStart + Math.max(60, usableH - 60);
              parts.push({
                id: `${idPrefix}-col${ci + 1}-rod`,
                nameZh: `${labelPrefix}${colLabel}欄門內吊衣桿`,
                material,
                grainDirection: "length",
                visible: { length: colW, width: subRodD, thickness: subRodD },
                origin: { x: colCx, y: subRodY, z: caseInnerZ },
                tenons: [],
                mortises: [],
              });
            }
            subCursorX += colW;
            if (ci < nDoorCols - 1) {
              parts.push({
                id: `${idPrefix}-partition-${ci + 1}`,
                nameZh: `${labelPrefix}直立分隔板 ${ci + 1}`,
                material,
                grainDirection: "length",
                visible: { length: partitionW, width: innerD, thickness: usableH },
                origin: { x: subCursorX + partitionW / 2, y: yStart, z: caseInnerZ },
                tenons: [],
                mortises: [],
              });
              subCursorX += partitionW;
            }
          }
        }
      } else if (z.type === "shelves") {
        const nCols = Math.max(1, z.cols ?? 1);
        if (nCols < 2) {
          renderShelvesZone({
            yStart,
            height: usableH,
            count: z.count ?? 1,
            idPrefix,
            labelPrefix,
          });
        } else {
          const partitionW = panelT;
          const totalPartitions = (nCols - 1) * partitionW;
          const subUsableW = innerW - totalPartitions;
          // 解析欄寬比例：未指定/不合法走均分；總和不為 1 時按比例正規化
          let fracs: number[];
          if (z.colWidths && z.colWidths.length === nCols && z.colWidths.every((f) => f > 0)) {
            const sum = z.colWidths.reduce((a, b) => a + b, 0);
            fracs = z.colWidths.map((f) => f / sum);
          } else {
            fracs = new Array(nCols).fill(1 / nCols);
          }
          let subCursorX = -innerW / 2;
          for (let ci = 0; ci < nCols; ci++) {
            const colW = subUsableW * fracs[ci];
            const colCx = subCursorX + colW / 2;
            const colLabel = nCols === 2
              ? (ci === 0 ? "左" : "右")
              : ci === 0 ? "左" : ci === 1 && nCols === 3 ? "中" : "右";
            renderShelvesZone({
              yStart,
              height: usableH,
              count: z.count ?? 1,
              idPrefix: `${idPrefix}-col${ci + 1}`,
              labelPrefix: `${labelPrefix}${colLabel}欄`,
              xCenter: colCx,
              colInnerW: colW,
            });
            subCursorX += colW;
            if (ci < nCols - 1) {
              parts.push({
                id: `${idPrefix}-partition-${ci + 1}`,
                nameZh: `${labelPrefix}直立分隔板 ${ci + 1}`,
                material,
                grainDirection: "length",
                visible: { length: partitionW, width: innerD, thickness: usableH },
                origin: { x: subCursorX + partitionW / 2, y: yStart, z: caseInnerZ },
                tenons: [],
                mortises: [],
              });
              subCursorX += partitionW;
            }
          }
        }
      } else if (z.type === "hanging") {
        // 吊衣桿：區中央加一根橫桿，其餘空間留給衣服懸掛
        const rodD = 28;
        // yStart 是 zone 底端、yStart+usableH 是頂端；rod 要靠頂端 60mm 內掛
        const rodY = yStart + Math.max(60, usableH - 60); // 距頂端 60mm（usableH<120 時夾在中央偏上）
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
        // 兩側板加 rod 母榫眼接吊衣桿（rotation z=π/2 後 mesh +X = 世界 +Y 鉛直）
        // §M1: side panel visible {length:innerH, width:width, thickness:panelT}，
        // 鉛直 = length 軸 = mesh local X。rod 在世界 Y=rodY，
        // 對 side 而言相對 panel 底部 = rodY - panelT(side panel origin.y) - innerH/2 偏移。
        // panel.origin.y = caseBottomY+panelT，length=innerH，故 mesh local x = rodY - (caseBottomY+panelT) - innerH/2
        const sidePanels = parts.filter(
          (p) => p.id === "side-left" || p.id === "side-right",
        );
        for (const sp of sidePanels) {
          const sideIsLeft = sp.id === "side-left";
          const rodLocalX = rodY - (caseBottomY + panelT) - innerH / 2;
          sp.mortises = [
            ...sp.mortises,
            {
              origin: {
                x: rodLocalX,
                y: sideIsLeft ? 0 : panelT,
                z: 0,
              },
              depth: 8,
              length: rodD,
              width: rodD,
              through: false,
            },
          ];
        }
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
    useButtJointConvention: true,
    primaryMaterial: material,
    notes:
      opts.notes ??
      "頂板/底板/側板半榫接合；層板半榫入側板；背板薄板入兩側溝槽；抽屜/門板需另配五金（滑軌/鉸鏈）。",
    warnings: opts.warnings && opts.warnings.length > 0 ? opts.warnings : undefined,
  };
}
