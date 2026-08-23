import { describe, it, expect } from "vitest";
import { calculateQuote } from "./quote";
import { LABOR_DEFAULTS } from "./labor";
import { MM3_PER_BDFT, SHEET_AREA_MM2 } from "./catalog";
import type { FurnitureDesign, Part } from "@/lib/types";

/**
 * 報價演算法的手算對照。
 *
 * 這支測試存在的理由：`quote.ts` 六百行、算的是使用者實際收錢的數字，
 * 在此之前**一支測試都沒有**。改壞了不會有人發現，直到照著報價收錢才出事。
 *
 * 每個期望值都是照 docs/drafting-math.md §T2 / §X1 / §X2 手算出來的常數，
 * 不是「跑一次程式把輸出貼上來」——那種測試只會證明程式跟自己一致。
 */

function mkPart(over: Partial<Part> & { id: string }): Part {
  return {
    nameZh: over.nameZh ?? over.id,
    material: over.material ?? "maple",
    grainDirection: "length",
    visible: over.visible ?? { length: 1000, width: 100, thickness: 20 },
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    tenons: over.tenons ?? [],
    mortises: over.mortises ?? [],
    ...over,
    id: over.id,
  } as Part;
}

function mkDesign(parts: Part[], category = "desk"): FurnitureDesign {
  return {
    id: "test",
    category,
    nameZh: "測試件",
    primaryMaterial: "maple",
    defaultJoinery: "mortise-tenon",
    overall: { length: 1000, width: 500, height: 700 },
    parts,
    notes: "",
  } as unknown as FurnitureDesign;
}

/** 只留材料成本，其他科目歸零，讓斷言鎖定單一公式 */
const BARE = {
  ...LABOR_DEFAULTS,
  primaryMaterialPricePerBdft: 300,
  hourlyRate: 0, equipmentRate: 0, consumables: 0, finishingCost: 0,
  marginRate: 0, vatRate: 0,
} as any;

describe("材料成本（§T2 才積 / §X2 損料率）", () => {
  it("一件 1000×100×20 實木，10% 損耗，NT$300/單位 → 手算 NT$279.69", () => {
    const q = calculateQuote(mkDesign([mkPart({ id: "p1" })]), BARE);
    // 體積 = 1000×100×20 = 2,000,000 mm³
    // 含 10% 損耗 = 2,200,000 mm³
    // 材積 = 2,200,000 / 2,359,737 = 0.93231
    // 金額 = 0.93231 × 300 = 279.69
    const expectedBdft = (1000 * 100 * 20 * 1.1) / MM3_PER_BDFT;
    expect(q.totalBdft).toBeCloseTo(expectedBdft, 5);
    expect(q.totalBdft).toBeCloseTo(0.93231, 4);
    expect(q.materialCost).toBeCloseTo(279.69, 1);
  });

  it("小物件（tray）走 25% 損耗，不是 10%（§X2）", () => {
    const big = calculateQuote(mkDesign([mkPart({ id: "p1" })], "desk"), BARE);
    const small = calculateQuote(mkDesign([mkPart({ id: "p1" })], "tray"), BARE);
    expect(small.totalBdft / big.totalBdft).toBeCloseTo(1.25 / 1.1, 6);
  });

  it("榫頭要算進下料尺寸——不然買的料會短一截", () => {
    const noTenon = calculateQuote(mkDesign([mkPart({ id: "p1" })]), BARE);
    const withTenon = calculateQuote(
      mkDesign([mkPart({ id: "p1", tenons: [{ type: "blind-tenon", position: "start", length: 30, width: 30, thickness: 10 } as any] })]),
      BARE,
    );
    // 長度 1000 → 1030，材積等比
    expect(withTenon.totalBdft / noTenon.totalBdft).toBeCloseTo(1030 / 1000, 6);
  });

  it("純視覺零件（玻璃等）不計材料錢", () => {
    const withVisual = calculateQuote(
      mkDesign([mkPart({ id: "p1" }), mkPart({ id: "g1", visual: "glass" } as any)]),
      BARE,
    );
    const without = calculateQuote(mkDesign([mkPart({ id: "p1" })]), BARE);
    expect(withVisual.materialCost).toBeCloseTo(without.materialCost, 6);
  });
});

