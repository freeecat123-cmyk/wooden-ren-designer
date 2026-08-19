import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/** 會被轉成 PDF 的 SVG 來源目錄。 */
const SCANNED = ["lib/render", "components/print", "lib/export/template-pack"];

/** 測試檔不會變成送進 svg2pdf 的 SVG，而且裡面本來就會有違規字串當範例 → 跳過。 */
function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

/**
 * 字重的四種寫法都要掃到。
 *
 * 舊版只有 `fontWeight={600}` 與 `font-weight="600"` 兩種，漏掉 camelCase + 字串的
 * `fontWeight="600"` —— svg-views.tsx 裡剛好有 8 處（含三視圖尺寸標註）用這個寫法，
 * 測試全綠但一個都沒抓到，等於假的安全網。
 */
const PATTERNS = [
  /fontWeight=\{(?!400|700)\d+\}/,        // fontWeight={600}
  /fontWeight="(?!400|700)\d+"/,          // fontWeight="600"
  /font-weight="(?!400|700)\d+"/,         // font-weight="600"
  /fontWeight:\s*(?!400|700)\d+/,         // style={{ fontWeight: 600 }}
];

describe("PDF 字重限制", () => {
  it("不得出現 400/700 以外的 font-weight", () => {
    const offenders: string[] = [];
    for (const root of SCANNED) {
      for (const file of walk(root)) {
        const src = readFileSync(file, "utf8");
        src.split("\n").forEach((line, i) => {
          if (PATTERNS.some((re) => re.test(line))) offenders.push(`${file}:${i + 1}`);
        });
      }
    }
    // svg2pdf 只認 400/700，中間值會靜默改用 Helvetica → 中文變亂碼且不報錯
    expect(offenders).toEqual([]);
  });

  // regex 本身的自我檢查：上面那條全綠可能是「真的乾淨」，也可能是「又漏了一種寫法」。
  it("四種寫法的違規都抓得到，400/700 不誤判", () => {
    const bad = [
      `fontWeight={600}`,
      `fontWeight="600"`,
      `font-weight="500"`,
      `style={{ fontWeight: 600 }}`,
    ];
    for (const line of bad) {
      expect(PATTERNS.some((re) => re.test(line)), `漏抓：${line}`).toBe(true);
    }
    const ok = [
      `fontWeight={700}`,
      `fontWeight="700"`,
      `fontWeight="400"`,
      `font-weight="400"`,
      `style={{ fontWeight: 700 }}`,
    ];
    for (const line of ok) {
      expect(PATTERNS.some((re) => re.test(line)), `誤判：${line}`).toBe(false);
    }
  });
});
