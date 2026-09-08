/**
 * quad 頂邊折點（topBreak）：頂邊「先平一段再斜」的五角側板（丙級第三題）。
 * 取樣／三視圖／3D 都要多出那個點；拿掉折點就退回四角。
 */
import { describe, it, expect } from "vitest";
import { quadPoint } from "@/lib/render/quad-profile";
import { projectPartPolygon } from "@/lib/render/geometry";
import { buildQuadGeometry } from "@/lib/render/part-geometry";
import type { Part } from "@/lib/types";

const corners: [[number, number], [number, number], [number, number], [number, number]] = [[-57.5, -60.4], [57.5, -115], [57.5, 115], [-57.5, 115]];
const topBreak: [number, number] = [39.5, -115];
const part: Part = {
  id: "side-back-left", nameZh: "後片", material: "pine", grainDirection: "width",
  visible: { length: 115, width: 230, thickness: 18 }, origin: { x: -141, y: 0, z: -62.5 },
  rotation: { x: Math.PI / 2, y: Math.PI / 2, z: 0 }, tenons: [], mortises: [],
  shape: { kind: "quad", corners, topBreak },
} as Part;

describe("quad topBreak", () => {
  it("quadPoint：折點處回傳折點本身，平段內 z 維持 −115，折點前是斜線", () => {
    const ub = (39.5 + 57.5) / 115; // 0.8435
    expect(quadPoint(corners, 2 * ub - 1, -1, topBreak).map((n) => Math.round(n * 10) / 10)).toEqual([39.5, -115]);
    expect(quadPoint(corners, 0.95, -1, topBreak)[1]).toBeCloseTo(-115, 6);
    const mid = quadPoint(corners, 0, -1, topBreak);   // u=0.5 在斜段中間
    expect(mid[1]).toBeGreaterThan(-115); expect(mid[1]).toBeLessThan(-60.4);
    // 沒折點：頂邊是直線，u=0.5 → (−60.4−115)/2
    expect(quadPoint(corners, 0, -1)[1]).toBeCloseTo((-60.4 - 115) / 2, 6);
  });
  it("側視輪廓 5 點且含平段兩端；拿掉折點 → 4 點", () => {
    const pts = projectPartPolygon(part, "side").map((p) => `${Math.round(p.x)},${Math.round(p.y)}`);
    expect(pts).toHaveLength(5);
    expect(pts).toContain("120,230"); expect(pts).toContain("102,230");
    const plain = projectPartPolygon({ ...part, shape: { kind: "quad", corners } } as Part, "side");
    expect(plain).toHaveLength(4);
  });
  it("3D：五角柱 10 個頂點、30 個三角形索引；沒折點 8 個", () => {
    const g = buildQuadGeometry([115, 18, 230], corners, "xz", topBreak);
    expect(g.getAttribute("position").count).toBe(10);
    expect(g.getIndex()!.count).toBe((3 * 2 + 5 * 2) * 3);   // 端面 3+3 三角、側面 5×2 三角
    expect(buildQuadGeometry([115, 18, 230], corners).getAttribute("position").count).toBe(8);
  });
});

describe("topBreak 驗證（審查員 2026-09-08）", () => {
  it("折點 x 超出兩角之間 → 忽略：頂邊退回直線、側視 4 點、3D 8 頂點", () => {
    const bad: [number, number] = [80, -115];
    expect(quadPoint(corners, 1, -1, bad)).toEqual(quadPoint(corners, 1, -1));
    expect(projectPartPolygon({ ...part, shape: { kind: "quad", corners, topBreak: bad } } as Part, "side")).toHaveLength(4);
    expect(buildQuadGeometry([115, 18, 230], corners, "xz", bad).getAttribute("position").count).toBe(8);
  });
  it("折點凹進板內（z 在兩角連線之下）→ 忽略", () => {
    const concave: [number, number] = [0, -60];
    expect(projectPartPolygon({ ...part, shape: { kind: "quad", corners, topBreak: concave } } as Part, "side")).toHaveLength(4);
  });
});

describe("五角柱法線（2026-09-08 木頭仁：「板子的表面消失了，直接看到裡面的榫」）", () => {
  it("每個三角形的法線都朝離心方向（正面剔除後不會透明）", async () => {
    const { Vector3 } = await import("three");
    for (const g of [buildQuadGeometry([115, 18, 230], corners, "xz", topBreak), buildQuadGeometry([115, 18, 230], corners)]) {
      const pos = g.getAttribute("position"); const idx = g.getIndex()!;
      const c = new Vector3(); for (let i = 0; i < pos.count; i++) c.add(new Vector3(pos.getX(i), pos.getY(i), pos.getZ(i))); c.divideScalar(pos.count);
      let bad = 0;
      for (let t = 0; t < idx.count; t += 3) {
        const a = new Vector3().fromBufferAttribute(pos, idx.getX(t)), b = new Vector3().fromBufferAttribute(pos, idx.getX(t + 1)), d = new Vector3().fromBufferAttribute(pos, idx.getX(t + 2));
        const n = new Vector3().subVectors(b, a).cross(new Vector3().subVectors(d, a));
        const centroid = new Vector3().add(a).add(b).add(d).divideScalar(3);
        if (n.dot(new Vector3().subVectors(centroid, c)) < 0) bad++;
      }
      expect(bad).toBe(0);
    }
  });
});
