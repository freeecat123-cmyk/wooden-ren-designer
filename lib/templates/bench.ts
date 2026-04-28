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
  { group: "back", type: "select", key: "endSplat", label: "兩端立板", defaultValue: "none", choices: [
    { value: "none", label: "無（純長凳）" },
    { value: "low", label: "矮立板（150mm 高，扶手感）" },
    { value: "high", label: "高立板（350mm 高，教堂長椅式）" },
  ], help: "兩端加垂直立板，靠著有依靠感、視覺更有結構" },
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
    notes: `腳樣式：${legShapeLabel(legShape)}。長凳腳粗越大越穩；超過 1.2m 建議開啟中央橫撐防扭。${seatEdgeNote(seatEdge, seatEdgeStyle)}${legEdgeNote(legEdge, legEdgeStyle)}${stretcherEdgeNote(stretcherEdge, stretcherEdgeStyle)}${seatProfileNote(seatProfile) ? ` ${seatProfileNote(seatProfile)}` : ""}${endSplat !== "none" ? ` 兩端加 ${endSplat === "low" ? "150mm" : "350mm"} 立板（${endSplat === "low" ? "矮扶手感" : "教堂長椅式"}）。` : ""}`,
  });

  // 兩端立板（end splat）—— 從座板上緣往上延伸，立在 +x / -x 兩端
  if (endSplat !== "none") {
    const splatHeight = endSplat === "low" ? 150 : 350;
    const splatThick = 25;
    const seatTop = input.height; // 座板頂面
    const halfL = input.length / 2;
    for (const side of [-1, 1] as const) {
      design.parts.push({
        id: `end-splat-${side > 0 ? "right" : "left"}`,
        nameZh: `${side > 0 ? "右" : "左"}端立板`,
        material: input.material,
        grainDirection: "length",
        visible: {
          length: input.width - 20,
          width: splatHeight,
          thickness: splatThick,
        },
        origin: {
          x: side * (halfL - splatThick / 2),
          y: seatTop,
          z: 0,
        },
        rotation: { x: Math.PI / 2, y: Math.PI / 2, z: 0 },
        tenons: [],
        mortises: [],
      });
    }
  }

  if (withUnderShelf) {
    const shelfT = DEFAULT_SHELF_THICKNESS_MM;
    // 下橫撐 Y（跟 simple-table 同邏輯：自動 = 腳高 × LOWER_STRETCHER_HEIGHT_RATIO）+ 寬 40
    const stretcherW = 40;
    const stretcherY = lowerStretcherHeight > 0
      ? lowerStretcherHeight
      : Math.round((input.height - topThickness) * LOWER_STRETCHER_HEIGHT_RATIO);
    // 層板坐在下橫撐頂面，不能埋進橫撐內部
    const shelfY = stretcherY + stretcherW;
    design.parts.push({
      id: "under-shelf",
      nameZh: "座下層板",
      material: input.material,
      grainDirection: "length",
      visible: {
        // 扣腳本身 + legInset，再各邊留 SHELF_CLEARANCE_MM 間隙
        length: Math.max(50, input.length - 2 * legSize - 2 * legInset - 2 * SHELF_CLEARANCE_MM),
        width: Math.max(50, input.width - 2 * legSize - 2 * legInset - 2 * SHELF_CLEARANCE_MM),
        thickness: shelfT,
      },
      origin: { x: 0, y: shelfY, z: 0 },
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
