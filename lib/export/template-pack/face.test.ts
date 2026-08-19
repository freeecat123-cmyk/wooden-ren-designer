import { describe, it, expect } from "vitest";
import type { Part } from "@/lib/types";
import { pickTemplateFace } from "./face";

/** 最小可用零件：400×80×20 的橫撐，兩端各一個公榫。 */
function makePart(over: Partial<Part> = {}): Part {
  return {
    id: "apron-front",
    nameZh: "牙條",
    material: "pine",
    grainDirection: "length",
    visible: { length: 400, width: 80, thickness: 20 },
    tenons: [],
    mortises: [],
    ...over,
  } as Part;
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
});
