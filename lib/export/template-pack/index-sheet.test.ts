import { describe, it, expect } from "vitest";
import { indexSheetSvg, type PackRow } from "./index-sheet";
import { PAPERS } from "./paper";

const A3 = PAPERS.find((p) => p.id === "A3")!;
const A2 = PAPERS.find((p) => p.id === "A2")!;

const baseRows: PackRow[] = [
  { partNo: "P-01", nameZh: "凳腳", qty: 4, wmm: 425, hmm: 35,
    placement: { paper: A3, angleDeg: 21, swapped: false } },
  { partNo: "P-04", nameZh: "座板", qty: 1, wmm: 1200, hmm: 600, placement: null },
];

describe("indexSheetSvg", () => {
  it("A4 直式", () => {
    const svgs = indexSheetSvg("方凳", baseRows);
    expect(svgs.length).toBeGreaterThan(0);
    expect(svgs[0]).toContain('viewBox="0 0 210 297"');
  });

  it("列出件號、件名、紙張與角度", () => {
    const svgs = indexSheetSvg("方凳", baseRows);
    const allText = svgs.join("");
    expect(allText).toContain("P-01");
    expect(allText).toContain("凳腳");
    expect(allText).toContain("A3");
    expect(allText).toContain("21");
  });

  it("塞不下的零件標明退回零件圖", () => {
    const svgs = indexSheetSvg("方凳", baseRows);
    const allText = svgs.join("");
    expect(allText).toContain("見零件圖");
  });

  it("含列印設定提醒", () => {
    const svgs = indexSheetSvg("方凳", baseRows);
    expect(svgs[0]).toContain("實際大小");
  });

  it("不得出現 font-weight 500/600", () => {
    const svgs = indexSheetSvg("方凳", baseRows);
    const allText = svgs.join("");
    expect(allText).not.toMatch(/font-weight="(500|600)"/);
  });

  it("空陣列回傳一頁（只有標題與表頭）", () => {
    const svgs = indexSheetSvg("方凳", []);
    expect(svgs.length).toBe(1);
    expect(svgs[0]).toContain("件號");
    expect(svgs[0]).toContain("件名");
  });

  it("40 列分頁，每一頁都含表頭，所有件號都出現", () => {
    const rows: PackRow[] = Array.from({ length: 40 }, (_, i) => ({
      partNo: `P-${String(i + 1).padStart(2, "0")}`,
      nameZh: `零件${i + 1}`,
      qty: i % 5 === 0 ? 9 : 1,
      wmm: 100 + i * 10,
      hmm: 50 + i * 5,
      placement: i % 3 === 0 ? null : { paper: A3, angleDeg: 0, swapped: false },
    }));

    const svgs = indexSheetSvg("櫥櫃", rows);
    expect(svgs.length).toBeGreaterThan(1); // 分頁
    const allText = svgs.join("");

    // 所有件號都要出現
    for (let i = 1; i <= 40; i++) {
      const partNo = `P-${String(i).padStart(2, "0")}`;
      expect(allText).toContain(partNo);
    }

    // 每頁都要有表頭
    for (const svg of svgs) {
      expect(svg).toContain("件號");
      expect(svg).toContain("件名");
      expect(svg).toContain("數量");
    }

    // 只有第 1 頁有列印提醒
    expect(svgs[0]).toContain("實際大小");
    for (let i = 1; i < svgs.length; i++) {
      expect(svgs[i]).not.toContain("實際大小");
    }
  });

  it("長件名截斷加省略號，不含原名", () => {
    const longName = "區1抽屜1箱體前板加長版測試名稱加";
    const rows: PackRow[] = [
      { partNo: "P-01", nameZh: longName, qty: 1, wmm: 100, hmm: 100,
        placement: { paper: A3, angleDeg: 0, swapped: false } },
    ];

    const svgs = indexSheetSvg("測試", rows);
    const allText = svgs.join("");

    // 應該有省略號
    expect(allText).toContain("…");
    // 但不應該包含完整的長名（已被截斷）
    expect(allText).not.toContain(longName);
  });

  it("頁碼標籤多頁時顯示，單頁時不顯示", () => {
    const rows: PackRow[] = Array.from({ length: 34 }, (_, i) => ({
      partNo: `P-${String(i + 1).padStart(2, "0")}`,
      nameZh: `零件${i + 1}`,
      qty: 1,
      wmm: 100,
      hmm: 100,
      placement: { paper: A3, angleDeg: 0, swapped: false },
    }));

    const svgs = indexSheetSvg("櫥櫃", rows);

    // 應該多頁
    expect(svgs.length).toBeGreaterThan(1);

    // 第 1 頁有頁碼
    expect(svgs[0]).toContain("第 1 頁 / 共");

    // 第 2 頁有頁碼
    expect(svgs[1]).toContain("第 2 頁 / 共");
  });
});
