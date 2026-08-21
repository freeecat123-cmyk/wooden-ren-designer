import { describe, it, expect } from "vitest";
import { FURNITURE_CATALOG } from "../templates";
import { partExportGeometry } from "./three-d-export";
import type { FurnitureCatalogEntry } from "../templates";
import type { MaterialId, Part } from "../types";

/**
 * 🧷 3D 匯出(STL / OBJ / 3MF)的桌面輪廓要跟設計一致。
 *
 * ⛔ `toShapeSpec` 對 `top-outline` 只帶 `style` 與 `sizeMm`,**漏掉另外 4 個造型參數**
 *   (sizeZMm / squareness / archSides / lobes)。任何有「檯面輪廓」選項的模板
 *   選了外凸弧「四邊(枕形)」之類的設定,匯出的形狀就跟畫面上的設計不一樣 ——
 *   3D 列印或送 CNC 出來是錯的。(2026-08-21 稽核發現。)
 */
const e = (FURNITURE_CATALOG as FurnitureCatalogEntry[]).find((x) => x.category === "dining-table")!;
const base = (e.optionSchema ?? []).reduce<Record<string, string | number | boolean>>(
  (a, s) => ((a[s.key] = s.defaultValue as string | number | boolean), a),
  {},
);
const topPart = (ov: Record<string, string | number | boolean>): Part => {
  const d = e.template!({
    length: e.defaults.length,
    width: e.defaults.width,
    height: e.defaults.height,
    material: "maple" as MaterialId,
    options: { ...base, ...ov },
  });
  return d.parts.find((p) => p.shape?.kind === "top-outline")!;
};
const vertexCount = (ov: Record<string, string | number | boolean>): number => {
  const g = partExportGeometry(topPart(ov));
  return g.getAttribute("position").count;
};

describe("top-outline 的造型參數要傳到 3D 匯出", () => {
  it("① 前提:這些設定真的產生 top-outline 零件", () => {
    expect(topPart({ seatOutline: "arch", seatOutlineArchSides: "all" })).toBeDefined();
  });

  it("② ⭐外凸弧「四邊」與「前後」要匯出不同的幾何", () => {
    const all = vertexCount({ seatOutline: "arch", seatOutlineArchSides: "all" });
    const fb = vertexCount({ seatOutline: "arch", seatOutlineArchSides: "front-back" });
    expect(all).not.toBe(fb);
    // 四邊都有弧 → 頂點必然比只有兩邊多
    expect(all).toBeGreaterThan(fb);
  });

  it("③ archSides 有被帶進 shape(漏掉的話這欄會是 undefined)", () => {
    const shape = topPart({ seatOutline: "arch", seatOutlineArchSides: "all" }).shape;
    expect(shape?.kind).toBe("top-outline");
    expect((shape as { archSides?: string }).archSides).toBe("all");
  });

  it("④ 方形檯面不受影響(沒有 top-outline 零件就是對的)", () => {
    expect(topPart({ seatOutline: "rect" })).toBeUndefined();
  });
});
