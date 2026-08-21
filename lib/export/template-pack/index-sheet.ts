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
  /** null = 1:1 塞不下最大的紙 → 退回比例零件圖；也可能是 plainRect（見下） */
  placement: Placement | null;
  /**
   * true = 零孔零榫的純矩形，**刻意不出樣板**（不是塞不下）。
   *
   * 跟 `placement === null`（太大 → 見零件圖）是兩種完全不同的狀態，索引上的
   * 說法也不同：這種是「不需要樣板 · 直接量畫」，使用者不必去找零件圖。
   * 兩者混為一談會讓人以為一堆零件都太大印不出來。
   */
  plainRect?: boolean;
  /**
   * 只有 A4 拼接模式（buildPackPlan mode="a4"）且塞得下（≤6 張）時才有值。
   * printshop 模式或拼接失敗的列一律不設這個欄位（undefined），
   * 「印在哪張紙」欄照舊用 placement 那條分支——不會動到既有 87 個測試。
   */
  tiling?: { landscape: boolean; cols: number; rows: number };
}

const W = 210;
const H = 297;

// 欄位起點 (mm) 與寬度。
// 「面別」是後補的欄——多加工面的零件會拆成 P-01a / P-01b 兩列，件名一模一樣，
// 沒有這欄使用者看不出兩列差在哪。件名欄因此從 74mm 縮到 66mm。
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

const r1 = (n: number) => Math.round(n * 10) / 10;

/** 件名超過 14 字截斷加省略號。中文字寬約 4.5mm @ font-size 4.5，欄寬 66mm。 */
function truncateName(nameZh: string): string {
  const MAX_CHARS = 14;
  if (nameZh.length > MAX_CHARS) {
    return nameZh.slice(0, MAX_CHARS - 1) + "…";
  }
  return nameZh;
}

/**
 * A4 拼接相關的提醒行文字（第一頁、hasA4 時才出現）。回傳的順序就是印出來的
 * 順序，每行各佔一個 A4_REMINDER_LINE_STEP 的行高。
 *
 * calibrationMeasuredMm：使用者這次匯出用的印表機校正基準值（250mm 測試線量到
 * 的長度，見 tiling.ts CALIBRATION_TEST_LINE_MM）。undefined＝沒套用校正（含
 * printshop 模式、或 a4 模式但沒填校正），不加後面兩行——這個包不會因為多語
 * 校正提醒就跟舊版索引頁長得不一樣。
 *
 * 文案刻意講人話（不用「係數／補償／幾何／縮放因子」這類詞）：這份索引頁常常
 * 是使用者事後翻出舊 zip 才看到的東西，要讓他知道「這份是配哪台印表機校正
 * 過的」，換印表機要重新來一次，而不是寫成系統除錯訊息。
 */
function a4ReminderLines(hasA4: boolean, calibrationMeasuredMm?: number): string[] {
  if (!hasA4) return [];
  const lines = [
    "拼接前請先印 00_印表機測試頁，確認你的印表機邊界安全再印其餘 A4。",
    "拼接紙的實體邊緣本來就會對不齊（進紙誤差，正常現象）；真正要對準的是紙上印出來的十字與線。",
  ];
  if (calibrationMeasuredMm != null) {
    lines.push(
      `這份樣板已經套用你量過的印表機校正（那次量到 ${r1(calibrationMeasuredMm)}mm）；列印設定還是要選「實際大小 / 100%」，不要再縮放一次。`,
      "這個校正是配這台印表機的，換另一台印表機要重新量一次、重新下載。",
    );
  }
  return lines;
}

/** A4 提醒行的行高（mm）與起始 y。 */
const A4_REMINDER_LINE_STEP = 6;
const A4_REMINDER_START_Y = 45;

/** 首頁「列印提醒區塊」結束、底線畫在哪個 y（無 A4 提醒時＝原本的 46，完全不變）。 */
function firstPageBaselineY(hasA4: boolean, calibrationMeasuredMm?: number): number {
  const extra = a4ReminderLines(hasA4, calibrationMeasuredMm);
  if (extra.length === 0) return 46;
  return A4_REMINDER_START_Y + extra.length * A4_REMINDER_LINE_STEP - 1;
}

/**
 * 單頁表頭與設定（包括底線）。isFirstPage 決定是否加列印提醒。
 *
 * hasA4：這包裡有沒有 A4 拼接模式的列（PackRow.tiling 有值）。只有這種情況才
 * 加額外提醒——printshop 模式（hasA4=false）的既有兩行提醒 y 座標（33／39）、
 * 底線 y=46、表頭 headY=53 全部維持原樣，不動既有 87 個測試守住的版面；
 * hasA4=true 時底線／表頭／資料列起點改用 firstPageBaselineY() 動態往下推，
 * 讓 2～4 行 A4 提醒（拼接說明＋邊緣不對齊說明＋校正說明）有地方印，不用再
 * 塞進原本 39→46 那個只有 7mm 高的縫（上一輪修法的教訓：字級被迫縮到 4mm、
 * 沒有實測過會不會太擠）。這條路徑不會被既有 139 個測試踩到——所有既有測試
 * 的 fixture 都沒有 tiling 欄位（hasA4 恆為 false），行為完全不變。
 */
