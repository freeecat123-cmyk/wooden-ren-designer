import type {
  FurnitureDesign,
  FurnitureTemplate,
  OptionSpec,
  Part,
} from "@/lib/types";
import { getOption } from "@/lib/types";
import { corners } from "./_helpers";

export const diningChairOptions: OptionSpec[] = [
  { type: "number", key: "legSize", label: "椅腳粗 (mm)", defaultValue: 35, min: 20, max: 120, step: 1 },
  { type: "number", key: "seatThickness", label: "座板厚 (mm)", defaultValue: 25, min: 12, max: 60, step: 1 },
  { type: "number", key: "seatHeight", label: "坐高 (mm)", defaultValue: 450, min: 150, max: 900, step: 10, help: "地面到座板上緣，一般 440–460" },
  { type: "number", key: "apronWidth", label: "牙板高 (mm)", defaultValue: 60, min: 30, max: 200, step: 5 },
  { type: "number", key: "backSlats", label: "椅背板條數", defaultValue: 2, min: 0, max: 10, step: 1, help: "設 0 則只有頂橫木，無直條" },
  { type: "number", key: "slatWidth", label: "板條寬 (mm)", defaultValue: 60, min: 15, max: 200, step: 5 },
  { type: "number", key: "apronOffset", label: "牙板距座板 (mm)", defaultValue: 5, min: 0, max: 150, step: 5, help: "牙板頂緣往下退的距離" },
  { type: "checkbox", key: "withLowerStretcher", label: "加下橫撐（H形）", defaultValue: false, help: "在椅腳下方約 1/4 處加一圈橫撐，餐椅結構更穩" },
  { type: "number", key: "backTopRailHeight", label: "椅背頂橫木高 (mm)", defaultValue: 50, min: 20, max: 180, step: 5 },
];

/**
 * 餐椅（dining-chair）
 *
 * 結構（簡化版）：
 *  - 1 × 座板
 *  - 4 × 椅腳（前 2 短至座面，後 2 延伸至椅背頂）
 *  - 4 × 座面下牙板（半榫接椅腳）
 *  - 1 × 椅背頂橫木（連接後 2 椅腳上端）
 *  - 2 × 椅背板條（直立，半榫接座面後牙板與頂橫木）
 *
 * 已知簡化：後腳以直料表示。實際舒適餐椅會有後仰曲線（10–15°），需後腳上半段
 * 後傾或鋸成 S 形。SVG/3D 渲染目前以 axis-aligned box 為主，無法表現曲線；
 * 製作時請依工序文件以樣板鋸出後腳曲線後再鑿榫眼。
 */
