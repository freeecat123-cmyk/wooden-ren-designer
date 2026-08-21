import { describe, it, expect } from "vitest";
import { ladderForOutline, FULL_LADDER } from "./paper";
import { placeOnLadder } from "./fit";

/** 純矩形輪廓（四角）。 */
function rect(w: number, h: number) {
  return [
    { x: 0, y: 0 },
    { x: w, y: 0 },
    { x: w, y: h },
    { x: 0, y: h },
  ];
}

/** 切角輪廓——「用尺畫不出來」的代表。 */
function notched(w: number, h: number) {
  return [
    { x: 0, y: 0 },
    { x: w, y: 0 },
    { x: w, y: h - 20 },
    { x: w - 20, y: h },
    { x: 0, y: h },
  ];
}

/**
 * 紙張上限改用「輪廓是不是矩形」判定（2026-08-21，取代原本綁 PartCategory 的
 * 面板類封頂 A2）。
 *
 * 舊規則誤傷：有 dado／切角的側板（鞋櫃 906×350、斗櫃 816×450）被分類判成面板、
 * 封頂 A2、整個拿不到樣板；反過來一片 900×350 只有 2 個孔的矩形頂板，卻可能
 * 吃掉一整張 A0。
 *
 * 註：圓桌面那類曲線件此刻還走不到「非矩形」這條分支——partMachiningFaces 回的
 * 是外接矩形。等真實輪廓算出來，它自然會落進來，這個函式不用再改。
 *
 * 新規則：用尺畫不出來的（圓形、曲線、切角）開到 A0；矩形板不管幾個孔都封頂
 * A2——矩形的孔位用零件圖量兩個數字就標出來了，1:1 沒有比較快，不值得那張紙。
 */
describe("ladderForOutline", () => {
  it("矩形輪廓封頂 A2", () => {
    expect(ladderForOutline(rect(450, 450)).map((p) => p.id)).toEqual(["A4", "A3", "B3", "A2"]);
  });

  it("非矩形輪廓開到 A0", () => {
    expect(ladderForOutline(notched(786, 300)).map((p) => p.id)).toEqual(FULL_LADDER.map((p) => p.id));
  });

  it("孔多寡不影響上限——判的是輪廓，不是資訊量", () => {
    // 同一個矩形，帶不帶孔都一樣封頂 A2（孔位資訊由零件圖負責）
    expect(ladderForOutline(rect(900, 350)).map((p) => p.id)).toEqual(["A4", "A3", "B3", "A2"]);
  });
});

describe("placeOnLadder", () => {
  it("方凳牙條 280×60 水平擺進 A4", () => {
    const r = placeOnLadder(280, 60, ladderForOutline(rect(280, 60)));
    expect(r?.paper.id).toBe("A4");
    expect(r?.angleDeg).toBe(0);
  });

  it("方凳凳腳 425×35 在 A3 上必須斜擺才進得去", () => {
    const r = placeOnLadder(425, 35, ladderForOutline(rect(425, 35)));
    expect(r?.paper.id).toBe("A3");
    expect(r?.angleDeg).toBeGreaterThan(0);
    expect(r?.angleDeg).toBeLessThanOrEqual(30);
  });

  it("方凳座板 350×350 落在 A2（B3 短邊 353 扣留白後不夠）", () => {
    const r = placeOnLadder(350, 350, ladderForOutline(rect(350, 350)));
    expect(r?.paper.id).toBe("A2");
  });

  it("餐椅椅面 420×400 落在 A2", () => {
    expect(placeOnLadder(420, 400, ladderForOutline(rect(420, 400)))?.paper.id).toBe("A2");
  });

  it("書桌桌面板 1200×600 是矩形 → 封頂 A2 → null", () => {
    expect(placeOnLadder(1200, 600, ladderForOutline(rect(1200, 600)))).toBeNull();
  });

  it("餐椅座板 450×450 有切角 → 開到 A1，不再被誤殺", () => {
    // 舊規則（面板類封頂 A2）在這裡回 null，使用者拿不到最需要 1:1 的那張
    expect(placeOnLadder(450, 450, ladderForOutline(notched(450, 450)))?.paper.id).toBe("A1");
  });

  it("圓茶几 700×700 圓桌面 → A0（圓形件的 1:1 價值最高）", () => {
    expect(placeOnLadder(700, 700, ladderForOutline(notched(700, 700)))?.paper.id).toBe("A0");
  });

  it("餐椅曲線後腿 900×120 斜擺留在 A1，不用上 A0", () => {
    const r = placeOnLadder(900, 120, ladderForOutline(notched(900, 120)));
    expect(r?.paper.id).toBe("A1");
  });

  it("邊界：剛好等於可用區時算塞得下", () => {
    // A4 可用區 287×200
    expect(placeOnLadder(287, 200, FULL_LADDER)?.paper.id).toBe("A4");
  });

  it("邊界：超過 0.5mm 就要換紙", () => {
    expect(placeOnLadder(287.5, 200, FULL_LADDER)?.paper.id).toBe("A3");
  });
});
