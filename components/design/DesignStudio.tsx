"use client";

import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore, type KeyboardEvent, type ReactNode, type RefObject } from "react";
import { Ellipsis, PanelLeft, PanelRight, X } from "lucide-react";
import type { Dimensions, FurnitureDesign, JoineryType } from "@/lib/types";
import { calculateCutDimensions } from "@/lib/geometry/cut-dimensions";
import { materialName } from "@/lib/materials";
import { partName } from "@/lib/templates/part-names";
import { formatDimensions } from "@/lib/units/format";
import { UNIT_CHANGE_EVENT } from "@/hooks/useUnit";
import { useSelectedPart } from "@/components/SelectedPartContext";
import styles from "./DesignStudio.module.css";

export interface DesignStudioProps {
  locale: string;
  design: FurnitureDesign;
  title: string;
  toolbar: ReactNode;
  parameters: ReactNode;
  model: ReactNode;
  drawings: ReactNode;
  materials: ReactNode;
  build: ReactNode;
  quote: ReactNode;
  exports: ReactNode;
  notices?: ReactNode;
  unit?: "mm" | "inch";
}

const views = ["design", "drawings", "materials", "build", "quote", "exports"] as const;
type View = typeof views[number];
type Panel = "parameters" | "inspector";
type Layout = "mobile" | "tablet" | "desktop";

const copy = {
  en: {
    design: "Design", drawings: "Drawings", materials: "Materials", build: "Build", quote: "Quote", exports: "Export",
    workspace: "Design workspace", views: "Workspace views", parameters: "Parameters", inspector: "Inspector",
    toggleParameters: "Toggle parameters", toggleInspector: "Toggle inspector",
    closeParameters: "Close parameters", closeInspector: "Close inspector", clear: "Clear selection",
    overview: "Overview", partCount: "Parts", material: "Material", visible: "Visible dimensions",
    cut: "Cut dimensions", axes: "Length × width × thickness", overall: "Overall dimensions",
    joints: "Joinery", tenons: "Tenons", mortises: "Mortises", none: "None",
    plywood: "Plywood", mdf: "MDF",
  },
  zh: {
    design: "設計", drawings: "圖面", materials: "材料", build: "製作", quote: "報價", exports: "輸出",
    workspace: "設計工作區", views: "工作區檢視", parameters: "參數", inspector: "零件檢視",
    toggleParameters: "切換參數面板", toggleInspector: "切換零件檢視",
    closeParameters: "關閉參數面板", closeInspector: "關閉零件檢視", clear: "清除選取",
    overview: "設計概覽", partCount: "零件數", material: "材質", visible: "可見尺寸",
    cut: "切料尺寸", axes: "長 × 寬 × 厚", overall: "整體尺寸",
    joints: "榫卯", tenons: "公榫", mortises: "榫孔", none: "無",
    plywood: "夾板", mdf: "中纖板（MDF）",
  },
};

const jointNames: Record<JoineryType, readonly [string, string]> = {
  "through-tenon": ["Through tenon", "通榫"], "blind-tenon": ["Blind tenon", "盲榫"],
  "shouldered-tenon": ["Shouldered tenon", "帶肩榫"], "stub-joint": ["Housing joint", "整支卡榫"],
  "half-lap": ["Half lap", "半搭榫"], dovetail: ["Dovetail", "鳩尾榫"],
  "finger-joint": ["Finger joint", "指接榫"], "tongue-and-groove": ["Tongue and groove", "企口榫"],
  dowel: ["Dowel", "木釘"], "mitered-spline": ["Mitered spline", "斜接插片榫"],
  mitered: ["Miter joint", "斜接"], "pocket-hole": ["Pocket hole", "斜孔"], screw: ["Screw", "螺絲"],
};

function subscribeLayout(notify: () => void) {
  const queries = [window.matchMedia("(min-width: 768px)"), window.matchMedia("(min-width: 1280px)")];
  queries.forEach(query => query.addEventListener("change", notify));
  return () => queries.forEach(query => query.removeEventListener("change", notify));
}

