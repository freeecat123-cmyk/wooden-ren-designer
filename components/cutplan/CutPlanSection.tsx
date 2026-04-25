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
  onSplitSpec,
}: {
  group: StockGroup;
  inventory?: StockItem[];
  /** 點排不下零件旁的「✂ 分割」時，傳回該零件的 spec id 給上層處理 */
  onSplitSpec?: (specId: string) => void;
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
          onSplitSpec={onSplitSpec}
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
  onSplitSpec,
}: {
  unplaced: StockGroup["unplaced"];
  group: StockGroup;
  inventory: StockItem[];
  onSplitSpec?: (specId: string) => void;
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
      <ul className="text-xs space-y-1 ml-1">
        {unplaced.map((p, i) => {
          // partId 形如 "spec-abc123-2"（quantity > 1）或 "spec-abc123"（quantity === 1）
          // 拼板分割產生的 id 帶 -s0/-s1 後綴，要保留；只剝最末段的純數字 -N。
          const specId = p.partId.replace(/-\d+$/, "");
          return (
            <li key={i} className="flex items-baseline gap-2">
              <span className="text-red-400">·</span>
              {p.code && (
                <span className="inline-block font-mono font-bold">
                  [{p.code}]
                </span>
              )}
              <span>
                {p.partNameZh}（{p.length} × {p.width} × {p.thickness}）
              </span>
              {onSplitSpec && (
                <button
                  type="button"
                  onClick={() => onSplitSpec(specId)}
                  className="ml-auto text-[10px] px-2 py-0.5 rounded border border-red-300 text-red-700 bg-white hover:bg-red-100"
                  title="拼板分割：把寬度拆成 N 條，多板拼合（自動加 10mm 膠合損耗）"
                >
                  ✂ 分割
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
