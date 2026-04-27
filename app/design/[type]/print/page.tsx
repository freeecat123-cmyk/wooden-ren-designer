import { notFound } from "next/navigation";
import { getTemplate } from "@/lib/templates";
import { toBeginnerMode } from "@/lib/templates/beginner-mode";
import type {
  FurnitureCategory,
  FurnitureDesign,
  MaterialId,
} from "@/lib/types";
import { ThreeViewLayout, MaterialList } from "@/lib/render/svg-views";
import { MATERIALS } from "@/lib/materials";
import { extractJoineryUsages } from "@/lib/joinery/extract";
import {
  JoineryDetail,
  JOINERY_LABEL,
  JOINERY_DESCRIPTION,
} from "@/lib/joinery/details";
import { PrintToolList } from "@/components/print/PrintToolList";
import { PrintAccessGate, PrintWatermarkLayer } from "@/components/PrintAccessGate";
import {
  deriveBuildSteps,
  totalEstimatedHours,
  PHASE_LABEL,
} from "@/lib/steps/derive";
import { TOOL_CATALOG } from "@/lib/tools/catalog";
import { calculateCutDimensions } from "@/lib/geometry/cut-dimensions";

interface PageProps {
  params: Promise<{ type: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const DIFFICULTY_LABEL = {
  beginner: "入門",
  intermediate: "中階",
  advanced: "進階",
} as const;

export default async function PrintPage({ params, searchParams }: PageProps) {
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
  const rawDesign = entry.template({ length, width, height, material, options });
  const design = joineryMode ? rawDesign : toBeginnerMode(rawDesign);
  const usages = extractJoineryUsages(design);
  const steps = deriveBuildSteps(design);
  const totalHours = totalEstimatedHours(steps);
  const today = new Date().toISOString().slice(0, 10);
  const totalVolumeM3 = estimateTotalVolume(design);

  return (
    <main className="max-w-[210mm] mx-auto bg-white text-zinc-900 relative">
      {/* watermark — only renders in print via @media print */}
      <div className="print-watermark" aria-hidden>
        <span>木頭仁 · woodenren.com</span>
      </div>

      {/* 免費版螢幕浮水印（付費版自動隱藏） */}
      <PrintWatermarkLayer />

      {/* Top bar — hidden in print */}
      <div className="no-print sticky top-0 z-10 bg-zinc-50 border-b border-zinc-200 px-6 py-3 flex items-center justify-between">
        <p className="text-sm text-zinc-600">
          列印預覽（A4 直式）— 按下按鈕後在系統對話框選擇「另存為 PDF」
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
            alt="木頭仁"
            width={64}
            height={64}
            className="object-contain"
          />
          <div>
            <p className="text-xs text-zinc-500 tracking-widest">
              WOODEN REN · 木頭仁木匠學院
            </p>
            <p className="text-sm text-zinc-700">家具設計圖紙</p>
          </div>
        </header>

        <div className="flex-1 flex flex-col justify-center mt-12">
          <h1 className="text-6xl font-bold leading-tight">{entry.nameZh}</h1>
          <p className="mt-4 text-xl text-zinc-700">{entry.description}</p>

          <dl className="mt-12 grid grid-cols-2 gap-y-4 gap-x-12 text-base max-w-xl">
            <CoverField label="尺寸" value={`${length} × ${width} × ${height} mm`} />
            <CoverField label="木材" value={MATERIALS[material].nameZh} />
            <CoverField
              label="難度"
              value={DIFFICULTY_LABEL[entry.difficulty]}
            />
            <CoverField
              label="預估工時"
              value={`約 ${totalHours} 小時`}
            />
            <CoverField label="零件數" value={`${design.parts.length} 件`} />
            <CoverField
              label="預估材積"
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
          <span>設計編號：{design.id}</span>
          <span>產生日期：{today}</span>
        </footer>
      </section>

      {/* ================= Page 2: Three-view drawings ================= */}
      <section data-print-page className="px-10 py-12">
        <SectionHeading title="工程三視圖" subtitle="正視 / 側視 / 俯視" />
        <p className="text-xs text-zinc-500 mb-4">
          ⚠️ 標示為組裝後可見尺寸（肩到肩）。實際切料含榫頭，請看下一頁材料單。
        </p>
        <ThreeViewLayout design={design} />
      </section>

      {/* ================= Page 3: Material list ================= */}
      <section data-print-page className="px-10 py-12">
        <SectionHeading title="材料單" subtitle="切料尺寸已含榫頭凸出長度" />
        <div className="rounded border border-zinc-300 overflow-hidden">
          <MaterialList design={design} />
        </div>
        <p className="mt-3 text-xs text-zinc-500">
          總材積約 {totalVolumeM3.toFixed(3)} m³ · 母榫（凹）不影響零件外形尺寸 · 預留 5–10% 切料損耗
        </p>
      </section>

      {/* ================= Page 4+: Joinery details ================= */}
      {usages.length > 0 && (
        <section data-print-page className="px-10 py-12">
          <SectionHeading title="榫卯細節圖" subtitle={`共 ${usages.length} 種`} />
          <div className="space-y-6">
            {usages.map((u, i) => (
              <div key={i} className="print-keep border border-zinc-300 rounded p-4">
                <div className="flex items-baseline justify-between flex-wrap gap-2 mb-2">
                  <h3 className="font-semibold">
                    {JOINERY_LABEL[u.type]}{" "}
                    <span className="text-xs font-normal text-zinc-500">
                      · {u.partNameZh} ↔ {u.motherPartNames.length > 0 ? u.motherPartNames.join(" / ") : "接頭母件"} · 共 {u.count} 處
                    </span>
                  </h3>
                  <p className="text-xs text-zinc-500">
                    榫頭 {u.tenon.length} × {u.tenon.width} × {u.tenon.thickness} mm
                  </p>
                </div>
                <p className="text-xs text-zinc-600 mb-3">
                  {JOINERY_DESCRIPTION[u.type]}
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
                  }}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ================= Page N+: Tool list with QR ================= */}
      <section data-print-page className="px-10 py-12">
        <SectionHeading
          title="工具清單"
          subtitle="掃 QR 碼到木頭仁木匠商城購買"
        />
        <PrintToolList design={design} />
        <p className="mt-4 text-[10px] text-zinc-500">
          所有 QR 碼皆含 UTM 追蹤碼用以統計工具需求；點開連結將前往 woodenren.easy.co
        </p>
      </section>

      {/* ================= Page N+: Build steps ================= */}
      <section data-print-page className="px-10 py-12">
        <SectionHeading
          title="製作工序"
          subtitle={`共 ${steps.length} 步驟 · 預估 ${totalHours} 小時`}
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
                  {PHASE_LABEL[step.phase]}
                </span>
                <h3 className="font-semibold text-sm">{step.title}</h3>
                {step.estimatedMinutes && (
                  <span className="text-xs text-zinc-500 ml-auto">
                    約 {step.estimatedMinutes} 分鐘
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-700 leading-relaxed">
                {step.description}
              </p>
              {step.toolIds.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  <span className="text-[10px] text-zinc-500">工具：</span>
                  {step.toolIds.map((id) => {
                    const t = TOOL_CATALOG[id];
                    if (!t) return null;
                    return (
                      <span
                        key={id}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-700"
                      >
                        {t.nameZh}
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
        © 2026 木頭仁木匠學院 · woodenren.com · 設計編號 {design.id}
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
