import type { MaterialId, Part } from "@/lib/types";

/**
 * 抽屜列共用 builder。原本嵌在 case-furniture 的 `renderDrawerZone` 與
 * `makePullParts` 兩段邏輯抽出來成 pure function，這樣不只 case 家具能用，
 * 桌類（書桌「牙板位置抽屜」）也可以直接呼叫，不再複製貼上抽屜五板邏輯。
 */

export type DrawerMount = "inset" | "overlay-3" | "overlay-6";
export type DrawerBottomMode = "surface" | "rebated";

/**
 * 抽屜面板把手：依 pullStyle 生對應 brass / wood 把手 parts。
 * finger-pull / none → 不生 part（finger-pull 改成 face 上的 cosmetic mortise）。
 */
export function makePullParts(
  material: MaterialId,
  pullStyle: string,
  idPrefix: string,
  faceX: number,
  faceY: number,
  faceWidth: number,
  faceHeight: number,
  zFaceFront: number, // face 朝外那面的世界 z（往 -Z 方向延伸把手）
): Part[] {
  if (pullStyle === "none" || pullStyle === "finger-pull") {
    return [];
  }
  const cx = faceX;
  const cy = faceY + faceHeight / 2;
  // 0.5mm clearance 避免跟面板 floating-point overlap
  const CLEAR = 0.5;
  if (pullStyle === "knob") {
    const D = 30, L = 25;
    return [{
      id: `${idPrefix}-pull`,
      nameZh: "黃銅圓把手",
      material,
      materialOverride: "plywood",
      grainDirection: "length",
      visible: { length: D, width: L, thickness: D },
      origin: { x: cx, y: cy - D / 2, z: zFaceFront - L / 2 - CLEAR },
      shape: { kind: "round", axis: "z" },
      visual: "brass-antique",
      tenons: [],
      mortises: [],
    }];
  }
  if (pullStyle === "wood-knob") {
    const D = 35, L = 28;
    return [{
      id: `${idPrefix}-pull`,
      nameZh: "木製圓把手",
      material,
      grainDirection: "length",
      visible: { length: D, width: L, thickness: D },
      origin: { x: cx, y: cy - D / 2, z: zFaceFront - L / 2 - CLEAR },
      shape: { kind: "round", axis: "z" },
      tenons: [],
      mortises: [],
    }];
  }
  if (pullStyle === "bar") {
    const barLen = Math.min(128, Math.max(64, faceWidth * 0.5));
    return [{
      id: `${idPrefix}-pull`,
      nameZh: "長條把手",
      material,
      materialOverride: "plywood",
      grainDirection: "length",
      visible: { length: barLen, width: 25, thickness: 14 },
      origin: { x: cx, y: cy - 7, z: zFaceFront - 12.5 - CLEAR },
      visual: "brass-antique",
      tenons: [],
      mortises: [],
    }];
  }
  if (pullStyle === "ring-chinese") {
    // 中式古銅吊環：底座 plate 圓盤盤面貼板，環從盤面下緣垂下
    // 傳統位置：底座中心放在面板上 60%（垂下式的視覺重心剛好在中央）
    const plateD = Math.min(38, faceWidth * 0.6);
    const plateT = 2;
    const ringD = plateD * 0.8;
    const ringT = 4;
    const plateCy = faceY + faceHeight * 0.6; // 面板上 40% 處
    // 環 yExt = ringD，環頂貼齊底座下緣（plateCy - plateD/2）→ ring origin.y = (plateCy - plateD/2) - ringD
    const plateOriginY = plateCy - plateD / 2;
    const ringOriginY = plateOriginY - ringD;
    return [
      {
        id: `${idPrefix}-pull-plate`,
        nameZh: "中式古銅吊環底座",
        material,
        materialOverride: "plywood",
        grainDirection: "length",
        visible: { length: plateD, width: plateT, thickness: plateD },
        origin: { x: cx, y: plateOriginY, z: zFaceFront - plateT / 2 - CLEAR },
        shape: { kind: "round", axis: "z" },
        visual: "brass-antique",
        tenons: [],
        mortises: [],
      },
      {
        id: `${idPrefix}-pull-ring`,
        nameZh: "中式古銅吊環",
        material,
        materialOverride: "plywood",
        grainDirection: "length",
        visible: { length: ringD, width: ringT, thickness: ringD },
        origin: { x: cx, y: ringOriginY, z: zFaceFront - plateT - ringT / 2 - CLEAR },
        shape: { kind: "round", axis: "z" },
        visual: "brass-antique",
        tenons: [],
        mortises: [],
      },
    ];
  }
  if (pullStyle === "drop-bail") {
    const plateW = Math.min(76, faceWidth * 0.5);
    const plateH = Math.min(60, faceHeight * 0.7);
    const plateT = 2;
    const bailW = plateW * 0.8, bailH = 22, bailT = 3;
    const bailCy = cy - plateH / 4;
    return [
      {
        id: `${idPrefix}-pull-plate`,
        nameZh: "古典吊環底座",
        material,
        materialOverride: "plywood",
        grainDirection: "length",
        visible: { length: plateW, width: plateT, thickness: plateH },
        origin: { x: cx, y: cy - plateH / 2, z: zFaceFront - plateT / 2 - CLEAR },
        visual: "brass-antique",
        tenons: [],
        mortises: [],
      },
      {
        id: `${idPrefix}-pull-bail`,
        nameZh: "古典吊環",
        material,
        materialOverride: "plywood",
        grainDirection: "length",
        visible: { length: bailW, width: bailT, thickness: bailH },
        origin: { x: cx, y: bailCy - bailH / 2, z: zFaceFront - plateT - bailT / 2 - CLEAR },
        visual: "brass-antique",
        tenons: [],
        mortises: [],
      },
    ];
  }
  return [];
}

