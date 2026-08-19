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
});
