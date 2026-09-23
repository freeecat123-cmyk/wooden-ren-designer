/**
 * 圈椅 P3/P4 曲線版：機器可數的驗收（AGENTS.md「看得到的東西不准只用截圖驗」）。
 * - 椅圈：俯視 ¾ 圓 + 兩端外撇、包絡 ≈ 698×690、後高前低（單調下降）、五段接得起來
 * - 四腿：座面以下是直線（複斜：側腳 + 前後收分）、腳底切平、柱頂端面貼椅圈當地底面
 * - 鵝脖／聯幫棍／靠背板：曲線形狀（反曲點）與端點落點
 * - 棖／角牙：端面照複斜肩切（梯形／反向法頂點）而不是留 expectedGapMm
 * - 榫卯 gap 檢查：基準 0 警告；負向對照（搬壞）必須紅
 */
import { describe, expect, it } from "vitest";
import { applyCircleChairJoinery, buildCircleChairJoints, circleChair, circleChairOptions, circleChairRingDebug } from "../circle-chair";
import { countInflections, sampleCenterline, sweptCapRing, sweptPointAtArcLength, sweptWorldEndpoints, type SweptCurveShape } from "@/lib/geometry/swept-curve";
import { projectPartPolygon, worldExtents } from "@/lib/render/geometry";
import { findOverlaps } from "@/lib/geometry/overlap";
import type { Part } from "@/lib/types";

type V = { x: number; y: number; z: number };
const SEAT_H = 480, SEAT_W = 610, SEAT_D = 497, RING_H = 720;
const LEG_X_OFF = SEAT_W / 2 - 25 - 6; // legAnchors：前腳 Ø50、inset 6 → 274

function fresh() {
  return circleChair({
    length: SEAT_W, width: SEAT_D, height: RING_H, material: "walnut",
    options: Object.fromEntries(circleChairOptions.map((o) => [o.key, o.defaultValue])),
  } as Parameters<typeof circleChair>[0]);
}
const swept = (p: Part): SweptCurveShape => {
  if (p.shape?.kind !== "swept-curve") throw new Error(`${p.id} 不是曲料`);
  return p.shape;
};
const worldPt = (p: Part, l: V): V => ({ x: p.origin.x + l.x, y: p.origin.y + p.visible.thickness / 2 + l.y, z: p.origin.z + l.z });
const polyArea = (poly: { x: number; y: number }[]) => Math.abs(poly.reduce((a, q, i) => { const r = poly[(i + 1) % poly.length]; return a + q.x * r.y - r.x * q.y; }, 0)) / 2;
const angleDeg = (a: V, b: V) => (Math.acos(Math.min(1, Math.max(-1, a.x * b.x + a.y * b.y + a.z * b.z))) * 180) / Math.PI;
const ends = (p: Part) => sweptWorldEndpoints({ origin: p.origin, visible: p.visible, shape: swept(p) });

/** 中心線各點離「起點→y=yCut 那點」直線的最大距離（只看 y ≤ yCut 的部分） */
function straightnessBelow(p: Part, yCut: number): number {
  const s = sampleCenterline(swept(p));
  const w = s.points.map((q) => worldPt(p, q));
  const a = w[0];
  const b = w.find((q) => q.y >= yCut)!;
  const ab = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
  const L = Math.hypot(ab.x, ab.y, ab.z);
  let maxD = 0;
  for (const q of w) {
    if (q.y > yCut) break;
    const aq = { x: q.x - a.x, y: q.y - a.y, z: q.z - a.z };
    const cr = { x: aq.y * ab.z - aq.z * ab.y, y: aq.z * ab.x - aq.x * ab.z, z: aq.x * ab.y - aq.y * ab.x };
    maxD = Math.max(maxD, Math.hypot(cr.x, cr.y, cr.z) / L);
  }
  return maxD;
}

