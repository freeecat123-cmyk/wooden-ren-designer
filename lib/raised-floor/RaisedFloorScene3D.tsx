"use client";

/**
 * 和室架高平台 — R3F 3D 場景含爆炸圖
 *
 * 對標 lib/ceiling/CeilingScene3D.tsx 的 5 圖層架構,擴增到 6 圖層。
 *
 * 座標系(嚴格遵守 spec):
 *   X = 平台 polygon 的 x 軸(=input.widthCm 方向)
 *   Z = 平台 polygon 的 y 軸(=input.depthCm 方向)
 *   Y = 高度,Y=0 為地面,Y>0 往上是平台
 *   原點 = 平台 bbox 中心(用 group position=[-cx, 0, -cz] 移)
 *
 * 「長軸 / 短軸」用 bbox 比較推:短軸 = 主支方向(每根長度),長軸 = 主支排列方向。
 * 對齊 lib/raised-floor/geometry.ts 的 shortAlongX 規則。
 *
 * 圖層由下而上(對應 explode 0..1 把各層往上拉開 EXPLODE_BASE_CM=30cm):
 *   legs     — 4 角+中段腳柱(0..heightCm,不爆)
 *   frame    — 邊框角材(× 1)
 *   main     — 主支(× 2)
 *   sub      — 副支(× 3)
 *   plywood  — 夾板(× 4)
 *   plank    — 面材(× 5)
 *
 * frameloop="always"(對齊 [[feedback-frameloop-demand-invalidate]] iOS scroll 安全)。
 */

import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, OrthographicCamera } from "@react-three/drei";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { RaisedFloorBom } from "./types";
import { boundingBox } from "@/lib/floor/geometry";

export type LayerKey =
  | "legs"
  | "frameTop"
  | "frameBottom"
  | "mainTop"
  | "mainBottom"
  | "sub"
  | "plywood"
  | "plank";

export type ViewMode = "iso" | "top";

interface RaisedFloorScene3DProps {
  bom: RaisedFloorBom;
  viewMode: ViewMode;
  explode: number; // 0..1
  layers: Record<LayerKey, boolean>;
}

const EXPLODE_BASE_CM = 30;
const LEG_CROSS_CM = 6;       // 視覺腳柱斷面(2 寸角材實寬 5.5,圓整 6 cm 視覺)
const PLANK_THICK_CM = 1.2;   // 超耐磨面材厚度 ~12 mm
const LEG_MAX_SPACING_CM = 80;

// ─────────────────────────────────────────────────────────
// 多邊形幾何工具(平台 polygon 都是軸向正交,挨柱挖洞也是正交矩形)
// ─────────────────────────────────────────────────────────
type Pt = { x: number; y: number };

