// 把一個設計組成一包 1:1 樣板 PDF（依紙張分檔），用既有的 zipStore 打包。
import type { FurnitureDesign } from "@/lib/types";
import { groupPartsForDrawing, groupDisplayName } from "@/lib/render/part-drawing/grouping";
import { deriveMortisesByPart } from "@/lib/export/derived-mortises";
import { categorizePart } from "@/lib/render/categorize-part";
import { zipStore } from "@/lib/export/zip-store";
import { ladderFor } from "./paper";
import { placeOnLadder, type Placement } from "./fit";
import { pickTemplateFaces } from "./face";
import { templateSheetSvg } from "./sheet";
import { indexSheetSvg, type PackRow } from "./index-sheet";
import { fetchFontSubset, svgsToPdf, FontSubsetError } from "./pdf";

export interface PackPlan {
  rows: PackRow[];
  /** key = paper.id + (swapped ? "-P" : "") */
  byPaper: Map<string, Array<{ placement: Placement; row: PackRow; svg: string }>>;
}

export function buildPackPlan(design: FurnitureDesign): PackPlan {
  const groups = groupPartsForDrawing(design);
  const derivedMap = deriveMortisesByPart(design.parts);
  const rows: PackRow[] = [];
  const byPaper: PackPlan["byPaper"] = new Map();

  groups.forEach((g, i) => {
    const part = g.representative;
    // 每個加工面各一張樣板。一隻腳兩個相鄰內側面各接一片牙板時，只印面積最大的
    // 那面 = 另一面的榫孔在紙上完全不存在（全 catalog 實測會吃掉 291 個孔）。
    const faces = pickTemplateFaces(part, derivedMap.get(part.id) ?? []);
    const baseNo = `P-${String(i + 1).padStart(2, "0")}`;
    faces.forEach((face, fi) => {
      // 單面維持 P-01；多面加尾碼 P-01a / P-01b…（faces 最多 6 個，不會超出 a–f）
      const partNo = faces.length > 1 ? `${baseNo}${String.fromCharCode(97 + fi)}` : baseNo;
      const placement = placeOnLadder(face.w, face.h, ladderFor(categorizePart(part.id)));
      const row: PackRow = {
        partNo,
        nameZh: groupDisplayName(g, "zh-TW"),
        faceLabelZh: face.faceLabelZh,
        faceIndex: fi,
        faceCount: faces.length,
        qty: Math.min(g.count, 99),
        wmm: face.w,
        hmm: face.h,
        placement,
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
      if (!byPaper.has(key)) byPaper.set(key, []);
      byPaper.get(key)!.push({ placement, row, svg });
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

export async function downloadTemplatePack(
  design: FurnitureDesign,
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  const plan = buildPackPlan(design);
  const allSvgs: string[] = [];
  for (const list of plan.byPaper.values()) for (const it of list) allSvgs.push(it.svg);
  const indexSvgs = indexSheetSvg(safeStem(design), plan.rows); // 多頁索引（避免超過每頁列數上限時漏印）
  allSvgs.push(...indexSvgs);

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
    }
    throw new Error("字型載入失敗，請檢查網路後重試。");
  }

  const files: Record<string, Uint8Array> = {};
  const total = plan.byPaper.size + 1;
  let done = 0;

  // svgsToPdf 內部失敗訊息（例如「SVG 解析失敗」）是給開發者除錯用的技術字眼，
  // 不該直接丟給使用者看，統一包成「PDF 產生失敗」。
  try {
    files["00_索引.pdf"] = await svgsToPdf(indexSvgs, 210, 297, fontB64);
    onProgress?.(++done, total);

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