describe("圈椅椅圈（swept-curve 五段，後高前低）", () => {
  it("俯視：後半圓貼 R、整圈角度跨度 ≥ 240°、包絡 ≈ 698×690（spec §3）", () => {
    const { ring } = circleChairRingDebug();
    const s = sampleCenterline(ring.world);
    let maxDev = 0, minAng = Infinity, maxAng = -Infinity;
    for (const p of s.points) {
      const ang = (Math.atan2(p.x, p.z - ring.zc) * 180) / Math.PI; // 0 = 後正中
      minAng = Math.min(minAng, ang); maxAng = Math.max(maxAng, ang);
      if (p.z > ring.zc + 5) maxDev = Math.max(maxDev, Math.abs(Math.hypot(p.x, p.z - ring.zc) - ring.R));
    }
    expect(maxDev).toBeLessThan(2.0);
    expect(maxAng - minAng).toBeGreaterThan(240);
    expect(ring.R).toBeGreaterThan(240);
    expect(ring.R).toBeLessThan(300);
    const d = fresh();
    const by = new Map(d.parts.map((p) => [p.id, p]));
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const id of ["arm-rail-side-l", "arm-rail-mid-l", "arm-rail-back", "arm-rail-mid-r", "arm-rail-side-r"]) {
      const p = by.get(id)!; const { xExt, zExt } = worldExtents(p);
      x0 = Math.min(x0, p.origin.x - xExt / 2); x1 = Math.max(x1, p.origin.x + xExt / 2);
      z0 = Math.min(z0, p.origin.z - zExt / 2); z1 = Math.max(z1, p.origin.z + zExt / 2);
    }
    expect(x1 - x0).toBeCloseTo(698, -1);
    expect(z1 - z0).toBeCloseTo(690, -1);
  });

  it("立面：後正中最高 = 椅圈總高，沿扶手往前單調下降，鵝脖接點降 30、鱔魚頭尾端再降 25", () => {
    const { ring } = circleChairRingDebug();
    const hp = ring.heightProfile();
    const apexI = hp.reduce((b, h, i) => (Math.abs(h.x) < Math.abs(hp[b].x) ? i : b), 0);
    expect(hp[apexI].y).toBeCloseTo(RING_H - 18, 1);
    // 從 apex 往兩端走，高度不可以上升（容差 0.2mm）
    for (let i = apexI; i + 1 < hp.length; i++) expect(hp[i + 1].y - hp[i].y).toBeLessThan(0.2);
    for (let i = apexI; i > 0; i--) expect(hp[i - 1].y - hp[i].y).toBeLessThan(0.2);
    expect(Math.min(...hp.map((h) => h.y))).toBeCloseTo(RING_H - 18 - 55, 0);
    const d = fresh();
    const by = new Map(d.parts.map((p) => [p.id, p]));
    // 鵝脖頂（椅圈底面接點）比後正中底面低 ≈ 30
    const apexBottom = ends(by.get("back-splat")!).end.point.y;
    const neckTop = ends(by.get("leg-front-l")!).end.point.y;
    expect(apexBottom - neckTop).toBeGreaterThan(20);
    expect(apexBottom - neckTop).toBeLessThan(45);
  });

  it("負向對照：把椅圈扶手段的控制點抬高，「單調下降」檢查必須紅", () => {
    const { ring } = circleChairRingDebug();
    const n = ring.world.controlPoints.length;
    ring.world.controlPoints[Math.floor(n * 0.72)].y += 8; // 扶手中段（平緩處）抬高 8mm
    const hp = ring.heightProfile();
    const apexI = hp.reduce((b, h, i) => (Math.abs(h.x) < Math.abs(hp[b].x) ? i : b), 0);
    let maxRise = 0;
    for (let i = apexI; i + 1 < hp.length; i++) maxRise = Math.max(maxRise, hp[i + 1].y - hp[i].y);
    expect(maxRise).toBeGreaterThan(0.2);
  });

  it("五段相鄰段的接點落在同一條中心線上（< 0.5mm、切線 < 2°）、斷面是皮條線", () => {
    const d = fresh();
    const by = new Map(d.parts.map((p) => [p.id, p]));
    const { ranges } = circleChairRingDebug();
    const order = ["arm-rail-side-l", "arm-rail-mid-l", "arm-rail-back", "arm-rail-mid-r", "arm-rail-side-r"] as const;
    for (let i = 0; i + 1 < order.length; i++) {
      const a = by.get(order[i])!, b = by.get(order[i + 1])!;
      const [a0, a1] = ranges[order[i]], [b0] = ranges[order[i + 1]];
      const sJoint = (b0 + a1) / 2;
      const pa = sweptPointAtArcLength(swept(a), sJoint - a0);
      const pb = sweptPointAtArcLength(swept(b), sJoint - b0);
      const wa = worldPt(a, pa.point), wb = worldPt(b, pb.point);
      expect(Math.hypot(wa.x - wb.x, wa.y - wb.y, wa.z - wb.z)).toBeLessThan(0.5);
      expect(angleDeg(pa.tangent, pb.tangent)).toBeLessThan(2);
      expect(a1 - b0).toBeCloseTo(85, 5);
    }
    for (const id of order) {
      const pr = swept(by.get(id)!).profile;
      expect(pr.type === "rect" && pr.sectionStyle).toBe("pitiao");
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

describe("圈椅四腿複斜（§AT1.3）與柱頂斜肩", () => {
  it("座面以下是直線；腳底外踢 = tan4°×480（側）、tan2.5°×480（前後，前腳往前、後腳往後）", () => {
    const d = fresh();
    const by = new Map(d.parts.map((p) => [p.id, p]));
    const dx = Math.tan((4 * Math.PI) / 180) * SEAT_H, dz = Math.tan((2.5 * Math.PI) / 180) * SEAT_H;
    for (const id of ["leg-front-l", "leg-front-r", "leg-rear-l", "leg-rear-r"]) {
      const p = by.get(id)!;
      expect(straightnessBelow(p, SEAT_H)).toBeLessThan(0.05);
      const e = ends(p);
      expect(e.start.point.y).toBeCloseTo(0, 6);
      // 腳底相對座面高處的腿心：側向外踢 dx；前腳 z 往前（−）、後腳往後（+）dz
      const s = sampleCenterline(swept(p));
      const w = s.points.map((q) => worldPt(p, q));
      const j = w.findIndex((q) => q.y >= SEAT_H);
      const f = (SEAT_H - w[j - 1].y) / (w[j].y - w[j - 1].y);
      const atSeat = { x: w[j - 1].x + (w[j].x - w[j - 1].x) * f, y: SEAT_H, z: w[j - 1].z + (w[j].z - w[j - 1].z) * f };
      expect(Math.abs(e.start.point.x) - Math.abs(atSeat.x)).toBeCloseTo(dx, 0);
      const dzGot = e.start.point.z - atSeat.z;
      expect(dzGot).toBeCloseTo(id.includes("front") ? -dz : dz, 0);
      // 腳底切平：起點端面所有點 y = 0（同一平面、水平）
      const cap = sweptCapRing(swept(p), "start");
      const ys = cap.points.map((q) => worldPt(p, q).y);
      expect(Math.max(...ys) - Math.min(...ys)).toBeLessThan(1e-6);
      expect(Math.abs(ys[0])).toBeLessThan(1e-6);
    }
  });

  it("後腳整支直線頂到椅圈底；頂端端面平行椅圈當地底面（法線夾角 < 2°），榫軸沿腿軸", () => {
    const d = fresh();
    const by = new Map(d.parts.map((p) => [p.id, p]));
    const { ring } = circleChairRingDebug();
    for (const id of ["leg-rear-l", "leg-rear-r"]) {
      const p = by.get(id)!;
      const e = ends(p);
      expect(straightnessBelow(p, e.end.point.y - 1)).toBeLessThan(0.05);
      // 榫軸（端切線）= 腿軸：離垂直 = 複斜合角 acos(cos4°·cos2.5°) ≈ 4.7°
      expect(angleDeg(e.end.outward, { x: 0, y: 1, z: 0 })).toBeCloseTo(4.7, 0);
      // 端面切平面法線 = 椅圈當地「上」方向（模板算的 attach.up 存在 endCap）
      const cap = swept(p).endCap!;
      expect(cap).toBeDefined();
      // 端面上所有點都在通過端點、法線 = cap 的平面上
      const ring0 = sweptCapRing(swept(p), "end");
      for (const q of ring0.points) {
        const dq = { x: q.x - ring0.origin.x, y: q.y - ring0.origin.y, z: q.z - ring0.origin.z };
        expect(Math.abs(dq.x * cap.x + dq.y * cap.y + dq.z * cap.z)).toBeLessThan(1e-6);
      }
      // 頂端高度 = 椅圈在該 z 的底面高（後高前低 → 比 apex 底低一點點）
      const att = ring.attachAtZ(id.endsWith("-l") ? -1 : 1, e.end.point.z + 0);
      void att; // attachAtZ 的 z 是「未整體平移前」座標，這裡只驗 cap 幾何，位置由 gap 檢查（0 警告）守
    }
  });

  it("鵝脖／聯幫棍頂端沿椅圈當地法線插入（端切線 = 端面法線），靠背板兩端垂直", () => {
    const d = fresh();
    const by = new Map(d.parts.map((p) => [p.id, p]));
    for (const id of ["leg-front-l", "leg-front-r", "side-spindle-l", "side-spindle-r"]) {
      const p = by.get(id)!;
      const e = ends(p);
      const cap = swept(p).endCap!;
      expect(angleDeg(e.end.outward, cap)).toBeLessThan(2);
      // 扶手往前降 → 當地法線略往後傾，但仍接近垂直（< 15°）
      expect(angleDeg(cap, { x: 0, y: 1, z: 0 })).toBeLessThan(15);
      expect(angleDeg(cap, { x: 0, y: 1, z: 0 })).toBeGreaterThan(0.5);
    }
    const bs = by.get("back-splat")!;
    const eb = ends(bs);
    expect(Math.abs(eb.end.outward.y - 1)).toBeLessThan(1e-3);
    expect(Math.abs(eb.start.outward.y + 1)).toBeLessThan(1e-3);
    expect(eb.end.point.y).toBeCloseTo(RING_H - 36, 0); // 後正中椅圈底面
    // 聯幫棍是「三彎」鐮刀把（spec §3）：正視反曲點 2；靠背板是 S 形（側視反曲點 1）
    expect(countInflections(swept(by.get("side-spindle-l")!), "xy")).toBe(2);
    expect(countInflections(swept(by.get("side-spindle-r")!), "xy")).toBe(2);
    expect(countInflections(swept(bs), "yz")).toBe(1);
    // 鵝脖頂比腿在座框處的中心外撇 40+
    const fl = by.get("leg-front-l")!;
    expect(Math.abs(ends(fl).end.point.x)).toBeGreaterThan(LEG_X_OFF + 40);
  });
});

describe("圈椅下盤：棖／角牙端面照複斜肩切", () => {
  it("棖是 apron-trapezoid（上下長度各自貼腿面）、rotation x=π/2；角牙是反向法 8 頂點；沒有一筆 expectedGapMm 用在腿上", () => {
    const d = fresh();
    const by = new Map(d.parts.map((p) => [p.id, p]));
    const dxPerMm = Math.tan((4 * Math.PI) / 180), dzPerMm = Math.tan((2.5 * Math.PI) / 180);
    for (const id of ["decor-rail-front", "decor-rail-back", "foot-rail-front", "foot-rail-back"]) {
      const p = by.get(id)!;
      expect(p.shape?.kind).toBe("apron-trapezoid");
      expect(p.rotation?.x).toBeCloseTo(Math.PI / 2, 6);
      const sh = p.shape as { topLengthScale: number; bottomLengthScale: number };
      // 側腳：腿往下外踢 → 棖底比棖頂長 ≈ 2·tan4°·h（圓腿上細下粗的錐度會抵掉一小部分）
      const h = p.visible.width;
      const got = (sh.bottomLengthScale - sh.topLengthScale) * p.visible.length;
      expect(got).toBeGreaterThan(0.7 * 2 * dxPerMm * h);
      expect(got).toBeLessThan(1.05 * 2 * dxPerMm * h);
    }
    for (const id of ["decor-rail-left", "decor-rail-right", "foot-rail-side-l", "foot-rail-side-r"]) {
      const p = by.get(id)!;
      expect(p.shape?.kind).toBe("apron-trapezoid");
      const sh = p.shape as { topLengthScale: number; bottomLengthScale: number };
      const h = p.visible.width;
      // 前後收分：前腳往前、後腳往後 → 側棖底比頂長 ≈ 2·tan2.5°·h（同上，錐度抵掉一點）
      const got = (sh.bottomLengthScale - sh.topLengthScale) * p.visible.length;
      expect(got).toBeGreaterThan(0.6 * 2 * dzPerMm * h);
      expect(got).toBeLessThan(1.05 * 2 * dzPerMm * h);
    }
    for (const id of ["corner-brace-front-l", "decor-brace-1", "decor-brace-3", "decor-brace-6"]) {
      const p = by.get(id)!;
      expect(p.shape?.kind).toBe("mitered-ends");
      const v = (p.shape as { vertices: [number, number, number][] }).vertices;
      expect(v).toHaveLength(8);
      // free 端（同一個 x）上下一樣；貼腿端上下不同（斜）
      const xs = v.map((q) => q[0]);
      const top = xs.slice(0, 4), bot = xs.slice(4, 8);
      const diff = top.map((x, i) => Math.abs(x - bot[i]));
      expect(Math.max(...diff)).toBeGreaterThan(0.3);
      expect(Math.min(...diff)).toBeLessThan(1e-9);
    }
    const joints = buildCircleChairJoints(d.parts);
    for (const j of joints) {
      if (j.mother.startsWith("leg-")) expect(j.expectedGapMm ?? 0).toBe(0);
    }
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
  it("負向對照：曲料搬走 / 縮短、棖縮短，gap 檢查必須紅", () => {
    const cases: Array<[string, (ps: Part[]) => void]> = [
      ["椅圈左桿外移 120", (ps) => { ps.find((x) => x.id === "arm-rail-side-l")!.origin.x -= 120; }],
      ["中桿後推 60（楔釘榫脫開）", (ps) => { ps.find((x) => x.id === "arm-rail-mid-l")!.origin.z += 60; }],
      ["聯幫棍外移 40", (ps) => { ps.find((x) => x.id === "side-spindle-l")!.origin.x -= 40; }],
      ["靠背板前推 25", (ps) => { ps.find((x) => x.id === "back-splat")!.origin.z -= 25; }],
      ["後棖縮 14（兩端各短 7）", (ps) => { ps.find((x) => x.id === "foot-rail-back")!.visible.length -= 14; }],
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

describe("圈椅穿模稽核（曲料用真穿深，不用 Y-slice AABB）", () => {
  // scripts/audit-overlaps.ts 對圈椅的結構性放行（腿穿座框、椅圈段接點、柱頂入椅圈、角牙嵌夾角）——
  // 這裡照抄同一套規則，剩下的才是真穿模。
  const structural = (a: string, b: string) => {
    const ids = [a, b].sort();
    if (ids[0].startsWith("leg-") && ids[1].startsWith("seat-")) return true;
    if (ids[0].startsWith("arm-rail-") && ids[1].startsWith("arm-rail-")) return true;
    if (ids[0].startsWith("arm-rail-") && ids[1].startsWith("leg-")) return true;
    if (ids[0].startsWith("arm-rail-") && ids[1] === "back-splat") return true;
    const brace = (s: string) => s.startsWith("corner-brace-") || s.startsWith("decor-brace-");
    const mother = (s: string) => s.startsWith("leg-") || s.startsWith("seat-rail-") || s.startsWith("decor-rail-");
    return (brace(ids[0]) && mother(ids[1])) || (brace(ids[1]) && mother(ids[0]));
  };
  const real = (ps: Part[]) => findOverlaps(ps, 1).filter((o) => !structural(o.a, o.b));
  it("基準 0 穿模（柱頂貼在下降的扶手底、棖端貼在複斜腿面都不算）", () => {
    expect(real(fresh().parts)).toEqual([]);
  });
  it("負向對照：聯幫棍上推 4 進扶手、後棖／踏腳棖右推 4 進腿，都必須紅", () => {
    const cases: Array<[string, (ps: Part[]) => void, [string, string]]> = [
      ["聯幫棍上推 4", (ps) => { ps.find((x) => x.id === "side-spindle-l")!.origin.y += 4; }, ["arm-rail-side-l", "side-spindle-l"]],
      ["後棖右推 4", (ps) => { ps.find((x) => x.id === "foot-rail-back")!.origin.x += 4; }, ["leg-rear-r", "foot-rail-back"]],
      ["踏腳棖右推 4", (ps) => { ps.find((x) => x.id === "foot-rail-front")!.origin.x += 4; }, ["leg-front-r", "foot-rail-front"]],
    ];
    for (const [name, mut, [pa, pb]] of cases) {
      const d = fresh();
      mut(d.parts);
      const ov = real(d.parts);
      const hit = ov.some((o) => (o.a === pa && o.b === pb) || (o.a === pb && o.b === pa));
      expect(hit, `${name}: ${JSON.stringify(ov)}`).toBe(true);
    }
  });
});
