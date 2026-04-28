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
 * 把零件的 8 個 box corner 套用完整 rotation（含非 quarter）→ 投影到 view 平面
 * → convex hull 算出 silhouette polygon。
 *
 * 用於零件有非 90° 倍數的旋轉（例如外斜腳的 apron tilt α）時，
 * 標準 worldExtents bbox 無法正確呈現，需要實際算傾斜後的形狀。
 */
export function projectTiltedBoxSilhouette(
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
  const projected: Array<{ x: number; y: number }> = [];
  // 梯形 apron：上 (z=-hz) 用 topScale 縮 length，下 (z=+hz) 用 bottomScale
  const trap = part.shape?.kind === "apron-trapezoid" ? part.shape : null;
  // 斜邊 apron：local z 方向 shear -y × tan(bevelAngle)，上下緣旋轉後保持水平
  // apron-trapezoid 也帶 bevelAngle（外斜腳家具），同樣要補 shear，
  // 不然側/前視圖剪影會出現「折角」、上下緣看起來不水平。
  const bev = part.shape?.kind === "apron-beveled" ? part.shape : null;
  const bevAngle = bev?.bevelAngle ?? trap?.bevelAngle ?? 0;
  const bevShear = Math.tan(bevAngle);
  for (const ex of [-1, 1] as const) {
    for (const ey of [-1, 1] as const) {
      for (const ez of [-1, 1] as const) {
        const xScale = trap
          ? ez < 0 ? trap.topLengthScale : trap.bottomLengthScale
          : 1;
        let x = (ex * lx * xScale) / 2;
        let y = (ey * ly) / 2;
        let z = (ez * lz) / 2 - y * bevShear;
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
      }
    }
  }
  return convexHull2D(projected);
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

  // Taper only applies when the part stands vertically (length/thickness →
  // world Y). Always skipped in top view.
  if (part.shape.kind === "tapered") {
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

  // 板狀零件頂緣倒角（座板 / 桌面）：前/側視 = 矩形上 2 角斜切（chamfered）
  // 或圓角弧線（rounded）。俯視仍是矩形（從上方看不到倒角）。
  // bottomChamferMm > 0 → 下 2 角也斜切（腳內縮、座板下緣外露時用）。
  if (part.shape.kind === "chamfered-top") {
    if (view === "top") return box;
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
