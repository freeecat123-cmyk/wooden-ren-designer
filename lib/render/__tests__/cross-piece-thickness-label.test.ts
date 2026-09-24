/**
 * 🩸2026-09-24 乙級第五題最高規格複查抓到的 bug：橫撐/牙板「寬×厚」標籤（§I6 必標件厚）
 * 對「同時繞 X 又繞 Y 轉 90°」的零件（左右側牙板/橫撐）算錯厚度——把 `worldExtents().zExt`
 * 無條件當厚度用，但雙重旋轉件的 zExt 其實是 length（沿 Z 延伸的長度），真正的厚度落在 xExt。
 * 影響全站 13 款既有家具（方凳、板凳、茶几…）的側牙板標籤把長度印成厚度。
 *
 * 這支測試直接比對標籤印出的厚度數字 vs 零件自己的 `visible.thickness`，不靠眼睛看三視圖，
 * 涵蓋單軸旋轉（前/後牙板）跟雙軸旋轉（左/右牙板）兩種情況。
 */
import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FURNITURE_CATALOG } from "@/lib/templates";
import { CompactThreeViews } from "@/lib/render/svg-views";
import type { FurnitureDesign } from "@/lib/types";

function buildDefault(category: string): FurnitureDesign {
  const entry = FURNITURE_CATALOG.find((e) => e.category === category)!;
  const base = Object.fromEntries(
    (entry.optionSchema ?? []).map((s) => [s.key, s.defaultValue]),
  ) as Record<string, string | number | boolean>;
  return entry.template!({
    length: entry.defaults.length,
    width: entry.defaults.width,
    height: entry.defaults.height,
    material: "pine",
    options: base,
  });
}

function thicknessLabels(d: FurnitureDesign): string[] {
  const svg = renderToStaticMarkup(
    React.createElement(CompactThreeViews, { design: d, locale: "zh-TW" } as never),
  );
  return [...svg.matchAll(/<text[^>]*>([^<]*×[^<]*)<\/text>/g)].map((m) => m[1]);
}

describe("橫撐/牙板厚度標籤：雙軸旋轉件不可把長度印成厚度", () => {
  it("stool：前牙板（單軸）跟側牙板（雙軸）各自都要標出正確厚度 20，不能有任何一條把 side apron 的 length＝280 印成厚度", () => {
    const d = buildDefault("stool");
    const apronFront = d.parts.find((p) => p.id === "apron-front")!;
    const apronLeft = d.parts.find((p) => p.id === "apron-left")!;
    expect(apronFront.visible.thickness).toBe(20);
    expect(apronLeft.visible.thickness).toBe(20);
    expect(apronLeft.visible.length).toBe(280); // ground truth：這個數字絕對不該出現在厚度標籤裡

    const labels = thicknessLabels(d);
    const apronLabels = labels.filter((l) => l.includes("牙條"));
    // 三視圖（正/側/俯）各自跑一次同樣的去重迴圈，同一個正確標籤會在整份 SVG 裡出現多次
    // 屬正常；用 Set 只看「出現過哪些不同的字串」。前/後牙板（單軸）跟左/右牙板（雙軸）
    // 厚度剛好都是 20、寬度都是 60 → 應該只有一種字串「牙條 60×20」；bug 版會多一種
    // 「牙條 60×280」（side apron 誤把 length 當厚度，dedup key 因此跟正確版不同，兩種都留下）。
    const distinctApronLabels = [...new Set(apronLabels)];
    expect(distinctApronLabels, `找到的牙條標籤種類：${JSON.stringify(distinctApronLabels)}`).toEqual(["牙條 60×20"]);
  });

  it("workbench：ls-left/right（雙軸旋轉下橫撐）不可把 length＝400 印成厚度", () => {
    const d = buildDefault("workbench");
    const lsLeft = d.parts.find((p) => p.id === "ls-left")!;
    expect(lsLeft.visible).toEqual({ length: 400, width: 100, thickness: 50 });

    const labels = thicknessLabels(d);
    const stretcherLabels = [...new Set(labels.filter((l) => l.includes("橫撐")))];
    expect(stretcherLabels, `找到的橫撐標籤種類：${JSON.stringify(stretcherLabels)}`).toEqual(["下橫撐 100×50"]);
  });
});
