import type { FurnitureDesign, MaterialId, Part } from "@/lib/types";

/** PDF 15 A-A: 70mm flat, tangent R15/R15 rise of 20mm, mirrored. */
export function certB1FrontProfile(): Array<[number, number]> {
  const r = 15, rise = 20, angle = Math.acos(1 - rise / (2 * r));
  const left: Array<[number, number]> = [[-173, 30], [-103, 30]];
  for (let i = 1; i <= 24; i++) {
    const t = angle * i / 24;
    left.push([-103 + r * Math.sin(t), 30 - r * (1 - Math.cos(t))]);
  }
  const xMid = -103 + r * Math.sin(angle);
  for (let i = 1; i <= 24; i++) {
    const t = angle * (1 - i / 24);
    left.push([xMid + r * (Math.sin(angle) - Math.sin(t)), 10 + r * (1 - Math.cos(t))]);
  }
  return [...left, ...left.toReversed().map(([x, z]): [number, number] => [-x, z]), [173, -30], [-173, -30]];
}

/** Fixed blank assembly. Joinery not yet verified is deliberately not invented. */
export function certB1Assembly(): FurnitureDesign {
  const parts: Part[] = [];
  function board(id: string, nameZh: string, l: number, w: number, t: number, x: number, y: number, z: number,
    rotation?: Part["rotation"], material: MaterialId = "pine") {
    const p: Part = { id, nameZh, material, grainDirection: "length", visible: { length: l, width: w, thickness: t },
      origin: { x, y, z }, rotation, tenons: [], mortises: [] };
    parts.push(p);
    return p;
  }
  const upright = { x: Math.PI / 2, y: 0, z: 0 };
  const sideways = { x: Math.PI / 2, y: Math.PI / 2, z: 0 };
  board("top-core", "桌面木心板", 434, 434, 18, 0, 432, 0, undefined, "blockboard-primary");
  // Butt-ended edging is an assembly choice; the official sections give 8mm, not corner sequencing.
  for (const s of [-1, 1]) {
    board(`top-edge-x-${s}`, "桌面左右封邊（角接待核）", 434, 8, 18, s * 221, 432, 0, { x: 0, y: Math.PI / 2, z: 0 });
    board(`top-edge-z-${s}`, "桌面前後封邊（角接待核）", 450, 8, 18, 0, 432, s * 221);
  }
  for (const x of [-1, 1]) for (const z of [-1, 1]) {
    const p = board(`leg-${x}-${z}`, "腳柱（榫孔待核）", 32, 432, 45, x * 189, 0, z * 182.5, upright);
    p.grainDirection = "width";
  }
  for (const s of [-1, 1]) {
    board(`side-rail-${s}`, "側板（接合待核）", 320, 105, 18, s * 187, 327, 0, sideways, "blockboard-primary");
    board(`runner-${s}`, "抽屜滑條（長度待核）", 320, 14, 15, s * 170.5, 373, 0, sideways);
  }
  board("back-rail", "後板（接合位置待核）", 346, 105, 18, 0, 327, 186, upright, "blockboard-primary");
  const rail = board("front-rail", "前曲線橫檔（榫頭待核）", 346, 60, 18, 0, 265, -186, upright);
  rail.shape = { kind: "edge-profile", style: "kunmen", depthMm: 20, profilePoints: certB1FrontProfile() };
  rail.mortises.push({ origin: { x: 0, y: 3, z: -30 }, length: 346, width: 6, depth: 4,
    through: false, cosmetic: true, label: "前橫檔上緣 6×4 凹口" });
  const front = board("drawer-front", "抽屜前板（鳩尾接合待核）", 340, 103, 18, 0, 327, -186, upright);
  front.mortises.push({ origin: { x: 0, y: 0, z: 0 }, length: 20, width: 20, depth: 18,
    through: true, cosmetic: true, shape: "round", label: "中央 Ø20 指孔" });
  front.mortises.push({ origin: { x: 0, y: 18, z: 38.5 }, length: 324, width: 4, depth: 7,
    through: false, cosmetic: true, label: "底板槽（深度待核）" });
  board("drawer-back", "抽屜後板（鳩尾接合待核）", 340, 80, 15, 0, 342, 147.5, upright);
  for (const s of [-1, 1]) {
    // Blanks stop at the front inner face until asymmetric front/rear dovetails are verified.
    const side = board(`drawer-side-${s < 0 ? "left" : "right"}`, "抽屜側板（端部鳩尾待核）", 332, 100, 15, s * 162.5, 327, -11, sideways);
    side.mortises.push({ origin: { x: 0, y: s < 0 ? 15 : 0, z: 37 }, length: 332, width: 4, depth: 7,
      through: false, cosmetic: true, label: "4mm 底板槽，深 7mm" });
    side.mortises.push({ origin: { x: 0, y: s < 0 ? 0 : 15, z: -2.5 }, length: 332, width: 15, depth: 8,
      through: false, cosmetic: true, label: "滑條槽 15mm，深 8mm" });
  }
  board("drawer-bottom", "抽屜合板底（前槽深度待核）", 324, 339, 4, 0, 338, -14.5, undefined, "plywood-primary");
  return { id: "cert-b1-assembly", category: "side-table", nameZh: "乙級第一題板件核對模型",
    overall: { length: 450, width: 450, thickness: 450 }, parts, primaryMaterial: "pine", defaultJoinery: "blind-tenon",
    joineryOnly: true, useButtJointConvention: true,
    warnings: ["未完成施工驗證：鳩尾榫、框架榫孔、木釘與螺釘位置、腳底倒角尚待完成。",
      "封邊角接順序、滑條長度、後板位置與前板底槽深度暫為組裝假設，不能作為官方尺寸或切料依據。",
      "抽屜側板與後板仍為待加工毛坯，交疊處不代表已完成鳩尾接合。"] };
}
