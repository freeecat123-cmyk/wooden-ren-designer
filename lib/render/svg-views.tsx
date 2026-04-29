import type { FurnitureDesign, Part } from "@/lib/types";
import { calculateCutDimensions } from "@/lib/geometry/cut-dimensions";
import { MATERIALS } from "@/lib/materials";
import { JOINERY_LABEL } from "@/lib/joinery/details";
import {
  MM3_PER_BDFT,
  SHEET_GOOD_LABEL,
  effectiveBillableMaterial,
} from "@/lib/pricing/catalog";
import {
  classifyEdgeVisibility,
  hasNonQuarterRotation,
  isPartHidden,
  makeHiddenChecker,
  projectPart,
  projectPartPolygon,
  projectTiltedBoxSilhouette,
  sortPartsByDepth,
  worldExtents,
  type OrthoView,
} from "@/lib/render/geometry";

interface ViewProps {
  design: FurnitureDesign;
}

const PADDING = 220; // 留空間給內外尺寸雙標線 + zone 高度鏈 + 腳高（避免文字撞外框）
const DIM_OFFSET = 50;
const TITLE_BAR_H = 32;

/**
 * 統一抓家具的標線資訊。涵蓋櫃體 / 桌 / 椅 / 凳 / 桌附下層 / 各種板件。
 *
 * - main = 主水平面（櫃頂 / 桌面 / 座板）
 * - cabinet = 同時有 top + bottom 才算（櫃體獨有的內部尺寸 + zone 鏈）
 * - shelves = 任何 id 含 "shelf" 或 "under-shelf" 的板（茶几下層、書櫃內層）
 */
function extractFurnitureDims(design: FurnitureDesign) {
  const topPart = design.parts.find((p) => p.id === "top");
  const seatPart = design.parts.find((p) => p.id === "seat");
  const bottomPart = design.parts.find((p) => p.id === "bottom");
  const main = topPart ?? seatPart;
  if (!main) return null;

  const mainT = main.visible.thickness;
  const mainBottomY = main.origin.y;
  const mainTopY = main.origin.y + mainT;
  const mainKind: "top" | "seat" = topPart ? "top" : "seat";

  const cabinet =
    topPart && bottomPart
      ? (() => {
          const panelT = topPart.visible.thickness;
          const innerW = topPart.visible.length - 2 * panelT;
          const bottomTopY = bottomPart.origin.y + bottomPart.visible.thickness;
          const topBottomY = topPart.origin.y;
          const innerH = topBottomY - bottomTopY;
          const sideLeft = design.parts.find((p) => p.id === "side-left");
          const innerD = sideLeft ? sideLeft.visible.width : topPart.visible.width;
          const legHeight = bottomPart.origin.y;
          return { panelT, innerW, innerH, innerD, bottomTopY, topBottomY, legHeight };
        })()
      : null;

  // 額外水平板（茶几下層架、書櫃內層、bench under-shelf）
  const shelves = design.parts
    .filter((p) => /shelf/.test(p.id) || /under-shelf/.test(p.id))
    .map((p) => ({
      id: p.id,
      nameZh: p.nameZh,
      bottomY: p.origin.y,
      topY: p.origin.y + p.visible.thickness,
      thickness: p.visible.thickness,
    }))
    .sort((a, b) => a.bottomY - b.bottomY);

  // 橫向構件：牙板 / 橫撐 / 椅背料 / footrest 等（Y 位置 = origin.y, yExt 用 worldExtents）
  const crossPieces = design.parts
    .filter((p) =>
      /^(apron|ls-|stretcher|back-rail|back-top-rail|back-splat|footrest|center-stretcher)/.test(
        p.id,
      ),
    )
    .map((p) => {
      const { yExt } = worldExtents(p);
      // 所有橫撐都標總長（拉箭頭）；梯形橫撐多標斜面角度
      // length = visible.length（bottom 邊長度，or 一般矩形的長度）
      // 斜面角度 = atan((bottom - top) / 2 / apronWidth)，trap shape 才有
      const trap = p.shape?.kind === "apron-trapezoid" ? p.shape : null;
      // 中軸對齊後 bottomLengthScale 也可能 ≠ 1（top 收、bot 放），
      // 取兩端較長者當切料長，角度看 top↔bot 差
      const trapBotLen = trap ? p.visible.length * trap.bottomLengthScale : p.visible.length;
      const trapTopLen = trap ? p.visible.length * trap.topLengthScale : p.visible.length;
      const cutLengthMm = Math.max(trapBotLen, trapTopLen);
      const cutAngleDeg = trap
        ? (Math.atan(Math.abs(trapBotLen - trapTopLen) / 2 / p.visible.width) *
            180) /
          Math.PI
        : 0;
      // 軸向：rotation.y ≈ π/2 → Z 軸橫撐（左/右），else X 軸（前/後）
      // 用來決定哪個視圖該顯示這條橫撐的長度標
      const isZAxis = Math.abs(p.rotation?.y ?? 0) > Math.PI / 4;
      return {
        id: p.id,
        nameZh: p.nameZh,
        bottomY: p.origin.y,
        topY: p.origin.y + yExt,
        yExt,
        cutLengthMm,
        cutAngleDeg,
        isZAxis,
      };
    })
    .sort((a, b) => a.bottomY - b.bottomY);

  // 腳：取所有 id 開頭為 leg- 的件（俯視圖用來標腳跨距 / 腳粗）
  const legs = design.parts.filter((p) => /^leg-?\d*$/.test(p.id));
  // 外斜腳的最大落地點偏移（splayed shape 的 dxMm / dzMm 絕對值最大者）
  // 用來算落地點 X / Z 範圍 vs 椅面邊距
  const maxSplayDx = Math.max(
    0,
    ...legs.map((p) =>
      p.shape?.kind === "splayed" || p.shape?.kind === "splayed-tapered" || p.shape?.kind === "splayed-round-tapered"
        ? Math.abs(p.shape.dxMm)
        : 0,
    ),
  );
  const maxSplayDz = Math.max(
    0,
    ...legs.map((p) =>
      p.shape?.kind === "splayed" || p.shape?.kind === "splayed-tapered" || p.shape?.kind === "splayed-round-tapered"
        ? Math.abs(p.shape.dzMm)
        : 0,
    ),
  );
  const legFootprint =
    legs.length >= 2
      ? (() => {
          const xs = legs.map((p) => p.origin.x);
          const zs = legs.map((p) => p.origin.z);
          const minX = Math.min(...xs);
          const maxX = Math.max(...xs);
          const minZ = Math.min(...zs);
          const maxZ = Math.max(...zs);
          // 用第一根腳的「橫切面」當作腳粗（visible.length 通常 = legSize）
          const sample = legs[0];
          const legSize = Math.min(sample.visible.length, sample.visible.width);
          return { minX, maxX, minZ, maxZ, legSize, count: legs.length };
        })()
      : null;

  return {
    legs,
    maxSplayDx,
    maxSplayDz,
    main,
    mainT,
    mainBottomY,
    mainTopY,
    mainKind,
    cabinet,
    shelves,
    crossPieces,
    legFootprint,
  };
}

/**
 * 抓 zones 模式下每片 boundary 板的 Y 位置（origin.y = 板下緣）。
 * 用來在前視圖左側畫每個 zone 的高度標示鏈。
 */
function extractZoneBoundaryYs(design: FurnitureDesign): number[] {
  return design.parts
    .filter((p) => /^z\d+-boundary$/.test(p.id))
    .map((p) => p.origin.y)
    .sort((a, b) => a - b);
}

function partFill(part: Part) {
  return MATERIALS[part.material].color;
}

