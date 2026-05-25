/**
 * 模板「設計細節透視」畫廊
 *
 * 為每個模板掛載專屬細節截圖（鳩尾透視、椅背曲面、抽屜結構等）。
 * 截圖放在 public/showcase/[檔名].png，這裡用 registry 對應到 category。
 *
 * 加新截圖流程：
 *   1. 截圖丟進 public/showcase/
 *   2. 在這個 file 對應的 category 陣列 push 一筆 { src, label, desc }
 *   3. detail page 自動 render
 *
 * 多個模板共用同張圖 OK（例如所有櫃子共用 cabinet-internal-perspective.png）。
 */

import type { FurnitureCategory } from "../types";

export interface GalleryImage {
  /** 圖片路徑（相對 public/） */
  src: string;
  /** 標題（≤16 字） */
  label: string;
  /** 補述（≤40 字） */
  desc?: string;
}

const CABINET_INTERNAL: GalleryImage = {
  src: "/showcase/cabinet-internal-perspective.png",
  label: "櫃體內部透視",
  desc: "切到「隱藏面板」模式可以看見內部隔板、滑軌位置、層板結構，組裝前先在腦袋過一遍",
};

const BENCH_CURVED_BACK: GalleryImage = {
  src: "/showcase/bench-curved-back.png",
  label: "曲面靠背長凳",
  desc: "可選曲面椅背 + 直棍式靠背樣式，3D 透視即時看到組裝後的真實樣子",
};

const WARDROBE_VARIATIONS: GalleryImage = {
  src: "/showcase/wardrobe-variations.png",
  label: "衣櫃配置變化多",
  desc: "吊衣桿、抽屜、上層板、下方鞋格、頂櫃自由組合 — 同一支模板能長出 N 種衣櫃",
};

export const TEMPLATE_GALLERY: Partial<Record<FurnitureCategory, GalleryImage[]>> = {
  // === 櫃子類共用「櫃體內部透視」 ===
  wardrobe: [WARDROBE_VARIATIONS, CABINET_INTERNAL],
  "chest-of-drawers": [CABINET_INTERNAL],
  "shoe-cabinet": [CABINET_INTERNAL],
  "display-cabinet": [CABINET_INTERNAL],
  nightstand: [CABINET_INTERNAL],
  "media-console": [CABINET_INTERNAL],
  "open-bookshelf": [CABINET_INTERNAL],

  // === 椅凳類 ===
  bench: [BENCH_CURVED_BACK],
};

export function getGallery(
  category: FurnitureCategory,
): GalleryImage[] | undefined {
  const g = TEMPLATE_GALLERY[category];
  return g && g.length > 0 ? g : undefined;
}
