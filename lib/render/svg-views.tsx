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
  type OrthoView,
} from "@/lib/render/geometry";

interface ViewProps {
  design: FurnitureDesign;
}

const PADDING = 90;
const DIM_OFFSET = 50;
const TITLE_BAR_H = 32;

function partFill(part: Part) {
  return MATERIALS[part.material].color;
}

/** Single orthographic view with engineering-drawing frame and dim lines */
function OrthoView({
  design,
  view,
  title,
  titleEn,
}: ViewProps & {
  view: OrthoView;
  title: string;
  titleEn: string;
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
      className="bg-white w-full h-auto max-h-[70vh]"
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
        const poly = projectPartPolygon(part, view);
        if (part.shape && part.shape.kind === "tapered" && view !== "top") {
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
        label={`${w}`}
      />

      {/* vertical dimension on right side (all views) */}
      <VerticalDimensionLine
        arrowId={`arr-${view}`}
        x={w / 2 + 28}
        y1={view === "top" ? -h / 2 : -h}
        y2={view === "top" ? h / 2 : 0}
        label={`${h}`}
      />
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
        fontSize={11}
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
        fontSize={11}
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

export function MaterialList({ design }: { design: FurnitureDesign }) {
  let totalBdft = 0;
  const bdftByMaterial = new Map<string, number>();

  const rows = design.parts.map((part) => {
    const cut = calculateCutDimensions(part);
    const volMm3 = cut.length * cut.width * cut.thickness;
    const bdft = volMm3 / MM3_PER_BDFT;
    totalBdft += bdft;

    const billable = effectiveBillableMaterial(part);
    const materialLabel =
      billable === "plywood" || billable === "mdf"
        ? `${MATERIALS[part.material].nameZh} / ${SHEET_GOOD_LABEL[billable]}`
        : MATERIALS[part.material].nameZh;

    const groupKey =
      billable === "plywood" || billable === "mdf"
        ? SHEET_GOOD_LABEL[billable]
        : MATERIALS[part.material].nameZh;
    bdftByMaterial.set(groupKey, (bdftByMaterial.get(groupKey) ?? 0) + bdft);

    const tenonNotes = part.tenons.length
      ? part.tenons
          .map(
            (t) =>
              `${t.position} ${t.length}mm ${JOINERY_LABEL[t.type] ?? t.type}`,
          )
          .join("、")
      : "—";

    return { part, cut, bdft, materialLabel, tenonNotes };
  });

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
      <tbody>
        {rows.map(({ part, cut, bdft, materialLabel, tenonNotes }) => (
          <tr key={part.id} className="border-b border-zinc-200">
            <td className="p-2">{part.nameZh}</td>
            <td className="p-2">{materialLabel}</td>
            <td className="p-2 text-right">
              {part.visible.length} × {part.visible.width} × {part.visible.thickness}
            </td>
            <td className="p-2 text-right font-semibold">
              {cut.length} × {cut.width} × {cut.thickness}
            </td>
            <td className="p-2 text-right font-mono">
              {bdft.toFixed(2)}
            </td>
            <td className="p-2 text-xs text-zinc-600">{tenonNotes}</td>
          </tr>
        ))}
      </tbody>
      <tfoot className="bg-zinc-50 border-t-2 border-zinc-300">
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
