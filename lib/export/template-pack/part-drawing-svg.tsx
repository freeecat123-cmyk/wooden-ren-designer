// 零件圖（React 元件）→ 可以進 PDF 的 SVG 字串。
//
// 為什麼需要這層轉換：零件圖是為了螢幕與瀏覽器列印寫的，字型寫 sans-serif /
// monospace、根節點掛 Tailwind class。樣板包的 PDF 只嵌了 PackCJK 一支字型，
// svg2pdf 找不到指定字型時會**靜默**掉回 Helvetica —— 不報錯，中文直接變亂碼
// （2026-08-19 實測踩過，只有把 PDF 光柵化出來看才會發現）。所以進 PDF 前
// 一定要把字型統一改寫掉。
import React from "react";
import type { FurnitureDesign } from "@/lib/types";
import { groupPartsForDrawing, groupDisplayName } from "@/lib/render/part-drawing/grouping";
import { PartDrawingPaperSheet } from "@/lib/render/part-drawing/paper-sheet";
import { pickScaleForPaper } from "@/lib/render/part-drawing/paper-fit";
import { grossPartDims } from "@/lib/render/part-drawing/drawing";
import { MATERIALS } from "@/lib/materials";

/** A4 橫式，跟 PartDrawingPaperSheet 的 viewBox 一致。 */
export const DRAWING_PAGE_W_MM = 297;
export const DRAWING_PAGE_H_MM = 210;

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * 把零件圖 SVG 整成 svgsToPdf 吃得下的形狀。純字串處理，好測。
 *
 * - font-family 一律改成 PackCJK（唯一嵌進 PDF 的字型）
 * - font-weight 正規化成 400 / 700。svg2pdf 只認這兩個值，中間值（500/600）
 *   與關鍵字（bold）都可能靜默掉回無中文字型
 * - 補 xmlns 與 mm 尺寸；拿掉 Tailwind class（獨立 SVG 沒有樣式表，
 *   w-full / h-auto 只會干擾尺寸）
 */
export function normalizeDrawingSvg(svg: string): string {
  let out = svg
    .replace(/font-family="[^"]*"/g, 'font-family="PackCJK"')
    .replace(/font-weight="bold"/g, 'font-weight="700"')
    .replace(/font-weight="normal"/g, 'font-weight="400"')
    // 500/600 這種中間值 svg2pdf 會靜默掉回 Helvetica → 中文亂碼
    .replace(/font-weight="[5-9]\d\d"/g, 'font-weight="700"')
    .replace(/font-weight="[1-4]\d\d"/g, 'font-weight="400"')
    .replace(/\sclass="[^"]*"/g, "");

  // 根節點補 xmlns 與實體尺寸——svgsToPdf 用 width/height 對應紙張。
  out = out.replace(/^<svg\b/, "<svg");
  if (!out.includes('xmlns="http://www.w3.org/2000/svg"')) {
    out = out.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
  }
  if (!/^<svg[^>]*\swidth=/.test(out)) {
    out = out.replace(
      /^<svg/,
      `<svg width="${DRAWING_PAGE_W_MM}mm" height="${DRAWING_PAGE_H_MM}mm"`,
    );
  }
  // 根節點自己也要帶字型：零件圖裡有「身上沒有 font-family、祖先也沒有」的
  // <text>（FacingMark 標零件哪一面朝上的那個「上」就是）。那種 text 會落到
  // svg2pdf 的預設 Helvetica，中文直接消失而且不報錯——2026-08-21
  // verify:template 的逐字元比對抓到的就是這個字。掛在根節點讓全部繼承。
  if (!/^<svg[^>]*\sfont-family=/.test(out)) {
    out = out.replace(/^<svg/, '<svg font-family="PackCJK"');
  }
  return out;
}

/**
 * 一個設計的全部零件圖，每個零件群組一張 A4 橫式 SVG 字串。
 *
 * 件號用 `P-${index+1}`，跟 buildPackPlan 的 baseNo 同一套（兩邊都是照
 * groupPartsForDrawing 的順序跑），索引上的「太大 → 見零件圖 P-XX」才對得上。
 *
 * react-dom/server 走動態 import：這支只有按下下載才會用到，靜態 import 會把
 * 它綁進主 bundle（跟 pdf.ts 動態 import jspdf / svg2pdf 同一個理由）。
 */
export async function partDrawingSvgs(
  design: FurnitureDesign,
  locale: string = "zh-TW",
): Promise<string[]> {
  const { renderToStaticMarkup } = await import("react-dom/server");
  const groups = groupPartsForDrawing(design);
  const isEn = locale === "en";

  return groups.map((g, index) => {
    const part = g.representative;
    const material = MATERIALS[part.material];
    const gross = grossPartDims(part);
    const el = (
      <PartDrawingPaperSheet
        design={design}
        part={part}
        partNo={`P-${String(index + 1).padStart(2, "0")}`}
        count={Math.min(g.count, 99)}
        scale={pickScaleForPaper(part).scale}
        materialLabel={
          isEn
            ? (material?.nameEn ?? material?.nameZh ?? part.material)
            : (material?.nameZh ?? part.material)
        }
        dimsLabel={`${round1(gross.L)}×${round1(gross.W)}×${round1(gross.T)}`}
        title={groupDisplayName(g, locale)}
        locale={locale}
      />
    );
    return normalizeDrawingSvg(renderToStaticMarkup(el));
  });
}
