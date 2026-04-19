import type { FurnitureTemplate } from "@/lib/types";
import { caseFurniture } from "./_builders/case-furniture";

export const chestOfDrawers: FurnitureTemplate = (input) => {
  // 每層抽屜約 200mm 高
  const drawerCount = Math.max(3, Math.round((input.height - 36) / 200));
  return caseFurniture({
    category: "chest-of-drawers",
    nameZh: "斗櫃",
    length: input.length,
    width: input.width,
    height: input.height,
    material: input.material,
    shelfCount: drawerCount - 1, // 抽屜分隔板
    drawerCount,
    panelThickness: 18,
    shelfThickness: 18,
    backThickness: 6,
    notes: `${drawerCount} 層抽屜斗櫃；抽屜需另配側拉滑軌或木製滑軌（見工具清單）。面板尺寸已扣除門縫。`,
  });
};
