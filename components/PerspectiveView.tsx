"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, Environment, ContactShadows } from "@react-three/drei";
import { ACESFilmicToneMapping, BoxGeometry, BufferGeometry, CylinderGeometry, EdgesGeometry, Euler, ExtrudeGeometry, Float32BufferAttribute, LatheGeometry, MeshStandardMaterial, Shape, SRGBColorSpace, Vector2 } from "three";
import { mergeGeometries, mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { Brush, Evaluator, SUBTRACTION } from "three-bvh-csg";
import type { FurnitureDesign } from "@/lib/types";
import { MATERIALS } from "@/lib/materials";
import { worldExtents } from "@/lib/render/geometry";
import { findOverlaps } from "@/lib/geometry/overlap";
import type { LocalBox } from "@/lib/render/svg-views";
import { categorizePart, mortiseLocalBox } from "@/lib/render/svg-views";
import {
  woodCompileXNarrow,
  woodCompileXWide,
  woodCompileZNarrow,
  woodCompileZWide,
  WIDE_BOARD_THRESHOLD_MM,
} from "@/components/wood-shader";

// Apply Euler XYZ (intrinsic Rx → Ry → Rz) to a local vector. Matches the
// rotation order used inline below for tenon mesh placement and the order
// Three.js consumes from `new Euler(rx, ry, rz, "ZYX")`.
function rotateXYZ(
  rx: number, ry: number, rz: number,
  lx: number, ly: number, lz: number,
) {
  const cosX = Math.cos(rx), sinX = Math.sin(rx);
  const cosY = Math.cos(ry), sinY = Math.sin(ry);
  const cosZ = Math.cos(rz), sinZ = Math.sin(rz);
  let x = lx, y = ly, z = lz;
  const y1 = y * cosX - z * sinX;
  const z1 = y * sinX + z * cosX;
  y = y1; z = z1;
  const x2 = x * cosY + z * sinY;
  const z2 = -x * sinY + z * cosY;
  x = x2; z = z2;
  const x3 = x * cosZ - y * sinZ;
  const y3 = x * sinZ + y * cosZ;
  x = x3; y = y3;
  return { x, y, z };
}

type WorldMortise = {
  partId: string;
  entryX: number; entryY: number; entryZ: number;
  axis: "x" | "y" | "z";
  sign: 1 | -1;
  depth: number;
  through: boolean;
};

/**
 * Blend a hex color toward a tint. amount=0 → original, 1 → tint.
 * Used to highlight drawer / door parts so they're easy to spot against
 * the rest of the cabinet (which all share the same wood color).
 */
function tintHex(baseHex: string, tintHex: string, amount: number): string {
  const parse = (h: string) => {
    const s = h.replace("#", "");
    return [
      parseInt(s.slice(0, 2), 16),
      parseInt(s.slice(2, 4), 16),
      parseInt(s.slice(4, 6), 16),
    ];
  };
  const [br, bg, bb] = parse(baseHex);
  const [tr, tg, tb] = parse(tintHex);
  const mix = (a: number, b: number) =>
    Math.round(a * (1 - amount) + b * amount);
  const toHex = (n: number) => n.toString(16).padStart(2, "0");
  return `#${toHex(mix(br, tr))}${toHex(mix(bg, tg))}${toHex(mix(bb, tb))}`;
}

// 抽屜 / 門（夾板貼皮 / 鑲板 / 玻璃）統一暖橘色微染——
// 跟櫃體結構區隔，一眼看出哪些零件是可動面板。
// 抽屜：暖橙褐（略偏黃）；門：冷灰褐（略偏灰）。兩者都在木色系內，
// 色差柔和不撞色但能分辨。
const DRAWER_TINT = "#c89060";
const DOOR_TINT = "#9b8068";
const TINT_AMOUNT = 0.18;

/**
 * 配對二元淺/深著色：
 *   - 左/右 partId → 淺色（×1.08）
 *   - 上/下 / 前/後 partId → 深色（×0.92）
 *   - 沒方位字 → base 不變
 * 同 category（框體 / 門 / 抽屜）內配對「左右一對 / 上下一對」共享同一色，
 * 視覺乾淨——最多 2 個深淺，不像隨機 jitter 那樣亂。
 */
function pairShadeByPartId(hex: string, partId: string): string {
  const id = partId.toLowerCase();
  let factor = 1.0;
  // 左右板：淺色
  if (/(^|-)(left|right)($|-|\d)/.test(id)) factor = 1.08;
  // 上下 / 前後 板：深色
  else if (/(^|-)(top|bottom|front|back)($|-|\d)/.test(id)) factor = 0.92;
  const s = hex.replace("#", "");
  const r = parseInt(s.slice(0, 2), 16);
  const g = parseInt(s.slice(2, 4), 16);
  const b = parseInt(s.slice(4, 6), 16);
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n * factor)));
  const toHex = (n: number) => n.toString(16).padStart(2, "0");
  return `#${toHex(clamp(r))}${toHex(clamp(g))}${toHex(clamp(b))}`;
}

/**
 * 車旋腳輪廓（古典花瓶/baluster 風格）：
 * [topRScale, botRScale, hFrac]，從上到下
 * - 頂部：滿尺寸做榫接區
 * - 上球節：圓潤外凸
 * - 凹頸：明顯收進去
 * - 花瓶腹身：先外擴再內收，像花瓶
 * - 主桿：細長下漸細
 * - 下球節：再次外擴
 * - 足盤：穩定的較粗底座
 * 半徑 scale 全部以 fullR (= legSize/2) 為基準
 */
export const LATHE_TURNED_SEGMENTS: Array<[number, number, number]> = [
  [1.0, 1.0, 0.05],   // 頂端榫接區（直圓柱）
  [1.0, 1.10, 0.04],  // 上球節 ↑
  [1.10, 1.0, 0.04],  // 上球節 ↓
  [1.0, 0.55, 0.10],  // 凹頸 cove
  [0.55, 0.78, 0.18], // 花瓶腹身上半（外擴）
  [0.78, 0.55, 0.20], // 花瓶腹身下半（內收）
  [0.55, 0.50, 0.10], // 主桿（細部）
  [0.50, 0.95, 0.10], // 下球節 ↑
  [0.95, 0.85, 0.05], // 過渡
  [0.85, 0.95, 0.06], // 足盤外擴
  [0.95, 0.95, 0.05], // 足底圓盤
  [0.95, 0.80, 0.03], // 足底斜邊
];

type ShapeSpec =
  | { kind: "box" }
  | { kind: "tapered"; bottomScale: number; chamferMm?: number; chamferStyle?: "chamfered" | "rounded" }
  | { kind: "splayed"; dx: number; dz: number; chamferMm?: number; chamferStyle?: "chamfered" | "rounded" }
  | { kind: "hoof"; hoofHeight: number; hoofScale: number; dirX: -1 | 0 | 1; dirZ: -1 | 0 | 1 }
  | { kind: "round"; chamferMm?: number; chamferStyle?: "chamfered" | "rounded"; axis?: "x" | "y" | "z" }
  | { kind: "round-tapered"; bottomScale: number }
  | { kind: "shaker"; squareFrac?: number; bottomScale?: number }
  | { kind: "lathe-turned" }
  | { kind: "splayed-tapered"; bottomScale: number; dx: number; dz: number }
  | { kind: "splayed-round-tapered"; bottomScale: number; dx: number; dz: number }
  | { kind: "apron-trapezoid"; topLengthScale: number; bottomLengthScale: number; bevelAngle?: number; bevelMode?: "full" | "half" }
  | { kind: "apron-beveled"; bevelAngle: number }
  | { kind: "apron-half-beveled"; bevelAngle: number }
  | { kind: "chamfered-top"; chamferMm: number; bottomChamferMm?: number; style?: "chamfered" | "rounded"; cornerR?: number }
  | { kind: "chamfered-edges"; chamferMm: number; style?: "chamfered" | "rounded" }
  | { kind: "notched-corners"; notchLengthMm: number; notchWidthMm: number }
  | { kind: "arch-bent"; bendMm: number; segments?: number }
  | { kind: "live-edge"; amplitudeMm: number }
  | { kind: "seat-scoop"; profile: "saddle" | "scooped" | "dished"; depth: number }
  | { kind: "face-rounded"; cornerR: number; topArchMm?: number; bottomArchMm?: number; bendMm?: number; bendAxis?: "z" | "y" }
  | { kind: "mitered-ends";
      insetEach: number;
      outerSide: "+y" | "-y";
      tiltAngle?: number;
      bevelAngle?: number;
      vertices?: [number, number, number][];
    }
  | { kind: "finger-joint-ends"; segmentCount: number; phase: 0 | 1; fingerDepth: number; edgeChamferMm?: number }
  | { kind: "dovetail-ends"; segmentCount: number; phase: 0 | 1; angleDeg: number; pinDepth: number; halfPin?: boolean }
  | { kind: "regular-polygon"; sides: number; outerRadius: number; angleOffsetDeg?: number }
  | { kind: "right-triangle"; corner: "-x-z" | "-x+z" | "+x-z" | "+x+z" }
  | { kind: "mitered-corner"; axis: "x" | "y" | "z"; corner: "++" | "+-" | "-+" | "--"; depthMm: number; chamferMm?: number };

/**
 * 把母件的 base geometry 用 CSG 減掉每個 mortise 對應的方塊，produce 帶
 * 真實榫眼洞的 buffer geometry。box 座標已 SCALE 過（three.js units）。
 *
 * - through mortise 由 caller 傳入時自帶內墊（避免 CSG 留薄殼）
 * - 共用一個 Evaluator 跑完所有 mortise（sequential subtraction）
 * - 中間 brush 的 geometry 會 dispose；保留原 baseGeo 不動（useMemo 會重用）
 */
function subtractMortisesFromGeometry(
  baseGeo: BufferGeometry,
  mortiseBoxes: LocalBox[],
  mortiseShapes?: Array<"rect" | "round">,
): BufferGeometry {
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
  for (let i = 0; i < mortiseBoxes.length; i++) {
    const m = mortiseBoxes[i];
    if (m.hx <= 0 || m.hy <= 0 || m.hz <= 0) continue;
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
    if (isRound) {
      // 圓孔 cross-section 預壓 ellipse：x-radius m.hz、z-radius m.hz·c
      // rotation 後 slice = 半徑 m.hz 正圓
      cutGeo = new CylinderGeometry(m.hz, m.hz, 2 * hyExt, 24);
      if (absRot) cutGeo.scale(1, 1, c);
    } else {
      cutGeo = new BoxGeometry(2 * m.hx, 2 * hyExt, 2 * hzScaled);
    }
    cutGeo.deleteAttribute("uv");
    const cut = new Brush(cutGeo, material);
    cut.position.set(m.cx, m.cy, m.cz);
    // 外撇牆 cosmetic 孔：cut Brush 繞 part-local X 軸轉 rotX 弧度，讓孔軸跟
    // 牆面法線一致（孔上下緣斜、跟牆一起傾），不會是 axis-aligned 水平上下緣
    if (m.rotX) cut.rotation.x = m.rotX;
    cut.updateMatrixWorld();
    const next = evaluator.evaluate(acc, cut, SUBTRACTION);
    cutGeo.dispose();
    acc.geometry.dispose();
    acc = next;
  }
  return acc.geometry;
}

