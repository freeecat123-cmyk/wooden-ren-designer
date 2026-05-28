"use client";

/**
 * <PartDrawing> — single-part shop drawing card（Phase 1 Task 4）
 *
 * 一張零件的工程圖卡：3 個 OrthoView（正/俯/側）+ 標題列 + 底部材料。
 * Task 4 只做 layout shell，T1/T2 尺寸標註等 Task 5/6 再補。
 *
 * Spec: docs/superpowers/specs/2026-05-16-part-drawings-design.md §4 / §5.1
 */
"use client";

import React, { useLayoutEffect, useRef } from "react";
import type { FurnitureDesign, Part } from "@/lib/types";
import type { PartDrawingGroup } from "./grouping";
import { OrthoView, mirrorYPart } from "@/lib/render/svg-views";
import { MATERIALS } from "@/lib/materials";
import {
  T1Dimensions,
  T2Annotations,
  FacingMark,
  ShapeSpecificAnnotation,
  CompoundMiterAnnotation,
  GrainArrow,
  ChamferRoundAnnotation,
} from "./annotation";
import { InstallHintMini } from "./install-hint";
import { rawStockSize } from "./raw-stock";
import { inferProcessSteps, inferTableSawSetting } from "./process-steps";
import { pickScaleForPaper } from "./paper-fit";
import { computeBrokenViewSpec } from "./broken-view";
import { PartDrawingPaperSheet } from "./paper-sheet";

const round1 = (n: number) => Math.round(n * 10) / 10;

// 圓料家族：part shape 屬於圓族時 dim 用 Ø{直徑}×{長度}（跟 PartDrawingsPanel.tsx 對偶）
const isRoundFamilyShape = (part: Part): boolean => {
  const k = part.shape?.kind;
  return (
    k === "round" ||
    k === "round-tapered" ||
    k === "splayed-round-tapered" ||
    k === "lathe-turned" ||
    k === "shaker"
  );
};

export type PartView = "front" | "top" | "side" | "bottom";
export const ZOOM_LEVELS = [1, 2, 3, 5, 8] as const;
export type ZoomLevel = (typeof ZOOM_LEVELS)[number];

interface PartDrawingProps {
  group: PartDrawingGroup;
  design: FurnitureDesign;
  /** Sequence number (P-01, P-02, ...). 0-based. */
  index: number;
  /** Override scale denominator; default auto. */
  scaleDenom?: number;
  className?: string;
  /**
   * 3 views layout：
   * - "row"（default）：橫排 3 列，印製 2×2 grid 卡片用
   * - "stack"：直排 3 列，每張視圖佔全寬，modal 大圖檢視用
   */
  viewLayout?: "row" | "stack";
  /** 限定只渲染這一個 view（單視圖放大模式用）。 */
  singleView?: PartView;
  /** 設了之後每個 view 變 clickable、點擊 callback 傳該 view 名。 */
  onViewClick?: (view: PartView) => void;
  /**
   * 給 OrthoView 內的 SVG 用的 className。預設 undefined（OrthoView 用內建
   * `bg-white w-full h-auto max-h-[70vh]`）。modal stack mode 傳
   * `bg-white w-full h-auto` 去掉 max-h、讓扁平 part 保持真實 aspect。
   */
  orthoClassName?: string;
  /**
   * 視圖縮放（單一視圖放大模式用）。預設 1。> 1 時：
   *  - 改在 SVG 外用 HTML 畫 view 標題（不被 scale 放大）
   *  - 只對 OrthoView 包一層 transform:scale wrapper、不縮 chrome（卡片邊框、
   *    title bar、底部 title block、InstallHintMini、T2 標註清單）
   *  外層 zoom transform 改由本元件控制，避免 panel 整片 scale 把
   *  「正視/側視」「右上角縮圖」「比例編號」等附屬元素也一起放大。
   */
  zoom?: number;
  /**
   * 每張視圖獨立放大倍率（方案 1：每個視圖標題旁直接放 1×~8× 按鈕）。
   * 若提供，覆蓋全卡 `zoom` prop，作用範圍只限該 view。
   * 僅 stack / singleView 路徑生效（paper-sheet L 型整張不支援）。
   */
  perViewZoom?: Partial<Record<PartView, ZoomLevel>>;
  /** 倍率按鈕被按時的 callback；提供才會渲染倍率工具列。 */
  onViewZoom?: (view: PartView, zoom: ZoomLevel) => void;
  /** 標題/材料/比例 label 語言;預設 zh-TW。 */
  locale?: string;
}

