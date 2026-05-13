"use client";

import { useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { LazyPerspectiveView } from "@/components/LazyPerspectiveView";
import { ZoomableThreeViews } from "@/components/ZoomableThreeViews";
import { ZoomableJoineryDetail } from "@/components/ZoomableJoineryDetail";
import { extractJoineryUsages } from "@/lib/joinery/extract";
import { JOINERY_LABEL, JOINERY_DESCRIPTION } from "@/lib/joinery/details";
import { MaterialListWithSelection } from "@/components/MaterialListWithSelection";
import { ToolList } from "@/components/ToolList";
import { BuildSteps } from "@/components/BuildSteps";
import { StylePresetButtons } from "@/components/design/StylePresetButtons";
import { SizePresetButtons } from "@/components/design/SizePresetButtons";
import { DesignFormShell } from "@/components/design/DesignFormShell";
import { SaveDesignButton } from "@/components/SaveDesignButton";
import { SelectedPartProvider } from "@/components/SelectedPartContext";
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
  wireframeMode?: boolean;
  joineryMode?: boolean;
  designerMode?: boolean;
  canUseDesignerMode?: boolean;
  /** 初始場景 ID（由 server 從 URL ?scene= 解析後傳入） */
  sceneId?: SceneThemeId;
}

export function MobileShell(props: MobileShellProps) {
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
  const optionSchema: OptionSpec[] = entry.optionSchema ?? [];

  // limits: flat { length, width, height } — each is the max value; use 200 as min floor.
  const lMax = entry.limits?.length ?? 3000;
  const wMax = entry.limits?.width ?? 3000;
  const hMax = entry.limits?.height ?? 3000;

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
    <div className="md:hidden min-h-screen bg-zinc-50 pb-24">
      <MobileTopBar
        title={entry.nameZh}
        backHref="/"
        onOverflow={() => setOverflowOpen(true)}
      />

      <DesignFormShell action={formAction} className="px-4 py-3 space-y-4">
        {/* 3D viewer：sticky 釘在 TopBar (56px) 下；3D + TopBar 合計約 1/3 viewport */}
        <div className="sticky top-[56px] z-10 -mx-4 px-4 py-1 bg-zinc-50">
          <div className="rounded-lg overflow-hidden border border-zinc-200 bg-white">
            <div style={{ height: 220 }}>
              <LazyPerspectiveView design={design} compactMode wireframeMode={props.wireframeMode} joineryMode={props.joineryMode} sceneTheme={activeSceneTheme} />
            </div>
          </div>
        </div>

        <div className="rounded-lg bg-white px-3 py-2 border border-zinc-200">
          <div className="text-[11px] text-zinc-500 mb-1.5">風格</div>
          <StylePresetButtons optionSchema={optionSchema} category={entry.category} compact />
        </div>

        <div className="rounded-lg bg-white p-3 border border-zinc-200 space-y-2">
          <SizePresetButtons category={entry.category} compact />
          <div className="space-y-1.5">
            <RangeInput name="length" label="長" defaultValue={length} min={200} max={lMax} step={10} />
            <RangeInput name="width" label="寬" defaultValue={width} min={200} max={wMax} step={10} />
            <RangeInput name="height" label="高" defaultValue={height} min={200} max={hMax} step={10} />
            <label className="flex items-center gap-3 text-sm pt-1">
              <span className="text-zinc-700 font-medium shrink-0 w-8">材料</span>
              <select
                name="material"
                defaultValue={material}
                className="flex-1 min-h-[36px] border border-zinc-300 rounded-md px-2 py-1 bg-white text-zinc-900 text-sm"
              >
                {Object.entries(MATERIALS).map(([id, m]) => (
                  <option key={id} value={id}>{m.nameZh}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <SaveDesignButton
              furnitureType={entry.category}
              defaultName={saveName}
              params={saveParams}
            />
            <button
              type="button"
              onClick={() => setAdvancedOpen(true)}
              className="min-h-[44px] rounded-md bg-zinc-800 hover:bg-zinc-900 text-white text-sm font-semibold"
            >
              ⚙ 進階設定
            </button>
          </div>
        </div>

        {/* 工法 + 設計師模式：核心 toggle，放主表單下方 */}
        <div className="rounded-lg bg-white p-3 border border-zinc-200 space-y-2">
          <div className="text-[11px] text-zinc-500">工法</div>
          <div className="grid grid-cols-2 gap-2">
            <label className={`flex items-center justify-center gap-1.5 min-h-[44px] px-2 rounded-md text-sm font-semibold cursor-pointer ring-2 ${!props.joineryMode ? "ring-emerald-500 bg-emerald-50 text-emerald-900" : "ring-zinc-200 bg-white text-zinc-700"}`}>
              <input type="radio" name="joineryMode" value="" defaultChecked={!props.joineryMode} className="sr-only" />
              🔩 組裝版
            </label>
            <label className={`flex items-center justify-center gap-1.5 min-h-[44px] px-2 rounded-md text-sm font-semibold cursor-pointer ring-2 ${props.joineryMode ? "ring-amber-500 bg-amber-50 text-amber-900" : "ring-zinc-200 bg-white text-zinc-700"}`}>
              <input type="radio" name="joineryMode" value="true" defaultChecked={props.joineryMode} className="sr-only" />
              🪵 榫接版
            </label>
          </div>
          {props.canUseDesignerMode ? (
            <label className="flex items-center gap-2 min-h-[36px] px-1 pt-1 text-sm cursor-pointer border-t border-zinc-100">
              <input type="checkbox" name="designerMode" value="true" defaultChecked={props.designerMode} className="h-4 w-4 accent-amber-600" />
              <span className="text-zinc-800">🎨 設計師模式</span>
              <span className="text-[10px] text-zinc-500">自由尺寸到 mm</span>
            </label>
          ) : null}
        </div>

        <CollapsibleSection title="三視圖" badge="點圖放大">
          <ZoomableThreeViews design={design} joineryMode={props.joineryMode} />
        </CollapsibleSection>

        <CollapsibleSection title="材料清單" badge={`${design.parts.length} 件`}>
          <MaterialListWithSelection design={design} />
        </CollapsibleSection>

        {joineryUsages.length > 0 && (
          <CollapsibleSection title="工法（榫卯說明）" badge={`${joineryUsages.length} 處`}>
            <div className="space-y-3">
              {joineryUsages.map((u, i) => (
                <div key={i} className="rounded-md border border-zinc-200 bg-white p-3">
                  <div className="flex items-baseline justify-between flex-wrap gap-1 mb-1">
                    <h4 className="font-semibold text-sm text-zinc-900">
                      {JOINERY_LABEL[u.type]}
                      <span className="text-xs font-normal text-zinc-500 ml-1">
                        · {u.partNameZh} ↔ {u.motherPartNames.length > 0 ? u.motherPartNames.join(" / ") : "母件"} · 共 {u.count} 處
                      </span>
                    </h4>
                  </div>
                  <p className="text-xs text-zinc-500 mb-2">
                    榫頭 {u.tenon.length} × {u.tenon.width} × {u.tenon.thickness} mm
                  </p>
                  <p className="text-xs text-zinc-700 leading-relaxed">{JOINERY_DESCRIPTION[u.type]}</p>
                </div>
              ))}
              <p className="text-[11px] text-zinc-500">完整榫卯細節圖：⚙ 進階設定 → 榫接 tab</p>
            </div>
          </CollapsibleSection>
        )}

        <CollapsibleSection title="製作工序">
          <BuildSteps design={design} />
        </CollapsibleSection>

        <CollapsibleSection title="工具清單">
          <ToolList design={design} />
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
            {visibleStructureSpecs.length === 0 ? (
              <div className="text-sm text-zinc-500">此家具無結構選項</div>
            ) : (
              visibleStructureSpecs.map((s) => (
                <MobileOptionField key={s.key} spec={s} value={optionValues[s.key]} allValues={optionValues} />
              ))
            )}
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
            {visibleStyleSpecs.map((s) => (
              <MobileOptionField key={s.key} spec={s} value={optionValues[s.key]} allValues={optionValues} />
            ))}
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
              {visibleJoinerySpecs.length === 0 ? (
                <div className="text-sm text-zinc-500">此家具無榫接選項</div>
              ) : (
                visibleJoinerySpecs.map((s) => (
                  <MobileOptionField key={s.key} spec={s} value={optionValues[s.key]} allValues={optionValues} />
                ))
              )}
            </DesignFormShell>

            {/* 榫卯細節圖：zModal="z-[70]" 讓放大 modal 蓋過 AdvancedSheet (z-50) */}
            {joineryUsages.length === 0 ? (
              <div className="text-sm text-zinc-500">
                {props.joineryMode
                  ? "此家具無可顯示的榫卯。"
                  : "切換到「🪵 榫接版」可顯示榫卯細節圖。"}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wide pt-1 border-t border-zinc-100">
                  榫卯細節圖
                </div>
                {joineryUsages.map((u, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-zinc-200 bg-white p-3"
                  >
                    <div className="flex items-baseline justify-between flex-wrap gap-1 mb-1">
                      <h3 className="text-sm font-semibold text-zinc-800">
                        {JOINERY_LABEL[u.type]}{" "}
                        <span className="text-xs font-normal text-zinc-500">
                          · {u.partNameZh}
                          {u.motherPartNames.length > 0
                            ? ` ↔ ${u.motherPartNames.join(" / ")}`
                            : " ↔ 母件"}
                          {" "}· 共 {u.count} 處
                        </span>
                      </h3>
                      <p className="text-[10px] text-zinc-400">
                        {u.tenon.length} × {u.tenon.width} × {u.tenon.thickness} mm
                      </p>
                    </div>
                    <p className="text-xs text-zinc-500 mb-2">{JOINERY_DESCRIPTION[u.type]}</p>
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
              <p className="text-xs text-zinc-500 mb-3">選擇擺放場景，3D 視圖即時更新背景與燈光氛圍</p>
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
                          ? "border-violet-600 bg-violet-50 text-violet-900"
                          : "border-zinc-200 bg-white text-zinc-700 active:bg-zinc-50"
                      }`}
                    >
                      <span
                        className="inline-block w-5 h-5 rounded-md border border-black/15 shrink-0"
                        style={{ backgroundColor: t.swatch }}
                      />
                      <span>{t.nameZh}</span>
                      {active && <span className="ml-auto text-violet-600 text-xs">✓</span>}
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
              ).share({ title: "木頭仁家具設計器", url: shortUrl });
              return;
            } catch {
              // 使用者取消 → fallback 到 alert
            }
          }
          alert(`短碼已複製：\n${shortUrl}`);
        }}
        onDownloadCsv={() => {
          alert("材料 CSV phase 2 整合");
        }}
      />
    </div>
    </SelectedPartProvider>
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
