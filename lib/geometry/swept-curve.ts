/**
 * swept-curve — 沿空間曲線放樣的實木曲料（圈椅椅圈／鵝脖／聯幫棍／S 形靠背板）。
 *
 * 單一真相來源：3D 網格（part-geometry.ts）、三視圖輪廓（geometry.ts）、榫頭端點
 * （joint-world.ts）與模板（circle-chair.ts）全部吃這裡同一份 `sampleCenterline` /
 * `sweptSurfaceRings` 的輸出，曲線只算一次，3D 跟三視圖不會對不上。
 *
 * 公式出處（docs/drafting-math.md）：
 *   §S2  clamped cubic B-spline（Cox–de Boor）
 *   §S5  adaptive flattening，ε = 0.1mm
 *   §S7  圈椅椅圈＝clamped cubic B-spline 繞圓心橢圓化
 *   §S8  Sweep：surface(u,v) = path(v) + frame(v)·profile(u)
 *   §A9  非 90° 零件的 silhouette 要用 3D 採樣投影，不能用 AABB
 *
 * 座標慣例：控制點在 **part-local、以 AABB 中心為原點** 的座標（mm），y 上 z 後 x 寬
 * （code 慣例）。swept-curve 零件一律 `rotation = 0`——曲線本身已經是世界方向，
 * 由 `sweptPartFromWorldPoints` 把世界座標的曲線搬進 local 並算出 visible / origin。
 *
 * 純函式，無 three.js / React 依賴。
 */

export type Vec3 = { x: number; y: number; z: number };
export type Vec2 = { x: number; y: number };

export type SweptProfile =
  /** 圓料：半徑沿弧長線性從 radiusStart 變到 radiusEnd（鵝脖、聯幫棍、後腿）。 */
  | { type: "round"; radiusStart: number; radiusEnd: number }
  /**
   * 矩形斷面（椅圈、靠背板）：width 沿 N 軸、thickness 沿 B 軸。
   * - widthStart / widthEnd 線性；給 widthMid 則走三點二次曲線（椅圈後正中最寬）。
   * - thicknessAlong：厚度軸鎖世界軸（椅圈厚度永遠垂直 → "y"）。
   * - widthAlong：寬度軸鎖世界軸（靠背板板寬永遠橫向 → "x"）。
   *   兩者擇一；都不給 → thicknessAlong "y"。
   * - cornerR：斷面四角導圓（椅圈 §S6 皮條線的簡化）。
   */
  | {
      type: "rect";
      widthStart: number;
      widthEnd: number;
      widthMid?: number;
      thickness: number;
      cornerR?: number;
      thicknessAlong?: "x" | "y" | "z";
      widthAlong?: "x" | "y" | "z";
    };

export type SweptCurveShape = {
  kind: "swept-curve";
  /** clamped cubic B-spline 控制點（part-local，mm） */
  controlPoints: Vec3[];
  /** clamped knot vector（長度 = 控制點數 + degree + 1）；省略 = 均勻 clamped */
  knots?: number[];
  profile: SweptProfile;
  /** 中心線取樣上限（預設 400）；adaptive flatten 先跑，超過才退回均勻取樣 */
  segments?: number;
};

export const SWEPT_FLATTEN_EPS_MM = 0.1; // §S5
const DEFAULT_MAX_SAMPLES = 400;
const ROUND_PROFILE_SEGS = 24;
const CORNER_SEGS = 8;

// ─── 向量 ─────────────────────────────────────────────────────────────────────
const add = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const mul = (a: Vec3, k: number): Vec3 => ({ x: a.x * k, y: a.y * k, z: a.z * k });
const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
const len = (a: Vec3): number => Math.hypot(a.x, a.y, a.z);
const norm = (a: Vec3): Vec3 => {
  const l = len(a);
  return l > 1e-12 ? mul(a, 1 / l) : { x: 0, y: 0, z: 0 };
};
const AXIS: Record<"x" | "y" | "z", Vec3> = {
  x: { x: 1, y: 0, z: 0 },
  y: { x: 0, y: 1, z: 0 },
  z: { x: 0, y: 0, z: 1 },
};

// ─── §S2 B-spline ─────────────────────────────────────────────────────────────
export function bsplineDegree(n: number): number {
  return Math.max(1, Math.min(3, n - 1));
}

/** 均勻 clamped knot vector（頭尾各重複 p+1 次 → 經過首尾控制點） */
export function clampedUniformKnots(n: number, p: number): number[] {
  const m = n + p + 1;
  const U: number[] = [];
  const inner = n - p - 1; // 內部 knot 數
  for (let i = 0; i < m; i++) {
    if (i <= p) U.push(0);
    else if (i >= m - p - 1) U.push(1);
    else U.push((i - p) / (inner + 1));
  }
  return U;
}

function findSpan(n: number, p: number, u: number, U: number[]): number {
  // n = 控制點數 − 1
  if (u >= U[n + 1]) return n;
  if (u <= U[p]) return p;
  let lo = p, hi = n + 1;
  let mid = (lo + hi) >> 1;
  while (u < U[mid] || u >= U[mid + 1]) {
    if (u < U[mid]) hi = mid; else lo = mid;
    mid = (lo + hi) >> 1;
  }
  return mid;
}

