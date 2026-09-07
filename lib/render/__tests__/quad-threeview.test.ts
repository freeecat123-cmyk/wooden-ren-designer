/**
 * 三視圖要把 quad 側板畫成四邊形，不是矩形。
 * 🩸2026-09-07 projectPartPolygon 不認得 quad → fallback 成 AABB 矩形，
 * 側視圖上斜切的三條邊全部不見（技能檢定家具木工丙級 01200-100301 的考點就是那三條斜邊）。
 */
import { describe, it, expect } from "vitest";
import { projectPartPolygon } from "@/lib/render/geometry";
import { sidePanelQuad } from "@/lib/render/quad-profile";
import type { Part } from "@/lib/types";

const side: Part = {
  id: "side-left", nameZh: "左側板", material: "pine", grainDirection: "width",
  visible: { length: 120, width: 350, thickness: 18 },
  origin: { x: -141, y: 0, z: 0 },
  rotation: { x: Math.PI / 2, y: Math.PI / 2, z: 0 },
  shape: { kind: "quad", corners: sidePanelQuad({ lx: 120, lz: 350, bottomDepth: 95, topDropFront: 30, bottomRiseFront: 15, backSide: "max" }) },
  tenons: [], mortises: [],
} as Part;

const round = (p: { x: number; y: number }) => `${Math.round(p.x)},${Math.round(p.y)}`;

describe("quad 側板的三視圖輪廓", () => {
  it("側視圖：四個角＝背上 / 背下 / 前下（升 15）/ 前上（降 30），不是矩形", () => {
    const poly = projectPartPolygon(side, "side");
    expect(poly).toHaveLength(4);
    const pts = new Set(poly.map(round));
    // 側視 x 軸＝−世界 z（背在 +60）；y＝世界高度
    expect(pts).toEqual(new Set(["60,0", "60,350", "-35,15", "-60,320"]));
  });
  it("正視圖：看的是 18 厚的邊，仍是 18×350 的矩形", () => {
    const poly = projectPartPolygon(side, "front");
    const xs = poly.map((p) => Math.round(p.x)), ys = poly.map((p) => Math.round(p.y));
    expect(Math.max(...xs) - Math.min(...xs)).toBe(18);
    expect(Math.max(...ys) - Math.min(...ys)).toBe(350);
  });
  it("拿掉 quad 形狀 → 側視退回 120×350 矩形（證明是 quad 分支在作用）", () => {
    const poly = projectPartPolygon({ ...side, shape: undefined }, "side");
    const pts = new Set(poly.map(round));
    expect(pts).toEqual(new Set(["-60,0", "60,0", "60,350", "-60,350"]));
  });
});
