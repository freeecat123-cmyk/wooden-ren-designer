import { describe, expect, it } from "vitest";
import {
  countInflections,
  evalBSpline,
  interpolateBSpline,
  profileWidthAt,
  projectSweptOutline,
  sampleCenterline,
  sweptCapRing,
  sweptDistanceToSolid,
  sweptEndpoints,
  profileLoops,
  sweptSurfaceRings,
  sweptFrames,
  sweptLocalAABB,
  sweptPartFromWorldPoints,
  type SweptCurveShape,
  type Vec3,
} from "./swept-curve";
import { convexHull2D } from "@/lib/render/geometry";

const circlePts = (R: number, n: number, degSpan = 270): Vec3[] => {
  const out: Vec3[] = [];
  for (let i = 0; i < n; i++) {
    const a = ((-degSpan / 2 + (degSpan * i) / (n - 1)) * Math.PI) / 180;
    out.push({ x: R * Math.sin(a), y: 0, z: R * Math.cos(a) });
  }
  return out;
};
const dist = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const pointToPolyline = (p: Vec3, poly: Vec3[]) => {
  let best = Infinity;
  for (let i = 0; i + 1 < poly.length; i++) {
    const a = poly[i], b = poly[i + 1];
    const ab = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
    const L2 = ab.x * ab.x + ab.y * ab.y + ab.z * ab.z || 1;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * ab.x + (p.y - a.y) * ab.y + (p.z - a.z) * ab.z) / L2));
    best = Math.min(best, dist(p, { x: a.x + ab.x * t, y: a.y + ab.y * t, z: a.z + ab.z * t }));
  }
  return best;
};

describe("swept-curve §S2 B-spline 內插", () => {
  it("內插曲線經過每個經過點（chord-length 參數化 + knot 平均）", () => {
    const pts = circlePts(300, 9);
    const fit = interpolateBSpline(pts);
    expect(fit.controlPoints).toHaveLength(9);
    expect(fit.knots).toHaveLength(9 + 3 + 1);
    const shape: SweptCurveShape = { kind: "swept-curve", controlPoints: fit.controlPoints, knots: fit.knots, profile: { type: "round", radiusStart: 10, radiusEnd: 10 } };
    const s = sampleCenterline(shape);
    for (const p of pts) expect(pointToPolyline(p, s.points)).toBeLessThan(0.15);
    // 首尾剛好是端點（clamped）
    expect(dist(s.points[0], pts[0])).toBeLessThan(1e-6);
    expect(dist(s.points[s.points.length - 1], pts[pts.length - 1])).toBeLessThan(1e-6);
  });

  it("9 點內插的 ¾ 圓，半徑誤差 < 1.5mm（§S7 圈椅椅圈近似）", () => {
    const fit = interpolateBSpline(circlePts(300, 9));
    const shape: SweptCurveShape = { kind: "swept-curve", controlPoints: fit.controlPoints, knots: fit.knots, profile: { type: "round", radiusStart: 10, radiusEnd: 10 } };
    const s = sampleCenterline(shape);
    const maxDev = Math.max(...s.points.map((p) => Math.abs(Math.hypot(p.x, p.z) - 300)));
    expect(maxDev).toBeLessThan(1.5);
  });

  it("變異：把一個經過點往內推 8mm，半徑檢查必須紅", () => {
    const pts = circlePts(300, 9);
    pts[4] = { x: pts[4].x * (292 / 300), y: 0, z: pts[4].z * (292 / 300) };
    const fit = interpolateBSpline(pts);
    const shape: SweptCurveShape = { kind: "swept-curve", controlPoints: fit.controlPoints, knots: fit.knots, profile: { type: "round", radiusStart: 10, radiusEnd: 10 } };
    const s = sampleCenterline(shape);
    const maxDev = Math.max(...s.points.map((p) => Math.abs(Math.hypot(p.x, p.z) - 300)));
    expect(maxDev).toBeGreaterThan(5);
  });
});

