import type { FurnitureTemplate } from "@/lib/types";
import { simpleTable } from "./_builders/simple-table";

export const bench: FurnitureTemplate = (input) =>
  simpleTable({
    category: "bench",
    nameZh: "長凳",
    length: input.length,
    width: input.width,
    height: input.height,
    material: input.material,
    legSize: 40,
    apronWidth: 80,
    withCenterStretcher: input.length > 1200,
    notes:
      "長凳腳粗 40mm 較穩；超過 1.2m 自動加中央橫撐防扭。可坐 2 人。",
  });
