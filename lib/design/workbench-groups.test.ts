import { describe, expect, it } from "vitest";
import { workbenchOptions } from "@/lib/templates/workbench";
import { groupWorkbenchSpecs, WORKBENCH_GROUP_KEYS } from "./workbench-groups";
import { evalDep } from "@/components/mobile/MobileOptionField";

describe("workbench purpose groups", () => {
  it("assigns every schema option exactly once without changing its identity or metadata", () => {
    const original = structuredClone(workbenchOptions);
    const groups = groupWorkbenchSpecs(workbenchOptions);
    expect(groups.map((g) => g.group)).toEqual(["structure", "top", "base", "vises", "storage", "machining"]);
    const flattened = groups.flatMap((g) => g.specs);
    expect(flattened.map((s) => s.key).sort()).toEqual(workbenchOptions.map((s) => s.key).sort());
    expect(new Set(Object.values(WORKBENCH_GROUP_KEYS).flat()).size).toBe(Object.values(WORKBENCH_GROUP_KEYS).flat().length);
    expect(Object.values(WORKBENCH_GROUP_KEYS).flat().filter((key) => key !== "constructionVersion").sort()).toEqual(workbenchOptions.filter((s) => s.key !== "constructionVersion").map((s) => s.key).sort());
    for (const spec of flattened) expect(spec).toBe(workbenchOptions.find((s) => s.key === spec.key));
    expect(workbenchOptions).toEqual(original);
  });

  it("places layers, storage and drilling with their purposes", () => {
    const groups = groupWorkbenchSpecs(workbenchOptions);
    const keys = (group: string) => groups.find((g) => g.group === group)!.specs.map((s) => s.key);
    expect(keys("top")).toContain("plyTopLayers");
    expect(keys("base")).toEqual(expect.arrayContaining(["legLayers", "lsLayers", "knockdown"]));
    expect(keys("storage")).toEqual(["withUnderShelf", "drawerCount", "drawerCols"]);
    expect(keys("machining")).toEqual(expect.arrayContaining(["legHoles", "dogHoles", "holdfastHoles"]));
    expect(keys("vises")).toContain("deadman");
  });

  it("keeps conditional options reachable after filtering, including cross-group dependencies", () => {
    const values = Object.fromEntries(workbenchOptions.map((s) => [s.key, s.defaultValue]));
    const scenarios: Record<string, string | number | boolean>[] = [{}, { materialStyle: "plywood" }, { drawerCount: 2 }, { topSplit: "center-well" }, { frontVise: "none" }];
    for (const overrides of scenarios) {
      const current = { ...values, ...overrides };
      const visible = workbenchOptions.filter((s) => !s.dependsOn || evalDep(s.dependsOn, current));
      expect(groupWorkbenchSpecs(visible).flatMap((g) => g.specs).map((s) => s.key).sort()).toEqual(visible.map((s) => s.key).sort());
    }
  });

  it("keeps future unknown options reachable and omits empty groups", () => {
    const spec = { ...workbenchOptions[0], key: "futureOption" };
    expect(groupWorkbenchSpecs([spec])).toEqual([expect.objectContaining({ group: "structure", specs: [spec] })]);
    expect(groupWorkbenchSpecs([])).toEqual([]);
  });

  it("keeps constructionVersion in structure without interpreting its default", () => {
    const version = { type: "select" as const, key: "constructionVersion", label: "Version", defaultValue: "1", group: "structure" as const, choices: [{ value: "1", label: "Original" }, { value: "2", label: "Revised" }] };
    const groups = groupWorkbenchSpecs([...workbenchOptions.filter((s) => s.key !== version.key), version]);
    expect(groups.find((g) => g.group === "structure")!.specs).toContain(version);
    expect(groups.flatMap((g) => g.specs).filter((s) => s.key === version.key)).toEqual([version]);
    expect(version.defaultValue).toBe("1");
  });
});
