import { createHmac, timingSafeEqual } from "node:crypto";
import type { FurnitureDesign } from "@/lib/types";
import { designFingerprint, savedDesignQuery } from "./saved-query";
import type { SpRecord } from "./parse-search-params";

export interface ModelSnapshot {
  schema: 1;
  category: string;
  locale: string;
  build: string;
  input: string;
  raw: FurnitureDesign;
  design: FurnitureDesign;
  signature: string;
}
const MAX_SNAPSHOT_BYTES = 2 * 1024 * 1024;
function inputs(params: Record<string, unknown>) {
  const { _modelSnapshot: _ignored, ...rest } = params;
  return rest;
}
function signingKeys(): string[] {
  const previous: unknown = JSON.parse(process.env.MODEL_SNAPSHOT_PREVIOUS_KEYS ?? "[]");
  if (!Array.isArray(previous) || previous.some(key => typeof key !== "string") || previous.length > 10) throw new Error("Invalid model signing key configuration");
  return [process.env.MODEL_SNAPSHOT_SIGNING_KEY, process.env.SUPABASE_SERVICE_ROLE_KEY, ...previous].filter((key): key is string => Boolean(key));
}
function sign(payload: Omit<ModelSnapshot, "signature">, key = signingKeys()[0]): string | undefined {
  if (!key) return undefined;
  return createHmac("sha256", key).update("wooden-ren:model-snapshot:v1\n").update(designFingerprint(payload)).digest("hex");
}
export function makeModelSnapshot(category: string, params: Record<string, unknown>, raw: FurnitureDesign, design: FurnitureDesign, locale: string): ModelSnapshot | undefined {
  // JSON normalization matches jsonb storage (undefined fields are not persisted).
  const payload = JSON.parse(JSON.stringify({ schema: 1, category, locale,
    build: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? "local",
    input: designFingerprint(inputs(params)), raw, design })) as Omit<ModelSnapshot, "signature">;
  if (Buffer.byteLength(JSON.stringify(payload)) > MAX_SNAPSHOT_BYTES) return undefined;
  const signature = sign(payload);
  return signature ? { ...payload, signature } : undefined;
}
export function readModelSnapshot(value: unknown, category: string, params: Record<string, unknown>): ModelSnapshot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const snapshot = value as ModelSnapshot;
  if (snapshot.schema !== 1 || snapshot.category !== category || snapshot.input !== designFingerprint(inputs(params)) ||
    typeof snapshot.signature !== "string" || !/^[a-f0-9]{64}$/.test(snapshot.signature)) return null;
  if (Buffer.byteLength(JSON.stringify(value)) > MAX_SNAPSHOT_BYTES) return null;
  const { signature, ...payload } = snapshot;
  const valid = signingKeys().some(key => {
    const expected = sign(payload, key)!;
    return timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(expected, "hex"));
  });
  return valid ? snapshot : null;
}
export function validateSnapshotParams(params: Record<string, unknown>, category?: string): boolean {
  if (Buffer.byteLength(JSON.stringify(inputs(params))) > 32 * 1024) return false;
  if (!("_modelSnapshot" in params)) return true;
  return Boolean(category && readModelSnapshot(params._modelSnapshot, category, params));
}
export function matchesSnapshotQuery(sp: SpRecord, params: Record<string, unknown>, optionKeys: string[], defaults: Record<string, unknown> = {}): boolean {
  const saved = savedDesignQuery("", inputs(params));
  const keys = new Set(["length", "width", "height", "material", "joineryMode", "designerMode", ...optionKeys]);
  for (const key of keys) {
    const raw = sp[key];
    let value = Array.isArray(raw) ? raw[0] : raw;
    const expected = saved.get(key);
    if (value === undefined && expected === null) continue;
    if (key === "joineryMode" || key === "designerMode" || typeof defaults[key] === "boolean") {
      const fallback = key === "joineryMode" ? sp.beginnerMode === "false" : defaults[key] ?? false;
      const flag = value === undefined || value === "" ? fallback : ["true", "1", "on"].includes(value);
      value = String(flag);
    } else if ((value === undefined || value === "") && defaults[key] !== undefined) {
      value = String(defaults[key]);
    }
    if (value !== expected) return false;
  }
  return true;
}
