import { BoxGeometry, BufferGeometry, CylinderGeometry, Euler, Matrix4, MeshStandardMaterial, Quaternion, Vector3 } from "three";
import { ADDITION, Brush, Evaluator, SUBTRACTION } from "three-bvh-csg";
import type { Part, TenonPosition } from "@/lib/types";
import type { LocalBox } from "./svg-views";
import { buildDovetailEndsGeometry, holeAxisOf, holeRadiusOf } from "./part-geometry";
import { worldExtents } from "./geometry";

export function partForJoineryView(part: Part): Part {
  return part.joineryView ? {
    ...part,
    shape: part.joineryView.shape ?? part.shape,
    visible: part.joineryView.visible ?? part.visible,
    origin: part.joineryView.origin ?? part.origin,
  } : part;
}

/** Renderer primitive; shrink is a visual clearance, not a manufacturing allowance. */
export function ordinaryTenonPrimitive(position: TenonPosition, box: Pick<LocalBox, "hx" | "hy" | "hz">,
  round: boolean, unitsPerMm = 0.01, shrinkMm = 0.5):
  { kind: "round"; args: [number, number, number, number] } | { kind: "rect"; args: [number, number, number] } {
  const { hx, hy, hz } = box;
  const longX = position === "start" || position === "end";
  const longY = position === "top" || position === "bottom";
  const sx = (longX ? hx : Math.max(0.05, hx - shrinkMm)) * 2 * unitsPerMm;
  const sy = (longY ? hy : Math.max(0.05, hy - shrinkMm)) * 2 * unitsPerMm;
  const sz = (!longX && !longY ? hz : Math.max(0.05, hz - shrinkMm)) * 2 * unitsPerMm;
  if (round) {
    const r = Math.max(0.05, Math.min(hx, hz) - shrinkMm) * unitsPerMm;
    return { kind: "round", args: [r, r, sy, 24] };
  }
  return { kind: "rect", args: [sx, sy, sz] };
}

export function buildOrdinaryTenonGeometry(position: TenonPosition, box: Pick<LocalBox, "hx" | "hy" | "hz">,
  round: boolean, unitsPerMm = 0.01, shrinkMm = 0.5): BufferGeometry {
  const primitive = ordinaryTenonPrimitive(position, box, round, unitsPerMm, shrinkMm);
  return primitive.kind === "round" ? new CylinderGeometry(...primitive.args) : new BoxGeometry(...primitive.args);
}

export function partMachiningMatrix(part: Part, unitsPerMm = 1): Matrix4 {
  return new Matrix4().compose(
    new Vector3(part.origin.x * unitsPerMm, (part.origin.y + worldExtents(part).yExt / 2) * unitsPerMm, part.origin.z * unitsPerMm),
    new Quaternion().setFromEuler(new Euler(part.rotation?.x ?? 0, part.rotation?.y ?? 0, part.rotation?.z ?? 0, "ZYX")),
    new Vector3(1, 1, 1),
  );
}

export type DovetailCutter = { brush: Brush; fromLid: boolean };

/** Actual renderer tail cutters. Dimensional export sets visual tip allowance to zero. */
export function buildDovetailCutBrushes(parts: readonly Part[], unitsPerMm = 0.01, tipAllowanceMm = 0.2): DovetailCutter[] {
  const brushes: DovetailCutter[] = [];
  const material = new MeshStandardMaterial();
  for (const part of parts) {
    if (part.shape?.kind !== "dovetail-ends") continue;
    const s = part.shape;
    const geo = buildDovetailEndsGeometry(
      [part.visible.length * unitsPerMm, part.visible.thickness * unitsPerMm, part.visible.width * unitsPerMm],
      s.segmentCount, s.phase, s.angleDeg, s.pinDepth * unitsPerMm, s.halfPin ?? true, s.ends ?? "both",
    );
    geo.deleteAttribute("uv");
    if (!geo.attributes.normal) geo.computeVertexNormals();
    geo.scale((part.visible.length + 2 * tipAllowanceMm) / part.visible.length, 1, 1);
    geo.applyMatrix4(partMachiningMatrix(part, unitsPerMm));
    geo.computeVertexNormals();
    const brush = new Brush(geo, material);
    brush.updateMatrixWorld();
    brushes.push({ brush, fromLid: /-lid$/.test(part.id) });
  }
  return brushes;
}

