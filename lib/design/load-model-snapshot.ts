import { createClient } from "@/lib/supabase/server";
import { getTemplate } from "@/lib/templates";
import type { FurnitureCategory } from "@/lib/types";
import type { SpRecord } from "./parse-search-params";
import { matchesSnapshotQuery, readModelSnapshot } from "./model-snapshot";

/** Private references never authorize a read; query changes leave snapshot mode. */
export async function loadModelSnapshot(category: string, sp: SpRecord) {
  const id = typeof sp.designId === "string" ? sp.designId : "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return null;
  const { data: saved, error } = await db.from("designs")
    .select("params, furniture_type, updated_at").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (error) throw new Error("Could not verify saved model snapshot");
  if (!saved || saved.furniture_type.replace(/_/g, "-") !== category) return null;
  if (!saved.params?._modelSnapshot) return null;
  if (sp.revision && sp.revision !== saved.updated_at) throw new Error("Saved design changed; reopen it from My Designs");
  const snapshot = readModelSnapshot(saved.params._modelSnapshot, category, saved.params);
  // Invalid signatures must never silently fall back to a different model.
  if (!snapshot) throw new Error("Saved model snapshot could not be verified");
  const entry = getTemplate(category as FurnitureCategory);
  const schema = entry?.optionSchema ?? [];
  const defaults = { ...entry?.defaults, material: "pine", ...Object.fromEntries(schema.map(s => [s.key, s.defaultValue])) };
  return matchesSnapshotQuery(sp, saved.params, schema.map(s => s.key), defaults) ? snapshot : null;
}

export function preserveSavedReference(query: URLSearchParams, sp: SpRecord) {
  for (const key of ["designId", "revision"]) if (typeof sp[key] === "string") query.set(key, sp[key]);
  return query;
}
