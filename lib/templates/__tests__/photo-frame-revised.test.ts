import { createHash } from "node:crypto";
import { expect, it } from "vitest";
import { BoxGeometry, Euler, Vector3 } from "three";
import { computeMeshVolume } from "three-bvh-csg";
import { photoFrame, photoFrameOptions } from "../photo-frame";
import { choiceLabel, specHelp, specLabel } from "../spec-labels";
import { mortiseLocalBox, tenonLocalBox } from "@/lib/render/svg-views";
import { applyEdgeProtection } from "@/lib/joinery/edge-protection";
import { worldExtents } from "@/lib/render/geometry";
import type { Part } from "@/lib/types";
import { deriveBuildSteps } from "@/lib/steps/derive";
import { translateSteps } from "@/lib/steps/translations";
import { buildShapeGeometry } from "@/lib/render/part-geometry";
import { subtractMortisesFromGeometry } from "@/lib/render/mortise-csg";
import { findOverlaps } from "@/lib/geometry/overlap";
import { toBeginnerMode } from "../beginner-mode";

const input = { length: 300, width: 200, height: 25, material: "pine" as const };
it("uses consistent construction version labels without changing the legacy default", () => {
  const spec = photoFrameOptions.find(s => s.key === "constructionVersion")!;
  expect(specLabel(spec, "zh-TW")).toBe("結構版本");
  expect(specLabel(spec, "en")).toBe("Construction version");
  expect(spec.defaultValue).toBe("1");
  expect(spec.type).toBe("select");
  if (spec.type !== "select") throw new Error("Expected version choices");
  expect(spec.choices).toEqual([{ value: "1", label: "原版" }, { value: "2", label: "修正版" }]);
  expect(spec.choices.map(choice => choiceLabel(spec.key, choice.value, choice.label, "en"))).toEqual(["Original", "Revised"]);
});
it("distinguishes rebate inset from revised rear cutting depth in both languages", () => {
  const spec = photoFrameOptions.find(s => s.key === "glassGrooveDepth")!;
  expect(specLabel(spec, "zh-TW")).toBe("背槽內嵌寬度");
  expect(specLabel(spec, "en")).toBe("Rear rebate inset");
  expect(specHelp(spec, "zh-TW")).toContain("2 + 4 + 2 = 8mm");
  expect(specHelp(spec, "en")).toContain("2 + 4 + 2 = 8mm");
  expect(spec.defaultValue).toBe(6);
});
for (const [cornerJoinery, hash] of [["butt", "4427c54291daea53b852255c9d5ba884de49a96e4866df393b5ba1e0c479a0ea"], ["miter", "a21544195949be8c9fdfa9ba8604e9314ba1e17430051a1b3666188d286e44b3"]]) {
  it(`preserves legacy ${cornerJoinery} geometry and notes`, () => {
    expect(createHash("sha256").update(JSON.stringify(photoFrame({ ...input, options: { cornerJoinery } }))).digest("hex")).toBe(hash);
  });
}

