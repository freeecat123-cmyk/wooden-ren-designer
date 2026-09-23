import { describe, it, expect } from "vitest";
import { computeCeilingBom } from "./calc";
import { DEFAULT_CEILING_INPUT } from "./types";
import type { CeilingInput } from "./types";

/**
 * 🧷 主支中心必須落在房間裡。
 *
 * ⛔ 主支根數 `n = floor(長邊 / 間距) + 1` 是**假設第一支從 0 開始**算的,
 *   但「靠左」的第一支中心在 `邊框寬 + 半角材`,整排右移後最後一支會掉到牆外。
 *   實測長邊 365、角材 3.6、自動間距 90.3、基準=靠左:
 *     centers = 5.4 / 95.7 / 186 / 276.3 / **366.6** ← 超出 365 的牆
 *   圖上矩形畫到房間框外面、BOM 多列一支、副支也跟著多切一組。
 *   「靠右」則是反方向:第一支中心 −1.6,掉到牆的左邊外面。
 *   (2026-08-21 稽核發現。)
 */
const ROOM: CeilingInput = {
  ...(DEFAULT_CEILING_INPUT as CeilingInput),
  longSideCm: 365,
  shortSideCm: 320,
};
const centersFor = (base: CeilingInput["alignmentBase"]): number[] => {
  const bom = computeCeilingBom({ ...ROOM, alignmentBase: base }) as unknown as Record<string, unknown>;
  const dig = (o: unknown, k: string): unknown => {
    if (!o || typeof o !== "object") return null;
    if (k in (o as Record<string, unknown>)) return (o as Record<string, unknown>)[k];
    for (const v of Object.values(o as Record<string, unknown>)) {
      const r = dig(v, k);
      if (r) return r;
    }
    return null;
  };
  return (dig(bom, "mainJoistCentersCm") as number[]) ?? [];
};
const MIN = ROOM.timberWidthCm * 1.5;
const MAX = ROOM.longSideCm - ROOM.timberWidthCm * 1.5;

describe.each(["left", "center", "right"] as const)("主支排版基準 = %s", (base) => {
  it("① 真的有排出主支（沒有這條，下面的『沒有超出』會是假通過）", () => {
    expect(centersFor(base).length).toBeGreaterThan(0);
  });

  it("② ⛔沒有任何一支掉到牆外", () => {
    const bad = centersFor(base).filter((c) => c > MAX + 0.01 || c < MIN - 0.01);
    expect(bad, `這些中心在牆外：${bad.join(", ")}`).toEqual([]);
  });

  it("③ 間距維持設定值（剔除越界的那支不能把中間也弄亂）", () => {
    const c = centersFor(base);
    for (let i = 1; i < c.length; i++) {
      expect(c[i] - c[i - 1]).toBeCloseTo(c[1] - c[0], 5);
    }
  });
});

describe("BOM 呈現的數量要跟實際排出的支數一致", () => {
  /**
   * ⚠️ 這裡故意驗 **BOM 條目與備註文字**,不是隨便挖某個內部欄位:
   *   `bom.auto.mainPositionCount` 是排版**之前**用 `floor(長邊/間距)+1` 算的中間值(仍是 5),
   *   UI 完全不顯示它;真正端到使用者面前的是 BOM 這一行。
   *   第一版測試盲抓內部欄位,抓到那個中間值就誤判成沒修好——驗的東西要是使用者看得到的。
   */
  it("④ 主支那一行的備註,寫的支數要等於實際排出的支數", () => {
    const bom = computeCeilingBom({ ...ROOM, alignmentBase: "left" });
    const placed = centersFor("left").length;
    const main = bom.items.find((i) => /主支/.test(i.nameZh ?? ""));
    expect(main, "BOM 裡找不到主支").toBeDefined();
    expect(main!.count).toBe(placed);
    // 備註不可以再出現「floor(...)+1」那種算式——排到牆外的已經被剔掉,算式對不上
    expect(main!.note ?? "").not.toContain("floor(");
  });
});
