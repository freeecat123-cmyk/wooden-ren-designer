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

/**
 * hoof（馬蹄足）與 lathe-turned（車旋）：projectPartPolygon 早就有真實輪廓
 * （hoof 6 點外撇、lathe-turned 12 段車旋），但 projectPartSilhouette 沒有分支，
 * 於是吃幾何資料的下游（1:1 實尺樣板）拿到的是一根直條矩形。
 *
 * 中式方角櫃那四根 35×1478 的立柱在 A4 拼接模式**真的會印出來**（6 張），
 * 馬蹄那段在樣板上完全不存在 —— 照著描會做成直腳。
 */
describe("projectPartSilhouette — hoof / lathe-turned 走真實輪廓", () => {
  const post = part({
    visible: { length: 35, width: 35, thickness: 1478 },
    shape: { kind: "hoof", hoofMm: 120, hoofScale: 1.6 },
  } as Partial<Part> & { visible: Part["visible"] });

  it("馬蹄足正視不是矩形，腳底比料寬（外撇）", () => {
    const pts = projectPartSilhouette(post, "front");
    expect(pts.length).toBeGreaterThan(4);
    const b = bbox(pts);
    // hoofScale 1.6 → 腳底外撇到 35×1.6 = 56
    expect(b.w).toBeGreaterThan(35);
    expect(b.w).toBeCloseTo(56, 0);
    expect(b.h).toBeCloseTo(1478, 0);
  });

  it("馬蹄足俯視仍是矩形（方截面立柱，從上面看就是方的）", () => {
    const b = bbox(projectPartSilhouette(post, "top"));
    expect(b.w).toBeCloseTo(35, 0);
    expect(b.h).toBeCloseTo(35, 0);
  });

  it("帶旋轉的 hoof 不套用 —— view-name 硬畫的輪廓軸向會不對", () => {
    const tilted = part({
      visible: { length: 35, width: 35, thickness: 1478 },
      shape: { kind: "hoof", hoofMm: 120, hoofScale: 1.6 },
      rotation: { x: 0, y: 0, z: Math.PI / 2 },
    } as Partial<Part> & { visible: Part["visible"] });
    const b = bbox(projectPartSilhouette(tilted, "front"));
    // 橫躺後長邊變成水平；若誤用直立硬畫輪廓，寬會停在 56 左右
    expect(b.w).toBeCloseTo(1478, 0);
  });

  it("車旋立柱正視有車旋輪廓（不是一根直條）", () => {
    const column = part({
      visible: { length: 60, width: 60, thickness: 1664 },
      shape: { kind: "lathe-turned" },
    } as Partial<Part> & { visible: Part["visible"] });
    const pts = projectPartSilhouette(column, "front");
    expect(pts.length).toBeGreaterThan(8);
    // 輪廓沿高度會胖瘦變化：取幾個高度採樣，寬度不該全部一樣
    const widths = new Set(pts.map((q) => Math.round(Math.abs(q.x) * 10) / 10));
    expect(widths.size).toBeGreaterThan(2);
  });
});
