import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTemplate } from "@/lib/templates";
import { createClient } from "@/lib/supabase/server";
import { canAccessCategory, getPlanFeatures, isPaidCategory } from "@/lib/permissions";
import { getServerAdminEmails, isAdminEmail } from "@/lib/admin";
import { toBeginnerMode } from "@/lib/templates/beginner-mode";
import { applyEdgeProtection } from "@/lib/joinery/edge-protection";
import { estimateWeight } from "@/lib/design/shipping";
import { AutoSubmitCheckbox } from "@/components/AutoSubmitCheckbox";
import type { FurnitureCategory, FurnitureDesign, MaterialId, OptionDependency, OptionSpec } from "@/lib/types";
import { MaterialListWithSelection } from "@/components/MaterialListWithSelection";
import { SelectedPartProvider } from "@/components/SelectedPartContext";
import { HoveredPartsProvider } from "@/components/HoveredPartsContext";
import { Material3dPip } from "@/components/Material3dPip";
import { ZoomableThreeViews } from "@/components/ZoomableThreeViews";
import { ZoomableJoineryDetail } from "@/components/ZoomableJoineryDetail";
import { LazyPerspectiveView } from "@/components/LazyPerspectiveView";
import { MATERIALS } from "@/lib/materials";
import { extractJoineryUsages } from "@/lib/joinery/extract";
import {
  JoineryDetail,
  JOINERY_LABEL,
  JOINERY_DESCRIPTION,
} from "@/lib/joinery/details";
import { ToolList } from "@/components/ToolList";
import { BuildSteps } from "@/components/BuildSteps";
import { DesignFormShell } from "@/components/design/DesignFormShell";
import { ClampedNumberInput } from "@/components/design/ClampedNumberInput";
import { resolvePartIds } from "@/lib/design/option-part-map";
import { ErgoHints } from "@/components/ErgoHints";
import { DeflectionHints } from "@/components/DeflectionHints";
import { SceneThemeToggle } from "@/components/SceneThemeToggle";
import { SCENE_THEMES, type SceneThemeId } from "@/lib/design/scene-themes";
import { GROUP_META, GROUP_ORDER } from "@/lib/design/option-groups";
import { MaterialAttributesPanel } from "@/components/MaterialAttributesPanel";
import { EdgePresetButtons } from "@/components/design/EdgePresetButtons";
import { StylePresetButtons } from "@/components/design/StylePresetButtons";
import { StyleMismatchWarning } from "@/components/design/StyleMismatchWarning";
// import { AIRefineButton } from "@/components/design/AIRefineButton";
import { SizePresetButtons } from "@/components/design/SizePresetButtons";
import { HeightToSizeButton } from "@/components/design/HeightToSizeButton";
import { ResetDefaultsButton } from "@/components/design/ResetDefaultsButton";
import { SuggestionsBox } from "@/components/design/SuggestionsBox";
import { AskMasterButton } from "@/components/design/AskMasterButton";
import { ShareDesignButton } from "@/components/design/ShareDesignButton";
// import { PhotoToParamsButton } from "@/components/design/PhotoToParamsButton";
import { PartDrawingsPanel } from "@/components/design/PartDrawingsPanel";
import { isLocalhost } from "@/lib/dev-only";
import { SaveDesignButton } from "@/components/SaveDesignButton";
import {
  parseDesignSearchParams,
  designParamsToQuery,
} from "@/lib/design/parse-search-params";
import { MobileShell } from "@/components/mobile/MobileShell";
import { calculateQuote } from "@/lib/pricing/quote";
import { LABOR_DEFAULTS } from "@/lib/pricing/labor";
import { MATERIAL_PRICE_PER_BDFT } from "@/lib/pricing/catalog";

interface PageProps {
  params: Promise<{ type: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ type: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { type } = await params;
  const sp = await searchParams;
  const entry = getTemplate(type as FurnitureCategory);
  if (!entry) return { title: "找不到家具範本" };

  const ogParams = new URLSearchParams({ type: entry.category });
  for (const k of ["length", "width", "height", "material", "style"]) {
    const v = sp[k];
    if (typeof v === "string" && v) ogParams.set(k, v);
  }
  const ogImage = `/api/og?${ogParams.toString()}`;
  const canonical = `/design/${entry.category}`;
  const shareUrl = ogParams.toString() ? `${canonical}?${ogParams.toString().replace(/^type=[^&]+&?/, "")}` : canonical;

  const title = `${entry.nameZh}設計圖｜輸入尺寸自動產出三視圖、材料單、報價`;
  const description = `${entry.description}。輸入長寬高、選木材，自動算切料、生三視圖與透視圖、列印 A4 工程圖紙。木頭仁木匠學院出品。`;
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: shareUrl,
      type: "website",
      images: [{ url: ogImage, width: 1200, height: 630 }],
    },
    twitter: { card: "summary_large_image", title, description, images: [ogImage] },
  };
}

