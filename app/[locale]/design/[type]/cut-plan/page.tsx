import { Link } from "@/i18n/navigation";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { isPaidUser } from "@/lib/userProfile";
import { getTemplate, getEntryName } from "@/lib/templates";
import { toBeginnerMode } from "@/lib/templates/beginner-mode";
import { applyEdgeProtection } from "@/lib/joinery/edge-protection";
import type { FurnitureCategory } from "@/lib/types";
import { materialName } from "@/lib/materials";
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
import { getUnitFromCookies } from "@/lib/units/server-unit";
import { formatDimensions } from "@/lib/units/format";

interface PageProps {
  params: Promise<{ locale: string; type: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CutPlanPage({ params, searchParams }: PageProps) {
  const { locale, type } = await params;
  const t = await getTranslations({ locale, namespace: "cutPlan" });
  const sp = await searchParams;

  const entry = getTemplate(type as FurnitureCategory);
  if (!entry || !entry.template) notFound();

  // dev-only：playwright shoot-output 腳本繞過 paywall 抓所有家具排板圖
  const isThumbShoot =
    process.env.NODE_ENV === "development" && sp._shoot === "1";

  // server-side paid gate — session 取自 cookie（middleware 已驗 JWT），無 HTTP
  const user = await getSessionUser();
  const supabase = await createClient();
  if (!isThumbShoot) {
    const prefix = locale === "en" ? "/en" : "";
    if (!user) {
      redirect(`${prefix}/login?next=${encodeURIComponent(`${prefix}/design/${type}/cut-plan`)}`);
    }
    if (!(await isPaidUser(user.id))) {
      redirect(`${prefix}/pricing?locked=${encodeURIComponent(type)}`);
    }
  }

  const parsed = parseDesignSearchParams(sp, entry);
  const { length, width, height, material, options, joineryMode } = parsed;

  const rawDesign = entry.template({ length, width, height, material, options, locale });
  const unit = await getUnitFromCookies(locale);
  const dims = formatDimensions(length, width, height, unit);
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
  const initialSpecs = collapseIntoSpecs(allPieces, locale);

  const designQuery = designParamsToQuery(parsed, entry);
  const entryName = getEntryName(entry, locale);
  const matName = materialName(material, locale);

  return (
    <main className="max-w-7xl mx-auto px-6 py-6 print:px-0 print:py-4 cutplan-print">
      <Link
        href={`/design/${type}?${designQuery.toString()}`}
        className="text-sm text-zinc-500 hover:underline no-print"
      >
        {t("backLink", { name: entryName })}
      </Link>

      <header className="mt-2 mb-4 no-print">
        <h1 className="text-2xl font-bold">{t("h1")}</h1>
        <p className="mt-0.5 text-xs text-zinc-500">
          {t("subtitle", { name: entryName, length, width, height, material: matName })}
        </p>
      </header>

      <CutPlanApp
        initialSpecs={initialSpecs}
        initialConfig={DEFAULT_NEST_CONFIG}
        entryNameZh={`${entryName} ${dims} ${matName}`}
      />
    </main>
  );
}
