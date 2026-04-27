"use client";

import { useUserPlan } from "@/hooks/useUserPlan";
import { PrintButton } from "@/components/print/PrintButton";
import { UpgradePrompt } from "@/components/UpgradePrompt";
import { TrialWatermark } from "@/components/TrialWatermark";

/**
 * 列印頁的列印按鈕門檻。
 * - 付費版（canDownloadPdf=true）：照常顯示 PrintButton
 * - 免費版：替換為「升級下載 PDF」按鈕導向 /pricing
 *
 * 若 hasWatermark=true（免費版），同時掛一個螢幕版浮水印。
 */
export function PrintAccessGate({
  suggestedFilename,
}: {
  suggestedFilename?: string;
}) {
  const { features, isLoading } = useUserPlan();

  if (isLoading) {
    return (
      <button
        type="button"
        disabled
        className="px-4 py-2 bg-zinc-200 text-zinc-500 rounded text-sm cursor-wait"
      >
        🖨️ 載入中…
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
      title="升級個人版即可下載 PDF"
    >
      🔒 升級下載 PDF
    </a>
  );
}

/**
 * 列印頁的試用版浮水印（螢幕可見）+ 升級提示。
 * 付費版回傳 null。
 */
export function PrintWatermarkLayer() {
  const { features, isLoading } = useUserPlan();
  if (isLoading || !features.hasWatermark) return null;
  return (
    <>
      <TrialWatermark text="木頭仁 · 試用版" />
      <div className="no-print fixed bottom-4 left-1/2 -translate-x-1/2 z-30 max-w-md w-[90%]">
        <UpgradePrompt
          feature="無浮水印 PDF"
          requiredPlan="personal"
          hint="個人版開始就能下載無浮水印 PDF～"
          variant="card"
        />
      </div>
    </>
  );
}
