/**
 * 板材展開圖（Surface Unfolding）— 純函數庫
 *
 * 給未來「彎曲家具」（圓桌邊條、彎椅背、收口櫃身、車削飾面）展平到 2D 板材用。
 *
 * 涵蓋：
 *   - 高斯曲率 K 判斷（K=0 可展、K≠0 不可展）
 *   - 圓柱展開（完整 / 部分）
 *   - 圓錐展開
 *   - 截頂圓錐展開（喇叭口、收口家具）
 *   - 蒸彎 / 層壓彎曲補正
 *
 * 詳細公式 docs/drafting-math.md §J。
 *
 * 沒有 UI、沒整合到家具設計流程；純 lib，等需要彎曲家具時再接。
 */

/** 展開結果通用類型 */
export interface UnfoldedRect {
  kind: "rect";
  width: number;
  height: number;
  /** 板材長軸方向的「木紋走向」建議 */
  grainHint: "along-length" | "along-width";
}

export interface UnfoldedFan {
  kind: "fan";
  /** 扇形外半徑 */
  outerRadius: number;
  /** 扇形內半徑（圓錐 = 0；截頂圓錐 > 0）*/
  innerRadius: number;
  /** 扇形角（rad）*/
  angle: number;
  /** SVG path 描述（順時針，原點在扇形虛擬頂點）*/
  svgPath: string;
}

export type UnfoldedShape = UnfoldedRect | UnfoldedFan;

// ---- 1. 圓柱展開 ----

/**
 * 完整圓柱（直徑 D、高 H）展開為矩形。
 * 寬 = πD（圓周長），高 = H。
 */
export function unfoldCylinder(diameter: number, height: number): UnfoldedRect {
  return {
    kind: "rect",
    width: Math.PI * diameter,
    height,
    grainHint: "along-length", // 沿弧長方向（彎曲時纖維受力最少）
  };
}

/**
 * 部分圓柱（半徑 R、弧角 θ rad、高 H）展開為矩形。
 * 弧長 = R·θ；弦長 = 2R·sin(θ/2)；矢高 = R−R·cos(θ/2)
 */
export function unfoldArcCylinder(radius: number, archAngleRad: number, height: number) {
  const arcLength = radius * archAngleRad;
  const chord = 2 * radius * Math.sin(archAngleRad / 2);
  const sagitta = radius - radius * Math.cos(archAngleRad / 2);
  return {
    rect: {
      kind: "rect" as const,
      width: arcLength,
      height,
      grainHint: "along-length" as const,
    },
    chord,
    sagitta,
  };
}

// ---- 2. 圓錐展開 ----

/**
 * 完整圓錐（底半徑 r、高 h）展開為扇形。
 * 母線長 L = √(h² + r²)
 * 扇形半徑 = L
 * 扇形角 α = 2π · r / L
 */
export function unfoldCone(baseRadius: number, height: number): UnfoldedFan {
  const slant = Math.sqrt(height * height + baseRadius * baseRadius);
  const angle = (2 * Math.PI * baseRadius) / slant;
  const path = fanPath(slant, 0, angle);
  return {
    kind: "fan",
    outerRadius: slant,
    innerRadius: 0,
    angle,
    svgPath: path,
  };
}

// ---- 3. 截頂圓錐展開（喇叭口、收口家具）----

/**
 * 截頂圓錐：下半徑 r1、上半徑 r2、垂直高 h → 展開為扇環。
 * 若 r1 ≈ r2，公式發散；fallback 為部分圓柱（s × π × (r1+r2) 的條狀）。
 */
export function unfoldFrustum(r1: number, r2: number, height: number): UnfoldedFan | UnfoldedRect {
  const dr = r1 - r2;
  if (Math.abs(dr) < 0.5) {
    // r1 ≈ r2，當圓柱用
    const avgD = r1 + r2; // 平均直徑
    const slant = Math.sqrt(height * height + dr * dr);
    return {
      kind: "rect",
      width: Math.PI * avgD,
      height: slant,
      grainHint: "along-length",
    };
  }
  const slant = Math.sqrt(dr * dr + height * height);
  // 相似三角形：虛擬頂點到底邊距離 = R，到頂邊 = r
  const R = (slant * r1) / dr;
  const r = (slant * r2) / dr;
  const angle = (2 * Math.PI * r1) / R;
  const path = annulusFanPath(r, R, angle);
  return {
    kind: "fan",
    outerRadius: R,
    innerRadius: r,
    angle,
    svgPath: path,
  };
}

// ---- 4. 蒸彎 / 層壓彎曲補正（per §J6）----

/**
 * 蒸彎最小彎曲半徑判斷
 * 板厚 t（mm）→ 最小未蒸 R = 25t；蒸彎 R = 5t；白臘木可到 2t
 */
