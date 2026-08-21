import { describe, it, expect } from "vitest";
import { normalizeDrawingSvg, partDrawingSvgs } from "./part-drawing-svg";
import { getTemplate } from "@/lib/templates";
import type { FurnitureCatalogEntry } from "@/lib/templates";
import type { FurnitureCategory, FurnitureDesign, MaterialId, OptionSpec } from "@/lib/types";

function buildDefaultDesign(category: FurnitureCategory): FurnitureDesign {
  const entry = getTemplate(category) as FurnitureCatalogEntry | undefined;
  if (!entry?.template) throw new Error(`找不到範本：${category}`);
  const options = (entry.optionSchema ?? []).reduce<Record<string, string | number | boolean>>(
    (acc, spec: OptionSpec) => {
      acc[spec.key] = spec.defaultValue;
      return acc;
    },
    {},
  );
  return entry.template({
    length: entry.defaults.length,
    width: entry.defaults.width,
    height: entry.defaults.height,
    material: "maple" as MaterialId,
    options,
  });
}

/**
 * 零件圖是為了螢幕/瀏覽器列印寫的，字型用 sans-serif / monospace。
 * 樣板包的 PDF 只嵌了 PackCJK 一支字型，svg2pdf 找不到指定字型時會**靜默**
 * 掉回 Helvetica —— 不報錯，中文直接變亂碼（2026-08-19 實測踩過）。
 * 所以進 PDF 前一定要把字型統一改寫掉，這幾條就是那道防線。
 */
describe("normalizeDrawingSvg", () => {
  it("sans-serif 改寫成 PackCJK", () => {
    const out = normalizeDrawingSvg('<svg viewBox="0 0 297 210"><g font-family="sans-serif"/></svg>');
    expect(out).toContain('font-family="PackCJK"');
    expect(out).not.toContain("sans-serif");
  });

  it("monospace 也要改寫（尺寸數字用的就是這支）", () => {
    const out = normalizeDrawingSvg('<svg viewBox="0 0 297 210"><text font-family="monospace">300</text></svg>');
    expect(out).toContain('font-family="PackCJK"');
    expect(out).not.toContain("monospace");
  });

  it('font-weight="bold" 改寫成 700', () => {
    // svg2pdf 只認得 400 / 700，關鍵字寫法不保證，寧可先正規化
    const out = normalizeDrawingSvg('<svg viewBox="0 0 297 210"><text font-weight="bold">件號</text></svg>');
    expect(out).toContain('font-weight="700"');
    expect(out).not.toContain('font-weight="bold"');
  });

  it("補上 xmlns 與 mm 尺寸（svgsToPdf 要靠這個知道紙張大小）", () => {
    const out = normalizeDrawingSvg('<svg viewBox="0 0 297 210"></svg>');
    expect(out).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(out).toContain('width="297mm"');
    expect(out).toContain('height="210mm"');
  });

  it("拿掉 class（Tailwind 在獨立 SVG 裡沒有樣式表，w-full 反而干擾）", () => {
    const out = normalizeDrawingSvg('<svg viewBox="0 0 297 210" class="bg-white w-full h-auto"></svg>');
    expect(out).not.toContain("w-full");
  });

  it("根節點自己要帶 PackCJK —— 沒有 font-family 的 text 靠繼承才不會變亂碼", () => {
    // 2026-08-21 verify:template 抓到:FacingMark 的「上」是一個沒有 font-family
    // 的 <text>,祖先也沒有,svg2pdf 就用預設 Helvetica → 那個字整個消失。
    // 木工看不到「上」會把零件裝反面,是這份圖最不能掉的字之一。
    const out = normalizeDrawingSvg('<svg viewBox="0 0 297 210"><text>上</text></svg>');
    expect(/^<svg[^>]*font-family="PackCJK"/.test(out)).toBe(true);
  });

  it("沒有殘留的 500/600 字重（那會靜默掉回 Helvetica）", () => {
    const out = normalizeDrawingSvg('<svg viewBox="0 0 297 210"><text font-weight="600">x</text></svg>');
    expect(/font-weight="[56]\d\d"/.test(out)).toBe(false);
  });
});

describe("partDrawingSvgs（真的把 React 零件圖渲成 SVG 字串）", () => {
  it("方凳：每個零件群組各一張 A4 橫式", async () => {
    const svgs = await partDrawingSvgs(buildDefaultDesign("stool"));
    expect(svgs.length).toBeGreaterThan(0);
    for (const svg of svgs) {
      expect(svg.startsWith("<svg")).toBe(true);
      expect(svg).toContain('viewBox="0 0 297 210"');
      expect(svg).toContain('width="297mm"');
    }
  });

  it("中文有進去，而且字型全部是 PackCJK", async () => {
    const svgs = await partDrawingSvgs(buildDefaultDesign("stool"));
    const all = svgs.join("");
    expect(all).toContain("凳腳");
    expect(all).toMatch(/font-family="PackCJK"/);
    expect(all).not.toContain("sans-serif");
    expect(all).not.toContain("monospace");
  });

  it("FacingMark 的「上」有出現在輸出裡", async () => {
    const svgs = await partDrawingSvgs(buildDefaultDesign("stool"));
    expect(svgs.join("")).toContain(">上<");
  });

  it("件號跟樣板包同一套編號（索引的「見零件圖 P-XX」才對得上）", async () => {
    const svgs = await partDrawingSvgs(buildDefaultDesign("stool"));
    expect(svgs[0]).toContain("P-01");
  });

  it("不含 foreignObject —— svg2pdf 畫不出來，有的話會整塊消失", async () => {
    const svgs = await partDrawingSvgs(buildDefaultDesign("nightstand"));
    expect(svgs.join("")).not.toContain("foreignObject");
  });
});
