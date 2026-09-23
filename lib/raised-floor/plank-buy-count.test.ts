import { describe, it, expect } from "vitest";
import { computeRaisedFloorBom } from "./calc";
import { DEFAULT_RAISED_FLOOR_INPUT } from "./types";
import { computeFloorBom } from "../floor/calc";
import { DEFAULT_FLOOR_INPUT } from "../floor/types";

/**
 * 架高地板的「面材片數」要吃到餘料再利用。
 *
 * 2026-08-24 大軍稽核抓到：BOM 的 count / 金額用的是**優化前**的 full + cut，
 * 但 `reuseOffcuts` 在這支是寫死 true、餘料優化一定會跑。
 * 同一頁自己就對不起來——裁切表寫「整片 38 + 裁切 26(實耗新片 16)= 64 片」，
 * 38 + 16 = 54，那句話裡的加法根本不成立。400×300 平台多收 NT$2,142。
 */
const bom = (w: number, d: number) =>
  computeRaisedFloorBom({ ...DEFAULT_RAISED_FLOOR_INPUT, widthCm: w, depthCm: d, plankPricePerPing: 4500 }) as any;

describe("面材片數 = 整片 + 餘料優化後的新片數", () => {
  for (const [w, d] of [[300, 240], [400, 300], [500, 400], [600, 450]] as const) {
    it(`${w}×${d} 平台`, () => {
      const b = bom(w, d);
      const item = b.items.find((x: any) => x.category === "plank");
      expect(item.count).toBe(b.trace.plankFullCount + b.trace.plankCutNewCount);
      // 餘料真的有被利用時，一定會比「優化前」少
      if (b.trace.plankCutNewCount < b.trace.plankCutCount) {
        expect(item.count).toBeLessThan(b.trace.plankFullCount + b.trace.plankCutCount);
      }
    });
  }

  it("金額跟著片數走（不是照優化前的片數收錢）", () => {
    const b = bom(400, 300);
    const item = b.items.find((x: any) => x.category === "plank");
    const PING_M2 = 3.305; // 跟 lib/raised-floor/calc.ts:21 同一個常數
    const perPlankM2 = (b.input.plankLengthCm * b.input.plankWidthCm) / 10000;
    const expected = (item.count * perPlankM2 / PING_M2) * 4500;
    expect(item.subtotal).toBeCloseTo(expected, 0);
  });

  it("⭐ 跟姊妹工具 /floor 對同一塊地板要算出一樣的片數（兩支不能各說各話）", () => {
    const W = 400, D = 300;
    const rf = bom(W, D);
    const fl: any = computeFloorBom({
      ...DEFAULT_FLOOR_INPUT,
      room: { vertices: [{ x: 0, y: 0 }, { x: W, y: 0 }, { x: W, y: D }, { x: 0, y: D }] },
      plankLengthCm: rf.input.plankLengthCm,
      plankWidthCm: rf.input.plankWidthCm,
      expansionGapMm: 0,
      reuseOffcuts: true,
    });
    const rfCount = rf.items.find((x: any) => x.category === "plank").count;
    const flCount = fl.items.find((x: any) => x.category === "plank").count;
    // 兩支排版細節不完全相同（架高有柱腳），容許小幅差異，但不該差到一整輪優化那麼多
    expect(Math.abs(rfCount - flCount) / Math.max(rfCount, flCount)).toBeLessThan(0.15);
  });
});
