import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const state = vi.hoisted(() => ({ user: { id: "owner" } as { id: string } | null, calls: [] as unknown[][],
  current: { id: "design" } as unknown, version: { params: { length: 900 }, name: "Old", furniture_type: "stool" } as unknown,
  restored: { id: "design", updated_at: "2026-09-05T11:00:00Z" } as unknown,
  versions: Array.from({ length: 21 }, (_, i) => ({ id: String(i) })) as Array<Record<string, unknown>>,
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: state.user } }) } }),
  createAdminClient: () => ({ from: (table: string) => {
    let updating = false;
    const query = {
      select: () => query,
      eq: (key: string, value: unknown) => { state.calls.push([table, key, value]); return query; },
      order: () => query,
      range: async () => ({ data: state.versions, error: null }),
      update: (patch: unknown) => { updating = true; state.calls.push(["update", patch]); return query; },
      maybeSingle: async () => ({ data: updating ? state.restored : table === "designs" ? state.current : state.version, error: null }),
    };
    return query;
  } }),
}));
import { GET, POST } from "./route";
const id = "11111111-1111-1111-1111-111111111111";
const versionId = "22222222-2222-2222-2222-222222222222";
const revision = "2026-09-05T10:00:00Z";
const context = { params: Promise.resolve({ id }) };
const list = () => GET(new NextRequest(`http://localhost/api/designs/${id}/versions`), context);
const restore = () => POST(new NextRequest(`http://localhost/api/designs/${id}/versions`, { method: "POST", body: JSON.stringify({ versionId, expectedUpdatedAt: revision }) }), context);
beforeEach(() => {
  state.user = { id: "owner" }; state.calls = []; state.current = { id }; state.restored = { id, updated_at: revision };
  state.version = { params: { length: 900 }, name: "Old", furniture_type: "stool" };
  state.versions = Array.from({ length: 21 }, (_, i) => ({ id: String(i) }));
});
it("requires authentication for listing and restoring", async () => {
  state.user = null;
  expect((await list()).status).toBe(401);
  expect((await restore()).status).toBe(401);
  expect(state.calls).toEqual([]);
});
it("paginates owned history without exposing the lookahead record", async () => {
  const response = await list();
  const data = await response.json();
  expect(data.versions).toHaveLength(20);
  expect(data.hasMore).toBe(true);
  expect(state.calls).toContainEqual(["design_versions", "design_id", id]);
  expect(state.calls).toContainEqual(["design_versions", "user_id", "owner"]);
  expect(response.headers.get("cache-control")).toContain("no-store");
});
it("does not list versions for a design the user cannot access", async () => {
  state.current = null;
  expect((await list()).status).toBe(404);
  expect(state.calls.some(call => call[0] === "design_versions")).toBe(false);
});
it("restores the owned snapshot with an atomic revision precondition", async () => {
  expect((await restore()).status).toBe(200);
  expect(state.calls).toContainEqual(["design_versions", "id", versionId]);
  expect(state.calls).toContainEqual(["design_versions", "design_id", id]);
  expect(state.calls).toContainEqual(["design_versions", "user_id", "owner"]);
  expect(state.calls).toContainEqual(["designs", "user_id", "owner"]);
  expect(state.calls).toContainEqual(["designs", "updated_at", revision]);
  expect(state.calls).toContainEqual(["update", { params: { length: 900 }, name: "Old", furniture_type: "stool" }]);
});
it("rejects a version from another design or account before updating", async () => {
  state.version = null;
  expect((await restore()).status).toBe(404);
  expect(state.calls.some(call => call[0] === "update")).toBe(false);
});
it("does not report success when another editor saved first", async () => {
  state.restored = null;
  expect((await restore()).status).toBe(409);
});
it("does not send full model archives in the history listing", async () => {
  state.versions = [{ id: versionId, params: { length: 500, _modelSnapshot: { locale: "zh-TW", raw: "large-model" } } }];
  const data = await (await list()).json();
  expect(data.versions[0].params).toEqual({ length: 500 });
  expect(data.versions[0].hasModelSnapshot).toBe(true);
});
it("refuses corrupt archived models without overwriting the current design", async () => {
  state.version = { furniture_type: "stool", params: { _modelSnapshot: { schema: 1 } } };
  expect((await restore()).status).toBe(409);
  expect(state.calls.some(call => call[0] === "update")).toBe(false);
});
