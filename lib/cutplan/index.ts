import type { FurnitureDesign, MaterialId } from "@/lib/types";
import { buildCutPieces, materialZh } from "./group";
import { packLinear } from "./linear";
import { packSheet } from "./sheet";
import { packLumber2D } from "./lumber-2d";
import type { CutPiece, NestConfig, NestPlan } from "./types";

export * from "./types";
export { buildCutPieces };

/** 預設原料：台灣常見實木 4/6/8 尺 + 夾板 4×8 尺；鋸路 3mm；最小可用餘料 50mm；板材允許旋轉；庫存不限 */
export const DEFAULT_NEST_CONFIG: NestConfig = {
  lumberLengths: [1212, 1818, 2424],
  lumberCounts: {},
  lumberInventory: [],
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
  for (const pieces of sheetGroups.values()) {
    for (const p of pieces) {
      if (p.allowRotate === undefined) p.allowRotate = config.allowSheetRotate;
    }
  }
  return computePlanFromPieces(lumberGroups, sheetGroups, config);
}

/**
 * 低階版：直接餵已分組的零件 Map（給 client 編輯後重算用）。
 * lumberGroups 原本 key 是 "material|width|thickness"（嚴格寬度）；
 * 如果某 (material, thickness) 在 config.lumberInventory 有對應資料，
 * 會把那些 1D group 合併成一個 (material, thickness) 2D group 丟給 packLumber2D。
 */
export function computePlanFromPieces(
  lumberGroups: Map<string, CutPiece[]>,
  sheetGroups: Map<string, CutPiece[]>,
  config: NestConfig,
): NestPlan {
  // 1. 先決定哪些 (material, thickness) 走 2D 模式
  const invKeys = new Set<string>();
  for (const s of config.lumberInventory) {
    invKeys.add(`${s.material}|${s.thickness}`);
  }

  // 2. 切成 1D 用的 group（保留原 key）和 2D 用的 group（按 material|thickness 合併）
  const keep1D = new Map<string, CutPiece[]>();
  const merge2D = new Map<string, CutPiece[]>();
  for (const [key, pieces] of lumberGroups) {
    const [material, , thicknessStr] = key.split("|");
    const mtKey = `${material}|${thicknessStr}`;
    if (invKeys.has(mtKey)) {
      if (!merge2D.has(mtKey)) merge2D.set(mtKey, []);
      merge2D.get(mtKey)!.push(...pieces);
    } else {
      keep1D.set(key, pieces);
    }
  }

  const linearGroups = Array.from(keep1D.entries())
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

  const lumberInvGroups = Array.from(merge2D.entries())
    .map(([key, pieces]) => {
      const [material, thicknessStr] = key.split("|");
      return packLumber2D(
        material as MaterialId,
        Number(thicknessStr),
        pieces,
        config.lumberInventory,
        config.kerf,
        config.minWasteMm,
      );
    })
    .sort(
      (a, b) =>
        a.material.localeCompare(b.material) || a.thickness - b.thickness,
    );

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

  return { linearGroups, lumberInvGroups, sheetGroups: sheetGroupsArr, config };
}
