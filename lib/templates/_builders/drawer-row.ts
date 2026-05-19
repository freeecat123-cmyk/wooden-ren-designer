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
  pullX?: number, // 覆寫把手 x 位置（雙開門用，把手放內側豎梃；undefined = 走 faceX 中央）
  orientation?: "horizontal" | "vertical", // 長條把手方向；undefined 走自動偵測（idPrefix 帶 door/slab → 垂直）
): Part[] {
  if (pullStyle === "none" || pullStyle === "finger-pull") {
    return [];
  }
  const cx = pullX ?? faceX;
  const isDoor = idPrefix.includes("-door") || idPrefix.includes("-slab");
  // §N4：門距底 2/3（向下伸手，符合站立握把高度）；抽屜走中央或上 1/3、預設中央。
  // 距底 2/3 ≡ 距頂 1/3：通吃 wardrobe 1800mm 大門 (1200mm 把手) 跟 nightstand
  // 400mm 小門 (267mm 把手) — 中央 200mm 太靠床沿、肘部會頂到。
  const cy = isDoor
    ? faceY + faceHeight * 2 / 3
    : faceY + faceHeight / 2;
  const barVertical = orientation ? orientation === "vertical" : isDoor;
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
    if (barVertical) {
      // 門板：長條垂直立著，長度依門高（25~35%）；把手 X 軸寬 14、Z 軸深 25
      const barLen = Math.min(192, Math.max(96, faceHeight * 0.3));
      return [{
        id: `${idPrefix}-pull`,
        nameZh: "長條把手",
        material,
        materialOverride: "plywood",
        grainDirection: "length",
        visible: { length: 14, width: 25, thickness: barLen },
        origin: { x: cx, y: cy - barLen / 2, z: zFaceFront - 12.5 - CLEAR },
        visual: "brass-antique",
        tenons: [],
        mortises: [],
      }];
    }
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
  /** 抽屜面板 X 軸延伸（單側）。column 模式邊角=full overlay、鄰 face=halfBoundary。未傳走原本 inColumn 邏輯。 */
  extendLeft?: number;
  extendRight?: number;
  /** 各排高度比例（fraction 陣列、總和需 = 1）。未傳走均分。長度需 = rows。
   *  例：rows=2 + [0.4, 0.6] → 下排 = 40% 高、上排 = 60% 高（淺抽放遙控器、深抽放線材） */
  rowHeights?: number[];
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
  /** 抽屜底板厚度 mm；3/6/9/12 任一。釘底 / 入溝皆套用此厚度。
   *  fallback：surface=3, rebated=6（跟舊行為一致）。 */
  drawerBottomThickness?: number;
  /** 抽屜箱體 4 角接合：lap 搭接（側板蓋前後）/ dovetail 鳩尾（自動依面板判半/通）。
   *  預設 "lap"。 */
  drawerBoxJoinery?: "lap" | "dovetail";
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
  // 每排高度（mm）：cfg.rowHeights 是 fraction（總和=1）；未傳走均分。長度不對也 fallback 均分。
  const rowFractions =
    cfg.rowHeights && cfg.rowHeights.length === rows && Math.abs(cfg.rowHeights.reduce((a, b) => a + b, 0) - 1) < 1e-3
      ? cfg.rowHeights
      : Array.from({ length: rows }, () => 1 / rows);
  const rowSlotH: number[] = rowFractions.map((f) => zoneH * f);
  const rowSlotYBottom: number[] = [];
  {
    let acc = 0;
    for (let r = 0; r < rows; r++) {
      rowSlotYBottom.push(acc);
      acc += rowSlotH[r];
    }
  }
  const drawerZoneBottomY = yStart;
  const drawerZoneTopY = yStart + zoneH;

  // —— 水平分隔板（case 用；desk apron 不需要） ——
  if (!skipCaseDividers) {
    for (let d = 0; d < rows - 1; d++) {
      const dividerY = drawerZoneBottomY + rowSlotYBottom[d + 1];
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
  // 抽屜接合 + 內框厚度邏輯（依「有沒有外加面板」分流）：
  //
  //   hasFacePanel = true  → 外加面板蓋住前板 → 內框 4 片等厚 14mm
  //                          鳩尾 = 通鳩尾（tail 穿過、面板蓋住不用藏）
  //   hasFacePanel = false → 入柱+無滑軌、前板就是面板 → 不等厚 18/14/14
  //                          鳩尾 = 半鳩尾（tail 只進前板 2/3、面板木紋完整）
  //
  // 接合方式 user 可選（drawerBoxJoinery option）：
  //   "lap" 搭接：側板蓋前後板、無榫頭（butt joint）
  //   "dovetail" 鳩尾：依 hasFacePanel 自動分通/半
  const drawerBoxJoinery = cfg.drawerBoxJoinery ?? "lap";
  const isLapJoint = drawerBoxJoinery === "lap";
  const isDovetailJoint = drawerBoxJoinery === "dovetail";
  // 內框前板厚：有面板 14（跟側板等厚）/ 無面板 18（視覺面厚一點）
  const drawerFrontT = hasFacePanel ? 14 : 18;
  const drawerSideT = 14;
  const drawerBackT = 14;
  // 鳩尾 pinDepth：有面板 → 通鳩尾（=drawerFrontT 整個穿過）/
  //                沒面板 → 半鳩尾（round(drawerFrontT*2/3) = 12）
  const useHalfBlindDovetail = isDovetailJoint && !hasFacePanel;
  const useThroughDovetail = isDovetailJoint && hasFacePanel;
  // 半搭接：搭接 + 入柱（無面板）→ 前板全寬蓋住側板、背面挖 1/3 深凹槽讓
  // 側板前緣嵌進。完全沒榫、沒 dovetail-ends shape、只用 cosmetic mortise 切凹槽。
  // side panel 長度跟全搭接一樣 drawerOuterD、但 z 位置往後推 rabbetDepth、
  // 讓 side 前緣坐在 rabbet 底（不再跟前板正面齊平、面板蓋住側板端）。
  const useHalfLap = isLapJoint && !hasFacePanel;
  const useFullLap = isLapJoint && hasFacePanel;
  const halfLapRabbetDepth = Math.round(drawerFrontT / 3);
  const dovetailPinDepth = useThroughDovetail
    ? drawerFrontT
    : useHalfBlindDovetail
      ? Math.round((drawerFrontT * 2) / 3)
      : 0;
  const drawerBottomMode = cfg.drawerBottomMode ?? "surface";
  const isSurfaceDrawerBottom = drawerBottomMode === "surface";
  // 入溝槽深固定 6mm（吃進側板厚度），不管底板多厚都不會挖穿 14mm 側板。
  // mortise.width = drawerBottomT + 1 是槽「在側板面上的高度」（讓底板厚度塞得進）
  // 不是往側板厚度方向挖多深、跟側板厚度無關。
  const drawerBottomT = cfg.drawerBottomThickness ?? (isSurfaceDrawerBottom ? 3 : 6);
  const faceT = hasFacePanel ? drawerFacePanelT : 0;
  const faceTBoxOffset = isInsetDrawer && hasSlide ? drawerFacePanelT : 0;
  const backClearance = hasSlide ? 10 : 6;
  const drawerOuterW = drawerSlotW - 2 * slideGap;
  const boxExtW = hasSlide ? drawerOuterW : drawerOuterW - 4;
  const drawerInnerW = boxExtW - 2 * drawerSideT;
  const drawerInnerD = innerD - faceTBoxOffset - drawerFrontT - drawerBackT - backClearance;
  const drawerOuterD = drawerInnerD + drawerFrontT + drawerBackT;
  const boxYOffset = hasSlide ? 5 - drawerGap : 0;
  const dovetailLen = drawerSideT;
  const inColumn = cfg.colInnerW !== undefined;
  const overlayBot = cfg.overlayBottom ?? drawerOverlay;
  const overlayTop = cfg.overlayTop ?? drawerOverlay;
  const extendLeftDefault = inColumn ? panelT : (length - zoneW) / 2; // 非 inColumn = case 邊到 zone 邊
  const extendLeft = cfg.extendLeft ?? (drawerMount === "overlay-6" ? extendLeftDefault : drawerOverlay);
  const extendRight = cfg.extendRight ?? (drawerMount === "overlay-6" ? extendLeftDefault : drawerOverlay);
  const totalFaceW = isInsetDrawer
    ? 0
    : zoneW + extendLeft + extendRight - 2 * drawerGap;
  const faceXShift = (extendRight - extendLeft) / 2;
  const totalFaceH = isInsetDrawer
    ? 0
    : zoneH + overlayTop + overlayBot - 2 * drawerGap;
  const perFaceW_ov = isInsetDrawer ? 0 : (totalFaceW - (cols - 1) * drawerGap) / cols;
  // per-row 面板高度：總面板區（扣掉 gap）依 rowFractions 分配
  const faceContentH = Math.max(0, totalFaceH - (rows - 1) * drawerGap);
  const rowFaceH: number[] = isInsetDrawer ? [] : rowFractions.map((f) => faceContentH * f);
  const rowFaceYBottom: number[] = [];
  if (!isInsetDrawer) {
    let acc = 0;
    for (let r = 0; r < rows; r++) {
      rowFaceYBottom.push(acc);
      acc += rowFaceH[r] + drawerGap;
    }
  }

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
            : drawerZoneBottomY + rowSlotYBottom[r];
        const segYTop =
          r === rows - 1
            ? drawerZoneBottomY + zoneH
            : drawerZoneBottomY + rowSlotYBottom[r + 1] - shelfT;
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
    const slotHRow = rowSlotH[row];
    // 釘底底板 attach 在側板下緣（y = yBase - drawerBottomT）→ 抽屜總高
    // = boxHRow + drawerBottomT。要：
    //   1. 從 slot 預算扣掉這段（縮 boxHRow）
    //   2. 把 yBase 推高 drawerBottomT（不然底板會垂出 slot 底）
    // 入溝底板嵌在 box 內、不增加總高、不扣。
    const surfaceBottomReserve = isSurfaceDrawerBottom ? drawerBottomT : 0;
    const drawerHRow = slotHRow - shelfT - drawerGap * 2 - surfaceBottomReserve;
    const boxHRow = (hasSlide ? slotHRow - shelfT - 10 - surfaceBottomReserve : drawerHRow) + expandTop;
    const yBase = drawerZoneBottomY + rowSlotYBottom[row] + drawerGap + surfaceBottomReserve;
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
        faceHeight = slotHRow - shelfT - 2 * drawerGap + expandTop;
        faceX = xCenter;
        faceY = drawerZoneBottomY + rowSlotYBottom[row] + drawerGap;
      } else {
        faceW = perFaceW_ov;
        faceHeight = rowFaceH[row];
        const blockStartX = zoneCx + faceXShift - totalFaceW / 2;
        const blockStartY = drawerZoneBottomY - overlayBot + drawerGap;
        faceX = blockStartX + col * (perFaceW_ov + drawerGap) + perFaceW_ov / 2;
        faceY = blockStartY + rowFaceYBottom[row];
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
              // 跟底板 X length=drawerInnerW+12 對齊（前 +4 太短、底板 corner 撞前板實心區顯紅）
              length: drawerInnerW + 12,
              width: drawerBottomT,
              through: false,
              cosmetic: true,
              shape: "rect",
            },
          ]
        : [];
    // 半搭接：前板背面在側板對應位置開 cosmetic rabbet（drawerSideT 寬 × 2/3 深）
    // 讓側板嵌進。完全沒榫、無 dovetail-ends shape、只是視覺凹槽（cosmetic mortise）。
    //
    // origin.y 用 drawerFrontT - halfLapRabbetDepth/2 而不是 canonical drawerFrontT：
    // mortiseLocalBox 對 canonical Y + 靠近 X face 會把 depthAxis 切到 X、變成從
    // 側邊往內挖。改用中間值才會正確走 Y 深度（從背面往前面挖 2/3）。
    const halfLapRabbetOriginY = drawerFrontT - halfLapRabbetDepth / 2;
    const frontRabbetMortises: Part["mortises"] = useHalfLap
      ? [
          {
            origin: {
              x: -boxExtW / 2 + drawerSideT / 2,
              y: halfLapRabbetOriginY,
              z: 0,
            },
            depth: halfLapRabbetDepth,
            length: drawerSideT,
            width: boxHRow + frontExtraDown,
            through: false,
            cosmetic: true,
            shape: "rect",
          },
          {
            origin: {
              x: +boxExtW / 2 - drawerSideT / 2,
              y: halfLapRabbetOriginY,
              z: 0,
            },
            depth: halfLapRabbetDepth,
            length: drawerSideT,
            width: boxHRow + frontExtraDown,
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
      // 前板長度依接合：
      //  useFullLap（有面板+搭接）→ 夾在側板中間 drawerInnerW
      //  其他（half-lap / dovetail）→ 全寬 boxExtW
      visible: {
        length: useFullLap ? drawerInnerW : boxExtW,
        width: boxHRow + frontExtraDown,
        thickness: drawerFrontT,
      },
      origin: { x: xCenter, y: yBase + boxYOffset - frontExtraDown, z: zFront },
      rotation: { x: Math.PI / 2, y: 0, z: 0 },
      // lap = butt joint 無榫；dovetail = CSG 從側板 shape 切、前板自己也無 tenons
      tenons: [],
      mortises: [...frontGrooveMortises, ...frontRabbetMortises],
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
      // 後板長度依接合：lap 搭接時被夾在側板中間（=drawerInnerW）、dovetail 時
      // 跨外寬被側板 tail CSG 切（=boxExtW = drawerInnerW + 2×drawerSideT）。
      visible: {
        // useFullLap → drawerInnerW 夾中間 / 其他 → 全寬
        length: useFullLap ? drawerInnerW : drawerInnerW + 2 * drawerSideT,
        width: drawerBackHeight,
        thickness: drawerBackT,
      },
      origin: { x: xCenter, y: drawerBackY, z: zBack },
      rotation: { x: Math.PI / 2, y: 0, z: 0 },
      // lap / dovetail 皆無 corner tenons（lap=butt、dovetail=CSG）
      tenons: [],
      mortises: [],
    });

    const sideZCenter =
      (zFront + drawerFrontT / 2 + zBack - drawerBackT / 2) / 2;
    const halfBlindSegmentCount = Math.max(
      3,
      Math.min(11, Math.round(boxHRow / (1.8 * drawerSideT))),
    );
    // 半鳩尾段數要奇數（前後段都是 pin 才不破角）
    const dovetailSegCount =
      halfBlindSegmentCount % 2 === 0
        ? halfBlindSegmentCount + 1
        : halfBlindSegmentCount;
    for (const side of [-1, 1] as const) {
      // side panel 依接合方式決定長度 + 位置：
      // - dovetail（含半鳩尾）：body 延長 2×pinDepth 進前後板實體區、shape 在
      //   延伸區做 crenellated tail。z center 維持 sideZCenter（body 中段）。
      // - lap（搭接）：body 蓋滿前後板（drawerOuterD）、z center 推到 drawer
      //   外部中心、無 shape、前後板被夾在中間。
      const sideLength = isDovetailJoint
        ? drawerInnerD + 2 * dovetailPinDepth
        : drawerOuterD;
      // 全搭接：側板蓋滿前後板（front 邊緣到 back 邊緣）
      const sideZCenterLap =
        (zFront - drawerFrontT / 2 + zBack + drawerBackT / 2) / 2;
      // 半搭接：側板 z 往後推 rabbet 深度、讓 front 邊緣坐在 rabbet 底
      //（不跟前板正面齊平、面板蓋住側板端）。back 邊緣會超出後板 rabbetDepth、
      //  但後板在櫃內看不到、暫接受。
      const sideZCenterHalfLap = sideZCenterLap + halfLapRabbetDepth;
      const effectiveSideZCenter = useHalfLap
        ? sideZCenterHalfLap
        : isLapJoint
          ? sideZCenterLap
          : sideZCenter;
      parts.push({
        id: `${idPrefix}-${i + 1}-side-${side < 0 ? "left" : "right"}`,
        nameZh: `${labelPrefix}${i + 1} ${side < 0 ? "左" : "右"}側板`,
        material,
        grainDirection: "length",
        visible: {
          length: sideLength,
          width: boxHRow,
          thickness: drawerSideT,
        },
        origin: {
          x: xCenter + side * (boxExtW / 2 - drawerSideT / 2),
          y: yBase + boxYOffset,
          z: effectiveSideZCenter,
        },
        rotation: { x: Math.PI / 2, y: Math.PI / 2, z: 0 },
        shape: isDovetailJoint
          ? {
              kind: "dovetail-ends" as const,
              segmentCount: dovetailSegCount,
              phase: 0 as const,
              angleDeg: 10,
              pinDepth: dovetailPinDepth,
              halfPin: true,
            }
          : undefined,
        tenons: [],
        // lap / dovetail 都無 corner mortise（lap=butt joint、dovetail=CSG 從 shape 切）
        mortises: [
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
        // 入溝：X 方向左右各 +6mm 進到側板槽底（跟 Z 方向 drawerBottomFrontEdgeZ
        // 的 -6 慣例一致）。前 +4 = 左右各 +2 只 stick into 2mm、視覺上像「沒卡進去」
        : { length: drawerInnerW + 12, width: drawerBottomLengthRebated, thickness: drawerBottomT },
      origin: {
        x: xCenter,
        y: isSurfaceDrawerBottom
          ? yBase + boxYOffset - drawerBottomT
          : yBase + boxYOffset + 6,
        z: isSurfaceDrawerBottom
          ? (zFront + zBack) / 2
          : (drawerBottomFrontEdgeZ + drawerBottomRearEdgeZ) / 2,
      },
      // 入溝底板：body 已 +12（左右各 +6mm 卡到槽底）、無需 tenons 再外推；
      // 加 tenons 反而會超出側板槽底 6mm 深、戳進實心側板（紅榫頭 bug）。
      tenons: [],
      mortises: [],
    });
   }
  }
}
