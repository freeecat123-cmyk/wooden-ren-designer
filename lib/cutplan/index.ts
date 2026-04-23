import type { FurnitureDesign, MaterialId } from "@/lib/types";
import { buildCutPieces, materialZh } from "./group";
import { packLinear } from "./linear";
import { packSheet } from "./sheet";
import type { CutPiece, NestConfig, NestPlan } from "./types";

export * from "./types";
export { buildCutPieces };

/** 預設原料：台灣常見實木 4/6/8 尺 + 夾板 4×8 尺；鋸路 3mm；最小可用餘料 50mm；板材允許旋轉；庫存不限 */
export const DEFAULT_NEST_CONFIG: NestConfig = {
  lumberLengths: [1212, 1818, 2424],
  lumberCounts: {},
  sheetSize: { length: 2440, width: 1220 },
  sheetCount: null,
  kerf: 3,
  minWasteMm: 50,
  allowSheetRotate: true,
};

export function computeNestPlan(
  design: FurnitureDesign,
  config: NestConfig = DEFAULT_NEST_CONFIG,
): NestPlan {
  const { lumberGroups, sheetGroups } = buildCutPieces(design);
  // 套用全域旋轉設定（設計匯入時 allowRotate 預設 undefined）
  for (const pieces of sheetGroups.values()) {
    for (const p of pieces) {
      if (p.allowRotate === undefined) p.allowRotate = config.allowSheetRotate;
    }
  }
  return computePlanFromPieces(lumberGroups, sheetGroups, config);
}

/**
 * 低階版：直接餵已分組的零件 Map（給 client 編輯後重算用）。
 */
export function computePlanFromPieces(
  lumberGroups: Map<string, CutPiece[]>,
  sheetGroups: Map<string, CutPiece[]>,
  config: NestConfig,
): NestPlan {
  const linearGroups = Array.from(lumberGroups.entries())
    .map(([key, pieces]) => {
      const [material, widthStr, thicknessStr] = key.split("|");
      return packLinear(
        material as MaterialId,
        Number(widthStr),
        Number(thicknessStr),
        pieces,
        config.lumberLengths,
        config.lumberCounts,
        config.kerf,
        config.minWasteMm,
      );
    })
    .sort(
      (a, b) =>
        a.material.localeCompare(b.material) ||
        b.width * b.thickness - a.width * a.thickness,
    );

  // 板材庫存跨 group 共用：同 4×8 尺板不分材質/厚度算同一堆
  let sheetBudget: number | null =
    config.sheetCount !== null && config.sheetCount > 0 ? config.sheetCount : null;
  const sheetGroupsArr = Array.from(sheetGroups.entries())
    .map(([key, pieces]) => {
      const [billableStr, thicknessStr] = key.split("|");
      const billable = billableStr as "plywood" | "mdf";
      const repMaterialZh = materialZh(pieces[0]?.material ?? "");
      const g = packSheet(
        billable,
        repMaterialZh,
        Number(thicknessStr),
        pieces,
        config.sheetSize.length,
        config.sheetSize.width,
        config.kerf,
        config.minWasteMm,
        sheetBudget,
      );
      if (sheetBudget !== null) sheetBudget = Math.max(0, sheetBudget - g.bins.length);
      return g;
    })
    .sort((a, b) => a.billable.localeCompare(b.billable) || a.thickness - b.thickness);

  return { linearGroups, sheetGroups: sheetGroupsArr, config };
}
