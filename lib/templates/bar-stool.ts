import type {
  FurnitureDesign,
  FurnitureTemplate,
  OptionSpec,
  Part,
} from "@/lib/types";
import { getOption, opt } from "@/lib/types";
import { corners } from "./_helpers";

export const barStoolOptions: OptionSpec[] = [
  { group: "leg", type: "select", key: "legShape", label: "椅腳樣式", defaultValue: "box", choices: [
    { value: "box", label: "方直腳" },
    { value: "tapered", label: "錐形腳（下方收窄）" },
    { value: "strong-taper", label: "方錐漸縮（大幅下收）" },
    { value: "inverted", label: "倒錐腳（下方更粗）" },
    { value: "splayed", label: "斜腳（整支外傾）" },
    { value: "hoof", label: "馬蹄腳（底部外撇）" },
  ] },
  { group: "leg", type: "number", key: "legSize", label: "椅腳粗 (mm)", defaultValue: 35, min: 20, max: 80, step: 1 },
  { group: "top", type: "number", key: "seatThickness", label: "座板厚 (mm)", defaultValue: 28, min: 15, max: 60, step: 1 },
  { group: "stretcher", type: "number", key: "footrestHeight", label: "腳踏/下橫撐高 (mm)", defaultValue: 200, min: 50, max: 700, step: 10, help: "腳踏橫撐離地高度" },
  { group: "apron", type: "number", key: "apronWidth", label: "牙板高 (mm)", defaultValue: 50, min: 20, max: 150, step: 5 },
  { group: "apron", type: "number", key: "apronOffset", label: "牙板距座板 (mm)", defaultValue: 5, min: 0, max: 300, step: 5, help: "牙板頂緣往下退的距離" },
  { group: "back", type: "select", key: "backStyle", label: "椅背樣式", defaultValue: "none", choices: [
    { value: "none", label: "無椅背" },
    { value: "rail", label: "短橫木（一根橫木）" },
    { value: "slats", label: "直條式（N 根垂直板條）" },
  ] },
  { group: "back", type: "number", key: "backHeight", label: "椅背高 (mm)", defaultValue: 200, min: 80, max: 500, step: 10, help: "從座板上緣到椅背頂" },
  { group: "back", type: "number", key: "backSlats", label: "直條數（直條式用）", defaultValue: 3, min: 1, max: 8, step: 1 },
  { group: "back", type: "number", key: "backSlatWidth", label: "直條寬 (mm)", defaultValue: 40, min: 15, max: 150, step: 5 },
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
  const footrestHeight = getOption<number>(input, opt(o, "footrestHeight"));
  const apronWidth = getOption<number>(input, opt(o, "apronWidth"));
  const apronOffset = getOption<number>(input, opt(o, "apronOffset"));
  const backStyle = getOption<string>(input, opt(o, "backStyle"));
  const backHeightOpt = getOption<number>(input, opt(o, "backHeight"));
  const backSlatCount = getOption<number>(input, opt(o, "backSlats"));
  const backSlatWidth = getOption<number>(input, opt(o, "backSlatWidth"));
  const withBack = backStyle !== "none";

  const apronThickness = 18;
  const footRestWidth = 30;
  const footRestThickness = 22;
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
      shape: legShapeFor(c),
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
    tenons: [],
    mortises: cornerPts
      .filter((c) => !(withBack && c.z > 0))
      .map((c) => ({
        origin: { x: c.x, y: 0, z: c.z },
        depth: seatThickness,
        length: legTopTenonSize,
        width: legTopTenonSize,
        through: true,
      })),
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
    tenons: [
      { position: "start", type: "shouldered-tenon", length: apronTenonLen, width: apronTenonW, thickness: apronTenonThick },
      { position: "end", type: "shouldered-tenon", length: apronTenonLen, width: apronTenonW, thickness: apronTenonThick },
    ],
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
    tenons: [
      { position: "start", type: "blind-tenon", length: apronTenonLen, width: frTenonW, thickness: frTenonThick },
      { position: "end", type: "blind-tenon", length: apronTenonLen, width: frTenonW, thickness: frTenonThick },
    ],
    mortises: [],
  }));

  const parts: Part[] = [seatPanel, ...legs, ...aprons, ...footRests];

  if (withBack) {
    const topRailH = Math.min(50, Math.round(backHeight / 3));
    // 頂橫木一定有——鎖住後腳頂部
    parts.push({
      id: "back-rail",
      nameZh: "椅背頂橫木",
      material,
      grainDirection: "length",
      visible: { length: length - legSize, width: 22, thickness: topRailH },
      origin: { x: 0, y: seatY + backHeight - topRailH, z: width / 2 - legSize / 2 },
      tenons: [
        { position: "start", type: "blind-tenon", length: apronTenonLen, width: Math.max(12, topRailH - 10), thickness: 17 },
        { position: "end", type: "blind-tenon", length: apronTenonLen, width: Math.max(12, topRailH - 10), thickness: 17 },
      ],
      mortises: [],
    });
    if (backStyle === "slats" && backSlatCount > 0) {
      const slatThickness = 16;
      const availableW = length - legSize - 40;
      const pitch = availableW / (backSlatCount + 1);
      const slatLen = backHeight - topRailH;
      for (let i = 0; i < backSlatCount; i++) {
        const xCenter = -availableW / 2 + pitch * (i + 1);
        parts.push({
          id: `back-slat-${i + 1}`,
          nameZh: `椅背板條 ${i + 1}`,
          material,
          grainDirection: "length",
          visible: { length: slatLen, width: backSlatWidth, thickness: slatThickness },
          origin: { x: xCenter, y: seatY, z: width / 2 - legSize / 2 },
          rotation: { x: 0, y: 0, z: Math.PI / 2 },
          tenons: [
            { position: "start", type: "blind-tenon", length: 12, width: Math.max(10, backSlatWidth - 10), thickness: Math.max(5, Math.round(slatThickness / 3)) },
            { position: "end", type: "blind-tenon", length: 12, width: Math.max(10, backSlatWidth - 10), thickness: Math.max(5, Math.round(slatThickness / 3)) },
          ],
          mortises: [],
        });
      }
    }
  }

  return {
    id: `bar-stool-${length}x${width}x${height}`,
    category: "bar-stool",
    nameZh: "吧檯椅",
    overall: { length, width, thickness: height },
    parts,
    defaultJoinery: "blind-tenon",
    primaryMaterial: material,
    notes: `吧檯椅：高度 ${height}mm（建議 700–800）；腳踏離地 ${footrestHeight}mm；${withBack ? "含短椅背" : "無椅背"}。座板與椅腳通榫，牙板/腳踏與椅腳半榫。`,
  };
};