describe("板材整張計價（半張也付全張錢）", () => {
  const SHEET = { ...BARE, plywoodPricePerBdft: 50 };
  it("只用 0.1 張夾板也要付一整張的錢", () => {
    const tiny = calculateQuote(
      mkDesign([mkPart({ id: "b1", materialOverride: "plywood", visible: { length: 500, width: 500, thickness: 18 } })]),
      SHEET,
    );
    // ceil(0.25 m² × 1.1 / 2.9768 m²) = 1 張
    // 計費體積 = 2,976,800 × 18 = 53,582,400 mm³ → 22.707 材積 × 50 = NT$1135.35
    const oneSheetBdft = (SHEET_AREA_MM2 * 18) / MM3_PER_BDFT;
    expect(tiny.materialCost).toBeCloseTo(oneSheetBdft * 50, 4);
    expect(tiny.materialCost).toBeCloseTo(1135.35, 1);
  });

  it("用量跨過整張門檻 → 跳成兩張，不是線性成長", () => {
    const oneSheet = (SHEET_AREA_MM2 * 18) / MM3_PER_BDFT * 50;
    // 面積 2.8 m²，含 10% 損耗 = 3.08 m² > 2.9768 → 2 張
    const q = calculateQuote(
      mkDesign([mkPart({ id: "b1", materialOverride: "plywood", visible: { length: 2000, width: 1400, thickness: 18 } })]),
      SHEET,
    );
    expect(q.materialCost).toBeCloseTo(oneSheet * 2, 4);
  });
});

describe("價格鏈：成本 → 毛利 → 設計師加成 → 數量 → 折扣 → 稅", () => {
  const base = {
    ...LABOR_DEFAULTS,
    primaryMaterialPricePerBdft: 0, // 材料歸零，只驗算術
    hourlyRate: 0, equipmentRate: 0,
    consumables: 1000, finishingCost: 0,
    marginRate: 0.3, vatRate: 0.05, quantity: 1, discountRate: 0,
  } as any;

  it("毛利 30%：成本 1000 → 木匠單價 1300", () => {
    const q = calculateQuote(mkDesign([mkPart({ id: "p1" })]), base);
    expect(q.costSubtotal).toBeCloseTo(1000, 6);
    expect(q.makerUnitPriceExclVat).toBeCloseTo(1300, 6);
    expect(q.margin).toBeCloseTo(300, 6);
  });

  it("設計師加成 50% 疊在木匠價之上：1300 → 1950", () => {
    const q = calculateQuote(mkDesign([mkPart({ id: "p1" })]), { ...base, designerMarkupRate: 0.5 });
    expect(q.unitPriceExclVat).toBeCloseTo(1950, 6);
    expect(q.designerMarkupAmount).toBeCloseTo(650, 6);
  });

  it("數量 3 + 折扣 10% + 稅 5%：1300×3=3900 → 折後 3510 → 含稅 3685.5", () => {
    const q = calculateQuote(mkDesign([mkPart({ id: "p1" })]), { ...base, quantity: 3, discountRate: 0.1 });
    expect(q.subtotalBeforeDiscount).toBeCloseTo(3900, 6);
    expect(q.discountAmount).toBeCloseTo(390, 6);
    expect(q.vat).toBeCloseTo(175.5, 6);
    expect(q.total).toBeCloseTo(3685.5, 6);
  });

  it("手動覆寫單價時，毛利要反推（可為負值＝賠本，不能藏起來）", () => {
    const q = calculateQuote(mkDesign([mkPart({ id: "p1" })]), { ...base, overrideUnitPrice: 800 });
    expect(q.makerUnitPriceExclVat).toBeCloseTo(800, 6);
    expect(q.margin).toBeCloseTo(-200, 6);
  });

  it("折扣率超出 0–1 會被夾住，不會做出負數總價", () => {
    const q = calculateQuote(mkDesign([mkPart({ id: "p1" })]), { ...base, discountRate: 5 });
    // 折扣 500% 被夾成 100% → 折後 0 元、稅 0、總價 0，不會變負數
    expect(q.discountAmount).toBeCloseTo(q.subtotalBeforeDiscount, 6);
    expect(q.total).toBe(0);
  });

  it("訂金 + 尾款要剛好等於總價（四捨五入不能吃掉錢）", () => {
    const q = calculateQuote(mkDesign([mkPart({ id: "p1" })]), { ...base, quantity: 7, depositRate: 0.35 });
    expect(q.depositAmount + q.balanceAmount).toBe(Math.round(q.total));
  });
});

