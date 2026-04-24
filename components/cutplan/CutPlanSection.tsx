import type { StockGroup, StockItem } from "@/lib/cutplan";
import { MATERIALS } from "@/lib/materials";
import { SheetBinSvg } from "./SheetBinSvg";
import { colorForCode } from "@/lib/cutplan/colors";

function kindLabel(kind: StockGroup["kind"]): string {
  if (kind === "plywood") return "夾板";
  if (kind === "mdf") return "中纖板";
  return "實木";
}

export function CutPlanSection({
  group,
  inventory = [],
}: {
  group: StockGroup;
  inventory?: StockItem[];
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
      <header className="flex items-baseline justify-between mb-3 print:mb-1">
        <h3 className="text-lg font-semibold flex items-baseline gap-2 print:text-sm">
          {title}
          <span className="text-[10px] font-normal px-1.5 py-0.5 bg-zinc-100 text-zinc-500 rounded">
            {kindLabel(group.kind)}
          </span>
        </h3>
        <div className="text-sm text-zinc-600 print:text-xs">
          {group.bins.length} 塊原料．{group.pieces.length - group.unplaced.length}/
          {group.pieces.length} 件．利用率{" "}
          <span className="font-semibold">{(group.utilization * 100).toFixed(1)}%</span>
        </div>
      </header>
      {group.unplaced.length > 0 && (
        <UnplacedNotice
          unplaced={group.unplaced}
          group={group}
          inventory={inventory}
        />
      )}
      {group.bins.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 print:gap-2">
          {group.bins.map((bin, i) => (
            <div key={i} className="print:break-inside-avoid">
              <SheetBinSvg
                bin={bin}
                index={i + 1}
                colorFor={(piece) => colorForCode(piece.code ?? piece.partId)}
              />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function UnplacedNotice({
  unplaced,
  group,
  inventory,
}: {
  unplaced: StockGroup["unplaced"];
  group: StockGroup;
  inventory: StockItem[];
}) {
  // 估算還需要多少塊板——以「該 kind/material 已用過的原料平均面積」或
  // 「庫存裡該類最常見的規格」推估；用 1.2 倍利用率寬鬆抓
  const matching = inventory.filter((s) => {
    if (s.kind !== group.kind) return false;
    if (group.kind === "solid" && s.material !== group.material) return false;
    return true;
  });
  const refStock =
    matching[0] ??
    (group.bins[0]
      ? { length: group.bins[0].stockLength, width: group.bins[0].stockWidth }
      : null);
  const unplacedArea = unplaced.reduce(
    (s, p) => s + p.length * p.width,
    0,
  );
  let shortageMsg: string | null = null;
  if (refStock && unplacedArea > 0) {
    // 利用率以 0.75 抓（邊角會浪費），ceil 向上取整
    const estimated = Math.ceil(unplacedArea / (refStock.length * refStock.width * 0.75));
    shortageMsg = `估計還需要約 ${estimated} 塊 ${refStock.length}×${refStock.width}mm 原料`;
  }
  return (
    <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800">
      <p className="font-semibold mb-1">
        ⚠️ {unplaced.length} 件排不下——庫存不足或原料尺寸不夠大
      </p>
      {shortageMsg && (
        <p className="text-xs mb-1 font-semibold text-red-900">🧮 {shortageMsg}</p>
      )}
      <ul className="text-xs ml-4 list-disc">
        {unplaced.map((p, i) => (
          <li key={i}>
            {p.code && (
              <span className="inline-block font-mono font-bold mr-1">
                [{p.code}]
              </span>
            )}
            {p.partNameZh}（{p.length} × {p.width} × {p.thickness}）
          </li>
        ))}
      </ul>
    </div>
  );
}
