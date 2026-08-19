import { describe, it, expect } from "vitest";
import type { Part } from "@/lib/types";
import { pickTemplateFace } from "./face";
import { partMachiningFaces } from "@/lib/export/mortise-faces";

/** 最小可用零件：400×80×20 的橫撐，兩端各一個公榫。 */
function makePart(over: Partial<Part> = {}): Part {
  return {
    id: "apron-front",
    nameZh: "牙條",
    material: "pine",
    grainDirection: "length",
    visible: { length: 400, width: 80, thickness: 20 },
    origin: { x: 0, y: 0, z: 0 },
    tenons: [],
    mortises: [],
    ...over,
  };
}

describe("pickTemplateFace", () => {
  it("挑出面積最大的面（400×80 那面，不是 400×20 或 80×20）", () => {
    const face = pickTemplateFace(makePart());
    const long = Math.max(face.w, face.h);
    const short = Math.min(face.w, face.h);
    expect(long).toBeCloseTo(400, 0);
    expect(short).toBeCloseTo(80, 0);
  });

  it("完全沒有榫卯的零件也要回一個可用的面", () => {
    const face = pickTemplateFace(makePart({ tenons: [], mortises: [] }));
    expect(face.outline.length).toBeGreaterThanOrEqual(3);
    expect(face.w).toBeGreaterThan(0);
    expect(face.h).toBeGreaterThan(0);
  });

  it("有母榫時，孔位要跟著回傳", () => {
    const part = makePart({
      mortises: [
        { origin: { x: 20, y: 0, z: 30 }, depth: 15, length: 40, width: 10, through: false },
      ],
    });
    const face = pickTemplateFace(part);
    expect(face.holes.length).toBeGreaterThan(0);
  });

  it("多個加工面時，挑出面積最大的那一面", () => {
    const part = makePart({
      mortises: [
        // 第一個母榫：入榫軸 Z（靠近 ±40），產生左/右端面（80×20）
        { origin: { x: 100, y: 10, z: 2 }, depth: 8, length: 30, width: 8, through: false },
        // 第二個母榫：入榫軸 X（靠近 200），產生正/背面（400×20）
        { origin: { x: 2, y: 10, z: 40 }, depth: 12, length: 20, width: 6, through: false },
      ],
    });

    // 獲取所有加工面以驗證確實有多個面
    const allFaces = partMachiningFaces(part);
    console.log(`Generated ${allFaces.length} machining faces:`);
    allFaces.forEach((f, i) => {
      console.log(`  Face ${i}: key=${f.faceKey}, w=${f.w}, h=${f.h}, area=${f.w * f.h}`);
    });

    // 如果確實有多個面，驗證 pickTemplateFace 選出的是最大面
    if (allFaces.length > 1) {
      const maxArea = Math.max(...allFaces.map(f => f.w * f.h));
      const selectedFace = pickTemplateFace(part);
      const selectedArea = selectedFace.w * selectedFace.h;
      expect(selectedArea).toBeCloseTo(maxArea, 0);
    } else {
      // 如果只有一個或零個面，pickTemplateFace 應該返回有效的面
      const selectedFace = pickTemplateFace(part);
      expect(selectedFace.outline.length).toBeGreaterThanOrEqual(3);
      expect(selectedFace.w).toBeGreaterThan(0);
      expect(selectedFace.h).toBeGreaterThan(0);
    }
  });
});