export function minBendRadius(thicknessMm: number, technique: "raw" | "steamed" | "ash-best"): number {
  switch (technique) {
    case "raw": return 25 * thicknessMm;
    case "steamed": return 5 * thicknessMm;
    case "ash-best": return 2 * thicknessMm;
  }
}

/**
 * 回彈補償：冷卻後 +30%、乾燥再 +1-4%
 * 模具半徑建議 = 目標半徑 × 0.7（過彎 30%）
 */
export function moldRadiusForTarget(targetRadius: number): number {
  return targetRadius * 0.7;
}

/**
 * 層壓彎曲料表（per §J6）
 * 單層厚度 t（建議 9-12mm）、層數 n、目標半徑 R、弧角 θ
 * 回傳每層的長度（從內側起算）
 */
export function laminationLayerLengths(
  innerRadius: number,
  layerThickness: number,
  layerCount: number,
  archAngleRad: number,
  wasteRatio: number = 0.06,
): number[] {
  const lengths: number[] = [];
  for (let i = 0; i < layerCount; i++) {
    const r = innerRadius + (i + 0.5) * layerThickness; // 取中間半徑
    const arcLen = r * archAngleRad;
    lengths.push(arcLen * (1 + wasteRatio));
  }
  return lengths;
}

// ---- 5. 高斯曲率（mesh 可展性）----

interface MeshLite {
  vertices: { x: number; y: number; z: number }[];
  // 每個 face: 3 個 vertex index
  faces: [number, number, number][];
}

/**
 * 估算頂點 v 的 Gauss curvature（angle defect / area）
 * K ≈ 0 表示局部可展
 */
export function gaussianCurvatureAtVertex(mesh: MeshLite, vertexIdx: number): number {
  let angleSum = 0;
  let areaSum = 0;
  for (const [a, b, c] of mesh.faces) {
    const others: [number, number] | null =
      a === vertexIdx ? [b, c]
      : b === vertexIdx ? [a, c]
      : c === vertexIdx ? [a, b]
      : null;
    if (!others) continue;
    const v = mesh.vertices[vertexIdx];
    const p1 = mesh.vertices[others[0]];
    const p2 = mesh.vertices[others[1]];
    // 角 at v
    const e1 = { x: p1.x - v.x, y: p1.y - v.y, z: p1.z - v.z };
    const e2 = { x: p2.x - v.x, y: p2.y - v.y, z: p2.z - v.z };
    const dot = e1.x * e2.x + e1.y * e2.y + e1.z * e2.z;
    const m1 = Math.hypot(e1.x, e1.y, e1.z);
    const m2 = Math.hypot(e2.x, e2.y, e2.z);
    const cos = dot / (m1 * m2);
    angleSum += Math.acos(Math.max(-1, Math.min(1, cos)));
    // 面積（三角形 1/3 算進此頂點）
    const cross = {
      x: e1.y * e2.z - e1.z * e2.y,
      y: e1.z * e2.x - e1.x * e2.z,
      z: e1.x * e2.y - e1.y * e2.x,
    };
    const area = Math.hypot(cross.x, cross.y, cross.z) / 2;
    areaSum += area / 3;
  }
  if (areaSum < 1e-6) return 0;
  return (2 * Math.PI - angleSum) / areaSum;
}

/**
 * mesh 是否近似可展（所有頂點 |K| < eps）
 */
export function isDevelopable(mesh: MeshLite, eps = 1e-3): boolean {
  for (let i = 0; i < mesh.vertices.length; i++) {
    if (Math.abs(gaussianCurvatureAtVertex(mesh, i)) > eps) return false;
  }
  return true;
}

// ---- SVG path helpers ----

function fanPath(radius: number, angleStart: number, angleEnd: number): string {
  const x0 = radius * Math.cos(angleStart);
  const y0 = radius * Math.sin(angleStart);
  const x1 = radius * Math.cos(angleEnd);
  const y1 = radius * Math.sin(angleEnd);
  const largeArc = angleEnd - angleStart > Math.PI ? 1 : 0;
  return `M 0 0 L ${x0} ${y0} A ${radius} ${radius} 0 ${largeArc} 1 ${x1} ${y1} Z`;
}

function annulusFanPath(innerR: number, outerR: number, angle: number): string {
  const x0o = outerR;
  const y0o = 0;
  const x1o = outerR * Math.cos(angle);
  const y1o = outerR * Math.sin(angle);
  const x0i = innerR;
  const y0i = 0;
  const x1i = innerR * Math.cos(angle);
  const y1i = innerR * Math.sin(angle);
  const largeArc = angle > Math.PI ? 1 : 0;
  return [
    `M ${x0o} ${y0o}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${x1o} ${y1o}`,
    `L ${x1i} ${y1i}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${x0i} ${y0i}`,
    "Z",
  ].join(" ");
}
