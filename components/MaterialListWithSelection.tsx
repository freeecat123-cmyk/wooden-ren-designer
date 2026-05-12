"use client";

import { useRef } from "react";
import type { FurnitureDesign } from "@/lib/types";
import { MaterialList } from "@/lib/render/svg-views";
import { useSelectedPart, useScrollToSelectedRow } from "./SelectedPartContext";

/**
 * MaterialList 的 client 包裝：把 SelectedPartContext 接到 row 點擊+反白上。
 * 3D 點零件 → 對應 row 自動 scroll 進視野。
 */
export function MaterialListWithSelection({ design }: { design: FurnitureDesign }) {
  const { selectedPartId, setSelectedPartId } = useSelectedPart();
  const containerRef = useRef<HTMLDivElement>(null);
  useScrollToSelectedRow(containerRef);
  return (
    <div ref={containerRef}>
      <MaterialList
        design={design}
        selectedPartId={selectedPartId}
        onPartClick={(id) => setSelectedPartId(id === selectedPartId ? null : id)}
      />
    </div>
  );
}
