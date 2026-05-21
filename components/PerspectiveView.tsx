"use client";

import { memo, Component, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, Environment, ContactShadows } from "@react-three/drei";
import { ACESFilmicToneMapping, BoxGeometry, BufferGeometry, CylinderGeometry, EdgesGeometry, Euler, Float32BufferAttribute, Matrix4, MeshStandardMaterial, Quaternion, SRGBColorSpace, Vector3, VSMShadowMap } from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { Brush, Evaluator, SUBTRACTION } from "three-bvh-csg";
import type { FurnitureDesign } from "@/lib/types";
import { MATERIALS } from "@/lib/materials";
import { worldExtents } from "@/lib/render/geometry";
import {
  type ShapeSpec,
  buildShapeGeometry,
  buildDovetailEndsGeometry,
} from "@/lib/render/part-geometry";
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
import { useHoveredParts } from "@/components/HoveredPartsContext";

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

/**
 * 包住 <Environment> HDR 載入 — drei CDN 抖動時 (Could not load lebombo_1k.hdr)
 * 不該讓整個 3D 場景炸到外層 error boundary 跳「設計參數渲染失敗」。
 * HDR 掛了就 silently 拿掉，其他 ambient + directional light 仍給足基本明暗。
 */
class HDRBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(err: Error) {
    // dev 看到一次就好，prod silently 失敗
    if (process.env.NODE_ENV !== "production") {
      console.warn("[HDRBoundary] HDR env failed, dropping:", err.message);
    }
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

type WorldMortise = {
  partId: string;
  entryX: number; entryY: number; entryZ: number;
  axis: "x" | "y" | "z";
  sign: 1 | -1;
  depth: number;
  through: boolean;
  // World-space unit vector pointing OUT of the leg (opening direction).
  // Negated copy of the rotated m.axis (since m.axis points INTO leg).
  // Only set when the source Mortise carried an explicit axis override
  // (compound splay). When null, fall back to dominant-axis legacy path.
  axisUnit?: { x: number; y: number; z: number } | null;
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
    // splayed apron 的 Z 面 mortise（左右牙板進腳）：cut 繞 part-local Z 軸轉
    // rotZ 讓 cross-section 跟 tilted tenon 對齊，不留空白角
    if (m.rotZ) cut.rotation.z = m.rotZ;
    cut.updateMatrixWorld();
    const next = evaluator.evaluate(acc, cut, SUBTRACTION);
    cutGeo.dispose();
    acc.geometry.dispose();
    acc = next;
  }
  return acc.geometry;
}

type PartProps = {
  position: [number, number, number];
  size: [number, number, number];
  rotation: Euler;
  color: string;
  shape?: ShapeSpec;
  isGlass?: boolean;
  isBrass?: boolean;
  grainDirection?: "length" | "width";
  mortiseBoxes?: LocalBox[];
  mortiseShapes?: Array<"rect" | "round">;
  dovetailCuts?: Brush[];
  isSelected?: boolean;
  isHovered?: boolean;
  isDimmed?: boolean;
  wireframe?: boolean;
};

// React.memo 比較器：父元件 render 時 size/position/rotation 都是新 array
// reference；不寫自訂 equality React 預設 shallow compare 永遠 fail，memo
// 等於沒掛。把 array/Euler/shape 改成元素比較，跳過 hover / select 等
// 只動 1 件家具的場景（其他 29 件可以完全跳 render）。
function arePartPropsEqual(a: PartProps, b: PartProps): boolean {
  if (a.color !== b.color) return false;
  if (a.isGlass !== b.isGlass || a.isBrass !== b.isBrass) return false;
  if (a.grainDirection !== b.grainDirection) return false;
  if (a.isSelected !== b.isSelected || a.isHovered !== b.isHovered) return false;
  if (a.isDimmed !== b.isDimmed || a.wireframe !== b.wireframe) return false;
  if (a.position[0] !== b.position[0] || a.position[1] !== b.position[1] || a.position[2] !== b.position[2]) return false;
  if (a.size[0] !== b.size[0] || a.size[1] !== b.size[1] || a.size[2] !== b.size[2]) return false;
  if (a.rotation.x !== b.rotation.x || a.rotation.y !== b.rotation.y || a.rotation.z !== b.rotation.z) return false;
  // shape: 小物件 JSON 比較（kind + 數個 number 欄位，<200 bytes，~5μs）
  const sa = a.shape ? JSON.stringify(a.shape) : "";
  const sb = b.shape ? JSON.stringify(b.shape) : "";
  if (sa !== sb) return false;
  // mortiseBoxes / mortiseShapes / dovetailCuts: 長度 + element ref 比較
  const ma = a.mortiseBoxes, mb = b.mortiseBoxes;
  if ((ma?.length ?? 0) !== (mb?.length ?? 0)) return false;
  if (ma && mb) for (let i = 0; i < ma.length; i++) if (ma[i] !== mb[i]) return false;
  const msa = a.mortiseShapes, msb = b.mortiseShapes;
  if ((msa?.length ?? 0) !== (msb?.length ?? 0)) return false;
  if (msa && msb) for (let i = 0; i < msa.length; i++) if (msa[i] !== msb[i]) return false;
  const da = a.dovetailCuts, db = b.dovetailCuts;
  if ((da?.length ?? 0) !== (db?.length ?? 0)) return false;
  if (da && db) for (let i = 0; i < da.length; i++) if (da[i] !== db[i]) return false;
  return true;
}

