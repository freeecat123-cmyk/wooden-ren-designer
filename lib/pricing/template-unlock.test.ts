import { describe, it, expect } from "vitest";
import {
  TEMPLATE_BUNDLES,
  TEMPLATE_UNLOCK_PRICES,
  getBundleFor,
  getUnlockCategories,
  getUnlockPrice,
} from "@/lib/pricing/template-unlock";
import { FURNITURE_CATALOG } from "@/lib/templates";
import { isPaidCategory } from "@/lib/permissions";

/**
 * 丙級三題套組（2026-09-08 木頭仁：「三個打包一起賣，一起買斷三個都有，290」）。
 * 買任一題 → 付 290、三題全解鎖；非套組範本維持三階價。
 */
describe("丙級三題套組買斷", () => {
  it("三題都在同一個套組、價格 290", () => {
    for (const c of ["cert-c1", "cert-c2", "cert-c3"]) {
      expect(getBundleFor(c)?.id, c).toBe("cert-bundle");
      expect(getUnlockPrice(c), c).toBe(290);
      expect(getUnlockCategories(c), c).toEqual(["cert-c1", "cert-c2", "cert-c3"]);
    }
  });
  it("三題是付費範本（不在免費清單），套組成員都真的存在於目錄", () => {
    for (const b of TEMPLATE_BUNDLES) {
      for (const c of b.categories) {
        expect(isPaidCategory(c), c).toBe(true);
        expect(FURNITURE_CATALOG.some((e) => e.category === c), c).toBe(true);
      }
    }
  });
  it("非套組範本維持三階價、只解鎖自己", () => {
    expect(getBundleFor("dining-chair")).toBeNull();
    expect(getUnlockCategories("dining-chair")).toEqual(["dining-chair"]);
    const entry = FURNITURE_CATALOG.find((e) => e.category === "dining-chair")!;
    expect(getUnlockPrice("dining-chair")).toBe(TEMPLATE_UNLOCK_PRICES[entry.difficulty]);
  });
  it("變異：套組價不是三階價的任何一階（確認真的走套組路徑）", () => {
    expect(Object.values(TEMPLATE_UNLOCK_PRICES)).not.toContain(getUnlockPrice("cert-c2"));
  });
});
