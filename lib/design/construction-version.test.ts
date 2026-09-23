import { expect, it } from "vitest";
import { getTemplate } from "@/lib/templates";
import { parseDesignSearchParams, designParamsToQuery } from "./parse-search-params";
import { matchesSnapshotQuery } from "./model-snapshot";
import { savedDesignQuery } from "./saved-query";

const entry = getTemplate("photo-frame")!;
it("keeps mode-only legacy URLs on v1 through output round trips", () => {
  for (const key of ["joineryMode", "beginnerMode", "designerMode"]) {
    for (const value of ["true", "false", "1", "0", ""]) {
      const query = { [key]: value };
      const parsed = parseDesignSearchParams(query, entry);
      expect(parsed.options.constructionVersion, `${key}=${value}`).toBe("1");
      expect(parseDesignSearchParams(Object.fromEntries(designParamsToQuery(parsed, entry)), entry).options.constructionVersion).toBe("1");
      expect(parseDesignSearchParams({ ...query, constructionVersion: "2" }, entry).options.constructionVersion).toBe("2");
    }
  }
});
it("starts a blank design with revised construction", () => {
  expect(parseDesignSearchParams({}, entry).options.constructionVersion).toBe("2");
  expect(parseDesignSearchParams({ material: "maple", audit: "true" }, entry).options.constructionVersion).toBe("2");
  expect(parseDesignSearchParams({ style: "shaker", styleVariant: "classic" }, entry).options.constructionVersion).toBe("2");
});
it("treats unknown query keys as legacy unless the version is explicit", () => {
  expect(parseDesignSearchParams({ unknownOption: "value" }, entry).options.constructionVersion).toBe("1");
  expect(parseDesignSearchParams({ unknownOption: "value", constructionVersion: "2" }, entry).options.constructionVersion).toBe("2");
});
it("preserves saved records and parameterized legacy links until explicit upgrade", () => {
  for (const query of [{ designId: "old" }, { length: "300" }, { cornerJoinery: "miter" }, { constructionVersion: "1" }, Object.fromEntries(savedDesignQuery("", { length: 300 }))]) {
    expect(parseDesignSearchParams(query, entry).options.constructionVersion).toBe("1");
  }
  expect(parseDesignSearchParams({ designId: "old", constructionVersion: "2" }, entry).options.constructionVersion).toBe("2");
  expect(parseDesignSearchParams({ constructionVersion: "999" }, entry).options.constructionVersion).toBe("1");
});
it("carries construction through output and save round trips", () => {
  const parsed = parseDesignSearchParams({}, entry);
  const query = Object.fromEntries(designParamsToQuery(parsed, entry));
  expect(query.constructionVersion).toBe("2");
  expect(parseDesignSearchParams(query, entry).options).toEqual(parsed.options);
  expect(savedDesignQuery("owned", { ...parsed }).get("constructionVersion")).toBe("2");
});
it("old snapshots remain matchable, but explicit upgrade exits snapshot mode", () => {
  const params = { length: 300 };
  expect(matchesSnapshotQuery({ length: "300", constructionVersion: "1" }, params, ["constructionVersion"], { constructionVersion: "1" })).toBe(true);
  expect(matchesSnapshotQuery({ length: "300", constructionVersion: "2" }, params, ["constructionVersion"], { constructionVersion: "1" })).toBe(false);
});
