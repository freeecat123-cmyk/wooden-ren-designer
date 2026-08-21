import { describe, it, expect } from "vitest";
import { computeFloorBom } from "./calc";
import { DEFAULT_FLOOR_INPUT } from "./types";
import type { FloorInput } from "./types";

/**
 * 🧷 「經驗 +10% 損耗」必須真的進到數量與金額。
 *
 * ⛔ 修好前 `wasteMode: "empirical"` 只影響兩個地方:損耗百分比的顯示、以及備註文字
 *   「建議進貨 N 片」。BOM 的 count 與材料費**都用未加損耗的片數**。
 *   結果:BOM 叫師傅進 62 片,報價按 56 片算(少 9.7%)——毛利、稅、總價一路少收,
 *   師傅照報價接單就自己吸收多買的 6 片。30 坪的案子少收約 1.5 萬。
 *   (2026-08-21 稽核發現。)
 */
const priced = (mode: FloorInput["wasteMode"]): FloorInput => ({
  ...(DEFAULT_FLOOR_INPUT as FloorInput),
  wasteMode: mode,
  plankPricePerPing: 3000,
  underlayPricePerPing: 500,
  skirtingPricePerM: 200,
});
const plankOf = (mode: FloorInput["wasteMode"]) => {
  const bom = computeFloorBom(priced(mode));
  const item = bom.items.find((i) => i.category === "plank")!;
  // count / subtotal 在型別上是 optional。⚠️ 這裡直接斷言它們存在:
  // 若哪天 BOM 不再帶這兩個欄位,下面每一條比較都會變成 undefined 對 undefined 的假通過。
  if (item.count == null) throw new Error("BOM 的地板片沒有 count,測試無法成立");
  if (item.subtotal == null) throw new Error("BOM 的地板片沒有 subtotal,測試無法成立");
  return { item, count: item.count, subtotal: item.subtotal, total: bom.cost.total };
};

describe("地板損耗模式", () => {
  it("① 選了經驗損耗，片數要比實算多（不能兩個模式同一個數字）", () => {
    expect(plankOf("empirical").count).toBeGreaterThan(plankOf("computed").count);
  });

  it("② 片數正好是實算的 1.1 倍無條件進位", () => {
    const layoutCount = plankOf("computed").count;
    expect(plankOf("empirical").count).toBe(Math.ceil(layoutCount * 1.1));
  });

  it("③ ⛔材料費要跟著變（這才是報價少收的根源）", () => {
    const c = plankOf("computed");
    const e = plankOf("empirical");
    expect(c.subtotal, "沒有單價就驗不到金額，這條會變成假通過").toBeGreaterThan(0);
    expect(e.subtotal).toBeGreaterThan(c.subtotal);
    // 金額比例要跟片數比例一致，不能只加一半
    expect(e.subtotal / c.subtotal).toBeCloseTo(e.count / c.count, 5);
  });

  it("④ 總價也要跟著變", () => {
    expect(plankOf("empirical").total).toBeGreaterThan(plankOf("computed").total);
  });

  it("⑤ 負向對照：實算模式的數字一個都不能被我改到", () => {
    const c = plankOf("computed");
    // 排版 56 片、材料 11,590、總計 16,196（2026-08-21 修改前後皆同）
    expect(c.count).toBe(56);
    expect(Math.round(c.subtotal)).toBe(11590);
    expect(Math.round(c.total)).toBe(16196);
  });

  it("⑥ 備註要同時講「排版需幾片」與「進貨幾片」，不然使用者不知道差在哪", () => {
    const note = plankOf("empirical").item.note ?? "";
    expect(note).toContain("排版需");
    expect(note).toContain("進貨");
  });
});
