import type { Part } from "@/lib/types";
import { CURVED_TAPER_ARC_SEG, curvedTaperInsetAtY, curvedTaperProfileYs } from "./part-geometry";

/**
 * World-frame extents of a part's bounding box, honoring its rotation.
 *
 * Local (unrotated) convention: length→X, thickness→Y, width→Z.
 * Rotations are applied in three.js default Euler XYZ order (extrinsic around
 * world X, then world Y, then world Z). Only ~90° quarter-turns are supported.
 */
/**
 * 「這個視角算不算正對著零件的大面」的門檻(法線與視線夾角的 cos)。
 *
 * ⛔ 原本寫死 `> 0.99` —— 那是 **acos(0.99) = 8.1°**。但外斜角度的 UI 上限是 **15°**
 *    (SPLAY_ANGLE.stoolMaxDeg),也就是一半以上的可用範圍會被判成「非正對」→
 *    走 `convexHull2D` → **整條內凹弧被填平**。
 *    實測 /design/stool 選 牙條造型=圓弧 + 外斜角度=10:
 *    正視圖與零件圖的前後牙條變成完全平的長方形,弧不見了(3D 裡還在)。
 *    木工照零件圖下料就少挖那道弧,做出來跟畫面上的 3D 不一樣。
 *    (2026-08-21 稽核發現。)
 *
 * ✅ 放寬到 20°(cos = 0.9397),涵蓋 15° 上限並留餘裕。
 *    取捨:略為傾斜的視角用「有序輪廓」會忽略厚度方向那幾 mm 的投影(silhouette 稍窄),
 *    但 convex hull 是**整條弧直接消失**——前者小失真、後者資訊全毀,前者明顯較好。
 *    超過 20° 才回去走 hull(那時大面已經明顯側斜,輪廓本來就不該當正視看)。
 */
const FACE_ON_COS = 0.9397; // cos(20°)

export function worldExtents(part: Part) {
  let xExt = part.visible.length;
  let yExt = part.visible.thickness;
  let zExt = part.visible.width;
  const quarter = (a: number) => Math.abs(Math.sin(a)) > 0.5;
  if (quarter(part.rotation?.x ?? 0)) [yExt, zExt] = [zExt, yExt];
  if (quarter(part.rotation?.y ?? 0)) [xExt, zExt] = [zExt, xExt];
  if (quarter(part.rotation?.z ?? 0)) [xExt, yExt] = [yExt, xExt];
  return { xExt, yExt, zExt };
}

export type OrthoView = "front" | "side" | "top" | "bottom";

/**
 * 法式斜切條截面（共用，3D / 三視圖 / SVG 同源，杜絕梯形 vs 方塊漂移）。
 * 直角梯形，在 part-local Y–Z 平面（Y=thickness 凸出牆面、Z=width 條高）。
 * 回傳 4 個 [y, z] 點，CCW（從 +X 端往 -X 看）。
 * - upper（牆條）：斜口朝上 → 前面（+Y）比背面（-Y）矮 bevelDrop。
 * - lower（活動掛座）：斜口朝下 → 與 upper 上下鏡像，倒扣咬合。
 * 背面（-Y，貼牆側）永遠是垂直滿邊，從 -hz 到 +hz。
 * 純函式、無 three.js 依賴，故放在 2D geometry 模組讓 part-geometry 與 svg-views 共用。
 */
export function frenchCleatSection(
  thickness: number,
  width: number,
  bevelAngle: number,
  orientation: "upper" | "lower",
): Array<[number, number]> {
  const hy = thickness / 2;
  const hz = width / 2;
  // 45° → bevelDrop = 2*hy（斜面在 Z 上吃掉 = 在 Y 上凸出量）。clamp 不超過全高。
  const bevelDrop = Math.min(2 * hz, (2 * hy) / Math.tan(bevelAngle));
  // lower = upper 的「截面 180° 點反射」(y,z)→(-y,-z)。配 part 同一個 rotation
  // 後，世界座標等於把 upper 牆條繞長度軸轉 180° → 斜面與牆條平行、可真正咬合
  // （單純上下鏡像會讓斜面方向相反、扣不住）。
  return orientation === "upper"
    ? [
        [-hy, -hz],            // 背下
        [hy, -hz],             // 前下
        [hy, hz - bevelDrop],  // 前上（斜面起點，前面較矮）
        [-hy, hz],             // 背上
      ]
    : [
        [hy, hz],              // = upper 各點 (y,z)→(-y,-z)
        [-hy, hz],
        [-hy, -hz + bevelDrop],
        [hy, -hz],
      ];
}

/**
 * 牙板／下橫撐「造型邊」2D 輪廓（edge-profile）——在 length(X) × width(U) 大面上，
 * 下緣（U=+w/2，rotation x=π/2 後為世界下方）依 style 內凹造型，沿厚度擠出。
 * 3D（buildEdgeProfileGeometry）、正視 polygon、零件 SVG 匯出三方共用，保證逐點一致。
 *
 * style：
 *  - arch        下緣圓弧（單一大弧往上收，兩端歸零）
 *  - kunmen      壸門曲線（兩端 cos 弧肩上收 → 中段平直於深度 d）
 *  - wave        波浪連續弧（waveCount 個圓滑波峰，兩端歸零）
 *  - corner-round 下緣兩端圓角（半徑 = depth 的四分之一圓，中段平直）
 *  - double-arch 上下都往內圓弧（上下緣各一道內凹弧＝束腰）
 *
 * 回傳閉合順序頂點 [x, u]（u 軸 = local Z；+u = 下緣）。深度自動 clamp 保結構。
 */
export function edgeProfileOutline(
  lx: number,
  w: number,
  style: "arch" | "arch-out" | "top-arch" | "kunmen" | "wave" | "corner-round" | "double-arch",
  depthMm: number,
  waveCount: number = 4,
  /** 選配梯形補償（同 apron-trapezoid 語意）：上緣（-u）/下緣（+u）長度縮放，
   *  輪廓 x 依 u 位置線性插值縮放 → 造型與斜腳/弧肩斜腳的牙板梯形補償可同時成立。 */
  topLengthScale: number = 1,
  bottomLengthScale: number = 1,
): Array<[number, number]> {
  const hx = lx / 2;
  const hu = w / 2;
  // u → x 縮放：-hu(上緣)=topLengthScale、+hu(下緣)=bottomLengthScale
  const xScaleAt = (u: number): number =>
    topLengthScale + ((bottomLengthScale - topLengthScale) * (u + hu)) / (w || 1);
  // 深度 clamp：單邊 ≤ 45% 高；double-arch 兩邊各 ≤ 35%（中段至少留 30%）
  const d = Math.max(0, Math.min(depthMm, style === "double-arch" ? w * 0.35 : w * 0.45));
  const N = style === "wave" ? 96 : 32;
  const pts: Array<[number, number]> = [];
  // 下緣內凹量 f(t)，t ∈ [0,1] 由 -hx → +hx
  const inset = (t: number): number => {
    if (d <= 0) return 0;
    if (style === "top-arch") return 0; // 上緣圓弧：下緣平直
    if (style === "arch-out") {
      // 下緣外圓弧（凸弧）：中間垂到全高、兩端上收 d（弧朝外/下鼓）
      return d * (1 - Math.sin(Math.PI * t));
    }
    if (style === "kunmen") {
      const s = 0.22; // 兩端弧肩占比
      if (t < s) return (d * (1 - Math.cos(Math.PI * (t / s)))) / 2;
      if (t > 1 - s) return (d * (1 - Math.cos(Math.PI * ((1 - t) / s)))) / 2;
      return d;
    }
    if (style === "wave") {
      const n = Math.max(2, Math.round(waveCount));
      return (d * (1 - Math.cos(2 * Math.PI * n * t))) / 2;
    }
    if (style === "corner-round") {
      // 兩端 r=d 四分之一圓角，中段平直貼下緣
      const r = Math.min(d, hx * 0.9);
      const xAbs = (t: number) => -hx + lx * t;
      const x = xAbs(t);
      if (x < -hx + r) return r - Math.sqrt(Math.max(0, r * r - (x - (-hx + r)) ** 2));
      if (x > hx - r) return r - Math.sqrt(Math.max(0, r * r - (x - (hx - r)) ** 2));
      return 0;
    }
    // arch / double-arch 下緣：單一正弦大弧
    return d * Math.sin(Math.PI * t);
  };
  // 上緣內凹量（double-arch 束腰 / top-arch 上緣圓弧）
  const insetTop = (t: number): number =>
    style === "double-arch" || style === "top-arch" ? d * Math.sin(Math.PI * t) : 0;
  // 下緣：-hx → +hx（+u 邊往 -u 內凹）
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const u = hu - inset(t);
    pts.push([(-hx + lx * t) * xScaleAt(u), u]);
  }
  // 上緣：+hx → -hx（-u 邊往 +u 內凹）
  for (let i = 0; i <= N; i++) {
    const t = 1 - i / N;
    const u = -hu + insetTop(t);
    pts.push([(-hx + lx * t) * xScaleAt(u), u]);
  }
  return pts;
}

/** top-outline 細節參數（全部選配，預設 = 第一版行為）。 */
export type TopOutlineOpts = {
  /** octagon：Z 向切深；undefined / 0 = 同 sizeMm（45° 等邊切角）。 */
  sizeZMm?: number;
  /** oval：方圓程度 0..1（0 = 正橢圓；愈大愈接近圓角方形＝超橢圓 n=2..8）。 */
  squareness?: number;
  /** arch：外凸弧套用邊；預設 "front-back"。"all" = 四邊枕形。 */
  archSides?: "front-back" | "left-right" | "all";
  /** petal：瓣數（4 = 海棠形、6、8）；預設 4。 */
  lobes?: number;
};

/**
 * 座板／桌面「俯視輪廓」2D 造型（top-outline）——在 length(X) × width(Z) 大面上
 * 依 style 重塑外輪廓，沿厚度（local Y）擠出。
 * 3D（buildTopOutlineGeometry）、silhouette、零件 SVG 匯出三方共用，保證逐點一致。
 *
 * style：
 *  - octagon 四角切角（X 向切 sizeMm、Z 向切 sizeZMm｜預設同值 45° → 八角面）
 *  - oval    滿版橢圓／超橢圓（squareness 0..1 由正橢圓過渡到圓角方；sizeMm 不用）
 *  - arch    外凸弧（archSides 選前後／左右／四邊枕形；兩端各收 sizeMm、中段滿幅）
 *  - petal   海棠／花瓣形（lobes 瓣、瓣深 sizeMm；瓣鼓在軸向、凹谷在瓣間）
 *
 * 回傳閉合順序頂點 [x, z]（俯視慣例 §A1：+z = 後緣）。尺寸自動 clamp 保結構。
 */
export function topOutlinePoints(
  lx: number,
  lz: number,
  style: "octagon" | "oval" | "arch" | "petal",
  sizeMm: number,
  opts: TopOutlineOpts = {},
): Array<[number, number]> {
  const hx = lx / 2;
  const hz = lz / 2;
  const rectPts: Array<[number, number]> = [
    [-hx, -hz], [hx, -hz], [hx, hz], [-hx, hz],
  ];
  if (style === "octagon") {
    const a = Math.max(0, Math.min(sizeMm, hx * 0.9));
    const bRaw = opts.sizeZMm !== undefined && opts.sizeZMm > 0 ? opts.sizeZMm : sizeMm;
    const b = Math.max(0, Math.min(bRaw, hz * 0.9));
    if (a < 0.01 || b < 0.01) return rectPts; // 退化成方形，避免重複點
    return [
      [-hx + a, -hz], [hx - a, -hz], [hx, -hz + b], [hx, hz - b],
      [hx - a, hz], [-hx + a, hz], [-hx, hz - b], [-hx, -hz + b],
    ];
  }
  if (style === "oval" || style === "petal") {
    // 極座標統一式：base = 超橢圓 r̂(θ) = (|cosθ|^n + |sinθ|^n)^(−1/n)（n=2 即橢圓），
    // petal 再乘瓣調變 m(θ) = 1 − d̂·(1 − cos(kθ))/2（凹谷在 θ=π/k 奇數倍＝瓣間、鼓在軸向）
    const s = Math.max(0, Math.min(1, style === "oval" ? (opts.squareness ?? 0) : 0));
    const n = 2 + s * 6;
    const k = Math.max(2, Math.round(opts.lobes ?? 4));
    const dNorm =
      style === "petal"
        ? Math.max(0, Math.min(sizeMm, Math.min(hx, hz) * 0.3)) / Math.min(hx, hz)
        : 0;
    const N = 96;
    const pts: Array<[number, number]> = [];
    for (let i = 0; i < N; i++) {
      const th = (2 * Math.PI * i) / N;
      const c = Math.cos(th);
      const si = Math.sin(th);
      const rBase = Math.pow(Math.pow(Math.abs(c), n) + Math.pow(Math.abs(si), n), -1 / n);
      const m = 1 - (dNorm * (1 - Math.cos(k * th))) / 2;
      pts.push([hx * rBase * m * c, hz * rBase * m * si]);
    }
    return pts;
  }
  // arch：外凸弧。archSides 決定哪些邊鼓（中段滿幅、兩端各收 d）
  const sides = opts.archSides ?? "front-back";
  const N = 32;
  const pts: Array<[number, number]> = [];
  const bow = (t: number, d: number) => d * (1 - Math.sin(Math.PI * t)); // 端點=d、中段=0
  if (sides === "front-back") {
    const d = Math.max(0, Math.min(sizeMm, hz * 0.35));
    if (d < 0.01) return rectPts;
    for (let i = 0; i <= N; i++) { const t = i / N; pts.push([-hx + lx * t, -(hz - bow(t, d))]); }
    for (let i = 0; i <= N; i++) { const t = 1 - i / N; pts.push([-hx + lx * t, hz - bow(t, d)]); }
    return pts;
  }
  if (sides === "left-right") {
    const d = Math.max(0, Math.min(sizeMm, hx * 0.35));
    if (d < 0.01) return rectPts;
    // 右緣（+x）：-hz → +hz；左緣（-x）：+hz → -hz；上下緣為直線（由端點相接）
    for (let i = 0; i <= N; i++) { const t = i / N; pts.push([hx - bow(t, d), -hz + lz * t]); }
    for (let i = 0; i <= N; i++) { const t = 1 - i / N; pts.push([-(hx - bow(t, d)), -hz + lz * t]); }
    return pts;
  }
  // all：四邊枕形——四角各縮 d、四邊中段鼓到滿幅，角點由相鄰兩弧共用
  const d = Math.max(0, Math.min(sizeMm, Math.min(hx, hz) * 0.35));
  if (d < 0.01) return rectPts;
  // 前緣：(-(hx-d), -(hz-d)) → (hx-d, -(hz-d))，中段垂到 -hz
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    pts.push([-(hx - d) + (lx - 2 * d) * t, -(hz - bow(t, d))]);
  }
  // 右緣：(hx-d, -(hz-d)) → (hx-d, hz-d)，中段鼓到 +hx
  for (let i = 1; i <= N; i++) {
    const t = i / N;
    pts.push([hx - bow(t, d), -(hz - d) + (lz - 2 * d) * t]);
  }
  // 後緣：(hx-d, hz-d) → (-(hx-d), hz-d)，中段鼓到 +hz
  for (let i = 1; i <= N; i++) {
    const t = i / N;
    pts.push([hx - d - (lx - 2 * d) * t, hz - bow(t, d)]);
  }
  // 左緣：(-(hx-d), hz-d) → (-(hx-d), -(hz-d))，中段鼓到 -hx
  for (let i = 1; i < N; i++) {
    const t = i / N;
    pts.push([-(hx - bow(t, d)), hz - d - (lz - 2 * d) * t]);
  }
  return pts;
}

