"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

/**
 * 一鍵把所有 URL params 清空回到模板預設值。
 * 學員調整爛了不知道怎麼救時的逃生口。
 * 故意做 confirm 確認，因為 URL 即所有設計狀態，誤按會清光。
 */
export function ResetDefaultsButton() {
  const t = useTranslations("resetDefaults");
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  // 沒任何 param 時不顯示（已經是預設狀態）
  const hasAnyParam = params && Array.from(params.keys()).length > 0;
  if (!hasAnyParam) return null;

  const handleReset = () => {
    if (window.confirm(t("confirm"))) {
      router.replace(pathname ?? "/", { scroll: false });
    }
  };

  return (
    <button
      type="button"
      onClick={handleReset}
      title={t("title")}
      className="text-[11px] px-2.5 py-1 rounded-md border border-amber-200 bg-white text-zinc-600 hover:border-amber-400 hover:bg-amber-50 hover:text-amber-800 transition-colors"
    >
      {t("button")}
    </button>
  );
}
