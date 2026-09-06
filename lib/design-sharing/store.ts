import { createAdminClient } from "@/lib/supabase/server";
import { randomUUID } from "node:crypto";
import { type Publication, type ShareStore } from "./service";

export const SHARE_BUCKET = "design-shares";

// Never issue signed URLs. A fresh authenticated origin request is required on every read,
// including revocation checks; unique URLs prevent stale Storage CDN cache hits.
async function readObject<T>(path: string): Promise<T | null> {
  const url = new URL(`/storage/v1/object/authenticated/${SHARE_BUCKET}/${path}`, process.env.NEXT_PUBLIC_SUPABASE_URL!);
  url.searchParams.set("check", randomUUID());
  const response = await fetch(url, { cache: "no-store", headers: {
    Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
    apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!, "Cache-Control": "no-store",
  } });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    if (response.status === 404 || error.code === "NoSuchKey" || error.message === "Object not found") return null;
    throw new Error("Share storage unavailable");
  }
  return response.json();
}

export function createShareStore(): ShareStore {
  const db = createAdminClient();
  const bucket = db.storage.from(SHARE_BUCKET);
  return {
    async ownedDesign(id, owner) {
      const { data, error } = await db.from("designs")
        .select("id, user_id, furniture_type, updated_at, params").eq("id", id).eq("user_id", owner).maybeSingle();
      if (error) throw error;
      return data;
    },
    async insert(publication) {
      const configuration = await db.storage.getBucket(SHARE_BUCKET);
      if (configuration.error || !configuration.data || configuration.data.public) throw new Error("Private share bucket required");
      const options = { contentType: "application/json", cacheControl: "0", upsert: false };
      // Index first: a failed publication leaves only an inert pointer, never an
      // active link the owner cannot find and revoke. Neither object is public.
      const index = await bucket.upload(`owners/${publication.owner_id}/${publication.design_id}/${publication.token}.json`, JSON.stringify({ token: publication.token }), options);
      if (index.error) throw index.error;
      const result = await bucket.upload(`publications/${publication.token}.json`, JSON.stringify(publication), options);
      if (result.error) throw result.error;
    },
    async active(token) {
      const publication = await readObject<Publication>(`publications/${token}.json`);
      if (!publication) return null;
      const revoked = await readObject<{ owner_id: string }>(`revocations/${token}.json`);
      return revoked ? null : publication;
    },
    async revoke(token, owner) {
      const publication = await readObject<Publication>(`publications/${token}.json`);
      if (!publication || publication.owner_id !== owner) return false;
      const existing = await readObject(`revocations/${token}.json`);
      if (existing) return true;
      const { error } = await bucket.upload(`revocations/${token}.json`, JSON.stringify({ owner_id: owner, revoked_at: new Date().toISOString() }),
        { contentType: "application/json", cacheControl: "0", upsert: false });
      // Concurrent owner revocations are idempotent, but all other failures propagate.
      if (error && (error as { statusCode?: string }).statusCode !== "409") throw error;
      return true;
    },
  };
}
export async function listOwnedPublications(owner: string, designId: string, offset = 0) {
  const db = createAdminClient();
  const store = createShareStore();
  const shares: { token: string; source_revision: string }[] = [];
    const { data, error } = await db.storage.from(SHARE_BUCKET).list(`owners/${owner}/${designId}`, { limit: 10, offset, sortBy: { column: "name", order: "asc" } });
    if (error) throw error;
    for (const object of data ?? []) {
      if (!/^[A-Za-z0-9_-]{43}\.json$/.test(object.name)) continue;
      const token = object.name.slice(0, -5);
      const publication = await store.active(token);
      if (publication?.owner_id === owner && publication.design_id === designId) shares.push({ token, source_revision: publication.source_revision });
    }
  return { shares, nextOffset: data?.length === 10 ? offset + 10 : null };
}
