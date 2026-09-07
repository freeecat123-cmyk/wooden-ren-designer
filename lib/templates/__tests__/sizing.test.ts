import { describe, it, expect } from "vitest";
import { FURNITURE_CATALOG } from "@/lib/templates";
import { FEATURED_TEMPLATE_CATEGORIES } from "@/lib/templates/marketing";
import { getSizingRows, ROUND_CATEGORIES, SIZING_SUB_KEYS, formatSizingValue, formatSizingRange } from "@/lib/templates/sizing";
import { SIZING_NOTES, getSizingNotes } from "@/lib/templates/sizing-notes";
import { SPEC_LABEL_EN } from "@/lib/templates/spec-labels";
import { FEATURED_TEMPLATE_CATEGORIES_EN } from "@/lib/templates/marketing-en";

describe("sizing table = program constants (all catalog templates)", () => {
  for (const entry of FURNITURE_CATALOG) {
    it(`${entry.category}: main dims match defaults/limits`, () => {
      const rows = getSizingRows(entry, "zh-TW");
      const byKey = Object.fromEntries(rows.map((r) => [r.key, r]));
      if (ROUND_CATEGORIES.has(entry.category)) {
        expect(byKey.diameter.defaultValue).toBe(entry.defaults.length);
        expect(byKey.diameter.max).toBe(entry.limits?.length ?? null);
        expect(byKey.length).toBeUndefined();
        expect(byKey.width).toBeUndefined();
      } else {
        expect(byKey.length.defaultValue).toBe(entry.defaults.length);
        expect(byKey.length.max).toBe(entry.limits?.length ?? null);
        expect(byKey.width.defaultValue).toBe(entry.defaults.width);
        expect(byKey.width.max).toBe(entry.limits?.width ?? null);
      }
      expect(byKey.height.defaultValue).toBe(entry.defaults.height);
      expect(byKey.height.max).toBe(entry.limits?.height ?? null);
    });

    it(`${entry.category}: sub-dimension rows match optionSchema`, () => {
      const rows = getSizingRows(entry, "zh-TW");
      const wanted = SIZING_SUB_KEYS[entry.category] ?? [];
      for (const key of wanted) {
        const spec = (entry.optionSchema ?? []).find((s) => s.key === key);
        const row = rows.find((r) => r.key === key);
        if (!spec || spec.type !== "number") {
          expect(row, `${key} not in schema → no row`).toBeUndefined();
          continue;
        }
        expect(row, `${key} row exists`).toBeDefined();
        expect(row!.defaultValue).toBe(spec.defaultValue);
        expect(row!.min).toBe(spec.min ?? null);
        expect(row!.max).toBe(spec.max ?? null);
        expect(row!.label).toBe(spec.label);
      }
      // 每款至少一個子尺寸真的對到 schema（白名單不能全是死 key）
      expect(rows.length).toBeGreaterThan(ROUND_CATEGORIES.has(entry.category) ? 2 : 3);
    });

    it(`${entry.category}: en labels resolve for every sub key`, () => {
      const rows = getSizingRows(entry, "en");
      for (const key of SIZING_SUB_KEYS[entry.category] ?? []) {
        const row = rows.find((r) => r.key === key);
        if (row) expect(SPEC_LABEL_EN[key], `${key} needs EN label`).toBeTruthy();
      }
    });
  }
});

describe("sizing notes", () => {
  it("every note set has both zh and en with equal counts", () => {
    for (const [cat, n] of Object.entries(SIZING_NOTES)) {
      expect(n!.zh.length, cat).toBeGreaterThan(0);
      expect(n!.en.length, cat).toBe(n!.zh.length);
    }
  });
  it("categories without basis return []", () => {
    expect(getSizingNotes("display-cabinet", "zh-TW")).toEqual([]);
    expect(getSizingNotes("dining-table", "en").length).toBeGreaterThan(0);
  });
  it("notes only reference real featured categories", () => {
    const all = new Set(FURNITURE_CATALOG.map((e) => e.category as string));
    for (const cat of Object.keys(SIZING_NOTES)) expect(all.has(cat), cat).toBe(true);
    // 中英行銷頁都有的款，兩邊表格列數一致
    for (const cat of FEATURED_TEMPLATE_CATEGORIES_EN) {
      const e = FURNITURE_CATALOG.find((x) => x.category === cat)!;
      expect(getSizingRows(e, "en").length).toBe(getSizingRows(e, "zh-TW").length);
    }
    expect(FEATURED_TEMPLATE_CATEGORIES.length).toBeGreaterThan(0);
  });
});

describe("formatting", () => {
  it("mm shows cm conversion; other units verbatim", () => {
    expect(formatSizingValue(750, "mm")).toBe("750 mm（75 cm）");
    expect(formatSizingValue(35, "mm")).toBe("35 mm（3.5 cm）");
    expect(formatSizingValue(5, "°")).toBe("5 °");
    expect(formatSizingValue(170, "cm")).toBe("170 cm");
    expect(formatSizingValue(3, "")).toBe("3");
    expect(formatSizingValue(750, "mm", "en")).toBe("750 mm (75 cm)");
  });
  it("range: main dims are upper-bound only; sub dims are min–max", () => {
    expect(formatSizingRange({ key: "h", label: "", min: null, max: 800, defaultValue: 750, unit: "mm" }, "zh-TW")).toBe("最多 800 mm（80 cm）");
    expect(formatSizingRange({ key: "h", label: "", min: null, max: 800, defaultValue: 750, unit: "mm" }, "en")).toBe("up to 800 mm (80 cm)");
    expect(formatSizingRange({ key: "s", label: "", min: 350, max: 550, defaultValue: 450, unit: "mm" }, "zh-TW")).toBe("350–550 mm（35–55 cm）");
    expect(formatSizingRange({ key: "a", label: "", min: 0, max: 15, defaultValue: 5, unit: "°" }, "en")).toBe("0–15 °");
  });
});