function Part({
  position,
  size,
  rotation,
  color,
  shape,
  isGlass,
  isBrass,
  grainDirection,
  mortiseBoxes,
  mortiseShapes,
  isSelected,
  isDimmed,
  wireframe,
}: {
  position: [number, number, number];
  size: [number, number, number];
  rotation: Euler;
  color: string;
  shape?: ShapeSpec;
  isGlass?: boolean;
  isBrass?: boolean;
  grainDirection?: "length" | "width";
  /** joineryMode：母件 mortise 的 SCALE 過 LocalBox（caller 已乘 SCALE）。
   *  傳 undefined / [] 表示不做 CSG，走原本 plain mesh 路徑。 */
  mortiseBoxes?: LocalBox[];
  /** 對應 mortiseBoxes 每個的形狀（"rect" | "round"）；undefined = 全 rect */
  mortiseShapes?: Array<"rect" | "round">;
  /** 選中：本體 emissive 黃光，最強視覺提示 */
  isSelected?: boolean;
  /** 其他零件被選中時：本體變半透明灰，讓選中零件凸出 */
  isDimmed?: boolean;
  /** 線框模式：所有 face 變骨架線 */
  wireframe?: boolean;
}) {
  // 高亮配色（選中：amber-400 emissive；變灰：opacity 0.18）
  const HIGHLIGHT_EMISSIVE = "#fbbf24";
  const HIGHLIGHT_INTENSITY = 0.55;
  const DIM_OPACITY = 0.18;
  // 木紋順著零件 grain 軸（length 沿 local X、width 沿 local Z）。
  // 依「跨紋方向尺寸」選 wide（山形紋）或 narrow（直紋）：寬板 plain-sawn
  // 山形紋、細條 quartersawn 直紋——跟真實鋸下來的木料長相一致。
  // size 是 three-units（1 unit = 100mm），×100 換回 mm。
  const crossGrainMm =
    (grainDirection === "width" ? size[0] : size[2]) * 100;
  const isWide = crossGrainMm >= WIDE_BOARD_THRESHOLD_MM;
  const woodCompile =
    grainDirection === "width"
      ? (isWide ? woodCompileZWide : woodCompileZNarrow)
      : (isWide ? woodCompileXWide : woodCompileXNarrow);
  const geometry = useMemo(() => {
    if (!shape || shape.kind === "box") return null;
    if (shape.kind === "tapered") {
      // 帶倒角的方錐（圓凳/餐椅方錐腳套用 legEdge）：用 chamfered-edges
      // builder 帶 bottomScale，cross-section 八邊形 + 底端縮小。
      if (shape.chamferMm && shape.chamferMm > 0) {
        return buildChamferedEdgesGeometry(
          size,
          shape.chamferMm,
          shape.chamferStyle ?? "chamfered",
          0,
          0,
          shape.bottomScale,
        );
      }
      if (shape.bottomScale === 1) return null;
      return buildTaperedGeometry(size, shape.bottomScale);
    }
    if (shape.kind === "splayed") {
      // 有 chamfer → 用 chamfered-edges builder + 底端偏移；無 chamfer → 純 splayed box
      if (shape.chamferMm && shape.chamferMm > 0) {
        return buildChamferedEdgesGeometry(
          size,
          shape.chamferMm,
          shape.chamferStyle ?? "chamfered",
          shape.dx,
          shape.dz,
        );
      }
      return buildSplayedGeometry(size, shape.dx, shape.dz);
    }
    if (shape.kind === "hoof") {
      return buildHoofGeometry(size, shape.hoofHeight, shape.hoofScale, shape.dirX, shape.dirZ);
    }
    if (shape.kind === "splayed-tapered") {
      return buildSplayedTaperedGeometry(size, shape.bottomScale, shape.dx, shape.dz);
    }
    // 圓料：把 cylinderGeometry / latheGeometry 改成 buffer geo 走 useMemo，
    // CSG 才能挖洞（Phase 2 後續擴展）。座板上的方形 mortise 對圓腳 → 圓
    // 柱面挖出方洞，視覺正確。
    if (shape.kind === "round") {
      // axis: cylinder 中心軸對齊的世界軸；預設 "y"（站立圓柱）
      // axis="z" 用於門把/旋鈕（軸朝前後，從正面看是圓）
      // axis="x" 用於橫躺圓柱（軸朝左右）
      const ax = shape.axis ?? "y";
      const radius =
        ax === "y" ? size[0] / 2 : ax === "x" ? size[1] / 2 : size[0] / 2;
      const height = ax === "y" ? size[1] : ax === "x" ? size[0] : size[2];
      const chamfer = shape.chamferMm ?? 0;
      const rotation: [number, number, number] =
        ax === "x" ? [0, 0, Math.PI / 2] : ax === "z" ? [Math.PI / 2, 0, 0] : [0, 0, 0];
      if (chamfer > 0) {
        const h = height;
        const cap = Math.min(chamfer, radius * 0.5, h * 0.5);
        const innerR = Math.max(0.5, radius - cap);
        const styleSegs = shape.chamferStyle === "rounded" ? 6 : 1;
        const points: Vector2[] = [
          new Vector2(0, -h / 2),
          new Vector2(radius, -h / 2),
          new Vector2(radius, h / 2 - cap),
        ];
        if (styleSegs === 1) {
          points.push(new Vector2(innerR, h / 2));
        } else {
          for (let i = 1; i <= styleSegs; i++) {
            const t = (i / styleSegs) * (Math.PI / 2);
            points.push(
              new Vector2(innerR + cap * Math.cos(t), h / 2 - cap + cap * Math.sin(t)),
            );
          }
        }
        points.push(new Vector2(0, h / 2));
        const lathe = new LatheGeometry(points, 48);
        if (rotation[0] || rotation[1] || rotation[2]) {
          lathe.rotateX(rotation[0]);
          lathe.rotateY(rotation[1]);
          lathe.rotateZ(rotation[2]);
        }
        return lathe;
      }
      const cyl = new CylinderGeometry(radius, radius, height, 48);
      if (rotation[0] || rotation[1] || rotation[2]) {
        cyl.rotateX(rotation[0]);
        cyl.rotateY(rotation[1]);
        cyl.rotateZ(rotation[2]);
      }
      return cyl;
    }
    if (shape.kind === "round-tapered") {
      const topR = size[0] / 2;
      const botR = topR * shape.bottomScale;
      return new CylinderGeometry(topR, botR, size[1], 48);
    }
    if (shape.kind === "splayed-round-tapered") {
      // 已經有 builder，重用即可（buffer geo + index）
      return buildSplayedRoundTaperedGeometry(size, shape.bottomScale, shape.dx, shape.dz, 48);
    }
    // 夏克風 / 車旋腳：原本走 multi-mesh group，整合成單一 merged BufferGeometry
    // 給 CSG pipeline 用（座板/橫撐 mortise → 圓柱面方洞）
    if (shape.kind === "shaker") {
      const SQUARE_FRAC = shape.squareFrac ?? 0.25;
      const TAPER_BOT_SCALE = shape.bottomScale ?? 0.6;
      const fullH = size[1];
      const squareH = fullH * SQUARE_FRAC;
      const taperH = fullH * (1 - SQUARE_FRAC);
      const fullR = size[0] / 2;
      const botR = fullR * TAPER_BOT_SCALE;
      const squareYOffset = taperH / 2;
      const taperYOffset = -squareH / 2;
      const sq = new BoxGeometry(size[0], squareH, size[2]);
      sq.translate(0, squareYOffset, 0);
      const cyl = new CylinderGeometry(fullR, botR, taperH, 48);
      cyl.translate(0, taperYOffset, 0);
      const merged = mergeGeometries([sq, cyl], false);
      sq.dispose();
      cyl.dispose();
      return merged ?? new BoxGeometry(size[0], size[1], size[2]);
    }
    if (shape.kind === "lathe-turned") {
      const fullH = size[1];
      const fullR = size[0] / 2;
      let yCursor = fullH / 2;
      const segs: BufferGeometry[] = [];
      for (const [topR, botR, hFrac] of LATHE_TURNED_SEGMENTS) {
        const segH = fullH * hFrac;
        const segYCenter = yCursor - segH / 2;
        yCursor -= segH;
        const cyl = new CylinderGeometry(fullR * topR, fullR * botR, segH, 32);
        cyl.translate(0, segYCenter, 0);
        segs.push(cyl);
      }
      const merged = mergeGeometries(segs, false);
      for (const s of segs) s.dispose();
      return merged ?? new BoxGeometry(size[0], size[1], size[2]);
    }
    if (shape.kind === "apron-trapezoid") {
      return buildApronTrapezoidGeometry(size, shape.topLengthScale, shape.bottomLengthScale, shape.bevelAngle ?? 0, shape.bevelMode ?? "full");
    }
    if (shape.kind === "apron-beveled") {
      return buildBeveledApronGeometry(size, shape.bevelAngle);
    }
    if (shape.kind === "apron-half-beveled") {
      return buildHalfBeveledApronGeometry(size, shape.bevelAngle);
    }
    if (shape.kind === "chamfered-top") {
      return buildChamferedTopGeometry(size, shape.chamferMm, shape.style ?? "chamfered", shape.bottomChamferMm ?? 0, shape.cornerR ?? 0);
    }
    if (shape.kind === "chamfered-edges") {
      return buildChamferedEdgesGeometry(size, shape.chamferMm, shape.style ?? "chamfered");
    }
    if (shape.kind === "notched-corners") {
      return buildNotchedCornersGeometry(size, shape.notchLengthMm, shape.notchWidthMm);
    }
    if (shape.kind === "arch-bent") {
      return buildArchBentGeometry(size, shape.bendMm, shape.segments ?? 16);
    }
    if (shape.kind === "live-edge") {
      return buildLiveEdgeGeometry(size, shape.amplitudeMm);
    }
    if (shape.kind === "seat-scoop") {
      return buildSeatScoopGeometry(size, shape.profile, shape.depth);
    }
    if (shape.kind === "face-rounded") {
      return buildFaceRoundedGeometry(size, shape.cornerR, shape.topArchMm ?? 0, shape.bottomArchMm ?? 0, shape.bendMm ?? 0, shape.bendAxis ?? "z");
    }
    if (shape.kind === "mitered-ends") {
      if (shape.vertices && shape.vertices.length === 8) {
        return buildCompoundMiterFromVerts(shape.vertices);
      }
      return buildMiteredEndsGeometry(
        size, shape.insetEach, shape.outerSide,
        shape.tiltAngle ?? 0, shape.bevelAngle ?? 0,
      );
    }
    if (shape.kind === "finger-joint-ends") {
      return buildFingerJointEndsGeometry(size, shape.segmentCount, shape.phase, shape.fingerDepth, shape.edgeChamferMm ?? 0);
    }
    if (shape.kind === "dovetail-ends") {
      return buildDovetailEndsGeometry(size, shape.segmentCount, shape.phase, shape.angleDeg, shape.pinDepth, shape.halfPin ?? true);
    }
    if (shape.kind === "regular-polygon") {
      return buildRegularPolygonGeometry(size, shape.sides, shape.outerRadius, shape.angleOffsetDeg ?? (90 + 180 / shape.sides));
    }
    if (shape.kind === "right-triangle") {
      return buildRightTriangleGeometry(size, shape.corner);
    }
    if (shape.kind === "mitered-corner") {
      return buildMiteredCornerGeometry(size, shape.axis, shape.corner, shape.depthMm, shape.chamferMm);
    }
    return null;
  }, [size, shape]);

  // joineryMode CSG：把每個 mortise 從 base geo 挖掉。base geo 為 null 時
  // 用預設 box 當底建 brush；多 mesh shape（lathe-turned / shaker）跟自由曲面
  // （live-edge / arch-bent / face-rounded / seat-scoop）暫時不挖，留 phase 4+。
  // 圓料 (round / round-tapered / splayed-round-tapered) 已於 2026-05-02 整進
  // useMemo geometry，CSG 直接挖（座板上的方 mortise → 圓柱面方洞，視覺正確）。
  const csgGeometry = useMemo(() => {
    if (!mortiseBoxes || mortiseBoxes.length === 0) return null;
    const baseGeo = geometry ?? new BoxGeometry(size[0], size[1], size[2]);
    const result = subtractMortisesFromGeometry(baseGeo, mortiseBoxes, mortiseShapes);
    // 若 baseGeo 是新建的 BoxGeometry（不是 useMemo cache 的 geometry），dispose
    if (!geometry) baseGeo.dispose();
    return result;
  }, [geometry, mortiseBoxes, mortiseShapes, shape, size]);
  // wireframeMode：抽出 silhouette edges（box=12 邊、tapered=12、圓柱=雙圈
  //  + 接縫；用 EdgesGeometry 預設 1° 門檻只留相鄰面 normal 變化大的邊
  //  → 不會畫三角形對角線）
  const edgesGeometry = useMemo(() => {
    if (!wireframe) return null;
    // 線框直接用 pre-CSG geometry（box / tapered / cylinder 原型），
    // 不抽 csgGeometry 因 CSG 切出的小三角網狀沒有 clean shared edges
    // → 對角線消不掉。線框是「結構輪廓」視圖，榫眼挖洞細節不需要顯示。
    let baseGeo: BufferGeometry;
    let createdLocally = false;
    if (geometry) {
      baseGeo = geometry;
    } else {
      baseGeo = new BoxGeometry(size[0], size[1], size[2]);
      createdLocally = true;
    }
    const merged = mergeVertices(baseGeo, 0.001);
    // 圓料 cylinder 鄰面夾角 ~7.5° < 30°，threshold 30° 只剩 top/bot 圓環
    // 沒側線視覺像消失。降 threshold 到 1° 讓 side facet 也算邊（cage look）
    const isRound = shape?.kind === "round" || shape?.kind === "round-tapered"
      || shape?.kind === "splayed-round-tapered" || shape?.kind === "shaker"
      || shape?.kind === "lathe-turned";
    const threshold = isRound ? 1 : 30;
    const eg = new EdgesGeometry(merged, threshold);
    if (merged !== baseGeo) merged.dispose();
    if (createdLocally) baseGeo.dispose();
    return eg;
  }, [wireframe, geometry, size, shape]);

  // wireframe 模式：所有材質統一用 silhouette edges 渲染
  if (wireframe && edgesGeometry) {
    return (
      <lineSegments position={position} rotation={rotation}>
        <primitive attach="geometry" object={edgesGeometry} />
        <lineBasicMaterial
          color={isSelected ? HIGHLIGHT_EMISSIVE : isBrass ? "#8a6a3a" : "#3f3f46"}
          transparent
          opacity={isDimmed ? 0.25 : 1}
        />
      </lineSegments>
    );
  }

  if (isGlass) {
    // 改用 standard material 半透明：transmission + opacity 雙重透明會讓背板/內部
    // 在 transmission 渲染 pass 中被略過，玻璃看過去全穿。半透明 blend 走標準
    // alpha 路徑，背板/層板正常出現在後面，玻璃只是淡藍色遮罩。
    return (
      <mesh position={position} rotation={rotation} renderOrder={1}>
        <boxGeometry args={size} />
        <meshStandardMaterial
          color="#b8d9e8"
          roughness={0.1}
          metalness={0}
          transparent
          opacity={isDimmed ? 0.12 : 0.35}
          depthWrite={false}
          emissive={isSelected ? HIGHLIGHT_EMISSIVE : "#000000"}
          emissiveIntensity={isSelected ? HIGHLIGHT_INTENSITY : 0}
        />
      </mesh>
    );
  }
  if (isBrass) {
    // 仿古銅：metalness 高、低光澤、暖色調，模擬氧化銅件而非亮金
    const brassGeo = geometry ?? null;
    return (
      <mesh position={position} rotation={rotation}>
        {brassGeo ? <primitive object={brassGeo} attach="geometry" /> : <boxGeometry args={size} />}
        <meshStandardMaterial
          color="#8a6a3a"
          roughness={0.35}
          metalness={0.85}
          transparent
          opacity={isDimmed ? DIM_OPACITY : 1}
          depthWrite={!isDimmed && !wireframe}
          emissive={isSelected ? HIGHLIGHT_EMISSIVE : "#000000"}
          emissiveIntensity={isSelected ? HIGHLIGHT_INTENSITY : 0}
        />
      </mesh>
    );
  }

  // round / round-tapered / splayed-round-tapered 已在 useMemo 統一回 buffer
  // geometry，會走到底下的 final mesh + CSG pipeline；早期的 inline JSX 路徑
  // 移除（Phase 2 圓料挖洞擴展）。

  // shaker / lathe-turned 已整進 useMemo geometry，會走底下 final mesh + CSG。

  // chamfered-edges / chamfered-top / splayed+chamfer 用 flatShading：
  // 每個 facet 自己的法線 → 八角斷面看得出來；不然 smooth shading 會把
  // 多 facet 平滑成連續曲面，看起來跟方料沒兩樣
  //
  // CSG 挖出的 cosmetic mortise（指槽 / 無線充電凹槽等）也需要 flatShading：
  // 否則 smooth shading 會把凹槽邊緣 normal 插值平滑掉，看起來像沒挖一樣
  const hasCosmeticCut = (mortiseBoxes?.length ?? 0) > 0;
  const useFlatShading =
    shape?.kind === "chamfered-edges" ||
    shape?.kind === "chamfered-top" ||
    shape?.kind === "mitered-ends" ||
    shape?.kind === "finger-joint-ends" ||
    shape?.kind === "dovetail-ends" ||
    shape?.kind === "regular-polygon" ||
    shape?.kind === "right-triangle" ||
    shape?.kind === "mitered-corner" ||
    (shape?.kind === "splayed" && (shape.chamferMm ?? 0) > 0) ||
    hasCosmeticCut;
  return (
    <mesh position={position} rotation={rotation} castShadow receiveShadow>
      {csgGeometry ? (
        <primitive attach="geometry" object={csgGeometry} />
      ) : geometry ? (
        <primitive attach="geometry" object={geometry} />
      ) : (
        <boxGeometry args={size} />
      )}
      <meshStandardMaterial
        color={color}
        roughness={0.55}
        metalness={0.05}
        flatShading={useFlatShading}
        onBeforeCompile={woodCompile}
        transparent
        opacity={isDimmed ? DIM_OPACITY : 1}
        depthWrite={!isDimmed && !wireframe}
        emissive={isSelected ? HIGHLIGHT_EMISSIVE : "#000000"}
        emissiveIntensity={isSelected ? HIGHLIGHT_INTENSITY : 0}
      />
    </mesh>
  );
}

/**
 * Truncated pyramid: top face is full size (length × width), bottom face is
 * scaled by `scale`. Height axis is Y (local thickness in our part convention
 * maps to Y in three.js box). 8 vertices, 12 triangles.
 */
