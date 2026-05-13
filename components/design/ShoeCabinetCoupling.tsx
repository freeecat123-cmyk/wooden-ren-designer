"use client";

import { useEffect } from "react";

/**
 * shoe-cabinet 專屬的表單欄位雙向耦合：
 *
 * - 勾 angledRack ON → 同步把 topType select 切到 "shelves"
 *   （斜放只在開放層板上才有意義；不耦合的話勾起來會「沒反應」）
 *
 * - 切 topType 到非 shelves → 同步取消 angledRack
 *   （使用者改用門/抽屜時應該尊重，不能因為 angledRack=true 就拉回 shelves）
 *
 * 兩個動作都在同一個 change 事件 capture 階段完成，DesignFormShell 的
 * pushURL（200ms debounce）會在 capture phase 完成後讀取 FormData，
 * 所以同時看到兩個欄位的新值，一次 URL 更新搞定。
 *
 * 為什麼不用 server-side redirect：server 看到 ?angledRack=true&topType=door
 * 沒辦法分辨「使用者剛勾斜放」（要切 shelves）還是「使用者剛切到門板」
 * （要關 angledRack）—— 兩種狀態 URL 一樣。client-side 抓 change 事件
 * 才知道哪個欄位是這次互動的源頭。
 */
export function ShoeCabinetCoupling() {
  useEffect(() => {
    const handler = (e: Event) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      const form = target.closest<HTMLFormElement>("form");
      if (!form) return;

      // 勾 angledRack ON → 把 topType 切到 shelves
      if (
        target instanceof HTMLInputElement &&
        target.type === "checkbox" &&
        target.name === "angledRack" &&
        target.checked
      ) {
        const topTypeSelect = form.querySelector<HTMLSelectElement>(
          'select[name="topType"]',
        );
        if (topTypeSelect && topTypeSelect.value !== "shelves") {
          topTypeSelect.value = "shelves";
        }
      }

      // 切 topType 到非 shelves → 取消 angledRack
      if (
        target instanceof HTMLSelectElement &&
        target.name === "topType" &&
        target.value !== "shelves"
      ) {
        const angledCheckbox = form.querySelector<HTMLInputElement>(
          'input[name="angledRack"]',
        );
        if (angledCheckbox && angledCheckbox.checked) {
          angledCheckbox.checked = false;
        }
      }
    };

    document.addEventListener("change", handler, true);
    return () => document.removeEventListener("change", handler, true);
  }, []);

  return null;
}
