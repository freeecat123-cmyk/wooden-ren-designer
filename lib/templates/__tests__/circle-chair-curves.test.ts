/**
 * 圈椅 P3 曲線版：機器可數的驗收（AGENTS.md「看得到的東西不准只用截圖驗」）。
 * - 椅圈：俯視角度跨度接近 ¾ 圓、後半圓半徑貼 R、五段在同一條中心線上接得起來
 * - 鵝脖／聯幫棍／靠背板：曲線形狀（反曲點）與端點落點
 * - 榫卯 gap 檢查：基準 0 警告；負向對照（搬壞）必須紅
 */
import { describe, expect, it } from "vitest";
import { applyCircleChairJoinery, buildCircleChairJoints, circleChair, circleChairOptions, circleChairRingDebug } from "../circle-chair";
import { countInflections, sampleCenterline, sweptPointAtArcLength, sweptWorldEndpoints, type SweptCurveShape } from "@/lib/geometry/swept-curve";
import { projectPartPolygon } from "@/lib/render/geometry";
import type { Part } from "@/lib/types";

function fresh() {
  return circleChair({
    length: 610, width: 497, height: 720, material: "walnut",
    options: Object.fromEntries(circleChairOptions.map((o) => [o.key, o.defaultValue])),
  } as Parameters<typeof circleChair>[0]);
}
const swept = (p: Part): SweptCurveShape => {
  if (p.shape?.kind !== "swept-curve") throw new Error(`${p.id} 不是曲料`);
  return p.shape;
};
const worldPt = (p: Part, l: { x: number; y: number; z: number }) => ({ x: p.origin.x + l.x, y: p.origin.y + p.visible.thickness / 2 + l.y, z: p.origin.z + l.z });
const polyArea = (poly: { x: number; y: number }[]) => Math.abs(poly.reduce((a, q, i) => { const r = poly[(i + 1) % poly.length]; return a + q.x * r.y - r.x * q.y; }, 0)) / 2;

describe("圈椅椅圈（swept-curve 五段）", () => {
  it("後半圓貼 R、整圈俯視角度跨度 ≥ 240°（¾ 圓 + 扶手）", () => {
    const { ring } = circleChairRingDebug();
    const s = sampleCenterline(ring.world);
    let maxDev = 0;
    let minAng = Infinity, maxAng = -Infinity;
    for (const p of s.points) {
      const ang = (Math.atan2(p.x, p.z - ring.zc) * 180) / Math.PI; // 0 = 後正中
      minAng = Math.min(minAng, ang); maxAng = Math.max(maxAng, ang);
      if (p.z > ring.zc + 5) maxDev = Math.max(maxDev, Math.abs(Math.hypot(p.x, p.z - ring.zc) - ring.R));
    }
    // 每 22.5° 一個經過點的 cubic 內插對 R=342 的圓，偏差 ~1.5mm（變異測試在 swept-curve.test：推 8mm 會 > 5）
    expect(maxDev).toBeLessThan(2.0);
    expect(maxAng - minAng).toBeGreaterThan(240);
    // 整圈水平（RING_TIP_DROP=0）
    const ys = s.points.map((p) => p.y);
    expect(Math.max(...ys) - Math.min(...ys)).toBeLessThan(0.05);
  });

  it("五段相鄰段的接點落在同一條中心線上（< 0.5mm、切線 < 2°）", () => {
    const d = fresh();
    const by = new Map(d.parts.map((p) => [p.id, p]));
    const { ranges } = circleChairRingDebug();
    const order = ["arm-rail-side-l", "arm-rail-mid-l", "arm-rail-back", "arm-rail-mid-r", "arm-rail-side-r"] as const;
    for (let i = 0; i + 1 < order.length; i++) {
      const a = by.get(order[i])!, b = by.get(order[i + 1])!;
      const [a0, a1] = ranges[order[i]], [b0] = ranges[order[i + 1]];
      // 接點弧長 = 兩段重疊區中點
      const sJoint = (b0 + a1) / 2;
      const pa = sweptPointAtArcLength(swept(a), sJoint - a0);
      const pb = sweptPointAtArcLength(swept(b), sJoint - b0);
      const wa = worldPt(a, pa.point), wb = worldPt(b, pb.point);
      expect(Math.hypot(wa.x - wb.x, wa.y - wb.y, wa.z - wb.z)).toBeLessThan(0.5);
      const dot = pa.tangent.x * pb.tangent.x + pa.tangent.y * pb.tangent.y + pa.tangent.z * pb.tangent.z;
      expect((Math.acos(Math.min(1, Math.abs(dot))) * 180) / Math.PI).toBeLessThan(2);
      // 重疊區 = 楔釘榫搭口 85
      expect(a1 - b0).toBeCloseTo(85, 5);
    }
  });

  it("每個曲料零件：AABB 有效、三個視圖輪廓面積 > 0、無 NaN", () => {
    const d = fresh();
    const curved = d.parts.filter((p) => p.shape?.kind === "swept-curve");
    expect(curved.map((p) => p.id).sort()).toEqual([
      "arm-rail-back", "arm-rail-mid-l", "arm-rail-mid-r", "arm-rail-side-l", "arm-rail-side-r",
      "back-splat", "leg-front-l", "leg-front-r", "leg-rear-l", "leg-rear-r", "side-spindle-l", "side-spindle-r",
    ]);
    for (const p of curved) {
      expect(p.visible.length).toBeGreaterThan(0);
      expect(p.visible.width).toBeGreaterThan(0);
      expect(p.visible.thickness).toBeGreaterThan(0);
      expect(p.rotation).toBeUndefined();
      for (const view of ["front", "side", "top"] as const) {
        const poly = projectPartPolygon(p, view);
        expect(poly.some((q) => !Number.isFinite(q.x + q.y))).toBe(false);
        expect(polyArea(poly)).toBeGreaterThan(100);
      }
    }
  });
});

