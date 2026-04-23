"use client";

import type { FurnitureDesign } from "@/lib/types";
import { calculateCutDimensions } from "@/lib/geometry/cut-dimensions";
import { MATERIALS } from "@/lib/materials";
import { JOINERY_LABEL } from "@/lib/joinery/details";
import {
  MM3_PER_BDFT,
  SHEET_GOOD_LABEL,
  effectiveBillableMaterial,
} from "@/lib/pricing/catalog";

interface Props {
  design: FurnitureDesign;
}

export function CsvExportButton({ design }: Props) {
  const download = () => {
    const rows: string[][] = [];
    rows.push([
      "零件",
      "材質",
      "可見長 (mm)",
      "可見寬 (mm)",
      "可見厚 (mm)",
      "切料長 (mm)",
      "切料寬 (mm)",
      "切料厚 (mm)",
      "材積 (板才)",
      "榫頭備註",
    ]);

    for (const part of design.parts) {
      if (part.visual === "glass") continue;
      const cut = calculateCutDimensions(part);
      const bdft = (cut.length * cut.width * cut.thickness) / MM3_PER_BDFT;
      const billable = effectiveBillableMaterial(part);
      const materialLabel =
        billable === "plywood" || billable === "mdf"
          ? `${MATERIALS[part.material].nameZh} / ${SHEET_GOOD_LABEL[billable]}`
          : MATERIALS[part.material].nameZh;

      const tenonNotes = part.tenons.length
        ? part.tenons
            .map(
              (t) =>
                `${t.position} ${t.length}mm ${JOINERY_LABEL[t.type] ?? t.type}`,
            )
            .join("；")
        : "";

      rows.push([
        part.nameZh,
        materialLabel,
        String(part.visible.length),
        String(part.visible.width),
        String(part.visible.thickness),
        String(cut.length),
        String(cut.width),
        String(cut.thickness),
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
    const fname = `${design.nameZh}_材料單_${today}.csv`;

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
      📋 材料單 CSV 下載
    </button>
  );
}
