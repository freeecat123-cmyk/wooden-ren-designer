import type { FurnitureTemplate } from "@/lib/types";
import { simpleTable } from "./_builders/simple-table";

export const sideTable: FurnitureTemplate = (input) =>
  simpleTable({
    category: "side-table",
    nameZh: "邊桌 / 床頭櫃",
    length: input.length,
    width: input.width,
    height: input.height,
    material: input.material,
    legSize: 35,
    apronWidth: 60,
    notes:
      "床側收納用矮桌；可後續加單層抽屜（v2）。預設高 600mm 接近床墊面。",
  });