describe("swept-curve §S5 adaptive flattening", () => {
  it("相鄰取樣點之間的弦高 < 0.1mm，且沒有 NaN", () => {
    const fit = interpolateBSpline(circlePts(300, 9));
    const shape: SweptCurveShape = { kind: "swept-curve", controlPoints: fit.controlPoints, knots: fit.knots, profile: { type: "round", radiusStart: 10, radiusEnd: 10 } };
    const s = sampleCenterline(shape);
    expect(s.points.length).toBeGreaterThan(20);
    expect(s.points.some((p) => !Number.isFinite(p.x + p.y + p.z))).toBe(false);
    for (let i = 0; i + 1 < s.us.length; i++) {
      const a = s.points[i], b = s.points[i + 1];
      const m = evalBSpline(fit.controlPoints, fit.knots, (s.us[i] + s.us[i + 1]) / 2);
      const ab = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
      const am = { x: m.x - a.x, y: m.y - a.y, z: m.z - a.z };
      const cr = { x: ab.y * am.z - ab.z * am.y, y: ab.z * am.x - ab.x * am.z, z: ab.x * am.y - ab.y * am.x };
      const h = Math.hypot(cr.x, cr.y, cr.z) / (Math.hypot(ab.x, ab.y, ab.z) || 1);
      expect(h).toBeLessThan(0.1 + 1e-9);
    }
    // 弧長單調遞增
    for (let i = 1; i < s.s.length; i++) expect(s.s[i]).toBeGreaterThan(s.s[i - 1]);
  });

  it("segments 上限：超過就退回均勻取樣，不會炸", () => {
    const fit = interpolateBSpline(circlePts(300, 9));
    const shape: SweptCurveShape = { kind: "swept-curve", controlPoints: fit.controlPoints, knots: fit.knots, profile: { type: "round", radiusStart: 10, radiusEnd: 10 }, segments: 10 };
    const s = sampleCenterline(shape);
    expect(s.points.length).toBe(11);
  });
});

describe("swept-curve 框架 / 斷面", () => {
  it("每站 (T,N,B) 正交單位、N×B=T；rect thicknessAlong y 時 B 貼世界 y", () => {
    const fit = interpolateBSpline(circlePts(300, 9));
    const shape: SweptCurveShape = { kind: "swept-curve", controlPoints: fit.controlPoints, knots: fit.knots, profile: { type: "rect", widthStart: 30, widthEnd: 60, thickness: 36, thicknessAlong: "y" } };
    const s = sampleCenterline(shape);
    const fr = sweptFrames(s, shape.profile);
    for (const { T, N, B } of fr) {
      const dotNB = N.x * B.x + N.y * B.y + N.z * B.z;
      expect(Math.abs(dotNB)).toBeLessThan(1e-6);
      expect(Math.abs(Math.hypot(N.x, N.y, N.z) - 1)).toBeLessThan(1e-6);
      const c = { x: N.y * B.z - N.z * B.y, y: N.z * B.x - N.x * B.z, z: N.x * B.y - N.y * B.x };
      expect(dist(c, T)).toBeLessThan(1e-6);
      expect(Math.abs(B.y - 1)).toBeLessThan(1e-6);
    }
  });

  it("寬度沿弧長：線性與三點二次（widthMid）", () => {
    expect(profileWidthAt({ type: "rect", widthStart: 30, widthEnd: 60, thickness: 36 }, 0.5)).toBeCloseTo(45, 6);
    const q = { type: "rect" as const, widthStart: 45, widthEnd: 45, widthMid: 60, thickness: 36 };
    expect(profileWidthAt(q, 0)).toBeCloseTo(45, 6);
    expect(profileWidthAt(q, 0.5)).toBeCloseTo(60, 6);
    expect(profileWidthAt(q, 1)).toBeCloseTo(45, 6);
    expect(profileWidthAt({ type: "round", radiusStart: 25, radiusEnd: 20 }, 1)).toBeCloseTo(40, 6);
  });
});

