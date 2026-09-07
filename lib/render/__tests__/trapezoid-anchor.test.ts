/**
 * 直角梯形（一邊垂直、一邊斜）的算式。
 *
 * 🩸2026-09-07 木頭仁要把技術士技能檢定家具木工丙級的三題做進木作藍圖。
 * 01200-100301 的側板是**上緣 120、下緣 95、左緣整片垂直**的直角梯形，
 * 而既有的 `apron-trapezoid` 一律對稱收窄 → 直接用尺寸就不對，
 * 而「斜切」正好是那題的考點，不能將就。
 */
import { describe, it, expect } from "vitest";
import { trapAnchorOffset } from "@/lib/render/trapezoid-anchor";
import { buildApronTrapezoidGeometry } from "@/lib/render/part-geometry";

/** 把幾何的頂點取出來，回傳每個 z 斷面的 x 範圍（模擬「上緣寬 / 下緣寬」量測） */
function xRangeByZ(geo: { getAttribute: (n: string) => { array: ArrayLike<number>; count: number } }) {
  const pos = geo.getAttribute("position");
  const byZ = new Map<string, { lo: number; hi: number }>();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.array[i * 3], z = pos.array[i * 3 + 2];
    const k = z.toFixed(3);
    const cur = byZ.get(k) ?? { lo: Infinity, hi: -Infinity };
    byZ.set(k, { lo: Math.min(cur.lo, x), hi: Math.max(cur.hi, x) });
  }
  return [...byZ.entries()].sort((a, b) => Number(a[0]) - Number(b[0]));
}

describe("梯形靠邊：位移式與「固定某一側邊」等價", () => {
  it("省略 anchor＝對稱（既有 29 款家具的牙條一格不能動）", () => {
    expect(trapAnchorOffset(60, 0.8)).toBe(0);
    expect(trapAnchorOffset(60, 0.8, "center")).toBe(0);
  });

  it("靠 −X 邊：左緣固定在 −半長，右緣才收", () => {
    const hx = 60, s = 95 / 120;             // 上緣 120 → 下緣 95
    const off = trapAnchorOffset(hx, s, "min");
    // 縮放後的兩端：−hx·s+off 應該剛好回到 −hx（左緣完全沒動）
    expect(-hx * s + off).toBeCloseTo(-hx, 9);
    expect(hx * s + off).toBeCloseTo(-hx + 2 * hx * s, 9);   // 右緣＝左緣 + 收窄後的寬
  });

  it("靠 +X 邊：右緣固定，左緣才收", () => {
    const hx = 60, s = 95 / 120;
    const off = trapAnchorOffset(hx, s, "max");
    expect(hx * s + off).toBeCloseTo(hx, 9);
    expect(-hx * s + off).toBeCloseTo(hx - 2 * hx * s, 9);
  });

  it("縮放比例 1（不收窄）時，靠哪邊都不位移", () => {
    for (const a of ["center", "min", "max"] as const) {
      expect(trapAnchorOffset(60, 1, a)).toBeCloseTo(0, 12);
    }
  });
});

describe("3D 幾何：靠邊真的做出直角梯形", () => {
  const size: [number, number, number] = [120, 18, 350];   // 長(上緣)120 × 厚18 × 高350
  const topS = 1, botS = 95 / 120;

  it("對稱時上下緣都置中（回歸：既有行為）", () => {
    const rows = xRangeByZ(buildApronTrapezoidGeometry(size, topS, botS));
    const top = rows[0][1], bot = rows[rows.length - 1][1];
    expect(top.lo).toBeCloseTo(-60, 6);
    expect(top.hi).toBeCloseTo(60, 6);
    expect(bot.lo).toBeCloseTo(-47.5, 6);
    expect(bot.hi).toBeCloseTo(47.5, 6);
  });

  it("靠 −X 邊：左緣兩端都在 −60（整條垂直），右緣從 60 收到 35", () => {
    const rows = xRangeByZ(buildApronTrapezoidGeometry(size, topS, botS, 0, "full", undefined, "min"));
    const top = rows[0][1], bot = rows[rows.length - 1][1];
    expect(top.lo).toBeCloseTo(-60, 6);
    expect(bot.lo).toBeCloseTo(-60, 6);          // ⭐ 左緣垂直
    expect(top.hi).toBeCloseTo(60, 6);
    expect(bot.hi).toBeCloseTo(35, 6);           // 60 − 25＝上下緣差 120−95
    // 上下緣寬度仍然是 120 / 95（靠邊不可以改變寬度）
    expect(top.hi - top.lo).toBeCloseTo(120, 6);
    expect(bot.hi - bot.lo).toBeCloseTo(95, 6);
  });

  it("靠 +X 邊是靠 −X 的鏡像", () => {
    const a = xRangeByZ(buildApronTrapezoidGeometry(size, topS, botS, 0, "full", undefined, "min"));
    const b = xRangeByZ(buildApronTrapezoidGeometry(size, topS, botS, 0, "full", undefined, "max"));
    const aBot = a[a.length - 1][1], bBot = b[b.length - 1][1];
    expect(bBot.hi).toBeCloseTo(-aBot.lo, 6);
    expect(bBot.lo).toBeCloseTo(-aBot.hi, 6);
  });
});
