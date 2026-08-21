import { describe, it, expect } from "vitest";
import { computeRaisedFloorBom, withRealPlywoodCount } from "./calc";
import { computePlywoodLayout } from "./cutting";
import { DEFAULT_RAISED_FLOOR_INPUT } from "./types";
import type { RaisedFloorInput } from "./types";

/**
 * 🧷 夾板張數:同一頁只能有一個數字。
 *
 * ⛔ BOM 的夾板張數是**面積估算**(`ceil(平台面積 / 單張面積 × (1+損耗))`),
 *   但同一頁的裁切表走真正的 2D shelf packing。兩個數字會打架:
 *     平台 140×500cm、夾板 4×8(122×244)、損耗 20%、單價 1500:
 *       材料統計卡 → **3 張** / NT$4,500;裁切表 → 「要訂 **5 張**」
 *     差 2 張 = NT$3,000(40%),而**報價只跟偏低的那個面積估算走**。
 *   板材不能按面積切 —— 排版才是真的。(2026-08-21 稽核發現。)
 */
const mk = (widthCm: number, depthCm: number): RaisedFloorInput => ({
  ...(DEFAULT_RAISED_FLOOR_INPUT as RaisedFloorInput),
  widthCm,
  depthCm,
  plywoodPricePerSheet: 1500,
  plywoodWaste: 0.2,
});
const SIZES: Array<[number, number]> = [
  [300, 400],
  [140, 500], // ← 稽核報的那組,估算 3 / 排版 5
  [200, 300],
  [250, 450],
];

describe.each(SIZES)("平台 %i × %i cm", (w, d) => {
  const raw = computeRaisedFloorBom(mk(w, d));
  const fixed = withRealPlywoodCount(raw);
  const layout = computePlywoodLayout(raw);
  const item = fixed.items.find((i) => i.category === "plywood")!;

  it("① BOM 的夾板張數 = 裁切表實際要訂的張數", () => {
    expect(item.count).toBe(layout.orderSheetCount);
    expect(fixed.trace.plywoodSheetCount).toBe(layout.orderSheetCount);
  });

  it("② 金額跟著張數走(報價不能還跟著偏低的估算)", () => {
    expect(item.subtotal).toBe(layout.orderSheetCount * 1500);
    expect(fixed.cost.plywood).toBe(layout.orderSheetCount * 1500);
  });

  it("③ 總價有把差額算進去", () => {
    const delta = fixed.cost.plywood - raw.cost.plywood;
    expect(fixed.cost.total - raw.cost.total).toBeCloseTo(delta, 5);
  });

  it("④ 其他材料一項都沒被動到", () => {
    for (const c of ["plank", "joist", "skirting"] as const) {
      expect(fixed.cost[c], `${c} 被改到了`).toBe(raw.cost[c]);
    }
  });
});

describe("負向對照:這個測試抓得到問題嗎", () => {
  it("⑤ 140×500 這組修正前後真的不同(不然上面全是假通過)", () => {
    const raw = computeRaisedFloorBom(mk(140, 500));
    const fixed = withRealPlywoodCount(raw);
    expect(raw.trace.plywoodSheetCount).toBe(3);
    expect(fixed.trace.plywoodSheetCount).toBe(5);
  });
});
