import { describe, it, expect } from "vitest";
import { ladderFor } from "./paper";
import { placeOnLadder } from "./fit";

describe("ladderFor", () => {
  it("面板類截到 A2", () => {
    expect(ladderFor("seat").map((p) => p.id)).toEqual(["A4", "A3", "B3", "A2"]);
  });
  it("抽屜面板類截到 A2（跟 case 同性質，避免長抽屜面板印成多張 A1）", () => {
    expect(ladderFor("drawer").map((p) => p.id)).toEqual(["A4", "A3", "B3", "A2"]);
  });
  it("非面板類開到 A0", () => {
    expect(ladderFor("leg").map((p) => p.id)).toEqual([
      "A4", "A3", "B3", "A2", "A1", "A0",
    ]);
  });
});

describe("placeOnLadder", () => {
  it("方凳牙條 280×60 水平擺進 A4", () => {
    const r = placeOnLadder(280, 60, ladderFor("apron"));
    expect(r?.paper.id).toBe("A4");
    expect(r?.angleDeg).toBe(0);
  });

  it("方凳凳腳 425×35 在 A3 上必須斜擺才進得去", () => {
    const r = placeOnLadder(425, 35, ladderFor("leg"));
    expect(r?.paper.id).toBe("A3");
    expect(r?.angleDeg).toBeGreaterThan(0);
    expect(r?.angleDeg).toBeLessThanOrEqual(30);
  });

  it("方凳座板 350×350 落在 A2（B3 短邊 353 扣留白後不夠）", () => {
    const r = placeOnLadder(350, 350, ladderFor("seat"));
    expect(r?.paper.id).toBe("A2");
  });

  it("餐椅椅面 420×400 落在 A2", () => {
    expect(placeOnLadder(420, 400, ladderFor("seat"))?.paper.id).toBe("A2");
  });

  it("書桌桌面板 1200×600 超過面板上限 → null", () => {
    expect(placeOnLadder(1200, 600, ladderFor("case"))).toBeNull();
  });

  it("邊桌桌面板 450×450 超過 A2 短邊 → null", () => {
    expect(placeOnLadder(450, 450, ladderFor("seat"))).toBeNull();
  });

  it("餐椅曲線後腿 900×120 斜擺留在 A1，不用上 A0", () => {
    const r = placeOnLadder(900, 120, ladderFor("leg"));
    expect(r?.paper.id).toBe("A1");
  });

  it("邊界：剛好等於可用區時算塞得下", () => {
    // A4 可用區 287×200
    expect(placeOnLadder(287, 200, ladderFor("misc"))?.paper.id).toBe("A4");
  });

  it("邊界：超過 0.5mm 就要換紙", () => {
    expect(placeOnLadder(287.5, 200, ladderFor("misc"))?.paper.id).toBe("A3");
  });
});