export interface RenderDrawerZoneCfg {
  // —— 區域定義 ——
  yStart: number;
  height: number;
  rows: number;
  cols: number;
  idPrefix: string;
  labelPrefix: string;
  /** 區邊界分隔板來自上方/下方/無。case 家具用；apron 模式請傳 "none" + skipCaseDividers=true。 */
  dividerFrom: "above" | "below" | "none";
  xCenter?: number;
  colInnerW?: number;
  overlayBottom?: number;
  overlayTop?: number;
  // —— host 框架幾何（case 或 desk apron）——
  material: MaterialId;
  panelT: number;
  shelfT: number;
  shelfTongueT: number;
  tenonLen: number;
  /** Host 外總長（X 軸）— 用於 overlay-6 totalFaceW = length - 2*gap */
  caseLength: number;
  /** Host 外總寬（Z 軸）— 用於 zFront/zFace 的 -width/2 基準 */
  caseWidth: number;
  /** 預設 zone 寬（colInnerW 沒傳時用），通常 = innerW */
  innerW: number;
  /** 抽屜箱可用深度基準 — 通常 = case innerD（背板模式扣 backT） */
  innerD: number;
  /** divider / partition / zone-boundary 的 Z 中心（case rebated 模式會偏移） */
  caseInnerZ: number;
  /** 抽屜面板厚（22mm 配框料門、18mm 配平板門/無門） */
  drawerFacePanelT: number;
  drawerMount: DrawerMount;
  drawerBottomMode?: DrawerBottomMode;
  drawerSlideGap?: number;
  pullStyle: string;
  /** 跳過 case 風格的水平分隔板 / zone-boundary（給 desk 牙板抽屜用）。
   *  仍會生 col-partition（多 col 抽屜的中柱）— 滑軌固定用。 */
  skipCaseDividers?: boolean;
}

