import type {
  FurnitureDesign,
  FurnitureTemplate,
  OptionSpec,
  Part,
} from "@/lib/types";
import { getOption } from "@/lib/types";
import { corners } from "./_helpers";

export const barStoolOptions: OptionSpec[] = [
  { type: "number", key: "legSize", label: "椅腳粗 (mm)", defaultValue: 35, min: 20, max: 80, step: 1 },
  { type: "number", key: "seatThickness", label: "座板厚 (mm)", defaultValue: 28, min: 15, max: 60, step: 1 },
  { type: "number", key: "footrestHeight", label: "腳踏/下橫撐高 (mm)", defaultValue: 200, min: 50, max: 700, step: 10, help: "腳踏橫撐離地高度" },
  { type: "number", key: "apronWidth", label: "牙板高 (mm)", defaultValue: 50, min: 20, max: 150, step: 5 },
  { type: "number", key: "apronOffset", label: "牙板距座板 (mm)", defaultValue: 5, min: 0, max: 300, step: 5, help: "牙板頂緣往下退的距離" },
  { type: "checkbox", key: "withBack", label: "加椅背", defaultValue: false, help: "吧檯椅常見無背，可勾選加短椅背" },
];

/**
 * 吧檯椅（bar stool）
 * 高度 700–800mm，一圈腳踏橫撐在較低位置；可選加短椅背。
 */
export const barStool: FurnitureTemplate = (input): FurnitureDesign => {
  const { length, width, height, material } = input;
  const legSize = getOption<number>(input, barStoolOptions[0]);
  const seatThickness = getOption<number>(input, barStoolOptions[1]);
  const footrestHeight = getOption<number>(input, barStoolOptions[2]);
  const apronWidth = getOption<number>(input, barStoolOptions[3]);
  const apronOffset = getOption<number>(input, barStoolOptions[4]);
  const withBack = getOption<boolean>(input, barStoolOptions[5]);

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
  const backHeight = withBack ? 200 : 0;
  const cornerPts = corners(length, width, legSize);

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
    parts.push({
      id: "back-rail",
      nameZh: "椅背橫木",
      material,
      grainDirection: "length",
      visible: { length: length - legSize, width: 22, thickness: 50 },
      origin: { x: 0, y: seatY + backHeight - 50, z: width / 2 - legSize / 2 },
      tenons: [
        { position: "start", type: "blind-tenon", length: apronTenonLen, width: 40, thickness: 17 },
        { position: "end", type: "blind-tenon", length: apronTenonLen, width: 40, thickness: 17 },
      ],
      mortises: [],
    });
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
