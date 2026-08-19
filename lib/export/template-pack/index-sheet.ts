// 列印包索引封面（A4 直式，分頁）。到輸出中心可以核張數，也避免漏印。
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

// 欄位起點 (mm) 與寬度
const COLS = {
  partNo: { x: 14, width: 18 },
  nameZh: { x: 32, width: 74 },
  qty: { x: 106, width: 14 },
  wh: { x: 120, width: 34 },
  where: { x: 154, width: 42 },
};

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** 件名超過 16 字截斷加省略號。中文字寬約 4.5mm @ font-size 4.5。 */
function truncateName(nameZh: string): string {
  const MAX_CHARS = 16;
  if (nameZh.length > MAX_CHARS) {
    return nameZh.slice(0, 15) + "…";
  }
  return nameZh;
}

/** 單頁表頭與設定（包括底線）。isFirstPage 決定是否加列印提醒。 */
function renderPageHeader(title: string, pageNum: number, totalPages: number, isFirstPage: boolean): string[] {
  const lines: string[] = [];

  // 標題 + 頁碼
  const pageLabel = totalPages > 1 ? `(第 ${pageNum} 頁 / 共 ${totalPages} 頁)` : "";
  lines.push(
    `<text x="14" y="24" font-family="PackCJK" font-size="9" font-weight="700" fill="#000">${esc(title)} — 1:1 實尺樣板索引${pageLabel}</text>`,
  );

  if (isFirstPage) {
    lines.push(
      `<text x="14" y="33" font-family="PackCJK" font-size="4.5" font-weight="400" fill="#000">列印時務必選「實際大小 / 100%」，不要選「縮放至頁面大小」，否則樣板不是實尺。</text>`,
    );
    lines.push(
      `<text x="14" y="39" font-family="PackCJK" font-size="4.5" font-weight="400" fill="#000">每張樣板左下角有一條 100mm 證明尺，印出來量一下就知道有沒有被縮放。</text>`,
    );
    lines.push(`<line x1="14" y1="46" x2="196" y2="46" stroke="#000" stroke-width="0.5"/>`);
  } else {
    lines.push(`<line x1="14" y1="30" x2="196" y2="30" stroke="#000" stroke-width="0.5"/>`);
  }

  return lines;
}

/** 表頭行（件號、件名、數量、攤平尺寸、印在哪張紙）。 */
function renderTableHeader(): string[] {
  const lines: string[] = [];
  const head = ["件號", "件名", "數量", "攤平尺寸", "印在哪張紙"];
  const headY = 53;

  lines.push(
    `<text x="${COLS.partNo.x}" y="${headY}" font-family="PackCJK" font-size="4.5" font-weight="700" fill="#000">${esc(head[0])}</text>`,
  );
  lines.push(
    `<text x="${COLS.nameZh.x}" y="${headY}" font-family="PackCJK" font-size="4.5" font-weight="700" fill="#000">${esc(head[1])}</text>`,
  );
  lines.push(
    `<text x="${COLS.qty.x}" y="${headY}" font-family="PackCJK" font-size="4.5" font-weight="700" fill="#000">${esc(head[2])}</text>`,
  );
  lines.push(
    `<text x="${COLS.wh.x}" y="${headY}" font-family="PackCJK" font-size="4.5" font-weight="700" fill="#000">${esc(head[3])}</text>`,
  );
  lines.push(
    `<text x="${COLS.where.x}" y="${headY}" font-family="PackCJK" font-size="4.5" font-weight="700" fill="#000">${esc(head[4])}</text>`,
  );

  return lines;
}

/** 資料列。 */
function renderTableRow(r: PackRow, y: number): string[] {
  const lines: string[] = [];

  const where = r.placement
    ? `${r.placement.paper.label}${r.placement.swapped ? " 直放" : ""}${r.placement.angleDeg > 0 ? ` 斜 ${r.placement.angleDeg}°` : ""}`
    : "太大 → 見零件圖";

  const nameZhTruncated = truncateName(r.nameZh);
  const wh = `${Math.round(r.wmm)}×${Math.round(r.hmm)}`;

  lines.push(
    `<text x="${COLS.partNo.x}" y="${y}" font-family="PackCJK" font-size="4.5" font-weight="400" fill="#000">${esc(r.partNo)}</text>`,
  );
  lines.push(
    `<text x="${COLS.nameZh.x}" y="${y}" font-family="PackCJK" font-size="4.5" font-weight="400" fill="#000">${esc(nameZhTruncated)}</text>`,
  );
  lines.push(
    `<text x="${COLS.qty.x}" y="${y}" font-family="PackCJK" font-size="4.5" font-weight="400" fill="#000">×${r.qty}</text>`,
  );
  lines.push(
    `<text x="${COLS.wh.x}" y="${y}" font-family="PackCJK" font-size="4.5" font-weight="400" fill="#000">${esc(wh)}</text>`,
  );
  lines.push(
    `<text x="${COLS.where.x}" y="${y}" font-family="PackCJK" font-size="4.5" font-weight="400" fill="#000">${esc(where)}</text>`,
  );

  return lines;
}

export function indexSheetSvg(title: string, rows: PackRow[]): string[] {
  // 計算頁數：首頁標題+提醒佔 ~46mm，後續頁標題佔 ~30mm
  // 表頭 53mm，之後每行 7mm。可用高度：297 - 邊界。
  // 首頁：62 開始資料，297 - 20 = 277 上限，可用 215mm → 30 行
  // 後續頁：37 開始資料，297 - 20 = 277 上限，可用 240mm → 34 行

  const ROWS_PER_PAGE = 31; // 保守估計，包含表頭

  const pages: string[] = [];
  const totalPages = Math.max(1, Math.ceil(rows.length / ROWS_PER_PAGE));

  let rowIndex = 0;
  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    const isFirstPage = pageNum === 1;
    const lines: string[] = [];

    // 頁面標題 + 可選的列印提醒
    lines.push(...renderPageHeader(title, pageNum, totalPages, isFirstPage));

    // 表頭
    lines.push(...renderTableHeader());

    // 資料列
    let y = isFirstPage ? 62 : 60; // 首頁 62 開始，後續頁 60 開始（更緊湊）
    const maxY = H - 20; // 留邊界

    while (rowIndex < rows.length && y < maxY) {
      lines.push(...renderTableRow(rows[rowIndex], y));
      rowIndex++;
      y += 7;
    }

    // 生成 SVG
    const svg = [
      `<svg xmlns="http://www.w3.org/2000/svg" width="${W}mm" height="${H}mm" viewBox="0 0 ${W} ${H}">`,
      lines.join("\n  "),
      `</svg>`,
      "",
    ].join("\n");

    pages.push(svg);
  }

  return pages;
}