function renderPageHeader(
  title: string,
  pageNum: number,
  totalPages: number,
  isFirstPage: boolean,
  hasA4: boolean,
  calibrationMeasuredMm: number | undefined,
): { lines: string[]; baselineY: number } {
  const lines: string[] = [];

  // 標題 + 頁碼
  const pageLabel = totalPages > 1 ? `(第 ${pageNum} 頁 / 共 ${totalPages} 頁)` : "";
  lines.push(
    `<text x="14" y="24" font-family="PackCJK" font-size="9" font-weight="700" fill="#000">${esc(title)} — 1:1 實尺樣板索引${pageLabel}</text>`,
  );

  let baselineY = 30;
  if (isFirstPage) {
    lines.push(
      `<text x="14" y="33" font-family="PackCJK" font-size="4.5" font-weight="400" fill="#000">列印時務必選「實際大小 / 100%」，不要選「縮放至頁面大小」，否則樣板不是實尺。</text>`,
    );
    lines.push(
      `<text x="14" y="39" font-family="PackCJK" font-size="4.5" font-weight="400" fill="#000">每張樣板都有一條 100mm 證明尺（灰色虛線，在空白角），量一下就知道有沒有被縮放。</text>`,
    );
    const extra = a4ReminderLines(hasA4, calibrationMeasuredMm);
    extra.forEach((text, i) => {
      const y = A4_REMINDER_START_Y + i * A4_REMINDER_LINE_STEP;
      lines.push(
        `<text x="14" y="${y}" font-family="PackCJK" font-size="4" font-weight="${i === 0 || i === 2 ? "700" : "400"}" fill="#000">${esc(text)}</text>`,
      );
    });
    baselineY = firstPageBaselineY(hasA4, calibrationMeasuredMm);
    lines.push(`<line x1="14" y1="${baselineY}" x2="196" y2="${baselineY}" stroke="#000" stroke-width="0.5"/>`);
  } else {
    lines.push(`<line x1="14" y1="30" x2="196" y2="30" stroke="#000" stroke-width="0.5"/>`);
  }

  return { lines, baselineY };
}

/** 表頭行（件號、件名、數量、攤平尺寸、印在哪張紙）。headY：見 renderPageHeader 的動態版面說明。 */
function renderTableHeader(headY: number): string[] {
  const lines: string[] = [];
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

  const tileCount = r.tiling ? r.tiling.cols * r.tiling.rows : 0;
  // plainRect 要排在 placement 之前判斷：它是「刻意不出」，不是「塞不下」，
  // 講成「太大 → 見零件圖」會害使用者跑去找一張根本不需要的圖。
  const where = r.plainRect
    ? "不需要樣板 · 直接量畫"
    : r.tiling
      ? `A4 ×${tileCount}（${r.tiling.cols}×${r.tiling.rows} 拼接）`
      : r.placement
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

/**
 * 表頭（欄名那一列）的 y。非首頁固定 53（原本行為，不變）；首頁固定在
 * 「列印提醒區塊底線」下方 7mm——沒有 A4 提醒時底線＝46，headY＝53，跟原本
 * 一模一樣；有 A4 提醒時底線往下推，headY 跟著往下推，兩者永遠維持 7mm 間距。
 */
function pageHeadY(isFirstPage: boolean, hasA4: boolean, calibrationMeasuredMm?: number): number {
  if (!isFirstPage) return 53;
  return firstPageBaselineY(hasA4, calibrationMeasuredMm) + 7;
}

/**
 * 第一列資料的基準線 y。非首頁固定 60（原本行為，不變）；首頁＝headY+9，
 * 跟 pageHeadY 用同一個來源，兩者不會走鐘。
 */
function firstRowY(isFirstPage: boolean, hasA4: boolean, calibrationMeasuredMm?: number): number {
  if (!isFirstPage) return 60;
  return pageHeadY(true, hasA4, calibrationMeasuredMm) + 9;
}

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
 *
 * hasA4／calibrationMeasuredMm 只影響第一頁的起始 y（見 firstRowY）——沒有
 * tiling 欄位的既有呼叫（hasA4 恆為 false）容量完全不變，這是既有 139 個測試
 * （含「1..120 全掃」「每頁列數＝實際填列容量」這種嚴格容量測試）安全的原因：
 * 那些 fixture 全部不帶 tiling 欄位。
 */
function paginate(
  rowCount: number,
  hasA4: boolean,
  calibrationMeasuredMm?: number,
): Array<{ start: number; end: number }> {
  const pages: Array<{ start: number; end: number }> = [];
  let i = 0;
  do {
    const start = i;
    let y = firstRowY(pages.length === 0, hasA4, calibrationMeasuredMm);
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

/**
 * @param calibrationMeasuredMm 這批樣板實際套用的印表機校正基準值（250mm 測試線
 * 量到的長度）。undefined（預設）＝沒有校正提醒，索引頁跟原本一模一樣；只有
 * a4 模式且使用者真的填了跟標稱值不同的校正時，呼叫端（pack.ts）才會傳這個值。
 */
export function indexSheetSvg(title: string, rows: PackRow[], calibrationMeasuredMm?: number): string[] {
  const hasA4 = rows.some((r) => r.tiling);
  const ranges = paginate(rows.length, hasA4, calibrationMeasuredMm);
  const totalPages = ranges.length;

  const pages = ranges.map(({ start, end }, idx) => {
    const isFirstPage = idx === 0;
    const lines: string[] = [];

    // 頁面標題 + 可選的列印提醒
    const header = renderPageHeader(title, idx + 1, totalPages, isFirstPage, hasA4, calibrationMeasuredMm);
    lines.push(...header.lines);

    // 表頭
    const headY = pageHeadY(isFirstPage, hasA4, calibrationMeasuredMm);
    lines.push(...renderTableHeader(headY));

    // 資料列
    let y = firstRowY(isFirstPage, hasA4, calibrationMeasuredMm);
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