function basisFuns(span: number, u: number, p: number, U: number[]): number[] {
  const N = new Array<number>(p + 1).fill(0);
  const left = new Array<number>(p + 1).fill(0);
  const right = new Array<number>(p + 1).fill(0);
  N[0] = 1;
  for (let j = 1; j <= p; j++) {
    left[j] = u - U[span + 1 - j];
    right[j] = U[span + j] - u;
    let saved = 0;
    for (let r = 0; r < j; r++) {
      const denom = right[r + 1] + left[j - r];
      const temp = denom !== 0 ? N[r] / denom : 0;
      N[r] = saved + right[r + 1] * temp;
      saved = left[j - r] * temp;
    }
    N[j] = saved;
  }
  return N;
}

export function evalBSpline(cps: Vec3[], knots: number[] | undefined, u: number): Vec3 {
  const n = cps.length - 1;
  if (n < 0) return { x: 0, y: 0, z: 0 };
  if (n === 0) return { ...cps[0] };
  const p = bsplineDegree(cps.length);
  const U = knots ?? clampedUniformKnots(cps.length, p);
  const uu = Math.min(1, Math.max(0, u));
  const span = findSpan(n, p, uu, U);
  const N = basisFuns(span, uu, p, U);
  const out: Vec3 = { x: 0, y: 0, z: 0 };
  for (let i = 0; i <= p; i++) {
    const c = cps[span - p + i];
    out.x += N[i] * c.x; out.y += N[i] * c.y; out.z += N[i] * c.z;
  }
  return out;
}

/**
 * 全域內插（Piegl & Tiller A9.1）：給「曲線要經過的點」，回傳經過它們的 clamped
 * cubic B-spline 控制點 + knot。模板端只管畫「曲線經過哪裡」（鵝脖從腳頂到椅圈底
 * 要經過哪幾個位置），不用手調控制多邊形。
 */