/** Single orthographic view with engineering-drawing frame and dim lines */
export function OrthoView({
  design,
  view,
  title,
  titleEn,
  className,
}: ViewProps & {
  view: OrthoView;
  title: string;
  titleEn: string;
  /** 覆蓋 SVG 預設 className（預設 "bg-white w-full h-auto max-h-[70vh]"） */
  className?: string;
}) {
  const { overall } = design;
  const w = view === "side" ? overall.width : overall.length;
  const h = view === "top" ? overall.width : overall.thickness;

  const vbW = w + PADDING * 2;
  const vbH = h + PADDING * 2 + DIM_OFFSET + TITLE_BAR_H;
  const vbX = -PADDING - w / 2;
  // Top view parts project around y=0 (origin.z - zExt/2 ranges roughly -h/2..h/2);
  // front/side views use natural flipY so parts span y=-h..0.
  const drawAreaTop = view === "top" ? -h / 2 : -h;
  const vbY = drawAreaTop - PADDING - TITLE_BAR_H;

  // Frame: enclose drawing + title bar + dim area
  const frameX = vbX + 8;
  const frameY = vbY + 8;
  const frameW = vbW - 16;
  const frameH = vbH - 16;

  return (
    <svg
      viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
      preserveAspectRatio="xMidYMid meet"
      className={className ?? "bg-white w-full h-auto max-h-[70vh]"}
    >
      <defs>
        <marker
          id={`arr-${view}`}
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="8"
          markerHeight="8"
          orient="auto-start-reverse"
        >
          {/* CNS 3-3 規定箭頭夾角 20°：半角 10° → 半寬 = 10·tan(10°) ≈ 1.76 */}
          <path d="M 0 3.24 L 10 5 L 0 6.76 z" fill="#111" />
        </marker>
      </defs>

      {/* outer frame */}
      <rect
        x={frameX}
        y={frameY}
        width={frameW}
        height={frameH}
        fill="none"
        stroke="#222"
        strokeWidth={1}
      />

      {/* title bar at top */}
      <g>
        <line
          x1={frameX}
          x2={frameX + frameW}
          y1={frameY + TITLE_BAR_H}
          y2={frameY + TITLE_BAR_H}
          stroke="#222"
          strokeWidth={0.6}
        />
        <text
          x={frameX + 10}
          y={frameY + TITLE_BAR_H - 10}
          fontSize={13}
          fontWeight="700"
          fill="#111"
          fontFamily="sans-serif"
        >
          {title}
        </text>
        <text
          x={frameX + 10}
          y={frameY + TITLE_BAR_H - 10}
          dx={70}
          fontSize={10}
          fill="#666"
          fontFamily="sans-serif"
        >
          {titleEn}
        </text>
      </g>

      {/* center lines (dot-dash) */}
      <g stroke="#888" strokeWidth={0.5} strokeDasharray="8 2 2 2" opacity={0.7}>
        <line x1={0} x2={0} y1={drawAreaTop - 10} y2={drawAreaTop + h + 10} />
        <line
          x1={-w / 2 - 10}
          x2={w / 2 + 10}
          y1={drawAreaTop + h / 2}
          y2={drawAreaTop + h / 2}
        />
      </g>

      {/* parts — line-art style: visible solid, hidden dashed */}
      {sortPartsByDepth(design.parts, view).map((part) => {
        const hidden = isPartHidden(part, design.parts, view);
        const stroke = hidden ? "#888" : "#111";
        const sw = hidden ? 0.5 : 0.9;
        const dash = hidden ? "4 3" : undefined;
        // 圓盤 / 圓柱腳俯視畫圓；前/側視維持矩形（圓盤側面 = 直徑 × 厚）
        if (
          (part.shape?.kind === "round" ||
            part.shape?.kind === "round-tapered" ||
            part.shape?.kind === "splayed-round-tapered" ||
            part.shape?.kind === "lathe-turned") &&
          view === "top"
        ) {
          const r = projectPart(part, view);
          const cx = r.x + r.w / 2;
          // Top view 翻轉 Y 跟 polygon 路徑（-p.y）一致：world +Z (BACK) → SVG 上方
          const cy = -(r.y + r.h / 2);
          const radius = Math.min(r.w, r.h) / 2;
          // 外斜圓錐：實線=腳頂位置，虛線=腳底位置 + 兩條外切線連起來才看得出是腳
          if (part.shape.kind === "splayed-round-tapered") {
            const scale = part.shape.bottomScale;
            const footCx = cx + -part.shape.dxMm; // 俯視鏡像 X
            const footCy = cy - part.shape.dzMm;  // 翻轉 Y 後 dzMm 符號要反過來
            const r1 = radius;
            const r2 = radius * scale;
            // 兩個圓的外切線：N = cosθ·p + sinθ·u，其中 sinθ = (r1-r2)/d
            const ddx = footCx - cx;
            const ddy = footCy - cy;
            const d = Math.hypot(ddx, ddy);
            const tangents: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
            if (d > Math.abs(r1 - r2) + 0.01) {
              const ux = ddx / d, uy = ddy / d;
              const px = -uy, py = ux;
              const sinT = (r1 - r2) / d;
              const cosT = Math.sqrt(Math.max(0, 1 - sinT * sinT));
              for (const s of [-1, 1] as const) {
                const Nx = s * cosT * px + sinT * ux;
                const Ny = s * cosT * py + sinT * uy;
                tangents.push({
                  x1: cx + r1 * Nx, y1: cy + r1 * Ny,
                  x2: footCx + r2 * Nx, y2: footCy + r2 * Ny,
                });
              }
            }
            return (
              <g key={part.id}>
                <circle cx={cx} cy={cy} r={r1} fill="none" stroke={stroke} strokeWidth={sw} strokeDasharray={dash} />
                <circle cx={footCx} cy={footCy} r={r2} fill="none" stroke="#888" strokeWidth={0.4} strokeDasharray="3 3" />
                {tangents.map((t, i) => (
                  <line key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} stroke={stroke} strokeWidth={sw} strokeDasharray={dash} />
                ))}
              </g>
            );
          }
          return (
            <circle
              key={part.id}
              cx={cx}
              cy={cy}
              r={radius}
              fill="none"
              stroke={stroke}
              strokeWidth={sw}
              strokeDasharray={dash}
            />
          );
        }
        // 傾斜 box / 梯形 apron / arch-bent / tilt-z
        // worldExtents 只認 quarter rotation；非 quarter 旋轉、彎料、傾斜料都要走
        // projectPartSilhouette（3D corner sample → rotate → project → hull）
        const isTiltedBox =
          (!part.shape || part.shape.kind === "box") && hasNonQuarterRotation(part);
        const isApronTrapezoid = part.shape?.kind === "apron-trapezoid";
        const isApronBeveled = part.shape?.kind === "apron-beveled";
        const isArchBentSideFront =
          part.shape?.kind === "arch-bent" && view !== "top";
        const isTiltZ = part.shape?.kind === "tilt-z" && view !== "top";
        if (
          isTiltedBox ||
          isApronTrapezoid ||
          isApronBeveled ||
          isArchBentSideFront ||
          isTiltZ
        ) {
          // 俯視特例：上面（接座）+ 下面（接地，虛線）+ 4 條連接線
          // 跟外斜腳同樣的視覺風格——讓使用者看出 apron 是傾斜的
          if (view === "top") {
            const lx = part.visible.length;
            const ly = part.visible.thickness;
            const lz = part.visible.width;
            const trap = isApronTrapezoid && part.shape?.kind === "apron-trapezoid" ? part.shape : null;
            const bev = isApronBeveled && part.shape?.kind === "apron-beveled" ? part.shape : null;
            const bevShear = bev ? Math.tan(bev.bevelAngle) : 0;
            const proj = (xl: number, yl: number, zl: number) => {
              // 梯形：x 依 z 端的 scale 縮放
              const xScale = trap
                ? zl < 0 ? trap.topLengthScale : trap.bottomLengthScale
                : 1;
              xl = xl * xScale;
              // 斜邊 apron：z 依 y 偏移（上下緣轉成水平面）
              zl = zl - yl * bevShear;
              const rx = part.rotation?.x ?? 0;
              const ry = part.rotation?.y ?? 0;
              const rz = part.rotation?.z ?? 0;
              const cxR = Math.cos(rx), sxR = Math.sin(rx);
              const cyR = Math.cos(ry), syR = Math.sin(ry);
              const czR = Math.cos(rz), szR = Math.sin(rz);
              let x = xl, y = yl, z = zl;
              let y2 = y * cxR - z * sxR;
              let z2 = y * sxR + z * cxR;
              y = y2; z = z2;
              let x2 = x * cyR + z * syR;
              z2 = -x * syR + z * cyR;
              x = x2; z = z2;
              x2 = x * czR - y * szR;
              y2 = x * szR + y * czR;
              x = x2; y = y2;
              return { x: -(x + part.origin.x), y: z + part.origin.z };
            };
            // 上面（local z = -lz/2）= 接座那面，下面 = 接地那面
            const topCorners = [
              proj(-lx / 2, -ly / 2, -lz / 2),
              proj(+lx / 2, -ly / 2, -lz / 2),
              proj(+lx / 2, +ly / 2, -lz / 2),
              proj(-lx / 2, +ly / 2, -lz / 2),
            ];
            const botCorners = [
              proj(-lx / 2, -ly / 2, +lz / 2),
              proj(+lx / 2, -ly / 2, +lz / 2),
              proj(+lx / 2, +ly / 2, +lz / 2),
              proj(-lx / 2, +ly / 2, +lz / 2),
            ];
            const fmt = (pts: typeof topCorners) =>
              pts.map((p) => `${p.x},${-p.y}`).join(" ");
            return (
              <g key={part.id}>
                <polygon points={fmt(topCorners)} fill="none" stroke={stroke} strokeWidth={sw} strokeDasharray={dash} />
                <polygon points={fmt(botCorners)} fill="none" stroke="#888" strokeWidth={0.4} strokeDasharray="3 3" />
                {topCorners.map((tc, i) => (
                  <line
                    key={i}
                    x1={tc.x} y1={-tc.y}
                    x2={botCorners[i].x} y2={-botCorners[i].y}
                    stroke={stroke} strokeWidth={sw} strokeDasharray={dash}
                  />
                ))}
              </g>
            );
          }
          // 其他 view：convex hull silhouette
          const poly = projectTiltedBoxSilhouette(part, view);
          const points = poly.map((p) => `${p.x},${-p.y}`).join(" ");
          return (
            <polygon
              key={part.id}
              points={points}
              fill="none"
              stroke={stroke}
              strokeWidth={sw}
              strokeDasharray={dash}
            />
          );
        }
        // 外斜方錐俯視：實線=腳頂位置，虛線=腳底位置 + 4 條角對角線
        if (part.shape?.kind === "splayed-tapered" && view === "top") {
          const r = projectPart(part, view);
          const scale = part.shape.bottomScale;
          const footW = r.w * scale;
          const footH = r.h * scale;
          // Top view 翻轉 Y：原 y → -(y+h)
          const headY = -(r.y + r.h);
          const footX = r.x + r.w / 2 - footW / 2 + -part.shape.dxMm;
          const footY = -(r.y + r.h / 2 + footH / 2) - part.shape.dzMm;
          // 4 個角對角線：頂角 → 底角（翻轉 Y）
          const topCorners = [
            [r.x, headY], [r.x + r.w, headY], [r.x + r.w, headY + r.h], [r.x, headY + r.h],
          ];
          const botCorners = [
            [footX, footY], [footX + footW, footY], [footX + footW, footY + footH], [footX, footY + footH],
          ];
          return (
            <g key={part.id}>
              <rect x={r.x} y={headY} width={r.w} height={r.h} fill="none" stroke={stroke} strokeWidth={sw} strokeDasharray={dash} />
              <rect x={footX} y={footY} width={footW} height={footH} fill="none" stroke="#888" strokeWidth={0.4} strokeDasharray="3 3" />
              {topCorners.map((tc, i) => (
                <line key={i} x1={tc[0]} y1={tc[1]} x2={botCorners[i][0]} y2={botCorners[i][1]} stroke={stroke} strokeWidth={sw} strokeDasharray={dash} />
              ))}
            </g>
          );
        }
        // Use polygon when the shape is non-box AND it would differ from a rect
        // in this view.
        const useShape =
          part.shape &&
          part.shape.kind !== "box" &&
          part.shape.kind !== "round" &&
          !(
            view === "top" &&
            part.shape.kind !== "splayed" &&
            part.shape.kind !== "splayed-tapered" &&
            part.shape.kind !== "splayed-round-tapered" &&
            part.shape.kind !== "notched-corners" &&
            part.shape.kind !== "arch-bent"
          );
        if (useShape) {
          const poly = projectPartPolygon(part, view);
          const points = poly.map((p) => `${p.x},${-p.y}`).join(" ");
          const extras: React.ReactNode[] = [];
          // Splayed top view: also draw the shifted bottom footprint so you
          // can see how far the foot lands from directly below the head.
          if (part.shape?.kind === "splayed" && view === "top") {
            const r = projectPart(part, view);
            extras.push(
              <rect
                key={`${part.id}-foot`}
                x={r.x + -part.shape.dxMm}
                y={-(r.y + r.h) - part.shape.dzMm}
                width={r.w}
                height={r.h}
                fill="none"
                stroke="#888"
                strokeWidth={0.4}
                strokeDasharray="3 3"
              />,
            );
          }
          // Arch-bent 側視：在未彎時的端面後緣多畫一條垂直實線，標示
          // 端面（cross-section）邊界——讓看圖的人分得出料的真實厚度 vs 彎弧延伸
          if (part.shape?.kind === "arch-bent" && view === "side") {
            const r = projectPart(part, view);
            const bend = part.shape.bendMm;
            if (Math.abs(bend) >= 0.5) {
              const xBackOriginal = r.x + r.w; // 未彎時的後緣
              extras.push(
                <line
                  key={`${part.id}-endface`}
                  x1={xBackOriginal}
                  x2={xBackOriginal}
                  y1={-r.y}
                  y2={-(r.y + r.h)}
                  stroke={stroke}
                  strokeWidth={sw}
                />,
              );
            }
          }
          return (
            <g key={part.id}>
              <polygon
                points={points}
                fill="none"
                stroke={stroke}
                strokeWidth={sw}
                strokeDasharray={dash}
              />
              {extras}
            </g>
          );
        }
        const r = projectPart(part, view);
        // 預設 rect path：把 4 條邊用 HLE 分段——visible 段實線、hidden 段虛線
        // 整個零件被擋住時 hidden 變數會 true，沿用整體實線/虛線；否則用 per-edge 判斷
        if (hidden) {
          return (
            <rect
              key={part.id}
              x={r.x}
              y={view === "top" ? -(r.y + r.h) : -r.y - r.h}
              width={r.w}
              height={r.h}
              fill="none"
              stroke={stroke}
              strokeWidth={sw}
              strokeDasharray={dash}
            />
          );
        }
        const corners = [
          { x: r.x, y: r.y },
          { x: r.x + r.w, y: r.y },
          { x: r.x + r.w, y: r.y + r.h },
          { x: r.x, y: r.y + r.h },
        ];
        const isHiddenAt = makeHiddenChecker(part, design.parts, view);
        const lines: React.ReactNode[] = [];
        for (let i = 0; i < 4; i++) {
          const a = corners[i];
          const b = corners[(i + 1) % 4];
          const segs = classifyEdgeVisibility(a, b, isHiddenAt);
          segs.forEach((seg, segIdx) => {
            lines.push(
              <line
                key={`${part.id}-e${i}-s${segIdx}`}
                x1={seg.a.x}
                y1={-seg.a.y}
                x2={seg.b.x}
                y2={-seg.b.y}
                stroke={seg.hidden ? "#888" : "#111"}
                strokeWidth={seg.hidden ? 0.5 : 0.9}
                strokeDasharray={seg.hidden ? "4 3" : undefined}
                fill="none"
              />,
            );
          });
        }
        return <g key={part.id}>{lines}</g>;
      })}

      {/* 座面挖型（saddle / scooped）— 前/側視疊一條虛線曲線顯示挖型輪廓
           俯視看不到挖型不畫；曲線從矩形頂緣往下凹（最深點 = depthMm） */}
      {view !== "top" && design.parts
        .filter((p) => p.shape?.kind === "seat-scoop")
        .map((p) => {
          if (p.shape?.kind !== "seat-scoop") return null;
          const scoop = p.shape;
          const r = projectPart(p, view);
          const yTop = -r.y - r.h; // SVG y for the seat top
          // x 軸：前視看 length，側視看 width
          const axisLen = view === "side" ? p.visible.width : p.visible.length;
          const halfL = axisLen / 2;
          const SAMPLES = 40;
          const dipFn = (t: number): number => {
            // t ∈ [-1, 1]
            if (scoop.profile === "saddle") {
              return scoop.depthMm * Math.max(0, 1 - t * t);
            }
            if (scoop.profile === "dished") {
              // 沿 Z 軸單軸下凹：側視全弧、前視淺弧
              if (view === "side") return scoop.depthMm * Math.max(0, 1 - t * t);
              return scoop.depthMm * Math.max(0, 1 - t * t * 0.3);
            }
            // scooped 兩個 basin（中心在 ±0.5）
            // 前視 (X 軸 ↔ length)：能看到 M 形雙凹
            // 側視 (Z 軸 ↔ width)：兩 basin 沿 Z 全長延伸（兩端稍淺），畫單凹
            if (view === "side") {
              return scoop.depthMm * Math.max(0, 1 - t * t * 0.6);
            }
            const r1 = (t - 0.5) / 0.5;
            const r2 = (t + 0.5) / 0.5;
            const f1 = Math.max(0, 1 - r1 * r1);
            const f2 = Math.max(0, 1 - r2 * r2);
            return scoop.depthMm * Math.max(f1, f2);
          };
          const cx = r.x + r.w / 2;
          const pts: string[] = [];
          for (let i = 0; i <= SAMPLES; i++) {
            const t = -1 + (2 * i) / SAMPLES;
            const x = cx + t * halfL;
            const y = yTop + dipFn(t);
            pts.push(`${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`);
          }
          return (
            <path
              key={`scoop-${p.id}-${view}`}
              d={pts.join(" ")}
              fill="none"
              stroke="#666"
              strokeWidth={0.6}
              strokeDasharray="3 2"
            />
          );
        })}

      {/* outer bounding box (dashed ghost) */}
      <rect
        x={-w / 2}
        y={drawAreaTop}
        width={w}
        height={h}
        fill="none"
        stroke="#999"
        strokeDasharray="3 3"
        strokeWidth={0.5}
        opacity={0.8}
      />

      {/* horizontal dimension below — 加方向 prefix 讓讀者一看就懂
          Front/Top 投影 X 軸 = 寬（length）；Side 投影 X 軸 = 深（width）*/}
      <DimensionLine
        arrowId={`arr-${view}`}
        x1={-w / 2}
        x2={w / 2}
        y={drawAreaTop + h + 28}
        label={`${view === "side" ? "深" : "寬"} ${w} mm`}
      />

      {/* vertical dimension on right side
          桌椅類前/側視圖左側已有「座面 ${h}」/「桌面 ${h}」高度標，避免重複；
          頂視圖跟櫃類沒有左側等價標籤，仍顯示總高
          Front/Side 投影 Y 軸 = 高（thickness）；Top 投影 Y 軸 = 深（width）*/}
      {(() => {
        const hasFlatTopLeftLabel =
          view !== "top" && extractFurnitureDims(design) !== null;
        if (hasFlatTopLeftLabel) return null;
        return (
          <VerticalDimensionLine
            arrowId={`arr-${view}`}
            x={w / 2 + 28}
            y1={view === "top" ? -h / 2 : -h}
            y2={view === "top" ? h / 2 : 0}
            label={`${view === "top" ? "深" : "高"} ${h} mm`}
          />
        );
      })()}

      {/* === 額外標線（內部尺寸 + zone 高度鏈 / 桌面厚 + 淨高 / 層板高度）=== */}
      {(() => {
        const dims = extractFurnitureDims(design);
        if (!dims) return null;
        const {
          main,
          mainT,
          mainBottomY,
          mainTopY,
          mainKind,
          cabinet,
          shelves,
          crossPieces,
          legFootprint,
          legs,
          maxSplayDx,
          maxSplayDz,
        } = dims;
        const sFloor = drawAreaTop + h;

        // ===== 桌椅 / 凳子 / 茶几（無 cabinet 部分）=====
        if (!cabinet) {
          if (view === "top") {
            // 俯視圖：腳粗 + 桌面外伸（4 角到腳外面距離）+ 對角線（檢查方正度）
            if (!legFootprint) return null;
            const { minX, maxX, minZ, maxZ, legSize } = legFootprint;
            const overhangXr = w / 2 - (maxX + legSize / 2);  // 右側外伸
            const overhangXl = -w / 2 - (minX - legSize / 2); // 左側 (負值取 abs)
            const overhangZb = h / 2 - (maxZ + legSize / 2);  // 後側 (z>0)
            const overhangZf = -h / 2 - (minZ - legSize / 2); // 前側 (negative)
            const showOverhang = Math.abs(overhangXr) > 1; // > 1mm 才標
            return (
              <>
                {/* 腳粗 */}
                <text
                  x={minX + legSize / 2 + 4}
                  y={minZ - 4}
                  fontSize={10}
                  fill="#444"
                  fontFamily="sans-serif"
                >
                  腳 {legSize}×{legSize}
                </text>
                {/* 桌面外伸——只在右上角標一個（4 邊對稱所以只標 1 處夠用）*/}
                {showOverhang && (
                  <>
                    <DimensionLine
                      arrowId={`arr-${view}`}
                      x1={maxX + legSize / 2}
                      x2={w / 2}
                      y={-h / 2 - 16}
                      label={`外伸 ${Math.round(overhangXr)}`}
                    />
                    <VerticalDimensionLine
                      arrowId={`arr-${view}`}
                      x={w / 2 + 16}
                      y1={maxZ + legSize / 2}
                      y2={h / 2}
                      label={`外伸 ${Math.round(overhangZb)}`}
                    />
                  </>
                )}
                {/* 外斜腳：每個橫撐的上下緣 Y 跟落地 Y 都畫一圈腳框
                    （4 隻腳每個 Y 都畫 legSize×legSize），讓師傅看到腳在不同高度的位置。
                    深紅 = 落地 Y（最重要）；淺紅 = 橫撐接腳 Y */}
                {(maxSplayDx > 0 || maxSplayDz > 0) && (() => {
                  // 落地 Y + 牙板 Y 用深紅；下橫撐 (ls-) Y 用深藍，跟牙板分得開
                  const footColor = "#c63d3d";
                  const stretcherColor = "#c63d3d";
                  const lowerStretcherColor = "#1e3a8a";
                  const footProtrudeX = maxX + maxSplayDx + legSize / 2 - w / 2;
                  const footProtrudeZ = maxZ + maxSplayDz + legSize / 2 - h / 2;
                  const protrudeLabel = (mm: number) =>
                    mm > 0 ? `落地超出椅面 ${Math.round(mm)}` : `落地內縮 ${Math.round(-mm)}`;
                  return (
                    <>
                      {/* 橫撐上下緣 Y 的腳框（淺紅）+ 落地點腳框（深紅）
                          每隻腳依 splay 物理在每個 Y 算位置：
                          legX(Y) = origin.x + dxMm * (1 − Y / legHeight)
                          dedupe by Y——4 個 stretcher 同 Y 只畫一次（避免 React key 衝突 */}
                      {(() => {
                        const sample = legs[0];
                        const legHeight = sample.visible.thickness;
                        const yMap = new Map<number, string>();
                        // 牙板先寫（紅），下橫撐後寫蓋過去（藍）——這樣同 Y 時藍勝出
                        const sortedPieces = [...crossPieces].sort(
                          (a, b) => Number(/^ls-/.test(a.id)) - Number(/^ls-/.test(b.id)),
                        );
                        for (const c of sortedPieces) {
                          const color = /^ls-/.test(c.id) ? lowerStretcherColor : stretcherColor;
                          const yb = Math.round(c.bottomY);
                          const yt = Math.round(c.topY);
                          yMap.set(yb, color);
                          yMap.set(yt, color);
                        }
                        yMap.set(0, footColor); // 落地（覆蓋同 Y stretcher 的話以落地為主）
                        const ys = [...yMap.entries()].map(([y, color]) => ({ y, color }));
                        // 4 隻腳 × N 個 Y → 同 Y 同腳的框
                        return legs.flatMap((leg) => {
                          const sh = leg.shape;
                          const dx = sh?.kind === "splayed" || sh?.kind === "splayed-tapered" || sh?.kind === "splayed-round-tapered"
                            ? sh.dxMm : 0;
                          const dz = sh?.kind === "splayed" || sh?.kind === "splayed-tapered" || sh?.kind === "splayed-round-tapered"
                            ? sh.dzMm : 0;
                          if (dx === 0 && dz === 0) return [];
                          return ys.map(({ y, color }) => {
                            // 腳越下面外推越多：shift = (1 − y/legHeight)
                            const shift = legHeight > 0 ? 1 - y / legHeight : 0;
                            const cx = leg.origin.x + dx * shift;
                            const cz = leg.origin.z + dz * shift;
                            return (
                              <rect
                                key={`leg-${leg.id}-y${Math.round(y)}`}
                                x={cx - legSize / 2}
                                y={cz - legSize / 2}
                                width={legSize}
                                height={legSize}
                                fill="none"
                                stroke={color}
                                strokeWidth={0.4}
                                strokeDasharray="2 3"
                              />
                            );
                          });
                        });
                      })()}
                      {maxSplayDx > 0 && Math.abs(footProtrudeX) > 0.5 && (
                        <DimensionLine
                          arrowId={`arr-${view}`}
                          x1={Math.min(w / 2, maxX + maxSplayDx + legSize / 2)}
                          x2={Math.max(w / 2, maxX + maxSplayDx + legSize / 2)}
                          y={-h / 2 - 32}
                          label={protrudeLabel(footProtrudeX)}
                        />
                      )}
                      {maxSplayDz > 0 && Math.abs(footProtrudeZ) > 0.5 && (
                        <VerticalDimensionLine
                          arrowId={`arr-${view}`}
                          x={w / 2 + 32}
                          y1={Math.min(h / 2, maxZ + maxSplayDz + legSize / 2)}
                          y2={Math.max(h / 2, maxZ + maxSplayDz + legSize / 2)}
                          label={protrudeLabel(footProtrudeZ)}
                        />
                      )}
                    </>
                  );
                })()}
                {/* 對角線——量方正度，一律抓「腳外角」對角。
                    splayed 腳：抓「腳落地點外角」（穩定性才看落地）
                    一般腳：抓「腳頂面外角」（量這條檢查腳位有沒有歪） */}
                {(() => {
                  const isSplayed = maxSplayDx > 0 || maxSplayDz > 0;
                  // SVG 俯視 X 鏡像：world +X → SVG -X，所以 minX/maxX 要取負
                  const lxMin = -maxX - (isSplayed ? maxSplayDx : 0) - legSize / 2;
                  const lxMax = -minX + (isSplayed ? maxSplayDx : 0) + legSize / 2;
                  const lzMin = minZ - (isSplayed ? maxSplayDz : 0) - legSize / 2;
                  const lzMax = maxZ + (isSplayed ? maxSplayDz : 0) + legSize / 2;
                  const dx1 = lxMin;
                  const dy1 = lzMin;
                  const dx2 = lxMax;
                  const dy2 = lzMax;
                  const dw = dx2 - dx1;
                  const dh = dy2 - dy1;
                  const diagLen = Math.sqrt(dw * dw + dh * dh);
                  const cx = (dx1 + dx2) / 2;
                  const cy = (dy1 + dy2) / 2;
                  const angDeg = (Math.atan2(dh, dw) * 180) / Math.PI;
                  const angRad = Math.atan2(dh, dw);
                  const offX = -Math.sin(angRad) * 14;
                  const offY = Math.cos(angRad) * 14;
                  const label = `對角 ${Math.round(diagLen)}${isSplayed ? "（落地外角）" : "（腳外角）"}`;
                  return (
                    <>
                      <line
                        x1={dx1}
                        y1={dy1}
                        x2={dx2}
                        y2={dy2}
                        stroke="#a55"
                        strokeWidth={0.4}
                        strokeDasharray="4 3"
                      />
                      <g transform={`translate(${cx + offX}, ${cy + offY}) rotate(${angDeg})`}>
                        <rect
                          x={-label.length * 5}
                          y={-7}
                          width={label.length * 10}
                          height={13}
                          fill="white"
                          opacity={0.9}
                        />
                        <text
                          x={0}
                          y={0}
                          fontSize={10}
                          fill="#a55"
                          fontFamily="sans-serif"
                          textAnchor="middle"
                          dominantBaseline="middle"
                        >
                          {label}
                        </text>
                      </g>
                    </>
                  );
                })()}
              </>
            );
          }
          // front / side：主面厚 + 淨高 + 座面高 + 層板 + 橫撐 / 牙板 / 椅背
          const labelMain = mainKind === "seat" ? "座板" : "桌面";
          const labelClear = mainKind === "seat" ? "座下高" : "桌下淨高";
          // 把所有「會疊在左側的高度標線」整合：座面高 + 層板 + cross-pieces
          const leftStack: { y: number; label: string }[] = [];
          if (mainKind === "seat") {
            leftStack.push({
              y: mainTopY,
              label: `座面 ${Math.round(mainTopY)}`,
            });
          }
          for (const s of shelves) {
            leftStack.push({
              y: s.topY,
              label: `${s.nameZh} ${Math.round(s.topY)}`,
            });
          }
          for (const c of crossPieces) {
            leftStack.push({
              y: c.topY,
              label: `${c.nameZh} ${Math.round(c.topY)}`,
            });
          }
          // 排序去重（同 Y 只留一個）
          const seen = new Set<number>();
          const dedupedStack = leftStack
            .sort((a, b) => a.y - b.y)
            .filter((it) => {
              const key = Math.round(it.y);
              if (seen.has(key)) return false;
              seen.add(key);
              return true;
            });
          return (
            <>
              {/* 主面厚 */}
              <VerticalDimensionLine
                arrowId={`arr-${view}`}
                x={w / 2 + 96}
                y1={-mainTopY}
                y2={-mainBottomY}
                label={`${labelMain} ${Math.round(mainT)}`}
              />
              {/* 淨高 */}
              <VerticalDimensionLine
                arrowId={`arr-${view}`}
                x={w / 2 + 140}
                y1={-mainBottomY}
                y2={sFloor}
                label={`${labelClear} ${Math.round(mainBottomY)} mm`}
              />
              {/* cross-pieces 厚度（橫撐 / 牙板 / 椅背）— 同 Y 同尺寸去重，只標一次
                  名稱去掉「前/後/左/右」前綴避免重複（4 個都同樣是「牙板 60」） */}
              {(() => {
                const seen = new Map<string, typeof crossPieces[0]>();
                for (const c of crossPieces) {
                  const key = `${Math.round(c.bottomY)}_${Math.round(c.yExt)}`;
                  if (!seen.has(key)) seen.set(key, c);
                }
                const bare = (n: string) => n.replace(/^(前|後|左|右)/, "");
                return [...seen.values()].map((c) => (
                  <text
                    key={`xp-thick-${c.id}`}
                    x={w / 2 + 4}
                    y={-(c.bottomY + c.yExt / 2) + 4}
                    fontSize={10}
                    fill="#444"
                    fontFamily="sans-serif"
                  >
                    {bare(c.nameZh)} {Math.round(c.yExt)}
                  </text>
                ));
              })()}
              {/* 橫撐長度標——所有橫撐都標 L（拉箭頭），梯形多標 ∠
                  按視圖軸過濾：front 顯示 X 軸（前/後）、side 顯示 Z 軸（左/右） */}
              {(() => {
                const seenLen = new Map<string, typeof crossPieces[0]>();
                for (const c of crossPieces) {
                  if (view === "front" && c.isZAxis) continue;
                  if (view === "side" && !c.isZAxis) continue;
                  const key = `${Math.round(c.bottomY)}_${Math.round(c.cutLengthMm)}`;
                  if (!seenLen.has(key)) seenLen.set(key, c);
                }
                const bare = (n: string) => n.replace(/^(前|後|左|右)/, "");
                return [...seenLen.values()].map((c) => {
                  const halfL = c.cutLengthMm / 2;
                  const yLine = -c.bottomY + 12;
                  const showAngle = c.cutAngleDeg > 0.1;
                  return (
                    <g key={`xp-len-${c.id}`} stroke="#a55" fill="#a55" strokeWidth={0.5} fontFamily="sans-serif">
                      <line x1={-halfL} y1={yLine} x2={halfL} y2={yLine}
                        markerStart={`url(#arr-${view})`} markerEnd={`url(#arr-${view})`} />
                      <text x={0} y={yLine + 11} textAnchor="middle" fontSize={9} stroke="none">
                        {bare(c.nameZh)} L{Math.round(c.cutLengthMm)}
                        {showAngle ? ` ∠${c.cutAngleDeg.toFixed(1)}°` : ""}
                      </text>
                    </g>
                  );
                });
              })()}
              {/* 左側高度堆疊 */}
              {dedupedStack.map((it, i) => (
                <VerticalDimensionLine
                  key={`stack-${i}`}
                  arrowId={`arr-${view}`}
                  x={-w / 2 - 36 - i * 44}
                  y1={-it.y}
                  y2={sFloor}
                  label={it.label}
                />
              ))}
            </>
          );
        }

        // ===== 櫃體 =====
        const { panelT, innerW, innerH, innerD, bottomTopY, topBottomY, legHeight } =
          cabinet;
        // 由下面延用原本的櫃體 dims
        if (view === "front") {
          // SVG 座標：y 軸向下，OrthoView 內部 y = -worldY，drawAreaTop 對應櫃頂
          // 頂板下緣螢幕 Y = -topBottomY，底板上緣螢幕 Y = -bottomTopY
          const sBottom = -bottomTopY;
          const sTop = -topBottomY;
          const sLegBottom = -legHeight; // 底板下緣（= 腳頂）
          const sFloor = drawAreaTop + h; // 螢幕地面 Y
          // 內寬：上方 dim line（畫在頂板下緣再往下一點，內側 W）
          // zone 高度鏈：從 bottomTopY 往上每片 boundary，左側堆疊
          const boundaryYs = extractZoneBoundaryYs(design);
          const zoneSegments: { y1: number; y2: number; label: string }[] = [];
          let prevY = bottomTopY;
          for (const by of boundaryYs) {
            zoneSegments.push({ y1: -prevY, y2: -by, label: `${Math.round(by - prevY)} mm` });
            prevY = by + panelT; // 下一段從 boundary 上緣開始
          }
          zoneSegments.push({
            y1: -prevY,
            y2: -topBottomY,
            label: `${Math.round(topBottomY - prevY)} mm`,
          });

          return (
            <>
              {/* 內寬 — 在外寬下方再加一條（位置往下偏 22px） */}
              <DimensionLine
                arrowId={`arr-${view}`}
                x1={-w / 2 + panelT}
                x2={w / 2 - panelT}
                y={drawAreaTop + h + 80}
                label={`內 ${Math.round(innerW)} mm`}
              />
              {/* 內高 — 在右側外高內側再加一條（往內偏 32px） */}
              <VerticalDimensionLine
                arrowId={`arr-${view}`}
                x={w / 2 + 96}
                y1={sTop}
                y2={sBottom}
                label={`內 ${Math.round(innerH)} mm`}
              />
              {/* 腳高 — 右側更靠內，從底板下緣到地面 */}
              {legHeight > 0 && (
                <VerticalDimensionLine
                  arrowId={`arr-${view}`}
                  x={w / 2 + 140}
                  y1={sLegBottom}
                  y2={sFloor}
                  label={`腳 ${Math.round(legHeight)}`}
                />
              )}
              {/* zone 高度鏈 — 左側堆疊 */}
              {zoneSegments.length > 1 && zoneSegments.map((seg, i) => (
                <VerticalDimensionLine
                  key={`zone-${i}`}
                  arrowId={`arr-${view}`}
                  x={-w / 2 - 28}
                  y1={seg.y1}
                  y2={seg.y2}
                  label={seg.label}
                />
              ))}
              {/* 板厚標註：頂板 + 底板（小字 + 引線） */}
              <g fontFamily="sans-serif" fill="#444" fontSize={10}>
                <text x={w / 2 + 4} y={-topBottomY - panelT / 2 - 2} textAnchor="start">
                  頂板 {panelT}
                </text>
                <text x={w / 2 + 4} y={-bottomTopY + panelT / 2 + 8} textAnchor="start">
                  底板 {panelT}
                </text>
              </g>
            </>
          );
        }
        if (view === "side") {
          return (
            <>
              {/* 內深 — 外深下方再加一條 */}
              <DimensionLine
                arrowId={`arr-${view}`}
                x1={-w / 2}
                x2={-w / 2 + innerD}
                y={drawAreaTop + h + 80}
                label={`內深 ${Math.round(innerD)} mm`}
              />
              {/* 內高 — 右側內側多一條 */}
              <VerticalDimensionLine
                arrowId={`arr-${view}`}
                x={w / 2 + 96}
                y1={-topBottomY}
                y2={-bottomTopY}
                label={`內 ${Math.round(innerH)} mm`}
              />
              {legHeight > 0 && (
                <VerticalDimensionLine
                  arrowId={`arr-${view}`}
                  x={w / 2 + 140}
                  y1={-legHeight}
                  y2={drawAreaTop + h}
                  label={`腳 ${Math.round(legHeight)}`}
                />
              )}
            </>
          );
        }
        if (view === "top") {
          // top view: x 軸 = 櫃寬（length），y 軸 = 櫃深（width / depth）
          // h = overall.width；drawAreaTop = -h/2
          return (
            <>
              {/* 內寬 — 下方再加一條 */}
              <DimensionLine
                arrowId={`arr-${view}`}
                x1={-w / 2 + panelT}
                x2={w / 2 - panelT}
                y={drawAreaTop + h + 80}
                label={`內 ${Math.round(innerW)} mm`}
              />
              {/* 內深 — 右側內側 */}
              <VerticalDimensionLine
                arrowId={`arr-${view}`}
                x={w / 2 + 96}
                y1={-h / 2}
                y2={-h / 2 + innerD}
                label={`內深 ${Math.round(innerD)}`}
              />
            </>
          );
        }
        return null;
      })()}

      {/* Orientation marker: the TOP view shows the furniture from above, so
          label which edge is the FRONT face (−Z in world) and which is BACK.
          Helps readers orient since top-view alone is ambiguous. */}
      {view === "top" && (
        <g fontFamily="sans-serif" fill="#666" fontSize={11}>
          <text
            x={0}
            y={drawAreaTop - 6}
            textAnchor="middle"
          >
            後 BACK
          </text>
          <text
            x={0}
            y={drawAreaTop + h + 110}
            textAnchor="middle"
          >
            前 FRONT
          </text>
        </g>
      )}

      {/* 比例尺：100mm 參考棒（per drafting-math.md §A3）
          位於圖框左下角，給讀者一個視覺基準快速估其他尺寸 */}
      <g fontFamily="sans-serif" fill="#666" stroke="#666" strokeWidth={0.3}>
        {(() => {
          const sx = frameX + 14;
          const sy = frameY + frameH - 14;
          const barLen = 100; // mm in SVG units (since viewBox is mm-based)
          return (
            <>
              {/* 主棒 */}
              <line x1={sx} y1={sy} x2={sx + barLen} y2={sy} strokeWidth={0.6} />
              {/* 兩端 + 中央 tick */}
              <line x1={sx} y1={sy - 4} x2={sx} y2={sy + 4} strokeWidth={0.6} />
              <line x1={sx + barLen / 2} y1={sy - 3} x2={sx + barLen / 2} y2={sy + 3} strokeWidth={0.4} />
              <line x1={sx + barLen} y1={sy - 4} x2={sx + barLen} y2={sy + 4} strokeWidth={0.6} />
              <text x={sx + barLen / 2} y={sy + 14} textAnchor="middle" fontSize={9} stroke="none" fill="#666">
                100 mm
              </text>
            </>
          );
        })()}
      </g>
    </svg>
  );
}