export function isDovetailReceiver(part: Part): boolean {
  return ["wall-left", "wall-right", "wall-left-lid", "wall-right-lid"].includes(part.id) || /-\d+-(front|back)$/.test(part.id);
}

export function dovetailCutsForPart(part: Part, cutters: DovetailCutter[]): Brush[] | undefined {
  if (!cutters.length || !isDovetailReceiver(part)) return undefined;
  const lid = part.id === "wall-left-lid" || part.id === "wall-right-lid";
  return cutters.filter(c => lid ? c.fromLid : !c.fromLid).map(c => c.brush);
}

/** Pre-transformed identity brushes, exactly as the renderer's dovetail CSG path. */
export function evaluateJoineryGeometry(base: BufferGeometry, operands: readonly BufferGeometry[],
  operation: "add" | "subtract", unitsPerMm = 0.01): BufferGeometry {
  if (!Number.isFinite(unitsPerMm) || unitsPerMm <= 0) throw new Error("Invalid joinery units");
  const factor = 0.01 / unitsPerMm;
  const clean = (g: BufferGeometry) => {
    const p = g.getAttribute("position");
    if (!p?.count || !Array.from(p.array).every(Number.isFinite)) throw new Error("Invalid joinery geometry");
    const clone = g.clone();
    clone.deleteAttribute("uv");
    if (factor !== 1) clone.scale(factor, factor, factor);
    if (!clone.attributes.normal) clone.computeVertexNormals();
    return clone;
  };
  const material = new MeshStandardMaterial();
  const evaluator = new Evaluator();
  evaluator.useGroups = false;
  evaluator.attributes = ["position", "normal"];
  let acc = new Brush(clean(base), material);
  acc.updateMatrixWorld();
  try {
    for (const operand of operands) {
      const cutter = new Brush(clean(operand), material);
      cutter.updateMatrixWorld();
      try {
        const next = evaluator.evaluate(acc, cutter, operation === "add" ? ADDITION : SUBTRACTION);
        acc.geometry.dispose();
        acc = next;
        const p = acc.geometry.getAttribute("position");
        if (!p?.count || !Array.from(p.array).every(Number.isFinite)) throw new Error("Empty or invalid joinery CSG result");
      } finally { cutter.geometry.dispose(); }
    }
    return acc.geometry.clone().scale(1 / factor, 1 / factor, 1 / factor);
  } finally { acc.geometry.dispose(); material.dispose(); }
}

export function subtractDovetailReceiverGeometry(local: BufferGeometry, worldMatrix: Matrix4, cuts: readonly Brush[], unitsPerMm = 0.01): BufferGeometry {
  const world = local.clone().applyMatrix4(worldMatrix);
  world.computeVertexNormals();
  try { return evaluateJoineryGeometry(world, cuts.map(c => c.geometry), "subtract", unitsPerMm); }
  finally { world.dispose(); }
}

/**
 * 把母件的 base geometry 用 CSG 減掉每個 mortise 對應的方塊，produce 帶
 * 真實榫眼洞的 buffer geometry。box 座標已 SCALE 過（three.js units）。
 *
 * - through mortise 由 caller 傳入時自帶內墊（避免 CSG 留薄殼）
 * - 共用一個 Evaluator 跑完所有 mortise（sequential subtraction）
 * - 中間 brush 的 geometry 會 dispose；保留原 baseGeo 不動（useMemo 會重用）
 */