function buildTaperedGeometry(
  size: [number, number, number],
  scale: number,
): BufferGeometry {
  const [lx, ly, lz] = size;
  const hx = lx / 2;
  const hy = ly / 2;
  const hz = lz / 2;
  const bx = hx * scale;
  const bz = hz * scale;
  // 8 verts: 0..3 bottom (y=-hy), 4..7 top (y=+hy), order: -x-z, +x-z, +x+z, -x+z
  const v: number[] = [
    -bx, -hy, -bz,
    bx, -hy, -bz,
    bx, -hy, bz,
    -bx, -hy, bz,
    -hx, hy, -hz,
    hx, hy, -hz,
    hx, hy, hz,
    -hx, hy, hz,
  ];
  // Three.js uses right-handed coords with CCW winding = front face. Each
  // quad (a,b,c,d) is listed so the normal points outward.
  const f = (a: number, b: number, c: number, d: number) => [a, b, c, a, c, d];
  const idx = [
    ...f(0, 1, 2, 3), // bottom (-y outward)
    ...f(4, 7, 6, 5), // top (+y outward)
    ...f(0, 4, 5, 1), // front (-z outward)
    ...f(1, 5, 6, 2), // right (+x outward)
    ...f(2, 6, 7, 3), // back (+z outward)
    ...f(3, 7, 4, 0), // left (-x outward)
  ];
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(v, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * Splayed box: same length/width/height as a box, but the 4 bottom vertices
 * are shifted by (dx, dz) relative to the 4 top vertices, so the whole leg
 * leans in the (dx, dz) direction. dx/dz are in three.js units (already
 * scaled).
 */
function buildSplayedGeometry(
  size: [number, number, number],
  dx: number,
  dz: number,
): BufferGeometry {
  const [lx, ly, lz] = size;
  const hx = lx / 2;
  const hy = ly / 2;
  const hz = lz / 2;
  const v: number[] = [
    // bottom (y = -hy), shifted by (dx, dz)
    -hx + dx, -hy, -hz + dz,
    hx + dx, -hy, -hz + dz,
    hx + dx, -hy, hz + dz,
    -hx + dx, -hy, hz + dz,
    // top (y = +hy)
    -hx, hy, -hz,
    hx, hy, -hz,
    hx, hy, hz,
    -hx, hy, hz,
  ];
  const f = (a: number, b: number, c: number, d: number) => [a, b, c, a, c, d];
  const idx = [
    ...f(0, 1, 2, 3),
    ...f(4, 7, 6, 5),
    ...f(0, 4, 5, 1),
    ...f(1, 5, 6, 2),
    ...f(2, 6, 7, 3),
    ...f(3, 7, 4, 0),
  ];
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(v, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * 牙條梯形：上窄下寬（或反之）的 box，length 軸在 ±width/2 端不同尺寸。
 * 用於外斜腳家具的 apron——讓 apron 的左右端跟著腳的中心軸傾斜對齊。
 * 8 corners: 上 (local Z=-hz) 用 topScale 縮 length，下 (local Z=+hz) 用 bottomScale。
 */
function buildApronTrapezoidGeometry(
  size: [number, number, number],
  topScale: number,
  bottomScale: number,
  bevelAngle: number = 0,
  bevelMode: "full" | "half" = "full",
): BufferGeometry {
  const [lx, ly, lz] = size;
  const hx = lx / 2;
  const hy = ly / 2;
  const hz = lz / 2;
  const topX = hx * topScale;
  const botX = hx * bottomScale;
  // bevel shear：z' = z - y × tan(bevel)
  // mode="half"：只 top 4 vertex shear（頂面水平、底面跟 rotation 自然斜）
  const shear = Math.tan(bevelAngle);
  const topShear = shear;
  const botShear = bevelMode === "half" ? 0 : shear;
  const v: number[] = [
    -topX, -hy, -hz - (-hy) * topShear,
    topX, -hy, -hz - (-hy) * topShear,
    topX, hy, -hz - (+hy) * topShear,
    -topX, hy, -hz - (+hy) * topShear,
    -botX, -hy, hz - (-hy) * botShear,
    botX, -hy, hz - (-hy) * botShear,
    botX, hy, hz - (+hy) * botShear,
    -botX, hy, hz - (+hy) * botShear,
  ];
  // 6 faces, CCW from outside
  const f = (a: number, b: number, c: number, d: number) => [a, b, c, a, c, d];
  const idx = [
    ...f(0, 3, 2, 1), // -z face (top of apron in world)
    ...f(4, 5, 6, 7), // +z face (bottom of apron in world)
    ...f(0, 1, 5, 4), // -y face
    ...f(2, 3, 7, 6), // +y face
    ...f(1, 2, 6, 5), // +x face
    ...f(3, 0, 4, 7), // -x face
  ];
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(v, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * 牙條斜邊（apron beveled）：上下緣切斜面，跟外斜腳 apron tilt 互補。
 * Local 截面從矩形變平行四邊形：所有 corner 的 z 偏移 -y × tan(bevelAngle)。
 * 套用 part rotation 後上下緣面在世界中保持水平（可貼緊椅面 / 地面）。
 *
 * bevelAngle = 牙條繞 local X 軸的「補償用」旋轉量（signed radians）。
 *   X 軸 apron（前/後）：bevelAngle = (-sz) × tilt
 *   Z 軸 apron（左/右）：bevelAngle = -(sx) × tilt
 */
function buildBeveledApronGeometry(
  size: [number, number, number],
  bevelAngle: number,
): BufferGeometry {
  const [lx, ly, lz] = size;
  const hx = lx / 2;
  const hy = ly / 2;
  const hz = lz / 2;
  const shear = Math.tan(bevelAngle);
  // For corner (x, y, z): z' = z - y × shear. Top z = -hz, bottom z = +hz.
  // 8 verts in same order as buildApronTrapezoidGeometry：z=-hz first, z=+hz second
  const v: number[] = [
    -hx, -hy, -hz - (-hy) * shear, // 0: -x, -y, top  → z' = -hz + hy*shear
    +hx, -hy, -hz - (-hy) * shear, // 1: +x, -y, top
    +hx, +hy, -hz - (+hy) * shear, // 2: +x, +y, top  → z' = -hz - hy*shear
    -hx, +hy, -hz - (+hy) * shear, // 3: -x, +y, top
    -hx, -hy, +hz - (-hy) * shear, // 4: -x, -y, bot  → z' = +hz + hy*shear
    +hx, -hy, +hz - (-hy) * shear, // 5: +x, -y, bot
    +hx, +hy, +hz - (+hy) * shear, // 6: +x, +y, bot  → z' = +hz - hy*shear
    -hx, +hy, +hz - (+hy) * shear, // 7: -x, +y, bot
  ];
  const f = (a: number, b: number, c: number, d: number) => [a, b, c, a, c, d];
  const idx = [
    ...f(0, 3, 2, 1), // -z face (top of apron in world)
    ...f(4, 5, 6, 7), // +z face (bottom of apron in world)
    ...f(0, 1, 5, 4), // -y face
    ...f(2, 3, 7, 6), // +y face
    ...f(1, 2, 6, 5), // +x face
    ...f(3, 0, 4, 7), // -x face
  ];
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(v, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * Half-beveled apron: 只把「上 4 vertex」shear（補償 rotation 的 tilt → 頂面在 world 水平）；
 * 「下 4 vertex」不動（底面跟著 rotation 自然斜，跟腳同向）。
 * 牙條 apronDropFromTop=0 時用，頂面才能貼緊水平的座板。
 */
function buildHalfBeveledApronGeometry(
  size: [number, number, number],
  bevelAngle: number,
): BufferGeometry {
  const [lx, ly, lz] = size;
  const hx = lx / 2;
  const hy = ly / 2;
  const hz = lz / 2;
  const shear = Math.tan(bevelAngle);
  const v: number[] = [
    -hx, -hy, -hz - (-hy) * shear, // 0: top, sheared
    +hx, -hy, -hz - (-hy) * shear, // 1: top, sheared
    +hx, +hy, -hz - (+hy) * shear, // 2: top, sheared
    -hx, +hy, -hz - (+hy) * shear, // 3: top, sheared
    -hx, -hy, +hz,                  // 4: bot, NOT sheared
    +hx, -hy, +hz,                  // 5: bot
    +hx, +hy, +hz,                  // 6: bot
    -hx, +hy, +hz,                  // 7: bot
  ];
  const f = (a: number, b: number, c: number, d: number) => [a, b, c, a, c, d];
  const idx = [
    ...f(0, 3, 2, 1),
    ...f(4, 5, 6, 7),
    ...f(0, 1, 5, 4),
    ...f(2, 3, 7, 6),
    ...f(1, 2, 6, 5),
    ...f(3, 0, 4, 7),
  ];
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(v, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * 板狀零件頂緣 4 邊倒角（chamfered top）：
 * 座板 / 桌面常見的「邊緣 5×45° 倒角」或「R5/R12 圓角」視覺呈現。
 * 為簡化都用 45° 倒角實作（視覺接近，3D 不真做圓弧）：
 *   - chamfered: chamferMm = 5
 *   - rounded R5: chamferMm = 5（同 chamfered，視覺差異看 SVG label）
 *   - rounded R12: chamferMm = 12
 * Local Y 是厚度軸（origin = 底部），頂面 = +y 那面。
 * 16 vertices: 8 原 box 頂點 + 8 新增（頂面 4 角往內縮、頂面下緣 4 角）
 */
function buildChamferedTopGeometry(
  size: [number, number, number],
  chamferMm: number,
  style: "chamfered" | "rounded" = "chamfered",
  bottomChamferMm: number = 0,
  cornerR: number = 0,
): BufferGeometry {
  const [lx, ly, lz] = size;
  const hx = lx / 2;
  const hz = lz / 2;
  const yBot = -ly / 2;
  const yTop = ly / 2;
  const cTop = Math.min(chamferMm, ly * 0.45, hx * 0.45, hz * 0.45);
  const cBot = bottomChamferMm > 0
    ? Math.min(bottomChamferMm, ly * 0.45, hx * 0.45, hz * 0.45)
    : 0;
  const baseR = Math.max(0, Math.min(cornerR, hx * 0.95, hz * 0.95));

  // 圓角用多段 chamfer 拼近似四分圓，45° 用單段斜面
  const segs = style === "rounded" ? 4 : 1;
  const cornerSegs = baseR > 0 ? 6 : 0;

  // 由下往上堆 levels：每個 level 有 (y, inset)
  const levels: Array<{ y: number; inset: number }> = [];
  if (cBot > 0) {
    for (let i = 0; i <= segs; i++) {
      const θ = (i * Math.PI) / 2 / segs;
      levels.push({
        y: yBot + cBot - cBot * Math.sin(θ),
        inset: cBot - cBot * Math.cos(θ),
      });
    }
    levels.reverse();
  } else {
    levels.push({ y: yBot, inset: 0 });
  }
  for (let i = 1; i <= segs; i++) {
    const θ = (i * Math.PI) / 2 / segs;
    levels.push({
      y: yTop - cTop + cTop * Math.sin(θ),
      inset: cTop - cTop * Math.cos(θ),
    });
  }
  if (cTop > 0) {
    const insertIdx = levels.length - segs;
    levels.splice(insertIdx, 0, { y: yTop - cTop, inset: 0 });
  }

  // 一個 level 的 perimeter (X-Z 平面 4 角圓角矩形)，CCW 從 +Y 方向看（俯視）
  // 4 個角各 (cornerSegs+1) 點；無圓角時退回 4 角矩形
  // ⚠ 每層點數必須一致（下方三角化寫死 K = perimeters[0].length）。
  //   cornerSegs > 0 時一律走圓角迴圈——r 夾到 0（cornerR < chamferMm 時上倒角層會發生）
  //   也只是讓該角的點塌縮到尖角，點數仍 = 4×(cornerSegs+1)，K 不會錯位。
  const perimeterAt = (inset: number): Array<[number, number]> => {
    const ax = Math.max(0, hx - inset);
    const az = Math.max(0, hz - inset);
    const r = Math.max(0, Math.min(baseR - inset, ax, az));
    if (cornerSegs === 0) {
      return [[-ax, -az], [+ax, -az], [+ax, +az], [-ax, +az]];
    }
    const pts: Array<[number, number]> = [];
    // BR 角 (中心 +ax-r, -az+r)，從 -π/2 → 0
    for (let i = 0; i <= cornerSegs; i++) {
      const t = -Math.PI / 2 + (Math.PI / 2) * (i / cornerSegs);
      pts.push([(ax - r) + r * Math.cos(t), (-az + r) + r * Math.sin(t)]);
    }
    // TR 角 (中心 +ax-r, +az-r)，從 0 → π/2
    for (let i = 0; i <= cornerSegs; i++) {
      const t = (Math.PI / 2) * (i / cornerSegs);
      pts.push([(ax - r) + r * Math.cos(t), (az - r) + r * Math.sin(t)]);
    }
    // TL 角 (中心 -ax+r, +az-r)，從 π/2 → π
    for (let i = 0; i <= cornerSegs; i++) {
      const t = Math.PI / 2 + (Math.PI / 2) * (i / cornerSegs);
      pts.push([(-ax + r) + r * Math.cos(t), (az - r) + r * Math.sin(t)]);
    }
    // BL 角 (中心 -ax+r, -az+r)，從 π → 3π/2
    for (let i = 0; i <= cornerSegs; i++) {
      const t = Math.PI + (Math.PI / 2) * (i / cornerSegs);
      pts.push([(-ax + r) + r * Math.cos(t), (-az + r) + r * Math.sin(t)]);
    }
    return pts;
  };

  // 算每個 level 的 perimeter，K = 同一個值（每層點數一樣）
  const perimeters = levels.map((L) => perimeterAt(L.inset));
  const K = perimeters[0].length;

  const v: number[] = [];
  for (let li = 0; li < levels.length; li++) {
    const L = levels[li];
    const peri = perimeters[li];
    for (const [x, z] of peri) {
      v.push(x, L.y, z);
    }
  }
  // 底面與頂面用 fan 三角化，center 點放最後
  const bottomCenterIdx = levels.length * K;
  v.push(0, levels[0].y, 0);
  const topCenterIdx = bottomCenterIdx + 1;
  v.push(0, levels[levels.length - 1].y, 0);

  const idx: number[] = [];

  // 底面 fan：perimeter 點 0..K-1 在 X-Z 平面是 BL→BR→TR→TL（CCW from +Y）
  // 從 -Y 看（仰望）這變 CW；底面 outward=-Y，要 CCW from -Y 才對 → idx 用 (center, a, b)
  for (let i = 0; i < K; i++) {
    const a = i;
    const b = (i + 1) % K;
    idx.push(bottomCenterIdx, a, b);
  }

  // 相鄰 level 之間連接（每邊 K 個 quad）
  for (let li = 0; li < levels.length - 1; li++) {
    const a0 = li * K;
    const a1 = (li + 1) * K;
    for (let i = 0; i < K; i++) {
      const i1 = (i + 1) % K;
      idx.push(a0 + i, a1 + i, a1 + i1);
      idx.push(a0 + i, a1 + i1, a0 + i1);
    }
  }

  // 頂面 fan：perimeter 是 CCW from +Y 看，頂面 outward=+Y 要 CCW from +Y → 用 (center, b, a)
  const topBase = (levels.length - 1) * K;
  for (let i = 0; i < K; i++) {
    const a = topBase + i;
    const b = topBase + ((i + 1) % K);
    idx.push(topCenterIdx, b, a);
  }

  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(v, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * 4 條沿最長軸的長邊各倒 45°——cross-section 從正方形變八角形。
 * 自動偵測 size 三軸最大者當「長軸」（腳 = Y、橫撐 = X）。
 * 16 vertices = 8 cross-section corners × 2 ends。
 *
 * splayDx / splayDz：可選的「底端偏移」——非 0 時把長軸最低端（-ha）整面
 * 沿 X / Z 平移，組合 chamfered + splayed（外斜腳也要倒角）。
 */
function buildChamferedEdgesGeometry(
  size: [number, number, number],
  chamferMm: number,
  style: "chamfered" | "rounded" = "chamfered",
  splayDx: number = 0,
  splayDz: number = 0,
  bottomScale: number = 1,
): BufferGeometry {
  const [lx, ly, lz] = size;
  const longAxis: 0 | 1 | 2 =
    ly > lx && ly > lz ? 1 : lz > lx && lz > ly ? 2 : 0;
  const shortDim = (i: 0 | 1 | 2) => (i === 0 ? lx : i === 1 ? ly : lz);
  const longLen = shortDim(longAxis);
  const sa1 = ((longAxis + 1) % 3) as 0 | 1 | 2;
  const sa2 = ((longAxis + 2) % 3) as 0 | 1 | 2;
  const ha = longLen / 2;
  const hb = shortDim(sa1) / 2;
  const hc = shortDim(sa2) / 2;
  const c = Math.min(chamferMm, hb * 0.45, hc * 0.45);

  // 圓角用 N=4 段 chamfer 拼近似四分圓；45° 用 1 段
  const segs = style === "rounded" ? 4 : 1;
  // 每個 corner 都是凸圓弧，圓心在內側 c 距離處
  // CCW 順序（從 +b 軸看 +long 方向）：NE → NW → SW → SE
  const arcPts = (cx: number, cy: number, θ0: number, θ1: number): Array<[number, number]> => {
    const pts: Array<[number, number]> = [];
    for (let i = 0; i <= segs; i++) {
      const θ = θ0 + ((θ1 - θ0) * i) / segs;
      pts.push([cx + c * Math.cos(θ), cy + c * Math.sin(θ)]);
    }
    return pts;
  };
  const ne = arcPts(hb - c, hc - c, 0, Math.PI / 2);            // (hb, hc-c) → (hb-c, hc)
  const nw = arcPts(-hb + c, hc - c, Math.PI / 2, Math.PI);     // (-hb+c, hc) → (-hb, hc-c)
  const sw = arcPts(-hb + c, -hc + c, Math.PI, 3 * Math.PI / 2); // (-hb, -hc+c) → (-hb+c, -hc)
  const se = arcPts(hb - c, -hc + c, 3 * Math.PI / 2, 2 * Math.PI); // (hb-c, -hc) → (hb, -hc+c)
  // 一圈 CCW：ne 末 = (hb-c, hc) → nw 起 = (-hb+c, hc) 之間是 top straight（不加中間點）
  // 完整序列：ne ∪ nw ∪ sw ∪ se
  const cs: Array<[number, number]> = [...ne, ...nw, ...sw, ...se];

  // 每個 cross-section corner 在兩端 (long axis = ±ha) 各一個 vertex → 16 verts
  // vertex layout: 0..7 = 端 -ha 的 8 點，8..15 = 端 +ha 的 8 點
  // 把 (a, b, c) 的 longAxis 座標放對位置
  const place = (axisVal: number, sa1Val: number, sa2Val: number): [number, number, number] => {
    const arr: [number, number, number] = [0, 0, 0];
    arr[longAxis] = axisVal;
    arr[sa1] = sa1Val;
    arr[sa2] = sa2Val;
    return arr;
  };

  const N = cs.length; // chamfered=8, rounded=20
  const v: number[] = [];
  // 底端（-ha 端）：可選 bottomScale 縮 cross-section（tapered+chamfered 用）
  // 加 splayDx/Dz 平移（splayed+chamfered 用）。兩者可獨立或組合。
  for (const [b, cc] of cs) {
    const p = place(-ha, b * bottomScale, cc * bottomScale);
    p[0] += splayDx;
    p[2] += splayDz;
    v.push(...p);
  }
  for (const [b, cc] of cs) v.push(...place(+ha, b, cc));

  const f = (a: number, b: number, c: number, d: number) => [a, b, c, a, c, d];
  const idx: number[] = [];

  // N 個側面（cross-section 邊 × 長軸延伸）
  for (let i = 0; i < N; i++) {
    const next = (i + 1) % N;
    idx.push(...f(i, next, next + N, i + N));
  }
  // 兩個多邊形端面（fan from vertex 0）
  for (let i = 1; i < N - 1; i++) {
    idx.push(0, i + 1, i);          // -ha 端
    idx.push(N, N + i, N + i + 1);  // +ha 端
  }

  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(v, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * 外斜方錐：方料 + 上下不同尺寸 + 底部偏移。
 * 上方面 (lx × lz) 在 y=+hy（無偏移），下方面 (lx*scale × lz*scale) 在 y=-hy
 * 偏移 (dx, dz)。
 */
function buildSplayedTaperedGeometry(
  size: [number, number, number],
  scale: number,
  dx: number,
  dz: number,
): BufferGeometry {
  const [lx, ly, lz] = size;
  const hx = lx / 2;
  const hy = ly / 2;
  const hz = lz / 2;
  const bx = hx * scale;
  const bz = hz * scale;
  const v: number[] = [
    -bx + dx, -hy, -bz + dz,
    bx + dx, -hy, -bz + dz,
    bx + dx, -hy, bz + dz,
    -bx + dx, -hy, bz + dz,
    -hx, hy, -hz,
    hx, hy, -hz,
    hx, hy, hz,
    -hx, hy, hz,
  ];
  const f = (a: number, b: number, c: number, d: number) => [a, b, c, a, c, d];
  const idx = [
    ...f(0, 1, 2, 3),
    ...f(4, 7, 6, 5),
    ...f(0, 4, 5, 1),
    ...f(1, 5, 6, 2),
    ...f(2, 6, 7, 3),
    ...f(3, 7, 4, 0),
  ];
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(v, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * 外斜圓錐：圓料（直徑 = lx）+ 上下不同半徑 + 底部偏移。
 * segments 段邊（48 段視覺平滑），加上下 cap 中心點。
 */
function buildSplayedRoundTaperedGeometry(
  size: [number, number, number],
  scale: number,
  dx: number,
  dz: number,
  segments = 48,
): BufferGeometry {
  const [lx, ly] = size;
  const r = lx / 2;
  const hy = ly / 2;
  const rTop = r;
  const rBot = r * scale;
  const v: number[] = [];
  for (let i = 0; i < segments; i++) {
    const theta = (i / segments) * 2 * Math.PI;
    v.push(Math.cos(theta) * rTop, hy, Math.sin(theta) * rTop);
  }
  for (let i = 0; i < segments; i++) {
    const theta = (i / segments) * 2 * Math.PI;
    v.push(Math.cos(theta) * rBot + dx, -hy, Math.sin(theta) * rBot + dz);
  }
  const topCenter = segments * 2;
  const botCenter = segments * 2 + 1;
  v.push(0, hy, 0);
  v.push(dx, -hy, dz);
  const idx: number[] = [];
  for (let i = 0; i < segments; i++) {
    const i0 = i;
    const i1 = (i + 1) % segments;
    const j0 = segments + i;
    const j1 = segments + ((i + 1) % segments);
    // 側面：CCW from outside（法線朝外）
    // theta 由小到大走 CCW 從上往下看（+Y），但側面要從外側看 CCW
    // 順序：i0 (top θ) → i1 (top θ+δ) → j1 (bot θ+δ) → j0 (bot θ)
    idx.push(i0, i1, j1, i0, j1, j0);
    // 上 cap（CCW from above looking +Y down）：center → i0 → i1
    idx.push(topCenter, i0, i1);
    // 下 cap（CCW from below looking -Y up）：center → j1 → j0
    idx.push(botCenter, j1, j0);
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(v, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * Live edge 板狀零件（保留樹皮的原木板桌面）。
 *
 * 兩條長邊（±Z 方向）以多段 sin 組合 noise 做不規則波浪，模擬樹皮的有機曲線。
 * 兩端 (±X) 與上下面 (±Y) 保持平直。
 *
 * 段數固定 32（沿長邊取樣），波形 = 3 個不同週期的 sin 疊加，振幅 = amplitudeMm。
 * 兩條長邊用不同 phase（差 π/3），看起來不會對稱。
 */
/**
 * 4 角缺角板：層板 4 個角各切掉 notchLength × notchWidth 的矩形。
 * 用 8-corner 多邊形 prism——上下兩面都是 8 邊形，4 條垂直邊連起來。
 * 用途：座下層板延伸到下橫撐齊平、跟腳柱重疊的角要切掉。
 */
/**
 * 反向法複斜 miter：直接從 part-local 8 頂點構幾何，bypass ring extrude。
 * Layout：index 0..3 = z=-hz（世界頂）、index 4..7 = z=+hz（世界底）。
 * 同 mitered-ends 的 ring layout 慣例（outer/inner 順序）。
 * 12 面 = 4 側面 quad × 2 三角 + 上下 cap fan × 2 三角。
 * 用 toNonIndexed + flatShading 保留複斜 cut face 的硬邊。
 */
function buildCompoundMiterFromVerts(verts: [number, number, number][]): BufferGeometry {
  const v: number[] = [];
  for (const [x, y, z] of verts) v.push(x, y, z);
  const N = 4;
  const idx: number[] = [];
  for (let i = 0; i < N; i++) {
    const a = i;
    const b = (i + 1) % N;
    const at = a + N;
    const bt = b + N;
    idx.push(a, b, bt, a, bt, at);
  }
  for (let i = 1; i < N - 1; i++) idx.push(0, i + 1, i);
  for (let i = 1; i < N - 1; i++) idx.push(N, N + i, N + i + 1);
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(v, 3));
  g.setIndex(idx);
  const nonIndexed = g.toNonIndexed();
  g.dispose();
  nonIndexed.computeVertexNormals();
  return nonIndexed;
}

/**
 * 4 壁 45° 斜接：梯形在 local X-Y 平面（length × thickness），沿 Z 軸（width=wallH）擠出。
 * outerSide="+y" → local +Y 邊為外緣全長 L，-Y 邊為內緣 L−2×inset。
 * outerSide="-y" → 反過來。前/右壁用 +y、後/左壁用 -y，4 壁拼起來 4 角 45° 對接。
 */
function buildMiteredEndsGeometry(
  size: [number, number, number],
  insetEach: number,
  outerSide: "+y" | "-y" = "+y",
  tiltAngle: number = 0,
  bevelAngle: number = 0,
): BufferGeometry {
  // tiltAngle 目前 geometry 本身不直接套（rotation 由 tray.ts 那邊處理），
  // 收下參數是為了 caller API 對稱、未來若要 geometry 自體傾倒可從這裡擴。
  // bevelAngle > 0：頂 ring（z=+hz）的外緣 length 方向內縮 lz·tan(B)，
  // 視覺上 plan 看到端面是「下寬上窄」的梯形（複斜 miter cut 的真實樣）。
  void tiltAngle;
  const [lx, ly, lz] = size;
  const hx = lx / 2;
  const hy = ly / 2;
  const hz = lz / 2;
  const inset = Math.max(0, Math.min(insetEach, hx * 0.95));
  if (inset <= 0) {
    return new BoxGeometry(lx, ly, lz);
  }
  // ring 在 X-Y 平面，CW from +Z viewer（沿用 buildNotchedCornersGeometry winding 慣例）
  // outerSide="+y"：outer 邊（全長 L）在 +hy，inner 邊（短）在 -hy
  // outerSide="-y"：outer 邊在 -hy，inner 邊在 +hy
  const ring: Array<[number, number]> = outerSide === "+y"
    ? [
        [+hx,          +hy],  // outer right
        [-hx,          +hy],  // outer left
        [-hx + inset,  -hy],  // inner left (recessed)
        [+hx - inset,  -hy],  // inner right
      ]
    : [
        [+hx - inset,  +hy],  // inner right (recessed)
        [-hx + inset,  +hy],  // inner left
        [-hx,          -hy],  // outer left
        [+hx,          -hy],  // outer right
      ];
  // bevel：頂端（+hz = 牆頂）外緣比底端內縮 lz·tan(bevelAngle)，
  // 對應 inset 也是 lz·tan(bevelAngle)（用 tan M = cos θ 與 tan B 統一相減算）
  const bevelInset = bevelAngle > 0 ? lz * Math.tan(bevelAngle) : 0;
  const ringTop: Array<[number, number]> = outerSide === "+y"
    ? [
        [+hx - bevelInset,                  +hy],
        [-hx + bevelInset,                  +hy],
        [-hx + bevelInset + inset,          -hy],
        [+hx - bevelInset - inset,          -hy],
      ]
    : [
        [+hx - bevelInset - inset,          +hy],
        [-hx + bevelInset + inset,          +hy],
        [-hx + bevelInset,                  -hy],
        [+hx - bevelInset,                  -hy],
      ];
  const v: number[] = [];
  for (const [x, y] of ring) v.push(x, y, -hz);
  for (const [x, y] of ringTop) v.push(x, y, +hz);
  const N = ring.length;
  const idx: number[] = [];
  // ring CW from +Z + extrude along Z 的 outward normal winding（已用 cross product
  // 推導；切勿沿用 notched-corners 的 pattern—那是 extrude along Y 的版本，sign 不同）
  for (let i = 0; i < N; i++) {
    const a = i;
    const b = (i + 1) % N;
    const at = a + N;
    const bt = b + N;
    idx.push(a, b, bt, a, bt, at);
  }
  // 底蓋 z=-hz：outward = -Z → 反向 fan
  for (let i = 1; i < N - 1; i++) idx.push(0, i + 1, i);
  // 頂蓋 z=+hz：outward = +Z → 正向 fan
  for (let i = 1; i < N - 1; i++) idx.push(N, N + i, N + i + 1);
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(v, 3));
  g.setIndex(idx);
  // toNonIndexed → 每三角形獨立 vertex，computeVertexNormals 不會跨面平均
  // 確保 flatShading 真正 flat（45° miter inner 邊內角不會被法向量插值成圓角）
  const nonIndexed = g.toNonIndexed();
  g.dispose();
  nonIndexed.computeVertexNormals();
  return nonIndexed;
}

/**
 * 4 壁指接（finger / box joint）：polygon 在 local X-Z 平面（length × height），
 * 沿 Y 軸（thickness）擠出全壁厚。Comb 沿 Z 軸交錯凸齒/凹槽，每段高 lz/segmentCount。
 * phase=0：local -Z 起算第 1 段為齒（X 推到 ±hx）；phase=1：第 1 段為槽（X 內縮 fingerDepth）。
 * Winding 同 buildNotchedCornersGeometry（也沿 Y 擠出，已驗證 outward）。
 */
/**
 * 正多邊形板（六/八角筆筒底板）：N-gon 沿 thickness 軸（Y）擠出。
 */
function buildRegularPolygonGeometry(
  size: [number, number, number],
  sides: number,
  outerRadius: number,
  angleOffsetDeg: number,
): BufferGeometry {
  const [, ly] = size;
  const hy = ly / 2;
  const N = Math.max(3, Math.floor(sides));
  const angleOffset = (angleOffsetDeg * Math.PI) / 180;
  const shape2D = new Shape();
  for (let i = 0; i < N; i++) {
    const ang = angleOffset + (i * 2 * Math.PI) / N;
    const x = outerRadius * Math.cos(ang);
    const y = outerRadius * Math.sin(ang);
    if (i === 0) shape2D.moveTo(x, y);
    else shape2D.lineTo(x, y);
  }
  shape2D.closePath();
  const extrude = new ExtrudeGeometry(shape2D, { depth: ly, bevelEnabled: false });
  extrude.translate(0, 0, -hy);
  extrude.rotateX(Math.PI / 2);
  return extrude;
}

function buildFingerJointEndsGeometry(
  size: [number, number, number],
  segmentCount: number,
  phase: 0 | 1,
  fingerDepth: number,
  edgeChamferMm: number = 0,
): BufferGeometry {
  const [lx, ly, lz] = size;
  const hx = lx / 2;
  const hy = ly / 2;
  const hz = lz / 2;
  const depth = Math.max(0, Math.min(fingerDepth, hx * 0.95));
  const N = Math.max(2, Math.floor(segmentCount));
  if (depth <= 0) return new BoxGeometry(lx, ly, lz);
  // 注意：edgeChamferMm 留 API 給未來但目前不套——bevelEnabled 會把齒邊也倒圓
  // 破壞接合外觀。要做 selective chamfer（只動世界頂緣不動齒邊）需手刻 geometry。
  void edgeChamferMm;
  const segH = lz / N;
  const isFinger = (s: number) => ((s + phase) % 2) === 0;
  const xRightAt = (s: number) => (isFinger(s) ? +hx : +hx - depth);
  const xLeftAt = (s: number) => (isFinger(s) ? -hx : -hx + depth);
  // 用 Three.js Shape + ExtrudeGeometry（earcut 三角化），手刻 fan tri 對凹形會破洞。
  // Shape 在 X-Y 平面，CCW from +Z viewer 繞 polygon：bottom-right 起 → 右上 → 左上 → 左下 → close。
  // 內部 X 軸對應 wall length，Shape Y 軸對應 wallH（heights）。擠出沿 +Z = thickness 方向。
  const shape2D = new Shape();
  shape2D.moveTo(xRightAt(0), -hz);
  for (let s = 0; s < N; s++) {
    const x = xRightAt(s);
    const yTop = -hz + (s + 1) * segH;
    shape2D.lineTo(x, yTop);
    if (s < N - 1) {
      const nx = xRightAt(s + 1);
      if (nx !== x) shape2D.lineTo(nx, yTop);
    }
  }
  shape2D.lineTo(xLeftAt(N - 1), +hz);
  for (let s = N - 1; s >= 0; s--) {
    const x = xLeftAt(s);
    const yBot = -hz + s * segH;
    shape2D.lineTo(x, yBot);
    if (s > 0) {
      const nx = xLeftAt(s - 1);
      if (nx !== x) shape2D.lineTo(nx, yBot);
    }
  }
  shape2D.closePath();
  // ExtrudeGeometry: Shape (X, Y_height) 沿 +Z 擠出 depth=ly（= thickness）。
  // 結果 3D 頂點：X=length, Y=wallH, Z=[0, ly]。
  // Step 1: translate(0, 0, -hy) → Z 中心化 [-hy, +hy]
  // Step 2: rotateX(+π/2) 把 Y↔Z 軸互換 → X=length, Y=±thickness, Z=±wallH（manual 幾何框架）
  const extrude = new ExtrudeGeometry(shape2D, { depth: ly, bevelEnabled: false });
  extrude.translate(0, 0, -hy);
  extrude.rotateX(Math.PI / 2);
  return extrude;
}

/**
 * 4 壁鳩尾榫接合 (dovetail joint)：仿 finger-joint，但段是梯形不是矩形。
 *
 * 形狀同 finger-joint：comb 沿 wallH 方向（Shape Y）N 段交錯，pin 段往 ±X 凸出
 *   pinDepth；gap 段內縮。差異：pin 段不是直角矩形，而是「外寬內窄」梯形
 *   （pin 朝外的 tip 邊比朝內的 base 邊長 2·slantY，slantY = pinDepth·tan(α)）。
 *   gap 段同樣承接梯形邊，外窄內寬。視覺上 4 角從外面看就是鳩尾榫 trapezoid 互鎖。
 *
 * 對稱：phase 0 / 1 交錯，鄰壁 phase 相反 → 互嵌（一邊 pin 一邊 gap）。
 * halfPin=true：第 0 / 最後段強制為 pin，且外邊界不收斜——傳統「兩端半 pin」做法，
 *   不破角更穩。
 *
 * Shape2D 在 X-Y 平面，CCW from +Z viewer 走外輪廓：右邊 bot→top，左邊 top→bot 閉合。
 * 沿用 finger-joint 的「ExtrudeGeometry 沿 +Z=ly 擠出 → translate -hy → rotateX +π/2」
 * pipeline，extrude 後局部框架 X=length, Y=±thickness, Z=±wallH。
 */
function buildDovetailEndsGeometry(
  size: [number, number, number],
  segmentCount: number,
  phase: 0 | 1,
  angleDeg: number,
  pinDepth: number,
  halfPin: boolean = true,
): BufferGeometry {
  const [lx, ly, lz] = size;
  const hx = lx / 2;
  const hy = ly / 2;
  const hz = lz / 2;
  const depth = Math.max(0, Math.min(pinDepth, hx * 0.95));
  const N = Math.max(3, Math.floor(segmentCount));
  if (depth <= 0) return new BoxGeometry(lx, ly, lz);
  const segH = lz / N;
  // 鳩尾角的 Y 方向收斜量：slantY = depth · tan(α)
  // clamp 到 segH/2 避免相鄰 pin 的肩交疊（segH 太小或 angle 太大時）
  const angleRad = (Math.max(1, Math.min(25, angleDeg)) * Math.PI) / 180;
  const slantY = Math.min(segH * 0.45, depth * Math.tan(angleRad));

  // halfPin=true：強制 s=0 與 s=N-1 為 pin（保護 corner 不破角）
  const isPin = (s: number): boolean => {
    if (halfPin && (s === 0 || s === N - 1)) return true;
    return ((s + phase) % 2) === 0;
  };

  // phase=0 (tail board，前後板)：tail 是 trapezoid 端頭最寬（top 上凸 + bot 下凸）
  //   tail face view 看：燕尾型寬端在外
  // phase=1 (pin board，左右板)：pin 在 face view 是 PARALLELOGRAM、外側較低內側較高
  //   都是直線（top 跟 bot 同方向往下斜）；trapezoidal 鳩尾型只在端頭視才出現
  //   （在 thickness 方向、不在 height 方向）
  // 兩者互嵌：tail 寬端正好卡進 pin 之間的 gap。
  const topSlant = phase === 0 ? +slantY : -slantY;  // tail top 上凸；pin top 下斜
  const botSlant = -slantY;                            // 兩者 bot 都下凸/下斜

  // 沿右邊 (X = +hx tip / +hx - depth base) 走 bot→top；左邊 (X = -hx tip / -hx + depth base) 走 top→bot 閉合
  const xRTip = +hx;
  const xRBase = +hx - depth;
  const xLTip = -hx;
  const xLBase = -hx + depth;

  // 收集點到 array 然後 push 進 Shape；可去重相鄰相同點
  const pts: Array<[number, number]> = [];
  const push = (x: number, y: number) => {
    const last = pts[pts.length - 1];
    if (!last || Math.abs(last[0] - x) > 1e-6 || Math.abs(last[1] - y) > 1e-6) {
      pts.push([x, y]);
    }
  };

  // 右邊：sweep s=0..N-1，每段依 pin/gap 推不同邊形
  for (let s = 0; s < N; s++) {
    const yB = -hz + s * segH;
    const yT = yB + segH;
    const pin = isPin(s);
    const isFirst = s === 0;
    const isLast = s === N - 1;
    if (pin) {
      // halfPin 強制 s=0 / s=N-1：對應外邊界（yB for s=0、yT for s=N-1）不收斜
      const hardBot = halfPin && isFirst;
      const hardTop = halfPin && isLast;
      // 1) 進入 segment 底邊：從前一段的終點 (Base, yB) 開始；若上一段也是 pin（連續 pin 不太合理但 halfPin 邊界可能），直接接續
      // bottom corner sequence:
      //   進 pin：(Base, yB) → (Tip, yB + botSlant)  [斜] 除非 hardBot
      if (hardBot) {
        push(xRTip, yB);
      } else {
        push(xRBase, yB);
        push(xRTip, yB + botSlant);
      }
      // top corner sequence:
      //   出 pin：(Tip, yT + topSlant) → (Base, yT)  除非 hardTop
      if (hardTop) {
        push(xRTip, yT);
      } else {
        push(xRTip, yT + topSlant);
        push(xRBase, yT);
      }
    } else {
      // gap：右邊在 Base，從 (Base, yB) 直到 (Base, yT)。
      // 鄰 pin 的 slant 已經把 (Base, yB), (Tip, yB+slantY) 邊推進去——gap 只需把
      // (Base, yT) push 進去即可。但 push 前若上一個是 (Base, yT_prev) = (Base, yB)
      // 就由 dedup 自動處理。
      push(xRBase, yB);
      push(xRBase, yT);
    }
  }

  // 左邊：sweep s=N-1..0（top→bot），對稱推（左邊 pin 凸出到 xLTip = -hx）
  for (let s = N - 1; s >= 0; s--) {
    const yB = -hz + s * segH;
    const yT = yB + segH;
    const pin = isPin(s);
    const isFirst = s === 0;
    const isLast = s === N - 1;
    if (pin) {
      const hardBot = halfPin && isFirst;
      const hardTop = halfPin && isLast;
      // 走 top→bot：先處理 top corner，再 bottom
      if (hardTop) {
        push(xLTip, yT);
      } else {
        push(xLBase, yT);
        push(xLTip, yT + topSlant);
      }
      if (hardBot) {
        push(xLTip, yB);
      } else {
        push(xLTip, yB + botSlant);
        push(xLBase, yB);
      }
    } else {
      // gap：左邊在 Base
      push(xLBase, yT);
      push(xLBase, yB);
    }
  }

  // 構造 Shape
  const shape2D = new Shape();
  if (pts.length === 0) return new BoxGeometry(lx, ly, lz);
  shape2D.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) {
    shape2D.lineTo(pts[i][0], pts[i][1]);
  }
  shape2D.closePath();

  const extrude = new ExtrudeGeometry(shape2D, { depth: ly, bevelEnabled: false });
  extrude.translate(0, 0, -hy);
  extrude.rotateX(Math.PI / 2);
  return extrude;
}

/**
 * 直角三角形板：local X-Z 平面內三角形 cross-section 沿 Y 軸擠出。
 * corner = 直角所在角（X 軸 sign + Z 軸 sign）。三角形 3 個頂點：
 *   - 直角頂點 A = (sx·hx, sz·hz)
 *   - X 邊端點 B = (-sx·hx, sz·hz)
 *   - Z 邊端點 C = (sx·hx, -sz·hz)
 * 上下兩個三角面 + 3 個側面 quad；computeVertexNormals 給法向。
 */
function buildRightTriangleGeometry(
  size: [number, number, number],
  corner: "-x-z" | "-x+z" | "+x-z" | "+x+z",
): BufferGeometry {
  const [lx, ly, lz] = size;
  const hx = lx / 2;
  const hy = ly / 2;
  const hz = lz / 2;
  const sx = corner.startsWith("+x") ? +1 : -1;
  const sz = corner.endsWith("+z") ? +1 : -1;
  // 為了讓上面 (y=+hy) 的三角面 outward normal = +Y，三角形頂點順序需符合
  // (zB-zA)(xC-xA) - (xB-xA)(zC-zA) > 0 → 推導出 sx*sz < 0 時用 (A, B, C)，
  // sx*sz > 0 時用 (A, C, B)。
  const swap = sx * sz > 0;
  const A: [number, number] = [sx * hx, sz * hz];      // 直角
  const Bx: [number, number] = [-sx * hx, sz * hz];    // X 邊另一端
  const Cz: [number, number] = [sx * hx, -sz * hz];    // Z 邊另一端
  const order: Array<[number, number]> = swap ? [A, Cz, Bx] : [A, Bx, Cz];

  const v: number[] = [];
  // bottom 3 verts (y = -hy)
  for (const [x, z] of order) v.push(x, -hy, z);
  // top 3 verts (y = +hy)
  for (const [x, z] of order) v.push(x, +hy, z);

  const idx: number[] = [];
  // 頂面：(3,4,5) → 排好的 order 在 y=+hy 給 +Y outward normal
  idx.push(3, 4, 5);
  // 底面：反向 (0, 2, 1) 給 -Y outward normal
  idx.push(0, 2, 1);
  // 3 個側面 quad：沿底面 winding(0,2,1) 邊 0→2、2→1、1→0，
  // 每個 quad outside-CCW = (a, a+3, b+3, b)，拆 2 三角 → outward normal 朝外。
  const bottomEdges: Array<[number, number]> = [[0, 2], [2, 1], [1, 0]];
  for (const [a, b] of bottomEdges) {
    idx.push(a, a + 3, b + 3);
    idx.push(a, b + 3, b);
  }

  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(v, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * 把 CCW 多邊形每個角倒成兩個點（沿兩鄰邊各內縮 chamferMm），總點數 N→2N。
 * 用於 mitered-corner / 通用 prism 軸向邊 chamfer：cross-section 多邊形 chamfer 後
 * 擠出，原本每個角的 1 條 axial edge 變成 1 條 chamfer 平面 + 兩條主邊夾角。
 */
function chamferPolygon(poly: Array<[number, number]>, chamferMm: number): Array<[number, number]> {
  if (chamferMm <= 0 || poly.length < 3) return poly;
  const result: Array<[number, number]> = [];
  for (let i = 0; i < poly.length; i++) {
    const prev = poly[(i - 1 + poly.length) % poly.length];
    const curr = poly[i];
    const next = poly[(i + 1) % poly.length];
    const dxP = prev[0] - curr[0], dyP = prev[1] - curr[1];
    const lP = Math.hypot(dxP, dyP);
    const dxN = next[0] - curr[0], dyN = next[1] - curr[1];
    const lN = Math.hypot(dxN, dyN);
    if (lP === 0 || lN === 0) { result.push(curr); continue; }
    const cP = Math.min(chamferMm, lP * 0.45);
    const cN = Math.min(chamferMm, lN * 0.45);
    // Pa: 沿往 prev 方向內縮 cP
    result.push([curr[0] + dxP / lP * cP, curr[1] + dyP / lP * cP]);
    // Pb: 沿往 next 方向內縮 cN
    result.push([curr[0] + dxN / lN * cN, curr[1] + dyN / lN * cN]);
  }
  return result;
}

/**
 * 帶 noChamfer 旗標的 chamfer：跳過接合處（miter 兩端），其他角倒兩個點。
 */
function chamferPolygonWithFlags(
  poly: Array<{ p: [number, number]; noChamfer: boolean }>,
  chamferMm: number,
): Array<[number, number]> {
  if (chamferMm <= 0 || poly.length < 3) return poly.map((v) => v.p);
  const result: Array<[number, number]> = [];
  for (let i = 0; i < poly.length; i++) {
    const v = poly[i];
    if (v.noChamfer) {
      result.push(v.p);
      continue;
    }
    const prev = poly[(i - 1 + poly.length) % poly.length].p;
    const curr = v.p;
    const next = poly[(i + 1) % poly.length].p;
    const dxP = prev[0] - curr[0], dyP = prev[1] - curr[1];
    const lP = Math.hypot(dxP, dyP);
    const dxN = next[0] - curr[0], dyN = next[1] - curr[1];
    const lN = Math.hypot(dxN, dyN);
    if (lP === 0 || lN === 0) { result.push(curr); continue; }
    const cP = Math.min(chamferMm, lP * 0.45);
    const cN = Math.min(chamferMm, lN * 0.45);
    result.push([curr[0] + dxP / lP * cP, curr[1] + dyP / lP * cP]);
    result.push([curr[0] + dxN / lN * cN, curr[1] + dyN / lN * cN]);
  }
  return result;
}

/**
 * 單邊 45° miter（mitered-corner）：沿 axis 方向擠出 pentagon / trapezoid cross-section。
 * axis = corner edge 跑的軸（x/y/z）
 * corner = 在垂直平面內被削掉的角（a1 sign 後 a2 sign）：
 *   axis=x → (a1=Y, a2=Z); axis=y → (a1=X, a2=Z); axis=z → (a1=X, a2=Y)
 * depthMm = 內縮深度。45° → 兩鄰面各內縮 depthMm。depthMm = 2*halfA1 或 2*halfA2 時退化為梯形（4 vertices）。
 * chamferMm > 0 時，沿軸向邊（=多邊形角延伸出的長邊）倒 45° chamfer。
 */
function buildMiteredCornerGeometry(
  size: [number, number, number],
  axis: "x" | "y" | "z",
  corner: "++" | "+-" | "-+" | "--",
  depthMm: number,
  chamferMm: number = 0,
): BufferGeometry {
  const half = [size[0] / 2, size[1] / 2, size[2] / 2];
  const axisIdx = axis === "x" ? 0 : axis === "y" ? 1 : 2;
  // a1Idx, a2Idx = perpendicular axes (natural: lower-then-higher index)
  const a1Idx = axis === "x" ? 1 : 0;
  const a2Idx = axis === "z" ? 1 : 2;
  const halfEdge = half[axisIdx];
  const halfA1 = half[a1Idx];
  const halfA2 = half[a2Idx];
  const s1 = corner[0] === "+" ? +1 : -1;
  const s2 = corner[1] === "+" ? +1 : -1;
  const d = Math.min(depthMm, 2 * halfA1, 2 * halfA2);

  // 4 corners CCW in (a1, a2) plane (natural orientation: a1 right, a2 up).
  // 順序：(--), (+-), (++), (-+)
  const baseCorners: Array<[number, number, string]> = [
    [-halfA1, -halfA2, "--"],
    [+halfA1, -halfA2, "+-"],
    [+halfA1, +halfA2, "++"],
    [-halfA1, +halfA2, "-+"],
  ];

  // Replace cut corner with 2 inset points; dedupe coincident vertices.
  // 每個 vertex 帶 noChamfer 旗標：true = 接合處（miter 兩端），不可倒角
  const eps = 1e-6;
  type PolyVertex = { p: [number, number]; noChamfer: boolean };
  const polyCCW: PolyVertex[] = [];
  const pushIfDistinct = (p: [number, number], noChamfer: boolean) => {
    const last = polyCCW[polyCCW.length - 1];
    if (last && Math.abs(last.p[0] - p[0]) < eps && Math.abs(last.p[1] - p[1]) < eps) {
      // coincide → 合併，noChamfer 取 OR
      last.noChamfer = last.noChamfer || noChamfer;
      return;
    }
    polyCCW.push({ p, noChamfer });
  };
  for (const [a1, a2, key] of baseCorners) {
    if (key === corner) {
      const a1FacePoint: [number, number] = [s1 * halfA1, s2 * (halfA2 - d)];
      const a2FacePoint: [number, number] = [s1 * (halfA1 - d), s2 * halfA2];
      // miter 兩端 = noChamfer
      if (s1 * s2 > 0) {
        pushIfDistinct(a1FacePoint, true);
        pushIfDistinct(a2FacePoint, true);
      } else {
        pushIfDistinct(a2FacePoint, true);
        pushIfDistinct(a1FacePoint, true);
      }
    } else {
      pushIfDistinct([a1, a2], false);
    }
  }
  // 收尾去重：start ↔ end
  if (polyCCW.length > 1) {
    const f = polyCCW[0], l = polyCCW[polyCCW.length - 1];
    if (Math.abs(f.p[0] - l.p[0]) < eps && Math.abs(f.p[1] - l.p[1]) < eps) {
      f.noChamfer = f.noChamfer || l.noChamfer;
      polyCCW.pop();
    }
  }

  // axis=y 時 a1×a2 = X×Z = -Y → CCW in (a1, a2) 給的法向是 -Y，需反向才能讓 +halfEdge 面 outward = +axis
  const polyOriented = axis === "y" ? polyCCW.slice().reverse() : polyCCW;
  // 若給了 chamferMm，把多邊形每個角倒成兩個點（插入 1 條 chamfer 邊），
  // 但跳過 noChamfer 點（miter 兩端要保留原始尖角，否則接合處被削出小縫）。
  const poly: Array<[number, number]> =
    chamferMm > 0
      ? chamferPolygonWithFlags(polyOriented, chamferMm)
      : polyOriented.map((v) => v.p);
  const N = poly.length;

  // Place (a1Val, a2Val) at edge level into 3D vertex.
  const place = (a1Val: number, a2Val: number, edgeVal: number): [number, number, number] => {
    const v: [number, number, number] = [0, 0, 0];
    v[axisIdx] = edgeVal;
    v[a1Idx] = a1Val;
    v[a2Idx] = a2Val;
    return v;
  };

  const v: number[] = [];
  // bottom ring at edge = -halfEdge
  for (const [a1, a2] of poly) v.push(...place(a1, a2, -halfEdge));
  // top ring at edge = +halfEdge
  for (const [a1, a2] of poly) v.push(...place(a1, a2, +halfEdge));

  const idx: number[] = [];
  // +axis 面（top, indices N..2N-1）：CCW from +axis = poly 順序（已校正）→ fan from N
  for (let i = 1; i < N - 1; i++) idx.push(N, N + i, N + i + 1);
  // -axis 面（bottom, indices 0..N-1）：CCW from -axis = poly 反向 → fan from 0 反向
  for (let i = 1; i < N - 1; i++) idx.push(0, i + 1, i);
  // 側面：每條 poly 邊 (i, next) 對應一個 quad (i, next, next+N, i+N)
  // outward CCW from outside: (i, i+N, next+N, next) → 拆 (i, i+N, next+N) + (i, next+N, next)
  for (let i = 0; i < N; i++) {
    const next = (i + 1) % N;
    idx.push(i, next, next + N);
    idx.push(i, next + N, i + N);
  }

  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(v, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function buildNotchedCornersGeometry(
  size: [number, number, number],
  notchL: number,
  notchW: number,
): BufferGeometry {
  const [lx, ly, lz] = size;
  const hx = lx / 2;
  const hy = ly / 2;
  const hz = lz / 2;
  const nL = Math.max(0, Math.min(notchL, hx * 0.95));
  const nW = Math.max(0, Math.min(notchW, hz * 0.95));
  if (nL <= 0 || nW <= 0) {
    // Fallback: regular box
    const g = new BufferGeometry();
    const v = [
      -hx, -hy, -hz,  hx, -hy, -hz,  hx, hy, -hz,  -hx, hy, -hz,
      -hx, -hy,  hz,  hx, -hy,  hz,  hx, hy,  hz,  -hx, hy,  hz,
    ];
    const f = (a: number, b: number, c: number, d: number) => [a, b, c, a, c, d];
    const idx = [
      ...f(0, 1, 2, 3), ...f(7, 6, 5, 4),
      ...f(4, 5, 1, 0), ...f(2, 6, 7, 3),
      ...f(1, 5, 6, 2), ...f(0, 3, 7, 4),
    ];
    g.setAttribute("position", new Float32BufferAttribute(v, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }
  // 8 outer corners on top + 8 on bottom 環一圈順時針：
  // (hx, -hz+nW), (hx, hz-nW), (hx-nL, hz-nW), (hx-nL, hz),
  // (-hx+nL, hz), (-hx+nL, hz-nW), (-hx, hz-nW), (-hx, -hz+nW),
  // (-hx+nL, -hz+nW), (-hx+nL, -hz), (hx-nL, -hz), (hx-nL, -hz+nW)
  const ring: Array<[number, number]> = [
    [+hx, -hz + nW], [+hx, +hz - nW], [+hx - nL, +hz - nW], [+hx - nL, +hz],
    [-hx + nL, +hz], [-hx + nL, +hz - nW], [-hx, +hz - nW], [-hx, -hz + nW],
    [-hx + nL, -hz + nW], [-hx + nL, -hz], [+hx - nL, -hz], [+hx - nL, -hz + nW],
  ];
  const v: number[] = [];
  // bottom ring (y=-hy), then top ring (y=+hy)
  for (const [x, z] of ring) v.push(x, -hy, z);
  for (const [x, z] of ring) v.push(x,  hy, z);
  const N = ring.length;
  const idx: number[] = [];
  // 側面：相鄰 2 點 + 對應 top 的 2 點 → 1 個 quad = 2 三角
  // ring 是俯視 CW，所以從外面看 quad（a, b, bt, at）順序是 CW → backface culled。
  // 反成 (a, at, bt, b) 才是 CCW from outside。
  for (let i = 0; i < N; i++) {
    const a = i;
    const b = (i + 1) % N;
    const at = a + N;
    const bt = b + N;
    idx.push(a, at, bt, a, bt, b);
  }
  // ring 在上方俯視是 CW 順序，所以底面（從下方看）是 CCW，
  // 但頂面（從上方看）是 CW → 需要反轉 winding
  // 底面 fan from vertex 0：idx 順序 0, i, i+1（順 ring CW）= 從下看 CCW ✓
  for (let i = 1; i < N - 1; i++) {
    idx.push(0, i, i + 1);
  }
  // 頂面 fan from vertex N：要從上看 CCW，所以反轉 ring 順序 → N, i+1, i
  for (let i = 1; i < N - 1; i++) {
    idx.push(N, N + i + 1, N + i);
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(v, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * 板狀零件正面 4 角圓角：
 * - 不彎曲（bendMm=0）→ Shape + ExtrudeGeometry，圓角 + topArch/bottomArch 都可用
 * - 彎曲（bendMm>0）→ 自製 grid-based BufferGeometry，
 *   M×N 細密 mesh（80×24）+ 圓角用 corner clamping 投影回 rounded-rect 邊界
 *   這樣 bent surface 才平滑、不會出現 ExtrudeGeometry earcut 大三角的 facet
 */
function buildFaceRoundedGeometry(
  size: [number, number, number],
  cornerR: number,
  topArchMm: number = 0,
  bottomArchMm: number = 0,
  bendMm: number = 0,
  bendAxis: "z" | "y" = "z",
): BufferGeometry {
  const [lx, ly, lz] = size;
  // 圓角夾在「大面」兩軸：bendAxis="z" 大面 = lx × ly（靠背）；
  // bendAxis="y" 大面 = lx × lz（椅面）。用薄軸夾會把 cornerR 壓死成板厚一半
  const faceB = bendAxis === "z" ? ly : lz;
  const r = Math.min(cornerR, lx * 0.45, faceB * 0.45);
  if (bendMm === 0) {
    return buildFaceRoundedExtrude(lx, ly, lz, r, topArchMm, bottomArchMm);
  }
  return buildBentPanelGrid(lx, ly, lz, r, topArchMm, bottomArchMm, bendMm, bendAxis);
}

function buildFaceRoundedExtrude(
  lx: number,
  ly: number,
  lz: number,
  r: number,
  topArchMm: number,
  bottomArchMm: number,
): BufferGeometry {
  const hx = lx / 2;
  const hy = ly / 2;
  const nx = 40;
  const ny = 12;
  const arcSegs = Math.max(8, Math.round(r / 4));
  const shape = new Shape();
  shape.moveTo(-hx + r, -hy);
  for (let i = 1; i <= nx; i++) {
    const t = i / nx;
    const x = -hx + r + (lx - 2 * r) * t;
    const y = bottomArchMm !== 0 ? -hy + bottomArchMm * Math.sin(Math.PI * t) : -hy;
    shape.lineTo(x, y);
  }
  shape.absarc(hx - r, -hy + r, r, -Math.PI / 2, 0, false);
  for (let i = 1; i <= ny; i++) {
    const t = i / ny;
    shape.lineTo(hx, -hy + r + (ly - 2 * r) * t);
  }
  shape.absarc(hx - r, hy - r, r, 0, Math.PI / 2, false);
  for (let i = 1; i <= nx; i++) {
    const t = i / nx;
    const x = (hx - r) - (lx - 2 * r) * t;
    const y = topArchMm !== 0 ? hy + topArchMm * Math.sin(Math.PI * t) : hy;
    shape.lineTo(x, y);
  }
  shape.absarc(-hx + r, hy - r, r, Math.PI / 2, Math.PI, false);
  for (let i = 1; i <= ny; i++) {
    const t = i / ny;
    shape.lineTo(-hx, (hy - r) - (ly - 2 * r) * t);
  }
  shape.absarc(-hx + r, -hy + r, r, Math.PI, (3 * Math.PI) / 2, false);
  const geom = new ExtrudeGeometry(shape, { depth: lz, bevelEnabled: false, curveSegments: arcSegs });
  geom.translate(0, 0, -lz / 2);
  return geom;
}

/**
 * 彎曲薄板：M+1 × N+1 grid 構成兩片大面 + 4 條側壁。
 *
 * bendAxis 決定板子的「薄軸」：
 *  - "z"（預設，靠背用）：薄軸 = local Z（lz=厚度），大面在 X-Y 平面，
 *    grid 鋪在 (lx, ly)，兩片大面位於 z=±hz，bend 推 Z
 *  - "y"（椅面用）：薄軸 = local Y（ly=厚度），大面在 X-Z 平面，
 *    grid 鋪在 (lx, lz)，兩片大面位於 y=±hy，bend 推 Y（負值=中央往下凹）
 *
 * bend 公式統一：offset = bendMm × (1 − (x/hx)²)，沿 X 軸對稱、兩端 0。
 * 圓角處理在大面上執行；arch（topArch/bottomArch）只用於 bendAxis="z"（靠背 4 邊）。
 */
function buildBentPanelGrid(
  lx: number,
  ly: number,
  lz: number,
  r: number,
  topArchMm: number,
  bottomArchMm: number,
  bendMm: number,
  bendAxis: "z" | "y" = "z",
): BufferGeometry {
  const hx = lx / 2;
  const hy = ly / 2;
  const hz = lz / 2;
  const M = 80;
  const N = 24;

  // 大面內第二軸的「半長」：z 模式用 hy，y 模式用 hz
  const hu = bendAxis === "z" ? hy : hz;

  // 給定 grid 索引 (i, j)，回傳該點在大面平面上的位置 (x, u)。
  // u 是大面的第二軸：bendAxis="z" 時 u=y，bendAxis="y" 時 u=z。
  const gridFace = (i: number, j: number): [number, number] => {
    const ti = i / M;
    const tj = j / N;
    let x = -hx + lx * ti;
    let u = -hu + 2 * hu * tj;
    // 圓角投影：在原始矩形角落區內把點投影到 R 弧上
    if (r > 0 && Math.abs(x) > hx - r && Math.abs(u) > hu - r) {
      const sx = Math.sign(x) || 1;
      const su = Math.sign(u) || 1;
      const cx = sx * (hx - r);
      const cu = su * (hu - r);
      const dx = x - cx;
      const du = u - cu;
      const d = Math.hypot(dx, du);
      if (d > r && d > 1e-6) {
        x = cx + (dx / d) * r;
        u = cu + (du / d) * r;
      }
    }
    // arch 只在 z 軸（靠背）模式套到頂/底緣（u 軸=ly=面高度方向）
    if (bendAxis === "z") {
      if (j === N && topArchMm !== 0) {
        u += topArchMm * Math.sin(Math.PI * ti);
      } else if (j === 0 && bottomArchMm !== 0) {
        u += bottomArchMm * Math.sin(Math.PI * ti);
      }
    }
    return [x, u];
  };

  const bendOffset = (x: number): number => {
    const t = x / hx;
    return bendMm * Math.max(0, 1 - t * t);
  };

  const positions: number[] = [];
  const indices: number[] = [];

  // 兩片大面：bendAxis="z" 在 z=±hz；bendAxis="y" 在 y=±hy
  // 命名為 frontStart / backStart 維持原語義（front=+offset 那片，back=-offset 那片）
  const frontStart = 0;
  for (let j = 0; j <= N; j++) {
    for (let i = 0; i <= M; i++) {
      const [x, u] = gridFace(i, j);
      const off = bendOffset(x);
      if (bendAxis === "z") {
        positions.push(x, u, hz + off);
      } else {
        positions.push(x, hy + off, u);
      }
    }
  }
  const backStart = (M + 1) * (N + 1);
  for (let j = 0; j <= N; j++) {
    for (let i = 0; i <= M; i++) {
      const [x, u] = gridFace(i, j);
      const off = bendOffset(x);
      if (bendAxis === "z") {
        positions.push(x, u, -hz + off);
      } else {
        positions.push(x, -hy + off, u);
      }
    }
  }

  const fIdx = (i: number, j: number) => frontStart + j * (M + 1) + i;
  const bIdx = (i: number, j: number) => backStart + j * (M + 1) + i;

  // Front face: outward normal +Z (兩三角形 winding 為 CCW 從 +Z 看)
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < M; i++) {
      const a = fIdx(i, j);
      const b = fIdx(i + 1, j);
      const c = fIdx(i, j + 1);
      const d = fIdx(i + 1, j + 1);
      indices.push(a, b, d);
      indices.push(a, d, c);
    }
  }
  // Back face: outward normal -Z (反向 winding)
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < M; i++) {
      const a = bIdx(i, j);
      const b = bIdx(i + 1, j);
      const c = bIdx(i, j + 1);
      const d = bIdx(i + 1, j + 1);
      indices.push(a, d, b);
      indices.push(a, c, d);
    }
  }
  // 側壁：4 條邊把 front 連到 back（winding 對應 outward normal，否則背面剔除後只看到一片正面）
  // 上邊 j=N (outward +Y)
  for (let i = 0; i < M; i++) {
    const fa = fIdx(i, N);
    const fb = fIdx(i + 1, N);
    const ba = bIdx(i, N);
    const bb = bIdx(i + 1, N);
    indices.push(fa, fb, ba);
    indices.push(fb, bb, ba);
  }
  // 下邊 j=0 (outward -Y)
  for (let i = 0; i < M; i++) {
    const fa = fIdx(i, 0);
    const fb = fIdx(i + 1, 0);
    const ba = bIdx(i, 0);
    const bb = bIdx(i + 1, 0);
    indices.push(fa, ba, fb);
    indices.push(fb, ba, bb);
  }
  // 右邊 i=M (outward +X)
  for (let j = 0; j < N; j++) {
    const fa = fIdx(M, j);
    const fb = fIdx(M, j + 1);
    const ba = bIdx(M, j);
    const bb = bIdx(M, j + 1);
    indices.push(fa, ba, fb);
    indices.push(fb, ba, bb);
  }
  // 左邊 i=0 (outward -X)
  for (let j = 0; j < N; j++) {
    const fa = fIdx(0, j);
    const fb = fIdx(0, j + 1);
    const ba = bIdx(0, j);
    const bb = bIdx(0, j + 1);
    indices.push(fa, fb, ba);
    indices.push(fb, bb, ba);
  }

  // 大面換軸後三角形 winding 都會反向（cross product sign flip），統一翻所有 indices
  if (bendAxis === "y") {
    for (let i = 0; i < indices.length; i += 3) {
      const tmp = indices[i + 1];
      indices[i + 1] = indices[i + 2];
      indices[i + 2] = tmp;
    }
  }

  const geom = new BufferGeometry();
  geom.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return geom;
}

/**
 * 弧形彎料：沿 length 軸切 N 段，每段 z 軸偏移 = bend × (1 - (2x/L)²)
 * 用於椅背頂橫木向後彎的弧形。box 截面 (ly × lz) 不變、只是 z 中心彎。
 * 上下/左右 face 用 N+1 環 vertex 連接側面，端面 2 個 quad。
 */
function buildArchBentGeometry(
  size: [number, number, number],
  bendMm: number,
  segments: number = 16,
): BufferGeometry {
  const [lx, ly, lz] = size;
  const hx = lx / 2;
  const hy = ly / 2;
  const hz = lz / 2;
  const N = Math.max(2, segments);
  // 計算每個 X 切片的 z 中心偏移
  const zOffsetAt = (x: number): number => {
    const t = (2 * x) / lx; // [-1, 1]
    return bendMm * Math.max(0, 1 - t * t);
  };
  const v: number[] = [];
  // 每個 slice 4 個 vertex（截面 4 角）：bottom-front, top-front, top-back, bottom-back
  for (let i = 0; i <= N; i++) {
    const x = -hx + (lx * i) / N;
    const dz = zOffsetAt(x);
    v.push(x, -hy, -hz + dz);  // 0: front-bot
    v.push(x,  hy, -hz + dz);  // 1: front-top
    v.push(x,  hy,  hz + dz);  // 2: back-top
    v.push(x, -hy,  hz + dz);  // 3: back-bot
  }
  const idx: number[] = [];
  // 4 個 side face 沿 length 連接每個 slice
  // 注意：所有三角形 winding 為 CCW 從外側看（法線朝外）
  for (let i = 0; i < N; i++) {
    const a = i * 4;
    const b = (i + 1) * 4;
    // bottom face (法線 -Y)：從 -Y 看 CCW
    idx.push(a + 0, b + 0, b + 3, a + 0, b + 3, a + 3);
    // top face (法線 +Y)：從 +Y 看 CCW
    idx.push(a + 1, a + 2, b + 2, a + 1, b + 2, b + 1);
    // front face (法線 -Z)：從 -Z 看 CCW
    idx.push(a + 0, a + 1, b + 1, a + 0, b + 1, b + 0);
    // back face (法線 +Z)：從 +Z 看 CCW
    idx.push(a + 3, b + 3, b + 2, a + 3, b + 2, a + 2);
  }
  // 兩端 cap：第 0 slice 跟第 N slice 各 1 個 quad
  // 起始端（X=-hx，法線 -X）：從 -X 看 CCW = 0 → 3 → 2 → 1
  idx.push(0, 3, 2, 0, 2, 1);
  // 終止端（X=+hx，法線 +X）：從 +X 看 CCW = e → e+1 → e+2 → e+3
  const e = N * 4;
  idx.push(e, e + 1, e + 2, e, e + 2, e + 3);
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(v, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function buildLiveEdgeGeometry(
  size: [number, number, number],
  amplitudeMm: number,
): BufferGeometry {
  const [lx, ly, lz] = size;
  const hx = lx / 2;
  const hy = ly / 2;
  const hz = lz / 2;
  const N = 32; // 段數
  const amp = amplitudeMm;

  // 沿 length 軸（X）取樣，每個 x_i 各算 +Z 邊和 -Z 邊的 z 偏移（向外側突出 amp 範圍內）
  const noise = (x: number, phase: number) =>
    amp * 0.6 * Math.sin((x + phase) / (lx * 0.06)) +
    amp * 0.3 * Math.sin((x + phase * 1.7) / (lx * 0.035)) +
    amp * 0.1 * Math.sin((x + phase * 2.3) / (lx * 0.02));

  // 取樣點 (i = 0..N)，端點 (i=0, i=N) 強制 noise=0 讓兩端平整
  const xs: number[] = [];
  const zPos: number[] = []; // +Z 邊
  const zNeg: number[] = []; // -Z 邊
  for (let i = 0; i <= N; i++) {
    const x = -hx + (lx * i) / N;
    xs.push(x);
    const t = i / N;
    // 兩端漸退讓 noise 收斂為 0（避免端面變形）
    const taper = Math.sin(Math.PI * t);
    zPos.push(hz + noise(x, 0) * taper);
    zNeg.push(-hz - noise(x, Math.PI / 3) * taper);
  }

  // Vertex layout：每個取樣點上 4 個 vertex（top-front, top-back, bot-front, bot-back）
  // index = i * 4 + (0=botBack, 1=botFront, 2=topFront, 3=topBack)
  // botBack = (xs[i], -hy, zPos[i])
  // botFront = (xs[i], -hy, zNeg[i])
  // topFront = (xs[i], +hy, zNeg[i])
  // topBack  = (xs[i], +hy, zPos[i])
  const v: number[] = [];
  for (let i = 0; i <= N; i++) {
    v.push(xs[i], -hy, zPos[i]);
    v.push(xs[i], -hy, zNeg[i]);
    v.push(xs[i], hy, zNeg[i]);
    v.push(xs[i], hy, zPos[i]);
  }

  const f = (a: number, b: number, c: number, d: number) => [a, b, c, a, c, d];
  const vi = (i: number, k: number) => i * 4 + k;
  const idx: number[] = [];

  // Side faces between i and i+1
  for (let i = 0; i < N; i++) {
    // bottom face (looking from -Y): vertices at -hy, CCW from -Y
    idx.push(...f(vi(i, 0), vi(i, 1), vi(i + 1, 1), vi(i + 1, 0)));
    // top face (from +Y): CCW from +Y
    idx.push(...f(vi(i, 3), vi(i + 1, 3), vi(i + 1, 2), vi(i, 2)));
    // +Z 長邊（後緣，向 +Z 突出）。normal +Z when viewed from +Z
    idx.push(...f(vi(i, 0), vi(i + 1, 0), vi(i + 1, 3), vi(i, 3)));
    // -Z 長邊（前緣，向 -Z 突出）。normal -Z
    idx.push(...f(vi(i, 1), vi(i, 2), vi(i + 1, 2), vi(i + 1, 1)));
  }
  // 端面 -X (i=0)
  idx.push(...f(vi(0, 0), vi(0, 3), vi(0, 2), vi(0, 1)));
  // 端面 +X (i=N)
  idx.push(...f(vi(N, 0), vi(N, 1), vi(N, 2), vi(N, 3)));

  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(v, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * 明式馬蹄腳。
 *
 * 結構：上方直料 → 馬蹄區段 4 環，外側 2 面做 S 形（上半外凸 → 中段內凹收腰
 * → 下半外撇腳趾），內側 2 面保持直線。dirX/dirZ 決定哪 2 面是「外側」。
 *
 * 為什麼這麼做：原本實作所有 4 面對稱外擴 → 像漏斗，跟明式馬蹄腳完全不像。
 * 真正的馬蹄腳只有「朝家具外」的兩個面才會踢出來，其他 2 面（朝中心）保持
 * 直線——這樣才能把腳趾的方向感做出來。
 *
 * 參數：
 *  hoofHeight = 馬蹄區段總高（從底部往上算）
 *  hoofScale  = 腳趾外側 flare 倍率（>1 = 外撇）
 *  dirX/dirZ  = 外側方向（±1 = 該軸的這個方向是外側、要 flare；0 = 該軸不 flare）
 *
 * 環高度比例：top 50% 直線 / 鼓肚 25% / 收腰 15% / 腳趾 10%
 */
function buildHoofGeometry(
  size: [number, number, number],
  hoofHeight: number,
  hoofScale: number,
  dirX: -1 | 0 | 1,
  dirZ: -1 | 0 | 1,
): BufferGeometry {
  const [lx, ly, lz] = size;
  const hx = lx / 2;
  const hy = ly / 2;
  const hz = lz / 2;
  const hoofH = Math.min(hoofHeight, ly * 0.5);

  // 4 個馬蹄區段環的 Y（從上到下）+ 該環各 4 個 corner 的 X/Z 縮放比
  // 比例是「外側面相對直料寬」的縮放：
  //   start: 1.00（剛離開直料，全寬）
  //   bulge: 1.10（外側面鼓出去——S 上半圓弧）
  //   waist: 0.85（外側面內凹收腰，比直料窄 15%）
  //   toe:   hoofScale（腳趾外撇到最大寬）
  // 內側面所有環都保持 1.0（直料），這樣外側才看得出 S 形腳趾踢出去。
  const rings = [
    { yFrac: 0.00, outerScale: 1.00 },  // 馬蹄頂（與直料銜接）
    { yFrac: 0.45, outerScale: 1.10 },  // 鼓肚
    { yFrac: 0.78, outerScale: 0.85 },  // 收腰（要明顯一點才看得出 S 形）
    { yFrac: 1.00, outerScale: hoofScale }, // 腳趾（最寬）
  ];
  const yTopHoof = -hy + hoofH; // 馬蹄區段的頂端

  // 收 vertex 的 helper：給 ring index + corner sign (sx, sz)，回傳 [x, y, z]
  const cornerVert = (
    ringIdx: number,
    sx: -1 | 1,
    sz: -1 | 1,
  ): [number, number, number] => {
    const ring = rings[ringIdx];
    const y = yTopHoof - hoofH * ring.yFrac;
    // 外側軸（sx === dirX 或 sz === dirZ）才套 outerScale；內側保持 1
    // dirX/dirZ 可能是 0（中柱腳，該軸不外撇），這時跟 sx/sz 都不相等 → 走 1.0
    const xScale = (dirX as number) !== 0 && sx === dirX ? ring.outerScale : 1;
    const zScale = (dirZ as number) !== 0 && sz === dirZ ? ring.outerScale : 1;
    return [sx * hx * xScale, y, sz * hz * zScale];
  };

  const v: number[] = [];
  // 環 0..3：馬蹄區段 4 環，每環 4 個 corner，順序 (-,-) (+,-) (+,+) (-,+)
  // 對應 vertex index：環 r 的 corner i 在 v 的 4*r + i
  for (let r = 0; r < 4; r++) {
    v.push(...cornerVert(r, -1, -1));
    v.push(...cornerVert(r, 1, -1));
    v.push(...cornerVert(r, 1, 1));
    v.push(...cornerVert(r, -1, 1));
  }
  // 環 4：直料頂端（= 馬蹄區段頂端 + 上方直料）。原本 yTopHoof = -hy + hoofH，
  // 直料頂在 +hy。所以 ring 0 (= yTopHoof) 跟 ring 4 (= +hy) 之間是直料。
  v.push(-hx, hy, -hz);
  v.push(hx, hy, -hz);
  v.push(hx, hy, hz);
  v.push(-hx, hy, hz);

  // f(a, b, c, d) → 兩個三角形組成 quad，winding 由 caller 控制
  const f = (a: number, b: number, c: number, d: number) => [a, b, c, a, c, d];
  // 環 r 的 corner 索引：4*r + i (i = 0..3)
  // ring 0 = 馬蹄頂；ring 3 = 腳趾底；ring 4 = 直料頂（最高）。
  const ri = (r: number, i: number) => 4 * r + i;
  const idx: number[] = [];
  // 底面（ring 3 = 腳趾底，normal -Y）
  idx.push(...f(ri(3, 0), ri(3, 1), ri(3, 2), ri(3, 3)));
  // 頂面（ring 4 = 直料頂，normal +Y）
  idx.push(...f(ri(4, 0), ri(4, 3), ri(4, 2), ri(4, 1)));
  // 4 個側面 × 4 個環間區段（ring r 在上、ring r+1 在下；
  // r=3 的時候 r+1=4，這是直料區段—直料頂端 ring 4 在最上方，
  // 但 corner 順序仍對齊 ring 0..3 的 (-,-) (+,-) (+,+) (-,+)）
  // 為避免直料區段方向反，r 從 0 到 2 處理馬蹄區，r=3 額外處理直料區。
  // CCW from outside: bot → top → top_next → bot_next
  for (let r = 0; r < 3; r++) {
    // 馬蹄區段（r 在上、r+1 在下）
    idx.push(...f(ri(r + 1, 0), ri(r, 0), ri(r, 1), ri(r + 1, 1))); // -Z 面
    idx.push(...f(ri(r + 1, 1), ri(r, 1), ri(r, 2), ri(r + 1, 2))); // +X 面
    idx.push(...f(ri(r + 1, 2), ri(r, 2), ri(r, 3), ri(r + 1, 3))); // +Z 面
    idx.push(...f(ri(r + 1, 3), ri(r, 3), ri(r, 0), ri(r + 1, 0))); // -X 面
  }
  // 直料區段：ring 4 在上 (+hy)、ring 0 在下 (yTopHoof = -hy + hoofH)
  idx.push(...f(ri(0, 0), ri(4, 0), ri(4, 1), ri(0, 1)));
  idx.push(...f(ri(0, 1), ri(4, 1), ri(4, 2), ri(0, 2)));
  idx.push(...f(ri(0, 2), ri(4, 2), ri(4, 3), ri(0, 3)));
  idx.push(...f(ri(0, 3), ri(4, 3), ri(4, 0), ri(0, 0)));

  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(v, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * 座面挖型曲面：把座板頂面換成 displaced grid。
 *  saddle  = 中央 paraboloid 凹陷（雙軸）
 *  scooped = 沿 X 軸兩個並列 basin（左右各一個沿 Z 方向延伸的凹槽）
 *
 * 為了讓側面與底面保持平直、不被 grid 平均的 normal 帶歪，側 / 底面用獨立 quad
 * 建立（自帶頂點，不跟 grid 共用），grid 用 32×32 細分套 computeVertexNormals
 * 平滑出曲面。
 */
function buildSeatScoopGeometry(
  size: [number, number, number],
  profile: "saddle" | "scooped" | "dished",
  depth: number,
): BufferGeometry {
  const [lx, ly, lz] = size;
  const hx = lx / 2;
  const hy = ly / 2;
  const hz = lz / 2;
  const nx = 32;
  const nz = 32;

  // depth 是 scene units（已乘 SCALE）。clip 到不超過厚度 70%
  const maxDip = Math.min(depth, ly * 0.7);

  function dipAt(x: number, z: number): number {
    const rx = (2 * x) / lx; // [-1, 1]
    const rz = (2 * z) / lz;
    if (profile === "saddle") {
      const fx = Math.max(0, 1 - rx * rx);
      const fz = Math.max(0, 1 - rz * rz);
      return -maxDip * fx * fz;
    }
    if (profile === "dished") {
      // 沿 Z 軸（座深方向）單軸下凹—— 給長坐用，Z 中央最深、X 全長均勻
      // X 方向兩端稍微淺一點，避免邊緣銳利
      const fz = Math.max(0, 1 - rz * rz);
      const fx = Math.max(0, 1 - rx * rx * 0.3);
      return -maxDip * fz * fx;
    }
    // scooped: 兩個 basin 中心在 x = ±lx/4，每個寬 lx/2，沿 z 全長延伸（兩端漸收）
    const bw = lx / 4; // basin half-width
    const r1 = (x - lx / 4) / bw;
    const r2 = (x + lx / 4) / bw;
    const f1 = Math.max(0, 1 - r1 * r1);
    const f2 = Math.max(0, 1 - r2 * r2);
    const fz = Math.max(0, 1 - rz * rz * 0.6); // z 方向稍微收（兩端稍淺）
    return -maxDip * Math.max(f1, f2) * fz;
  }

  const v: number[] = [];
  const idx: number[] = [];

  // 1) 頂面 grid（(nx+1) × (nz+1) 個頂點，displaced）
  const topStart = 0;
  for (let i = 0; i <= nx; i++) {
    const x = -hx + (i / nx) * lx;
    for (let j = 0; j <= nz; j++) {
      const z = -hz + (j / nz) * lz;
      v.push(x, hy + dipAt(x, z), z);
    }
  }
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      const a = topStart + i * (nz + 1) + j;
      const b = topStart + (i + 1) * (nz + 1) + j;
      const c = topStart + (i + 1) * (nz + 1) + j + 1;
      const d = topStart + i * (nz + 1) + j + 1;
      idx.push(a, b, c, a, c, d);
    }
  }

  // 2) 側面 + 底面：4 個邊牆 + 1 個底面，獨立頂點以保平面 shading
  // 邊牆頂端的 Y 對齊 grid 邊緣，但用獨立 vertex 不分享。
  const sideStart = v.length / 3;

  // -Z 面（front, j=0），i=0..nx
  for (let i = 0; i <= nx; i++) {
    const x = -hx + (i / nx) * lx;
    v.push(x, hy + dipAt(x, -hz), -hz); // 頂
    v.push(x, -hy, -hz);                 // 底
  }
  const negZBase = sideStart;
  for (let i = 0; i < nx; i++) {
    const a = negZBase + i * 2;
    const b = negZBase + (i + 1) * 2;
    const ab = a + 1;
    const bb = b + 1;
    idx.push(a, ab, bb, a, bb, b);
  }

  const posZBase = v.length / 3;
  for (let i = 0; i <= nx; i++) {
    const x = -hx + (i / nx) * lx;
    v.push(x, hy + dipAt(x, hz), hz);
    v.push(x, -hy, hz);
  }
  for (let i = 0; i < nx; i++) {
    const a = posZBase + i * 2;
    const b = posZBase + (i + 1) * 2;
    const ab = a + 1;
    const bb = b + 1;
    idx.push(a, bb, ab, a, b, bb);
  }

  const negXBase = v.length / 3;
  for (let j = 0; j <= nz; j++) {
    const z = -hz + (j / nz) * lz;
    v.push(-hx, hy + dipAt(-hx, z), z);
    v.push(-hx, -hy, z);
  }
  for (let j = 0; j < nz; j++) {
    const a = negXBase + j * 2;
    const b = negXBase + (j + 1) * 2;
    const ab = a + 1;
    const bb = b + 1;
    idx.push(a, bb, ab, a, b, bb);
  }

  const posXBase = v.length / 3;
  for (let j = 0; j <= nz; j++) {
    const z = -hz + (j / nz) * lz;
    v.push(hx, hy + dipAt(hx, z), z);
    v.push(hx, -hy, z);
  }
  for (let j = 0; j < nz; j++) {
    const a = posXBase + j * 2;
    const b = posXBase + (j + 1) * 2;
    const ab = a + 1;
    const bb = b + 1;
    idx.push(a, ab, bb, a, bb, b);
  }

  // 底面 4 角（normal -Y）
  const botBase = v.length / 3;
  v.push(-hx, -hy, -hz);
  v.push(hx, -hy, -hz);
  v.push(hx, -hy, hz);
  v.push(-hx, -hy, hz);
  idx.push(botBase, botBase + 2, botBase + 1);
  idx.push(botBase, botBase + 3, botBase + 2);

  // 上面 winding 是內外相反（top 變 backface culled、座面整個消失）。
  // 一次性翻轉所有 triangle 的 winding，再算 normal。
  for (let k = 0; k < idx.length; k += 3) {
    const tmp = idx[k + 1];
    idx[k + 1] = idx[k + 2];
    idx[k + 2] = tmp;
  }

  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(v, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export function PerspectiveView({
  design,
  sceneTheme,
  joineryMode = false,
  auditMode = false,
  explodeMm = 0,
  xrayMode = "off",
  selectedPartId = null,
  onPartSelect,
  compactMode = false,
  wireframeMode = false,
}: {
  design: FurnitureDesign;
  /** 場景環境主題（natural=現況，其他加地板+調光）*/
  sceneTheme?: import("@/lib/design/scene-themes").SceneTheme;
  /** 榫接模式：3D 多畫一層紅色 tenon 凸出 */
  joineryMode?: boolean;
  /** Dev audit mode：?audit=true URL 啟用，overlap 的 parts 用紅色 wireframe 高亮 */
  auditMode?: boolean;
  /** 爆炸視圖：joineryMode 下 tenon 沿 position 方向往外偏 explodeMm（mm），
   *  視覺像榫頭從榫眼抽出來。0 = 無偏移（預設），> 0 拆得越開 */
  explodeMm?: number;
  /** X-ray 透視：
   *  - "off"：顯示全部
   *  - "face"：只藏面板（drawer-face + 全門）→ 看得到抽屜箱體 + 內部層板
   *  - "full"：藏整個抽屜 + 全門 → 看得到櫃內全空（層板/隔板/後板）*/
  xrayMode?: "off" | "face" | "full";
  /** 選中的零件 id（從外部 context 進來），對應 part.id 會多一層黃色 wireframe 高亮 */
  selectedPartId?: string | null;
  /** 點擊零件時呼叫，傳回 part.id 給外部 context（雙向高亮：3D ↔ 零件清單） */
  onPartSelect?: (id: string | null) => void;
  /** 緊湊模式：外層 wrapper 用 w-full h-full 跟著父容器（PIP 用），不用預設 40vh / 520px */
  compactMode?: boolean;
  /** 線框模式：所有零件渲染成骨架，看內部結構 */
  wireframeMode?: boolean;
}) {
  const [viewPreset, setViewPreset] = useState<ViewPreset | null>(null);
  // 將 mm 縮放成 Three.js 單位（1 unit = 100mm）
  const SCALE = 0.01;
  const maxDim = Math.max(
    design.overall.length,
    design.overall.width,
    design.overall.thickness,
  ) * SCALE;
  const themeFloor = sceneTheme?.floorColor ?? null;
  const ambientMul = sceneTheme?.ambientMul ?? 1.0;
  const tint = sceneTheme?.lightTint ?? { r: 1, g: 1, b: 1 };
  // 把 (r,g,b) 0-1 轉成 rgb() string（Three.js Color.set 不接 array）
  const lightHex = `rgb(${Math.round(tint.r * 255)}, ${Math.round(tint.g * 255)}, ${Math.round(tint.b * 255)})`;

  // joineryMode：把所有 mortise 攤成 world 座標索引，給 tenon mesh 配對用。
  // 配對後 tenon mesh 長度 clamp 到 mortise.depth，確保 mesh 永遠住在母件
  // 預挖的洞裡，不會因為母件 shape（圓腳/倒角）讓 CSG 失效而從外面戳出來。
  const worldMortiseIndex = useMemo<WorldMortise[]>(() => {
    if (!joineryMode) return [];
    const idx: WorldMortise[] = [];
    for (const part of design.parts) {
      if (!part.mortises || part.mortises.length === 0) continue;
      const rx = part.rotation?.x ?? 0;
      const ry = part.rotation?.y ?? 0;
      const rz = part.rotation?.z ?? 0;
      const lx = part.visible.length;
      const ly = part.visible.thickness;
      const lz = part.visible.width;
      const yExt = worldExtents(part).yExt;
      const pcx = part.origin.x;
      const pcy = part.origin.y + yExt / 2;
      const pcz = part.origin.z;
      for (const m of part.mortises) {
        // 跟 mortiseLocalBox 同樣的 depth-axis 推導（哪個面最近 = 入口面）。
        // 重要：origin.y=0 或 origin.y=ly 是 from-bottom 慣例的「便利預設值」
        // （側板/牙條 mortise template 常寫 y:0 表示「不指定 Y 入榫」），不該被
        // 當作真的 Y face 入榫。當 origin.y 在 canonical 值 + X 或 Z 軸有
        // origin 靠近 face (≤ ly/2) 時，優先選 X/Z 為真正 entry axis—跟
        // svg-views.tsx 的 mortiseLocalBox 邏輯保持一致，否則 tenon outAxis
        // 配對全錯，drawer-bottom tenon 抓不到 side-panel mortise → 紅塊。
        const yToFace = Math.min(Math.abs(m.origin.y), Math.abs(m.origin.y - ly));
        const xToFace = Math.min(Math.abs(m.origin.x - lx / 2), Math.abs(m.origin.x + lx / 2));
        const zToFace = Math.min(Math.abs(m.origin.z - lz / 2), Math.abs(m.origin.z + lz / 2));
        const yIsCanonical = m.origin.y === 0 || m.origin.y === ly;
        let lex = 0, ley = 0, lez = 0;
        let localAxis: "x" | "y" | "z";
        let localSign: 1 | -1;
        if (yIsCanonical && (xToFace < ly / 2 || zToFace < ly / 2)) {
          // canonical Y 不是真深度軸 → 改選 X 或 Z（最靠近 face 的那個）
          if (xToFace <= zToFace) {
            localAxis = "x";
            localSign = m.origin.x >= 0 ? 1 : -1;
            lex = localSign === 1 ? lx / 2 : -lx / 2;
            ley = m.origin.y - ly / 2;
            lez = m.origin.z;
          } else {
            localAxis = "z";
            localSign = m.origin.z >= 0 ? 1 : -1;
            lex = m.origin.x;
            ley = m.origin.y - ly / 2;
            lez = localSign === 1 ? lz / 2 : -lz / 2;
          }
        } else if (yToFace <= xToFace && yToFace <= zToFace) {
          localAxis = "y";
          localSign = m.origin.y >= ly - 1 ? 1 : -1;
          lex = m.origin.x;
          ley = localSign === 1 ? ly / 2 : -ly / 2;
          lez = m.origin.z;
        } else if (xToFace <= zToFace) {
          localAxis = "x";
          localSign = m.origin.x >= 0 ? 1 : -1;
          lex = localSign === 1 ? lx / 2 : -lx / 2;
          ley = m.origin.y - ly / 2;
          lez = m.origin.z;
        } else {
          localAxis = "z";
          localSign = m.origin.z >= 0 ? 1 : -1;
          lex = m.origin.x;
          ley = m.origin.y - ly / 2;
          lez = localSign === 1 ? lz / 2 : -lz / 2;
        }
        const e = rotateXYZ(rx, ry, rz, lex, ley, lez);
        const ax = localAxis === "x" ? localSign : 0;
        const ay = localAxis === "y" ? localSign : 0;
        const az = localAxis === "z" ? localSign : 0;
        const a = rotateXYZ(rx, ry, rz, ax, ay, az);
        const aX = Math.abs(a.x), aY = Math.abs(a.y), aZ = Math.abs(a.z);
        let worldAxis: "x" | "y" | "z";
        let worldSign: 1 | -1;
        if (aX >= aY && aX >= aZ) { worldAxis = "x"; worldSign = a.x >= 0 ? 1 : -1; }
        else if (aY >= aZ) { worldAxis = "y"; worldSign = a.y >= 0 ? 1 : -1; }
        else { worldAxis = "z"; worldSign = a.z >= 0 ? 1 : -1; }
        idx.push({
          partId: part.id,
          entryX: pcx + e.x,
          entryY: pcy + e.y,
          entryZ: pcz + e.z,
          axis: worldAxis,
          sign: worldSign,
          depth: m.depth,
          through: m.through ?? false,
        });
      }
    }
    return idx;
  }, [design.parts, joineryMode]);

  // Audit mode：抓 overlap 對，把出現在裡面的 part id 拉成 set。標紅色高亮。
  const overlapIds = useMemo(() => {
    if (!auditMode) return new Set<string>();
    const ids = new Set<string>();
    try {
      const overlaps = findOverlaps(design.parts);
      for (const o of overlaps) {
        ids.add(o.a);
        ids.add(o.b);
      }
      if (overlaps.length > 0) {
        // eslint-disable-next-line no-console
        console.warn(
          `[audit=true] ${overlaps.length} overlap pair(s):`,
          overlaps,
        );
      } else {
        // eslint-disable-next-line no-console
        console.info(`[audit=true] 0 overlaps`);
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("[audit=true] findOverlaps failed", e);
    }
    return ids;
  }, [auditMode, design]);

  return (
    <div className={
      compactMode
        ? "w-full h-full overflow-hidden bg-gradient-to-b from-zinc-50 to-zinc-200 flex flex-col"
        : "w-full h-[40vh] min-h-[260px] lg:h-[520px] rounded-xl overflow-hidden border border-zinc-200 shadow-sm bg-gradient-to-b from-zinc-50 to-zinc-200 flex flex-col"
    }>
      <ViewPresetBar onSelect={setViewPreset} />
      <div data-thumb="3d" className="flex-1 min-h-0 relative">
      <Canvas
        shadows
        // 點到家具零件之外的空白處（場景空地、grid）→ 清掉 selectedPartId
        // 不接 onClick 因為 OrbitControls 拖動結束會 fire click。
        // onPointerMissed 是 R3F 提供：pointer up 沒打到任何 mesh 才 fire。
        onPointerMissed={onPartSelect ? () => onPartSelect(null) : undefined}
        // frameloop="always" 確保 selectedPartId / dim opacity 變化即時反映
        // （之前 demand 模式有 race condition：material prop 變更但 invalidate
        //  時 GPU 還沒收到 → 透明效果失效）。代價：scroll 時 3D 持續渲染
        //  約 30-60fps，比 demand 多吃一些 GPU 但保證視覺正確
        frameloop="always"
        // dpr 上限 1.5 防止 Retina 螢幕 4× 像素做 shadow map。
        dpr={[1, 1.5]}
        // ACES Filmic tone mapping — 電影業界標準，給 PBR 材質正確的高光衰減
        // outputColorSpace SRGB — 讓 albedo 紋理顏色不偏暗
        gl={{
          toneMapping: ACESFilmicToneMapping,
          toneMappingExposure: 1.0,
          outputColorSpace: SRGBColorSpace,
          antialias: true,
        }}
        camera={{
          // Distance driven by the piece's LARGEST dimension so tall furniture
          // (wardrobe, open-bookshelf) doesn't get clipped top/bottom even
          // when its length/width is small.
          // distance ≈ sqrt(1.8² + 1.4² + 2.0²) ≈ 3.03 × maxDim
          // → fov 38° 視野垂直容得下 ~2.08 × maxDim 物高，留 4% 邊距
          //
          // compactMode（手機 220px 高 canvas）：距離 ×1.1，比桌面略遠避免邊緣
          // 切到，但保持家具夠大；target Y=thickness/3（在 OrbitControls 設）
          // 讓家具中心點往畫面上方推一點
          position: compactMode
            ? [maxDim * 2.0, maxDim * 1.55, -maxDim * 2.2]
            : [maxDim * 1.8, maxDim * 1.4, -maxDim * 2.0],
          fov: 38,
        }}
      >
        {/* SoftShadows 暫時移除——drei 注入的 shader 用了 unpackRGBAToDepth
            在當前 Three.js 版本不存在，整個 fragment shader 編譯失敗 → 3D blank
            compactMode 沒 Environment HDR 補光 → ambient + key + fill 全 ×1.7 */}
        <ambientLight intensity={(compactMode ? 0.8 : 0.45) * ambientMul} color={lightHex} />
        <directionalLight
          position={[maxDim * 1.5, maxDim * 2, maxDim * 1.2]}
          intensity={(compactMode ? 1.5 : 1.0) * ambientMul}
          color={lightHex}
          castShadow={!compactMode}
          shadow-mapSize={[1024, 1024]}
          shadow-camera-left={-maxDim * 2}
          shadow-camera-right={maxDim * 2}
          shadow-camera-top={maxDim * 2}
          shadow-camera-bottom={-maxDim * 2}
          shadow-bias={-0.0005}
        />
        <directionalLight
          position={[-maxDim, maxDim, -maxDim]}
          intensity={(compactMode ? 0.6 : 0.3) * ambientMul}
          color={lightHex}
        />
        {/* compactMode：補一道從下方往上打的微光，模擬地板反彈光、避免桌底全黑 */}
        {compactMode && (
          <directionalLight
            position={[0, -maxDim, maxDim]}
            intensity={0.35 * ambientMul}
            color={lightHex}
          />
        )}

        {/* compactMode（手機）：拿掉 Environment HDR（drei CDN 拉 300-500KB
            HDR + 處理）+ ContactShadows，省 1-2 秒首次載入。
            視覺差別：手機 canvas 220px 看不太出 reflection 細節，ambientLight
            +directionalLight 已給足基本明暗。 */}
        {!compactMode && (
          <>
            <Environment preset="apartment" />
            <ContactShadows
              position={[0, 0.001, 0]}
              opacity={0.35}
              blur={2}
              far={maxDim * 2}
              scale={maxDim * 3}
            />
          </>
        )}

        {/* 場景主題地板：theme=natural 時不渲染，回到原本懸浮在 grid 上的視覺 */}
        {themeFloor && (
          <mesh
            position={[0, -0.001, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
            receiveShadow
          >
            <planeGeometry args={[maxDim * 8, maxDim * 8]} />
            <meshStandardMaterial color={themeFloor} roughness={0.85} metalness={0} />
          </mesh>
        )}

        {/* 沒選 theme 時保留原本的 grid（給設計師量度），有 theme 時用實心地板 */}
        {!themeFloor && (
          <gridHelper
            args={[
              (Math.max(design.overall.length, design.overall.width) * SCALE) * 3,
              20,
              "#aaa",
              "#ddd",
            ]}
          />
        )}

        {design.parts.map((partRaw) => {
          // joineryView 覆寫：joineryMode 開啟時，部分 part 會用「榫接版專用幾何」
          // （e.g. 書擋的 45° miter）；組裝版維持原本直角對接 / 簡潔形狀。
          const part = joineryMode && partRaw.joineryView
            ? {
                ...partRaw,
                shape: partRaw.joineryView.shape ?? partRaw.shape,
                visible: partRaw.joineryView.visible ?? partRaw.visible,
                origin: partRaw.joineryView.origin ?? partRaw.origin,
              }
            : partRaw;
          const baseColor = MATERIALS[part.material].color;
          const category = categorizePart(part.id);
          // X-ray 模式過濾：
          if (xrayMode !== "off") {
            // 抓任何 part id 含 -door (case-furniture: z1-door-1 / 中式櫃:
            // layer1-left-door / -door-raised / -door-inlay-* / -door-muntin-* 等)
            // 或 category=door。
            // 門 part 的 ID 模式：{prefix}-door-{idx}-{...} 或 -door 結尾
            // 但要排除門「內層板」（id 含 -door-inner-shelf-）— 那是櫃內收納板不是門
            const isDoor = (category === "door" || /-door($|-)/.test(part.id))
              && !/-door-inner-/.test(part.id);
            // face mode：藏「面板」+「箱體前板」+「面板把手」
            const isDrawerFront = /-drawer-\d+-(face|front)(-pull)?$/.test(part.id);
            const isDrawer = category === "drawer" || /-drawer-\d+/.test(part.id);
            // pull / hinge 屬於門 / 抽屜的視覺配件，xray 一律藏
            const isPull = /-pull$/.test(part.id);
            const isHinge = /-hinge/.test(part.id);
            if (isDoor || isPull || isHinge) return null;
            if (xrayMode === "face" && isDrawerFront) return null;
            if (xrayMode === "full" && isDrawer) return null;
          }
          const tintedColor =
            category === "drawer"
              ? tintHex(baseColor, DRAWER_TINT, TINT_AMOUNT)
              : category === "door"
                ? tintHex(baseColor, DOOR_TINT, TINT_AMOUNT)
                : baseColor;
          // 配對二元淺/深：左右淺、上下深，最多 2 色不亂
          const color = pairShadeByPartId(tintedColor, part.id);
          const { yExt } = worldExtents(part);
          const px = part.origin.x * SCALE;
          const py = (part.origin.y + yExt / 2) * SCALE;
          const pz = part.origin.z * SCALE;
          let shape: ShapeSpec | undefined;
          if (part.shape?.kind === "tapered") {
            shape = {
              kind: "tapered",
              bottomScale: part.shape.bottomScale,
              chamferMm: part.shape.chamferMm ? part.shape.chamferMm * SCALE : undefined,
              chamferStyle: part.shape.chamferStyle,
            };
          } else if (part.shape?.kind === "splayed") {
            shape = {
              kind: "splayed",
              dx: part.shape.dxMm * SCALE,
              dz: part.shape.dzMm * SCALE,
              chamferMm: part.shape.chamferMm ? part.shape.chamferMm * SCALE : undefined,
              chamferStyle: part.shape.chamferStyle,
            };
          } else if (part.shape?.kind === "hoof") {
            shape = {
              kind: "hoof",
              hoofHeight: part.shape.hoofMm * SCALE,
              hoofScale: part.shape.hoofScale,
              dirX: part.shape.dirX ?? 0,
              dirZ: part.shape.dirZ ?? 0,
            };
          } else if (part.shape?.kind === "round") {
            shape = {
              kind: "round",
              chamferMm: part.shape.chamferMm ? part.shape.chamferMm * SCALE : undefined,
              chamferStyle: part.shape.chamferStyle,
              axis: part.shape.axis,
            };
          } else if (part.shape?.kind === "round-tapered") {
            shape = { kind: "round-tapered", bottomScale: part.shape.bottomScale };
          } else if (part.shape?.kind === "shaker") {
            shape = {
              kind: "shaker",
              squareFrac: part.shape.squareFrac,
              bottomScale: part.shape.bottomScale,
            };
          } else if (part.shape?.kind === "lathe-turned") {
            shape = { kind: "lathe-turned" };
          } else if (part.shape?.kind === "splayed-tapered") {
            shape = {
              kind: "splayed-tapered",
              bottomScale: part.shape.bottomScale,
              dx: part.shape.dxMm * SCALE,
              dz: part.shape.dzMm * SCALE,
            };
          } else if (part.shape?.kind === "splayed-round-tapered") {
            shape = {
              kind: "splayed-round-tapered",
              bottomScale: part.shape.bottomScale,
              dx: part.shape.dxMm * SCALE,
              dz: part.shape.dzMm * SCALE,
            };
          } else if (part.shape?.kind === "apron-trapezoid") {
            shape = {
              kind: "apron-trapezoid",
              bevelAngle: part.shape.bevelAngle,
              topLengthScale: part.shape.topLengthScale,
              bottomLengthScale: part.shape.bottomLengthScale,
            };
          } else if (part.shape?.kind === "apron-beveled") {
            shape = { kind: "apron-beveled", bevelAngle: part.shape.bevelAngle };
          } else if (part.shape?.kind === "chamfered-top") {
            shape = {
              kind: "chamfered-top",
              chamferMm: part.shape.chamferMm * SCALE,
              bottomChamferMm: part.shape.bottomChamferMm ? part.shape.bottomChamferMm * SCALE : undefined,
              style: part.shape.style,
              cornerR: part.shape.cornerR ? part.shape.cornerR * SCALE : undefined,
            };
          } else if (part.shape?.kind === "chamfered-edges") {
            shape = { kind: "chamfered-edges", chamferMm: part.shape.chamferMm * SCALE, style: part.shape.style };
          } else if (part.shape?.kind === "notched-corners") {
            shape = {
              kind: "notched-corners",
              notchLengthMm: part.shape.notchLengthMm * SCALE,
              notchWidthMm: part.shape.notchWidthMm * SCALE,
            };
          } else if (part.shape?.kind === "arch-bent") {
            shape = {
              kind: "arch-bent",
              bendMm: part.shape.bendMm * SCALE,
              segments: part.shape.segments,
            };
          } else if (part.shape?.kind === "live-edge") {
            shape = { kind: "live-edge", amplitudeMm: (part.shape.amplitudeMm ?? 12) * SCALE };
          } else if (part.shape?.kind === "seat-scoop") {
            shape = { kind: "seat-scoop", profile: part.shape.profile, depth: part.shape.depthMm * SCALE };
          } else if (part.shape?.kind === "face-rounded") {
            shape = {
              kind: "face-rounded",
              cornerR: part.shape.cornerR * SCALE,
              topArchMm: (part.shape.topArchMm ?? 0) * SCALE,
              bottomArchMm: (part.shape.bottomArchMm ?? 0) * SCALE,
              bendMm: (part.shape.bendMm ?? 0) * SCALE,
              bendAxis: part.shape.bendAxis ?? "z",
            };
          } else if (part.shape?.kind === "mitered-ends") {
            shape = {
              kind: "mitered-ends",
              insetEach: part.shape.insetEach * SCALE,
              outerSide: part.shape.outerSide,
              tiltAngle: part.shape.tiltAngle,
              bevelAngle: part.shape.bevelAngle,
              vertices: part.shape.vertices?.map(
                ([x, y, z]) => [x * SCALE, y * SCALE, z * SCALE] as [number, number, number],
              ),
            };
          } else if (part.shape?.kind === "finger-joint-ends") {
            shape = {
              kind: "finger-joint-ends",
              segmentCount: part.shape.segmentCount,
              phase: part.shape.phase,
              fingerDepth: part.shape.fingerDepth * SCALE,
              edgeChamferMm: part.shape.edgeChamferMm !== undefined ? part.shape.edgeChamferMm * SCALE : undefined,
            };
          } else if (part.shape?.kind === "dovetail-ends") {
            shape = {
              kind: "dovetail-ends",
              segmentCount: part.shape.segmentCount,
              phase: part.shape.phase,
              angleDeg: part.shape.angleDeg,
              pinDepth: part.shape.pinDepth * SCALE,
              halfPin: part.shape.halfPin,
            };
          } else if (part.shape?.kind === "regular-polygon") {
            shape = {
              kind: "regular-polygon",
              sides: part.shape.sides,
              outerRadius: part.shape.outerRadius * SCALE,
              angleOffsetDeg: part.shape.angleOffsetDeg,
            };
          } else if (part.shape?.kind === "right-triangle") {
            shape = { kind: "right-triangle", corner: part.shape.corner };
          } else if (part.shape?.kind === "mitered-corner") {
            shape = {
              kind: "mitered-corner",
              axis: part.shape.axis,
              corner: part.shape.corner,
              depthMm: part.shape.depthMm * SCALE,
              chamferMm: part.shape.chamferMm ? part.shape.chamferMm * SCALE : undefined,
            };
          }
          // joineryMode：每個 tenon 凸出當小盒子畫，用 part 的 rotation +
          // tenon local center（含 offset）算 world position；box 跟 part 同
          // rotation 才能讓 cross-section 對齊。
          //
          // 配對母件 mortise：先找這個 tenon 在 worldMortiseIndex 裡的對應入口
          // （outward 軸反向、entry 點最近），找到且非通榫就把 mesh 長度 clamp
          // 到 mortise.depth，避免 tenon mesh 戳出母件外（圓腳/倒角讓 CSG 失
          // 效時最明顯）。through-tenon 維持原長度，因為通榫本來就要凸出母件
          // 背面。
          const tenonMeshes = joineryMode
            ? part.tenons.map((t, ti) => {
                if (t.length <= 0) return null;
                const lx = part.visible.length;
                const ly = part.visible.thickness;
                const lz = part.visible.width;
                const W = t.width;
                const T = t.thickness;
                const oW = t.offsetWidth ?? 0;
                const oT = t.offsetThickness ?? 0;

                // 算 tenon 根面世界座標 + outward 世界軸，給 mortise 配對用
                const rxP = part.rotation?.x ?? 0;
                const ryP = part.rotation?.y ?? 0;
                const rzP = part.rotation?.z ?? 0;
                let lrx = 0, lry = 0, lrz = 0;
                let lox = 0, loy = 0, loz = 0;
                switch (t.position) {
                  case "start":  lrx = -lx / 2; lry = oT; lrz = oW; lox = -1; break;
                  case "end":    lrx = +lx / 2; lry = oT; lrz = oW; lox = +1; break;
                  case "top":    lrx = oW; lry = +ly / 2; lrz = oT; loy = +1; break;
                  case "bottom": lrx = oW; lry = -ly / 2; lrz = oT; loy = -1; break;
                  case "left":   lrx = oW; lry = oT; lrz = -lz / 2; loz = -1; break;
                  case "right":  lrx = oW; lry = oT; lrz = +lz / 2; loz = +1; break;
                }
                const rRoot = rotateXYZ(rxP, ryP, rzP, lrx, lry, lrz);
                const rOut = rotateXYZ(rxP, ryP, rzP, lox, loy, loz);
                const wRootX = part.origin.x + rRoot.x;
                const wRootY = part.origin.y + worldExtents(part).yExt / 2 + rRoot.y;
                const wRootZ = part.origin.z + rRoot.z;
                const aX = Math.abs(rOut.x), aY = Math.abs(rOut.y), aZ = Math.abs(rOut.z);
                let outAxis: "x" | "y" | "z";
                let outSign: 1 | -1;
                if (aX >= aY && aX >= aZ) { outAxis = "x"; outSign = rOut.x >= 0 ? 1 : -1; }
                else if (aY >= aZ) { outAxis = "y"; outSign = rOut.y >= 0 ? 1 : -1; }
                else { outAxis = "z"; outSign = rOut.z >= 0 ? 1 : -1; }

                // tenon outward 跟 mortise opening 反向 → mortise.sign === -outSign
                //
                // Owner-family filter（避免抽屜 part 配到櫃體 part）：
                //   抽屜 part id 慣例 `{prefix}drawer-{i+1}-{role}`，例：
                //     `drawer-1-back`（單區）
                //     `col1-drawer-1-back`（columns）
                //     `z2-drawer-1-back`（zones）
                //   如果 tenon owner id 含 `drawer-N-`，只跟同 `…drawer-N-`
                //   前綴的 mortise 配對；不准跨抽屜也不准爬到櫃體 side panel。
                //   其它（leg/apron/top/case-side）維持原 1-NN 行為。
                const drawerMatch = part.id.match(/^(.*?drawer-\d+)-/);
                const drawerFamily = drawerMatch ? drawerMatch[1] + "-" : null;
                let bestMort: WorldMortise | null = null;
                let bestDist = Infinity;
                for (const mw of worldMortiseIndex) {
                  if (mw.partId === part.id) continue;
                  if (mw.axis !== outAxis) continue;
                  if (mw.sign === outSign) continue;
                  if (drawerFamily && !mw.partId.startsWith(drawerFamily)) continue;
                  const dx = mw.entryX - wRootX;
                  const dy = mw.entryY - wRootY;
                  const dz = mw.entryZ - wRootZ;
                  const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
                  // 50mm 容忍：parts 可能因斜腳 splay/錯位有些距離
                  if (d < bestDist && d < 50) { bestDist = d; bestMort = mw; }
                }

                // 通榫不 clamp（要凸出母件背面）；其它都 clamp 到母件 mortise 深
                const effLen = bestMort && !bestMort.through
                  ? Math.min(t.length, bestMort.depth)
                  : t.length;

                let lcx = 0, lcy = 0, lcz = 0;
                let hx = 0, hy = 0, hz = 0;
                // explode：tenon 沿 outward axis 多偏 explodeMm，視覺像榫頭從
                // mortise 抽出來
                let ex = 0, ey = 0, ez = 0;
                switch (t.position) {
                  case "start":
                    lcx = -lx / 2 - effLen / 2; lcy = oT; lcz = oW;
                    hx = effLen / 2; hy = T / 2; hz = W / 2;
                    ex = -explodeMm;
                    break;
                  case "end":
                    lcx = lx / 2 + effLen / 2; lcy = oT; lcz = oW;
                    hx = effLen / 2; hy = T / 2; hz = W / 2;
                    ex = explodeMm;
                    break;
                  case "top":
                    lcx = oW; lcy = ly / 2 + effLen / 2; lcz = oT;
                    hx = W / 2; hy = effLen / 2; hz = T / 2;
                    ey = explodeMm;
                    break;
                  case "bottom":
                    lcx = oW; lcy = -ly / 2 - effLen / 2; lcz = oT;
                    hx = W / 2; hy = effLen / 2; hz = T / 2;
                    ey = -explodeMm;
                    break;
                  case "left":
                    lcx = oW; lcy = oT; lcz = -lz / 2 - effLen / 2;
                    hx = W / 2; hy = T / 2; hz = effLen / 2;
                    ez = -explodeMm;
                    break;
                  case "right":
                    lcx = oW; lcy = oT; lcz = lz / 2 + effLen / 2;
                    hx = W / 2; hy = T / 2; hz = effLen / 2;
                    ez = explodeMm;
                    break;
                }
                lcx += ex; lcy += ey; lcz += ez;
                // 把 local center 經 part Euler XYZ 旋轉 → 加 part 中心 = world center
                const rx = part.rotation?.x ?? 0;
                const ry = part.rotation?.y ?? 0;
                const rz = part.rotation?.z ?? 0;
                const cosX = Math.cos(rx), sinX = Math.sin(rx);
                const cosY = Math.cos(ry), sinY = Math.sin(ry);
                const cosZ = Math.cos(rz), sinZ = Math.sin(rz);
                let x = lcx, y = lcy, z = lcz;
                // Rx
                let y2 = y * cosX - z * sinX;
                let z2 = y * sinX + z * cosX;
                y = y2; z = z2;
                // Ry
                let x2 = x * cosY + z * sinY;
                z2 = -x * sinY + z * cosY;
                x = x2; z = z2;
                // Rz
                x2 = x * cosZ - y * sinZ;
                y2 = x * sinZ + y * cosZ;
                x = x2; y = y2;
                const wx = (part.origin.x + x) * SCALE;
                const wy = (part.origin.y + worldExtents(part).yExt / 2 + y) * SCALE;
                const wz = (part.origin.z + z) * SCALE;
                // 圓料腳的 top 榫頭：cross-section 是圓 → 用 cylinderGeometry（沿 Y 軸）
                const isRoundLegPart =
                  part.shape?.kind === "round" ||
                  part.shape?.kind === "round-tapered" ||
                  part.shape?.kind === "shaker" ||
                  part.shape?.kind === "splayed-round-tapered";
                const useRoundTenon = isRoundLegPart && t.position === "top";
                return (
                  <mesh
                    key={`${part.id}-tenon-${ti}`}
                    position={[wx, wy, wz]}
                    rotation={new Euler(rx, ry, rz, "ZYX")}
                    castShadow
                  >
                    {(() => {
                      // Shrink tenon mesh 0.5mm 各軸防 z-fighting：tenon 完全埋進 mortise CSG
                      // 切口內，邊緣不貼齊母件外面，避免角隅閃出紅點
                      const SHRINK_MM = 0.5;
                      const sx = Math.max(0.05, hx - SHRINK_MM) * 2 * SCALE;
                      const sy = Math.max(0.05, hy - SHRINK_MM) * 2 * SCALE;
                      const sz = Math.max(0.05, hz - SHRINK_MM) * 2 * SCALE;
                      return useRoundTenon ? (
                        <cylinderGeometry args={[
                          Math.max(0.05, Math.min(hx, hz) - SHRINK_MM) * SCALE,
                          Math.max(0.05, Math.min(hx, hz) - SHRINK_MM) * SCALE,
                          sy,
                          24,
                        ]} />
                      ) : (
                        <boxGeometry args={[sx, sy, sz]} />
                      );
                    })()}
                    <meshStandardMaterial
                      color="#c0392b"
                      roughness={0.8}
                      transparent={selectedPartId !== null && selectedPartId !== part.id}
                      opacity={selectedPartId !== null && selectedPartId !== part.id ? 0.18 : 1}
                    />
                  </mesh>
                );
              })
            : null;

          // 選中：本體 emissive 黃光；其他零件半透明變灰（聚焦選中件）
          const isSelected = selectedPartId === part.id;
          const isDimmed = selectedPartId !== null && !isSelected;
          // Audit mode：overlap part 加紅色半透明 wireframe overlay box
          const auditOverlay = overlapIds.has(part.id) ? (
            <mesh
              position={[px, py, pz]}
              rotation={new Euler(
                part.rotation?.x ?? 0,
                part.rotation?.y ?? 0,
                part.rotation?.z ?? 0,
                "ZYX",
              )}
            >
              <boxGeometry
                args={[
                  part.visible.length * SCALE,
                  part.visible.thickness * SCALE,
                  part.visible.width * SCALE,
                ]}
              />
              <meshBasicMaterial color="#ff2030" wireframe transparent opacity={0.7} />
            </mesh>
          ) : null;

          // mortise CSG：joineryMode 顯示全部；正常 3D 只顯示 cosmetic（無線充電/穿線孔等產品凹槽）
          const mortisesToCsg = joineryMode
            ? part.mortises
            : part.mortises.filter((m) => m.cosmetic);
          const mortiseBoxesScaled: LocalBox[] | undefined =
            mortisesToCsg.length > 0
              ? mortisesToCsg.map((m) => {
                  const lb = mortiseLocalBox(part, m);
                  return {
                    cx: lb.cx * SCALE,
                    cy: lb.cy * SCALE,
                    cz: lb.cz * SCALE,
                    hx: lb.hx * SCALE,
                    hy: lb.hy * SCALE,
                    hz: lb.hz * SCALE,
                    rotX: lb.rotX,
                  };
                })
              : undefined;
          const mortiseShapesArr: Array<"rect" | "round"> | undefined =
            mortisesToCsg.length > 0
              ? mortisesToCsg.map((m) => m.shape === "round" ? "round" : "rect")
              : undefined;
          return (
            <group
              key={part.id}
              onClick={onPartSelect ? (e) => { e.stopPropagation(); onPartSelect(part.id); } : undefined}
            >
              <Part
                position={[px, py, pz]}
                size={[
                  part.visible.length * SCALE,
                  part.visible.thickness * SCALE,
                  part.visible.width * SCALE,
                ]}
                rotation={new Euler(
                  part.rotation?.x ?? 0,
                  part.rotation?.y ?? 0,
                  part.rotation?.z ?? 0,
                  "ZYX",
                )}
                color={color}
                shape={shape}
                isGlass={part.visual === "glass"}
                isBrass={part.visual === "brass-antique"}
                grainDirection={part.grainDirection}
                mortiseBoxes={mortiseBoxesScaled}
                mortiseShapes={mortiseShapesArr}
                isSelected={isSelected}
                isDimmed={isDimmed}
                wireframe={wireframeMode}
              />
              {tenonMeshes}
              {auditOverlay}
            </group>
          );
        })}


        <OrbitControls
          makeDefault
          enablePan
          enableZoom
          enableRotate
          // compactMode：target Y 下移到 thickness/3（原 thickness/2），讓家具
          // 中心點往畫面上方推
          target={[0, (design.overall.thickness * SCALE) / (compactMode ? 3 : 2), 0]}
          minDistance={maxDim * 0.15}
          maxDistance={maxDim * 6}
          maxPolarAngle={Math.PI - 0.02}
          minPolarAngle={0.02}
        />
        <CameraController
          preset={viewPreset}
          maxDim={maxDim}
          targetY={(design.overall.thickness * SCALE) / (compactMode ? 3 : 2)}
          fitHalfExtents={[
            (design.overall.length * SCALE) / 2,
            (design.overall.thickness * SCALE) / 2,
            (design.overall.width * SCALE) / 2,
          ]}
          onApplied={() => setViewPreset(null)}
        />
        <InvalidateOnDep dep={selectedPartId} />
      </Canvas>
      </div>
    </div>
  );
}

type ViewPreset = "front" | "back" | "left" | "right" | "top" | "bottom" | "hero" | "fit";

function ViewPresetBar({ onSelect }: { onSelect: (p: ViewPreset) => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const wfOn = sp?.get("wf") === "1" || sp?.get("wf") === "true";
  const xrayCur = sp?.get("xray") ?? "off";

  const toggleWf = () => {
    const params = new URLSearchParams(sp?.toString() ?? "");
    if (wfOn) params.delete("wf");
    else params.set("wf", "1");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : (pathname ?? "/"), { scroll: false });
  };

  // 三段循環：off → face（只藏面板）→ full（藏整個抽屜+門） → off
  const cycleXray = () => {
    const params = new URLSearchParams(sp?.toString() ?? "");
    const next = xrayCur === "off" ? "face" : xrayCur === "face" ? "full" : "off";
    if (next === "off") params.delete("xray");
    else params.set("xray", next);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : (pathname ?? "/"), { scroll: false });
  };

  const presets: { id: ViewPreset; label: string; title: string }[] = [
    { id: "hero", label: "45°", title: "預設立體角度" },
    { id: "fit", label: "🔍 填滿", title: "縮放至家具充滿視窗（依實際長寬高 + 畫面比例）" },
    { id: "front", label: "正", title: "正視圖" },
    { id: "back", label: "背", title: "背視圖" },
    { id: "left", label: "左", title: "左側視圖" },
    { id: "right", label: "右", title: "右側視圖" },
    { id: "top", label: "俯", title: "俯視圖" },
    { id: "bottom", label: "仰", title: "仰視圖" },
  ];
  return (
    <div className="relative shrink-0 border-b border-zinc-200">
      <div className="flex gap-1 px-2 py-1 bg-white/70 backdrop-blur-sm overflow-x-auto">
        <span className="shrink-0 px-1 text-xs text-zinc-500 self-center">視角</span>
        {presets.map((p) => (
          <button
            key={p.id}
            type="button"
            title={p.title}
            onClick={() => onSelect(p.id)}
            className="shrink-0 max-md:min-h-[44px] px-2 text-xs font-medium text-zinc-700 bg-white ring-1 ring-zinc-200 hover:ring-amber-400 hover:bg-amber-50 hover:text-amber-900 rounded transition"
          >
            {p.label}
          </button>
        ))}
        <button
          type="button"
          title="線框模式（顯示所有 edge / 內部結構）"
          onClick={toggleWf}
          className={`shrink-0 max-md:min-h-[44px] px-2 text-xs font-medium rounded ring-1 transition ${
            wfOn
              ? "bg-amber-600 text-white ring-amber-700"
              : "bg-white text-zinc-700 ring-zinc-200 hover:ring-amber-400 hover:bg-amber-50 hover:text-amber-900"
          }`}
        >
          ⊞ 線框
        </button>
        <button
          type="button"
          title={`隱藏面板（${xrayCur === "off" ? "點切到只藏門/抽屜面板" : xrayCur === "face" ? "點切到藏整個抽屜+門" : "點關閉"}）`}
          onClick={cycleXray}
          className={`shrink-0 max-md:min-h-[44px] px-2 text-xs font-medium rounded ring-1 transition ${
            xrayCur === "off"
              ? "bg-white text-zinc-700 ring-zinc-200 hover:ring-amber-400 hover:bg-amber-50 hover:text-amber-900"
              : "bg-amber-600 text-white ring-amber-700"
          }`}
        >
          🪟 {xrayCur === "off" ? "隱藏面板" : xrayCur === "face" ? "藏面板" : "藏全部"}
        </button>
      </div>
      {/* 右側 fade mask 提示橫滑 */}
      <div className="pointer-events-none absolute top-0 right-0 bottom-0 w-6 bg-gradient-to-l from-white/70 to-transparent" />
    </div>
  );
}

/**
 * frameloop="demand" 模式下，外部 prop / context 變化（如 selectedPartId）
 * 不會自動觸發 re-render → 透明度 / emissive 改了畫面也不會更新。
 * 此小元件 useEffect 監測 dep，變化時呼叫 invalidate() 強制下一幀重繪。
 */
function InvalidateOnDep({ dep }: { dep: unknown }) {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    invalidate();
  }, [dep, invalidate]);
  return null;
}

function CameraController({
  preset,
  maxDim,
  targetY,
  fitHalfExtents,
  onApplied,
}: {
  preset: ViewPreset | null;
  maxDim: number;
  targetY: number;
  fitHalfExtents: [number, number, number];
  onApplied: () => void;
}) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const controls = useThree((s) => s.controls) as {
    target: { set: (x: number, y: number, z: number) => void };
    update: () => void;
  } | null;
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    if (!preset) return;
    if (preset === "fit") {
      // Bounding-sphere fit：r = sqrt(hx² + hy² + hz²)
      // halfFov = min(vertical, horizontal) — 寬扁家具靠橫向 FOV、瘦高家具靠縱向 FOV
      // 套用 hero 方向（45° 斜上 + 略偏左後），保證家具填滿視窗
      const [hx, hy, hz] = fitHalfExtents;
      const r = Math.sqrt(hx * hx + hy * hy + hz * hz);
      const fovDeg = (camera as { fov?: number }).fov ?? 38;
      const halfV = (fovDeg * Math.PI) / 180 / 2;
      const aspect = size.width > 0 && size.height > 0 ? size.width / size.height : 1;
      const halfH = Math.atan(Math.tan(halfV) * aspect);
      const halfFov = Math.min(halfV, halfH);
      const d = (r / Math.sin(halfFov)) * 1.05;
      // hero 方向 normalize：[0.55, 0.5, -0.6] / |.| = [0.576, 0.523, -0.628]
      const dirX = 0.576;
      const dirY = 0.523;
      const dirZ = -0.628;
      camera.position.set(dirX * d, targetY + dirY * d, dirZ * d);
      if (controls) {
        controls.target.set(0, targetY, 0);
        controls.update();
      }
      invalidate();
      onApplied();
      return;
    }
    const d = maxDim * 2.3;
    // 俯/仰用球面角 polar=±0.15 rad (~8.6°) 對齊 OrbitControls 的
    // minPolarAngle=0.02 / maxPolarAngle=π-0.02 限制，距離仍維持 d。
    // 俯/仰視：camera 偏移放在 Z 軸（小量），X=0 → 世界 X 軸保持水平投影
    // 若改用 X offset（原本 topX≠0, Z=0），從正上方看時 X 軸投影到畫面垂直方向
    // 造成長方形家具長邊旋轉 90°。小 Z offset 避免 camera 與 up=(0,1,0) 完全共線。
    const zOffset = d * 0.001;
    const POS: Record<Exclude<ViewPreset, "fit">, [number, number, number]> = {
      hero:   [d * 0.55, targetY + d * 0.5, -d * 0.6],
      front:  [0, targetY, -d],
      back:   [0, targetY, d],
      left:   [-d, targetY, 0.001],
      right:  [d, targetY, 0.001],
      top:    [0, targetY + d, zOffset],
      bottom: [0, targetY - d, zOffset],
    };
    const [x, y, z] = POS[preset];
    camera.position.set(x, y, z);
    if (controls) {
      controls.target.set(0, targetY, 0);
      controls.update();
    }
    invalidate();
    onApplied();
  }, [preset, camera, controls, invalidate, maxDim, targetY, fitHalfExtents, size, onApplied]);
  return null;
}
