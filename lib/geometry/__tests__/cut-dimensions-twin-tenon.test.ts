/**
 * 雙榫頭的切料長：同一端兩支榫頭從同一個端面伸出去，切料只加那一端最長的一支一次。
 *
 * 🩸2026-09-07 技能檢定家具木工丙級 01200-100301 上層板：每端兩支 20 寬貫穿榫、各 28 長，
 * 舊算法逐支相加 → 264+28×4＝376；實際切料 264+28+28＝320（試題的總寬 320 就是它）。
 */
import { describe, it, expect } from "vitest";
import { calculateCutDimensions, tenonAllowance } from "@/lib/geometry/cut-dimensions";
import type { Part, Tenon } from "@/lib/types";

const tenon = (position: Tenon["position"], length: number): Tenon =>
  ({ position, type: "through-tenon", length, width: 20, thickness: 18 });
const shelf = (tenons: Tenon[]): Part =>
  ({ id: "shelf", nameZh: "上層板", material: "pine", grainDirection: "length",
    visible: { length: 264, width: 100, thickness: 18 }, origin: { x: 0, y: 0, z: 0 }, tenons, mortises: [] } as Part);

describe("calculateCutDimensions：每端取最長榫頭一次", () => {
  it("每端一支 28 → 320", () => {
    expect(calculateCutDimensions(shelf([tenon("start", 28), tenon("end", 28)])).length).toBe(320);
  });
  it("每端兩支 28（雙榫頭）→ 還是 320，不是 376", () => {
    expect(calculateCutDimensions(shelf([tenon("start", 28), tenon("start", 28), tenon("end", 28), tenon("end", 28)])).length).toBe(320);
  });
  it("同一端長短不一 → 取最長", () => {
    expect(calculateCutDimensions(shelf([tenon("start", 28), tenon("start", 18), tenon("end", 10)])).length).toBe(264 + 28 + 10);
  });
  it("只有一端有榫 → 只加一端", () => {
    expect(calculateCutDimensions(shelf([tenon("end", 28)])).length).toBe(292);
  });
});

describe("tenonAllowance：同一端多支取最長", () => {
  it("雙榫頭 start/end 各 28 → {28, 28}", () => {
    expect(tenonAllowance([tenon("start", 28), tenon("start", 28), tenon("end", 28), tenon("end", 28)], "length")).toEqual({ start: 28, end: 28 });
  });
  it("沒有榫 → {0, 0}", () => {
    expect(tenonAllowance([], "length")).toEqual({ start: 0, end: 0 });
  });
});
