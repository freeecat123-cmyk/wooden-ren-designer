"use client";

import { useTranslations, useLocale } from "next-intl";
import type { FurnitureDesign } from "@/lib/types";
import { calculateCutDimensions } from "@/lib/geometry/cut-dimensions";
import { MATERIALS, materialName } from "@/lib/materials";
import { JOINERY_LABEL } from "@/lib/joinery/details";
import {
  MM3_PER_BDFT,
  SHEET_GOOD_LABEL,
  effectiveBillableMaterial,
} from "@/lib/pricing/catalog";
import { useUnit } from "@/hooks/useUnit";
import { formatMm } from "@/lib/units/format";

interface Props {
  design: FurnitureDesign;
}

export function CsvExportButton({ design }: Props) {
  const t = useTranslations("csvExport");
  const locale = useLocale();
  const unit = useUnit();
  const download = () => {
    const rows: string[][] = [];
    rows.push([
      t("colPart"),
      t("colMaterial"),
      t("colVisL"),
      t("colVisW"),
      t("colVisT"),
      t("colCutL"),
      t("colCutW"),
      t("colCutT"),
      t("colBdft"),
      t("colTenon"),
    ]);

    // 尺寸依數值降冪排序輸出為 長/寬/厚，避免背板那類 visible 欄位
    // 命名順序跟木工語意不一致造成混淆（如 760×8×1460 應顯示為 1460×760×8）
    const sortDimsDesc = (a: number, b: number, c: number) =>
      [a, b, c].sort((x, y) => y - x);

    for (const part of design.parts) {
      if (part.visual !== undefined) continue;
      const cut = calculateCutDimensions(part);
      const bdft = (cut.length * cut.width * cut.thickness) / MM3_PER_BDFT;
      const billable = effectiveBillableMaterial(part);
      const matName = materialName(part.material, locale);
      const materialLabel =
        billable === "plywood" || billable === "mdf"
          ? `${matName} / ${SHEET_GOOD_LABEL[billable]}`
          : matName;

      const tenonNotes = part.tenons.length
        ? part.tenons
            .map(
              (t) =>
                `${t.position} ${formatMm(t.length, unit)} ${JOINERY_LABEL[t.type] ?? t.type}`,
            )
            .join("；")
        : "";

      const [vl, vw, vt] = sortDimsDesc(
        part.visible.length,
        part.visible.width,
        part.visible.thickness,
      );
      const [cl, cw, ct] = sortDimsDesc(cut.length, cut.width, cut.thickness);

      rows.push([
        part.nameZh,
        materialLabel,
        String(vl),
        String(vw),
        String(vt),
        String(cl),
        String(cw),
        String(ct),
        bdft.toFixed(3),
        tenonNotes,
      ]);
    }

    // UTF-8 BOM 讓 Excel 正確顯示中文
    const bom = "\ufeff";
    const csv =
      bom +
      rows
        .map((r) =>
          r
            .map((cell) => {
              // 有逗號/引號/換行就加引號包起來，引號要 escape
              const needQuote = /[",\n\r]/.test(cell);
              const escaped = cell.replace(/"/g, '""');
              return needQuote ? `"${escaped}"` : escaped;
            })
            .join(","),
        )
        .join("\r\n");

    const today = new Date().toISOString().slice(0, 10);
    const fname = t("filenameTpl", { name: design.nameZh, date: today });

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fname;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <button
      type="button"
      onClick={download}
      className="mt-4 inline-flex items-center gap-1 px-3 py-1.5 text-xs border border-zinc-300 rounded bg-white hover:bg-zinc-50 text-zinc-700"
    >
      {t("btn")}
    </button>
  );
}
