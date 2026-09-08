import { describe, it, expect } from "vitest";
import { dowelDims } from "@/lib/render/dowel-dims";
import type { Part } from "@/lib/types";
const mk = (axis: "x" | "y" | "z", v: [number, number, number]): Part => ({ id: "d", nameZh: "木釘", material: "pine", grainDirection: "length", visible: { length: v[0], width: v[1], thickness: v[2] }, origin: { x: 0, y: 0, z: 0 }, shape: { kind: "round", axis }, visual: "dowel", tenons: [], mortises: [] } as Part);
describe("dowelDims 照軸取直徑與長度", () => {
  it("沿 x：30×8×8 → Ø8×30", () => expect(dowelDims(mk("x", [30, 8, 8]))).toEqual({ dia: 8, len: 30 }));
  it("沿 z：8×30×8 → Ø8×30（材料單原本印成 Ø8×8）", () => expect(dowelDims(mk("z", [8, 30, 8]))).toEqual({ dia: 8, len: 30 }));
  it("沿 y：8×8×30 → Ø8×30", () => expect(dowelDims(mk("y", [8, 8, 30]))).toEqual({ dia: 8, len: 30 }));
});
