import { expect, it } from "vitest";
import { chineseCabinet } from "@/lib/templates/chinese-cabinet";
import { clearedByHoofSections } from "./hoof-clearance";
import { findOverlaps } from "./overlap";
import { mortiseLocalBox } from "@/lib/render/svg-views";

for (const legShape of ["auto", "inward-hoof", "outward-hoof"]) for (const hoofMm of [80, 140]) {
  it(`continuous hoof clipping: ${legShape}/${hoofMm}`, () => {
    const design = chineseCabinet({ length: 800, width: 400, height: 1500, material: "maple",
      options: { constructionVersion: "2", legShape, hoofMm, hoofScale: hoofMm === 80 ? 1.35 : 1.6 } });
    const posts = design.parts.filter(p => p.shape?.kind === "hoof");
    const receivers = design.parts.filter(p => p.id.startsWith("skirt-") || p.id.endsWith("lower-rail"));
    for (const post of posts) for (const receiver of receivers) {
      expect(clearedByHoofSections(post, receiver), `${post.id}/${receiver.id}`).toBe(true);
    }
    expect(findOverlaps(design.parts).filter(p => posts.some(post => post.id === p.a || post.id === p.b)
      && receivers.some(r => r.id === p.a || r.id === p.b))).toEqual([]);
    if (legShape === "outward-hoof") return;
    const post = posts.find(p => p.id === "post-front-left")!;
    const receiver = receivers.find(p => p.id === "front-lower-rail")!;
    expect(clearedByHoofSections({ ...post, id: "generic-shaped-stock" }, { ...receiver, id: "generic-receiver" })).toBe(true);
    for (const mutation of ["missing", "shallow", "shifted"] as const) {
      const broken = structuredClone(receiver);
      if (mutation === "missing") broken.mortises = [];
      if (mutation === "shallow") broken.mortises.forEach(m => m.depth /= 2);
      if (mutation === "shifted") broken.mortises.forEach(m => m.origin.x += 5);
      expect(clearedByHoofSections(post, broken), mutation).toBe(false);
      expect(findOverlaps([post, broken]).length, mutation).toBe(1);
    }
    expect(clearedByHoofSections({ ...post, rotation: { x: 0.01, y: 0, z: 0 } }, receiver)).toBe(false);
    const gapY = receiver.origin.y + receiver.visible.thickness * 0.53;
    const gap = { ...receiver, mortises: receiver.mortises.filter(m => {
      const b = mortiseLocalBox(receiver, m), half = b.rotZ ? b.hx : b.hy;
      const center = receiver.origin.y + receiver.visible.thickness / 2 + b.cy;
      return Math.abs(gapY - center) > half;
    }) };
    expect(clearedByHoofSections(post, gap), "intermediate missing band").toBe(false);
  });
}
