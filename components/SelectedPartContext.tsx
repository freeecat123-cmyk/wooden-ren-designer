"use client";

import { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react";

interface SelectedPartCtx {
  selectedPartId: string | null;
  setSelectedPartId: (id: string | null) => void;
}

const Ctx = createContext<SelectedPartCtx>({
  selectedPartId: null,
  setSelectedPartId: () => {},
});

export function SelectedPartProvider({ children }: { children: ReactNode }) {
  const [selectedPartId, setSelectedPartId] = useState<string | null>(null);
  return <Ctx.Provider value={{ selectedPartId, setSelectedPartId }}>{children}</Ctx.Provider>;
}

export function useSelectedPart() {
  return useContext(Ctx);
}

/** 選中變更時自動 scroll 對應 row 進視野（dom 找 data-part-id） */
export function useScrollToSelectedRow(containerRef: React.RefObject<HTMLElement | null>) {
  const { selectedPartId } = useSelectedPart();
  const lastScrolledRef = useRef<string | null>(null);
  useEffect(() => {
    if (!selectedPartId || lastScrolledRef.current === selectedPartId) return;
    const el = containerRef.current?.querySelector(`[data-part-id="${CSS.escape(selectedPartId)}"]`);
    if (el && "scrollIntoView" in el) {
      (el as HTMLElement).scrollIntoView({ block: "center", behavior: "smooth" });
      lastScrolledRef.current = selectedPartId;
    }
  }, [selectedPartId, containerRef]);
}
