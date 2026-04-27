"use client";

import { useCallback, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * 設計頁表單的 client-side 外殼。
 *
 * 為什麼需要：原本 ParameterForm 用「改數字 → 按重新生成」方式更新設計，
 * 使用者每次要 scroll 下來按按鈕。改成 onChange debounce 500ms 後
 * 自動 router.replace，表單跟 3D / 三視圖的視覺迴圈就閉合了。
 *
 * 實作：只包 form 元素，內容（inputs、groups、button）仍由 server 渲。
 * form 的 action 保留，沒 JS 時「重新生成」按鈕仍可 GET submit。
 */
export function DesignFormShell({
  action,
  children,
  className,
}: {
  action: string;
  children: React.ReactNode;
  className?: string;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const pushURL = useCallback(() => {
    if (!formRef.current) return;
    const data = new FormData(formRef.current);
    const params = new URLSearchParams();
    for (const [k, v] of data.entries()) {
      params.set(k, v as string);
    }
    // Unchecked checkboxes are absent from FormData — remove them so server
    // sees no value (which the parser treats as "false")
    formRef.current
      .querySelectorAll<HTMLInputElement>('input[type="checkbox"]')
      .forEach((cb) => {
        if (!cb.checked) params.delete(cb.name);
      });
    // scroll: false 防止 Next.js 預設行為——router.replace 會把頁面捲回最上面，
    // 改參數時就會「跳掉看不到剛編輯的欄位」，嚴重影響操作。
    router.replace(`${action}?${params.toString()}`, { scroll: false });
  }, [action, router]);

  const handleChange = useCallback(() => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(pushURL, 500);
  }, [pushURL]);

  return (
    <form
      ref={formRef}
      method="get"
      action={action}
      onChange={handleChange}
      className={className}
    >
      {children}
    </form>
  );
}
