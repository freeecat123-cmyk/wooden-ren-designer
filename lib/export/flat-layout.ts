import { BufferGeometry, Group, Mesh, MeshBasicMaterial } from "three";
import type { FurnitureDesign } from "@/lib/types";
import { partExportGeometry } from "./three-d-export";

/** 攤平排版零件間隔（mm，縮放前） */
export const LAYOUT_GAP_MM = 8;
/** 虛擬列印床寬度（mm）——只決定 shelf packing 何時換列，不阻擋超寬件 */
export const LAYOUT_BED_MM = 250;

export interface PackItem {
  /** footprint X 寬（mm） */
  w: number;
  /** footprint Z 深（mm） */
  d: number;
}

export interface PackPos {
  /** 中心 X（mm） */
  x: number;
  /** 中心 Z（mm） */
  z: number;
}

/**
 * Shelf packing：矩形 footprint 由左至右排，cursor 超過 bedWidth 換列。
 * 較長邊大的先排（較穩）。回傳陣列順序對應輸入順序。
 */
export function packShelves(
  items: PackItem[],
  bedWidth: number,
  gap: number,
): PackPos[] {
  const order = items
    .map((_, i) => i)
    .sort(
      (a, b) =>
        Math.max(items[b].w, items[b].d) - Math.max(items[a].w, items[a].d),
    );
  const pos: PackPos[] = new Array(items.length);
  let cursorX = 0;
  let rowZ = 0;
  let rowDepth = 0;
  for (const i of order) {
    const it = items[i];
    // 此列已有件、且再放會超過床寬 → 換列
    if (cursorX > 0 && cursorX + it.w > bedWidth) {
      rowZ += rowDepth + gap;
      cursorX = 0;
      rowDepth = 0;
    }
    pos[i] = { x: cursorX + it.w / 2, z: rowZ + it.d / 2 };
    cursorX += it.w + gap;
    rowDepth = Math.max(rowDepth, it.d);
  }
  return pos;
}

export interface FlatDims {
  /** 攤平後 footprint X 長度（mm） */
  footprintX: number;
  /** 攤平後 footprint Z 長度（mm） */
  footprintZ: number;
  /** 攤平後高度＝最薄維度，沿 Y（mm） */
  height: number;
}

/**
 * 把零件 geometry 就地旋轉成「最薄維度沿 Y 軸（朝上）」的攤平姿態。
 * 旋轉一律 90° 的整數倍。回傳攤平後的 XZ footprint 與高度。
 *
 * 注意：忽略零件在家具裡的裝配 rotation——攤平是製造姿態，只看 geometry 本身。
 */
export function orientFlat(geom: BufferGeometry): FlatDims {
  geom.computeBoundingBox();
  const bb = geom.boundingBox!;
  const sx = bb.max.x - bb.min.x;
  const sy = bb.max.y - bb.min.y;
  const sz = bb.max.z - bb.min.z;
  if (sx <= sy && sx <= sz) {
    // X 最薄 → 繞 Z 轉 +90°：+X 軸轉到 +Y
    geom.rotateZ(Math.PI / 2);
  } else if (sz <= sy && sz <= sx) {
    // Z 最薄 → 繞 X 轉 -90°：+Z 軸轉到 +Y
    geom.rotateX(-Math.PI / 2);
  }
  // Y 最薄 → 已是攤平姿態，不旋轉
  geom.computeBoundingBox();
  const b = geom.boundingBox!;
  return {
    footprintX: b.max.x - b.min.x,
    footprintZ: b.max.z - b.min.z,
    height: b.max.y - b.min.y,
  };
}

/**
 * 建出「攤平排版」的零件 Group——每件攤平躺平、shelf packing 排在虛擬列印床上，
 * 全部底面坐 Z=0。供 downloadFlatLayoutSTL 匯出單一 STL 用。
 *
 * 與 buildGroup（組裝姿態）並存、互不影響。
 */
export function buildFlatLayoutGroup(
  design: FurnitureDesign,
  scale: number,
): Group {
  const root = new Group();
  const mat = new MeshBasicMaterial();

  // 1) 每件建幾何 + 攤平姿態
  const entries: Array<{ geom: BufferGeometry; dims: FlatDims; name: string }> = [];
  for (const part of design.parts) {
    if (part.visual) continue;
    const geom = partExportGeometry(part);
    const dims = orientFlat(geom);
    entries.push({ geom, dims, name: part.nameZh || part.id });
  }

  // 2) shelf packing
  const positions = packShelves(
    entries.map((e) => ({ w: e.dims.footprintX, d: e.dims.footprintZ })),
    LAYOUT_BED_MM,
    LAYOUT_GAP_MM,
  );

  // 3) 擺放：每件中心對齊排版座標、底面坐 Y=0
  for (let i = 0; i < entries.length; i++) {
    const { geom, name } = entries[i];
    geom.computeBoundingBox();
    const bb = geom.boundingBox!;
    const cx = (bb.min.x + bb.max.x) / 2;
    const cz = (bb.min.z + bb.max.z) / 2;
    const mesh = new Mesh(geom, mat);
    mesh.name = name;
    mesh.position.set(positions[i].x - cx, -bb.min.y, positions[i].z - cz);
    root.add(mesh);
  }

  // Y up → Z up：用 +90°（local +Y → world +Z），讓攤平件坐在列印床上方
  // （Z≥0）。buildGroup 的組裝姿態用 -90°，攤平要的是「躺在床上」故相反。
  root.rotation.x = Math.PI / 2;
  root.scale.setScalar(scale);
  root.updateMatrixWorld(true);
  return root;
}