/**
 * 弧肩斜腳（curved-taper）側面 2D 輪廓（local X=寬、Y=高 平面），沿厚度 Z 擠出。
 * ⚠️ 必須與 part-geometry.ts `buildCurvedTaperGeometry` 的 `pts` 逐點一致
 *   （同 clamp 相對係數、同弧參數 x=-hx+shoulder·cos(th)、y=yCoveEnd+coveSpan·sin(th)）。
 *   這裡是純 2D（無 three 依賴），dims 為原始 mm（SCALE 只在 3D 路徑），故絕對 clamp OK。
 *   外面（+dir 側）垂直 plumb；內面（-dir 側）= 接撐段全寬 → 內凹弧肩 → 斜降到腳底再內收。
 * 回傳 local [x, y] 頂點序列（已套 dir 鏡射 s），非閉合、勿跑 convex hull（會填掉凹弧）。
 */
export function curvedTaperProfilePoints(
  lx: number,
  ly: number,
  blockHeightMm: number,
  shoulderMm: number,
  insetMm: number,
  dir: -1 | 0 | 1,
  lowerCove?: { botMm: number; topMm: number },
  sCurve?: boolean,
): Array<[number, number]> {
  const hx = lx / 2;
  const hy = ly / 2;
  const s = dir < 0 ? -1 : 1;
  const blockH = Math.max(0, Math.min(blockHeightMm, ly * 0.9));
  const shoulder = Math.max(0, Math.min(shoulderMm, lx * 0.45));
  const coveSpan = Math.min(shoulder, Math.max(0, ly - blockH));
  const inset = Math.max(0, Math.min(insetMm, lx - shoulder - lx * 0.05));
  const yTop = hy;
  const yBlockBot = hy - blockH;
  const yCoveEnd = yBlockBot - coveSpan;
  const yBot = -hy;
  /**
   * ⭐ 形狀只由 `curvedTaperInsetAtY()` 決定、取樣點只由 `curvedTaperProfileYs()` 決定
   *    —— 跟 3D 網格**共用同一支**。（2026-08-25 統一）
   *
   * 🩸 統一前這裡自己寫一份分段邏輯,跟 part-geometry.ts 那份是兩套。
   *    加密弧段時只改了 3D 那份,165 組腳型指紋「完全沒反應」——
   *    因為它量的正是這裡。兩份各改各的就是這樣。
   */
  const pts: Array<[number, number]> = [];
  pts.push([hx, yTop]);  // 外頂（全寬）
  pts.push([hx, yBot]);  // 外底（外側垂直 plumb）
  const ysDown = curvedTaperProfileYs(lx, ly, blockHeightMm, shoulderMm, CURVED_TAPER_ARC_SEG, lowerCove, sCurve);
  for (let i = ysDown.length - 1; i >= 0; i--) {
    const y = ysDown[i];
    pts.push([-hx + curvedTaperInsetAtY(lx, ly, blockHeightMm, shoulderMm, insetMm, y, lowerCove, sCurve), y]);
  }
  return pts.map(([x, y]) => [s * x, y] as [number, number]);
}

/**
 * 通用零件 silhouette：取零件 local-frame 採樣點 → 套形狀修飾（taper/splay/
 * arch-bent/tilt-z/apron-trapezoid/apron-beveled）→ 套 rotation → 加 origin →
 * 投影到 view 平面 → convex hull → 剪影 polygon。
 *
 * 一條演算法處理所有「需要 3D 計算才能正確投影 2D」的情況，取代以往
 * 各 view × 各 shape 散落的 polygon 邏輯。
 */
