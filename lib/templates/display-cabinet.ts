import type { FurnitureTemplate } from "@/lib/types";
import { caseFurniture } from "./_builders/case-furniture";

export const displayCabinet: FurnitureTemplate = (input) => {
  // 玻璃展示櫃每層約 350mm
  const shelfCount = Math.max(3, Math.round((input.height - 36) / 350) - 1);
  return caseFurniture({
    category: "display-cabinet",
    nameZh: "玻璃展示櫃",
    length: input.length,
    width: input.width,
    height: input.height,
    material: input.material,
    shelfCount,
    doorCount: 2,
    doorType: "glass",
    panelThickness: 20,
    shelfThickness: 18,
    backThickness: 8,
    notes: `${shelfCount} 層展示空間 + 2 扇玻璃門框；玻璃需另裁；門框內側開槽嵌入玻璃；建議用 5mm 強化玻璃。`,
  });
};
