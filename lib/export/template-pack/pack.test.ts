import { describe, it, expect } from "vitest";
import { getTemplate } from "@/lib/templates";
import type { FurnitureCatalogEntry } from "@/lib/templates";
import type { FurnitureCategory, FurnitureDesign, MaterialId, OptionSpec } from "@/lib/types";
import { buildPackPlan } from "./pack";
import { deriveMortisesByPart } from "@/lib/export/derived-mortises";
import { partMachiningFaces } from "@/lib/export/mortise-faces";
import { planA4Tiles, CALIBRATION_TEST_LINE_MM } from "./tiling";

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

describe("buildPackPlan mode=\"a4\"（A4 拼接模式）", () => {
  it("不傳 mode 或傳 \"printshop\" 時行為完全不變（既有 87 個測試守的就是這個）", () => {
    const design = buildDefaultDesign("stool");
    const a = buildPackPlan(design);
    const b = buildPackPlan(design, "printshop");
    expect(a.rows.map((r) => r.partNo)).toEqual(b.rows.map((r) => r.partNo));
    expect(a.rows.every((r) => r.tiling === undefined)).toBe(true);
    expect(Array.from(a.byPaper.keys())).toEqual(Array.from(b.byPaper.keys()));
  });

  it("方凳凳腳：a4 模式落在 A4、拼接張數跟 planA4Tiles 算出來的一致，一律不旋轉", () => {
    const plan = buildPackPlan(buildDefaultDesign("stool"), "a4");
    const leg = plan.rows.find((r) => r.nameZh.includes("凳腳") && r.faceLabelZh === "正面");
    expect(leg?.placement?.paper.id).toBe("A4");
    expect(leg?.placement?.angleDeg).toBe(0);
    expect(leg?.tiling).toBeDefined();
    const expected = planA4Tiles(leg!.wmm, leg!.hmm);
    expect(expected).not.toBeNull();
    expect(leg?.tiling).toEqual({ landscape: expected!.landscape, cols: expected!.cols, rows: expected!.rows });
    expect(leg!.tiling!.cols * leg!.tiling!.rows).toBeGreaterThan(1); // 前提：凳腳真的要拼多張，不然這條測試沒測到重點
  });

  it("byPaper 的樣板張數 = 每一列的拼接張數總和（不是列數）", () => {
    const plan = buildPackPlan(buildDefaultDesign("stool"), "a4");
    const totalSheets = Array.from(plan.byPaper.values()).reduce((s, a) => s + a.length, 0);
    const expected = plan.rows.reduce((s, r) => s + (r.tiling ? r.tiling.cols * r.tiling.rows : 0), 0);
    expect(totalSheets).toBe(expected);
    expect(totalSheets).toBeGreaterThan(plan.rows.filter((r) => r.placement).length); // 至少有一列被拆成多張
  });

  it("超過 6 張的面（書桌桌面板）在 a4 模式下也退回零件圖，不是靜默消失", () => {
    const plan = buildPackPlan(buildDefaultDesign("desk"), "a4");
    const topRow = plan.rows.find((r) => Math.max(r.wmm, r.hmm) > 1000);
    expect(topRow).toBeDefined();
    expect(topRow?.placement).toBeNull();
    expect(topRow?.tiling).toBeUndefined();
  });

  it("a4 模式所有 sheet 都是 A4，且都不旋轉（angleDeg=0）", () => {
    for (const category of ["stool", "chest-of-drawers", "dining-chair"] as const) {
      const plan = buildPackPlan(buildDefaultDesign(category), "a4");
      for (const list of plan.byPaper.values()) {
        for (const it of list) {
          expect(it.placement.paper.id).toBe("A4");
          expect(it.placement.angleDeg).toBe(0);
        }
      }
    }
  });
});