describe("工時與工期", () => {
  it("工資 = 工時 × 時薪；設備折舊 = 工時 × 設備費率", () => {
    const q = calculateQuote(mkDesign([mkPart({ id: "p1" })]), {
      ...LABOR_DEFAULTS, primaryMaterialPricePerBdft: 0,
      hourlyRate: 600, equipmentRate: 50, marginRate: 0, vatRate: 0,
      consumables: 0, finishingCost: 0,
    } as any);
    expect(q.laborCost).toBeCloseTo(q.laborHours * 600, 6);
    expect(q.equipmentCost).toBeCloseTo(q.laborHours * 50, 6);
  });

  it("手動覆寫工時要真的蓋過自動估算", () => {
    const q = calculateQuote(mkDesign([mkPart({ id: "p1" })]), {
      ...LABOR_DEFAULTS, primaryMaterialPricePerBdft: 0, laborHoursOverride: 12.5,
    } as any);
    expect(q.laborHours).toBe(12.5);
    expect(q.autoLaborHours).not.toBe(12.5);
  });

  it("工期隨數量放大（6hr/天），不是固定值", () => {
    const one = calculateQuote(mkDesign([mkPart({ id: "p1" })]), { ...LABOR_DEFAULTS, primaryMaterialPricePerBdft: 0, quantity: 1, bufferDays: 0 } as any);
    const ten = calculateQuote(mkDesign([mkPart({ id: "p1" })]), { ...LABOR_DEFAULTS, primaryMaterialPricePerBdft: 0, quantity: 10, bufferDays: 0 } as any);
    expect(ten.estimatedWorkdays).toBeGreaterThan(one.estimatedWorkdays);
    expect(ten.estimatedWorkdays).toBe(Math.ceil((one.laborHours * 10) / 6));
  });
});


describe("板材的板厚要取三邊最小（立著的背板不能把高度當板厚）", () => {
  /**
   * 2026-08-23 實際 bug：`visible` 是幾何軸三元組（§A9.1），立著的櫃子背板
   * 板厚在 width、高度在 thickness。舊碼直接拿 thickness 當板厚，
   * 一片 3mm 背板被算成「一張 1920mm 厚的夾板」＝ NT$121,104。
   * 6 款櫃類全中，最誇張差 640 倍。勾「背板用夾板」反而比實木貴 3 倍。
   */
  const SHEET = { ...BARE, plywoodPricePerBdft: 50 };
  const oneSheetCost = (t: number) => ((SHEET_AREA_MM2 * t) / MM3_PER_BDFT) * 50;

  it("躺平的 3mm 夾板", () => {
    const q = calculateQuote(mkDesign([mkPart({
      id: "b", materialOverride: "plywood",
      visible: { length: 1200, width: 900, thickness: 3 },
    } as any)]), SHEET);
    expect(q.materialCost).toBeCloseTo(oneSheetCost(3), 4);
  });

  it("立著的 3mm 夾板（板厚在 width）算出來要一模一樣", () => {
    const q = calculateQuote(mkDesign([mkPart({
      id: "b", materialOverride: "plywood",
      visible: { length: 1200, width: 3, thickness: 900 },
    } as any)]), SHEET);
    expect(q.materialCost).toBeCloseTo(oneSheetCost(3), 4);
  });

  it("板厚在 length 也一樣（三個軸都試過）", () => {
    const q = calculateQuote(mkDesign([mkPart({
      id: "b", materialOverride: "plywood",
      visible: { length: 3, width: 1200, thickness: 900 },
    } as any)]), SHEET);
    expect(q.materialCost).toBeCloseTo(oneSheetCost(3), 4);
  });

  it("三種擺法算出的金額必須完全相等（這就是當初漏掉的不變量）", () => {
    const costs = [
      { length: 1200, width: 900, thickness: 3 },
      { length: 1200, width: 3, thickness: 900 },
      { length: 3, width: 1200, thickness: 900 },
    ].map((v) => calculateQuote(mkDesign([mkPart({ id: "b", materialOverride: "plywood", visible: v } as any)]), SHEET).materialCost);
    expect(new Set(costs.map((c) => c.toFixed(6))).size).toBe(1);
  });
});
