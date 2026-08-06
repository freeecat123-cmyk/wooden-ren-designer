import { describe, expect, it } from "vitest";
import { nestPieces, DEFAULT_SHEET, type NestPiece, type NestedSheet } from "./nest-sheet";

function piece(
  label: string,
  w: number,
  h: number,
  over: Partial<NestPiece> = {},
): NestPiece {
  return {
    label,
    outline: [
      { x: 0, y: 0 },
      { x: w, y: 0 },
      { x: w, y: h },
      { x: 0, y: h },
    ],
    w,
    h,
    stockKey: "plywood|18mm",
    stockLabel: "18mm 夾板",
    allowRotate: false,
    ...over,
  };
}

const CFG = { sheetLengthMm: 2440, sheetWidthMm: 1220, kerfMm: 8 };

/** 兩片擺放框有沒有重疊（含刀縫要求：間距必須 ≥ kerf）。 */
function overlaps(
  a: NestedSheet["pieces"][number],
  b: NestedSheet["pieces"][number],
  gap: number,
): boolean {
  return (
    a.x < b.x + b.w + gap - 1e-6 &&
    b.x < a.x + a.w + gap - 1e-6 &&
    a.y < b.y + b.h + gap - 1e-6 &&
    b.y < a.y + a.h + gap - 1e-6
  );
}

