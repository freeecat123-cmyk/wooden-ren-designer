import { describe, it, expect } from "vitest";
import { faceNeedsTemplate } from "./needs-template";
import type { MachiningFace } from "@/lib/export/mortise-faces";

function face(partial: Partial<MachiningFace>): MachiningFace {
  return {
    faceKey: "front",
    faceLabelZh: "正面",
    outline: [
      { x: 0, y: 0 },
      { x: 400, y: 0 },
      { x: 400, y: 80 },
      { x: 0, y: 80 },
    ],
    holes: [],
    tenons: [],
    w: 400,
    h: 80,
    ...partial,
  } as MachiningFace;
}

describe("faceNeedsTemplate", () => {
  it("零孔零榫的純矩形不需要樣板（量兩個數字畫線就切了）", () => {
    expect(faceNeedsTemplate(face({}))).toBe(false);
  });

  it("有榫孔就要樣板——孔位才是照著描的理由", () => {
    expect(
      faceNeedsTemplate(
        face({ holes: [{ kind: "rect", pts: [], through: true, label: "" }] as unknown as MachiningFace["holes"] }),
      ),
    ).toBe(true);
  });

  it("有公榫就要樣板", () => {
    expect(
      faceNeedsTemplate(face({ tenons: [{ pts: [] }] as unknown as MachiningFace["tenons"] })),
    ).toBe(true);
  });

  it("非矩形輪廓就要樣板——曲線件正是最需要 1:1 的", () => {
    const curved = face({
      outline: [
        { x: 0, y: 0 },
        { x: 400, y: 0 },
        { x: 400, y: 60 },
        { x: 200, y: 80 },
        { x: 0, y: 60 },
      ],
    });
    expect(faceNeedsTemplate(curved)).toBe(true);
  });

  it("切角（4 點但不是矩形）要樣板", () => {
    const trapezoid = face({
      outline: [
        { x: 0, y: 0 },
        { x: 400, y: 0 },
        { x: 360, y: 80 },
        { x: 40, y: 80 },
      ],
    });
    expect(faceNeedsTemplate(trapezoid)).toBe(true);
  });

  it("點的順序不影響判定（順時針/逆時針/從哪個角起算都算矩形）", () => {
    const reordered = face({
      outline: [
        { x: 400, y: 80 },
        { x: 0, y: 80 },
        { x: 0, y: 0 },
        { x: 400, y: 0 },
      ],
    });
    expect(faceNeedsTemplate(reordered)).toBe(false);
  });

  it("0.05mm 以內的浮點毛邊仍算矩形——幾何運算的殘差不該讓整批純矩形又冒出來", () => {
    const jittery = face({
      outline: [
        { x: 0.01, y: -0.02 },
        { x: 400.02, y: 0.01 },
        { x: 399.98, y: 80.03 },
        { x: -0.01, y: 79.99 },
      ],
    });
    expect(faceNeedsTemplate(jittery)).toBe(false);
  });

  it("差 1mm 的斜邊不算矩形——真的歪掉就要出樣板", () => {
    const skew = face({
      outline: [
        { x: 0, y: 0 },
        { x: 400, y: 0 },
        { x: 399, y: 80 },
        { x: 1, y: 80 },
      ],
    });
    expect(faceNeedsTemplate(skew)).toBe(true);
  });

  it("點數不是 4 就要樣板（重複收尾點也算，寧可多印一張也不要漏掉輪廓資訊）", () => {
    const closed = face({
      outline: [
        { x: 0, y: 0 },
        { x: 400, y: 0 },
        { x: 400, y: 80 },
        { x: 0, y: 80 },
        { x: 0, y: 0 },
      ],
    });
    expect(faceNeedsTemplate(closed)).toBe(true);
  });
});
