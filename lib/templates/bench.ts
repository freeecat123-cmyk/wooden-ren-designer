import type { FurnitureTemplate, OptionSpec } from "@/lib/types";
import { getOption, opt } from "@/lib/types";
import { simpleTable } from "./_builders/simple-table";
import { applyStandardChecks, validateStoolStructure, appendWarnings, appendSuggestion } from "./_validators";
import {
  RECT_LEG_SHAPE_CHOICES,
  seatEdgeOption,
  seatEdgeStyleOption,
  seatEdgeNote,
  seatProfileOption,
  seatProfileNote,
  legEdgeOption,
  legEdgeStyleOption,
  legEdgeNote,
  stretcherEdgeOption,
  stretcherEdgeStyleOption,
  stretcherEdgeNote,
  legShapeLabel,
} from "./_helpers";
import {
  SHELF_CLEARANCE_MM,
  DEFAULT_SHELF_THICKNESS_MM,
  LOWER_STRETCHER_HEIGHT_RATIO,
} from "./_constants";

export const benchOptions: OptionSpec[] = [
  { group: "leg", type: "select", key: "legShape", label: "腳樣式", defaultValue: "box", choices: RECT_LEG_SHAPE_CHOICES },
  { group: "leg", type: "number", key: "legSize", label: "腳粗 (mm)", defaultValue: 40, min: 20, max: 120, step: 1 },
  { group: "top", type: "number", key: "topThickness", label: "座板厚 (mm)", defaultValue: 30, min: 12, max: 60, step: 1 },
  seatEdgeOption("top", 5),
  seatEdgeStyleOption("top"),
  seatProfileOption("top"),
  legEdgeOption("leg", 1),
  legEdgeStyleOption("leg"),
  stretcherEdgeOption("stretcher", 1),
  stretcherEdgeStyleOption("stretcher"),
  { group: "apron", type: "number", key: "apronWidth", label: "牙板高 (mm)", defaultValue: 80, min: 30, max: 200, step: 5 },
  { group: "apron", type: "number", key: "apronOffset", label: "牙板距座板 (mm)", defaultValue: 20, min: 0, max: 400, step: 5 },
  { group: "stretcher", type: "checkbox", key: "withCenterStretcher", label: "加中央橫撐", defaultValue: false, help: "超過 1.2m 建議加" },
  { group: "stretcher", type: "checkbox", key: "withLowerStretchers", label: "加 4 邊下橫撐", defaultValue: false, help: "H 字形結構，更穩但費料" },
  { group: "top", type: "checkbox", key: "withUnderShelf", label: "座下儲物層板", defaultValue: false, help: "在下橫撐之間加一片層板收納鞋子/書" },
  { group: "back", type: "select", key: "endSplat", label: "椅背款式", defaultValue: "none", choices: [
    { value: "none", label: "無（純長凳）" },
    { value: "low", label: "矮椅背 板式（150mm，腰靠感）" },
    { value: "high", label: "高椅背 板式（350mm，正式座椅）" },
    { value: "slatted", label: "高椅背 直格條（350mm，垂直料 + 頂橫木）" },
    { value: "ladder", label: "高椅背 橫格條（350mm，3 條水平橫木）" },
    { value: "windsor", label: "Windsor 風（350mm，2 邊柱+5 細圓料）" },
  ], help: "沿長邊背側加椅背料，靠著有依靠感" },
  { group: "back", type: "number", key: "slatCount", label: "直料根數", defaultValue: 5, min: 3, max: 12, step: 1, dependsOn: { key: "endSplat", equals: "slatted" } },
  { group: "back", type: "number", key: "slatSize", label: "直料粗細 (mm)", defaultValue: 50, min: 20, max: 100, step: 5, help: "方料截面，width 跟 thickness 都用這值", dependsOn: { key: "endSplat", equals: "slatted" } },
  { group: "back", type: "number", key: "topRailSize", label: "頂橫木粗細 (mm)", defaultValue: 50, min: 25, max: 100, step: 5, help: "頂橫木高度，thickness 自動配 25mm", dependsOn: { key: "endSplat", equals: "slatted" } },
  { group: "back", type: "number", key: "slatBackInset", label: "直料距背緣 (mm)", defaultValue: 0, min: 0, max: 80, step: 5, help: "直料背面跟座板背緣的距離，0 = 齊平", dependsOn: { key: "endSplat", equals: "slatted" } },
  { group: "back", type: "number", key: "slatEndInset", label: "直料距端頭 (mm)", defaultValue: 0, min: 0, max: 200, step: 10, help: "直料兩端往內縮的距離（頂橫木仍跨整條長邊不動），0 = 齊平座板兩端", dependsOn: { key: "endSplat", equals: "slatted" } },
  { group: "back", type: "number", key: "topRailBendMm", label: "頂橫木向後彎弧 (mm)", defaultValue: 0, min: 0, max: 80, step: 5, help: "頂橫木中央往後（背側）彎的最大量，給人靠著符合腰背曲線。0 = 直線", dependsOn: { key: "endSplat", equals: "slatted" } },
  { group: "leg", type: "number", key: "legInset", label: "椅腳內縮 (mm)", defaultValue: 0, min: 0, max: 300, step: 5 },
  { group: "stretcher", type: "number", key: "lowerStretcherHeight", label: "下橫撐離地高 (mm)", defaultValue: 0, min: 0, max: 400, step: 10, help: "設 0 = 自動", dependsOn: { key: "withLowerStretchers", equals: true } },
];

