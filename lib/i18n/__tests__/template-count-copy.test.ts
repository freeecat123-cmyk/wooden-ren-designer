/**
 * 文案裡寫的「N 件家具範本」必須等於目錄真的有幾件。
 *
 * 🩸 2026-09-17：訂價頁、FAQ、首頁描述、學員開通信全寫「26 件」，
 *    實際對外只有 25 件（DEV_CATEGORIES 與檢定考題不算）。數字寫死在 30 幾個字串裡，
 *    目錄一變就沒人記得回頭改 —— 等於在收錢的頁面多報一件。
 *    這支讓下次上線／下架家具時直接紅，逼著一起改文案。
 *
 * 「其餘 N 款」「the other N templates」指扣掉免費款之後的數量，另外比。
 * 更新日誌（changelog）是歷史紀錄，不掃。
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FURNITURE_CATALOG, isDevCategory, isExamCategory } from "@/lib/templates";
import { isPaidCategory } from "@/lib/permissions";

const ROOT = join(__dirname, "..", "..", "..");
const FILES = [
  "messages/zh-TW.json",
  "messages/en.json",
  "lib/email/templates/student-enrolled.ts",
  "components/AcademyPromoBanner.tsx",
];

const publicEntries = FURNITURE_CATALOG.filter(
  (e) => !isDevCategory(e.category) && !isExamCategory(e.category),
);
const TOTAL = publicEntries.length;
const FREE = publicEntries.filter((e) => !isPaidCategory(e.category)).length;

// 「其餘 22 款」／「the other 22 templates」
const REST = /(?:其餘\s*(\d+)\s*款|the other (\d+) templates)/g;
// 「全 25 模板」「25 件家具範本」「25 種家具參數化設計」「all 25 furniture」「25 Furniture Templates」
const ALL =
  /(?:全\s*(\d+)\s*(?:個|種|件)?\s*(?:家具|模板|範本)|(?<![\d:])(\d+)\+?\s*(?:件|種|個)\s*(?:以上)?(?:家具|範本|模板)|(?<![\d:])(\d+)\+?\s+(?:parametric |parameterizable )?(?:furniture|templates)\b)/gi;
// 免費版的「3 件範本不限次」「3 templates, unlimited use」＝免費款數，另外比
const FREE_RE = /(?:(\d+) 件範本不限次|(\d+) templates, unlimited use)/g;

function scan(re: RegExp, skip: RegExp[] = []): { file: string; n: number; text: string }[] {
  const out: { file: string; n: number; text: string }[] = [];
  for (const file of FILES) {
    let src = readFileSync(join(ROOT, file), "utf8");
    for (const s of skip) src = src.replace(s, "");
    for (const m of src.matchAll(re)) {
      const n = Number(m.slice(1).find((g) => g !== undefined));
      out.push({ file, n, text: m[0] });
    }
  }
  return out;
}

describe("文案裡的家具範本數量 = 目錄實際數量", () => {
  it("對外家具數量（手算：28 件扣掉 3 題丙級考題 = 25，其中免費 3 件）", () => {
    expect(TOTAL).toBe(25);
    expect(FREE).toBe(3);
  });

  it("「全 N 件範本」類的字串都等於對外家具數", () => {
    const hits = scan(ALL, [REST, FREE_RE]);
    // 正向對照：抓不到東西的 0 錯誤不算數（改壞 regex 時這條會紅）
    expect(hits.length).toBeGreaterThanOrEqual(50);
    const wrong = hits.filter((h) => h.n !== TOTAL).map((h) => `${h.file}: ${h.text}`);
    expect(wrong).toEqual([]);
  });

  it("免費版寫的範本數 = 免費款數", () => {
    const hits = scan(FREE_RE);
    expect(hits.length).toBe(2);
    expect(hits.filter((h) => h.n !== FREE).map((h) => `${h.file}: ${h.text}`)).toEqual([]);
  });

  it("「其餘 N 款」等於對外家具數扣掉免費款", () => {
    const hits = scan(REST);
    expect(hits.length).toBe(2);
    const wrong = hits.filter((h) => h.n !== TOTAL - FREE).map((h) => `${h.file}: ${h.text}`);
    expect(wrong).toEqual([]);
  });
});
