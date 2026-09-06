import { afterEach, beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ objects: new Map<string, string>(), uploads: [] as { path: string; options: unknown }[], bucketPublic: false, lists: [] as { limit: number; offset: number }[] }));
vi.mock("@/lib/supabase/server", () => ({ createAdminClient: () => ({ storage: {
  getBucket: async () => ({ data: { public: state.bucketPublic }, error: null }),
  from: () => ({
    upload: async (path: string, content: string, options: unknown) => {
      state.uploads.push({ path, options });
      if (state.objects.has(path)) return { error: { statusCode: "409" } };
      state.objects.set(path, content); return { error: null };
    },
    list: async (prefix: string, options: { limit: number; offset: number }) => {
      state.lists.push(options);
      return { data: [...state.objects.keys()].filter(key => key.startsWith(`${prefix}/`)).slice(options.offset, options.offset + options.limit).map(key => ({ name: key.split("/").at(-1) })), error: null };
    },
  }),
} }) }));
import { createShareStore, listOwnedPublications } from "./store";
import type { Publication } from "./service";
const token = "a".repeat(43);
const row: Publication = { token, owner_id: "owner", design_id: "design", source_revision: "2026-09-07T00:00:00Z", revoked_at: null, payload: { schema: 1, joineryMode: false, design: {} as never } };
beforeEach(() => {
  state.objects.clear(); state.uploads.length = 0; state.bucketPublic = false; state.lists.length = 0;
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://storage.example");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "secret");
  vi.stubGlobal("fetch", vi.fn(async (url: URL) => {
    const path = url.pathname.split("/design-shares/")[1];
    const value = state.objects.get(path);
    return value ? new Response(value, { status: 200 }) : Response.json({ code: "NoSuchKey" }, { status: 400 });
  }));
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
it("writes owner index before immutable publication and never overwrites", async () => {
  const store = createShareStore();
  await store.insert(row);
  expect(state.uploads.map(u => u.path)).toEqual([`owners/owner/design/${token}.json`, `publications/${token}.json`]);
  expect(state.uploads.every(u => (u.options as { upsert: boolean }).upsert === false)).toBe(true);
  await expect(store.insert(row)).rejects.toMatchObject({ statusCode: "409" });
  expect(await store.active(token)).toEqual(row);
});
it("refuses to publish into a public bucket", async () => {
  state.bucketPublic = true;
  await expect(createShareStore().insert(row)).rejects.toThrow();
  expect(state.uploads).toHaveLength(0);
});
it("checks stored owner, revokes immutably and excludes revoked links from owner management", async () => {
  const store = createShareStore(); await store.insert(row);
  expect(await listOwnedPublications("owner", "design")).toEqual({ shares: [{ token, source_revision: row.source_revision }], nextOffset: null });
  expect(await listOwnedPublications("stranger", "design")).toEqual({ shares: [], nextOffset: null });
  expect(await store.revoke(token, "stranger")).toBe(false);
  expect(await store.active(token)).toEqual(row);
  expect(await store.revoke(token, "owner")).toBe(true);
  expect(await store.revoke(token, "owner")).toBe(true);
  expect(await store.active(token)).toBeNull();
  expect(await listOwnedPublications("owner", "design")).toEqual({ shares: [], nextOffset: null });
  expect(JSON.parse(state.objects.get(`publications/${token}.json`)!)).toEqual(row);
});
it("uses unique no-store authenticated reads and fails closed on revocation lookup errors", async () => {
  const store = createShareStore(); await store.insert(row);
  await store.active(token); await store.active(token);
  const calls = vi.mocked(fetch).mock.calls;
  expect(new Set(calls.map(([url]) => String(url))).size).toBe(4);
  expect(calls.every(([, init]) => init?.cache === "no-store" && (init.headers as Record<string, string>).Authorization === "Bearer secret")).toBe(true);
  vi.mocked(fetch).mockImplementation(async (url) => String(url).includes("revocations") ? Response.json({ message: "service down" }, { status: 503 }) : Response.json(row));
  await expect(store.active(token)).rejects.toThrow("Share storage unavailable");
});
it("bounds management reads to ten entries and exposes the next page", async () => {
  const store = createShareStore();
  for (let i = 0; i < 11; i++) await store.insert({ ...row, token: String(i).padStart(43, "a") });
  vi.mocked(fetch).mockClear();
  const first = await listOwnedPublications("owner", "design");
  expect(first.shares).toHaveLength(10);
  expect(first.nextOffset).toBe(10);
  expect(vi.mocked(fetch).mock.calls).toHaveLength(20);
  const second = await listOwnedPublications("owner", "design", 10);
  expect(second.shares).toHaveLength(1);
  expect(second.nextOffset).toBeNull();
  expect(state.lists.map(({ limit, offset }) => ({ limit, offset }))).toEqual([{ limit: 10, offset: 0 }, { limit: 10, offset: 10 }]);
});
