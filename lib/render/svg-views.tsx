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
        // Use polygon when the shape is non-box AND it would differ from a rect
        // in this view.
        const useShape =
          part.shape &&
          part.shape.kind !== "box" &&
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
            y={drawAreaTop + h + 50}
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
type PartCategory =
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

function categorizePart(id: string): PartCategory {
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
