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
import type { FurnitureDesign, Part } from "../lib/types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "previews");
mkdirSync(OUT_DIR, { recursive: true });

const PADDING = 80;
const VIEW_GAP = 60;
const TITLE_H = 40;

function projectPart(part: Part, view: "front" | "side" | "top") {
  const { x, y, z } = part.origin;
  const { length, width, thickness } = part.visible;
  if (view === "front") return { x: x - length / 2, y, w: length, h: thickness };
  if (view === "side") return { x: z - width / 2, y, w: width, h: thickness };
  return { x: x - length / 2, y: z - width / 2, w: length, h: width };
}

function viewSvg(
  design: FurnitureDesign,
  view: "front" | "side" | "top",
  title: string,
  offsetX: number,
  offsetY: number,
): { body: string; w: number; h: number } {
  const { overall } = design;
  const w = view === "side" ? overall.width : overall.length;
  const h = view === "top" ? overall.width : overall.thickness;

  const minX = -w / 2 - PADDING;
  const minY = -PADDING - 20;
  const vbW = w + PADDING * 2;
  const vbH = h + PADDING * 2 + 30;

  const rects = design.parts
    .map((p) => {
      const r = projectPart(p, view);
      const flipY = view === "top" ? r.y : h - r.y - r.h;
      return `<rect x="${(r.x).toFixed(1)}" y="${flipY.toFixed(1)}" width="${r.w.toFixed(1)}" height="${r.h.toFixed(1)}" fill="${MATERIALS[p.material].color}" stroke="#3a2a1a" stroke-width="1.2" opacity="0.92"/>`;
    })
    .join("\n");

  // Bounding rectangle + view title
  const frame = `<rect x="${(-w / 2).toFixed(1)}" y="0" width="${w.toFixed(1)}" height="${h.toFixed(1)}" fill="none" stroke="#888" stroke-dasharray="4 3" stroke-width="0.8"/>`;
  const titleEl = `<text x="0" y="${(h + 50).toFixed(1)}" text-anchor="middle" font-size="18" fill="#444" font-family="sans-serif">${title}（${w} × ${h} mm）</text>`;

  // Outer wrapping <g> with viewBox-equivalent translation
  const g = `<g transform="translate(${offsetX - minX}, ${offsetY - minY})">
    ${frame}
    ${rects}
    ${titleEl}
  </g>`;

  return { body: g, w: vbW, h: vbH };
}

function buildPreviewSvg(design: FurnitureDesign): string {
  const front = viewSvg(design, "front", "正視圖", 0, 0);
  const side = viewSvg(design, "side", "側視圖", front.w + VIEW_GAP, 0);
  const top = viewSvg(design, "top", "俯視圖", 0, front.h + VIEW_GAP);

  const totalW = Math.max(front.w + VIEW_GAP + side.w, top.w);
  const totalH = front.h + VIEW_GAP + top.h + TITLE_H;

  const headerY = -10;
  const header = `<text x="${(totalW / 2).toFixed(0)}" y="${headerY}" text-anchor="middle" font-size="24" font-weight="700" fill="#111" font-family="sans-serif">${design.nameZh}</text>
<text x="${(totalW / 2).toFixed(0)}" y="${(headerY + 22).toFixed(0)}" text-anchor="middle" font-size="13" fill="#666" font-family="sans-serif">${design.overall.length} × ${design.overall.width} × ${design.overall.thickness} mm · ${MATERIALS[design.primaryMaterial].nameZh} · ${design.parts.length} 件</text>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="-20 -50 ${totalW + 40} ${totalH + 80}" width="${totalW + 40}" height="${totalH + 80}">
<rect x="-20" y="-50" width="${totalW + 40}" height="${totalH + 80}" fill="#fafaf7"/>
${header}
${front.body}
${side.body}
${top.body}
</svg>`;
}

let count = 0;
for (const entry of FURNITURE_CATALOG) {
  if (!entry.template) continue;
  const design = entry.template({
    length: entry.defaults.length,
    width: entry.defaults.width,
    height: entry.defaults.height,
    material: "taiwan-cypress",
  });
  const svg = buildPreviewSvg(design);
  const out = join(OUT_DIR, `${entry.category}.svg`);
  writeFileSync(out, svg, "utf8");
  console.log(`✓ ${entry.category}.svg (${design.parts.length} parts)`);
  count++;
}
console.log(`\nGenerated ${count} previews in ${OUT_DIR}`);
