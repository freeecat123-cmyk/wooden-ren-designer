// Explicit provisioning verification only: npx tsx lib/design-sharing/live-smoke.ts --live --origin=http://localhost:3115
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { photoFrame } from "@/lib/templates/photo-frame";
import { makeModelSnapshot } from "@/lib/design/model-snapshot";
import { createPublication, revokePublication, type ShareStore } from "./service";
import { createShareStore, SHARE_BUCKET } from "./store";

async function main() {
  if (!process.argv.includes("--live")) throw new Error("Explicit --live flag required; no provider writes performed");
  loadEnvConfig(process.cwd());
  const origin = process.argv.find(arg => arg.startsWith("--origin="))?.slice(9) ?? "http://localhost:3115";
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  assert(url && serviceKey && anonKey, "Supabase configuration required");
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const bucket = admin.storage.from(SHARE_BUCKET);
  const owner = randomUUID(), id = randomUUID(), revision = new Date().toISOString();
  const params = { length: 300, width: 200, height: 25, material: "pine" as const };
  const model = photoFrame(params);
  const snapshot = makeModelSnapshot("photo-frame", params, model, model, "en");
  assert(snapshot, "Server snapshot signing configuration required");
  const fixture = { id, user_id: owner, furniture_type: "photo-frame", updated_at: revision, params: { ...params, _modelSnapshot: snapshot } };
  const real = createShareStore();
  let token: string | undefined;
  const store: ShareStore = { ...real,
    ownedDesign: async (requestedId, requestedOwner) => requestedId === id && requestedOwner === owner ? fixture : null,
    insert: async publication => { token = publication.token; await real.insert(publication); },
  };
  try {
    const publication = await createPublication(store, owner, id, revision);
    const endpoint = `${origin}/api/design-shares/${publication.token}`;
    const response = await fetch(endpoint, { cache: "no-store" });
    assert.equal(response.status, 200, "public resolver must read the live private object");
    assert.match(response.headers.get("cache-control") ?? "", /no-store/);
    const original = await response.json();
    assert.equal(original.schema, 1);
    assert.equal(original.design.parts.length, model.parts.length);
    assert(!JSON.stringify(original).includes(owner));
    assert(!JSON.stringify(original).includes(id));
    assert(!JSON.stringify(original).includes(snapshot.signature));
    fixture.params._modelSnapshot.design.parts[0].visible.length += 20;
    assert.deepEqual(await (await fetch(endpoint, { cache: "no-store" })).json(), original, "later source edits must not mutate the publication");
    const active = await real.active(publication.token);
    assert(active);
    await assert.rejects(real.insert(active), "publication/index cannot be overwritten");
    assert.deepEqual((await real.active(publication.token))?.payload, active.payload);
    assert.equal(await real.revoke(publication.token, randomUUID()), false, "strangers cannot revoke");

    const objectPath = `publications/${publication.token}.json`;
    const anonymousHeaders = { apikey: anonKey, Authorization: `Bearer ${anonKey}` };
    const download = await fetch(`${url}/storage/v1/object/authenticated/${SHARE_BUCKET}/${objectPath}?probe=${randomUUID()}`, { headers: anonymousHeaders, cache: "no-store" });
    assert(!download.ok, "anonymous authenticated-download path must be denied");
    const publicDownload = await fetch(`${url}/storage/v1/object/public/${SHARE_BUCKET}/${objectPath}?probe=${randomUUID()}`, { cache: "no-store" });
    assert(!publicDownload.ok, "public Storage URL must be denied");
    const list = await fetch(`${url}/storage/v1/object/list/${SHARE_BUCKET}`, { method: "POST", headers: { ...anonymousHeaders, "Content-Type": "application/json" }, body: JSON.stringify({ prefix: "publications", limit: 100, offset: 0 }) });
    if (list.ok) assert.deepEqual(await list.json(), [], "RLS must hide every publication from anonymous listing");
    console.log(`Anonymous isolation: authenticated download ${download.status}, public download ${publicDownload.status}, list ${list.status} (denied or empty)`);

    const unknown = await fetch(`${origin}/api/design-shares/${"z".repeat(43)}`, { cache: "no-store" });
    assert.equal(unknown.status, 404);
    await revokePublication(store, owner, publication.token);
    assert.equal(await real.active(publication.token), null);
    for (let i = 0; i < 2; i++) {
      const revoked = await fetch(endpoint, { cache: "no-store" });
      assert.equal(revoked.status, 404, "same URL must not return stale geometry after revocation");
      assert.match(revoked.headers.get("cache-control") ?? "", /no-store/);
    }
    await revokePublication(store, owner, publication.token);
    console.log("Live provider: signed synthetic create, public 200, immutable source, owner-only/idempotent revoke, unknown/revoked 404 PASS");
  } finally {
    if (token) {
      const paths = [`owners/${owner}/${id}/${token}.json`, `publications/${token}.json`, `revocations/${token}.json`];
      const { error } = await bucket.remove(paths);
      if (error) throw new Error(`Probe cleanup failed for exact paths: ${paths.join(", ")}`);
      const remaining = await real.active(token);
      assert.equal(remaining, null, "probe publication must be gone after cleanup");
      console.log("Cleaned only the 3 exact synthetic object paths; no customer database rows read or changed.");
    }
  }
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Live sharing probe failed"); process.exitCode = 1; });
