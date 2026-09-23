import { describe, it, expect } from "vitest";
import { indexSheetSvg, type PackRow } from "./index-sheet";
import { PAPERS } from "./paper";

const A3 = PAPERS.find((p) => p.id === "A3")!;

function row(over: Partial<PackRow> = {}): PackRow {
  return {
    partNo: "P-01",
    nameZh: "凳腳",
    faceLabelZh: "攤平面",
    faceIndex: 0,
    faceCount: 1,
    qty: 1,
    wmm: 100,
    hmm: 100,
    placement: { paper: A3, angleDeg: 0, swapped: false },
    ...over,
  };
}

const baseRows: PackRow[] = [
  row({ partNo: "P-01", nameZh: "凳腳", qty: 4, wmm: 425, hmm: 35,
    placement: { paper: A3, angleDeg: 21, swapped: false } }),
  row({ partNo: "P-04", nameZh: "座板", wmm: 1200, hmm: 600, placement: null }),
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
    expect(svgs.join("")).toContain("見零件圖");
  });

  it("含列印設定提醒", () => {
    const svgs = indexSheetSvg("方凳", baseRows);
    expect(svgs[0]).toContain("實際大小");
  });

  it("不得出現 font-weight 500/600", () => {
    const svgs = indexSheetSvg("方凳", baseRows);
    expect(svgs.join("")).not.toMatch(/font-weight="(500|600)"/);
  });

  it("空陣列回傳一頁（只有標題與表頭）", () => {
    const svgs = indexSheetSvg("方凳", []);
    expect(svgs.length).toBe(1);
    expect(svgs[0]).toContain("件號");
    expect(svgs[0]).toContain("件名");
  });

  it("多加工面的零件：面別欄看得出兩列差在哪", () => {
    const svgs = indexSheetSvg("方凳", [
      row({ partNo: "P-01a", nameZh: "凳腳 1", qty: 4, faceLabelZh: "正面", faceIndex: 0, faceCount: 2 }),
      row({ partNo: "P-01b", nameZh: "凳腳 1", qty: 4, faceLabelZh: "右端", faceIndex: 1, faceCount: 2 }),
    ]);
    const allText = svgs.join("");
    expect(allText).toContain("面別");
    expect(allText).toContain("P-01a");
    expect(allText).toContain("P-01b");
    expect(allText).toContain("正面 1/2");
    expect(allText).toContain("右端 2/2");
  });

  it("單面零件的面別欄不加 N/M 後綴", () => {
    const allText = indexSheetSvg("方凳", [row({ faceLabelZh: "攤平面" })]).join("");
    expect(allText).toContain("攤平面");
    expect(allText).not.toContain("1/1");
  });

  it("40 列分頁，每一頁都含表頭，所有件號都出現", () => {
    const rows: PackRow[] = Array.from({ length: 40 }, (_, i) =>
      row({
        partNo: `P-${String(i + 1).padStart(2, "0")}`,
        nameZh: `零件${i + 1}`,
        qty: i % 5 === 0 ? 9 : 1,
        wmm: 100 + i * 10,
        hmm: 50 + i * 5,
        placement: i % 3 === 0 ? null : { paper: A3, angleDeg: 0, swapped: false },
      }),
    );

    const svgs = indexSheetSvg("櫥櫃", rows);
    expect(svgs.length).toBeGreaterThan(1); // 分頁
    const allText = svgs.join("");

    for (let i = 1; i <= 40; i++) {
      expect(allText).toContain(`P-${String(i).padStart(2, "0")}`);
    }

    for (const svg of svgs) {
      expect(svg).toContain("件號");
      expect(svg).toContain("件名");
      expect(svg).toContain("數量");
    }

    expect(svgs[0]).toContain("實際大小");
    for (let i = 1; i < svgs.length; i++) {
      expect(svgs[i]).not.toContain("實際大小");
    }
  });

  /**
   * 這條守的是「靜默漏件」。舊版頁數是 ceil(rows/31) 常數推算、填列是另一條
   * while (y < maxY)，兩套邏輯只是碰巧都等於 31 列；動了起始 y / 行距 / 頁邊
   * 讓實際容量掉到 30，最後幾列就會憑空消失。掃 1..120 列全部驗一次件號完整。
   */
  it("任何列數都不會漏件（1..120 全掃）", () => {
    for (let n = 1; n <= 120; n++) {
      const rows = Array.from({ length: n }, (_, i) =>
        row({ partNo: `Q${i + 1}#`, nameZh: `零件${i + 1}` }),
      );
      const allText = indexSheetSvg("壓力測試", rows).join("");
      for (let i = 1; i <= n; i++) {
        expect(allText, `${n} 列時漏掉 Q${i}#`).toContain(`Q${i}#`);
      }
    }
  });

  it("每頁列數 = 實際填列容量（頁碼不會多算或少算一頁）", () => {
    // 找出第 1 頁真正裝得下幾列：多一列就會多一頁。
    let cap = 0;
    for (let n = 1; n <= 60; n++) {
      if (indexSheetSvg("量容量", Array.from({ length: n }, () => row())).length > 1) {
        cap = n - 1;
        break;
      }
    }
    expect(cap).toBeGreaterThan(0);
    expect(indexSheetSvg("量容量", Array.from({ length: cap }, () => row())).length).toBe(1);
    expect(indexSheetSvg("量容量", Array.from({ length: cap + 1 }, () => row())).length).toBe(2);
  });

  it("長件名截斷加省略號，不含原名", () => {
    const longName = "區1抽屜1箱體前板加長版測試名稱加";
    const svgs = indexSheetSvg("測試", [row({ nameZh: longName })]);
    const allText = svgs.join("");
    expect(allText).toContain("…");
    expect(allText).not.toContain(longName);
  });

  it("A4 拼接模式（有 tiling 欄位）：印在哪張紙顯示「A4 ×N（cols×rows 拼接）」", () => {
    const svgs = indexSheetSvg("方凳", [
      row({ partNo: "P-01a", nameZh: "凳腳 1", placement: { paper: PAPERS.find((p) => p.id === "A4")!, angleDeg: 0, swapped: false },
        tiling: { landscape: true, cols: 2, rows: 1 } }),
    ]);
    const allText = svgs.join("");
    expect(allText).toContain("A4 ×2（2×1 拼接）");
  });

  it("A4 拼接但太大（tiling 沒有值、placement 為 null）：仍走既有的「太大 → 見零件圖」", () => {
    const svgs = indexSheetSvg("衣櫃", [row({ partNo: "P-09", nameZh: "背板", placement: null })]);
    expect(svgs.join("")).toContain("見零件圖");
  });

  it("A4 拼接模式：即使沒填校正，也提醒「實體邊緣本來就會對不齊」", () => {
    const svgs = indexSheetSvg("方凳", [
      row({
        partNo: "P-01a", nameZh: "凳腳 1",
        placement: { paper: PAPERS.find((p) => p.id === "A4")!, angleDeg: 0, swapped: false },
        tiling: { landscape: true, cols: 2, rows: 1 },
      }),
    ]);
    const allText = svgs.join("");
    expect(allText).toContain("對不齊");
    expect(allText).toContain("十字與線");
    // 沒傳 calibrationMeasuredMm，不該出現校正提醒的字樣。
    expect(allText).not.toContain("已經套用你量過的印表機校正");
  });

  it("A4 拼接模式＋有套用校正：索引頁多一行講清楚基準值與『維持 100%』", () => {
    const svgs = indexSheetSvg(
      "方凳",
      [
        row({
          partNo: "P-01a", nameZh: "凳腳 1",
          placement: { paper: PAPERS.find((p) => p.id === "A4")!, angleDeg: 0, swapped: false },
          tiling: { landscape: true, cols: 2, rows: 1 },
        }),
      ],
      248.75,
    );
    const allText = svgs.join("");
    // 索引頁四捨五入到小數點後 1 位（r1）——248.75 → 248.8。
    expect(allText).toContain("248.8mm");
    expect(allText).toContain("已經套用你量過的印表機校正");
    expect(allText).toContain("實際大小 / 100%");
    expect(allText).toContain("換另一台印表機要重新量一次");
  });

  it("不傳第三個參數（沒有校正）：索引頁跟原本（不帶 tiling）完全沒有分頁行為差異", () => {
    // hasA4=false 時，firstRowY／headY／paginate 都要走原本固定的 46/53/62，
    // 不受新加的動態版面邏輯影響——用「40 列分頁」那組 fixture 重跑一次確認容量沒變。
    const rows: PackRow[] = Array.from({ length: 40 }, (_, i) =>
      row({
        partNo: `P-${String(i + 1).padStart(2, "0")}`,
        nameZh: `零件${i + 1}`,
        placement: i % 3 === 0 ? null : { paper: A3, angleDeg: 0, swapped: false },
      }),
    );
    const before = indexSheetSvg("櫥櫃", rows);
    const after = indexSheetSvg("櫥櫃", rows, undefined);
    expect(after.length).toBe(before.length);
    expect(after.join("")).toBe(before.join(""));
  });

  it("頁碼標籤多頁時顯示，單頁時不顯示", () => {
    const rows = Array.from({ length: 34 }, (_, i) =>
      row({ partNo: `P-${String(i + 1).padStart(2, "0")}`, nameZh: `零件${i + 1}` }),
    );
    const svgs = indexSheetSvg("櫥櫃", rows);
    expect(svgs.length).toBeGreaterThan(1);
    expect(svgs[0]).toContain("第 1 頁 / 共");
    expect(svgs[1]).toContain("第 2 頁 / 共");
    expect(indexSheetSvg("櫥櫃", [row()])[0]).not.toContain("第 1 頁 / 共");
  });
});

