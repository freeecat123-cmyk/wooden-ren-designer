import { describe, expect, it } from "vitest";
import { designFingerprint, savedDesignQuery } from "./saved-query";

describe("saved design round trip", () => {
  it("preserves false options, designer mode, and nested settings", () => {
    const query = savedDesignQuery("own-id", { length: 1200, designerMode: true, options: { drawer: false, legInset: 125 }, designId: "other-id" }, "v1");
    expect(Object.fromEntries(query)).toEqual({ designId: "own-id", length: "1200", designerMode: "true", drawer: "false", legInset: "125", revision: "v1" });
  });
  it("opens legacy flattened options", () => {
    expect(savedDesignQuery("id", { legInset: 80 }).get("legInset")).toBe("80");
  });
  it("compares design values independent of key order", () => {
    expect(designFingerprint({ options: { a: 1, b: false }, length: 900 })).toBe(designFingerprint({ length: 900, options: { b: false, a: 1 } }));
    expect(designFingerprint({ length: 900 })).not.toBe(designFingerprint({ length: 901 }));
  });
});
