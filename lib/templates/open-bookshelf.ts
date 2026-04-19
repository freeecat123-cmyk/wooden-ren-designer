import type { FurnitureTemplate } from "@/lib/types";
import { caseFurniture } from "./_builders/case-furniture";

export const openBookshelf: FurnitureTemplate = (input) => {
  // 每層約 350mm 高，自動換算層數
  const shelfCount = Math.max(2, Math.round((input.height - 36) / 350) - 1);
  return caseFurniture({
    category: "open-bookshelf",
    nameZh: "開放書櫃",
    length: input.length,
    width: input.width,
    height: input.height,
    material: input.material,
    shelfCount,
    panelThickness: 18,
    shelfThickness: 18,
    backThickness: 6,
    notes: `${shelfCount + 2} 層開放式書櫃（含頂底板）；可調層板需另加金屬層板釘（v2）。`,
  });
};
