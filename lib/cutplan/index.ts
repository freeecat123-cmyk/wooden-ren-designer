import type { FurnitureDesign, MaterialId } from "@/lib/types";
import { buildCutPieces, materialZh } from "./group";
import { buildSharedPool, packGroup } from "./pack";
import type { CutPiece, NestConfig, NestPlan, StockItem } from "./types";

export * from "./types";
export { buildCutPieces, materialZh };

/** 預設：沒庫存，鋸路 3mm，最小餘料 50mm，板材允許旋轉 */
export const DEFAULT_NEST_CONFIG: NestConfig = {
  inventory: [],
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
 * 低階：直接餵 piece maps（client 編輯後重算用）。
 * lumberGroups 原 key 是 "material|width|thickness"——這裡只取 material + thickness。
 */
export function computePlanFromPieces(
  lumberGroups: Map<string, CutPiece[]>,
  sheetGroups: Map<string, CutPiece[]>,
  config: NestConfig,
): NestPlan {
  // 合併為 (kind, material?, thickness) → pieces[]
  type GroupKey = { kind: StockItem["kind"]; material?: MaterialId; thickness: number };
  const groupMap = new Map<string, { key: GroupKey; pieces: CutPiece[] }>();

  for (const [k, pieces] of lumberGroups) {
    const [material, , thicknessStr] = k.split("|");
    const gk = `solid|${material}|${thicknessStr}`;
    if (!groupMap.has(gk)) {
      groupMap.set(gk, {
        key: { kind: "solid", material: material as MaterialId, thickness: Number(thicknessStr) },
        pieces: [],
      });
    }
    groupMap.get(gk)!.pieces.push(...pieces);
  }
  for (const [k, pieces] of sheetGroups) {
    const [billable, thicknessStr] = k.split("|");
    const gk = `${billable}|_|${thicknessStr}`;
    if (!groupMap.has(gk)) {
      groupMap.set(gk, {
        key: {
          kind: billable as "plywood" | "mdf",
          thickness: Number(thicknessStr),
        },
        pieces: [],
      });
    }
    groupMap.get(gk)!.pieces.push(...pieces);
  }

  // 共享 pool：庫存不綁厚度，所以同一筆庫存的 count 會跨 group 共享消耗
  const sharedPool = buildSharedPool(config.inventory);

  // 依厚度降冪排（厚先排，厚零件佔空間大、先佔用有限庫存比較合理）
  const orderedGroups = Array.from(groupMap.values()).sort(
    (a, b) => b.key.thickness - a.key.thickness,
  );

  const groups = orderedGroups
    .map(({ key, pieces }) =>
      packGroup(
        key.kind,
        key.material,
        key.thickness,
        pieces,
        sharedPool,
        config.kerf,
        config.minWasteMm,
        config.allowSheetRotate,
      ),
    )
    .sort((a, b) => {
      const kindOrder = { solid: 0, plywood: 1, mdf: 2 };
      if (a.kind !== b.kind) return kindOrder[a.kind] - kindOrder[b.kind];
      if (a.material && b.material && a.material !== b.material)
        return a.material.localeCompare(b.material);
      return a.thickness - b.thickness;
    });

  return { groups, config };
}
