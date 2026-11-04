import { describe, expect, it } from "vitest";
import { TOOL_UNLOCK_PRICES, VALID_TOOL_IDS } from "./tool-unlock";
import { PLAN_PRICES } from "./plans";

describe("工具單買價格", () => {
  it("四個工具（天花板、地板、架高平台、CNC）都是 490", () => {
    expect(VALID_TOOL_IDS).toHaveLength(4);
    for (const id of VALID_TOOL_IDS) expect(TOOL_UNLOCK_PRICES[id]).toBe(490);
  });

  it("⛔ 既有訂閱價格沒被動到（個人 390／3,900、專業 890／8,900、學員價照舊）", () => {
    expect(PLAN_PRICES.personal).toMatchObject({ monthly: 390, yearly: 3900 });
    expect(PLAN_PRICES.pro).toMatchObject({ monthly: 890, yearly: 8900 });
    expect(PLAN_PRICES.student_personal).toMatchObject({ monthly: 219, yearly: 2190 });
    expect(PLAN_PRICES.student_pro).toMatchObject({ monthly: 690, yearly: 6900 });
  });
});
