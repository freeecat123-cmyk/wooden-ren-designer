import { notFound, redirect } from "next/navigation";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { isPaidUser } from "@/lib/userProfile";
import { getTemplate, getEntryName, getEntryDescription } from "@/lib/templates";
import { toBeginnerMode } from "@/lib/templates/beginner-mode";
import { applyEdgeProtection } from "@/lib/joinery/edge-protection";
import type {
  FurnitureCategory,
  FurnitureDesign,
  MaterialId,
} from "@/lib/types";
import { ThreeViewLayout, MaterialList } from "@/lib/render/svg-views";
import { MATERIALS, materialName } from "@/lib/materials";
import { taipeiIsoDate } from "@/lib/utils/date-tw";
import { extractJoineryUsages } from "@/lib/joinery/extract";
import {
  JoineryDetail,
  joineryLabel,
  joineryDescription,
} from "@/lib/joinery/details";
import { PrintToolList } from "@/components/print/PrintToolList";
import { PrintPartDrawings } from "@/components/print/PrintPartDrawings";
import { PartDrawingsIndex } from "@/components/print/PartDrawingsIndex";
import { isLocalhost } from "@/lib/dev-only";
import { PrintTemplates } from "@/components/print/PrintTemplates";
import { getUnitFromCookies } from "@/lib/units/server-unit";
import { formatDimensions } from "@/lib/units/format";
import { PrintAccessGate, PrintWatermarkLayer } from "@/components/PrintAccessGate";
import {
  deriveBuildSteps,
  totalEstimatedHours,
  phaseLabel,
} from "@/lib/steps/derive";
import { translateSteps } from "@/lib/steps/translations";
import { TOOL_CATALOG, toolName } from "@/lib/tools/catalog";
import { calculateCutDimensions } from "@/lib/geometry/cut-dimensions";
import { routing } from "@/i18n/routing";

