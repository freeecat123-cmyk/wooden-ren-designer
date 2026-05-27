/**
 * 26 個家具類別的中文標籤——獨立檔，**完全不 import 任何 template 函式或
 * optionSchema**，給 client component 共用「我只要顯示家具名稱」的場景。
 *
 * 為什麼不直接 `getTemplate(category)?.nameZh`：
 * `@/lib/templates` 是 barrel，re-exports 26 個 template 函式（總 ~17K LOC）+
 * 各自的 optionSchema。client component import getTemplate 會把整包都拉進
 * client bundle，純為了讀一個字串卻塞 100KB+ JS。labels.ts 是純資料 map，
 * tree-shake 後對 client bundle 影響趨近 0。
 *
 * 跟 lib/templates/index.ts 的 FURNITURE_CATALOG[].nameZh 必須保持同步。
 * 之後新增/改名 template 時兩邊都要動。
 */
import type { FurnitureCategory } from "@/lib/types";

export const CATEGORY_LABELS: Record<FurnitureCategory, string> = {
  stool: "方凳",
  bench: "長凳",
  "tea-table": "邊桌",
  "side-table": "床邊桌",
  "low-table": "矮桌",
  "open-bookshelf": "開放書櫃",
  "chest-of-drawers": "斗櫃",
  "chinese-cabinet": "中式方角櫃",
  "shoe-cabinet": "鞋櫃",
  "display-cabinet": "玻璃展示櫃",
  "dining-table": "餐桌",
  desk: "書桌/辦公桌",
  "dining-chair": "餐椅",
  wardrobe: "衣櫃",
  "bar-stool": "吧檯椅",
  "media-console": "電視櫃",
  nightstand: "床頭櫃",
  "round-stool": "圓凳",
  "round-tea-table": "圓茶几",
  "round-table": "圓餐桌",
  "pencil-holder": "筆筒",
  bookend: "書擋",
  "photo-frame": "相框",
  tray: "托盤",
  "dovetail-box": "木盒",
  "wine-rack": "紅酒架",
  bed: "床架",
  "coat-rack": "立式衣帽架",
};

export function getCategoryLabel(category: FurnitureCategory): string {
  return CATEGORY_LABELS[category] ?? category;
}

export const CATEGORY_LABELS_EN: Record<FurnitureCategory, string> = {
  stool: "Square stool",
  bench: "Bench",
  "tea-table": "Tea table",
  "side-table": "Side table",
  "low-table": "Low table",
  "open-bookshelf": "Open bookshelf",
  "chest-of-drawers": "Chest of drawers",
  "chinese-cabinet": "Ming-style cabinet",
  "shoe-cabinet": "Shoe cabinet",
  "display-cabinet": "Display cabinet",
  "dining-table": "Dining table",
  desk: "Desk",
  "dining-chair": "Dining chair",
  wardrobe: "Wardrobe",
  "bar-stool": "Bar stool",
  "media-console": "Media console",
  nightstand: "Nightstand",
  "round-stool": "Round stool",
  "round-tea-table": "Round tea table",
  "round-table": "Round dining table",
  "pencil-holder": "Pencil holder",
  bookend: "Bookend",
  "photo-frame": "Picture frame",
  tray: "Tray",
  "dovetail-box": "Dovetail box",
  "wine-rack": "Wine rack",
  bed: "Bed frame",
  "coat-rack": "Coat rack",
};

export function categoryLabel(category: FurnitureCategory, locale: string): string {
  if (locale === "en") return CATEGORY_LABELS_EN[category] ?? CATEGORY_LABELS[category] ?? category;
  return CATEGORY_LABELS[category] ?? category;
}
