import { expect, it } from "vitest";
import { geometrySearch, savedEventMatches } from "./client-state";

it("ignores only viewing/reference parameters, never construction or joinery modes", () => {
  expect(geometrySearch("length=300&scene=natural&revision=old&designId=a")).toBe(geometrySearch("designId=b&revision=new&scene=studio&length=300"));
  expect(geometrySearch("length=300&joineryMode=true")).not.toBe(geometrySearch("length=300&joineryMode=false"));
  expect(geometrySearch("constructionVersion=1")).not.toBe(geometrySearch("constructionVersion=2"));
});
it("does not clear unsubmitted input on visual URL changes or stale saves", () => {
  const event = { id: "id", revision: "revision", fingerprint: "signed-input", search: "length=300" };
  expect(savedEventMatches(event, "length=300&scene=studio", { length: "301" })).toBe(false);
  expect(savedEventMatches(event, "length=301", { length: "301" })).toBe(false);
  expect(savedEventMatches({ ...event, search: "length=301" }, "length=301&scene=studio", { length: "301" })).toBe(true);
  expect(savedEventMatches({ ...event, revision: undefined }, "length=300", {})).toBe(false);
});
