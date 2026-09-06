import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { chineseCabinet, chineseCabinetOptions } from "./chinese-cabinet";
import { calculateCutDimensions } from "../geometry/cut-dimensions";
import { findOverlaps } from "../geometry/overlap";
import { mortiseLocalBox } from "../render/svg-views";
import type { FurnitureTemplateInput } from "../types";

const variants = ["auto", "inward-hoof", "outward-hoof", "box"] as const;
const defaults = Object.fromEntries(chineseCabinetOptions.map(o => [o.key, o.defaultValue]));
const build = (options: FurnitureTemplateInput["options"] = {}, dimensions = [800, 400, 1500]) => chineseCabinet({
  length: dimensions[0], width: dimensions[1], height: dimensions[2], material: "maple", options: { ...defaults, ...options },
});
const hashes = [
  "91337ce5bfc22b678214a7b7cefcaf9f36c70daf1ed80c67163ad1ae8711da97",
  "91337ce5bfc22b678214a7b7cefcaf9f36c70daf1ed80c67163ad1ae8711da97",
  "43c76494c6f43df189b4050b155738fe2b8ad346c30e2ed3938e30ea5b4bc2c6",
  "1ac854223e41f861bd2f52900ae58f2e97c2b570300e99fa6833779e62dfc1d1",
];

// Every historical pair has a construction diagnosis. This is not an overlap
// exemption: unknown pairs and reintroduced resolved pairs must fail below.
const diagnoses = new Map<string, string>();
const pairKey = (a: string, b: string) => [a, b].sort().join(" / ");
const register = (a: string, b: string, reason: string) => diagnoses.set(pairKey(a, b), reason);
for (const fb of ["front", "back"]) for (const lr of ["left", "right"]) {
  const post = `post-${fb}-${lr}`;
  for (const role of ["upper", "lower"]) {
    register(post, `${fb}-${role}-rail`, "outer-face rail stock");
    register(post, `${lr}-side-${role}-rail`, "outer-face rail stock");
    register(`${fb}-${role}-rail`, `${lr}-side-${role}-rail`, "rail corner stock");
  }
  for (const [skirt, spandrel] of [[fb, `${fb}-${lr}-x`], [lr, `${lr}-${fb}-z`]]) {
    register(post, `skirt-${skirt}`, "hoof/skirt clearance missing");
    register(post, `spandrel-${spandrel}`, "hoof/spandrel clearance missing");
    register(`skirt-${skirt}`, `spandrel-${spandrel}`, "duplicate decorative stock");
  }
}
for (const face of ["left-side", "right-side", "back"]) for (const role of ["upper", "lower"]) {
  register(`${face}-${role}-rail`, `${face}-panel`, "5mm panel groove missing");
}
for (const body of ["left-side", "right-side", "back"]) {
  register("divider-1", `layer1-drawer-${body}`, "drawer top clearance missing");
  register("bottom-board", `layer1-drawer-${body}`, "drawer bottom clearance missing");
}
register("bottom-board", "layer1-drawer-bottom", "drawer bottom clearance missing");
register("layer1-drawer-1-front", "layer1-drawer-1-pull", "horizontal pull on vertical face");
for (const lr of ["left", "right"]) register(`layer2-${lr}-door`, `layer2-${lr}-door-pull`, "horizontal pull on vertical face");

