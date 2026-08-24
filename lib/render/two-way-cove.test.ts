import { describe, it, expect } from "vitest";
import { projectPartSilhouette, projectPartPolygon, curvedTaperProfilePoints } from "./geometry";
import { curvedTaperInsetAtY } from "./part-geometry";
import { FURNITURE_CATALOG } from "@/lib/templates";

/**
 * 兩向弧肩（§A9.9）：把同一道「方肩→凹弧→斜降」同時做在兩個相鄰內面。
 *
 * 腳站在家具角落，兩個方向都有牙條進來，本來就該有兩道弧肩。
 * 現有做法是「單一側面輪廓沿厚度擠出」→ 只有一面有造型，從另一邊看是方料。
 *
 * ⚠️ 最重要的一條：**關掉時輸出必須跟改動前完全一致**。
 */
const leg = (twoWay: boolean, extra: Record<string, unknown> = {}) => ({
  id: "leg-1", nameZh: "腳", material: "maple", grainDirection: "length",
  visible: { length: 60, width: 60, thickness: 420 },
  origin: { x: 0, y: 210, z: 0 }, tenons: [], mortises: [],
  shape: {
    kind: "curved-taper", blockHeightMm: 40, shoulderMm: 8, insetMm: 12, dir: 1,
    ...(twoWay ? { twoWay: true } : {}), ...extra,
  },
}) as never;

describe("內縮函式跟原本的輪廓點必須逐點一致", () => {
  it("同一組參數下，兩者算出的內面 X 完全相同（誤差 < 0.001mm）", () => {
    const lx = 60, ly = 420;
    const pts = curvedTaperProfilePoints(lx, ly, 40, 8, 12, 1);
    for (const [x, y] of pts) {
      if (x > 0) continue; // 只比內面
      expect(-lx / 2 + curvedTaperInsetAtY(lx, ly, 40, 8, 12, y)).toBeCloseTo(x, 3);
    }
  });

  it("三段各自的行為：方肩段 0、弧段遞增、斜降段最深", () => {
    const f = (y: number) => curvedTaperInsetAtY(60, 420, 40, 8, 12, y);
    expect(f(210)).toBeCloseTo(0, 6);       // 頂
    expect(f(180)).toBeCloseTo(0, 6);       // 方肩段內
    expect(f(-210)).toBeCloseTo(8 + 12, 6); // 腳底 = shoulder + inset
    expect(f(0)).toBeGreaterThan(8);        // 斜降段
    expect(f(0)).toBeLessThan(8 + 12);
  });
});

describe("⚠️ 關掉兩向時，三視圖輸出跟改動前完全一致", () => {
  for (const view of ["front", "side", "top"] as const) {
    it(`${view}：單向的 silhouette 不受影響`, () => {
      const off = projectPartSilhouette(leg(false), view);
      // 單向側視本來就是方框(4 點)、正視是輪廓(13 點)
      expect(off.length).toBe(view === "front" ? 13 : 4);
    });
  }

  it("單向的側視 polygon 仍是矩形", () => {
    expect(projectPartPolygon(leg(false), "side").length).toBe(4);
  });
});

describe("開啟兩向後，只有側視改變", () => {
  it("正視不動（那一面本來就有弧肩）", () => {
    expect(JSON.stringify(projectPartSilhouette(leg(true), "front")))
      .toBe(JSON.stringify(projectPartSilhouette(leg(false), "front")));
  });

  it("俯視不動（斷面最寬處在頂部，本來就是矩形）", () => {
    expect(JSON.stringify(projectPartSilhouette(leg(true), "top")))
      .toBe(JSON.stringify(projectPartSilhouette(leg(false), "top")));
  });

  it("⭐ 側視從 4 點方框變成 13 點輪廓", () => {
    expect(projectPartSilhouette(leg(false), "side").length).toBe(4);
    expect(projectPartSilhouette(leg(true), "side").length).toBe(13);
  });

  it("側視 polygon 也要跟著變（三視圖實際畫的是它）", () => {
    expect(projectPartPolygon(leg(false), "side").length).toBe(4);
    expect(projectPartPolygon(leg(true), "side").length).toBe(13);
  });

  it("側視輪廓確實是凹的（不是被 hull 填平成方框）", () => {
    const poly = projectPartPolygon(leg(true), "side") as Array<{ x: number; y: number }>;
    const xs = poly.map((p) => p.x);
    // 有中間值不落在兩端 → 代表有階梯與弧，不是矩形
    expect(new Set(xs.map((x) => x.toFixed(2))).size).toBeGreaterThan(2);
  });
});

describe("三款有弧肩斜腳的家具，開兩向後輪廓都合法", () => {
  for (const cat of ["stool", "bar-stool", "dining-chair"]) {
    it(cat, () => {
      const e = (FURNITURE_CATALOG as never[] as any[]).find((x) => x.category === cat)!;
      const base: any = (e.optionSchema ?? []).reduce((a: any, s: any) => ((a[s.key] = s.defaultValue), a), {});
      const d = e.template({
        length: e.defaults.length, width: e.defaults.width, height: e.defaults.height,
        material: "maple", options: { ...base, legShape: "curved-taper", ctTwoWay: true },
      });
      const legs = (d.parts as any[]).filter((p) => p.shape?.kind === "curved-taper");
      expect(legs.length).toBeGreaterThan(0);
      for (const p of legs) {
        for (const v of ["front", "side", "top"] as const) {
          const poly = projectPartSilhouette(p, v) as Array<{ x: number; y: number }>;
          expect(poly.length, `${cat} ${v} 點數`).toBeGreaterThanOrEqual(3);
          expect(poly.every((q) => Number.isFinite(q.x) && Number.isFinite(q.y))).toBe(true);
          let area = 0;
          for (let i = 0; i < poly.length; i++) {
            const a = poly[i], b = poly[(i + 1) % poly.length];
            area += a.x * b.y - b.x * a.y;
          }
          expect(Math.abs(area / 2), `${cat} ${v} 面積`).toBeGreaterThan(1);
        }
      }
    });
  }
});
