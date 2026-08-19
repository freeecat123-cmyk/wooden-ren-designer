// 列印包索引封面（A4 直式，分頁）。到輸出中心可以核張數，也避免漏印。
import type { Placement } from "./fit";

export interface PackRow {
  partNo: string;
  nameZh: string;
  /** 這一列是哪一個加工面（"正面" / "右端" / "攤平面"…）。 */
  faceLabelZh: string;
  /** 該零件的第幾個加工面（0-based）。 */
  faceIndex: number;
  /** 該零件總共幾個加工面。>1 時件號會帶 a/b 尾碼。 */
  faceCount: number;
  qty: number;
  wmm: number;
  hmm: number;
  /** null = 1:1 塞不下最大的紙 → 退回比例零件圖 */
  placement: Placement | null;
}

const W = 210;
const H = 297;

// 欄位起點 (mm) 與寬度。
// 「面別」是後補的欄——多加工面的零件會拆成 P-01a / P-01b 兩列，件名一模一樣，
// 沒有這欄使用者看不出兩列差在哪。件名欄因此從 74mm 縮到 62mm。
const COLS = {
  partNo: { x: 14, width: 16 },
  nameZh: { x: 30, width: 66 },
  face: { x: 96, width: 22 },
  qty: { x: 118, width: 12 },
  wh: { x: 130, width: 22 },
  where: { x: 152, width: 44 },
};

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** 件名超過 14 字截斷加省略號。中文字寬約 4.5mm @ font-size 4.5，欄寬 66mm。 */
function truncateName(nameZh: string): string {
  const MAX_CHARS = 14;
  if (nameZh.length > MAX_CHARS) {
    return nameZh.slice(0, MAX_CHARS - 1) + "…";
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
      `<text x="14" y="39" font-family="PackCJK" font-size="4.5" font-weight="400" fill="#000">每張樣板都有一條 100mm 證明尺（灰色虛線，在空白角），量一下就知道有沒有被縮放。</text>`,
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
  const headY = 53;
  const cells: Array<[number, string]> = [
    [COLS.partNo.x, "件號"],
    [COLS.nameZh.x, "件名"],
    [COLS.face.x, "面別"],
    [COLS.qty.x, "數量"],
    [COLS.wh.x, "攤平尺寸"],
    [COLS.where.x, "印在哪張紙"],
  ];
  for (const [x, s] of cells) {
    lines.push(
      `<text x="${x}" y="${headY}" font-family="PackCJK" font-size="4.5" font-weight="700" fill="#000">${esc(s)}</text>`,
    );
  }

  return lines;
}

/** 資料列。 */
function renderTableRow(r: PackRow, y: number): string[] {
  const lines: string[] = [];

  const where = r.placement
    ? `${r.placement.paper.label}${r.placement.swapped ? " 直放" : ""}${r.placement.angleDeg > 0 ? ` 斜 ${r.placement.angleDeg}°` : ""}`
    : "太大 → 見零件圖";

  // 多加工面時把「第 N/M 面」併進面別欄，使用者才知道同一支腳還有另一張要翻面做。
  const faceCell = r.faceCount > 1
    ? `${r.faceLabelZh} ${r.faceIndex + 1}/${r.faceCount}`
    : r.faceLabelZh;
  const cells: Array<[number, string]> = [
    [COLS.partNo.x, r.partNo],
    [COLS.nameZh.x, truncateName(r.nameZh)],
    [COLS.face.x, faceCell],
    [COLS.qty.x, `×${r.qty}`],
    [COLS.wh.x, `${Math.round(r.wmm)}×${Math.round(r.hmm)}`],
    [COLS.where.x, where],
  ];
  for (const [x, s] of cells) {
    lines.push(
      `<text x="${x}" y="${y}" font-family="PackCJK" font-size="4.5" font-weight="400" fill="#000">${esc(s)}</text>`,
    );
  }

  return lines;
}

/** 第一列的基準線 y（首頁多了列印提醒，起點低一點）。 */
const firstRowY = (isFirstPage: boolean) => (isFirstPage ? 62 : 60);
/** 列距 mm。 */
const ROW_STEP = 7;
/** 資料列可用的最低 y（留下邊界）。 */
const MAX_ROW_Y = H - 20;

/**
 * 分頁：直接用「實際填列」那條迴圈算出每頁裝哪幾列。
 *
 * ⚠️ 不要退回 `ceil(rows.length / 常數)`。舊版頁數是常數推算、填列是另一條
 * `while (y < maxY)`，兩套邏輯剛好都等於 31 列所以沒出事；只要有人動了起始 y、
 * 行距或頁邊，實際容量掉到 30，最後幾列就會靜默消失（沒有錯誤、沒有痕跡，
 * 使用者少印零件才發現）。現在容量只有這一個來源，頁數是它算出來的結果。
 */
function paginate(rowCount: number): Array<{ start: number; end: number }> {
  const pages: Array<{ start: number; end: number }> = [];
  let i = 0;
  do {
    const start = i;
    let y = firstRowY(pages.length === 0);
    while (i < rowCount && y < MAX_ROW_Y) {
      i++;
      y += ROW_STEP;
    }
    // 一頁裝不下任何一列 = 版面常數被改壞了，會無限迴圈。寧可爆掉也不要靜默漏件。
    if (i === start && i < rowCount) {
      throw new Error("index-sheet: 每頁容量為 0，請檢查 firstRowY / ROW_STEP / MAX_ROW_Y");
    }
    pages.push({ start, end: i });
  } while (i < rowCount);
  return pages;
}

export function indexSheetSvg(title: string, rows: PackRow[]): string[] {
  const ranges = paginate(rows.length);
  const totalPages = ranges.length;

  const pages = ranges.map(({ start, end }, idx) => {
    const isFirstPage = idx === 0;
    const lines: string[] = [];

    // 頁面標題 + 可選的列印提醒
    lines.push(...renderPageHeader(title, idx + 1, totalPages, isFirstPage));

    // 表頭
    lines.push(...renderTableHeader());

    // 資料列
    let y = firstRowY(isFirstPage);
    for (let r = start; r < end; r++) {
      lines.push(...renderTableRow(rows[r], y));
      y += ROW_STEP;
    }

    return [
      `<svg xmlns="http://www.w3.org/2000/svg" width="${W}mm" height="${H}mm" viewBox="0 0 ${W} ${H}">`,
      lines.join("\n  "),
      `</svg>`,
      "",
    ].join("\n");
  });

  // 收尾自檢：分頁涵蓋的列數必須等於輸入列數，任何漏件都在這裡爆掉。
  const covered = ranges.reduce((s, r) => s + (r.end - r.start), 0);
  if (covered !== rows.length) {
    throw new Error(`index-sheet: 分頁漏件（${covered}/${rows.length}）`);
  }

  return pages;
}