function cutBounds(part: Part) {
  const m = part.mortises.find(m => m.label === "框背槽")!;
  expect(m).toBeDefined();
  const b = mortiseLocalBox(part, m);
  return boxBounds(part, b);
}
function boxBounds(part: Part, b: ReturnType<typeof mortiseLocalBox>) {
  const r = part.rotation;
  const rotation = new Euler(r?.x ?? 0, r?.y ?? 0, r?.z ?? 0, "ZYX");
  const corners: Vector3[] = [];
  for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) {
    corners.push(new Vector3(b.cx + x * b.hx, b.cy + y * b.hy, b.cz + z * b.hz).applyEuler(rotation)
      .add(new Vector3(part.origin.x, part.origin.y + worldExtents(part).yExt / 2, part.origin.z)));
  }
  return Object.fromEntries((["x", "y", "z"] as const).map(axis => [axis, [Math.min(...corners.map(p => p[axis])), Math.max(...corners.map(p => p[axis]))]]));
}
for (const cornerJoinery of ["butt", "miter"]) for (const frameProfile of ["flat", "chamfer-out"]) {
  it(`places a shared rear rebate with exact glass/back sizes: ${cornerJoinery}/${frameProfile}`, () => {
    const design = photoFrame({ ...input, options: { cornerJoinery, frameProfile, constructionVersion: "2" } });
    const glass = design.parts.find(p => p.id === "glass")!;
    const back = design.parts.find(p => p.id === "back-panel")!;
    expect(glass.visible).toEqual({ length: 310, width: 210, thickness: 2 });
    expect(glass.origin.y).toBe(4);
    expect(back.origin.y).toBe(0);
    expect(design.notes).toContain("310×210mm");
    for (const rail of design.parts.filter(p => p.id.startsWith("frame-"))) {
      const box = cutBounds(rail);
      expect(box.y[0]).toBeCloseTo(0);
      expect(box.y[1]).toBeCloseTo(8);
      const axis = ["frame-top", "frame-bottom"].includes(rail.id) ? "z" : "x";
      const inner = axis === "z" ? 100 : 150;
      const sign = ["frame-top", "frame-right"].includes(rail.id) ? 1 : -1;
      expect(box[axis][0]).toBeCloseTo(sign > 0 ? inner : -inner - 6);
      expect(box[axis][1]).toBeCloseTo(sign > 0 ? inner + 6 : -inner);
    }
  });
}
it("raises insufficient miter stock thickness explicitly rather than burying the glass in wood", () => {
  const design = photoFrame({ ...input, options: { constructionVersion: "2", cornerJoinery: "miter", frameThickness: 12, glassThickness: 4, backThickness: 8 } });
  expect(design.overall.thickness).toBe(16);
  expect(design.warnings?.some(w => w.includes("12") && w.includes("16"))).toBe(true);
});

it("reserves intact corner tenons in front of the rear rebate and warns about thicker stock", () => {
  const design = photoFrame({ ...input, options: { constructionVersion: "2", frameWidth: 15, frameThickness: 12, glassGrooveDepth: 12, glassThickness: 4, backThickness: 8 } });
  // 14mm rebate + existing 6mm tenon + 2mm front shoulder.
  expect(design.overall.thickness).toBe(22);
  expect(design.warnings?.some(w => w.includes("12") && w.includes("22"))).toBe(true);
  expect(design.parts[2].tenons[0].thickness).toBe(6);
});

it("keeps all four real tenon boxes clear of the rebate and aligned with their mortises", () => {
  for (const frameWidth of [15, 35, 60]) for (const frameThickness of [12, 25, 30]) {
    for (const glassGrooveDepth of [5, 12]) for (const backThickness of [3, 8]) {
      for (const glassThickness of [2, 4]) {
        const raw = photoFrame({ ...input, options: { constructionVersion: "2", frameWidth, frameThickness, glassGrooveDepth, backThickness, glassThickness } });
        for (const design of [raw, applyEdgeProtection(raw)]) {
          const mortises = design.parts.slice(0, 2).flatMap(p => p.mortises.filter(m => !m.cosmetic).map(m => boxBounds(p, mortiseLocalBox(p, m))));
          const tenons = design.parts.slice(2, 4).flatMap(p => p.tenons.map(t => boxBounds(p, tenonLocalBox(p, t))));
          expect(tenons).toHaveLength(4);
          for (const tenon of tenons) {
            expect(tenon.y[0]).toBeGreaterThanOrEqual(backThickness + glassThickness + 2 - 1e-6);
            expect(tenon.y[1]).toBeLessThanOrEqual(design.overall.thickness - 2 + 1e-6);
            expect(mortises.some(m => (["x", "y", "z"] as const).every(axis =>
              Math.abs(m[axis][0] - tenon[axis][0]) < 1e-6 && Math.abs(m[axis][1] - tenon[axis][1]) < 1e-6,
            ))).toBe(true);
          }
        }
      }
    }
  }
});

