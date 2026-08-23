import { describe, it, expect } from "vitest";
import { MM3_PER_BDFT, MATERIAL_PRICE_PER_BDFT, SHEET_AREA_MM2, SHEET_DIM_MM } from "./catalog";

/**
 * 計價單位是**美制 board foot**，不是台才。
 *
 * 2026-08-23 跟木頭仁確認：單價表（楓木 150、白橡 200、台檜 1000…）是照
 * board foot 報的，維持現狀。
 *
 * `docs/drafting-math.md` §T2 另外寫著「1 才 = 2,781,870 mm³」——那是台灣木材行
 * 講「才」的單位，跟這裡差 17.9%。看到 doc 就來「修正」這個常數的話，
 * 全站材料成本會一夕之間錯 17.9%，而且不會有任何地方報錯。
 *
 * 這支測試就是那道閘：註解會被忽略，紅燈不會。
 */
describe("計價單位鎖定在美制 board foot（不是台才）", () => {
  it("1 板才 = 144 in³ ≈ 2,359,737 mm³", () => {
    expect(MM3_PER_BDFT).toBeCloseTo(25.4 ** 3 * 144, 6);
    expect(Math.round(MM3_PER_BDFT)).toBe(2359737);
  });

  it("不是台才的 2,781,870 mm³（差 17.9%，這正是要防的那一刀）", () => {
    const TAIWAN_CAI_MM3 = 30.3 * 30.3 * 3030;
    expect(Math.round(MM3_PER_BDFT)).not.toBe(Math.round(TAIWAN_CAI_MM3));
    expect(TAIWAN_CAI_MM3 / MM3_PER_BDFT).toBeCloseTo(1.179, 3);
  });

  it("1 m³ = 424 板才（台才是 360，兩個數字別記混）", () => {
    expect(1e9 / MM3_PER_BDFT).toBeCloseTo(423.8, 1);
  });

  it("換單位的話單價表要一起換——這裡把幾個基準價釘住當提醒", () => {
    expect(MATERIAL_PRICE_PER_BDFT.maple).toBe(150);
    expect(MATERIAL_PRICE_PER_BDFT["white-oak"]).toBe(200);
    expect(MATERIAL_PRICE_PER_BDFT["taiwan-cypress"]).toBe(1000);
  });

  it("板材標準張 = 4×8 呎（2440×1220），一張 18mm ≈ 22.7 板才", () => {
    expect(SHEET_DIM_MM.length).toBe(2440);
    expect(SHEET_DIM_MM.width).toBe(1220);
    expect((SHEET_AREA_MM2 * 18) / MM3_PER_BDFT).toBeCloseTo(22.71, 2);
  });
});
