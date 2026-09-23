"use client";

import { useTranslations, useLocale } from "next-intl";
import type { StockGroup, StockItem } from "@/lib/cutplan";
import { MATERIALS, materialName } from "@/lib/materials";
import { SheetBinSvg } from "./SheetBinSvg";
import { colorForCode } from "@/lib/cutplan/colors";
import { formatLengthBare } from "@/lib/units/format";

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
  const t = useTranslations("cutPlanSection");
  const locale = useLocale();
  const kindLabel = (kind: StockGroup["kind"]): string => {
    if (kind === "plywood") return t("kindPlywood");
    if (kind === "mdf") return t("kindMdf");
    return t("kindSolid");
  };
  const matLabel =
    group.kind === "solid"
      ? group.material && MATERIALS[group.material]
        ? materialName(group.material, locale)
        : group.material ?? ""
      : kindLabel(group.kind);
  const thicknesses = Array.from(new Set(group.pieces.map((p) => p.thickness)))
    .sort((a, b) => b - a);
  const isEn = locale === "en";
  const thicknessLabel = isEn
    ? `${thicknesses.map((t) => formatLengthBare(t, "inch")).join(" / ")} in`
    : `${thicknesses.join(" / ")} mm`;
  const title =
    thicknesses.length > 0
      ? `${matLabel}．${thicknessLabel}`
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
          {t("stockStatsTpl", {
            bins: group.bins.length,
            placed: group.pieces.length - group.unplaced.length,
            total: group.pieces.length,
            pct: (group.utilization * 100).toFixed(1),
          })}
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
        <div
          className={`grid gap-4 print:gap-2 ${
            group.bins.length === 1 ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2"
          }`}
        >
          {group.bins.map((bin, i) => (
            <div key={i} className="print:break-inside-avoid" data-cutplan-board={i + 1}>
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
  const t = useTranslations("cutPlanSection");
  const locale = useLocale();
  const isEn = locale === "en";
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
    const estimated = Math.ceil(unplacedArea / (refStock.length * refStock.width * 0.75));
    shortageMsg = t("shortageTpl", { n: estimated, l: refStock.length, w: refStock.width });
  }
  return (
    <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800">
      <p className="font-semibold mb-1">
        {t("unplacedHTpl", { n: unplaced.length })}
      </p>
      {shortageMsg && (
        <p className="text-xs mb-1 font-semibold text-red-900">{shortageMsg}</p>
      )}
      <ul className="text-xs space-y-1 ml-1">
        {unplaced.map((p, i) => (
          <li key={i} className="flex items-baseline gap-2">
            <span className="text-red-400">·</span>
            {p.code && (
              <span className="inline-block font-mono font-bold">
                [{p.code}]
              </span>
            )}
            <span>
              {isEn ? p.partNameEn : p.partNameZh}（{p.length} × {p.width} × {p.thickness}）
            </span>
            {onSplitSpec && (
              <button
                type="button"
                onClick={() => onSplitSpec(p.partId)}
                className="ml-auto text-[10px] px-2 py-0.5 rounded border border-red-300 text-red-700 bg-white hover:bg-red-100"
                title={t("splitTitle")}
              >
                {t("splitBtn")}
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
