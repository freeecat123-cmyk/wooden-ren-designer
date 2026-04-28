import type {
  FurnitureDesign,
  FurnitureTemplate,
  OptionSpec,
  Part,
} from "@/lib/types";
import { getOption, opt } from "@/lib/types";
import { corners, rectLegShape, RECT_LEG_SHAPE_CHOICES, seatEdgeOption, seatEdgeStyleOption, seatEdgeNote, seatEdgeShape, seatProfileOption, seatProfileNote, seatScoopShape, legEdgeOption, legEdgeStyleOption, legEdgeShape, legEdgeNote, stretcherEdgeOption, stretcherEdgeStyleOption, stretcherEdgeNote, legShapeLabel } from "./_helpers";
import { applyStandardChecks, validateStoolStructure, appendWarnings, appendSuggestion } from "./_validators";
import { LOWER_STRETCHER_HEIGHT_RATIO } from "./_constants";

export const squareStoolOptions: OptionSpec[] = [
  { group: "leg", type: "select", key: "legShape", label: "腳樣式", defaultValue: "box", choices: RECT_LEG_SHAPE_CHOICES },
  { group: "leg", type: "number", key: "legSize", label: "腳粗 (mm)", defaultValue: 35, min: 20, max: 120, step: 1, unit: "mm" },
  { group: "leg", type: "number", key: "legInset", label: "腳內縮 (mm)", defaultValue: 0, min: 0, max: 200, step: 5, unit: "mm", help: "腳中心離座板邊緣的內縮量。> 0 讓座板外伸、視覺更俐落" },
  legEdgeOption("leg", 0),
  legEdgeStyleOption("leg"),
  { group: "top", type: "number", key: "seatThickness", label: "座板厚 (mm)", defaultValue: 25, min: 12, max: 60, step: 1, unit: "mm" },
  seatEdgeOption("top", 5),
  seatEdgeStyleOption("top"),
  seatProfileOption("top"),
  { group: "apron", type: "number", key: "apronWidth", label: "橫撐高度 (mm)", defaultValue: 60, min: 30, max: 200, step: 5, unit: "mm" },
  { group: "apron", type: "number", key: "apronThickness", label: "橫撐厚度 (mm)", defaultValue: 20, min: 10, max: 50, step: 1, unit: "mm" },
  { group: "apron", type: "number", key: "apronDropFromTop", label: "橫撐距座板 (mm)", defaultValue: 30, min: 0, max: 400, step: 5, unit: "mm", help: "橫撐頂面距座板下緣的距離" },
  { group: "stretcher", type: "checkbox", key: "withLowerStretcher", label: "加下橫撐", defaultValue: false, help: "在腳下方 1/4 高加一圈橫撐，結構更穩" },
  { group: "stretcher", type: "select", key: "lowerStretcherStyle", label: "下橫撐樣式", defaultValue: "h-frame", choices: [
    { value: "h-frame", label: "H 字形（4 條繞 1 圈，最穩）" },
    { value: "x-cross", label: "X 字交叉（2 條斜撐穿越中心，明清交杌做法）" },
  ], dependsOn: { key: "withLowerStretcher", equals: true } },
  { group: "stretcher", type: "number", key: "lowerStretcherWidth", label: "下橫撐高 (mm)", defaultValue: 40, min: 20, max: 150, step: 5, unit: "mm", dependsOn: { key: "withLowerStretcher", equals: true } },
  { group: "stretcher", type: "number", key: "lowerStretcherThickness", label: "下橫撐厚 (mm)", defaultValue: 20, min: 10, max: 50, step: 1, unit: "mm", dependsOn: { key: "withLowerStretcher", equals: true } },
  { group: "stretcher", type: "number", key: "lowerStretcherHeight", label: "下橫撐離地高 (mm)", defaultValue: 0, min: 0, max: 700, step: 10, unit: "mm", help: "0 = 自動（腳高的 22%）", dependsOn: { key: "withLowerStretcher", equals: true } },
  stretcherEdgeOption("stretcher", 0),
  stretcherEdgeStyleOption("stretcher"),
];

