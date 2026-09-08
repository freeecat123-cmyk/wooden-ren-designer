/**
 * 「開發中／暫不上架」名單只能有一份（lib/templates DEV_CATEGORIES）。
 *
 * 🩸 2026-09-09：木頭仁說乙級第一題「先不要上架」，cert-b1 加進 DEV_CATEGORIES 後 /templates、sitemap、
 * 定價頁、設計頁都對了，但 `app/[locale]/app/page.tsx` 自己抄了一份四款的清單 → 設計器目錄「全部」分頁
 * 照列 cert-b1、可點可買。同一份清單抄很多份是老問題（DEV_CATEGORIES 的註解就寫過 3 份漏了
 * wall-mounted-tool-storage），所以用測試釘住：除了單一真相來源那一支，沒有第二個檔案可以自己列名單。
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { DEV_CATEGORIES } from "@/lib/templates";

const ROOT = process.cwd();
const SOURCE_OF_TRUTH = join("lib", "templates", "index.ts");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next" || name === ".git") continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

describe("DEV_CATEGORIES 單一真相來源", () => {
  it("名單本身非空且含既有四款", () => {
    for (const c of ["chinese-cabinet", "bed", "coat-rack", "wall-mounted-tool-storage"]) {
      expect(DEV_CATEGORIES.has(c), c).toBe(true);
    }
  });

  it("除了 lib/templates/index.ts，沒有別的檔案自己列開發中名單", () => {
    // 特徵＝「陣列／Set 字面值裡的每一個 category 字串都是開發中款」。
    // 這樣才抓得到抄一份名單（`new Set(["chinese-cabinet","bed","coat-rack","wall-mounted-tool-storage"])`），
    // 又不會誤報正當用法：FurnitureCategory union（不是陣列）、labels／sizing／marketing（物件的 key）、
    // quote／derive 的 accessory 名單（裡面混了非開發中款）。
    const members = new Set(DEV_CATEGORIES);
    const offenders: string[] = [];
    for (const dir of ["app", "lib", "components", "scripts"]) {
      for (const file of walk(join(ROOT, dir))) {
        const rel = file.slice(ROOT.length + 1);
        if (rel === SOURCE_OF_TRUTH || rel.includes("__tests__") || /\.test\.tsx?$/.test(rel)) continue;
        // 先剝掉註解再判——不然「註解裡提到 DEV_CATEGORIES」就會被當成已經修好
        // （2026-09-09 這支測試自己踩過：加了說明註解後變異測試不紅）
        const src = readFileSync(file, "utf8")
          .replace(/\/\*[\s\S]*?\*\//g, "")
          .replace(/^\s*\/\/.*$/gm, "");
        if (/\bDEV_CATEGORIES\b/.test(src)) continue;   // 已經吃單一真相來源
        for (const lit of src.match(/\[[^\][]{0,600}\]/g) ?? []) {
          const strings = (lit.match(/"[a-z0-9-]+"/g) ?? []).map((x) => x.slice(1, -1));
          const cats = strings.filter((x) => x.includes("-") || members.has(x));
          const devHits = cats.filter((x) => members.has(x));
          if (devHits.length >= 2 && cats.length === devHits.length) {
            offenders.push(`${rel} → [${devHits.join(", ")}]`);
            break;
          }
        }
      }
    }
    expect(offenders, `這些檔案自己抄了一份開發中名單，改吃 DEV_CATEGORIES：\n${offenders.join("\n")}`).toEqual([]);
  });
});
