import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/** 會被轉成 PDF 的 SVG 來源目錄。 */
const SCANNED = ["lib/render", "components/print", "lib/export/template-pack"];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

describe("PDF 字重限制", () => {
  it("不得出現 400/700 以外的 font-weight", () => {
    const offenders: string[] = [];
    for (const root of SCANNED) {
      for (const file of walk(root)) {
        const src = readFileSync(file, "utf8");
        src.split("\n").forEach((line, i) => {
          if (/fontWeight=\{(?!400|700)\d+\}|font-weight="(?!400|700)\d+"/.test(line)) {
            offenders.push(`${file}:${i + 1}`);
          }
        });
      }
    }
    // svg2pdf 只認 400/700，中間值會靜默改用 Helvetica → 中文變亂碼且不報錯
    expect(offenders).toEqual([]);
  });
});
