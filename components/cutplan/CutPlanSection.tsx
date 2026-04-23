import type { LinearGroup, SheetGroup } from "@/lib/cutplan";
import { MATERIALS } from "@/lib/materials";
import { LumberBinSvg } from "./LumberBinSvg";
import { SheetBinSvg } from "./SheetBinSvg";

/** 給每個零件一個穩定色（同 partId 同色，跨 bin 辨識同一件） */
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
  kind: "lumber" | "sheet";
  group: LinearGroup | SheetGroup;
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
            {g.bins.length} 支原料．{g.pieces.length} 件．利用率{" "}
            <span className="font-semibold">{(g.utilization * 100).toFixed(1)}%</span>
          </div>
        </header>
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

  const g = group as SheetGroup;
  const title = `${g.billable === "plywood" ? "夾板" : "中纖板"}．${g.thickness} mm（${g.representativeMaterialZh} 計）`;
  return (
    <section>
      <header className="flex items-baseline justify-between mb-3">
        <h3 className="text-lg font-semibold">{title}</h3>
        <div className="text-sm text-zinc-600">
          {g.bins.length} 張板．{g.pieces.length} 件．利用率{" "}
          <span className="font-semibold">{(g.utilization * 100).toFixed(1)}%</span>
        </div>
      </header>
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
