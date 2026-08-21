import { describe, it, expect } from "vitest";
import { computeCuttingPlan } from "./cutting";
import type { CuttingPiece } from "./cutting";

/**
 * 🧷 超長角材拼接:切出來的每一段都不能比原料還長。
 *
 * ⛔ 段數原本用 `ceil(長度 / 原料長)`——那是「不重疊」的算法,但每多一段就要多吃一段
 *   拼接重疊。實測長邊 715cm、原料 360cm(12 尺)、重疊 10cm:
 *     N = ceil(715/360) = 2 → 末段 = 715 − 360 + 10 = **365cm > 360cm**
 *   裁切表出現兩根 stock 各裝一段 365、`remainCm = −5.0`,利用率還顯示 97.1%。
 *   師傅照表下料才發現「從 360 的料切不出 365」。(2026-08-21 稽核發現。)
 */
const OVERLAP = 10;
const plan = (lengthCm: number, stock: number) =>
  computeCuttingPlan([{ label: "主支", lengthCm, category: "main-joist" } satisfies CuttingPiece], stock, 0.3, OVERLAP);
const segsOf = (lengthCm: number, stock: number) =>
  plan(lengthCm, stock).stocks.flatMap((s) => s.pieces);

describe.each([
  [715, 360],
  [715, 300],
  [1000, 360],
  [365, 360],
])("長度 %i cm / 原料 %i cm", (len, stock) => {
  it("① 真的有切出段(沒有這條,下面的『沒有超長』會是假通過)", () => {
    expect(segsOf(len, stock).length).toBeGreaterThan(0);
  });

  it("② ⛔沒有任何一段比原料長", () => {
    const over = segsOf(len, stock).filter((p) => p.lengthCm > stock + 0.01);
    expect(over.map((p) => p.lengthCm), "這幾段切不出來").toEqual([]);
  });

  it("③ 沒有剩料為負的原料(負剩料 = 表本身自相矛盾)", () => {
    const neg = plan(len, stock).stocks.filter((s) => s.remainCm < -0.01);
    expect(neg.length).toBe(0);
  });

  it("④ 拼起來的總覆蓋長度要 ≥ 需求(不能為了不超長就少切)", () => {
    const segs = segsOf(len, stock);
    const covered = segs.reduce((a, b) => a + b.lengthCm, 0) - (segs.length - 1) * OVERLAP;
    expect(covered).toBeGreaterThanOrEqual(len - 0.01);
  });
});