it("CSG confirms intact corner stock and zero glass/backer intersection, with a broken-tenon control", () => {
  const design = applyEdgeProtection(photoFrame({ ...input, options: { constructionVersion: "2", frameWidth: 15, frameThickness: 12, glassGrooveDepth: 12, glassThickness: 4, backThickness: 8 } }));
  const top = design.parts[0];
  const base = new BoxGeometry(top.visible.length, top.visible.thickness, top.visible.width);
  const cut = subtractMortisesFromGeometry(base, top.mortises.map(m => mortiseLocalBox(top, m)), undefined, { strict: true, unitsPerMm: 1 });
  try {
    // 330*15*22 stock - 330*12*14 rebate - two 15*15*6 corner mortises.
    expect(computeMeshVolume(cut)).toBeCloseTo(50760, 0);
  } finally { if (cut !== base) cut.dispose(); base.dispose(); }

  function panelIntersection(part: Part, tenon: Part["tenons"][number], panel: Part) {
    const b = boxBounds(part, tenonLocalBox(part, tenon));
    const center = { x: (b.x[0] + b.x[1]) / 2, y: (b.y[0] + b.y[1]) / 2, z: (b.z[0] + b.z[1]) / 2 };
    const solid = new BoxGeometry(b.x[1] - b.x[0], b.y[1] - b.y[0], b.z[1] - b.z[0]);
    const remaining = subtractMortisesFromGeometry(solid, [{
      cx: panel.origin.x - center.x, cy: panel.origin.y + panel.visible.thickness / 2 - center.y, cz: panel.origin.z - center.z,
      hx: panel.visible.length / 2, hy: panel.visible.thickness / 2, hz: panel.visible.width / 2,
    }], undefined, { strict: true, unitsPerMm: 1 });
    try { return computeMeshVolume(solid) - computeMeshVolume(remaining); }
    finally { if (remaining !== solid) remaining.dispose(); solid.dispose(); }
  }
  for (const part of design.parts.slice(2, 4)) for (const tenon of part.tenons) {
    for (const panel of design.parts.slice(4)) expect(panelIntersection(part, tenon, panel)).toBeCloseTo(0, 1);
  }
  // Undo the offset only: a centered tenon intersects 11*11*4mm of glass.
  expect(panelIntersection(design.parts[2], { ...design.parts[2].tenons[0], offsetThickness: 0 }, design.parts[4])).toBeCloseTo(484, 0);
});

it("includes rear rebate machining time per rail in both languages", () => {
  const design = photoFrame({ ...input, options: { constructionVersion: "2" } });
  const steps = deriveBuildSteps(design);
  expect(steps.find(step => step.id === "frame-rear-rebate")?.estimatedMinutes).toBe(24);
  const doubled = { ...design, parts: [...design.parts, ...design.parts.map(p => ({ ...p, id: `copy-${p.id}` }))] };
  expect(deriveBuildSteps(doubled).find(step => step.id === "frame-rear-rebate")?.estimatedMinutes).toBe(48);
  expect(translateSteps(steps, design, "en").find(step => step.id === "frame-rear-rebate")?.title).toBe("Machine rear rebates (4 rails)");
  expect(deriveBuildSteps(photoFrame(input)).some(step => step.id === "frame-rear-rebate")).toBe(false);
});

for (const cornerJoinery of ["butt", "miter"]) {
  it(`renderer removes the hand-calculated rebate volume: ${cornerJoinery}`, () => {
    const design = photoFrame({ ...input, options: { constructionVersion: "2", cornerJoinery } });
    for (const part of design.parts.filter(p => p.id.startsWith("frame-"))) {
      const scale = 0.01;
      const size: [number, number, number] = [part.visible.length * scale, part.visible.thickness * scale, part.visible.width * scale];
      const shape = part.shape;
      const base = shape?.kind === "mitered-ends"
        ? buildShapeGeometry({ kind: "mitered-ends", insetEach: 35 * scale, outerSide: shape.outerSide }, size)!
        : new BoxGeometry(...size);
      const cutter = mortiseLocalBox(part, part.mortises.find(m => m.label === "框背槽")!);
      const boxes = [{ ...cutter, cx: cutter.cx * scale, cy: cutter.cy * scale, cz: cutter.cz * scale, hx: cutter.hx * scale, hy: cutter.hy * scale, hz: cutter.hz * scale }];
      const removed = cornerJoinery === "miter" ? 6 * (part.visible.length - 70 + 6) * 8 : part.visible.length * 6 * 8;
      const cut = subtractMortisesFromGeometry(base, boxes);
      try {
        expect(Math.abs((computeMeshVolume(base) - computeMeshVolume(cut)) / scale ** 3 - removed)).toBeLessThan(1);
      } finally { if (base !== cut) cut.dispose(); base.dispose(); }
    }
    const assembled = toBeginnerMode(design);
    const backCollisions = (parts: Part[]) => findOverlaps(parts).filter(pair => pair.a === "back-panel" || pair.b === "back-panel");
    expect(backCollisions(assembled.parts)).toEqual([]);
    expect(backCollisions(assembled.parts.map(p => ({ ...p, mortises: [] })))).toHaveLength(4);
  });
}