function getLayout(): Layout {
  return window.matchMedia("(min-width: 1280px)").matches ? "desktop"
    : window.matchMedia("(min-width: 768px)").matches ? "tablet" : "mobile";
}

function subscribeUnit(notify: () => void) {
  window.addEventListener(UNIT_CHANGE_EVENT, notify);
  window.addEventListener("storage", notify);
  return () => { window.removeEventListener(UNIT_CHANGE_EVENT, notify); window.removeEventListener("storage", notify); };
}

function dimensions(value: Dimensions, unit: "mm" | "inch") {
  return formatDimensions(value.length, value.width, value.thickness, unit);
}

function StudioPanel({ id, panel, title, closeLabel, visible, modal, trigger, onClose, children }: {
  id: string;
  panel: Panel;
  title: string;
  closeLabel: string;
  visible: boolean;
  modal: boolean;
  trigger: RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog || !visible) return;
    const focused = document.activeElement;
    // Promote the same DOM subtree to the top layer; never duplicate the form.
    if (modal) dialog.showModal();
    else {
      dialog.show();
      if (focused instanceof HTMLElement && focused !== document.body) focused.focus({ preventScroll: true });
      else if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    }
    const previousOverflow = document.body.style.overflow;
    /*
     * 🩸 手機版彈出面板時，studio 上面還有網站頁首。頁面沒捲到頂的話，3D 被頁首和
     *    面板上下夾掉——實測看得到的高度從 323px 掉到 198px。body 一旦 overflow:hidden
     *    就再也捲不動，所以要**先捲再鎖**。
     */
    if (modal) {
      const studio = dialog.closest("main");
      const offset = studio ? studio.getBoundingClientRect().top + window.scrollY : 0;
      window.scrollTo({ top: Math.max(0, offset), behavior: "instant" as ScrollBehavior });
    }
    if (modal) document.body.style.overflow = "hidden";
    const opener = trigger.current;
    return () => {
      dialog.close();
      if (modal) {
        document.body.style.overflow = previousOverflow;
        opener?.focus({ preventScroll: true });
      }
    };
  }, [visible, modal, trigger]);

  function containFocus(event: KeyboardEvent<HTMLDialogElement>) {
    if (!modal || event.key !== "Tab") return;
    const focusable = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
      'a[href],button,input,select,textarea,[tabindex]',
    )).filter(element => element.tabIndex >= 0 && !element.matches(':disabled')
      && !element.closest('[inert]') && element.getClientRects().length > 0);
    const first = focusable[0];
    const last = focusable.at(-1);
    if (!first || !last) {
      event.preventDefault();
      event.currentTarget.focus();
    } else if (event.shiftKey && (document.activeElement === first || document.activeElement === event.currentTarget)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return <dialog ref={ref} id={id} className={`${styles.sidePanel} ${styles[panel]}`}
    data-studio-panel={panel} data-modal={modal} role={modal ? "dialog" : "complementary"}
    aria-labelledby={`${id}-title`} aria-modal={modal && visible ? true : undefined}
    inert={!visible} tabIndex={-1} onKeyDown={containFocus}
    onCancel={event => { event.preventDefault(); onClose(); }}>
    <div className={styles.panelHeading}>
      <h2 id={`${id}-title`}>{title}</h2>
      <button type="button" className={styles.iconButton} aria-label={closeLabel} title={closeLabel} onClick={onClose}>
        <X size={18} aria-hidden="true" />
      </button>
    </div>
    <div className={styles.panelContent}>{children}</div>
  </dialog>;
}

