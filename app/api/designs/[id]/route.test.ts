import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const db = vi.hoisted(() => ({
  user: { id: "owner" } as { id: string } | null,
  result: { count: 1, error: null, data: [{ updated_at: "2026-09-05T10:00:00Z" }] },
  eq: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: db.user } }) } }),
  createAdminClient: () => ({ from: () => ({ update: () => {
    const query = { eq: (...args: unknown[]) => { db.eq(...args); return query; }, select: async () => db.result };
    return query;
  } }) }),
}));
import { PATCH } from "./route";
const id = "11111111-1111-1111-1111-111111111111";
function save(body: unknown) {
  return PATCH(new NextRequest(`http://localhost/api/designs/${id}`, { method: "PATCH", body: JSON.stringify(body) }), { params: Promise.resolve({ id }) });
}
beforeEach(() => { db.user = { id: "owner" }; db.result.count = 1; db.eq.mockClear(); });
it("uses ownership and revision as atomic update filters", async () => {
  const response = await save({ params: { length: 900 }, expectedUpdatedAt: "2026-09-04T10:00:00Z" });
  expect(response.status).toBe(200);
  expect(db.eq.mock.calls).toEqual([["id", id], ["user_id", "owner"], ["updated_at", "2026-09-04T10:00:00Z"]]);
  expect((await response.json()).updated_at).toBe("2026-09-05T10:00:00Z");
});
it("refuses a stale save instead of reporting success", async () => {
  db.result.count = 0;
  expect((await save({ params: { length: 900 }, expectedUpdatedAt: "2026-09-04T10:00:00Z" })).status).toBe(409);
});
it("rejects signed-out saves before reaching the database", async () => {
  db.user = null;
  expect((await save({ params: {} })).status).toBe(401);
  expect(db.eq).not.toHaveBeenCalled();
});
it("rejects a null body", async () => { expect((await save(null)).status).toBe(400); });
it("rejects unsigned model data before issuing any database update", async () => {
  expect((await save({ furnitureType: "stool", params: { length: 500, _modelSnapshot: { schema: 1 } } })).status).toBe(400);
  expect(db.eq).not.toHaveBeenCalled();
});
