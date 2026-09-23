import { afterEach, expect, it, vi } from "vitest";
import { photoFrame } from "@/lib/templates/photo-frame";
import { FURNITURE_CATALOG } from "@/lib/templates";
import { toBeginnerMode } from "@/lib/templates/beginner-mode";
import { makeModelSnapshot, readModelSnapshot, validateSnapshotParams, matchesSnapshotQuery } from "./model-snapshot";

const params = { length: 300, width: 200, height: 25, material: "pine", joineryMode: false, options: { frameWidth: 35 } };
const raw = photoFrame({ ...params, material: "pine" });
afterEach(() => vi.unstubAllEnvs());
function capture() {
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-only-signing-key");
  return makeModelSnapshot("photo-frame", params, raw, raw, "zh-TW")!;
}
it("retains exact geometry through a JSON save/reopen round trip", () => {
  const snapshot = JSON.parse(JSON.stringify(capture()));
  expect(readModelSnapshot(snapshot, "photo-frame", params)?.design.parts).toEqual(raw.parts);
});
it("rejects changed geometry, params, category and signature", () => {
  const snapshot = capture();
  const changed = structuredClone(snapshot);
  changed.design.parts[0].visible.length++;
  expect(readModelSnapshot(changed, "photo-frame", params)).toBeNull();
  expect(readModelSnapshot(snapshot, "photo-frame", { ...params, length: 301 })).toBeNull();
  expect(readModelSnapshot(snapshot, "stool", params)).toBeNull();
  expect(readModelSnapshot({ ...snapshot, signature: "00" }, "photo-frame", params)).toBeNull();
});
it("treats legacy parameter-only records as valid without inventing geometry", () => {
  expect(validateSnapshotParams(params, "photo-frame")).toBe(true);
  expect(readModelSnapshot(undefined, "photo-frame", params)).toBeNull();
});
it("accepts a signed snapshot but rejects unsigned or oversized input", () => {
  const snapshot = capture();
  expect(validateSnapshotParams({ ...params, _modelSnapshot: snapshot }, "photo-frame")).toBe(true);
  expect(validateSnapshotParams({ ...params, _modelSnapshot: {} }, "photo-frame")).toBe(false);
  expect(validateSnapshotParams({ ...params, garbage: "x".repeat(33000) }, "photo-frame")).toBe(false);
});
it("matches unchanged URL inputs and ignores view/revision settings, not changed dimensions", () => {
  const q = { length: "300", width: "200", height: "25", material: "pine", joineryMode: "false", frameWidth: "35", scene: "natural", revision: "v2" };
  expect(matchesSnapshotQuery(q, params, ["frameWidth", "newOption"])).toBe(true);
  expect(matchesSnapshotQuery({ ...q, length: "301" }, params, ["frameWidth"])).toBe(false);
  expect(matchesSnapshotQuery({ ...q, newOption: "true" }, params, ["frameWidth", "newOption"])).toBe(false);
});
it("does not sign without a configured server secret", () => {
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
  vi.stubEnv("MODEL_SNAPSHOT_SIGNING_KEY", "");
  vi.stubEnv("MODEL_SNAPSHOT_PREVIOUS_KEYS", "[]");
  expect(makeModelSnapshot("photo-frame", params, raw, raw, "zh-TW")).toBeUndefined();
});
it("verifies historical signatures during an explicit signing-key rotation", () => {
  const snapshot = capture();
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "new-signing-key");
  expect(readModelSnapshot(snapshot, "photo-frame", params)).toBeNull();
  vi.stubEnv("MODEL_SNAPSHOT_PREVIOUS_KEYS", JSON.stringify(["test-only-signing-key"]));
  expect(readModelSnapshot(snapshot, "photo-frame", params)).not.toBeNull();
});
it("recognizes form-omitted defaults but not changed template defaults", () => {
  const q = { length: "300", width: "200", height: "25", material: "pine", joineryMode: "", designerMode: "false" };
  const saved = { ...params, designerMode: false };
  expect(matchesSnapshotQuery(q, saved, ["frameWidth"], { frameWidth: 35 })).toBe(true);
  expect(matchesSnapshotQuery(q, saved, ["frameWidth"], { frameWidth: 40 })).toBe(false);
});
it("captures every catalog default within the archive size budget", () => {
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-only-signing-key");
  for (const entry of FURNITURE_CATALOG) {
    if (!entry.template) continue;
    const params = { ...entry.defaults, material: "pine", options: Object.fromEntries((entry.optionSchema ?? []).map(s => [s.key, s.defaultValue])) };
    const raw = entry.template({ ...params, material: "pine" });
    const snapshot = makeModelSnapshot(entry.category, params, raw, toBeginnerMode(raw), "zh-TW");
    expect(snapshot, entry.category).toBeDefined();
    expect(readModelSnapshot(JSON.parse(JSON.stringify(snapshot)), entry.category, params)?.raw).toEqual(JSON.parse(JSON.stringify(raw)));
  }
});
