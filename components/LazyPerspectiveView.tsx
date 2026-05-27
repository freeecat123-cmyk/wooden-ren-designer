"use client";

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import type { FurnitureDesign } from "@/lib/types";
import { useSelectedPart } from "./SelectedPartContext";

function LoadingShell() {
  const t = useTranslations("lazyPerspective");
  return (
    <div className="w-full h-full min-h-[180px] aspect-[4/3] md:aspect-[16/10] rounded-lg bg-gradient-to-br from-zinc-100 to-zinc-200 flex items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full animate-[shimmer_1.6s_infinite]" />
      <div className="relative text-center text-zinc-500 text-sm select-none">
        <div className="text-3xl mb-1">🪵</div>
        <p className="text-xs">{t("loadingHint")}</p>
      </div>
    </div>
  );
}

const PerspectiveViewLazy = dynamic(
  () =>
    import("./PerspectiveView").then((m) => ({ default: m.PerspectiveView })),
  {
    ssr: false,
    loading: () => <LoadingShell />,
  },
);

export function LazyPerspectiveView({
  design,
  sceneTheme,
  joineryMode = false,
  auditMode = false,
  explodeMm = 0,
  lidLiftMm = 0,
  xrayMode = "off",
  compactMode = false,
  noSync = false,
  wireframeMode = false,
  hidePartIds = [],
}: {
  design: FurnitureDesign;
  sceneTheme?: import("@/lib/design/scene-themes").SceneTheme;
  joineryMode?: boolean;
  auditMode?: boolean;
  /** 爆炸視圖：tenon 外偏 explodeMm，視覺像榫頭抽出（joineryMode 才有意義） */
  explodeMm?: number;
  /** 掀蓋浮起：lid 整組（含 plug / hinge）往上抬 lidLiftMm，看 lid 底下結構 */
  lidLiftMm?: number;
  /** X-ray 透視：off / face（藏門+抽屜面板）/ full（藏整個抽屜+門） */
  xrayMode?: "off" | "face" | "full";
  /** 緊湊模式：外層 wrapper 跟父容器（PIP 用） */
  compactMode?: boolean;
  /** 不同步 SelectedPartContext（頂端參數調整 3D 用，避免被零件 dim 干擾） */
  noSync?: boolean;
  /** 線框模式：所有零件渲染骨架 */
  wireframeMode?: boolean;
  /** Debug：?hide=wall-front,wall-back URL param 隱藏特定 part */
  hidePartIds?: string[];
}) {
  const ctx = useSelectedPart();
  const selectedPartId = noSync ? null : ctx.selectedPartId;
  const onPartSelect = noSync ? undefined : ctx.setSelectedPartId;
  return (
    <PerspectiveViewLazy
      design={design}
      sceneTheme={sceneTheme}
      joineryMode={joineryMode}
      auditMode={auditMode}
      explodeMm={explodeMm}
      lidLiftMm={lidLiftMm}
      xrayMode={xrayMode}
      selectedPartId={selectedPartId}
      onPartSelect={onPartSelect}
      compactMode={compactMode}
      wireframeMode={wireframeMode}
      hidePartIds={hidePartIds}
    />
  );
}
