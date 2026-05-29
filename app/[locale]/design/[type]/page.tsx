import { Link } from "@/i18n/navigation";
import { notFound, redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing, type Locale } from "@/i18n/routing";
import { getTemplate, getEntryName, getEntryDescription } from "@/lib/templates";
import { FEATURED_TEMPLATE_CATEGORIES } from "@/lib/templates/marketing";
import { createClient, createAdminClient, getSessionUser } from "@/lib/supabase/server";
import { canAccessCategory, getPlanFeatures, isPaidCategory } from "@/lib/permissions";
import { fetchUnlockedCategories } from "@/lib/unlocks";
import { getServerAdminEmails, isAdminEmail } from "@/lib/admin";
import { toBeginnerMode } from "@/lib/templates/beginner-mode";
import { applyEdgeProtection } from "@/lib/joinery/edge-protection";
import { estimateWeight } from "@/lib/design/shipping";
import { AutoSubmitCheckbox } from "@/components/AutoSubmitCheckbox";
import { RangeInput } from "@/components/mobile/RangeInput";
import type { FurnitureCategory, FurnitureDesign, MaterialId, OptionDependency, OptionSpec } from "@/lib/types";
import { MaterialListWithSelection } from "@/components/MaterialListWithSelection";
import { SelectedPartProvider } from "@/components/SelectedPartContext";
import { HoveredPartsProvider } from "@/components/HoveredPartsContext";
import { Material3dPip } from "@/components/Material3dPip";
import { ZoomableThreeViews } from "@/components/ZoomableThreeViews";
import { ZoomableJoineryDetail } from "@/components/ZoomableJoineryDetail";
import { LazyPerspectiveView } from "@/components/LazyPerspectiveView";
import { ThreeDExportButton } from "@/components/ThreeDExportButton";
import { MATERIALS, materialName } from "@/lib/materials";
import { extractJoineryUsages } from "@/lib/joinery/extract";
import {
  JoineryDetail,
  joineryLabel,
  joineryDescription,
} from "@/lib/joinery/details";
import { ToolList } from "@/components/ToolList";
import { BuildSteps } from "@/components/BuildSteps";
import { deriveBuildSteps } from "@/lib/steps/derive";
import { translateSteps } from "@/lib/steps/translations";
import { FURNITURE_CATALOG } from "@/lib/templates";
import { DesignFormShell } from "@/components/design/DesignFormShell";
import { ClampedNumberInput } from "@/components/design/ClampedNumberInput";
import { UnitSuffix } from "@/components/design/UnitSuffix";
import { HeightPresetChips } from "@/components/design/HeightPresetChips";
import { resolvePartIds } from "@/lib/design/option-part-map";
import { ErgoHints } from "@/components/ErgoHints";
import { DeflectionHints } from "@/components/DeflectionHints";
import { SceneThemeToggle } from "@/components/SceneThemeToggle";
import { SCENE_THEMES, type SceneThemeId } from "@/lib/design/scene-themes";
import { GROUP_META, GROUP_ORDER, groupLabel } from "@/lib/design/option-groups";
import { specLabel, choiceLabel, specHelp } from "@/lib/templates/spec-labels";
import { MaterialAttributesPanel } from "@/components/MaterialAttributesPanel";
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
import { getUnitFromCookies } from "@/lib/units/server-unit";
import { formatMm, formatDimensions } from "@/lib/units/format";

interface PageProps {
  params: Promise<{ locale: string; type: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; type: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale: rawLocale, type } = await params;
  const locale: Locale = (rawLocale as Locale) ?? routing.defaultLocale;
  const sp = await searchParams;
  const entry = getTemplate(type as FurnitureCategory);
  const tMeta = await getTranslations({ locale, namespace: "design.metadata" });
  if (!entry) return { title: tMeta("notFoundTitle") };

  const ogParams = new URLSearchParams({ type: entry.category });
  for (const k of ["length", "width", "height", "material", "style"]) {
    const v = sp[k];
    if (typeof v === "string" && v) ogParams.set(k, v);
  }
  if (locale !== routing.defaultLocale) ogParams.set("locale", locale);
  const ogImage = `/api/og?${ogParams.toString()}`;
  const isDefault = locale === routing.defaultLocale;
  const canonical = isDefault
    ? `/design/${entry.category}`
    : `/${locale}/design/${entry.category}`;
  const shareUrl = ogParams.toString() ? `${canonical}?${ogParams.toString().replace(/^type=[^&]+&?/, "")}` : canonical;

