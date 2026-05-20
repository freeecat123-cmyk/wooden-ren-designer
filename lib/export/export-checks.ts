import type { FurnitureDesign } from "@/lib/types";
import { BufferGeometry, Group, Mesh, Vector3 } from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/** 低於此值的零件在一般 FDM 印表機（0.4mm 噴嘴）幾乎印不出來 */
export const MIN_PRINTABLE_MM = 0.8;

export interface MinThicknessResult {
  /** 最薄零件縮放後的最小維度（mm）；無零件時為 Infinity */
  thinnestMm: number;
  /** 該零件中文名（nameZh 優先，否則 id）；無零件時為空字串 */
  partName: string;
}

/**
 * 找出設計中「最薄」的零件——取每個非 visual 零件三維中的最小值，
 * 全體再取最小，乘上匯出比例。用來提醒使用者選的比例會不會印不出來。
 */
export function analyzeMinThickness(
  design: FurnitureDesign,
  scale: number,
): MinThicknessResult {
  let thinnest = Infinity;
  let partName = "";
  for (const part of design.parts) {
    if (part.visual) continue;
    const dim = Math.min(
      part.visible.length,
      part.visible.thickness,
      part.visible.width,
    );
    if (dim < thinnest) {
      thinnest = dim;
      partName = part.nameZh || part.id;
    }
  }
  return { thinnestMm: thinnest * scale, partName };
}

/** 三角面面積小於此值視為退化面（zero-area） */
const DEGENERATE_AREA_EPS = 1e-6;

export interface GeometryValidation {
  ok: boolean;
  nanVertices: number;
  degenerateTris: number;
  /** 被「不等於 2 個三角面」共用的邊數——破洞或自交的徵兆 */
  nonManifoldEdges: number;
}

/**
 * 檢查單一零件 geometry 是否為水密流形實體。
 *
 * 重要：原生幾何（BoxGeometry 等）同一角點的頂點是分開存的，
 * 必須先 mergeVertices 依座標合併，否則每條邊都會被誤判成非流形。
 */
export function validateGeometry(geom: BufferGeometry): GeometryValidation {
  // 檢查 NaN 頂點——必須在 mergeVertices 前，因為 mergeVertices 會過濾掉 NaN
  const origPos = geom.getAttribute("position");
  let nanVertices = 0;
  for (let i = 0; i < origPos.count; i++) {
    if (
      Number.isNaN(origPos.getX(i)) ||
      Number.isNaN(origPos.getY(i)) ||
      Number.isNaN(origPos.getZ(i))
    ) {
      nanVertices++;
    }
  }

  // 為了拓撲檢查，複製幾何並只保留 position 屬性（mergeVertices 才會真的合併同位置的頂點）
  const posOnly = new BufferGeometry();
  posOnly.setAttribute("position", origPos);
  if (geom.getIndex()) {
    posOnly.setIndex(geom.getIndex());
  }

  const merged = mergeVertices(posOnly);
  const pos = merged.getAttribute("position");
  const index = merged.getIndex();

  const triCount = index ? index.count / 3 : pos.count / 3;
  const vi = (t: number, c: number): number =>
    index ? index.getX(t * 3 + c) : t * 3 + c;

  let degenerateTris = 0;
  const edgeCount = new Map<string, number>();
  const a = new Vector3();
  const b = new Vector3();
  const c = new Vector3();
  const ab = new Vector3();
  const ac = new Vector3();

  for (let t = 0; t < triCount; t++) {
    const i0 = vi(t, 0);
    const i1 = vi(t, 1);
    const i2 = vi(t, 2);
    a.fromBufferAttribute(pos, i0);
    b.fromBufferAttribute(pos, i1);
    c.fromBufferAttribute(pos, i2);
    const area = ab.subVectors(b, a).cross(ac.subVectors(c, a)).length() / 2;
    if (area < DEGENERATE_AREA_EPS) {
      degenerateTris++;
      continue; // 退化面不計入邊統計
    }
    const edges: Array<[number, number]> = [
      [i0, i1],
      [i1, i2],
      [i2, i0],
    ];
    for (const [u, v] of edges) {
      const key = u < v ? `${u}_${v}` : `${v}_${u}`;
      edgeCount.set(key, (edgeCount.get(key) ?? 0) + 1);
    }
  }

  let nonManifoldEdges = 0;
  for (const count of edgeCount.values()) {
    if (count !== 2) nonManifoldEdges++;
  }

  merged.dispose();
  posOnly.dispose();
  return {
    ok: nanVertices === 0 && degenerateTris === 0 && nonManifoldEdges === 0,
    nanVertices,
    degenerateTris,
    nonManifoldEdges,
  };
}

export interface GroupValidation {
  ok: boolean;
  badParts: Array<{ partName: string } & GeometryValidation>;
}

/**
 * 對一個已組好的 three.js Group 逐 mesh 跑 validateGeometry，
 * 回報所有不通過的零件。
 */
export function validateGroup(group: Group): GroupValidation {
  const badParts: GroupValidation["badParts"] = [];
  group.traverse((obj) => {
    const mesh = obj as Mesh;
    if (!mesh.isMesh) return;
    const v = validateGeometry(mesh.geometry as BufferGeometry);
    if (!v.ok) badParts.push({ partName: mesh.name || "(未命名零件)", ...v });
  });
  return { ok: badParts.length === 0, badParts };
}
