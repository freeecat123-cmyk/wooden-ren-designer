import { describe, expect, it } from "vitest";
import { FURNITURE_CATALOG } from "@/lib/templates";
import { toBeginnerMode } from "@/lib/templates/beginner-mode";
import type { MaterialId, OptionSpec } from "@/lib/types";
import { deriveRequiredTools } from "./derive";
import { TOOL_CATALOG } from "./catalog";

function build(category: string) {
  const e = FURNITURE_CATALOG.find((x) => x.category === category)!;
  const opts = (e.optionSchema ?? []).reduce<Record<string, string | number | boolean>>((a, s: OptionSpec) => { a[s.key] = s.defaultValue; return a; }, {});
  return e.template!({ length: e.defaults.length, width: e.defaults.width, height: e.defaults.height, material: "maple" as MaterialId, options: opts });
}

describe("組裝版的工具清單要有螺絲那一套（2026-09-02）", () => {
  it("方凳組裝版：電鑽 / 斜孔治具 / TENZ 螺絲都在，且 TENZ 有商店連結", () => {
    const tools = deriveRequiredTools(toBeginnerMode(build("stool")));
    const ids = tools.map((t) => t.tool.id);
    expect(ids).toContain("drill");
    expect(ids).toContain("pocket-hole-jig");
    expect(ids).toContain("tenz-screw-set");
    expect(ids).toContain("mallet");
    const tenz = tools.find((t) => t.tool.id === "tenz-screw-set")!;
    expect(tenz.tool.shopUrl).toMatch(/^https:\/\/woodenren\.easy\.co\/products\//);
  });
  it("工序步驟用的 rubber-mallet 也有商店連結", () => {
    expect(TOOL_CATALOG["rubber-mallet"].shopUrl).toBe(TOOL_CATALOG.mallet.shopUrl);
  });
  it("榫接版不會因此多出斜孔治具", () => {
    const ids = deriveRequiredTools(build("stool")).map((t) => t.tool.id);
    expect(ids).not.toContain("pocket-hole-jig");
  });
  it("全目錄組裝版每一款都列 TENZ 螺絲", () => {
    for (const e of FURNITURE_CATALOG) {
      if (!e.template) continue;
      const ids = deriveRequiredTools(toBeginnerMode(build(e.category))).map((t) => t.tool.id);
      expect(ids, e.category).toContain("tenz-screw-set");
    }
  });
});