function DimensionLine({
  x1,
  x2,
  y,
  label,
  arrowId,
}: {
  x1: number;
  x2: number;
  y: number;
  label: string;
  arrowId: string;
}) {
  const ext = 8;
  // CNS 線寬分層：標註線 0.4（細），延伸線 0.25（更細），輪廓另由 part rendering 0.6+
  return (
    <g stroke="#111" fill="#111" strokeWidth={0.4} fontFamily="sans-serif">
      {/* extension lines */}
      <line x1={x1} y1={y - 16} x2={x1} y2={y + ext} strokeWidth={0.25} stroke="#888" />
      <line x1={x2} y1={y - 16} x2={x2} y2={y + ext} strokeWidth={0.25} stroke="#888" />
      {/* dim line with arrows at both ends */}
      <line
        x1={x1}
        y1={y}
        x2={x2}
        y2={y}
        markerStart={`url(#${arrowId})`}
        markerEnd={`url(#${arrowId})`}
      />
      <text
        x={(x1 + x2) / 2}
        y={y - 5}
        textAnchor="middle"
        fontSize={13}
        fontWeight="600"
        stroke="none"
      >
        {label}
      </text>
    </g>
  );
}

function VerticalDimensionLine({
  x,
  y1,
  y2,
  label,
  arrowId,
}: {
  x: number;
  y1: number;
  y2: number;
  label: string;
  arrowId: string;
}) {
  const ext = 8;
  return (
    <g stroke="#111" fill="#111" strokeWidth={0.4} fontFamily="sans-serif">
      <line x1={x - 16} y1={y1} x2={x + ext} y2={y1} strokeWidth={0.25} stroke="#888" />
      <line x1={x - 16} y1={y2} x2={x + ext} y2={y2} strokeWidth={0.25} stroke="#888" />
      <line
        x1={x}
        y1={y1}
        x2={x}
        y2={y2}
        markerStart={`url(#${arrowId})`}
        markerEnd={`url(#${arrowId})`}
      />
      <text
        x={x + 6}
        y={(y1 + y2) / 2}
        textAnchor="start"
        dominantBaseline="middle"
        fontSize={13}
        fontWeight="600"
        stroke="none"
      >
        {label}
      </text>
    </g>
  );
}

