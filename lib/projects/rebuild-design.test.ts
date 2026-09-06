import { afterEach, expect, it, vi } from "vitest";
import { rebuildDesignFromItem } from "./rebuild-design";
import { makeModelSnapshot } from "@/lib/design/model-snapshot";
import { photoFrame } from "@/lib/templates/photo-frame";
import type { ProjectItemRow } from "./types";

afterEach(() => vi.unstubAllEnvs());
it("rebuilds nested options for legacy project items", () => {
  const item = { furniture_type: "photo-frame", params: { length: 300, width: 200, height: 25, options: { frameWidth: 50 } } } as unknown as ProjectItemRow;
  expect(rebuildDesignFromItem(item)?.overall.length).toBe(400);
});
it("uses the stored model even when a current template would produce different geometry", () => {
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-only-key");
  const params = { length: 300, width: 200, height: 25, material: "pine", options: { frameWidth: 35 } };
  const historic = photoFrame({ ...params, material: "pine" });
  historic.parts[0].visible.length = 369;
  const snapshot = makeModelSnapshot("photo-frame", params, historic, historic, "zh-TW");
  const item = { furniture_type: "photo-frame", params: { ...params, _modelSnapshot: snapshot } } as unknown as ProjectItemRow;
  expect(rebuildDesignFromItem(item)?.parts[0].visible.length).toBe(369);
});
