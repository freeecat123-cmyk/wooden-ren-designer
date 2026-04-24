import type { StockGroup } from "@/lib/cutplan";
import { MATERIALS } from "@/lib/materials";
import { SheetBinSvg } from "./SheetBinSvg";

const PART_COLORS = [
  "#fde68a", "#fca5a5", "#a5f3fc", "#bef264", "#c4b5fd",
  "#f9a8d4", "#fdba74", "#86efac", "#93c5fd", "#f0abfc",
];

function colorFor(partId: string): string {
  let h = 0;
  for (let i = 0; i < partId.length; i++) h = (h * 31 + partId.charCodeAt(i)) >>> 0;
  return PART_COLORS[h % PART_COLORS.length];
}

function kindLabel(kind: StockGroup["kind"]): string {
  if (kind === "plywood") return "夾板";
  if (kind === "mdf") return "中纖板";
  return "實木";
}

export function CutPlanSection({
  group,
}: {
  group: StockGroup;
}) {
  const matLabel =
    group.kind === "solid"
      ? MATERIALS[group.material!]?.nameZh ?? group.material
      : kindLabel(group.kind);
  // 厚度集合——同一組可能有多種厚度零件（由實體板材刨到所需厚度）
  const thicknesses = Array.from(new Set(group.pieces.map((p) => p.thickness)))
    .sort((a, b) => b - a);
  const title =
    thicknesses.length > 0
      ? `${matLabel}．${thicknesses.join(" / ")} mm`
      : matLabel;

  return (
    <section>
      <header className="flex items-baseline justify-between mb-3">
        <h3 className="text-lg font-semibold flex items-baseline gap-2">
          {title}
          <span className="text-[10px] font-normal px-1.5 py-0.5 bg-zinc-100 text-zinc-500 rounded">
            {kindLabel(group.kind)}
          </span>
        </h3>
        <div className="text-sm text-zinc-600">
          {group.bins.length} 塊原料．{group.pieces.length - group.unplaced.length}/
          {group.pieces.length} 件．利用率{" "}
          <span className="font-semibold">{(group.utilization * 100).toFixed(1)}%</span>
        </div>
      </header>
      {group.unplaced.length > 0 && <UnplacedNotice unplaced={group.unplaced} />}
      {group.bins.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {group.bins.map((bin, i) => (
            <SheetBinSvg key={i} bin={bin} index={i + 1} colorFor={colorFor} />
          ))}
        </div>
      )}
    </section>
  );
}

function UnplacedNotice({
  unplaced,
}: {
  unplaced: StockGroup["unplaced"];
}) {
  return (
    <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800">
      <p className="font-semibold mb-1">
        ⚠️ {unplaced.length} 件排不下——庫存不足或原料尺寸不夠大
      </p>
      <ul className="text-xs ml-4 list-disc">
        {unplaced.map((p, i) => (
          <li key={i}>
            {p.partNameZh}（{p.length} × {p.width} × {p.thickness}）
          </li>
        ))}
      </ul>
    </div>
  );
}