/**
 * Legacy 自動選比例（fallback）：以最長邊 / scale 為目標 ≤ 280mm。
 * 留作 paperFitResult 內 scale denominator 的相容化計算來源。
 * Step 2 起改用 pickScaleForPaper（A4 紙面 + 三 view max + CNS 樹）。
 */
function pickScale(part: Part): number {
  return pickScaleForPaper(part).scale;
}

export function PartDrawing({
  group,
  design,
  index,
  scaleDenom,
  className,
  viewLayout = "row",
  singleView,
  onViewClick,
  orthoClassName,
  zoom = 1,
  perViewZoom,
  onViewZoom,
  locale = "zh-TW",
}: PartDrawingProps) {
  const isEn = locale === "en";
  const scalePrefix = isEn ? "Scale " : "比例 ";
  // 全卡 zoom（既有行為）vs 每張視圖獨立 zoom（方案 1）。
  // perViewZoom 任一 view > 1 也算 anyZoom，因為 scrollRefs effect 需要重置中心。
  const perViewZoomSig = perViewZoom
    ? Object.values(perViewZoom).join(",")
    : "";
  const scrollRefs = useRef<Array<HTMLDivElement | null>>([]);
  useLayoutEffect(() => {
    // zoom 變動時把每個 view 的 scroll 容器中央錨定（同 ZoomableThreeViews）
    scrollRefs.current.forEach((el) => {
      if (!el) return;
      el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
      el.scrollTop = (el.scrollHeight - el.clientHeight) / 2;
    });
  }, [zoom, singleView, group.hash, perViewZoomSig]);
  const part = group.representative;
  // Step 2: 用 A4 paper-fit 比例樹（三 view max + CNS 1/2/5/10/20）。
  // 若 caller 給 scaleDenom 走 override（測試/打印偏好）。
  const paperFit = pickScaleForPaper(part);
  const scale = scaleDenom ?? paperFit.scale;
  const partNo = `P-${String(index + 1).padStart(2, "0")}`;
  const titleSuffix =
    group.count > 1
      ? ` ×${Math.min(group.count, 99)}${group.count > 99 ? "+" : ""}`
      : "";
  const material = MATERIALS[part.material];
  const raw = rawStockSize(part);
  const steps = inferProcessSteps(part);
  const tableSaw = inferTableSawSetting(part);

  return (
    <div
      className={`print-keep relative border border-zinc-300 rounded p-3 bg-white ${
        className ?? ""
      }`}
    >
      {/* Install hint mini — 整家具縮圖、target part 紅色（Phase 2.5 Task 1）
          z-20 保證蓋在 OrthoView SVG（normal flow + bg-white）之上，否則
          高 aspect 零件的 SVG 會把右上角縮圖蓋掉一半（user 05-19 11:42 回報） */}
      <div className="absolute top-2 right-2 z-20">
        <InstallHintMini design={design} highlightPartId={group.parts.map((p) => p.id)} />
      </div>
      {/* Title bar */}
      <div className="flex items-baseline justify-between border-b border-zinc-200 pb-1 mb-2 pr-[88px]">
        <h3 className="font-semibold text-sm">
          {part.nameZh}
          {titleSuffix}
        </h3>
        <span className="text-xs text-zinc-500 tabular-nums">
          {scalePrefix}1:{scale}　{partNo}
        </span>
      </div>

      {/* 3 views layout：
            - row（預設）→ 1 張 A4 + L 型 3 view（CNS/JIS 第三角法慣例）
            - stack → 3 張獨立 A4 垂直疊（modal 全螢幕模式仍可放大單 view 看細節）
            - singleView → 單 view 模式
       */}
      {!singleView && viewLayout !== "stack" ? (
        <PartDrawingPaperSheet
          design={design}
          part={part}
          partNo={partNo}
          count={Math.min(group.count, 99)}
          scale={scale}
          materialLabel={
            isEn
              ? (material?.nameEn ?? material?.nameZh ?? part.material)
              : (material?.nameZh ?? part.material)
          }
          dimsLabel={`${Math.round(part.visible.length)}×${Math.round(part.visible.width)}×${Math.round(part.visible.thickness)}`}
          title={part.nameZh}
          className="bg-white w-full h-auto"
          locale={locale}
        />
      ) : (() => {
        const VIEWS: Array<{ view: PartView; title: string; titleEn: string }> = [
          { view: "front", title: "俯視", titleEn: "TOP" },
          { view: "side", title: "側視", titleEn: "SIDE" },
          { view: "bottom", title: "正視", titleEn: "FRONT" },
        ];
        const filtered = singleView
          ? VIEWS.filter((v) => v.view === singleView)
          : VIEWS;
        const gridClass = singleView
          ? "grid grid-cols-1 gap-2"
          : viewLayout === "stack"
          ? "grid grid-cols-1 gap-4"
          : "grid grid-cols-2 gap-2";
        return (
          <div className={gridClass}>
            {filtered.map(({ view, title, titleEn }, vIdx) => {
              // 此 view 的有效 zoom（per-view 覆寫 > 全卡 zoom > 1）
              const viewZoom: number = perViewZoom?.[view] ?? zoom;
              const viewUseExternalTitle = viewZoom > 1;
              const viewZoomWrapStyle: React.CSSProperties | undefined =
                viewZoom > 1
                  ? {
                      width: `${viewZoom * 100}%`,
                      height: `${viewZoom * 100}%`,
                      flexShrink: 0,
                    }
                  : undefined;
              // Modal stack / single-view mode：強制 SVG `max-h-[80vh]` 讓
              // 高 aspect 零件（長腳/桌腳 35×425）不會把 SVG 撐成 4000+ px 高、
              // 整個 modal 只看得到 part 頂端 + 一片白邊。caller 傳的
              // orthoClassName（如「bg-white w-full h-auto」沒 max-h）需要被
              // 增強——append `max-h-[80vh]`，preserveAspectRatio 自動把 viewBox
              // 縮進 viewport 高度內、part 置中、左右留白可接受（比 viewport
              // 截掉 80% part 好）。row 模式不動 caller className。
              // zoom > 1：SVG 改用 h-full 配合 wrapper 的 width/height: zoom*100%
              // 一起放大；wrapper 高度從外層 fixed-height scroll container（h-[70vh]）
              // 取百分比，1× 剛好 fit、2× 真的 2× of fit。
              // 用 h-auto+max-h 在 1× 是 fit-by-height、>1× 卻變 fit-by-width，
              // 兩個基準對不上，2× 看起來像 5×（user 2026-05-21 回報）。
              const needViewportClamp =
                viewZoom <= 1 &&
                (viewLayout === "stack" || singleView !== undefined) &&
                orthoClassName !== undefined &&
                !/max-h-/.test(orthoClassName);
              const effectiveOrthoClassName =
                viewZoom > 1
                  ? "bg-white w-full h-full"
                  : needViewportClamp
                  ? `${orthoClassName} max-h-[80vh]`
                  : orthoClassName;
              const brokenSpec = computeBrokenViewSpec(
                part,
                view,
                scale,
                paperFit.needBrokenView,
              );
              const orthoEl = (
                <OrthoView
                  design={design}
                  view={view}
                  title={title}
                  titleEn={titleEn}
                  isolatePartId={part.id}
                  showDimensions={false}
                  className={effectiveOrthoClassName}
                  noTitleInSvg={viewUseExternalTitle}
                  paperMode="a4-landscape"
                  paperScale={scale}
                  paperBroken={brokenSpec.active ? brokenSpec : null}
                  paperTitleBlock={{
                    partNo,
                    count: Math.min(group.count, 99),
                    materialLabel: isEn
                      ? (material?.nameEn ?? material?.nameZh ?? part.material)
                      : (material?.nameZh ?? part.material),
                    dimsLabel: `${Math.round(part.visible.length)}×${Math.round(part.visible.width)}×${Math.round(part.visible.thickness)}`,
                  }}
                  overlayContent={(ctx) => {
                    // 仰視 BOTTOM：annotation 在「Y 鏡像後的 part」+ view='top' 下渲染，
                    // 才能跟 OrthoView 內部 mirror design 投影對上。
                    const annPart = view === "bottom" ? mirrorYPart(part) : part;
                    const annView: PartView = view === "bottom" ? "top" : view;
                    return (
                      <>
                        <T1Dimensions ctx={ctx} part={annPart} view={annView} />
                        <T2Annotations ctx={ctx} part={annPart} view={annView} />
                        <GrainArrow ctx={ctx} part={annPart} view={annView} />
                        <ChamferRoundAnnotation ctx={ctx} part={annPart} view={annView} />
                        <FacingMark ctx={ctx} part={annPart} view={annView} />
                        <ShapeSpecificAnnotation
                          ctx={ctx}
                          part={annPart}
                          view={annView}
                        />
                        <CompoundMiterAnnotation
                          ctx={ctx}
                          part={annPart}
                          view={annView}
                        />
                      </>
                    );
                  }}
                />
              );
              // 倍率工具列（方案 1：每張視圖標題列旁直接放 1×~8×）
              const zoomToolbar = onViewZoom ? (
                <div className="flex items-center gap-1 ml-auto">
                  <span className="text-[10px] text-zinc-500 mr-1">放大</span>
                  {ZOOM_LEVELS.map((z) => (
                    <button
                      key={z}
                      type="button"
                      onClick={() => onViewZoom(view, z)}
                      className={`text-xs px-2 py-0.5 rounded border tabular-nums ${
                        viewZoom === z
                          ? "bg-amber-500 text-white border-amber-500"
                          : "border-zinc-300 text-zinc-700 hover:bg-zinc-50"
                      }`}
                    >
                      {z}×
                    </button>
                  ))}
                </div>
              ) : null;
              // zoom > 1 時把 OrthoView 包進 transform:scale wrapper、外面
              // 另畫不縮放的 HTML view 標題；zoom=1 維持既有行為（標題在 SVG 內）
              // 提供 onViewZoom 時：無論 zoom=1 都改用外置 HTML 標題列，
              // 才有地方掛倍率按鈕（否則 1× 標題在 SVG 內、按鈕無處附身）
              const externalTitle = viewUseExternalTitle || !!onViewZoom;
              // 第一張視圖的標題列要避開卡片右上角的 InstallHintMini（~88px 寬），
              // 不然 5×/8× 按鈕會被縮圖蓋住（user 2026-05-26 回報）
              const titleRowExtraClass = vIdx === 0 ? "pr-[92px]" : "";
              const viewBody = externalTitle ? (
                <>
                  <div className={`text-sm font-semibold text-zinc-800 mb-1 border-b border-zinc-200 pb-1 flex items-center ${titleRowExtraClass}`}>

                    <span>
                      {title}
                      <span className="ml-2 text-xs font-normal text-zinc-500">
                        {titleEn}
                      </span>
                    </span>
                    {zoomToolbar}
                  </div>
                  <div
                    ref={(el) => {
                      scrollRefs.current[vIdx] = el;
                    }}
                    className={`overflow-auto ${viewZoom > 1 ? "h-[70vh]" : ""} bg-zinc-50 flex [align-items:safe_center] [justify-content:safe_center]`}
                  >
                    <div
                      style={viewZoomWrapStyle}
                      className="flex items-center justify-center w-full"
                    >
                      {React.cloneElement(orthoEl, {
                        noTitleInSvg: true,
                      })}
                    </div>
                  </div>
                </>
              ) : (
                orthoEl
              );
              if (onViewClick) {
                return (
                  <button
                    key={view}
                    type="button"
                    onClick={() => onViewClick(view)}
                    className="group relative block w-full text-left cursor-zoom-in"
                    aria-label={`放大 ${title}`}
                  >
                    {viewBody}
                    <span className="absolute top-1 right-1 text-[10px] px-1.5 py-0.5 rounded bg-zinc-900/70 text-white opacity-0 group-hover:opacity-100 transition">
                      🔍 放大
                    </span>
                  </button>
                );
              }
              return <div key={view}>{viewBody}</div>;
            })}
          </div>
        );
      })()}

      {/* Phase 2.5 Task 3: title block 底列 — 編號 / 材料 / 比例 / 公差 */}
      <div className="border-t border-zinc-300 mt-2 pt-1 text-[9px] text-zinc-700 font-mono tabular-nums">
        <div className="grid grid-cols-4 gap-1">
          <div>
            <span className="text-zinc-500">{isEn ? "Part # " : "編號 "}</span>
            {partNo}
          </div>
          <div>
            <span className="text-zinc-500">{isEn ? "Material " : "材料 "}</span>
            {isEn
              ? (material?.nameEn ?? material?.nameZh ?? part.material)
              : (material?.nameZh ?? material?.nameEn ?? part.material)}
          </div>
          <div>
            <span className="text-zinc-500">{isEn ? "Scale " : "比例 "}</span>1:{scale}
          </div>
          <div>
            <span className="text-zinc-500">{isEn ? "Tolerance " : "公差 "}</span>±1mm
          </div>
        </div>
        {/* Phase 2.5 Task 2: 成品 vs 毛料雙標 */}
        <div className="text-zinc-500 mt-0.5">
          {isEn ? "Finished " : "成品 "}
          {isRoundFamilyShape(part)
            ? `Ø${round1(
                Math.max(part.visible.width, part.visible.thickness),
              )}×${round1(part.visible.length)}`
            : `${round1(part.visible.length)}×${round1(part.visible.width)}×${round1(part.visible.thickness)}`}
          　|　{isEn ? "Stock " : "毛料 "}{raw.L}×{raw.W}×{raw.T}
        </div>
        {design.useButtJointConvention !== false && (
          <div className="text-[8px] text-zinc-400 italic mt-0.5">
            {part.shape?.kind === "dovetail-ends"
              ? isEn
                ? "※ visible.length = stock cut length (incl. dovetail tail tips on both ends)"
                : "※ visible.length = stock 裁切長（含兩端鳩尾 tail tip）"
              : isEn
                ? "※ visible.length = with tenon overlap; exposed = visible.length − 2 × tenon length"
                : "※ visible.length = 含榫對接長度；裸露長 = visible.length − 2 × 榫長"}
          </div>
        )}
        {part.shape?.kind === "hoof" && (
          <div className="text-[8px] text-amber-700 mt-0.5">
            {isEn ? "Stock thickness ≥ " : "毛料厚建議 ≥ "}
            {Math.round(
              part.visible.width * (part.shape.hoofScale ?? 1.4) * 10,
            ) / 10}
            mm
          </div>
        )}
        {/* Phase 4 Task 2: 加工順序建議 */}
        <div className="text-[9px] text-zinc-700 mt-0.5">
          <span className="text-zinc-500">{isEn ? "Process " : "工序 "}</span>
          {steps.join(" → ")}
        </div>
        {/* Phase 4 Task 3: 鋸台設定值（僅斜角件出現） */}
        {tableSaw && (
          <div className="text-[9px] text-amber-700 mt-0.5">
            <span className="text-amber-500">{isEn ? "Table saw " : "鋸台 "}</span>
            {tableSaw}
          </div>
        )}
      </div>
    </div>
  );
}