export function ThreeViewLayout({ design }: { design: FurnitureDesign }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="border border-zinc-200 rounded-lg overflow-hidden bg-white shadow-sm">
        <OrthoView design={design} view="front" title="正視圖" titleEn="FRONT VIEW" />
      </div>
      <div className="border border-zinc-200 rounded-lg overflow-hidden bg-white shadow-sm">
        <OrthoView design={design} view="side" title="側視圖" titleEn="SIDE VIEW" />
      </div>
      <div className="border border-zinc-200 rounded-lg overflow-hidden bg-white shadow-sm">
        <OrthoView design={design} view="top" title="俯視圖" titleEn="TOP VIEW" />
      </div>
    </div>
  );
}

/**
 * Compact three-view strip — 3 views side-by-side 固定小尺寸，給 A4 報價單用。
 * 每個 view 最大高度 ~28mm，3 個總寬度 ~70mm，可放進文件抬頭不佔太多版面。
 */
export function CompactThreeViews({ design }: { design: FurnitureDesign }) {
  return (
    <div className="flex gap-2 compact-three-views">
      <div className="flex-1 border border-zinc-300 rounded overflow-hidden bg-white">
        <OrthoView design={design} view="front" title="正視圖" titleEn="FRONT" />
      </div>
      <div className="flex-1 border border-zinc-300 rounded overflow-hidden bg-white">
        <OrthoView design={design} view="side" title="側視圖" titleEn="SIDE" />
      </div>
      <div className="flex-1 border border-zinc-300 rounded overflow-hidden bg-white">
        <OrthoView design={design} view="top" title="俯視圖" titleEn="TOP" />
      </div>
    </div>
  );
}

