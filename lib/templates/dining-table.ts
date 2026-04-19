import type { FurnitureTemplate } from "@/lib/types";
import { simpleTable } from "./_builders/simple-table";

export const diningTable: FurnitureTemplate = (input) =>
  simpleTable({
    category: "dining-table",
    nameZh: "餐桌",
    length: input.length,
    width: input.width,
    height: input.height,
    material: input.material,
    legSize: 70,
    apronWidth: 100,
    apronThickness: 28,
    withCenterStretcher: true,
    topThickness: 30,
    notes:
      "餐桌結構強度需求高：桌腳 70mm、牙板 100×28mm、桌面 30mm 厚。標配中央橫撐。",
  });
