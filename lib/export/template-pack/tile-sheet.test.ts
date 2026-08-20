import { describe, it, expect } from "vitest";
import type { MachiningFace } from "@/lib/export/mortise-faces";
import { planA4Tiles } from "./tiling";
import { tileSheetSvg, tilePageGeometry, pageToFace, printerTestPageSvg } from "./tile-sheet";
import { PROOF_RULER_MM } from "./sheet";
import { TILE_MARGIN_MM } from "./tiling";

function rect(w: number, h: number, over: Partial<MachiningFace> = {}): MachiningFace {
  return {
    faceKey: "front",
    faceLabelZh: "正面",
    outline: [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }],
    holes: [],
    tenons: [],
    w,
    h,
    ...over,
  };
}

/** 方凳凳腳等級：425×35，橫放會切成 2 欄 1 列。 */
const legFace = rect(425, 35);
const legPlan = planA4Tiles(legFace.w, legFace.h)!;

/** 大板：3 欄 2 列，測角落/接縫/多鄰邊。 */
const bigFace = rect(700, 300);
const bigPlan = planA4Tiles(bigFace.w, bigFace.h)!;

function baseInput(face: MachiningFace, plan = planA4Tiles(face.w, face.h)!, c = 0, r = 0) {
  const tile = plan.tiles.find((t) => t.c === c && t.r === r)!;
  return {
    face,
    plan,
    tile,
    partNo: "P-01a",
    nameZh: "凳腳 1",
    qty: 4,
    faceIndex: 0,
    faceCount: 2,
  };
}

describe("planA4Tiles 前提", () => {
  it("凳腳 425×35 橫放切 2 欄 1 列", () => {
    expect(legPlan.cols).toBe(2);
    expect(legPlan.rows).toBe(1);
  });
  it("700×300 切成多欄多列（用來測四鄰邊情況）", () => {
    expect(bigPlan.cols).toBeGreaterThanOrEqual(2);
    expect(bigPlan.rows).toBeGreaterThanOrEqual(2);
  });
});

describe("tilePageGeometry", () => {
  it("leftX / topY 永遠等於留白（沒有前導重複內容可裁）", () => {
    for (const t of bigPlan.tiles) {
      const g = tilePageGeometry(bigPlan, t);
      expect(g.leftX).toBe(TILE_MARGIN_MM);
      expect(g.topY).toBe(TILE_MARGIN_MM);
    }
  });

  it("有右鄰時 rightX 內縮 10mm（重疊量）；沒有右鄰時 rightX＝紙邊留白", () => {
    const g0 = tilePageGeometry(bigPlan, bigPlan.tiles.find((t) => t.c === 0 && t.r === 0)!);
    expect(g0.hasRight).toBe(true);
    expect(g0.pageW - g0.rightX - TILE_MARGIN_MM).toBeCloseTo(10, 6); // 內縮 overlap

    const gLast = tilePageGeometry(
      bigPlan,
      bigPlan.tiles.find((t) => t.c === bigPlan.cols - 1 && t.r === 0)!,
    );
    expect(gLast.hasRight).toBe(false);
    expect(gLast.rightX).toBe(gLast.pageW - TILE_MARGIN_MM);
  });

  it("有下鄰時 bottomY 內縮 10mm；沒有下鄰時 bottomY＝紙邊留白", () => {
    const g0 = tilePageGeometry(bigPlan, bigPlan.tiles.find((t) => t.c === 0 && t.r === 0)!);
    expect(g0.hasBottom).toBe(true);
    expect(g0.pageH - g0.bottomY - TILE_MARGIN_MM).toBeCloseTo(10, 6);

    const gLast = tilePageGeometry(
      bigPlan,
      bigPlan.tiles.find((t) => t.c === 0 && t.r === bigPlan.rows - 1)!,
    );
    expect(gLast.hasBottom).toBe(false);
    expect(gLast.bottomY).toBe(gLast.pageH - TILE_MARGIN_MM);
  });

  /**
   * 核心正確性：這條鎖住「裁邊＝下一張的對齊線＝同一個 face 座標」。
   * 這是使用者真的把紙裁下、貼齊時，兩張紙會不會準的數學保證——
   * 不是只看畫面像不像，是座標算出來真的相等。
   */
  it("裁切線與下一張對齊線指向同一個 face 座標（欄方向）", () => {
    for (let c = 0; c < bigPlan.cols - 1; c++) {
      const tileA = bigPlan.tiles.find((t) => t.c === c && t.r === 0)!;
      const tileB = bigPlan.tiles.find((t) => t.c === c + 1 && t.r === 0)!;
      const gA = tilePageGeometry(bigPlan, tileA);
      const gB = tilePageGeometry(bigPlan, tileB);
      const faceFromCut = pageToFace(tileA, gA.rightX, gA.topY);
      const faceFromAlign = pageToFace(tileB, gB.leftX, gB.topY);
      expect(faceFromCut.x).toBeCloseTo(faceFromAlign.x, 6);
    }
  });

  it("裁切線與下一張對齊線指向同一個 face 座標（列方向）", () => {
    for (let r = 0; r < bigPlan.rows - 1; r++) {
      const tileA = bigPlan.tiles.find((t) => t.c === 0 && t.r === r)!;
      const tileB = bigPlan.tiles.find((t) => t.c === 0 && t.r === r + 1)!;
      const gA = tilePageGeometry(bigPlan, tileA);
      const gB = tilePageGeometry(bigPlan, tileB);
      const faceFromCut = pageToFace(tileA, gA.leftX, gA.bottomY);
      const faceFromAlign = pageToFace(tileB, gB.leftX, gB.topY);
      expect(faceFromCut.y).toBeCloseTo(faceFromAlign.y, 6);
    }
  });
});

