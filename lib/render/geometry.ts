import type { Part } from "@/lib/types";

/**
 * World-frame extents of a part's bounding box, honoring its rotation.
 *
 * Local (unrotated) convention: length→X, thickness→Y, width→Z.
 * Rotations are applied in three.js default Euler XYZ order (extrinsic around
 * world X, then world Y, then world Z). Only ~90° quarter-turns are supported.
 */
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

export type OrthoView = "front" | "side" | "top";

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
  const bevShear = Math.tan(bev?.bevelAngle ?? trap?.bevelAngle ?? 0);
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
  // Round / round-tapered / lathe-turned / shaker：截面圓形，採樣 N 點而非 4 角
  const isRound = part.shape?.kind === "round" || part.shape?.kind === "round-tapered"
    || part.shape?.kind === "lathe-turned";
  const ROUND_SAMPLES = 16;

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
    else if (view === "side") { vx = wz; vy = wy; }
    else { vx = -wx; vy = wy; }
    projected.push({ x: vx, y: vy });
  };

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
      for (const [eySamp, ezSamp] of samples) {
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
        const isBottom = eyEff < 0;
        // tapered 家族在底端兩軸（local X 與 local Z）同步縮，對齊 3D
        // buildTaperedGeometry 雙軸縮放（bx = hx*scale, bz = hz*scale）。歷史
        // 上 silhouette 只縮 X，三視圖跟 3D 不一致；2026-05-01 修正。
        const xScaleTaper = isBottom ? tapered : 1;
        const zScaleTaper = isBottom ? tapered : 1;
        const xScaleTrap = trap
          ? ezSamp < 0 ? trap.topLengthScale : trap.bottomLengthScale
          : 1;
        const splayDx = splay && isBottom ? splay.dx : 0;
        const splayDz = splay && isBottom ? splay.dz : 0;
        // tilt-z: 頂端 (ezSamp = +1，假設 width 是高度) z 偏 topShiftMm/2，底端偏 -topShiftMm/2
        // 不過 tilt-z 多半搭 rotation 用，rotation 已轉好，這裡只需要直接位移。
        const tiltZdz = tiltZ * (ezSamp / 2);

        const xLocal = (arch ? (lx * exNorm) / 2 : (exNorm * lx) / 2) * xScaleTaper * xScaleTrap
          + (isBottom ? splayDx : 0);
        const yLocal = (eyEff * ly) / 2;
        const zLocal = (ezSamp * lz) / 2 * zScaleTaper + archDz + tiltZdz - yLocal * bevShear
          + (isBottom ? splayDz : 0);
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
    const endT = (j + 1) / samples;
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
function convexHull2D(
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
  // (world +X appears on the screen LEFT). Side view is independent (uses Z).
  if (view === "front") return { x: -x - xExt / 2, y, w: xExt, h: yExt };
  if (view === "side") return { x: z - zExt / 2, y, w: zExt, h: yExt };
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
 */
export function projectPartPolygon(part: Part, view: OrthoView): Array<{ x: number; y: number }> {
  const r = projectPart(part, view);
  // Default box polygon (rectangle, tracing CCW in world-Y-up coords).
  const box = [
    { x: r.x, y: r.y + r.h },       // top-left
    { x: r.x + r.w, y: r.y + r.h }, // top-right
    { x: r.x + r.w, y: r.y },       // bottom-right
    { x: r.x, y: r.y },             // bottom-left
  ];
  if (!part.shape || part.shape.kind === "box") return box;

  // 帶頂緣倒角的圓盤（圓凳座板）：俯視維持矩形（caller 改畫圓），前/側視
  // 矩形 + 頂面 2 角倒角。等同 chamfered-top with bottomChamferMm=0。
  if (part.shape.kind === "round" && (part.shape.chamferMm ?? 0) > 0) {
    if (view === "top") return box;
    const cTop = Math.min(part.shape.chamferMm!, r.h * 0.45, r.w * 0.45);
    if (cTop <= 0) return box;
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
      pts.push({ x: r.x, y: r.y });
      pts.push({ x: r.x + r.w, y: r.y });
      return pts;
    }
    return [
      { x: r.x + cTop, y: r.y + r.h },
      { x: r.x + r.w - cTop, y: r.y + r.h },
      { x: r.x + r.w, y: r.y + r.h - cTop },
      { x: r.x + r.w, y: r.y },
      { x: r.x, y: r.y },
      { x: r.x, y: r.y + r.h - cTop },
    ];
  }

  // Taper only applies when the part stands vertically (length/thickness →
  // world Y). 俯視在無倒角時用 box；有倒角時畫八邊形 cross-section
  // （與 chamfered-edges 同 convention）。前/側視仍是梯形（倒角只在 cross-
  // section view 顯示，跟 chamfered-edges 邏輯一致）。
  if (part.shape.kind === "tapered") {
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
    // Splayed: bottom face shifted by (dxMm, dzMm) in world. Silhouette is a
    // parallelogram in front/side view; top view shows both top and shifted
    // bottom footprints (we draw the top, bottom handled by second polygon in
    // the renderer — keep it simple here: top silhouette only in top view).
    if (view === "top") return box;
    // Front view flips the X axis (see projectPart), so negate dxMm offset
    // so the parallelogram leans the right way on screen.
    const offset =
      view === "front" ? -part.shape.dxMm : part.shape.dzMm;
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
    const offset =
      view === "front" ? -part.shape.dxMm : part.shape.dzMm;
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
      // 投影 X = world Z；底面中心 z = origin.z - topShift/2，頂面 z = origin.z + topShift/2
      const zBotCenter = part.origin.z - topShift / 2;
      const zTopCenter = part.origin.z + topShift / 2;
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
    // top view 沿用 box
    return box;
  }

  // 弧形彎料（椅背頂橫木向後彎）側視：沿 worldX 看不到 length；silhouette =
  // 各段 X 的 cross-section union，等於把後緣（+Z 方向）整體外推 bendMm。
  // 結果是寬度 = topRailT + bendMm 的長方形，前緣維持原位、後緣 +bendMm。
  if (part.shape.kind === "arch-bent" && view === "side") {
    const bend = part.shape.bendMm;
    if (Math.abs(bend) < 0.5) return box;
    const xFront = r.x;
    const xBack = r.x + r.w + bend;
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
    if (view !== bigFaceView) {
      if (view === "side" && bendMm !== 0) {
        if (bendAxis === "z") {
          return bendMm > 0
            ? [
                { x: r.x, y: r.y + r.h },
                { x: r.x + r.w + bendMm, y: r.y + r.h },
                { x: r.x + r.w + bendMm, y: r.y },
                { x: r.x, y: r.y },
              ]
            : [
                { x: r.x + bendMm, y: r.y + r.h },
                { x: r.x + r.w, y: r.y + r.h },
                { x: r.x + r.w, y: r.y },
                { x: r.x + bendMm, y: r.y },
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
    // SVG: r.y 為頂、r.y+r.h 為底（y 軸向下），相對世界要鏡像。對拱：top 拱起 = 在 r.y 邊向上突 = 減 y。
    const pts: Array<{ x: number; y: number }> = [];
    // 左上角 R（順時針從左上開始繞）
    pts.push(...arc(r.x + c, r.y + c, Math.PI, (3 * Math.PI) / 2));
    // 上緣（往右），可選拱起
    if (topArch !== 0) {
      for (let i = 1; i <= archSegs; i++) {
        const t = i / archSegs;
        const x = r.x + c + (r.w - 2 * c) * t;
        const y = r.y - topArch * Math.sin(Math.PI * t);
        pts.push({ x, y });
      }
    }
    // 右上角 R
    pts.push(...arc(r.x + r.w - c, r.y + c, (3 * Math.PI) / 2, 2 * Math.PI));
    // 右側
    pts.push({ x: r.x + r.w, y: r.y + r.h - c });
    // 右下角 R
    pts.push(...arc(r.x + r.w - c, r.y + r.h - c, 0, Math.PI / 2));
    // 下緣（往左），可選拱起（中央向上 = 減 y）
    if (botArch !== 0) {
      for (let i = 1; i <= archSegs; i++) {
        const t = i / archSegs;
        const x = r.x + r.w - c - (r.w - 2 * c) * t;
        const y = r.y + r.h - botArch * Math.sin(Math.PI * t);
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
