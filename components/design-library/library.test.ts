import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { buildEditHref, categoryImage, categoryName, fetchAllDesigns, selectDesigns, type DesignRow } from "./library";

const row = (id: string, name: string, type: string, updated = "2026-09-01"): DesignRow => ({
  id, name, furniture_type: type, updated_at: updated, created_at: "2026-08-01", params: {},
});
const rows = [row("a", "Alpha", "side_table"), row("b", "beta", "stool", "2026-09-07"), row("c", "Alpha", "side-table")];

describe("design library", () => {
  it("searches names and translated categories case-insensitively", () => {
    expect(selectDesigns(rows, " ALPHA ", "", "updated", "en").map(r => r.id)).toEqual(["a", "c"]);
    expect(selectDesigns(rows, "SIDE TABLE", "", "updated", "en").map(r => r.id)).toEqual(["a", "c"]);
    expect(selectDesigns(rows, "床邊桌", "", "updated", "zh-TW")).toHaveLength(2);
    expect(selectDesigns(rows, "absent", "", "updated", "en")).toEqual([]);
  });
  it("normalizes category filters and saved reference URLs without leaking params", () => {
    expect(selectDesigns(rows, "", "side_table", "name", "en")).toHaveLength(2);
    expect(buildEditHref({ ...rows[0], id: "a&b", params: { length: 1 } })).toBe("/design/side-table?designId=a%26b&loadSaved=1");
  });
  it("sorts stably without mutating the owned collection", () => {
    expect(selectDesigns(rows, "", "", "updated", "en").map(r => r.id)).toEqual(["b", "a", "c"]);
    expect(selectDesigns(rows, "", "", "name", "en").map(r => r.id)).toEqual(["a", "c", "b"]);
    expect(rows.map(r => r.id)).toEqual(["a", "b", "c"]);
  });
  it("uses only available category images, never an invented saved preview", () => {
    expect(categoryImage("side_table")).toBe("/thumbs/v2/side-table.webp");
    expect(existsSync(`public${categoryImage("side_table")}`)).toBe(true);
    expect(categoryImage("wall-mounted-tool-storage")).toBeNull();
    expect(categoryImage("unknown")).toBeNull();
    expect(categoryName("unknown", "en")).toBe("unknown");
  });
  it("retrieves beyond Supabase's default cap, including shortened server pages", async () => {
    const all = Array.from({ length: 1203 }, (_, i) => row(String(i), "Design", "stool"));
    const result = await fetchAllDesigns(async (from, to) => ({ data: all.slice(from, Math.min(to + 1, from + 137)), error: null }));
    expect(result).toEqual(all);
  });
  it("rejects a failed later page instead of displaying a partial library", async () => {
    await expect(fetchAllDesigns(async from => from === 0 ? { data: rows, error: null } : { data: null, error: { message: "offline" } })).rejects.toThrow("offline");
  });
  it("stops pagination on account cancellation", async () => {
    const controller = new AbortController();
    await expect(fetchAllDesigns(async () => { controller.abort(); return { data: rows, error: null }; }, controller.signal)).rejects.toThrow();
  });
});
