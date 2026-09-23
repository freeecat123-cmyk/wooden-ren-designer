/**
 * 階段 2 self-verify: 渲染 4 個 case 的 SVG 成 HTML,playwright 截圖肉眼驗。
 * 跑: npx tsx scripts/preview-ceiling-svg.tsx
 * 產出: /tmp/ceiling-preview.html
 */

import { renderToStaticMarkup } from "react-dom/server";
import { writeFileSync } from "fs";
import React from "react";
import { CeilingOverviewSvg } from "@/lib/ceiling/CeilingOverviewSvg";
import { computeCeilingBom } from "@/lib/ceiling/calc";
import { DEFAULT_CEILING_INPUT } from "@/lib/ceiling/types";

const cases = [
  { name: "baseline 500×320 中置", input: { ...DEFAULT_CEILING_INPUT } },
  { name: "靠左 500×320", input: { ...DEFAULT_CEILING_INPUT, alignmentBase: "left" as const } },
  { name: "靠右 500×320", input: { ...DEFAULT_CEILING_INPUT, alignmentBase: "right" as const } },
  { name: "邊框兼支撐 500×320 中置", input: { ...DEFAULT_CEILING_INPUT, frameDoublesAsSupport: true } },
  { name: "正方形 400×400", input: { ...DEFAULT_CEILING_INPUT, longSideCm: 400, shortSideCm: 400 } },
  { name: "超長條 800×200", input: { ...DEFAULT_CEILING_INPUT, longSideCm: 800, shortSideCm: 200 } },
];

const sections = cases.map((c) => {
  const bom = computeCeilingBom(c.input);
  const svg = renderToStaticMarkup(React.createElement(CeilingOverviewSvg, { bom }));
  return `
    <section style="margin: 24px 0; padding: 16px; border: 1px solid #d4d4d8; border-radius: 8px; background: white;">
      <h2 style="font-size: 14px; color: #1a1a1a; margin: 0 0 8px;">${c.name}</h2>
      <p style="font-size: 11px; color: #71717a; margin: 0 0 12px;">
        L=${c.input.longSideCm} S=${c.input.shortSideCm} | align=${c.input.alignmentBase} | frameDoubles=${c.input.frameDoublesAsSupport}
        | 主支 ${bom.trace.mainJoistCentersCm.length} 位置(${bom.trace.mainJoistTimberCount} 下料)
        | 副支 ${bom.trace.slots.reduce((s, slot) => s + slot.subJoistCount, 0)} 支
      </p>
      ${svg}
    </section>
  `;
});

const html = `<!doctype html>
<html lang="zh-TW">
<head>
  <meta charset="utf-8">
  <title>ceiling SVG preview</title>
  <style>
    body { font-family: -apple-system, sans-serif; background: #fafaf7; padding: 24px; max-width: 1100px; margin: 0 auto; }
    h1 { font-size: 18px; color: #1a1a1a; }
    svg { width: 100%; }
  </style>
</head>
<body>
  <h1>木作天花板骨架俯視 SVG — 階段 2 self-verify</h1>
  ${sections.join("\n")}
</body>
</html>
`;

writeFileSync("/tmp/ceiling-preview.html", html);
console.log("→ /tmp/ceiling-preview.html written");
