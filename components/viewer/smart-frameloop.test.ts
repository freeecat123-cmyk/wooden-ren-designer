import { describe, it, expect } from "vitest";
import fs from "node:fs";

/**
 * ⭐⭐ 3D 靜置時停止重繪（2026-08-26，木頭仁回報「手機很慢」）。
 *
 * 實測：靜置 6 秒完全沒操作，手機主執行緒 41% / 桌機 100% 都在跑 Three.js
 * 的重繪迴圈（場景全靜態，沒有任何 useFrame，OrbitControls 也沒開 damping）。
 * 改成「有事才畫」後兩邊都降到 3%。
 *
 * 🩸 但這裡有個地雷 —— 見 [[feedback-frameloop-demand-invalidate]]：
 *    2026-05-12 為了修「選零件時其他零件不變半透明」，Canvas 從 demand 改成
 *    always，中間失敗過四種寫法（invalidate / key remount / needsUpdate /
 *    永遠 transparent），都是輸給 GPU 上傳的單幀競態。
 *
 * ⇒ 這支釘住兩件事，任一被拿掉當年的 bug 就會無聲回來：
 *    1. 任何影響畫面的 prop 變動後，必須**持續**重繪一段遠大於單幀的時間
 *    2. PerspectiveView 影響畫面的 prop，一個都不能漏出喚醒清單
 */

const HOOK = "components/viewer/useSmartFrameloop.ts";
const VIEW = "components/PerspectiveView.tsx";

/** 剝掉註解 —— 註解裡就寫著這些欄位名，不剝的話 includes 永遠成立＝橡皮圖章 */
const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("3D 靜置停繪不可以把當年的半透明競態放回來", () => {
  it("變動後要維持連續重繪，而且遠長於單幀", () => {
    const src = stripComments(fs.readFileSync(HOOK, "utf-8"));
    const m = src.match(/ACTIVE_MS\s*=\s*(\d+)/);
    expect(m, "找不到 ACTIVE_MS").toBeTruthy();
    const ms = Number(m![1]);
    // 一幀約 16ms。當年失敗的版本只補一次 invalidate（＝1 幀）就輸了。
    expect(
      ms,
      `變動後只連續重繪 ${ms}ms（約 ${Math.round(ms / 16)} 幀）→ 太短，` +
        `2026-05-12 那個「選零件其他零件不變半透明」的 GPU 上傳競態會回來`,
    ).toBeGreaterThanOrEqual(800);
  });

  it("dep 變動時一定要喚醒（不能只留空的 useEffect）", () => {
    const src = stripComments(fs.readFileSync(HOOK, "utf-8"));
    const i = src.indexOf("}, deps)");
    expect(i, "找不到掛在 deps 上的 useEffect").toBeGreaterThan(0);
    const body = src.slice(src.lastIndexOf("useEffect(", i), i);
    expect(
      /wake\.current\(\)/.test(body),
      "deps 變動沒有呼叫 wake() → 改材質/選零件時畫面不會更新",
    ).toBe(true);
  });

  it("Canvas 不可以寫死成 demand / never", () => {
    const src = stripComments(fs.readFileSync(VIEW, "utf-8"));
    expect(
      /frameloop=["'](demand|never)["']/.test(src),
      "Canvas 的 frameloop 被寫死成 demand/never → 互動會整個卡住",
    ).toBe(false);
    expect(
      /frameloop=\{frameloop\}/.test(src),
      "Canvas 沒有吃 useSmartFrameloop 的結果",
    ).toBe(true);
  });

  /**
   * 🩸 這個 repo 已經被「PerspectiveView 加了新欄位卻忘了帶」咬過兩次
   *    （2026-08-25 dirZ / 2026-08-26 lowerCove，見 two-way-cove.test.ts）。
   *    喚醒清單漏一個 prop 的症狀一模一樣：改了設定但 3D 沒反應。
   */
  it("PerspectiveView 影響畫面的 prop 都要在喚醒清單裡", () => {
    const src = fs.readFileSync(VIEW, "utf-8");

    // 元件的解構參數清單 = 所有 prop
    const start = src.indexOf("export function PerspectiveView({");
    expect(start, "找不到 PerspectiveView").toBeGreaterThan(0);
    const destructure = src.slice(start + "export function PerspectiveView({".length, src.indexOf("}: {", start));
    const props = stripComments(destructure)
      .split(",")
      .map((s) => s.trim().split(/[=:\s]/)[0])
      .filter(Boolean);
    expect(props.length, `只剖析到 ${props.length} 個 prop，剖析可能失敗`).toBeGreaterThanOrEqual(10);

    // 不影響畫面的 prop：純回呼，不需要重繪
    const NOT_VISUAL = new Set(["onPartSelect"]);

    const di = src.indexOf("useSmartFrameloop(");
    expect(di, "PerspectiveView 沒有用 useSmartFrameloop").toBeGreaterThan(0);
    const deps = stripComments(src.slice(di, src.indexOf("]);", di)));

    const missing = props.filter((p) => !NOT_VISUAL.has(p) && !deps.includes(p));
    expect(
      missing,
      `useSmartFrameloop 的喚醒清單漏了 ${missing.join("、")} → ` +
        `改這些設定時 3D 可能停在舊畫面（跟 2026-08-25 dirZ、08-26 lowerCove 同一種病）`,
    ).toEqual([]);
  });
});