export const bench: FurnitureTemplate = (input) => {
  const o = benchOptions;
  const legShape = getOption<string>(input, opt(o, "legShape"));
  const legSize = getOption<number>(input, opt(o, "legSize"));
  const topThickness = getOption<number>(input, opt(o, "topThickness"));
  const seatEdge = getOption<string>(input, opt(o, "seatEdge"));
  const seatEdgeStyle = getOption<string>(input, opt(o, "seatEdgeStyle"));
  const seatProfile = getOption<string>(input, opt(o, "seatProfile"));
  const legEdge = getOption<number>(input, opt(o, "legEdge"));
  const legEdgeStyle = getOption<string>(input, opt(o, "legEdgeStyle"));
  const stretcherEdge = getOption<number>(input, opt(o, "stretcherEdge"));
  const stretcherEdgeStyle = getOption<string>(input, opt(o, "stretcherEdgeStyle"));
  const apronWidth = getOption<number>(input, opt(o, "apronWidth"));
  const apronOffset = getOption<number>(input, opt(o, "apronOffset"));
  const withCenterStretcher = getOption<boolean>(input, opt(o, "withCenterStretcher"));
  const withLowerStretchers = getOption<boolean>(input, opt(o, "withLowerStretchers"));
  const withUnderShelf = getOption<boolean>(input, opt(o, "withUnderShelf"));
  const endSplat = getOption<string>(input, opt(o, "endSplat"));
  const slatCount = getOption<number>(input, opt(o, "slatCount"));
  const slatSize = getOption<number>(input, opt(o, "slatSize"));
  const topRailSize = getOption<number>(input, opt(o, "topRailSize"));
  const slatBackInset = getOption<number>(input, opt(o, "slatBackInset"));
  const slatEndInset = getOption<number>(input, opt(o, "slatEndInset"));
  const topRailBendMm = getOption<number>(input, opt(o, "topRailBendMm"));
  const legInset = getOption<number>(input, opt(o, "legInset"));
  const lowerStretcherHeight = getOption<number>(input, opt(o, "lowerStretcherHeight"));

  const design = simpleTable({
    category: "bench",
    nameZh: "長凳",
    length: input.length,
    width: input.width,
    height: input.height,
    material: input.material,
    legSize,
    topThickness,
    apronWidth,
    apronOffset,
    withCenterStretcher: withCenterStretcher || input.length > 1200,
    withLowerStretchers: withLowerStretchers || withUnderShelf,
    legInset,
    lowerStretcherHeight: lowerStretcherHeight > 0 ? lowerStretcherHeight : undefined,
    legShape: (["box", "tapered", "strong-taper", "inverted", "splayed", "splayed-length", "splayed-width", "hoof"].includes(legShape) ? legShape : "box") as "box" | "tapered" | "strong-taper" | "inverted" | "splayed" | "splayed-length" | "splayed-width" | "hoof",
    seatEdge,
    seatEdgeStyle,
    seatProfile,
    legEdge,
    legEdgeStyle,
    stretcherEdge,
    stretcherEdgeStyle,
    notes: `腳樣式：${legShapeLabel(legShape)}。長凳腳粗越大越穩；超過 1.2m 建議開啟中央橫撐防扭。${seatEdgeNote(seatEdge, seatEdgeStyle)}${legEdgeNote(legEdge, legEdgeStyle)}${stretcherEdgeNote(stretcherEdge, stretcherEdgeStyle)}${seatProfileNote(seatProfile) ? ` ${seatProfileNote(seatProfile)}` : ""}${endSplat !== "none" ? ` 椅背：${endSplat === "low" ? "150mm 板式（腰靠感）" : endSplat === "high" ? "350mm 板式" : endSplat === "slatted" ? "直格條 5 料" : endSplat === "ladder" ? "橫格條 3 條" : "Windsor 風（邊柱+5 圓料）"}。` : ""}`,
  });

  // 椅背 —— 沿長邊背側（+Z）從座板上緣往上延伸
  if (endSplat !== "none") {
    const splatHeight = endSplat === "low" ? 150 : 350;
    const splatThick = 25;
    const seatTop = input.height;
    const halfW = input.width / 2;
    const backZ = halfW - splatThick / 2;
    const mat = input.material;

    if (endSplat === "low" || endSplat === "high") {
      // 板式：單片整面立板
      design.parts.push({
        id: "back-splat",
        nameZh: "椅背立板",
        material: mat,
        grainDirection: "length",
        visible: { length: input.length, width: splatHeight, thickness: splatThick },
        origin: { x: 0, y: seatTop, z: backZ },
        rotation: { x: Math.PI / 2, y: 0, z: 0 },
        tenons: [],
        mortises: [],
      });
    } else if (endSplat === "slatted") {
      // 直格條：N 條垂直料（方料截面 slatSize × slatSize） + 頂橫木
      // slatBackInset：直料 + 頂橫木整體往前移（座板背緣往前推 slatBackInset）
      const topRailH = topRailSize;
      const topRailT = 25; // 頂橫木 thickness 固定 25mm
      const slatN = slatCount;
      const slatW = slatSize;
      const slatT = slatSize;
      const slatHeight = splatHeight - topRailH;
      // 直料兩端往內縮 slatEndInset，剩下空間平均分配 N 條直料
      // 頂橫木維持跨整條長邊（input.length）不縮
      const slatSpan = Math.max(slatN * slatW, input.length - 2 * slatEndInset);
      const slatGap = (slatSpan - slatN * slatW) / Math.max(1, slatN - 1);
      // 直料 origin.z 從 backZ 往前推 slatBackInset，但 backZ 算法用了 splatThick/2，
      // 直料截面是 slatT 不是 splatThick，要校正：直料背面齊平座板背緣 - slatBackInset
      // → origin.z = halfW - slatT/2 - slatBackInset
      const slatZ = halfW - slatT / 2 - slatBackInset;
      const railZ = halfW - topRailT / 2 - slatBackInset;
      for (let i = 0; i < slatN; i++) {
        const x = -slatSpan / 2 + slatW / 2 + i * (slatW + slatGap);
        // 頂橫木在這個 X 位置的後彎量
        const tBend = (2 * x) / input.length;
        const dzAtTop = topRailBendMm > 0
          ? topRailBendMm * Math.max(0, 1 - tBend * tBend)
          : 0;
        // 直料底部接座板 (slatX, seatTop, slatZ)、頂部接彎頂橫木 (..., seatTop+slatHeight, slatZ+dz)
        // 整支向後傾斜 θ = atan(dz / slatHeight)，料長除 cos(θ) 補償
        const tilt = dzAtTop > 0 ? Math.atan(dzAtTop / slatHeight) : 0;
        const tiltedHeight = slatHeight / Math.cos(tilt);
        // PerspectiveView py = (origin.y + yExt/2) → 調 origin 讓料中軸中點落在 (slatX, seatTop+slatHeight/2, slatZ+dz/2)
        const originY = seatTop + (slatHeight - tiltedHeight) / 2;
        const originZ = slatZ + dzAtTop / 2;
        design.parts.push({
          id: `back-slat-${i + 1}`,
          nameZh: `椅背直料 ${i + 1}`,
          material: mat,
          grainDirection: "length",
          visible: { length: slatW, width: tiltedHeight, thickness: slatT },
          origin: { x, y: originY, z: originZ },
          rotation: { x: Math.PI / 2 + tilt, y: 0, z: 0 },
          tenons: [],
          mortises: [],
        });
      }
      // 頂橫木：不旋轉，讓 local Z = 深度方向，arch-bent 才能在世界 Z 方向彎
      // local X=長 (世界 X)、local Y=高度 (世界 Y, thickness 借當高)、local Z=深度 (世界 Z, width 借當深)
      design.parts.push({
        id: "back-top-rail",
        nameZh: "椅背頂橫木",
        material: mat,
        grainDirection: "length",
        visible: { length: input.length, width: topRailT, thickness: topRailH },
        origin: { x: 0, y: seatTop + slatHeight, z: railZ },
        shape: topRailBendMm > 0 ? { kind: "arch-bent" as const, bendMm: topRailBendMm } : undefined,
        tenons: [],
        mortises: [],
      });
    } else if (endSplat === "ladder") {
      // 橫格條：頂橫木 + 2 條中段橫料（高 60mm）
      const railH = 60;
      const railT = 25;
      const railSpacing = (splatHeight - 3 * railH) / 2; // 3 條 + 2 個間隔
      for (let i = 0; i < 3; i++) {
        const yBot = seatTop + i * (railH + railSpacing);
        design.parts.push({
          id: `back-rail-${i + 1}`,
          nameZh: i === 2 ? "椅背頂橫木" : `椅背橫料 ${i + 1}`,
          material: mat,
          grainDirection: "length",
          visible: { length: input.length, width: railH, thickness: railT },
          origin: { x: 0, y: yBot, z: backZ },
          rotation: { x: Math.PI / 2, y: 0, z: 0 },
          tenons: [],
          mortises: [],
        });
      }
    } else if (endSplat === "windsor") {
      // Windsor 風：2 邊柱（方料）+ 1 頂橫木 + 5 條圓料連接座板和頂橫木
      const postW = 35;
      const postT = 35;
      const topRailH = 50;
      const topRailT = 25;
      const spindleD = 18; // 圓料直徑
      const spindleN = 5;
      // 2 邊柱
      for (const sx of [-1, 1] as const) {
        design.parts.push({
          id: `back-post-${sx > 0 ? "right" : "left"}`,
          nameZh: `椅背${sx > 0 ? "右" : "左"}邊柱`,
          material: mat,
          grainDirection: "length",
          visible: { length: postW, width: splatHeight, thickness: postT },
          origin: { x: sx * (input.length / 2 - postW / 2), y: seatTop, z: backZ },
          rotation: { x: Math.PI / 2, y: 0, z: 0 },
          tenons: [],
          mortises: [],
        });
      }
      // 頂橫木
      design.parts.push({
        id: "back-top-rail",
        nameZh: "椅背頂橫木",
        material: mat,
        grainDirection: "length",
        visible: { length: input.length - 2 * postW, width: topRailH, thickness: topRailT },
        origin: { x: 0, y: seatTop + splatHeight - topRailH, z: backZ },
        rotation: { x: Math.PI / 2, y: 0, z: 0 },
        tenons: [],
        mortises: [],
      });
      // 5 圓料：均分在邊柱之間
      const spindleSpan = input.length - 2 * postW - spindleD;
      const spindleH = splatHeight - topRailH;
      for (let i = 0; i < spindleN; i++) {
        const x = -spindleSpan / 2 + (i / (spindleN - 1)) * spindleSpan;
        design.parts.push({
          id: `back-spindle-${i + 1}`,
          nameZh: `椅背圓料 ${i + 1}`,
          material: mat,
          grainDirection: "length",
          visible: { length: spindleD, width: spindleH, thickness: spindleD },
          origin: { x, y: seatTop, z: backZ },
          rotation: { x: Math.PI / 2, y: 0, z: 0 },
          shape: { kind: "round" },
          tenons: [],
          mortises: [],
        });
      }
    }
  }

  if (withUnderShelf) {
    const shelfT = DEFAULT_SHELF_THICKNESS_MM;
    const stretcherW = 40;
    const stretcherT = 20; // 跟 simple-table opts.lowerStretcherThickness 預設一致
    const stretcherY = lowerStretcherHeight > 0
      ? lowerStretcherHeight
      : Math.round((input.height - topThickness) * LOWER_STRETCHER_HEIGHT_RATIO);
    const shelfY = stretcherY + stretcherW;
    // 跟著 simple-table 的 splay 慣例算橫撐 origin 偏移：splayed 腳的橫撐
    // 會以「中軸 Y」算外推量（centerline alignment），shelf 也要跟上。
    const splayMm = 40;
    const splayDx = legShape === "splayed" || legShape === "splayed-length" ? splayMm : 0;
    const splayDz = legShape === "splayed" || legShape === "splayed-width" ? splayMm : 0;
    const legHeight = input.height - topThickness;
    const sCenterY = stretcherY + stretcherW / 2;
    const sCenterShift = legHeight > 0 ? 1 - sCenterY / legHeight : 0;
    const sSplayX = splayDx * sCenterShift;
    const sSplayZ = splayDz * sCenterShift;
    // shelf 邊緣 = 橫撐外面（apronEdge + splay@centerY + stretcherT/2）×2
    const shelfLen = Math.max(50, input.length - legSize - 2 * legInset + 2 * sSplayX + stretcherT);
    const shelfWid = Math.max(50, input.width - legSize - 2 * legInset + 2 * sSplayZ + stretcherT);
    // 缺角公式：shelf 邊緣 vs 腳在 shelf-Y 的內面
    //   shelf_edge = apronEdge + splay@centerY + stretcherT/2
    //   leg_inner_at_shelfY = apronEdge + splay@shelfY - legSize/2
    //   overlap = splay × (centerShift - shelfShift) + (stretcherT + legSize)/2
    //           = splay × stretcherW / (2 × legHeight) + (legSize + stretcherT)/2
    const splayExtraX = legHeight > 0 ? (splayDx * stretcherW) / (2 * legHeight) : 0;
    const splayExtraZ = legHeight > 0 ? (splayDz * stretcherW) / (2 * legHeight) : 0;
    const notchLen = Math.max(0, splayExtraX + (legSize + stretcherT) / 2);
    const notchWid = Math.max(0, splayExtraZ + (legSize + stretcherT) / 2);
    design.parts.push({
      id: "under-shelf",
      nameZh: "座下層板",
      material: input.material,
      grainDirection: "length",
      visible: { length: shelfLen, width: shelfWid, thickness: shelfT },
      origin: { x: 0, y: shelfY, z: 0 },
      shape: notchLen > 0 || notchWid > 0
        ? { kind: "notched-corners", notchLengthMm: notchLen, notchWidthMm: notchWid }
        : undefined,
      tenons: [],
      mortises: [],
    });
  }

  applyStandardChecks(design, {
    minLength: 600, minWidth: 200, minHeight: 350,
    maxLength: 2000, maxWidth: 550, maxHeight: 550,
  });
  if (input.height > 550) {
    appendSuggestion(design, {
      text: `坐高 ${input.height}mm 已接近桌面高度——建議用低桌或餐桌模板，含中央橫撐 + 牙板選項。`,
      suggestedCategory: input.height >= 700 ? "dining-table" : "low-table",
      presetParams: { length: input.length, width: input.width, height: input.height, material: input.material },
    });
  }
  appendWarnings(
    design,
    validateStoolStructure({
      legSize,
      height: input.height,
      seatThickness: topThickness,
      seatSpan: input.length, // 長凳座板跨距 = length（長邊）
      lowerStretcherHeight: withLowerStretchers && lowerStretcherHeight > 0
        ? lowerStretcherHeight
        : undefined,
      hasLowerStretcher: withLowerStretchers || withUnderShelf,
    }),
  );
  return design;
};
