import type { FurnitureDesign, Part } from "@/lib/types";

/**
 * Strip mortise/tenon joinery from a design and replace it with
 * pocket-hole / screw+glue assembly. Geometry (part positions, sizes,
 * rotations) stays identical — only the joinery metadata is swapped.
 *
 * Our templates already size legs so that `visible.thickness` equals
 * the assembled leg height (the tenon is extra cut length beyond the
 * visible body — it lives inside the top/seat panel's mortise). So we
 * just drop tenons/mortises; cut lengths naturally shrink to the visible
 * dimension because the cut calculator adds tenon length on top.
 */
export function toBeginnerMode(design: FurnitureDesign): FurnitureDesign {
  // Normal mode keeps apron visible.length spanning leg center to leg center
  // (so the tenon portion is visually represented in the three-view). For a
  // butt-joined beginner build, shrink aprons by one legSize (half each end)
  // so they stop at the leg inner face.
  const legPart = design.parts.find(
    (p) => /^leg-/.test(p.id) && p.visible.length === p.visible.width,
  );
  const legSize = legPart ? legPart.visible.length : 0;

  // 只有真正「接腳」的零件（牙板、橫撐、背橫木）才需要縮短；
  // 櫃體的側板、層板、zone 分隔板、抽屜箱、門框 等都是面板對面板接合，
  // 長度已經是正確的內部尺寸，不能再縮——否則會比櫃體內高少 legSize，
  // 在 3D 看起來到處有縫、分解。
  const isApronLike = (id: string): boolean =>
    /^apron/.test(id) ||
    /^stretcher/.test(id) ||
    /^ls-/.test(id) ||
    id === "center-stretcher" ||
    id === "back-rail" ||
    id === "back-top-rail";

  const parts: Part[] = design.parts.map((p) => {
    const hasEndTenons = p.tenons.some(
      (t) => t.position === "start" || t.position === "end",
    );
    const shouldShrink =
      hasEndTenons &&
      isApronLike(p.id) &&
      legSize > 0 &&
      p.visible.length > legSize;
    const visible = shouldShrink
      ? { ...p.visible, length: p.visible.length - legSize }
      : p.visible;
    return {
      ...p,
      visible,
      tenons: [],
      mortises: [],
    };
  });

  return {
    ...design,
    parts,
    defaultJoinery: "pocket-hole",
    notes:
      (design.notes ? design.notes + "\n\n" : "") +
      "【組裝版】不含榫卯，用螺絲 / 木釘 / DOMINO / 斜孔系統擇一或混用 + 木工白膠組裝。" +
      "建議工具：斜孔器夾具、木板打孔定位器、電鑽、鑽頭組、PVA 木工膠、F 型夾具、砂紙。" +
      "施作速度約為榫接版的 3–5 倍，結構強度約榫接版的 60–70%，日常家具使用足夠、重載或傳承級作品仍建議榫接。",
  };
}
