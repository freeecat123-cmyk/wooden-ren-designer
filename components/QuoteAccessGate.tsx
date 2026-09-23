"use client";

import { useTranslations } from "next-intl";
import { useUserPlan } from "@/hooks/useUserPlan";
import { UpgradePrompt } from "@/components/UpgradePrompt";

/**
 * 客製家具報價系統門檻——免費/個人版會把整個 children 蓋掉並顯示升級卡。
 * 付費（pro / lifetime / student）直接 pass-through。
 */
export function QuoteAccessGate({ children }: { children: React.ReactNode }) {
  const t = useTranslations("quoteGate");
  const { features, isLoading, isLoggedIn } = useUserPlan();

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 text-center text-sm text-zinc-500">
        {t("checking")}
      </div>
    );
  }

  if (features.canUseQuoteSystem) {
    return <>{children}</>;
  }

  return (
    <div className="relative">
      <div
        aria-hidden
        className="pointer-events-none select-none filter blur-sm opacity-50 max-h-[480px] overflow-hidden"
      >
        {children}
      </div>

      <div className="absolute inset-0 flex items-center justify-center px-4">
        <div className="max-w-md w-full">
          <div
            className="rounded-2xl border-2 px-6 py-7 shadow-xl bg-white"
            style={{ borderColor: "#d4a574" }}
          >
            <div className="text-3xl mb-2">🌱</div>
            <h2 className="text-lg font-bold text-[#5a3812] mb-2">
              {t("h")}
            </h2>
            <p className="text-sm text-[#7c4f1a] leading-relaxed mb-4">
              {t("body1")}
              <br />
              {t("body2")}
            </p>
            <div className="flex flex-wrap gap-2">
              <a
                href="/pricing"
                className="inline-block px-5 py-2 rounded-lg bg-[#8b4513] text-white text-sm font-medium hover:bg-[#6f370f] transition-colors"
              >
                {t("cta")}
              </a>
              {!isLoggedIn && (
                <span className="text-xs text-zinc-500 self-center">
                  {t("notLoggedInHint")}
                </span>
              )}
            </div>
            <UpgradePrompt
              feature={t("upgradeFeature")}
              requiredPlan="pro"
              hint={t("upgradeHint")}
              variant="inline"
              hideCta
            />
          </div>
        </div>
      </div>
    </div>
  );
}
