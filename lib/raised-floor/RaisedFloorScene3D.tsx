"use client";

/**
 * 和室架高平台 — R3F 3D 場景含爆炸圖
 *
 * 對標 lib/ceiling/CeilingScene3D.tsx 的 5 圖層架構,擴增到 7 圖層。
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
 *   ground   — 平台真實多邊形 footprint(顯 L 形 / 挨柱挖空,Y=0)
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
  | "ground"
  | "legs"
  | "frame"
  | "main"
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

const COLOR = {
  ground: "#fef3c7",     // 地面 footprint 淡黃
  groundEdge: "#a16207",
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
  const tt = input.joist.thicknessMm / 10; // 角材厚(高度 Y 方向)
  const tw = input.joist.widthMm / 10;     // 角材寬(俯視寬度)
  const plyT = input.plywood.thicknessMm / 10;
  const plankT = PLANK_THICK_CM;
  const heightCm = input.heightCm;
  const plankW = input.plankWidthCm;

  // ─── 長 / 短軸方向(對齊 geometry.ts shortAlongX 規則)──
  // shortAlongX=true → 角材沿 X 走(每根長 = W),主支沿 Z 排列(長軸 = Z = depthCm)
  // shortAlongX=false → 角材沿 Z 走(每根長 = D),主支沿 X 排列(長軸 = X = widthCm)
  const shortAlongX = W <= D;
  const longSpan = shortAlongX ? D : W;
  const shortSpan = shortAlongX ? W : D;

  // ─── 各層 Y 位置(中心)──
  // 平台底 Y=0、頂面 Y=heightCm
  // 角材(邊框/主支/副支)上表面 = heightCm → 角材中心 = heightCm - tt/2
  // 副支稍微在主支下方(差 0.5cm)同 ceiling 慣例
  const yLegCenter = heightCm / 2;
  const yFrameCenter = heightCm - tt / 2;
  const yMainCenter = heightCm - tt / 2;
  const ySubCenter = heightCm - tt / 2 - 0.5;
  const yPlywoodCenter = heightCm + plyT / 2;
  const yPlankCenter = heightCm + plyT + plankT / 2;

  // ─── 爆炸偏移(由下而上往上拉開)──
  const eo = {
    ground: 0,
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
          {/* ────── 平台真實 footprint(L 形 / 挨柱挖空) ────── */}
          {layers.ground && (
            <GroundLayer
              vertices={platform.vertices}
              yCenter={0.01}
            />
          )}

          {/* ────── 腳柱 ────── */}
          {layers.legs && (
            <LegsLayer
              W={W}
              D={D}
              heightCm={heightCm}
              yCenter={yLegCenter + eo.legs}
            />
          )}

          {/* ────── 邊框 ────── */}
          {layers.frame && (
            <FrameLayer
              W={W}
              D={D}
              tw={tw}
              tt={tt}
              yCenter={yFrameCenter + eo.frame}
            />
          )}

          {/* ────── 主支 ────── */}
          {layers.main && (
            <MainJoistsLayer
              W={W}
              D={D}
              tw={tw}
              tt={tt}
              shortAlongX={shortAlongX}
              shortSpan={shortSpan}
              mainCenters={trace.mainJoistCentersCm}
              yCenter={yMainCenter + eo.main}
            />
          )}

          {/* ────── 副支 ────── */}
          {layers.sub && (
            <SubJoistsLayer
              W={W}
              D={D}
              tw={tw}
              tt={tt}
              shortAlongX={shortAlongX}
              shortSpan={shortSpan}
              longSpan={longSpan}
              mainCenters={trace.mainJoistCentersCm}
              subJoistSpacingCm={input.subJoistSpacingCm}
              yCenter={ySubCenter + eo.sub}
            />
          )}

          {/* ────── 夾板 ────── */}
          {layers.plywood && (
            <PlywoodLayer
              W={W}
              D={D}
              sheetLengthCm={input.plywood.sheetLengthCm}
              sheetWidthCm={input.plywood.sheetWidthCm}
              plyT={plyT}
              yCenter={yPlywoodCenter + eo.plywood}
            />
          )}

          {/* ────── 面材 ────── */}
          {layers.plank && (
            <PlankLayer
              W={W}
              D={D}
              plankW={plankW}
              plankT={plankT}
              shortAlongX={shortAlongX}
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
// 地面 footprint — 用 THREE.Shape 畫真實多邊形(顯 L / 挨柱)
// ─────────────────────────────────────────────────────────
function GroundLayer({
  vertices,
  yCenter,
}: {
  vertices: { x: number; y: number }[];
  yCenter: number;
}) {
  const { geometry, edgesGeom } = useMemo(() => {
    const shape = new THREE.Shape();
    if (vertices.length > 0) {
      // polygon (x, y) → XZ 平面(z 來自 polygon.y);
      // THREE.Shape 在自己的 2D 平面上(x, y),mesh 用 rotation 攤平到 XZ
      shape.moveTo(vertices[0].x, vertices[0].y);
      for (let i = 1; i < vertices.length; i++) {
        shape.lineTo(vertices[i].x, vertices[i].y);
      }
      shape.closePath();
    }
    const g = new THREE.ShapeGeometry(shape);
    const e = new THREE.EdgesGeometry(g);
    return { geometry: g, edgesGeom: e };
  }, [vertices]);

  return (
    <group position={[0, yCenter, 0]}>
      {/* shape XY 平面 → rotate -90° 繞 X,變成 XZ 平面;再翻 Z 鏡像對齊 polygon y→world Z */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <primitive object={geometry} attach="geometry" />
        <meshStandardMaterial
          color={COLOR.ground}
          side={THREE.DoubleSide}
          transparent
          opacity={0.7}
        />
      </mesh>
      <lineSegments rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <primitive object={edgesGeom} attach="geometry" />
        <lineBasicMaterial color={COLOR.groundEdge} />
      </lineSegments>
    </group>
  );
}

// ─────────────────────────────────────────────────────────
// 腳柱 — 4 角 + 中段每 ≤80cm 補一根(bbox 簡化)
// ─────────────────────────────────────────────────────────
function LegsLayer({
  W,
  D,
  heightCm,
  yCenter,
}: {
  W: number;
  D: number;
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
    for (const x of xs) for (const z of zs) out.push([x, z]);
    if (typeof console !== "undefined") {
      console.log(
        `[RaisedFloor3D] legs grid ${legCountX} × ${legCountZ} = ${out.length} pcs`,
      );
    }
    return out;
  }, [W, D]);

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
// 邊框 — 4 條角材圍 bbox(對標 ceiling FrameLayer)
// ─────────────────────────────────────────────────────────
function FrameLayer({
  W,
  D,
  tw,
  tt,
  yCenter,
}: {
  W: number;
  D: number;
  tw: number;
  tt: number;
  yCenter: number;
}) {
  return (
    <group position={[0, yCenter, 0]}>
      {/* 沿 X 兩條(前後)*/}
      <mesh position={[W / 2, 0, tw / 2]}>
        <boxGeometry args={[W, tt, tw]} />
        <meshStandardMaterial color={COLOR.frame} />
      </mesh>
      <mesh position={[W / 2, 0, D - tw / 2]}>
        <boxGeometry args={[W, tt, tw]} />
        <meshStandardMaterial color={COLOR.frame} />
      </mesh>
      {/* 沿 Z 兩條(左右)*/}
      <mesh position={[tw / 2, 0, D / 2]}>
        <boxGeometry args={[tw, tt, D]} />
        <meshStandardMaterial color={COLOR.frame} />
      </mesh>
      <mesh position={[W - tw / 2, 0, D / 2]}>
        <boxGeometry args={[tw, tt, D]} />
        <meshStandardMaterial color={COLOR.frame} />
      </mesh>
    </group>
  );
}

// ─────────────────────────────────────────────────────────
// 主支 — 沿短軸跨,長軸排列(mainCenters 給位置)
// ─────────────────────────────────────────────────────────
function MainJoistsLayer({
  W,
  D,
  tw,
  tt,
  shortAlongX,
  shortSpan,
  mainCenters,
  yCenter,
}: {
  W: number;
  D: number;
  tw: number;
  tt: number;
  shortAlongX: boolean;
  shortSpan: number;
  mainCenters: number[];
  yCenter: number;
}) {
  // 每根長度 = 短軸寬 - 2*frameW(扣邊框)
  const joistLength = Math.max(0, shortSpan - 2 * tw);

  return (
    <group position={[0, yCenter, 0]}>
      {mainCenters.map((c, idx) => {
        if (shortAlongX) {
          // 主支沿 X 跨(長度方向=X),沿 Z 排列(c 在 Z)
          return (
            <mesh key={idx} position={[W / 2, 0, c]}>
              <boxGeometry args={[joistLength, tt, tw]} />
              <meshStandardMaterial color={COLOR.main} />
            </mesh>
          );
        } else {
          // 主支沿 Z 跨,沿 X 排列(c 在 X)
          return (
            <mesh key={idx} position={[c, 0, D / 2]}>
              <boxGeometry args={[tw, tt, joistLength]} />
              <meshStandardMaterial color={COLOR.main} />
            </mesh>
          );
        }
      })}
    </group>
  );
}

// ─────────────────────────────────────────────────────────
// 副支 — 每 slot 內,沿長軸方向短段(垂直主支)
// ─────────────────────────────────────────────────────────
function SubJoistsLayer({
  W,
  D,
  tw,
  tt,
  shortAlongX,
  shortSpan,
  longSpan,
  mainCenters,
  subJoistSpacingCm,
  yCenter,
}: {
  W: number;
  D: number;
  tw: number;
  tt: number;
  shortAlongX: boolean;
  shortSpan: number;
  longSpan: number;
  mainCenters: number[];
  subJoistSpacingCm: number;
  yCenter: number;
}) {
  const items = useMemo(() => {
    // slot 邊界沿長軸:[frameW, ...mainCenters, longSpan - frameW]
    const boundaries = [tw, ...mainCenters, longSpan - tw];
    const spacing = Math.max(subJoistSpacingCm, 1);

    // 副支沿短軸排列(每 spacing 一根),每根長度 = slot 寬
    const subRows = Math.max(0, Math.floor(shortSpan / spacing));
    const subCenters: number[] = [];
    for (let i = 1; i <= subRows; i++) {
      subCenters.push((i * shortSpan) / (subRows + 1));
    }

    const out: Array<{ axisLongCenter: number; axisLongLength: number; axisShortCenter: number }> = [];
    for (let s = 0; s + 1 < boundaries.length; s++) {
      const lo = boundaries[s];
      const hi = boundaries[s + 1];
      const slotWidth = hi - lo;
      if (slotWidth <= 0) continue;
      const slotCenter = (lo + hi) / 2;
      for (const sc of subCenters) {
        out.push({
          axisLongCenter: slotCenter,
          axisLongLength: slotWidth,
          axisShortCenter: sc,
        });
      }
    }
    return out;
  }, [tw, mainCenters, longSpan, subJoistSpacingCm, shortSpan]);

  // 副支「沿長軸方向跑」,跟主支垂直
  //   shortAlongX=true → 長軸 = Z → 副支長度沿 Z
  //   shortAlongX=false → 長軸 = X → 副支長度沿 X
  return (
    <group position={[0, yCenter, 0]}>
      {items.map((it, i) => {
        if (shortAlongX) {
          // 副支沿 Z 跑(長度),沿 X 排列;axisShortCenter 在 X,axisLongCenter 在 Z
          return (
            <mesh
              key={i}
              position={[it.axisShortCenter, 0, it.axisLongCenter]}
            >
              <boxGeometry args={[tw, tt * 0.85, it.axisLongLength]} />
              <meshStandardMaterial color={COLOR.sub} />
            </mesh>
          );
        } else {
          // 副支沿 X 跑;axisLongCenter 在 X,axisShortCenter 在 Z
          return (
            <mesh
              key={i}
              position={[it.axisLongCenter, 0, it.axisShortCenter]}
            >
              <boxGeometry args={[it.axisLongLength, tt * 0.85, tw]} />
              <meshStandardMaterial color={COLOR.sub} />
            </mesh>
          );
        }
      })}
    </group>
  );
}

// ─────────────────────────────────────────────────────────
// 夾板 — bbox 攤滿,單片 244×122 切片(沿 X 切 244, 沿 Z 切 122)
// ─────────────────────────────────────────────────────────
function PlywoodLayer({
  W,
  D,
  sheetLengthCm,
  sheetWidthCm,
  plyT,
  yCenter,
}: {
  W: number;
  D: number;
  sheetLengthCm: number;
  sheetWidthCm: number;
  plyT: number;
  yCenter: number;
}) {
  const sheets = useMemo(() => {
    const gap = 0.2;
    // 夾板長 244 沿 X、寬 122 沿 Z(預設 preset);
    // 跟 spec「沿 X 切:每片 244cm,沿 Z 切:每片 122cm」對齊
    const sheetLongX = sheetWidthCm;   // preset 預設 244
    const sheetShortZ = sheetLengthCm; // preset 預設 122

    const xEdges: number[] = [0];
    let x = sheetLongX;
    while (x < W) {
      xEdges.push(x);
      x += sheetLongX;
    }
    xEdges.push(W);

    const zEdges: number[] = [0];
    let z = sheetShortZ;
    while (z < D) {
      zEdges.push(z);
      z += sheetShortZ;
    }
    zEdges.push(D);

    const out: Array<{ cx: number; cz: number; w: number; d: number }> = [];
    for (let i = 0; i < xEdges.length - 1; i++) {
      const xL = xEdges[i];
      const xR = xEdges[i + 1];
      const w = xR - xL - gap;
      if (w <= 0) continue;
      for (let j = 0; j < zEdges.length - 1; j++) {
        const zL = zEdges[j];
        const zR = zEdges[j + 1];
        const d = zR - zL - gap;
        if (d <= 0) continue;
        out.push({
          cx: (xL + xR) / 2,
          cz: (zL + zR) / 2,
          w,
          d,
        });
      }
    }
    return out;
  }, [W, D, sheetLengthCm, sheetWidthCm]);

  return (
    <group position={[0, yCenter, 0]}>
      {sheets.map((s, i) => (
        <mesh key={i} position={[s.cx, 0, s.cz]}>
          <boxGeometry args={[s.w, plyT, s.d]} />
          <meshStandardMaterial color={COLOR.plywood} />
        </mesh>
      ))}
    </group>
  );
}

// ─────────────────────────────────────────────────────────
// 面材 — 偷懶整條版本,沿短軸排,每條長度 = bbox 長(沿長軸)
// ─────────────────────────────────────────────────────────
function PlankLayer({
  W,
  D,
  plankW,
  plankT,
  shortAlongX,
  yCenter,
}: {
  W: number;
  D: number;
  plankW: number;
  plankT: number;
  shortAlongX: boolean;
  yCenter: number;
}) {
  const planks = useMemo(() => {
    // 面材方向慣例:長邊沿長軸走;條寬 plankW 沿短軸排
    // shortAlongX=true → 長軸 = Z → 每條長度沿 Z = D,寬沿 X = plankW
    // shortAlongX=false → 長軸 = X → 每條長度沿 X = W,寬沿 Z = plankW
    const gap = 0.2;
    const span = shortAlongX ? W : D;
    const count = Math.max(1, Math.floor(span / plankW));
    const out: Array<{
      axisShortCenter: number;
      lengthX: number;
      lengthZ: number;
    }> = [];
    for (let i = 0; i < count; i++) {
      const sc = i * plankW + plankW / 2;
      if (shortAlongX) {
        out.push({
          axisShortCenter: sc, // X
          lengthX: plankW - gap,
          lengthZ: D,
        });
      } else {
        out.push({
          axisShortCenter: sc, // Z
          lengthX: W,
          lengthZ: plankW - gap,
        });
      }
    }
    return out;
  }, [W, D, plankW, shortAlongX]);

  return (
    <group position={[0, yCenter, 0]}>
      {planks.map((p, i) => {
        const cx = shortAlongX ? p.axisShortCenter : W / 2;
        const cz = shortAlongX ? D / 2 : p.axisShortCenter;
        return (
          <mesh key={i} position={[cx, 0, cz]}>
            <boxGeometry args={[p.lengthX, plankT, p.lengthZ]} />
            <meshStandardMaterial color={COLOR.plank} />
          </mesh>
        );
      })}
    </group>
  );
}