export function projectPartSilhouette(
  part: Part,
  view: OrthoView,
): Array<{ x: number; y: number }> {
  const lx = part.visible.length;
  const ly = part.visible.thickness;
  const lz = part.visible.width;
  const rx = part.rotation?.x ?? 0;
  const ry = part.rotation?.y ?? 0;
  const rz = part.rotation?.z ?? 0;
  const cx = Math.cos(rx), sx = Math.sin(rx);
  const cy = Math.cos(ry), sy = Math.sin(ry);
  const cz = Math.cos(rz), sz = Math.sin(rz);
  const { yExt } = worldExtents(part);
  const yOffset = part.origin.y + yExt / 2;

  // === Shape modifiers ===
  const trap = part.shape?.kind === "apron-trapezoid" ? part.shape : null;
  const bev = part.shape?.kind === "apron-beveled" ? part.shape : null;
  const halfBev = part.shape?.kind === "apron-half-beveled" ? part.shape : null;
  const bevShear = Math.tan(bev?.bevelAngle ?? trap?.bevelAngle ?? 0);
  const halfBevShear = Math.tan(halfBev?.bevelAngle ?? 0);
  // trapezoid 可能是 half-bevel：只 top 4 vertex shear
  const trapHalfBevel = trap?.bevelMode === "half";
  // Tapered family: 底面 (y = +ly/2) 沿 X 縮 bottomScale
  const tapered = part.shape?.kind === "tapered" ? part.shape.bottomScale
    : part.shape?.kind === "round-tapered" ? part.shape.bottomScale
    : part.shape?.kind === "splayed-tapered" ? part.shape.bottomScale
    : part.shape?.kind === "splayed-round-tapered" ? part.shape.bottomScale
    : 1;
  // Splayed family: 底面 (y = +ly/2) 沿 X 偏 dxMm、沿 Z 偏 dzMm
  const splay =
    part.shape?.kind === "splayed" ? { dx: part.shape.dxMm, dz: part.shape.dzMm }
    : part.shape?.kind === "splayed-tapered" ? { dx: part.shape.dxMm, dz: part.shape.dzMm }
    : part.shape?.kind === "splayed-round-tapered" ? { dx: part.shape.dxMm, dz: part.shape.dzMm }
    : null;
  // Arch-bent: 沿 X 切 N 片，每片 z 軸偏移 bend × (1 - (2x/L)²)
  const arch = part.shape?.kind === "arch-bent" ? part.shape : null;
  const archSegments = arch ? Math.max(2, arch.segments ?? 16) : 0;
  // Tilt-z: 頂面 (y = +ly/2 → 旋轉前的局部頂端) 沿 Z 偏 topShiftMm
  // baseHeightMm 已在 visible.width 反映傾斜後的料長，不另外 scale。
  const tiltZ = part.shape?.kind === "tilt-z" ? part.shape.topShiftMm : 0;
  // Mitered-ends: 兩端沿 X 軸 inset，但只在 inner Y 邊（不在 outer Y 邊）。
  const mitered = part.shape?.kind === "mitered-ends" ? part.shape : null;
  // Right-triangle: 在 local X-Z 平面切去對角缺角，sample 時跳過該 (exNorm, ezSamp) 對。
  // corner = 直角位置；缺角 = 直角的對角（兩軸 sign 都反）。
  const rightTri = part.shape?.kind === "right-triangle" ? part.shape : null;
  const triMissExSign = rightTri ? (rightTri.corner.startsWith("+x") ? -1 : +1) : 0;
  const triMissEzSign = rightTri ? (rightTri.corner.endsWith("+z") ? -1 : +1) : 0;
  // Mitered-corner: 在 perpendicular axis 平面切去 45° 角；sample 時跳過該角 + 補上兩個 inset 點。
  const miterCorner = part.shape?.kind === "mitered-corner" ? part.shape : null;
  // Round / round-tapered / lathe-turned / shaker：截面圓形，採樣 N 點而非 4 角
  const isRound = part.shape?.kind === "round" || part.shape?.kind === "round-tapered"
    || part.shape?.kind === "lathe-turned";
  /**
   * 圓截面採樣點數。固定 16 點對腳、把手這種小圓件夠用,對大圓盤不夠:
   * 弦中點誤差 = R(1−cos(π/N)),700mm 圓盤用 16 點是 350×(1−cos(π/16)) ≈ 6.7mm。
   * 一般用途(AABB / overlap)看不出差別,但 1:1 實尺樣板是照著描的,6.7mm 直接
   * 變成切錯 6.7mm。所以點數跟半徑走,把誤差壓在 ROUND_SAGITTA_TOL_MM 以內。
   *
   * 下限 16 維持小零件的既有行為;上限 128 擋住極端尺寸把點數炸開
   * (128 點對 1000mm 圓的誤差是 0.3mm,已經遠低於木工實務解析度)。
   */
  const ROUND_SAGITTA_TOL_MM = 0.2;
  // 圓的半徑取三邊的「中位數」÷2:圓截面一定落在兩個相等的邊上,擠出方向是第三邊,
  // 所以中位數必然是圓的直徑。圓盤 (700,700,25)→700、圓腳 (40,40,450)→40、
  // 橫桿 (300,20,20)→20,三種都準。用 max 會把 450mm 高的圓腳誤判成 R=225 而
  // 過度採樣,用 min 則會把圓盤誤判成板厚。
  const roundR = [lx, ly, lz].sort((a, b) => a - b)[1] / 2;
  const ROUND_SAMPLES = (() => {
    if (roundR <= 0) return 16;
    const c = 1 - ROUND_SAGITTA_TOL_MM / roundR;
    if (c <= -1) return 16;
    const n = Math.ceil(Math.PI / Math.acos(Math.min(1, c)));
    return Math.min(128, Math.max(16, n));
  })();

  const projected: Array<{ x: number; y: number }> = [];
  const pushPoint = (xL: number, yL: number, zL: number) => {
    let x = xL, y = yL, z = zL;
    // Rx
    let y2 = y * cx - z * sx;
    let z2 = y * sx + z * cx;
    y = y2; z = z2;
    // Ry
    let x2 = x * cy + z * sy;
    z2 = -x * sy + z * cy;
    x = x2; z = z2;
    // Rz
    x2 = x * cz - y * sz;
    y2 = x * sz + y * cz;
    x = x2; y = y2;
    const wx = x + part.origin.x;
    const wy = y + yOffset;
    const wz = z + part.origin.z;
    let vx: number, vy: number;
    if (view === "top") { vx = -wx; vy = wz; }
    // 側視（第三角法右側視圖）：前面 -Z → SVG +x；用 -wz 維持「前=右」慣例
    else if (view === "side") { vx = -wz; vy = wy; }
    else { vx = -wx; vy = wy; }
    projected.push({ x: vx, y: vy });
  };

  // 反向法外撇 miter：mitered-ends.vertices 直接給 8 個 part-local 點，
  // 不走 bbox 角採樣（因為牆是 sheared parallelepiped、AABB 不準）。
  if (mitered?.vertices && mitered.vertices.length === 8) {
    for (const [xL, yL, zL] of mitered.vertices) {
      pushPoint(xL, yL, zL);
    }
    return convexHull2D(projected);
  }

  // apron-trapezoid 帶 taperSpanMm（床頭板貼錐腳）：−Z 邊起 span 內是梯形、之後垂直 →
  // 面對板面看是**六邊形**，錐腳（地板那端較寬）時膝點是凹角，convex hull 會把它填平、
  // 板緣就變成從地板斜到板頂的一條直線（2026-09-02 實測 y=70 差 3mm、y=250 差 11mm）。
  // 所以直接輸出有序輪廓：兩個 Y 面各一圈 6 點；面對面看用有序圈，看側邊（面積≈0）退回 hull。
  if (trap?.taperSpanMm !== undefined && trap.taperSpanMm > 0 && trap.taperSpanMm < lz) {
    const hx = lx / 2, hy = ly / 2, hz = lz / 2;
    const topX = hx * trap.topLengthScale, botX = hx * trap.bottomLengthScale;
    const zB = -hz + trap.taperSpanMm;
    const ring: Array<[number, number]> = [[-topX, -hz], [topX, -hz], [botX, zB], [botX, hz], [-botX, hz], [-botX, zB]];
    for (const [xL, zL] of ring) pushPoint(xL, hy, zL);
    const ordered = projected.slice();
    for (const [xL, zL] of ring) pushPoint(xL, -hy, zL);
    const area = (poly: Array<{ x: number; y: number }>) => Math.abs(poly.reduce((a, p, i) => { const q = poly[(i + 1) % poly.length]; return a + p.x * q.y - q.x * p.y; }, 0)) / 2;
    const hull = convexHull2D(projected);
    return area(ordered) > 0.5 * area(hull) ? ordered : hull;
  }

  // pointed-ends：local 長×厚（X-Y）截面是六邊形（兩個 X 端塌成尖點），
  // 沿 width 軸（Z）擠出。直接給 12 個 part-local 頂點（6 × 兩個 Z 端），
  // 不走 bbox 角採樣（矩形 bbox 會把尖端補成方角）。
  if (part.shape?.kind === "pointed-ends") {
    const inset = Math.min(ly / 2, (lx / 2) * 0.999);
    const hexXY: Array<[number, number]> = [
      [lx / 2, 0],
      [lx / 2 - inset, ly / 2],
      [-lx / 2 + inset, ly / 2],
      [-lx / 2, 0],
      [-lx / 2 + inset, -ly / 2],
      [lx / 2 - inset, -ly / 2],
    ];
    for (const zL of [-lz / 2, lz / 2]) {
      for (const [xL, yL] of hexXY) pushPoint(xL, yL, zL);
    }
    return convexHull2D(projected);
  }

  // french-cleat：直角梯形截面在 Y-Z 平面（ly=thickness, lz=width），沿 X 擠出。
  // 直接給 8 個 part-local 頂點（截面 4 點 × 兩個 X 端），不走 bbox 角採樣
  // （否則梯形被補成方塊）。側視看到梯形斜邊、正視/俯視自然成矩形。
  if (part.shape?.kind === "french-cleat") {
    const sec = frenchCleatSection(ly, lz, part.shape.bevelAngle, part.shape.orientation);
    for (const xL of [-lx / 2, lx / 2]) {
      for (const [yL, zL] of sec) pushPoint(xL, yL, zL);
    }
    return convexHull2D(projected);
  }

  // 弧肩斜腳（curved-taper）：側面輪廓在 local X-Y 平面（含內凹弧肩），沿 Z 擠出。
  // 正視（無旋轉、看 X-Y）→ 直接輸出「有序」輪廓多邊形，保留凹弧（不跑 convex hull，
  //   否則凹弧被填平回方框，正是 user 回報「正視圖畫成方框」的根因）。
  // 其他視角 / 帶旋轉（零件圖橫躺）→ 兩個 Z 端各採一圈輪廓 → convex hull：
  //   側視 / 俯視本就是矩形（Z 面全寬不收），audit 只用 min/max，皆正確；
  //   橫躺零件卡的凹弧會被 hull 填平（僅外側斜降仍在），屬可接受的細節損失。
  if (part.shape?.kind === "curved-taper") {
    const prof = curvedTaperProfilePoints(
      lx, ly, part.shape.blockHeightMm, part.shape.shoulderMm, part.shape.insetMm, part.shape.dir, part.shape.lowerCove, part.shape.sCurve,
    );
    // 選配外斜（splay）：頂固定、底外移 dxMm/dzMm。t=(hy−y)/ly ∈ [0 頂,1 底]。0 = 既有行為。
    const ctDx = part.shape.dxMm ?? 0;
    const ctDz = part.shape.dzMm ?? 0;
    const shearT = (yp: number) => (ly / 2 - yp) / ly;
    // 輪廓在 local X-Y 平面、沿 local Z 擠出 → profile 法線 = 旋轉後的 local Z。
    // 哪個視角「看向」此法線就看得到真實輪廓(含接撐段+凹弧) → 輸出有序多邊形不跑 hull
    // (hull 會把接撐段+凹弧填成一條斜線 = 楔形,零件圖橫躺就是踩這個)。
    // n = R·(0,0,1)(Rx→Ry→Rz,與 pushPoint 同序):
    const nZ = cx * cy;                      // n·(0,0,1) → front 視角
    const nX = cx * sy * cz + sx * sz;       // n·(1,0,0) → side 視角
    const nY = cx * sy * sz - sx * cz;       // n·(0,1,0) → top 視角
    const alongProfile =
      (view === "front" && Math.abs(nZ) > FACE_ON_COS) ||
      (view === "side" && Math.abs(nX) > FACE_ON_COS) ||
      (view === "top" && Math.abs(nY) > FACE_ON_COS);
    if (alongProfile) {
      // dz 沿擠出法線＝視線方向,投影上塌掉不可見 → 有序輪廓仍正確(凹弧保留)
      for (const [xp, yp] of prof) {
        const t = shearT(yp);
        pushPoint(xp + ctDx * t, yp, ctDz * t);
      }
      return projected; // 有序、保留接撐段+凹弧
    }
    /**
     * 兩向弧肩（§A9.9）：−Z 那面也有同一道弧肩 → 從 X 方向看過去也是輪廓，不是方框。
     *
     * 這一段的輪廓在 local **Z-Y** 平面（法線 = local X），所以要用 R·(1,0,0)
     * 的世界分量判哪個視角看得到（上面那組 n 是 R·(0,0,1)，管的是 X-Y 那面）。
     * m = R·(1,0,0) = (cy·cz, cy·sz, −sy)。
     */
    if (part.shape.twoWay) {
      const mX = cy * cz;   // → side 視角
      const mY = cy * sz;   // → top 視角
      const mZ = -sy;       // → front 視角
      const alongZProfile =
        (view === "front" && Math.abs(mZ) > FACE_ON_COS) ||
        (view === "side" && Math.abs(mX) > FACE_ON_COS) ||
        (view === "top" && Math.abs(mY) > FACE_ON_COS);
      if (alongZProfile) {
        // 同一條輪廓函式，但寬度基準換成 lz、方向用 dz 的正負決定內面在哪一側
        const dirZ = (part.shape.dirZ ?? 1) as -1 | 0 | 1;
        const profZ = curvedTaperProfilePoints(
          lz, ly, part.shape.blockHeightMm, part.shape.shoulderMm, part.shape.insetMm, dirZ, part.shape.lowerCove, part.shape.sCurve,
        );
        for (const [zp, yp] of profZ) {
          const t = shearT(yp);
          pushPoint(ctDx * t, yp, zp + ctDz * t);
        }
        return projected;
      }
    }
    // 看向擠出方向以外的視角:輪廓塌成線、擠出成矩形 → 兩端採樣 hull
    for (const zL of [-lz / 2, lz / 2]) {
      for (const [xp, yp] of prof) {
        const t = shearT(yp);
        pushPoint(xp + ctDx * t, yp, zL + ctDz * t);
      }
    }
    return convexHull2D(projected);
  }

  // 牙板／下橫撐造型邊（edge-profile）：輪廓在 local X–Z 大面、沿 local Y（厚度）擠出。
  // 對著大面法線（旋轉後的 local Y）的視角 → 輸出有序輪廓（保留內凹弧，不跑 hull）；
  // 其他視角 → 兩端（y=±hy）採樣 hull（側看本來就是矩形/傾斜四邊形）。
  if (part.shape?.kind === "edge-profile") {
    const prof = edgeProfileOutline(lx, lz, part.shape.style, part.shape.depthMm, part.shape.waveCount ?? 4, part.shape.topLengthScale ?? 1, part.shape.bottomLengthScale ?? 1);
    // n = R·(0,1,0)（Rx→Ry→Rz，與 pushPoint 同序）
    const nZ = sx * cy;                       // → front
    const nX = sx * sy * cz - cx * sz;        // → side
    const nY = sx * sy * sz + cx * cz;        // → top
    const alongFace =
      (view === "front" && Math.abs(nZ) > FACE_ON_COS) ||
      (view === "side" && Math.abs(nX) > FACE_ON_COS) ||
      (view === "top" && Math.abs(nY) > FACE_ON_COS);
    if (alongFace) {
      for (const [xp, up] of prof) pushPoint(xp, 0, up);
      return projected; // 有序、保留內凹造型
    }
    for (const yL of [-ly / 2, ly / 2]) {
      for (const [xp, up] of prof) pushPoint(xp, yL, up);
    }
    return convexHull2D(projected);
  }

  // 座板／桌面俯視輪廓（top-outline）：輪廓在 local X–Z 大面、沿 local Y（厚度）擠出。
  // 對著大面法線（旋轉後的 local Y）的視角 → 輸出有序輪廓（§A9 不跑 hull）；
  // 其他視角 → 兩端（y=±hy）採樣 hull（正/側視本來就是矩形範圍）。
  if (part.shape?.kind === "top-outline") {
    const prof = topOutlinePoints(lx, lz, part.shape.style, part.shape.sizeMm, {
      sizeZMm: part.shape.sizeZMm,
      squareness: part.shape.squareness,
      archSides: part.shape.archSides,
      lobes: part.shape.lobes,
    });
    // n = R·(0,1,0)（Rx→Ry→Rz，與 pushPoint 同序）——與 edge-profile 分支同式
    const nZ = sx * cy;                       // → front
    const nX = sx * sy * cz - cx * sz;        // → side
    const nY = sx * sy * sz + cx * cz;        // → top
    const alongFace =
      (view === "front" && Math.abs(nZ) > FACE_ON_COS) ||
      (view === "side" && Math.abs(nX) > FACE_ON_COS) ||
      (view === "top" && Math.abs(nY) > FACE_ON_COS);
    if (alongFace) {
      for (const [xp, zp] of prof) pushPoint(xp, 0, zp);
      return projected; // 有序、保留輪廓細節
    }
    for (const yL of [-ly / 2, ly / 2]) {
      for (const [xp, zp] of prof) pushPoint(xp, yL, zp);
    }
    return convexHull2D(projected);
  }

  // === Phase 3 Task 6: silhouette gap 補 ===
  // 7 種 shape 原本走 bbox 4-corner 採樣 → convex hull 給 AABB；零件圖正視/俯
  // 視看起來像方塊，看不出形狀。改用 projectPartPolygon 既有 polygon 邏輯
  // （已驗證的 shaker 6 點、notched-corners 12 點、finger-joint/dovetail comb、
  // regular-polygon N-gon、chamfered-top / face-rounded 圓角）。delegate 不影
  // 響 overlap.ts / y-slice.ts：那些 caller 只用 min/max 算 AABB，concave
  // polygon 的 min/max 跟 AABB 一樣。
  //
  // 注意：dovetail-ends 已有 user 並行 tray dovetail WIP（projectPartPolygon
  // 的 wall-left/right phase=1 合成 + projectPartPolygon comb 梯形 → 已測），
  // 這裡單純 delegate 不會破壞那條路徑。
  //
  // face-rounded / chamfered-top: 3D-only 細節（圓角 / R5-R12）在零件圖視覺
  // 影響極小（< 12mm），但 projectPartPolygon 已實作圓弧 polygon，照常 delegate。
  if (
    part.shape &&
    (part.shape.kind === "notched-corners" ||
      part.shape.kind === "finger-joint-ends" ||
      part.shape.kind === "dovetail-ends" ||
      part.shape.kind === "regular-polygon" ||
      part.shape.kind === "chamfered-top" ||
      part.shape.kind === "face-rounded")
  ) {
    return projectPartPolygon(part, view);
  }

  // hoof（馬蹄足）／ lathe-turned（車旋）：projectPartPolygon 早就有真實輪廓
  // （hoof 6 點外撇、lathe-turned 12 段車旋），silhouette 卻沒有分支，於是吃
  // 幾何資料的下游拿到一根直條矩形——中式方角櫃那四根 35×1478 的立柱在 A4 拼接
  // 模式真的會印出來（6 張），馬蹄那段在 1:1 樣板上完全不存在，照著描會做成直腳
  // （2026-08-21 盤點到，跟圓盤那個是同一類問題）。
  //
  // ⚠️ 只在「沒有旋轉」時 delegate。這兩條 polygon 分支都是 view-name 硬畫
  // （假設零件直立），橫躺的話軸向會整個不對——那正是 §A9.7 shaker 踩過的坑。
  // 帶旋轉時維持原本的通用採樣（形狀是矩形近似，但位置與 AABB 正確）。
  // 樣板路徑本來就把 rotation 歸零後才呼叫（mortise-faces / parts-svg 的
  // toLocalPart），所以這個守衛不影響它。
  if (
    part.shape &&
    (part.shape.kind === "hoof" || part.shape.kind === "lathe-turned") &&
    rx === 0 && ry === 0 && rz === 0
  ) {
    return projectPartPolygon(part, view);
  }

  // 夏克風腳：上方 squareFrac 方頂（方截面）+ 下方圓錐（圓截面 taper 到 bottomScale）。
  // projectPartPolygon 的 view-name 硬畫梯形假設 taper 沿垂直 r.h 軸，零件圖橫躺
  // （rotation.z=-π/2）時軸向不對。改在 local frame 整支採樣 → rotate → project →
  // hull，方頂在 local +Y、圓錐往 -Y 縮，任意旋轉都對（user 2026-06-16 邊桌回報）。
  if (part.shape?.kind === "shaker") {
    const SQUARE_FRAC = part.shape.squareFrac ?? 0.25;
    const BOT = part.shape.bottomScale ?? 0.6;
    const junctionY = ly / 2 - ly * SQUARE_FRAC; // 方/圓交界 local Y
    // 方頂：頂面 (+ly/2) 與交界面的 4 角（方截面）
    for (const yL of [ly / 2, junctionY]) {
      for (const xS of [-1, 1] as const) {
        for (const zS of [-1, 1] as const) {
          pushPoint((xS * lx) / 2, yL, (zS * lz) / 2);
        }
      }
    }
    // 圓錐：交界面（全徑）與腳底（縮 BOT）兩圈圓採樣
    for (const [yL, sc] of [
      [junctionY, 1],
      [-ly / 2, BOT],
    ] as const) {
      for (let i = 0; i < ROUND_SAMPLES; i++) {
        const a = (i / ROUND_SAMPLES) * Math.PI * 2;
        pushPoint(Math.sin(a) * (lx / 2) * sc, yL, Math.cos(a) * (lz / 2) * sc);
      }
    }
    return convexHull2D(projected);
  }

  // live-edge：sin 噪聲沿 length 軸（local X）讓 ±Z 兩條長邊起伏；俯視會看到
  // 波浪外緣，前/側視 silhouette 因為波在 Z 方向，front view 看不到、side view
  // 看 Z 厚度範圍會被波幅撐大一點。
  // top view = 32 段 wavy 多邊形 (~66 點)；其他 view = AABB（保留 sample loop
  // 結果，因為波幅可能讓 worldExtents 略小於實際），用 box corner sample 也夠。
  if (part.shape?.kind === "live-edge") {
    const amp = part.shape.amplitudeMm ?? 12;
    if (view === "top") {
      const N = 32;
      const hx = lx / 2;
      const hy = ly / 2;
      const hz = lz / 2;
      // Matches buildLiveEdgeGeometry in PerspectiveView.tsx
      const noise = (xLocal: number, phase: number) =>
        amp * 0.6 * Math.sin((xLocal + phase) / (lx * 0.06)) +
        amp * 0.3 * Math.sin((xLocal + phase * 1.7) / (lx * 0.035)) +
        amp * 0.1 * Math.sin((xLocal + phase * 2.3) / (lx * 0.02));
      const xs: number[] = [];
      const zPosArr: number[] = [];
      const zNegArr: number[] = [];
      for (let i = 0; i <= N; i++) {
        const xLocal = -hx + (lx * i) / N;
        const t = i / N;
        const taper = Math.sin(Math.PI * t);
        xs.push(xLocal);
        zPosArr.push(hz + noise(xLocal, 0) * taper);
        zNegArr.push(-hz - noise(xLocal, Math.PI / 3) * taper);
      }
      // 走 +Z 邊（i=0..N）→ -Z 邊（i=N..0），閉合多邊形
      for (let i = 0; i <= N; i++) {
        pushPoint(xs[i], hy, zPosArr[i]);
      }
      for (let i = N; i >= 0; i--) {
        pushPoint(xs[i], hy, zNegArr[i]);
      }
      return projected;
    }
    // front/side：波在 Z 方向。front 看 X-Y、Z 變化看不到 → AABB。
    // side 看 Z-Y、Z 變化撐大 silhouette 範圍 → 加 ±amp 給 Z 邊。
    // 落到下方 sample loop 即可（z ∈ [-lz/2, +lz/2]，amp 增量略小於 sample
    // tolerance，跑 hull 出來等同 AABB；可接受）。
    // 不 return，跌進下方主迴圈
  }

  // Round 家族（圓腳 / 圓錐腳 / 車木）長軸 = Y（thickness=腳高）的情形：圓截面
  // 在 X-Z 平面、沿 Y 擠出、taper 沿 Y 縮。主 sample loop 把圓畫在 Y-Z 平面
  // （rung/spindle 慣例＝長軸 X），對「長軸 = Y 的腳」會把腳高(70)當成圓半徑 →
  // 正視/側視投影塌成水滴狀（user 2026-06-13 圓錐腳正視畫錯）。長軸 = X 的橫桿/
  // 紡錘維持舊路徑（圓截面 Y-Z）。round-tapered 一律是腳故恆走這條。
  const longestIsY = ly >= lx && ly >= lz;
  // 圓盤（圓桌面 700×700×25、圓座板 350×350×25）：圓截面同樣在 X-Z、沿 Y 擠出，
  // 但 thickness 是**最短**邊，longestIsY 判不出來 → 掉進下面的通用 bbox 角採樣
  // → 俯視輪廓變成一個正方形。3D 跟三視圖看起來沒事，是因為 svg-views 在繪圖層
  // 自己改畫圓（projectPartPolygon 的 round 分支註解就寫著「俯視維持矩形，caller
  // 改畫圓」），但任何吃幾何資料的下游拿到的就是那個正方形——1:1 實尺樣板會照著
  // 印出一張正方形，木工描著切就是錯的（2026-08-21 抓到）。
  //
  // 判軸的正確依據不是「哪邊最長」，是「哪兩邊相等」：圓截面所在的那兩軸必然等長。
  // lx≈lz → 軸 = Y（腳、立柱、圓盤都算）；ly≈lz → 軸 = X（橫桿/紡錘，走舊路徑）。
  // 保留 longestIsY 是為了不動到「ly 最長但 lx≠lz」的橢圓截面既有行為。
  const AXIS_TOL_MM = 0.5;
  const axisIsY = Math.abs(lx - lz) <= AXIS_TOL_MM;
  if (isRound && (part.shape?.kind === "round-tapered" || longestIsY || axisIsY)) {
    const sc0 = tapered; // round-tapered 的 bottomScale；round / lathe-turned = 1
    for (const eyS of [-1, 1] as const) {
      const yL = (eyS * ly) / 2;
      // eyS=-1 = 腳底(y=-ly/2) → sc0(縮)；eyS=+1 = 腳頂 → 1.0(全寬)
      const sc = sc0 + (1 - sc0) * ((eyS + 1) / 2);
      for (let i = 0; i < ROUND_SAMPLES; i++) {
        const a = (i / ROUND_SAMPLES) * Math.PI * 2;
        pushPoint(Math.sin(a) * (lx / 2) * sc, yL, Math.cos(a) * (lz / 2) * sc);
      }
    }
    return convexHull2D(projected);
  }

  // 採樣每個 (ex, ey, ez) bbox 角，套 shape 修飾算實際 local 座標
  // 對 arch-bent 沿 ex 軸額外切 N 片
  const xSlices: number[] = arch
    ? Array.from({ length: archSegments + 1 }, (_, i) => -1 + (2 * i) / archSegments)
    : [-1, 1];
  for (const exNorm of xSlices) {
    // exNorm ∈ [-1, 1]：-1 = X 左端，+1 = X 右端
    const tArch = exNorm; // arch bend 用 (1 - tArch²) 計算
    const archDz = arch ? arch.bendMm * Math.max(0, 1 - tArch * tArch) : 0;
    for (const ey of [-1, 1] as const) {
      // 採截面：圓形 → ROUND_SAMPLES 點；方形 → ez=±1
      const samples: Array<[number, number]> = isRound
        ? Array.from({ length: ROUND_SAMPLES }, (_, i) => {
            const a = (i / ROUND_SAMPLES) * Math.PI * 2;
            return [Math.sin(a), Math.cos(a)];
          })
        : [[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([yS, zS]) => [yS, zS] as [number, number])
          .filter(([yS]) => yS === ey);
      // apron-trapezoid 帶 taperSpanMm：梯形在 −Z 邊起 span 處轉成垂直邊 → 多採一個「膝點」
      if (trap?.taperSpanMm !== undefined && trap.taperSpanMm > 0 && trap.taperSpanMm < lz && !isRound) {
        samples.push([ey, -1 + (2 * trap.taperSpanMm) / lz]);
      }
      for (const [eySamp, ezSamp] of samples) {
        // Right-triangle: 跳過缺角 (exNorm sign === triMissExSign && ezSamp sign === triMissEzSign)。
        // 剩下 3 個 X-Z 角 → convex hull 給直角三角形 silhouette。
        if (rightTri) {
          const exSign = exNorm > 0 ? +1 : -1;
          const ezSign = ezSamp > 0 ? +1 : -1;
          if (exSign === triMissExSign && ezSign === triMissEzSign) continue;
        }
        // 注意 isRound 時迴圈 ey 失效，但採樣已涵蓋整圈
        const eyEff = isRound ? eySamp : ey;
        // 底面 = ey > 0（local +Y 是底，因為 origin.y 是底，local Y 軸向 +Y 增加）
        // 等等——其實這套幾何裡 visible.thickness=Y，origin.y 是底，所以 ey=-1 是底、ey=+1 是頂?
        // 實際：local center 在 origin + extents/2，local y ∈ [-ly/2, +ly/2]，
        // 對應世界 y ∈ [origin.y, origin.y + ly]（假設無旋轉）。
        // 所以 ey=+1 = 世界 y 高 = 「上面」，ey=-1 = 「下面（origin.y 處）」
        // 但對腳/apron 來說 trap.bottomScale 是「腳底」= 世界 y 低 = ey=-1。
        // 此處沿用原 projectTiltedBoxSilhouette 慣例：ez<0 = top，ez>0 = bottom（梯形 apron 走 Z 軸）。
        // taper/splay 一般沿 Y：bottom = ey=+1（世界 +Y? 不對）...
        // 為相容原行為，taper/splay 套在 ey=+1（座標較高）= 「上面」？
        // 翻原 simple-table：腳 length=high, width=legSize, thickness=legSize；底面 = origin.y。
        // origin 是 local 中心 - extents/2 嗎？看 yOffset = origin.y + yExt/2 → origin.y = bottom，
        // local y = (ey * ly) / 2 → ey=-1 是 origin.y 處 = 「底」(地面)。
        // 所以：ey=-1 = 腳底 = bottomScale 套在這。
        // tapered 家族在底端兩軸（local X 與 local Z）同步縮，對齊 3D
        // buildTaperedGeometry 雙軸縮放（bx = hx*scale, bz = hz*scale）。歷史
        // 上 silhouette 只縮 X，三視圖跟 3D 不一致；2026-05-01 修正。
        // 對 round / round-tapered shape，eyEff 是連續 sin(angle) ∈ [-1, 1]，
        // 用 LINEAR 內插（不是 step-function isBottom），才會描出平滑梯形而
        // 非「上半全寬、下半縮」的 hexagon。對 box/4-corner samples 來說
        // eyEff=±1，線性內插結果跟 step-function 等價（0.6 vs 1）。
        const taperT = (eyEff + 1) / 2; // 0 = bottom, 1 = top
        const xScaleTaper = tapered + (1 - tapered) * taperT;
        const zScaleTaper = tapered + (1 - tapered) * taperT;
        const xScaleTrap = trap
          ? (trap.taperSpanMm !== undefined && trap.taperSpanMm > 0 && trap.taperSpanMm < lz
              // 從 −Z 邊起線性到 span 處＝bottomLengthScale，之後維持（床頭板貼錐腳：上段自由邊）
              ? trap.topLengthScale + (trap.bottomLengthScale - trap.topLengthScale) * Math.min(1, ((ezSamp + 1) / 2) * lz / trap.taperSpanMm)
              : ezSamp < 0 ? trap.topLengthScale : trap.bottomLengthScale)
          : 1;
        // splay 在頂端不偏、底端偏 dx/dz，沿 Y 線性內插（非 round 4-corner 一樣
        // 拿到 isBottom?dx:0 的端點值，convex hull 給線性中間值；round 16-sample
        // 需要每個樣本都用 (1-taperT)*dx 才不會有 step）
        const splayDx = splay ? splay.dx * (1 - taperT) : 0;
        const splayDz = splay ? splay.dz * (1 - taperT) : 0;
        // tilt-z: 頂端 (ezSamp = +1，假設 width 是高度) z 偏 topShiftMm/2，底端偏 -topShiftMm/2
        // 不過 tilt-z 多半搭 rotation 用，rotation 已轉好，這裡只需要直接位移。
        const tiltZdz = tiltZ * (ezSamp / 2);

        // Mitered-ends inset：inner Y 邊兩端往內縮 insetEach
        // visible.thickness 是 ly，所以 ey 軸 = thickness 軸
        let miterInset = 0;
        if (mitered) {
          const outerEy = mitered.outerSide === "+y" ? +1 : -1;
          // eyEff 對非 round 來說是 ey (±1)；inner = eyEff !== outerEy
          if (eyEff * outerEy < 0) {
            miterInset = exNorm > 0 ? -mitered.insetEach : +mitered.insetEach;
          }
        }
        const xLocal = (arch ? (lx * exNorm) / 2 : (exNorm * lx) / 2) * xScaleTaper * xScaleTrap
          + splayDx + miterInset;
        const yLocal = (eyEff * ly) / 2;
        // half-bevel: 只有頂面（ezSamp < 0）vertex 套 shear，底面不動
        const halfBevContribution = halfBev && ezSamp < 0 ? -yLocal * halfBevShear : 0;
        // trapezoid + half-bevel: top 套 bevShear、bot 不套（蓋掉前面的 -yLocal * bevShear）
        const trapBevAdjust = trapHalfBevel && ezSamp > 0 ? yLocal * bevShear : 0;
        const zLocal = (ezSamp * lz) / 2 * zScaleTaper + archDz + tiltZdz - yLocal * bevShear
          + halfBevContribution + trapBevAdjust + splayDz;
        // Mitered-corner：如果這個 sample 落在被削掉的角上，補兩個 inset 點代替原點。
        if (miterCorner) {
          const ax = miterCorner.axis;
          const s1Cut = miterCorner.corner[0] === "+" ? +1 : -1;
          const s2Cut = miterCorner.corner[1] === "+" ? +1 : -1;
          const d = miterCorner.depthMm;
          // 對 axis=x: cross-section in Y-Z; a1=ey, a2=ez. Check sign(eyEff)==s1Cut && sign(ezSamp)==s2Cut.
          // 對 axis=y: cross-section in X-Z; a1=ex, a2=ez. Check sign(exNorm)==s1Cut && sign(ezSamp)==s2Cut.
          // 對 axis=z: cross-section in X-Y; a1=ex, a2=ey. Check sign(exNorm)==s1Cut && sign(eyEff)==s2Cut.
          let isCutCorner = false;
          if (ax === "x") {
            isCutCorner = (eyEff > 0 ? +1 : -1) === s1Cut && (ezSamp > 0 ? +1 : -1) === s2Cut;
          } else if (ax === "y") {
            isCutCorner = (exNorm > 0 ? +1 : -1) === s1Cut && (ezSamp > 0 ? +1 : -1) === s2Cut;
          } else {
            isCutCorner = (exNorm > 0 ? +1 : -1) === s1Cut && (eyEff > 0 ? +1 : -1) === s2Cut;
          }
          if (isCutCorner) {
            // 改補兩個 inset 點：a1-extreme inset 一個、a2-extreme inset 一個
            if (ax === "x") {
              pushPoint(xLocal, s1Cut * (ly / 2 - d), s2Cut * lz / 2);
              pushPoint(xLocal, s1Cut * ly / 2, s2Cut * (lz / 2 - d));
            } else if (ax === "y") {
              pushPoint(s1Cut * (lx / 2 - d), yLocal, s2Cut * lz / 2);
              pushPoint(s1Cut * lx / 2, yLocal, s2Cut * (lz / 2 - d));
            } else {
              pushPoint(s1Cut * (lx / 2 - d), s2Cut * ly / 2, zLocal);
              pushPoint(s1Cut * lx / 2, s2Cut * (ly / 2 - d), zLocal);
            }
            continue;
          }
        }
        pushPoint(xLocal, yLocal, zLocal);
      }
    }
  }
  return convexHull2D(projected);
}

/** @deprecated 使用 projectPartSilhouette。保留別名做漸進遷移。 */
export const projectTiltedBoxSilhouette = projectPartSilhouette;

/** 標準 ray-casting point-in-polygon 測試。poly 須為閉合多邊形（首尾不需重複）。 */
export function pointInPolygon(
  p: { x: number; y: number },
  poly: Array<{ x: number; y: number }>,
): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y;
    const xj = poly[j].x, yj = poly[j].y;
    const intersect = ((yi > p.y) !== (yj > p.y)) &&
      (p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * 把一條 2D 線段 a→b 沿線採樣 N 點，每點檢查 isHidden(x,y)，相鄰同狀態合併成 segment。
 * 用來分段渲染：visible 段畫實線、hidden 段畫虛線（standard engineering hidden-line）。
 *
 * 時間 O(N) per edge；典型 N=20 對視覺夠了。
 */
export function classifyEdgeVisibility(
  a: { x: number; y: number },
  b: { x: number; y: number },
  isHiddenAt: (x: number, y: number) => boolean,
  samples: number = 20,
): Array<{ a: { x: number; y: number }; b: { x: number; y: number }; hidden: boolean }> {
  const states: boolean[] = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const x = a.x + (b.x - a.x) * t;
    const y = a.y + (b.y - a.y) * t;
    states.push(isHiddenAt(x, y));
  }
  const segs: Array<{ a: { x: number; y: number }; b: { x: number; y: number }; hidden: boolean }> = [];
  let i = 0;
  while (i < samples) {
    const startT = i / samples;
    const startHidden = states[i];
    let j = i;
    // 往後合併同狀態
    while (j < samples && states[j + 1] === startHidden) j++;
    // bug fix: j 可遞增到 samples，再 +1 / samples 會 > 1（extrapolate 5% 過頭，
    // 讓沒遮擋的邊向外延伸 1.75mm），改 clamp 到 samples 上限
    const endT = Math.min(j + 1, samples) / samples;
    segs.push({
      a: { x: a.x + (b.x - a.x) * startT, y: a.y + (b.y - a.y) * startT },
      b: { x: a.x + (b.x - a.x) * endT, y: a.y + (b.y - a.y) * endT },
      hidden: startHidden,
    });
    i = j + 1;
  }
  return segs;
}

/**
 * 預先算好「擋住別人」的零件 silhouette + depth，讓後續每條邊查 hidden 時用 closure 加速。
 * 回傳 isHiddenAt(x, y)，給 thisPart 的某條 edge 上的點查用。
 */
export function makeHiddenChecker(
  thisPart: Part,
  allParts: Part[],
  view: OrthoView,
): (x: number, y: number) => boolean {
  // SVG 渲染後 y 軸會 flip，但 polygon 點都在同一座標系所以一致
  const thisNear = partDepth(thisPart, view).near;
  const blockers: Array<{ poly: Array<{ x: number; y: number }>; near: number }> = [];
  for (const other of allParts) {
    if (other.id === thisPart.id) continue;
    const otherNear = partDepth(other, view).near;
    // 必須比 thisPart 更靠近鏡頭才能擋住
    if (otherNear <= thisNear + 0.5) continue;
    const poly = projectPartSilhouette(other, view);
    if (poly.length < 3) continue;
    blockers.push({ poly, near: otherNear });
  }
  return (x: number, y: number) => {
    for (const b of blockers) {
      if (pointInPolygon({ x, y }, b.poly)) return true;
    }
    return false;
  };
}

/** Andrew's monotone chain — 2D convex hull, CCW order. */
export function convexHull2D(
  pts: Array<{ x: number; y: number }>,
): Array<{ x: number; y: number }> {
  if (pts.length < 3) return pts;
  const sorted = [...pts].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (
    o: { x: number; y: number },
    a: { x: number; y: number },
    b: { x: number; y: number },
  ) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: Array<{ x: number; y: number }> = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: Array<{ x: number; y: number }> = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  upper.pop();
  lower.pop();
  return lower.concat(upper);
}

/** 偵測零件是否有非 quarter（非 90° 倍數）的旋轉。 */
export function hasNonQuarterRotation(part: Part): boolean {
  const eps = 0.01;
  const isQuarter = (a: number) => {
    const m = Math.abs(((a % (Math.PI / 2)) + Math.PI / 2) % (Math.PI / 2));
    return m < eps || Math.PI / 2 - m < eps;
  };
  return (
    !isQuarter(part.rotation?.x ?? 0) ||
    !isQuarter(part.rotation?.y ?? 0) ||
    !isQuarter(part.rotation?.z ?? 0)
  );
}

/**
 * 2D silhouette of a part for the given orthographic view.
 * Origin convention: part.origin.y is bottom of the part; x/z are centered.
 * Returned rect is in **world coords** (not yet flipped for SVG Y-down).
 */
export function projectPart(part: Part, view: OrthoView) {
  const { x, y, z } = part.origin;
  const { xExt, yExt, zExt } = worldExtents(part);
  // Mirror X for front + top so they match the 3D camera convention
  // (world +X appears on the screen LEFT). Side view 第三角法右側視圖：
  // viewer 在 +X 看 -X，前面（-Z）落在 SVG +x（右）→ SVG x = -wz、bbox
  // span 從 -(z + zExt/2) 到 -(z - zExt/2)。
  if (view === "front") return { x: -x - xExt / 2, y, w: xExt, h: yExt };
  if (view === "side") return { x: -z - zExt / 2, y, w: zExt, h: yExt };
  return { x: -x - xExt / 2, y: z - zExt / 2, w: xExt, h: zExt };
}

/**
 * Depth range of a part along the view axis, normalized so `near > far`
 * (larger value = closer to viewer).
 *
 * Viewer positions (derived from template conventions — front of furniture
 * faces -Z; the 3D camera is on +Z looking at the back, so the drafting
 * "front view" is the opposite face):
 *   front view → viewer at -Z (drawer fronts at min-z are closest)
 *   side view  → viewer at +X (right-side in conventional drafting)
 *   top view   → viewer at +Y
 */
export function partDepth(part: Part, view: OrthoView) {
  const { x, y, z } = part.origin;
  const { xExt, yExt, zExt } = worldExtents(part);
  if (view === "front") return { near: -(z - zExt / 2), far: -(z + zExt / 2) };
  if (view === "side") return { near: x + xExt / 2, far: x - xExt / 2 };
  return { near: y + yExt, far: y };
}

/**
 * 2D silhouette polygon for a part. Returns 4 points (top-left, top-right,
 * bottom-right, bottom-left) in *world* coords. For "tapered" parts, top
 * face uses visible width but bottom face is scaled. Y axis is world-up
 * (no flip) — caller flips for SVG.
 *
 * `allParts` (optional)：給跨 part 推理用。tray dovetail 接合下，前後板
 * 掛 `dovetail-ends` shape (phase=0 tail)、左右板沒 shape（3D 走 CSG 挖洞）
 * ——SVG 三視圖看不到鳩尾凹槽。這裡偵測「pin board 卻沒 shape」case，從
 * 同 design 的 tail board 借 segmentCount/angleDeg/pinDepth/halfPin，合成
 * phase=1 dovetail-ends shape 接到既有 comb 邏輯，跑出「外寬內窄」梯形
 * notch 進 box（拼接後互嵌）。
 */
export function projectPartPolygon(
  part: Part,
  view: OrthoView,
  allParts?: ReadonlyArray<Part>,
): Array<{ x: number; y: number }> {
  const r = projectPart(part, view);
  // Default box polygon (rectangle, tracing CCW in world-Y-up coords).
  const box = [
    { x: r.x, y: r.y + r.h },       // top-left
    { x: r.x + r.w, y: r.y + r.h }, // top-right
    { x: r.x + r.w, y: r.y },       // bottom-right
    { x: r.x, y: r.y },             // bottom-left
  ];

  // 鳩尾接合 pin board synthesis：兩種 case 都需要 phase=1 梯形 notch:
  //   tray:   tail board = wall-front/back（有 shape）、pin board = wall-left/right
  //   drawer: tail board = -side-left/right（有 shape）、pin board = -N-front / -N-back
  // 借 donor 的 N/angle/depth/halfPin → 對面 trapezoid notch 嵌進 tail tooth。
  if (
    (!part.shape || part.shape.kind === "box") &&
    (/^wall-(left|right)$/.test(part.id) ||
      /-\d+-(front|back)$/.test(part.id)) &&
    allParts
  ) {
    // ⭐ donor 必須取「同一個抽屜」的側板，否則跨抽屜抓到不同高度→不同 segmentCount
    // 的側板，前後板齒數跟自己側板對不上（user 2026-06-13：側板 3 公榫、前後板卻
    // 4 缺口）。drawer front/back id = "<prefix>-front/back"、同抽屜側板 =
    // "<prefix>-side-left/right"；先找同 prefix，找不到再 fallback 第一個（tray
    // wall-left/right 走 fallback，因為只有一組）。
    const drawerPrefix = part.id.replace(/-(front|back)$/, "");
    const donor =
      allParts.find(
        (p) =>
          p.shape?.kind === "dovetail-ends" &&
          (p.id === `${drawerPrefix}-side-left` ||
            p.id === `${drawerPrefix}-side-right`),
      ) ??
      allParts.find(
        (p) => p.shape?.kind === "dovetail-ends" && p.id !== part.id,
      );
    if (donor && donor.shape?.kind === "dovetail-ends") {
      part = {
        ...part,
        shape: {
          kind: "dovetail-ends",
          segmentCount: donor.shape.segmentCount,
          phase: 1,
          angleDeg: donor.shape.angleDeg,
          pinDepth: donor.shape.pinDepth,
          halfPin: donor.shape.halfPin,
        },
      };
    }
  }

  // 四周底邊搭接槽（嵌入式盒蓋 rabbeted lid）：側 / 正視（看得到端面厚度的視圖）
  // 輪廓畫成 L 階梯——上層 = 滿尺寸 cap、下層 = 縮 widthMm 的凸唇（plug，深 depthMm）。
  // 俯視（看面）維持矩形，rebate 由 cosmetic mortise 虛線表示（隱藏線慣例）。
  // shape 仍是 box（3D 走 CSG），所以放在 box early-return 之前判斷。
  if (part.peripheralRebate && view !== "top") {
    const rebW = Math.max(0, Math.min(part.peripheralRebate.widthMm, r.w * 0.45));
    const stepY = Math.max(0, Math.min(part.peripheralRebate.depthMm, r.h * 0.9));
    if (rebW > 0.5 && stepY > 0.5) {
      // plug 在底部（低 Y）；CCW（Y-up）描出滿寬 cap + 縮窄 plug
      return [
        { x: r.x, y: r.y + r.h },
        { x: r.x + r.w, y: r.y + r.h },
        { x: r.x + r.w, y: r.y + stepY },
        { x: r.x + r.w - rebW, y: r.y + stepY },
        { x: r.x + r.w - rebW, y: r.y },
        { x: r.x + rebW, y: r.y },
        { x: r.x + rebW, y: r.y + stepY },
        { x: r.x, y: r.y + stepY },
      ];
    }
  }

  if (!part.shape || part.shape.kind === "box") return box;

  // 弧肩斜腳（curved-taper）：正視畫側面輪廓（接撐段全寬 → 內凹弧肩 → 斜降），
  // 側視為矩形（Z 面全寬不收）→ box。俯視在 svg-views useShape 不納入 → 走 box path。
  // 帶旋轉（零件圖橫躺）→ delegate 給 silhouette（3D 採樣→旋轉→投影），比照 tapered 先例。
  // ⚠️ 不 delegate 給 projectPartSilhouette 的 hull 路徑（會填平凹弧）；正視直接輸出有序輪廓。
  // 牙板／橫撐造型邊：一律走 silhouette（造型件必帶 rotation x=π/2，silhouette 分支
  // 會對正視輸出有序輪廓、其他視角 hull；比照 curved-taper 帶旋轉的 delegate 先例）。
  if (part.shape.kind === "edge-profile") {
    return projectPartSilhouette(part, view);
  }

  // 座板／桌面俯視輪廓：一律走 silhouette（俯視輸出有序輪廓、正/側視 hull 出矩形範圍）。
  if (part.shape.kind === "top-outline") {
    return projectPartSilhouette(part, view);
  }

  if (part.shape.kind === "curved-taper") {
    const hasRotCT =
      (part.rotation?.x ?? 0) !== 0 ||
      (part.rotation?.y ?? 0) !== 0 ||
      (part.rotation?.z ?? 0) !== 0;
    if (hasRotCT) return projectPartSilhouette(part, view);
    const ctDx2 = part.shape.dxMm ?? 0;
    const ctDz2 = part.shape.dzMm ?? 0;
    // 側/俯視:無外斜=矩形(box);有外斜=傾斜形,delegate silhouette(hull 出傾斜四邊形,
    // 凹弧本來就朝 X、側視看不到,無細節損失)。
    /**
     * 兩向弧肩（§A9.9）：−Z 那面也有弧肩 → 側視也要畫輪廓，不能回 box。
     * 用同一條輪廓函式，寬度基準換成 width（local Z）。
     */
    if (view === "side" && part.shape.twoWay) {
      const cxS = r.x + r.w / 2;
      const midYS = r.y + r.h / 2;
      const lyS = part.visible.thickness;
      const dirZS = (part.shape.dirZ ?? 1) as -1 | 0 | 1;
      const profS = curvedTaperProfilePoints(
        part.visible.width, lyS,
        part.shape.blockHeightMm, part.shape.shoulderMm, part.shape.insetMm, dirZS, part.shape.lowerCove, part.shape.sCurve,
      );
      return profS.map(([lzp, lyp]) => {
        const t = (lyS / 2 - lyp) / lyS;
        return { x: cxS - (lzp + ctDz2 * t), y: midYS + lyp };
      });
    }
    if (view !== "front") return ctDx2 !== 0 || ctDz2 !== 0 ? projectPartSilhouette(part, view) : box;
    const cx = r.x + r.w / 2;
    const midY = r.y + r.h / 2;
    // 正視 svg x = -wx（世界 +X → 螢幕左），故 screenX = cx - localX（與 box mirror 一致）。
    const prof = curvedTaperProfilePoints(
      part.visible.length, part.visible.thickness,
      part.shape.blockHeightMm, part.shape.shoulderMm, part.shape.insetMm, part.shape.dir, part.shape.lowerCove, part.shape.sCurve,
    );
    const lyCT = part.visible.thickness;
    // 外斜 shear:local 頂(+ly/2)固定、底(-ly/2)外移 ctDx2(螢幕 X 鏡像 → 減號方向一致)
    return prof.map(([lxp, lyp]) => {
      const t = (lyCT / 2 - lyp) / lyCT;
      return { x: cx - (lxp + ctDx2 * t), y: midY + lyp };
    });
  }

  // 帶頂緣/下緣倒角的圓盤（圓凳座板）：俯視維持矩形（caller 改畫圓），前/側視
  // 矩形 + 頂面 2 角倒角（chamferMm）+ 下緣 2 角倒角（bottomChamferMm）。
  if (part.shape.kind === "round" && ((part.shape.chamferMm ?? 0) > 0 || (part.shape.bottomChamferMm ?? 0) > 0)) {
    if (view === "top") return box;
    const cTop = Math.min(part.shape.chamferMm ?? 0, r.h * 0.45, r.w * 0.45);
    const cBot = part.shape.bottomChamferMm
      ? Math.min(part.shape.bottomChamferMm, r.h * 0.45, r.w * 0.45)
      : 0;
    if (cTop <= 0 && cBot <= 0) return box;
    const rounded = part.shape.chamferStyle === "rounded";
    if (rounded) {
      const segs = 4;
      const arc = (cx: number, cy: number, c: number, t0: number, t1: number) => {
        const pts: Array<{ x: number; y: number }> = [];
        for (let i = 0; i <= segs; i++) {
          const t = t0 + ((t1 - t0) * i) / segs;
          pts.push({ x: cx + c * Math.cos(t), y: cy + c * Math.sin(t) });
        }
        return pts;
      };
      const pts: Array<{ x: number; y: number }> = [];
      pts.push(...arc(r.x + r.w - cTop, r.y + r.h - cTop, cTop, 0, Math.PI / 2));
      pts.push(...arc(r.x + cTop, r.y + r.h - cTop, cTop, Math.PI / 2, Math.PI));
      // BL 下倒角：cBot > 0 → 圓弧，否則直角點
      if (cBot > 0) {
        pts.push(...arc(r.x + cBot, r.y + cBot, cBot, Math.PI, (3 * Math.PI) / 2));
      } else {
        pts.push({ x: r.x, y: r.y });
      }
      // BR 下倒角：cBot > 0 → 圓弧，否則直角點
      if (cBot > 0) {
        pts.push(...arc(r.x + r.w - cBot, r.y + cBot, cBot, (3 * Math.PI) / 2, 2 * Math.PI));
      } else {
        pts.push({ x: r.x + r.w, y: r.y });
      }
      return pts;
    }
    return [
      { x: r.x + cTop, y: r.y + r.h },
      { x: r.x + r.w - cTop, y: r.y + r.h },
      { x: r.x + r.w, y: r.y + r.h - cTop },
      { x: r.x + r.w, y: r.y + cBot },
      { x: r.x + r.w - cBot, y: r.y },
      { x: r.x + cBot, y: r.y },
      { x: r.x, y: r.y + cBot },
      { x: r.x, y: r.y + r.h - cTop },
    ];
  }

  // live-edge 原木邊：silhouette 已有 32 段波浪 top 投影（其他視角 AABB），
  // 直接 delegate（user 2026-06-12 矮桌排查——polygon 層沒分支會落到 box）
  if (part.shape.kind === "live-edge") {
    return projectPartSilhouette(part, view);
  }

  // Taper only applies when the part stands vertically (length/thickness →
  // world Y). 俯視在無倒角時用 box；有倒角時畫八邊形 cross-section
  // （與 chamfered-edges 同 convention）。前/側視仍是梯形（倒角只在 cross-
  // section view 顯示，跟 chamfered-edges 邏輯一致）。
  if (part.shape.kind === "tapered") {
    const hasRotTaper =
      (part.rotation?.x ?? 0) !== 0 ||
      (part.rotation?.y ?? 0) !== 0 ||
      (part.rotation?.z ?? 0) !== 0;
    if (hasRotTaper) {
      // 零件圖 isolate 橫躺（Rz=-π/2 等）：下面的梯形/八邊形是「直立腳」
      // view-name 硬畫（頂邊全寬、底邊縮）——橫躺後收縮其實沿世界 X 漸變，
      // 硬畫變成 375→206 的怪梯形（user 2026-06-11 茶几錐形腳零件卡回報）。
      // delegate 給 projectPartSilhouette（3D 頂點採樣→旋轉→投影，任意旋轉
      // 都對）。splayed 分支同款先例。
      return projectPartSilhouette(part, view);
    }
    const chamferMm = part.shape.chamferMm ?? 0;
    if (view === "top") {
      if (chamferMm <= 0) return box;
      const cap = Math.min(chamferMm, r.w * 0.45, r.h * 0.45);
      if (cap <= 0) return box;
      return [
        { x: r.x + cap, y: r.y + r.h },
        { x: r.x + r.w - cap, y: r.y + r.h },
        { x: r.x + r.w, y: r.y + r.h - cap },
        { x: r.x + r.w, y: r.y + cap },
        { x: r.x + r.w - cap, y: r.y },
        { x: r.x + cap, y: r.y },
        { x: r.x, y: r.y + cap },
        { x: r.x, y: r.y + r.h - cap },
      ];
    }
    const scale = part.shape.bottomScale;
    const cx = (r.x + r.x + r.w) / 2;
    const halfTop = r.w / 2;
    const halfBot = halfTop * scale;
    return [
      { x: cx - halfTop, y: r.y + r.h },
      { x: cx + halfTop, y: r.y + r.h },
      { x: cx + halfBot, y: r.y },
      { x: cx - halfBot, y: r.y },
    ];
  }

  if (part.shape.kind === "splayed") {
    const hasRot =
      (part.rotation?.x ?? 0) !== 0 ||
      (part.rotation?.y ?? 0) !== 0 ||
      (part.rotation?.z ?? 0) !== 0;
    if (view === "top" && hasRot) {
      // 零件圖橫躺：local splay 經 rotation 後軸別變，delegate 給 silhouette
      return projectPartSilhouette(part, view);
    }
    if (view === "top") {
      // 俯視：頂面 box + 底面偏移 (Dx, Dy) 的聯合輪廓。
      // box 軸別：x = world -X（mirror）, y = world Z。
      // dxMm = world +X 底偏移 → polygon -dxMm
      // dzMm = world +Z 底偏移 → polygon +dzMm
      const Dx = -(part.shape.dxMm ?? 0);
      const Dy = part.shape.dzMm ?? 0;
      if (Dx === 0 && Dy === 0) return box;
      // 8 corners (top face + shifted bottom face)，convex hull → 平行四邊形/六邊形。
      const corners = [
        { x: r.x, y: r.y + r.h },
        { x: r.x + r.w, y: r.y + r.h },
        { x: r.x + r.w, y: r.y },
        { x: r.x, y: r.y },
        { x: r.x + Dx, y: r.y + r.h + Dy },
        { x: r.x + r.w + Dx, y: r.y + r.h + Dy },
        { x: r.x + r.w + Dx, y: r.y + Dy },
        { x: r.x + Dx, y: r.y + Dy },
      ];
      // Andrew's monotone chain convex hull
      const pts = corners.slice().sort((a, b) => a.x - b.x || a.y - b.y);
      const cross = (
        o: { x: number; y: number },
        a: { x: number; y: number },
        b: { x: number; y: number },
      ) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
      const lower: Array<{ x: number; y: number }> = [];
      for (const p of pts) {
        while (
          lower.length >= 2 &&
          cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0
        )
          lower.pop();
        lower.push(p);
      }
      const upper: Array<{ x: number; y: number }> = [];
      for (let i = pts.length - 1; i >= 0; i--) {
        const p = pts[i];
        while (
          upper.length >= 2 &&
          cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0
        )
          upper.pop();
        upper.push(p);
      }
      upper.pop();
      lower.pop();
      return lower.concat(upper);
    }
    // 旋轉的 splayed part（零件圖橫躺）── 原本 hardcoded 路徑把 offset 套在
    // r.h 軸,等於把 30mm 偏移擠進 35mm cross-section 高度,slant 變 40° 暴斜。
    // 改 delegate 給 projectPartSilhouette,讓它跑 local-frame 變形 + rotation
    // + 投影,slant 自然套到旋轉後正確的軸上（4° 真實傾角）。
    const hasRotation =
      (part.rotation?.x ?? 0) !== 0 ||
      (part.rotation?.y ?? 0) !== 0 ||
      (part.rotation?.z ?? 0) !== 0;
    if (hasRotation) {
      return projectPartSilhouette(part, view);
    }
    // Non-rotated 既有路徑：平行四邊形（足端 X 偏 dxMm 或 dzMm）
    // Front view: svg x = -wx → 底偏 +dxMm（世界）= 螢幕 -dxMm
    // Side view: 前=右慣例 svg x = -wz → 底偏 +dzMm（世界）= 螢幕 -dzMm
    const offset =
      view === "front" ? -part.shape.dxMm : -part.shape.dzMm;
    return [
      { x: r.x, y: r.y + r.h },
      { x: r.x + r.w, y: r.y + r.h },
      { x: r.x + r.w + offset, y: r.y },
      { x: r.x + offset, y: r.y },
    ];
  }

  if (part.shape.kind === "hoof") {
    if (view === "top") return box;
    const flareY = r.y + part.shape.hoofMm;
    const cx = (r.x + r.x + r.w) / 2;
    const halfN = r.w / 2;
    const halfF = halfN * part.shape.hoofScale;
    return [
      { x: cx - halfN, y: r.y + r.h },
      { x: cx + halfN, y: r.y + r.h },
      { x: cx + halfN, y: flareY },
      { x: cx + halfF, y: r.y },
      { x: cx - halfF, y: r.y },
      { x: cx - halfN, y: flareY },
    ];
  }

  // 圓錐腳：silhouette 跟方錐腳一樣是梯形（俯視仍是矩形 bbox，由 svg-views 改畫圓）
  if (part.shape.kind === "round-tapered") {
    if (
      (part.rotation?.x ?? 0) !== 0 ||
      (part.rotation?.y ?? 0) !== 0 ||
      (part.rotation?.z ?? 0) !== 0
    ) {
      // 零件圖橫躺：view-name 硬畫的梯形軸向不對（同 tapered 分支），
      // delegate 給 silhouette（任意旋轉都對）
      return projectPartSilhouette(part, view);
    }
    if (view === "top") return box;
    const scale = part.shape.bottomScale;
    const cx = (r.x + r.x + r.w) / 2;
    const halfTop = r.w / 2;
    const halfBot = halfTop * scale;
    return [
      { x: cx - halfTop, y: r.y + r.h },
      { x: cx + halfTop, y: r.y + r.h },
      { x: cx + halfBot, y: r.y },
      { x: cx - halfBot, y: r.y },
    ];
  }

  // 外斜方錐 / 圓錐腳：silhouette 是 tapered 梯形 + 底部偏移（splay）
  if (
    part.shape.kind === "splayed-tapered" ||
    part.shape.kind === "splayed-round-tapered"
  ) {
    if (view === "top") return box;
    const scale = part.shape.bottomScale;
    // 同 splayed：side view 走「前=右」慣例 svg x = -wz → dzMm 要負號
    const offset =
      view === "front" ? -part.shape.dxMm : -part.shape.dzMm;
    const cx = (r.x + r.x + r.w) / 2;
    const halfTop = r.w / 2;
    const halfBot = halfTop * scale;
    return [
      { x: cx - halfTop, y: r.y + r.h },
      { x: cx + halfTop, y: r.y + r.h },
      { x: cx + halfBot + offset, y: r.y },
      { x: cx - halfBot + offset, y: r.y },
    ];
  }

  // 夏克風腳：上方 squareFrac 方頂 + 下方圓錐（bottomScale）
  // 前/側視 silhouette = 矩形上半 + 梯形下半的疊加
  if (part.shape.kind === "shaker") {
    if (
      (part.rotation?.x ?? 0) !== 0 ||
      (part.rotation?.y ?? 0) !== 0 ||
      (part.rotation?.z ?? 0) !== 0
    ) {
      // 零件圖橫躺：下面 view-name 硬畫的方頂+圓錐梯形軸向不對（taper 被擠進
      // r.h cross-section，整支變沙漏/兩端全高，user 2026-06-16 邊桌夏克腳回報），
      // delegate 給 silhouette（3D sample → rotate → project，任意旋轉都對）。
      return projectPartSilhouette(part, view);
    }
    if (view === "top") return box;
    const SQUARE_FRAC = part.shape.squareFrac ?? 0.25;
    const TAPER_BOT_SCALE = part.shape.bottomScale ?? 0.6;
    const cx = (r.x + r.x + r.w) / 2;
    const halfFull = r.w / 2;
    const halfBot = halfFull * TAPER_BOT_SCALE;
    const splitY = r.y + r.h * (1 - SQUARE_FRAC);
    return [
      { x: cx - halfFull, y: r.y + r.h },
      { x: cx + halfFull, y: r.y + r.h },
      { x: cx + halfFull, y: splitY },
      { x: cx + halfBot, y: r.y },
      { x: cx - halfBot, y: r.y },
      { x: cx - halfFull, y: splitY },
    ];
  }

  // 車旋腳：silhouette 順著 cone-frustum 段組的輪廓畫
  // 段定義跟 PerspectiveView.LATHE_TURNED_SEGMENTS 必須一致
  if (part.shape.kind === "lathe-turned") {
    if (view === "top") return box;
    const cx = (r.x + r.x + r.w) / 2;
    const halfFull = r.w / 2;
    // [topRScale, botRScale, hFrac]
    const segments: Array<[number, number, number]> = [
      [1.0, 1.0, 0.05],
      [1.0, 1.10, 0.04],
      [1.10, 1.0, 0.04],
      [1.0, 0.55, 0.10],
      [0.55, 0.78, 0.18],
      [0.78, 0.55, 0.20],
      [0.55, 0.50, 0.10],
      [0.50, 0.95, 0.10],
      [0.95, 0.85, 0.05],
      [0.85, 0.95, 0.06],
      [0.95, 0.95, 0.05],
      [0.95, 0.80, 0.03],
    ];
    const right: Array<{ x: number; y: number }> = [];
    const left: Array<{ x: number; y: number }> = [];
    let yCursor = r.y + r.h;
    for (const [topR, botR, hFrac] of segments) {
      const segH = r.h * hFrac;
      right.push({ x: cx + halfFull * topR, y: yCursor });
      right.push({ x: cx + halfFull * botR, y: yCursor - segH });
      left.unshift({ x: cx - halfFull * topR, y: yCursor });
      left.unshift({ x: cx - halfFull * botR, y: yCursor - segH });
      yCursor -= segH;
    }
    return [...right, ...left];
  }

  // 4 條長邊倒角（腳 / 橫撐）：在「沿最長軸看過去」的那個視圖才看得到截角
  // chamfered → 八邊形截面；rounded → 多段近似圓角
  if (part.shape.kind === "chamfered-edges") {
    const c = part.shape.chamferMm;
    if (c <= 0) return box;
    const { xExt, yExt, zExt } = worldExtents(part);
    // 找世界座標下的最長軸
    const axes: Array<["x" | "y" | "z", number]> = [
      ["x", xExt],
      ["y", yExt],
      ["z", zExt],
    ];
    axes.sort((a, b) => b[1] - a[1]);
    const longestAxis = axes[0][0];
    // 截面視圖 = 沿最長軸看過去的那個（front 沿 Z、side 沿 X、top 沿 Y）
    const crossView = longestAxis === "x" ? "side" : longestAxis === "y" ? "top" : "front";
    if (view !== crossView) return box;
    const cap = Math.min(c, r.w * 0.45, r.h * 0.45);
    if (cap <= 0) return box;
    if (part.shape.style !== "rounded") {
      // 八邊形（4 角各斜切）
      return [
        { x: r.x + cap, y: r.y + r.h },
        { x: r.x + r.w - cap, y: r.y + r.h },
        { x: r.x + r.w, y: r.y + r.h - cap },
        { x: r.x + r.w, y: r.y + cap },
        { x: r.x + r.w - cap, y: r.y },
        { x: r.x + cap, y: r.y },
        { x: r.x, y: r.y + cap },
        { x: r.x, y: r.y + r.h - cap },
      ];
    }
    // 圓角：4 個四分圓弧（每個 4 段）— 共 16 段，視覺上接近圓角
    const segs = 4;
    const arc = (cx: number, cy: number, t0: number, t1: number) => {
      const pts: Array<{ x: number; y: number }> = [];
      for (let i = 0; i <= segs; i++) {
        const t = t0 + ((t1 - t0) * i) / segs;
        pts.push({ x: cx + cap * Math.cos(t), y: cy + cap * Math.sin(t) });
      }
      return pts;
    };
    return [
      ...arc(r.x + r.w - cap, r.y + r.h - cap, 0, Math.PI / 2),
      ...arc(r.x + cap, r.y + r.h - cap, Math.PI / 2, Math.PI),
      ...arc(r.x + cap, r.y + cap, Math.PI, (3 * Math.PI) / 2),
      ...arc(r.x + r.w - cap, r.y + cap, (3 * Math.PI) / 2, 2 * Math.PI),
    ];
  }

  // 沿 Z 傾斜長條（椅背直料）：side view 畫平行四邊形，front view 畫直立矩形
  // （厚度=slatT 在 X 方向；高度=baseHeightMm；頂端往 +Z 偏 topShiftMm）
  if (part.shape.kind === "tilt-z") {
    const topShift = part.shape.topShiftMm;
    const baseH = part.shape.baseHeightMm;
    const slatT = part.visible.thickness;
    const yBot = part.origin.y + (part.visible.width - baseH) / 2;
    const yTop = yBot + baseH;
    if (view === "side") {
      // 投影 X = -world Z（前=右慣例）；底面中心 z = origin.z - topShift/2，頂面 z = origin.z + topShift/2
      const zBotCenter = -(part.origin.z - topShift / 2);
      const zTopCenter = -(part.origin.z + topShift / 2);
      return [
        { x: zTopCenter - slatT / 2, y: yTop },     // top-left
        { x: zTopCenter + slatT / 2, y: yTop },     // top-right
        { x: zBotCenter + slatT / 2, y: yBot },     // bottom-right
        { x: zBotCenter - slatT / 2, y: yBot },     // bottom-left
      ];
    }
    if (view === "front") {
      // 投影 X = -world X（鏡像）；長條沿 X 軸寬度 = visible.length
      const xCenter = -part.origin.x;
      const halfL = part.visible.length / 2;
      return [
        { x: xCenter - halfL, y: yTop },
        { x: xCenter + halfL, y: yTop },
        { x: xCenter + halfL, y: yBot },
        { x: xCenter - halfL, y: yBot },
      ];
    }
    // top view：tilt-z slat 的 cross-section（20×20）在底部沿 Z 偏移到頂部
    // 偏 topShiftMm。default box 用 AABB 把整個 Z 跨距畫進去（20×(20+topShiftMm)），
    // 視覺上像被拉長 90°。改畫底面 cross-section（slat 接座板的位置），俯視只看
    // slat 落在座板的孔位、不再被 tilt 拉長。
    const xCenter = -part.origin.x;
    const halfL = part.visible.length / 2;
    // 底面 z 中心 = origin.z - topShift/2（slat originZ 是中軸、+topShift/2 推到頂面）
    // 俯視 y = -world Z（top view r.y = z - zExt/2 慣例），底面 z = origin.z - topShift/2
    const zBotCenter = part.origin.z - topShift / 2;
    const halfT = slatT / 2;
    return [
      { x: xCenter - halfL, y: zBotCenter + halfT },  // back (Z+)
      { x: xCenter + halfL, y: zBotCenter + halfT },
      { x: xCenter + halfL, y: zBotCenter - halfT },  // front (Z-)
      { x: xCenter - halfL, y: zBotCenter - halfT },
    ];
  }

  // 弧形彎料（椅背頂橫木向後彎）側視：沿 worldX 看不到 length；silhouette =
  // 各段 X 的 cross-section union，等於把後緣（+Z 方向）整體外推 bendMm。
  // 前=右慣例下，r.x 是後緣（SVG 左），r.x+r.w 是前緣（SVG 右）→ bend
  // 把後緣再往 SVG 左（-bend）外推；前緣不動。
  if (part.shape.kind === "arch-bent" && view === "side") {
    const bend = part.shape.bendMm;
    if (Math.abs(bend) < 0.5) return box;
    const xBack = r.x - bend;
    const xFront = r.x + r.w;
    const yBot = r.y;
    const yTop = r.y + r.h;
    return [
      { x: xFront, y: yTop },
      { x: xBack, y: yTop },
      { x: xBack, y: yBot },
      { x: xFront, y: yBot },
    ];
  }

  // 弧形彎料（椅背頂橫木向後彎）：俯視畫弧線輪廓，前/側視仍是矩形
  if (part.shape.kind === "arch-bent" && view === "top") {
    const bend = part.shape.bendMm;
    if (Math.abs(bend) < 0.5) return box;
    const SAMPLES = part.shape.segments ?? 16;
    // box r 是 X-Z bbox in projected coords (top view: x = -worldX, y = worldZ)
    // length 沿 worldX → 投影 x 軸（取負）。寬度沿 worldZ → 投影 y 軸。
    // 沿料的長軸（projected x）每段算 z 偏移。
    // 用 box r 來定座標，bend 在 worldZ 方向 → 投影 y 軸。
    const xL = r.x;
    const xR = r.x + r.w;
    const yFront = r.y;       // 前緣 = z 小那側
    const yBack = r.y + r.h;  // 背緣 = z 大那側
    // bend > 0 表示往 +Z 凸（背後彎）→ 在 top view 投影 y 變大
    const front: Array<{x: number; y: number}> = [];
    const back: Array<{x: number; y: number}> = [];
    for (let i = 0; i <= SAMPLES; i++) {
      const u = i / SAMPLES;     // [0, 1]
      const t = 2 * u - 1;       // [-1, 1]
      const xc = xL + (xR - xL) * u;
      const dy = bend * Math.max(0, 1 - t * t);
      front.push({ x: xc, y: yFront + dy });
      back.push({ x: xc, y: yBack + dy });
    }
    return [...front, ...back.reverse()];
  }

  // 45° 斜接壁：交給 silhouette pipeline（已含 rotation + origin 投影），
  // 才能正確處理 4 壁不同 rotation/outerSide 組合。
  if (part.shape.kind === "mitered-ends") {
    return projectPartSilhouette(part, view);
  }

  // 正多邊形板：俯視 N 邊形 outline；前/側視 bbox 矩形
  if (part.shape.kind === "regular-polygon" && view === "top") {
    const N = Math.max(3, Math.floor(part.shape.sides));
    const R = part.shape.outerRadius;
    const angleOffset = ((part.shape.angleOffsetDeg ?? (90 + 180 / N)) * Math.PI) / 180;
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h / 2;
    const pts: Array<{ x: number; y: number }> = [];
    for (let i = 0; i < N; i++) {
      const ang = angleOffset + (i * 2 * Math.PI) / N;
      pts.push({ x: cx - R * Math.cos(ang), y: cy + R * Math.sin(ang) });
    }
    return pts;
  }

  // 指接壁：在「broad face」視角（length × width 二軸都進 view，thickness 在
  // 深度）才畫 comb；end-face / edge-face（含 thickness）回 bbox。
  // - 安裝視圖：壁有 rotation.x=π/2 把 width 翻到 world Y → front view r.h=W
  // - 零件圖（isolatePartId reset rotation=0）：top view 才看得到 broad face
  //   → top r.h=W；以前 hardcode `view==="top" return box` 直接把零件圖的鳩尾
  //   teeth 全切掉、變純矩形（BUG）
  if (part.shape.kind === "finger-joint-ends") {
    const L = part.visible.length;
    const W = part.visible.width;
    const eps = 0.5;
    const N = Math.max(2, Math.floor(part.shape.segmentCount));
    const phase = part.shape.phase;
    const depth = part.shape.fingerDepth;
    const isFinger = (s: number) => ((s + phase) % 2) === 0;
    // s=0 = 最上方段（local -Z → world +Y top；reversed for "hw" axis）
    // combAxis 要求另一軸 ≈ width；不是 width（多半 = thickness）就 reject
    // → 該視角看 wall 邊緣/端面、teeth 不該在剪影出現
    let combAxis: "w" | "h" | null = null;
    if (Math.abs(r.w - L) < eps && Math.abs(r.h - W) < eps) combAxis = "w";
    else if (Math.abs(r.h - L) < eps && Math.abs(r.w - W) < eps) combAxis = "h";
    if (combAxis === null) return box;
    const pts: Array<{ x: number; y: number }> = [];
    if (combAxis === "w") {
      // length 軸水平 (r.w)、高度沿 r.h；s=0 = 頂部
      const segH = r.h / N;
      const d = Math.min(depth, r.w * 0.45);
      const xR = (s: number) => isFinger(s) ? r.x + r.w : r.x + r.w - d;
      const xL = (s: number) => isFinger(s) ? r.x : r.x + d;
      const yTopOf = (s: number) => r.y + r.h - s * segH;
      const yBotOf = (s: number) => r.y + r.h - (s + 1) * segH;
      // 從 top-right 起 CCW
      pts.push({ x: xR(0), y: yTopOf(0) });
      pts.push({ x: xL(0), y: yTopOf(0) });
      for (let s = 0; s < N; s++) {
        pts.push({ x: xL(s), y: yBotOf(s) });
        if (s < N - 1) {
          const nx = xL(s + 1);
          if (nx !== xL(s)) pts.push({ x: nx, y: yBotOf(s) });
        }
      }
      pts.push({ x: xR(N - 1), y: yBotOf(N - 1) });
      for (let s = N - 1; s >= 0; s--) {
        pts.push({ x: xR(s), y: yTopOf(s) });
        if (s > 0) {
          const nx = xR(s - 1);
          if (nx !== xR(s)) pts.push({ x: nx, y: yTopOf(s) });
        }
      }
    } else {
      // combAxis === "h"：length 軸垂直 (r.h)、寬度沿 r.w；s=0 對應頂端 r.y+r.h
      const segW = r.h / N;
      const d = Math.min(depth, r.w * 0.45);
      const yT = (s: number) => isFinger(s) ? r.y + r.h : r.y + r.h - 0; // not used differently here
      // Actually for "h" axis, comb 在 r.y / r.y+r.h 兩端、segments 沿 r.w
      // 但 r.h 是 length 方向 → comb 在 height 軸兩端... 重想
      // length 軸 = r.h → 壁長度沿 r.h；comb 在 r.h 兩端（top, bottom of view）
      // segments 沿 r.w 切
      const segWidth = r.w / N;
      const yTopFinger = r.y + r.h;
      const yTopGap = r.y + r.h - d;
      const yBotFinger = r.y;
      const yBotGap = r.y + d;
      const yTAt = (s: number) => isFinger(s) ? yTopFinger : yTopGap;
      const yBAt = (s: number) => isFinger(s) ? yBotFinger : yBotGap;
      const xLeftOf = (s: number) => r.x + s * segWidth;
      const xRightOf = (s: number) => r.x + (s + 1) * segWidth;
      // CCW from top-right
      pts.push({ x: xRightOf(N - 1), y: yTAt(N - 1) });
      for (let s = N - 1; s >= 0; s--) {
        pts.push({ x: xLeftOf(s), y: yTAt(s) });
        if (s > 0) {
          const ny = yTAt(s - 1);
          if (ny !== yTAt(s)) pts.push({ x: xLeftOf(s), y: ny });
        }
      }
      pts.push({ x: xLeftOf(0), y: yBAt(0) });
      for (let s = 0; s < N; s++) {
        pts.push({ x: xRightOf(s), y: yBAt(s) });
        if (s < N - 1) {
          const ny = yBAt(s + 1);
          if (ny !== yBAt(s)) pts.push({ x: xRightOf(s), y: ny });
        }
      }
    }
    return pts;
  }

  // 鳩尾榫壁：類似 finger-joint，但每段是梯形（pin 外寬內窄）。
  // combAxis 判斷邏輯與 finger 一致；slantY = depth * tan(angle)；
  // halfPin=true 時兩端段不收外邊界斜（防破角）。
  if (part.shape.kind === "dovetail-ends") {
    const L = part.visible.length;
    const eps = 0.5;
    const N = Math.max(3, Math.floor(part.shape.segmentCount));
    const phase = part.shape.phase;
    const depth = part.shape.pinDepth;
    const angleRad = (Math.max(1, Math.min(25, part.shape.angleDeg)) * Math.PI) / 180;
    const halfPin = part.shape.halfPin ?? true;
    // 半鳩尾端段（s=0 / s=N-1）：兩塊板必須互補——tail board（phase=0，側板）
    // 上下端是「公榫(齒)」、pin board（phase=1，前後板）上下端就要是「母榫(缺口)」
    // 才能互嵌。舊版一律 force true（兩塊端段都畫成齒）→ 前後板上下變成齒而非
    // 缺口、跟側板的齒對撞（user 2026-06-13）。改成依 phase 給互補值：phase=0
    // 端段=齒、phase=1 端段=缺口（同時仍保證同一塊板上下端一致，偶數 N 也對）。
    // 2026-06-13 強制 bundle hash 更新：d215440d 已上線但用戶端疑似快取舊 chunk，
    // 改動本檔讓 webpack chunk content hash 變動、瀏覽器重抓新版（互補母榫修正）。
    const isPin = (s: number) =>
      halfPin && (s === 0 || s === N - 1) ? phase === 0 : ((s + phase) % 2) === 0;
    // phase=0 (tail board，前後板)：face view 看是梯形（trapezoid tip 比 base 寬）
    // phase=1 (pin board，左右板)：面視看是**矩形**齒（slant=0）。鳩尾的斜角在
    // thickness 方向（垂直於 pin 板面），face view 看不到，所以 pin 邊應該是
    // 直線、不是斜線。3D CSG 自己把斜角從 tail 那邊挖出來。
    const slantSign = phase === 0 ? -1 : 0;
    // combAxis 要求另一軸 ≈ width；不是 width（多半 = thickness）就 reject
    // → 該視角看 wall 邊緣/端面、teeth 不該在剪影出現（同 finger-joint-ends 邏輯）
    // 零件圖 isolatePartId reset rotation=0 後、broad face 在 top 視圖，不再
    // hardcode `view==="top"` 切掉 polygon
    const W = part.visible.width;
    let combAxis: "w" | "h" | null = null;
    if (Math.abs(r.w - L) < eps && Math.abs(r.h - W) < eps) combAxis = "w";
    else if (Math.abs(r.h - L) < eps && Math.abs(r.w - W) < eps) combAxis = "h";
    if (combAxis === null) return box;
    const pts: Array<{ x: number; y: number }> = [];
    if (combAxis === "w") {
      // length 軸 = r.w（水平），高度沿 r.h
      const segH = r.h / N;
      const d = Math.min(depth, r.w * 0.45);
      const slantY = Math.min(segH * 0.45, d * Math.tan(angleRad));
      // 各段邊界 y（s=0 段 = top 還是 bottom？跟 finger 一致：s=0 → top）
      const yTopOf = (s: number) => r.y + r.h - s * segH;
      const yBotOf = (s: number) => r.y + r.h - (s + 1) * segH;
      // 右邊 X：xR_tip = r.x + r.w；xR_base = r.x + r.w - d
      const xRTip = r.x + r.w;
      const xRBase = r.x + r.w - d;
      const xLTip = r.x;
      const xLBase = r.x + d;
      // 從右側 top（s=0）開始 CCW 走下到底（s=N-1）
      const push = (x: number, y: number) => {
        const last = pts[pts.length - 1];
        if (!last || Math.abs(last.x - x) > 1e-3 || Math.abs(last.y - y) > 1e-3) {
          pts.push({ x, y });
        }
      };
      // 右側 top→bot：s = 0..N-1
      for (let s = 0; s < N; s++) {
        const yT = yTopOf(s);
        const yB = yBotOf(s);
        const pin = isPin(s);
        const isFirst = s === 0;
        const isLast = s === N - 1;
        if (pin) {
          const hardTop = halfPin && isFirst;
          const hardBot = halfPin && isLast;
          // top 邊
          if (hardTop) {
            push(xRTip, yT);
          } else {
            push(xRBase, yT);
            push(xRTip, yT - slantSign * slantY);
          }
          // bot 邊
          if (hardBot) {
            push(xRTip, yB);
          } else {
            push(xRTip, yB + slantSign * slantY);
            push(xRBase, yB);
          }
        } else {
          push(xRBase, yT);
          push(xRBase, yB);
        }
      }
      // 左側 bot→top：s = N-1..0
      for (let s = N - 1; s >= 0; s--) {
        const yT = yTopOf(s);
        const yB = yBotOf(s);
        const pin = isPin(s);
        const isFirst = s === 0;
        const isLast = s === N - 1;
        if (pin) {
          const hardTop = halfPin && isFirst;
          const hardBot = halfPin && isLast;
          if (hardBot) {
            push(xLTip, yB);
          } else {
            push(xLBase, yB);
            push(xLTip, yB + slantSign * slantY);
          }
          if (hardTop) {
            push(xLTip, yT);
          } else {
            push(xLTip, yT - slantSign * slantY);
            push(xLBase, yT);
          }
        } else {
          push(xLBase, yB);
          push(xLBase, yT);
        }
      }
    } else {
      // combAxis === "h"：length 軸垂直 r.h；comb 在 r.y/r.y+r.h 兩端，segments 沿 r.w 切
      const segW = r.w / N;
      const d = Math.min(depth, r.h * 0.45);
      const slantX = Math.min(segW * 0.45, d * Math.tan(angleRad));
      const yTipTop = r.y + r.h;
      const yBaseTop = r.y + r.h - d;
      const yTipBot = r.y;
      const yBaseBot = r.y + d;
      const xLeftOf = (s: number) => r.x + s * segW;
      const xRightOf = (s: number) => r.x + (s + 1) * segW;
      const push = (x: number, y: number) => {
        const last = pts[pts.length - 1];
        if (!last || Math.abs(last.x - x) > 1e-3 || Math.abs(last.y - y) > 1e-3) {
          pts.push({ x, y });
        }
      };
      // top 邊 right→left s=N-1..0
      for (let s = N - 1; s >= 0; s--) {
        const xL = xLeftOf(s);
        const xR = xRightOf(s);
        const pin = isPin(s);
        const isFirst = s === 0;
        const isLast = s === N - 1;
        if (pin) {
          const hardR = halfPin && isLast;
          const hardL = halfPin && isFirst;
          // right→left 進 pin top
          if (hardR) {
            push(xR, yTipTop);
          } else {
            push(xR, yBaseTop);
            push(xR - slantSign * slantX, yTipTop);
          }
          if (hardL) {
            push(xL, yTipTop);
          } else {
            push(xL + slantSign * slantX, yTipTop);
            push(xL, yBaseTop);
          }
        } else {
          push(xR, yBaseTop);
          push(xL, yBaseTop);
        }
      }
      // bot 邊 left→right s=0..N-1
      for (let s = 0; s < N; s++) {
        const xL = xLeftOf(s);
        const xR = xRightOf(s);
        const pin = isPin(s);
        const isFirst = s === 0;
        const isLast = s === N - 1;
        if (pin) {
          const hardL = halfPin && isFirst;
          const hardR = halfPin && isLast;
          if (hardL) {
            push(xL, yTipBot);
          } else {
            push(xL, yBaseBot);
            push(xL + slantSign * slantX, yTipBot);
          }
          if (hardR) {
            push(xR, yTipBot);
          } else {
            push(xR - slantSign * slantX, yTipBot);
            push(xR, yBaseBot);
          }
        } else {
          push(xL, yBaseBot);
          push(xR, yBaseBot);
        }
      }
    }
    return pts;
  }

  // 直角三角形板：silhouette 已跳過缺角 → convex hull 給三角形/矩形 view
  // 依旋轉與視角自動決定。
  if (part.shape.kind === "right-triangle") {
    return projectPartSilhouette(part, view);
  }

  // Mitered-corner：silhouette 已把缺角換成兩個 inset 點 → convex hull 給五邊形/梯形
  if (part.shape.kind === "mitered-corner") {
    return projectPartSilhouette(part, view);
  }

  // Pointed-ends：六角柱（兩端切尖）。交給 silhouette pipeline（已含 12 頂點
  // 採樣 + rotation + origin 投影），三視圖才能正確描出 45° 斜板的尖角輪廓。
  if (part.shape.kind === "pointed-ends") {
    return projectPartSilhouette(part, view);
  }

  // 4 角缺角板（座下層板避腳柱）：俯視畫 8 角多邊形，前/側視仍是矩形
  // （前/側 silhouette 沿 X-Y / Z-Y 投影，corner 缺角不影響 max extent）
  if (part.shape.kind === "notched-corners" && view === "top") {
    const nL = Math.max(0, Math.min(part.shape.notchLengthMm, r.w * 0.45));
    const nW = Math.max(0, Math.min(part.shape.notchWidthMm, r.h * 0.45));
    if (nL <= 0 || nW <= 0) return box;
    // 俯視 box：(r.x, r.y) 為左下角，(r.x+r.w, r.y+r.h) 為右上角
    return [
      { x: r.x + nL, y: r.y },
      { x: r.x + r.w - nL, y: r.y },
      { x: r.x + r.w - nL, y: r.y + nW },
      { x: r.x + r.w, y: r.y + nW },
      { x: r.x + r.w, y: r.y + r.h - nW },
      { x: r.x + r.w - nL, y: r.y + r.h - nW },
      { x: r.x + r.w - nL, y: r.y + r.h },
      { x: r.x + nL, y: r.y + r.h },
      { x: r.x + nL, y: r.y + r.h - nW },
      { x: r.x, y: r.y + r.h - nW },
      { x: r.x, y: r.y + nW },
      { x: r.x + nL, y: r.y + nW },
    ];
  }

  // 板狀零件頂緣倒角（座板 / 桌面）：前/側視 = 矩形上 2 角斜切（chamfered）
  // 或圓角弧線（rounded）。俯視仍是矩形（從上方看不到倒角）。
  // bottomChamferMm > 0 → 下 2 角也斜切（腳內縮、座板下緣外露時用）。
  if (part.shape.kind === "chamfered-top") {
    if (view === "top") {
      const cornerR = part.shape.cornerR ?? 0;
      if (cornerR <= 0) return box;
      const c = Math.min(cornerR, r.w * 0.45, r.h * 0.45);
      const segs = 6;
      const arc = (cx: number, cy: number, t0: number, t1: number) => {
        const pts: Array<{ x: number; y: number }> = [];
        for (let i = 0; i <= segs; i++) {
          const t = t0 + ((t1 - t0) * i) / segs;
          pts.push({ x: cx + c * Math.cos(t), y: cy + c * Math.sin(t) });
        }
        return pts;
      };
      // 4 角圓角矩形（CCW）
      const pts: Array<{ x: number; y: number }> = [];
      pts.push(...arc(r.x + c, r.y + c, Math.PI, (3 * Math.PI) / 2));
      pts.push(...arc(r.x + r.w - c, r.y + c, (3 * Math.PI) / 2, 2 * Math.PI));
      pts.push(...arc(r.x + r.w - c, r.y + r.h - c, 0, Math.PI / 2));
      pts.push(...arc(r.x + c, r.y + r.h - c, Math.PI / 2, Math.PI));
      return pts;
    }
    const cTop = Math.min(part.shape.chamferMm, r.h * 0.45, r.w * 0.45);
    const cBot = part.shape.bottomChamferMm
      ? Math.min(part.shape.bottomChamferMm, r.h * 0.45, r.w * 0.45)
      : 0;
    if (cTop <= 0 && cBot <= 0) return box;
    const rounded = part.shape.style === "rounded";
    const segs = rounded ? 4 : 1;
    const arc = (cx: number, cy: number, c: number, t0: number, t1: number) => {
      const pts: Array<{ x: number; y: number }> = [];
      const n = c > 0 ? segs : 0;
      if (n === 0) return [{ x: cx + c * Math.cos(t0), y: cy + c * Math.sin(t0) }];
      for (let i = 0; i <= n; i++) {
        const t = t0 + ((t1 - t0) * i) / n;
        pts.push({ x: cx + c * Math.cos(t), y: cy + c * Math.sin(t) });
      }
      return pts;
    };
    if (rounded || cBot > 0) {
      // 順時針從右上角→左上角→左下角→右下角繞一圈
      const pts: Array<{ x: number; y: number }> = [];
      // TR 上倒角 (圓心右上內側)
      if (cTop > 0) {
        pts.push(...arc(r.x + r.w - cTop, r.y + r.h - cTop, cTop, 0, Math.PI / 2));
      } else {
        pts.push({ x: r.x + r.w, y: r.y + r.h });
      }
      // TL 上倒角
      if (cTop > 0) {
        pts.push(...arc(r.x + cTop, r.y + r.h - cTop, cTop, Math.PI / 2, Math.PI));
      } else {
        pts.push({ x: r.x, y: r.y + r.h });
      }
      // BL 下倒角 (圓心左下內側)
      if (cBot > 0) {
        pts.push(...arc(r.x + cBot, r.y + cBot, cBot, Math.PI, (3 * Math.PI) / 2));
      } else {
        pts.push({ x: r.x, y: r.y });
      }
      // BR 下倒角
      if (cBot > 0) {
        pts.push(...arc(r.x + r.w - cBot, r.y + cBot, cBot, (3 * Math.PI) / 2, 2 * Math.PI));
      } else {
        pts.push({ x: r.x + r.w, y: r.y });
      }
      return pts;
    }
    // 純頂面 45° 倒角：原本的快路徑
    return [
      { x: r.x + cTop, y: r.y + r.h },
      { x: r.x + r.w - cTop, y: r.y + r.h },
      { x: r.x + r.w, y: r.y + r.h - cTop },
      { x: r.x + r.w, y: r.y },
      { x: r.x, y: r.y },
      { x: r.x, y: r.y + r.h - cTop },
    ];
  }

  // 板狀零件「大面」(big face) 4 角圓角 + 邊緣 arch + 中央 bend：
  //   bendAxis="z"（靠背，big face = (X×Y) 平面，薄軸 = Z）：
  //     - front view：大面，顯示 cornerR + arch
  //     - top view：bend 視圖（沿 +Z 凸出兩條長邊隨 X 變的弧）
  //     - side view：薄面投影，rectangle；bend !== 0 時 z 方向延伸 |bendMm|
  //   bendAxis="y"（椅面，big face = (X×Z) 平面，薄軸 = Y）：
  //     - top view：大面，顯示 cornerR
  //     - front view：bend 視圖（沿 ±Y 偏移兩條長邊隨 X 變的弧）
  //     - side view：薄面投影，rectangle；bend !== 0 時 y 方向延伸 |bendMm|
  if (part.shape.kind === "face-rounded") {
    const bendMm = part.shape.bendMm ?? 0;
    const bendAxis = part.shape.bendAxis ?? "z";
    const bigFaceView = bendAxis === "z" ? "front" : "top";
    const bendCurveView = bendAxis === "z" ? "top" : "front";

    // bend 中央弧：上下緣兩條長邊隨 X 同步偏移
    if (view === bendCurveView && bendMm !== 0) {
      const archSegs = 24;
      const pts: Array<{ x: number; y: number }> = [];
      const bendAt = (t: number): number => {
        const xLocal = 2 * t - 1; // [0,1] → [-1,1]
        return bendMm * Math.max(0, 1 - xLocal * xLocal);
      };
      for (let i = 0; i <= archSegs; i++) {
        const t = i / archSegs;
        pts.push({ x: r.x + r.w * t, y: r.y + r.h + bendAt(t) });
      }
      for (let i = 0; i <= archSegs; i++) {
        const t = i / archSegs;
        pts.push({ x: r.x + r.w * (1 - t), y: r.y + bendAt(1 - t) });
      }
      return pts;
    }
    // 非大面視圖（薄面 / 端面）：方框，不套 cornerR
    // 側視 + bend：silhouette 延伸 |bendMm|（端面 + 彎曲延伸都顯示）
    // 內部分隔線（區分端面與彎曲延伸）由 svg-views.tsx extras 額外畫出
    //   bendAxis="z"（靠背）→ z 軸（r.w 方向）多伸 |bendMm|
    //   bendAxis="y"（椅面）→ y 軸（r.h 方向）多伸 |bendMm|
    // 前=右慣例：+Z（背）→ SVG -x，-Z（前）→ SVG +x，所以 +bend 把後緣
    // 往 SVG -x 推；-bend 把前緣往 SVG +x 推。
    if (view !== bigFaceView) {
      if (view === "side" && bendMm !== 0) {
        if (bendAxis === "z") {
          return bendMm > 0
            ? [
                { x: r.x - bendMm, y: r.y + r.h },
                { x: r.x + r.w, y: r.y + r.h },
                { x: r.x + r.w, y: r.y },
                { x: r.x - bendMm, y: r.y },
              ]
            : [
                { x: r.x, y: r.y + r.h },
                { x: r.x + r.w - bendMm, y: r.y + r.h },
                { x: r.x + r.w - bendMm, y: r.y },
                { x: r.x, y: r.y },
              ];
        }
        return bendMm > 0
          ? [
              { x: r.x, y: r.y + r.h + bendMm },
              { x: r.x + r.w, y: r.y + r.h + bendMm },
              { x: r.x + r.w, y: r.y },
              { x: r.x, y: r.y },
            ]
          : [
              { x: r.x, y: r.y + r.h },
              { x: r.x + r.w, y: r.y + r.h },
              { x: r.x + r.w, y: r.y + bendMm },
              { x: r.x, y: r.y + bendMm },
            ];
      }
      return box;
    }
    // bigFaceView：cornerR + arch
    const c = Math.min(part.shape.cornerR, r.w * 0.45, r.h * 0.45);
    const topArch = part.shape.topArchMm ?? 0;
    const botArch = part.shape.bottomArchMm ?? 0;
    if (c <= 0 && topArch === 0 && botArch === 0) return box;
    const segs = 6;
    const archSegs = 16;
    const arc = (cx: number, cy: number, t0: number, t1: number) => {
      const pts: Array<{ x: number; y: number }> = [];
      for (let i = 0; i <= segs; i++) {
        const t = t0 + ((t1 - t0) * i) / segs;
        pts.push({ x: cx + c * Math.cos(t), y: cy + c * Math.sin(t) });
      }
      return pts;
    };
    /**
     * ⚠️ **這裡的 r 是世界座標,y 向上** —— `r.y` 是零件的**下緣**、`r.y + r.h` 是**上緣**。
     *    渲染端(svg-views.tsx:1321)才用 `-p.y` 翻成 SVG 的 y 向下。見 §A1 的備註:
     *    「polygon 回世界座標 y 向上,caller 才用 -p.y 翻」。
     *
     * ⛔ 原本這行註解寫「r.y 為頂、y 軸向下」,整段拱形就照那個假設寫 → **上下顛倒**:
     *    中式方角櫃全預設下,4 條壺門牙條的裝飾弧畫在牙條「上緣」(實際應在下緣)、
     *    8 個如意牙頭整個倒過來而且尖端穿出地板線下方 60mm。零件圖同樣顛倒 →
     *    木工照圖鋸,弧會挖在錯的那一邊,牙條報廢。
     *
     * ✅ 語意以 3D 那邊為準(part-geometry.ts:buildFaceRoundedExtrude,那邊是對的):
     *      下緣 y = -hy + bottomArch × sin(πt)   ← 往 +y 拱「進」零件(壺門)
     *      上緣 y = +hy + topArch    × sin(πt)   ← 往 +y 拱「出」零件(冠狀)
     *    所以下面兩段迴圈:走在 `r.y` 那條邊的掛 bottomArch、走在 `r.y + r.h` 那條邊的掛 topArch,
     *    兩者都是 **+**。(下面沿用原本「上緣/下緣」的變數命名順序以減少 diff,
     *    但實際位置如上,別再被名字騙一次。)
     */
    const pts: Array<{ x: number; y: number }> = [];
    // 左上角 R（順時針從左上開始繞）
    pts.push(...arc(r.x + c, r.y + c, Math.PI, (3 * Math.PI) / 2));
    // 走 `r.y` 這條邊（世界座標的**下緣**）→ 掛 bottomArch，往 +y 拱進零件
    if (botArch !== 0) {
      for (let i = 1; i <= archSegs; i++) {
        const t = i / archSegs;
        const x = r.x + c + (r.w - 2 * c) * t;
        const y = r.y + botArch * Math.sin(Math.PI * t);
        pts.push({ x, y });
      }
    }
    // 右上角 R
    pts.push(...arc(r.x + r.w - c, r.y + c, (3 * Math.PI) / 2, 2 * Math.PI));
    // 右側
    pts.push({ x: r.x + r.w, y: r.y + r.h - c });
    // 右下角 R
    pts.push(...arc(r.x + r.w - c, r.y + r.h - c, 0, Math.PI / 2));
    // 走 `r.y + r.h` 這條邊（世界座標的**上緣**）→ 掛 topArch，往 +y 拱出零件
    if (topArch !== 0) {
      for (let i = 1; i <= archSegs; i++) {
        const t = i / archSegs;
        const x = r.x + r.w - c - (r.w - 2 * c) * t;
        const y = r.y + r.h + topArch * Math.sin(Math.PI * t);
        pts.push({ x, y });
      }
    }
    // 左下角 R
    pts.push(...arc(r.x + c, r.y + r.h - c, Math.PI / 2, Math.PI));
    return pts;
  }

  return box;
}

const CONTAIN_EPS = 0.5;
const DEPTH_EPS = 0.5;

/**
 * A part is "hidden" in this view if some other part's silhouette fully
 * contains it AND that other part is completely in front of it along the
 * view axis. Hidden parts should render with dashed stroke.
 */
export function isPartHidden(part: Part, allParts: Part[], view: OrthoView) {
  const r = projectPart(part, view);
  const d = partDepth(part, view);
  for (const other of allParts) {
    if (other.id === part.id) continue;
    const ro = projectPart(other, view);
    const doo = partDepth(other, view);
    const contains =
      ro.x <= r.x + CONTAIN_EPS &&
      ro.x + ro.w >= r.x + r.w - CONTAIN_EPS &&
      ro.y <= r.y + CONTAIN_EPS &&
      ro.y + ro.h >= r.y + r.h - CONTAIN_EPS;
    if (contains && doo.far >= d.near - DEPTH_EPS) return true;
  }
  return false;
}

/**
 * Sort parts so deeper (farther-from-viewer) parts draw first; closer parts
 * paint on top. Stable order for equal depths preserves template order.
 */
export function sortPartsByDepth(parts: Part[], view: OrthoView): Part[] {
  return [...parts]
    .map((p, i) => ({ p, i, near: partDepth(p, view).near }))
    .sort((a, b) => (a.near === b.near ? a.i - b.i : a.near - b.near))
    .map((e) => e.p);
}

/**
 * 拼板 / 疊層的「分件方向」換算到世界軸。
 *
 * 料單說一個零件是 N 片（`panelPieces`）：`panelSplit === "thickness"` 是沿**最小那一維**
 * 疊層（夾板、薄板疊合），否則是沿跨紋方向拼板（寬板平拼 / 窄條側立拼）。
 * 3D（wood-shader）與三視圖共用這一支，兩邊才不會各判一套。
 *
 * 回傳 null = 這件不用畫分件線。
 */
export function panelSplitWorld(part: Part): {
  axis: "x" | "y" | "z";
  lo: number;
  hi: number;
  pieces: number;
} | null {
  const pieces = Math.max(1, Math.round(part.panelPieces ?? 1));
  if (pieces < 2) return null;
  const L = part.visible.length, T = part.visible.thickness, W = part.visible.width;
  // part-local：x = 長、y = 厚、z = 寬
  let local: "x" | "y" | "z";
  if (part.panelSplit === "thickness") {
    local = T <= L && T <= W ? "y" : L <= W ? "x" : "z";
  } else {
    local = part.grainDirection === "width" ? "x" : "z";
  }
  // quarter 旋轉把 local 軸換到世界軸（跟 worldExtents 同一套交換）
  const quarter = (a: number) => Math.abs(Math.sin(a)) > 0.5;
  const swap = (a: "x" | "y" | "z", b: "x" | "y" | "z") => {
    if (local === a) local = b;
    else if (local === b) local = a;
  };
  if (quarter(part.rotation?.x ?? 0)) swap("y", "z");
  if (quarter(part.rotation?.y ?? 0)) swap("x", "z");
  if (quarter(part.rotation?.z ?? 0)) swap("x", "y");
  const { xExt, yExt, zExt } = worldExtents(part);
  const ox = part.origin?.x ?? 0, oy = part.origin?.y ?? 0, oz = part.origin?.z ?? 0;
  if (local === "x") return { axis: "x", lo: ox - xExt / 2, hi: ox + xExt / 2, pieces };
  if (local === "y") return { axis: "y", lo: oy, hi: oy + yExt, pieces };
  return { axis: "z", lo: oz - zExt / 2, hi: oz + zExt / 2, pieces };
}
