import { describe, it, expect } from "vitest";
import { DEFAULT_CEILING_INPUT } from "./types";
import { computeCeilingBom } from "./calc";

/**
 * 吊筋高度 = 樓板高 − 天花板高。
 *
 * UI 上這是**兩根各自獨立的滑桿**（樓板高 200–400、天花板高 180–380），
 * 誰也不擋誰。使用者把天花板拉到 300、樓板留 250 → 吊筋 −50cm，
 * 直接進材料單跟報價，完全沒提示。（2026-08-23 掃描發現）
 */
describe("吊筋高度不准是負的", () => {
  const bom = (slab: number, ceil: number) =>
    computeCeilingBom({ ...DEFAULT_CEILING_INPUT, slabHeightCm: slab, ceilingHeightCm: ceil }) as any;

  it("正常情況照算，不動使用者的數字", () => {
    const b = bom(280, 260);
    expect(b.auto.hangerHeightCm).toBe(20);
    expect(b.warnings).toBeUndefined();
  });

  it("天花板設得比樓板高 → 吊筋夾成 5cm，不是 −50cm", () => {
    const b = bom(250, 300);
    expect(b.auto.rawHangerHeightCm).toBe(-50);
    expect(b.auto.hangerHeightCm).toBe(5);
  });

  it("夾了一定要發警告（靜默修正本身就是 bug）", () => {
    const b = bom(250, 300);
    expect(b.warnings?.length).toBeGreaterThan(0);
    expect(b.warnings[0]).toContain("250");
    expect(b.warnings[0]).toContain("300");
  });

  it("材料單上的吊筋長度也不准是負的", () => {
    const b = bom(250, 300);
    for (const it of b.items) expect(it.unitLengthCm ?? 0).toBeGreaterThanOrEqual(0);
  });

  it("兩根滑桿的整個合法範圍交叉跑一遍，材料單沒有任何負數", () => {
    const offenders: string[] = [];
    for (let slab = 200; slab <= 400; slab += 20) {
      for (let ceil = 180; ceil <= 380; ceil += 20) {
        const b = bom(slab, ceil);
        if (b.auto.hangerHeightCm <= 0) offenders.push(`樓板${slab}/天花${ceil} → 吊筋 ${b.auto.hangerHeightCm}`);
        for (const it of b.items) {
          if ((it.unitLengthCm ?? 0) < 0) offenders.push(`樓板${slab}/天花${ceil} → ${it.name} 長度 ${it.unitLengthCm}`);
          if ((it.qty ?? 0) < 0) offenders.push(`樓板${slab}/天花${ceil} → ${it.name} 數量 ${it.qty}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