describe("圈椅 S 曲線件與腿", () => {
  it("聯幫棍是 S 形（正視反曲點 1）、靠背板是 S 形（側視反曲點 1）", () => {
    const d = fresh();
    const by = new Map(d.parts.map((p) => [p.id, p]));
    expect(countInflections(swept(by.get("side-spindle-l")!), "xy")).toBe(1);
    expect(countInflections(swept(by.get("side-spindle-r")!), "xy")).toBe(1);
    expect(countInflections(swept(by.get("back-splat")!), "yz")).toBe(1);
  });

  it("鵝脖：前腳上段往外撇到椅圈扶手底、頂端剛好貼椅圈底面 y=684", () => {
    const d = fresh();
    const by = new Map(d.parts.map((p) => [p.id, p]));
    for (const id of ["leg-front-l", "leg-front-r", "leg-rear-l", "leg-rear-r", "side-spindle-l", "side-spindle-r", "back-splat"]) {
      const p = by.get(id)!;
      const e = sweptWorldEndpoints({ origin: p.origin, visible: p.visible, shape: swept(p) });
      expect(e.end.point.y).toBeCloseTo(684, 1);
      // 端面垂直（榫頭端面水平貼母件）
      expect(Math.abs(e.end.outward.y - 1)).toBeLessThan(1e-3);
    }
    const fl = by.get("leg-front-l")!;
    const e = sweptWorldEndpoints({ origin: fl.origin, visible: fl.visible, shape: swept(fl) });
    expect(Math.abs(e.end.point.x)).toBeGreaterThan(274 + 40); // 鵝脖頂比腿在座框處的中心外撇 40+
    expect(Math.abs(e.start.point.y)).toBeLessThan(1e-6);       // 腳底落地
    expect(e.start.outward.y).toBeCloseTo(-1, 3);                // 腳底端面水平
    const rl = by.get("leg-rear-l")!;
    const er = sweptWorldEndpoints({ origin: rl.origin, visible: rl.visible, shape: swept(rl) });
    expect(Math.abs(er.end.point.x)).toBeCloseTo(274, 0);        // 後腳頂在椅圈後半圓上（≈ legXOff）
  });

  it("下盤：橫撐端面貼在收分腿的最內側面上（不穿模），腳底比座框處外踢", () => {
    const d = fresh();
    const by = new Map(d.parts.map((p) => [p.id, p]));
    const rl = by.get("leg-rear-l")!;
    const er = sweptWorldEndpoints({ origin: rl.origin, visible: rl.visible, shape: swept(rl) });
    expect(Math.abs(er.start.point.x)).toBeGreaterThan(274 + 25); // 4° × 480 ≈ 33
    const rail = by.get("foot-rail-back")!;
    // 棖比 P1（腿心距 − 腿徑）長：收分讓底部腿心距變大
    expect(rail.visible.length).toBeGreaterThan(2 * 274 - 36 + 30);
  });
});

describe("圈椅榫卯位置檢查（gap）", () => {
  const rerun = (parts: Part[]) => {
    for (const p of parts) { p.tenons = []; p.mortises = []; }
    return applyCircleChairJoinery(parts, buildCircleChairJoints(parts));
  };
  it("基準：0 警告", () => {
    const d = fresh();
    expect(d.warnings ?? []).toEqual([]);
  });
  it("負向對照：曲料搬走 / 縮短，gap 檢查必須紅", () => {
    const cases: Array<[string, (ps: Part[]) => void]> = [
      ["椅圈左桿外移 120", (ps) => { ps.find((x) => x.id === "arm-rail-side-l")!.origin.x -= 120; }],
      ["中桿後推 60（楔釘榫脫開）", (ps) => { ps.find((x) => x.id === "arm-rail-mid-l")!.origin.z += 60; }],
      ["聯幫棍外移 40", (ps) => { ps.find((x) => x.id === "side-spindle-l")!.origin.x -= 40; }],
      ["靠背板前推 25", (ps) => { ps.find((x) => x.id === "back-splat")!.origin.z -= 25; }],
      ["後腳頂縮 150", (ps) => {
        const p = ps.find((x) => x.id === "leg-rear-l")!;
        const s = swept(p); const h = p.visible.thickness; const k = (h - 150) / h;
        s.controlPoints = s.controlPoints.map((c) => ({ x: c.x, y: (c.y + h / 2) * k - h / 2 + 75, z: c.z }));
        p.visible.thickness = h - 150;
      }],
    ];
    for (const [name, mut] of cases) {
      const d = fresh();
      mut(d.parts);
      const w = rerun(d.parts);
      expect(w.length, name).toBeGreaterThan(0);
    }
  });
});
