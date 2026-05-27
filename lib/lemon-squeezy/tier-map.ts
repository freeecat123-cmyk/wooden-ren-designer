/**
 * 單模板買斷分階：把 27 家具 + 2 工具 (ceiling/floor) 分成 3 階對應 LS 三個 single
 * payment product。對應 Lemon Squeezy 商店設定（2026-05-27）：
 *   Single Template - Basic   $4.99
 *   Single Template - Pro     $9.99
 *   Single Template - Studio  $14.99
 *
 * raised-floor 還沒進 ToolId union，目前單買僅限 ceiling / floor。
 */

import type { FurnitureCategory } from "@/lib/types";
import type { ToolId } from "@/lib/pricing/tool-unlock";

export type TemplateTier = "basic" | "pro" | "studio";

export type SellableTemplate =
  | { kind: "furniture"; category: FurnitureCategory }
  | { kind: "tool"; tool: ToolId };

const BASIC: ReadonlySet<string> = new Set<string>([
  // 小物件 / 簡單凳類
  "stool",
  "round-stool",
  "bar-stool",
  "pencil-holder",
  "photo-frame",
  "tray",
  "dovetail-box",
]);

const PRO: ReadonlySet<string> = new Set<string>([
  // 中型家具
  "bench",
  "low-table",
  "tea-table",
  "round-tea-table",
  "side-table",
  "coat-rack",
  "wine-rack",
  "nightstand",
  "dining-chair",
  "open-bookshelf",
  "round-table",
]);

const STUDIO_FURNITURE: ReadonlySet<string> = new Set<string>([
  // 大型家具
  "dining-table",
  "desk",
  "bed",
  "chest-of-drawers",
  "chinese-cabinet",
  "display-cabinet",
  "media-console",
  "shoe-cabinet",
  "wardrobe",
]);

const STUDIO_TOOLS: ReadonlySet<string> = new Set<string>([
  // 裝潢工具
  "ceiling",
  "floor",
]);

export function getTemplateTier(item: SellableTemplate): TemplateTier {
  const key = item.kind === "furniture" ? item.category : item.tool;
  if (BASIC.has(key)) return "basic";
  if (PRO.has(key)) return "pro";
  if (item.kind === "furniture" && STUDIO_FURNITURE.has(key)) return "studio";
  if (item.kind === "tool" && STUDIO_TOOLS.has(key)) return "studio";
  // 不在表內 = 預設 pro（保守、不會過便宜）
  return "pro";
}

export const TIER_PRICE_USD: Record<TemplateTier, number> = {
  basic: 4.99,
  pro: 9.99,
  studio: 14.99,
};

export function isSellableFurniture(category: string): boolean {
  return BASIC.has(category) || PRO.has(category) || STUDIO_FURNITURE.has(category);
}

export function isSellableTool(tool: string): boolean {
  return STUDIO_TOOLS.has(tool);
}