describe("cabinet construction versions", () => {
  it("retains the original 240-pair diagnosis registry including 16 outward proxy false positives", () => {
    expect(diagnoses.size).toBe(64);
    const hoofDecoration = [...diagnoses.values()].filter(reason => reason.startsWith("hoof/"));
    expect(hoofDecoration).toHaveLength(16);
    expect(diagnoses.size * 3 + (diagnoses.size - hoofDecoration.length)).toBe(240);
    const outward = findOverlaps(build({ legShape: "outward-hoof" }).parts);
    expect(outward.filter(o => diagnoses.get(pairKey(o.a, o.b))?.startsWith("hoof/"))).toEqual([]);
  });
  it("preserves the direct no-options legacy fingerprint", () => {
    const d = chineseCabinet({ length: 800, width: 400, height: 1500, material: "maple" });
    expect(createHash("sha256").update(JSON.stringify(d)).digest("hex")).toBe(hashes[0]);
  });
  it("detects missing, shallow and misplaced hoof cuts through the production collision checker", () => {
    const d = build({ constructionVersion: "2", legShape: "inward-hoof" });
    expect(findOverlaps(d.parts)).toEqual([]);
    for (const mutation of ["missing", "shallow", "shifted"]) {
      const broken = structuredClone(d.parts);
      const receiver = broken.find(p => p.id === "front-lower-rail")!;
      if (mutation === "missing") receiver.mortises = [];
      if (mutation === "shallow") receiver.mortises.forEach(m => m.depth /= 2);
      if (mutation === "shifted") receiver.mortises.forEach(m => m.origin.x += 5);
      expect(findOverlaps(broken).some(o => pairKey(o.a, o.b) === pairKey("front-lower-rail", "post-front-left")), mutation).toBe(true);
    }
  });
  it("warns and maintains positive box stock when thick dividers squeeze a drawer layer", () => {
    const d = build({ constructionVersion: "2", proportionStyle: "qing", layer2Type: "drawer", layer2HeightMm: 60 });
    for (const p of d.parts) expect(Math.min(...Object.values(p.visible)), p.id).toBeGreaterThan(0);
    expect(d.warnings?.some(w => w.includes("95mm"))).toBe(true);
  });
  it("offers an explicit opt-in with legacy default", () => {
    const spec = chineseCabinetOptions.find(o => o.key === "constructionVersion");
    expect(spec).toMatchObject({ group: "structure", label: "結構版本", type: "select", defaultValue: "1",
      choices: [{ value: "1", label: "原版" }, { value: "2", label: "修正版" }] });
  });
  variants.forEach((legShape, i) => {
    it(`classifies every legacy pair and requires no revised overlap: ${legShape}`, () => {
      const old = findOverlaps(build({ legShape }).parts);
      // The old symmetric hoof proxy falsely reported 16 outward decorative pairs.
      expect(old).toHaveLength(legShape === "box" || legShape === "outward-hoof" ? 48 : 64);
      expect(old.filter(o => !diagnoses.has(pairKey(o.a, o.b)))).toEqual([]);
      const d = build({ legShape, constructionVersion: "2" });
      const remaining = findOverlaps(d.parts);
      expect(remaining).toEqual([]);
      d.parts.push({ ...structuredClone(d.parts.find(p => p.id === "top")!), id: "cabinet-injected-collision" });
      expect(findOverlaps(d.parts).some(o => !diagnoses.has(pairKey(o.a, o.b)))).toBe(true);
    });
    it(`counts manufacturing setups rather than profile cutter primitives: ${legShape}`, () => {
      const d = build({ legShape, constructionVersion: "2" });
      const cuts = d.parts.flatMap(p => p.mortises.filter(m => m.label?.startsWith("馬蹄避讓")).map(m => `${p.id}:${m.label}`));
      expect(new Set(cuts).size).toBe(legShape === "auto" || legShape === "inward-hoof" ? 16 : 0);
      expect(d.parts.flatMap(p => p.mortises).filter(m => m.label === "板心槽 5mm")).toHaveLength(6);
      expect(d.parts.filter(p => p.nameZh.includes("連體牙頭"))).toHaveLength(4);
      if (cuts.length) expect(cuts.length).toBeGreaterThan(new Set(cuts).size);
    });
    it(`preserves the exact legacy ${legShape} fingerprint`, () => {
      for (const constructionVersion of [undefined, "1", "invalid"]) {
        const d = build({ legShape, ...(constructionVersion === undefined ? {} : { constructionVersion }) });
        expect(createHash("sha256").update(JSON.stringify(d)).digest("hex")).toBe(hashes[i]);
      }
    });
    it(`uses inside-post shoulders and separately counted tenons: ${legShape}`, () => {
      const d = build({ legShape, constructionVersion: "2" });
      const front = d.parts.find(p => p.id === "front-upper-rail")!;
      const side = d.parts.find(p => p.id === "left-side-upper-rail")!;
      // Ming posts = 35, tenons = round(35/2 - 2) = 16.
      expect(front.visible.length).toBe(730);
      expect(side.visible.length).toBe(330);
      expect(side.visible.width).toBe(25);
      expect(side.rotation?.y).toBe(Math.PI / 2);
      expect(calculateCutDimensions(front).length).toBe(762);
      expect(calculateCutDimensions(side).length).toBe(362);
      expect(d.overall).toEqual({ length: 800, width: 400, thickness: 1500 });
    });
    it(`clears actual 5mm panel grooves without changing panel blanks: ${legShape}`, () => {
      const legacy = build({ legShape });
      const d = build({ legShape, constructionVersion: "2" });
      for (const id of ["left-side-panel", "right-side-panel", "back-panel"]) {
        expect(d.parts.find(p => p.id === id)?.visible).toEqual(legacy.parts.find(p => p.id === id)?.visible);
        expect(findOverlaps(d.parts).filter(o => o.a === id || o.b === id)).toEqual([]);
      }
    });
    it(`fits the drawer box between the bottom and divider, and mounts pulls on the face: ${legShape}`, () => {
      const d = build({ legShape, constructionVersion: "2" });
      expect(findOverlaps(d.parts).filter(o => /drawer|door-pull/.test(`${o.a} ${o.b}`))).toEqual([]);
      const bottom = d.parts.find(p => p.id === "layer1-drawer-bottom")!;
      const side = d.parts.find(p => p.id === "layer1-drawer-left-side")!;
      const divider = d.parts.find(p => p.id === "divider-1")!;
      expect(bottom.origin.y).toBe(116); // lower rail top 95 + bottom board 18 + gap 3
      expect(side.origin.y).toBe(122); // 6mm drawer bottom
      expect(side.origin.y + side.visible.thickness).toBeCloseTo(divider.origin.y - 3);
    });
    it(`proves all six groove cutters and rejects missing, shallow, shifted cuts: ${legShape}`, () => {
      const d = build({ legShape, constructionVersion: "2" });
      for (const face of ["left-side", "right-side", "back"]) for (const role of ["upper", "lower"]) {
        const rail = d.parts.find(p => p.id === `${face}-${role}-rail`)!;
        const panel = d.parts.find(p => p.id === `${face}-panel`)!;
        const cut = rail.mortises.find(m => m.label === "板心槽 5mm")!;
        expect(cut.depth).toBe(5);
        const box = mortiseLocalBox(rail, cut);
        expect(box.depthAxis).toBe("y");
        expect(box.hy).toBe(2.5);
        expect(box.hx * 2).toBeCloseTo(face === "back" ? 730 : 330, 6);
        expect(box.hz * 2).toBeCloseTo(12.5, 6);
        expect(box.cy + rail.visible.thickness / 2).toBe(role === "upper" ? 2.5 : 42.5);
        for (const mutation of ["missing", "shallow", "shifted", "wrong-face", "narrow"]) {
          const broken = structuredClone(rail);
          const m = broken.mortises.find(m => m.label === "板心槽 5mm")!;
          if (mutation === "missing") broken.mortises = [];
          if (mutation === "shallow") m.depth = 4;
          if (mutation === "shifted") m.origin.z += 2;
          if (mutation === "wrong-face") m.origin.y = role === "upper" ? 45 : 0;
          if (mutation === "narrow") m.width = 10;
          expect(findOverlaps([broken, panel]), `${face}/${role}/${mutation}`).toHaveLength(1);
        }
      }
    });
  });

  it("carves integral spandrels from four skirt blanks instead of duplicating stock", () => {
    const d = build({ constructionVersion: "2", legShape: "box" });
    expect(d.parts.filter(p => p.id.startsWith("spandrel-"))).toHaveLength(0);
    expect(d.parts.filter(p => p.id.startsWith("skirt-"))).toHaveLength(4);
    for (const p of d.parts.filter(p => p.id.startsWith("skirt-"))) {
      expect(p.shape?.kind).toBe("face-rounded");
      if (p.shape?.kind === "face-rounded") expect(p.visible.thickness - (p.shape.bottomArchMm ?? 0)).toBeGreaterThanOrEqual(18);
    }
    expect(d.notes).toContain("576000");
  });

  for (const [cabinetPreset, hash] of [
    ["round-cabinet", "2f60571b8113b0ac562f2ee078c78103ac10f8908a86d29907f53a7a06268da3"],
    ["top-cabinet", "e1bc49aee1607192c75cfe35328bafef0cc05601c1de9bc9fb531953d23479d7"],
  ]) {
    it(`retains the legacy ${cabinetPreset} fingerprint`, () => {
      const d = chineseCabinet({ length: 900, width: 500, height: 1800, material: "maple", options: { cabinetPreset } });
      expect(createHash("sha256").update(JSON.stringify(d)).digest("hex")).toBe(hash);
    });
    for (const dimensions of [[900, 500, 1800], [1000, 550, 2000]]) {
      it(`clears ${cabinetPreset} frame/panel intersections at ${dimensions.join("x")}`, () => {
        const d = build({ cabinetPreset, constructionVersion: "2", legShape: "box" }, dimensions);
        const rakedRails = d.parts.filter(p => p.id.endsWith("-rail") && p.shape?.kind === "mitered-ends" && p.shape.vertices);
        expect(rakedRails).toHaveLength(cabinetPreset === "round-cabinet" ? 8 : 0);
        expect(d.parts.filter(p => p.nameZh.includes("連體牙頭"))).toHaveLength(cabinetPreset === "round-cabinet" ? 0 : 4);
        expect(findOverlaps(d.parts)).toEqual([]);
        for (const rail of d.parts.filter(p => p.mortises.some(m => m.label === "板心槽 5mm"))) {
          const panelId = rail.id.replace(/-(upper|lower)-rail$/, "-panel");
          for (const mutation of ["missing", "shallow"]) {
            const broken = structuredClone(d.parts);
            const target = broken.find(p => p.id === rail.id)!;
            if (mutation === "missing") target.mortises = target.mortises.filter(m => m.label !== "板心槽 5mm");
            else target.mortises.filter(m => m.label === "板心槽 5mm").forEach(m => m.depth = 4);
            expect(findOverlaps(broken).some(o => pairKey(o.a, o.b) === pairKey(rail.id, panelId)), `${rail.id}/${mutation}`).toBe(true);
          }
        }
        expect(d.overall).toEqual({ length: dimensions[0], width: dimensions[1], thickness: dimensions[2] });
      });
    }
  }
  it("fits the optional top-box drawer inside the back panel", () => {
    const d = build({ cabinetPreset: "top-cabinet", topBoxLayers: 2, constructionVersion: "2", legShape: "box" }, [1000, 550, 2000]);
    expect(findOverlaps(d.parts)).toEqual([]);
    for (const post of d.parts.filter(p => p.id.startsWith("tb-post-"))) expect(post.mortises).toHaveLength(4);
  });
  it("machines divider corners for the 3-degree round cabinet without changing blanks", () => {
    const options = { cabinetPreset: "round-cabinet", splayAngle: 3 };
    const d = build({ ...options, constructionVersion: "2" }, [1000, 550, 2000]);
    const old = build(options, [1000, 550, 2000]);
    for (const divider of d.parts.filter(p => p.id.startsWith("divider-"))) {
      expect(divider.visible).toEqual(old.parts.find(p => p.id === divider.id)?.visible);
      expect(divider.mortises.some(m => m.cosmetic)).toBe(true);
    }
    expect(findOverlaps(d.parts).filter(o => o.a.startsWith("post-") || o.b.startsWith("post-"))).toEqual([]);
  });

  for (const dimensions of [[600, 300, 900], [1100, 550, 2000]]) for (const legShape of variants) {
    it(`checks nondefault dimensions ${dimensions.join("x")} / ${legShape}`, () => {
      const options = { legShape, proportionStyle: "free", postSize: 50, railWidth: 65, railThickness: 30, panelThickness: 15 };
      const d = build({ ...options, constructionVersion: 2 }, dimensions);
      const old = build(options, dimensions);
      for (const p of d.parts) expect(Math.min(...Object.values(p.visible)), p.id).toBeGreaterThan(0);
      for (const id of ["left-side-panel", "right-side-panel", "back-panel", "top", "bottom-board"]) {
        expect(d.parts.find(p => p.id === id)?.visible).toEqual(old.parts.find(p => p.id === id)?.visible);
      }
      const front = d.parts.find(p => p.id === "front-upper-rail")!;
      const side = d.parts.find(p => p.id === "left-side-upper-rail")!;
      expect(front.visible.length).toBe(dimensions[0] - 100);
      expect(side.visible.length).toBe(dimensions[1] - 100);
      expect(calculateCutDimensions(front).length).toBe(dimensions[0] - 60);
      expect(calculateCutDimensions(side).length).toBe(dimensions[1] - 60);
      expect(findOverlaps(d.parts)).toEqual([]);
    });
  }
});
