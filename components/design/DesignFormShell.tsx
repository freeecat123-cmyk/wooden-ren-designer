"use client";

import { useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/** 非表單管的 URL 狀態 key（場景主題 / 顯示模式 / dev flag）——
 *  改 form 時要保留這些，否則 wireframe / xray / scene 會被 reset */
const PRESERVE_KEYS = ["scene", "xray", "wf", "audit", "explode", "joineryMode", "designerMode", "ui", "lidLift", "style", "styleVariant"];

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
  const sp = useSearchParams();
  const formRef = useRef<HTMLFormElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const pushURL = useCallback(() => {
    if (!formRef.current) return;
    const data = new FormData(formRef.current);
    const params = new URLSearchParams();
    // 先保留非表單管的 URL 狀態（wf / xray / scene 等）
    for (const k of PRESERVE_KEYS) {
      const v = sp?.get(k);
      if (v !== null && v !== undefined) params.set(k, v);
    }
    for (const [k, v] of data.entries()) {
      params.set(k, v as string);
    }
    // 未勾選的 checkbox 不在 FormData 裡，但 server parser 對「缺 key」
    // 的處理是回 spec.defaultValue——defaultValue=true 的 checkbox（如圓凳
    // withApron）勾掉後會被解析回 true，等於勾不掉。
    // 所以這裡要把「所有 checkbox」明確寫入 URL（true / false），讓 server
    // 看到 "false" 就確實當成關閉。
    formRef.current
      .querySelectorAll<HTMLInputElement>('input[type="checkbox"]')
      .forEach((cb) => {
        params.set(cb.name, cb.checked ? "true" : "false");
      });
    // scroll: false 防止 Next.js 預設行為——router.replace 會把頁面捲回最上面，
    // 改參數時就會「跳掉看不到剛編輯的欄位」，嚴重影響操作。
    router.replace(`${action}?${params.toString()}`, { scroll: false });
  }, [action, router, sp]);

  const isInputFocused = (target: EventTarget | null): boolean => {
    if (!(target instanceof HTMLElement)) return false;
    const tag = target.tagName;
    if (tag === "INPUT") {
      const type = (target as HTMLInputElement).type;
      return type === "number" || type === "text" || type === "email" || type === "tel" || type === "search";
    }
    return tag === "TEXTAREA";
  };

  const handleChange = useCallback((e: React.ChangeEvent<HTMLFormElement>) => {
    clearTimeout(timerRef.current);
    const target = e.target;
    // 數字 input：區分 spinner ▲▼ 點擊 vs 鍵盤輸入。
    // - 鍵盤輸入：InputEvent.inputType = "insertText" / "deleteContentBackward" 等
    // - spinner 點擊：inputType 為 ""（empty string）
    // 手打維持等 blur/Enter（避免「1500」打到「1」就被 clamp 到 min）；
    // spinner 走 600ms debounce——之前 200ms 卡在 macOS 「初始按下→
    // auto-repeat 啟動」的 500ms 間隙：按住時 debounce 在第一次事件後
    // 200ms 就 fire 一次 pushURL，URL 一變 input 因 key={defaults} 被
    // remount，使用者的 hold 就「斷在舊 DOM」上、值會跳回較舊的中間值。
    // 600ms 覆蓋掉那段間隙，按住期間連續事件會一直 reset debounce，只在
    // 真正放開後才 push 最終值。
    if (target instanceof HTMLInputElement && target.type === "number") {
      const native = e.nativeEvent;
      const isTyping = native instanceof InputEvent && native.inputType !== "";
      if (isTyping) return;
      timerRef.current = setTimeout(pushURL, 600);
      return;
    }
    // text inputs 等 blur 或 Enter 才送
    if (isInputFocused(target)) return;
    // checkbox / select / radio 維持 short debounce
    timerRef.current = setTimeout(pushURL, 200);
  }, [pushURL]);

  const handleBlur = useCallback((e: React.FocusEvent<HTMLFormElement>) => {
    if (!isInputFocused(e.target)) return;
    clearTimeout(timerRef.current);
    pushURL();
  }, [pushURL]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLFormElement>) => {
    if (e.key === "Enter" && isInputFocused(e.target)) {
      e.preventDefault();
      (e.target as HTMLInputElement).blur();
    }
  }, []);

  return (
    <form
      ref={formRef}
      method="get"
      action={action}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className={className}
    >
      {children}
    </form>
  );
}
