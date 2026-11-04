import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const state = vi.hoisted(() => ({ admin: false, count: 1, insert: vi.fn(), user: { id: "owner", email: "fixture@example.test" } as { id: string; email: string } | null }));
vi.mock("@/lib/admin", () => ({ getServerAdminEmails: () => [], isAdminEmail: () => state.admin }));
vi.mock("@/lib/unlocks", () => ({ fetchUnlockedCategories: async () => [] }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: state.user } }) } }),
  createAdminClient: () => ({ from: (table: string) => ({
    select: () => ({ eq: () => table === "users" ? { single: async () => ({ data: { plan: "free" } }) } : Promise.resolve({ count: state.count }) }),
    insert: (record: unknown) => { state.insert(record); return { select: () => ({ single: async () => ({ data: { id: "created", name: "Test", updated_at: "2026-09-06T00:00:00Z" }, error: null }) }) }; },
  }) }),
}));
import { POST } from "./route";
const create = () => POST(new NextRequest("http://localhost/api/designs/create", { method: "POST", body: JSON.stringify({ furnitureType: "stool", name: "Test", params: { length: 500 } }) }));
beforeEach(() => { state.admin = false; state.count = 1; state.user = { id: "owner", email: "fixture@example.test" }; state.insert.mockClear(); });
it("honors the server-verified administrator's existing unlimited entitlement", async () => {
  state.admin = true;
  const response = await create();
  expect(response.status).toBe(201);
  expect(state.insert).toHaveBeenCalledWith(expect.objectContaining({ user_id: "owner" }));
  expect((await response.json()).updated_at).toBe("2026-09-06T00:00:00Z");
});
it("keeps the free account's three-design limit (2026-11-04: raised from 1 to 3)", async () => {
  state.count = 3;
  const response = await create();
  expect(response.status).toBe(403);
  expect((await response.json()).error).toBe("max_designs_reached");
  expect(state.insert).not.toHaveBeenCalled();
});
it("lets a free account save while under the limit (1 and 2 existing designs: the old limit blocked at 1)", async () => {
  for (const count of [1, 2]) {
    state.count = count;
    state.insert.mockClear();
    const response = await create();
    expect(response.status).toBe(201);
    expect(state.insert).toHaveBeenCalledTimes(1);
  }
});
it("requires authentication even when administrator detection is mocked true", async () => {
  state.admin = true; state.user = null;
  expect((await create()).status).toBe(401);
  expect(state.insert).not.toHaveBeenCalled();
});
