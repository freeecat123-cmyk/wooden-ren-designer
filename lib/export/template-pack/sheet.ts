// 一個零件 → 一張 1:1 樣板 SVG（字串）。viewBox 單位 = mm = 紙面座標。
// 內容只有：輪廓、榫孔／公榫、部件名稱、100mm 證明尺。沒有尺寸標註、沒有三視圖。
import type { MachiningFace, FaceHole } from "@/lib/export/mortise-faces";
import { outlinePathD } from "@/lib/export/parts-svg";
import type { Placement } from "./fit";

/** 輪廓線寬 mm。比 CNC 的 0.1mm hairline 粗，列印才看得見。 */
const STROKE_MM = 0.3;
/** 證明尺長度 mm。 */
export const PROOF_RULER_MM = 100;
/** 名稱要塞進輪廓內所需的最小可用寬度 mm；不足就改放輪廓外。 */
const LABEL_MIN_WIDTH_MM = 12;

export interface TemplateSheetInput {
  face: MachiningFace;
  placement: Placement;
  partNo: string;
  nameZh: string;
  qty: number;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function holeMarkup(h: FaceHole): string {
  const t = `<title>${esc(h.label + (h.through ? "（通）" : "（盲）"))}</title>`;
  if (h.kind === "circle" && h.cx != null && h.cy != null && h.r != null) {
    const cross = Math.max(h.r * 0.8, 1.5);
    return [
      `<circle cx="${r2(h.cx)}" cy="${r2(h.cy)}" r="${r2(h.r)}" fill="none" stroke="#000" stroke-width="${STROKE_MM}">${t}</circle>`,
      `<g data-mark="center-cross" stroke="#000" stroke-width="${STROKE_MM / 2}">`,
      `<line x1="${r2(h.cx - cross)}" y1="${r2(h.cy)}" x2="${r2(h.cx + cross)}" y2="${r2(h.cy)}"/>`,
      `<line x1="${r2(h.cx)}" y1="${r2(h.cy - cross)}" x2="${r2(h.cx)}" y2="${r2(h.cy + cross)}"/>`,
      `</g>`,
    ].join("");
  }
  if (!h.pts) return "";
  const cx = h.pts.reduce((s, p) => s + p.x, 0) / h.pts.length;
  const cy = h.pts.reduce((s, p) => s + p.y, 0) / h.pts.length;
  return [
    `<path d="${outlinePathD(h.pts)}" fill="none" stroke="#000" stroke-width="${STROKE_MM}">${t}</path>`,
    `<g data-mark="center-cross" stroke="#000" stroke-width="${STROKE_MM / 2}">`,
    `<line x1="${r2(cx - 2)}" y1="${r2(cy)}" x2="${r2(cx + 2)}" y2="${r2(cy)}"/>`,
    `<line x1="${r2(cx)}" y1="${r2(cy - 2)}" x2="${r2(cx)}" y2="${r2(cy + 2)}"/>`,
    `</g>`,
  ].join("");
}

export function templateSheetSvg(input: TemplateSheetInput): string {
  const { face, placement, partNo, nameZh, qty } = input;
  const { paper, angleDeg, swapped } = placement;
  const pageW = swapped ? paper.h : paper.w;
  const pageH = swapped ? paper.w : paper.h;

  // 旋轉後外框，用來把內容置中。
  //
  // SVG rotate(θ) 以原點為軸、y 軸向下，(x,y) → (x·cosθ − y·sinθ, x·sinθ + y·cosθ)。
  // face 佔 [0,w]×[0,h]，四角轉完後：
  //   min x = −h·sinθ   max x = w·cosθ      → bw = w·cosθ + h·sinθ
  //   min y = 0          max y = w·sinθ + h·cosθ → bh = w·sinθ + h·cosθ
  // 也就是旋轉後 bbox 的左上角落在 (−h·sinθ, 0)，所以要把它平移回 (offX, offY)
  // 就得多補 +h·sinθ。transform 順序 translate ∘ rotate＝先轉再移。
  const t = (angleDeg * Math.PI) / 180;
  const bw = face.w * Math.cos(t) + face.h * Math.sin(t);
  const bh = face.w * Math.sin(t) + face.h * Math.cos(t);
  const offX = (pageW - bw) / 2;
  const offY = (pageH - bh) / 2;
  const tx = offX + face.h * Math.sin(t);
  const ty = offY;
  const transform = `translate(${r2(tx)} ${r2(ty)}) rotate(${r2(angleDeg)})`;

  const geometry = [
    `<path d="${outlinePathD(face.outline)}" fill="none" stroke="#000" stroke-width="${STROKE_MM}"/>`,
    ...(face.tenons ?? []).map(
      (tn) =>
        `<path d="${outlinePathD(tn.pts)}" fill="none" stroke="#000" stroke-width="${STROKE_MM}"><title>${esc(tn.label + "（公榫）")}</title></path>`,
    ),
    ...face.holes.map(holeMarkup),
  ].join("\n    ");

  // 名稱：輪廓夠寬就放輪廓中央，太窄就放正上方 3mm
  const inside = face.h >= LABEL_MIN_WIDTH_MM;
  const labelY = inside ? face.h / 2 + 2 : -3;
  const labelText = `${partNo} ${nameZh}${qty > 1 ? ` ×${qty}` : ""}`;
  const label =
    `<text x="${r2(face.w / 2)}" y="${r2(labelY)}" font-family="PackCJK" font-size="6" font-weight="700"` +
    ` fill="#000" text-anchor="middle">${esc(labelText)}</text>`;

  // 100mm 證明尺，固定畫在紙面左下角，不隨內容旋轉
  const rx = 10;
  const ry = pageH - 10;
  const ruler = [
    `<g data-mark="proof-ruler" stroke="#000" stroke-width="${STROKE_MM}" fill="none">`,
    `<line x1="${rx}" y1="${ry}" x2="${rx + PROOF_RULER_MM}" y2="${ry}"/>`,
    `<line x1="${rx}" y1="${ry - 2.5}" x2="${rx}" y2="${ry + 2.5}"/>`,
    `<line x1="${rx + PROOF_RULER_MM}" y1="${ry - 2.5}" x2="${rx + PROOF_RULER_MM}" y2="${ry + 2.5}"/>`,
    `</g>`,
    `<text x="${rx + PROOF_RULER_MM / 2}" y="${r2(ry - 4)}" font-family="PackCJK" font-size="4"`,
    ` font-weight="400" fill="#000" text-anchor="middle">此線實長 100mm — 列印請選「實際大小」</text>`,
  ].join("");

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${pageW}mm" height="${pageH}mm" viewBox="0 0 ${pageW} ${pageH}">`,
    `  <g transform="${transform}">`,
    `    ${geometry}`,
    `    ${label}`,
    `  </g>`,
    `  ${ruler}`,
    `</svg>`,
    "",
  ].join("\n");
}
