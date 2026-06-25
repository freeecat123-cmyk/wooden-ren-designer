"use client";

import { useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/** 非表單管的 URL 狀態 key（場景主題 / 顯示模式 / dev flag）——
 *  改 form 時要保留這些，否則 wireframe / xray / scene 會被 reset。
 *  ⭐ designId：載入雲端設計後改參數，必須保留 ?designId，否則 SaveDesignButton
 *  的 currentDesignId 變 null →「儲存設計」又跳出輸入新專案名（變另存新檔，
 *  user 2026-06-25 回報「改參數後就存不回原設計」）。 */
const PRESERVE_KEYS = ["scene", "xray", "wf", "audit", "explode", "joineryMode", "designerMode", "ui", "lidLift", "style", "styleVariant", "designId"];

/**
 * Preset → 自動同步 sibling input 值的映射表。
 *
 * 場景：紅酒架的「瓶型」select 選 bordeaux/burgundy/... 時，下面「瓶身直徑」
 * slider 應該自動跳到該 preset 對應的數字、視覺跟實際算保持一致。
 *
 * 表結構：{ [select.name]: { [select.value]: { [target.name]: targetValue } } }
 * - select 變更時查表、找到對應 target name → 用 querySelector 改 input.value
 * - "custom" / 表上沒列的 value = 不同步、user 的 slider 值留著
 */
const PRESET_INPUT_SYNC: Record<string, Record<string, Record<string, string>>> = {
  bottleType: {
    bordeaux: { bottleDiameter: "75" },
    burgundy: { bottleDiameter: "80" },
    champagne: { bottleDiameter: "90" },
    magnum: { bottleDiameter: "105" },
  },
};

/**
 * Reverse sync：sibling input 改變時、若值脫離 master select 的 preset、
 * 自動把 master select 切回 "custom"。避免 bordeaux preset 模式下拉 slider
 * 到 100、UI 上仍顯示「波爾多」+ slider 100 的衝突視覺。
 *
 * 表結構：{ [inputName]: { selectName, customValue, presetValues } }
 */
const PRESET_INPUT_REVERSE_SYNC: Record<string, {
  selectName: string;
  customValue: string;
  presetValues: Record<string, number>;
}> = {
  bottleDiameter: {
    selectName: "bottleType",
    customValue: "custom",
    presetValues: { bordeaux: 75, burgundy: 80, champagne: 90, magnum: 105 },
  },
};

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
    // Preset → sibling input 自動同步（紅酒架 bottleType → bottleDiameter）
    if (
      target instanceof HTMLSelectElement &&
      PRESET_INPUT_SYNC[target.name] &&
      PRESET_INPUT_SYNC[target.name][target.value]
    ) {
      const syncMap = PRESET_INPUT_SYNC[target.name][target.value];
      for (const [targetKey, targetVal] of Object.entries(syncMap)) {
        const targetInput = formRef.current?.querySelector<HTMLInputElement>(
          `input[name="${targetKey}"]`,
        );
        if (targetInput && targetInput.value !== targetVal) {
          targetInput.value = targetVal;
          // 觸發 input event 讓 React controlled-component listener（若有）跟上
          targetInput.dispatchEvent(new Event("input", { bubbles: true }));
        }
      }
    }
    // Reverse sync：input 改變時、若值脫離 master select 的 preset 對應、
    // 自動把 select 切回 "custom"。避免「波爾多 preset + slider 100」衝突視覺。
    if (
      target instanceof HTMLInputElement &&
      target.type === "number" &&
      PRESET_INPUT_REVERSE_SYNC[target.name]
    ) {
      const cfg = PRESET_INPUT_REVERSE_SYNC[target.name];
      const masterSelect = formRef.current?.querySelector<HTMLSelectElement>(
        `select[name="${cfg.selectName}"]`,
      );
      if (masterSelect && masterSelect.value !== cfg.customValue) {
        const expectedPresetValue = cfg.presetValues[masterSelect.value];
        const newInputValue = Number(target.value);
        if (Number.isFinite(newInputValue) && expectedPresetValue !== newInputValue) {
          masterSelect.value = cfg.customValue;
          masterSelect.dispatchEvent(new Event("change", { bubbles: true }));
        }
      }
    }
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

  // 保險絲：把目前的雲端設計 id 埋成隱藏欄位，讓「原生 GET 送出」(無 JS / 任何
  // 繞過 pushURL 的邊角路徑) 也帶著 designId，不會掉回「另存新檔」。pushURL 走
  // PRESERVE_KEYS 已先擋一層，這裡是雙保險。
  const designId = sp?.get("designId") ?? null;

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
      {designId && <input type="hidden" name="designId" value={designId} />}
      {children}
    </form>
  );
}
