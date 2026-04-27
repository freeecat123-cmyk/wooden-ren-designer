import type {
  FurnitureDesign,
  FurnitureTemplate,
  OptionSpec,
  Part,
} from "@/lib/types";
import { getOption, opt } from "@/lib/types";
import { corners, RECT_LEG_SHAPE_CHOICES, seatEdgeOption, seatEdgeStyleOption, seatEdgeNote, seatEdgeShape, legEdgeOption, legEdgeStyleOption, legEdgeNote, legEdgeShape, stretcherEdgeOption, stretcherEdgeStyleOption, stretcherEdgeNote, legShapeLabel } from "./_helpers";
import { applyStandardChecks } from "./_validators";

export const barStoolOptions: OptionSpec[] = [
  { group: "leg", type: "select", key: "legShape", label: "椅腳樣式", defaultValue: "box", choices: RECT_LEG_SHAPE_CHOICES },
  { group: "leg", type: "number", key: "legSize", label: "椅腳粗 (mm)", defaultValue: 35, min: 20, max: 80, step: 1 },
  { group: "top", type: "number", key: "seatThickness", label: "座板厚 (mm)", defaultValue: 28, min: 15, max: 60, step: 1 },
  seatEdgeOption("top", 5),
  seatEdgeStyleOption("top"),
  legEdgeOption("leg", 1),
  legEdgeStyleOption("leg"),
  stretcherEdgeOption("stretcher", 1),
  stretcherEdgeStyleOption("stretcher"),
  { group: "stretcher", type: "select", key: "footrestStyle", label: "腳踏樣式", defaultValue: "four-sides", choices: [
    { value: "four-sides", label: "四面腳踏（最穩，傳統做法）" },
    { value: "front-only", label: "只前面腳踏（極簡）" },
    { value: "ring", label: "金屬環（外加，木工不負責）" },
  ], help: "吧檯椅腳踏的配置方式" },
  { group: "stretcher", type: "number", key: "footrestHeight", label: "腳踏高 (mm)", defaultValue: 200, min: 50, max: 700, step: 10, help: "腳踏橫撐離地高度，標準 200–230mm" },
  { group: "apron", type: "number", key: "apronWidth", label: "牙板高 (mm)", defaultValue: 50, min: 20, max: 150, step: 5 },
  { group: "apron", type: "number", key: "apronOffset", label: "牙板距座板 (mm)", defaultValue: 5, min: 0, max: 300, step: 5, help: "牙板頂緣往下退的距離" },
  { group: "back", type: "select", key: "backStyle", label: "椅背樣式", defaultValue: "none", choices: [
    { value: "none", label: "無椅背" },
    { value: "rail", label: "短橫木（一根橫木）" },
    { value: "slats", label: "直條式（N 根垂直板條）" },
  ] },
  { group: "back", type: "number", key: "backHeight", label: "椅背高 (mm)", defaultValue: 200, min: 80, max: 500, step: 10, help: "從座板上緣到椅背頂", dependsOn: { key: "backStyle", notIn: ["none"] } },
  { group: "back", type: "number", key: "backSlats", label: "直條數（直條式用）", defaultValue: 3, min: 1, max: 8, step: 1, dependsOn: { key: "backStyle", equals: "slats" } },
  { group: "back", type: "number", key: "backSlatWidth", label: "直條寬 (mm)", defaultValue: 40, min: 15, max: 150, step: 5, dependsOn: { key: "backStyle", equals: "slats" } },
  { group: "stretcher", type: "number", key: "footrestWidth", label: "腳踏寬 (mm)", defaultValue: 30, min: 20, max: 60, step: 1, help: "腳踏橫撐的垂直高（粗）" },
  { group: "stretcher", type: "number", key: "footrestThickness", label: "腳踏厚 (mm)", defaultValue: 22, min: 12, max: 40, step: 1, help: "腳踏橫撐的水平厚（深）" },
];

/**
 * 吧檯椅（bar stool）
 * 高度 700–800mm，一圈腳踏橫撐在較低位置；可選加短椅背。
 */
