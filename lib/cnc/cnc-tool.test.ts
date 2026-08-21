import { describe, it, expect } from "vitest";
import { readFileSync, statSync } from "node:fs";
import path from "node:path";

/**
 * 🧷 CNC 刀路工具(單檔離線 HTML)的冒煙測試。
 *
 * ⭐ 為什麼要有這支:`lib/cnc/cnc-tool.html` 是 **1.4MB 的壓縮建置產物,人工從另一個
 *   repo(~/CLAUDE/cnc-toolpath)貼進來的**。它的 1433 條測試住在那邊,這裡只有成品。
 *   近 7 個 commit 全是「同步 XXX」/「對應 <另一 repo 的 hash>」——
 *   **repo 內沒有任何東西驗證貼進來的東西是好的**。
 *   而 /api/cnc-tool 會把它發給每一個付費 / 試用中的使用者。(2026-08-21 稽核發現。)
 *
 * ⚠️ 這支**不是**在測 CNC 演算法(那是另一個 repo 的事,那邊有 1433 條測試)。
 *    它擋的是「貼的過程出錯」這三種真實會發生的事:
 *      ① 貼到一半 / 檔案截斷    ② 貼錯檔案      ③ 貼到開發版
 *    這三種都不會有人發現,直到使用者下載回去打不開。
 */
const FILE = path.join(process.cwd(), "lib/cnc/cnc-tool.html");
const html = readFileSync(FILE, "utf-8");

describe("cnc-tool.html — 貼進來的建置產物", () => {
  it("① 檔案在,而且大小合理(壓縮後的單檔 app 應該在 0.5–5MB)", () => {
    const mb = statSync(FILE).size / 1024 / 1024;
    expect(mb).toBeGreaterThan(0.5);
    expect(mb).toBeLessThan(5);
  });

  it("② 沒有被截斷:開頭是 doctype、結尾是收好的 </html>", () => {
    expect(html.trimStart().slice(0, 15).toLowerCase()).toBe("<!doctype html>");
    expect(html.trimEnd().endsWith("</html>")).toBe(true);
  });

  it("③ 是「單檔」離線版:所有 script 都內嵌,不能有外部 src", () => {
    // vite-plugin-singlefile 的重點就是全部 inline。有 src= 代表貼到未打包的版本,
    // 使用者存檔帶走就會壞掉。
    const externalScripts = html.match(/<script[^>]+src=/gi) ?? [];
    expect(externalScripts).toEqual([]);
    const externalCss = html.match(/<link[^>]+rel=["']stylesheet["']/gi) ?? [];
    expect(externalCss).toEqual([]);
  });

  it("④ 是正式建置不是開發版:沒有 sourcemap 註解", () => {
    expect(html).not.toMatch(/sourceMappingURL/);
  });

  it("⑤ 貼的是對的那支工具:關鍵功能字樣都在", () => {
    // 貼錯檔案(例如貼成另一個專案的 index.html)這幾個一定不會同時出現。
    for (const marker of ["GORDIX", "Carvera", "鳩尾", "刀路"]) {
      expect(html, `找不到關鍵字「${marker}」——可能貼錯檔案`).toContain(marker);
    }
  });

  it("⑥ 有掛載點(React app 的根節點)", () => {
    expect(html).toMatch(/<div id="root"><\/div>/);
  });

  it("⑦ 沒有把本機開發位址寫死進去(存檔帶走會連不到)", () => {
    // 允許字串字面值裡出現 "localhost" 這個字（例如判斷用），
    // 但不可以有 http://localhost:PORT 這種真的會被拿去連線的位址。
    expect(html).not.toMatch(/https?:\/\/localhost:\d+/);
    expect(html).not.toMatch(/https?:\/\/127\.0\.0\.1:\d+/);
  });
});
