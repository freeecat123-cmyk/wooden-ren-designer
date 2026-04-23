import type { FurnitureDesign, MaterialId } from "@/lib/types";
import { buildCutPieces, materialZh } from "./group";
import { packLinear } from "./linear";
import { packSheet } from "./sheet";
import type { NestConfig, NestPlan } from "./types";

export * from "./types";

/** 預設原料：台灣常見實木 4/6/8 尺 + 夾板 4×8 尺；鋸路 3mm */
export const DEFAULT_NEST_CONFIG: NestConfig = {
  lumberLengths: [1212, 1818, 2424],
  sheetSize: { length: 2440, width: 1220 },
  kerf: 3,
};

export function computeNestPlan(
  design: FurnitureDesign,
  config: NestConfig = DEFAULT_NEST_CONFIG,
): NestPlan {
  const { lumberGroups, sheetGroups } = buildCutPieces(design);

  const linearGroups = Array.from(lumberGroups.entries())
    .map(([key, pieces]) => {
      const [material, widthStr, thicknessStr] = key.split("|");
      return packLinear(
        material as MaterialId,
        Number(widthStr),
        Number(thicknessStr),
        pieces,
        config.lumberLengths,
        config.kerf,
      );
    })
    .sort(
      (a, b) =>
        a.material.localeCompare(b.material) ||
        b.width * b.thickness - a.width * a.thickness,
    );

  const sheetGroupsArr = Array.from(sheetGroups.entries())
    .map(([key, pieces]) => {
      const [billableStr, thicknessStr] = key.split("|");
      const billable = billableStr as "plywood" | "mdf";
      // 取第一件的主材當代表（同組通常都是同一主材）
      const repMaterialZh = materialZh(pieces[0]?.material ?? "");
      return packSheet(
        billable,
        repMaterialZh,
        Number(thicknessStr),
        pieces,
        config.sheetSize.length,
        config.sheetSize.width,
        config.kerf,
      );
    })
    .sort((a, b) => a.billable.localeCompare(b.billable) || a.thickness - b.thickness);

  return { linearGroups, sheetGroups: sheetGroupsArr, config };
}
