/**
 * 中式紋樣參數化生成器（per drafting-math.md §U）
 *
 * 每個紋樣是純函數 (opts) => SVGString，回傳 SVG fragment（不含 <svg> 外殼）。
 * 使用方法：把 fragment 包進 <svg viewBox="0 0 W H"> 或 <pattern>。
 *
 * 座標慣例：origin = 左上角 (0, 0)，x 向右、y 向下（SVG 標準）。
 */

export interface PatternOptions {
  /** 紋樣總寬度 (SVG 單位) */
  width: number;
  /** 紋樣總高度 */
  height: number;
  /** 線寬（預設 1.5） */
  strokeWidth?: number;
  /** 線色（預設 #5a3a20 — 木雕褐）*/
  stroke?: string;
  /** 填色（預設 none）*/
  fill?: string;
  /** 紋樣大小（單元邊長 mm，影響密度）*/
  unit?: number;
  /** 隨機種子（only for stochastic patterns like iceCrack）*/
  seed?: number;
}

export interface PatternMeta {
  id: string;
  nameZh: string;
  nameEn: string;
  category: "geometric" | "cloud" | "lattice";
  /** 派系標籤（per §K3）*/
  schools: ("su" | "jing" | "guang" | "hui" | "jin")[];
  defaults: Partial<PatternOptions>;
}

export type PatternGenerator = (opts: PatternOptions) => string;
