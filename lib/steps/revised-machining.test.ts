import { expect, it } from "vitest";
import { workbench } from "@/lib/templates/workbench";
import { deriveBuildSteps } from "./derive";
import { translateSteps } from "./translations";
import { FURNITURE_CATALOG } from "@/lib/templates";
import { chineseCabinet, chineseCabinetOptions } from "@/lib/templates/chinese-cabinet";

it("includes the revised deadman clearance operation only when actually machined", () => {
  const input = { length: 1800, width: 600, height: 850, material: "pine" as const,
    options: { deadman: true, withLowerStretchers: true, withUnderShelf: true, constructionVersion: "2" } };
  const design = workbench(input);
  const cuts = design.parts.flatMap(p => p.mortises).filter(m => m.label === "滑板後側避層板槽");
  expect(cuts).toHaveLength(1);
  const steps = deriveBuildSteps(design);
  expect(steps.find(s => s.id === "deadman-shelf-clearance")?.estimatedMinutes).toBe(8);
  expect(translateSteps(steps, design, "en").find(s => s.id === "deadman-shelf-clearance")?.title).toBe("Machine deadman shelf clearance");
  expect(deriveBuildSteps(workbench({ ...input, options: { ...input.options, constructionVersion: "1" } })).some(s => s.id === "deadman-shelf-clearance")).toBe(false);
});

it("counts cabinet machining sites, not the many overlapping cutter passes", () => {
  const input = { length: 800, width: 400, height: 1500, material: "maple" as const,
    options: { ...Object.fromEntries(chineseCabinetOptions.map(s => [s.key, s.defaultValue])), constructionVersion: "2" } };
  const design = chineseCabinet(input);
  const expected = { "cabinet-panel-grooves": 36, "cabinet-hoof-reliefs": 128, "cabinet-integral-spandrels": 48 };
  for (const [id, minutes] of Object.entries(expected)) {
    expect(deriveBuildSteps(design).find(s => s.id === id)?.estimatedMinutes, id).toBe(minutes);
    const doubled = { ...design, parts: [...design.parts, ...design.parts.map(p => ({ ...p, id: `${p.id}-copy` }))] };
    expect(deriveBuildSteps(doubled).find(s => s.id === id)?.estimatedMinutes).toBe(2 * minutes);
    expect(translateSteps(deriveBuildSteps(design), design, "en").find(s => s.id === id)?.title).toMatch(/^[A-Za-z]/);
  }
  const legacy = chineseCabinet({ ...input, options: { ...input.options, constructionVersion: "1" } });
  expect(deriveBuildSteps(legacy).some(s => Object.hasOwn(expected, s.id))).toBe(false);
  const round = chineseCabinet({ ...input, options: { ...input.options, cabinetPreset: "round-cabinet" } });
  expect(deriveBuildSteps(round).find(s => s.id === "cabinet-raked-ends")?.estimatedMinutes).toBe(64);
  const roundDouble = { ...round, parts: [...round.parts, ...round.parts.map(p => ({ ...p, id: `${p.id}-copy` }))] };
  expect(deriveBuildSteps(roundDouble).find(s => s.id === "cabinet-raked-ends")?.estimatedMinutes).toBe(128);
  const legacyRound = chineseCabinet({ ...input, options: { ...input.options, cabinetPreset: "round-cabinet", constructionVersion: "1" } });
  expect(deriveBuildSteps(legacyRound).some(s => s.id === "cabinet-raked-ends")).toBe(false);
  const splayed = chineseCabinet({ length: 1000, width: 550, height: 2000, material: "maple",
    options: { constructionVersion: "2", cabinetPreset: "round-cabinet", legShape: "box", splayAngle: 3 } });
  expect(splayed.parts.flatMap(p => p.mortises).filter(m => m.label === "側腳避讓")).toHaveLength(12);
  expect(deriveBuildSteps(splayed).find(s => s.id === "cabinet-shelf-reliefs")?.estimatedMinutes).toBe(72);
  const splayedDouble = { ...splayed, parts: [...splayed.parts, ...splayed.parts.map(p => ({ ...p, id: `${p.id}-copy` }))] };
  expect(deriveBuildSteps(splayedDouble).find(s => s.id === "cabinet-shelf-reliefs")?.estimatedMinutes).toBe(144);
  expect(translateSteps(deriveBuildSteps(splayed), splayed, "en").find(s => s.id === "cabinet-shelf-reliefs")?.title).toBe("Cut shelf-to-post clearance notches");
});

it("counts actual construction housings and scales machining time with their quantity", () => {
  const entry = FURNITURE_CATALOG.find(e => e.category === "round-table")!;
  const input = { ...entry.defaults, material: "pine" as const, options: {
    ...Object.fromEntries(entry.optionSchema!.map(s => [s.key, s.defaultValue])),
    legShape: "pedestal", constructionVersion: "2",
  } };
  const design = entry.template!(input);
  const cuts = design.parts.flatMap(p => p.mortises).filter(m => "constructionCut" in m);
  expect(cuts).toHaveLength(4);
  const steps = deriveBuildSteps(design);
  expect(steps.find(s => s.id === "construction-housings")?.estimatedMinutes).toBe(32);
  expect(translateSteps(steps, design, "en").find(s => s.id === "construction-housings")?.title).toBe("Machine construction housings");
  const doubled = { ...design, parts: [...design.parts, ...design.parts.map(p => ({ ...p, id: `${p.id}-copy` }))] };
  expect(deriveBuildSteps(doubled).find(s => s.id === "construction-housings")?.estimatedMinutes).toBe(64);
  const legacy = entry.template!({ ...input, options: { ...input.options, constructionVersion: "1" } });
  expect(deriveBuildSteps(legacy).some(s => s.id === "construction-housings")).toBe(false);
});