export function interpolateBSpline(points: Vec3[]): { controlPoints: Vec3[]; knots: number[] } {
  const n = points.length - 1;
  if (n < 1) return { controlPoints: points.map((p) => ({ ...p })), knots: [0, 1] };
  const p = bsplineDegree(points.length);
  // chord-length 參數化
  const ub: number[] = [0];
  let d = 0;
  for (let k = 1; k <= n; k++) d += len(sub(points[k], points[k - 1]));
  for (let k = 1; k <= n; k++) ub.push(ub[k - 1] + len(sub(points[k], points[k - 1])) / (d || 1));
  ub[n] = 1;
  // knot 取平均
  const m = n + p + 1;
  const U = new Array<number>(m + 1).fill(0);
  for (let i = m - p; i <= m; i++) U[i] = 1;
  for (let j = 1; j <= n - p; j++) {
    let s = 0;
    for (let i = j; i <= j + p - 1; i++) s += ub[i];
    U[j + p] = s / p;
  }
  // A · P = Q
  const A: number[][] = [];
  for (let k = 0; k <= n; k++) {
    const row = new Array<number>(n + 1).fill(0);
    const span = findSpan(n, p, ub[k], U);
    const N = basisFuns(span, ub[k], p, U);
    for (let i = 0; i <= p; i++) row[span - p + i] = N[i];
    A.push(row);
  }
  const solve = (rhs: number[]): number[] => {
    const M = A.map((r, i) => [...r, rhs[i]]);
    const N1 = n + 1;
    for (let c = 0; c < N1; c++) {
      let piv = c;
      for (let r = c + 1; r < N1; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
      if (piv !== c) [M[c], M[piv]] = [M[piv], M[c]];
      const pv = M[c][c] || 1e-12;
      for (let r = c + 1; r < N1; r++) {
        const f = M[r][c] / pv;
        if (f === 0) continue;
        for (let k = c; k <= N1; k++) M[r][k] -= f * M[c][k];
      }
    }
    const x = new Array<number>(N1).fill(0);
    for (let r = N1 - 1; r >= 0; r--) {
      let s = M[r][N1];
      for (let k = r + 1; k < N1; k++) s -= M[r][k] * x[k];
      x[r] = s / (M[r][r] || 1e-12);
    }
    return x;
  };
  const xs = solve(points.map((q) => q.x));
  const ys = solve(points.map((q) => q.y));
  const zs = solve(points.map((q) => q.z));
  return { controlPoints: xs.map((x, i) => ({ x, y: ys[i], z: zs[i] })), knots: U };
}

/**
 * 帶端切線的全域內插（Piegl & Tiller 9.2.2）：多兩個控制點吃 C'(0)=D₀、C'(1)=Dₙ，
 * 曲線仍然經過每個點。切線大小取總弦長（chord-length 參數化下 |C'| ≈ d）。
 * 榫頭端面要水平貼母件 → 端切線鎖垂直；用「推第二個控制點」的做法會把 S 形壓扁，這支不會。
 */
export function interpolateBSplineWithTangents(points: Vec3[], t0: Vec3, tn: Vec3): { controlPoints: Vec3[]; knots: number[] } {
  const n = points.length - 1;
  const p = 3;
  if (n < 2) return interpolateBSpline(points);
  const ub: number[] = [0];
  let d = 0;
  for (let k = 1; k <= n; k++) d += len(sub(points[k], points[k - 1]));
  for (let k = 1; k <= n; k++) ub.push(ub[k - 1] + len(sub(points[k], points[k - 1])) / (d || 1));
  ub[n] = 1;
  const cnt = n + 3;            // 控制點數
  const m = cnt + p;            // 最後一個 knot 的索引
  const U = new Array<number>(m + 1).fill(0);
  for (let i = m - p; i <= m; i++) U[i] = 1;
  for (let j = 0; j <= n - 2; j++) U[j + p + 1] = (ub[j] + ub[j + 1] + ub[j + 2]) / p;
  const D0 = mul(norm(t0), d), Dn = mul(norm(tn), d);
  const P: Vec3[] = new Array(cnt);
  P[0] = { ...points[0] };
  P[1] = add(points[0], mul(D0, U[p + 1] / p));
  P[cnt - 1] = { ...points[n] };
  P[cnt - 2] = sub(points[n], mul(Dn, (1 - U[m - p - 1]) / p));
  // 未知 P_2..P_n，由 Q_1..Q_{n-1} 決定
  const unknown = n - 1;
  const nCtl = cnt - 1;
  const A: number[][] = [];
  const rhs: Vec3[] = [];
  for (let k = 1; k <= n - 1; k++) {
    const span = findSpan(nCtl, p, ub[k], U);
    const N = basisFuns(span, ub[k], p, U);
    const row = new Array<number>(unknown).fill(0);
    let r: Vec3 = { ...points[k] };
    for (let i = 0; i <= p; i++) {
      const idx = span - p + i;
      if (idx >= 2 && idx <= n) row[idx - 2] = N[i];
      else r = sub(r, mul(P[idx], N[i]));
    }
    A.push(row);
    rhs.push(r);
  }
  const solve = (b: number[]): number[] => {
    const M = A.map((row, i) => [...row, b[i]]);
    for (let c = 0; c < unknown; c++) {
      let piv = c;
      for (let r = c + 1; r < unknown; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
      if (piv !== c) [M[c], M[piv]] = [M[piv], M[c]];
      const pv = M[c][c] || 1e-12;
      for (let r = c + 1; r < unknown; r++) {
        const f = M[r][c] / pv;
        if (f === 0) continue;
        for (let k = c; k <= unknown; k++) M[r][k] -= f * M[c][k];
      }
    }
    const x = new Array<number>(unknown).fill(0);
    for (let r = unknown - 1; r >= 0; r--) {
      let s = M[r][unknown];
      for (let k = r + 1; k < unknown; k++) s -= M[r][k] * x[k];
      x[r] = s / (M[r][r] || 1e-12);
    }
    return x;
  };
  const xs = solve(rhs.map((q) => q.x)), ys = solve(rhs.map((q) => q.y)), zs = solve(rhs.map((q) => q.z));
  for (let i = 0; i < unknown; i++) P[i + 2] = { x: xs[i], y: ys[i], z: zs[i] };
  return { controlPoints: P, knots: U };
}

// ─── §S5 取樣 ─────────────────────────────────────────────────────────────────
export type CenterlineSample = {
  /** 曲線上的點（part-local） */
  points: Vec3[];
  /** 單位切線（沿曲線前進方向） */
  tangents: Vec3[];
  /** 各點參數 u */
  us: number[];
  /** 累積弧長（mm），points[i] 對應 s[i] */
  s: number[];
};

function chordHeight(a: Vec3, b: Vec3, m: Vec3): number {
  const ab = sub(b, a);
  const L = len(ab);
  if (L < 1e-9) return len(sub(m, a));
  return len(cross(sub(m, a), ab)) / L;
}

/**
 * 中心線取樣：先依 knot span 切基本區間，再遞迴細分到弦高 < ε（§S5）。
 * 超過 segments 上限則退回均勻取樣（形狀不變只是粗一點，不會炸）。
 */
export function sampleCenterline(shape: SweptCurveShape, eps = SWEPT_FLATTEN_EPS_MM): CenterlineSample {
  const cps = shape.controlPoints;
  const maxN = Math.max(8, shape.segments ?? DEFAULT_MAX_SAMPLES);
  if (cps.length === 0) return { points: [], tangents: [], us: [], s: [] };
  if (cps.length === 1) {
    return { points: [{ ...cps[0] }], tangents: [{ x: 0, y: 1, z: 0 }], us: [0], s: [0] };
  }
  const p = bsplineDegree(cps.length);
  const U = shape.knots ?? clampedUniformKnots(cps.length, p);
  const ev = (u: number) => evalBSpline(cps, U, u);
  // 基本區間：不重複的 knot
  const breaks: number[] = [];
  for (const u of U) if (breaks.length === 0 || u > breaks[breaks.length - 1] + 1e-12) breaks.push(u);
  if (breaks[0] > 0) breaks.unshift(0);
  if (breaks[breaks.length - 1] < 1) breaks.push(1);
  const us: number[] = [];
  let overflow = false;
  const rec = (ua: number, ub: number, pa: Vec3, pb: Vec3, depth: number) => {
    if (overflow) return;
    const um = (ua + ub) / 2;
    const pm = ev(um);
    const uq1 = (ua + um) / 2, uq3 = (um + ub) / 2;
    const pq1 = ev(uq1), pq3 = ev(uq3);
    const flat =
      chordHeight(pa, pb, pm) < eps &&
      chordHeight(pa, pm, pq1) < eps &&
      chordHeight(pm, pb, pq3) < eps;
    if (flat || depth >= 12) {
      us.push(ub);
      if (us.length > maxN) overflow = true;
      return;
    }
    rec(ua, um, pa, pm, depth + 1);
    rec(um, ub, pm, pb, depth + 1);
  };
  us.push(breaks[0]);
  for (let i = 0; i + 1 < breaks.length; i++) {
    const ua = breaks[i], ub = breaks[i + 1];
    // 每個 knot span 至少切 4 段，避免對稱曲線在中點/四分點剛好量不到弦高
    const base = 4;
    let prevU = ua, prevP = ev(ua);
    for (let k = 1; k <= base; k++) {
      const u = ua + ((ub - ua) * k) / base;
      const pt = ev(u);
      rec(prevU, u, prevP, pt, 0);
      prevU = u; prevP = pt;
    }
  }
  let finalUs = us;
  if (overflow) {
    finalUs = [];
    for (let i = 0; i <= maxN; i++) finalUs.push(i / maxN);
  }
  const points = finalUs.map(ev);
  const tangents: Vec3[] = points.map((pt, i) => {
    const h = 1e-4;
    const u = finalUs[i];
    const a = ev(Math.max(0, u - h));
    const b = ev(Math.min(1, u + h));
    const t = norm(sub(b, a));
    if (len(t) > 0) return t;
    // 退化（重疊控制點）：用相鄰取樣點
    const prev = points[Math.max(0, i - 1)], next = points[Math.min(points.length - 1, i + 1)];
    return norm(sub(next, prev));
  });
  const s: number[] = [0];
  for (let i = 1; i < points.length; i++) s.push(s[i - 1] + len(sub(points[i], points[i - 1])));
  return { points, tangents, us: finalUs, s };
}

// ─── Frame（T, N, B）──────────────────────────────────────────────────────────
export type Frame = { T: Vec3; N: Vec3; B: Vec3 };

/**
 * 每個取樣點的正交框架。T = 切線；
 * - rect + thicknessAlong：B 鎖該世界軸（投影到 ⊥T），N = B × T
 * - rect + widthAlong：N 鎖該世界軸（投影到 ⊥T），B = T × N
 * - round／退化：parallel transport（法線沿曲線平移不扭轉）
 * 三者都滿足 N × B = T（右手系）。
 */
export function sweptFrames(sample: CenterlineSample, profile: SweptProfile): Frame[] {
  const out: Frame[] = [];
  const fixedB = profile.type === "rect" && !profile.widthAlong ? AXIS[profile.thicknessAlong ?? "y"] : null;
  const fixedN = profile.type === "rect" && profile.widthAlong ? AXIS[profile.widthAlong] : null;
  let prevN: Vec3 | null = null;
  for (let i = 0; i < sample.points.length; i++) {
    const T = sample.tangents[i];
    let N: Vec3, B: Vec3;
    const projPerp = (a: Vec3) => norm(sub(a, mul(T, dot(a, T))));
    if (fixedB && Math.abs(dot(fixedB, T)) < 0.995) {
      B = projPerp(fixedB);
      N = norm(cross(B, T));
    } else if (fixedN && Math.abs(dot(fixedN, T)) < 0.995) {
      N = projPerp(fixedN);
      B = norm(cross(T, N));
    } else if (prevN) {
      N = projPerp(prevN);
      if (len(N) < 1e-6) N = projPerp(pickRef(T));
      B = norm(cross(T, N));
    } else {
      N = projPerp(pickRef(T));
      B = norm(cross(T, N));
    }
    prevN = N;
    out.push({ T, N, B });
  }
  return out;
}

/** 跟 T 最不平行的世界軸（優先 y，再 x，再 z） */
function pickRef(T: Vec3): Vec3 {
  const cands: Vec3[] = [AXIS.y, AXIS.x, AXIS.z];
  let best = cands[0], bestDot = 2;
  for (const c of cands) {
    const d = Math.abs(dot(c, T));
    if (d < bestDot) { bestDot = d; best = c; }
  }
  return best;
}

// ─── 斷面 ─────────────────────────────────────────────────────────────────────
/** 斷面寬（rect）／直徑（round）沿弧長 0..1 */
export function profileWidthAt(profile: SweptProfile, t01: number): number {
  const t = Math.min(1, Math.max(0, t01));
  if (profile.type === "round") return 2 * (profile.radiusStart + (profile.radiusEnd - profile.radiusStart) * t);
  const w0 = profile.widthStart, w1 = profile.widthEnd;
  if (profile.widthMid === undefined) return w0 + (w1 - w0) * t;
  // 三點二次：w(0)=w0, w(0.5)=wm, w(1)=w1
  const wm = profile.widthMid;
  const l0 = 2 * (t - 0.5) * (t - 1);
  const l1 = -4 * t * (t - 1);
  const l2 = 2 * t * (t - 0.5);
  return w0 * l0 + wm * l1 + w1 * l2;
}

/**
 * 斷面多邊形（在 (N,B) 平面的 2D 座標），繞 +T 逆時針。
 * 回傳 loops：round／導圓矩形 = 1 個封閉環；直角矩形 = 4 條開放邊（3D 要銳邊各自成面）。
 */
export function profileLoops(profile: SweptProfile, t01: number): { closed: boolean; loops: Vec2[][] } {
  if (profile.type === "round") {
    const r = profileWidthAt(profile, t01) / 2;
    const ring: Vec2[] = [];
    for (let k = 0; k < ROUND_PROFILE_SEGS; k++) {
      const a = (2 * Math.PI * k) / ROUND_PROFILE_SEGS;
      ring.push({ x: r * Math.cos(a), y: r * Math.sin(a) });
    }
    return { closed: true, loops: [ring] };
  }
  const w = profileWidthAt(profile, t01) / 2;
  const h = profile.thickness / 2;
  const cr = Math.min(profile.cornerR ?? 0, w * 0.45, h * 0.45);
  if (cr <= 0.01) {
    // 4 條邊：+N 邊、+B 邊、−N 邊、−B 邊（逆時針）
    const c0 = { x: w, y: -h }, c1 = { x: w, y: h }, c2 = { x: -w, y: h }, c3 = { x: -w, y: -h };
    return { closed: false, loops: [[c0, c1], [c1, c2], [c2, c3], [c3, c0]] };
  }
  const ring: Vec2[] = [];
  const corner = (cx: number, cy: number, a0: number) => {
    for (let k = 0; k <= CORNER_SEGS; k++) {
      const a = a0 + ((Math.PI / 2) * k) / CORNER_SEGS;
      ring.push({ x: cx + cr * Math.cos(a), y: cy + cr * Math.sin(a) });
    }
  };
  corner(w - cr, -h + cr, -Math.PI / 2);
  corner(w - cr, h - cr, 0);
  corner(-w + cr, h - cr, Math.PI / 2);
  corner(-w + cr, -h + cr, Math.PI);
  return { closed: true, loops: [ring] };
}

// ─── 表面 ─────────────────────────────────────────────────────────────────────
export type SweptSurface = {
  sample: CenterlineSample;
  frames: Frame[];
  /** rings[i][loop] = 第 i 站第 loop 條邊的 3D 點（part-local） */
  rings: Vec3[][][];
  closed: boolean;
};

export function sweptSurfaceRings(shape: SweptCurveShape): SweptSurface {
  const sample = sampleCenterline(shape);
  const frames = sweptFrames(sample, shape.profile);
  const total = sample.s[sample.s.length - 1] || 1;
  const rings: Vec3[][][] = [];
  let closed = true;
  for (let i = 0; i < sample.points.length; i++) {
    const c = sample.points[i];
    const { N, B } = frames[i];
    const t01 = sample.s[i] / total;
    const pl = profileLoops(shape.profile, t01);
    closed = pl.closed;
    rings.push(pl.loops.map((loop) => loop.map((q) => add(c, add(mul(N, q.x), mul(B, q.y))))));
  }
  return { sample, frames, rings, closed };
}

export function sweptAllPoints(shape: SweptCurveShape): Vec3[] {
  const out: Vec3[] = [];
  for (const st of sweptSurfaceRings(shape).rings) for (const loop of st) for (const q of loop) out.push(q);
  return out;
}

export function sweptLocalAABB(shape: SweptCurveShape): { min: Vec3; max: Vec3 } {
  const pts = sweptAllPoints(shape);
  const min = { x: Infinity, y: Infinity, z: Infinity };
  const max = { x: -Infinity, y: -Infinity, z: -Infinity };
  for (const q of pts) {
    min.x = Math.min(min.x, q.x); min.y = Math.min(min.y, q.y); min.z = Math.min(min.z, q.z);
    max.x = Math.max(max.x, q.x); max.y = Math.max(max.y, q.y); max.z = Math.max(max.z, q.z);
  }
  if (!Number.isFinite(min.x)) return { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } };
  return { min, max };
}

// ─── 端點（榫頭根面）─────────────────────────────────────────────────────────
export type SweptEnd = { point: Vec3; /** 往外（離開零件）的單位向量 */ outward: Vec3 };

/** 曲線兩端的中心點與往外方向（part-local）。start 往 −T₀、end 往 +Tₙ。 */
export function sweptEndpoints(shape: SweptCurveShape): { start: SweptEnd; end: SweptEnd } {
  const s = sampleCenterline(shape);
  const n = s.points.length - 1;
  if (n < 0) return { start: { point: { x: 0, y: 0, z: 0 }, outward: { x: 0, y: -1, z: 0 } }, end: { point: { x: 0, y: 0, z: 0 }, outward: { x: 0, y: 1, z: 0 } } };
  return {
    start: { point: s.points[0], outward: mul(s.tangents[0], -1) },
    end: { point: s.points[n], outward: s.tangents[n] },
  };
}

/** 曲線總弧長（mm） */
export function sweptArcLength(shape: SweptCurveShape): number {
  const s = sampleCenterline(shape);
  return s.s[s.s.length - 1] ?? 0;
}

/** 弧長 sMm 處的中心線點（part-local；線性內插取樣點） */
export function sweptPointAtArcLength(shape: SweptCurveShape, sMm: number): { point: Vec3; tangent: Vec3 } {
  const s = sampleCenterline(shape);
  const n = s.points.length - 1;
  if (n <= 0) return { point: s.points[0] ?? { x: 0, y: 0, z: 0 }, tangent: s.tangents[0] ?? { x: 0, y: 1, z: 0 } };
  const target = Math.min(s.s[n], Math.max(0, sMm));
  let i = 0;
  while (i < n && s.s[i + 1] < target) i++;
  const span = s.s[i + 1] - s.s[i] || 1;
  const t = (target - s.s[i]) / span;
  return {
    point: add(s.points[i], mul(sub(s.points[i + 1], s.points[i]), t)),
    tangent: norm(add(mul(s.tangents[i], 1 - t), mul(s.tangents[i + 1], t))),
  };
}

export type SweptCrossing = { point: Vec3; tangent: Vec3; /** 弧長比例 0..1 */ t01: number };

/** 中心線所有跨過 axis = value 的點（腳穿椅盤：取 y = 大邊中高的腳心；椅圈：取某個 z 的左右兩側） */
export function sweptCrossings(shape: SweptCurveShape, axis: "x" | "y" | "z", value: number): SweptCrossing[] {
  const s = sampleCenterline(shape);
  const total = s.s[s.s.length - 1] || 1;
  const out: SweptCrossing[] = [];
  for (let i = 0; i + 1 < s.points.length; i++) {
    const a = s.points[i][axis], b = s.points[i + 1][axis];
    if ((a <= value && value < b) || (b < value && value <= a) || (a === value && b === value && i === 0)) {
      const t = b === a ? 0 : (value - a) / (b - a);
      out.push({
        point: add(s.points[i], mul(sub(s.points[i + 1], s.points[i]), t)),
        tangent: norm(add(mul(s.tangents[i], 1 - t), mul(s.tangents[i + 1], t))),
        t01: (s.s[i] + (s.s[i + 1] - s.s[i]) * t) / total,
      });
    }
  }
  return out;
}

/** 第一個跨越點（相容用） */
export function sweptPointWhere(shape: SweptCurveShape, axis: "x" | "y" | "z", value: number): Vec3 | null {
  return sweptCrossings(shape, axis, value)[0]?.point ?? null;
}

/**
 * 點到曲料實體的距離（part-local，mm）：把曲料當成一串沿切線的小盒子（每站一個，
 * 斷面尺寸 = 該站斷面），取最近的一個。0 = 在木頭裡。
 * 模板的榫卯 gap 檢查用它取代 AABB——AABB 對馬蹄弧來說整個內側都算「在裡面」，
 * 零件搬進弧內 100mm 也量不到，負向對照會假綠。
 */
export function sweptDistanceToSolid(shape: SweptCurveShape, p: Vec3): number {
  const surf = sweptSurfaceRings(shape);
  const n = surf.sample.points.length;
  if (n === 0) return Infinity;
  const total = surf.sample.s[n - 1] || 1;
  let best = Infinity;
  for (let i = 0; i + 1 < n; i++) {
    const a = surf.sample.points[i], b = surf.sample.points[i + 1];
    const c = mul(add(a, b), 0.5);
    const T = norm(sub(b, a));
    if (len(T) === 0) continue;
    const { N, B } = surf.frames[i];
    const t01 = (surf.sample.s[i] + surf.sample.s[i + 1]) / 2 / total;
    const hw = shape.profile.type === "round" ? profileWidthAt(shape.profile, t01) / 2 : profileWidthAt(shape.profile, t01) / 2;
    const hb = shape.profile.type === "round" ? hw : shape.profile.thickness / 2;
    const hl = len(sub(b, a)) / 2;
    const d = sub(p, c);
    const dx = Math.max(0, Math.abs(dot(d, T)) - hl);
    const dn = Math.max(0, Math.abs(dot(d, N)) - hw);
    const db = Math.max(0, Math.abs(dot(d, B)) - hb);
    const dist = Math.hypot(dx, dn, db);
    if (dist < best) best = dist;
  }
  return best;
}

/**
 * 從「世界座標的曲線」切出子曲線（弧長 s0..s1），回傳新的 B-spline（重新內插 K 點）。
 * 圈椅五段：整圈一條曲線 → 依楔釘榫接點切五段，端點落在同一條中心線上。
 */
export function subCurveByArcLength(shape: SweptCurveShape, s0: number, s1: number, k = 9): { controlPoints: Vec3[]; knots: number[] } {
  const pts: Vec3[] = [];
  const K = Math.max(3, k);
  for (let i = 0; i < K; i++) pts.push(sweptPointAtArcLength(shape, s0 + ((s1 - s0) * i) / (K - 1)).point);
  return interpolateBSpline(pts);
}

// ─── 投影輪廓（§A9：3D 採樣 → 2D）───────────────────────────────────────────
/**
 * 給定投影函式（part-local 3D → 視圖 2D），回傳曲料的有序輪廓多邊形（非凸）。
 * 做法：每站把斷面點投影，取相對「投影後切線」最左／最右的點串成兩條邊，兩端補
 * 端面斷面的外側弧。曲線幾乎正對視線（投影長度 < 斷面）時退回全部點的凸包。
 */
export function projectSweptOutline(
  shape: SweptCurveShape,
  proj: (p: Vec3) => Vec2,
  hull: (pts: Vec2[]) => Vec2[],
): Vec2[] {
  const surf = sweptSurfaceRings(shape);
  const n = surf.sample.points.length;
  if (n === 0) return [];
  const P2: Vec2[][] = surf.rings.map((st) => st.flat().map(proj));
  const C2: Vec2[] = surf.sample.points.map(proj);
  const all = P2.flat();
  if (n === 1) return hull(all);
  // 投影後中心線長度 vs 斷面尺寸
  let projLen = 0;
  for (let i = 1; i < n; i++) projLen += Math.hypot(C2[i].x - C2[i - 1].x, C2[i].y - C2[i - 1].y);
  const maxProfile = Math.max(
    profileWidthAt(shape.profile, 0), profileWidthAt(shape.profile, 0.5), profileWidthAt(shape.profile, 1),
    shape.profile.type === "rect" ? shape.profile.thickness : 0,
  );
  // 投影後路徑不夠長（< 3 倍斷面）→ 凸包：垂直的腿從上面看、聯幫棍俯視都是一團，
  // 逐站取左右極值會漏掉「投影切線退化」那些站的真正外緣（腿俯視漏 1~4mm，
  // 棖端面貼在腿面上卻被 2D 稽核量成有縫）。長條（椅圈段、正視的腿）才走左右極值保留凹側。
  if (projLen < maxProfile * 3) return hull(all);
  // 投影切線（一階差分），退化站沿用最近的非退化切線
  const tan: (Vec2 | null)[] = [];
  for (let i = 0; i < n; i++) {
    const a = C2[Math.max(0, i - 1)], b = C2[Math.min(n - 1, i + 1)];
    const dx = b.x - a.x, dy = b.y - a.y;
    const L = Math.hypot(dx, dy);
    tan.push(L > 1e-6 ? { x: dx / L, y: dy / L } : null);
  }
  let last: Vec2 | null = null;
  for (let i = 0; i < n; i++) { if (tan[i]) last = tan[i]; else if (last) tan[i] = last; }
  last = null;
  for (let i = n - 1; i >= 0; i--) { if (tan[i]) last = tan[i]; else if (last) tan[i] = last; }
  if (!tan[0]) return hull(all);
  const left: Vec2[] = [], right: Vec2[] = [];
  for (let i = 0; i < n; i++) {
    const t = tan[i]!;
    let lBest = P2[i][0], lVal = -Infinity, rBest = P2[i][0], rVal = Infinity;
    for (const q of P2[i]) {
      const v = t.x * (q.y - C2[i].y) - t.y * (q.x - C2[i].x); // cross(t, q−c)
      if (v > lVal) { lVal = v; lBest = q; }
      if (v < rVal) { rVal = v; rBest = q; }
    }
    left.push(lBest); right.push(rBest);
  }
  // 端面弧：沿端面凸包從 right 走到 left，走「切線朝外」那一側
  const capArc = (i: number, from: Vec2, to: Vec2, dir: Vec2): Vec2[] => {
    const h = hull(P2[i]);
    if (h.length < 3) return [];
    const idx = (q: Vec2) => {
      let bi = 0, bd = Infinity;
      h.forEach((p, k) => { const d = Math.hypot(p.x - q.x, p.y - q.y); if (d < bd) { bd = d; bi = k; } });
      return bi;
    };
    const iF = idx(from), iT = idx(to);
    const walk = (step: 1 | -1) => {
      const out: Vec2[] = [];
      let k = iF;
      let guard = 0;
      while (k !== iT && guard++ < h.length + 1) { k = (k + step + h.length) % h.length; if (k !== iT) out.push(h[k]); }
      return out;
    };
    const fwd = walk(1), bwd = walk(-1);
    const score = (chain: Vec2[]) => chain.reduce((m, q) => Math.max(m, (q.x - C2[i].x) * dir.x + (q.y - C2[i].y) * dir.y), -Infinity);
    return score(fwd) >= score(bwd) ? fwd : bwd;
  };
  const tEnd = tan[n - 1]!, tStart = tan[0]!;
  const endCap = capArc(n - 1, left[n - 1], right[n - 1], tEnd);
  const startCap = capArc(0, right[0], left[0], { x: -tStart.x, y: -tStart.y });
  const outline = [...left, ...endCap, ...right.slice().reverse(), ...startCap];
  // 自檢：輪廓的 bbox 不可以比點雲小（投影後曲線折返、或端面弧走錯邊時會發生）
  // → 退回凸包（保守：只會多不會少，稽核寧可多量到也不能漏）。
  const bb = (pts: Vec2[]) => {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const q of pts) { x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y); }
    return { x0, x1, y0, y1 };
  };
  const a = bb(outline), b = bb(all);
  const shrink = Math.max(a.x0 - b.x0, b.x1 - a.x1, a.y0 - b.y0, b.y1 - a.y1);
  if (!(shrink <= 1.0)) return hull(all);
  return outline;
}

