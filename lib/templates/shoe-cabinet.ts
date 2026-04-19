import type { FurnitureTemplate } from "@/lib/types";
import { caseFurniture } from "./_builders/case-furniture";

export const shoeCabinet: FurnitureTemplate = (input) => {
  // 每層約 200mm 高
  const shelfCount = Math.max(2, Math.round((input.height - 36) / 200) - 1);
  return caseFurniture({
    category: "shoe-cabinet",
    nameZh: "鞋櫃",
    length: input.length,
    width: input.width,
    height: input.height,
    material: input.material,
    shelfCount,
    doorCount: 2,
    doorType: "wood",
    panelThickness: 18,
    shelfThickness: 18,
    backThickness: 6,
    notes: `${shelfCount} 層內部層板 + 2 扇門板；層板可用層板釘做可調式；門板需配隱藏鉸鏈。`,
  });
};
