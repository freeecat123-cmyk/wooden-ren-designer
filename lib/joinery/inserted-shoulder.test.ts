import { describe, it, expect } from "vitest";
import {
  slottedLegStiffnessRatio, legUpsizeFactor, wedgeTipThicknessMm,
  maxShoulderAngleDeg, checkInsertedShoulder, MIN_WEDGE_TIP_MM,
} from "./inserted-shoulder";

/**
 * 規格見 docs/drafting-math.md §JT1–JT3。
 * 這裡的期望值是**手算**的，不是把程式輸出貼上來。
 */
describe("§JT1 腿開兩道槽後的抗彎剛度", () => {
  it("公式就是 1 − 牙條厚/腿料", () => {
    expect(slottedLegStiffnessRatio(60, 39)).toBeCloseTo(1 - 39 / 60, 10);
    expect(slottedLegStiffnessRatio(60, 30)).toBeCloseTo(0.5, 10);
  });

  it("⭐ 剛度剩餘率跟腿多粗無關，只看比值（doc 的核心結論）", () => {
    const ratios = [50, 60, 70, 80].map((w) => slottedLegStiffnessRatio(w, w * 0.65));
    expect(new Set(ratios.map((r) => r.toFixed(9))).size).toBe(1);
    expect(ratios[0]).toBeCloseTo(0.35, 9);
  });

  it("§1015 慣例（牙條厚 = 腿料 0.65）→ 剩 35%、腿要粗 1.30 倍", () => {
    expect(slottedLegStiffnessRatio(60, 39)).toBeCloseTo(0.35, 2);
    expect(legUpsizeFactor(60, 39)).toBeCloseTo(1.30, 2);
    expect(Math.ceil(60 * legUpsizeFactor(60, 39))).toBe(79);
  });

  it("放大倍率的定義:I ∝ W⁴，所以是 (剩餘率)^(−1/4)", () => {
    for (const [w, t] of [[60, 30], [60, 36], [80, 52]] as const) {
      const keep = slottedLegStiffnessRatio(w, t);
      expect(legUpsizeFactor(w, t)).toBeCloseTo(Math.pow(1 / keep, 0.25), 10);
      // 放大後的腿，剛度確實回到原本(同比例下 I 比 = scale⁴ × keep = 1)
      expect(Math.pow(legUpsizeFactor(w, t), 4) * keep).toBeCloseTo(1, 10);
    }
  });

  it("牙條厚到等於腿料 → 剛度歸零，腿料要無限粗（邊界不能爆掉）", () => {
    expect(slottedLegStiffnessRatio(60, 60)).toBe(0);
    expect(legUpsizeFactor(60, 60)).toBe(Infinity);
  });
});

describe("§JT2 斜肩角上限由牙條楔尖反解，不寫死角度", () => {
  it("楔尖厚 = 牙條厚 − 肩高·tan(α)", () => {
    expect(wedgeTipThicknessMm(39, 40, 0)).toBeCloseTo(39, 10);
    expect(wedgeTipThicknessMm(39, 40, 45)).toBeCloseTo(39 - 40, 10); // 負值＝做不出來
  });

  it("doc 表格的兩個關鍵值：40° 剩 5.4mm、45° 變負", () => {
    expect(wedgeTipThicknessMm(39, 40, 40)).toBeCloseTo(5.4, 1);
    expect(wedgeTipThicknessMm(39, 40, 45)).toBeLessThan(0);
  });

  it("上限角度剛好讓楔尖等於下限（互為反函數）", () => {
    const a = maxShoulderAngleDeg(39, 40);
    expect(wedgeTipThicknessMm(39, 40, a)).toBeCloseTo(MIN_WEDGE_TIP_MM, 6);
  });

  it("牙條越厚可以斜越多；牙條薄到剩下限 → 根本不能斜肩", () => {
    expect(maxShoulderAngleDeg(50, 40)).toBeGreaterThan(maxShoulderAngleDeg(30, 40));
    expect(maxShoulderAngleDeg(MIN_WEDGE_TIP_MM, 40)).toBe(0);
    expect(maxShoulderAngleDeg(2, 40)).toBe(0);
  });

  it("⚠️ 不可以套抱肩榫的 45°（那是束腰家具的三角眼，不同幾何）", () => {
    // 以慣例牙條厚 39mm / 肩高 40mm 而言，45° 是幾何上不成立的
    expect(maxShoulderAngleDeg(39, 40)).toBeLessThan(45);
  });
});

describe("checkInsertedShoulder：模板要拿它產警告", () => {
  it("剛度掉到一半以下就警告，而且要講出該加粗到多少", () => {
    const r = checkInsertedShoulder({ legWidthMm: 60, apronThicknessMm: 39, shoulderHeightMm: 40, alphaDeg: 14 });
    expect(r.ok).toBe(false);
    expect(r.warnings.join()).toContain("79mm");
    expect(r.warnings.join()).toContain("35%");
  });

  it("斜肩超過上限也要警告，並講出這組尺寸的上限是幾度", () => {
    const r = checkInsertedShoulder({ legWidthMm: 90, apronThicknessMm: 39, shoulderHeightMm: 40, alphaDeg: 44 });
    expect(r.warnings.some((w) => w.includes("斜肩"))).toBe(true);
    expect(r.warnings.join()).toContain(r.maxAlphaDeg.toFixed(1));
  });

  it("⚠️ 合理的組合不可以亂噴警告（別把閘關過頭）", () => {
    // 薄牙條 + 粗腿 + 小斜肩：剛度剩 75%、斜肩遠低於上限
    const r = checkInsertedShoulder({ legWidthMm: 80, apronThicknessMm: 20, shoulderHeightMm: 40, alphaDeg: 10 });
    expect(r.ok).toBe(true);
    expect(r.warnings).toEqual([]);
  });
});