/**
 * 零件分類——用 id 前綴判斷屬於哪個結構分組，方便材料單視覺切分。
 * 順序即為顯示順序。
 */
export type PartCategory =
  | "case"       // 櫃體結構：頂底板、側板、背板
  | "divider"    // 層板 / 分隔板 / 中柱
  | "drawer"     // 抽屜組件
  | "door"       // 門組件
  | "apron"      // 牙板 / 橫撐（桌椅）
  | "seat"       // 座板 / 椅背板（椅）
  | "leg"        // 椅腳 / 桌腳 / 底座
  | "misc";

const CATEGORY_ORDER: PartCategory[] = [
  "case", "divider", "drawer", "door", "apron", "seat", "leg", "misc",
];

const CATEGORY_LABEL: Record<PartCategory, string> = {
  case: "🗄️ 櫃體結構",
  divider: "═ 層板 / 分隔板",
  drawer: "🧺 抽屜",
  door: "🚪 門",
  apron: "━ 牙板 / 橫撐",
  seat: "🪑 座板 / 椅背",
  leg: "🦵 腳 / 底座",
  misc: "⚙ 其他",
};

// 色碼分組：每個分類一個顯眼色，左側 4px 直條 + 標頭背景。
// 木工現場掃讀用，顏色選相近自然色（避免螢光色）。
const CATEGORY_COLOR: Record<
  PartCategory,
  { bar: string; head: string; text: string }
