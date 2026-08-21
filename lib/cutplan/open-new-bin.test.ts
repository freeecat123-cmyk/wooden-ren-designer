import { describe, it, expect } from "vitest";
import { packGroupGuillotine } from "./pack-guillotine";
import type { CutPiece } from "./types";
import type { PoolItem } from "./pack";

/**
 * 🧷 開新板時要挑**真的放得下**的庫存。
 *
 * ⛔ 原本直接拿 pool 裡第一個還有剩的板。cut-plan 頁預設就是 guillotine 策略,
 *   而庫存表會自動補一列 3000×200 的角料。使用者為了桌面另外加一列 1800×600 集成材時,
 *   這支會先開那塊角料 → 桌面塞不下 → 撤銷 → 直接判定排不下,
 *   **根本沒去試 1800×600 那塊**。畫面紅字說「排不下,請拼板」;
 *   切到 FFD 策略才會神奇地排得下 → 使用者買錯料或白做一次拼板分割。
 *   (2026-08-21 稽核發現。)
 */
const solid = (length: number, width: number, remaining: number): PoolItem => ({
  kind: "solid",
  material: "maple",
  length,
  width,
  remaining,
});
let seq = 0;
const piece = (length: number, width: number, allowRotate = false): CutPiece => ({
  partId: `p${++seq}`,
  partNameZh: "桌面",
  partNameEn: "Top",
  length,
  width,
  thickness: 25,
  material: "maple",
  billable: "maple",
  allowRotate,
});
const run = (pool: PoolItem[], pieces: CutPiece[]) =>
  packGroupGuillotine("solid", "maple", 25, pieces, pool, 3, 0, false);

describe("開新板要挑放得下的", () => {
  it("① ⭐角料排在前面時,仍要找到後面那塊放得下的大板", () => {
    const g = run([solid(3000, 200, 5), solid(1800, 600, 2)], [piece(1500, 500)]);
    expect(g.unplaced ?? []).toHaveLength(0);
    expect(g.bins[0].stockWidth).toBe(600);
  });

  it("② 放得下的有好幾塊時,挑面積最小的(不要拿大板裝小件)", () => {
    const g = run([solid(3000, 1200, 2), solid(1000, 600, 2)], [piece(900, 500)]);
    expect(g.bins[0].stockLength).toBe(1000);
  });

  it("③ 允許旋轉時,轉過來放得下的也要算數", () => {
    // 500×1500 的板,零件 1500×500 —— 不轉放不下,轉了剛好
    const g = run([solid(500, 1500, 1)], [piece(1400, 450, true)]);
    expect(g.unplaced ?? []).toHaveLength(0);
  });

  it("④ ⛔負向對照:零件真的比所有庫存都大時,仍要老實回報排不下", () => {
    const g = run([solid(1000, 500, 2)], [piece(2000, 800)]);
    expect((g.unplaced ?? []).length).toBe(1);
    // 而且不可以留下「利用率 0%」的空板
    expect(g.bins.filter((b) => b.shelves.length === 0)).toHaveLength(0);
  });

  it("⑤ 庫存用完時也要老實回報,不能無中生有", () => {
    const g = run([solid(1800, 600, 1)], [piece(1500, 500), piece(1500, 500)]);
    expect((g.unplaced ?? []).length).toBe(1);
  });
});
