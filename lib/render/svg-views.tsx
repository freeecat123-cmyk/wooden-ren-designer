import type { FurnitureDesign, Part } from "@/lib/types";
import { calculateCutDimensions } from "@/lib/geometry/cut-dimensions";
import { MATERIALS } from "@/lib/materials";
import { JOINERY_LABEL } from "@/lib/joinery/details";
import { worldExtents } from "@/lib/render/geometry";

interface ViewProps {
  design: FurnitureDesign;
}

const PADDING = 60;
const DIM_OFFSET = 35;

function projectPart(part: Part, view: "front" | "side" | "top") {
  const { x, y, z } = part.origin;
  const { xExt, yExt, zExt } = worldExtents(part);
  if (view === "front") {
    return { x: x - xExt / 2, y, w: xExt, h: yExt };
  }
  if (view === "side") {
    return { x: z - zExt / 2, y, w: zExt, h: yExt };
  }
  // top
  return { x: x - xExt / 2, y: z - zExt / 2, w: xExt, h: zExt };
}

function partFill(part: Part) {
  return MATERIALS[part.material].color;
}

/** Single orthographic view (正視/側視/俯視) */
function OrthoView({
  design,
  view,
  title,
}: ViewProps & { view: "front" | "side" | "top"; title: string }) {
  const { overall } = design;
  const w = view === "side" ? overall.width : overall.length;
  const h = view === "top" ? overall.width : overall.thickness;

  const vbW = w + PADDING * 2;
  const vbH = h + PADDING * 2 + DIM_OFFSET;

  // Front/side views flip Y so +height points up (parts rendered at y = -r.y - r.h
  // land in the range [-h, 0]). ViewBox Y origin must start at -h-PADDING to include
  // them; top view uses natural SVG Y so it starts at -PADDING.
  const vbY = view === "top" ? -PADDING : -h - PADDING;

  return (
    <svg
      viewBox={`${-PADDING - w / 2} ${vbY} ${vbW} ${vbH}`}
      preserveAspectRatio="xMidYMid meet"
      className="bg-white border border-zinc-300 w-full h-auto max-h-[70vh]"
    >
      <text
        x={-w / 2}
        y={vbY + PADDING / 2}
        fontSize={12}
        fill="#333"
        fontWeight="bold"
      >
        {title}
      </text>

      {/* parts */}
      {design.parts.map((part) => {
        const r = projectPart(part, view);
        return (
          <rect
            key={part.id}
            x={r.x}
            y={view === "top" ? r.y : -r.y - r.h}
            width={r.w}
            height={r.h}
            fill={partFill(part)}
            stroke="#222"
            strokeWidth={0.6}
            opacity={0.85}
          />
        );
      })}

      {/* outer dimension (assembled, solid black) — below the drawing */}
      <DimensionLine
        x1={-w / 2}
        x2={w / 2}
        y={view === "top" ? overall.width / 2 + 20 : 20}
        label={`${w} mm`}
      />
      {/* vertical dimension for front/side views */}
      {view !== "top" && (
        <VerticalDimensionLine
          x={w / 2 + 20}
          y1={-h}
          y2={0}
          label={`${h} mm`}
        />
      )}
    </svg>
  );
}

function DimensionLine({
  x1,
  x2,
  y,
  label,
}: {
  x1: number;
  x2: number;
  y: number;
  label: string;
}) {
  const tick = 5;
  return (
    <g stroke="#111" fill="#111" strokeWidth={0.5}>
      <line x1={x1} y1={y} x2={x2} y2={y} />
      <line x1={x1} y1={y - tick} x2={x1} y2={y + tick} />
      <line x1={x2} y1={y - tick} x2={x2} y2={y + tick} />
      <text
        x={(x1 + x2) / 2}
        y={y - 6}
        textAnchor="middle"
        fontSize={10}
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
}: {
  x: number;
  y1: number;
  y2: number;
  label: string;
}) {
  const tick = 5;
  return (
    <g stroke="#111" fill="#111" strokeWidth={0.5}>
      <line x1={x} y1={y1} x2={x} y2={y2} />
      <line x1={x - tick} y1={y1} x2={x + tick} y2={y1} />
      <line x1={x - tick} y1={y2} x2={x + tick} y2={y2} />
      <text
        x={x + 8}
        y={(y1 + y2) / 2}
        textAnchor="start"
        dominantBaseline="middle"
        fontSize={10}
        stroke="none"
      >
        {label}
      </text>
    </g>
  );
}

export function ThreeViewLayout({ design }: { design: FurnitureDesign }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div>
        <h3 className="text-sm font-semibold mb-2">正視圖（Front）</h3>
        <OrthoView design={design} view="front" title="正視圖" />
      </div>
      <div>
        <h3 className="text-sm font-semibold mb-2">側視圖（Side）</h3>
        <OrthoView design={design} view="side" title="側視圖" />
      </div>
      <div>
        <h3 className="text-sm font-semibold mb-2">俯視圖（Top）</h3>
        <OrthoView design={design} view="top" title="俯視圖" />
      </div>
    </div>
  );
}

export function MaterialList({ design }: { design: FurnitureDesign }) {
  return (
    <table className="w-full text-sm">
      <thead className="bg-zinc-100">
        <tr>
          <th className="text-left p-2">零件</th>
          <th className="text-left p-2">材質</th>
          <th className="text-right p-2">可見長 × 寬 × 厚 (mm)</th>
          <th className="text-right p-2">切料尺寸 (mm)</th>
          <th className="text-left p-2">榫頭備註</th>
        </tr>
      </thead>
      <tbody>
        {design.parts.map((part) => {
          const cut = calculateCutDimensions(part);
          const tenonNotes = part.tenons.length
            ? part.tenons
                .map(
                  (t) =>
                    `${t.position} ${t.length}mm ${JOINERY_LABEL[t.type] ?? t.type}`,
                )
                .join("、")
            : "—";
          return (
            <tr key={part.id} className="border-b border-zinc-200">
              <td className="p-2">{part.nameZh}</td>
              <td className="p-2">{MATERIALS[part.material].nameZh}</td>
              <td className="p-2 text-right">
                {part.visible.length} × {part.visible.width} × {part.visible.thickness}
              </td>
              <td className="p-2 text-right font-semibold">
                {cut.length} × {cut.width} × {cut.thickness}
              </td>
              <td className="p-2 text-xs text-zinc-600">{tenonNotes}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
