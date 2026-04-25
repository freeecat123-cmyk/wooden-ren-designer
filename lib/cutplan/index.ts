import type { FurnitureDesign, MaterialId } from "@/lib/types";
import { buildCutPieces, materialZh } from "./group";
import { buildSharedPool, packGroup } from "./pack";
import { packGroupGuillotine } from "./pack-guillotine";
import type { CutPiece, NestConfig, NestPlan, StockItem } from "./types";

export * from "./types";
export { buildCutPieces, materialZh };

/** 預設：沒庫存，鋸路 3mm，最小餘料 50mm，板材允許旋轉，刀線式排料（最省料） */
export const DEFAULT_NEST_CONFIG: NestConfig = {
  inventory: [],
  kerf: 3,
  minWasteMm: 50,
  allowSheetRotate: true,
  strategy: "guillotine",
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
  // 合併為 (kind, material?) → pieces[]
  // 不再按厚度拆組——實體庫存一塊板可同時產出不同厚度零件（由刨床工序決定成品厚度）
  type GroupKey = { kind: StockItem["kind"]; material?: MaterialId };
  const groupMap = new Map<string, { key: GroupKey; pieces: CutPiece[] }>();

  for (const [, pieces] of lumberGroups) {
    for (const p of pieces) {
      const gk = `solid|${p.material}`;
      if (!groupMap.has(gk)) {
        groupMap.set(gk, {
          key: { kind: "solid", material: p.material },
          pieces: [],
        });
      }
      groupMap.get(gk)!.pieces.push(p);
    }
  }
  for (const [k, pieces] of sheetGroups) {
    const [billable] = k.split("|");
    const gk = `${billable}|_`;
    if (!groupMap.has(gk)) {
      groupMap.set(gk, {
        key: { kind: billable as "plywood" | "mdf" },
        pieces: [],
      });
    }
    groupMap.get(gk)!.pieces.push(...pieces);
  }

  // 共享 pool：庫存不綁厚度；同一筆庫存的 count 跨 group 共享消耗
  const sharedPool = buildSharedPool(config.inventory);

  // packGroup 不再需要 thickness 參數（傳 0 佔位）
  const strat = config.strategy ?? "ffd";
  const groups = Array.from(groupMap.values())
    .map(({ key, pieces }) =>
      strat === "guillotine"
        ? packGroupGuillotine(
            key.kind,
            key.material,
            0,
            pieces,
            sharedPool,
            config.kerf,
            config.minWasteMm,
            config.allowSheetRotate,
          )
        : packGroup(
            key.kind,
            key.material,
            0,
            pieces,
            sharedPool,
            config.kerf,
            config.minWasteMm,
            config.allowSheetRotate,
            strat,
          ),
    )
    .sort((a, b) => {
      const kindOrder = { solid: 0, plywood: 1, mdf: 2 };
      if (a.kind !== b.kind) return kindOrder[a.kind] - kindOrder[b.kind];
      if (a.material && b.material && a.material !== b.material)
        return a.material.localeCompare(b.material);
      return 0;
    });

  return { groups, config };
}
