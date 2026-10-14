import { configDefaults, defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
  test: {
    exclude: [...configDefaults.exclude, ".claude/**", ".tmp/**"],
    include: ["**/__tests__/**/*.test.ts", "**/*.test.ts"],
    /**
     * 每天 13:00 的維護排程用 wrd-verify 比對 origin/main，而單元測試在那裡
     * **長期是紅的** —— 不是程式壞了，是 vitest 預設的 5000ms 太短。
     *
     * 這套有 15 支 Playwright 測試（各自 chromium.launch() + esbuild bundle），
     * 加上 negative-dims 那種「全模板 × 全數字選項極值」的重運算，全部平行跑。
     * 機器一忙就整批 `Test timed out in 5000ms`，而且每次中獎的不是同一支
     * （2026-10-14 實測：全套跑是 StudioActionGuard 紅，單獨跑同一支 3/3 全過）。
     *
     * 後果不是「測試偶爾紅」而已 —— 是**每天的上線閘門失去意義**：
     * 真的壞掉跟機器太忙長得一樣，看到紅燈沒辦法分辨。
     *
     * 30 秒是「比最慢的正常測試寬，但仍抓得到真的卡死」。
     * ⚠️ 不要為了讓某支過而再往上加 —— 真的需要更久的個別測試請用
     * `it(..., 30000)` 那種 per-test timeout，不要動這個全域值。
     */
    testTimeout: 30000,
  },
});