describe("tileSheetSvg", () => {
  it("viewBox 依橫放/直放取正確的 A4 尺寸", () => {
    const svg = tileSheetSvg(baseInput(legFace));
    expect(legPlan.landscape).toBe(true);
    expect(svg).toContain('viewBox="0 0 297 210"');
  });

  it("含 100mm 證明尺", () => {
    expect(PROOF_RULER_MM).toBe(100);
    expect(tileSheetSvg(baseInput(legFace))).toContain("100mm");
  });

  it("絕不輸出 font-weight 500 或 600", () => {
    for (const t of bigPlan.tiles) {
      const svg = tileSheetSvg(baseInput(bigFace, bigPlan, t.c, t.r));
      expect(svg).not.toMatch(/font-weight="(500|600)"/);
    }
  });

  it("字型一律 PackCJK", () => {
    const svg = tileSheetSvg(baseInput(legFace));
    const texts = svg.match(/<text[^>]*font-family="[^"]*"/g) ?? [];
    expect(texts.length).toBeGreaterThan(0);
    for (const t of texts) expect(t).toContain('font-family="PackCJK"');
  });

  it("有右鄰的那張：右邊實線裁切線 + 「沿此線裁」；沒有右鄰：不畫", () => {
    const left = tileSheetSvg(baseInput(legFace, legPlan, 0, 0));
    const right = tileSheetSvg(baseInput(legFace, legPlan, 1, 0));
    expect(left).toContain("沿此線裁");
    expect(left).toContain('data-mark="cut-line"');
    expect(right).not.toContain("沿此線裁");
    expect(right).not.toContain('data-mark="cut-line"');
  });

  it("有左鄰的那張：左邊灰色虛線對齊線 + 提示文字；沒有左鄰：不畫", () => {
    const left = tileSheetSvg(baseInput(legFace, legPlan, 0, 0));
    const right = tileSheetSvg(baseInput(legFace, legPlan, 1, 0));
    expect(left).not.toContain("對齊此線");
    expect(right).toContain("對齊此線");
    expect(right).toContain('data-mark="align-line"');
  });

  it("格子編號：欄字母＋列數字，附「共 X 欄 × Y 列」", () => {
    const a1 = tileSheetSvg(baseInput(bigFace, bigPlan, 0, 0));
    const b2 = tileSheetSvg(baseInput(bigFace, bigPlan, 1, 1));
    expect(a1).toContain("A1");
    expect(b2).toContain("B2");
    expect(a1).toContain(`共 ${bigPlan.cols} 欄 × ${bigPlan.rows} 列`);
  });

  it("不用「第 N 張/共 M 張」這種舊格式字樣", () => {
    const svg = tileSheetSvg(baseInput(bigFace, bigPlan, 0, 0));
    expect(svg).not.toMatch(/第 \d+ 張/);
  });

  it("每張都有向上箭頭標記", () => {
    const svg = tileSheetSvg(baseInput(legFace));
    expect(svg).toContain('data-mark="up-arrow"');
  });

  it("四角都有對位十字register mark", () => {
    const svg = tileSheetSvg(baseInput(bigFace, bigPlan, 1, 1)); // 中間格，四鄰都有
    const n = (svg.match(/data-mark="tile-register"/g) ?? []).length;
    expect(n).toBe(4);
  });

  it("含整組對角自檢線（灰色細線，從 face 左上到右下）", () => {
    const svg = tileSheetSvg(baseInput(legFace, legPlan, 0, 0));
    expect(svg).toContain('data-mark="diagonal-check"');
  });

  it("零件名稱／件號／面別仍然出現在頁面上", () => {
    const svg = tileSheetSvg(baseInput(legFace));
    expect(svg).toContain("P-01a");
    expect(svg).toContain("凳腳 1");
    expect(svg).toContain("×4");
    expect(svg).toContain("正面");
  });

  it("四角十字與裁切線/對齊線/資訊區塊都在 15mm 內縮框內（不得靠近紙張實體邊緣）", () => {
    // 用中間格（四鄰都有）＋角落格各測一次，涵蓋裁切線在內縮位置、對齊線在留白邊緣兩種情況。
    for (const [c, r] of [[0, 0], [1, 1], [bigPlan.cols - 1, bigPlan.rows - 1]] as const) {
      const g = tilePageGeometry(bigPlan, bigPlan.tiles.find((t) => t.c === c && t.r === r)!);
      expect(g.leftX).toBeGreaterThanOrEqual(TILE_MARGIN_MM);
      expect(g.topY).toBeGreaterThanOrEqual(TILE_MARGIN_MM);
      expect(g.pageW - g.rightX).toBeGreaterThanOrEqual(TILE_MARGIN_MM);
      expect(g.pageH - g.bottomY).toBeGreaterThanOrEqual(TILE_MARGIN_MM);
    }
  });

  it("單一 tile（1×1，無鄰邊）不畫裁切線也不畫對齊線，但仍有四角十字與箭頭", () => {
    const small = rect(150, 80);
    const plan = planA4Tiles(small.w, small.h)!;
    expect(plan.cols).toBe(1);
    expect(plan.rows).toBe(1);
    const svg = tileSheetSvg(baseInput(small, plan, 0, 0));
    expect(svg).not.toContain('data-mark="cut-line"');
    expect(svg).not.toContain('data-mark="align-line"');
    expect((svg.match(/data-mark="tile-register"/g) ?? []).length).toBe(4);
    expect(svg).toContain('data-mark="up-arrow"');
  });
});

