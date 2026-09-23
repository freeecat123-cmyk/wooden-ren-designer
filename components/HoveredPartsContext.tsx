"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

/**
 * HoveredPartsContext — 參數 hover → 3D 對應部件發光的橋樑
 *
 * 設計原則：
 * - 只負責「誰被 hover」的狀態傳遞，不知道參數 → partId 怎麼算（那是 Bot C）
 * - 用 ReadonlySet<string> 給消費端，O(1) 命中查詢，避免每個 part render 都跑 .includes
 * - setHoveredPartIds(null) 等同清空；setHoveredPartIds([]) 也清空
 * - 沒 Provider 也不 throw，方便還沒包到的角落安全 call hook（回傳空集合 + noop）
 */
interface HoveredPartsCtx {
  hoveredPartIds: ReadonlySet<string>;
  setHoveredPartIds: (ids: string[] | null) => void;
}

const EMPTY_SET: ReadonlySet<string> = new Set();

const Ctx = createContext<HoveredPartsCtx | null>(null);

export function HoveredPartsProvider({ children }: { children: ReactNode }) {
  const [ids, setIds] = useState<ReadonlySet<string>>(EMPTY_SET);

  const setHoveredPartIds = useCallback((next: string[] | null) => {
    if (!next || next.length === 0) {
      // 用同一個 EMPTY_SET reference 讓 memo / 比對更穩定
      setIds((prev) => (prev.size === 0 ? prev : EMPTY_SET));
      return;
    }
    setIds(new Set(next));
  }, []);

  const value = useMemo<HoveredPartsCtx>(
    () => ({ hoveredPartIds: ids, setHoveredPartIds }),
    [ids, setHoveredPartIds],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/**
 * 安全版 hook：沒 Provider 也不 throw，回傳空集合 + noop。
 * 這樣 PerspectiveView / 任何 deep child 都可以無條件呼叫。
 */
export function useHoveredParts(): HoveredPartsCtx {
  const c = useContext(Ctx);
  if (!c) {
    return { hoveredPartIds: EMPTY_SET, setHoveredPartIds: () => {} };
  }
  return c;
}
