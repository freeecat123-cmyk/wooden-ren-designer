import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import type { FurnitureDesign } from "@/lib/types";

const h = vi.hoisted(() => ({ states: [] as unknown[], cursor: 0,
  stl: vi.fn(), obj: vi.fn(), flat: vi.fn(), mf: vi.fn(), validate: vi.fn(() => ({ ok: true, badParts: [] })) }));
vi.mock("react", async importOriginal => ({ ...await importOriginal<typeof import("react")>(),
  useState: (initial: unknown) => {
    const i = h.cursor++;
    if (!(i in h.states)) h.states[i] = initial;
    return [h.states[i], (value: unknown) => { h.states[i] = value; }];
  }, useMemo: (fn: () => unknown) => fn(), useEffect: () => {},
}));
vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key, useLocale: () => "en" }));
vi.mock("@/lib/export/three-d-export", () => ({ downloadSTL: h.stl, downloadOBJ: h.obj,
  downloadFlatLayoutSTL: h.flat, download3MF: h.mf, validateDesignExport: h.validate,
  MORTISE_EXPORT_LIMITATIONS: "Explicit mortises only; tenon protrusions and derived mating dovetail cuts are not included.",
  JOINERY_EXPORT_LIMITATIONS: "Supported joinery only; compound-axis tenons rejected.",
}));
vi.mock("@/lib/export/parts-svg", () => ({ designHasMortises: () => false }));
import { ThreeDExportButton } from "./ThreeDExportButton";
const design = { parts: [] } as unknown as FurnitureDesign;
type Node = ReactElement<Record<string, any>>;
function render(machiningDesign: FurnitureDesign | null = design) {
  h.cursor = 0;
  const all: Node[] = [];
  const walk = (n: any) => { if (!n || typeof n !== "object") return;
    if (Array.isArray(n)) { n.forEach(walk); return; }
    all.push(n); walk(n.props?.children);
  };
  walk(ThreeDExportButton({ design, machiningDesign: machiningDesign ?? undefined }));
  return all;
}
describe("3D export mode controls", () => {
  beforeEach(() => { h.states = []; vi.clearAllMocks(); });
  it("does not advertise accurate joinery from an assembly-only model", () => {
    const nodes = render(null);
    for (const value of ["mortise-accurate", "joinery-accurate"]) {
      expect(nodes.find(n => n.type === "option" && n.props.value === value)!.props.disabled).toBe(true);
    }
    nodes.find(n => n.type === "select" && n.props["aria-label"] === "Export geometry")!.props.onChange({ target: { value: "joinery-accurate" } });
    const selected = render(null);
    const button = selected.find(n => n.type === "button" && n.props.children === "stlBtn")!;
    expect(button.props.disabled).toBe(true);
    button.props.onClick();
    expect(h.stl).not.toHaveBeenCalled();
  });
  it("uses the explicit machining model for validation and every accurate download", () => {
    const machiningDesign = { ...design, id: "unstripped-joinery" };
    render(machiningDesign).find(n => n.type === "select" && n.props["aria-label"] === "Export geometry")!.props.onChange({ target: { value: "joinery-accurate" } });
    const nodes = render(machiningDesign);
    expect(h.validate).toHaveBeenLastCalledWith(machiningDesign, "joinery-accurate");
    for (const [label, fn] of [["stlBtn", h.stl], ["objBtn", h.obj], ["flatBtn", h.flat], ["threeMfBtn", h.mf]] as const) {
      nodes.find(n => n.type === "button" && n.props.children === label)!.props.onClick();
      expect(fn).toHaveBeenLastCalledWith(machiningDesign, 0.1, "joinery-accurate");
    }
  });
  it("keeps printable defaults and forwards selected mode to all four downloads", () => {
    let nodes = render();
    nodes.find(n => n.type === "button" && n.props.children === "stlBtn")!.props.onClick();
    expect(h.stl).toHaveBeenLastCalledWith(design, 0.1, "printable");
    const mode = nodes.find(n => n.type === "select" && n.props["aria-label"] === "Export geometry");
    expect(mode).toBeDefined();
    mode!.props.onChange({ target: { value: "mortise-accurate" } });
    nodes = render();
    for (const [label, fn] of [["stlBtn", h.stl], ["objBtn", h.obj], ["flatBtn", h.flat], ["threeMfBtn", h.mf]] as const) {
      nodes.find(n => n.type === "button" && n.props.children === label)!.props.onClick();
      expect(fn).toHaveBeenLastCalledWith(design, 0.1, "mortise-accurate");
    }
    expect(JSON.stringify(nodes)).toContain("tenon protrusions");
    expect(h.validate).toHaveBeenLastCalledWith(design, "mortise-accurate");
  });
  it("shows download failure instead of silently falling back", () => {
    h.stl.mockImplementationOnce(() => { throw new Error("CSG failed"); });
    render().find(n => n.type === "button" && n.props.children === "stlBtn")!.props.onClick();
    expect(render().find(n => n.props?.role === "alert")?.props.children).toContain("CSG failed");
  });
  it("offers supported joinery without removing mortise-only mode", () => {
    const nodes = render();
    expect(nodes.some(n => n.type === "option" && n.props.value === "joinery-accurate")).toBe(true);
    expect(nodes.some(n => n.type === "option" && n.props.value === "mortise-accurate")).toBe(true);
    nodes.find(n => n.type === "select" && n.props["aria-label"] === "Export geometry")!.props.onChange({ target: { value: "joinery-accurate" } });
    const selected = render();
    expect(JSON.stringify(selected)).toContain("compound-axis");
    for (const [label, fn] of [["stlBtn", h.stl], ["objBtn", h.obj], ["flatBtn", h.flat], ["threeMfBtn", h.mf]] as const) {
      selected.find(n => n.type === "button" && n.props.children === label)!.props.onClick();
      expect(fn).toHaveBeenLastCalledWith(design, 0.1, "joinery-accurate");
    }
  });
});
