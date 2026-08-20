import { describe, it, expect } from "vitest";
import {
  planA4Tiles,
  MAX_TILES_PER_FACE,
  TILE_OVERLAP_MM,
  TILE_MARGIN_MM,
  CALIBRATION_TEST_LINE_MM,
  CALIBRATION_MIN_S,
  CALIBRATION_MAX_S,
  calibrationScale,
} from "./tiling";

// 留白 15mm（印表機不可列印區安全裕度，取代早期 5mm 草案）：
// 橫放 usableW=297-30=267, usableH=210-30=180；直放 usableW=180, usableH=267。
const USABLE_W_LANDSCAPE = 267;
const USABLE_H_LANDSCAPE = 180;

describe("planA4Tiles", () => {
  it("留白常數是 15mm（印表機不可列印區安全裕度）", () => {
    expect(TILE_MARGIN_MM).toBe(15);
  });

  it("小零件（塞進單張 A4 可用區）回 1×1", () => {
    const plan = planA4Tiles(200, 100);
    expect(plan).not.toBeNull();
    expect(plan!.cols).toBe(1);
    expect(plan!.rows).toBe(1);
    expect(plan!.tiles).toHaveLength(1);
    expect(plan!.tiles[0]).toEqual({
      c: 0, r: 0, x: 0, y: 0, w: USABLE_W_LANDSCAPE, h: USABLE_H_LANDSCAPE,
    });
  });

  it("剛好等於可用區時算塞得下（跟 fit.ts 的邊界慣例一致）", () => {
    const plan = planA4Tiles(USABLE_W_LANDSCAPE, USABLE_H_LANDSCAPE);
    expect(plan!.cols).toBe(1);
    expect(plan!.rows).toBe(1);
  });

  it("橫放直放各算一次，取張數少的（方凳凳腳 425×35，不旋轉時橫放明顯比較省張）", () => {
    const plan = planA4Tiles(425, 35);
    expect(plan).not.toBeNull();
    // 425 寬：橫放 usableW=267, stepW=257 → cols=ceil((425-10)/257)=2；直放 usableW=180,stepW=170 → cols=ceil(415/170)=3
    expect(plan!.landscape).toBe(true);
    expect(plan!.cols).toBe(2);
    expect(plan!.rows).toBe(1);
  });

  it("平手時取橫放", () => {
    // 正方形零件橫放/直放張數必然相同 → 平手，應回 landscape=true
    const plan = planA4Tiles(500, 500);
    expect(plan!.landscape).toBe(true);
  });

  it("角度一律 0（不旋轉，brief 決策 2）", () => {
    // planA4Tiles 本身不輸出角度欄位——這條測試守的是介面上根本沒有 angleDeg，
    // 呼叫端不需要也不能傳角度進來。用型別層面表達：tiles 沒有 angleDeg 屬性。
    const plan = planA4Tiles(600, 300)!;
    for (const t of plan.tiles) {
      expect((t as unknown as Record<string, unknown>).angleDeg).toBeUndefined();
    }
  });

  it("張數超過上限（6）→ null，不能靜默吃掉", () => {
    // 衣櫃背板等級：1200×1920 全 catalog 實測要 49 張，遠超上限。
    expect(planA4Tiles(1200, 1920)).toBeNull();
    expect(MAX_TILES_PER_FACE).toBe(6);
  });

  it("剛好等於上限（6 張）仍要出", () => {
    // 橫放：usableW=267,stepW=257,usableH=180,stepH=170 → 700×300 落在 3 欄 × 2 列 = 6 張。
    const plan = planA4Tiles(700, 300);
    expect(plan).not.toBeNull();
    expect(plan!.tiles.length).toBeLessThanOrEqual(MAX_TILES_PER_FACE);
  });

  it("多張時的座標涵蓋整個 face，且步進＝可用區－重疊", () => {
    const plan = planA4Tiles(425, 35)!; // 橫放 2 欄 1 列
    expect(TILE_OVERLAP_MM).toBe(10);
    const stepW = USABLE_W_LANDSCAPE - TILE_OVERLAP_MM;
    expect(plan.tiles[0]).toEqual({
      c: 0, r: 0, x: 0, y: 0, w: USABLE_W_LANDSCAPE, h: USABLE_H_LANDSCAPE,
    });
    expect(plan.tiles[1]).toEqual({
      c: 1, r: 0, x: stepW, y: 0, w: USABLE_W_LANDSCAPE, h: USABLE_H_LANDSCAPE,
    });
    // 最後一張的右邊要蓋過 faceW，不然中間會有縫
    const last = plan.tiles[plan.tiles.length - 1];
    expect(last.x + last.w).toBeGreaterThanOrEqual(425);
  });

  it("三欄以上：每一張的 x 都是 stepW 的倍數，相鄰兩張重疊剛好 10mm", () => {
    const plan = planA4Tiles(700, 100)!; // 橫放，cols 應該 >= 2
    expect(plan.cols).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < plan.cols; i++) {
      const prev = plan.tiles.find((t) => t.c === i - 1 && t.r === 0)!;
      const cur = plan.tiles.find((t) => t.c === i && t.r === 0)!;
      const overlap = prev.x + prev.w - cur.x;
      expect(overlap).toBeCloseTo(TILE_OVERLAP_MM, 6);
    }
  });
});