export const diningChair: FurnitureTemplate = (input): FurnitureDesign => {
  const { length, width, height, material } = input;

  const legSize = getOption<number>(input, diningChairOptions[0]);
  const seatThickness = getOption<number>(input, diningChairOptions[1]);
  const seatHeight = getOption<number>(input, diningChairOptions[2]);
  const apronWidth = getOption<number>(input, diningChairOptions[3]);
  const slatCount = getOption<number>(input, diningChairOptions[4]);
  const slatWidth = getOption<number>(input, diningChairOptions[5]);
  const apronOffset = getOption<number>(input, diningChairOptions[6]);
  const withLowerStretcher = getOption<boolean>(input, diningChairOptions[7]);
  const topRailHeightOpt = getOption<number>(input, diningChairOptions[8]);
  const apronThickness = 20;
  const backHeight = height - seatHeight;
  // 正規比例：榫長 = 柱腳 2/3；榫厚 = 母件 1/3；榫肩 = 上下各 1/4
  const apronTenonLen = Math.round((legSize * 2) / 3);
  const apronTenonThick = Math.max(6, Math.round(apronThickness / 3));
  const apronTenonW = Math.max(15, apronWidth - Math.round(apronWidth / 4));
  const seatTopTenonLen = seatThickness;
  const slatThickness = 18;

  const cornerPts = corners(length, width, legSize);

  // 4 椅腳（前 2 短，後 2 長）
  const legs: Part[] = cornerPts.map((c, i) => {
    const isBack = c.z > 0;
    const legTotalH = isBack ? height : seatHeight;
    return {
      id: `leg-${i + 1}`,
      nameZh: isBack ? `後椅腳 ${i + 1}` : `前椅腳 ${i + 1}`,
      material,
      grainDirection: "length",
      visible: { length: legSize, width: legSize, thickness: legTotalH },
      origin: { x: c.x, y: 0, z: c.z },
      tenons: isBack
        ? [] // 後腳頂端接椅背頂橫木（橫木有公榫，不在腳上）
        : [
            {
              position: "top",
              type: "through-tenon",
              length: seatTopTenonLen,
              width: legSize,
              thickness: legSize,
            },
          ],
      mortises: [
        // 座面下牙板 X 向
        {
          origin: {
            x: 0,
            y: seatHeight - seatThickness - apronWidth - apronOffset,
            z: c.z > 0 ? -1 : 1,
          },
          depth: apronTenonLen,
          length: apronTenonW,
          width: apronTenonThick,
          through: false,
        },
        // 座面下牙板 Z 向
        {
          origin: {
            x: c.x > 0 ? -1 : 1,
            y: seatHeight - seatThickness - apronWidth - apronOffset,
            z: 0,
          },
          depth: apronTenonLen,
          length: apronTenonW,
          width: apronTenonThick,
          through: false,
        },
      ],
    };
  });

  // 座板（前腳通榫進來）
  const seatPanel: Part = {
    id: "seat",
    nameZh: "座板",
    material,
    grainDirection: "length",
    visible: { length, width, thickness: seatThickness },
    origin: { x: 0, y: seatHeight - seatThickness, z: 0 },
    tenons: [],
    mortises: cornerPts
      .filter((c) => c.z < 0) // 只有前 2 腳穿過座板
      .map((c) => ({
        origin: { x: c.x, y: 0, z: c.z },
        depth: seatThickness,
        length: legSize,
        width: legSize,
        through: true,
      })),
  };

  // 4 座面下牙板 —— body 延伸到腳中心
  const apronInnerSpan = { x: length - legSize, z: width - legSize };
  void backHeight;
  const apronY = seatHeight - seatThickness - apronWidth - apronOffset;
  const apronSides = [
    {
      key: "front",
      nameZh: "前牙板",
      visibleLength: apronInnerSpan.x,
      axis: "x" as const,
      origin: { x: 0, z: -(width / 2 - legSize / 2) },
    },
    {
      key: "back",
      nameZh: "後牙板",
      visibleLength: apronInnerSpan.x,
      axis: "x" as const,
      origin: { x: 0, z: width / 2 - legSize / 2 },
    },
    {
      key: "left",
      nameZh: "左牙板",
      visibleLength: apronInnerSpan.z,
      axis: "z" as const,
      origin: { x: -(length / 2 - legSize / 2), z: 0 },
    },
    {
      key: "right",
      nameZh: "右牙板",
      visibleLength: apronInnerSpan.z,
      axis: "z" as const,
      origin: { x: length / 2 - legSize / 2, z: 0 },
    },
  ];
  const aprons: Part[] = apronSides.map((s) => ({
    id: `apron-${s.key}`,
    nameZh: s.nameZh,
    material,
    grainDirection: "length",
    visible: {
      length: s.visibleLength,
      width: apronWidth,
      thickness: apronThickness,
    },
    origin: { x: s.origin.x, y: apronY, z: s.origin.z },
    rotation: s.axis === "z"
      ? { x: Math.PI / 2, y: Math.PI / 2, z: 0 }
      : { x: Math.PI / 2, y: 0, z: 0 },
    tenons: [
      {
        position: "start",
        type: "shouldered-tenon",
        length: apronTenonLen,
        width: apronTenonW,
        thickness: apronTenonThick,
      },
      {
        position: "end",
        type: "shouldered-tenon",
        length: apronTenonLen,
        width: apronTenonW,
        thickness: apronTenonThick,
      },
    ],
    mortises: [],
  }));

  // 椅背頂橫木（連接後 2 椅腳）
  const topRailHeight = topRailHeightOpt;
  const topRailThickness = 22;
  const topRailY = height - topRailHeight;
  const backTopRail: Part = {
    id: "back-top-rail",
    nameZh: "椅背頂橫木",
    material,
    grainDirection: "length",
    visible: { length: length - legSize, width: topRailThickness, thickness: topRailHeight },
    origin: { x: 0, y: topRailY, z: width / 2 - legSize / 2 },
    tenons: [
      {
        position: "start",
        type: "blind-tenon",
        length: apronTenonLen,
        width: Math.max(15, topRailHeight - Math.round(topRailHeight / 4)),
        thickness: Math.max(6, Math.round(topRailThickness / 3)),
      },
      {
        position: "end",
        type: "blind-tenon",
        length: apronTenonLen,
        width: Math.max(15, topRailHeight - Math.round(topRailHeight / 4)),
        thickness: Math.max(6, Math.round(topRailThickness / 3)),
      },
    ],
    mortises: [],
  };

  // 下橫撐（H形，增加結構強度）
  const lowerStretchers: Part[] = [];
  if (withLowerStretcher) {
    const lowerY = Math.round(seatHeight * 0.25);
    const lowerW = 35;
    const lowerT = 18;
    const lowerTenon = Math.round((legSize * 2) / 3);
    const lowerTenonThick = Math.max(6, Math.round(lowerT / 3));
    const lowerTenonW = Math.max(12, lowerW - Math.round(lowerW / 4));
    const sides = [
      { id: "ls-front", nameZh: "前下橫撐", visibleLength: apronInnerSpan.x, axis: "x" as const, origin: { x: 0, z: -(width / 2 - legSize / 2) } },
      { id: "ls-back", nameZh: "後下橫撐", visibleLength: apronInnerSpan.x, axis: "x" as const, origin: { x: 0, z: width / 2 - legSize / 2 } },
      { id: "ls-left", nameZh: "左下橫撐", visibleLength: apronInnerSpan.z, axis: "z" as const, origin: { x: -(length / 2 - legSize / 2), z: 0 } },
      { id: "ls-right", nameZh: "右下橫撐", visibleLength: apronInnerSpan.z, axis: "z" as const, origin: { x: length / 2 - legSize / 2, z: 0 } },
    ];
    for (const s of sides) {
      lowerStretchers.push({
        id: s.id,
        nameZh: s.nameZh,
        material,
        grainDirection: "length",
        visible: { length: s.visibleLength, width: lowerW, thickness: lowerT },
        origin: { x: s.origin.x, y: lowerY, z: s.origin.z },
        rotation: s.axis === "z" ? { x: Math.PI / 2, y: Math.PI / 2, z: 0 } : { x: Math.PI / 2, y: 0, z: 0 },
        tenons: [
          { position: "start", type: "blind-tenon", length: lowerTenon, width: lowerTenonW, thickness: lowerTenonThick },
          { position: "end", type: "blind-tenon", length: lowerTenon, width: lowerTenonW, thickness: lowerTenonThick },
        ],
        mortises: [],
      });
    }
  }

  // N 椅背板條（均勻分布）
  const slats: Part[] = [];
  if (slatCount > 0) {
    const availableWidth = length - legSize - 40;
    const slotPitch = availableWidth / (slatCount + 1);
    for (let i = 0; i < slatCount; i++) {
      const xCenter = -availableWidth / 2 + slotPitch * (i + 1);
      slats.push({
        id: `back-slat-${i + 1}`,
        nameZh: `椅背板條 ${i + 1}`,
        material,
        grainDirection: "length",
        visible: { length: topRailY - seatHeight, width: slatWidth, thickness: slatThickness },
        origin: {
          x: xCenter,
          y: seatHeight,
          z: width / 2 - legSize / 2,
        },
        rotation: { x: 0, y: 0, z: Math.PI / 2 },
        tenons: [
          { position: "top", type: "blind-tenon", length: 15, width: Math.max(10, slatWidth - Math.round(slatWidth / 4)), thickness: Math.max(5, Math.round(slatThickness / 3)) },
          { position: "bottom", type: "blind-tenon", length: 15, width: Math.max(10, slatWidth - Math.round(slatWidth / 4)), thickness: Math.max(5, Math.round(slatThickness / 3)) },
        ],
        mortises: [],
      });
    }
  }

  return {
    id: `dining-chair-${length}x${width}x${height}`,
    category: "dining-chair",
    nameZh: "餐椅",
    overall: { length, width, thickness: height },
    parts: [seatPanel, ...legs, ...aprons, ...lowerStretchers, backTopRail, ...slats],
    defaultJoinery: "blind-tenon",
    primaryMaterial: material,
    notes:
      "前椅腳通榫接座板；後椅腳延伸成椅背支柱；牙板與椅腳半榫；椅背板條上下半榫接頂橫木與後牙板。後腳於圖面以直料呈現，實作建議依樣板鋸出 10–15° 後仰曲線以提升坐感。",
  };
};