describe("swept-curve 零件（sweptPartFromWorldPoints）", () => {
  const up = { x: 0, y: 1, z: 0 };
  const S = [
    { x: 0, y: 0, z: 0 }, { x: 8, y: 25, z: 0 }, { x: 0, y: 50, z: 0 }, { x: -8, y: 75, z: 0 }, { x: 0, y: 100, z: 0 },
  ];

  it("visible = 表面 AABB、origin 在底部中心、控制點以 AABB 中心為原點", () => {
    // 端切線鎖垂直 → 端面水平，AABB 高度剛好 = 曲線高 100（不鎖的話斜端面會多出 r·sinθ）
    const g = sweptPartFromWorldPoints(S, { type: "round", radiusStart: 10, radiusEnd: 10 }, { startTangent: up, endTangent: up });
    expect(g.visible.thickness).toBeCloseTo(100, 0);
    expect(g.visible.length).toBeGreaterThan(30); // ±8 彎 + 2×10 半徑
    expect(g.origin.y).toBeCloseTo(0, 0);
    const box = sweptLocalAABB(g.shape);
    expect(Math.abs(box.min.x + box.max.x)).toBeLessThan(1e-6);
    expect(Math.abs(box.min.y + box.max.y)).toBeLessThan(1e-6);
  });

  it("端切線鎖定：endTangent/startTangent 讓端面剛好垂直", () => {
    const g = sweptPartFromWorldPoints(S, { type: "round", radiusStart: 10, radiusEnd: 10 }, { startTangent: up, endTangent: up });
    const e = sweptEndpoints(g.shape);
    expect(dist(e.start.outward, { x: 0, y: -1, z: 0 })).toBeLessThan(1e-3);
    expect(dist(e.end.outward, up)).toBeLessThan(1e-3);
    // 不鎖：S 形的端切線不會剛好垂直（證明鎖定真的有做事）
    const g2 = sweptPartFromWorldPoints(S, { type: "round", radiusStart: 10, radiusEnd: 10 });
    const e2 = sweptEndpoints(g2.shape);
    expect(dist(e2.end.outward, up)).toBeGreaterThan(0.05);
  });

  it("S 形反曲點 = 1、C 形 = 0", () => {
    const g = sweptPartFromWorldPoints(S, { type: "round", radiusStart: 10, radiusEnd: 10 });
    expect(countInflections(g.shape, "xy")).toBe(1);
    const C = [{ x: 0, y: 0, z: 0 }, { x: 12, y: 50, z: 0 }, { x: 0, y: 100, z: 0 }];
    const gc = sweptPartFromWorldPoints(C, { type: "round", radiusStart: 10, radiusEnd: 10 });
    expect(countInflections(gc.shape, "xy")).toBe(0);
  });

  it("點到實體距離：曲線上的點 = 0、離軸 25 的點 ≈ 15（r=10）", () => {
    const g = sweptPartFromWorldPoints([{ x: 0, y: 0, z: 0 }, { x: 0, y: 50, z: 0 }, { x: 0, y: 100, z: 0 }], { type: "round", radiusStart: 10, radiusEnd: 10 });
    expect(sweptDistanceToSolid(g.shape, { x: 0, y: 0, z: 0 })).toBeLessThan(1e-6);
    expect(sweptDistanceToSolid(g.shape, { x: 25, y: 0, z: 0 })).toBeCloseTo(15, 0);
  });

  it("投影輪廓：直圓管正視 = 20 寬 × 100 高，且輪廓不比點雲小", () => {
    const g = sweptPartFromWorldPoints([{ x: 0, y: 0, z: 0 }, { x: 0, y: 50, z: 0 }, { x: 0, y: 100, z: 0 }], { type: "round", radiusStart: 10, radiusEnd: 10 });
    const poly = projectSweptOutline(g.shape, (p) => ({ x: p.x, y: p.y }), convexHull2D);
    const xs = poly.map((q) => q.x), ys = poly.map((q) => q.y);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(20, 0);
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(100, 0);
    expect(poly.some((q) => !Number.isFinite(q.x + q.y))).toBe(false);
  });

  it("投影輪廓：馬蹄弧俯視是非凸的（內側不會被填滿）", () => {
    const fit = interpolateBSpline(circlePts(300, 9));
    const shape: SweptCurveShape = { kind: "swept-curve", controlPoints: fit.controlPoints, knots: fit.knots, profile: { type: "rect", widthStart: 40, widthEnd: 40, thickness: 36, thicknessAlong: "y" } };
    const poly = projectSweptOutline(shape, (p) => ({ x: p.x, y: p.z }), convexHull2D);
    const area = Math.abs(poly.reduce((a, q, i) => { const r = poly[(i + 1) % poly.length]; return a + q.x * r.y - r.x * q.y; }, 0)) / 2;
    const hullArea = (() => { const h = convexHull2D(poly); return Math.abs(h.reduce((a, q, i) => { const r = h[(i + 1) % h.length]; return a + q.x * r.y - r.x * q.y; }, 0)) / 2; })();
    // ¾ 圓弧帶面積 ≈ 弧長 × 40 ≈ 1414×40 ≈ 56k；凸包 ≈ 整個圓盤 ≈ 280k
    expect(area).toBeLessThan(hullArea * 0.4);
    expect(area).toBeGreaterThan(40000);
  });
});

