/**
 * Part Drawing — predicate + isolation filter（Phase 1 Task 1）
 *
 * - needsPartDrawing(part): 是否要出獨立零件圖。純方料無榫無造型 → 不出。
 * - filterDesignForIsolation(design, partId): 回傳「只剩這個零件、recenter
 *   到 origin」的 design copy，供 <PartDrawing> + OrthoView isolatePartId 使用。
 *
 * Spec: docs/superpowers/specs/2026-05-16-part-drawings-design.md §1.1 / §5
 */

import type { Part, FurnitureDesign } from "@/lib/types";

/**
 * 一個零件是否需要獨立的製造圖（shop drawing）。
 *
 * 觸發條件（任一）：
 *   - 含榫頭（tenons.length > 0）
 *   - 含榫眼（mortises.length > 0）
 *   - 非方料造型（shape 存在且 kind !== "box"）
 *
 * 純方料 + 無榫 → 不出圖（材料單已涵蓋）。
 */
export function needsPartDrawing(part: Part): boolean {
  if (part.tenons.length > 0) return true;
  if (part.mortises.length > 0) return true;
  if (part.shape !== undefined && part.shape.kind !== "box") return true;
  return false;
}

/**
 * 回傳一個只包含指定 partId 的 design copy，並把該零件 recenter 到原點。
 *
 * 用途：<PartDrawing> 把單一零件丟給 OrthoView 渲染（OrthoView 會用整套
 * design 的 bounding box 算座標，這裡先把多餘 parts 拿掉、把原點放到 0,0,0
 * 讓三視圖以零件 local 座標為主）。
 *
 * 原 design 不被修改（純函式）。若 partId 找不到，原樣回傳。
 */
export function filterDesignForIsolation(
  design: FurnitureDesign,
  partId: string,
): FurnitureDesign {
  const part = design.parts.find((p) => p.id === partId);
  if (!part) return design;

  return {
    ...design,
    parts: [
      {
        ...part,
        origin: { x: 0, y: 0, z: 0 },
      },
    ],
  };
}
