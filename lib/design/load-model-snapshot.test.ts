import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { photoFrame } from "@/lib/templates/photo-frame";
import { makeModelSnapshot } from "./model-snapshot";
import { savedDesignQuery } from "./saved-query";

const state = vi.hoisted(() => ({ user: { id: "owner" } as { id: string } | null, saved: null as unknown, error: null as unknown, eq: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({
  auth: { getUser: async () => ({ data: { user: state.user } }) },
  from: () => { const query = { select: () => query, eq: (...args: unknown[]) => { state.eq(...args); return query; }, maybeSingle: async () => ({ data: state.saved, error: state.error }) }; return query; },
}) }));
import { loadModelSnapshot, preserveSavedReference } from "./load-model-snapshot";
const id = "11111111-1111-1111-1111-111111111111";
const params = { length: 300, width: 200, height: 25, material: "pine", joineryMode: false, options: { frameWidth: 35 } };
const query = Object.fromEntries(savedDesignQuery(id, params, "v1"));
beforeEach(() => {
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-only-key");
  const raw = photoFrame({ ...params, material: "pine" });
  state.saved = { furniture_type: "photo-frame", updated_at: "v1", params: { ...params, _modelSnapshot: makeModelSnapshot("photo-frame", params, raw, raw, "zh-TW") } };
  state.user = { id: "owner" }; state.error = null; state.eq.mockClear();
});
afterEach(() => vi.unstubAllEnvs());
it("loads only the owned, matching model", async () => {
  expect((await loadModelSnapshot("photo-frame", query))?.design.category).toBe("photo-frame");
  expect(state.eq).toHaveBeenCalledWith("user_id", "owner");
  expect(state.eq).toHaveBeenCalledWith("id", id);
});
it("uses live geometry after edits, never another category or stale revision", async () => {
  expect(await loadModelSnapshot("photo-frame", { ...query, length: "301" })).toBeNull();
  expect(await loadModelSnapshot("stool", query)).toBeNull();
  await expect(loadModelSnapshot("photo-frame", { ...query, revision: "old" })).rejects.toThrow("Saved design changed");
});
it("does not read private models for a signed-out visitor", async () => {
  state.user = null;
  expect(await loadModelSnapshot("photo-frame", query)).toBeNull();
  expect(state.eq).not.toHaveBeenCalled();
});
it("does not silently regenerate after a database or signature failure", async () => {
  state.error = { code: "offline" };
  await expect(loadModelSnapshot("photo-frame", query)).rejects.toThrow();
  state.error = null;
  state.saved = { furniture_type: "photo-frame", updated_at: "v1", params: { ...params, _modelSnapshot: {} } };
  await expect(loadModelSnapshot("photo-frame", query)).rejects.toThrow();
});
it("keeps private output references without copying unrelated URL controls", () => {
  expect(Object.fromEntries(preserveSavedReference(new URLSearchParams("length=300"), { ...query, scene: "dark" }))).toEqual({ length: "300", designId: id, revision: "v1" });
});
