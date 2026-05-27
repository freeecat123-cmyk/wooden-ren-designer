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

export type OrthoView = "front" | "side" | "top" | "bottom";

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
    (part.shape.kind === "shaker" ||
      part.shape.kind === "notched-corners" ||
      part.shape.kind === "finger-joint-ends" ||
      part.shape.kind === "dovetail-ends" ||
      part.shape.kind === "regular-polygon" ||
      part.shape.kind === "chamfered-top" ||
      part.shape.kind === "face-rounded")
  ) {
    return projectPartPolygon(part, view);
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
          ? ezSamp < 0 ? trap.topLengthScale : trap.bottomLengthScale
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
    const donor = allParts.find(
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

  if (!part.shape || part.shape.kind === "box") return box;

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
    const isPin = (s: number) => (halfPin && (s === 0 || s === N - 1)) ? true : ((s + phase) % 2) === 0;
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
