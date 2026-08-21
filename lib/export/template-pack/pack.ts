// 把一個設計組成一包 1:1 樣板 PDF（依紙張分檔），用既有的 zipStore 打包。
import type { FurnitureDesign } from "@/lib/types";
import { groupPartsForDrawing, groupDisplayName } from "@/lib/render/part-drawing/grouping";
import { deriveMortisesByPart } from "@/lib/export/derived-mortises";
import { zipStore } from "@/lib/export/zip-store";
import { ladderForOutline, PAPERS } from "./paper";
import { placeOnLadder, type Placement } from "./fit";
import { pickTemplateFaces } from "./face";
import { faceNeedsTemplate } from "./needs-template";
import { templateSheetSvg } from "./sheet";
import { planA4Tiles, CALIBRATION_TEST_LINE_MM, calibrationScale } from "./tiling";
import { tileSheetSvg, printerTestPageSvg } from "./tile-sheet";
import { indexSheetSvg, type PackRow } from "./index-sheet";
import { fetchFontSubset, svgsToPdf, FontSubsetError } from "./pdf";
import { partDrawingSvgs, DRAWING_PAGE_W_MM, DRAWING_PAGE_H_MM } from "./part-drawing-svg";

/** "printshop" = 現有的選紙＋擺放（可能斜擺）；"a4" = 全部在家用 A4 拼接，不旋轉。 */
export type PackMode = "printshop" | "a4";

const A4_PAPER = PAPERS.find((p) => p.id === "A4")!;

export interface PackPlan {
  rows: PackRow[];
  /** key = paper.id + (swapped ? "-P" : "") */
  byPaper: Map<string, Array<{ placement: Placement; row: PackRow; svg: string }>>;
}

/**
 * @param calibrationMeasuredMm 使用者在印表機測試頁上量到的 250mm 校正線實際長度
 * （mm）。預設 CALIBRATION_TEST_LINE_MM（250）＝沒校正，跟原本行為完全一樣。
 * 只有 mode="a4" 會用到；printshop 模式送輸出中心印，不會撞到家用印表機的縮放
 * 誤差問題。
 */
