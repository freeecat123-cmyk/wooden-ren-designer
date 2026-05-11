"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * 一鍵把所有 URL params 清空回到模板預設值。
 * 學員調整爛了不知道怎麼救時的逃生口。
 * 故意做 confirm 確認，因為 URL 即所有設計狀態，誤按會清光。
 */
export function ResetDefaultsButton() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  // 沒任何 param 時不顯示（已經是預設狀態）
  const hasAnyParam = params && Array.from(params.keys()).length > 0;
  if (!hasAnyParam) return null;

  const handleReset = () => {
    if (
      window.confirm(
        "重設後會清空你目前所有調整，回到出廠預設。要繼續嗎？\n（清空後可以按瀏覽器上一頁救回）",
      )
    ) {
      router.replace(pathname ?? "/", { scroll: false });
    }
  };

  return (
    <button
      type="button"
      onClick={handleReset}
      title="清空所有調整、回到模板預設值"
      className="text-[11px] px-2.5 py-1 rounded border border-zinc-200 bg-zinc-50 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
    >
      ↺ 重設預設
    </button>
  );
}
