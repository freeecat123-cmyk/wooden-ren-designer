import { describe, it, expect } from "vitest";

/**
 * 🧷 /api/og 的尺寸參數只接受數字。
 *
 * ⛔ 原本直接把 query 字串印進圖裡 → 任何人可以產出一張 1200×630、
 *   **網址掛在正式網域**、內容由他決定的圖,拿去做假冒的釣魚貼文。
 *   (2026-08-21 稽核發現。)
 *
 * 這裡把 route 裡的 `dim()` 規則獨立複製一份來測 —— route 本身是 next/og runtime,
 * 在 vitest 裡跑不起來。⚠️ 兩份實作有漂移風險,所以規則刻意寫得極簡:
 * 「有限的正數、上限 100000、四捨五入,其餘一律 ?」。改 route 時記得同步這裡。
 */
const dim = (raw: string | null): string => {
  if (!raw) return "?";
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0 || n > 100000) return "?";
  return String(Math.round(n));
};

describe("og 尺寸參數", () => {
  it("① 正常數字照用", () => {
    expect(dim("1200")).toBe("1200");
    expect(dim("350.4")).toBe("350");
  });

  it("② ⛔任意文字一律變 ?（這就是釣魚圖的入口）", () => {
    for (const evil of [
      "限時免費領取請點連結",
      "<script>alert(1)</script>",
      "0800-000-000 詐騙專線",
      "A".repeat(2000),
    ]) {
      expect(dim(evil)).toBe("?");
    }
  });

  it("③ 缺參數 / 空字串 → ?（跟原本行為一致）", () => {
    expect(dim(null)).toBe("?");
    expect(dim("")).toBe("?");
  });

  it("④ 不合理的數字擋掉（負數 / 0 / 破表 / NaN / Infinity）", () => {
    for (const bad of ["-100", "0", "999999999", "NaN", "Infinity", "1e400"]) {
      expect(dim(bad)).toBe("?");
    }
  });

  it("⑤ 邊界:剛好上限可用、超過一點就擋", () => {
    expect(dim("100000")).toBe("100000");
    expect(dim("100001")).toBe("?");
  });
});
