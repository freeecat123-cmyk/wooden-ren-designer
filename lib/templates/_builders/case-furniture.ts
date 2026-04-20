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
  /** Limit total height of drawer stack (mm). Default = full innerH. Drawers placed at bottom. */
  drawerAreaHeight?: number;
  /** If > 0, add N door panels in front. */
  doorCount?: number;
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
  /** If provided, overrides equal-spacing with custom shelf Y fractions (0..1 from bottom). */
  customShelfFractions?: number[];
  /** Horizontal area (y fraction range) reserved for a hanging rod. Used by wardrobe. */
  hangingArea?: { yStart: number; yEnd: number };
  notes?: string;
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
    doorCount = 0,
    doorType = "wood",
  } = opts;

  const panelT = opts.panelThickness ?? 18;
  const shelfT = opts.shelfThickness ?? 18;
  const backT = opts.backThickness ?? 6;
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

  // Optional 4 corner legs (raise the case)
  const legShape = legShapeRaw;
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
      const insetX = 10;
      const insetZ = 10;
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
      const legOffsetX = length / 2 - legSize / 2;
      const legOffsetZ = width / 2 - legSize / 2;
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
        width: panelT - 4,
        through: false,
      },
      {
        origin: { x: length / 2 - panelT / 2, y: 0, z: 0 },
        depth: tenonLen,
        length: width - backT,
        width: panelT - 4,
        through: false,
      },
    ],
  });

  // 底板
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
        width: panelT - 4,
        through: false,
      },
      {
        origin: { x: length / 2 - panelT / 2, y: 0, z: 0 },
        depth: tenonLen,
        length: width - backT,
        width: panelT - 4,
        through: false,
      },
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
      origin: { x: side * (length / 2 - panelT / 2), y: caseBottomY + panelT, z: 0 },
      rotation: { x: 0, y: 0, z: Math.PI / 2 },
      tenons: [
        {
          position: "top",
          type: "blind-tenon",
          length: tenonLen,
          width: innerD - 8,
          thickness: panelT - 4,
        },
        {
          position: "bottom",
          type: "blind-tenon",
          length: tenonLen,
          width: innerD - 8,
          thickness: panelT - 4,
        },
      ],
      // 內側面挖層板/抽屜分隔板的榫眼（簡化為一個示意榫眼）
      mortises: shelfFractions.map((f) => ({
        origin: { x: 0, y: f * innerH, z: 0 },
        depth: tenonLen,
        length: innerD - 10,
        width: shelfT - 4,
        through: false,
      })),
    });
  }

  // 中間層板/抽屜分隔板
  for (let i = 0; i < shelfFractions.length; i++) {
    const y = caseBottomY + panelT + shelfFractions[i] * innerH;
    parts.push({
      id: `shelf-${i + 1}`,
      nameZh: drawerCount > 0 ? `抽屜分隔板 ${i + 1}` : `層板 ${i + 1}`,
      material,
      grainDirection: "length",
      visible: { length: innerW, width: innerD, thickness: shelfT },
      origin: { x: 0, y, z: 0 },
      tenons: [
        {
          position: "start",
          type: "blind-tenon",
          length: tenonLen,
          width: innerD - 10,
          thickness: shelfT - 4,
        },
        {
          position: "end",
          type: "blind-tenon",
          length: tenonLen,
          width: innerD - 10,
          thickness: shelfT - 4,
        },
      ],
      mortises: [],
    });
  }

  // 背板（薄板）
  parts.push({
    id: "back",
    nameZh: "背板",
    material,
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

  // ===== 抽屜內箱（每屜 5 件：面板 / 後板 / 左右側板 / 底板）=====
  if (drawerCount > 0) {
    const drawerSlotH = drawerAreaH / drawerCount;

    // 抽屜間水平分隔板（drawerCount-1 片；抽屜區頂緣若未到頂再加一片封頂）
    const needTopCover = drawerAreaH < innerH - 1;
    const dividerRows = needTopCover ? drawerCount : drawerCount - 1;
    for (let d = 0; d < dividerRows; d++) {
      const dividerY = caseBottomY + panelT + (d + 1) * drawerSlotH;
      parts.push({
        id: `drawer-divider-${d + 1}`,
        nameZh: d === drawerCount - 1 ? "抽屜區頂板" : `抽屜分隔板 ${d + 1}`,
        material,
        grainDirection: "length",
        visible: { length: innerW, width: innerD, thickness: shelfT },
        origin: { x: 0, y: dividerY - shelfT, z: 0 },
        tenons: [
          { position: "start", type: "blind-tenon", length: tenonLen, width: innerD - 10, thickness: shelfT - 4 },
          { position: "end", type: "blind-tenon", length: tenonLen, width: innerD - 10, thickness: shelfT - 4 },
        ],
        mortises: [],
      });
    }

    const drawerFrontT = 18;
    const drawerSideT = 14;
    const drawerBackT = 12;
    const drawerBottomT = 6;
    const drawerGap = 4; // 抽屜與隔板的間隙
    const colPitch = innerW / drawerCols;
    const drawerInnerW = colPitch - 4 - 2 * drawerSideT;
    const drawerInnerD = innerD - drawerFrontT - drawerBackT - 6;
    const drawerH = drawerSlotH - drawerGap * 2;
    const dovetailLen = drawerSideT;

    for (let row = 0; row < drawerCount; row++) {
     for (let col = 0; col < drawerCols; col++) {
      const i = row * drawerCols + col;
      const yBase = caseBottomY + panelT + row * drawerSlotH + drawerGap;
      const xCenter = -innerW / 2 + colPitch * col + colPitch / 2;
      const zFront = -width / 2 + drawerFrontT / 2 + 1;
      const zBack = zFront + drawerInnerD + drawerFrontT / 2 + drawerBackT / 2;

      // 面板：左右兩端燕尾榫接側板 — X 旋轉站立
      parts.push({
        id: `drawer${i + 1}-front`,
        nameZh: `抽屜${i + 1} 面板`,
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

      // 後板：兩端半搭接（half-lap）入側板 — X 旋轉站立
      parts.push({
        id: `drawer${i + 1}-back`,
        nameZh: `抽屜${i + 1} 後板`,
        material,
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

      // 左右側板 — 長度沿 Z，需 {x: π/2, y: π/2} 旋轉
      for (const side of [-1, 1] as const) {
        parts.push({
          id: `drawer${i + 1}-side-${side < 0 ? "left" : "right"}`,
          nameZh: `抽屜${i + 1} ${side < 0 ? "左" : "右"}側板`,
          material,
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

      // 底板：四邊舌頭嵌入溝槽
      parts.push({
        id: `drawer${i + 1}-bottom`,
        nameZh: `抽屜${i + 1} 底板`,
        material,
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
  }

  // ===== 門框（每門 4 件框 + 鑲板/玻璃）=====
  if (doorCount > 0) {
    const doorW = innerW / doorCount;
    const stileW = 60; // 豎梃寬度
    const railW = 60; // 橫檔寬度
    const frameT = 22; // 框料厚度
    const panelT_door = 12; // 木鑲板厚度（玻璃時不計）
    const cornerTenonLen = Math.round(stileW * 0.6);
    const grooveDepth = 8;

    for (let i = 0; i < doorCount; i++) {
      const xCenter = -innerW / 2 + i * doorW + doorW / 2;
      const zFront = -width / 2 - frameT / 2 - 1;
      const doorOuterW = doorW - 4;
      const doorOuterH = innerH - 4;
      const innerOpenW = doorOuterW - 2 * stileW;
      const innerOpenH = doorOuterH - 2 * railW;

      // 上橫檔 — 橫放但垂直站立（X 軸旋轉）
      parts.push({
        id: `door${i + 1}-rail-top`,
        nameZh: `門${i + 1} 上橫檔`,
        material,
        grainDirection: "length",
        visible: {
          length: innerOpenW,
          width: railW,
          thickness: frameT,
        },
        origin: {
          x: xCenter,
          y: caseBottomY + panelT + doorOuterH - railW,
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
        id: `door${i + 1}-rail-bottom`,
        nameZh: `門${i + 1} 下橫檔`,
        material,
        grainDirection: "length",
        visible: {
          length: innerOpenW,
          width: railW,
          thickness: frameT,
        },
        origin: {
          x: xCenter,
          y: caseBottomY + panelT,
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
          id: `door${i + 1}-stile-${side < 0 ? "left" : "right"}`,
          nameZh: `門${i + 1} ${side < 0 ? "左" : "右"}豎梃`,
          material,
          grainDirection: "length",
          visible: {
            length: stileW,
            width: doorOuterH,
            thickness: frameT,
          },
          origin: {
            x: xCenter + (side * (doorOuterW / 2 - stileW / 2)),
            y: caseBottomY + panelT,
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
          id: `door${i + 1}-panel`,
          nameZh: `門${i + 1} 木鑲板`,
          material,
          grainDirection: "length",
          visible: {
            length: innerOpenW + 2 * grooveDepth - 2,
            width: innerOpenH + 2 * grooveDepth - 2,
            thickness: panelT_door,
          },
          origin: {
            x: xCenter,
            y: caseBottomY + panelT + railW - grooveDepth,
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
      // 玻璃門：玻璃由溝槽夾住，不視為木質零件，不入材料單
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