export const barStool: FurnitureTemplate = (input): FurnitureDesign => {
  const { length, width, height, material } = input;
  const o = barStoolOptions;
  const legShape = getOption<string>(input, opt(o, "legShape"));
  const legSize = getOption<number>(input, opt(o, "legSize"));
  const seatThickness = getOption<number>(input, opt(o, "seatThickness"));
  const seatEdge = getOption<string>(input, opt(o, "seatEdge"));
  const seatEdgeStyle = getOption<string>(input, opt(o, "seatEdgeStyle"));
  const legEdge = getOption<number>(input, opt(o, "legEdge"));
  const legEdgeStyle = getOption<string>(input, opt(o, "legEdgeStyle"));
  const stretcherEdge = getOption<number>(input, opt(o, "stretcherEdge"));
  const stretcherEdgeStyle = getOption<string>(input, opt(o, "stretcherEdgeStyle"));
  const footrestStyle = getOption<string>(input, opt(o, "footrestStyle"));
  const footrestHeight = getOption<number>(input, opt(o, "footrestHeight"));
  const apronWidth = getOption<number>(input, opt(o, "apronWidth"));
  const apronOffset = getOption<number>(input, opt(o, "apronOffset"));
  const backStyle = getOption<string>(input, opt(o, "backStyle"));
  const backHeightOpt = getOption<number>(input, opt(o, "backHeight"));
  const backSlatCount = getOption<number>(input, opt(o, "backSlats"));
  const backSlatWidth = getOption<number>(input, opt(o, "backSlatWidth"));
  const footRestWidth = getOption<number>(input, opt(o, "footrestWidth"));
  const footRestThickness = getOption<number>(input, opt(o, "footrestThickness"));
  const withBack = backStyle !== "none";

  const apronThickness = 18;
  // footRestWidth / footRestThickness 已從 options 讀入（line 50-51）
  // 正規榫卯比例：榫厚 = min(apron 厚 - 兩肩 12, 柱腳 1/3)；肩寬固定 6mm
  const MIN_SHOULDER = 6;
  const apronTenonLen = Math.round((legSize * 2) / 3);
  const apronTenonThick = Math.max(
    5,
    Math.min(apronThickness - 2 * MIN_SHOULDER, Math.round(legSize / 3)),
  );
  const apronTenonW = Math.max(12, apronWidth - 2 * MIN_SHOULDER);
  const frTenonThick = Math.max(
    5,
    Math.min(footRestThickness - 2 * MIN_SHOULDER, Math.round(legSize / 3)),
  );
  const frTenonW = Math.max(12, footRestWidth - 2 * MIN_SHOULDER);
  const seatTopTenonLen = seatThickness;
  const legTopTenonSize = Math.max(15, Math.round((legSize * 2) / 3));

  const seatY = height - seatThickness;
  const backHeight = withBack ? backHeightOpt : 0;
  const cornerPts = corners(length, width, legSize);

  // Leg shape mapping (same set as dining-table / dining-chair)
  const splayMm = 25;
  const hoofMm = 30;
  const legShapeFor = (c: { x: number; z: number }): Part["shape"] => {
    if (legShape === "tapered") return { kind: "tapered", bottomScale: 0.6 };
    if (legShape === "strong-taper") return { kind: "tapered", bottomScale: 0.4 };
    if (legShape === "inverted") return { kind: "tapered", bottomScale: 1.25 };
    if (legShape === "splayed") {
      return {
        kind: "splayed",
        dxMm: Math.sign(c.x) * splayMm,
        dzMm: Math.sign(c.z) * splayMm,
      };
    }
    if (legShape === "hoof") return { kind: "hoof", hoofMm, hoofScale: 1.3 };
    return undefined;
  };

  // 椅背 joinery 位置：頂橫木 + 板條 X 座標——legs / rail / apron / seat 都要引用
  const topRailH = withBack ? Math.min(50, Math.round(backHeight / 3)) : 0;
  const topRailThickness = 22;
  const topRailY = withBack ? seatY + backHeight - topRailH : 0;
  const topRailYCenter = topRailY + topRailH / 2;
  const topRailTenonW = withBack ? Math.max(12, topRailH - 10) : 0;
  const topRailTenonThick = 17;
  const slatXs: number[] = [];
  const slatThicknessConst = 16;
  const slatTenonLen = 12;
  const slatTenonW = (w: number) => Math.max(10, w - 10);
  const slatTenonT = Math.max(5, Math.round(slatThicknessConst / 3));
  if (withBack && backStyle === "slats" && backSlatCount > 0) {
    const availableW = length - legSize - 40;
    const pitch = availableW / (backSlatCount + 1);
    for (let i = 0; i < backSlatCount; i++) {
      slatXs.push(-availableW / 2 + pitch * (i + 1));
    }
  }

  const legs: Part[] = cornerPts.map((c, i) => {
    const isBack = c.z > 0 && withBack;
    const legTotalH = isBack ? seatY + backHeight : seatY;
    return {
      id: `leg-${i + 1}`,
      nameZh: isBack ? `後椅腳 ${i + 1}` : `椅腳 ${i + 1}`,
      material,
      grainDirection: "length",
      visible: { length: legSize, width: legSize, thickness: legTotalH },
      origin: { x: c.x, y: 0, z: c.z },
      shape: legShapeFor(c) ?? legEdgeShape(legEdge, legEdgeStyle),
      tenons: isBack ? [] : [
        {
          position: "top",
          type: "through-tenon",
          length: seatTopTenonLen,
          width: legTopTenonSize,
          thickness: legTopTenonSize,
        },
      ],
      mortises: [
        // 座板下牙板
        {
          origin: { x: 0, y: seatY - apronWidth - apronOffset, z: c.z > 0 ? -1 : 1 },
          depth: apronTenonLen,
          length: apronTenonW,
          width: apronTenonThick,
          through: false,
        },
        {
          origin: { x: c.x > 0 ? -1 : 1, y: seatY - apronWidth - apronOffset, z: 0 },
          depth: apronTenonLen,
          length: apronTenonW,
          width: apronTenonThick,
          through: false,
        },
        // 腳踏橫撐
        {
          origin: { x: 0, y: footrestHeight, z: c.z > 0 ? -1 : 1 },
          depth: apronTenonLen,
          length: frTenonW,
          width: frTenonThick,
          through: false,
        },
        {
          origin: { x: c.x > 0 ? -1 : 1, y: footrestHeight, z: 0 },
          depth: apronTenonLen,
          length: frTenonW,
          width: frTenonThick,
          through: false,
        },
        // 背腳：椅背頂橫木的母榫眼
        ...(isBack
          ? [
              {
                origin: { x: c.x > 0 ? -1 : 1, y: topRailYCenter, z: 0 },
                depth: apronTenonLen,
                length: topRailTenonW,
                width: topRailTenonThick,
                through: false,
              },
            ]
          : []),
      ],
    };
  });

  const seatPanel: Part = {
    id: "seat",
    nameZh: "座板",
    material,
    grainDirection: "length",
    visible: { length, width, thickness: seatThickness },
    origin: { x: 0, y: seatY, z: 0 },
    shape: seatEdgeShape(seatEdge, seatEdgeStyle),
    tenons: [],
    // 前腳通榫進來；後腳穿過座板高度範圍，要開大孔讓腳通過。
    // slats 從座板上面立起到頂橫木 → 座板上緣加 slat 母榫眼
    mortises: [
      ...cornerPts
        .filter((c) => !(withBack && c.z > 0))
        .map((c) => ({
          origin: { x: c.x, y: 0, z: c.z },
          depth: seatThickness,
          length: legTopTenonSize,
          width: legTopTenonSize,
          through: true,
        })),
      ...cornerPts
        .filter((c) => withBack && c.z > 0)
        .map((c) => ({
          origin: { x: c.x, y: 0, z: c.z },
          depth: seatThickness,
          length: legSize,
          width: legSize,
          through: true,
        })),
      ...slatXs.map((sx) => ({
        origin: { x: sx, y: seatThickness, z: width / 2 - legSize / 2 },
        depth: slatTenonLen,
        length: slatTenonW(backSlatWidth),
        width: slatTenonT,
        through: false,
      })),
    ],
  };

  const innerSpanX = length - legSize;
  const innerSpanZ = width - legSize;
  const ringY = seatY - apronWidth - apronOffset;
  const apronSides = [
    { key: "front", nameZh: "前牙板", visibleLength: innerSpanX, axis: "x" as const, origin: { x: 0, z: -(width / 2 - legSize / 2) } },
    { key: "back", nameZh: "後牙板", visibleLength: innerSpanX, axis: "x" as const, origin: { x: 0, z: width / 2 - legSize / 2 } },
    { key: "left", nameZh: "左牙板", visibleLength: innerSpanZ, axis: "z" as const, origin: { x: -(length / 2 - legSize / 2), z: 0 } },
    { key: "right", nameZh: "右牙板", visibleLength: innerSpanZ, axis: "z" as const, origin: { x: length / 2 - legSize / 2, z: 0 } },
  ];
  const aprons: Part[] = apronSides.map((s) => ({
    id: `apron-${s.key}`,
    nameZh: s.nameZh,
    material,
    grainDirection: "length",
    visible: { length: s.visibleLength, width: apronWidth, thickness: apronThickness },
    origin: { x: s.origin.x, y: ringY, z: s.origin.z },
    rotation: s.axis === "z" ? { x: Math.PI / 2, y: Math.PI / 2, z: 0 } : { x: Math.PI / 2, y: 0, z: 0 },
    shape: legEdgeShape(stretcherEdge, stretcherEdgeStyle),
    tenons: [
      { position: "start", type: "shouldered-tenon", length: apronTenonLen, width: apronTenonW, thickness: apronTenonThick },
      { position: "end", type: "shouldered-tenon", length: apronTenonLen, width: apronTenonW, thickness: apronTenonThick },
    ],
    // 後牙板：上緣加 slat 母榫眼（slat 從上面接入）。但 bar-stool 的 slat 落在
    // 座板上方不穿過 apron 區，這裡其實沒 slat 母——slats 接座板上面 + 頂橫木下面
    mortises: [],
  }));

  const footRests: Part[] = apronSides.map((s) => ({
    id: `footrest-${s.key}`,
    nameZh: `腳踏-${s.nameZh.replace("牙板", "")}`,
    material,
    grainDirection: "length",
    visible: { length: s.visibleLength, width: footRestWidth, thickness: footRestThickness },
    origin: { x: s.origin.x, y: footrestHeight, z: s.origin.z },
    rotation: s.axis === "z" ? { x: Math.PI / 2, y: Math.PI / 2, z: 0 } : { x: Math.PI / 2, y: 0, z: 0 },
    shape: legEdgeShape(stretcherEdge, stretcherEdgeStyle),
    tenons: [
      { position: "start", type: "blind-tenon", length: apronTenonLen, width: frTenonW, thickness: frTenonThick },
      { position: "end", type: "blind-tenon", length: apronTenonLen, width: frTenonW, thickness: frTenonThick },
    ],
    mortises: [],
  }));

  const parts: Part[] = [seatPanel, ...legs, ...aprons, ...footRests];

  if (withBack) {
    // 頂橫木一定有——鎖住後腳頂部。slat 從下方接入，下緣加 slat 母榫眼
    parts.push({
      id: "back-rail",
      nameZh: "椅背頂橫木",
      material,
      grainDirection: "length",
      visible: { length: length - legSize, width: topRailThickness, thickness: topRailH },
      origin: { x: 0, y: topRailY, z: width / 2 - legSize / 2 },
      tenons: [
        { position: "start", type: "blind-tenon", length: apronTenonLen, width: topRailTenonW, thickness: topRailTenonThick },
        { position: "end", type: "blind-tenon", length: apronTenonLen, width: topRailTenonW, thickness: topRailTenonThick },
      ],
      mortises: slatXs.map((sx) => ({
        origin: { x: sx, y: 0, z: 0 },
        depth: slatTenonLen,
        length: slatTenonW(backSlatWidth),
        width: slatTenonT,
        through: false,
      })),
    });
    if (backStyle === "slats" && backSlatCount > 0) {
      const slatLen = backHeight - topRailH;
      slatXs.forEach((xCenter, i) => {
        parts.push({
          id: `back-slat-${i + 1}`,
          nameZh: `椅背板條 ${i + 1}`,
          material,
          grainDirection: "length",
          visible: { length: slatLen, width: backSlatWidth, thickness: slatThicknessConst },
          origin: { x: xCenter, y: seatY, z: width / 2 - legSize / 2 },
          rotation: { x: 0, y: 0, z: Math.PI / 2 },
          tenons: [
            { position: "start", type: "blind-tenon", length: slatTenonLen, width: slatTenonW(backSlatWidth), thickness: slatTenonT },
            { position: "end", type: "blind-tenon", length: slatTenonLen, width: slatTenonW(backSlatWidth), thickness: slatTenonT },
          ],
          mortises: [],
        });
      });
    }
  }

  const design: FurnitureDesign = {
    id: `bar-stool-${length}x${width}x${height}`,
    category: "bar-stool",
    nameZh: "吧檯椅",
    overall: { length, width, thickness: height },
    parts,
    defaultJoinery: "blind-tenon",
    primaryMaterial: material,
    notes:
      `吧檯椅：高度 ${height}mm（建議 700–800）；腳樣式 ${legShapeLabel(legShape)}；` +
      `腳踏樣式：${footrestStyle === "four-sides" ? "四面腳踏" : footrestStyle === "front-only" ? "僅前面腳踏" : "金屬環"}（離地 ${footrestHeight}mm）；` +
      `${withBack ? "含短椅背" : "無椅背"}。座板與椅腳通榫，牙板/腳踏與椅腳半榫。${seatEdgeNote(seatEdge, seatEdgeStyle)}${legEdgeNote(legEdge, legEdgeStyle)}${stretcherEdgeNote(stretcherEdge, stretcherEdgeStyle)}`,
  };
  applyStandardChecks(design, { minLength: 300, minWidth: 300, minHeight: 600 });
  return design;
};