function pointInPolygon(px: number, py: number, verts: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = verts.length - 1; i < verts.length; j = i++) {
    const xi = verts[i].x;
    const yi = verts[i].y;
    const xj = verts[j].x;
    const yj = verts[j].y;
    const intersect =
      yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * 把一條軸向線段(axis=horizontal → 沿 X 跑,fixedCoord = polygon.y;
 * axis=vertical → 沿 Y 跑,fixedCoord = polygon.x)依 polygon 切成「內部」區段。
 * 回傳 [start, end] 區間陣列。
 */
function clipSegmentToPolygon(
  axis: "horizontal" | "vertical",
  fixedCoord: number,
  rangeStart: number,
  rangeEnd: number,
  verts: Pt[],
): Array<[number, number]> {
  if (verts.length < 3) return [];
  const crossings: number[] = [];
  for (let i = 0; i < verts.length; i++) {
    const a = verts[i];
    const b = verts[(i + 1) % verts.length];
    if (axis === "horizontal") {
      // 邊跨越 y=fixedCoord(用半開區間避開頂點重複計數)
      const aBelow = a.y <= fixedCoord;
      const bBelow = b.y <= fixedCoord;
      if (aBelow !== bBelow) {
        const t = (fixedCoord - a.y) / (b.y - a.y);
        crossings.push(a.x + t * (b.x - a.x));
      }
    } else {
      const aLeft = a.x <= fixedCoord;
      const bLeft = b.x <= fixedCoord;
      if (aLeft !== bLeft) {
        const t = (fixedCoord - a.x) / (b.x - a.x);
        crossings.push(a.y + t * (b.y - a.y));
      }
    }
  }
  crossings.sort((p, q) => p - q);
  const intervals: Array<[number, number]> = [];
  for (let i = 0; i + 1 < crossings.length; i += 2) {
    const lo = Math.max(crossings[i], rangeStart);
    const hi = Math.min(crossings[i + 1], rangeEnd);
    if (hi - lo > 0.1) intervals.push([lo, hi]);
  }
  return intervals;
}

/** signed area > 0 → CCW;<0 → CW */
function polygonSignedArea(verts: Pt[]): number {
  let s = 0;
  for (let i = 0; i < verts.length; i++) {
    const a = verts[i];
    const b = verts[(i + 1) % verts.length];
    s += a.x * b.y - b.x * a.y;
  }
  return s / 2;
}

const COLOR = {
  leg: "#71717a",
  frame: "#a16207",
  main: "#d97706",
  sub: "#71717a",
  plywood: "#e7e5e4",
  plank: "#d4a373",
} as const;

export function RaisedFloorScene3D({
  bom,
  viewMode,
  explode,
  layers,
}: RaisedFloorScene3DProps) {
  const { input, platform, trace } = bom;

  const bb = boundingBox(platform);
  const W = bb.maxX - bb.minX; // = input.widthCm(polygon X span)
  const D = bb.maxY - bb.minY; // = input.depthCm(polygon Z span)
  // 主支(也用於頂框/底框)與副支可不同斷面
  const mainTt = input.mainJoist.thicknessMm / 10;
  const mainTw = input.mainJoist.widthMm / 10;
  const subTt = input.subJoist.thicknessMm / 10;
  const subTw = input.subJoist.widthMm / 10;
  const plyT = input.plywood.thicknessMm / 10;
  const plankT = PLANK_THICK_CM;
  const heightCm = input.heightCm;

  // ─── 長 / 短軸方向(對齊 geometry.ts shortAlongX 規則)──
  // shortAlongX=true → 角材沿 X 走(每根長 = W),主支沿 Z 排列(長軸 = Z = depthCm)
  // shortAlongX=false → 角材沿 Z 走(每根長 = D),主支沿 X 排列(長軸 = X = widthCm)
  const shortAlongX = W <= D;
  const shortSpan = shortAlongX ? W : D;

  // ─── 各層 Y 位置(中心)──
  // 平台底 Y=0、頂面 Y=heightCm
  // 角材(邊框/主支/副支)上表面 = heightCm → 角材中心 = heightCm - tt/2
  // 副支稍微在主支下方(差 0.5cm)同 ceiling 慣例
  // 底框 + 底主支(只在有內柱的那排)貼地;
  // 腳柱站在底框/底主支頂面(Y=mainTt);頂框/主支貼頂、副支在主支下方。
  const yBottomFrameCenter = mainTt / 2;
  const yBottomMainCenter = mainTt / 2;
  const yLegCenter = (mainTt + (heightCm - mainTt)) / 2;
  const yFrameCenter = heightCm - mainTt / 2;
  const yMainCenter = heightCm - mainTt / 2;
  const ySubCenter = heightCm - mainTt - subTt / 2 - 0.1;
  const yPlywoodCenter = heightCm + plyT / 2;
  const yPlankCenter = heightCm + plyT + plankT / 2;
  const legBodyHeight = Math.max(0, heightCm - 2 * mainTt);

  // ─── 爆炸偏移(由下而上往上拉開)──
  const eo = {
    bottomFrame: 0, // 不爆(地面那層當基準)
    bottomMain: 0,  // 跟底框同層,不爆
    legs: 0, // 不爆
    frame: explode * EXPLODE_BASE_CM * 1,
    main: explode * EXPLODE_BASE_CM * 2,
    sub: explode * EXPLODE_BASE_CM * 3,
    plywood: explode * EXPLODE_BASE_CM * 4,
    plank: explode * EXPLODE_BASE_CM * 5,
  };

  // 平台 bbox 中心(把場景移到原點)
  const cx = W / 2;
  const cz = D / 2;

  // 把 polygon vertices 平移到 bbox-local 座標(0..W, 0..D),
  // 給 plank/plywood 的 ExtrudeGeometry 使用,讓 L 形 / 挨柱挖洞反映在 3D。
  const platformVerts = useMemo(
    () => platform.vertices.map((p) => ({ x: p.x - bb.minX, y: p.y - bb.minY })),
    [platform.vertices, bb.minX, bb.minY]
  );

  // 腳柱 grid 的內部 X / Z 位置(去掉周邊 i=0 / i=last 那一圈);
  // 底主支只畫在「有內柱」的那一排(沿主支方向跨,承一整排內柱)。
  const interiorLegLines = useMemo(() => {
    const legCountX = Math.max(2, Math.ceil(W / LEG_MAX_SPACING_CM) + 1);
    const legCountZ = Math.max(2, Math.ceil(D / LEG_MAX_SPACING_CM) + 1);
    const innerXs: number[] = [];
    const innerZs: number[] = [];
    for (let i = 1; i < legCountX - 1; i++) {
      innerXs.push((i * W) / (legCountX - 1));
    }
    for (let j = 1; j < legCountZ - 1; j++) {
      innerZs.push((j * D) / (legCountZ - 1));
    }
    return { innerXs, innerZs };
  }, [W, D]);
  // shortAlongX=true → 主支沿 X 跑、c 在 Z;底主支取內柱 Z 排
  // shortAlongX=false → 主支沿 Z 跑、c 在 X;底主支取內柱 X 排
  const bottomMainCenters = shortAlongX
    ? interiorLegLines.innerZs
    : interiorLegLines.innerXs;

  // ortho 攝影機 frustum 推算 — 架高高度通常小(30cm vs 平台 300+cm)
  // 要乘 4 才會在 iso 視角能看見高度;對齊 spec
  const maxDim = Math.max(W, D, heightCm * 4);

  return (
    <div className="w-full h-[30vh] sm:h-[520px] sm:max-h-[70vh]">
      <Canvas
        className="bg-amber-50/30 rounded border border-zinc-200"
        style={{ width: "100%", height: "100%" }}
        shadows={false}
        frameloop="always"
        dpr={[1, 1.5]}
      >
        <CameraRig viewMode={viewMode} maxDim={maxDim} />
        <ambientLight intensity={0.7} />
        <directionalLight position={[W, 400, D]} intensity={0.6} />

        <group position={[-cx, 0, -cz]}>
          {/* ────── 底框(腳柱底下承重)────── */}
          {layers.frameBottom && (
            <FrameLayer
              vertices={platformVerts}
              tw={mainTw}
              tt={mainTt}
              yCenter={yBottomFrameCenter + eo.bottomFrame}
            />
          )}

          {/* ────── 底主支(只畫在「有內柱」的那排,承重用)────── */}
          {layers.mainBottom && bottomMainCenters.length > 0 && (
            <MainJoistsLayer
              W={W}
              D={D}
              tw={mainTw}
              tt={mainTt}
              shortAlongX={shortAlongX}
              vertices={platformVerts}
              mainCenters={bottomMainCenters}
              yCenter={yBottomMainCenter + eo.bottomMain}
            />
          )}

          {/* ────── 腳柱 ────── */}
          {layers.legs && (
            <LegsLayer
              W={W}
              D={D}
              vertices={platformVerts}
              heightCm={legBodyHeight}
              yCenter={yLegCenter + eo.legs}
            />
          )}

          {/* ────── 頂框 ────── */}
          {layers.frameTop && (
            <FrameLayer
              vertices={platformVerts}
              tw={mainTw}
              tt={mainTt}
              yCenter={yFrameCenter + eo.frame}
            />
          )}

          {/* ────── 頂主支 ────── */}
          {layers.mainTop && (
            <MainJoistsLayer
              W={W}
              D={D}
              tw={mainTw}
              tt={mainTt}
              shortAlongX={shortAlongX}
              vertices={platformVerts}
              mainCenters={trace.mainJoistCentersCm}
              yCenter={yMainCenter + eo.main}
            />
          )}

          {/* ────── 副支 ────── */}
          {layers.sub && (
            <SubJoistsLayer
              W={W}
              D={D}
              tw={subTw}
              tt={subTt}
              frameTw={mainTw}
              shortAlongX={shortAlongX}
              shortSpan={shortSpan}
              vertices={platformVerts}
              subJoistSpacingCm={input.subJoistSpacingCm}
              plywoodLongCm={input.plywood.sheetWidthCm}
              yCenter={ySubCenter + eo.sub}
            />
          )}

          {/* ────── 夾板 ────── */}
          {layers.plywood && (
            <PlywoodLayer
              vertices={platformVerts}
              plyT={plyT}
              yCenter={yPlywoodCenter + eo.plywood}
            />
          )}

          {/* ────── 面材 ────── */}
          {layers.plank && (
            <PlankLayer
              vertices={platformVerts}
              plankT={plankT}
              yCenter={yPlankCenter + eo.plank}
            />
          )}
        </group>

        <OrbitControls
          enablePan
          enableZoom
          enableRotate={viewMode === "iso"}
          target={[0, heightCm / 2, 0]}
        />
      </Canvas>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// 攝影機 — 軸測 / 俯視(完整對標 ceiling CameraRig)
// ─────────────────────────────────────────────────────────
function CameraRig({
  viewMode,
  maxDim,
}: {
  viewMode: ViewMode;
  maxDim: number;
}) {
  const camRef = useRef<THREE.OrthographicCamera>(null);
  const { size } = useThree();
  const minSide = Math.min(size.width, size.height);
  const zoom = (minSide * (viewMode === "iso" ? 1.0 : 0.85)) / Math.max(maxDim, 1);
  const dist = maxDim * 1.5;
  const position: [number, number, number] =
    viewMode === "iso" ? [dist, dist, dist] : [0, dist * 1.2, 0.001];

  return (
    <OrthographicCamera
      ref={camRef}
      makeDefault
      position={position}
      zoom={zoom}
      near={-dist * 3}
      far={dist * 3}
    />
  );
}


// ─────────────────────────────────────────────────────────
// 腳柱 — 4 角 + 中段每 ≤80cm 補一根(bbox 簡化)
// ─────────────────────────────────────────────────────────
function LegsLayer({
  W,
  D,
  vertices,
  heightCm,
  yCenter,
}: {
  W: number;
  D: number;
  vertices: Pt[];
  heightCm: number;
  yCenter: number;
}) {
  const positions = useMemo(() => {
    const legCountX = Math.max(2, Math.ceil(W / LEG_MAX_SPACING_CM) + 1);
    const legCountZ = Math.max(2, Math.ceil(D / LEG_MAX_SPACING_CM) + 1);
    const xs: number[] = [];
    const zs: number[] = [];
    for (let i = 0; i < legCountX; i++) {
      xs.push((i * W) / (legCountX - 1));
    }
    for (let j = 0; j < legCountZ; j++) {
      zs.push((j * D) / (legCountZ - 1));
    }
    const out: Array<[number, number]> = [];
    // 內部 grid:挨柱挖空處跳過。用點稍微往內縮 0.1cm 避開邊界誤判。
    const EPS = 0.1;
    for (const x of xs) {
      for (const z of zs) {
        const xi = Math.max(EPS, Math.min(W - EPS, x));
        const zi = Math.max(EPS, Math.min(D - EPS, z));
        if (pointInPolygon(xi, zi, vertices)) out.push([x, z]);
      }
    }
    // 加 polygon 頂點(L 形 / 挨柱新角)的腳柱,確保每個角都有支撐
    for (const v of vertices) {
      const dup = out.some(
        ([x, z]) => Math.abs(x - v.x) < 1 && Math.abs(z - v.y) < 1,
      );
      if (!dup) out.push([v.x, v.y]);
    }
    return out;
  }, [W, D, vertices]);

  return (
    <group position={[0, yCenter, 0]}>
      {positions.map(([x, z], i) => (
        <mesh key={i} position={[x, 0, z]}>
          <boxGeometry args={[LEG_CROSS_CM, heightCm, LEG_CROSS_CM]} />
          <meshStandardMaterial color={COLOR.leg} />
        </mesh>
      ))}
    </group>
  );
}

// ─────────────────────────────────────────────────────────
// 邊框 — 沿 polygon 每條邊鋪一根角材(L 形 / 挨柱自動跟形)
// 平台 polygon 都是軸向正交,每邊不是水平就是垂直,beam 用 boxGeometry 即可。
// 「往內」方向用 CCW 法向(左手邊),所以先正規化成 CCW。
// ─────────────────────────────────────────────────────────
function FrameLayer({
  vertices,
  tw,
  tt,
  yCenter,
}: {
  vertices: Pt[];
  tw: number;
  tt: number;
  yCenter: number;
}) {
  const beams = useMemo(() => {
    const verts =
      polygonSignedArea(vertices) < 0 ? [...vertices].reverse() : vertices;
    const out: Array<{
      cx: number;
      cz: number;
      lenX: number;
      lenZ: number;
    }> = [];
    for (let i = 0; i < verts.length; i++) {
      const a = verts[i];
      const b = verts[(i + 1) % verts.length];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy);
      if (len < 0.1) continue;
      const ux = dx / len;
      const uy = dy / len;
      // CCW 左法向(往 polygon 內部)
      const nx = -uy;
      const ny = ux;
      // beam 中心 = 邊中點 + 法向 × tw/2
      const cx = (a.x + b.x) / 2 + (nx * tw) / 2;
      const cz = (a.y + b.y) / 2 + (ny * tw) / 2;
      const horiz = Math.abs(uy) < 0.01; // 邊沿 X 跑
      out.push({
        cx,
        cz,
        lenX: horiz ? len : tw,
        lenZ: horiz ? tw : len,
      });
    }
    return out;
  }, [vertices, tw]);

  return (
    <group position={[0, yCenter, 0]}>
      {beams.map((b, i) => (
        <mesh key={i} position={[b.cx, 0, b.cz]}>
          <boxGeometry args={[b.lenX, tt, b.lenZ]} />
          <meshStandardMaterial color={COLOR.frame} />
        </mesh>
      ))}
    </group>
  );
}

// ─────────────────────────────────────────────────────────
// 主支 — 沿短軸跨,長軸排列(mainCenters 給位置);依 polygon 切段避開挨柱
// ─────────────────────────────────────────────────────────
function MainJoistsLayer({
  W,
  D,
  tw,
  tt,
  shortAlongX,
  vertices,
  mainCenters,
  yCenter,
}: {
  W: number;
  D: number;
  tw: number;
  tt: number;
  shortAlongX: boolean;
  vertices: Pt[];
  mainCenters: number[];
  yCenter: number;
}) {
  const segments = useMemo(() => {
    const out: Array<{ c: number; lo: number; hi: number }> = [];
    for (const c of mainCenters) {
      // shortAlongX=true → 主支沿 X 跑,c 是 z;clip horizontal segment at y=c (polygon coord),x range = [tw, W-tw]
      // shortAlongX=false → 主支沿 Z 跑,c 是 x;clip vertical at x=c, y range = [tw, D-tw]
      const intervals = shortAlongX
        ? clipSegmentToPolygon("horizontal", c, tw, W - tw, vertices)
        : clipSegmentToPolygon("vertical", c, tw, D - tw, vertices);
      for (const [lo, hi] of intervals) out.push({ c, lo, hi });
    }
    return out;
  }, [shortAlongX, mainCenters, vertices, tw, W, D]);

  return (
    <group position={[0, yCenter, 0]}>
      {segments.map((s, idx) => {
        const len = s.hi - s.lo;
        const mid = (s.lo + s.hi) / 2;
        if (shortAlongX) {
          return (
            <mesh key={idx} position={[mid, 0, s.c]}>
              <boxGeometry args={[len, tt, tw]} />
              <meshStandardMaterial color={COLOR.main} />
            </mesh>
          );
        }
        return (
          <mesh key={idx} position={[s.c, 0, mid]}>
            <boxGeometry args={[tw, tt, len]} />
            <meshStandardMaterial color={COLOR.main} />
          </mesh>
        );
      })}
    </group>
  );
}

// ─────────────────────────────────────────────────────────
// 副支 — 沿長軸方向跑(垂直主支),每 sub-row 位置依 polygon 切段避開挨柱
// ─────────────────────────────────────────────────────────
function SubJoistsLayer({
  W,
  D,
  tw,
  tt,
  frameTw,
  shortAlongX,
  shortSpan,
  vertices,
  subJoistSpacingCm,
  plywoodLongCm,
  yCenter,
}: {
  W: number;
  D: number;
  tw: number;
  tt: number;
  frameTw: number;
  shortAlongX: boolean;
  shortSpan: number;
  vertices: Pt[];
  subJoistSpacingCm: number;
  plywoodLongCm: number;
  yCenter: number;
}) {
  const segments = useMemo(() => {
    // 副支對齊夾板接縫(以 plywoodLongCm/N 為間距,從 0 起算)
    const target = Math.max(subJoistSpacingCm, 10);
    const aligned =
      plywoodLongCm > 0
        ? plywoodLongCm / Math.max(2, Math.round(plywoodLongCm / target))
        : target;
    const subCenters: number[] = [];
    let pos = aligned;
    while (pos < shortSpan - 0.5) {
      subCenters.push(pos);
      pos += aligned;
    }
    const out: Array<{ c: number; lo: number; hi: number }> = [];
    for (const sc of subCenters) {
      // 副支內側 clip 用「邊框寬」(frameTw=mainTw)而非自身寬,避免副支比主支細時跑出框外
      const intervals = shortAlongX
        ? clipSegmentToPolygon("vertical", sc, frameTw, D - frameTw, vertices)
        : clipSegmentToPolygon("horizontal", sc, frameTw, W - frameTw, vertices);
      for (const [lo, hi] of intervals) out.push({ c: sc, lo, hi });
    }
    return out;
  }, [shortAlongX, shortSpan, subJoistSpacingCm, plywoodLongCm, vertices, frameTw, W, D]);

  return (
    <group position={[0, yCenter, 0]}>
      {segments.map((s, i) => {
        const len = s.hi - s.lo;
        const mid = (s.lo + s.hi) / 2;
        if (shortAlongX) {
          // 副支沿 Z 跑,c 是 x
          return (
            <mesh key={i} position={[s.c, 0, mid]}>
              <boxGeometry args={[tw, tt * 0.85, len]} />
              <meshStandardMaterial color={COLOR.sub} />
            </mesh>
          );
        }
        return (
          <mesh key={i} position={[mid, 0, s.c]}>
            <boxGeometry args={[len, tt * 0.85, tw]} />
            <meshStandardMaterial color={COLOR.sub} />
          </mesh>
        );
      })}
    </group>
  );
}

// ─────────────────────────────────────────────────────────
// 用 platform polygon 建一個 ExtrudeGeometry,實際反映 L 形 / 挨柱挖洞。
// vertices 是 bbox-local(0..W, 0..D),polygon.y → world Z。
// 拉伸方向預設沿 +Z(THREE.Shape 在 XY 平面),mesh 用 rotation [-π/2, 0, 0] 攤到 XZ,
// 厚度 thickness 沿世界 Y。
// ─────────────────────────────────────────────────────────
function PlatformExtrudeMesh({
  vertices,
  thickness,
  color,
}: {
  vertices: { x: number; y: number }[];
  thickness: number;
  color: string;
}) {
  const { geometry, edgesGeom } = useMemo(() => {
    // geometry.ts 產出順時針(CW)頂點,但 THREE.Shape / earcut 期望 CCW
    // 才會生出朝外的正面三角形。檢測 signed area 決定是否反轉。
    let area = 0;
    for (let i = 0; i < vertices.length; i++) {
      const a = vertices[i];
      const b = vertices[(i + 1) % vertices.length];
      area += a.x * b.y - b.x * a.y;
    }
    const verts = area < 0 ? [...vertices].reverse() : vertices;

    const shape = new THREE.Shape();
    if (verts.length > 0) {
      shape.moveTo(verts[0].x, verts[0].y);
      for (let i = 1; i < verts.length; i++) {
        shape.lineTo(verts[i].x, verts[i].y);
      }
      shape.closePath();
    }
    const g = new THREE.ExtrudeGeometry(shape, {
      depth: thickness,
      bevelEnabled: false,
    });
    // 讓 slab 中心對齊 parent group 的 Y=0
    g.translate(0, 0, -thickness / 2);
    const e = new THREE.EdgesGeometry(g);
    return { geometry: g, edgesGeom: e };
  }, [vertices, thickness]);

  return (
    <group rotation={[Math.PI / 2, 0, 0]}>
      <mesh>
        <primitive object={geometry} attach="geometry" />
        <meshStandardMaterial color={color} side={THREE.DoubleSide} />
      </mesh>
      <lineSegments>
        <primitive object={edgesGeom} attach="geometry" />
        <lineBasicMaterial color="#52525b" />
      </lineSegments>
    </group>
  );
}

// ─────────────────────────────────────────────────────────
// 夾板 — 依平台多邊形 extrude(含 L 形/挨柱);
// 沿 X/Z 的拼接縫在 2D「拼花」tab 看,3D 簡化成整層。
// ─────────────────────────────────────────────────────────
function PlywoodLayer({
  vertices,
  plyT,
  yCenter,
}: {
  vertices: { x: number; y: number }[];
  plyT: number;
  yCenter: number;
}) {
  return (
    <group position={[0, yCenter, 0]}>
      <PlatformExtrudeMesh
        vertices={vertices}
        thickness={plyT}
        color={COLOR.plywood}
      />
    </group>
  );
}

// ─────────────────────────────────────────────────────────
// 面材 — 依平台多邊形 extrude(含 L 形/挨柱);條寬細節留給 2D 拼花 tab。
// ─────────────────────────────────────────────────────────
function PlankLayer({
  vertices,
  plankT,
  yCenter,
}: {
  vertices: { x: number; y: number }[];
  plankT: number;
  yCenter: number;
}) {
  return (
    <group position={[0, yCenter, 0]}>
      <PlatformExtrudeMesh
        vertices={vertices}
        thickness={plankT}
        color={COLOR.plank}
      />
    </group>
  );
}
