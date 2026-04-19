import type {
  FurnitureDesign,
  FurnitureTemplate,
  Part,
} from "@/lib/types";
import { corners } from "./_helpers";

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

  const seatThickness = 25;
  const legSize = 35;
  const apronWidth = 60;
  const apronThickness = 20;
  const seatHeight = 450; // 椅面高，固定
  const backHeight = height - seatHeight; // 椅背高度
  const apronTenonLen = Math.round(legSize * 0.6);
  const seatTopTenonLen = seatThickness;
  const slatThickness = 18;
  const slatWidth = 60;

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
            y: seatHeight - seatThickness - apronWidth - 5,
            z: c.z > 0 ? -1 : 1,
          },
          depth: apronTenonLen,
          length: apronWidth - 10,
          width: apronThickness - 5,
          through: false,
        },
        // 座面下牙板 Z 向
        {
          origin: {
            x: c.x > 0 ? -1 : 1,
            y: seatHeight - seatThickness - apronWidth - 5,
            z: 0,
          },
          depth: apronTenonLen,
          length: apronWidth - 10,
          width: apronThickness - 5,
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

  // 4 座面下牙板
  const apronInnerSpan = { x: length - legSize, z: width - legSize };
  const apronY = seatHeight - seatThickness - apronWidth - 5;
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
        type: "blind-tenon",
        length: apronTenonLen,
        width: apronWidth - 10,
        thickness: apronThickness - 5,
      },
      {
        position: "end",
        type: "blind-tenon",
        length: apronTenonLen,
        width: apronWidth - 10,
        thickness: apronThickness - 5,
      },
    ],
    mortises: [],
  }));

  // 椅背頂橫木（連接後 2 椅腳）
  const backTopRail: Part = {
    id: "back-top-rail",
    nameZh: "椅背頂橫木",
    material,
    grainDirection: "length",
    visible: { length: length - legSize, width: 50, thickness: 22 },
    origin: { x: 0, y: height - 60, z: width / 2 - legSize / 2 },
    tenons: [
      {
        position: "start",
        type: "blind-tenon",
        length: apronTenonLen,
        width: 40,
        thickness: 17,
      },
      {
        position: "end",
        type: "blind-tenon",
        length: apronTenonLen,
        width: 40,
        thickness: 17,
      },
    ],
    mortises: [],
  };

  // 2 椅背板條
  const slats: Part[] = [-1, 1].map((side) => ({
    id: side < 0 ? "back-slat-left" : "back-slat-right",
    nameZh: side < 0 ? "左椅背板條" : "右椅背板條",
    material,
    grainDirection: "length",
    visible: { length: backHeight - 80, width: slatWidth, thickness: slatThickness },
    origin: {
      x: (side * (length - legSize - slatWidth - 40)) / 4,
      y: seatHeight + (backHeight - 80) / 2,
      z: width / 2 - legSize / 2,
    },
    tenons: [
      {
        position: "top",
        type: "blind-tenon",
        length: 15,
        width: slatWidth - 8,
        thickness: slatThickness - 4,
      },
      {
        position: "bottom",
        type: "blind-tenon",
        length: 15,
        width: slatWidth - 8,
        thickness: slatThickness - 4,
      },
    ],
    mortises: [],
  }));

  return {
    id: `dining-chair-${length}x${width}x${height}`,
    category: "dining-chair",
    nameZh: "餐椅",
    overall: { length, width, thickness: height },
    parts: [seatPanel, ...legs, ...aprons, backTopRail, ...slats],
    defaultJoinery: "blind-tenon",
    primaryMaterial: material,
    notes:
      "前椅腳通榫接座板；後椅腳延伸成椅背支柱；牙板與椅腳半榫；椅背板條上下半榫接頂橫木與後牙板。後腳於圖面以直料呈現，實作建議依樣板鋸出 10–15° 後仰曲線以提升坐感。",
  };
};