export function buildPackPlan(
  design: FurnitureDesign,
  mode: PackMode = "printshop",
  calibrationMeasuredMm: number = CALIBRATION_TEST_LINE_MM,
): PackPlan {
  const s = calibrationScale(calibrationMeasuredMm);
  const groups = groupPartsForDrawing(design);
  const derivedMap = deriveMortisesByPart(design.parts);
  const rows: PackRow[] = [];
  const byPaper: PackPlan["byPaper"] = new Map();

  const pushSheet = (key: string, entry: { placement: Placement; row: PackRow; svg: string }) => {
    if (!byPaper.has(key)) byPaper.set(key, []);
    byPaper.get(key)!.push(entry);
  };

  groups.forEach((g, i) => {
    const part = g.representative;
    // 每個加工面各一張樣板。一隻腳兩個相鄰內側面各接一片牙板時，只印面積最大的
    // 那面 = 另一面的榫孔在紙上完全不存在（全 catalog 實測會吃掉 291 個孔）。
    const faces = pickTemplateFaces(part, derivedMap.get(part.id) ?? []);
    const baseNo = `P-${String(i + 1).padStart(2, "0")}`;
    faces.forEach((face, fi) => {
      // 單面維持 P-01；多面加尾碼 P-01a / P-01b…（faces 最多 6 個，不會超出 a–f）
      const partNo = faces.length > 1 ? `${baseNo}${String.fromCharCode(97 + fi)}` : baseNo;
      const nameZh = groupDisplayName(g, "zh-TW");
      const qty = Math.min(g.count, 99);

      // 零孔零榫的純矩形不出樣板（見 needs-template.ts）。兩個模式都套同一套判定，
      // 但仍然要進 rows —— 索引會把它標成「不需要樣板 · 直接量畫」，零件不可以
      // 從清單上消失。
      if (!faceNeedsTemplate(face)) {
        rows.push({
          partNo, nameZh, faceLabelZh: face.faceLabelZh, faceIndex: fi,
          faceCount: faces.length, qty, wmm: face.w, hmm: face.h,
          placement: null, plainRect: true,
        });
        return;
      }

      if (mode === "a4") {
        // A4 拼接模式：張數上限 6，超過就退回零件圖（跟 printshop 的 placeOnLadder
        // 回 null 同一套語意，index-sheet 的「太大 → 見零件圖」不用另外改）。
        const plan = planA4Tiles(face.w, face.h, s);
        if (!plan) {
          rows.push({
            partNo, nameZh, faceLabelZh: face.faceLabelZh, faceIndex: fi,
            faceCount: faces.length, qty, wmm: face.w, hmm: face.h, placement: null,
          });
          return;
        }
        // 拼接一律不旋轉（brief 決策 2）。placement 借用既有 Placement 形狀
        // （paper=A4、angleDeg=0、swapped=直放與否），讓 byPaper／下載／進度
        // 這些既有機制不用另外改一套。
        const placement: Placement = { paper: A4_PAPER, angleDeg: 0, swapped: !plan.landscape };
        const row: PackRow = {
          partNo, nameZh, faceLabelZh: face.faceLabelZh, faceIndex: fi,
          faceCount: faces.length, qty, wmm: face.w, hmm: face.h, placement,
          tiling: { landscape: plan.landscape, cols: plan.cols, rows: plan.rows },
        };
        rows.push(row);
        const key = `${placement.paper.id}${placement.swapped ? "-P" : ""}`;
        for (const tile of plan.tiles) {
          const svg = tileSheetSvg({
            face, plan, tile, partNo: row.partNo, nameZh: row.nameZh, qty: row.qty,
            faceIndex: fi, faceCount: faces.length, s,
          });
          pushSheet(key, { placement, row, svg });
        }
        return;
      }

      // 紙張上限看輪廓形狀,不看零件分類(見 paper.ts ladderForOutline)。
      const placement = placeOnLadder(face.w, face.h, ladderForOutline(face.outline));
      const row: PackRow = {
        partNo, nameZh, faceLabelZh: face.faceLabelZh, faceIndex: fi,
        faceCount: faces.length, qty, wmm: face.w, hmm: face.h, placement,
      };
      rows.push(row);
      if (!placement) return;
      const key = `${placement.paper.id}${placement.swapped ? "-P" : ""}`;
      const svg = templateSheetSvg({
        face,
        placement,
        partNo: row.partNo,
        nameZh: row.nameZh,
        qty: row.qty,
        faceIndex: fi,
        faceCount: faces.length,
      });
      pushSheet(key, { placement, row, svg });
    });
  });

  return { rows, byPaper };
}

