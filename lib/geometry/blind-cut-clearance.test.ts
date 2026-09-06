import { expect, it } from "vitest";
import { FURNITURE_CATALOG } from "@/lib/templates";
import { toBeginnerMode } from "@/lib/templates/beginner-mode";
import type { Part } from "@/lib/types";
import { findOverlaps } from "./overlap";

const stock: Part = { id: "stock", nameZh: "stock", material: "maple", grainDirection: "length", visible: { length: 100, width: 100, thickness: 100 }, origin: { x: 0, y: 0, z: 0 }, tenons: [], mortises: [{ origin: { x: 50, y: 50, z: 0 }, depth: 20, length: 50, width: 50, through: false, cosmetic: true }] };
const peg: Part = { ...stock, id: "peg", visible: { length: 10, width: 30, thickness: 30 }, origin: { x: 45, y: 35, z: 0 }, mortises: [] };

it("clears only a fully enclosing rendered rectangular pocket", () => {
  expect(findOverlaps([stock, peg])).toEqual([]);
  for (const patch of [{ depth: 5 }, { width: 10 }, { shape: "round" as const }, { cosmetic: false }, { rotZ: 0.1 }]) {
    expect(findOverlaps([{ ...stock, mortises: stock.mortises.map(m => ({ ...m, ...patch })) }, peg])).toHaveLength(1);
  }
  expect(findOverlaps([stock, { ...peg, origin: { ...peg.origin, z: 40 } }])).toHaveLength(1);
});

it("does not bridge a thin solid strip between two pockets", () => {
  const pocket = stock.mortises[0];
  const split = (gap: number): Part => ({ ...stock, mortises: [-1, 1].map(sign => ({
    ...pocket, width: 15 - gap / 2,
    origin: { ...pocket.origin, z: sign * (7.5 + gap / 4) },
  })) });
  expect(findOverlaps([split(0), peg])).toEqual([]);
  expect(findOverlaps([split(0.2), peg])).toHaveLength(1);
  expect(findOverlaps([{ ...stock, mortises: [{ ...pocket, label: "百葉槽 1" }] }, peg])).toHaveLength(1);
});

const deadmanCases: Record<string, string | number | boolean>[] = [
  { lowerStretcherArrangement: "box-frame", withUnderShelf: true },
  { topSplit: "center-well" }, { lowerStretcherArrangement: "box-frame" },
  { viseSide: "right", endVise: "wagon", lowerStretcherArrangement: "box-frame" },
  { frontVise: "leg", lowerStretcherArrangement: "pair-x" }, { legDepth: 75 },
];
for (const overrides of deadmanCases) {
  it(`deadman grooves clear rails, not the unrelated shelf: ${JSON.stringify(overrides)}`, () => {
    const entry = FURNITURE_CATALOG.find(e => e.category === "workbench")!;
    const options = { ...Object.fromEntries(entry.optionSchema!.map(s => [s.key, s.defaultValue])), deadman: true, ...overrides };
    const design = toBeginnerMode(entry.template!({ ...entry.defaults, material: "maple", options }));
    const parts = design.parts.filter(p => ["deadman-board", "deadman-rail", "deadman-ridge"].includes(p.id));
    expect(parts).toHaveLength(3);
    expect(findOverlaps(parts)).toEqual([]);
    expect(findOverlaps(parts.map(p => ({ ...p, mortises: [] })))).toHaveLength(2);
    if (overrides.withUnderShelf) {
      const shelf = design.parts.find(p => p.id === "under-shelf")!;
      expect(findOverlaps([...parts, shelf]).map(p => [p.a, p.b])).toEqual([["deadman-board", "under-shelf"]]);
    }
  });
}

it("recognizes the dovetail-box lid rebate without excusing wall joints", () => {
  const entry = FURNITURE_CATALOG.find(e => e.category === "dovetail-box")!;
  const design = toBeginnerMode(entry.template!({ ...entry.defaults, material: "maple", options: Object.fromEntries(entry.optionSchema!.map(s => [s.key, s.defaultValue])) }));
  const parts = design.parts.filter(p => ["wall-right", "lid"].includes(p.id));
  expect(parts).toHaveLength(2);
  expect(findOverlaps(parts)).toEqual([]);
  expect(findOverlaps(parts.map(p => ({ ...p, mortises: [] })))).toHaveLength(1);
  expect(findOverlaps(design.parts)).toHaveLength(6);
});