describe("nestPieces", () => {
  it("空清單回空陣列", () => {
    expect(nestPieces([], CFG)).toEqual([]);
  });

  it("所有零件都會被排進去，一個都不能少", () => {
    const items = Array.from({ length: 40 }, (_, i) => piece(`P${i}`, 300 + (i % 5) * 50, 200));
    const sheets = nestPieces(items, CFG);
    const total = sheets.reduce((n, s) => n + s.pieces.length, 0);
    expect(total).toBe(items.length);
  });

  // ⭐排料最基本的正確性：零件不能疊在一起，而且彼此至少要隔一個刀縫，
  //  否則 CNC 走完第一刀就把隔壁那片的邊也吃掉了。
  it("同一張板上的零件互不重疊，且至少隔一個刀縫", () => {
    const items = Array.from({ length: 30 }, (_, i) => piece(`P${i}`, 200 + (i % 7) * 60, 150 + (i % 4) * 80));
    for (const sheet of nestPieces(items, CFG)) {
      for (let i = 0; i < sheet.pieces.length; i++) {
        for (let j = i + 1; j < sheet.pieces.length; j++) {
          expect(overlaps(sheet.pieces[i], sheet.pieces[j], CFG.kerfMm)).toBe(false);
        }
      }
    }
  });

  it("零件不會超出板子邊界（四周也留了刀縫）", () => {
    const items = Array.from({ length: 25 }, (_, i) => piece(`P${i}`, 400 + (i % 3) * 120, 260));
    for (const sheet of nestPieces(items, CFG)) {
      for (const p of sheet.pieces) {
        expect(p.x).toBeGreaterThanOrEqual(CFG.kerfMm - 1e-6);
        expect(p.y).toBeGreaterThanOrEqual(CFG.kerfMm - 1e-6);
        expect(p.x + p.w).toBeLessThanOrEqual(sheet.lengthMm - CFG.kerfMm + 1e-6);
        expect(p.y + p.h).toBeLessThanOrEqual(sheet.widthMm - CFG.kerfMm + 1e-6);
      }
    }
  });

  // ⭐不同料厚／材質分張：18mm 夾板和 45mm 實木腳排在同一張圖上，那張圖切不出來。
  it("不同料別各自成張，不會混在同一張板", () => {
    const sheets = nestPieces(
      [
        piece("A", 400, 300),
        piece("B", 400, 300, { stockKey: "oak|45mm", stockLabel: "45mm 橡木", allowRotate: false }),
      ],
      CFG,
    );
    expect(sheets).toHaveLength(2);
    for (const s of sheets) {
      const keys = new Set(s.pieces.map((p) => p.piece.stockKey));
      expect(keys.size).toBe(1);
    }
  });

  it("排不下就開下一張，並標好第幾張／共幾張", () => {
    // 每片 1200×600，扣掉邊距後一張 2424×1204 最多放 2 片
    const items = Array.from({ length: 5 }, (_, i) => piece(`P${i}`, 1200, 600));
    const sheets = nestPieces(items, CFG);
    expect(sheets.length).toBeGreaterThan(1);
    sheets.forEach((s, i) => {
      expect(s.index).toBe(i + 1);
      expect(s.total).toBe(sheets.length);
    });
  });

  it("可旋轉的零件會轉 90° 塞進去（省料）", () => {
    // 板寬只有 1220：600×1100 直放塞得下，但一排只放得下 2 片；允許旋轉後排得更緊
    const items = Array.from({ length: 6 }, (_, i) =>
      piece(`P${i}`, 1100, 600, { allowRotate: true }),
    );
    const sheets = nestPieces(items, CFG);
    expect(sheets.some((s) => s.pieces.some((p) => p.rotated))).toBe(true);
  });

  it("不可旋轉的零件絕不會被轉（實木轉了木紋就橫過來）", () => {
    const items = Array.from({ length: 20 }, (_, i) => piece(`P${i}`, 900, 250));
    for (const s of nestPieces(items, CFG)) {
      for (const p of s.pieces) {
        expect(p.rotated).toBe(false);
        expect(p.w).toBe(900);
        expect(p.h).toBe(250);
      }
    }
  });

  // ⭐寧可產出一張非標準尺寸的圖，也不要靜靜少掉一個零件。
  it("零件比標準板還大時把板放大並標記，不是丟掉它", () => {
    const sheets = nestPieces([piece("BIG", 3000, 900)], CFG);
    expect(sheets).toHaveLength(1);
    expect(sheets[0].enlarged).toBe(true);
    expect(sheets[0].lengthMm).toBeGreaterThanOrEqual(3000 + CFG.kerfMm * 2);
    expect(sheets[0].pieces).toHaveLength(1);
  });

  it("尺寸都在標準板內時不會亂放大", () => {
    const sheets = nestPieces([piece("A", 500, 300)], CFG);
    expect(sheets[0].enlarged).toBe(false);
    expect(sheets[0].stockLengthMm).toBe(CFG.sheetLengthMm);
    expect(sheets[0].stockWidthMm).toBe(CFG.sheetWidthMm);
  });

  // ⭐一張 4×8 板上只躺四支凳腳時，輸出 2440×1220 的圖等於叫人對著一片空白找零件。
  //  裁到用到的範圍＝這張圖就是「你要準備的那塊料多大」。
  it("沒排滿的板會裁到實際用到的範圍（四周留一個刀縫）", () => {
    const s = nestPieces([piece("A", 500, 300)], CFG)[0];
    expect(s.lengthMm).toBeCloseTo(500 + CFG.kerfMm * 2, 6);
    expect(s.widthMm).toBeCloseTo(300 + CFG.kerfMm * 2, 6);
    expect(s.stockLengthMm).toBe(2440); // 原本要排進去的板材尺寸還記著
  });

  it("裁切不會動到零件座標（還是對得上板子的角落）", () => {
    const s = nestPieces([piece("A", 500, 300), piece("B", 400, 200)], CFG)[0];
    for (const p of s.pieces) {
      expect(p.x).toBeGreaterThanOrEqual(CFG.kerfMm - 1e-6);
      expect(p.y).toBeGreaterThanOrEqual(CFG.kerfMm - 1e-6);
    }
  });

  it("利用率＝零件外框面積 ÷ 裁切後的圖面積（排得密不密，跟板子多大無關）", () => {
    const s = nestPieces([piece("A", 1220, 610)], CFG)[0];
    expect(s.utilization).toBeCloseTo((1220 * 610) / (s.lengthMm * s.widthMm), 6);
    expect(s.utilization).toBeGreaterThan(0.9);
  });

  // ⭐刀線式勝過 shelf packing 的地方：小件可以填進大件旁邊的「肚子」，
  //  而不是被大件的高度綁死一整條。
  it("小件會填進大件旁邊的空位，不是各佔一整條", () => {
    const items = [
      piece("BIG", 2000, 1100),
      ...Array.from({ length: 8 }, (_, i) => piece(`S${i}`, 380, 120)),
    ];
    const sheets = nestPieces(items, CFG);
    expect(sheets).toHaveLength(1); // shelf packing 會因為 BIG 佔滿一整條而被迫開第二張
  });

  it("預設板材是 4×8 呎（2440×1220）、刀縫 8mm", () => {
    expect(DEFAULT_SHEET).toEqual({ sheetLengthMm: 2440, sheetWidthMm: 1220, kerfMm: 8 });
  });

  it("刀縫調小（雷切）能排得更密", () => {
    const items = Array.from({ length: 24 }, (_, i) => piece(`P${i}`, 590, 290));
    const wide = nestPieces(items, { ...CFG, kerfMm: 20 });
    const tight = nestPieces(items, { ...CFG, kerfMm: 1 });
    expect(tight.length).toBeLessThanOrEqual(wide.length);
  });
});