// ─── 建零件 ───────────────────────────────────────────────────────────────────
export type SweptPartGeometry = {
  shape: SweptCurveShape;
  /** AABB 尺寸（length=X, thickness=Y, width=Z） */
  visible: { length: number; width: number; thickness: number };
  /** wrd 慣例：底部中心 */
  origin: Vec3;
  /** AABB 中心（世界） */
  center: Vec3;
};

/**
 * 世界座標的「曲線經過點」→ 內插成 B-spline → 搬進 part-local（AABB 中心為原點）。
 * visible = 表面 AABB（也就是 spec §10.2 的備料 bounding box，才積直接用它）。
 */
export function sweptPartFromWorldPoints(
  throughPointsWorld: Vec3[],
  profile: SweptProfile,
  opts?: {
    segments?: number;
    knots?: number[];
    controlPointsWorld?: Vec3[];
    /**
     * 端點切線鎖定（單位向量，世界）。clamped B-spline 的端切線 ∝ (P₁−P₀)／(Pₙ−Pₙ₋₁)，
     * 把第二個控制點推到指定方向上就能讓端面剛好垂直於指定軸（榫頭端面要水平貼母件，
     * 光靠多放一個共線經過點做不到——內插曲線 C² 連續，會被下一個點拉歪 1~15°）。
     */
    startTangent?: Vec3;
    endTangent?: Vec3;
  },
): SweptPartGeometry {
  let fit: { controlPoints: Vec3[]; knots: number[] };
  if (opts?.controlPointsWorld) {
    fit = { controlPoints: opts.controlPointsWorld, knots: opts.knots ?? clampedUniformKnots(opts.controlPointsWorld.length, bsplineDegree(opts.controlPointsWorld.length)) };
  } else if ((opts?.startTangent || opts?.endTangent) && throughPointsWorld.length >= 3) {
    // 只給一端：另一端沿用無約束內插的自然切線
    const plain = interpolateBSpline(throughPointsWorld);
    const nP = plain.controlPoints.length - 1;
    const natural0 = norm(sub(plain.controlPoints[1], plain.controlPoints[0]));
    const naturalN = norm(sub(plain.controlPoints[nP], plain.controlPoints[nP - 1]));
    fit = interpolateBSplineWithTangents(throughPointsWorld, opts.startTangent ?? natural0, opts.endTangent ?? naturalN);
  } else {
    fit = interpolateBSpline(throughPointsWorld);
  }
  const worldShape: SweptCurveShape = { kind: "swept-curve", controlPoints: fit.controlPoints, knots: fit.knots, profile, segments: opts?.segments };
  const box = sweptLocalAABB(worldShape);
  const center = { x: (box.min.x + box.max.x) / 2, y: (box.min.y + box.max.y) / 2, z: (box.min.z + box.max.z) / 2 };
  const shape: SweptCurveShape = {
    ...worldShape,
    controlPoints: fit.controlPoints.map((c) => sub(c, center)),
  };
  return {
    shape,
    visible: { length: box.max.x - box.min.x, thickness: box.max.y - box.min.y, width: box.max.z - box.min.z },
    origin: { x: center.x, y: box.min.y, z: center.z },
    center,
  };
}

