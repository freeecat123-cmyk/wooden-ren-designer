import { describe, it, expect } from "vitest";
import { FURNITURE_CATALOG } from "../templates";
import { deriveBuildSteps } from "./derive";
import type { FurnitureCatalogEntry } from "../templates";
import type { MaterialId } from "../types";

/**
 * 🧷 工時要隨家具尺寸放大。
 *
 * ⛔ 修好前只有櫃體(cabinet)有放大,桌椅完全沒有:
 *   同一個餐桌模板報 2400×1000 的大餐桌,加工工資仍是 15.1hr × NT$500 = NT$7,550,
 *   **跟 1200×800 一模一樣**(整張報價只有材料在變)。大件桌椅 / 長凳一律報價偏低。
 *   (2026-08-21 稽核發現。)
 *
 * ⭐ 放大依據是**面積**不是長度:§X1「砂磨 ≈ 1 hr/m²」,而桌椅工時大頭就是檯面砂磨。
 *   2400×1000 = 2.4m² vs 1200×800 = 0.96m²,用長度算(2 倍)會低估。
 */
const hoursOf = (category: string, length: number, width: number): number => {
  const e = (FURNITURE_CATALOG as FurnitureCatalogEntry[]).find((x) => x.category === category)!;
  const options = (e.optionSchema ?? []).reduce<Record<string, string | number | boolean>>(
    (a, s) => ((a[s.key] = s.defaultValue as string | number | boolean), a),
    {},
  );
  const d = e.template!({ length, width, height: e.defaults.height, material: "maple" as MaterialId, options });
  const mins = deriveBuildSteps(d).reduce((a, s) => a + (s.estimatedMinutes ?? 0), 0);
  return mins / 60;
};

describe("桌 / 椅類工時隨尺寸放大", () => {
  it("① ⭐2.4m 餐桌的工時要明顯多於 1.2m(修好前兩者相同)", () => {
    const small = hoursOf("dining-table", 1200, 800);
    const big = hoursOf("dining-table", 2400, 1000);
    expect(big).toBeGreaterThan(small);
    // 檯面面積 2.5 倍;工時不會等比(有些工序跟尺寸無關),但至少要多 40%
    expect(big / small).toBeGreaterThan(1.4);
  });

  it("② 長凳同理", () => {
    expect(hoursOf("bench", 2400, 450)).toBeGreaterThan(hoursOf("bench", 1200, 350));
  });

  it("③ ⛔放大有上限,不會因為尺寸極端就爆掉", () => {
    const huge = hoursOf("dining-table", 4000, 2000);
    const big = hoursOf("dining-table", 2400, 1000);
    // 兩者都吃到 clamp 上限 2.5 → 應該相同
    expect(huge).toBeCloseTo(big, 1);
  });

  it("④ 負向對照:櫃體本來就有放大,不能被我改壞", () => {
    const small = hoursOf("nightstand", 450, 400);
    const big = hoursOf("nightstand", 900, 400);
    expect(big).toBeGreaterThan(small);
  });

  it("⑤ 小物件不受影響(它有自己的縮減規則)", () => {
    const a = hoursOf("pencil-holder", 90, 90);
    expect(a).toBeGreaterThan(0);
    expect(a).toBeLessThan(hoursOf("dining-table", 1200, 800));
  });
});
