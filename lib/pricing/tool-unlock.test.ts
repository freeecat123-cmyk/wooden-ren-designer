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

/**
 * 銷售頁給 Google 的結構化資料（Offer.price）原本各自寫死 "390"，改價時漏改會變成
 * 「頁面寫 490、搜尋結果顯示 390」。現在一律讀 TOOL_UNLOCK_PRICES，這支測試防止有人又寫死。
 */
import { readFileSync } from "node:fs";
describe("工具銷售頁的結構化資料價格不可寫死", () => {
  const pages: Record<string, string> = {
    ceiling: "app/[locale]/ceiling/CeilingMarketing.tsx",
    floor: "app/[locale]/floor/FloorMarketing.tsx",
    "raised-floor": "app/[locale]/raised-floor/RaisedFloorMarketing.tsx",
    cnc: "app/[locale]/cnc/CncMarketing.tsx",
  };
  for (const [tool, file] of Object.entries(pages)) {
    it(`${tool}：台灣價讀 TOOL_UNLOCK_PRICES，沒有寫死數字`, () => {
      const src = readFileSync(file, "utf8");
      expect(src).toContain(`String(TOOL_UNLOCK_PRICES["${tool}"])`);
      expect(src).not.toMatch(/isEn \? "[0-9.]+" : "\d+"/);
    });
  }
});