// design.nameZh 在型別上是必填 string，直接用即可。
function safeStem(design: FurnitureDesign): string {
  return design.nameZh.replace(/[\\/:*?"<>|]/g, "_");
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * @param calibrationMeasuredMm 見 buildPackPlan 同名參數；只有 mode="a4" 用得到。
 */
export async function downloadTemplatePack(
  design: FurnitureDesign,
  onProgress?: (done: number, total: number) => void,
  mode: PackMode = "printshop",
  calibrationMeasuredMm: number = CALIBRATION_TEST_LINE_MM,
): Promise<void> {
  const plan = buildPackPlan(design, mode, calibrationMeasuredMm);
  const allSvgs: string[] = [];
  for (const list of plan.byPaper.values()) for (const it of list) allSvgs.push(it.svg);
  // 只有 a4 模式、且使用者真的填了跟標稱值不同的校正，索引頁才多印一行提醒
  // （見 index-sheet.ts renderPageHeader）——printshop 模式或沒校正時完全不受影響。
  const isCalibrated = mode === "a4" && calibrationMeasuredMm !== CALIBRATION_TEST_LINE_MM;
  const indexSvgs = indexSheetSvg(
    safeStem(design),
    plan.rows,
    isCalibrated ? calibrationMeasuredMm : undefined,
  ); // 多頁索引（避免超過每頁列數上限時漏印）
  allSvgs.push(...indexSvgs);

  // a4 模式才需要印表機測試頁——printshop 模式送印刷店，不會撞到家用印表機的
  // 不可列印區問題。放在整包最前面（檔名開頭 00_，比 00_索引.pdf 先——見下方
  // files 的塞入順序＋檔名本身的字元排序，兩層都保證排在索引前面）。
  const totalSheets = Array.from(plan.byPaper.values()).reduce((sum, a) => sum + a.length, 0);
  const testPageSvg = mode === "a4" ? printerTestPageSvg(totalSheets, calibrationScale(calibrationMeasuredMm)) : null;
  if (testPageSvg) allSvgs.push(testPageSvg);

  // 零件圖(每個零件群組一張 A4 橫式)。索引上的「太大 → 見零件圖」原本是斷頭路——
  // 承諾了這份檔案卻沒放進 zip,使用者得自己回網站找(斗櫃 24 件裡 16 件指向這條路)。
  // 兩個模式都放:太大退回跟純矩形不出樣板的零件在兩種模式下都存在。
  const drawingSvgs = await partDrawingSvgs(design);
  allSvgs.push(...drawingSvgs);

  // 一次要好整包會用到的所有字元，避免每份 PDF 各打一次 API。
  // 依 HTTP 狀態碼分情況給使用者訊息——這個 catch 會接到任何失敗（400 字元過多 /
  // 429 rate limit / 500 / 網路斷線），不能一律說成「字元過多」，否則使用者被
  // rate limit 時會誤以為要簡化設計，回報理由也會是錯的（review 2026-08-19）。
  let fontB64: string;
  try {
    fontB64 = await fetchFontSubset(allSvgs);
  } catch (err) {
    console.error("[template-pack] fetchFontSubset 失敗", err);
    if (err instanceof FontSubsetError) {
      if (err.status === 400) throw new Error("樣板文字包含的字元過多，請回報給開發者。");
      if (err.status === 429) throw new Error("產生次數過於頻繁，請稍後再試。");
      if ((err.status ?? 0) >= 500) {
        // 5xx 是伺服器端的事，叫使用者「檢查網路」會害他往錯的方向找
        // （2026-08-20 就是這樣：Upstash 掛掉讓這支回 500，畫面卻說網路有問題）。
        throw new Error("字型服務暫時異常，請稍後再試；持續發生請回報。");
      }
    }
    throw new Error("連不上字型服務，請檢查網路後重試。");
  }

  const files: Record<string, Uint8Array> = {};
  const total = plan.byPaper.size + 1 + (testPageSvg ? 1 : 0) + (drawingSvgs.length ? 1 : 0);
  let done = 0;

  // svgsToPdf 內部失敗訊息（例如「SVG 解析失敗」）是給開發者除錯用的技術字眼，
  // 不該直接丟給使用者看，統一包成「PDF 產生失敗」。
  try {
    if (testPageSvg) {
      // A4 橫放，跟其他拼接紙同一個尺寸。
      files["00_印表機測試頁.pdf"] = await svgsToPdf([testPageSvg], 297, 210, fontB64);
      onProgress?.(++done, total);
    }
    files["00_索引.pdf"] = await svgsToPdf(indexSvgs, 210, 297, fontB64);
    onProgress?.(++done, total);

    if (drawingSvgs.length) {
      files["04_零件圖.pdf"] = await svgsToPdf(
        drawingSvgs, DRAWING_PAGE_W_MM, DRAWING_PAGE_H_MM, fontB64,
      );
      onProgress?.(++done, total);
    }

    let n = 1;
    for (const [key, list] of plan.byPaper) {
      const { paper, swapped } = list[0].placement;
      const pw = swapped ? paper.h : paper.w;
      const ph = swapped ? paper.w : paper.h;
      const name = `${String(n).padStart(2, "0")}_樣板_${key}.pdf`;
      files[name] = await svgsToPdf(list.map((x) => x.svg), pw, ph, fontB64);
      n++;
      onProgress?.(++done, total);
    }
  } catch (err) {
    console.error("[template-pack] svgsToPdf 失敗", err);
    throw new Error("PDF 產生失敗，請重試。");
  }

  let zip: Uint8Array;
  try {
    zip = zipStore(files);
  } catch (err) {
    console.error("[template-pack] zipStore 失敗", err);
    throw new Error("PDF 產生失敗，請重試。");
  }
  const ab = zip.buffer.slice(zip.byteOffset, zip.byteOffset + zip.byteLength) as ArrayBuffer;
  const date = new Date().toISOString().slice(0, 10);
  triggerDownload(new Blob([ab], { type: "application/zip" }), `${safeStem(design)}_實尺樣板_${date}.zip`);
}
