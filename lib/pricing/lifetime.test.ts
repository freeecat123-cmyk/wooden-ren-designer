import { describe, expect, it } from "vitest";
import {
  LIFETIME_ITEM_NAME,
  LIFETIME_PRICE,
  LIFETIME_QUOTA,
  getLifetimeStatus,
  lifetimeEligibility,
} from "./lifetime";
import { TOOL_LABEL_ZH } from "./tool-unlock";
import type { PlanId } from "@/lib/permissions";

describe("getLifetimeStatus — 名額邊界（期望值手算）", () => {
  it("一個都還沒賣：剩滿額、可買", () => {
    expect(getLifetimeStatus(0)).toEqual({ quota: LIFETIME_QUOTA, taken: 0, remaining: LIFETIME_QUOTA, available: true });
  });

  it("剩最後 1 個：還能買", () => {
    const s = getLifetimeStatus(LIFETIME_QUOTA - 1);
    expect(s.remaining).toBe(1);
    expect(s.available).toBe(true);
  });

  it("剛好賣完：不能買（這是最容易差 1 的邊界）", () => {
    const s = getLifetimeStatus(LIFETIME_QUOTA);
    expect(s.remaining).toBe(0);
    expect(s.available).toBe(false);
  });

  it("超賣（同時付款造成）：剩餘夾在 0、不能買，不會出現負數", () => {
    const s = getLifetimeStatus(LIFETIME_QUOTA + 3);
    expect(s.remaining).toBe(0);
    expect(s.available).toBe(false);
  });

  it("帶進來的數字壞掉（負數、NaN）：當成 0，不會因此多開名額到超過上限", () => {
    expect(getLifetimeStatus(-5).remaining).toBe(LIFETIME_QUOTA);
    expect(getLifetimeStatus(Number.NaN).remaining).toBe(LIFETIME_QUOTA);
  });

  it("自訂名額：5 名賣出 5 個就額滿", () => {
    expect(getLifetimeStatus(4, 5)).toMatchObject({ remaining: 1, available: true });
    expect(getLifetimeStatus(5, 5)).toMatchObject({ remaining: 0, available: false });
  });
});

describe("lifetimeEligibility — 誰能買", () => {
  const cases: Array<[PlanId, boolean, string?]> = [
    ["free", true],
    ["personal", false, "has_plan"],
    ["pro", false, "has_plan"],
    ["student", false, "has_plan"],
    ["lifetime", false, "owned"],
    ["lifetime_personal", false, "owned"],
  ];
  for (const [plan, ok, reason] of cases) {
    it(`${plan} → ${ok ? "可以買" : `不能買（${reason}）`}`, () => {
      const r = lifetimeEligibility(plan);
      expect(r.ok).toBe(ok);
      if (!r.ok) expect(r.reason).toBe(reason);
    });
  }
});

describe("定價與品項名稱", () => {
  it("售價 6,900", () => {
    expect(LIFETIME_PRICE).toBe(6900);
  });

  it("綠界品項名稱帶「終身買斷」，而且跟工具買斷的品項名稱分得開", () => {
    expect(LIFETIME_ITEM_NAME).toContain("終身買斷");
    for (const label of Object.values(TOOL_LABEL_ZH)) {
      expect(`${label} 永久買斷`).not.toContain("終身買斷");
    }
  });
});
