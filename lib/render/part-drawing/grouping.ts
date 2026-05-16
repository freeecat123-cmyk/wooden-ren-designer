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
import { categorizePart, type PartCategory } from "@/lib/render/svg-views";

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

/**
 * Stable geometry hash. Identical hash → merge as ×N. Mirror parts get
 * different hashes (mortise/tenon X-position 或 origin.x 鏡像翻號就會差開）.
 *
 * 涵蓋欄位：
 *   - visible (L×W×T)
 *   - shape (kind + 全部參數，JSON serialize)
 *   - tenons (sorted by stringified signature)
 *   - mortises (sorted by stringified signature；含 origin.x/y/z 抓鏡像)
 *
 * 不考慮：part.id / nameZh / material / origin — 因為這些是「裝在哪」「叫什麼」
 * 而非「形狀本體」。原則：用同一張圖能照做出來的零件 hash 全等。
 *
 * Spec: docs/superpowers/specs/2026-05-16-part-drawings-design.md §2.1
 */
export function hashPart(part: Part): string {
  const tenons = part.tenons
    .map((t: any) =>
      [
        `T:${t.position ?? ""}`,
        `w:${t.offsetWidth ?? 0}`,
        `th:${t.offsetThickness ?? 0}`,
        `L:${t.length ?? 0}`,
        `W:${t.width ?? 0}`,
        // tenons 的厚度欄位是 thickness（不是 depth）；test data 用 depth 也支援
        `D:${t.thickness ?? t.depth ?? 0}`,
        `ty:${t.type ?? ""}`,
        `sh:${(t.shoulderOn ?? []).slice().sort().join(",")}`,
      ].join("|"),
    )
    .sort()
    .join(";");
  const mortises = part.mortises
    .map((m: any) =>
      [
        `M:${m.position ?? ""}`,
        // 真實 Mortise 有 origin.x/y/z；test data 用 offsetWidth 也支援
        `ox:${m.origin?.x ?? m.offsetWidth ?? 0}`,
        `oy:${m.origin?.y ?? 0}`,
        `oz:${m.origin?.z ?? m.offsetThickness ?? 0}`,
        `L:${m.length ?? 0}`,
        `W:${m.width ?? 0}`,
        `D:${m.depth ?? 0}`,
        `th:${m.through ? 1 : 0}`,
        `sp:${m.shape ?? "rect"}`,
      ].join("|"),
    )
    .sort()
    .join(";");
  return [
    `L:${part.visible.length}`,
    `W:${part.visible.width}`,
    `T:${part.visible.thickness}`,
    `S:${part.shape ? JSON.stringify(part.shape) : "box"}`,
    `t:${tenons}`,
    `m:${mortises}`,
  ].join("/");
}

export type PartDrawingGroup = {
  hash: string;
  parts: Part[];
  count: number;
  representative: Part;
  category: PartCategory;
};

/**
 * 排序順序：依 spec §3 結構角色排，「unknown 性質」的 misc 排最後。
 *
 * 對應 spec 列表 vs 實際 PartCategory enum：
 *   spec 1 case/panel/框        → "case"
 *   spec 2 leg/腳               → "leg"
 *   spec 3 apron/stretcher      → "apron"
 *   spec 4 drawer               → "drawer"
 *   spec 5 door                 → "door"
 *   spec 6 back/arm/椅背扶手     → "seat"（actual enum 把椅背/座板/扶手收進 seat）
 *   spec 7 hardware/五金        → 無 dedicated enum，併入 "misc"
 *   spec 8 unknown              → "misc"（categorizePart 的 fallback bucket）
 *
 * 額外：actual enum 多一個 "divider"（層板/分隔板），放在 case 之後比照框架元件處理。
 */
const CATEGORY_SORT_ORDER: PartCategory[] = [
  "case",
  "divider",
  "leg",
  "apron",
  "drawer",
  "door",
  "seat",
  "misc",
];

/**
 * Group parts by geometry hash. Mirror pairs (X-mortise/origin.x 差)
 * 自動分群（hash 已包含 origin.x）. Sorted by category（misc 永遠尾排）,
 * 同 category 內按 representative.id 字典序.
 *
 * Spec: §2 合併規則 / §3 排序
 */
export function groupPartsForDrawing(design: FurnitureDesign): PartDrawingGroup[] {
  const triggered = design.parts.filter(needsPartDrawing);
  const byHash = new Map<string, Part[]>();

  for (const part of triggered) {
    const h = hashPart(part);
    const list = byHash.get(h) ?? [];
    list.push(part);
    byHash.set(h, list);
  }

  const groups: PartDrawingGroup[] = [];
  for (const [hash, parts] of byHash) {
    const representative = parts[0];
    const category = categorizePart(representative.id);
    groups.push({
      hash,
      parts,
      count: parts.length,
      representative,
      category,
    });
  }

  groups.sort((a, b) => {
    const ai = CATEGORY_SORT_ORDER.indexOf(a.category);
    const bi = CATEGORY_SORT_ORDER.indexOf(b.category);
    const aIdx = ai === -1 ? CATEGORY_SORT_ORDER.length : ai;
    const bIdx = bi === -1 ? CATEGORY_SORT_ORDER.length : bi;
    if (aIdx !== bIdx) return aIdx - bIdx;
    return a.representative.id.localeCompare(b.representative.id);
  });

  return groups;
}
