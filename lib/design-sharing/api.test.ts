import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ user: null as { id: string } | null, create: vi.fn(), resolve: vi.fn(), revoke: vi.fn(), list: vi.fn(), limit: vi.fn() }));
vi.mock("@/lib/api/ip-rate-limit", () => ({ checkIpRateLimit: (...args: unknown[]) => mocks.limit(...args) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser: async () => ({ data: { user: mocks.user } }) } }) }));
vi.mock("./store", () => ({ createShareStore: () => ({}), listOwnedPublications: (...args: unknown[]) => mocks.list(...args) }));
vi.mock("./service", async importOriginal => ({ ...await importOriginal<object>(),
  createPublication: (...args: unknown[]) => mocks.create(...args),
  resolvePublication: (...args: unknown[]) => mocks.resolve(...args),
  revokePublication: (...args: unknown[]) => mocks.revoke(...args),
}));
import { POST, GET as LIST } from "@/app/api/design-shares/route";
import { GET, DELETE } from "@/app/api/design-shares/[token]/route";
import { ShareError } from "./service";
const token = "a".repeat(43);
const ctx = { params: Promise.resolve({ token }) };
const body = { designId: "11111111-1111-4111-8111-111111111111", expectedUpdatedAt: "2026-09-07T00:00:00.000Z" };
const req = (value: unknown = body, origin = "https://example.com") => new Request("https://example.com/api/design-shares", { method: "POST", headers: { "Content-Type": "application/json", Origin: origin }, body: JSON.stringify(value) });
beforeEach(() => { vi.clearAllMocks(); mocks.user = { id: "owner" }; mocks.limit.mockResolvedValue({ ok: true, remaining: 29 }); });
it("rate-limits publication by authenticated owner without restricting revocation", async () => {
  mocks.limit.mockResolvedValue({ ok: false, remaining: 0 });
  const limited = await POST(req());
  expect(limited.status).toBe(429);
  expect(await limited.json()).toEqual({ error: "rate_limited" });
  expect(mocks.limit).toHaveBeenCalledWith({ prefix: "design-share-owner", ip: "owner", perDay: 30 });
  expect(mocks.create).not.toHaveBeenCalled();
  mocks.revoke.mockResolvedValue(undefined);
  expect((await DELETE(req(), ctx)).status).toBe(200);
  expect(mocks.limit).toHaveBeenCalledTimes(1);
});
it("denies unauthenticated creation and revocation before touching persistence", async () => {
  mocks.user = null;
  expect((await POST(req())).status).toBe(401);
  expect((await DELETE(req(), ctx)).status).toBe(401);
  expect(mocks.create).not.toHaveBeenCalled();
  expect(mocks.revoke).not.toHaveBeenCalled();
});
it("rejects cross-origin writes, client geometry and missing revisions", async () => {
  expect((await POST(req(body, "https://evil.test"))).status).toBe(403);
  expect((await DELETE(req(body, "https://evil.test"), ctx)).status).toBe(403);
  expect((await POST(req({ ...body, model: {} }))).status).toBe(400);
  expect((await POST(req({ designId: body.designId }))).status).toBe(400);
  expect((await POST(req(null))).status).toBe(400);
  expect((await POST(req({ junk: "x".repeat(5000) }))).status).toBe(413);
  expect(mocks.create).not.toHaveBeenCalled();
});
it("publishes only the authenticated saved revision and returns an opaque viewer URL", async () => {
  mocks.create.mockResolvedValue({ token, sourceRevision: body.expectedUpdatedAt });
  const response = await POST(req());
  expect(response.status).toBe(201);
  expect(await response.json()).toEqual({ token, sourceRevision: body.expectedUpdatedAt, url: `/shared-design/${token}` });
  expect(mocks.create).toHaveBeenCalledWith({}, "owner", body.designId, body.expectedUpdatedAt);
  expect(response.headers.get("Cache-Control")).toContain("no-store");
});
it("serves only public payload, never caches success or revoked/error responses", async () => {
  mocks.resolve.mockResolvedValue({ schema: 1, design: { id: "shared-design" } });
  const response = await GET(req(), ctx);
  expect(response.status).toBe(200);
  expect(response.headers.get("Cache-Control")).toContain("no-store");
  expect(response.headers.get("X-Robots-Tag")).toContain("noindex");
  mocks.resolve.mockRejectedValue(new ShareError(404, "not_found"));
  const revoked = await GET(req(), ctx);
  expect(revoked.status).toBe(404);
  expect(revoked.headers.get("Cache-Control")).toContain("no-store");
  mocks.resolve.mockRejectedValue(new Error("private database secret"));
  const failed = await GET(req(), ctx);
  expect(failed.status).toBe(503);
  expect(await failed.text()).not.toContain("private");
});
it("owner-scopes management and revocation and propagates failures", async () => {
  mocks.list.mockResolvedValue({ shares: [], nextOffset: null });
  const response = await LIST(new Request(`https://example.com/api/design-shares?designId=${body.designId}`));
  expect(response.status).toBe(200);
  expect(mocks.list).toHaveBeenCalledWith("owner", body.designId, 0);
  mocks.revoke.mockRejectedValue(new ShareError(404, "not_found"));
  expect((await DELETE(req(), ctx)).status).toBe(404);
  expect(mocks.revoke).toHaveBeenCalledWith({}, "owner", token);
});
