import Link from "next/link";
import { notFound } from "next/navigation";
import { getTemplate } from "@/lib/templates";
import { toBeginnerMode } from "@/lib/templates/beginner-mode";
import { applyEdgeProtection } from "@/lib/joinery/edge-protection";
import type { FurnitureCategory } from "@/lib/types";
import { MATERIALS } from "@/lib/materials";
import {
  DEFAULT_NEST_CONFIG,
  buildCutPieces,
} from "@/lib/cutplan";
import { collapseIntoSpecs } from "@/lib/cutplan/piece-spec";
import { CutPlanApp } from "@/components/cutplan/CutPlanApp";
import {
  parseDesignSearchParams,
  designParamsToQuery,
} from "@/lib/design/parse-search-params";

interface PageProps {
  params: Promise<{ type: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CutPlanPage({ params, searchParams }: PageProps) {
  const { type } = await params;
  const sp = await searchParams;

  const entry = getTemplate(type as FurnitureCategory);
  if (!entry || !entry.template) notFound();

  const parsed = parseDesignSearchParams(sp, entry);
  const { length, width, height, material, options, joineryMode } = parsed;

  const rawDesign = entry.template({ length, width, height, material, options });
  const design = joineryMode
    ? applyEdgeProtection(rawDesign)
    : toBeginnerMode(rawDesign);

  const { lumberGroups, sheetGroups } = buildCutPieces(design);
  // 旋轉預設不勾——使用者可在零件清單個別勾。原本為 sheet 強制 allowRotate:true
  // 是想自動最大化板材利用率，但實際使用上會把零件方向轉錯。
  const allPieces = [
    ...Array.from(lumberGroups.values()).flat(),
    ...Array.from(sheetGroups.values()).flat(),
  ];
  const initialSpecs = collapseIntoSpecs(allPieces);

  const designQuery = designParamsToQuery(parsed, entry);

  return (
    <main className="max-w-7xl mx-auto px-6 py-6 print:px-0 print:py-4 cutplan-print">
      <Link
        href={`/design/${type}?${designQuery.toString()}`}
        className="text-sm text-zinc-500 hover:underline no-print"
      >
        ← 回{entry.nameZh}設計
      </Link>

      <header className="mt-2 mb-4 no-print">
        <h1 className="text-2xl font-bold">裁切計算器</h1>
        <p className="mt-0.5 text-xs text-zinc-500">
          {entry.nameZh} · {length}×{width}×{height}mm · {MATERIALS[material].nameZh}．左邊輸入庫存 → 右邊立刻看排料圖
        </p>
      </header>

      <CutPlanApp
        initialSpecs={initialSpecs}
        initialConfig={DEFAULT_NEST_CONFIG}
        entryNameZh={`${entry.nameZh} ${length}×${width}×${height}mm ${MATERIALS[material].nameZh}`}
      />
    </main>
  );
}
