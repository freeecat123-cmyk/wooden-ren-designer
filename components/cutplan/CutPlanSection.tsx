import type { LinearGroup, LumberInvGroup, SheetGroup } from "@/lib/cutplan";
import { MATERIALS } from "@/lib/materials";
import { LumberBinSvg } from "./LumberBinSvg";
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

export function CutPlanSection({
  kind,
  group,
  kerf,
}: {
  kind: "lumber" | "lumberInv" | "sheet";
  group: LinearGroup | LumberInvGroup | SheetGroup;
  kerf: number;
}) {
  if (kind === "lumber") {
    const g = group as LinearGroup;
    const title = `${MATERIALS[g.material]?.nameZh ?? g.material}．${g.width} × ${g.thickness} mm 橫截面`;
    return (
      <section>
        <header className="flex items-baseline justify-between mb-3">
          <h3 className="text-lg font-semibold">{title}</h3>
          <div className="text-sm text-zinc-600">
            {g.bins.length} 支原料．{g.pieces.length - g.unplaced.length}/
            {g.pieces.length} 件．利用率{" "}
            <span className="font-semibold">{(g.utilization * 100).toFixed(1)}%</span>
          </div>
        </header>
        {g.unplaced.length > 0 && <UnplacedNotice unplaced={g.unplaced} />}
        <div className="space-y-3">
          {g.bins.map((bin, i) => (
            <LumberBinSvg
              key={i}
              bin={bin}
              index={i + 1}
              kerf={kerf}
              colorFor={colorFor}
            />
          ))}
        </div>
      </section>
    );
  }

  if (kind === "lumberInv") {
    const g = group as LumberInvGroup;
    const title = `${MATERIALS[g.material]?.nameZh ?? g.material}．${g.thickness} mm 實木（多寬度 2D）`;
    return (
      <section>
        <header className="flex items-baseline justify-between mb-3">
          <h3 className="text-lg font-semibold">{title}</h3>
          <div className="text-sm text-zinc-600">
            {g.bins.length} 塊板才．{g.pieces.length - g.unplaced.length}/
            {g.pieces.length} 件．利用率{" "}
            <span className="font-semibold">{(g.utilization * 100).toFixed(1)}%</span>
          </div>
        </header>
        {g.unplaced.length > 0 && <UnplacedNotice unplaced={g.unplaced} />}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {g.bins.map((bin, i) => (
            <SheetBinSvg key={i} bin={bin} index={i + 1} colorFor={colorFor} />
          ))}
        </div>
      </section>
    );
  }

  const g = group as SheetGroup;
  const title = `${g.billable === "plywood" ? "夾板" : "中纖板"}．${g.thickness} mm（${g.representativeMaterialZh} 計）`;
  return (
    <section>
      <header className="flex items-baseline justify-between mb-3">
        <h3 className="text-lg font-semibold">{title}</h3>
        <div className="text-sm text-zinc-600">
          {g.bins.length} 張板．{g.pieces.length - g.unplaced.length}/
          {g.pieces.length} 件．利用率{" "}
          <span className="font-semibold">{(g.utilization * 100).toFixed(1)}%</span>
        </div>
      </header>
      {g.unplaced.length > 0 && <UnplacedNotice unplaced={g.unplaced} />}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {g.bins.map((bin, i) => (
          <SheetBinSvg
            key={i}
            bin={bin}
            index={i + 1}
            colorFor={colorFor}
          />
        ))}
      </div>
    </section>
  );
}

function UnplacedNotice({
  unplaced,
}: {
  unplaced: LinearGroup["unplaced"] | SheetGroup["unplaced"];
}) {
  return (
    <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800">
      <p className="font-semibold mb-1">
        ⚠️ {unplaced.length} 件排不下——庫存/尺寸不足
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
