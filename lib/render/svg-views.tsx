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
  isPartHidden,
  projectPart,
  projectPartPolygon,
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
      return {
        id: p.id,
        nameZh: p.nameZh,
        bottomY: p.origin.y,
        topY: p.origin.y + yExt,
        yExt,
      };
    })
    .sort((a, b) => a.bottomY - b.bottomY);

  // 腳：取所有 id 開頭為 leg- 的件（俯視圖用來標腳跨距 / 腳粗）
  const legs = design.parts.filter((p) => /^leg-?\d*$/.test(p.id));
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
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#111" />
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
          (part.shape?.kind === "round" || part.shape?.kind === "round-tapered") &&
          view === "top"
        ) {
          const r = projectPart(part, view);
          const cx = r.x + r.w / 2;
          const cy = r.y + r.h / 2;
          const radius = Math.min(r.w, r.h) / 2;
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
        // Use polygon when the shape is non-box AND it would differ from a rect
        // in this view.
        const useShape =
          part.shape &&
          part.shape.kind !== "box" &&
          part.shape.kind !== "round" &&
          !(view === "top" && part.shape.kind !== "splayed");
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
                y={r.y + part.shape.dzMm}
                width={r.w}
                height={r.h}
                fill="none"
                stroke="#888"
                strokeWidth={0.4}
                strokeDasharray="3 3"
              />,
            );
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
        return (
          <rect
            key={part.id}
            x={r.x}
            y={view === "top" ? r.y : -r.y - r.h}
            width={r.w}
            height={r.h}
            fill="none"
            stroke={stroke}
            strokeWidth={sw}
            strokeDasharray={dash}
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

      {/* horizontal dimension below */}
      <DimensionLine
        arrowId={`arr-${view}`}
        x1={-w / 2}
        x2={w / 2}
        y={drawAreaTop + h + 28}
        label={`${w} mm`}
      />

      {/* vertical dimension on right side (all views) */}
      <VerticalDimensionLine
        arrowId={`arr-${view}`}
        x={w / 2 + 28}
        y1={view === "top" ? -h / 2 : -h}
        y2={view === "top" ? h / 2 : 0}
        label={`${h} mm`}
      />

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
        } = dims;
        const sFloor = drawAreaTop + h;

        // ===== 桌椅 / 凳子 / 茶几（無 cabinet 部分）=====
        if (!cabinet) {
          if (view === "top") {
            // 俯視圖：腳間距（X / Z）+ 腳粗
            if (!legFootprint) return null;
            const { minX, maxX, minZ, maxZ, legSize } = legFootprint;
            return (
              <>
                {/* 腳間距 X 方向（前緣下方再畫一條） */}
                <DimensionLine
                  arrowId={`arr-${view}`}
                  x1={minX}
                  x2={maxX}
                  y={drawAreaTop + h + 80}
                  label={`腳跨距 ${Math.round(maxX - minX)} mm`}
                />
                {/* 腳間距 Z 方向（右側內側多一條） */}
                <VerticalDimensionLine
                  arrowId={`arr-${view}`}
                  x={w / 2 + 96}
                  y1={minZ}
                  y2={maxZ}
                  label={`腳跨距 ${Math.round(maxZ - minZ)} mm`}
                />
                {/* 腳粗（小字標在第一根腳旁邊） */}
                <text
                  x={minX + legSize / 2 + 4}
                  y={minZ - 4}
                  fontSize={10}
                  fill="#444"
                  fontFamily="sans-serif"
                >
                  腳 {legSize}×{legSize}
                </text>
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
              {/* cross-pieces 厚度（橫撐 / 牙板 / 椅背）— 各自右側標小字 */}
              {crossPieces.map((c) => (
                <text
                  key={`xp-thick-${c.id}`}
                  x={w / 2 + 4}
                  y={-(c.bottomY + c.yExt / 2) + 4}
                  fontSize={10}
                  fill="#444"
                  fontFamily="sans-serif"
                >
                  {c.nameZh} {Math.round(c.yExt)}
                </text>
              ))}
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
  return (
    <g stroke="#111" fill="#111" strokeWidth={0.6} fontFamily="sans-serif">
      {/* extension lines */}
      <line x1={x1} y1={y - 16} x2={x1} y2={y + ext} strokeWidth={0.4} stroke="#666" />
      <line x1={x2} y1={y - 16} x2={x2} y2={y + ext} strokeWidth={0.4} stroke="#666" />
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
    <g stroke="#111" fill="#111" strokeWidth={0.6} fontFamily="sans-serif">
      <line x1={x - 16} y1={y1} x2={x + ext} y2={y1} strokeWidth={0.4} stroke="#666" />
      <line x1={x - 16} y1={y2} x2={x + ext} y2={y2} strokeWidth={0.4} stroke="#666" />
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

    return { part, cut, bdft, materialLabel, tenonNotes, category, isGlass };
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
        return (
          <tbody key={cat} className="border-t-2 border-zinc-200">
            <tr className="bg-zinc-50/80">
              <td
                colSpan={4}
                className="px-2 py-1.5 text-xs font-semibold text-zinc-700"
              >
                {CATEGORY_LABEL[cat]}
                <span className="ml-2 font-normal text-zinc-400">
                  · {catRows.length} 件
                </span>
              </td>
              <td className="px-2 py-1.5 text-right text-xs font-mono text-zinc-600">
                {catBdft.toFixed(2)}
              </td>
              <td />
            </tr>
            {catRows.map(
              ({ part, cut, bdft, materialLabel, tenonNotes }) => {
                const [vl, vw, vt] = sortDimsDesc(
                  part.visible.length,
                  part.visible.width,
                  part.visible.thickness,
                );
                const [cl, cw, ct] = sortDimsDesc(
                  cut.length,
                  cut.width,
                  cut.thickness,
                );
                return (
                  <tr key={part.id} className="border-b border-zinc-100">
                    <td className="p-2">{part.nameZh}</td>
                    <td className="p-2">{materialLabel}</td>
                    <td className="p-2 text-right">
                      {fmt(vl)} × {fmt(vw)} × {fmt(vt)}
                    </td>
                    <td className="p-2 text-right font-semibold">
                      {fmt(cl)} × {fmt(cw)} × {fmt(ct)}
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
