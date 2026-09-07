import { randomBytes } from "node:crypto";
import { readModelSnapshot } from "@/lib/design/model-snapshot";
import { publicGeometry, type PublicDesign } from "./payload";

export class ShareError extends Error {
  constructor(public status: number, public code: string) { super(code); }
}
export interface SavedShareDesign {
  id: string;
  user_id: string;
  furniture_type: string;
  updated_at: string;
  params: Record<string, unknown>;
}
export interface Publication {
  token: string;
  owner_id: string;
  design_id: string;
  source_revision: string;
  payload: PublicDesign;
  revoked_at: string | null;
}
export interface ShareStore {
  ownedDesign(id: string, owner: string): Promise<SavedShareDesign | null>;
  insert(publication: Publication): Promise<void>;
  active(token: string): Promise<Publication | null>;
  revoke(token: string, owner: string): Promise<boolean>;
}
export const validToken = (token: string) => /^[A-Za-z0-9_-]{43}$/.test(token);

export async function createPublication(store: ShareStore, owner: string | null, id: string, revision: string) {
  if (!owner) throw new ShareError(401, "unauthenticated");
  const saved = await store.ownedDesign(id, owner);
  if (!saved || saved.user_id !== owner) throw new ShareError(404, "not_found");
  if (saved.updated_at !== revision) throw new ShareError(409, "design_conflict");
  const snapshot = readModelSnapshot(saved.params._modelSnapshot, saved.furniture_type.replace(/_/g, "-"), saved.params);
  if (!snapshot) throw new ShareError(422, "signed_snapshot_required");
  const token = randomBytes(32).toString("base64url");
  const publication: Publication = {
    token, owner_id: owner, design_id: id, source_revision: revision, revoked_at: null,
    payload: publicGeometry(snapshot.design, saved.params.joineryMode === true),
  };
  await store.insert(publication);
  return { token, sourceRevision: revision };
}
export async function resolvePublication(store: ShareStore, token: string): Promise<PublicDesign> {
  if (!validToken(token)) throw new ShareError(404, "not_found");
  const row = await store.active(token);
  if (!row || row.revoked_at || row.payload.schema !== 1) throw new ShareError(404, "not_found");
  return publicGeometry(row.payload.design, row.payload.joineryMode);
}
export async function revokePublication(store: ShareStore, owner: string | null, token: string) {
  if (!owner) throw new ShareError(401, "unauthenticated");
  if (!validToken(token) || !await store.revoke(token, owner)) throw new ShareError(404, "not_found");
}