/** part-local → 世界（swept-curve 零件無旋轉：中心 = origin + (0, thickness/2, 0)） */
export function sweptLocalToWorld(part: { origin: Vec3; visible: { thickness: number } }, p: Vec3): Vec3 {
  return { x: part.origin.x + p.x, y: part.origin.y + part.visible.thickness / 2 + p.y, z: part.origin.z + p.z };
}
export function sweptWorldToLocal(part: { origin: Vec3; visible: { thickness: number } }, w: Vec3): Vec3 {
  return { x: w.x - part.origin.x, y: w.y - part.origin.y - part.visible.thickness / 2, z: w.z - part.origin.z };
}

/** 世界座標的兩端（榫頭根面用） */
export function sweptWorldEndpoints(part: { origin: Vec3; visible: { thickness: number }; shape: SweptCurveShape }): { start: SweptEnd; end: SweptEnd } {
  const e = sweptEndpoints(part.shape);
  return {
    start: { point: sweptLocalToWorld(part, e.start.point), outward: e.start.outward },
    end: { point: sweptLocalToWorld(part, e.end.point), outward: e.end.outward },
  };
}

/** 反曲點數（中心線在某平面投影的曲率變號次數）——S 形應為 1，三彎 2。驗證用。 */
export function countInflections(shape: SweptCurveShape, plane: "xy" | "yz" | "xz" = "yz"): number {
  const s = sampleCenterline(shape);
  const pts = s.points.map((p) => (plane === "xy" ? { a: p.x, b: p.y } : plane === "yz" ? { a: p.z, b: p.y } : { a: p.x, b: p.z }));
  const ks: number[] = [];
  for (let i = 1; i + 1 < pts.length; i++) {
    const ax = pts[i].a - pts[i - 1].a, ay = pts[i].b - pts[i - 1].b;
    const bx = pts[i + 1].a - pts[i].a, by = pts[i + 1].b - pts[i].b;
    const cr = ax * by - ay * bx;
    const mag = Math.hypot(ax, ay) * Math.hypot(bx, by);
    ks.push(mag < 1e-9 ? 0 : cr / mag);
  }
  // 只數「有意義」的彎：曲率絕對值小於最大曲率 8% 的視為直線（端切線鎖定會留下 <1% 的微漣漪）
  const kMax = Math.max(1e-9, ...ks.map((k) => Math.abs(k)));
  let count = 0, prevSign = 0;
  for (const k of ks) {
    if (Math.abs(k) < kMax * 0.08) continue;
    const sg = k > 0 ? 1 : -1;
    if (prevSign !== 0 && sg !== prevSign) count++;
    prevSign = sg;
  }
  return count;
}