describe("端面切平面（startCap / endCap，§S7.1）與皮條線斷面", () => {
  const slanted = (cap?: { start?: Vec3; end?: Vec3 }): SweptCurveShape => ({
    kind: "swept-curve",
    // 斜圓柱：從 (0,0,0) 往上、往 +x 傾 ~10°
    controlPoints: [{ x: 0, y: 0, z: 0 }, { x: 30, y: 170, z: 0 }, { x: 60, y: 340, z: 0 }],
    profile: { type: "round", radiusStart: 18, radiusEnd: 18 },
    ...(cap?.start ? { startCap: cap.start } : {}),
    ...(cap?.end ? { endCap: cap.end } : {}),
  });
  it("沒給 cap：端面垂直於切線（既有行為）；給了水平 cap：端面所有點同一個 y、端點與切線不變", () => {
    const plain = slanted();
    const c0 = sweptCapRing(plain, "start");
    const ys0 = c0.points.map((q) => q.y);
    expect(Math.max(...ys0) - Math.min(...ys0)).toBeGreaterThan(2); // 斜切圓柱的垂直端面有高低差
    const capped = slanted({ start: { x: 0, y: -1, z: 0 }, end: { x: 0, y: 1, z: 0 } });
    const c1 = sweptCapRing(capped, "start");
    const ys1 = c1.points.map((q) => q.y);
    expect(Math.max(...ys1) - Math.min(...ys1)).toBeLessThan(1e-9);
    expect(Math.abs(ys1[0])).toBeLessThan(1e-9);
    const e0 = sweptEndpoints(plain), e1 = sweptEndpoints(capped);
    expect(e1.start.point).toEqual(e0.start.point);
    expect(e1.end.outward).toEqual(e0.end.outward);
    // 變異：cap 跟切線幾乎垂直（> 72°）要被忽略、退回垂直端面
    const bad = slanted({ end: { x: 1, y: 0, z: 0 } });
    const cb = sweptCapRing(bad, "end");
    const ysb = cb.points.map((q) => q.y);
    expect(Math.max(...ysb) - Math.min(...ysb)).toBeGreaterThan(2);
  });
  it("皮條線：上半是弧（|x/w|ⁿ+|y/h|ⁿ=1）、下半平底 + 導圓；上面最高點在中心、底面平", () => {
    const pr = { type: "rect" as const, widthStart: 44, widthEnd: 44, thickness: 36, sectionStyle: "pitiao" as const, topExponent: 2.6, cornerR: 5 };
    const loop = profileLoops(pr, 0.5).loops[0];
    const top = loop.filter((q) => q.y > 0.1);
    const bottom = loop.filter((q) => q.y < -17.9);
    expect(top.length).toBeGreaterThan(10);
    for (const q of top) expect(Math.pow(Math.abs(q.x / 22), 2.6) + Math.pow(Math.abs(q.y / 18), 2.6)).toBeCloseTo(1, 3);
    // 平底：x 從 −(w−cr) 到 +(w−cr) 的點都在 y = −h
    expect(Math.min(...bottom.map((q) => q.x))).toBeLessThan(-(22 - 5) + 0.01);
    expect(Math.max(...bottom.map((q) => q.x))).toBeGreaterThan((22 - 5) - 0.01);
    // 上面在 x=±22 高度為 0（弧從腰起），最高點 18
    expect(Math.max(...loop.map((q) => q.y))).toBeCloseTo(18, 6);
    // 3D 放樣後 rings 數 = 站數、每站點數一致
    const shape: SweptCurveShape = { kind: "swept-curve", controlPoints: [{ x: 0, y: 0, z: 0 }, { x: 100, y: 0, z: 0 }, { x: 200, y: 0, z: 0 }], profile: pr };
    const surf = sweptSurfaceRings(shape);
    expect(surf.closed).toBe(true);
    expect(new Set(surf.rings.map((st) => st[0].length)).size).toBe(1);
  });
});