describe("印表機校正（s 參數）", () => {
  it("常數：250mm 測試線、合理範圍 0.9–1.1", () => {
    expect(CALIBRATION_TEST_LINE_MM).toBe(250);
    expect(CALIBRATION_MIN_S).toBe(0.9);
    expect(CALIBRATION_MAX_S).toBe(1.1);
  });

  it("calibrationScale：量到的 mm ÷ 250", () => {
    expect(calibrationScale(250)).toBe(1);
    expect(calibrationScale(248.75)).toBeCloseTo(0.995, 10);
  });

  it("s=1（不傳）跟明確傳 1 完全一樣——不校正時行為零改變", () => {
    const a = planA4Tiles(425, 35);
    const b = planA4Tiles(425, 35, 1);
    expect(b).toEqual(a);
  });

  it("s=0.995（印表機縮水 0.5%）：每張涵蓋的 face 範圍縮小＝usablePaper×s", () => {
    const s = 0.995;
    const plan1 = planA4Tiles(700, 300, 1)!;
    const planS = planA4Tiles(700, 300, s)!;
    // usable 橫放＝267×180；s=0.995 時應該縮成 267×0.995／180×0.995。
    expect(planS.tiles[0].w).toBeCloseTo(USABLE_W_LANDSCAPE * s, 6);
    expect(planS.tiles[0].h).toBeCloseTo(USABLE_H_LANDSCAPE * s, 6);
    expect(planS.tiles[0].w).toBeLessThan(plan1.tiles[0].w);
    expect(planS.tiles[0].h).toBeLessThan(plan1.tiles[0].h);
  });

  it("縮水的印表機可能讓貼邊的零件多切一張——這是正確行為，不是 bug", () => {
    // 266mm 在 s=1 時剛好塞進橫放可用區（267mm）＝1 張；
    // s=0.995 時可用區縮成 267×0.995＝265.665mm，266 已經放不下，要切成 2 張。
    const face = 266;
    const s = 0.995;
    expect(planA4Tiles(face, 100, 1)!.cols).toBe(1);
    expect(planA4Tiles(face, 100, s)!.cols).toBe(2);
  });

  it("重疊量 TILE_OVERLAP_MM（10mm）本身不隨 s 換算——它是真實世界要重疊的量，跟校正無關", () => {
    const s = 0.995;
    const plan = planA4Tiles(700, 100, s)!;
    expect(plan.cols).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < plan.cols; i++) {
      const prev = plan.tiles.find((t) => t.c === i - 1 && t.r === 0)!;
      const cur = plan.tiles.find((t) => t.c === i && t.r === 0)!;
      const overlap = prev.x + prev.w - cur.x;
      expect(overlap).toBeCloseTo(TILE_OVERLAP_MM, 6);
    }
  });
});
