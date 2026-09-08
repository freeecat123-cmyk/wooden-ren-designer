/**
 * quad plane="yz"：四角落在厚度×寬度的端面剖面、沿長度擠出——板端斜切用
 * （丙級第二題頂板：頂面深 91.6、底面短 2.06，前端順門的傾角）。
 * 三視圖：側視要是梯形（4 個不同點）、正視 / 俯視仍是矩形。3D：8 個頂點、+z 端的兩個 z 不同。
 */
import { describe, it, expect } from "vitest";
import { projectPartPolygon } from "@/lib/render/geometry";
import { buildQuadGeometry } from "@/lib/render/part-geometry";
import type { Part } from "@/lib/types";

const bevel = 2.06;
const board: Part = {
  id: "top-board", nameZh: "頂板", material: "pine", grainDirection: "length",
  visible: { length: 264, width: 91.6, thickness: 18 },
  origin: { x: 0, y: 282, z: -14.2 }, tenons: [], mortises: [],
  shape: { kind: "quad", plane: "yz", corners: [[-9, -45.8], [9, -45.8], [9, 45.8], [-9, 45.8 - bevel]] },
} as Part;
const round = (p: { x: number; y: number }) => `${Math.round(p.x * 10) / 10},${Math.round(p.y * 10) / 10}`;

describe("quad plane=yz（板端斜切）", () => {
  it("側視：梯形，底面前端比頂面短 2.06", () => {
    const poly = projectPartPolygon(board, "side");
    expect(poly).toHaveLength(4);
    const xs = poly.map((p) => Math.round(p.x * 100) / 100);
    // 側視 x 軸＝−世界 z：前端（+z）落在 x 最小；兩個前端點 x 相差 bevel
    const front = [...xs].sort((a, b) => a - b).slice(0, 2);
    expect(Math.abs(front[1] - front[0])).toBeCloseTo(bevel, 1);
  });
  it("正視／俯視：仍是矩形（264×18、264×91.6）", () => {
    for (const [view, w, h] of [["front", 264, 18], ["top", 264, 91.6]] as const) {
      const poly = projectPartPolygon(board, view);
      const xs = poly.map((p) => p.x), ys = poly.map((p) => p.y);
      expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(w, 1);
      expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(h, 1);
    }
  });
  it("3D：8 個頂點，+z 端上下兩排 z 相差 bevel；plane 省略時走原本的 xz 擠出", () => {
    const g = buildQuadGeometry([264, 18, 91.6], (board.shape as any).corners, "yz");
    const pos = g.getAttribute("position");
    expect(pos.count).toBe(8);
    const zs = new Set<number>();
    for (let i = 0; i < pos.count; i++) zs.add(Math.round(pos.getZ(i) * 100) / 100);
    expect([...zs].sort((a, b) => a - b)).toEqual([-45.8, Math.round((45.8 - bevel) * 100) / 100, 45.8]);
    const gx = buildQuadGeometry([264, 18, 91.6], (board.shape as any).corners);
    const px = gx.getAttribute("position");
    const ys = new Set<number>();
    for (let i = 0; i < px.count; i++) ys.add(Math.round(px.getY(i) * 100) / 100);
    expect([...ys]).toEqual([-9, 9]);
  });
  it("變異：拿掉 plane → 側視退回矩形（證明是 yz 分支在作用）", () => {
    const flat = { ...board, shape: { ...(board.shape as any), plane: undefined } };
    const poly = projectPartPolygon(flat as Part, "side");
    const xs = poly.map((p) => Math.round(p.x * 100) / 100);
    expect(new Set(xs).size).toBe(2);
  });
});
