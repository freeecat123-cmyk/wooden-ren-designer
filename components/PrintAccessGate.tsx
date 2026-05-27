"use client";

import { useTranslations } from "next-intl";
import { useUserPlan } from "@/hooks/useUserPlan";
import { PrintButton } from "@/components/print/PrintButton";
import { UpgradePrompt } from "@/components/UpgradePrompt";
import { TrialWatermark } from "@/components/TrialWatermark";

export function PrintAccessGate({
  suggestedFilename,
}: {
  suggestedFilename?: string;
}) {
  const t = useTranslations("printGate");
  const { features, isLoading } = useUserPlan();

  if (isLoading) {
    return (
      <button
        type="button"
        disabled
        className="px-4 py-2 bg-zinc-200 text-zinc-500 rounded text-sm cursor-wait"
      >
        {t("loadingBtn")}
      </button>
    );
  }

  if (features.canDownloadPdf) {
    return <PrintButton suggestedFilename={suggestedFilename} />;
  }

  return (
    <a
      href="/pricing"
      className="px-4 py-2 rounded text-sm font-medium text-white transition-colors"
      style={{ background: "#8b4513" }}
      title={t("upgradeTitle")}
    >
      {t("upgradeBtn")}
    </a>
  );
}

export function PrintWatermarkLayer() {
  const t = useTranslations("printGate");
  const { features, isLoading } = useUserPlan();
  if (isLoading || !features.hasWatermark) return null;
  return (
    <>
      <TrialWatermark text={t("watermark")} />
      <div className="no-print fixed bottom-4 left-1/2 -translate-x-1/2 z-30 max-w-md w-[90%]">
        <UpgradePrompt
          feature={t("upgradeFeature")}
          requiredPlan="personal"
          hint={t("upgradeHint")}
          variant="card"
        />
      </div>
    </>
  );
}