/**
 * 方凳（square stool）
 *
 * 結構：
 *  - 1 × 座板（top panel）
 *  - 4 × 凳腳（legs）
 *  - 4 × 橫撐（stretchers/aprons），凳腳之間連接
 *
 * 接合：
 *  - 凳腳 ↔ 座板：通榫（凳腳上端凸出穿過座板）
 *  - 橫撐 ↔ 凳腳：半榫（橫撐兩端凸入凳腳側面榫眼）
 *
 * 預設尺寸假設：
 *  - 座板 = length × width × thickness（含 4 個榫眼）
 *  - 凳腳 = leg × leg × height（上端有通榫，側面有 2 個半榫眼）
 *  - 橫撐 = (length - 2*legSize) × apronWidth × apronThickness
 */
export const squareStool: FurnitureTemplate = (input): FurnitureDesign => {
  const {
    length,
    width,
    height,
    material,
  } = input;

  const o = squareStoolOptions;
  const legShape = getOption<string>(input, opt(o, "legShape"));
  const legSize = getOption<number>(input, opt(o, "legSize"));
  const legInset = getOption<number>(input, opt(o, "legInset"));
  const legEdge = getOption<string>(input, opt(o, "legEdge"));
  const legEdgeStyle = getOption<string>(input, opt(o, "legEdgeStyle"));
  const seatThickness = getOption<number>(input, opt(o, "seatThickness"));
  const seatEdge = getOption<string>(input, opt(o, "seatEdge"));
  const seatEdgeStyle = getOption<string>(input, opt(o, "seatEdgeStyle"));
  const seatProfile = getOption<string>(input, opt(o, "seatProfile"));
  const stretcherEdge = getOption<string>(input, opt(o, "stretcherEdge"));
  const stretcherEdgeStyle = getOption<string>(input, opt(o, "stretcherEdgeStyle"));
  const apronWidth = getOption<number>(input, opt(o, "apronWidth"));
  const apronThickness = getOption<number>(input, opt(o, "apronThickness"));
  const apronDropFromTop = getOption<number>(input, opt(o, "apronDropFromTop"));
  const withLowerStretcher = getOption<boolean>(input, opt(o, "withLowerStretcher"));
  const lowerStretcherStyle = getOption<string>(input, opt(o, "lowerStretcherStyle"));
  const lowerStretcherWidth = getOption<number>(input, opt(o, "lowerStretcherWidth"));
  const lowerStretcherThickness = getOption<number>(input, opt(o, "lowerStretcherThickness"));
  const lowerStretcherHeightOpt = getOption<number>(input, opt(o, "lowerStretcherHeight"));

  const legTenonLength = seatThickness; // 通榫穿過座板
  // 通榫也要有肩：tenon 斷面 = 柱腳的 2/3，四面留肩
  const legTopTenonSize = Math.max(15, Math.round((legSize * 2) / 3));
  // 正規比例：榫厚 = min(apron 厚 - 兩肩 12, 柱腳 1/3)；肩寬固定 6mm
  const MIN_SHOULDER = 6;
  const apronTenonLength = Math.round((legSize * 2) / 3);
  const apronTenonThick = Math.max(
    6,
    Math.min(apronThickness - 2 * MIN_SHOULDER, Math.round(legSize / 3)),
  );
  const apronTenonW = Math.max(15, apronWidth - 2 * MIN_SHOULDER);

  const legHeight = height - seatThickness;

  const seatPanel: Part = {
    id: "seat",
    nameZh: "座板",
    material,
    grainDirection: "length",
    visible: { length, width, thickness: seatThickness },
    origin: { x: 0, y: legHeight, z: 0 },
    shape: seatScoopShape(seatProfile) ?? seatEdgeShape(seatEdge, seatEdgeStyle),
    tenons: [],
    mortises: [
      // 4 個通孔：座板四角放凳腳通榫（肩內縮的斷面）
      ...corners(length, width, legSize, legInset).map((c) => ({
        origin: { x: c.x, y: 0, z: c.z },
        depth: seatThickness,
        length: legTopTenonSize,
        width: legTopTenonSize,
        through: true,
      })),
    ],
  };

  // 4 隻凳腳
  const legs: Part[] = corners(length, width, legSize, legInset).map((c, i) => ({
    id: `leg-${i + 1}`,
    nameZh: `凳腳 ${i + 1}`,
    material,
    grainDirection: "length",
    visible: { length: legSize, width: legSize, thickness: legHeight },
    origin: { x: c.x, y: 0, z: c.z },
    // 主 leg shape（box / tapered / splayed 等）優先；leg 是 box 時可改套
    // chamfered-edges（4 條長邊倒角）。tapered/splayed 已有自己的視覺，不疊加。
    shape: rectLegShape(legShape, c, { splayedFrontOnly: false }) ?? legEdgeShape(legEdge, legEdgeStyle),
    tenons: [
      {
        position: "top",
        type: "through-tenon",
        length: legTenonLength,
        width: legTopTenonSize,
        thickness: legTopTenonSize,
      },
    ],
    // 凳腳內側 2 面要挖橫撐的半榫眼（中段，距離地面 1/3 處）
    mortises: legMortisesForApron(c, length, width, {
      apronTenonLength,
      apronTenonWidth: apronTenonW,
      apronTenonThick,
      apronWidth,
      legHeight,
      apronDropFromTop,
    }),
  }));

  // 4 條橫撐（凳腳之間）—— body 延伸到腳中心以視覺呈現榫頭位置
  const apronInnerSpan = {
    x: length - legSize - 2 * legInset,
    z: width - legSize - 2 * legInset,
  };
  // 外斜支援 3 種：對角 splayed、單向 splayed-length（只 X）、splayed-width（只 Z）
  // splayDx/splayDz 拆開計算，axis-aware 牙板補償
  const splayMm = 30; // 跟 rectLegShape 預設一致
  const splayDx =
    legShape === "splayed" || legShape === "splayed-length" ? splayMm : 0;
  const splayDz =
    legShape === "splayed" || legShape === "splayed-width" ? splayMm : 0;
  const isSplayed = splayDx > 0 || splayDz > 0;
  const apronY = legHeight - apronWidth - apronDropFromTop;
  const apronYCenter = apronY + apronWidth / 2;
  const apronShiftFactor = legHeight > 0 ? 1 - apronYCenter / legHeight : 0;
  const apronSplayX = splayDx * apronShiftFactor;
  const apronSplayZ = splayDz * apronShiftFactor;
  const tiltX = splayDx > 0 ? Math.atan(splayDx / legHeight) : 0;
  const tiltZ = splayDz > 0 ? Math.atan(splayDz / legHeight) : 0;
  const apronEdgeZ = width / 2 - legSize / 2 - legInset;
  const apronEdgeX = length / 2 - legSize / 2 - legInset;
  const apronSides = [
    { id: "apron-front", nameZh: "前橫撐", visibleLength: apronInnerSpan.x + 2 * apronSplayX, axis: "x" as const, sx: 0, sz: -1, origin: { x: 0, z: -(apronEdgeZ + apronSplayZ) } },
    { id: "apron-back", nameZh: "後橫撐", visibleLength: apronInnerSpan.x + 2 * apronSplayX, axis: "x" as const, sx: 0, sz: 1, origin: { x: 0, z: apronEdgeZ + apronSplayZ } },
    { id: "apron-left", nameZh: "左橫撐", visibleLength: apronInnerSpan.z + 2 * apronSplayZ, axis: "z" as const, sx: -1, sz: 0, origin: { x: -(apronEdgeX + apronSplayX), z: 0 } },
    { id: "apron-right", nameZh: "右橫撐", visibleLength: apronInnerSpan.z + 2 * apronSplayZ, axis: "z" as const, sx: 1, sz: 0, origin: { x: apronEdgeX + apronSplayX, z: 0 } },
  ];
  const aprons: Part[] = apronSides.map((s) => {
    // x 軸牙板（前/後）補 tiltZ；z 軸牙板（左/右）補 tiltX
    const bevelAngle = isSplayed
      ? s.axis === "x" ? -s.sz * tiltZ : -s.sx * tiltX
      : 0;
    return {
      id: s.id,
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
      shape: isSplayed
        ? { kind: "apron-beveled" as const, bevelAngle }
        : legEdgeShape(stretcherEdge, stretcherEdgeStyle),
      tenons: [
        {
          position: "start" as const,
          type: "shouldered-tenon" as const,
          length: apronTenonLength,
          width: apronTenonW,
          thickness: apronTenonThick,
        },
        {
          position: "end" as const,
          type: "shouldered-tenon" as const,
          length: apronTenonLength,
          width: apronTenonW,
          thickness: apronTenonThick,
        },
      ],
      mortises: [],
    };
  });

  const parts: Part[] = [seatPanel, ...legs, ...aprons];

  if (withLowerStretcher) {
    const lowerY = lowerStretcherHeightOpt > 0
      ? lowerStretcherHeightOpt
      : Math.round(legHeight * LOWER_STRETCHER_HEIGHT_RATIO);
    const lowerW = lowerStretcherWidth;
    const lowerT = lowerStretcherThickness;
    const lowerTenon = Math.round((legSize * 2) / 3);
    const lowerTenonThick = Math.max(
      6,
      Math.min(lowerT - 2 * MIN_SHOULDER, Math.round(legSize / 3)),
    );
    const lowerTenonW = Math.max(12, lowerW - 2 * MIN_SHOULDER);
    // 下橫撐位置低 → 腳已外推更多，shiftFactor 更大
    const lsYCenter = lowerY + lowerW / 2;
    const lsShiftFactor = legHeight > 0 ? 1 - lsYCenter / legHeight : 0;
    const lsSplayX = splayDx * lsShiftFactor;
    const lsSplayZ = splayDz * lsShiftFactor;
    if (lowerStretcherStyle === "x-cross") {
      // X 字交叉橫撐：兩條對角線連接 4 隻腳，過中心半搭接。
      // 外斜模式時對角橫撐做法太複雜（要傾斜+扭轉），先不支援；fallback 走直立 X。
      // 視覺上 2 條交叉時可能有 z-fight，第二條稍微抬高 1mm 避免（肉眼看不出）。
      const halfX = apronEdgeX + lsSplayX;
      const halfZ = apronEdgeZ + lsSplayZ;
      const diagLen = 2 * Math.sqrt(halfX * halfX + halfZ * halfZ);
      // 對角斜撐 length 較長 → 重新算 tenon（仍是 1/3 法則）
      const xTenonW = Math.max(12, lowerW - 2 * MIN_SHOULDER);
      const xTenonThick = Math.max(6, Math.min(lowerT - 2 * MIN_SHOULDER, Math.round(legSize / 3)));
      // 角度：atan2(halfZ, halfX)，方型凳 = 45°
      const angle = Math.atan2(halfZ, halfX);
      const diagonals = [
        { id: "ls-x1", nameZh: "X 撐 1（前左↔後右）", yRot: angle, yLift: 0 },
        { id: "ls-x2", nameZh: "X 撐 2（前右↔後左）", yRot: -angle, yLift: lowerT * 0.05 },
      ];
      for (const d of diagonals) {
        parts.push({
          id: d.id,
          nameZh: d.nameZh,
          material,
          grainDirection: "length",
          visible: { length: diagLen, width: lowerW, thickness: lowerT },
          origin: { x: 0, y: lowerY + d.yLift, z: 0 },
          rotation: { x: Math.PI / 2, y: d.yRot, z: 0 },
          shape: legEdgeShape(stretcherEdge, stretcherEdgeStyle),
          tenons: [
            { position: "start", type: "blind-tenon", length: lowerTenon, width: xTenonW, thickness: xTenonThick },
            { position: "end", type: "blind-tenon", length: lowerTenon, width: xTenonW, thickness: xTenonThick },
          ],
          mortises: [],
        });
      }
    } else {
      // h-frame: 4 條繞 1 圈
      const sides = [
        { id: "ls-front", nameZh: "前下橫撐", visibleLength: apronInnerSpan.x + 2 * lsSplayX, axis: "x" as const, sx: 0, sz: -1, origin: { x: 0, z: -(apronEdgeZ + lsSplayZ) } },
        { id: "ls-back", nameZh: "後下橫撐", visibleLength: apronInnerSpan.x + 2 * lsSplayX, axis: "x" as const, sx: 0, sz: 1, origin: { x: 0, z: apronEdgeZ + lsSplayZ } },
        { id: "ls-left", nameZh: "左下橫撐", visibleLength: apronInnerSpan.z + 2 * lsSplayZ, axis: "z" as const, sx: -1, sz: 0, origin: { x: -(apronEdgeX + lsSplayX), z: 0 } },
        { id: "ls-right", nameZh: "右下橫撐", visibleLength: apronInnerSpan.z + 2 * lsSplayZ, axis: "z" as const, sx: 1, sz: 0, origin: { x: apronEdgeX + lsSplayX, z: 0 } },
      ];
      for (const s of sides) {
        const bevelAngle = isSplayed
          ? s.axis === "x" ? -s.sz * tiltZ : -s.sx * tiltX
          : 0;
        parts.push({
          id: s.id,
          nameZh: s.nameZh,
          material,
          grainDirection: "length",
          visible: { length: s.visibleLength, width: lowerW, thickness: lowerT },
          origin: { x: s.origin.x, y: lowerY, z: s.origin.z },
          rotation: s.axis === "z"
            ? { x: Math.PI / 2, y: Math.PI / 2, z: s.sx * tiltX }
            : { x: Math.PI / 2 + (-s.sz) * tiltZ, y: 0, z: 0 },
          shape: isSplayed
            ? { kind: "apron-beveled", bevelAngle }
            : legEdgeShape(stretcherEdge, stretcherEdgeStyle),
          tenons: [
            { position: "start", type: "blind-tenon", length: lowerTenon, width: lowerTenonW, thickness: lowerTenonThick },
            { position: "end", type: "blind-tenon", length: lowerTenon, width: lowerTenonW, thickness: lowerTenonThick },
          ],
          mortises: [],
        });
      }
    }
  }

  const design: FurnitureDesign = {
    id: `square-stool-${length}x${width}x${height}`,
    category: "stool",
    nameZh: "方凳",
    overall: { length, width, thickness: height },
    parts,
    defaultJoinery: "through-tenon",
    primaryMaterial: material,
    notes:
      `腳樣式：${legShapeLabel(legShape)}。座板與凳腳用通榫，凳腳與橫撐用半榫。` +
      (withLowerStretcher
        ? lowerStretcherStyle === "x-cross"
          ? " 加 X 字交叉橫撐（明清交杌做法）。"
          : " 加 H 字下橫撐結構。"
        : "") +
      ` ${seatEdgeNote(seatEdge)}` +
      (seatProfileNote(seatProfile) ? ` ${seatProfileNote(seatProfile)}` : ""),
  };
  applyStandardChecks(design, {
    minLength: 250, minWidth: 250, minHeight: 350,
    maxLength: 600, maxWidth: 600, maxHeight: 550,
  });
  // 尺寸明顯比較像桌類 → 建議切茶几模板
  if (length > 600 || width > 600) {
    appendSuggestion(design, {
      text: `${length}×${width}mm 比較像茶几尺寸——茶几模板有專屬選項（下棚板、牙板距桌面、外伸）。`,
      suggestedCategory: "tea-table",
      presetParams: { length, width, height: Math.min(height, 500), material },
    });
  }
  appendWarnings(
    design,
    validateStoolStructure({
      legSize,
      height,
      seatThickness,
      seatSpan: Math.max(length, width),
      lowerStretcherHeight: withLowerStretcher
        ? lowerStretcherHeightOpt > 0
          ? lowerStretcherHeightOpt
          : Math.round(legHeight * LOWER_STRETCHER_HEIGHT_RATIO)
        : undefined,
      hasLowerStretcher: withLowerStretcher,
    }),
  );
  return design;
};

