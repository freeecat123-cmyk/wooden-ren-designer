"use client";

/**
 * 階段 3 — 木作天花板骨架 3D 場景(R3F)
 *
 * 座標慣例:
 *   X = 長邊方向(主支沿 X 排列)
 *   Y = 上(吊筋從 ceilingHeight 向上到 slabHeight)
 *   Z = 短邊方向(主支單支跨 Z)
 *   原點 = 房間中心, Y=0 為天花板完成面(=師傅站底下看上去的高度)
 *
 * 五層結構由 explode slider(0=合體 / 1=爆炸):
 *   layer 0 矽酸鈣板(底部)
 *   layer 1 副支
 *   layer 2 主支
 *   layer 3 邊框
 *   layer 4 吊筋(向上接樓板)
 *
 * 5 圖層 visibility toggle by props.
 * frameloop="always"(對齊 [[feedback-frameloop-demand-invalidate]] iOS scroll 安全)
 */

import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, OrthographicCamera } from "@react-three/drei";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { CeilingBom } from "./types";

export type LayerKey = "room" | "frame" | "main" | "sub" | "boards";
export type ViewMode = "iso" | "top";
export type Scene3DHighlight = "frame" | "main" | "sub" | "hanger" | "board" | null;

interface CeilingScene3DProps {
  bom: CeilingBom;
  viewMode: ViewMode;
  explode: number;        // 0..1
  layers: Record<LayerKey, boolean>;
  highlight?: Scene3DHighlight;
  /** 副支高亮時只亮特定長度,其他副支變淡 */
  subLengthFilter?: number | null;
  /** 矽酸鈣板高亮時只亮整張或裁切,其他變淡 */
  boardKindFilter?: "full" | "cut" | null;
}

const EXPLODE_BASE_CM = 30; // 每層爆炸間距(乘上 explode 0..1)

const COLOR = {
  frame: "#a16207",
  main: "#d97706",
  sub: "#71717a",
  hanger: "#475569",
  board: "#f5f5f4",
  boardEdge: "#a8a29e",
  roomFloor: "#e7e5e4",
  roomWall: "#cbd5e1",
} as const;