export function subtractMortisesFromGeometry(
  baseGeo: BufferGeometry,
  mortiseBoxes: LocalBox[],
  mortiseShapes?: Array<"rect" | "round">,
  options: { strict?: boolean; unitsPerMm?: number } = {},
): BufferGeometry {
  const unitsPerMm = options.unitsPerMm ?? 0.01;
  if (!Number.isFinite(unitsPerMm) || unitsPerMm <= 0) throw new Error("Invalid CSG unitsPerMm");
  // Evaluate in the renderer's proven numerical range; return caller units.
  if (unitsPerMm !== 0.01) {
    const factor = 0.01 / unitsPerMm;
    const scaled = baseGeo.clone().scale(factor, factor, factor);
    try {
      const result = subtractMortisesFromGeometry(scaled, mortiseBoxes.map(m => ({
        ...m, cx: m.cx * factor, cy: m.cy * factor, cz: m.cz * factor,
        hx: m.hx * factor, hy: m.hy * factor, hz: m.hz * factor,
      })), mortiseShapes, { ...options, unitsPerMm: 0.01 });
      return (result === scaled ? result.clone() : result).scale(1 / factor, 1 / factor, 1 / factor);
    } finally { scaled.dispose(); }
  }
  if (options.strict) {
    const pos = baseGeo.getAttribute("position");
    if (!pos?.count || !Array.from(pos.array).every(Number.isFinite)) throw new Error("Invalid CSG stock geometry");
    for (const m of mortiseBoxes) {
      if (![m.cx, m.cy, m.cz, m.hx, m.hy, m.hz, m.rotX ?? 0, m.rotY ?? 0, m.rotZ ?? 0].every(Number.isFinite)
        || Math.min(m.hx, m.hy, m.hz) <= 0 || Math.abs(m.rotX ?? 0) >= Math.PI / 2) {
        throw new Error("Invalid CSG mortise");
      }
    }
  }
  if (mortiseBoxes.length === 0) return baseGeo;
  // 確保 base 有 normal 跟 index（CSG 必須）。原 builder 多半都做了，
  // 但雙保險：toNonIndexed → mergeVertices? 實際試 prepareGeometry 再
  // call evaluator。BoxGeometry / buildChamferedEdgesGeometry 都 indexed。
  const material = new MeshStandardMaterial();
  const evaluator = new Evaluator();
  evaluator.useGroups = false;
  // 限定只處理 position + normal，避免 base 有 uv 但 cut 沒 uv（或反之）
  // 觸發 evaluator 內部 attribute mismatch crash。
  evaluator.attributes = ["position", "normal"];
  // 統一兩個 brush 的 attribute set：剝掉 uv
  const baseClean = baseGeo.clone();
  baseClean.deleteAttribute("uv");
  if (!baseClean.attributes.normal) baseClean.computeVertexNormals();
  let acc = new Brush(baseClean, material);
  acc.updateMatrixWorld();
  if (options.strict) baseClean.computeBoundingBox();
  for (let i = 0; i < mortiseBoxes.length; i++) {
    let m = mortiseBoxes[i];
    // Float32 cutter vertices plus a translated center can leave a microscopic
    // skin at a coincident stock face. Extend only the exterior endpoint;
    // never shift the pocket floor or resize the stock. Values are canonical
    // renderer units: tolerance 0.00001mm, exterior extension 0.0001mm.
    if (options.strict && !m.rotX && !m.rotY && !m.rotZ && baseClean.boundingBox) {
      m = { ...m };
      for (const axis of ["x", "y", "z"] as const) {
        if (mortiseShapes?.[i] === "round" && axis !== m.depthAxis) continue;
        const center = `c${axis}` as const, half = `h${axis}` as const;
        let low = m[center] - m[half], high = m[center] + m[half];
        const bounds = baseClean.boundingBox;
        if (Math.abs(low - bounds.min[axis]) < 1e-7) low = bounds.min[axis] - 1e-6;
        if (Math.abs(high - bounds.max[axis]) < 1e-7) high = bounds.max[axis] + 1e-6;
        m[center] = (low + high) / 2;
        m[half] = (high - low) / 2;
      }
    }
    if (m.hx <= 0 || m.hy <= 0 || m.hz <= 0) continue;
    // 防呆：half-extent 或中心若是 NaN/Infinity，BoxGeometry 會吐 degenerate
    // triangles → three-bvh-csg 計算 BVH 時 normal=null → dot() crash
    if (
      !Number.isFinite(m.hx) || !Number.isFinite(m.hy) || !Number.isFinite(m.hz) ||
      !Number.isFinite(m.cx) || !Number.isFinite(m.cy) || !Number.isFinite(m.cz)
    ) {
      if (typeof console !== "undefined") {
        console.warn("[subtractMortisesFromGeometry] skip non-finite mortise", m);
      }
      continue;
    }
    const isRound = mortiseShapes?.[i] === "round";
    // 外撇牆 cosmetic 孔（rotX≠0）的 slice 幾何修正：
    // Wall 在 part-local 是 parallelogram（mitered-ends vertices）；外面法線
    // 在 y-z 平面斜 θ。cut Brush 繞 part-local X 軸轉 ±θ，cut Y 軸對齊牆法線。
    //
    // 問題：rotated BoxGeometry / CylinderGeometry 切到「牆外面」slice 處的
    // 形狀跟使用者指定的 (handleW × handleH) 矩形 / 半徑 hz 圓**對不上**：
    //   - Box slice z 半寬 = hz_cut / cos θ（cos 放大）
    //   - Cyl slice 是橢圓（x 半徑 r，z 半徑 r/c），不是圓
    //   - 兩者形狀差距使 pill 中段 rect 跟兩端 circle z 大小錯位
    //
    // 數學解（見 /tmp/slice-math.md）：
    //   hy_ext  = m.hy / cosθ + m.hz · sinθ       （延伸 depth，避免 strip 1 截斷）
    //   hz_scaled = m.hz · cosθ                    （壓縮 z，slice 後還原成 m.hz）
    //   Box: BoxGeometry(2·hx, 2·hy_ext, 2·hz_scaled)
    //   Cyl: CylinderGeometry(hz, hz, 2·hy_ext).scale(1, 1, cosθ)
    //     （cross-section 預壓成 ellipse，rotation 後 slice 才是正圓 radius=hz）
    //
    // Slice 中心會在 z = hy_wall·tanθ（非 z=0），但 pill 三孔同 cz、同步偏移、仍對齊。
    const absRot = m.rotX ? Math.abs(m.rotX) : 0;
    const c = absRot ? Math.cos(absRot) : 1;
    const s = absRot ? Math.sin(absRot) : 0;
    const hyExt = absRot ? (m.hy / c + m.hz * s) : m.hy;
    const hzScaled = absRot ? m.hz * c : m.hz;
    let cutGeo: BufferGeometry;
    // 圓孔的「孔軸」＝ half-extent 最大那軸（跟下面「塞」那條同一套判斷）。
    // 🩸2026-09-04 木頭仁回報「前腳 holdfast、長板靠板都沒顯示孔」：桌面狗孔的深度落在
    // local Y，但腳 / 靠板的孔是往側面鑽、深度落在 local Z。以前一律當 Y 軸做圓柱
    // → 半徑拿到的是「半個孔深」（50）、長度拿到的是孔半徑（19），等於拿一塊餅去挖，
    // 挖出來根本不是孔。rotX≠0（外撇牆斜孔）維持原本的 Y 軸 slice 數學不動。
    // 🩸2026-09-09：孔軸一律用 mortiseLocalBox 算出來的 depthAxis（＝範本宣告的入孔面），
    // 只有它缺席才退回 holeAxisOf 的「half-extent 最大那軸」猜測。
    // 以前只有 strict（匯出路徑）才吃 depthAxis，3D 預覽吃猜測 →「孔徑 ≥ 板厚」的貫穿孔一律挖錯軸：
    // 乙級第一題抽屜面板 Ø20 指孔（板厚 18）挖成橫躺圓柱、與正反兩面相切只留 0.04mm 皮，畫面上完全看不出有孔。
    // 全 catalog 掃過共 15 個圓孔中這個 case（托盤兩片側牆手把孔、木盒蓋指孔、工具牆鑿刀孔 ×6、虎鉗顎孔 ×3），
    // 每一個都是「孔比板厚」→ 全部本來就是壞的，改吃 depthAxis 是全面修正。
    const holeAxis: "x" | "y" | "z" = absRot ? "y" : m.depthAxis ?? holeAxisOf(m.hx, m.hy, m.hz);
    if (isRound) {
      const halfLen = holeAxis === "x" ? m.hx : holeAxis === "z" ? m.hz : hyExt;
      const radius = absRot ? m.hz : m.depthAxis
        ? (holeAxis === "x" ? Math.min(m.hy, m.hz) : holeAxis === "z" ? Math.min(m.hx, m.hy) : Math.min(m.hx, m.hz))
        : holeRadiusOf(m.hx, m.hy, m.hz);
      // 圓孔 cross-section 預壓 ellipse：x-radius radius、z-radius radius·c
      // rotation 後 slice = 半徑 radius 正圓
      cutGeo = new CylinderGeometry(radius, radius, 2 * halfLen, 24);
      if (absRot) cutGeo.scale(1, 1, c);
      // CylinderGeometry 預設軸是 Y；孔軸在 X / Z 要先轉過去
      if (holeAxis === "z") cutGeo.rotateX(Math.PI / 2);
      else if (holeAxis === "x") cutGeo.rotateZ(Math.PI / 2);
    } else {
      cutGeo = new BoxGeometry(2 * m.hx, 2 * hyExt, 2 * hzScaled);
    }
    // 把 rotation 直接烤進 geometry，避免 three-bvh-csg 的 matrixWorld
    // propagation 不一致（mesh.rotation 有時不反映到 evaluator）。
    // rotX：外撇牆 cosmetic 孔（孔軸跟牆面法線一致）
    // rotZ：splayed apron Z 面 mortise（cross-section 跟 tilted tenon 對齊）
    if (m.rotX) cutGeo.rotateX(m.rotX);
    if (m.rotY) cutGeo.rotateY(m.rotY);
    if (m.rotZ) cutGeo.rotateZ(m.rotZ);
    cutGeo.deleteAttribute("uv");
    const cut = new Brush(cutGeo, material);
    cut.position.set(m.cx, m.cy, m.cz);
    cut.updateMatrixWorld();
    try {
      const next = evaluator.evaluate(acc, cut, SUBTRACTION);
      if (options.strict) {
        const pos = next.geometry.getAttribute("position");
        if (!pos?.count || !Array.from(pos.array).every(Number.isFinite)) {
          next.geometry.dispose();
          throw new Error("CSG produced empty or non-finite geometry");
        }
      }
      cutGeo.dispose();
      acc.geometry.dispose();
      acc = next;
    } catch (err) {
      if (options.strict) {
        cutGeo.dispose();
        acc.geometry.dispose();
        material.dispose();
        throw new Error("Mortise CSG failed", { cause: err });
      }
      // three-bvh-csg 偶爾因 degenerate triangle / 邊界重疊 hit null normal
      // → 整個頁面掛掉。skip 這個 mortise 比讓使用者看到錯誤頁好。
      if (typeof console !== "undefined") {
        console.warn("[subtractMortisesFromGeometry] CSG evaluate failed, skipping mortise", { mortise: m, err });
      }
      cutGeo.dispose();
    }
  }
  material.dispose();
  return acc.geometry;
}
