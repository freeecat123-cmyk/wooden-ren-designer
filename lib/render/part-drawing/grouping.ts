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
import { categorizePart, type PartCategory } from "@/lib/render/categorize-part";

/**
 * 一個零件是否需要獨立的製造圖（shop drawing）。
 *
 * 觸發條件（任一）：
 *   - 含榫頭（tenons.length > 0）
 *   - 含榫眼（mortises.length > 0）
 *   - 非方料造型（shape 存在且 kind !== "box"）
 *   - joineryView 覆寫了非 box shape（bookend / photo-frame 等 45° miter 板）
 *   - visual === "glass"（玻璃片獨立列以方便下料 / 玻璃廠採購）
 *   - categorizePart 判定為主結構（case/divider/drawer/door/apron/seat）—
 *     床板條 / 隔板 / 主板等都列出（純方料也要進零件圖，dedup ×N 顯示）
 *
 * 不會出圖（材料單已涵蓋，零件圖只標獨立件）：
 *   - leg / misc 類純方料且無榫無造型（例：吊衣桿、小五金、無接合的支撐塊）
 *
 * Spec: docs/superpowers/specs/2026-05-16-part-drawings-design.md §1.1
 * + FX3 patch（2026-05-18）：主面板 / 隔板 / 玻璃補上
 */
export function needsPartDrawing(part: Part): boolean {
  if (part.tenons.length > 0) return true;
  if (part.mortises.length > 0) return true;
  if (part.shape !== undefined && part.shape.kind !== "box") return true;
  // joineryView shape：bookend base/back 等 45° miter 板（part.shape 是 box，但
  // 榫接版有 mitered-corner shape）—— 零件圖該示意斜切細節。
  const jvShape = part.joineryView?.shape;
  if (jvShape !== undefined && jvShape.kind !== "box") return true;
  // 玻璃片（display-cabinet / photo-frame）：3D 不計才但下料/玻璃廠採購要列。
  if (part.visual === "glass") return true;
  // 主結構分類：case（頂底側背板）、divider（層板 / 分隔板）、drawer / door /
  // apron / seat（slat / 椅背板）——這些就算純方料無榫也要出圖。
  const cat = categorizePart(part.id);
  if (cat === "case" || cat === "divider" || cat === "drawer" || cat === "door" || cat === "apron" || cat === "seat") {
    return true;
  }
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
 * Stable geometry hash. Identical hash → merge as ×N.
 *
 * **FX3 patch (2026-05-18)：鏡像件合併**——同尺寸 4 隻桌腳、左右對稱側板、12 條
 * 床板，工匠手上拿到的圖一樣（只是 X 翻號裝），不該拆 P-02~P-05 浪費紙。
 * 做法：tenon 的 offsetWidth/offsetThickness、mortise 的 origin.x/z、shape 內
 * 的 dx/dz 類欄位都取絕對值 normalize，sign 翻號的 mirror pair 自然 hash 全等。
 *
 * 涵蓋欄位：
 *   - visible (L×W×T)
 *   - shape (kind + 全部數值參數 abs-normalize)
 *   - tenons (sorted；offsetWidth/Thickness 取絕對值)
 *   - mortises (sorted；origin.x/z 取絕對值)
 *
 * 不考慮：part.id / nameZh / material / origin — 因為這些是「裝在哪」「叫什麼」
 * 而非「形狀本體」。原則：用同一張圖能照做出來的零件 hash 全等。
 *
 * Spec: docs/superpowers/specs/2026-05-16-part-drawings-design.md §2.1（FX3 改）
 */
function normalizeShape(shape: Part["shape"]): string {
  if (!shape) return "box";
  // 把 shape 內所有 sign-bearing 欄位取絕對值（dx/dz/corner sign 等）。
  // shape.kind 跟其他離散參數保持原樣。
  const SIGN_KEYS = new Set([
    "dxMm", "dzMm",          // splayed / splayed-tapered
    "x", "y", "z",            // legAxis 等向量
  ]);
  const norm: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(shape)) {
    if (SIGN_KEYS.has(k) && typeof v === "number") {
      norm[k] = Math.abs(v);
    } else {
      norm[k] = v;
    }
  }
  return JSON.stringify(norm);
}

// FX3：normalize 鏡像對稱字面值——"left"/"right" 對 mirror pair 只是裝配方向差，
// 圖面是同一張。"start"/"end" 對棒材是兩端但榫頭幾何同 → 也算 mirror。
// 保留 "top"/"bottom" 因為這是垂直功能差（不是鏡像）。
function mirrorNormSide(side: string): string {
  if (side === "left" || side === "right") return "side";
  if (side === "start" || side === "end") return "end";
  return side;
}

export function hashPart(part: Part): string {
  const tenons = part.tenons
    .map((t: any) =>
      [
        `T:${mirrorNormSide(t.position ?? "")}`,
        // FX3：offsetWidth/Thickness 取絕對值——4 隻腳的 top tenon 只差 ±sign
        // (legInset > 0 時 tenon 朝中心偏)，鏡像配對該合併。
        `w:${Math.abs(t.offsetWidth ?? 0)}`,
        `th:${Math.abs(t.offsetThickness ?? 0)}`,
        `L:${t.length ?? 0}`,
        `W:${t.width ?? 0}`,
        // tenons 的厚度欄位是 thickness（不是 depth）；test data 用 depth 也支援
        `D:${t.thickness ?? t.depth ?? 0}`,
        `ty:${t.type ?? ""}`,
        // shoulderOn 也要 normalize：mirror leg shoulderOn=[top,bottom,left] vs
        // [top,bottom,right] 圖面同一張。
        `sh:${(t.shoulderOn ?? []).map(mirrorNormSide).slice().sort().join(",")}`,
      ].join("|"),
    )
    .sort()
    .join(";");
  const mortises = part.mortises
    .map((m: any) =>
      [
        `M:${mirrorNormSide(m.position ?? "")}`,
        // FX3：origin.x/z 取絕對值——legShape="box" 4 腳的 mortise.origin.x/z
        // 只差 ±sign（c.x>0?-INSET:INSET），鏡像配對該合併到同一張圖。
        // origin.y 不取絕對值（垂直高度不是鏡像，是真實位置差）。
        `ox:${Math.abs(m.origin?.x ?? m.offsetWidth ?? 0)}`,
        `oy:${m.origin?.y ?? 0}`,
        `oz:${Math.abs(m.origin?.z ?? m.offsetThickness ?? 0)}`,
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
    `S:${normalizeShape(part.shape)}`,
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
