"use client";

import { useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { LazyPerspectiveView } from "@/components/LazyPerspectiveView";
import { ZoomableThreeViews } from "@/components/ZoomableThreeViews";
import { ZoomableJoineryDetail } from "@/components/ZoomableJoineryDetail";
import { extractJoineryUsages } from "@/lib/joinery/extract";
import { joineryLabel, joineryDescription } from "@/lib/joinery/details";
import { MaterialListWithSelection } from "@/components/MaterialListWithSelection";
import { ToolList } from "@/components/ToolList";
import { BuildSteps } from "@/components/BuildSteps";
import { StylePresetButtons } from "@/components/design/StylePresetButtons";
import { SizePresetButtons } from "@/components/design/SizePresetButtons";
import { DesignFormShell } from "@/components/design/DesignFormShell";
import { PartDrawingsPanel } from "@/components/design/PartDrawingsPanel";
import { useUnit } from "@/hooks/useUnit";
import { formatDimensions } from "@/lib/units/format";
import { SaveDesignButton } from "@/components/SaveDesignButton";
import { SelectedPartProvider } from "@/components/SelectedPartContext";
import { HoveredPartsProvider } from "@/components/HoveredPartsContext";
import { MobileTopBar } from "./MobileTopBar";
import { StickyBottomBar } from "./StickyBottomBar";
import { CollapsibleSection } from "./CollapsibleSection";
import { AdvancedSheet } from "./AdvancedSheet";
import { MobileOverflowMenu } from "./MobileOverflowMenu";
import { MobileOptionField, evalDep } from "./MobileOptionField";
import { RangeInput } from "./RangeInput";
import type { FurnitureCatalogEntry } from "@/lib/templates";
import type { FurnitureDesign, MaterialId, OptionSpec } from "@/lib/types";
import { MATERIALS } from "@/lib/materials";
import { SCENE_THEME_LIST, SCENE_THEMES, type SceneThemeId } from "@/lib/design/scene-themes";
import { groupSpecsByGroup, groupLabel } from "@/lib/design/option-groups";
import { resolvePartIds } from "@/lib/design/option-part-map";

// FurnitureCatalogEntry contains a `template` function that cannot be
// serialised when passing from Server → Client Component. MobileShell
// only needs the plain-data fields, so we Omit the function.
type SerializableEntry = Omit<FurnitureCatalogEntry, "template">;

interface MobileShellProps {
  entry: SerializableEntry;
  design: FurnitureDesign;
  length: number;
  width: number;
  height: number;
  material: MaterialId;
  optionValues: Record<string, string | number | boolean>;
  totalPrice: number;
  weight: number;
  designUrl: string;
  quoteUrl: string;
  cutPlanUrl: string;
  printUrl: string;
  lineShareText: string;
  formAction: string;
  currentDesignId?: string | null;
  wireframeMode?: boolean;
  joineryMode?: boolean;
  designerMode?: boolean;
  canUseDesignerMode?: boolean;
  /** 範例預覽鎖：免費版進付費模板時鎖尺寸/結構選項，只能換材料 */
  previewLocked?: boolean;
  /** 初始場景 ID（由 server 從 URL ?scene= 解析後傳入） */
  sceneId?: SceneThemeId;
  /** 掀蓋浮起 mm；正 = 抬起，-1 = 鉸鏈翻開。從 URL ?lidLift= 解析後傳入 */
  lidLiftMm?: number;
  /** 爆炸視圖偏移 mm（joineryMode 才有意義） */
  explodeMm?: number;
  /** X-ray 透視模式 */
  xrayMode?: "off" | "face" | "full";
}

export function MobileShell(props: MobileShellProps) {
  const t = useTranslations("mobile");
  const locale = useLocale();
  const isEn = locale === "en";
  const unit = useUnit();
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [overflowOpen, setOverflowOpen] = useState(false);

  // 場景切換：URL ?scene= 控制，初始值由 server 傳入；
  // 手機端用 client-side router.replace 讓 3D 立即反應（無需重新整理）。
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [activeSceneId, setActiveSceneId] = useState<SceneThemeId>(
    props.sceneId ?? "natural",
  );

  const handleSceneSelect = (id: SceneThemeId) => {
    setActiveSceneId(id);
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    if (id === "natural") {
      params.delete("scene");
    } else {
      params.set("scene", id);
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname ?? ""}?${qs}` : (pathname ?? ""), { scroll: false });
  };

  const activeSceneTheme = SCENE_THEMES[activeSceneId];

  const { entry, design, length, width, height, material, optionValues, formAction } = props;
  const previewLocked = props.previewLocked ?? false;
  // 範例預覽鎖：尺寸/選項包進 disabled fieldset（不進 FormData → 不送出），材料留外面可改。
  // 不用 pointer-events-none：使用者仍能打開「進階設定」瀏覽有哪些可調項目（看得到、改不了）。
  const lockCls = previewLocked
    ? "min-w-0 border-0 m-0 p-0 opacity-70 select-none"
    : "min-w-0 border-0 m-0 p-0";
  const pricingHref = `${isEn ? "/en" : ""}/pricing?locked=${entry.category}`;
  // 進階設定 sheet 內頂端的鎖定提示（讓使用者知道：能看、升級才能改）
  const lockHint = previewLocked ? (
    <a
      href={pricingHref}
      className="block rounded-lg bg-amber-50 ring-1 ring-amber-300 px-3 py-2 text-xs text-amber-900 font-medium"
    >
      🔒 {t("previewLockSheetHint")}
    </a>
  ) : null;
  const entryName = isEn && entry.nameEn ? entry.nameEn : entry.nameZh;
  const optionSchema: OptionSpec[] = entry.optionSchema ?? [];
  const allPartIds: string[] = design.parts.map((p) => p.id);

  // 目標 6~8 條 ticks。算出乾淨間距（100/200/250/500/1000mm 階梯），避免擠成一坨
  const makeTicks = (minV: number, maxV: number, step: number): number[] => {
    const span = maxV - minV;
    if (span <= 0) return [];
    const targetCount = 7;
    const rawInterval = span / targetCount;
    const candidates = [10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000];
    const interval = candidates.find((c) => c >= rawInterval) ?? Math.ceil(rawInterval / step) * step;
    const out: number[] = [];
    const start = Math.ceil(minV / interval) * interval;
    for (let t = start; t <= maxV; t += interval) {
      if (t > minV && t < maxV) out.push(t);
    }
    return out;
  };

  // limits: flat { length, width, height } — each is the max value.
  const lMax = entry.limits?.length ?? 3000;
  const wMax = entry.limits?.width ?? 3000;
  const hMax = entry.limits?.height ?? 3000;
  // 滑桿下限：跟桌面版一樣 20mm 地板，但若當前值更小（筆筒 80、相框厚 18 等小物件）
  // 就降到該值，否則 RangeInput 會把值 clamp 上去（min===max 還會整條拉不動）。
  const lMin = Math.min(20, length);
  const wMin = Math.min(20, width);
  const hMin = Math.min(20, height);

  // 分流 spec 到 4 tab。先匹配美學 / 榫接，剩下的全進「結構」當 catch-all（避免漏選項）。
  const inGroup = (s: OptionSpec, keywords: string[]) =>
    keywords.some((k) => s.key.toLowerCase().includes(k));
  const styleSpecs = optionSchema.filter((s) =>
    inGroup(s, ["edge", "handle", "grain", "pull", "hardware", "knob", "finish"]),
  );
  const joinerySpecs = optionSchema.filter((s) =>
    inGroup(s, ["joinery", "tenon", "mortise", "joint"]) && !styleSpecs.includes(s),
  );
  const structureSpecs = optionSchema.filter(
    (s) => !styleSpecs.includes(s) && !joinerySpecs.includes(s),
  );

  // 套 spec.dependsOn 過濾 —— 讓 AdvancedSheet 只顯示與當前選項相關的 spec
  const visibleStructureSpecs = structureSpecs.filter(
    (s) => !s.dependsOn || evalDep(s.dependsOn, optionValues),
  );
  const visibleStyleSpecs = styleSpecs.filter(
    (s) => !s.dependsOn || evalDep(s.dependsOn, optionValues),
  );
  const visibleJoinerySpecs = joinerySpecs.filter(
    (s) => !s.dependsOn || evalDep(s.dependsOn, optionValues),
  );

  // 榫接 tab：從 design 抽出所有榫卯使用情況（同桌面版 JoinerySection 邏輯）
  const joineryUsages = extractJoineryUsages(design);

  // SaveDesignButton params
  const saveParams: Record<string, unknown> = {
    length,
    width,
    height,
    material,
    ...optionValues,
  };
  const saveName = `${entry.nameZh} ${length}×${width}×${height}`;

  return (
    <SelectedPartProvider>
    <HoveredPartsProvider>
    <div className="md:hidden min-h-screen pb-24">
      <MobileTopBar
        title={entryName}
        backHref="/"
        onOverflow={() => setOverflowOpen(true)}
      />

      <DesignFormShell action={formAction} className="px-4 py-3 space-y-4">
        {/* 主表單在 sheet 之外，預設只有 length/width/height/material/joineryMode/designerMode
            這些可見 input。改材料時 FormData 不含 optionValues（pullStyle 等都在 AdvancedSheet
            內），導致 URL 重建時把把手樣式漏掉、server fallback 到 defaultValue。
            這裡補 hidden inputs 帶上所有 optionValues，保證主表單任何欄位變動都保留全狀態。 */}
        {Object.entries(optionValues).map(([k, v]) => (
          <input key={`main-hidden-${k}`} type="hidden" name={k} value={String(v)} />
        ))}
        {/* 3D viewer：sticky 釘在 TopBar (56px) 下；3D + TopBar 合計約 1/3 viewport */}
        <div className="sticky top-[56px] z-10 -mx-4 px-4 py-1">
          <div className="rounded-xl overflow-hidden ring-1 ring-amber-900/10 bg-white shadow-sm">
            <div style={{ height: 220 }}>
              <LazyPerspectiveView design={design} compactMode wireframeMode={props.wireframeMode} joineryMode={props.joineryMode} sceneTheme={activeSceneTheme} lidLiftMm={props.lidLiftMm} explodeMm={props.explodeMm} xrayMode={props.xrayMode} />
            </div>
          </div>
        </div>

        {previewLocked && (
          <div className="rounded-xl border-2 border-amber-400 bg-gradient-to-br from-amber-50 to-amber-100/60 p-3.5">
            <div className="flex items-start gap-2">
              <span className="text-lg leading-none mt-0.5" aria-hidden>🔒</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-amber-950">
                  {t("previewLockTitle", { dims: formatDimensions(length, width, height, unit) })}
                </p>
                <p className="mt-1 text-xs text-amber-900/90 leading-relaxed">
                  {t("previewLockBody")}
                </p>
                <a
                  href={pricingHref}
                  className="mt-2.5 inline-flex items-center gap-1 rounded-lg bg-amber-700 px-3.5 py-2 text-xs font-semibold text-white shadow-sm active:scale-[0.98]"
                >
                  {t("previewLockCta")}
                </a>
              </div>
            </div>
          </div>
        )}

        <div className="rounded-xl bg-white px-3 py-2.5 ring-1 ring-amber-900/10 shadow-sm">
          <div className="text-[11px] font-semibold text-zinc-500 mb-1.5">{t("form.style")}</div>
          <fieldset disabled={previewLocked} className={lockCls}>
            <StylePresetButtons optionSchema={optionSchema} category={entry.category} compact />
          </fieldset>
        </div>

        <div className="rounded-xl bg-white p-3 ring-1 ring-amber-900/10 shadow-sm space-y-2">
          <fieldset disabled={previewLocked} className={lockCls}>
            <SizePresetButtons category={entry.category} limits={entry.limits} compact />
          </fieldset>
          <div className="space-y-1.5">
            <fieldset disabled={previewLocked} className={`${lockCls} space-y-1.5`}>
            <RangeInput
              name="length"
              label={
                entry.category === "round-stool" ||
                entry.category === "round-table" ||
                entry.category === "round-tea-table"
                  ? t("form.diameter")
                  : t("form.length")
              }
              defaultValue={length}
              min={lMin}
              max={lMax}
              step={10}
              ticks={makeTicks(lMin, lMax, 10)}
              showRange
              partIds={resolvePartIds("length", allPartIds)}
            />
            {entry.category !== "round-stool" &&
              entry.category !== "round-table" &&
              entry.category !== "round-tea-table" && (
                <RangeInput
                  name="width"
                  label={t("form.width")}
                  defaultValue={width}
                  min={wMin}
                  max={wMax}
                  step={10}
                  ticks={makeTicks(wMin, wMax, 10)}
                  showRange
                  partIds={resolvePartIds("width", allPartIds)}
                />
              )}
            <RangeInput
              name="height"
              label={t("form.height")}
              defaultValue={height}
              min={hMin}
              max={hMax}
              step={10}
              ticks={makeTicks(hMin, hMax, 10)}
              showRange
              partIds={resolvePartIds("height", allPartIds)}
            />
            </fieldset>
            <label className="flex items-center gap-3 text-sm pt-1">
              <span className="text-zinc-700 font-medium shrink-0 w-8">{t("form.material")}</span>
              <select
                name="material"
                defaultValue={material}
                className="flex-1 min-h-[36px] border border-zinc-300 rounded-md px-2 py-1 bg-white text-zinc-900 text-sm"
              >
                {Object.entries(MATERIALS).map(([id, m]) => (
                  <option key={id} value={id}>{isEn ? m.nameEn : m.nameZh}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <SaveDesignButton
              furnitureType={entry.category}
              defaultName={saveName}
              currentDesignId={props.currentDesignId}
              params={saveParams}
            />
            <button
              type="button"
              onClick={() => setAdvancedOpen(true)}
              className="min-h-[44px] rounded-xl bg-amber-900 hover:bg-amber-800 active:scale-[0.98] text-white text-sm font-semibold shadow-sm transition-all"
            >
              {t("form.advanced")}
            </button>
          </div>
        </div>

        {/* 工法 + 設計師模式：核心 toggle，放主表單下方。pencil-holder 隱藏工法切換 */}
        <div className="rounded-xl bg-white p-3 ring-1 ring-amber-900/10 shadow-sm space-y-2">
          {entry.category !== "pencil-holder" && entry.category !== "tray" && entry.category !== "dovetail-box" && (
            <>
              <div className="text-[11px] text-zinc-500">{t("form.method")}</div>
              <div className="grid grid-cols-2 gap-2">
                <label className={`flex items-center justify-center gap-1.5 min-h-[44px] px-2 rounded-md text-sm font-semibold cursor-pointer ring-2 ${!props.joineryMode ? "ring-emerald-500 bg-emerald-50 text-emerald-900" : "ring-zinc-200 bg-white text-zinc-700"}`}>
                  <input type="radio" name="joineryMode" value="" defaultChecked={!props.joineryMode} className="sr-only" />
                  {t("form.assembly")}
                </label>
                <label className={`flex items-center justify-center gap-1.5 min-h-[44px] px-2 rounded-md text-sm font-semibold cursor-pointer ring-2 ${props.joineryMode ? "ring-amber-500 bg-amber-50 text-amber-900" : "ring-zinc-200 bg-white text-zinc-700"}`}>
                  <input type="radio" name="joineryMode" value="true" defaultChecked={props.joineryMode} className="sr-only" />
                  {t("form.joinery")}
                </label>
              </div>
            </>
          )}
          {props.canUseDesignerMode ? (
            <label className="flex items-center gap-2 min-h-[36px] px-1 pt-1 text-sm cursor-pointer border-t border-zinc-100">
              <input type="checkbox" name="designerMode" value="true" defaultChecked={props.designerMode} className="h-4 w-4 accent-amber-600" />
              <span className="text-zinc-800">{t("form.designerMode")}</span>
              <span className="text-[10px] text-zinc-500">{t("form.designerHint")}</span>
            </label>
          ) : null}
        </div>

        <CollapsibleSection title={t("section.threeView")} badge={t("section.threeViewBadge")}>
          <ZoomableThreeViews design={design} joineryMode={props.joineryMode} />
        </CollapsibleSection>

        {/* 零件圖：手機版上線（2026-06-08）。桌面版在 hidden md:block 區、手機版缺，
            補進 MobileShell。面板自身已響應式(grid-cols-2)、含 modal 全圖。 */}
        <PartDrawingsPanel design={design} />

        <CollapsibleSection title={t("section.cutList")} badge={t("section.cutListBadge", { count: design.parts.length })}>
          <div className="px-3 py-2 bg-zinc-50 border-b border-zinc-200 flex items-center justify-between gap-2 text-[11px] text-zinc-500">
            <span className="leading-snug">{t("section.cutListNotice")}</span>
            <a
              href={props.cutPlanUrl}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 px-2.5 py-1 bg-amber-600 text-white rounded text-[11px] hover:bg-amber-700"
            >
              {t("section.cutPlan")}
            </a>
          </div>
          <MaterialListWithSelection design={design} />
        </CollapsibleSection>

        {joineryUsages.length > 0 && (
          <CollapsibleSection title={t("section.joineryNote")} badge={t("section.joineryNoteBadge", { count: joineryUsages.length })}>
            <div className="space-y-3">
              {joineryUsages.map((u, i) => (
                <div key={i} className="rounded-md border border-zinc-200 bg-white p-3">
                  <div className="flex items-baseline justify-between flex-wrap gap-1 mb-1">
                    <h4 className="font-semibold text-sm text-zinc-900">
                      {joineryLabel(u.type, locale)}
                      <span className="text-xs font-normal text-zinc-500 ml-1">
                        · {u.partNameZh} ↔ {u.motherPartNames.length > 0 ? u.motherPartNames.join(" / ") : t("joinery.motherPart")} · {t("joinery.spotsCount", { count: u.count })}
                      </span>
                    </h4>
                  </div>
                  <p className="text-xs text-zinc-500 mb-2">
                    {t("joinery.tenon")} {formatDimensions(u.tenon.length, u.tenon.width, u.tenon.thickness, unit)}
                  </p>
                  <p className="text-xs text-zinc-700 leading-relaxed">{joineryDescription(u.type, locale)}</p>
                </div>
              ))}
              <p className="text-[11px] text-zinc-500">{t("section.joineryFootnote")}</p>
            </div>
          </CollapsibleSection>
        )}

        <CollapsibleSection title={t("section.buildSteps")}>
          <BuildSteps design={design} locale={locale} />
        </CollapsibleSection>

        <CollapsibleSection title={t("section.toolList")}>
          <ToolList design={design} locale={locale} />
        </CollapsibleSection>
      </DesignFormShell>

      <StickyBottomBar
        totalPrice={props.totalPrice}
        weight={props.weight}
        quoteUrl={props.quoteUrl}
        lineShareText={props.lineShareText}
      />

      <AdvancedSheet
        open={advancedOpen}
        onClose={() => setAdvancedOpen(false)}
        structureContent={
          <DesignFormShell action={formAction} className="space-y-4">
            <HiddenStateInputs
              length={length}
              width={width}
              height={height}
              material={material}
              optionValues={optionValues}
              exceptKeys={visibleStructureSpecs.map((s) => s.key)}
            />
            {lockHint}
            <fieldset disabled={previewLocked} className={lockCls}>
            {visibleStructureSpecs.length === 0 ? (
              <div className="text-sm text-zinc-500">{t("advancedSheet.noStructure")}</div>
            ) : (
              <GroupedSpecs specs={visibleStructureSpecs} optionValues={optionValues} overallHeight={height} overallLength={length} allPartIds={allPartIds} />
            )}
            </fieldset>
          </DesignFormShell>
        }
        styleContent={
          <DesignFormShell action={formAction} className="space-y-4">
            <HiddenStateInputs
              length={length}
              width={width}
              height={height}
              material={material}
              optionValues={optionValues}
              exceptKeys={visibleStyleSpecs.map((s) => s.key)}
            />
            {lockHint}
            <fieldset disabled={previewLocked} className={lockCls}>
            <GroupedSpecs specs={visibleStyleSpecs} optionValues={optionValues} overallHeight={height} overallLength={length} allPartIds={allPartIds} />
            </fieldset>
          </DesignFormShell>
        }
        joineryContent={
          <div className="space-y-4">
            {/* 榫接選項表單 */}
            <DesignFormShell action={formAction} className="space-y-4">
              <HiddenStateInputs
                length={length}
                width={width}
                height={height}
                material={material}
                optionValues={optionValues}
                exceptKeys={visibleJoinerySpecs.map((s) => s.key)}
              />
              {lockHint}
              <fieldset disabled={previewLocked} className={lockCls}>
              {visibleJoinerySpecs.length === 0 ? (
                <div className="text-sm text-zinc-500">{t("advancedSheet.noJoineryOption")}</div>
              ) : (
                <GroupedSpecs specs={visibleJoinerySpecs} optionValues={optionValues} overallHeight={height} overallLength={length} allPartIds={allPartIds} />
              )}
              </fieldset>
            </DesignFormShell>

            {/* 榫卯細節圖：zModal="z-[70]" 讓放大 modal 蓋過 AdvancedSheet (z-50) */}
            {joineryUsages.length === 0 ? (
              <div className="text-sm text-zinc-500">
                {props.joineryMode
                  ? t("joinery.noJoinery")
                  : t("joinery.switchHint")}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wide pt-1 border-t border-zinc-100">
                  {t("joinery.detailTitle")}
                </div>
                {joineryUsages.map((u, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-zinc-200 bg-white p-3"
                  >
                    <div className="flex items-baseline justify-between flex-wrap gap-1 mb-1">
                      <h3 className="text-sm font-semibold text-zinc-800">
                        {joineryLabel(u.type, locale)}{" "}
                        <span className="text-xs font-normal text-zinc-500">
                          · {u.partNameZh}
                          {u.motherPartNames.length > 0
                            ? ` ↔ ${u.motherPartNames.join(" / ")}`
                            : ` ↔ ${t("joinery.motherPart")}`}
                          {" "}· {t("joinery.spotsCount", { count: u.count })}
                        </span>
                      </h3>
                      <p className="text-[10px] text-zinc-400">
                        {formatDimensions(u.tenon.length, u.tenon.width, u.tenon.thickness, unit)}
                      </p>
                    </div>
                    <p className="text-xs text-zinc-500 mb-2">{joineryDescription(u.type, locale)}</p>
                    <ZoomableJoineryDetail
                      type={u.type}
                      params={{
                        tenonLength: u.tenon.length,
                        tenonWidth: u.tenon.width,
                        tenonThickness: u.tenon.thickness,
                        motherThickness: u.estimatedMotherThickness,
                        childThickness: u.childThickness,
                        childWidth: u.childWidth,
                        motherShape: u.motherShape,
                        material: design.parts.find((p) => p.id === u.partId)?.material ?? design.parts[0]?.material,
                      }}
                      zModal="z-[70]"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        }
        sceneContent={
          <div className="space-y-4">
            <div>
              <p className="text-xs text-zinc-500 mb-3">{t("advancedSheet.sceneHint")}</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {SCENE_THEME_LIST.map((t) => {
                  const active = t.id === activeSceneId;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => handleSceneSelect(t.id)}
                      className={`flex items-center gap-2 min-h-[52px] px-3 py-2 rounded-xl text-sm font-medium transition-colors border-2 ${
                        active
                          ? "border-amber-600 bg-amber-50 text-amber-900"
                          : "border-zinc-200 bg-white text-zinc-700 active:bg-zinc-50"
                      }`}
                    >
                      <span
                        className="inline-block w-5 h-5 rounded-md border border-black/15 shrink-0"
                        style={{ backgroundColor: t.swatch }}
                      />
                      <span>{t.nameZh}</span>
                      {active && <span className="ml-auto text-amber-600 text-xs">✓</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        }
      />

      <MobileOverflowMenu
        open={overflowOpen}
        onClose={() => setOverflowOpen(false)}
        cutPlanUrl={props.cutPlanUrl}
        printUrl={props.printUrl}
        onShareLink={async () => {
          setOverflowOpen(false);
          const path =
            typeof window !== "undefined"
              ? window.location.pathname + window.location.search
              : "";
          let shortUrl =
            typeof window !== "undefined" ? window.location.href : "";
          try {
            const res = await fetch("/api/design/shorten", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ path }),
            });
            if (res.ok) {
              const data: { code?: string } = await res.json();
              if (data.code) {
                shortUrl = `${window.location.origin}/q/${data.code}`;
              }
            }
          } catch {
            // network fail → fallback to long URL
          }
          // 寫進 clipboard（先試，失敗不擋流程）
          try {
            await navigator.clipboard.writeText(shortUrl);
          } catch {
            // clipboard blocked on some browsers
          }
          // 優先用 Web Share API（iOS Safari 最順）
          if (
            typeof navigator !== "undefined" &&
            "share" in navigator
          ) {
            try {
              await (
                navigator as Navigator & {
                  share: (d: { title: string; url: string }) => Promise<void>;
                }
              ).share({ title: t("share.title"), url: shortUrl });
              return;
            } catch {
              // 使用者取消 → fallback 到 alert
            }
          }
          alert(`${t("share.copied")}\n${shortUrl}`);
        }}
        onDownloadCsv={() => {
          alert(t("share.csvWip"));
        }}
      />
    </div>
    </HoveredPartsProvider>
    </SelectedPartProvider>
  );
}

/**
 * 把 visible spec list 依 spec.group 分群，渲染成「色條 + 中文 section 標題 + 該群選項」。
 * 解決手機進階設定一連串選項看不出哪幾項屬於上層 / 中層 / 下層 / 抽屜 / 門板 的問題。
 */
function GroupedSpecs({
  specs,
  optionValues,
  overallHeight,
  overallLength,
  allPartIds,
}: {
  specs: OptionSpec[];
  optionValues: Record<string, string | number | boolean>;
  overallHeight?: number;
  overallLength?: number;
  allPartIds?: string[];
}) {
  const locale = useLocale();
  const groups = groupSpecsByGroup(specs);
  return (
    <>
      {groups.map((g) => (
        <section key={g.group} className="space-y-3">
          <div className="flex items-center gap-2 pt-1">
            <span className={`inline-block w-1 h-4 rounded-full ${g.meta.bar}`} />
            <span className="text-sm font-semibold text-zinc-800">
              <span className="mr-1">{g.meta.icon}</span>
              {groupLabel(g.meta, locale)}
            </span>
          </div>
          <div className="space-y-3 pl-3 border-l-2 border-zinc-100">
            {g.specs.map((s) => (
              <MobileOptionField
                key={s.key}
                spec={s}
                value={optionValues[s.key]}
                allValues={optionValues}
                overallHeight={overallHeight}
                overallLength={overallLength}
                allPartIds={allPartIds}
              />
            ))}
          </div>
        </section>
      ))}
    </>
  );
}

/**
 * 在 AdvancedSheet 內部 form 提交時，保留 main form 的所有 state：
 * length/width/height/material + 不在當前 tab 的所有 optionSpec 值。
 * 沒這個的話 sheet 改一個 slider，server 收不到 material → 退回預設胡桃木。
 */
function HiddenStateInputs({
  length,
  width,
  height,
  material,
  optionValues,
  exceptKeys,
}: {
  length: number;
  width: number;
  height: number;
  material: MaterialId;
  optionValues: Record<string, string | number | boolean>;
  /** 當前 tab 內已有對應可見 input 的 key，不再 render hidden（避免重複） */
  exceptKeys: string[];
}) {
  const exceptSet = new Set(exceptKeys);
  return (
    <>
      <input type="hidden" name="length" value={length} />
      <input type="hidden" name="width" value={width} />
      <input type="hidden" name="height" value={height} />
      <input type="hidden" name="material" value={material} />
      {Object.entries(optionValues).map(([k, v]) =>
        exceptSet.has(k) ? null : (
          <input key={k} type="hidden" name={k} value={String(v)} />
        ),
      )}
    </>
  );
}