const Part = memo(function PartInner({
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
  dovetailCuts,
  isSelected,
  isHovered,
  isDimmed,
  wireframe,
}: PartProps) {
  // 高亮配色（選中：amber-400 emissive 強；hover：同色但弱，預覽用）
  const HIGHLIGHT_EMISSIVE = "#fbbf24";
  const HIGHLIGHT_INTENSITY = 0.55;
  const HOVER_INTENSITY = 0.4;
  const isHighlighted = isSelected || isHovered;
  const highlightIntensity = isSelected ? HIGHLIGHT_INTENSITY : (isHovered ? HOVER_INTENSITY : 0);
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
  // useMemo deps：size 是 [a,b,c] array、shape 是 object——父元件每 render
  // 都建新 reference 害 useMemo 永遠 invalidate。改 primitive + shape JSON
  // 後 box 件 fast-path 不變，異形件每次拖滑桿省一次 geometry 重建（50-200ms）。
  const sx = size[0], sy = size[1], sz = size[2];
  const shapeKey = shape ? JSON.stringify(shape) : "";
  const geometry = useMemo(() => {
    // 幾何分派抽到 lib/render/part-geometry.ts 的純函式 buildShapeGeometry，
    // 3D 預覽與 STL/OBJ 匯出共用同一份建模邏輯。回傳 null = 用方塊 fast-path。
    return buildShapeGeometry(shape, size);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sx, sy, sz, shapeKey]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geometry, mortiseBoxes, mortiseShapes, shapeKey, sx, sy, sz]);

  // 鳩尾榫 CSG：把 dovetailCuts 中每個 cutter Brush 從本零件 base geo 減掉。
  // 上輪 (09c1097) 用 Brush.position.set + rotation.set + updateMatrixWorld 對齊
  // 的方式整個側板被挖空，疑是 matrixWorld 沒 propagate / acc 跟 cutter local
  // frame 對不上。本輪改 **pre-transform geometry**：直接把 base geo vertices
  // 套上 part 的 world transform（apply Matrix4），brush.matrixWorld 是 identity
  // → CSG 結果就是 world 座標，外層 mesh 用 identity transform 渲染。
  // deps 用 primitive：position/rotation 每 render 是 new array / new Euler，
  // 但實際數值穩定 → 拆成 6 個 number 防止 useMemo 每幀重做 CSG 害掉 invalidate
  // 迴圈。
  const px0 = position[0], py0 = position[1], pz0 = position[2];
  const rx0 = rotation.x, ry0 = rotation.y, rz0 = rotation.z;
  const dovetailCutGeometry = useMemo(() => {
    if (!dovetailCuts || dovetailCuts.length === 0) return null;
    const localGeo = csgGeometry ?? geometry ?? new BoxGeometry(size[0], size[1], size[2]);
    const material = new MeshStandardMaterial();
    const evaluator = new Evaluator();
    evaluator.useGroups = false;
    evaluator.attributes = ["position", "normal"];
    const baseClean = localGeo.clone();
    baseClean.deleteAttribute("uv");
    if (!baseClean.attributes.normal) baseClean.computeVertexNormals();
    // PRE-TRANSFORM base geo to world：vertices 直接套上 part 的 world matrix
    const m = new Matrix4().compose(
      new Vector3(px0, py0, pz0),
      new Quaternion().setFromEuler(new Euler(rx0, ry0, rz0, "ZYX")),
      new Vector3(1, 1, 1),
    );
    baseClean.applyMatrix4(m);
    baseClean.computeVertexNormals();
    let acc = new Brush(baseClean, material);
    acc.updateMatrixWorld();  // identity
    for (const cut of dovetailCuts) {
      const next = evaluator.evaluate(acc, cut, SUBTRACTION);
      acc.geometry.dispose();
      acc = next;
    }
    if (!csgGeometry && !geometry) localGeo.dispose();
    return acc.geometry;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [csgGeometry, geometry, size[0], size[1], size[2], dovetailCuts, px0, py0, pz0, rx0, ry0, rz0]);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wireframe, geometry, sx, sy, sz, shapeKey]);

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
          emissive={isHighlighted ? HIGHLIGHT_EMISSIVE : "#000000"}
          emissiveIntensity={highlightIntensity}
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
          emissive={isHighlighted ? HIGHLIGHT_EMISSIVE : "#000000"}
          emissiveIntensity={highlightIntensity}
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
  const hasDovetailCut = (dovetailCuts?.length ?? 0) > 0 && dovetailCutGeometry !== null;
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
    hasCosmeticCut ||
    hasDovetailCut;
  // dovetailCutGeometry 已在 world，mesh 必須 identity transform 否則雙重套位置錯
  const meshPosition: [number, number, number] = hasDovetailCut ? [0, 0, 0] : position;
  const meshRotation = hasDovetailCut ? new Euler(0, 0, 0) : rotation;
  return (
    <mesh position={meshPosition} rotation={meshRotation} castShadow receiveShadow>
      {dovetailCutGeometry ? (
        <primitive attach="geometry" object={dovetailCutGeometry} />
      ) : csgGeometry ? (
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
        emissive={isHighlighted ? HIGHLIGHT_EMISSIVE : "#000000"}
        emissiveIntensity={highlightIntensity}
      />
    </mesh>
  );
}, arePartPropsEqual);


