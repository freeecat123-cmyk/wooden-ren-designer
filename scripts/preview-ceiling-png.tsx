/**
 * 用 sharp 把 6 個 case 的 SVG 直接出 PNG,給肉眼驗證。
 * 跑: npx tsx scripts/preview-ceiling-png.tsx
 * 產出: /tmp/ceiling-case-*.png
 */

import { renderToStaticMarkup } from "react-dom/server";
import { writeFileSync } from "fs";
import React from "react";
import sharp from "sharp";
import { CeilingOverviewSvg } from "@/lib/ceiling/CeilingOverviewSvg";
import { computeCeilingBom } from "@/lib/ceiling/calc";
import { DEFAULT_CEILING_INPUT } from "@/lib/ceiling/types";

const cases = [
  { slug: "01-baseline", name: "baseline 500×320 主中/副中", input: { ...DEFAULT_CEILING_INPUT } },
  { slug: "02-align-left", name: "主靠左 / 副置中", input: { ...DEFAULT_CEILING_INPUT, alignmentBase: "left" as const } },
  { slug: "03-align-right", name: "主靠右 / 副置中", input: { ...DEFAULT_CEILING_INPUT, alignmentBase: "right" as const } },
  { slug: "04-sub-top", name: "副支靠上 / 主置中", input: { ...DEFAULT_CEILING_INPUT, subAlignmentBase: "top" as const } },
  { slug: "05-sub-bottom", name: "副支靠下 / 主置中", input: { ...DEFAULT_CEILING_INPUT, subAlignmentBase: "bottom" as const } },
  { slug: "06-frame-doubles", name: "邊框兼支撐 + 副置中", input: { ...DEFAULT_CEILING_INPUT, frameDoublesAsSupport: true } },
];

(async () => {
  for (const c of cases) {
    const bom = computeCeilingBom(c.input);
    let svg = renderToStaticMarkup(React.createElement(CeilingOverviewSvg, { bom }));
    // 把 className 與既有 style 拿掉(sharp 不認 tailwind),改塞固定值
    svg = svg.replace(/class="[^"]*"/g, "");
    svg = svg.replace(/style="[^"]*"/g, "");
    const svgWithBg = svg.replace(
      /<svg /,
      '<svg width="1000" style="background:#fafaf7" '
    );
    writeFileSync(`/tmp/ceiling-${c.slug}.svg`, svgWithBg);
    await sharp(Buffer.from(svgWithBg))
      .png()
      .toFile(`/tmp/ceiling-${c.slug}.png`);
    console.log(`✓ /tmp/ceiling-${c.slug}.png — ${c.name} (主支位置 ${bom.trace.mainJoistCentersCm.length} / 副支 ${bom.trace.slots.reduce((s, slot) => s + slot.subJoistCount, 0)})`);
  }
})();
