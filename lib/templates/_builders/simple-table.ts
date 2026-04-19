import type {
  FurnitureCategory,
  FurnitureDesign,
  MaterialId,
  Part,
} from "@/lib/types";
import { corners } from "../_helpers";

export interface SimpleTableOpts {
  category: FurnitureCategory;
  nameZh: string;
  length: number;
  width: number;
  height: number;
  material: MaterialId;
  /** Auto-scaled by height if omitted */
  legSize?: number;
  topThickness?: number;
  apronWidth?: number;
  apronThickness?: number;
  /** Add a single mid-span stretcher (tie beam) between front and back aprons. */
  withCenterStretcher?: boolean;
  notes?: string;
}

/**
 * Generic 4-leg + apron + top table.
 * Used by bench, side-table, low-table, dining-table, desk.
 */
export function simpleTable(opts: SimpleTableOpts): FurnitureDesign {
  const {
    length,
    width,
    height,
    material,
    category,
    nameZh,
    withCenterStretcher = false,
  } = opts;

  const topThickness = opts.topThickness ?? 25;
  const legSize =
    opts.legSize ?? Math.max(35, Math.min(70, Math.round(height / 12)));
  const apronWidth = opts.apronWidth ?? 70;
  const apronThickness = opts.apronThickness ?? 22;
  const apronTenonLen = Math.round(legSize * 0.65);
  const legTopTenonLen = topThickness;

  const legHeight = height - topThickness;
  const apronY = legHeight - apronWidth - 20;

  const cornerPts = corners(length, width, legSize);

  // Top
  const topPanel: Part = {
    id: "top",
    nameZh: "桌面板",
    material,
    grainDirection: "length",
    visible: { length, width, thickness: topThickness },
    origin: { x: 0, y: legHeight, z: 0 },
    tenons: [],
    mortises: cornerPts.map((c) => ({
      origin: { x: c.x, y: 0, z: c.z },
      depth: topThickness,
      length: legSize,
      width: legSize,
      through: true,
    })),
  };

  // Legs
  const legs: Part[] = cornerPts.map((c, i) => ({
    id: `leg-${i + 1}`,
    nameZh: `桌腳 ${i + 1}`,
    material,
    grainDirection: "length",
    visible: { length: legSize, width: legSize, thickness: legHeight },
    origin: { x: c.x, y: 0, z: c.z },
    tenons: [
      {
        position: "top",
        type: "through-tenon",
        length: legTopTenonLen,
        width: legSize,
        thickness: legSize,
      },
    ],
    mortises: [
      {
        origin: { x: 0, y: apronY, z: c.z > 0 ? -1 : 1 },
        depth: apronTenonLen,
        length: apronWidth - 10,
        width: apronThickness - 5,
        through: false,
      },
      {
        origin: { x: c.x > 0 ? -1 : 1, y: apronY, z: 0 },
        depth: apronTenonLen,
        length: apronWidth - 10,
        width: apronThickness - 5,
        through: false,
      },
    ],
  }));

  // Aprons (4 sides)
  const apronInnerSpan = { x: length - legSize, z: width - legSize };
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

  const parts: Part[] = [topPanel, ...legs, ...aprons];

  // Optional center stretcher (for long tables)
  if (withCenterStretcher) {
    const stretcherWidth = 50;
    const stretcherThickness = 25;
    const stretcherTenonLen = apronTenonLen;
    parts.push({
      id: "center-stretcher",
      nameZh: "中央橫撐",
      material,
      grainDirection: "length",
      visible: {
        length: width - 2 * apronThickness - 20,
        width: stretcherWidth,
        thickness: stretcherThickness,
      },
      origin: { x: 0, y: apronY - 30, z: 0 },
      tenons: [
        {
          position: "start",
          type: "blind-tenon",
          length: stretcherTenonLen,
          width: stretcherWidth - 8,
          thickness: stretcherThickness - 5,
        },
        {
          position: "end",
          type: "blind-tenon",
          length: stretcherTenonLen,
          width: stretcherWidth - 8,
          thickness: stretcherThickness - 5,
        },
      ],
      mortises: [],
    });
  }

  return {
    id: `${category}-${length}x${width}x${height}`,
    category,
    nameZh,
    overall: { length, width, thickness: height },
    parts,
    defaultJoinery: "blind-tenon",
    primaryMaterial: material,
    notes:
      opts.notes ?? "桌腳與桌面通榫；牙板與桌腳半榫；長桌建議加中央橫撐防扭。",
  };
}