export default async function DesignPage({ params, searchParams }: PageProps) {
  const { type } = await params;
  const sp = await searchParams;

  const entry = getTemplate(type as FurnitureCategory);
  if (!entry) notFound();

  // 付費門檻：免費版只能進 FREE_UNLOCKED_CATEGORIES，其他導去 /pricing；
  // 同時拉一次 profile 給「設計師模式」門檻用，避免重複查詢。
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let profile = null;
  if (user) {
    const { data } = await supabase
      .from("users")
      .select(
        "plan, subscription_status, subscription_expires_at, student_activated_at, student_expires_at",
      )
      .eq("id", user.id)
      .single();
    profile = data;
  }
  const isAdmin = isAdminEmail(user?.email, getServerAdminEmails());
  // dev-only：playwright shoot-thumbs 腳本繞過 paywall 抓所有家具縮圖
  const isThumbShoot =
    process.env.NODE_ENV === "development" && sp._shoot === "1";
  if (
    !isAdmin &&
    !isThumbShoot &&
    isPaidCategory(type as FurnitureCategory) &&
    !canAccessCategory(profile, type as FurnitureCategory)
  ) {
    redirect(`/pricing?locked=${type}`);
  }
  // canUseDesignerMode 給 UI 用(decide 是否 render toggle);limits clamp
  // 另外用 planAllowsDesigner 算,雙保險避免 UI bug 或未來改 admin 邏輯時
  // 不小心讓非付費 user 繞過尺寸上限。
  const planAllowsDesigner = getPlanFeatures(profile).canUseDesignerMode;
  const canUseDesignerMode = isAdmin || planAllowsDesigner;

  if (!entry.template) {
    return (
      <main className="max-w-3xl mx-auto px-6 py-12">
        <Link href="/" className="text-sm text-zinc-500 hover:underline">
          ← 回家具列表
        </Link>
        <h1 className="text-2xl font-bold mt-4">{entry.nameZh}</h1>
        <p className="mt-3 p-4 bg-amber-50 text-amber-800 rounded-lg">
          這個家具模板還在開發中，目前先支援「方凳」。
        </p>
      </main>
    );
  }

  // 2026-05-13 全面上線：mobile shell 預設啟用。`?ui=v1` 留作逃生口
  // （desktop ≥768px 永遠走舊版，由 md:hidden / hidden md:block CSS 控制，不靠這個 flag）
  const uiV2 = (Array.isArray(sp.ui) ? sp.ui[0] : sp.ui) !== "v1";

  const parsed = parseDesignSearchParams(sp, entry);
  const { material, options, joineryMode } = parsed;
  // 設計師模式是專業版功能；未付費就算 URL 帶了 designerMode=true 也強制關掉，
  // 避免被分享連結繞過上限檢查。
  const designerMode = canUseDesignerMode && parsed.designerMode;
  const optionSchema = entry.optionSchema ?? [];
  // Server-side hard clamp:雙保險 — 不靠 canUseDesignerMode aggregate flag,
  // 直接看 plan 權限 + admin。即使 UI 哪天把 toggle 露給 free user(或 designerMode
  // 旗標被汙染),只要 plan 不允許就強制夾。admin 仍可繞 limit 方便測試。
  const limits = (planAllowsDesigner || isAdmin) && parsed.designerMode
    ? null
    : entry.limits ?? null;
  const length = limits ? Math.min(parsed.length, limits.length) : parsed.length;
  const width = limits ? Math.min(parsed.width, limits.width) : parsed.width;
  const height = limits ? Math.min(parsed.height, limits.height) : parsed.height;
  const clampedDims: { dim: string; from: number; to: number }[] = [];
  if (limits) {
    if (parsed.length > limits.length) clampedDims.push({ dim: "寬", from: parsed.length, to: limits.length });
    if (parsed.width > limits.width) clampedDims.push({ dim: "深", from: parsed.width, to: limits.width });
    if (parsed.height > limits.height) clampedDims.push({ dim: "高", from: parsed.height, to: limits.height });
  }

  // 書桌特例：H 框離地高 server-side clamp 到櫃底以下，讓 form 顯示實際採用值
  if (type === "desk") {
    const drawerCount = Number(options.drawerCount ?? 0);
    const reqStretcherY = Number(options.pedestalStretcherHeight ?? 0);
    if (drawerCount > 0 && reqStretcherY > 0) {
      const topThickness = Number(options.topThickness ?? 28);
      const withApron = options.withApron !== false;
      const apronWidth = Number(options.apronWidth ?? 90);
      const pedestalTopGap = Number(options.pedestalTopGap ?? 5);
      const legHeight = height - topThickness;
      const topGap = withApron ? apronWidth + 5 : pedestalTopGap;
      const caseTopY = legHeight - topGap;
      const maxCaseH = caseTopY - 80;
      const caseH = Math.min(maxCaseH, drawerCount * 130 + 30);
      const caseY = caseTopY - caseH;
      const STRETCHER_H = 40;
      const maxStretcherY = caseY - STRETCHER_H;
      if (reqStretcherY > maxStretcherY) {
        options.pedestalStretcherHeight = maxStretcherY;
      }
    }
  }
  const rawDesign = entry.template({ length, width, height, material, options });
  const design = joineryMode
    ? applyEdgeProtection(rawDesign)
    : toBeginnerMode(rawDesign);

  // 場景主題：URL `?scene=nordic|japandi|industrial|chinese`，預設 natural
  const sceneIdRaw = (typeof sp.scene === "string" ? sp.scene : "natural") as SceneThemeId;
  const sceneId: SceneThemeId = (Object.keys(SCENE_THEMES) as SceneThemeId[]).includes(sceneIdRaw)
    ? sceneIdRaw
    : "natural";
  const sceneTheme = SCENE_THEMES[sceneId];

  // Dev audit mode（drafting-math.md §A10.7 / §A11.7）：?audit=true URL 啟
  // 用，3D PerspectiveView 把 overlap 的 parts 用紅色 wireframe 高亮並
  // console.warn 列表。給開發人員肉眼看 audit 結果用。
  const auditMode = sp.audit === "true" || sp.audit === "1";
  // Debug：?hide=wall-front,wall-back 隱藏特定 part.id 看內部 CSG / joint 結果
  const hidePartIds = typeof sp.hide === "string" ? sp.hide.split(",").map((s) => s.trim()).filter(Boolean) : [];
  const xrayMode: "off" | "face" | "full" =
    sp.xray === "full" ? "full" :
    sp.xray === "face" || sp.xray === "true" || sp.xray === "1" ? "face" :
    "off";
  const wireframeMode = sp.wf === "1" || sp.wf === "true";

  // 爆炸視圖：?explode=N（mm）— joineryMode 下 tenon 沿 outward axis 偏移，
  // 視覺像榫頭從榫眼抽出。常用 20–40。
  const explodeMm = (() => {
    const raw = sp.explode;
    if (typeof raw !== "string") return 0;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? Math.min(200, n) : 0;
  })();
  // 掀蓋：?lidLift=N — dovetail-box 才用，看 lid 底下結構。
  //   正值（1-300）：lid 垂直浮起 N mm
  //   -1：lid 繞後緣 90° 翻開（鉸鏈式掀蓋）
  //   0 / 缺省：蓋上
  const lidLiftMm = (() => {
    const raw = sp.lidLift;
    if (typeof raw !== "string") return 0;
    const n = Number(raw);
    if (!Number.isFinite(n)) return 0;
    if (n < 0) return -1;  // open mode sentinel
    return n > 0 ? Math.min(300, n) : 0;
  })();

  const printQuery = designParamsToQuery(parsed, entry);

  // MobileShell 需要的 server 端計算
  let mobileTotalPrice = 0;
  let mobileWeight = 0;
  if (uiV2) {
    try {
      const quote = calculateQuote(design, {
        ...LABOR_DEFAULTS,
        primaryMaterialPricePerBdft: MATERIAL_PRICE_PER_BDFT[material] ?? 300,
      });
      mobileTotalPrice = quote.total;
    } catch (e) {
      console.warn("[MobileShell] calculateQuote failed, falling back to 0", e);
    }
    mobileWeight = estimateWeight(design);
  }

  const designUrl = `/design/${entry.category}`;
  // printQuery 已用 designParamsToQuery 序列化所有 optionValues（layoutMode / doorType / etc.）
  // 舊 baseQuoteParams 只帶 4 個基本參數，會讓報價頁全部 fallback 預設值，金額錯誤。
  const quoteUrl = `${designUrl}/quote?${printQuery.toString()}`;
  const cutPlanUrl = `${designUrl}/cut-plan?${printQuery.toString()}`;
  const printUrl = `${quoteUrl}&print=1`;
  const lineShareText = `木頭仁設計：${entry.nameZh} ${length}×${width}×${height}mm`;

  return (
    <>
    <div className={uiV2 ? "hidden md:block" : "block"}>
    <main className="max-w-7xl mx-auto px-6 py-6">
      <Link href="/" className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900 hover:underline">
        <span>←</span> 回家具列表
      </Link>

      <header className="mt-2 mb-4 flex items-baseline justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">{entry.nameZh}</h1>
          <p className="mt-0.5 text-xs text-zinc-500 flex flex-wrap items-center gap-2">
            <span>{entry.description}</span>
            <span className="font-mono text-zinc-700">· {length} × {width} × {height} mm</span>
            <span>· {MATERIALS[material].nameZh}</span>
            <span>· {design.parts.length} 件</span>
            <span title="實重 = 各部件 體積×木材密度 + 12% 包裝重">· 約 {estimateWeight(design)} kg</span>
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* <AskMasterButton
            category={type as FurnitureCategory}
            defaults={{ length, width, height }}
          /> */}
          <ShareDesignButton
            category={type as FurnitureCategory}
            defaults={{ length, width, height }}
          />
          {/* <PhotoToParamsButton /> */}
          <SaveDesignButton
            furnitureType={type}
            defaultName={`${entry.nameZh} ${length}×${width}×${height}`}
            params={{
              length,
              width,
              height,
              material,
              joineryMode,
              options,
            }}
          />
          <Link
            href={`/design/${type}/quote?${printQuery.toString()}`}
            target="_blank"
            className="px-3 py-1.5 bg-emerald-700 text-white rounded text-xs hover:bg-emerald-800"
          >
            💰 產生報價
          </Link>
          <Link
            href={`/design/${type}/print?${printQuery.toString()}`}
            target="_blank"
            className="px-3 py-1.5 bg-zinc-900 text-white rounded text-xs hover:bg-zinc-700 transition"
          >
            🖨️ 列印 / PDF
          </Link>
        </div>
      </header>

      {clampedDims.length > 0 && (
        <div className="mb-4 rounded-lg border-2 border-rose-400 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          <div className="flex items-start gap-2">
            <span className="text-base leading-none mt-0.5">🔒</span>
            <div className="flex-1">
              <div className="font-semibold mb-1">已達免費版尺寸上限——已自動縮回</div>
              <ul className="list-disc pl-5 space-y-0.5 text-xs">
                {clampedDims.map((c) => (
                  <li key={c.dim}>
                    {c.dim}：{c.from} mm <span className="text-rose-500">→</span> {c.to} mm
                  </li>
                ))}
              </ul>
              <div className="mt-2 text-xs">
                想做更大尺寸？開啟「設計師模式」自由輸入到 mm 級——
                <Link href="/pricing" className="font-semibold underline hover:text-rose-700">
                  升級專業版 →
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {design.warnings && design.warnings.length > 0 && (
        <div className="mb-4 rounded-lg border-2 border-amber-400 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <div className="flex items-start gap-2">
            <span className="text-base leading-none mt-0.5">⚠️</span>
            <div className="flex-1">
              <div className="font-semibold mb-1">設計參數有問題（已自動修正後續渲染）：</div>
              <ul className="list-disc pl-5 space-y-0.5 text-xs">
                {design.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      <DeflectionHints parts={design.parts} />

      {design.suggestions && design.suggestions.length > 0 && (
        <SuggestionsBox suggestions={design.suggestions} />
      )}

      {/* 主視覺：
          desktop = 左參數右 3D（3D sticky top-4）
          mobile = 3D 黏頂端 sticky（高度 40vh），參數表單在下方捲動 */}
      <SelectedPartProvider>
      <HoveredPartsProvider>
      <section className="lg:grid lg:grid-cols-[5fr_7fr] gap-4">
        {/* 3D 區塊：DOM 第一順位 → mobile 自動在上；desktop 用 grid 顯式放到右欄 row 1 */}
        <div
          className="
            sticky top-0 z-20 -mx-6 px-6 pb-2 bg-[#fafaf7]
            lg:relative lg:top-4 lg:mx-0 lg:px-0 lg:pb-0 lg:bg-transparent
            lg:col-start-2 lg:row-start-1 lg:sticky lg:self-start
          "
        >
          <div className="rounded-lg border border-zinc-200 bg-white overflow-hidden">
            <div className="px-4 py-1.5 border-b border-zinc-200 text-xs font-semibold text-zinc-700 flex items-center gap-2">
              <span className="w-0.5 h-4 bg-amber-500 rounded-full" />
              透視圖（3D · 拖曳旋轉）
            </div>
            <SceneThemeToggle current={sceneId} />
            <LazyPerspectiveView design={design} sceneTheme={sceneTheme} joineryMode={joineryMode} auditMode={auditMode} explodeMm={explodeMm} lidLiftMm={lidLiftMm} xrayMode={xrayMode} wireframeMode={wireframeMode} hidePartIds={hidePartIds} noSync />
          </div>
        </div>

        {/* 參數表單：DOM 第二順位 → mobile 在 3D 下方；desktop grid 顯式放到左欄 row 1 */}
        <div className="mt-3 lg:mt-0 lg:col-start-1 lg:row-start-1">
          <ParameterForm
            type={type}
            defaults={{ length, width, height, material }}
            limits={designerMode ? undefined : entry.limits}
            optionSchema={optionSchema}
            optionValues={options}
            joineryMode={joineryMode}
            designerMode={designerMode}
            canUseDesignerMode={canUseDesignerMode}
            allPartIds={design.parts.map((p) => p.id)}
          />
        </div>
      </section>

      <section className="mt-4 rounded-lg border border-zinc-200 bg-white overflow-hidden">
        <div className="px-4 py-2 border-b border-zinc-200 text-xs font-semibold text-zinc-700 flex items-center gap-2">
          <span className="w-0.5 h-4 bg-amber-500 rounded-full" />
          工程三視圖
          <span className="ml-auto text-[10px] font-normal text-zinc-400">
            標示為組裝後肩到肩可見尺寸
          </span>
        </div>
        <div className="p-3">
          <ZoomableThreeViews design={design} joineryMode={joineryMode} />
        </div>
      </section>

      {/* 零件圖（Phase 1 Task 7）：榫接 / 非方料 零件出獨立工程圖卡，卡片 → modal
          一律走榫接版（applyEdgeProtection），不吃 toBeginnerMode strip——零件圖
          是給師傅看的製作圖，組裝版 strip 會把腳 / 牙條的 tenon/mortise 砍掉，
          導致 needsPartDrawing 全 false 只剩 shape 件出現。
          開發中，僅 localhost 顯示。 */}
      {(await isLocalhost()) && <PartDrawingsPanel design={applyEdgeProtection(rawDesign)} />}

      {/* 下半：施工備料（按需展開） */}
      <details className="mt-4 rounded-lg border border-zinc-200 bg-white" open>
        <summary className="cursor-pointer list-none px-4 py-3 text-sm flex items-center justify-between hover:bg-zinc-50">
          <span className="font-medium text-zinc-800 flex items-center gap-2">
            <span className="w-0.5 h-4 bg-amber-500 rounded-full" />
            🪵 材料單
            <span className="text-[10px] font-normal text-zinc-400">{design.parts.length} 件 · 切料尺寸已含榫頭</span>
          </span>
          <span className="text-xs text-zinc-400">展開 / 收合</span>
        </summary>
        <div className="border-t border-zinc-200">
          <div className="px-4 py-2 bg-zinc-50 border-b border-zinc-200 flex items-center justify-between text-[11px] text-zinc-500">
            <span>切料尺寸已含榫頭凸出長度。母榫（凹）不影響零件外形尺寸。</span>
            <Link
              href={`/design/${type}/cut-plan?${printQuery.toString()}`}
              target="_blank"
              className="px-2.5 py-1 bg-amber-600 text-white rounded text-[11px] hover:bg-amber-700"
            >
              🪚 裁切計算器
            </Link>
          </div>
          {/* desktop 雙欄：左清單右 sticky 3D；mobile 單欄 + Material3dPip 浮窗 */}
          <div className="lg:grid lg:grid-cols-[7fr_5fr] lg:gap-4">
            <div data-pip-area className="lg:col-start-1 lg:row-start-1 min-w-0">
              <MaterialListWithSelection design={design} />
            </div>
            <div className="hidden lg:block lg:col-start-2 lg:row-start-1 lg:sticky lg:top-4 lg:self-start lg:px-3 lg:py-3">
              <div className="rounded-lg border border-zinc-200 bg-white overflow-hidden">
                <div className="px-3 py-1.5 border-b border-zinc-200 text-[11px] font-semibold text-zinc-600 flex items-center gap-2">
                  <span className="w-0.5 h-3 bg-amber-500 rounded-full" />
                  3D 預覽（同步高亮選中零件）
                </div>
                <SceneThemeToggle current={sceneId} />
                <LazyPerspectiveView design={design} sceneTheme={sceneTheme} joineryMode={joineryMode} auditMode={auditMode} explodeMm={explodeMm} lidLiftMm={lidLiftMm} xrayMode={xrayMode} hidePartIds={hidePartIds} />
              </div>
            </div>
          </div>
          {/* mobile only：scroll 進材料區出現頂端 banner */}
          <Material3dPip>
            <LazyPerspectiveView design={design} sceneTheme={sceneTheme} joineryMode={joineryMode} auditMode={auditMode} explodeMm={explodeMm} lidLiftMm={lidLiftMm} xrayMode={xrayMode} hidePartIds={hidePartIds} compactMode />
          </Material3dPip>
        </div>
      </details>
      </HoveredPartsProvider>
      </SelectedPartProvider>

      <details className="mt-3 rounded-lg border border-zinc-200 bg-white overflow-hidden">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm flex items-center justify-between hover:bg-zinc-50">
          <span className="font-medium text-zinc-800 flex items-center gap-2">
            <span className="w-0.5 h-4 bg-amber-500 rounded-full" />
            {joineryMode ? "🪚 榫卯細節圖" : "🔩 組裝接合說明"}
          </span>
          <span className="text-xs text-zinc-400">展開 / 收合</span>
        </summary>
        <div className="border-t border-zinc-200 p-4">
          {joineryMode ? (
            <JoinerySection design={design} />
          ) : (
            <div className="rounded-lg bg-emerald-50 ring-1 ring-emerald-200 p-5 text-sm text-emerald-900 leading-relaxed">
              <p className="font-semibold mb-2">📐 無榫卯組裝方式（擇一或混用）</p>
              <ul className="space-y-1.5 list-disc list-inside ml-1">
                <li><b>斜孔螺絲</b>—— 板材垂直接合（頂板↔側板、層板↔側板）。用斜孔器夾具鑽 15° 斜孔，螺絲從隱藏面鎖入，外觀看不到螺絲頭。</li>
                <li><b>木釘拼接</b>—— 板材拼寬或結構補強，用木板打孔定位器 + 8mm 木釘。</li>
                <li><b>DOMINO 圓榫</b>—— 想要更接近榫接強度可用 DOMINO 系統（機具另備）。</li>
                <li><b>木工螺絲 + 白膠</b>—— 框架類（椅腳↔牙板、橫撐↔椅腳）最簡單。先鑽先導孔避免劈裂。</li>
                <li><b>所有接點務必上白膠</b>—— 機械緊固 + 膠合才是真正牢固。螺絲木釘只是夾緊工具。</li>
              </ul>
              <p className="mt-3 text-xs text-emerald-700">
                建議工具：斜孔器夾具、木板打孔定位器、電鑽、鑽頭組、PVA 木工膠、F 夾具×4、砂紙 120/240/400。
              </p>
              <p className="mt-2 text-xs text-emerald-600">
                如需傳統榫卯設計（含榫頭榫眼細節圖、工序更精緻）請勾選左側「榫接模式」。
              </p>
            </div>
          )}
        </div>
      </details>

      <details className="mt-3 rounded-lg border border-zinc-200 bg-white overflow-hidden">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm flex items-center justify-between hover:bg-zinc-50">
          <span className="font-medium text-zinc-800 flex items-center gap-2">
            <span className="w-0.5 h-4 bg-amber-500 rounded-full" />
            🛠️ 工具清單
          </span>
          <span className="text-xs text-zinc-400">展開 / 收合</span>
        </summary>
        <div className="border-t border-zinc-200 p-4">
          <ToolList design={design} />
        </div>
      </details>

      <details className="mt-3 rounded-lg border border-zinc-200 bg-white overflow-hidden">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm flex items-center justify-between hover:bg-zinc-50">
          <span className="font-medium text-zinc-800 flex items-center gap-2">
            <span className="w-0.5 h-4 bg-amber-500 rounded-full" />
            📋 製作工序
          </span>
          <span className="text-xs text-zinc-400">展開 / 收合</span>
        </summary>
        <div className="border-t border-zinc-200 p-4">
          <BuildSteps design={design} />
        </div>
      </details>
    </main>
    </div>
    {uiV2 && (
      <MobileShell
        entry={{ category: entry.category, nameZh: entry.nameZh, description: entry.description, difficulty: entry.difficulty, defaults: entry.defaults, limits: entry.limits, optionSchema: entry.optionSchema }}
        design={design}
        length={length}
        width={width}
        height={height}
        material={material}
        optionValues={options}
        totalPrice={mobileTotalPrice}
        weight={mobileWeight}
        designUrl={designUrl}
        quoteUrl={quoteUrl}
        cutPlanUrl={cutPlanUrl}
        printUrl={printUrl}
        lineShareText={lineShareText}
        formAction={designUrl}
        wireframeMode={wireframeMode}
        joineryMode={joineryMode}
        designerMode={designerMode}
        canUseDesignerMode={canUseDesignerMode}
        sceneId={sceneId}
      />
    )}
    </>
  );
}

function JoineryRulesCallout() {
  return (
    <div className="rounded-lg bg-amber-50 ring-1 ring-amber-200 p-4 text-xs text-amber-900 leading-relaxed mb-5">
      <p className="font-semibold mb-1.5">
        榫卯比例規則（本設計依此推算 — FWW / Popular Woodworking / Woodcraft / Rockler 共識）
      </p>
      <ul className="space-y-0.5 list-disc list-inside">
        <li>
          <b>方榫厚</b> = <b>被開榫眼的母件（柱腳）厚度的 1/3</b>（例 1.5" 柱腳 → 1/2" 榫厚）；
          若公件較薄則取 <b>min(公件厚 − 兩側肩各 6mm, 母厚/3)</b>
        </li>
        <li>
          <b>方榫長</b>：盲榫 = 柱腳寬的 <b>2/3</b>；通榫 = 母件厚度（穿透，常加 <b>楔片</b>防脫）
        </li>
        <li>
          <b>方榫寬</b> = 牙板寬 <b>−上下肩各 6mm</b>（固定量非比例）；
          榫寬 &gt; 5×榫厚或牙板 &gt; 125mm 時拆 <b>雙榫</b>（twin tenon）
        </li>
        <li>
          <b>帶肩榫肩長</b> = 主榫長 <b>1/3</b>；肩榫永遠在主榫<b>上方</b>，補滿桌面通榫孔縫 + 防旋轉
        </li>
        <li>
          <b>企口榫</b>：舌厚 = 板厚 <b>1/3</b>（18mm 板 → 6mm 舌）、兩側肩各 6mm；
          <b>凹槽深度 = 舌長 + 1mm</b>（必留漲縮餘量，否則濕季撕裂）
        </li>
        <li>
          <b>鳩尾榫</b>：硬木 <b>1:8</b>（≈7.1°）、軟木 <b>1:6</b>（≈9.5°）；
          兩端必為「銷」（pin）不是「尾」，承拉力
        </li>
        <li>
          <b>半搭榫</b>：兩件各削 <b>1/2</b> 板厚；垂直半搭強度 = 整體 1/2，水平半搭僅 1/8
        </li>
        <li>
          <b>指接榫</b>：指厚 = 板厚 <b>1/2</b>；指數 4–9 個常見，比例 1:1 或 1:2 都可
        </li>
        <li>
          <b>圓棒榫</b>：木釘徑 = 板厚 <b>1/3</b>（不超過 1/2）；長 = 徑 × 1.5 + 1/16" 餘量；
          沿邊每尺 4–6 支
        </li>
        <li>
          <b>配合容差</b>（mortise ↔ tenon）：緊 0.05–0.13mm｜<b>標準 0.13–0.25mm</b>｜鬆 0.25–0.38mm
        </li>
      </ul>
    </div>
  );
}

function JoinerySection({ design }: { design: FurnitureDesign }) {
  const usages = extractJoineryUsages(design);
  if (usages.length === 0) {
    return <p className="text-sm text-zinc-500">這個設計沒有可顯示的榫卯。</p>;
  }
  return (
    <div className="space-y-6">
      <JoineryRulesCallout />
      {usages.map((u, i) => (
        <div
          key={i}
          className="rounded-lg border border-zinc-200 bg-white p-4"
        >
          <div className="flex items-baseline justify-between flex-wrap gap-2 mb-2">
            <h3 className="font-semibold">
              {JOINERY_LABEL[u.type]}{" "}
              <span className="text-xs font-normal text-zinc-500">
                · {u.partNameZh} ↔ {u.motherPartNames.length > 0 ? u.motherPartNames.join(" / ") : "母件"} · 共 {u.count} 處
              </span>
            </h3>
            <p className="text-xs text-zinc-500">
              榫頭 {u.tenon.length} × {u.tenon.width} × {u.tenon.thickness} mm
            </p>
          </div>
          <p className="text-xs text-zinc-600 mb-3">{JOINERY_DESCRIPTION[u.type]}</p>
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
              material: design.parts.find((part) => part.id === u.partId)?.material ?? design.parts[0]?.material,
            }}
          />
        </div>
      ))}
    </div>
  );
}

function ParameterForm({
  type,
  defaults,
  limits,
  optionSchema,
  optionValues,
  joineryMode,
  designerMode,
  canUseDesignerMode,
  allPartIds,
}: {
  type: string;
  defaults: { length: number; width: number; height: number; material: MaterialId };
  limits?: { length: number; width: number; height: number };
  optionSchema: OptionSpec[];
  optionValues: Record<string, string | number | boolean>;
  joineryMode: boolean;
  designerMode: boolean;
  canUseDesignerMode: boolean;
  allPartIds: string[];
}) {
  return (
    <DesignFormShell
      action={`/design/${type}`}
      className="p-5 bg-zinc-50 rounded-lg ring-1 ring-zinc-200"
    >
      {type !== "pencil-holder" && type !== "tray" && type !== "dovetail-box" && (
        <fieldset className="mb-5">
          <legend className="mb-2 text-sm font-semibold text-zinc-800 flex items-center gap-2">
            <span className="w-0.5 h-4 bg-amber-500 rounded-full" />
            工法選擇
            <span className="text-[10px] font-normal text-zinc-400">— 影響材料單與接合工序</span>
          </legend>
          <div className="grid grid-cols-2 gap-2">
            <label
              className={`flex flex-col gap-1 p-3 rounded-lg cursor-pointer ring-2 transition ${
                !joineryMode
                  ? "ring-emerald-500 bg-emerald-50"
                  : "ring-zinc-200 bg-white hover:ring-zinc-300"
              }`}
            >
              <input
                type="radio"
                name="joineryMode"
                value=""
                defaultChecked={!joineryMode}
                className="sr-only"
              />
              <div className="text-sm font-semibold text-emerald-900 flex items-center gap-1">
                🔩 組裝版
                <span className="text-[10px] font-normal text-emerald-700 ml-auto">推薦新手</span>
              </div>
              <div className="text-[11px] text-emerald-800 leading-relaxed">
                螺絲 / 木釘 / DOMINO / 斜孔系統。施作快、強度約榫接版 60–70%，日常家具夠用。
              </div>
            </label>
            <label
              className={`flex flex-col gap-1 p-3 rounded-lg cursor-pointer ring-2 transition ${
                joineryMode
                  ? "ring-amber-500 bg-amber-50"
                  : "ring-zinc-200 bg-white hover:ring-zinc-300"
              }`}
            >
              <input
                type="radio"
                name="joineryMode"
                value="true"
                defaultChecked={joineryMode}
                className="sr-only"
              />
              <div className="text-sm font-semibold text-amber-900 flex items-center gap-1">
                🪵 榫接版
                <span className="text-[10px] font-normal text-amber-700 ml-auto">傳統工法</span>
              </div>
              <div className="text-[11px] text-amber-800 leading-relaxed">
                傳統榫卯接合，含榫頭榫眼細節圖、精緻工序。難度較高、做工較久。
              </div>
            </label>
          </div>
        </fieldset>
      )}
      <fieldset className="mb-4 rounded-lg border-2 border-amber-200 bg-amber-50/40 p-3">
        <legend className="text-xs text-amber-900 px-1.5 font-semibold">
          🎨 設計師模式（自由尺寸）
        </legend>
        {canUseDesignerMode ? (
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              name="designerMode"
              value="true"
              defaultChecked={designerMode}
              className="mt-0.5 h-4 w-4 accent-amber-600 shrink-0"
            />
            <div className="flex-1 min-w-0">
              <div className="text-xs text-amber-900 leading-relaxed">
                開啟後解除範本上限，可輸入到 mm 級客製尺寸（卡牆 2387 / 避柱凹槽 等系統櫃級需求）。
              </div>
              {designerMode && (
                <div className="mt-1.5 text-[10px] text-amber-700 leading-relaxed">
                  ⚠️ 已啟用：尺寸不再受範本上限限制。極端尺寸下範本可能產生不合理結果（樑深不足、榫接無法成立），請務必以三視圖檢核。
                </div>
              )}
            </div>
          </label>
        ) : (
          <div className="flex items-start gap-2">
            <div className="mt-0.5 h-4 w-4 shrink-0 rounded border border-amber-300 bg-white flex items-center justify-center text-[10px] text-amber-600">
              🔒
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-amber-900 leading-relaxed">
                解除範本尺寸上限，輸入到 mm 級客製尺寸（卡牆 2387 / 避柱凹槽 等系統櫃級需求）。
              </div>
              <div className="mt-1.5 text-[11px] text-amber-800">
                這是 <span className="font-semibold">專業版</span> 功能。
                <Link href="/pricing" className="ml-1 underline font-medium hover:text-amber-900">
                  看方案 →
                </Link>
              </div>
            </div>
          </div>
        )}
      </fieldset>
      <div className="mb-4 pb-3 border-b border-zinc-200 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-zinc-800 flex items-center gap-2">
          <span className="w-0.5 h-4 bg-amber-500 rounded-full" />
          整體尺寸
          {designerMode && (
            <span className="text-[10px] font-normal text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
              無上限
            </span>
          )}
        </h3>
        <ResetDefaultsButton />
      </div>
      <SizePresetButtons category={type as FurnitureCategory} />
      <HeightToSizeButton category={type as FurnitureCategory} />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {/* key 綁 defaultValue 強制 remount——server clamp 後 input 才會顯示縮回後的值 */}
        <NumberInput
          key={`length-${defaults.length}`}
          name="length"
          label="寬 (mm)"
          defaultValue={defaults.length}
          max={limits?.length}
          partIds={resolvePartIds("length", allPartIds)}
        />
        <NumberInput
          key={`width-${defaults.width}`}
          name="width"
          label="深 (mm)"
          defaultValue={defaults.width}
          max={limits?.width}
          partIds={resolvePartIds("width", allPartIds)}
        />
        <NumberInput
          key={`height-${defaults.height}`}
          name="height"
          label="高 (mm)"
          defaultValue={defaults.height}
          max={limits?.height}
          partIds={resolvePartIds("height", allPartIds)}
          presetPoints={getHeightPresetsForCategory(type)}
        />
        <label className="flex flex-col text-xs">
          <span className="text-zinc-600 mb-1">木材</span>
          <select
            key={`material-${defaults.material}`}
            name="material"
            defaultValue={defaults.material}
            className="border border-zinc-300 rounded px-2 py-1.5 bg-white text-zinc-900 text-base"
          >
            {Object.values(MATERIALS).map((m) => (
              <option key={m.id} value={m.id}>
                {m.nameZh}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* 木材立體屬性面板：6 軸雷達圖 + 文化定位 + CITES/油性警示 */}
      <MaterialAttributesPanel materialId={defaults.material} />

      {/* 人體工學提示：根據家具類別給座高/桌高/椅桌差等合理範圍警告 */}
      <ErgoHints
        category={type}
        overall={{
          length: defaults.length,
          width: defaults.width,
          height: defaults.height,
        }}
        options={optionValues}
      />

      {optionSchema.length > 0 && (
        <>
          <div className="mb-3 pb-2 border-b border-zinc-200">
            <h3 className="text-sm font-semibold text-zinc-800 flex items-center gap-2">
              <span className="w-0.5 h-4 bg-amber-500 rounded-full" />
              細部設定
            </h3>
          </div>
          {/* 中式方角櫃自有 9 個 cabinetPreset (書櫃/茶櫃/明式頂箱櫃...) +
              比例風格 ming/qing 切換，跟通用「Shaker / 北歐 / 工業風」風格不
              相容（中式不會套西式風格），隱藏避免 user 混淆。 */}
          {type !== "chinese-cabinet" && (
            <StylePresetButtons
              optionSchema={optionSchema}
              category={type as FurnitureCategory}
              designSize={{ length: defaults.length, width: defaults.width, height: defaults.height }}
            />
          )}
          {/* <div className="mb-3 flex justify-end">
            <AIRefineButton
              optionSchema={optionSchema}
              category={type as FurnitureCategory}
              designSize={{ length: defaults.length, width: defaults.width, height: defaults.height }}
            />
          </div> */}
          <StyleMismatchWarning />
          <EdgePresetButtons optionSchema={optionSchema} />
          <GroupedOptionFields
            optionSchema={optionSchema}
            optionValues={optionValues}
            joineryMode={joineryMode}
            overallHeight={defaults.height}
            overallLength={defaults.length}
            allPartIds={allPartIds}
          />
        </>
      )}

      <p className="text-[11px] text-zinc-500 flex items-center gap-2">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
        改參數 0.5 秒後自動更新設計
      </p>
    </DesignFormShell>
  );
}

// GROUP_META / GROUP_ORDER 改抽到 lib/design/option-groups.ts 供手機 AdvancedSheet
// 共用，避免兩邊各維護一份漂移。

function isVisible(
  spec: OptionSpec,
  values: Record<string, string | number | boolean>,
): boolean {
  // 沒設 dependsOn 一律顯示。設了 dependsOn 就依規則 evaluate。
  // 之前用 checkbox 父子有 race condition（勾父子沒跳出來），現在只認
  // select-based notIn——切 select 會觸發 URL params 更新跟完整 re-render
  // 不會卡住
  const dep = spec.dependsOn;
  if (!dep) return true;
  return evalDep(dep, values);
}

function evalDep(
  dep: OptionDependency,
  values: Record<string, string | number | boolean>,
): boolean {
  if (dep.all) return dep.all.every((d) => evalDep(d, values));
  if (dep.any) return dep.any.some((d) => evalDep(d, values));
  if (!dep.key) return true;
  const v = values[dep.key];
  if (dep.notIn && dep.notIn.includes(v as string | number | boolean)) return false;
  if (dep.oneOf && !dep.oneOf.includes(v as string | number | boolean)) return false;
  if (dep.equals !== undefined && v !== dep.equals) return false;
  if (dep.equals === undefined && dep.notIn === undefined && dep.oneOf === undefined && !v) return false;
  return true;
}

function GroupedOptionFields({
  optionSchema,
  optionValues,
  joineryMode,
  overallHeight,
  overallLength,
  allPartIds,
}: {
  optionSchema: OptionSpec[];
  optionValues: Record<string, string | number | boolean>;
  joineryMode: boolean;
  overallHeight?: number;
  overallLength?: number;
  allPartIds?: string[];
}) {
  // legPenetratingTenon 只在榫接版有意義（組裝版根本不畫榫頭），組裝版隱藏避免混淆
  const visibleSchema = optionSchema.filter(
    (s) => isVisible(s, optionValues) && (joineryMode || s.key !== "legPenetratingTenon"),
  );
  const grouped = new Map<string, OptionSpec[]>();
  for (const spec of visibleSchema) {
    const g = spec.group ?? "misc";
    if (!grouped.has(g)) grouped.set(g, []);
    grouped.get(g)!.push(spec);
  }
  const keysInOrder = GROUP_ORDER.filter((k) => grouped.has(k)).concat(
    Array.from(grouped.keys()).filter((k) => !GROUP_ORDER.includes(k)),
  );
  return (
    <div className="mb-4 rounded-lg border border-zinc-200 bg-white divide-y divide-zinc-100">
      {keysInOrder.map((g) => {
        const meta = GROUP_META[g] ?? GROUP_META.misc;
        const specs = grouped.get(g)!;
        return (
          <details
            key={g}
            open
            className="group"
          >
            <summary className="flex items-center gap-1.5 px-2.5 py-1 cursor-pointer list-none hover:bg-zinc-50 select-none">
              <span className={`w-1 h-3.5 rounded-full ${meta.bar}`} />
              <span className="text-xs font-semibold text-zinc-800">
                {meta.label}
              </span>
              <span className="text-[10px] text-zinc-400">
                {specs.length}
              </span>
              <span className="ml-auto text-[10px] text-zinc-400 group-open:rotate-180 transition-transform">
                ▾
              </span>
            </summary>
            <div className="px-2.5 pb-2 pt-0.5 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-x-2 gap-y-1.5">
              {specs.map((spec) => {
                const isWide = spec.type === "checkbox" && spec.wide;
                // key 帶 value：URL 改變（如 EdgePresetButtons 一鍵套用倒角）時
                // 強制 remount，input/select 才會用新 defaultValue；
                // 沒 key 的話 React 重用 DOM node，defaultValue 變動被忽略 → 表單顯示舊值
                return (
                  <div
                    key={`${spec.key}-${String(optionValues[spec.key])}`}
                    className={isWide ? "col-span-2 md:col-span-3 lg:col-span-3" : ""}
                  >
                    <OptionField spec={spec} value={optionValues[spec.key]} allValues={optionValues} overallHeight={overallHeight} overallLength={overallLength} allPartIds={allPartIds} />
                  </div>
                );
              })}
            </div>
          </details>
        );
      })}
    </div>
  );
}

function OptionField({
  spec,
  value,
  allValues,
  overallHeight,
  overallLength,
  allPartIds,
}: {
  spec: OptionSpec;
  value: string | number | boolean;
  allValues?: Record<string, string | number | boolean>;
  overallHeight?: number;
  overallLength?: number;
  allPartIds?: string[];
}) {
  const choiceVisible = (
    dep: import("@/lib/types").OptionDependency | undefined,
  ): boolean => {
    if (!dep || !allValues) return true;
    return evalDep(dep, allValues);
  };
  if (spec.type === "number") {
    // 鎖定總高時，區段高度 max 動態縮成「內高扣其他層」
    const LOCKED_ZONE_KEYS = ["topHeight", "midHeight", "bottomHeight", "upperHeight", "lowerHeight"];
    const COLUMN_WIDTH_KEYS = ["leftWidthMm", "rightWidthMm", "singleLayerLeftWidthMm", "singleLayerRightWidthMm"];
    let effectiveMax = spec.max;
    const locked = !!(allValues && allValues.lockTotalHeight === true);
    const isLockedZone = locked && LOCKED_ZONE_KEYS.includes(spec.key) && overallHeight !== undefined && overallHeight > 0;
    if (isLockedZone) {
      const MIN_LEG = 30;
      const panelT = Number(allValues!.panelThickness) || 18;
      let otherSum = 0;
      for (const k of LOCKED_ZONE_KEYS) {
        if (k === spec.key) continue;
        const v = Number(allValues![k]);
        if (Number.isFinite(v) && v > 0) otherSum += v;
      }
      const innerCap = overallHeight! - MIN_LEG - 2 * panelT;
      const dynamicMax = Math.max(spec.min ?? 80, innerCap - otherSum);
      effectiveMax = Math.min(spec.max ?? 99999, dynamicMax);
    }
    // 橫向欄寬欄位：依 layoutMode + 其他欄寬動態夾 max
    const isColumnWidth = allValues && overallLength !== undefined && overallLength > 0 && COLUMN_WIDTH_KEYS.includes(spec.key);
    if (isColumnWidth) {
      const MIN_COL = 80;
      const panelT = Number(allValues!.panelThickness) || 18;
      const layoutMode = String(allValues!.layoutMode ?? "");
      const innerW = overallLength! - 2 * panelT;
      let wmax: number | null = null;
      if (spec.key === "leftWidthMm" && layoutMode === "h-2col") {
        wmax = Math.max(MIN_COL, innerW - panelT - MIN_COL);
      } else if ((spec.key === "leftWidthMm" || spec.key === "rightWidthMm") && layoutMode === "h-3col") {
        const otherKey = spec.key === "leftWidthMm" ? "rightWidthMm" : "leftWidthMm";
        const other = Math.max(MIN_COL, Number(allValues![otherKey]) || 0);
        wmax = Math.max(MIN_COL, innerW - 2 * panelT - other - MIN_COL);
      } else {
        const singleCols = parseInt(String(allValues!.singleLayerCols ?? "1"), 10) || 1;
        const inVertical = layoutMode === "v-1layer" || layoutMode === "v-2layer";
        if (spec.key === "singleLayerLeftWidthMm" && inVertical && singleCols >= 2) {
          if (singleCols === 2) {
            wmax = Math.max(MIN_COL, innerW - panelT - MIN_COL);
          } else {
            const other = Math.max(MIN_COL, Number(allValues!.singleLayerRightWidthMm) || 0);
            wmax = Math.max(MIN_COL, innerW - 2 * panelT - other - MIN_COL);
          }
        } else if (spec.key === "singleLayerRightWidthMm" && inVertical && singleCols === 3) {
          const other = Math.max(MIN_COL, Number(allValues!.singleLayerLeftWidthMm) || 0);
          wmax = Math.max(MIN_COL, innerW - 2 * panelT - other - MIN_COL);
        }
      }
      if (wmax !== null) effectiveMax = Math.min(effectiveMax ?? 99999, wmax);
    }
    return (
      <label className="flex flex-col text-xs" title={spec.help}>
        <span className="text-zinc-700 mb-0.5 truncate">
          {spec.label}
          {spec.unit && <span className="text-zinc-400 ml-1">·{spec.unit}</span>}
        </span>
        {isLockedZone || isColumnWidth ? (
          <ClampedNumberInput
            name={spec.key}
            defaultValue={String(value)}
            min={spec.min}
            max={effectiveMax}
            step={spec.step ?? 1}
            className="border border-zinc-300 rounded px-1.5 py-1 bg-white text-zinc-900 text-sm"
            partIds={allPartIds ? resolvePartIds(spec.key, allPartIds) : undefined}
            showPlusMinus
            dynamicMaxHint={
              effectiveMax !== spec.max
                ? `上限 ${effectiveMax}${isLockedZone ? "（鎖總高）" : ""}`
                : undefined
            }
          />
        ) : (
          <ClampedNumberInput
            name={spec.key}
            defaultValue={String(value)}
            min={spec.min}
            max={effectiveMax}
            step={spec.step ?? 1}
            className="border border-zinc-300 rounded px-1.5 py-1 bg-white text-zinc-900 text-sm"
            partIds={allPartIds ? resolvePartIds(spec.key, allPartIds) : undefined}
          />
        )}
        {spec.help && <span className="mt-0.5 text-[10px] text-zinc-500 line-clamp-1 hover:line-clamp-none">{spec.help}</span>}
      </label>
    );
  }
  if (spec.type === "select") {
    return (
      <label className="flex flex-col text-xs" title={spec.help}>
        <span className="text-zinc-700 mb-0.5 truncate">{spec.label}</span>
        <select
          name={spec.key}
          defaultValue={String(value)}
          className="border border-zinc-300 rounded px-1.5 py-1 bg-white text-zinc-900 text-sm"
        >
          {spec.choices.filter((c) => choiceVisible(c.dependsOn)).map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
        {spec.help && <span className="mt-0.5 text-[10px] text-zinc-500 line-clamp-1 hover:line-clamp-none">{spec.help}</span>}
      </label>
    );
  }
  // checkbox — auto-submit so conditional sub-options appear immediately on toggle
  const showLegReadout =
    spec.key === "lockTotalHeight"
    && Boolean(value)
    && allValues
    && overallHeight !== undefined
    && overallHeight > 0;
  let legReadout: { leg: number; clamped: boolean } | null = null;
  if (showLegReadout) {
    const LOCKED_ZONE_KEYS = ["topHeight", "midHeight", "bottomHeight", "upperHeight", "lowerHeight"];
    const MIN_LEG = 30;
    const panelT = Number(allValues!.panelThickness) || 18;
    let zoneSum = 0;
    for (const k of LOCKED_ZONE_KEYS) {
      const v = Number(allValues![k]);
      if (Number.isFinite(v) && v > 0) zoneSum += v;
    }
    const raw = overallHeight! - zoneSum - 2 * panelT;
    legReadout = { leg: Math.max(MIN_LEG, raw), clamped: raw < MIN_LEG };
  }
  return (
    <div className="flex flex-col gap-0.5">
      <AutoSubmitCheckbox
        name={spec.key}
        defaultChecked={Boolean(value)}
        label={spec.label}
        help={spec.help}
      />
      {legReadout && (
        <label className="flex flex-col text-xs">
          <span className="text-zinc-700 mb-0.5 truncate">
            計算後腳高
            <span className="text-zinc-400 ml-1">·mm</span>
          </span>
          <div
            className={`border rounded px-1.5 py-1 text-sm font-mono tabular-nums ${
              legReadout.clamped
                ? "bg-red-50 border-red-300 text-red-700"
                : "bg-amber-50 border-amber-300 text-amber-900"
            }`}
          >
            {legReadout.leg}
          </div>
          {legReadout.clamped && (
            <span className="mt-0.5 text-[10px] text-red-600">已夾到最低 30mm，請降低層高或加大總高</span>
          )}
        </label>
      )}
    </div>
  );
}

/**
 * family-aware 高度預設值（mm）。
 * 只給「高」一個維度，避免桌機畫面塞太擠。
 */
function getHeightPresetsForCategory(type: string): { value: number; label: string }[] {
  const t = type.toLowerCase();
  if (t.includes("dining-table") || t.includes("desk") || t.includes("workbench")) {
    return [{ value: 720, label: "餐桌" }, { value: 760, label: "工作" }];
  }
  if (t.includes("bar")) {
    return [{ value: 1050, label: "吧台" }, { value: 750, label: "餐桌" }];
  }
  if (t.includes("chair") || t.includes("stool") || t.includes("bench")) {
    return [{ value: 450, label: "餐椅" }, { value: 750, label: "吧凳" }];
  }
  if (t.includes("coffee-table") || t.includes("side-table") || t.includes("nightstand")) {
    return [{ value: 420, label: "茶几" }, { value: 550, label: "床頭" }];
  }
  if (t.includes("bookcase") || t.includes("shelf") || t.includes("cabinet")) {
    return [{ value: 1800, label: "高櫃" }, { value: 900, label: "矮櫃" }];
  }
  return [];
}

function NumberInput({
  name,
  label,
  defaultValue,
  max,
  partIds,
  presetPoints,
}: {
  name: string;
  label: string;
  defaultValue: number;
  max?: number;
  partIds?: string[];
  presetPoints?: { value: number; label: string }[];
}) {
  return (
    <label className="flex flex-col text-xs">
      <span className="text-zinc-600 mb-1">{label}{max ? ` · 上限 ${max}` : ""}</span>
      <ClampedNumberInput
        name={name}
        defaultValue={defaultValue}
        min={20}
        max={max ?? 4000}
        step={5}
        className="border border-zinc-300 rounded px-2 py-1.5 bg-white text-zinc-900 text-base"
        partIds={partIds}
        presetPoints={presetPoints}
        showPlusMinus
      />
    </label>
  );
}