describe("buildPackPlan 印表機校正（calibrationMeasuredMm）", () => {
  it("不傳、或傳標稱值 250，行為完全一樣（不校正）", () => {
    const design = buildDefaultDesign("stool");
    const a = buildPackPlan(design, "a4");
    const b = buildPackPlan(design, "a4", CALIBRATION_TEST_LINE_MM);
    expect(a.rows.map((r) => r.tiling)).toEqual(b.rows.map((r) => r.tiling));
  });

  it("printshop 模式完全忽略校正參數（送輸出中心印，跟家用印表機縮放無關）", () => {
    const design = buildDefaultDesign("stool");
    const a = buildPackPlan(design, "printshop");
    const b = buildPackPlan(design, "printshop", 248.75);
    expect(a.rows.map((r) => r.partNo)).toEqual(b.rows.map((r) => r.partNo));
    expect(Array.from(a.byPaper.keys())).toEqual(Array.from(b.byPaper.keys()));
  });

  it("s=0.995（量到 248.75mm）：跟 planA4Tiles 直接算出來的一致", () => {
    const design = buildDefaultDesign("stool");
    const measuredMm = 248.75; // 248.75/250 = 0.995
    const plan = buildPackPlan(design, "a4", measuredMm);
    const leg = plan.rows.find((r) => r.nameZh.includes("凳腳") && r.faceLabelZh === "正面");
    expect(leg?.tiling).toBeDefined();
    const expected = planA4Tiles(leg!.wmm, leg!.hmm, measuredMm / CALIBRATION_TEST_LINE_MM);
    expect(expected).not.toBeNull();
    expect(leg?.tiling).toEqual({ landscape: expected!.landscape, cols: expected!.cols, rows: expected!.rows });
  });
});

/**
 * 零孔零榫的純矩形不出樣板（2026-08-21）。
 *
 * 全 catalog A4 模式實測 559 張裡有 179 張（32%）是「沒有任何榫孔的長方形」——
 * 1:1 樣板對它們等於零資訊，量兩個數字畫線就切了。斗櫃 44 張裡 43 張、
 * 衣櫃 30 張全部都是這種，連玻璃展示櫃的玻璃片都在出木工樣板。
 *
 * 但零件不可以從索引消失（無聲丟件是這個功能最該防的錯），所以這裡同時鎖住
 * 「不出紙」與「仍然有列」兩件事。
 */
describe("零孔零榫的純矩形不出樣板", () => {
  it("衣櫃：純矩形件不佔紙，但每一件都還在 rows 裡", () => {
    const design = buildDefaultDesign("wardrobe");
    const plan = buildPackPlan(design, "a4");
    const plainRows = plan.rows.filter((r) => r.plainRect);
    expect(plainRows.length).toBeGreaterThan(0);
    // 被判成純矩形的列一定沒有 placement，也就不會產生任何一張紙
    for (const r of plainRows) {
      expect(r.placement).toBeNull();
      expect(r.tiling).toBeUndefined();
    }
  });

  it("衣櫃：張數真的降下來（過濾前 30 張）", () => {
    const plan = buildPackPlan(buildDefaultDesign("wardrobe"), "a4");
    const sheets = Array.from(plan.byPaper.values()).reduce((s, a) => s + a.length, 0);
    expect(sheets).toBeLessThan(10);
  });

  it("方凳：14 張全都是該出的，一張都不該被過濾掉", () => {
    const plan = buildPackPlan(buildDefaultDesign("stool"), "a4");
    expect(plan.rows.filter((r) => r.plainRect)).toHaveLength(0);
    const sheets = Array.from(plan.byPaper.values()).reduce((s, a) => s + a.length, 0);
    expect(sheets).toBe(14);
  });

  it("printshop 模式套同一套判定", () => {
    const plan = buildPackPlan(buildDefaultDesign("wardrobe"), "printshop");
    const plainRows = plan.rows.filter((r) => r.plainRect);
    expect(plainRows.length).toBeGreaterThan(0);
    for (const r of plainRows) expect(r.placement).toBeNull();
  });

  it("純矩形跟「太大退回零件圖」是兩種狀態，不可以混為一談", () => {
    const plan = buildPackPlan(buildDefaultDesign("wardrobe"), "a4");
    const tooBig = plan.rows.filter((r) => !r.placement && !r.plainRect);
    const plain = plan.rows.filter((r) => r.plainRect);
    // 兩邊都要有東西，才證明這個設計真的分得開這兩種情況
    expect(tooBig.length).toBeGreaterThan(0);
    expect(plain.length).toBeGreaterThan(0);
  });
});