> = {
  case:    { bar: "bg-amber-500",   head: "bg-amber-50",   text: "text-amber-900"   },
  divider: { bar: "bg-orange-400",  head: "bg-orange-50",  text: "text-orange-900"  },
  drawer:  { bar: "bg-rose-400",    head: "bg-rose-50",    text: "text-rose-900"    },
  door:    { bar: "bg-fuchsia-400", head: "bg-fuchsia-50", text: "text-fuchsia-900" },
  apron:   { bar: "bg-lime-500",    head: "bg-lime-50",    text: "text-lime-900"    },
  seat:    { bar: "bg-emerald-500", head: "bg-emerald-50", text: "text-emerald-900" },
  leg:     { bar: "bg-sky-500",     head: "bg-sky-50",     text: "text-sky-900"     },
  misc:    { bar: "bg-zinc-400",    head: "bg-zinc-50",    text: "text-zinc-700"    },
};

export function categorizePart(id: string): PartCategory {
  // 抽屜組件：z*-drawer-N-face / front / back / side / bottom
  if (/^z?\d*-?drawer-?\d*-(face|front|back|side|bottom)/.test(id))
    return "drawer";
  if (/drawer-col-partition/.test(id)) return "divider";
  // 門組件
  if (/-door-.*-(rail|stile|panel|glass)/.test(id)) return "door";
  // 櫃體主結構
  if (id === "top" || id === "bottom" || id === "back") return "case";
  if (/^side-(left|right)$/.test(id)) return "case";
  // 分隔板 / 層板 / zone boundary / col partition
  if (
    /^shelf-/.test(id) ||
    /-shelf-/.test(id) ||
    /-divider-/.test(id) ||
    /-boundary/.test(id) ||
    /^col-partition/.test(id) ||
    /col-partition-/.test(id)
  )
    return "divider";
  // 牙板 / 橫撐
  if (
    /^apron/.test(id) ||
    /^stretcher/.test(id) ||
    /^ls-/.test(id) ||
    id === "center-stretcher" ||
    id === "back-rail" ||
    id === "back-top-rail"
  )
    return "apron";
  // 座板 / 椅背
  if (id === "seat" || /^seat-/.test(id)) return "seat";
  if (/^back-slat/.test(id) || /^back-splat/.test(id) || /^splat/.test(id))
    return "seat";
  if (/^slat/.test(id) || /^rung/.test(id)) return "seat";
  // 腳類 / 托腳牙 / 底座
  if (
    /^leg-/.test(id) ||
    /^bracket-/.test(id) ||
    /^plinth/.test(id) ||
    /^side-extension/.test(id)
  )
    return "leg";
  // 其他（吊衣桿、特殊件）
  return "misc";
}