export function CeilingScene3D({ bom, viewMode, explode, layers, highlight = null, subLengthFilter = null, boardKindFilter = null }: CeilingScene3DProps) {
  const { input, trace } = bom;
  const dimOp = (key: Exclude<Scene3DHighlight, null>) =>
    highlight && highlight !== key ? 0.12 : 1;
  const L = input.longSideCm;
  const S = input.shortSideCm;
  const tw = input.timberWidthCm;     // 角材寬
  const tt = input.timberThicknessCm; // 角材厚(= 高度 Y 方向)
  const hangerH = input.slabHeightCm - input.ceilingHeightCm;
  const boardThickness = 0.9;         // cm,9 mm 矽酸鈣板

  // 各層 Y 位置(中心)— 天花板完成面 Y=0
  // 矽酸鈣板下緣 = Y=0(完成面),板上緣 = boardThickness
  // 角材(邊框/主支/副支)坐在板上緣,底部 = boardThickness
  // 吊筋 從角材上緣 = boardThickness + tt 向上到 hangerH
  const yBoardCenter = -boardThickness / 2;          // 板厚一半(在完成面下方,反方向)
  // Actually 板朝下 = 完成面 = Y=0,板向下延伸 → 板中心 = -boardThickness/2
  const yJoistCenter = boardThickness + tt / 2;      // 角材中心
  const yHangerCenter = boardThickness + tt + hangerH / 2;

  // 爆炸偏移(往上拉開,讓人看見每層)
  const explodeOffsets: Record<LayerKey | "hanger", number> = {
    boards: 0,
    sub: explode * EXPLODE_BASE_CM * 1,
    main: explode * EXPLODE_BASE_CM * 2,
    frame: explode * EXPLODE_BASE_CM * 3,
    hanger: explode * EXPLODE_BASE_CM * 4,
    room: 0,
  };

  // 視覺中心:把房間中心移到原點
  const cx = L / 2;
  const cz = S / 2;

  // 攝影機距離 — 房間最長維度 × 0.9 給 ortho frustum
  const maxDim = Math.max(L, S);

  return (
    <div className="w-full h-[38vh] sm:h-[520px] sm:max-h-[70vh]">
    <Canvas
      className="bg-amber-50/30 rounded border border-zinc-200"
      style={{ width: "100%", height: "100%" }}
      shadows={false}
      frameloop="always"
      dpr={[1, 1.5]}
    >
      <CameraRig viewMode={viewMode} maxDim={maxDim} />
      <ambientLight intensity={0.7} />
      <directionalLight position={[L, 400, S]} intensity={0.6} />

      <group position={[-cx, 0, -cz]}>
        {/* ────── 房間邊界(地板 + 4 牆 wireframe) ────── */}
        {layers.room && <RoomBoundary L={L} S={S} slabHeight={input.slabHeightCm} />}

        {/* ────── 矽酸鈣板(底層) ────── */}
        {layers.boards && (
          <BoardsLayer
            L={L}
            S={S}
            input={input}
            mainCenters={trace.mainJoistCentersCm}
            yCenter={yBoardCenter - explodeOffsets.boards}
            boardThickness={boardThickness}
            opacity={dimOp("board")}
            boardKindFilter={boardKindFilter}
          />
        )}

        {/* ────── 邊框角材 ────── */}
        {layers.frame && (
          <FrameLayer L={L} S={S} tw={tw} tt={tt} yCenter={yJoistCenter + explodeOffsets.frame} opacity={dimOp("frame")} />
        )}

        {/* ────── 主支角材 ────── */}
        {layers.main && (
          <MainJoistsLayer
            mainCenters={trace.mainJoistCentersCm}
            mainJoistLength={trace.mainJoistLengthCm}
            S={S}
            tw={tw}
            tt={tt}
            yCenter={yJoistCenter + explodeOffsets.main}
            frameDoublesAsSupport={input.frameDoublesAsSupport}
            L={L}
            opacity={dimOp("main")}
          />
        )}

        {/* ────── 副支角材 ────── */}
        {layers.sub && (
          <SubJoistsLayer
            trace={trace}
            tw={tw}
            tt={tt}
            yCenter={yJoistCenter + explodeOffsets.sub}
            opacity={dimOp("sub")}
            subLengthFilter={subLengthFilter}
          />
        )}

        {/* ────── 吊筋(永遠跟主支綁) ────── */}
        {layers.main && (
          <HangersLayer
            mainCenters={trace.mainJoistCentersCm}
            hangerPerJoist={trace.hangerPerMainJoist}
            mainJoistLength={trace.mainJoistLengthCm}
            S={S}
            tw={tw}
            tt={tt}
            hangerH={hangerH}
            yBase={boardThickness + tt}
            yCenter={boardThickness + tt + hangerH / 2 + explodeOffsets.hanger}
            opacity={dimOp("hanger")}
          />
        )}
      </group>

      <OrbitControls
        enablePan
        enableZoom
        enableRotate={viewMode === "iso"}
        target={[0, yJoistCenter, 0]}
      />
    </Canvas>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// 攝影機 — 軸測 / 俯視 切換
// ─────────────────────────────────────────────────────────
function CameraRig({ viewMode, maxDim }: { viewMode: ViewMode; maxDim: number }) {
  const camRef = useRef<THREE.OrthographicCamera>(null);
  // 依實際 canvas 尺寸算 zoom:
  //   - REF_DIM=550cm:對應預設房間(longSide 500)幾乎填滿白框
  //   - 小於 REF_DIM 的房間保持同一像素比,拖動只改房間比例不整體縮放
  //   - 大於 REF_DIM 才開始 fit-to-canvas 避免溢出
  // 取較短邊 × 0.48 留小頭呼吸,軸測比俯視多花對角空間再 × 0.85。
  const { size } = useThree();
  const minSide = Math.min(size.width, size.height);
  const baseRadius = minSide * 0.48;
  const REF_DIM = 550;
  const zoom =
    (baseRadius / Math.max(maxDim, REF_DIM)) * (viewMode === "iso" ? 0.85 : 1);
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
// 房間邊界 — 地板 + 4 牆 wireframe(到 slabHeight)
// ─────────────────────────────────────────────────────────
function RoomBoundary({ L, S, slabHeight }: { L: number; S: number; slabHeight: number }) {
  return (
    <group>
      {/* 地板(淺色面) */}
      <mesh position={[L / 2, -50, S / 2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[L, S]} />
        <meshStandardMaterial color={COLOR.roomFloor} side={THREE.DoubleSide} opacity={0.4} transparent />
      </mesh>
      {/* 4 面牆 wireframe 到樓板 */}
      <lineSegments position={[L / 2, slabHeight / 2 - 50, S / 2]}>
        <edgesGeometry args={[new THREE.BoxGeometry(L, slabHeight, S)]} />
        <lineBasicMaterial color={COLOR.roomWall} />
      </lineSegments>
    </group>
  );
}

// ─────────────────────────────────────────────────────────
// 邊框 — 4 條角材,圍住房間 perimeter
// ─────────────────────────────────────────────────────────
function FrameLayer({ L, S, tw, tt, yCenter, opacity = 1 }: { L: number; S: number; tw: number; tt: number; yCenter: number; opacity?: number }) {
  return (
    <group position={[0, yCenter, 0]}>
      <mesh position={[L / 2, 0, tw / 2]}>
        <boxGeometry args={[L, tt, tw]} />
        <meshStandardMaterial color={COLOR.frame} transparent opacity={opacity} />
      </mesh>
      <mesh position={[L / 2, 0, S - tw / 2]}>
        <boxGeometry args={[L, tt, tw]} />
        <meshStandardMaterial color={COLOR.frame} transparent opacity={opacity} />
      </mesh>
      <mesh position={[tw / 2, 0, S / 2]}>
        <boxGeometry args={[tw, tt, S]} />
        <meshStandardMaterial color={COLOR.frame} transparent opacity={opacity} />
      </mesh>
      <mesh position={[L - tw / 2, 0, S / 2]}>
        <boxGeometry args={[tw, tt, S]} />
        <meshStandardMaterial color={COLOR.frame} transparent opacity={opacity} />
      </mesh>
    </group>
  );
}

// ─────────────────────────────────────────────────────────
// 主支 — 沿 X 排列,每根跨 Z(短邊內側)
// ─────────────────────────────────────────────────────────
function MainJoistsLayer({
  mainCenters, mainJoistLength, S, tw, tt, yCenter, frameDoublesAsSupport, L, opacity = 1,
}: {
  mainCenters: number[];
  mainJoistLength: number;
  S: number;
  tw: number;
  tt: number;
  yCenter: number;
  frameDoublesAsSupport: boolean;
  L: number;
  opacity?: number;
}) {
  // 算「被邊框 absorb」標記:跟 SVG 邏輯一致
  const absorbed = useMemo(() => {
    const set = new Set<number>();
    if (!frameDoublesAsSupport) return set;
    const tol = tw / 2 + 0.01;
    mainCenters.forEach((c, idx) => {
      if (Math.abs(c) <= tol || Math.abs(c - L) <= tol) set.add(idx);
    });
    if (set.size === 0 && mainCenters.length >= 2) {
      set.add(0);
      set.add(mainCenters.length - 1);
    }
    return set;
  }, [mainCenters, frameDoublesAsSupport, tw, L]);

  return (
    <group position={[0, yCenter, 0]}>
      {mainCenters.map((cx, idx) => (
        <mesh
          key={idx}
          position={[cx, 0, S / 2]}
        >
          <boxGeometry args={[tw, tt, mainJoistLength]} />
          <meshStandardMaterial
            color={absorbed.has(idx) ? "#d6d3d1" : COLOR.main}
            opacity={(absorbed.has(idx) ? 0.4 : 1) * opacity}
            transparent
          />
        </mesh>
      ))}
    </group>
  );
}

// ─────────────────────────────────────────────────────────
// 副支 — 每 slot 內,沿 X 短段
// ─────────────────────────────────────────────────────────
function SubJoistsLayer({
  trace, tw, tt, yCenter, opacity = 1, subLengthFilter = null,
}: {
  trace: CeilingBom["trace"];
  tw: number;
  tt: number;
  yCenter: number;
  opacity?: number;
  subLengthFilter?: number | null;
}) {
  const items: Array<{ x: number; z: number; lengthX: number; op: number }> = [];
  for (const slot of trace.slots) {
    const xStart = slot.fromCm;
    const xEnd = slot.toCm;
    if (xEnd <= xStart) continue;
    const xCenter = (xStart + xEnd) / 2;
    const lengthX = xEnd - xStart;
    const matchesLength =
      subLengthFilter == null || Math.abs(slot.subJoistLengthCm - subLengthFilter) < 0.5;
    const itemOpacity = opacity * (matchesLength ? 1 : 0.12);
    for (const yOff of trace.subJoistYOffsetsCm) {
      const zCenter = tw + yOff;
      items.push({ x: xCenter, z: zCenter, lengthX, op: itemOpacity });
    }
  }
  return (
    <group position={[0, yCenter, 0]}>
      {items.map((it, i) => (
        <mesh key={i} position={[it.x, 0, it.z]}>
          <boxGeometry args={[it.lengthX, tt * 0.85, tw]} />
          <meshStandardMaterial color={COLOR.sub} transparent opacity={it.op} />
        </mesh>
      ))}
    </group>
  );
}

// ─────────────────────────────────────────────────────────
// 吊筋 — 每主支沿線 N 支垂直棒(spec floor(L/spacing)+1)
// ─────────────────────────────────────────────────────────
function HangersLayer({
  mainCenters, hangerPerJoist, mainJoistLength, S, tw, hangerH, yBase, yCenter, opacity = 1,
}: {
  mainCenters: number[];
  hangerPerJoist: number;
  mainJoistLength: number;
  S: number;
  tw: number;
  tt: number;
  hangerH: number;
  yBase: number;
  yCenter: number;
  opacity?: number;
}) {
  const rodCross = 1.5; // 吊筋截面 1.5×1.5 cm 視覺(實務 8-10 mm 螺絲棒,放大顯)
  const innerZStart = tw;
  const innerZEnd = S - tw;
  const usableZ = innerZEnd - innerZStart;
  // 吊筋 Z 位置策略:
  //   1 支 → 中心
  //   2 支(簡化模式)→ 1/3, 2/3(中段內側,不貼邊框)
  //   3+ 支(業界標準)→ 均分含端點(配合多段,需 evenly)
  const positions = (() => {
    if (hangerPerJoist <= 1) return [innerZStart + usableZ / 2];
    if (hangerPerJoist === 2) return [innerZStart + usableZ / 3, innerZStart + (2 * usableZ) / 3];
    const step = usableZ / (hangerPerJoist - 1);
    return Array.from({ length: hangerPerJoist }, (_, i) => innerZStart + i * step);
  })();

  return (
    <group>
      {mainCenters.map((cx, ji) => (
        <group key={ji}>
          {positions.map((z, i) => (
            <mesh key={`${ji}-${i}`} position={[cx, yCenter, z]}>
              <boxGeometry args={[rodCross, hangerH, rodCross]} />
              <meshStandardMaterial color={COLOR.hanger} transparent opacity={opacity} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

// ─────────────────────────────────────────────────────────
// 矽酸鈣板 — 依 mainCenters 切欄 + 每 boardLong 切列
// ─────────────────────────────────────────────────────────
function BoardsLayer({
  L, S, input, mainCenters, yCenter, boardThickness, opacity = 1, boardKindFilter = null,
}: {
  L: number;
  S: number;
  input: CeilingBom["input"];
  mainCenters: number[];
  yCenter: number;
  boardThickness: number;
  opacity?: number;
  boardKindFilter?: "full" | "cut" | null;
}) {
  // 視覺對齊主支中心(per spec「板邊落主支中心」),整 / 裁判定用容差
  const FULL_TOL_CM = 5;
  const colEdges: number[] = mainCenters.length === 0
    ? [0, L]
    : [0, ...mainCenters, L];

  const rowEdges: number[] = [0];
  let z = input.boardLongCm;
  while (z < S) {
    rowEdges.push(z);
    z += input.boardLongCm;
  }
  rowEdges.push(S);
  const fullRowCount = Math.floor(input.shortSideCm / input.boardLongCm);

  const gap = input.jointGapMm / 10;

  const boards: React.ReactNode[] = [];
  let k = 0;
  for (let ci = 0; ci < colEdges.length - 1; ci++) {
    const xL = colEdges[ci];
    const xR = colEdges[ci + 1];
    const colW = xR - xL - gap;
    if (colW <= 0) continue;
    const colFull = Math.abs((xR - xL) - input.boardShortCm) <= FULL_TOL_CM;
    for (let ri = 0; ri < rowEdges.length - 1; ri++) {
      const zT = rowEdges[ri];
      const zB = rowEdges[ri + 1];
      const rowH = zB - zT - gap;
      if (rowH <= 0) continue;
      const rowFull = ri < fullRowCount;
      const isFullBoard = colFull && rowFull;
      // boardKindFilter:full = 只亮 isFullBoard=true,cut = 只亮 isFullBoard=false
      const matchesKind =
        !boardKindFilter ||
        (boardKindFilter === "full" && isFullBoard) ||
        (boardKindFilter === "cut" && !isFullBoard);
      const boardOpacity = opacity * (matchesKind ? 1 : 0.12);
      const cx = xL + (xR - xL) / 2;
      const cz = zT + (zB - zT) / 2;
      boards.push(
        <mesh key={k++} position={[cx, yCenter, cz]}>
          <boxGeometry args={[colW, boardThickness, rowH]} />
          <meshStandardMaterial color={COLOR.board} transparent opacity={boardOpacity} />
        </mesh>,
      );
    }
  }
  return <group>{boards}</group>;
}