// ----- helpers -----

function legMortisesForApron(
  corner: { x: number; z: number },
  length: number,
  width: number,
  opts: {
    apronTenonLength: number;
    apronTenonWidth: number;
    apronTenonThick: number;
    apronWidth: number;
    legHeight: number;
    apronDropFromTop: number;
  },
) {
  const { apronTenonLength, apronTenonWidth, apronTenonThick, apronWidth, legHeight, apronDropFromTop } = opts;
  const yOffset = legHeight - apronWidth - apronDropFromTop;
  return [
    // 內側 X 方向榫眼（前後橫撐插入）
    {
      origin: { x: 0, y: yOffset, z: corner.z > 0 ? -1 : 1 },
      depth: apronTenonLength,
      length: apronTenonWidth,
      width: apronTenonThick,
      through: false,
    },
    // 內側 Z 方向榫眼（左右橫撐插入）
    {
      origin: { x: corner.x > 0 ? -1 : 1, y: yOffset, z: 0 },
      depth: apronTenonLength,
      length: apronTenonWidth,
      width: apronTenonThick,
      through: false,
    },
  ];
}

function apron(
  id: string,
  nameZh: string,
  visibleLength: number,
  axis: "x" | "z",
  origin: { x?: number; z?: number },
) {
  return {
    id,
    nameZh,
    visibleLength,
    axis,
    origin: { x: origin.x ?? 0, z: origin.z ?? 0 },
  };
}