export function DesignStudio({ locale, design, title, toolbar, parameters, model, drawings, materials, build, quote, exports, notices, unit = "mm" }: DesignStudioProps) {
  const text = locale === "en" ? copy.en : copy.zh;
  const displayUnit = useSyncExternalStore(subscribeUnit, () => {
    if (locale !== "en") return "mm";
    try { const saved = localStorage.getItem("wr-unit"); return saved === "mm" || saved === "inch" ? saved : unit; }
    catch { return unit; }
  }, () => unit);
  const id = useId();
  const [view, setView] = useState<View>("design");
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [overlay, setOverlay] = useState<Panel | null>(null);
  const [toolbarOpen, setToolbarOpen] = useState(false);
  const toolbarRef = useRef<HTMLDetailsElement>(null);
  const layout = useSyncExternalStore(subscribeLayout, getLayout, () => "desktop" as Layout);
  const leftTrigger = useRef<HTMLButtonElement>(null);
  const rightTrigger = useRef<HTMLButtonElement>(null);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const { selectedPartId, setSelectedPartId } = useSelectedPart();
  const selected = design.parts.find(part => part.id === selectedPartId);
  const leftModal = layout === "mobile";
  const rightModal = layout !== "desktop";
  const leftVisible = view === "design" && (leftModal ? overlay === "parameters" : leftOpen);
  const rightVisible = rightModal ? overlay === "inspector" : rightOpen;

  useEffect(() => { setOverlay(null); }, [layout]);
  useEffect(() => {
    if (!toolbarOpen) return;
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !toolbarRef.current?.contains(event.target)) setToolbarOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [toolbarOpen]);
  useEffect(() => {
    if (selectedPartId && !selected) setSelectedPartId(null);
  }, [selectedPartId, selected, setSelectedPartId]);

  const closeLeft = useCallback(() => {
    if (leftModal) setOverlay(null);
    else { setLeftOpen(false); leftTrigger.current?.focus(); }
  }, [leftModal]);
  const closeRight = useCallback(() => {
    if (rightModal) setOverlay(null);
    else { setRightOpen(false); rightTrigger.current?.focus(); }
  }, [rightModal]);

  function selectView(next: View) {
    setView(next);
    setOverlay(null);
  }
  function moveTab(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next: number;
    switch (event.key) {
      case "ArrowRight": next = (index + 1) % views.length; break;
      case "ArrowLeft": next = (index + views.length - 1) % views.length; break;
      case "Home": next = 0; break;
      case "End": next = views.length - 1; break;
      default: return;
    }
    event.preventDefault();
    selectView(views[next]);
    tabRefs.current[next]?.focus();
  }

  const slots = { design: model, drawings, materials, build, quote, exports };
  const joints = selected ? [...new Set(selected.tenons.map(tenon => tenon.type))] : [];
  const selectedMaterial = selected?.materialOverride ? text[selected.materialOverride]
    : materialName(selected?.material ?? design.primaryMaterial, locale);

  return <main className={styles.studio} aria-label={text.workspace}>
    <header className={styles.header}>
      <h1 className={styles.title}>{title}</h1>
      <details ref={toolbarRef} className={styles.toolbarMenu} open={layout === "desktop" || toolbarOpen}
        onKeyDown={event => { if (event.key === "Escape" && toolbarOpen) { setToolbarOpen(false); toolbarRef.current?.querySelector("summary")?.focus(); } }}>
        <summary aria-label={locale === "en" ? "Design actions" : "設計操作"}
          title={locale === "en" ? "Design actions" : "設計操作"}
          onClick={event => { event.preventDefault(); setToolbarOpen(value => !value); }}><Ellipsis size={20} aria-hidden /></summary>
        <div className={styles.toolbar}>{toolbar}</div>
      </details>
    </header>
    {notices != null && <div className={styles.notices}>{notices}</div>}
    <div className={styles.navigation}>
      <button ref={leftTrigger} type="button" className={styles.iconButton}
        aria-label={text.toggleParameters} title={text.toggleParameters} aria-controls={`${id}-parameters`}
        aria-expanded={leftVisible} aria-haspopup={leftModal ? "dialog" : undefined}
        onClick={() => {
          setView("design");
          if (leftModal) setOverlay(overlay === "parameters" ? null : "parameters");
          else setLeftOpen(view === "design" ? !leftOpen : true);
        }}><PanelLeft size={18} aria-hidden="true" /></button>
      <div className={styles.tabs} role="tablist" aria-label={text.views}>
        {views.map((key, index) => <button key={key} ref={node => { tabRefs.current[index] = node; }}
          type="button" role="tab" id={`${id}-tab-${key}`} aria-controls={`${id}-view-${key}`}
          aria-selected={view === key} tabIndex={view === key ? 0 : -1} className={styles.tab}
          onClick={() => selectView(key)} onKeyDown={event => moveTab(event, index)}>{text[key]}</button>)}
      </div>
      <button ref={rightTrigger} type="button" className={styles.iconButton}
        aria-label={text.toggleInspector} title={text.toggleInspector} aria-controls={`${id}-inspector`}
        aria-expanded={rightVisible} aria-haspopup={rightModal ? "dialog" : undefined}
        onClick={() => rightModal ? setOverlay(overlay === "inspector" ? null : "inspector") : setRightOpen(!rightOpen)}>
        <PanelRight size={18} aria-hidden="true" />
      </button>
    </div>
    <div className={styles.workspace}>
      <StudioPanel id={`${id}-parameters`} panel="parameters" title={text.parameters} closeLabel={text.closeParameters}
        visible={leftVisible} modal={leftModal} trigger={leftTrigger} onClose={closeLeft}>{parameters}</StudioPanel>
      <div className={`${styles.views} ${view === "materials" ? styles.materialsWorkspace : ""}`}>
        {views.map(key => {
          const sharedModel = key === "design" && view === "materials";
          const visible = view === key || sharedModel;
          return <div key={key} role={sharedModel ? "region" : "tabpanel"} id={`${id}-view-${key}`}
            aria-labelledby={sharedModel ? undefined : `${id}-tab-${key}`}
            aria-label={sharedModel ? (locale === "en" ? "3D model" : "3D 模型") : undefined}
            tabIndex={0} hidden={!visible} inert={!visible}
            className={key === "design" ? styles.modelPanel : styles.viewPanel}>{slots[key]}</div>;
        })}
      </div>
      <StudioPanel id={`${id}-inspector`} panel="inspector" title={text.inspector} closeLabel={text.closeInspector}
        visible={rightVisible} modal={rightModal} trigger={rightTrigger} onClose={closeRight}>
        <div className={styles.inspectorTitle}>
          <h3>{selected ? partName(selected, locale) : text.overview}</h3>
          {selected && <button type="button" className={styles.iconButton} aria-label={text.clear} title={text.clear}
            onClick={() => setSelectedPartId(null)}><X size={16} aria-hidden="true" /></button>}
        </div>
        <dl className={styles.facts}>
          <dt>{text.material}</dt><dd>{selectedMaterial}</dd>
          {selected ? <>
            <dt>{text.visible}</dt><dd>{dimensions(selected.visible, displayUnit)}</dd>
            <dt>{text.cut}</dt><dd>{dimensions(calculateCutDimensions(selected), displayUnit)}</dd>
          </> : <>
            <dt>{text.overall}</dt><dd>{dimensions(design.overall, displayUnit)}</dd>
            <dt>{text.partCount}</dt><dd>{design.parts.length}</dd>
          </>}
        </dl>
        <p className={styles.axes}>{text.axes}</p>
        {selected && <div className={styles.joints}>
          <h3>{text.joints}</h3>
          {joints.length > 0 ? <ul>{joints.map(joint => <li key={joint}>{jointNames[joint]?.[locale === "en" ? 0 : 1] ?? joint}</li>)}</ul> : null}
          <dl className={styles.facts}>
            <dt>{text.tenons}</dt><dd>{selected.tenons.length || text.none}</dd>
            <dt>{text.mortises}</dt><dd>{selected.mortises.length || text.none}</dd>
          </dl>
        </div>}
      </StudioPanel>
    </div>
  </main>;
}