interface PageProps {
  params: Promise<{ locale: string; type: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const DIFFICULTY_LABEL_ZH = {
  beginner: "入門",
  intermediate: "中階",
  advanced: "進階",
} as const;

const DIFFICULTY_LABEL_EN = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
} as const;

export default async function PrintPage({ params, searchParams }: PageProps) {
  const { locale: rawLocale, type } = await params;
  const locale = rawLocale === "en" ? "en" : routing.defaultLocale;
  const isEn = locale === "en";
  const DIFFICULTY_LABEL = isEn ? DIFFICULTY_LABEL_EN : DIFFICULTY_LABEL_ZH;
  const sp = await searchParams;

  const entry = getTemplate(type as FurnitureCategory);
  if (!entry || !entry.template) notFound();

  // server-side paid gate：未登入導 /login、未付費導 /pricing
  // 不能只靠 PrintAccessGate（DevTools 砍 blur 就破）
  // session 取自 cookie（middleware 已驗 JWT），無 HTTP roundtrip
  const user = await getSessionUser();
  const supabase = await createClient();
  const prefix = rawLocale === "en" ? "/en" : "";
  if (!user) {
    redirect(`${prefix}/login?next=${encodeURIComponent(`${prefix}/design/${type}/print`)}`);
  }
  if (!(await isPaidUser(user.id))) {
    redirect(`${prefix}/pricing?locked=${encodeURIComponent(type)}`);
  }

  const spStr = (k: string): string | undefined => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const length = parseInt(spStr("length") ?? "") || entry.defaults.length;
  const width = parseInt(spStr("width") ?? "") || entry.defaults.width;
  const height = parseInt(spStr("height") ?? "") || entry.defaults.height;
  const material = (spStr("material") as MaterialId) ?? "pine";

  const options: Record<string, string | number | boolean> = {};
  for (const spec of entry.optionSchema ?? []) {
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

  // 預設為「組裝版」（無榫卯）。傳統榫接要明確加 joineryMode=true。
  // 舊 URL 若帶 beginnerMode=false 視為開啟榫接模式（相容）。
  const joineryMode =
    spStr("joineryMode") === "true" ||
    spStr("joineryMode") === "1" ||
    spStr("beginnerMode") === "false";
  const unit = await getUnitFromCookies(rawLocale);
  const rawDesign = entry.template({ length, width, height, material, options, locale: rawLocale });
  const design = joineryMode
    ? applyEdgeProtection(rawDesign)
    : toBeginnerMode(rawDesign);
  const usages = extractJoineryUsages(design);
  const steps = translateSteps(deriveBuildSteps(design), design, locale);
  const totalHours = totalEstimatedHours(steps);
  const today = taipeiIsoDate();
  const totalVolumeM3 = estimateTotalVolume(design);

  return (
    <main className="max-w-[210mm] mx-auto bg-white text-zinc-900 relative">
      {/* watermark — only renders in print via @media print */}
      <div className="print-watermark" aria-hidden>
        <span>{isEn ? "Wooden Ren · woodenren.com" : "木頭仁 · woodenren.com"}</span>
      </div>

      {/* 免費版螢幕浮水印（付費版自動隱藏） */}
      <PrintWatermarkLayer />

      {/* Top bar — hidden in print */}
      <div className="no-print sticky top-0 z-10 bg-zinc-50 border-b border-zinc-200 px-6 py-3 flex items-center justify-between">
        <p className="text-sm text-zinc-600">
          {isEn
            ? "Print preview (A4 portrait) — choose 'Save as PDF' in the system dialog"
            : "列印預覽（A4 直式）— 按下按鈕後在系統對話框選擇「另存為 PDF」"}
        </p>
        <PrintAccessGate />
      </div>

      {/* ================= Page 1: Cover ================= */}
      <section
        data-print-page
        className="px-10 py-16 min-h-[260mm] flex flex-col"
      >
        <header className="flex items-center gap-4">
          {/* Logo: drop wooden-ren-designer/public/logo.png to enable image */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt={isEn ? "Wooden Ren" : "木頭仁"}
            width={64}
            height={64}
            className="object-contain"
          />
          <div>
            <p className="text-xs text-zinc-500 tracking-widest">
              {isEn ? "WOODEN REN · CARPENTER ACADEMY" : "WOODEN REN · 木頭仁木匠學院"}
            </p>
            <p className="text-sm text-zinc-700">{isEn ? "Furniture shop drawings" : "家具設計圖紙"}</p>
          </div>
        </header>

        <div className="flex-1 flex flex-col justify-center mt-12">
          <h1 className="text-6xl font-bold leading-tight">{getEntryName(entry, locale)}</h1>
          <p className="mt-4 text-xl text-zinc-700">{getEntryDescription(entry, locale) ?? ""}</p>

          <dl className="mt-12 grid grid-cols-2 gap-y-4 gap-x-12 text-base max-w-xl">
            <CoverField label={isEn ? "Size" : "尺寸"} value={formatDimensions(length, width, height, unit)} />
            <CoverField label={isEn ? "Wood" : "木材"} value={materialName(material, locale)} />
            <CoverField
              label={isEn ? "Difficulty" : "難度"}
              value={DIFFICULTY_LABEL[entry.difficulty]}
            />
            <CoverField
              label={isEn ? "Estimated time" : "預估工時"}
              value={isEn ? `~${totalHours} hours` : `約 ${totalHours} 小時`}
            />
            <CoverField label={isEn ? "Parts" : "零件數"} value={isEn ? `${design.parts.length} parts` : `${design.parts.length} 件`} />
            <CoverField
              label={isEn ? "Est. volume" : "預估材積"}
              value={`${totalVolumeM3.toFixed(3)} m³`}
            />
          </dl>

          {design.notes && (
            <p className="mt-12 text-sm text-zinc-600 leading-relaxed border-l-2 border-zinc-300 pl-4">
              {design.notes}
            </p>
          )}
        </div>

        <footer className="mt-auto pt-8 border-t border-zinc-200 text-xs text-zinc-500 flex justify-between">
          <span>{isEn ? `Design ID: ${design.id}` : `設計編號：${design.id}`}</span>
          <span>{isEn ? `Generated: ${today}` : `產生日期：${today}`}</span>
        </footer>
      </section>

      {/* ================= Page 2: Three-view drawings ================= */}
      <section data-print-page className="px-10 py-12">
        <SectionHeading
          title={isEn ? "Engineering views" : "工程三視圖"}
          subtitle={isEn ? "Front / side / top" : "正視 / 側視 / 俯視"}
        />
        <p className="text-xs text-zinc-500 mb-4">
          {isEn
            ? "⚠️ Dimensions shown are shoulder-to-shoulder, post-assembly. Cut sizes include tenon stock — see the cut list on the next page."
            : "⚠️ 標示為組裝後可見尺寸（肩到肩）。實際切料含榫頭，請看下一頁材料單。"}
        </p>
        <ThreeViewLayout design={design} joineryMode={joineryMode} locale={locale} />
      </section>

      {/* ================= Page 3: Material list ================= */}
      <section data-print-page className="px-10 py-12">
        <SectionHeading
          title={isEn ? "Cut list" : "材料單"}
          subtitle={isEn ? "Cut sizes include tenon stock" : "切料尺寸已含榫頭凸出長度"}
        />
        <div className="rounded border border-zinc-300 overflow-hidden">
          <MaterialList design={design} locale={locale} />
        </div>
        <p className="mt-3 text-xs text-zinc-500">
          {isEn
            ? `Total volume ~${totalVolumeM3.toFixed(3)} m³ · mortises don't affect outer dimensions · leave 5–10% trim waste`
            : `總材積約 ${totalVolumeM3.toFixed(3)} m³ · 母榫（凹）不影響零件外形尺寸 · 預留 5–10% 切料損耗`}
        </p>
      </section>

      {/* ================= Page 4+: Joinery details ================= */}
      {usages.length > 0 && (
        <section data-print-page className="px-10 py-12">
          <SectionHeading
            title={isEn ? "Joinery details" : "榫卯細節圖"}
            subtitle={isEn ? `${usages.length} joint types` : `共 ${usages.length} 種`}
          />
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2 mb-4">
            {isEn
              ? "⚠ Schematic only — actual dimensions may vary; refer to the engineering views"
              : "⚠ 僅為組合參考示意圖，跟實際尺寸可能不合，請參考三視圖詳細尺寸"}
          </p>
          <div className="space-y-6">
            {usages.map((u, i) => (
              <div key={i} className="print-keep border border-zinc-300 rounded p-4">
                <div className="flex items-baseline justify-between flex-wrap gap-2 mb-2">
                  <h3 className="font-semibold">
                    {joineryLabel(u.type, locale)}{" "}
                    <span className="text-xs font-normal text-zinc-500">
                      · {u.partNameZh} ↔ {u.motherPartNames.length > 0 ? u.motherPartNames.join(" / ") : (isEn ? "mother part" : "接頭母件")} · {isEn ? `× ${u.count}` : `共 ${u.count} 處`}
                    </span>
                  </h3>
                  <p className="text-xs text-zinc-500">
                    {isEn ? "Tenon" : "榫頭"} {formatDimensions(u.tenon.length, u.tenon.width, u.tenon.thickness, unit)}
                  </p>
                </div>
                <p className="text-xs text-zinc-600 mb-3">
                  {joineryDescription(u.type, locale)}
                </p>
                <JoineryDetail
                  type={u.type}
                  params={{
                    tenonLength: u.tenon.length,
                    tenonWidth: u.tenon.width,
                    tenonThickness: u.tenon.thickness,
                    motherThickness: u.estimatedMotherThickness,
                    childThickness: u.childThickness,
                    childWidth: u.childWidth,
                    motherShape: u.motherShape,
                    material: design.parts.find((part) => part.id === u.partId)?.material ?? material,
                  }}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 零件圖 / 索引：目前僅 localhost 顯示（方凳零件圖暫時隱藏） */}
      {(await isLocalhost()) && (
        <>
          {/* ================= Page N+: Part drawings index (零件清單索引) ================= */}
          <PartDrawingsIndex design={design} locale={locale} />

          {/* ================= Page N+: Part drawings (零件圖) ================= */}
          <PrintPartDrawings design={design} locale={locale} unit={unit} />
        </>
      )}

      {/* ================= Page N+: 1:1 樣板列印頁 ================= */}
      <PrintTemplates design={design} locale={locale} />

      {/* ================= Page N+: Tool list with QR ================= */}
      <section data-print-page className="px-10 py-12">
        <SectionHeading
          title={isEn ? "Tool list" : "工具清單"}
          subtitle={isEn ? "Scan QR codes to buy from the Wooden Ren store" : "掃 QR 碼到木頭仁木匠商城購買"}
        />
        <PrintToolList design={design} locale={locale} />
        <p className="mt-4 text-[10px] text-zinc-500">
          {isEn
            ? "All QR codes embed UTM tracking so we can prioritize stocking; links go to woodenren.easy.co"
            : "所有 QR 碼皆含 UTM 追蹤碼用以統計工具需求；點開連結將前往 woodenren.easy.co"}
        </p>
      </section>

      {/* ================= Page N+: Build steps ================= */}
      <section data-print-page className="px-10 py-12">
        <SectionHeading
          title={isEn ? "Build steps" : "製作工序"}
          subtitle={isEn ? `${steps.length} steps · ~${totalHours} hours` : `共 ${steps.length} 步驟 · 預估 ${totalHours} 小時`}
        />
        <ol className="space-y-3">
          {steps.map((step, i) => (
            <li
              key={step.id}
              className="print-keep border border-zinc-300 rounded p-3"
            >
              <div className="flex items-baseline gap-2 flex-wrap mb-1">
                <span className="text-xs font-mono text-zinc-400">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-700">
                  {phaseLabel(step.phase, locale)}
                </span>
                <h3 className="font-semibold text-sm">{step.title}</h3>
                {step.estimatedMinutes && (
                  <span className="text-xs text-zinc-500 ml-auto">
                    {isEn ? `~${step.estimatedMinutes} min` : `約 ${step.estimatedMinutes} 分鐘`}
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-700 leading-relaxed">
                {step.description}
              </p>
              {step.toolIds.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  <span className="text-[10px] text-zinc-500">{isEn ? "Tools:" : "工具："}</span>
                  {step.toolIds.map((id) => {
                    const t = TOOL_CATALOG[id];
                    if (!t) return null;
                    return (
                      <span
                        key={id}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-700"
                      >
                        {toolName(t, locale)}
                      </span>
                    );
                  })}
                </div>
              )}
              {step.warnings && step.warnings.length > 0 && (
                <ul className="mt-2 space-y-0.5">
                  {step.warnings.map((w, j) => (
                    <li
                      key={j}
                      className="text-[10px] text-amber-800 border-l-2 border-amber-400 pl-2"
                    >
                      ⚠️ {w}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ol>
      </section>

      {/* Bottom footer (print only) */}
      <footer className="px-10 py-6 text-center text-[10px] text-zinc-500 border-t border-zinc-200">
        {isEn
          ? `© 2026 Wooden Ren Carpenter Academy · woodenren.com · Design ID ${design.id}`
          : `© 2026 木頭仁木匠學院 · woodenren.com · 設計編號 ${design.id}`}
      </footer>
    </main>
  );
}

function SectionHeading({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-4 pb-2 border-b-2 border-zinc-900">
      <h2 className="text-2xl font-bold">{title}</h2>
      {subtitle && <p className="text-xs text-zinc-500 mt-0.5">{subtitle}</p>}
    </div>
  );
}

function CoverField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-zinc-500">{label}</dt>
      <dd className="font-semibold">{value}</dd>
    </div>
  );
}

function estimateTotalVolume(design: FurnitureDesign): number {
  let mm3 = 0;
  for (const part of design.parts) {
    const cut = calculateCutDimensions(part);
    mm3 += cut.length * cut.width * cut.thickness;
  }
  return mm3 / 1_000_000_000;
}
