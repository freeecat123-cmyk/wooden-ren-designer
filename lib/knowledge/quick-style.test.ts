import { expect, it } from "vitest";
import { FURNITURE_CATALOG } from "../templates";
import { STYLE_PRESETS } from "./style-presets";
import { quickStyleQuery } from "./quick-style";

it("does not apply furniture styling to a workbench", () => {
  const entry = FURNITURE_CATALOG.find(e => e.category === "workbench")!;
  expect(quickStyleQuery(new URLSearchParams(), "shaker", entry.category, entry.optionSchema ?? [])).toBeNull();
});

it("preserves user configuration and repeats deterministically for every template and style", () => {
  let supported = 0;
  for (const entry of FURNITURE_CATALOG) for (const id of Object.keys(STYLE_PRESETS)) {
    const original = new URLSearchParams("length=1800&width=650&height=830&material=pine&constructionVersion=1&drawerCount=3&doorStyle=panel&designId=owned&revision=4&styleVariant=99&legSize=85&joineryMode=true");
    const next = quickStyleQuery(original, id, entry.category, entry.optionSchema ?? []);
    if (!next) continue;
    supported++;
    for (const [key, value] of original) {
      if (key === "styleVariant") continue;
      expect(next.get(key), `${entry.category}/${id}/${key}`).toBe(value);
    }
    expect(next.has("styleVariant")).toBe(false);
    expect(quickStyleQuery(next, id, entry.category, entry.optionSchema ?? [])?.toString()).toBe(next.toString());
  }
  expect(supported).toBeGreaterThan(0);
});
