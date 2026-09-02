/**
 * 三視圖「畫出來的圖」接合檢查（不是 3D 座標，是真的把 OrthoView 渲染成 SVG 再量）。
 *
 * 對每款家具 × 腳型 × 新設定（兩向弧肩 / 橫撐弧 / S 形 / 牙條縮進 / 每個勾選框翻轉）：
 *   1. 用榫頭↔榫眼配對找出「應該接在一起」的零件對
 *   2. 正/側/俯三張圖各渲染一次，抓 <g data-part-id> 裡所有線段
 *   3. 量兩個零件在圖上的最短距離；> TOL 就是「圖上接不上」
 *   4. 零件在某張圖完全沒畫出來也記下來
 *
 * NEG_CTL=1 把方凳 apron-front 往 +x 推 30mm，確認抓得到；ONLY=stool,bed 只跑幾款；DEBUG=1 印兩邊 bbox。
 * 跑：npm run audit:2d-joints（全掃約 8~10 分鐘，所以沒接進 `npm run audit` 預設鏈；改三視圖／模板長度後手動跑）
 * 2026-09-02 首跑抓到 7 款 314 條：吧檯椅兩向弧肩腳踏短 13mm、俯視圖只畫腳頂面、衣帽架掛鉤浮在柱頂、
 * 餐椅椅背條榫頭插在座板裡、床倒錐腳楔形縫、錐腳橫撐 0.55/0.6 不一致。依賴 svg-views 每個零件的 <g data-part-id>。
 * 剩下的 7 條＝衣帽架底爪 vs 車旋柱的收腰（1.7mm，共用 LATHE_SEG 不能動，見 §A12）。
 */
import React from "react";
import { renderToString } from "react-dom/server";
import { FURNITURE_CATALOG } from "../lib/templates";
import { applyEdgeProtection } from "../lib/joinery/edge-protection";
import { OrthoView } from "../lib/render/svg-views";
import { buildWorldMortiseIndex, tenonWorld, matchMortiseForTenon } from "../lib/assembly/joint-world";

const TOL = 0.5;
const NEG = !!process.env.NEG_CTL;
const ONLY = process.env.ONLY; // 逗號分隔 category
type Pt = { x: number; y: number };
type Seg = [Pt, Pt];

