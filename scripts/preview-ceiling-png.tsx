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
  { slug: "01-baseline", name: "baseline 500×320 中置", input: { ...DEFAULT_CEILING_INPUT } },
  { slug: "02-align-left", name: "靠左 500×320", input: { ...DEFAULT_CEILING_INPUT, alignmentBase: "left" as const } },
  { slug: "03-align-right", name: "靠右 500×320", input: { ...DEFAULT_CEILING_INPUT, alignmentBase: "right" as const } },
  { slug: "04-frame-doubles", name: "邊框兼支撐 500×320 中置", input: { ...DEFAULT_CEILING_INPUT, frameDoublesAsSupport: true } },
  { slug: "05-square-400", name: "正方形 400×400", input: { ...DEFAULT_CEILING_INPUT, longSideCm: 400, shortSideCm: 400 } },
  { slug: "06-corridor-800x200", name: "超長條 800×200", input: { ...DEFAULT_CEILING_INPUT, longSideCm: 800, shortSideCm: 200 } },
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
