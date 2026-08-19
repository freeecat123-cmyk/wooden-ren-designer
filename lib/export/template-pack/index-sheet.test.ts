import { describe, it, expect } from "vitest";
import { indexSheetSvg, type PackRow } from "./index-sheet";
import { PAPERS } from "./paper";

const A3 = PAPERS.find((p) => p.id === "A3")!;

const rows: PackRow[] = [
  { partNo: "P-01", nameZh: "凳腳", qty: 4, wmm: 425, hmm: 35,
    placement: { paper: A3, angleDeg: 21, swapped: false } },
  { partNo: "P-04", nameZh: "座板", qty: 1, wmm: 1200, hmm: 600, placement: null },
];

describe("indexSheetSvg", () => {
  it("A4 直式", () => {
    expect(indexSheetSvg("方凳", rows)).toContain('viewBox="0 0 210 297"');
  });
  it("列出件號、件名、紙張與角度", () => {
    const svg = indexSheetSvg("方凳", rows);
    expect(svg).toContain("P-01");
    expect(svg).toContain("凳腳");
    expect(svg).toContain("A3");
    expect(svg).toContain("21");
  });
  it("塞不下的零件標明退回零件圖", () => {
    expect(indexSheetSvg("方凳", rows)).toContain("見零件圖");
  });
  it("含列印設定提醒", () => {
    expect(indexSheetSvg("方凳", rows)).toContain("實際大小");
  });
  it("不得出現 font-weight 500/600", () => {
    expect(indexSheetSvg("方凳", rows)).not.toMatch(/font-weight="(500|600)"/);
  });
});
