import { expect, it } from "vitest";
import { FURNITURE_CATALOG } from "../templates";
import { STYLE_PRESETS } from "./style-presets";
import { quickStyleQuery } from "./quick-style";

it("does not apply furniture styling to a workbench", () => {
  const entry = FURNITURE_CATALOG.find(e => e.category === "workbench")!;
  expect(quickStyleQuery(new URLSearchParams(), "shaker", entry.category, entry.optionSchema ?? [])).toBeNull();
});

// 尺寸、功能性設定（抽屜數…）、存檔身分是使用者的，換風格不准動
const KEEP = ["length", "width", "height", "constructionVersion", "drawerCount", "withDrawer", "designId", "revision", "joineryMode"];

it("keeps size and functional configuration, repeats deterministically", () => {
  let supported = 0;
  for (const entry of FURNITURE_CATALOG) for (const id of Object.keys(STYLE_PRESETS)) {
    const original = new URLSearchParams("length=1800&width=650&height=830&material=pine&constructionVersion=1&drawerCount=3&withDrawer=true&designId=owned&revision=4&styleVariant=99&joineryMode=true");
    const next = quickStyleQuery(original, id, entry.category, entry.optionSchema ?? []);
    if (!next) continue;
    supported++;
    for (const key of KEEP) expect(next.get(key), `${entry.category}/${id}/${key}`).toBe(original.get(key));
    expect(next.has("styleVariant")).toBe(false);
    expect(next.get("style")).toBe(id);
    expect(quickStyleQuery(next, id, entry.category, entry.optionSchema ?? [])?.toString()).toBe(next.toString());
  }
  expect(supported).toBeGreaterThan(100);
});

it("風格要看得出差別：方凳的日式跟古典歐式，木種、腳粗、腳形、邊緣都不同", () => {
  const stool = FURNITURE_CATALOG.find(e => e.category === "stool")!;
  const q = (id: string) => quickStyleQuery(new URLSearchParams("length=400&width=300&height=450"), id, "stool", stool.optionSchema ?? [])!;
  const ja = q("japanese"), ch = q("chippendale");
  expect(ja.get("material")).toBe("taiwan-cypress");
  expect(ch.get("material")).toBe("walnut");
  expect(Number(ch.get("legSize"))).toBeGreaterThan(Number(ja.get("legSize")));
  expect([ja.get("legShape"), ch.get("legShape")]).toEqual(["box", "tapered"]);
  expect(ch.get("legEdgeStyle")).toBe("rounded");
});

it("切風格不殘留上一個風格的外觀值", () => {
  // 長凳：簡約細腳會寫梯式橫檔（ladderRungs…），美式手工不寫 → 切過去要回模板預設
  const bench = FURNITURE_CATALOG.find(e => e.category === "bench")!;
  const schema = bench.optionSchema ?? [];
  const base = new URLSearchParams("length=1200&width=350&height=450");
  const viaOther = quickStyleQuery(quickStyleQuery(base, "shaker", "bench", schema)!, "farmhouse", "bench", schema)!;
  expect(viaOther.has("ladderRungs")).toBe(false);
  const direct = quickStyleQuery(base, "farmhouse", "bench", schema)!;
  viaOther.sort(); direct.sort();
  expect(viaOther.toString()).toBe(direct.toString());
});

it("沒有招牌腳形的家具不出那個風格（方凳沒有明式圓腳）", () => {
  const stool = FURNITURE_CATALOG.find(e => e.category === "stool")!;
  expect(quickStyleQuery(new URLSearchParams(), "ming", "stool", stool.optionSchema ?? [])).toBeNull();
});
