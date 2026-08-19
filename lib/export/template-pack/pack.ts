// 把一個設計組成一包 1:1 樣板 PDF（依紙張分檔），用既有的 zipStore 打包。
import type { FurnitureDesign } from "@/lib/types";
import { groupPartsForDrawing, groupDisplayName } from "@/lib/render/part-drawing/grouping";
import { deriveMortisesByPart } from "@/lib/export/derived-mortises";
import { categorizePart } from "@/lib/render/categorize-part";
import { zipStore } from "@/lib/export/zip-store";
import { ladderFor } from "./paper";
import { placeOnLadder, type Placement } from "./fit";
import { pickTemplateFace } from "./face";
import { templateSheetSvg } from "./sheet";
import { indexSheetSvg, type PackRow } from "./index-sheet";
import { fetchFontSubset, svgsToPdf } from "./pdf";

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
    const face = pickTemplateFace(part, derivedMap.get(part.id) ?? []);
    const placement = placeOnLadder(face.w, face.h, ladderFor(categorizePart(part.id)));
    const row: PackRow = {
      partNo: `P-${String(i + 1).padStart(2, "0")}`,
      nameZh: groupDisplayName(g, "zh-TW"),
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
    });
    if (!byPaper.has(key)) byPaper.set(key, []);
    byPaper.get(key)!.push({ placement, row, svg });
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
  // /api/pdf-font 對 chars 有 2000 字上限（超過回 400）——正常整包（去重後的唯一字
  // 元）遠遠到不了，若真的超過，把錯誤包成使用者看得懂的訊息，而不是讓 fetch 400
  // 無聲失敗。
  let fontB64: string;
  try {
    fontB64 = await fetchFontSubset(allSvgs);
  } catch (err) {
    throw new Error(
      `樣板包含的字元過多，無法產生字型（${err instanceof Error ? err.message : String(err)}）。請回報這個設計給開發者。`,
    );
  }

  const files: Record<string, Uint8Array> = {};
  const total = plan.byPaper.size + 1;
  let done = 0;

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

  const zip = zipStore(files);
  const ab = zip.buffer.slice(zip.byteOffset, zip.byteOffset + zip.byteLength) as ArrayBuffer;
  const date = new Date().toISOString().slice(0, 10);
  triggerDownload(new Blob([ab], { type: "application/zip" }), `${safeStem(design)}_實尺樣板_${date}.zip`);
}
