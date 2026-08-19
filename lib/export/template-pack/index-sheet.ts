// 列印包索引封面（A4 直式）。到輸出中心可以核張數，也避免漏印。
import type { Placement } from "./fit";

export interface PackRow {
  partNo: string;
  nameZh: string;
  qty: number;
  wmm: number;
  hmm: number;
  /** null = 1:1 塞不下最大的紙 → 退回比例零件圖 */
  placement: Placement | null;
}

const W = 210;
const H = 297;

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function indexSheetSvg(title: string, rows: PackRow[]): string {
  const cols = [14, 40, 78, 100, 140];
  const head = ["件號", "件名", "數量", "攤平尺寸", "印在哪張紙"];
  const lines: string[] = [];

  lines.push(
    `<text x="14" y="24" font-family="PackCJK" font-size="9" font-weight="700" fill="#000">${esc(title)} — 1:1 實尺樣板索引</text>`,
  );
  lines.push(
    `<text x="14" y="33" font-family="PackCJK" font-size="4.5" font-weight="400" fill="#000">列印時務必選「實際大小 / 100%」，不要選「縮放至頁面大小」，否則樣板不是實尺。</text>`,
  );
  lines.push(
    `<text x="14" y="39" font-family="PackCJK" font-size="4.5" font-weight="400" fill="#000">每張樣板左下角有一條 100mm 證明尺，印出來量一下就知道有沒有被縮放。</text>`,
  );
  lines.push(`<line x1="14" y1="46" x2="196" y2="46" stroke="#000" stroke-width="0.5"/>`);

  head.forEach((h, i) => {
    lines.push(
      `<text x="${cols[i]}" y="53" font-family="PackCJK" font-size="4.5" font-weight="700" fill="#000">${esc(h)}</text>`,
    );
  });

  let y = 62;
  for (const r of rows) {
    const where = r.placement
      ? `${r.placement.paper.label}${r.placement.swapped ? " 直放" : ""}${r.placement.angleDeg > 0 ? ` 斜 ${r.placement.angleDeg}°` : ""}`
      : "太大 → 見零件圖";
    const cells = [
      r.partNo,
      r.nameZh,
      `×${r.qty}`,
      `${Math.round(r.wmm)}×${Math.round(r.hmm)}`,
      where,
    ];
    cells.forEach((c, i) => {
      lines.push(
        `<text x="${cols[i]}" y="${y}" font-family="PackCJK" font-size="4.5" font-weight="400" fill="#000">${esc(c)}</text>`,
      );
    });
    y += 7;
    if (y > H - 20) break;
  }

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}mm" height="${H}mm" viewBox="0 0 ${W} ${H}">`,
    lines.join("\n  "),
    `</svg>`,
    "",
  ].join("\n");
}
