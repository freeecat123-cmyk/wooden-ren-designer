import { describe, it, expect } from "vitest";
import { projectPartSilhouette } from "./geometry";
import type { MaterialId, Part } from "@/lib/types";

/**
 * round 家族的「圓截面沿哪個軸擠出」判定。
 *
 * 舊條件是 `longestIsY`（thickness 最長 = 圓柱腳）。圓盤（圓桌面、圓座板）
 * 的 thickness 是最短邊，判不出來 → 掉進通用 bbox 角採樣 → 俯視輪廓變成一個
 * **正方形**。3D 跟三視圖看起來沒事是因為 svg-views 在繪圖層自己改畫圓
 * （projectPartPolygon 的註解就寫著「俯視維持矩形，caller 改畫圓」），
 * 但任何吃幾何資料的下游（1:1 實尺樣板）拿到的就是那個正方形。
 *
 * 正確依據不是「哪邊最長」，是「哪兩邊相等」——圓截面所在的那兩軸必然等長。
 */
function part(over: Partial<Part> & { visible: Part["visible"] }): Part {
  return {
    id: "test",
    nameZh: "測試件",
    material: "maple" as MaterialId,
    grainDirection: "length",
    origin: { x: 0, y: 0, z: 0 },
    tenons: [],
    mortises: [],
    ...over,
  } as Part;
}

/** 輪廓的外接矩形。 */
function bbox(pts: Array<{ x: number; y: number }>) {
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  return {
    w: Math.max(...xs) - Math.min(...xs),
    h: Math.max(...ys) - Math.min(...ys),
  };
}

/** 四個角是不是都貼在外接矩形上（= 這是個矩形輪廓，不是圓）。 */
function looksRectangular(pts: Array<{ x: number; y: number }>) {
  return pts.length <= 5;
}

describe("projectPartSilhouette — round 圓盤", () => {
  const roundTop = part({
    visible: { length: 700, width: 700, thickness: 25 },
    shape: { kind: "round", chamferMm: 1, chamferStyle: "chamfered" },
  } as Partial<Part> & { visible: Part["visible"] });

  it("圓桌面俯視是圓，不是正方形", () => {
    const pts = projectPartSilhouette(roundTop, "top");
    expect(looksRectangular(pts)).toBe(false);
    const b = bbox(pts);
    expect(b.w).toBeCloseTo(700, 0);
    expect(b.h).toBeCloseTo(700, 0);
  });

  it("圓桌面俯視每個點都落在半徑上（真的是圓，不是多邊形亂數）", () => {
    const pts = projectPartSilhouette(roundTop, "top");
    for (const p of pts) {
      const r = Math.hypot(p.x, p.y);
      expect(r).toBeGreaterThan(340);
      expect(r).toBeLessThan(355);
    }
  });

  it("700mm 圓的採樣密度要夠細——1:1 描邊誤差 < 0.3mm", () => {
    // 固定 16 點對小零件夠用,對 700mm 圓盤的弦中點誤差是 R(1−cos(π/N))
    // = 350×(1−cos(π/16)) ≈ 6.7mm。木工照著這條線描就切錯 6.7mm,
    // 這正是 1:1 樣板唯一不能妥協的地方。
    const pts = projectPartSilhouette(roundTop, "top");
    const n = pts.length;
    const sagitta = 350 * (1 - Math.cos(Math.PI / n));
    expect(sagitta).toBeLessThan(0.3);
  });

  it("小圓件不會為了精度爆出無意義的點數", () => {
    const knob = part({
      visible: { length: 30, width: 30, thickness: 20 },
      shape: { kind: "round" },
    } as Partial<Part> & { visible: Part["visible"] });
    expect(projectPartSilhouette(knob, "top").length).toBeLessThanOrEqual(32);
  });

  it("圓桌面正視仍是矩形（700 寬 × 25 厚）—— 側面看圓盤就是一條板", () => {
    const b = bbox(projectPartSilhouette(roundTop, "front"));
    expect(b.w).toBeCloseTo(700, 0);
    expect(b.h).toBeCloseTo(25, 0);
  });

  it("圓柱腳（thickness 最長）維持原本行為不變", () => {
    const leg = part({
      visible: { length: 40, width: 40, thickness: 450 },
      shape: { kind: "round" },
    } as Partial<Part> & { visible: Part["visible"] });
    const b = bbox(projectPartSilhouette(leg, "top"));
    expect(b.w).toBeCloseTo(40, 0);
    expect(b.h).toBeCloseTo(40, 0);
  });

  it("橫向圓桿（圓截面在 Y-Z，沿 X 擠出）維持原本行為不變", () => {
    const rung = part({
      visible: { length: 300, width: 20, thickness: 20 },
      shape: { kind: "round" },
    } as Partial<Part> & { visible: Part["visible"] });
    const b = bbox(projectPartSilhouette(rung, "front"));
    expect(b.w).toBeCloseTo(300, 0);
    expect(b.h).toBeCloseTo(20, 0);
  });
});
