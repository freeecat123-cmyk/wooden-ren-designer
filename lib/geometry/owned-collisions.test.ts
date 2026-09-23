import { createHash } from "node:crypto";
import { expect, it } from "vitest";
import { FURNITURE_CATALOG } from "@/lib/templates";
import { toBeginnerMode } from "@/lib/templates/beginner-mode";
import type { FurnitureCategory } from "@/lib/types";
import { findOverlaps } from "./overlap";

type Options = Record<string, string | number | boolean>;
const wb = { deadman: true, withUnderShelf: true, lowerStretcherArrangement: "box-frame" };
function build(category: FurnitureCategory, options: Options = {}) {
  const e = FURNITURE_CATALOG.find(e => e.category === category)!;
  return e.template!({ ...e.defaults, material: "maple", options });
}
const fingerprints: [FurnitureCategory, Options, string][] = [
  ["workbench", {}, "ab5cee8b4ab913462eabc346a4febfad17c71a7d34783ef9612aeb527ad714b0"],
  ["workbench", wb, "aeb64ec81241546929b4fc094e53e80f16d79c90fae742f621e7c0062c82e239"],
  ["stool", {}, "a9cacc0d82c46db64ffce6f53159eec84b833a498149de45fafd74680c98d9ae"],
  ["stool", { legShape: "curved-taper", ctTwoWay: true }, "6ea4ad9a53d8d32907912f96780d7abe59e06727f7c643ab21a90bf68a8d761e"],
  ["stool", { legShape: "curved-taper", ctLowerCove: true }, "bda13590717bb9c6f9ae85446cbe55c7dc76af59a6b68ca17ab924fbfe323afb"],
  ["stool", { legShape: "curved-taper", ctTwoWay: true, ctLowerCove: true }, "e16feb1f8daa019c509760e127d1bade6731c2c559f3436992c061438deb988f"],
  ["desk", {}, "c18d7c22732aeacc428463822070613a2df8c887048898578f0641e95e91486b"],
  ["desk", { legShape: "splayed-round-tapered" }, "44576cf3b8573a814078fd6e9f605fd15f62aba75db8fbcaf5e0908a93157ca1"],
  ["dovetail-box", {}, "ce3bb8bd884513afc7711cac1b3eb0d57b11c3ba3a7e06445f475e91017c52fc"],
  ["coat-rack", {}, "80d730eff346873584e6d251896c8883391247afb6baf30ab63f95e6629d4808"],
  ["round-table", {}, "449ca5db4048ff0cb424355c8f52081ee2d8a758867eddbb3558da931377b632"],
  ["round-table", { legShape: "pedestal" }, "9265713c7fa180148343ed5e54bf6e53eb9c9b412e32b01f87a540973462482c"],
];
for (const [category, options, hash] of fingerprints) {
  it(`preserves pre-edit geometry fingerprint: ${category} ${JSON.stringify(options)}`, () => {
    for (const version of [undefined, "1", 1, "unknown"]) {
      const d = build(category, { ...options, ...(version === undefined ? {} : { constructionVersion: version }) });
      expect(createHash("sha256").update(JSON.stringify(d.parts)).digest("hex")).toBe(hash);
    }
  });
}

for (const overrides of [{}, { viseSide: "right" }, { materialStyle: "plywood" }, { frontVise: "leg", lowerStretcherArrangement: "pair-x", legDepth: 75 }] as Options[]) {
  it(`v2 deadman rear relief clears the shelf, missing relief fails: ${JSON.stringify(overrides)}`, () => {
    const old = build("workbench", { ...wb, ...overrides });
    const revised = build("workbench", { ...wb, ...overrides, constructionVersion: "2" });
    expect(revised.parts.map(p => [p.id, p.visible, p.origin, p.shape])).toEqual(old.parts.map(p => [p.id, p.visible, p.origin, p.shape]));
    const pair = toBeginnerMode(revised).parts.filter(p => ["deadman-board", "under-shelf"].includes(p.id));
    expect(pair).toHaveLength(2);
    expect(findOverlaps(pair)).toEqual([]);
    expect(findOverlaps(pair.map(p => ({ ...p, mortises: [] })))).toHaveLength(1);
  });
}

for (const footCount of [3, 4]) it(`v2 coat-rack ${footCount} foot long axes point radially away from the column`, () => {
  const d = build("coat-rack", { constructionVersion: "2", footCount });
  for (const foot of d.parts.filter(p => p.id.startsWith("foot-"))) {
    const a = foot.rotation!.y;
    const r = Math.hypot(foot.origin.x, foot.origin.z);
    expect((foot.origin.x * Math.cos(a) - foot.origin.z * Math.sin(a)) / r).toBeCloseTo(1);
  }
});

it("offers explicit revisions only, with legacy schema defaults", () => {
  for (const category of ["coat-rack", "workbench", "stool", "desk", "round-table"]) {
    const option = FURNITURE_CATALOG.find(e => e.category === category)!.optionSchema!.find(s => s.key === "constructionVersion")!;
    expect(option).toMatchObject({ type: "select", defaultValue: "1", group: "structure", label: "結構版本" });
    if (option.type !== "select") throw new Error("Construction version must be a select");
    expect(option.choices?.map(c => c.value)).toEqual(["1", "2"]);
    expect(option.choices?.map(c => c.label)).toEqual(["原版", "修正版"]);
  }
});

it("does not mistake radial tangency for a collision; inward-shifted hooks still fail", () => {
  const d = toBeginnerMode(build("coat-rack"));
  const column = d.parts.find(p => p.id === "column")!;
  for (const hook of d.parts.filter(p => p.id.startsWith("hook-"))) {
    expect(findOverlaps([column, hook])).toEqual([]);
    const r = Math.hypot(hook.origin.x, hook.origin.z);
    expect(findOverlaps([column, { ...hook, origin: { ...hook.origin, x: hook.origin.x * (r - 10) / r, z: hook.origin.z * (r - 10) / r } }])).toHaveLength(1);
  }
});

it("recognizes sliding lid rebates on shaped walls without excusing missing cuts or the wall joints", () => {
  const d = toBeginnerMode(build("dovetail-box"));
  const lid = d.parts.find(p => p.id === "lid")!;
  for (const wall of d.parts.filter(p => ["wall-front", "wall-back"].includes(p.id))) {
    expect(findOverlaps([wall, lid])).toEqual([]);
    expect(findOverlaps([{ ...wall, mortises: [] }, lid])).toHaveLength(1);
  }
  expect(findOverlaps(d.parts)).toHaveLength(0);
});
