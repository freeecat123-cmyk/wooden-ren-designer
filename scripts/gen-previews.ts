/**
 * Generate static SVG previews of every furniture template's three-view drawing.
 * Output: wooden-ren-designer/previews/<category>.svg (committed to repo so
 * GitHub renders inline on phone/desktop without running the dev server).
 *
 * Run: pnpm tsx scripts/gen-previews.ts
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { FURNITURE_CATALOG } from "../lib/templates";
import { MATERIALS } from "../lib/materials";
import type { FurnitureDesign } from "../lib/types";
import {
  isPartHidden,
  projectPart,
  projectPartPolygon,
  sortPartsByDepth,
  type OrthoView,
} from "../lib/render/geometry";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "previews");
mkdirSync(OUT_DIR, { recursive: true });

const PADDING = 90;
const DIM_OFFSET = 50;
const TITLE_BAR_H = 32;
const VIEW_GAP = 40;

function viewBlock(
  design: FurnitureDesign,
  view: OrthoView,
  title: string,
  titleEn: string,
  arrowId: string,
): { body: string; w: number; h: number } {
  const { overall } = design;
  const w = view === "side" ? overall.width : overall.length;
  const h = view === "top" ? overall.width : overall.thickness;

  const vbW = w + PADDING * 2;
  const vbH = h + PADDING * 2 + DIM_OFFSET + TITLE_BAR_H;

  const drawAreaTop = view === "top" ? -h / 2 : -h;
  const contentDx = PADDING + w / 2;
  const contentDy = view === "top" ? PADDING + TITLE_BAR_H + h / 2 : PADDING + TITLE_BAR_H + h;

  const frameX = -w / 2 - PADDING + 8;
  const frameY = drawAreaTop - PADDING - TITLE_BAR_H + 8;
  const frameW = vbW - 16;
  const frameH = vbH - 16;

  const rects = sortPartsByDepth(design.parts, view)
    .map((p) => {
      const hidden = isPartHidden(p, design.parts, view);
      const stroke = hidden ? "#888" : "#111";
      const strokeW = hidden ? 0.5 : 0.9;
      const dash = hidden ? ` stroke-dasharray="4 3"` : "";
      if (p.shape && p.shape.kind === "tapered" && view !== "top") {
        const poly = projectPartPolygon(p, view);
        const pts = poly.map((pt) => `${pt.x.toFixed(1)},${(-pt.y).toFixed(1)}`).join(" ");
        return `<polygon points="${pts}" fill="none" stroke="${stroke}" stroke-width="${strokeW}"${dash}/>`;
      }
      const r = projectPart(p, view);
      const flipY = view === "top" ? r.y : -r.y - r.h;
      return `<rect x="${r.x.toFixed(1)}" y="${flipY.toFixed(1)}" width="${r.w.toFixed(1)}" height="${r.h.toFixed(1)}" fill="none" stroke="${stroke}" stroke-width="${strokeW}"${dash}/>`;
    })
    .join("\n");

  const frame = `<rect x="${frameX.toFixed(1)}" y="${frameY.toFixed(1)}" width="${frameW.toFixed(1)}" height="${frameH.toFixed(1)}" fill="none" stroke="#222" stroke-width="1"/>`;

  const titleBarY = frameY + TITLE_BAR_H;
  const titleBar = `
<line x1="${frameX.toFixed(1)}" y1="${titleBarY.toFixed(1)}" x2="${(frameX + frameW).toFixed(1)}" y2="${titleBarY.toFixed(1)}" stroke="#222" stroke-width="0.6"/>
<text x="${(frameX + 10).toFixed(1)}" y="${(titleBarY - 10).toFixed(1)}" font-size="13" font-weight="700" fill="#111" font-family="sans-serif">${title}</text>
<text x="${(frameX + 82).toFixed(1)}" y="${(titleBarY - 10).toFixed(1)}" font-size="10" fill="#666" font-family="sans-serif">${titleEn}</text>`;

  const centerLines = `
<g stroke="#888" stroke-width="0.5" stroke-dasharray="8 2 2 2" opacity="0.7">
  <line x1="0" y1="${(drawAreaTop - 10).toFixed(1)}" x2="0" y2="${(drawAreaTop + h + 10).toFixed(1)}"/>
  <line x1="${(-w / 2 - 10).toFixed(1)}" y1="${(drawAreaTop + h / 2).toFixed(1)}" x2="${(w / 2 + 10).toFixed(1)}" y2="${(drawAreaTop + h / 2).toFixed(1)}"/>
</g>`;

  const boundingGhost = `<rect x="${(-w / 2).toFixed(1)}" y="${drawAreaTop.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" fill="none" stroke="#999" stroke-dasharray="3 3" stroke-width="0.5" opacity="0.8"/>`;

  const dimY = drawAreaTop + h + 28;
  const horizontalDim = `
<g stroke="#111" fill="#111" stroke-width="0.6" font-family="sans-serif">
  <line x1="${(-w / 2).toFixed(1)}" y1="${(dimY - 16).toFixed(1)}" x2="${(-w / 2).toFixed(1)}" y2="${(dimY + 8).toFixed(1)}" stroke-width="0.4" stroke="#666"/>
  <line x1="${(w / 2).toFixed(1)}" y1="${(dimY - 16).toFixed(1)}" x2="${(w / 2).toFixed(1)}" y2="${(dimY + 8).toFixed(1)}" stroke-width="0.4" stroke="#666"/>
  <line x1="${(-w / 2).toFixed(1)}" y1="${dimY.toFixed(1)}" x2="${(w / 2).toFixed(1)}" y2="${dimY.toFixed(1)}" marker-start="url(#${arrowId})" marker-end="url(#${arrowId})"/>
  <text x="0" y="${(dimY - 5).toFixed(1)}" text-anchor="middle" font-size="11" stroke="none">${w}</text>
</g>`;

  const vDimTop = view === "top" ? -h / 2 : -h;
  const vDimBot = view === "top" ? h / 2 : 0;
  const verticalDim = `
<g stroke="#111" fill="#111" stroke-width="0.6" font-family="sans-serif">
  <line x1="${(w / 2 + 12).toFixed(1)}" y1="${vDimTop.toFixed(1)}" x2="${(w / 2 + 36).toFixed(1)}" y2="${vDimTop.toFixed(1)}" stroke-width="0.4" stroke="#666"/>
  <line x1="${(w / 2 + 12).toFixed(1)}" y1="${vDimBot.toFixed(1)}" x2="${(w / 2 + 36).toFixed(1)}" y2="${vDimBot.toFixed(1)}" stroke-width="0.4" stroke="#666"/>
  <line x1="${(w / 2 + 28).toFixed(1)}" y1="${vDimTop.toFixed(1)}" x2="${(w / 2 + 28).toFixed(1)}" y2="${vDimBot.toFixed(1)}" marker-start="url(#${arrowId})" marker-end="url(#${arrowId})"/>
  <text x="${(w / 2 + 34).toFixed(1)}" y="${((vDimTop + vDimBot) / 2).toFixed(1)}" text-anchor="start" dominant-baseline="middle" font-size="11" stroke="none">${h}</text>
</g>`;

  const body = `<g transform="translate(${contentDx.toFixed(1)}, ${contentDy.toFixed(1)})">
    ${frame}
    ${titleBar}
    ${centerLines}
    ${boundingGhost}
    ${rects}
    ${horizontalDim}
    ${verticalDim}
  </g>`;

  return { body, w: vbW, h: vbH };
}

function buildPreviewSvg(design: FurnitureDesign): string {
  const front = viewBlock(design, "front", "正視圖", "FRONT VIEW", "arr-front");
  const side = viewBlock(design, "side", "側視圖", "SIDE VIEW", "arr-side");
  const top = viewBlock(design, "top", "俯視圖", "TOP VIEW", "arr-top");

  const rowW = front.w + VIEW_GAP + side.w;
  const rowH = Math.max(front.h, side.h);
  const totalW = Math.max(rowW, top.w);
  const totalH = rowH + VIEW_GAP + top.h + 80;

  // Wrap side & top with own transforms for layout
  const sideShift = `<g transform="translate(${front.w + VIEW_GAP}, 0)">${side.body}</g>`;
  const topShift = `<g transform="translate(0, ${rowH + VIEW_GAP})">${top.body}</g>`;

  const header = `
<text x="${(totalW / 2).toFixed(0)}" y="24" text-anchor="middle" font-size="22" font-weight="700" fill="#111" font-family="sans-serif">${design.nameZh}</text>
<text x="${(totalW / 2).toFixed(0)}" y="46" text-anchor="middle" font-size="12" fill="#666" font-family="sans-serif">${design.overall.length} × ${design.overall.width} × ${design.overall.thickness} mm · ${MATERIALS[design.primaryMaterial].nameZh} · ${design.parts.length} 件零件</text>`;

  const arrowMarkers = ["arr-front", "arr-side", "arr-top"]
    .map(
      (id) =>
        `<marker id="${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#111"/></marker>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="-20 -10 ${totalW + 40} ${totalH + 60}" width="${totalW + 40}">
<defs>${arrowMarkers}</defs>
<rect x="-20" y="-10" width="${totalW + 40}" height="${totalH + 60}" fill="#fafaf7"/>
${header}
<g transform="translate(0, 70)">
  ${front.body}
  ${sideShift}
  ${topShift}
</g>
</svg>`;
}

const VARIANTS: Record<string, Array<{ suffix: string; options: Record<string, string | number | boolean> }>> = {
  "stool": [
    { suffix: "-lower-stretcher", options: { withLowerStretcher: true, legSize: 50 } },
  ],
  "chest-of-drawers": [
    { suffix: "-3x3-legs", options: { drawerRows: 3, drawerCols: 3, legHeight: 100 } },
    { suffix: "-2col", options: { drawerRows: 4, drawerCols: 2 } },
    { suffix: "-tapered-legs", options: { legHeight: 120, legShape: "tapered" } },
    { suffix: "-bracket", options: { legHeight: 140, legShape: "bracket" } },
    { suffix: "-plinth", options: { legHeight: 100, legShape: "plinth" } },
  ],
  "dining-table": [
    { suffix: "-tapered", options: { legShape: "tapered", topOverhang: 60, withLowerStretchers: false } },
  ],
  "dining-chair": [
    { suffix: "-4slats", options: { backSlats: 4 } },
  ],
  "wardrobe": [
    { suffix: "-3doors", options: { doorCount: 3, bottomDrawerCount: 3 } },
    { suffix: "-3drawer-cols", options: { bottomDrawerCount: 2, bottomDrawerCols: 3 } },
  ],
  "shoe-cabinet": [
    { suffix: "-no-legs", options: { legHeight: 0, doorCount: 0 } },
    { suffix: "-tapered", options: { legShape: "tapered" } },
  ],
  "media-console": [
    { suffix: "-3cols", options: { drawerCols: 3, doorCount: 3 } },
    { suffix: "-2x2drawers", options: { drawerRows: 2, drawerCols: 2, drawerHeight: 300, doorCount: 0 } },
    { suffix: "-tapered", options: { legShape: "tapered", legHeight: 150 } },
  ],
  "nightstand": [
    { suffix: "-2drawers", options: { drawerCount: 2, drawerCols: 1, shelfCount: 0 } },
  ],
  "bench": [
    { suffix: "-undershelf", options: { withUnderShelf: true } },
  ],
  "desk": [
    { suffix: "-drawer-right", options: { drawerCount: 2, drawerSide: "right", withCenterStretcher: false } },
    { suffix: "-drawer-left", options: { drawerCount: 3, drawerSide: "left", withCenterStretcher: false } },
  ],
  "tea-table": [
    { suffix: "-tapered", options: { legShape: "tapered" } },
  ],
  "display-cabinet": [
    { suffix: "-tapered", options: { legHeight: 100, legShape: "tapered" } },
  ],
  "open-bookshelf": [
    { suffix: "-legs", options: { legHeight: 100, legShape: "tapered" } },
  ],
};

let count = 0;
for (const entry of FURNITURE_CATALOG) {
  if (!entry.template) continue;
  const baseline = entry.template({
    length: entry.defaults.length,
    width: entry.defaults.width,
    height: entry.defaults.height,
    material: "taiwan-cypress",
  });
  writeFileSync(join(OUT_DIR, `${entry.category}.svg`), buildPreviewSvg(baseline), "utf8");
  console.log(`✓ ${entry.category}.svg (${baseline.parts.length} parts)`);
  count++;

  for (const variant of VARIANTS[entry.category] ?? []) {
    const v = entry.template({
      length: entry.defaults.length,
      width: entry.defaults.width,
      height: entry.defaults.height,
      material: "taiwan-cypress",
      options: variant.options,
    });
    const file = `${entry.category}${variant.suffix}.svg`;
    writeFileSync(join(OUT_DIR, file), buildPreviewSvg(v), "utf8");
    console.log(`  ↳ ${file} (${v.parts.length} parts)`);
    count++;
  }
}
console.log(`\nGenerated ${count} previews in ${OUT_DIR}`);
