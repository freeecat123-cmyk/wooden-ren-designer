import { describe, it, expect } from "vitest";
import { getTemplate } from "@/lib/templates";
import type { FurnitureCatalogEntry } from "@/lib/templates";
import type { FurnitureCategory, FurnitureDesign, MaterialId, OptionSpec } from "@/lib/types";
import { buildPackPlan } from "./pack";

/**
 * 用範本預設值建一個 design。
 * entry.template 本身就是 builder 函式（不是帶 .build 的物件），
 * options 取 optionSchema 的 defaultValue —— 跟 scripts/audit-overlaps.ts 同一套。
 */
function buildDefaultDesign(category: FurnitureCategory): FurnitureDesign {
  const entry = getTemplate(category) as FurnitureCatalogEntry | undefined;
  if (!entry?.template) throw new Error(`找不到範本：${category}`);
  const options = (entry.optionSchema ?? []).reduce<Record<string, string | number | boolean>>(
    (acc, spec: OptionSpec) => {
      acc[spec.key] = spec.defaultValue;
      return acc;
    },
    {},
  );
  return entry.template({
    length: entry.defaults.length,
    width: entry.defaults.width,
    height: entry.defaults.height,
    material: "maple" as MaterialId,
    options,
  });
}

describe("buildPackPlan", () => {
  it("方凳：每個零件都有一列，凳腳落在 A3", () => {
    const plan = buildPackPlan(buildDefaultDesign("stool"));
    expect(plan.rows.length).toBeGreaterThan(0);
    const leg = plan.rows.find((r) => r.nameZh.includes("腳"));
    expect(leg?.placement?.paper.id).toBe("A3");
  });

  it("依紙張分組，同一種紙的零件收在同一組", () => {
    const plan = buildPackPlan(buildDefaultDesign("stool"));
    const total = Array.from(plan.byPaper.values()).reduce((s, a) => s + a.length, 0);
    const placeable = plan.rows.filter((r) => r.placement).length;
    expect(total).toBe(placeable);
  });

  it("書桌桌面板太大 → placement 為 null（退回零件圖）", () => {
    const plan = buildPackPlan(buildDefaultDesign("desk"));
    const topRow = plan.rows.find((r) => Math.max(r.wmm, r.hmm) > 1000);
    expect(topRow).toBeDefined();
    expect(topRow?.placement).toBeNull();
  });
});
