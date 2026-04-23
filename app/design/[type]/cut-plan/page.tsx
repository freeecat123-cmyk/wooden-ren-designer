import Link from "next/link";
import { notFound } from "next/navigation";
import { getTemplate } from "@/lib/templates";
import { toBeginnerMode } from "@/lib/templates/beginner-mode";
import type { FurnitureCategory, MaterialId } from "@/lib/types";
import { MATERIALS } from "@/lib/materials";
import { computeNestPlan, DEFAULT_NEST_CONFIG } from "@/lib/cutplan";
import { CutPlanSection } from "@/components/cutplan/CutPlanSection";
import { CutPlanConfigForm } from "@/components/cutplan/CutPlanConfigForm";

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

  const lumberLengthsParam = spStr("lumberLengths");
  const lumberLengths = lumberLengthsParam
    ? lumberLengthsParam
        .split(",")
        .map((s) => Number(s))
        .filter((n) => Number.isFinite(n) && n > 0)
    : DEFAULT_NEST_CONFIG.lumberLengths;

  const sheetL = parseInt(spStr("sheetLength") ?? "") || DEFAULT_NEST_CONFIG.sheetSize.length;
  const sheetW = parseInt(spStr("sheetWidth") ?? "") || DEFAULT_NEST_CONFIG.sheetSize.width;
  const kerf = parseInt(spStr("kerf") ?? "") || DEFAULT_NEST_CONFIG.kerf;

  const config = {
    lumberLengths: lumberLengths.length > 0 ? lumberLengths : DEFAULT_NEST_CONFIG.lumberLengths,
    sheetSize: { length: sheetL, width: sheetW },
    kerf,
  };

  const plan = computeNestPlan(design, config);

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

  const totalLumberBins = plan.linearGroups.reduce((s, g) => s + g.bins.length, 0);
  const totalSheetBins = plan.sheetGroups.reduce((s, g) => s + g.bins.length, 0);

  return (
    <main className="max-w-6xl mx-auto px-6 py-10">
      <Link
        href={`/design/${type}?${designQuery.toString()}`}
        className="text-sm text-zinc-500 hover:underline"
      >
        ← 回{entry.nameZh}設計
      </Link>

      <header className="mt-4 mb-8">
        <h1 className="text-3xl font-bold">裁切計算器</h1>
        <p className="mt-1 text-sm text-zinc-600">
          {entry.nameZh}．{length} × {width} × {height} mm．
          {MATERIALS[material].nameZh}．
          實木 {totalLumberBins} 支原料、板材 {totalSheetBins} 張
        </p>
      </header>

      <CutPlanConfigForm
        type={type}
        designQuery={designQuery.toString()}
        lumberLengths={config.lumberLengths}
        sheetSize={config.sheetSize}
        kerf={config.kerf}
      />

      {plan.linearGroups.length === 0 && plan.sheetGroups.length === 0 ? (
        <div className="mt-8 p-6 bg-amber-50 text-amber-800 rounded-lg">
          這個設計沒有可排料的零件。
        </div>
      ) : (
        <div className="mt-8 space-y-10">
          {plan.linearGroups.map((g, i) => (
            <CutPlanSection key={`lumber-${i}`} kind="lumber" group={g} kerf={config.kerf} />
          ))}
          {plan.sheetGroups.map((g, i) => (
            <CutPlanSection key={`sheet-${i}`} kind="sheet" group={g} kerf={config.kerf} />
          ))}
        </div>
      )}
    </main>
  );
}
