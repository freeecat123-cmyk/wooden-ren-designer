import type { FurnitureTemplate } from "@/lib/types";
import { simpleTable } from "./_builders/simple-table";

export const lowTable: FurnitureTemplate = (input) =>
  simpleTable({
    category: "low-table",
    nameZh: "矮桌",
    length: input.length,
    width: input.width,
    height: input.height,
    material: input.material,
    legSize: 45,
    apronWidth: 70,
    withCenterStretcher: input.length > 900,
    notes:
      "和室矮桌、地板桌；高度約 350mm 適合席地而坐。長度 >900mm 自動加中央橫撐。",
  });
