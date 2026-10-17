/**
 * 客戶私密頁一律 noindex 的守門測試。
 *
 * 🩸 2026-10-16：`/projects/<id>/quote?token=...` 是**木匠貼給客戶看的報價單**
 * （CopyShareLinkButton 產的分享連結），頁上印著客戶姓名、聯絡方式、地址、
 * 每一項金額、木匠自己的聯絡資訊 —— 但它既沒有 meta noindex，`app/robots.ts`
 * 也沒擋 `/projects`。對照組 `shared-design/[token]` 早就寫了
 * `robots:{index:false}` + `referrer:"no-referrer"`，所以 projects 那組是漏掉的。
 * 當天補了 4 頁，但**只有 tsc 把關、沒有閘門** → 下一個人新增
 * `projects/<id>/invoice/page.tsx` 之類的頁面時沒有任何東西會喊。這支就是那個閘門。
 *
 * 守兩條規則：
 *   ① `app/[locale]/projects/[id]/**` 與 `app/[locale]/shared-design/**` 的每一支
 *      `page.tsx` 都必須在 metadata 裡宣告 `index: false`。
 *   ② 任何**吃 `token` 查詢字串**的 page.tsx（= 可分享給站外的人看的網址）
 *      除了 noindex，還要 `referrer: "no-referrer"`，token 才不會跟著外連
 *      從 Referer 標頭漏出去。
 *   ③ 任何會**印出客戶資料**的 page.tsx（報價單：客戶姓名／電話／地址寫在網址裡）
 *      同樣兩個欄位都要有。
 *
 * ⚠️ 刻意**不**要求 robots.txt 加 Disallow：被 Disallow 的網址 Google 不爬 →
 *    讀不到 noindex，有外部連結時仍可能只收錄網址本身。理由見
 *    `app/[locale]/projects/[id]/quote/page.tsx` 開頭。
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const APP_DIR = join("app", "[locale]");

/**
 * 這些目錄底下的頁面一律不給收錄（網址本身就對應到某一位客戶的資料）。
 *
 * ⚠️ 清單裡刻意**沒有** `projects` 索引頁本身（`app/[locale]/projects/page.tsx`）：
 *    它只列「登入者自己的」專案，爬蟲看到的是空清單，沒有客戶資料外洩的問題。
 *    那頁該不該因為「薄內容」而 noindex 是 SEO 決策、不是隱私決策，等木頭仁點頭。
 */
const PRIVATE_DIRS = [
  join(APP_DIR, "projects", "[id]"),
  join(APP_DIR, "shared-design"),
];

function walkPages(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(join(ROOT, dir));
  } catch {
    return out; // 目錄被改名／刪掉 → 交給下面的「至少要有幾頁」斷言去喊
  }
  for (const name of entries) {
    const rel = join(dir, name);
    if (statSync(join(ROOT, rel)).isDirectory()) {
      walkPages(rel, out);
    } else if (name === "page.tsx") {
      out.push(rel);
    }
  }
  return out;
}

/** 把註解拿掉再比對，免得註解裡的 `index: false` 被當成真的有做。 */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

/** 回報這頁少了哪些欄位（兩條規則共用，免得兩邊各寫一份判斷）。 */
function missing(rel: string, code: string): string[] {
  const out: string[] = [];
  if (!/index\s*:\s*false/.test(code)) out.push(`${rel}（缺 index:false）`);
  if (!/referrer\s*:\s*["']no-referrer["']/.test(code))
    out.push(`${rel}（缺 referrer:"no-referrer"）`);
  return out;
}

const privatePages = PRIVATE_DIRS.flatMap((d) => walkPages(d)).sort();
const allPages = walkPages(APP_DIR).sort();

describe("客戶私密頁 noindex 守門", () => {
  it("找得到要守的頁面（目錄搬了就要回來改這支）", () => {
    expect(privatePages.length).toBeGreaterThanOrEqual(5);
    expect(allPages.length).toBeGreaterThanOrEqual(30);
  });

  it.each(privatePages)("%s 宣告了 index: false", (rel) => {
    const code = stripComments(readFileSync(join(ROOT, rel), "utf8"));
    expect(/index\s*:\s*false/.test(code)).toBe(true);
  });

  it("吃 ?token= 的頁面都有 noindex ＋ no-referrer", () => {
    const offenders: string[] = [];
    for (const rel of allPages) {
      const code = stripComments(readFileSync(join(ROOT, rel), "utf8"));
      // 「宣告了 token 這個 searchParam」= 這個網址會被貼給站外的人
      const takesToken = /searchParams\s*:\s*Promise<\{[^}]*\btoken\b/.test(code);
      if (!takesToken) continue;
      offenders.push(...missing(rel, code));
    }
    expect(offenders).toEqual([]);
  });

  /**
   * 🩸 2026-10-17：`/design/<款>/quote?customerName=…&customerAddress=…` 跟裝潢工具的
   * `/ceiling/quote/print?c=<客戶 base64>` 把客戶姓名／電話／地址寫在**網址裡**，
   * 卻一頁都沒有 meta noindex，也都沒有 referrer policy。robots.txt 只擋了
   * `/design/<款>/quote` 那組（裝潢工具那組連擋都沒擋），而 Disallow 既讀不到
   * noindex、也完全管不到 Referer。這條就是釘住「頁面會印客戶資料 → 兩個欄位都要有」。
   */
  it("會印客戶資料的頁面都有 noindex ＋ no-referrer", () => {
    const pages = allPages.filter((rel) => {
      const code = stripComments(readFileSync(join(ROOT, rel), "utf8"));
      return (
        /\bCustomerInfo\b/.test(code) ||          // 裝潢工具報價單（?c= base64 包）
        /\bcustomerName\b/.test(code) ||          // 家具報價單（?customerName= 明碼）
        /\bEMPTY_CUSTOMER\b/.test(code)
      );
    });
    // 名單空掉 = 偵測訊號被改名了，要回來改這支，不可以靜悄悄變成 0 件通過
    expect(pages.length).toBeGreaterThanOrEqual(5);
    const offenders = pages.flatMap((rel) =>
      missing(rel, stripComments(readFileSync(join(ROOT, rel), "utf8"))),
    );
    expect(offenders).toEqual([]);
  });
});