// ─── SVG 解析 ────────────────────────────────────────────────────────────────
function attr(tag: string, name: string): string | null {
  const m = new RegExp(`\\s${name}="([^"]*)"`).exec(tag);
  return m ? m[1] : null;
}
function applyTransform(pts: Pt[], tf: string | null): Pt[] {
  if (!tf) return pts;
  let out = pts;
  // 支援 translate(a b) / rotate(a cx cy) / scale(a b)，多個由右往左套
  const ops = [...tf.matchAll(/(translate|rotate|scale)\(([^)]*)\)/g)].reverse();
  for (const op of ops) {
    const nums = op[2].split(/[\s,]+/).filter(Boolean).map(Number);
    if (op[1] === "translate") out = out.map(p => ({ x: p.x + (nums[0] ?? 0), y: p.y + (nums[1] ?? 0) }));
    else if (op[1] === "scale") out = out.map(p => ({ x: p.x * (nums[0] ?? 1), y: p.y * (nums[1] ?? nums[0] ?? 1) }));
    else if (op[1] === "rotate") {
      const a = (nums[0] ?? 0) * Math.PI / 180, cx = nums[1] ?? 0, cy = nums[2] ?? 0;
      out = out.map(p => { const dx = p.x - cx, dy = p.y - cy; return { x: cx + dx * Math.cos(a) - dy * Math.sin(a), y: cy + dx * Math.sin(a) + dy * Math.cos(a) }; });
    }
  }
  return out;
}
function parsePath(d: string): Pt[][] {
  const polys: Pt[][] = [];
  let cur: Pt[] = [];
  let x = 0, y = 0, sx = 0, sy = 0;
  const tokens = d.match(/[MmLlHhVvCcSsQqTtAaZz]|-?\d*\.?\d+(?:e-?\d+)?/g) ?? [];
  let i = 0; let cmd = "";
  const num = () => Number(tokens[i++]);
  while (i < tokens.length) {
    const t = tokens[i];
    if (/^[A-Za-z]$/.test(t)) { cmd = t; i++; if (cmd === "Z" || cmd === "z") { if (cur.length) polys.push(cur); cur = []; x = sx; y = sy; continue; } }
    const rel = cmd === cmd.toLowerCase();
    switch (cmd.toUpperCase()) {
      case "M": { const nx = num(), ny = num(); x = rel ? x + nx : nx; y = rel ? y + ny : ny; if (cur.length) polys.push(cur); cur = [{ x, y }]; sx = x; sy = y; cmd = rel ? "l" : "L"; break; }
      case "L": { const nx = num(), ny = num(); x = rel ? x + nx : nx; y = rel ? y + ny : ny; cur.push({ x, y }); break; }
      case "H": { const nx = num(); x = rel ? x + nx : nx; cur.push({ x, y }); break; }
      case "V": { const ny = num(); y = rel ? y + ny : ny; cur.push({ x, y }); break; }
      case "C": { const a = [num(), num(), num(), num(), num(), num()]; const px = x, py = y; const P = (k: number) => rel ? [px + a[k], py + a[k + 1]] : [a[k], a[k + 1]];
        // 用 8 段折線近似
        const [x1, y1] = P(0), [x2, y2] = P(2), [x3, y3] = P(4);
        for (let s = 1; s <= 8; s++) { const u = s / 8, v = 1 - u; cur.push({ x: v*v*v*px + 3*v*v*u*x1 + 3*v*u*u*x2 + u*u*u*x3, y: v*v*v*py + 3*v*v*u*y1 + 3*v*u*u*y2 + u*u*u*y3 }); }
        x = x3; y = y3; break; }
      case "S": { const a = [num(), num(), num(), num()]; x = rel ? x + a[2] : a[2]; y = rel ? y + a[3] : a[3]; cur.push({ x, y }); break; }
      case "Q": { const a = [num(), num(), num(), num()]; const px = x, py = y; const x1 = rel ? px + a[0] : a[0], y1 = rel ? py + a[1] : a[1], x2 = rel ? px + a[2] : a[2], y2 = rel ? py + a[3] : a[3];
        for (let s = 1; s <= 8; s++) { const u = s / 8, v = 1 - u; cur.push({ x: v*v*px + 2*v*u*x1 + u*u*x2, y: v*v*py + 2*v*u*y1 + u*u*y2 }); }
        x = x2; y = y2; break; }
      case "T": { const a = [num(), num()]; x = rel ? x + a[0] : a[0]; y = rel ? y + a[1] : a[1]; cur.push({ x, y }); break; }
      case "A": { const a = [num(), num(), num(), num(), num(), num(), num()]; x = rel ? x + a[5] : a[5]; y = rel ? y + a[6] : a[6]; cur.push({ x, y }); break; }
      default: i++; // 不認得就跳
    }
  }
  if (cur.length) polys.push(cur);
  return polys;
}
/** 一個 <g data-part-id> 區塊裡所有幾何 → 線段集合 */
function chunkSegments(chunk: string): Seg[] {
  const segs: Seg[] = [];
  const addPoly = (pts: Pt[], closed: boolean) => {
    if (pts.length === 1) { segs.push([pts[0], pts[0]]); return; }
    for (let k = 0; k + 1 < pts.length; k++) segs.push([pts[k], pts[k + 1]]);
    if (closed && pts.length > 2) segs.push([pts[pts.length - 1], pts[0]]);
  };
  for (const m of chunk.matchAll(/<(polygon|polyline|rect|path|circle|line|ellipse)\b[^>]*>/g)) {
    const tag = m[0]; const kind = m[1]; const tf = attr(tag, "transform");
    if (kind === "polygon" || kind === "polyline") {
      const nums = (attr(tag, "points") ?? "").split(/[\s,]+/).filter(Boolean).map(Number);
      const pts: Pt[] = []; for (let k = 0; k + 1 < nums.length; k += 2) pts.push({ x: nums[k], y: nums[k + 1] });
      addPoly(applyTransform(pts, tf), kind === "polygon");
    } else if (kind === "rect") {
      const x = +(attr(tag, "x") ?? 0), y = +(attr(tag, "y") ?? 0), w = +(attr(tag, "width") ?? 0), h = +(attr(tag, "height") ?? 0);
      addPoly(applyTransform([{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }], tf), true);
    } else if (kind === "line") {
      addPoly(applyTransform([{ x: +(attr(tag, "x1") ?? 0), y: +(attr(tag, "y1") ?? 0) }, { x: +(attr(tag, "x2") ?? 0), y: +(attr(tag, "y2") ?? 0) }], tf), false);
    } else if (kind === "circle" || kind === "ellipse") {
      const cx = +(attr(tag, "cx") ?? 0), cy = +(attr(tag, "cy") ?? 0);
      const rx = +(attr(tag, kind === "circle" ? "r" : "rx") ?? 0), ry = +(attr(tag, kind === "circle" ? "r" : "ry") ?? 0);
      const pts: Pt[] = []; for (let k = 0; k < 24; k++) { const a = k / 24 * Math.PI * 2; pts.push({ x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) }); }
      addPoly(applyTransform(pts, tf), true);
    } else if (kind === "path") {
      for (const poly of parsePath(attr(tag, "d") ?? "")) addPoly(applyTransform(poly, tf), /[Zz]/.test(attr(tag, "d") ?? ""));
    }
  }
  return segs;
}
/** 把 svg 字串切成 partId → 區塊（處理巢狀 <g>） */
function partChunks(svg: string): Map<string, string> {
  const out = new Map<string, string>();
  // 單一元素直接掛 data-part-id（polygon / circle 沒包 <g>）
  for (const m of svg.matchAll(/<(polygon|circle|rect|path|ellipse|line)\b[^>]*data-part-id="([^"]+)"[^>]*>/g)) out.set(m[2], (out.get(m[2]) ?? "") + m[0]);
  const re = /<g data-part-id="([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(svg))) {
    let depth = 0; let i = m.index; const tagRe = /<\/?g\b/g; tagRe.lastIndex = i;
    let t: RegExpExecArray | null; let end = svg.length;
    while ((t = tagRe.exec(svg))) { if (t[0] === "<g") depth++; else { depth--; if (depth === 0) { end = t.index; break; } } }
    const id = m[1];
    out.set(id, (out.get(id) ?? "") + svg.slice(m.index, end));
  }
  return out;
}
// ─── 幾何 ────────────────────────────────────────────────────────────────────
function segDist(a: Seg, b: Seg): number {
  // 線段對線段最短距離（2D）
  const cross = (o: Pt, p: Pt, q: Pt) => (p.x - o.x) * (q.y - o.y) - (p.y - o.y) * (q.x - o.x);
  const inter = () => {
    const d1 = cross(b[0], b[1], a[0]), d2 = cross(b[0], b[1], a[1]), d3 = cross(a[0], a[1], b[0]), d4 = cross(a[0], a[1], b[1]);
    return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0));
  };
  if (inter()) return 0;
  const pd = (p: Pt, s: Seg) => {
    const dx = s[1].x - s[0].x, dy = s[1].y - s[0].y; const L2 = dx * dx + dy * dy;
    let t = L2 === 0 ? 0 : ((p.x - s[0].x) * dx + (p.y - s[0].y) * dy) / L2; t = Math.max(0, Math.min(1, t));
    return Math.hypot(p.x - (s[0].x + t * dx), p.y - (s[0].y + t * dy));
  };
  return Math.min(pd(a[0], b), pd(a[1], b), pd(b[0], a), pd(b[1], a));
}
function bbox(segs: Seg[]) { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const s of segs) for (const p of s) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); } return { x0, y0, x1, y1 }; }
function hull(pts: Pt[]): Pt[] {
  const P = [...pts].sort((a, b) => a.x - b.x || a.y - b.y);
  if (P.length < 3) return P;
  const cr = (o: Pt, a: Pt, b: Pt) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lo: Pt[] = []; for (const p of P) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  const up: Pt[] = []; for (const p of P.reverse()) { while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}
function inHull(p: Pt, h: Pt[]): boolean {
  if (h.length < 3) return false;
  let sgn = 0;
  for (let i = 0; i < h.length; i++) { const a = h[i], b = h[(i + 1) % h.length]; const c = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x); if (Math.abs(c) < 1e-9) continue; const s = c > 0 ? 1 : -1; if (sgn === 0) sgn = s; else if (s !== sgn) return false; }
  return true;
}
/** 一個零件被另一個零件的輪廓整個包住（例：橫撐端面藏在腳後面的虛線方塊）→ 視為接上 */
function contained(A: Seg[], B: Seg[]): boolean {
  const hb = hull(B.flat()); const ha = hull(A.flat());
  return A.some(s => inHull(s[0], hb)) || B.some(s => inHull(s[0], ha));
}
function setDist(A: Seg[], B: Seg[]): number {
  if (contained(A, B)) return 0;
  const ba = bbox(A), bb = bbox(B);
  // bbox 先粗篩：bbox 距離 > 200 就不用細算（一定 > TOL）
  const bx = Math.max(0, bb.x0 - ba.x1, ba.x0 - bb.x1), by = Math.max(0, bb.y0 - ba.y1, ba.y0 - bb.y1);
  if (Math.hypot(bx, by) > 200) return Math.hypot(bx, by);
  let best = Infinity;
  for (const a of A) for (const b of B) { const d = segDist(a, b); if (d < best) { best = d; if (best === 0) return 0; } }
  return best;
}
// ─── 變體 ────────────────────────────────────────────────────────────────────
function variantsFor(e: any): [string, any][] {
  const specs = (e.optionSchema ?? []) as any[];
  const base: any = specs.reduce((a: any, s: any) => ((a[s.key] = s.defaultValue), a), {});
  const out: [string, any][] = [["預設", base]];
  const ls = specs.find((s) => s.key === "legShape");
  const hasCT = !!ls?.choices?.some((c: any) => c.value === "curved-taper");
  if (ls) for (const c of ls.choices ?? []) if (c.value !== ls.defaultValue) out.push([`legShape=${c.value}`, { ...base, legShape: c.value }]);
  if (hasCT) {
    const ct = { ...base, legShape: "curved-taper" };
    out.push(["弧肩+兩向", { ...ct, ctTwoWay: true }]);
    if (specs.some((s) => s.key === "ctLowerCove")) {
      out.push(["弧肩+橫撐弧", { ...ct, ctLowerCove: true }]);
      out.push(["弧肩+兩向+橫撐弧", { ...ct, ctTwoWay: true, ctLowerCove: true }]);
    }
    if (specs.some((s) => s.key === "ctShoulderCurve")) {
      out.push(["弧肩+S形", { ...ct, ctShoulderCurve: "s-curve" }]);
      out.push(["弧肩+S形+兩向+橫撐弧", { ...ct, ctShoulderCurve: "s-curve", ctTwoWay: true, ctLowerCove: true }]);
    }
    if (specs.some((s) => s.key === "ctSplay")) out.push(["弧肩+外斜8+兩向", { ...ct, ctSplay: 8, ctTwoWay: true }]);
    for (const k of ["ctBlockHeight", "ctShoulder", "ctInset"]) { const s = specs.find((x) => x.key === k); if (s) { out.push([`弧肩 ${k}=${s.min}`, { ...ct, ctTwoWay: true, [k]: s.min }]); out.push([`弧肩 ${k}=${s.max}`, { ...ct, ctTwoWay: true, [k]: s.max }]); } }
  }
  const sb = specs.find((s) => s.key === "apronSetback");
  if (sb) { for (const v of [sb.min, sb.max]) { out.push([`apronSetback=${v}`, { ...base, apronSetback: v }]); if (hasCT) out.push([`弧肩+apronSetback=${v}`, { ...base, legShape: "curved-taper", apronSetback: v }]); } }
  for (const s of specs) if ((s.type === "checkbox" || s.type === "boolean") && !/^ct/.test(s.key)) out.push([`${s.key}=${!s.defaultValue}`, { ...base, [s.key]: !s.defaultValue }]);
  return out;
}
// ─── 主程式 ──────────────────────────────────────────────────────────────────
const gaps: string[] = []; const missing: string[] = []; const errors: string[] = [];
let pairsChecked = 0, designs = 0;
const VIEWS = ["front", "side", "top"] as const;
for (const e of FURNITURE_CATALOG as any[]) {
  if (!e.template) continue;
  if (ONLY && !ONLY.split(",").includes(e.category)) continue;
  for (const [tag, o] of variantsFor(e)) {
    let d: any;
    try { d = applyEdgeProtection(e.template({ length: e.defaults.length, width: e.defaults.width, height: e.defaults.height, material: "maple", options: o })); }
    catch (err: any) { errors.push(`${e.category} [${tag}] template 炸: ${err?.message}`); continue; }
    if (NEG && e.category === "stool" && tag === "預設") {
      const p = d.parts.find((p: any) => p.id === "apron-front"); if (p) p.origin = { ...p.origin, x: p.origin.x + 30 };
    }
    designs++;
    // 配對
    const index = buildWorldMortiseIndex(d.parts);
    const pairs = new Map<string, [string, string]>();
    for (const p of d.parts) for (const t of p.tenons ?? []) {
      let mw: any = null; try { mw = matchMortiseForTenon(p, t, tenonWorld(p, t), index); } catch {}
      if (mw) pairs.set([p.id, mw.partId].sort().join("|"), [p.id, mw.partId]);
    }
    if (!pairs.size) continue;
    for (const view of VIEWS) {
      let svg = "";
      try { svg = renderToString(React.createElement(OrthoView as any, { design: d, view, title: "", titleEn: "", joineryMode: false, showDimensions: false })); }
      catch (err: any) { errors.push(`${e.category} [${tag}] ${view} 渲染炸: ${err?.message?.slice(0, 120)}`); continue; }
      const chunks = partChunks(svg);
      const segCache = new Map<string, Seg[]>();
      const segsOf = (id: string) => { if (!segCache.has(id)) segCache.set(id, chunkSegments(chunks.get(id) ?? "")); return segCache.get(id)!; };
      for (const [a, b] of pairs.values()) {
        const A = segsOf(a), B = segsOf(b);
        if (!A.length || !B.length) { missing.push(`${e.category} [${tag}] ${view}: ${!A.length ? a : b} 沒畫出來`); continue; }
        pairsChecked++;
        const dist = setDist(A, B);
        if (dist > TOL && process.env.DEBUG) { const ba = bbox(A), bb = bbox(B); console.log(`DBG ${e.category} [${tag}] ${view} ${a} bbox=${[ba.x0,ba.y0,ba.x1,ba.y1].map(v=>v.toFixed(1))} (${A.length}段) | ${b} bbox=${[bb.x0,bb.y0,bb.x1,bb.y1].map(v=>v.toFixed(1))} (${B.length}段)`); }
        if (dist > TOL) gaps.push(`${e.category} [${tag}] ${view}: ${a} ↔ ${b} 圖上差 ${dist.toFixed(1)}mm`);
      }
    }
  }
}
console.log(`掃了 ${designs} 個設計 / ${pairsChecked} 個接合×視圖`);
const uniq = (arr: string[]) => [...new Set(arr)];
console.log(`\n圖上接不上（> ${TOL}mm）：${uniq(gaps).length}`); for (const g of uniq(gaps)) console.log("  ❌ " + g);
console.log(`\n零件沒畫出來：${uniq(missing).length}`); for (const g of uniq(missing).slice(0, 60)) console.log("  ⚠️ " + g);
if (uniq(missing).length > 60) console.log(`  …還有 ${uniq(missing).length - 60} 條`);
console.log(`\n炸掉：${errors.length}`); for (const g of errors) console.log("  💥 " + g);
process.exit(gaps.length ? 1 : 0);
