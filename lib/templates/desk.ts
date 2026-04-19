import type { FurnitureTemplate } from "@/lib/types";
import { simpleTable } from "./_builders/simple-table";

export const desk: FurnitureTemplate = (input) =>
  simpleTable({
    category: "desk",
    nameZh: "書桌",
    length: input.length,
    width: input.width,
    height: input.height,
    material: input.material,
    legSize: 55,
    apronWidth: 90,
    apronThickness: 25,
    withCenterStretcher: true,
    topThickness: 28,
    notes:
      "書桌：桌腳 55mm、牙板 90×25mm、桌面 28mm。可後續加抽屜（v2）。標配中央橫撐。",
  });
