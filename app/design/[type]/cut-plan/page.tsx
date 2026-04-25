import Link from "next/link";
import { notFound } from "next/navigation";
import { getTemplate } from "@/lib/templates";
import { toBeginnerMode } from "@/lib/templates/beginner-mode";
import type { FurnitureCategory, MaterialId } from "@/lib/types";
import { MATERIALS } from "@/lib/materials";
import {
  DEFAULT_NEST_CONFIG,
  buildCutPieces,
} from "@/lib/cutplan";
import { collapseIntoSpecs } from "@/lib/cutplan/piece-spec";
import { CutPlanApp } from "@/components/cutplan/CutPlanApp";

interface PageProps {
  params: Promise<{ type: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CutPlanPage({ params, searchParams }: PageProps) {
  const { type } = await params;
  const sp = await searchParams;

  const entry = getTemplate(type as FurnitureCategory);
  if (!entry || !entry.template) notFound();

  const spStr = (k: string): string | undefined => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  };

  const length = parseInt(spStr("length") ?? "") || entry.defaults.length;
  const width = parseInt(spStr("width") ?? "") || entry.defaults.width;
  const height = parseInt(spStr("height") ?? "") || entry.defaults.height;
  const material = (spStr("material") as MaterialId) ?? "maple";

  const options: Record<string, string | number | boolean> = {};
  const optionSchema = entry.optionSchema ?? [];
  for (const spec of optionSchema) {
    const raw = spStr(spec.key);
    if (raw === undefined || raw === "") {
      options[spec.key] = spec.defaultValue;
      continue;
    }
    if (spec.type === "number") {
      const n = Number(raw);
      options[spec.key] = Number.isFinite(n) ? n : spec.defaultValue;
    } else if (spec.type === "checkbox") {
      options[spec.key] = raw === "true" || raw === "on" || raw === "1";
    } else {
      options[spec.key] = raw;
    }
  }

  const joineryMode =
    spStr("joineryMode") === "true" || spStr("joineryMode") === "1";
  const rawDesign = entry.template({ length, width, height, material, options });
  const design = joineryMode ? rawDesign : toBeginnerMode(rawDesign);

  const { lumberGroups, sheetGroups } = buildCutPieces(design);
  const allPieces = [
    ...Array.from(lumberGroups.values()).flat(),
    ...Array.from(sheetGroups.values()).flat().map((p) => ({ ...p, allowRotate: true })),
  ];
  const initialSpecs = collapseIntoSpecs(allPieces);

  const designQuery = new URLSearchParams({
    length: String(length),
    width: String(width),
    height: String(height),
    material,
  });
  for (const spec of optionSchema) {
    designQuery.set(spec.key, String(options[spec.key]));
  }
  if (joineryMode) designQuery.set("joineryMode", "true");

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