export function MaterialList({ design }: { design: FurnitureDesign }) {
  let totalBdft = 0;
  const bdftByMaterial = new Map<string, number>();

  /**
   * 顯示用尺寸：將長/寬/厚依數值降冪排序輸出（最長→次長→最薄）。
   * 因為背板等零件 visible 欄位命名取自幾何軸而非木工語意，
   * length=innerW / width=backT / thickness=innerH 看起來會是 760×8×1460，
   * 直覺上應該是 1460×760×8（長寬厚）。統一排序讓使用者認材快速。
   */
  const sortDimsDesc = (l: number, w: number, t: number): [number, number, number] => {
    const arr = [l, w, t].sort((a, b) => b - a);
    return [arr[0], arr[1], arr[2]];
  };
  // 顯示尺寸時最多保留 1 位小數，整數就不顯示「.0」。
  // 木工現場 0.1mm 已是極限，130.66666666 這種沒意義反而難讀。
  const fmt = (n: number): string => {
    const rounded = Math.round(n * 10) / 10;
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  };

  const rows = design.parts.map((part) => {
    const cut = calculateCutDimensions(part);
    const isGlass = part.visual === "glass";
    const volMm3 = cut.length * cut.width * cut.thickness;
    // 玻璃不算木材材積（另向玻璃行訂製）；不累計 totalBdft / bdftByMaterial
    const bdft = isGlass ? 0 : volMm3 / MM3_PER_BDFT;
    if (!isGlass) totalBdft += bdft;
    // 拼板：顯示「桌面板 ×3 (each 200 × 1500 × 30mm)」讓學員按片下料
    const pieces = Math.max(1, Math.round(part.panelPieces ?? 1));

    const billable = effectiveBillableMaterial(part);
    const materialLabel = isGlass
      ? `${cut.thickness}mm 強化玻璃`
      : billable === "plywood" || billable === "mdf"
        ? `${MATERIALS[part.material].nameZh} / ${SHEET_GOOD_LABEL[billable]}`
        : MATERIALS[part.material].nameZh;

    if (!isGlass) {
      const groupKey =
        billable === "plywood" || billable === "mdf"
          ? SHEET_GOOD_LABEL[billable]
          : MATERIALS[part.material].nameZh;
      bdftByMaterial.set(groupKey, (bdftByMaterial.get(groupKey) ?? 0) + bdft);
    }

    const tenonNotes = isGlass
      ? "另向玻璃行訂製，不入裁切"
      : part.tenons.length
        ? part.tenons
            .map(
              (t) =>
                `${t.position} ${t.length}mm ${JOINERY_LABEL[t.type] ?? t.type}`,
            )
            .join("、")
        : "—";

    const category = categorizePart(part.id);

    return { part, cut, bdft, materialLabel, tenonNotes, category, isGlass, pieces };
  });

  // 依分類排序 + 每類內的原有順序（stable sort）
  // 玻璃單獨抽出來，不混在木材分類裡（玻璃行訂製，跟木工區隔）
  const byCategory = new Map<PartCategory, typeof rows>();
  const glassRows: typeof rows = [];
  for (const r of rows) {
    if (r.isGlass) {
      glassRows.push(r);
      continue;
    }
    if (!byCategory.has(r.category)) byCategory.set(r.category, []);
    byCategory.get(r.category)!.push(r);
  }
  const sortedCategories = CATEGORY_ORDER.filter((c) => byCategory.has(c));

  return (
    <table className="w-full text-sm">
      <thead className="bg-zinc-100">
        <tr>
          <th className="text-left p-2">零件</th>
          <th className="text-left p-2">材質</th>
          <th className="text-right p-2">可見長 × 寬 × 厚 (mm)</th>
          <th className="text-right p-2">切料尺寸 (mm)</th>
          <th className="text-right p-2">材積（板才）</th>
          <th className="text-left p-2">榫頭備註</th>
        </tr>
      </thead>
      {sortedCategories.map((cat) => {
        const catRows = byCategory.get(cat)!;
        const catBdft = catRows.reduce((s, r) => s + r.bdft, 0);
        const color = CATEGORY_COLOR[cat];
        return (
          <tbody key={cat} className="border-t-2 border-zinc-200">
            <tr className={color.head}>
              <td
                colSpan={4}
                className={`relative px-2 py-1.5 pl-3 text-xs font-semibold ${color.text}`}
              >
                <span className={`absolute left-0 top-0 bottom-0 w-1 ${color.bar}`} />
                {CATEGORY_LABEL[cat]}
                <span className="ml-2 font-normal opacity-60">
                  · {catRows.length} 件
                </span>
              </td>
              <td className={`px-2 py-1.5 text-right text-xs font-mono ${color.text}`}>
                {catBdft.toFixed(2)}
              </td>
              <td />
            </tr>
            {catRows.map(
              ({ part, cut, bdft, materialLabel, tenonNotes, pieces }) => {
                // 拼板：可見/切料寬度都先除以片數（單片實際尺寸），方便去料行下單
                const dispVw = part.visible.width / pieces;
                const dispCw = cut.width / pieces;
                const [vl, vw, vt] = sortDimsDesc(
                  part.visible.length,
                  dispVw,
                  part.visible.thickness,
                );
                const [cl, cw, ct] = sortDimsDesc(
                  cut.length,
                  dispCw,
                  cut.thickness,
                );
                const piecesPrefix = pieces > 1 ? `${pieces} 片 × ` : "";
                return (
                  <tr key={part.id} className="border-b border-zinc-100">
                    <td className="p-2 pl-3 relative">
                      <span className={`absolute left-0 top-0 bottom-0 w-1 ${color.bar} opacity-50`} />
                      {part.nameZh}
                      {pieces > 1 && (
                        <span className="ml-1 text-[10px] text-amber-700 bg-amber-100 px-1 rounded">
                          拼 {pieces} 片
                        </span>
                      )}
                    </td>
                    <td className="p-2">{materialLabel}</td>
                    <td className="p-2 text-right">
                      {piecesPrefix}{fmt(vl)} × {fmt(vw)} × {fmt(vt)}
                    </td>
                    <td className="p-2 text-right font-semibold">
                      {piecesPrefix}{fmt(cl)} × {fmt(cw)} × {fmt(ct)}
                    </td>
                    <td className="p-2 text-right font-mono">
                      {bdft.toFixed(2)}
                    </td>
                    <td className="p-2 text-xs text-zinc-600">{tenonNotes}</td>
                  </tr>
                );
              },
            )}
          </tbody>
        );
      })}
      {glassRows.length > 0 && (
        <tbody className="border-t-2 border-sky-300 bg-sky-50/30">
          <tr className="bg-sky-100/60">
            <td colSpan={4} className="px-2 py-1.5 text-xs font-semibold text-sky-900">
              🪟 玻璃（另向玻璃行訂製，不入裁切）
              <span className="ml-2 font-normal text-sky-700">· {glassRows.length} 片</span>
            </td>
            <td className="px-2 py-1.5 text-right text-xs font-mono text-sky-700">—</td>
            <td />
          </tr>
          <tr className="bg-sky-50/60">
            <td colSpan={6} className="px-3 py-1.5 text-[11px] text-sky-800 italic">
              ⚠️ 此尺寸僅供參考——實際應在門片做完、量過實際開口後再向玻璃行下單，
              避免框料切削誤差導致玻璃尺寸不合。
            </td>
          </tr>
          {glassRows.map(({ part, cut, materialLabel, tenonNotes }) => {
            const [vl, vw, vt] = sortDimsDesc(
              part.visible.length,
              part.visible.width,
              part.visible.thickness,
            );
            const [cl, cw, ct] = sortDimsDesc(cut.length, cut.width, cut.thickness);
            return (
              <tr key={part.id} className="border-b border-sky-100">
                <td className="p-2">{part.nameZh}</td>
                <td className="p-2">{materialLabel}</td>
                <td className="p-2 text-right">
                  {fmt(vl)} × {fmt(vw)} × {fmt(vt)}
                </td>
                <td className="p-2 text-right font-semibold">
                  {fmt(cl)} × {fmt(cw)} × {fmt(ct)}
                </td>
                <td className="p-2 text-right font-mono text-sky-600">—</td>
                <td className="p-2 text-xs text-sky-700">{tenonNotes}</td>
              </tr>
            );
          })}
        </tbody>
      )}
      <tfoot className="bg-zinc-100 border-t-2 border-zinc-400">
        <tr>
          <td className="p-2 font-semibold" colSpan={4}>
            合計
            <span className="ml-3 text-xs text-zinc-500 font-normal">
              {[...bdftByMaterial.entries()]
                .map(([k, v]) => `${k} ${v.toFixed(2)} 板才`)
                .join("　・　")}
            </span>
          </td>
          <td className="p-2 text-right font-mono font-semibold">
            {totalBdft.toFixed(2)}
          </td>
          <td className="p-2 text-xs text-zinc-500">未含 10% 切料損耗</td>
        </tr>
      </tfoot>
    </table>
  );
}
