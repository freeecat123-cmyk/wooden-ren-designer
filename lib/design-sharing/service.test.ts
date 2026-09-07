import { afterEach, expect, it, vi } from "vitest";
import { photoFrame } from "@/lib/templates/photo-frame";
import { FURNITURE_CATALOG } from "@/lib/templates";
import { makeModelSnapshot } from "@/lib/design/model-snapshot";
import { publicGeometry } from "./payload";
import type { ConstructionMortise } from "@/lib/geometry/construction-cuts";
import { createPublication, resolvePublication, revokePublication, type ShareStore, type Publication } from "./service";

afterEach(() => vi.unstubAllEnvs());
const revision = "2026-09-07T00:00:00.000Z";
it("preserves louver classification without publishing freeform label suffixes", () => {
  const entry = FURNITURE_CATALOG.find(e => e.category === "shoe-cabinet")!;
  const model = entry.template!({ ...entry.defaults, material: "pine", options: { ...Object.fromEntries(entry.optionSchema!.map(s => [s.key, s.defaultValue])), doorType: "louvered" } });
  const grooves = model.parts.flatMap(p => p.mortises).filter(m => m.label?.startsWith("百葉槽"));
  expect(grooves.length).toBeGreaterThan(0);
  for (const groove of grooves) groove.label += " PRIVATE CUSTOMER";
  const normalCuts = (d: typeof model) => d.parts.flatMap(p => p.mortises).filter(m => m.cosmetic && !m.label?.startsWith("百葉槽")).length;
  const result = publicGeometry(model, false).design;
  expect(normalCuts(result)).toBe(normalCuts(model));
  expect(result.parts.flatMap(p => p.mortises).filter(m => m.label === "百葉槽")).toHaveLength(grooves.length);
  expect(JSON.stringify(result)).not.toContain("PRIVATE CUSTOMER");
});
it("preserves validated v2 construction cuts without nested private fields", () => {
  const model = photoFrame({ length: 300, width: 200, height: 25, material: "pine" });
  const box = { cx: 1, cy: 2, cz: 3, hx: 4, hy: 5, hz: 6, depthAxis: "z" as const };
  const cut: ConstructionMortise = { origin: { x: 0, y: 0, z: 0 }, depth: 12, length: 8, width: 10, through: false, cosmetic: true, shape: "rect", constructionCut: { version: 2, box } };
  model.parts[0].mortises = [JSON.parse(JSON.stringify({ ...cut, constructionCut: { ...cut.constructionCut, customer: "PRIVATE", box: { ...box, customer: "PRIVATE" } } }))];
  const result = publicGeometry(model, false);
  expect((result.design.parts[0].mortises[0] as ConstructionMortise).constructionCut).toEqual({ version: 2, box });
  expect(JSON.stringify(result)).not.toContain("PRIVATE");
  model.parts[0].mortises = [{ ...cut, constructionCut: { version: 2, box: { ...box, hx: -1 } } } as ConstructionMortise];
  expect(() => publicGeometry(model, false)).toThrow();
});
it("preserves every field of outline and edge-profile geometry", () => {
  const model = photoFrame({ length: 300, width: 200, height: 25, material: "pine" });
  model.parts[0].shape = { kind: "top-outline", style: "arch", sizeMm: 15, sizeZMm: 12, squareness: 0.4, archSides: "front-back", lobes: 4 };
  model.parts[1].shape = { kind: "edge-profile", style: "wave", depthMm: 12, waveCount: 3 };
  const result = publicGeometry(model, true);
  expect(result.design.parts[0].shape).toEqual(model.parts[0].shape);
  expect(result.design.parts[1].shape).toEqual(model.parts[1].shape);
});
function fixture() {
  vi.stubEnv("MODEL_SNAPSHOT_SIGNING_KEY", "test-sharing-secret");
  const params = { length: 300, width: 200, height: 25, material: "pine" as const };
  const model = photoFrame(params);
  model.nameZh = "PRIVATE CUSTOMER";
  model.notes = "PRIVATE CUSTOMER";
  model.parts[0].nameZh = "PRIVATE CUSTOMER";
  model.parts[0].mortises.push({ origin: { x: 0, y: 0, z: 0 }, depth: 1, width: 1, length: 1, through: false, label: "PRIVATE CUSTOMER" });
  const saved = { id: "design", user_id: "owner", furniture_type: "photo-frame", updated_at: revision,
    params: { ...params, _modelSnapshot: makeModelSnapshot("photo-frame", params, model, model, "en")! } };
  const rows = new Map<string, Publication>();
  const store: ShareStore = {
    ownedDesign: vi.fn(async (id, owner) => id === saved.id && owner === saved.user_id ? saved : null),
    insert: vi.fn(async row => { rows.set(row.token, structuredClone(row)); }),
    active: vi.fn(async token => { const r = rows.get(token); return r && !r.revoked_at ? structuredClone(r) : null; }),
    revoke: vi.fn(async (token, owner) => { const r = rows.get(token); if (!r || r.owner_id !== owner) return false; r.revoked_at = revision; return true; }),
  };
  return { saved, model, store, rows };
}
it("requires authenticated ownership and never inserts for strangers", async () => {
  const { store } = fixture();
  await expect(createPublication(store, null, "design", revision)).rejects.toMatchObject({ status: 401 });
  await expect(createPublication(store, "stranger", "design", revision)).rejects.toMatchObject({ status: 404 });
  expect(store.insert).not.toHaveBeenCalled();
});
it("rejects stale, unsigned and tampered saved revisions", async () => {
  const { store, saved } = fixture();
  await expect(createPublication(store, "owner", "design", "old")).rejects.toMatchObject({ status: 409 });
  saved.params._modelSnapshot.design.parts[0].visible.length++;
  await expect(createPublication(store, "owner", "design", revision)).rejects.toMatchObject({ status: 422 });
  saved.params._modelSnapshot = undefined!;
  await expect(createPublication(store, "owner", "design", revision)).rejects.toMatchObject({ status: 422 });
  expect(store.insert).not.toHaveBeenCalled();
});
it("publishes immutable exact geometry without private metadata, params or signature", async () => {
  const { store, saved, model } = fixture();
  const published = await createPublication(store, "owner", "design", revision);
  expect(published.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  const view = await resolvePublication(store, published.token);
  expect(view.design.parts[0].visible).toEqual(model.parts[0].visible);
  expect(view.design.parts[0].mortises[0].origin).toEqual(model.parts[0].mortises[0].origin);
  expect(JSON.stringify(view)).not.toMatch(/PRIVATE CUSTOMER|signature|owner_id|user_id|_modelSnapshot|input|params/);
  saved.params._modelSnapshot.design.parts[0].visible.length++;
  expect(await resolvePublication(store, published.token)).toEqual(view);
});
it("creates independent opaque publications and only owners can revoke", async () => {
  const { store } = fixture();
  const first = await createPublication(store, "owner", "design", revision);
  const second = await createPublication(store, "owner", "design", revision);
  expect(first.token).not.toBe(second.token);
  await expect(revokePublication(store, null, first.token)).rejects.toMatchObject({ status: 401 });
  await expect(revokePublication(store, "stranger", first.token)).rejects.toMatchObject({ status: 404 });
  await revokePublication(store, "owner", first.token);
  await revokePublication(store, "owner", first.token);
  await expect(resolvePublication(store, first.token)).rejects.toMatchObject({ status: 404 });
  await expect(resolvePublication(store, "x".repeat(43))).rejects.toMatchObject({ status: 404 });
  await expect(resolvePublication(store, "bad")).rejects.toMatchObject({ status: 404 });
  expect((await resolvePublication(store, second.token)).schema).toBe(1);
});