/**
 * 「不需要樣板」跟「太大 → 見零件圖」是兩種狀態，索引上必須講得不一樣。
 * 混為一談的後果：使用者拿著衣櫃那 30 件純矩形跑去找根本不存在的零件圖。
 */
describe("純矩形零件的索引說法", () => {
  it("plainRect 的列寫「不需要樣板 · 直接量畫」，不寫「太大」", () => {
    const svgs = indexSheetSvg("衣櫃", [row({ placement: null, plainRect: true })]);
    const all = svgs.join("");
    expect(all).toContain("不需要樣板 · 直接量畫");
    expect(all).not.toContain("太大 → 見零件圖");
  });

  it("沒有 plainRect 的 null placement 仍然寫「太大 → 見零件圖」", () => {
    const svgs = indexSheetSvg("書桌", [row({ placement: null })]);
    expect(svgs.join("")).toContain("太大 → 見零件圖");
  });

  it("被判成不需要樣板的零件仍然要出現在索引上（不可無聲丟件）", () => {
    const svgs = indexSheetSvg("衣櫃", [
      row({ partNo: "P-07", nameZh: "前後底座板", placement: null, plainRect: true }),
    ]);
    const all = svgs.join("");
    expect(all).toContain("P-07");
    expect(all).toContain("前後底座板");
  });
});