describe("printerTestPageSvg", () => {
  it("A4 橫放", () => {
    const svg = printerTestPageSvg(14);
    expect(svg).toContain('viewBox="0 0 297 210"');
  });

  it("含 100mm 證明尺", () => {
    expect(printerTestPageSvg(14)).toContain("100mm");
  });

  it("含四個角標（跟樣板同一顆 register mark）", () => {
    const svg = printerTestPageSvg(14);
    expect((svg.match(/data-mark="tile-register"/g) ?? []).length).toBe(4);
  });

  it("外框畫在 15mm 內縮位置，不是紙張實體邊緣", () => {
    const svg = printerTestPageSvg(14);
    const m = svg.match(/<rect data-mark="test-frame" x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)"/);
    expect(m).toBeTruthy();
    const [, x, y, w, h] = m!.map(Number);
    expect(x).toBe(TILE_MARGIN_MM);
    expect(y).toBe(TILE_MARGIN_MM);
    expect(x + w).toBe(297 - TILE_MARGIN_MM);
    expect(y + h).toBe(210 - TILE_MARGIN_MM);
  });

  it("帶入實際張數", () => {
    expect(printerTestPageSvg(14)).toContain("14");
    expect(printerTestPageSvg(29)).toContain("29");
  });

  it("含操作說明關鍵字", () => {
    const svg = printerTestPageSvg(14);
    expect(svg).toContain("先只印這一張");
    expect(svg).toContain("100mm");
    expect(svg).toContain("實際大小");
    expect(svg).toContain("縮放至頁面大小");
  });

  it("不得出現 font-weight 500/600、字型一律 PackCJK", () => {
    const svg = printerTestPageSvg(14);
    expect(svg).not.toMatch(/font-weight="(500|600)"/);
    const texts = svg.match(/<text[^>]*font-family="[^"]*"/g) ?? [];
    expect(texts.length).toBeGreaterThan(0);
    for (const t of texts) expect(t).toContain('font-family="PackCJK"');
  });

  it("所有 <text> 與外框都落在 15mm 內縮框內（不靠近紙張實體邊緣）", () => {
    const svg = printerTestPageSvg(14);
    const xs = [...svg.matchAll(/<text x="([\d.-]+)" y="([\d.-]+)"/g)];
    expect(xs.length).toBeGreaterThan(0);
    for (const [, x, y] of xs) {
      expect(Number(x)).toBeGreaterThanOrEqual(TILE_MARGIN_MM - 1e-6);
      expect(Number(x)).toBeLessThanOrEqual(297 - TILE_MARGIN_MM + 1e-6);
      expect(Number(y)).toBeGreaterThanOrEqual(TILE_MARGIN_MM - 1e-6);
      expect(Number(y)).toBeLessThanOrEqual(210 - TILE_MARGIN_MM + 1e-6);
    }
  });
});
