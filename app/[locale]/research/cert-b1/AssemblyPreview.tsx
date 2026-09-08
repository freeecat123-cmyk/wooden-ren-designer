"use client";

import { useMemo, useRef, useState } from "react";
import { Download } from "lucide-react";
import { CertB1RailDrawing } from "@/lib/render/cert-b1-rail-drawing";
import { CertB1DrawerDrawing } from "@/lib/render/cert-b1-drawer-drawing";
import { LazyPerspectiveView } from "@/components/LazyPerspectiveView";
import { ZoomableThreeViews } from "@/components/ZoomableThreeViews";
import { SelectedPartProvider } from "@/components/SelectedPartContext";
import { HoveredPartsProvider } from "@/components/HoveredPartsContext";
import { certB1Assembly } from "@/lib/templates/cert-b1";
import styles from "./study.module.css";

export function AssemblyPreview() {
  const drawingRef = useRef<HTMLDivElement>(null);
  const [drawingKind, setDrawingKind] = useState<"rail" | "front" | "side">("rail");
  function downloadRailDrawing() {
    const svg = drawingRef.current?.querySelector("svg");
    if (!svg) return;
    const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], { type: "image/svg+xml;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `woodenren-cert-b1-${drawingKind === "rail" ? "rail-body" : `drawer-${drawingKind}`}.svg`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const [drawerTravel, setDrawerTravel] = useState(0);
  const [hideTop, setHideTop] = useState(false);
  const assembly = useMemo(() => certB1Assembly(), []);
  const design = useMemo(() => ({ ...assembly, parts: assembly.parts.map(p => p.id.startsWith("drawer-")
    ? { ...p, origin: { ...p.origin, z: p.origin.z - drawerTravel } } : p) }), [assembly, drawerTravel]);
  return <SelectedPartProvider><HoveredPartsProvider>
    <div className={styles.controls}>
      <label><input type="checkbox" checked={hideTop} onChange={e => setHideTop(e.target.checked)} /> 隱藏桌面</label>
      <label>抽屜拉出 <input aria-label="抽屜拉出" type="range" min={0} max={200} step={5}
        value={drawerTravel} onChange={e => setDrawerTravel(Number(e.target.value))} />
        <output>{drawerTravel} mm</output></label>
    </div>
    <div className={styles.comparison}>
      <section aria-label="第一題板件模型">
        <LazyPerspectiveView design={design} initialFit compactMode noSync
          hidePartIds={hideTop ? assembly.parts.filter(p => p.id.startsWith("top-")).map(p => p.id) : []} />
      </section>
    </div>
    <section className={styles.review} aria-label="零件加工圖">
      <div className={styles.drawingHeading}><h2>零件加工圖</h2>
        <label>圖面 <select aria-label="加工圖選擇" value={drawingKind} onChange={e => setDrawingKind(e.target.value as typeof drawingKind)}>
          <option value="rail">前曲線橫檔・板身放樣</option>
          <option value="front">抽屜前板・指孔</option>
          <option value="side">抽屜側板・雙面開槽</option>
        </select></label>
        <button type="button" onClick={downloadRailDrawing}><Download size={16} aria-hidden="true" /> 下載 SVG</button>
      </div>
      <div className={styles.railDrawing} ref={drawingRef}>{drawingKind === "rail" ? <CertB1RailDrawing /> : <CertB1DrawerDrawing kind={drawingKind} />}</div>
    </section>
    <section className={styles.review} aria-label="接合核對狀態">
      <h2>待核項目</h2>
      <ul>{assembly.warnings?.map(w => <li key={w}>{w}</li>)}</ul>
    </section>
    <section className={styles.review} aria-label="三視圖草稿">
      <h2>三視圖草稿</h2>
      <ZoomableThreeViews design={assembly} />
    </section>
    <section className={styles.review} aria-label="板件尺寸核對">
      <h2>板件尺寸核對（非切料單）</h2>
      <div className={styles.tableScroll}><table>
        <thead><tr><th>板件</th><th>板身長 × 寬 × 厚（mm）</th><th>加工</th></tr></thead>
        <tbody>{assembly.parts.map(p => <tr key={p.id}><td>{p.nameZh}</td>
          <td>{p.visible.length} × {p.visible.width} × {p.visible.thickness}</td>
          <td>{p.mortises.map(m => m.label).join("；") || "接合待核"}</td></tr>)}</tbody>
      </table></div>
    </section>
  </HoveredPartsProvider></SelectedPartProvider>;
}