  const entryName = getEntryName(entry, locale);
  const entryDesc = getEntryDescription(entry, locale) ?? "";
  const title = tMeta("titleTemplate", { name: entryName });
  const description = tMeta("descriptionTemplate", { name: entryName, description: entryDesc });
  // 跟 app/sitemap.ts 同一份名單：尚未完成的模板從 sitemap 拿掉，但頁面仍可訪
  // 問。這裡同步加 robots noindex 防止 Google 仍照爬把半成品索引進去。
  const DEV_CATEGORIES = new Set(["chinese-cabinet", "bed", "coat-rack"]);
  const isDevCategory = DEV_CATEGORIES.has(entry.category);
  return {
    title,
    description,
    alternates: { canonical },
    ...(isDevCategory ? { robots: { index: false, follow: false } } : {}),
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
  const { locale: rawLocale, type } = await params;
  const locale: Locale = (rawLocale as Locale) ?? routing.defaultLocale;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "design" });
  const sp = await searchParams;
  const unit = await getUnitFromCookies(locale);

  const entry = getTemplate(type as FurnitureCategory);
  if (!entry) notFound();

  // 付費門檻：免費版只能進 FREE_UNLOCKED_CATEGORIES，其他導去 /pricing；
  // 同時拉一次 profile 給「設計師模式」門檻用，避免重複查詢。
  // 唯讀 SSR 頁面用 getSession（無 HTTP），middleware 已每個 request 驗 JWT。
  const user = await getSessionUser();
  const supabase = await createClient();
  let profile = null;
  let unlockedCategories: string[] = [];
  if (user) {
    const { data } = await supabase
      .from("users")
      .select(
        "plan, subscription_status, subscription_expires_at, student_activated_at, student_expires_at",
      )
      .eq("id", user.id)
      .single();
    profile = data;
    // 拉單範本永久買斷的解鎖清單,給 canAccessCategory 判斷
    unlockedCategories = await fetchUnlockedCategories(createAdminClient(), user.id);
  }
  const isAdmin = isAdminEmail(user?.email, getServerAdminEmails());
  // dev-only：playwright shoot-thumbs 腳本繞過 paywall 抓所有家具縮圖
  const isThumbShoot =
    process.env.NODE_ENV === "development" && sp._shoot === "1";
  if (
    !isAdmin &&
    !isThumbShoot &&
    isPaidCategory(type as FurnitureCategory) &&
    !canAccessCategory(profile, type as FurnitureCategory, unlockedCategories)
  ) {
    // locale 分流：en 走 /en/pricing → LemonSqueezyPricingClient + 單模板 LS 按鈕
    //              zh-TW 走 /pricing → PricingClient + ECPay 單模板按鈕
    const pricingPath =
      locale === routing.defaultLocale
        ? `/pricing?locked=${type}`
        : `/${locale}/pricing?locked=${type}`;
    redirect(pricingPath);
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
          {t("back")}
        </Link>
        <h1 className="text-2xl font-bold mt-4">{getEntryName(entry, locale)}</h1>
        <p className="mt-3 p-4 bg-amber-50 text-amber-800 rounded-lg">
          {t("wipTemplate")}
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
  // 圓形家具（圓凳/圓茶几/圓餐桌）只有「直徑」一個尺寸——template 端 input.length
  // 當直徑、忽略 input.width。UI 也只給直徑一個 input，width 強制 = length 避免
  // 殘留分享連結帶不同數值造成 server / template 看到不一致。
  const isRoundCategory =
    type === "round-stool" || type === "round-table" || type === "round-tea-table";
  const length = limits ? Math.min(parsed.length, limits.length) : parsed.length;
  const widthRaw = limits ? Math.min(parsed.width, limits.width) : parsed.width;
  const width = isRoundCategory ? length : widthRaw;
  const height = limits ? Math.min(parsed.height, limits.height) : parsed.height;
  const clampedDims: { dim: string; from: number; to: number }[] = [];
  if (limits) {
    if (parsed.length > limits.length) clampedDims.push({ dim: isRoundCategory ? t("clamp.dimDiameter") : t("clamp.dimWidth"), from: parsed.length, to: limits.length });
    if (!isRoundCategory && parsed.width > limits.width) clampedDims.push({ dim: t("clamp.dimDepth"), from: parsed.width, to: limits.width });
    if (parsed.height > limits.height) clampedDims.push({ dim: t("clamp.dimHeight"), from: parsed.height, to: limits.height });
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
  const rawDesign = entry.template({ length, width, height, material, options, locale });
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
  const entryName = getEntryName(entry, locale);
  const entryDesc = getEntryDescription(entry, locale) ?? "";
  const lineShareText = t("jsonLd.shareText", { name: entryName, length, width, height });

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://designer.woodenren.com";
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: t("jsonLd.homeCrumb"), item: siteUrl },
      { "@type": "ListItem", position: 2, name: t("jsonLd.catalogCrumb"), item: `${siteUrl}/#catalog` },
      { "@type": "ListItem", position: 3, name: t("jsonLd.designCrumb", { name: entryName }), item: `${siteUrl}/design/${entry.category}` },
    ],
  };

  // HowTo JSON-LD — designer 產出的工序就是「製作教學」，HowTo schema 抓
  // 「{家具}怎麼做 / 製作步驟」這類搜尋意圖的 rich result。資料來自跟畫面
  // BuildSteps 同一份 deriveBuildSteps，保證 SEO 跟 UI 完全對齊。
  const buildStepsForSchema = translateSteps(deriveBuildSteps(design), design, locale);
  const totalMinutes = buildStepsForSchema.reduce(
    (sum, s) => sum + (s.estimatedMinutes ?? 0),
    0,
  );
  const howToJsonLd = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: t("jsonLd.howToName", { name: entryName, dims: formatDimensions(length, width, height, unit) }),
    description: t("jsonLd.howToDesc", { name: entryName, length, width, height, material: materialName(material, locale) }),
    inLanguage: locale === "en" ? "en" : "zh-TW",
    ...(totalMinutes > 0 ? { totalTime: `PT${totalMinutes}M` } : {}),
    step: buildStepsForSchema.map((s, i) => ({
      "@type": "HowToStep",
      position: i + 1,
      name: s.title,
      text: s.description,
    })),
  };

  // 相關範本：同 family 中挑 3 個非自己的，給設計頁互連、SEO link juice +
  // UX「也想做這些嗎」入口。family 分組維持跟 lib/steps/derive.ts 同一套邏輯。
  const FAMILY_MAP: Record<string, FurnitureCategory[]> = {
    table: ["tea-table", "side-table", "low-table", "dining-table", "desk", "round-tea-table", "round-table"],
    seating: ["stool", "bench", "dining-chair", "bar-stool", "round-stool"],
    cabinet: ["open-bookshelf", "chest-of-drawers", "chinese-cabinet", "shoe-cabinet", "display-cabinet", "media-console", "nightstand", "wardrobe"],
    accessory: ["pencil-holder", "bookend", "photo-frame", "tray", "dovetail-box", "wine-rack", "coat-rack"],
    bed: ["bed"],
  };
  const family = (Object.keys(FAMILY_MAP) as Array<keyof typeof FAMILY_MAP>).find(
    (k) => FAMILY_MAP[k].includes(entry.category),
  );
  const relatedTemplates = family
    ? FURNITURE_CATALOG.filter(
        (e) =>
          e.category !== entry.category &&
          FAMILY_MAP[family].includes(e.category) &&
          // 跟 sitemap.ts 同名單，未完成的不出現在相關範本
          !["chinese-cabinet", "bed", "coat-rack"].includes(e.category),
      ).slice(0, 3)
    : [];

  return (
    <>
    {/* BreadcrumbList JSON-LD — SERP rich snippet 顯示麵包屑路徑 */}
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
    />
    {/* HowTo JSON-LD — 抓「{家具}怎麼做 / 製作步驟」這類 query 的 rich result */}
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(howToJsonLd) }}
    />
    <div className={uiV2 ? "hidden md:block" : "block"}>
    <main className="max-w-7xl mx-auto px-6 py-6">
      <div className="flex items-center gap-4 flex-wrap">
        <Link href="/app" className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-amber-700 transition-colors group">
          <span className="transition-transform group-hover:-translate-x-0.5">←</span> {t("back").replace(/^← ?/, "")}
        </Link>
        {/* /templates/[type] 只在 zh-TW 存在（marketing.ts 還沒翻），/en 不顯示這個連結 */}
        {locale === routing.defaultLocale && FEATURED_TEMPLATE_CATEGORIES.includes(entry.category) && (
          <Link href={`/templates/${entry.category}`} className="inline-flex items-center gap-1.5 text-sm text-amber-700 hover:text-amber-900 transition-colors">
            <span aria-hidden>📖</span>
            {t("detailedIntro", { name: entryName })}
          </Link>
        )}
      </div>

      <header className="mt-3 mb-5 rounded-2xl border border-amber-200/70 bg-white/80 shadow-sm shadow-amber-900/5 px-5 py-4 flex items-center justify-between flex-wrap gap-4">
        <div className="min-w-0">
          <h1 className="font-serif-tc text-[1.7rem] leading-tight font-bold tracking-tight text-zinc-900">{entryName}</h1>
          <p className="mt-1.5 text-xs text-zinc-500 flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <span>{entryDesc}</span>
            <span className="inline-flex items-center rounded-md bg-amber-100/70 px-1.5 py-0.5 font-mono text-[11px] text-amber-900">{formatDimensions(length, width, height, unit)}</span>
            <span className="inline-flex items-center rounded-md bg-zinc-100 px-1.5 py-0.5 text-[11px] text-zinc-600">{materialName(material, locale)}</span>
            <span className="inline-flex items-center rounded-md bg-zinc-100 px-1.5 py-0.5 text-[11px] text-zinc-600">{t("header.piecesCount", { count: design.parts.length })}</span>
            <span className="inline-flex items-center rounded-md bg-zinc-100 px-1.5 py-0.5 text-[11px] text-zinc-600" title={t("header.weightTitle")}>{t("header.weightApprox", { kg: estimateWeight(design) })}</span>
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
            defaultName={`${entryName} ${length}×${width}×${height}`}
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
            className="inline-flex items-center gap-1 px-3.5 py-2 bg-emerald-700 text-white rounded-lg text-xs font-medium shadow-sm shadow-emerald-900/20 hover:bg-emerald-800 hover:shadow-md transition-all"
          >
            {t("header.quoteBtn")}
          </Link>
          <Link
            href={`/design/${type}/print?${printQuery.toString()}`}
            target="_blank"
            className="inline-flex items-center gap-1 px-3.5 py-2 bg-zinc-900 text-white rounded-lg text-xs font-medium shadow-sm shadow-black/20 hover:bg-zinc-700 hover:shadow-md transition-all"
          >
            {t("header.printBtn")}
          </Link>
        </div>
      </header>

      {clampedDims.length > 0 && (
        <div className="mb-4 rounded-lg border-2 border-rose-400 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          <div className="flex items-start gap-2">
            <span className="text-base leading-none mt-0.5">🔒</span>
            <div className="flex-1">
              <div className="font-semibold mb-1">{t("clamp.title")}</div>
              <ul className="list-disc pl-5 space-y-0.5 text-xs">
                {clampedDims.map((c) => (
                  <li key={c.dim}>
                    {c.dim}: {c.from} mm <span className="text-rose-500">→</span> {c.to} mm
                  </li>
                ))}
              </ul>
              <div className="mt-2 text-xs">
                {t("clamp.footer")}
                <Link href="/pricing" className="font-semibold underline hover:text-rose-700">
                  {t("clamp.upgrade")}
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
              <div className="font-semibold mb-1">{t("warnings.title")}</div>
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
          <div className="rounded-2xl border border-amber-200/70 bg-white shadow-md shadow-amber-900/5 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-amber-100 bg-gradient-to-r from-amber-50/80 to-transparent text-xs font-semibold text-zinc-800 flex items-center gap-2">
              <span className="w-1 h-4 bg-amber-500 rounded-full" />
              {t("section.perspective")}
              <span className="text-[10px] font-normal text-zinc-400">{t("section.perspectiveHint")}</span>
            </div>
            <SceneThemeToggle current={sceneId} />
            <LazyPerspectiveView design={design} sceneTheme={sceneTheme} joineryMode={joineryMode} auditMode={auditMode} explodeMm={explodeMm} lidLiftMm={lidLiftMm} xrayMode={xrayMode} wireframeMode={wireframeMode} hidePartIds={hidePartIds} noSync />
            {getPlanFeatures(profile).canUseQuoteSystem && (
              <ThreeDExportButton design={design} />
            )}
          </div>
        </div>

        {/* 參數表單：DOM 第二順位 → mobile 在 3D 下方；desktop grid 顯式放到左欄 row 1 */}
        <div className="mt-3 lg:mt-0 lg:col-start-1 lg:row-start-1">
          {/* 紅酒架 builder 忽略 URL 的 length/width/height、從 bw/bt/bd 推導 overall。
             把「整體尺寸」三欄綁到 design.overall 而非 URL 值，這樣拉 bw/bt 上面寬/深/高
             即時跟著變、UI 不會說謊。其他模板 overall 多半 === input，但少數 derive
             (coat-rack/pencil-holder/dovetail-box/bookend/photo-frame)，避免 regression
             僅白名單 wine-rack。 */}
          <ParameterForm
            type={type}
            defaults={
              type === "wine-rack"
                ? {
                    length: design.overall.length,
                    width: design.overall.width,
                    height: design.overall.thickness,
                    material,
                  }
                : { length, width, height, material }
            }
            limits={designerMode ? undefined : entry.limits}
            optionSchema={optionSchema}
            optionValues={options}
            joineryMode={joineryMode}
            designerMode={designerMode}
            canUseDesignerMode={canUseDesignerMode}
            allPartIds={design.parts.map((p) => p.id)}
            locale={locale}
            unit={unit}
          />
        </div>
      </section>

      <section data-section="threeview" className="mt-5 rounded-2xl border border-amber-200/70 bg-white shadow-md shadow-amber-900/5 overflow-hidden">
        <div className="px-4 py-2.5 border-b border-amber-100 bg-gradient-to-r from-amber-50/80 to-transparent text-xs font-semibold text-zinc-800 flex items-center gap-2">
          <span className="w-1 h-4 bg-amber-500 rounded-full" />
          {t("section.threeView")}
          <span className="ml-auto text-[10px] font-normal text-zinc-400">
            {t("section.threeViewHint")}
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
          目前僅 localhost 顯示（方凳零件圖暫時隱藏）。 */}
      {(await isLocalhost()) && <PartDrawingsPanel design={design} />}

      {/* 下半：施工備料（按需展開） */}
      {/* 注意：此 details 不能用 overflow-hidden —— 內含 sticky 3D，
          overflow!=visible 的祖先會讓 position:sticky 失效。圓角靠 summary
          的 rounded-t + 材料單欄的 rounded-b 各自處理。 */}
      <details data-section="cutlist" className="group/d mt-5 rounded-2xl border border-amber-200/70 bg-white shadow-md shadow-amber-900/5" open>
        <summary className="cursor-pointer list-none rounded-t-2xl px-4 py-3 text-sm flex items-center justify-between bg-gradient-to-r from-amber-50/60 to-transparent hover:from-amber-50 transition-colors">
          <span className="font-semibold text-zinc-800 flex items-center gap-2">
            <span className="w-1 h-4 bg-amber-500 rounded-full" />
            {t("section.cutList")}
            <span className="text-[10px] font-normal text-zinc-400">{t("section.cutListHint", { count: design.parts.length })}</span>
          </span>
          <span className="text-[11px] text-zinc-400 group-open/d:rotate-180 transition-transform">▾</span>
        </summary>
        <div className="border-t border-amber-100">
          <div className="px-4 py-2.5 bg-amber-50/40 border-b border-amber-100 flex items-center justify-between text-[11px] text-zinc-500">
            <span>{t("section.cutListNotice")}</span>
            <Link
              href={`/design/${type}/cut-plan?${printQuery.toString()}`}
              target="_blank"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-amber-600 text-white rounded-lg text-[11px] font-medium shadow-sm shadow-amber-900/20 hover:bg-amber-700 hover:shadow-md transition-all"
            >
              {t("section.cutPlanBtn")}
            </Link>
          </div>
          {/* desktop 雙欄：左清單右 sticky 3D；mobile 單欄 + Material3dPip 浮窗 */}
          <div className="lg:grid lg:grid-cols-[7fr_5fr] lg:gap-4">
            <div data-pip-area className="lg:col-start-1 lg:row-start-1 min-w-0 rounded-b-2xl overflow-hidden">
              <MaterialListWithSelection design={design} />
            </div>
            {/* 外層 grid 格子撐滿（= 材料單高度），內層 sticky wrapper 才黏得住整段捲動 */}
            <div className="hidden lg:block lg:col-start-2 lg:row-start-1">
              <div className="lg:sticky lg:top-4 lg:px-3 lg:py-3">
                <div className="rounded-xl border border-amber-200/70 bg-white shadow-sm overflow-hidden">
                  <div className="px-3 py-2 border-b border-amber-100 bg-gradient-to-r from-amber-50/80 to-transparent text-[11px] font-semibold text-zinc-700 flex items-center gap-2">
                    <span className="w-1 h-3.5 bg-amber-500 rounded-full" />
                    {t("section.preview3d")}
                  </div>
                  <SceneThemeToggle current={sceneId} />
                  <LazyPerspectiveView design={design} sceneTheme={sceneTheme} joineryMode={joineryMode} auditMode={auditMode} explodeMm={explodeMm} lidLiftMm={lidLiftMm} xrayMode={xrayMode} hidePartIds={hidePartIds} />
                </div>
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

      <details className="group/d mt-4 rounded-2xl border border-amber-200/70 bg-white shadow-md shadow-amber-900/5 overflow-hidden">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm flex items-center justify-between bg-gradient-to-r from-amber-50/60 to-transparent hover:from-amber-50 transition-colors">
          <span className="font-semibold text-zinc-800 flex items-center gap-2">
            <span className="w-1 h-4 bg-amber-500 rounded-full" />
            {joineryMode ? t("section.joineryDetail") : t("section.joineryAssembly")}
          </span>
          <span className="text-[11px] text-zinc-400 group-open/d:rotate-180 transition-transform">▾</span>
        </summary>
        <div className="border-t border-amber-100 p-4">
          {joineryMode ? (
            <JoinerySection design={design} locale={locale} />
          ) : (
            <div className="rounded-lg bg-emerald-50 ring-1 ring-emerald-200 p-5 text-sm text-emerald-900 leading-relaxed">
              <p className="font-semibold mb-2">{t("noJoinery.h")}</p>
              <ul className="space-y-1.5 list-disc list-inside ml-1">
                <li><b>{t("noJoinery.row1Lead")}</b>{t("noJoinery.row1Body")}</li>
                <li><b>{t("noJoinery.row2Lead")}</b>{t("noJoinery.row2Body")}</li>
                <li><b>{t("noJoinery.row3Lead")}</b>{t("noJoinery.row3Body")}</li>
                <li><b>{t("noJoinery.row4Lead")}</b>{t("noJoinery.row4Body")}</li>
                <li><b>{t("noJoinery.row5Lead")}</b>{t("noJoinery.row5Body")}</li>
              </ul>
              <p className="mt-3 text-xs text-emerald-700">
                {t("noJoinery.tools")}
              </p>
              <p className="mt-2 text-xs text-emerald-600">
                {t("noJoinery.switchHint")}
              </p>
            </div>
          )}
        </div>
      </details>

      <details className="group/d mt-4 rounded-2xl border border-amber-200/70 bg-white shadow-md shadow-amber-900/5 overflow-hidden">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm flex items-center justify-between bg-gradient-to-r from-amber-50/60 to-transparent hover:from-amber-50 transition-colors">
          <span className="font-semibold text-zinc-800 flex items-center gap-2">
            <span className="w-1 h-4 bg-amber-500 rounded-full" />
            {t("section.toolList")}
          </span>
          <span className="text-[11px] text-zinc-400 group-open/d:rotate-180 transition-transform">▾</span>
        </summary>
        <div className="border-t border-amber-100 p-4">
          <ToolList design={design} locale={locale} />
        </div>
      </details>

      <details data-section="steps" open className="group/d mt-4 rounded-2xl border border-amber-200/70 bg-white shadow-md shadow-amber-900/5 overflow-hidden">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm flex items-center justify-between bg-gradient-to-r from-amber-50/60 to-transparent hover:from-amber-50 transition-colors">
          <span className="font-semibold text-zinc-800 flex items-center gap-2">
            <span className="w-1 h-4 bg-amber-500 rounded-full" />
            {t("section.buildSteps")}
          </span>
          <span className="text-[11px] text-zinc-400 group-open/d:rotate-180 transition-transform">▾</span>
        </summary>
        <div className="border-t border-amber-100 p-4">
          <BuildSteps design={design} locale={locale} />
        </div>
      </details>

      {/* 相關範本 — 同類別其他家具，內部連結提權 + UX「也想做這些嗎」入口 */}
      {relatedTemplates.length > 0 && (
        <section className="mt-6 rounded-2xl border border-amber-200/70 bg-amber-50/40 px-5 py-4">
          <h2 className="text-sm font-semibold text-zinc-800 flex items-center gap-2 mb-3">
            <span className="w-1 h-4 bg-amber-500 rounded-full" />
            {t("section.related")}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {relatedTemplates.map((r) => (
              <Link
                key={r.category}
                href={`/design/${r.category}`}
                target="_blank"
                rel="noopener"
                className="group rounded-xl bg-white ring-1 ring-amber-900/10 px-4 py-3 hover:ring-amber-400 hover:shadow-md transition"
              >
                <div className="font-semibold text-zinc-900 group-hover:text-amber-800 transition">
                  {getEntryName(r, locale)} {t("related.linkSuffix")}
                </div>
                <div className="mt-1 text-xs text-zinc-500 line-clamp-2">
                  {getEntryDescription(r, locale) ?? ""}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </main>
    </div>
    {uiV2 && (
      <MobileShell
        entry={{ category: entry.category, nameZh: entry.nameZh, nameEn: entry.nameEn, description: entry.description, descriptionEn: entry.descriptionEn, difficulty: entry.difficulty, defaults: entry.defaults, limits: entry.limits, optionSchema: entry.optionSchema }}
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
        formAction={`/${locale}/design/${entry.category}`}
        wireframeMode={wireframeMode}
        joineryMode={joineryMode}
        designerMode={designerMode}
        canUseDesignerMode={canUseDesignerMode}
        sceneId={sceneId}
        lidLiftMm={lidLiftMm}
        explodeMm={explodeMm}
        xrayMode={xrayMode}
      />
    )}
    </>
  );
}

function JoineryRulesCallout({ locale }: { locale: string }) {
  const isEn = locale === "en";
  return (
    <div className="rounded-lg bg-amber-50 ring-1 ring-amber-200 p-4 text-xs text-amber-900 leading-relaxed mb-5">
      <p className="font-semibold mb-1.5">
        {isEn
          ? "Joinery proportion rules (used by this design — FWW / Popular Woodworking / Woodcraft / Rockler consensus)"
          : "榫卯比例規則（本設計依此推算 — FWW / Popular Woodworking / Woodcraft / Rockler 共識）"}
      </p>
      <ul className="space-y-0.5 list-disc list-inside">
        {isEn ? (
          <>
            <li>
              <b>Mortise-and-tenon thickness</b> = <b>1/3 of the mortise-bearing (mother) part&apos;s thickness</b> (e.g. a 1.5&quot; leg → 1/2&quot; tenon).
              When the male part is thinner, use <b>min(male thickness − 6 mm shoulders on each side, mother / 3)</b>.
            </li>
            <li>
              <b>Tenon length</b>: blind tenon = <b>2/3 of leg width</b>; through tenon = full mother thickness (often pinned with a <b>wedge</b> to lock).
            </li>
            <li>
              <b>Tenon width</b> = apron width <b>− 6 mm shoulder top and bottom</b> (fixed, not proportional).
              If width &gt; 5× thickness or apron &gt; 125 mm, split into <b>twin tenons</b>.
            </li>
            <li>
              <b>Haunch length</b> = <b>1/3 of main tenon length</b>; haunch always sits <b>above</b> the main tenon to fill the through-mortise gap and resist rotation.
            </li>
            <li>
              <b>Tongue-and-groove</b>: tongue thickness = <b>1/3 of board thickness</b> (18 mm board → 6 mm tongue), 6 mm shoulder each side;
              <b>groove depth = tongue length + 1 mm</b> (mandatory expansion allowance — humid seasons will tear it apart otherwise).
            </li>
            <li>
              <b>Dovetail</b>: hardwood <b>1:8</b> (≈7.1°), softwood <b>1:6</b> (≈9.5°); ends must always be <b>pins</b> (not tails) so they carry pull-out load.
            </li>
            <li>
              <b>Half-lap</b>: each piece rebated to <b>1/2 thickness</b>; vertical half-lap = 1/2 the parent strength, horizontal half-lap only 1/8.
            </li>
            <li>
              <b>Finger joint</b>: finger thickness = <b>1/2 of board thickness</b>; 4–9 fingers is the usual range; 1:1 or 1:2 finger:gap ratios both work.
            </li>
            <li>
              <b>Dowel</b>: dowel diameter = <b>1/3 of board thickness</b> (max 1/2); length = diameter × 1.5 + 1/16&quot; allowance; 4–6 dowels per foot along the edge.
            </li>
            <li>
              <b>Fit tolerance</b> (mortise ↔ tenon): tight 0.05–0.13 mm | <b>standard 0.13–0.25 mm</b> | loose 0.25–0.38 mm.
            </li>
          </>
        ) : (
          <>
            <li>
              <b>方榫厚</b> = <b>被開榫眼的母件（柱腳）厚度的 1/3</b>（例 1.5&quot; 柱腳 → 1/2&quot; 榫厚）；
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
              <b>圓棒榫</b>：木釘徑 = 板厚 <b>1/3</b>（不超過 1/2）；長 = 徑 × 1.5 + 1/16&quot; 餘量；
              沿邊每尺 4–6 支
            </li>
            <li>
              <b>配合容差</b>（mortise ↔ tenon）：緊 0.05–0.13mm｜<b>標準 0.13–0.25mm</b>｜鬆 0.25–0.38mm
            </li>
          </>
        )}
      </ul>
    </div>
  );
}

async function JoinerySection({ design, locale }: { design: FurnitureDesign; locale: string }) {
  const t = await getTranslations({ locale, namespace: "design.joinery" });
  const usages = extractJoineryUsages(design);
  if (usages.length === 0) {
    return <p className="text-sm text-zinc-500">{t("noToShow")}</p>;
  }
  const motherLabel = t("motherPart");
  const spotsLabel = (n: number) => t("spotsLabel", { n });
  const tenonLabel = t("tenon");
  const unit = await getUnitFromCookies(locale);
  return (
    <div className="space-y-6">
      <JoineryRulesCallout locale={locale} />
      {usages.map((u, i) => (
        <div
          key={i}
          className="rounded-lg border border-zinc-200 bg-white p-4"
        >
          <div className="flex items-baseline justify-between flex-wrap gap-2 mb-2">
            <h3 className="font-semibold">
              {joineryLabel(u.type, locale)}{" "}
              <span className="text-xs font-normal text-zinc-500">
                · {u.partNameZh} ↔ {u.motherPartNames.length > 0 ? u.motherPartNames.join(" / ") : motherLabel} · {spotsLabel(u.count)}
              </span>
            </h3>
            <p className="text-xs text-zinc-500">
              {tenonLabel} {formatDimensions(u.tenon.length, u.tenon.width, u.tenon.thickness, unit)}
            </p>
          </div>
          <p className="text-xs text-zinc-600 mb-3">{joineryDescription(u.type, locale)}</p>
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

async function ParameterForm({
  type,
  defaults,
  limits,
  optionSchema,
  optionValues,
  joineryMode,
  designerMode,
  canUseDesignerMode,
  allPartIds,
  locale,
  unit,
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
  locale: string;
  unit: "mm" | "inch";
}) {
  const t = await getTranslations({ locale, namespace: "design.form" });
  return (
    <DesignFormShell
      action={`/${locale}/design/${type}`}
      className="p-5 rounded-2xl border border-amber-200/70 bg-amber-50/50 shadow-md shadow-amber-900/5"
    >
      {type !== "pencil-holder" && type !== "tray" && type !== "dovetail-box" && (
        <fieldset className="mb-5">
          <legend className="mb-2 text-sm font-semibold text-zinc-800 flex items-center gap-2">
            <span className="w-1 h-4 bg-amber-500 rounded-full" />
            {t("joineryMethodLegend")}
            <span className="text-[10px] font-normal text-zinc-400">{t("joineryMethodHint")}</span>
          </legend>
          <div className="grid grid-cols-2 gap-2.5">
            <label
              className={`flex flex-col gap-1 p-3 rounded-xl cursor-pointer ring-2 transition-all ${
                !joineryMode
                  ? "ring-emerald-500 bg-emerald-50 shadow-sm shadow-emerald-900/10"
                  : "ring-zinc-200 bg-white hover:ring-emerald-300 hover:bg-emerald-50/40"
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
                {t("modeAssemblyLabel")}
                <span className="text-[10px] font-normal text-emerald-700 ml-auto">{t("modeAssemblyBadge")}</span>
              </div>
              <div className="text-[11px] text-emerald-800 leading-relaxed">
                {t("modeAssemblyDesc")}
              </div>
            </label>
            <label
              className={`flex flex-col gap-1 p-3 rounded-xl cursor-pointer ring-2 transition-all ${
                joineryMode
                  ? "ring-amber-500 bg-amber-100/70 shadow-sm shadow-amber-900/10"
                  : "ring-zinc-200 bg-white hover:ring-amber-300 hover:bg-amber-50/50"
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
                {t("modeJoineryLabel")}
                <span className="text-[10px] font-normal text-amber-700 ml-auto">{t("modeJoineryBadge")}</span>
              </div>
              <div className="text-[11px] text-amber-800 leading-relaxed">
                {t("modeJoineryDesc")}
              </div>
            </label>
          </div>
        </fieldset>
      )}
      <fieldset className="mb-5 rounded-xl border border-amber-300/70 bg-white/70 p-3.5 shadow-sm shadow-amber-900/5">
        <legend className="text-xs text-amber-900 px-2 font-semibold bg-amber-100 rounded-md py-0.5">
          {t("designerLegend")}
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
                {t("designerOnDesc")}
              </div>
              {designerMode && (
                <div className="mt-1.5 text-[10px] text-amber-700 leading-relaxed">
                  {t("designerOnWarning")}
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
                {t("designerLockedDesc")}
              </div>
              <div className="mt-1.5 text-[11px] text-amber-800">
                {t("designerProPrefix")}<span className="font-semibold">{t("designerProName")}</span>{t("designerProSuffix")}
                <Link href="/pricing" className="ml-1 underline font-medium hover:text-amber-900">
                  {t("designerProLink")}
                </Link>
              </div>
            </div>
          </div>
        )}
      </fieldset>
      <div className="mb-4 pb-3 border-b border-amber-200/60 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-zinc-800 flex items-center gap-2">
          <span className="w-1 h-4 bg-amber-500 rounded-full" />
          {t("overallSize")}
          {designerMode && (
            <span className="text-[10px] font-normal text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
              {t("designerNoLimit")}
            </span>
          )}
        </h3>
        <ResetDefaultsButton />
      </div>
      <SizePresetButtons category={type as FurnitureCategory} limits={limits} />
      <HeightToSizeButton category={type as FurnitureCategory} />
      {(() => {
        const isRound =
          type === "round-stool" || type === "round-table" || type === "round-tea-table";
        const isEn = locale === "en";
        const gridCols = isEn ? "grid-cols-1" : (isRound ? "grid-cols-2" : "grid-cols-3");
        return (
          <div className={`grid ${gridCols} gap-2 mb-3 items-end`}>
            {/* key 綁 defaultValue 強制 remount——server clamp 後 input 才會顯示縮回後的值 */}
            <NumberInput
              key={`length-${defaults.length}`}
              name="length"
              label={isRound ? t("diameter") : t("width")}
              defaultValue={defaults.length}
              max={limits?.length}
              partIds={resolvePartIds("length", allPartIds)}
              upperLimitTpl={t("upperLimit", { max: formatMm(limits?.length ?? 0, unit) })}
              locale={locale}
            />
            {!isRound && (
              <NumberInput
                key={`width-${defaults.width}`}
                name="width"
                label={t("depth")}
                defaultValue={defaults.width}
                max={limits?.width}
                partIds={resolvePartIds("width", allPartIds)}
                upperLimitTpl={t("upperLimit", { max: formatMm(limits?.width ?? 0, unit) })}
                locale={locale}
              />
            )}
            <NumberInput
              key={`height-${defaults.height}`}
              name="height"
              label={t("height")}
              defaultValue={defaults.height}
              max={limits?.height}
              partIds={resolvePartIds("height", allPartIds)}
              upperLimitTpl={t("upperLimit", { max: formatMm(limits?.height ?? 0, unit) })}
              locale={locale}
            />
          </div>
        );
      })()}
      <div className="flex flex-wrap items-center gap-2 mb-5 text-xs">
        <label className="flex items-center gap-1.5 shrink-0">
          <span className="text-zinc-600 font-medium">{t("wood")}</span>
          <select
            key={`material-${defaults.material}`}
            name="material"
            defaultValue={defaults.material}
            className="border border-amber-300 rounded-lg px-2.5 py-1.5 bg-white text-zinc-900 text-sm shadow-sm focus:ring-2 focus:ring-amber-400 focus:border-amber-400 outline-none transition"
          >
            {Object.values(MATERIALS).map((m) => (
              <option key={m.id} value={m.id}>
                {locale === "en" ? m.nameEn : m.nameZh}
              </option>
            ))}
          </select>
        </label>
        <HeightPresetChips presets={getHeightPresetsForCategory(type, locale)} maxHeight={limits?.height} />
      </div>

      {/* 木材立體屬性面板：6 軸雷達圖 + 文化定位 + CITES/油性警示 */}
      <MaterialAttributesPanel materialId={defaults.material} locale={locale} />

      {/* 人體工學提示：根據家具類別給座高/桌高/椅桌差等合理範圍警告 */}
      <ErgoHints
        category={type}
        overall={{
          length: defaults.length,
          width: defaults.width,
          height: defaults.height,
        }}
        options={optionValues}
        locale={locale}
      />

      {optionSchema.length > 0 && (
        <>
          <div className="mb-3 pb-2 border-b border-amber-200/60">
            <h3 className="text-sm font-semibold text-zinc-800 flex items-center gap-2">
              <span className="w-1 h-4 bg-amber-500 rounded-full" />
              {t("detailSettings")}
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
          <GroupedOptionFields
            optionSchema={optionSchema}
            optionValues={optionValues}
            joineryMode={joineryMode}
            overallHeight={defaults.height}
            overallLength={defaults.length}
            allPartIds={allPartIds}
            locale={locale}
          />
        </>
      )}

      <p className="mt-1 text-[11px] text-zinc-500 flex items-center gap-2 rounded-lg bg-emerald-50/70 ring-1 ring-emerald-200/70 px-3 py-2">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60 animate-ping" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
        {t("autoUpdate")}
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
  locale,
}: {
  optionSchema: OptionSpec[];
  optionValues: Record<string, string | number | boolean>;
  joineryMode: boolean;
  overallHeight?: number;
  overallLength?: number;
  allPartIds?: string[];
  locale: string;
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
    <div className="mb-4 rounded-xl border border-amber-200/60 bg-white shadow-sm divide-y divide-amber-100/70 overflow-hidden">
      {keysInOrder.map((g) => {
        const meta = GROUP_META[g] ?? GROUP_META.misc;
        const specs = grouped.get(g)!;
        return (
          <details
            key={g}
            open
            className="group"
          >
            <summary className="flex items-center gap-1.5 px-2.5 py-1.5 cursor-pointer list-none hover:bg-amber-50/60 transition-colors select-none">
              <span className={`w-1 h-3.5 rounded-full ${meta.bar}`} />
              <span className="text-xs font-semibold text-zinc-800">
                {groupLabel(meta, locale)}
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
                    <OptionField spec={spec} value={optionValues[spec.key]} allValues={optionValues} overallHeight={overallHeight} overallLength={overallLength} allPartIds={allPartIds} locale={locale} />
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

async function OptionField({
  spec,
  value,
  allValues,
  overallHeight,
  overallLength,
  allPartIds,
  locale,
}: {
  spec: OptionSpec;
  value: string | number | boolean;
  allValues?: Record<string, string | number | boolean>;
  overallHeight?: number;
  overallLength?: number;
  allPartIds?: string[];
  locale: string;
}) {
  const tForm = await getTranslations({ locale, namespace: "design.form" });
  const label = specLabel(spec, locale);
  const help = specHelp(spec, locale);
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
      <label className="flex flex-col text-xs" title={help}>
        <span className="text-zinc-700 mb-0.5 truncate">
          {label}
          {spec.unit === "mm" ? (
            <UnitSuffix mmLabel="·mm" inchLabel="·in" className="text-zinc-400 ml-1" />
          ) : (
            spec.unit && <span className="text-zinc-400 ml-1">·{spec.unit}</span>
          )}
        </span>
        {isLockedZone || isColumnWidth ? (
          <ClampedNumberInput
            name={spec.key}
            defaultValue={String(value)}
            min={spec.min}
            max={effectiveMax}
            step={spec.step ?? 1}
            className="border border-zinc-300 rounded-md px-1.5 py-1 bg-white text-zinc-900 text-sm focus:ring-2 focus:ring-amber-400 focus:border-amber-400 outline-none transition"
            partIds={allPartIds ? resolvePartIds(spec.key, allPartIds) : undefined}
            showPlusMinus
            isLengthMm={spec.unit === "mm"}
            dynamicMaxHint={
              effectiveMax !== spec.max
                ? (isLockedZone
                    ? tForm("dynamicMaxHintLocked", { max: effectiveMax ?? 0 })
                    : tForm("dynamicMaxHint", { max: effectiveMax ?? 0 }))
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
            className="border border-zinc-300 rounded-md px-1.5 py-1 bg-white text-zinc-900 text-sm focus:ring-2 focus:ring-amber-400 focus:border-amber-400 outline-none transition"
            partIds={allPartIds ? resolvePartIds(spec.key, allPartIds) : undefined}
            isLengthMm={spec.unit === "mm"}
          />
        )}
        {help && <span className="mt-0.5 text-[10px] text-zinc-500 line-clamp-1 hover:line-clamp-none">{help}</span>}
      </label>
    );
  }
  if (spec.type === "select") {
    return (
      <label className="flex flex-col text-xs" title={help}>
        <span className="text-zinc-700 mb-0.5 truncate">{label}</span>
        <select
          name={spec.key}
          defaultValue={String(value)}
          className="border border-zinc-300 rounded-md px-1.5 py-1 bg-white text-zinc-900 text-sm focus:ring-2 focus:ring-amber-400 focus:border-amber-400 outline-none transition"
        >
          {spec.choices.filter((c) => choiceVisible(c.dependsOn)).map((c) => (
            <option key={c.value} value={c.value}>
              {choiceLabel(spec.key, c.value, c.label, locale)}
            </option>
          ))}
        </select>
        {help && <span className="mt-0.5 text-[10px] text-zinc-500 line-clamp-1 hover:line-clamp-none">{help}</span>}
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
        label={label}
        help={help}
      />
      {legReadout && (
        <label className="flex flex-col text-xs">
          <span className="text-zinc-700 mb-0.5 truncate">
            {tForm("legReadoutLabel")}
            <span className="text-zinc-400 ml-1">{tForm("legReadoutUnit")}</span>
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
            <span className="mt-0.5 text-[10px] text-red-600">{tForm("legReadoutClamped")}</span>
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
function getHeightPresetsForCategory(type: string, locale: string): { value: number; label: string }[] {
  const isEn = locale === "en";
  const L = {
    diningTable: isEn ? "Dining" : "餐桌",
    workbench: isEn ? "Worktop" : "工作",
    bar: isEn ? "Bar" : "吧台",
    diningChair: isEn ? "Dining" : "餐椅",
    barStool: isEn ? "Bar" : "吧凳",
    coffeeTable: isEn ? "Coffee" : "茶几",
    nightstand: isEn ? "Nightstand" : "床頭",
    tallCab: isEn ? "Tall" : "高櫃",
    shortCab: isEn ? "Short" : "矮櫃",
  };
  const t = type.toLowerCase();
  if (t.includes("dining-table") || t.includes("desk") || t.includes("workbench")) {
    return [{ value: 720, label: L.diningTable }, { value: 760, label: L.workbench }];
  }
  if (t.includes("bar")) {
    return [{ value: 1050, label: L.bar }, { value: 750, label: L.diningTable }];
  }
  if (t.includes("chair") || t.includes("stool") || t.includes("bench")) {
    return [{ value: 450, label: L.diningChair }, { value: 750, label: L.barStool }];
  }
  if (t.includes("coffee-table") || t.includes("side-table") || t.includes("nightstand")) {
    return [{ value: 420, label: L.coffeeTable }, { value: 550, label: L.nightstand }];
  }
  if (t.includes("bookcase") || t.includes("shelf") || t.includes("cabinet")) {
    return [{ value: 1800, label: L.tallCab }, { value: 900, label: L.shortCab }];
  }
  return [];
}

/** 算 6-8 個 tick mark 位置(從 mobile MobileShell 借同款 logic) */
function makeTicksForOverallDim(minV: number, maxV: number, step: number): number[] {
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
}

function NumberInput({
  name,
  label,
  defaultValue,
  max,
  partIds,
  presetPoints,
  upperLimitTpl,
  locale,
}: {
  name: string;
  label: string;
  defaultValue: number;
  max?: number;
  partIds?: string[];
  presetPoints?: { value: number; label: string }[];
  upperLimitTpl?: string;
  locale: string;
}) {
  // 國際版桌面端 W/D/H 改用 slider + chip 組合(對齊 IKEA / Roomle / Mebway 配置器 UX);
  // 中文版維持純 number input(台灣使用者習慣打 mm 數字).
  if (locale === "en") {
    const effMax = max ?? 4000;
    return (
      <RangeInput
        name={name}
        label={label}
        defaultValue={defaultValue}
        unit="mm"
        min={20}
        max={effMax}
        step={10}
        ticks={makeTicksForOverallDim(20, effMax, 10)}
        showRange
        partIds={partIds}
        presetPoints={presetPoints}
        help={upperLimitTpl}
      />
    );
  }
  return (
    <label className="flex flex-col text-xs">
      <span className="text-zinc-600 mb-1 truncate" title={max && upperLimitTpl ? upperLimitTpl : undefined}>
        {label}<UnitSuffix />
        {max && <span className="text-zinc-400 font-normal ml-1">≤{max}</span>}
      </span>
      <ClampedNumberInput
        name={name}
        defaultValue={defaultValue}
        min={20}
        max={max ?? 4000}
        step={10}
        className="border border-zinc-300 rounded-md px-2 py-1.5 bg-white text-zinc-900 text-base focus:ring-2 focus:ring-amber-400 focus:border-amber-400 outline-none transition"
        partIds={partIds}
        presetPoints={presetPoints}
        showPlusMinus
        isLengthMm
      />
    </label>
  );
}