export function PerspectiveView({
  design,
  sceneTheme,
  joineryMode = false,
  auditMode = false,
  explodeMm = 0,
  lidLiftMm = 0,
  xrayMode = "off",
  selectedPartId = null,
  onPartSelect,
  compactMode = false,
  wireframeMode = false,
  hidePartIds = [],
}: {
  design: FurnitureDesign;
  /** 場景環境主題（natural=現況，其他加地板+調光）*/
  sceneTheme?: import("@/lib/design/scene-themes").SceneTheme;
  /** 榫接模式：3D 多畫一層紅色 tenon 凸出 */
  joineryMode?: boolean;
  /** Dev audit mode：?audit=true URL 啟用，overlap 的 parts 用紅色 wireframe 高亮 */
  auditMode?: boolean;
  /** 掀蓋浮起：dovetail-box 才用，lid + plug + hinge 往上抬 lidLiftMm（mm） */
  lidLiftMm?: number;
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
  /** Debug：隱藏特定 part.id（用 URL ?hide=wall-front,wall-back 之類驗證 CSG/joint） */
  hidePartIds?: string[];
}) {
  const [viewPreset, setViewPreset] = useState<ViewPreset | null>(null);
  // Hover 高亮（Bot B：context 進來的 part id 集合，emissive 預覽用）
  // 沒 provider 也 fallback 空集合，hook 不會 throw
  const { hoveredPartIds } = useHoveredParts();
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
        // Compound splay: Mortise.axis is now WORLD-frame opening direction
        // (out of leg, toward apron). Consume directly — no part-rotation
        // composition, no negation. The matching Tenon.axis (out of apron,
        // into leg) is anti-parallel; dot-product check below uses < -0.85.
        const axisUnit = m.axis
          ? (() => {
              const mag = Math.hypot(m.axis!.x, m.axis!.y, m.axis!.z) || 1;
              return { x: m.axis!.x / mag, y: m.axis!.y / mag, z: m.axis!.z / mag };
            })()
          : null;
        idx.push({
          partId: part.id,
          entryX: pcx + e.x,
          entryY: pcy + e.y,
          entryZ: pcz + e.z,
          axis: worldAxis,
          sign: worldSign,
          depth: m.depth,
          through: m.through ?? false,
          axisUnit,
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

  // 鳩尾榫 CSG cutters：把每個 dovetail-ends 板（tray 前後板）的幾何包成 Brush，
  // **vertices 直接 pre-transform 到 world** (applyMatrix4 套 part position + ZYX
  // rotation)、brush.matrixWorld = identity → CSG 結果就是 world 座標。
  //
  // 設計：tray.ts 把 dovetail-ends shape 只掛在 wall-front/wall-back（phase=0
  // = tail），左右板留完整 box（不切榫）。本 useMemo 用前後板的 dovetail tail
  // 幾何當 cutter，從左右板 box 挖出對應的梯形 gap → 自動形成正確的 pin 形狀，
  // 不用硬算 trapezoid 對齊。
  //
  // 上輪 (09c1097 → revert 191a5ac) 用 brush.position.set + rotation.set +
  // updateMatrixWorld 對齊，側板整個被挖空。本輪改 pre-transform geometry 避開
  // matrixWorld propagation 疑慮。
  const dovetailCutBrushes = useMemo<{ brush: Brush; fromLid: boolean }[]>(() => {
    const brushes: { brush: Brush; fromLid: boolean }[] = [];
    const material = new MeshStandardMaterial();
    for (const part of design.parts) {
      if (part.shape?.kind !== "dovetail-ends") continue;
      const sx = part.visible.length * SCALE;
      const sy = part.visible.thickness * SCALE;
      const sz = part.visible.width * SCALE;
      const geo = buildDovetailEndsGeometry(
        [sx, sy, sz],
        part.shape.segmentCount,
        part.shape.phase,
        part.shape.angleDeg,
        part.shape.pinDepth * SCALE,
        part.shape.halfPin ?? true,
      );
      geo.deleteAttribute("uv");
      if (!geo.attributes.normal) geo.computeVertexNormals();
      // tail tip 在 X=±halfLength 跟側板外面 face 重合 → Z-fighting
      // 沿 X 微放大讓 cut 超出側板外面 0.2mm（feedback_csg_overlap_over_analytical_fit）
      // 之前用 1mm 過大，cavity 比 tail 深 1mm，視覺上會看到 tail tip 後面亮色細縫。
      const sxFull = part.visible.length;
      const xScale = (sxFull + 0.4) / sxFull;
      geo.scale(xScale, 1, 1);
      const { yExt } = worldExtents(part);
      const px = part.origin.x * SCALE;
      const py = (part.origin.y + yExt / 2) * SCALE;
      const pz = part.origin.z * SCALE;
      const m = new Matrix4().compose(
        new Vector3(px, py, pz),
        new Quaternion().setFromEuler(new Euler(
          part.rotation?.x ?? 0,
          part.rotation?.y ?? 0,
          part.rotation?.z ?? 0,
          "ZYX",
        )),
        new Vector3(1, 1, 1),
      );
      geo.applyMatrix4(m);
      geo.computeVertexNormals();
      const brush = new Brush(geo, material);
      brush.updateMatrixWorld();  // identity matrix
      brushes.push({ brush, fromLid: /-lid$/.test(part.id) });
    }
    return brushes;
  }, [design.parts]);

  return (
    <div className={
      compactMode
        ? "w-full h-full overflow-hidden bg-gradient-to-b from-zinc-50 to-zinc-200 flex flex-col"
        : "w-full h-[40vh] min-h-[260px] lg:h-[520px] rounded-xl overflow-hidden border border-zinc-200 shadow-sm bg-gradient-to-b from-zinc-50 to-zinc-200 flex flex-col"
    }>
      <ViewPresetBar onSelect={setViewPreset} hasLid={design.parts.some((p) => p.id === "lid")} />
      <div data-thumb="3d" className="flex-1 min-h-0 relative">
      <Canvas
        // VSMShadowMap (variance) 取代預設 PCFSoftShadowMap—— PCFSoftShadowMap
        // 在 Three.js r170+ 已 deprecated 並 fallback 到硬陰影 PCFShadowMap，
        // console 每張 3D 載入時刷 11+ 條 warning 像出包。VSM 是新版軟陰影方案，
        // 視覺效果接近原本，且不再有 deprecation 警告。
        shadows={{ type: VSMShadowMap }}
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
            <HDRBoundary>
              <Environment preset="apartment" />
            </HDRBoundary>
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
          if (hidePartIds.includes(partRaw.id)) return null;
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
            // 盒蓋（dovetail-box lid）跟門一樣 xray 一律藏
            const isLid = part.id === "lid";
            // face mode：藏「面板」+「箱體前板」+「面板把手」
            const isDrawerFront = /-drawer-\d+-(face|front)(-pull)?$/.test(part.id);
            const isDrawer = category === "drawer" || /-drawer-\d+/.test(part.id);
            // pull / hinge 屬於門 / 抽屜的視覺配件，xray 一律藏
            const isPull = /-pull$/.test(part.id);
            const isHinge = /-hinge/.test(part.id);
            if (isDoor || isLid || isPull || isHinge) return null;
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
          // 掀蓋：lid / lid-plug / lid-hinge-* 整組
          //   lidLiftMm > 0 = 垂直浮起 N mm（lift 模式）
          //   lidLiftMm < 0 = 繞後緣 90° 鉸鏈翻開（open 模式）
          const isLidGroup =
            part.id === "lid" || /^lid-(plug|hinge|cleat|raised-center)/.test(part.id) || /-lid$/.test(part.id);
          const lidOpenMode = isLidGroup && lidLiftMm < 0;
          // 預設 px/py/pz：未掀 + lift mode 共用
          const liftMm = isLidGroup && lidLiftMm > 0 ? lidLiftMm : 0;
          let px = part.origin.x * SCALE;
          let py = (part.origin.y + yExt / 2 + liftMm) * SCALE;
          let pz = part.origin.z * SCALE;
          // open mode：把 part center 繞後緣軸（X 軸通過 (0, lidBottomY_mm, +outerW/2)）轉 +π/2
          // pivot Y 用 lid origin.y（= 壁頂層 outerH - lidT），pivot Z = +outerW/2。
          let openRotation: Euler | null = null;
          if (lidOpenMode) {
            // pivot Y：lift-off 模式 = lid 牆底（= cutY）；其他蓋型 = lid origin.y
            // 偵測 lift-off：存在 wall-*-lid 牆
            const lidWall = design.parts.find((p) => /-lid$/.test(p.id) && /^wall-/.test(p.id));
            const lidRef = design.parts.find((p) => p.id === "lid");
            const pivotY_mm = lidWall?.origin.y ?? lidRef?.origin.y ?? part.origin.y;
            const pivotZ_mm = design.overall.width / 2;
            const cx_mm = part.origin.x;
            const cy_mm = part.origin.y + yExt / 2;
            const cz_mm = part.origin.z;
            const rY = cy_mm - pivotY_mm;
            const rZ = cz_mm - pivotZ_mm;
            // Rx(+π/2)：new_y = -z, new_z = y
            const newRY = -rZ;
            const newRZ = rY;
            px = cx_mm * SCALE;
            py = (pivotY_mm + newRY) * SCALE;
            pz = (pivotZ_mm + newRZ) * SCALE;
            // 合成 rotation：openQuat ∘ partQuat
            const openQuat = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), Math.PI / 2);
            const partQuat = new Quaternion().setFromEuler(
              new Euler(part.rotation?.x ?? 0, part.rotation?.y ?? 0, part.rotation?.z ?? 0, "ZYX"),
            );
            openRotation = new Euler().setFromQuaternion(openQuat.multiply(partQuat), "ZYX");
          }
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
                // Compute root position in world (always via part rotation).
                const rRoot = rotateXYZ(rxP, ryP, rzP, lrx, lry, lrz);
                const wRootX = part.origin.x + rRoot.x;
                const wRootY = part.origin.y + worldExtents(part).yExt / 2 + rRoot.y;
                const wRootZ = part.origin.z + rRoot.z;
                // outUnit / outAxis: tenon outward direction in WORLD frame.
                // - With t.axis present (compound splay): t.axis IS world; use directly.
                // - Without t.axis: rotate position-default local outward through partQ.
                let outUnit: { x: number; y: number; z: number };
                if (t.axis) {
                  const m = Math.hypot(t.axis.x, t.axis.y, t.axis.z) || 1;
                  outUnit = { x: t.axis.x / m, y: t.axis.y / m, z: t.axis.z / m };
                } else {
                  const rOut = rotateXYZ(rxP, ryP, rzP, lox, loy, loz);
                  const mag = Math.hypot(rOut.x, rOut.y, rOut.z) || 1;
                  outUnit = { x: rOut.x / mag, y: rOut.y / mag, z: rOut.z / mag };
                }
                const aX = Math.abs(outUnit.x), aY = Math.abs(outUnit.y), aZ = Math.abs(outUnit.z);
                let outAxis: "x" | "y" | "z";
                let outSign: 1 | -1;
                if (aX >= aY && aX >= aZ) { outAxis = "x"; outSign = outUnit.x >= 0 ? 1 : -1; }
                else if (aY >= aZ) { outAxis = "y"; outSign = outUnit.y >= 0 ? 1 : -1; }
                else { outAxis = "z"; outSign = outUnit.z >= 0 ? 1 : -1; }

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
                  if (drawerFamily && !mw.partId.startsWith(drawerFamily)) continue;
                  // Compound splay: both sides are WORLD-frame unit vectors.
                  // mw.axisUnit = mortise OPENING direction (out of leg toward apron).
                  // outUnit    = tenon outward direction (out of apron into leg).
                  // They point opposite each other → anti-parallel (dot ≈ -1).
                  if (mw.axisUnit && t.axis) {
                    const dot =
                      mw.axisUnit.x * outUnit.x +
                      mw.axisUnit.y * outUnit.y +
                      mw.axisUnit.z * outUnit.z;
                    if (dot > -0.85) continue;
                  } else {
                    if (mw.axis !== outAxis) continue;
                    if (mw.sign === outSign) continue;
                  }
                  const dx = mw.entryX - wRootX;
                  const dy = mw.entryY - wRootY;
                  const dz = mw.entryZ - wRootZ;
                  const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
                  // 60mm 容忍（compound splay 允許多一點偏差，原 50mm）
                  if (d < bestDist && d < 60) { bestDist = d; bestMort = mw; }
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
                // Note: with t.axis (compound splay), lcx/lcy/lcz remain at the
                // position-default local center. The mesh quaternion below
                // applies a WORLD-frame rotation that orients the box's long
                // axis onto t.axis; the box stays centred at its nominal
                // tenon position (visually approximate but acceptable).
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

                // Compound splay: t.axis is WORLD-frame tenon direction.
                // Composition: meshQuat = extraQ_world * partQ
                //   - partQ takes geometry from part-local to world (so the
                //     box's cross-section ends up aligned with the part's
                //     local W/T — tenon wide-face faces "up" relative to apron)
                //   - extraQ_world then rotates the post-partQ long-axis
                //     direction onto t.axis (world)
                // This preserves cross-section orientation while pointing
                // the long axis at the world-frame splayed tenon direction.
                // Compute meshQuat and the world-frame position shift needed
                // so the tenon's ROOT (the face flush against the parent part)
                // stays on the parent's exterior face after rotation. Without
                // the shift the mesh would rotate about its center, lifting
                // the root off the parent face by `(effLen/2) * (tAxis - geomLongWorld)`.
                let posShift: { x: number; y: number; z: number } | null = null;
                const meshQuat = (() => {
                  if (!t.axis) return null;
                  const partQ = new Quaternion().setFromEuler(new Euler(rx, ry, rz, "ZYX"));
                  const geomLongLocal: [number, number, number] =
                    (t.position === "start" || t.position === "end")  ? [1, 0, 0] :
                    (t.position === "top" || t.position === "bottom") ? [0, 1, 0] :
                                                                         [0, 0, 1];
                  const flip = (t.position === "start" || t.position === "bottom" || t.position === "left") ? -1 : 1;
                  const geomLongLocalV = new Vector3(
                    geomLongLocal[0] * flip,
                    geomLongLocal[1] * flip,
                    geomLongLocal[2] * flip,
                  );
                  const geomLongWorld = geomLongLocalV.clone().applyQuaternion(partQ);
                  const tm = Math.hypot(t.axis.x, t.axis.y, t.axis.z) || 1;
                  const target = new Vector3(t.axis.x / tm, t.axis.y / tm, t.axis.z / tm);
                  const extraQ = new Quaternion().setFromUnitVectors(geomLongWorld, target);
                  // Root-anchor shift: position += (effLen/2) * (target - geomLongWorld)
                  // in world frame. This keeps the tenon's root-face CENTER on the
                  // parent's exterior face after rotation. But the rotated box's
                  // bottom-face corners still spread ±(W/2*|perpY|) above/below
                  // this center, leaving a visible wedge gap on one side and
                  // overlap on the other.
                  //
                  // Second shift: push the mesh further along -target so the
                  // HIGHEST root-face corner lands at the anchor plane. After
                  // this, no part of the root face protrudes past the parent's
                  // exterior; the diagonal cut sinks into the parent (hidden
                  // in solid render, slightly visible in wireframe).
                  const composed = extraQ.clone().multiply(partQ);
                  const rootMesh = new Vector3(
                    -hx * geomLongLocal[0] * flip,
                    -hy * geomLongLocal[1] * flip,
                    -hz * geomLongLocal[2] * flip,
                  );
                  // Cross-section half-extents along the two non-long axes.
                  const isLongX = Math.abs(geomLongLocal[0]) > 0.5;
                  const isLongY = Math.abs(geomLongLocal[1]) > 0.5;
                  const halfA = isLongX ? hy : hx;
                  const halfB = isLongY ? hz : (isLongX ? hz : hy);
                  const perpAxisA = new Vector3(isLongX ? 0 : 1, isLongX ? 1 : 0, 0);
                  const perpAxisB = new Vector3(isLongX || isLongY ? 0 : 1, 0, isLongX || isLongY ? 1 : 0);
                  let maxCornerY = -Infinity;
                  for (const sa of [-1, 1]) for (const sb of [-1, 1]) {
                    const cornerLocal = rootMesh.clone()
                      .addScaledVector(perpAxisA, sa * halfA)
                      .addScaledVector(perpAxisB, sb * halfB);
                    const cornerWorld = cornerLocal.applyQuaternion(composed);
                    if (cornerWorld.y > maxCornerY) maxCornerY = cornerWorld.y;
                  }
                  // posShift = root-anchor + sink (push down by max corner Y so
                  // no corner protrudes above the anchor plane).
                  posShift = {
                    x: (effLen / 2) * (target.x - geomLongWorld.x) * SCALE,
                    y: (effLen / 2) * (target.y - geomLongWorld.y) * SCALE - maxCornerY * SCALE,
                    z: (effLen / 2) * (target.z - geomLongWorld.z) * SCALE,
                  };
                  return extraQ.multiply(partQ);
                })();

                // When t.axis is present, render as a SHEARED BOX: root + tip
                // cross-sections stay parallel to the parent's shoulder face
                // (horizontal for a leg's top face), and the body slides along
                // t.axis. This matches real woodworking (shoulder cut flat, tenon
                // body angled to match leg's lean). The mesh uses NO quaternion;
                // the shear is encoded directly in vertex positions.
                const useShearedBox = !!t.axis && !useRoundTenon;
                const shearedGeom = useShearedBox && t.axis ? (() => {
                  const SHRINK_MM = 0.5;
                  const ROOT_BURY = 0.1;  // mm, both ends
                  // A tenon is a PARALLELEPIPED with two independent directions:
                  //   B = body direction (along wood grain)
                  //   N = end face normal (perpendicular to cut surface)
                  // For leg-top tenon: B = t.axis (slanted), N = default outward
                  //   (= world Y for unrotated legs) — leg lean, horizontal shoulder.
                  // For apron tenon: B = apron length in world (partQ * default
                  //   outward), N = t.axis (compound miter plane normal) —
                  //   apron runs straight between corners, end faces are oblique.
                  const isTopBottom = (t.position === "top" || t.position === "bottom");
                  const isStartEnd  = (t.position === "start" || t.position === "end");

                  // Default outward direction in part-local (the direction the
                  // tenon protrudes naturally before t.axis override).
                  const defaultLocal: [number, number, number] =
                    t.position === "start"  ? [-1, 0, 0] :
                    t.position === "end"    ? [+1, 0, 0] :
                    t.position === "top"    ? [ 0, +1, 0] :
                    t.position === "bottom" ? [ 0, -1, 0] :
                    t.position === "left"   ? [ 0, 0, -1] :
                                              [ 0, 0, +1];
                  const partQS = new Quaternion().setFromEuler(new Euler(rx, ry, rz, "ZYX"));
                  const defaultWorld = new Vector3(...defaultLocal).applyQuaternion(partQS).normalize();
                  const tUnit = new Vector3(t.axis.x, t.axis.y, t.axis.z).normalize();

                  let B: Vector3;
                  let N: Vector3;
                  if (isTopBottom) {
                    // Legs: body along t.axis, end face normal along default outward.
                    B = tUnit.clone();
                    N = defaultWorld.clone();
                  } else {
                    // Aprons/stretchers: body along apron length, end face normal
                    // along t.axis (compound miter plane).
                    B = defaultWorld.clone();
                    N = tUnit.clone();
                  }

                  // Cross-section axes: the two part-local axes perpendicular to
                  // the long axis, transformed to world via partQ, then projected
                  // onto the plane perpendicular to N (Gram-Schmidt).
                  const cross1Local =
                    isStartEnd  ? new Vector3(0, 1, 0) :  // long=X → cross={Y,Z}
                    isTopBottom ? new Vector3(1, 0, 0) :  // long=Y → cross={X,Z}
                                  new Vector3(1, 0, 0);   // long=Z → cross={X,Y}
                  const cross2Local =
                    isStartEnd  ? new Vector3(0, 0, 1) :
                    isTopBottom ? new Vector3(0, 0, 1) :
                                  new Vector3(0, 1, 0);
                  const c1World = cross1Local.applyQuaternion(partQS);
                  const c2World = cross2Local.applyQuaternion(partQS);
                  // Project onto plane ⊥ N
                  const cross1 = c1World.clone().addScaledVector(N, -c1World.dot(N)).normalize();
                  const cross2 = c2World.clone().addScaledVector(N, -c2World.dot(N));
                  cross2.addScaledVector(cross1, -cross2.dot(cross1)).normalize();

                  // Cross-section half-extents (mm).
                  // For isStartEnd: long=X → perp1=Y (thickness), perp2=Z (width).
                  // For isTopBottom: long=Y → perp1=X (width), perp2=Z (thickness).
                  // For left/right: long=Z → perp1=X (width), perp2=Y (thickness).
                  const halfPerp1 = isStartEnd ? hy : hx;
                  const halfPerp2 = isStartEnd ? hz : (isTopBottom ? hz : hy);
                  const h1 = Math.max(0.05, halfPerp1 - SHRINK_MM) * SCALE;
                  const h2 = Math.max(0.05, halfPerp2 - SHRINK_MM) * SCALE;

                  // Body length: cut-plane normal is N, body direction is B.
                  // Tip face plane sits at depth effLen from root along N, so
                  //   L_body * (B · N) = effLen  → L_body = effLen / |B · N|
                  // Add 2*ROOT_BURY to bury both ends slightly (z-fight masking).
                  const bDotN = B.dot(N);
                  const denom = Math.max(0.1, Math.abs(bDotN));
                  const Lworld = (Math.abs(effLen) / denom + 2 * ROOT_BURY) * SCALE;

                  // Mesh origin sits at the nominal tenon center (wx,wy,wz)
                  // which was computed as position-default local center —
                  // i.e. parent-face + (effLen/2) along defaultWorld.
                  // Place ROOT at -(effLen/2 + bury)*defaultWorld so the root
                  // face stays flush with the parent shoulder face. Then walk
                  // tip = root + Lworld * B.
                  //
                  // Tilted cross-section corner protrusion correction：
                  // cross1/cross2 在 N⊥ plane，當 N ≠ defaultWorld 時、
                  // cross 軸在 defaultWorld 方向有非零投影，角落會比 root center
                  // 多伸 maxCornerProj 進 parent。把 root 往 defaultWorld 外推
                  // maxCornerProj 補償。
                  // rootCenter 放在 parent 實際肩面中心：
                  // - apron-trapezoid：miter plane 中心 = -lx*avgScale/2 in part-local
                  //   (avgScale = (topS+botS)/2)
                  //   → halfLenLocal = lx*(1-avgScale)/2 + effLen/2
                  // - 其他：parent 肩面就在 nominal end (-lx/2)
                  //   → halfLenLocal = effLen/2
                  // 因為 root face 已經在 N⊥ plane（= 平行 miter plane）、
                  // rootCenter 落在 miter plane 上時、4 個角落都在 miter plane
                  // 跟 parent 材料貼齊不重疊（不需 maxCornerProj 補償）
                  // rootCenter 放在 parent miter plane 上（不同 Z 高度位置不同）：
                  // 推導：apron-trapezoid 端面 4 角在 (-topX, ±hy, -hz) 跟 (-botX, ±hy, +hz)
                  // miter plane 方程 (in part-local): rootX = -lx*avgScale/2 - lx*(botS-topS)/(4*hz)*lcz
                  //   - lcz=0 (中央): rootX = -lx*avgScale/2 ✓
                  //   - lcz!=0 (offset)：考慮 Z 補償
                  // rootCenter_local.x = mesh_origin_local.x + halfLenLocal (start 方向)
                  //                    = lcx + halfLenLocal
                  // halfLenLocal = rootX_target - lcx (for start: lcx = -lx/2 - effLen/2)
                  let halfLenLocal = Math.abs(effLen) / 2 + ROOT_BURY;
                  if (part.shape?.kind === "apron-trapezoid" && isStartEnd) {
                    const topS = part.shape.topLengthScale ?? 1;
                    const botS = part.shape.bottomLengthScale ?? 1;
                    const avgScale = (topS + botS) / 2;
                    const lxPart = part.visible.length;
                    const hzPart = part.visible.width / 2;
                    // 端面有 Z 傾斜 → 不同 Z 位置 (lcz) 的 miter X 位置不同
                    const zCompensation = hzPart > 0 ? lxPart * (botS - topS) / (4 * hzPart) * lcz : 0;
                    halfLenLocal = lxPart * (1 - avgScale) / 2 + Math.abs(effLen) / 2 - zCompensation + ROOT_BURY;
                  }
                  const halfLenWorld = halfLenLocal * SCALE;
                  const rootCenter = defaultWorld.clone().multiplyScalar(-halfLenWorld);
                  const tipCenter  = rootCenter.clone().addScaledVector(B, Lworld);

                  const corners: Vector3[] = [];
                  for (const sa of [-1, 1]) for (const sb of [-1, 1]) {
                    const c = rootCenter.clone()
                      .addScaledVector(cross1, sa * h1)
                      .addScaledVector(cross2, sb * h2);
                    corners.push(c);
                  }
                  for (const sa of [-1, 1]) for (const sb of [-1, 1]) {
                    const c = tipCenter.clone()
                      .addScaledVector(cross1, sa * h1)
                      .addScaledVector(cross2, sb * h2);
                    corners.push(c);
                  }
                  // Flatten to Float32Array
                  const positions = new Float32Array(corners.length * 3);
                  corners.forEach((v, i) => { positions[i*3] = v.x; positions[i*3+1] = v.y; positions[i*3+2] = v.z; });
                  // Indices: 6 faces, 2 triangles each = 12 triangles = 36 indices.
                  // Corner layout (root then tip, both in cross1-cross2 quadrants):
                  //   0: root (-1,-1)
                  //   1: root (-1,+1)
                  //   2: root (+1,-1)
                  //   3: root (+1,+1)
                  //   4: tip  (-1,-1)
                  //   5: tip  (-1,+1)
                  //   6: tip  (+1,-1)
                  //   7: tip  (+1,+1)
                  const indices = new Uint16Array([
                    // root face (facing -longAxis): 0,2,3 + 0,3,1
                    0, 2, 3,  0, 3, 1,
                    // tip face (facing +longAxis): 4,5,7 + 4,7,6
                    4, 5, 7,  4, 7, 6,
                    // side cross1 +1: 2,6,7 + 2,7,3
                    2, 6, 7,  2, 7, 3,
                    // side cross1 -1: 0,1,5 + 0,5,4
                    0, 1, 5,  0, 5, 4,
                    // side cross2 +1: 1,3,7 + 1,7,5
                    1, 3, 7,  1, 7, 5,
                    // side cross2 -1: 0,4,6 + 0,6,2
                    0, 4, 6,  0, 6, 2,
                  ]);
                  // 計算 vertex normals（用 BufferGeometry.computeVertexNormals 一次性）
                  const tmpGeo = new BufferGeometry();
                  tmpGeo.setAttribute("position", new Float32BufferAttribute(positions, 3));
                  tmpGeo.setIndex(Array.from(indices));
                  tmpGeo.computeVertexNormals();
                  const normalAttr = tmpGeo.getAttribute("normal");
                  const normals = new Float32Array(normalAttr.array);
                  return { positions, indices, normals };
                })() : null;

                const meshPos: [number, number, number] = useShearedBox
                  ? [wx, wy, wz]                                       // sheared box uses bare wx/wy/wz (no rotation, geometry is pre-shaped)
                  : (posShift
                      ? [wx + posShift.x, wy + posShift.y, wz + posShift.z]
                      : [wx, wy, wz]);

                return (
                  <mesh
                    key={`${part.id}-tenon-${ti}`}
                    position={meshPos}
                    {...(useShearedBox
                      ? {}                                              // sheared box: identity rotation (shear is in geometry)
                      : meshQuat
                        ? { quaternion: meshQuat }
                        : { rotation: new Euler(rx, ry, rz, "ZYX") })}
                    castShadow
                  >
                    {(() => {
                      const SHRINK_MM = 0.5;
                      // Only shrink the CROSS-SECTION (real z-fight risk against
                      // mortise walls). Keep the long axis at full effLen so the
                      // root face sits flush with the parent's shoulder face —
                      // shrinking it lifts the root by 0.5mm and shows as a gap.
                      const isLongAxisX = (t.position === "start" || t.position === "end");
                      const isLongAxisY = (t.position === "top" || t.position === "bottom");
                      const isLongAxisZ = !isLongAxisX && !isLongAxisY;
                      const sx = (isLongAxisX ? hx : Math.max(0.05, hx - SHRINK_MM)) * 2 * SCALE;
                      const sy = (isLongAxisY ? hy : Math.max(0.05, hy - SHRINK_MM)) * 2 * SCALE;
                      const sz = (isLongAxisZ ? hz : Math.max(0.05, hz - SHRINK_MM)) * 2 * SCALE;
                      if (useRoundTenon) {
                        return (
                          <cylinderGeometry args={[
                            Math.max(0.05, Math.min(hx, hz) - SHRINK_MM) * SCALE,
                            Math.max(0.05, Math.min(hx, hz) - SHRINK_MM) * SCALE,
                            sy,
                            24,
                          ]} />
                        );
                      }
                      if (shearedGeom) {
                        return (
                          <bufferGeometry>
                            <bufferAttribute
                              attach="attributes-position"
                              args={[shearedGeom.positions, 3]}
                            />
                            <bufferAttribute
                              attach="attributes-normal"
                              args={[shearedGeom.normals, 3]}
                            />
                            <bufferAttribute
                              attach="index"
                              args={[shearedGeom.indices, 1]}
                            />
                          </bufferGeometry>
                        );
                      }
                      return <boxGeometry args={[sx, sy, sz]} />;
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
          // Hover 預覽（Bot B）：context 命中即發弱光；不影響 dim 行為（hover 不該讓其他件變灰）
          const isHovered = hoveredPartIds.has(part.id);
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
                    rotZ: lb.rotZ,
                  };
                })
              : undefined;
          const mortiseShapesArr: Array<"rect" | "round"> | undefined =
            mortisesToCsg.length > 0
              ? mortisesToCsg.map((m) => m.shape === "round" ? "round" : "rect")
              : undefined;
          // 鳩尾榫 wall-left / wall-right：base box geo 減掉前後板 dovetail tail
          // brush。lift-off 蓋段側板 wall-*-lid 也要套——但只套同段 brush 避免
          // Y=cutY 邊界跟另一段 brush 衝突造成 z-fighting。
          const isBodySide = part.id === "wall-left" || part.id === "wall-right";
          const isLidSide = part.id === "wall-left-lid" || part.id === "wall-right-lid";
          // 抽屜半鳩尾：tail carrier 是側板（shape=dovetail-ends），receiver 是
          // 前/後板。drawer-row.ts 生的 part id 格式 `${idPrefix}-${i+1}-(front|back)`，
          // pattern 配 `-\d+-(front|back)$`、跨多 zone / 多 drawer 都對得到。
          const isDrawerReceiver = /-\d+-(front|back)$/.test(part.id);
          const partDovetailCuts: Brush[] | undefined =
            dovetailCutBrushes.length > 0 && (isBodySide || isLidSide || isDrawerReceiver)
              ? dovetailCutBrushes
                  .filter((b) => (isLidSide ? b.fromLid : !b.fromLid))
                  .map((b) => b.brush)
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
                rotation={openRotation ?? new Euler(
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
                dovetailCuts={partDovetailCuts}
                isSelected={isSelected}
                isHovered={isHovered}
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

function ViewPresetBar({ onSelect, hasLid = false }: { onSelect: (p: ViewPreset) => void; hasLid?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const wfOn = sp?.get("wf") === "1" || sp?.get("wf") === "true";
  const xrayCur = sp?.get("xray") ?? "off";
  const lidLiftCur = Number(sp?.get("lidLift") ?? "0");

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

  // 四段循環：蓋上 → 30 mm 微抬 → 80 mm 高抬 → -1（90° 掀開）→ 蓋上
  // 只 dovetail-box 顯示；用 lidLift URL param 控制（負值 = 鉸鏈 90° 翻開）
  const cycleLidLift = () => {
    const params = new URLSearchParams(sp?.toString() ?? "");
    const cur = lidLiftCur;
    const next = cur === 0 ? 30 : cur === 30 ? 80 : cur === 80 ? -1 : 0;
    if (next === 0) params.delete("lidLift");
    else params.set("lidLift", String(next));
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
        {hasLid && (
          <button
            type="button"
            title={`掀蓋（看 lid 底下結構）：當前 ${
              lidLiftCur < 0 ? "90° 翻開" : lidLiftCur > 0 ? lidLiftCur + "mm 浮起" : "蓋上"
            }，點切下一檔`}
            onClick={cycleLidLift}
            className={`shrink-0 max-md:min-h-[44px] px-2 text-xs font-medium rounded ring-1 transition ${
              lidLiftCur !== 0
                ? "bg-amber-600 text-white ring-amber-700"
                : "bg-white text-zinc-700 ring-zinc-200 hover:ring-amber-400 hover:bg-amber-50 hover:text-amber-900"
            }`}
          >
            📦 {lidLiftCur < 0 ? "90° 掀開" : lidLiftCur > 0 ? `浮 ${lidLiftCur}mm` : "掀蓋"}
          </button>
        )}
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
