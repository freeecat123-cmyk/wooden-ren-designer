/**
 * 中式紋樣庫 — MVP 4 個（per drafting-math.md §U6）
 *
 * 用法：
 *   import { PATTERNS, renderPattern } from "@/lib/design/patterns";
 *   const svg = renderPattern("meander", { width: 200, height: 100 });
 *
 * 輸出 SVG fragment（不含 <svg> 外殼），自己包進：
 *   <svg viewBox="0 0 W H" dangerouslySetInnerHTML={{__html: svg}} />
 *
 * 未來擴充：dragon、vine、bogu、acanthus、turtle、flower、fushou
 */

import { meander, meanderMeta } from "./meander";
import { swastika, swastikaMeta } from "./swastika";
import { ruyi, ruyiQuad, ruyiMeta } from "./ruyi";
import { iceCrack, iceCrackMeta } from "./ice-crack";
import type { PatternGenerator, PatternMeta, PatternOptions } from "./types";

export type { PatternOptions, PatternMeta, PatternGenerator };

export type PatternId = "meander" | "swastika" | "ruyi" | "ruyiQuad" | "iceCrack";

export const PATTERN_META: Record<PatternId, PatternMeta> = {
  meander: meanderMeta,
  swastika: swastikaMeta,
  ruyi: ruyiMeta,
  ruyiQuad: { ...ruyiMeta, id: "ruyiQuad", nameZh: "四合如意", nameEn: "Quad Ruyi" },
  iceCrack: iceCrackMeta,
};

export const PATTERNS: Record<PatternId, PatternGenerator> = {
  meander,
  swastika,
  ruyi,
  ruyiQuad,
  iceCrack,
};

/** 渲染紋樣為 SVG fragment 字串（不含 <svg> 外殼）*/
export function renderPattern(id: PatternId, opts: PatternOptions): string {
  const generator = PATTERNS[id];
  const meta = PATTERN_META[id];
  return generator({ ...meta.defaults, ...opts });
}

/** 渲染為完整 SVG element 字串（含 <svg> 外殼）*/
export function renderPatternSVG(id: PatternId, opts: PatternOptions): string {
  const fragment = renderPattern(id, opts);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${opts.width} ${opts.height}" width="${opts.width}" height="${opts.height}">${fragment}</svg>`;
}
