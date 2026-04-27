"use client";

import { useUserPlan } from "@/hooks/useUserPlan";
import { UpgradePrompt } from "@/components/UpgradePrompt";

/**
 * 客製家具報價系統門檻——免費/個人版會把整個 children 蓋掉並顯示升級卡。
 * 付費（pro / lifetime / student）直接 pass-through。
 */
export function QuoteAccessGate({ children }: { children: React.ReactNode }) {
  const { features, isLoading, isLoggedIn } = useUserPlan();

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 text-center text-sm text-zinc-500">
        檢查方案中…
      </div>
    );
  }

  if (features.canUseQuoteSystem) {
    return <>{children}</>;
  }

  return (
    <div className="relative">
      {/* 模糊+不可點的預覽，讓用戶看到「裡面長這樣」但不能用 */}
      <div
        aria-hidden
        className="pointer-events-none select-none filter blur-sm opacity-50 max-h-[480px] overflow-hidden"
      >
        {children}
      </div>

      {/* 中央升級卡 */}
      <div className="absolute inset-0 flex items-center justify-center px-4">
        <div className="max-w-md w-full">
          <div
            className="rounded-2xl border-2 px-6 py-7 shadow-xl bg-white"
            style={{ borderColor: "#d4a574" }}
          >
            <div className="text-3xl mb-2">🌱</div>
            <h2 className="text-lg font-bold text-[#5a3812] mb-2">
              客製家具報價系統 是 專業版功能
            </h2>
            <p className="text-sm text-[#7c4f1a] leading-relaxed mb-4">
              整套報價流程（材料/工時/塗裝/折扣/稅）+ 自訂抬頭 LOGO + 客戶資料管理 +
              LINE/Email 一鍵分享，都在這裡。<br />
              專業版 NT$ 890 / 月，接過 1 件案子就回本。
            </p>
            <div className="flex flex-wrap gap-2">
              <a
                href="/pricing"
                className="inline-block px-5 py-2 rounded-lg bg-[#8b4513] text-white text-sm font-medium hover:bg-[#6f370f] transition-colors"
              >
                看方案
              </a>
              {!isLoggedIn && (
                <span className="text-xs text-zinc-500 self-center">
                  · 還沒登入嗎？右上角先登入
                </span>
              )}
            </div>
            <UpgradePrompt
              feature="自訂報價單抬頭 / LOGO / 客戶資料管理"
              requiredPlan="pro"
              hint="專業版含這些工作室必備工具～"
              variant="inline"
              hideCta
            />
          </div>
        </div>
      </div>
    </div>
  );
}
