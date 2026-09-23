import { describe, it, expect } from "vitest";
import { collectChars } from "./pdf";

describe("collectChars", () => {
  it("抽出所有文字節點的字元，去重", () => {
    const svg = '<svg><text>凳腳</text><text>凳腳 P-01</text></svg>';
    const got = collectChars([svg]);
    expect(got).toContain("凳");
    expect(got).toContain("腳");
    expect(got).toContain("P");
    // 去重：凳只出現一次
    expect(got.split("").filter((c) => c === "凳").length).toBe(1);
  });

  it("不把標籤名稱當成文字", () => {
    expect(collectChars(['<svg><path d="M 0 0"/></svg>'])).not.toContain("d");
  });

  it("巢狀 tspan：收全部文字，包含巢狀標籤之後的兄弟文字", () => {
    const svg = "<svg><text>abc<tspan>def</tspan>ghi</text></svg>";
    const got = collectChars([svg]);
    for (const c of "abcdefghi") {
      expect(got).toContain(c);
    }
  });

  it("XML 實體解碼回原字元", () => {
    expect(collectChars(["<svg><text>A&lt;B</text></svg>"])).toContain("<");
    expect(collectChars(["<svg><text>A&gt;B</text></svg>"])).toContain(">");
    expect(collectChars(['<svg><text>A&quot;B</text></svg>'])).toContain('"');
    expect(collectChars(["<svg><text>A&amp;B</text></svg>"])).toContain("&");
    expect(collectChars(["<svg><text>A&#39;B</text></svg>"])).toContain("'");
  });
});
