import { describe, it, expect } from "vitest";
import { getTemplate } from "@/lib/templates";
import type { FurnitureCatalogEntry } from "@/lib/templates";
import type { FurnitureCategory, FurnitureDesign, MaterialId, OptionSpec } from "@/lib/types";
import { buildPackPlan } from "./pack";
import { deriveMortisesByPart } from "@/lib/export/derived-mortises";
import { partMachiningFaces } from "@/lib/export/mortise-faces";

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

/**
 * 多加工面 —— 舊版只印面積最大的那一面，全 catalog 291 個榫孔靜默消失。
 * 這幾條是那個 bug 的迴歸鎖。
 */
describe("每個加工面各一張樣板", () => {
  it("方凳凳腳：兩張樣板，四個榫孔全在", () => {
    const design = buildDefaultDesign("stool");
    const plan = buildPackPlan(design);
    const legRows = plan.rows.filter((r) => r.nameZh.includes("凳腳 1"));
    expect(legRows).toHaveLength(2);
    expect(legRows.map((r) => r.partNo)).toEqual(["P-01a", "P-01b"]);
    expect(new Set(legRows.map((r) => r.faceLabelZh))).toEqual(new Set(["正面", "右端"]));
    expect(legRows.every((r) => r.faceCount === 2)).toBe(true);

    // 凳腳實際上就是 4 個榫眼：正面 榫孔1/榫孔3、右端 榫孔2/榫孔4。
    // 這裡原本斷言 8，是把反推母榫產生的重複孔也算進去了（每個真孔旁邊都有一個
    // 座標重合的反推分身）。pickTemplateFaces 已改成逐孔去重、真孔優先，所以是 4。
    const sheets = Array.from(plan.byPaper.values())
      .flat()
      .filter((s) => legRows.some((r) => r.partNo === s.row.partNo));
    expect(sheets).toHaveLength(2);

    const part = design.parts.find((p) => p.id === "leg-1")!;
    const realFaces = partMachiningFaces(part, []);
    const totalHoles = realFaces.reduce((s, f) => s + f.holes.length, 0);
    expect(totalHoles).toBe(4); // 正面 2（榫孔1、榫孔3）+ 右端 2（榫孔2、榫孔4）

    const drawn = sheets.reduce(
      (s, x) => s + (x.svg.match(/data-mark="center-cross"/g) ?? []).length,
      0,
    );
    expect(drawn).toBe(totalHoles);
  });

  /**
   * 「底板」是面積平手的代表案例：頂面 2 孔、底面 6 孔、尺寸一模一樣。
   * 舊版 `>` 嚴格大於平手不換人，留住排序第一的頂面 → 6 個孔全丟。
   * （底面的 6 個是真母榫；頂面的 2 個只有反推母榫有——那是側板插進底板頂面的
   *   接合，範本沒建母榫，正是反推存在的理由，去重時要保留。）
   *
   * 斗櫃預設 800×450 超過面板類的 A2 上限（594×420）兩面都退回零件圖，
   * 所以孔的實際渲染改用同款、尺寸塞得下的床頭櫃底板驗。
   */
  it("底板：面積平手時 6 孔的底面排在前面（不是 2 孔的頂面）", () => {
    for (const category of ["chest-of-drawers", "nightstand"] as const) {
      const rows = buildPackPlan(buildDefaultDesign(category)).rows
        .filter((r) => r.nameZh === "底板");
      expect(rows).toHaveLength(2);
      expect(rows[0].faceLabelZh).toBe("底面");
      expect(rows[0].partNo.endsWith("a")).toBe(true);
      expect(rows[1].faceLabelZh).toBe("頂面");
      expect(rows[1].partNo.endsWith("b")).toBe(true);
      expect(rows[0].wmm).toBeCloseTo(rows[1].wmm, 6); // 前提：面積真的平手
      expect(rows[0].hmm).toBeCloseTo(rows[1].hmm, 6);
    }
  });

  it("床頭櫃底板：6 孔的那一面真的印出 6 個孔中心", () => {
    const plan = buildPackPlan(buildDefaultDesign("nightstand"));
    const sheets = Array.from(plan.byPaper.values())
      .flat()
      .filter((s) => s.row.nameZh === "底板");
    expect(sheets).toHaveLength(2);
    const crosses = sheets.map((s) => (s.svg.match(/data-mark="center-cross"/g) ?? []).length);
    expect(Math.max(...crosses)).toBe(6);
    expect(crosses.reduce((a, b) => a + b, 0)).toBe(8); // 底面 6（真母榫）+ 頂面 2（只有反推）
  });

  it("單一加工面的零件維持 P-01 這種不帶尾碼的件號", () => {
    const plan = buildPackPlan(buildDefaultDesign("stool"));
    const single = plan.rows.filter((r) => r.faceCount === 1);
    expect(single.length).toBeGreaterThan(0);
    for (const r of single) expect(r.partNo).toMatch(/^P-\d{2}$/);
  });

  it("byPaper 的樣板數 = 有 placement 的列數（每一面各一張，一張都不能少）", () => {
    for (const category of ["stool", "chest-of-drawers", "dining-chair"] as const) {
      const plan = buildPackPlan(buildDefaultDesign(category));
      const total = Array.from(plan.byPaper.values()).reduce((s, a) => s + a.length, 0);
      expect(total).toBe(plan.rows.filter((r) => r.placement).length);
    }
  });
});