/**
 * 抽屜列渲染 — 在指定 yStart / height / rows × cols 區域內生抽屜及對應分隔板。
 * 每個抽屜含：面板（可選）、箱體前板、後板、左右側板、底板、把手。
 *
 * 原本是 case-furniture.ts 內的 `renderDrawerZone` 閉包；2026-05-13 抽成共用
 * 函式讓 desk 也能在牙板位置生抽屜。
 */
export function renderDrawerZone(cfg: RenderDrawerZoneCfg, parts: Part[]): void {
  const {
    yStart,
    height: zoneH,
    rows,
    cols,
    idPrefix,
    labelPrefix,
    dividerFrom,
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
    pullStyle,
    skipCaseDividers,
  } = cfg;
  const zoneCx = cfg.xCenter ?? 0;
  const zoneW = cfg.colInnerW ?? innerW;
  const drawerSlotH = zoneH / rows;
  const drawerZoneBottomY = yStart;
  const drawerZoneTopY = yStart + zoneH;

  // —— 水平分隔板（case 用；desk apron 不需要） ——
  if (!skipCaseDividers) {
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
  }

  const drawerFrontT = 18;
  const drawerSideT = 14;
  const drawerBackT = 12;
  const drawerBottomMode = cfg.drawerBottomMode ?? "surface";
  const isSurfaceDrawerBottom = drawerBottomMode === "surface";
  const drawerBottomT = isSurfaceDrawerBottom ? 3 : 6;
  const drawerGap = 2;
  const partitionT = cols > 1 ? panelT : 0;
  const totalPartitionW = (cols - 1) * partitionT;
  const drawerSlotW = (zoneW - totalPartitionW) / cols;
  const slideGap = cfg.drawerSlideGap ?? 0;
  const hasSlide = slideGap > 0;
  const isInsetDrawer = drawerMount === "inset";
  const drawerOverlay =
    drawerMount === "overlay-3" ? 9 :
    drawerMount === "overlay-6" ? panelT : 0;
  const hasFacePanel = hasSlide || !isInsetDrawer;
  const faceT = hasFacePanel ? drawerFacePanelT : 0;
  const faceTBoxOffset = isInsetDrawer && hasSlide ? drawerFacePanelT : 0;
  const backClearance = hasSlide ? 10 : 6;
  const drawerOuterW = drawerSlotW - 2 * slideGap;
  const boxExtW = hasSlide ? drawerOuterW : drawerOuterW - 4;
  const drawerInnerW = boxExtW - 2 * drawerSideT;
  const drawerInnerD = innerD - faceTBoxOffset - drawerFrontT - drawerBackT - backClearance;
  const drawerH = drawerSlotH - shelfT - drawerGap * 2;
  const boxYOffset = hasSlide ? 5 - drawerGap : 0;
  const dovetailLen = drawerSideT;
  const inColumn = cfg.colInnerW !== undefined;
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

  // 直立分隔板（中柱）
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
    const isTopRowExpand = row === rows - 1 && dividerFrom !== "above";
    const expandTop = isTopRowExpand ? shelfT : 0;
    const boxHRow = (hasSlide ? drawerSlotH - shelfT - 10 : drawerH) + expandTop;
    const yBase = drawerZoneBottomY + row * drawerSlotH + drawerGap;
    const xCenter =
      zoneCx -
      zoneW / 2 +
      drawerSlotW / 2 +
      col * (drawerSlotW + partitionT);
    const zFace = isInsetDrawer
      ? -width / 2 + faceT / 2 + 1
      : -width / 2 - faceT / 2 - 1;
    const zFront = -width / 2 + faceTBoxOffset + drawerFrontT / 2 + 1;
    const zBack = zFront + drawerInnerD + drawerFrontT / 2 + drawerBackT / 2;

    if (hasFacePanel) {
      let faceW: number, faceHeight: number, faceX: number, faceY: number;
      if (isInsetDrawer) {
        faceW = drawerSlotW - 2 * drawerGap;
        faceHeight = drawerSlotH - shelfT - 2 * drawerGap + expandTop;
        faceX = xCenter;
        faceY = drawerZoneBottomY + row * drawerSlotH + drawerGap;
      } else {
        faceW = perFaceW_ov;
        faceHeight = perFaceH_ov;
        const blockStartX = zoneCx - totalFaceW / 2;
        const blockStartY = drawerZoneBottomY - overlayBot + drawerGap;
        faceX = blockStartX + col * (perFaceW_ov + drawerGap) + perFaceW_ov / 2;
        faceY = blockStartY + row * (perFaceH_ov + drawerGap);
      }
      const faceJpullMortises: Part["mortises"] =
        pullStyle === "finger-pull"
          ? [{
              // origin.y=0 = local -Y 入口 → 對應 face 旋轉 x=π/2 後的世界 -Z 方向（前面）
              origin: { x: 0, y: 0, z: -faceHeight / 2 + 14 },
              depth: 12,
              length: 80,
              width: 25,
              through: false,
              cosmetic: true,
              shape: "rect",
            }]
          : [];
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
        mortises: faceJpullMortises,
      });
      parts.push(...makePullParts(
        material,
        pullStyle,
        `${idPrefix}-${i + 1}-face`,
        faceX, faceY, faceW, faceHeight,
        zFace - faceT / 2,
      ));
    }

    const insetDrawerCoversBottom = isInsetDrawer && isSurfaceDrawerBottom && !hasFacePanel;
    const frontExtraDown = insetDrawerCoversBottom ? drawerBottomT : 0;
    const frontGrooveMortises: Part["mortises"] = insetDrawerCoversBottom
      ? [
          {
            origin: {
              x: 0,
              y: drawerFrontT,
              z: (boxHRow + frontExtraDown) / 2 - drawerBottomT / 2,
            },
            depth: 6,
            length: boxExtW - 4,
            width: drawerBottomT,
            through: false,
            cosmetic: true,
            shape: "rect",
          },
        ]
      : !isSurfaceDrawerBottom
        ? [
            {
              origin: {
                x: 0,
                y: drawerFrontT,
                z: boxHRow / 2 - (6 + drawerBottomT / 2),
              },
              depth: 6,
              length: drawerInnerW + 4,
              width: drawerBottomT,
              through: false,
              cosmetic: true,
              shape: "rect",
            },
          ]
        : [];
    parts.push({
      id: `${idPrefix}-${i + 1}-front`,
      nameZh: hasFacePanel
        ? `${labelPrefix}${i + 1} 箱體前板`
        : `${labelPrefix}${i + 1} 面板`,
      material,
      grainDirection: "length",
      visible: {
        length: boxExtW,
        width: boxHRow + frontExtraDown,
        thickness: drawerFrontT,
      },
      origin: { x: xCenter, y: yBase + boxYOffset - frontExtraDown, z: zFront },
      rotation: { x: Math.PI / 2, y: 0, z: 0 },
      tenons: [
        {
          position: "start",
          type: "dovetail",
          length: dovetailLen,
          width: boxHRow - 6,
          thickness: drawerFrontT - 2,
        },
        {
          position: "end",
          type: "dovetail",
          length: dovetailLen,
          width: boxHRow - 6,
          thickness: drawerFrontT - 2,
        },
      ],
      mortises: frontGrooveMortises,
    });
    if (!hasFacePanel) {
      parts.push(...makePullParts(
        material,
        pullStyle,
        `${idPrefix}-${i + 1}-face`,
        xCenter,
        yBase + boxYOffset - frontExtraDown,
        boxExtW,
        boxHRow + frontExtraDown,
        zFront - drawerFrontT / 2,
      ));
    }

    const drawerBackHeight = isSurfaceDrawerBottom ? boxHRow : boxHRow - drawerBottomT - 8;
    const drawerBackY = isSurfaceDrawerBottom
      ? yBase + boxYOffset
      : yBase + boxYOffset + drawerBottomT + 6;
    parts.push({
      id: `${idPrefix}-${i + 1}-back`,
      nameZh: `${labelPrefix}${i + 1} 後板`,
      material,
      grainDirection: "length",
      visible: {
        length: drawerInnerW + 2 * drawerSideT,
        width: drawerBackHeight,
        thickness: drawerBackT,
      },
      origin: { x: xCenter, y: drawerBackY, z: zBack },
      rotation: { x: Math.PI / 2, y: 0, z: 0 },
      tenons: [
        {
          position: "start",
          type: "half-lap",
          length: drawerSideT * 0.5,
          width: drawerBackHeight - 4,
          thickness: drawerBackT,
        },
        {
          position: "end",
          type: "half-lap",
          length: drawerSideT * 0.5,
          width: drawerBackHeight - 4,
          thickness: drawerBackT,
        },
      ],
      mortises: [],
    });

    const sideZCenter =
      (zFront + drawerFrontT / 2 + zBack - drawerBackT / 2) / 2;
    for (const side of [-1, 1] as const) {
      parts.push({
        id: `${idPrefix}-${i + 1}-side-${side < 0 ? "left" : "right"}`,
        nameZh: `${labelPrefix}${i + 1} ${side < 0 ? "左" : "右"}側板`,
        material,
        grainDirection: "length",
        visible: {
          length: drawerInnerD,
          width: boxHRow,
          thickness: drawerSideT,
        },
        origin: {
          x: xCenter + side * (boxExtW / 2 - drawerSideT / 2),
          y: yBase + boxYOffset,
          z: sideZCenter,
        },
        rotation: { x: Math.PI / 2, y: Math.PI / 2, z: 0 },
        tenons: [],
        mortises: [
          {
            origin: { x: -drawerInnerD / 2 - 1, y: 0, z: 0 },
            depth: dovetailLen,
            length: boxHRow - 6,
            width: drawerFrontT - 2,
            through: true,
          },
          {
            origin: {
              x: drawerInnerD / 2 + 1,
              y: 0,
              z: isSurfaceDrawerBottom ? 0 : (drawerBottomT + 6) / 2,
            },
            depth: drawerSideT * 0.5,
            length: drawerBackHeight - 4,
            width: drawerBackT,
            through: false,
          },
          ...(isSurfaceDrawerBottom
            ? []
            : [
                {
                  origin: { x: 0, y: 0, z: boxHRow / 2 - 6 - drawerBottomT / 2 },
                  depth: 6,
                  length: drawerInnerD - 4,
                  width: drawerBottomT + 1,
                  through: false,
                  cosmetic: true,
                  shape: "rect" as const,
                },
              ]),
        ],
      });
    }

    const drawerOuterD = drawerInnerD + drawerFrontT + drawerBackT;
    const drawerBottomLengthRebated = drawerInnerD + drawerBackT + 6;
    const drawerBottomFrontEdgeZ = zFront + drawerFrontT / 2 - 6;
    const drawerBottomRearEdgeZ = zBack + drawerBackT / 2;
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
        : { length: drawerInnerW + 4, width: drawerBottomLengthRebated, thickness: drawerBottomT },
      origin: {
        x: xCenter,
        y: isSurfaceDrawerBottom
          ? yBase + boxYOffset - drawerBottomT
          : yBase + boxYOffset + 6,
        z: isSurfaceDrawerBottom
          ? (zFront + zBack) / 2
          : (drawerBottomFrontEdgeZ + drawerBottomRearEdgeZ) / 2,
      },
      tenons: isSurfaceDrawerBottom
        ? []
        : [
            {
              position: "start",
              type: "tongue-and-groove",
              length: 6,
              width: drawerInnerD - 4,
              thickness: drawerBottomT,
            },
            {
              position: "end",
              type: "tongue-and-groove",
              length: 6,
              width: drawerInnerD - 4,
              thickness: drawerBottomT,
            },
          ],
      mortises: [],
    });
   }
  }
}
