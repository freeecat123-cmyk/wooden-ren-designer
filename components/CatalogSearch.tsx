"use client";

import { useEffect, useState } from "react";

/**
 * 首頁搜尋框：用 client-side filter 快速隱藏不符合的家具卡片。
 * 26 個範本掃過 Cmd+F 還能找，但給客戶 demo / 想直接打「鞋櫃」找的場合很重要。
 *
 * 實作：所有家具卡片掛 `data-catalog-search="關鍵字 中文 英文"`，
 * 這個元件改 input 後直接 querySelectorAll 設 display=none。
 * 沒 JS 也不會壞——卡片預設都顯示。
 */
export function CatalogSearch() {
  const [q, setQ] = useState("");

  useEffect(() => {
    const cards = document.querySelectorAll<HTMLElement>(
      "[data-catalog-search]",
    );
    const groups = document.querySelectorAll<HTMLElement>(
      "[data-catalog-group]",
    );
    const needle = q.trim().toLowerCase();
    if (!needle) {
      cards.forEach((c) => (c.style.display = ""));
      groups.forEach((g) => (g.style.display = ""));
      return;
    }
    cards.forEach((c) => {
      const hay = (c.dataset.catalogSearch ?? "").toLowerCase();
      c.style.display = hay.includes(needle) ? "" : "none";
    });
    groups.forEach((g) => {
      const visible = g.querySelectorAll<HTMLElement>(
        '[data-catalog-search]:not([style*="display: none"])',
      );
      g.style.display = visible.length > 0 ? "" : "none";
    });
  }, [q]);

  return (
    <div className="mb-6 relative">
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="🔍 搜尋家具：餐桌、書櫃、玄關鞋櫃…"
        className="w-full px-4 py-3 rounded-xl border-2 border-zinc-200 bg-white text-base focus:border-amber-400 focus:outline-none"
      />
      {q && (
        <button
          type="button"
          onClick={() => setQ("")}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 text-sm"
        >
          ✕ 清除
        </button>
      )}
    </div>
  );
}
