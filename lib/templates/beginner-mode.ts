import type { FurnitureDesign, Part } from "@/lib/types";

/**
 * Strip mortise/tenon joinery from a design — produce「組裝版」for users who
 * assemble with screws / pocket-hole / dowels instead of cutting joinery.
 *
 * Geometry stays identical: all templates use `useButtJointConvention=true`
 * meaning `visible.length` is already the端面對接 length (drafting-math.md §A10).
 * Just drop tenons/mortises and rename / annotate.
 *
 * Legacy 縮短邏輯（依 leg shape 沿 Y 反向縮短 apron）已廢除——所有模板已遷
 * 移到 butt-joint 慣例（§A10），visible 即組裝版幾何，不需補償。
 *
 * 缺 useButtJointConvention 的舊模板會 fall through 直接 strip——可能會有
 * tenon/mortise 失配的視覺 bug，但目前 26 個模板都已遷移。
 */
export function toBeginnerMode(design: FurnitureDesign): FurnitureDesign {
  const parts: Part[] = design.parts.map((p) => ({
    ...p,
    tenons: [],
    mortises: [],
  }));

  // 組裝版改名：鳩尾盒 → 木盒（鳩尾是榫接版本才有的稱呼）
  const beginnerNameMap: Record<string, string> = {
    鳩尾盒: "木盒",
  };
  const newNameZh = beginnerNameMap[design.nameZh] ?? design.nameZh;

  return {
    ...design,
    parts,
    nameZh: newNameZh,
    defaultJoinery: "pocket-hole",
    notes:
      (design.notes ? design.notes + "\n\n" : "") +
      "【組裝版】不含榫卯，用螺絲 / 木釘 / DOMINO / 斜孔系統擇一或混用 + 木工白膠組裝。" +
      "建議工具：斜孔器夾具、木板打孔定位器、電鑽、鑽頭組、PVA 木工膠、F 型夾具、砂紙。" +
      "施作速度約為榫接版的 3–5 倍，結構強度約榫接版的 60–70%，日常家具使用足夠、重載或傳承級作品仍建議榫接。",
  };
}
