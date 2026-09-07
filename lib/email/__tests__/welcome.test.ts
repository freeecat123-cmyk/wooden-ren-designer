import { describe, it, expect } from "vitest";
import { welcomeEmail } from "../templates/welcome";

/**
 * 歡迎信第一段主打「先把你的工作桌畫出來」（2026-09-04 木頭仁拍板：工作桌是最重要的免費鉤子）。
 * 三個免費範本（方凳、筆筒、木工工作桌）仍要列出來。
 */
describe("welcomeEmail — 主打免費工作桌", () => {
  it("zh-TW：第一段講工作桌、附落地頁網址、三件免費都列", () => {
    const m = welcomeEmail({ name: "阿仁" });
    expect(m.text.startsWith("阿仁，")).toBe(true);
    // 開頭第一段（前 3 行）就要講工作桌
    const head = m.text.split("\n").slice(0, 3).join("\n");
    expect(head).toContain("先把你的工作桌畫出來");
    expect(m.text).toContain("https://designer.woodenren.com/workbench");
    expect(m.html).toContain('href="https://designer.woodenren.com/workbench"');
    for (const name of ["方凳", "筆筒", "木工工作桌"]) {
      expect(m.text).toContain(name);
      expect(m.html).toContain(name);
    }
  });

  it("en：first paragraph leads with the workbench + landing URL + all three free templates", () => {
    const m = welcomeEmail({ name: "Sam", locale: "en" });
    expect(m.text.startsWith("Hi Sam,")).toBe(true);
    const head = m.text.split("\n").slice(0, 3).join("\n");
    expect(head.toLowerCase()).toContain("draw your own workbench");
    expect(m.text).toContain("https://designer.woodenren.com/en/workbench");
    expect(m.html).toContain('href="https://designer.woodenren.com/en/workbench"');
    for (const name of ["square stool", "pencil holder", "workbench"]) {
      expect(m.text).toContain(name);
      expect(m.html).toContain(name);
    }
  });

  it("名字含 HTML 會被跳脫", () => {
    const m = welcomeEmail({ name: "<b>x</b>" });
    expect(m.html).not.toContain("<b>x</b>");
    expect(m.html).toContain("&lt;b&gt;x&lt;/b&gt;");
  });
});
