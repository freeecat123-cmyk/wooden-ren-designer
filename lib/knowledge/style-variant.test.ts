import { describe, it, expect, vi } from "vitest";
import { applyStylePreset, STYLE_PRESETS } from "./style-presets";
import { FURNITURE_CATALOG } from "../templates";
import type { FurnitureCatalogEntry } from "../templates";

/**
 * 🧷 連按同一個風格要真的產生不同變體。
 *
 * ⛔ 症狀:手機連按「明式」三次,chip 的 #1 #2 一直加、URL 的 styleVariant 也在加,
 *   但其他參數一字不差 = 死控制項。
 *   真因**不在手機**:`MobileShell` 沒把 `designSize` 傳給 StylePresetButtons
 *   → `ctx` 是 undefined → `applyStylePreset` 內 `variantSeed > 0 && adapterCtx`
 *   這個條件永遠不成立 → **整段變體被靜默跳過**。桌面版一直都有傳。
 *   (2026-08-21 稽核發現;稽核描述成「手機版的 bug」,真因是漏傳一個 prop。)
 */
const stool = (FURNITURE_CATALOG as FurnitureCatalogEntry[]).find((e) => e.category === "stool")!;
const schema = stool.optionSchema ?? [];
const CTX = { totalLength: 350, totalWidth: 350, totalHeight: 450, material: "maple" };
const styleIds = Object.keys(STYLE_PRESETS);

const paramsFor = (style: string, seed: number, ctx: typeof CTX | undefined) => {
  const p = applyStylePreset(style, "stool", ctx, seed, schema);
  if (!p) return null;
  return JSON.stringify(
    Object.fromEntries(Object.entries(p).filter(([k]) => !k.startsWith("_")).sort()),
  );
};

describe("風格變體", () => {
  it("① 前提:風格 id 真的存在(用錯 id 會回 null,下面就全是假通過)", () => {
    expect(styleIds.length).toBeGreaterThan(0);
    expect(paramsFor(styleIds[0], 0, CTX)).not.toBeNull();
  });

  it.each(styleIds)("② 「%s」連按 4 次要產生 4 種不同的參數", (style) => {
    const outs = [0, 1, 2, 3].map((s) => paramsFor(style, s, CTX));
    expect(new Set(outs).size).toBeGreaterThan(1);
  });

  it("③ ⛔沒有 designSize 時變體會失效 —— 而且必須留下警告,不能靜默", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const outs = [0, 1, 2, 3].map((s) => paramsFor(styleIds[0], s, undefined));
    // 行為本身維持(沒尺寸就沒得抽),但一定要有人被通知
    expect(new Set(outs).size).toBe(1);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
