/**
 * connection-marks 單元測試
 *
 * 跑法：`npx tsx lib/render/part-drawing/connection-marks.test.ts`
 *
 * 用簡單方凳 fixture 驗證 inferConnectionMarks 的距端/距頂結果。
 */

import { inferConnectionMarks } from "./connection-marks";
import type { FurnitureDesign, Part } from "@/lib/types";

let pass = 0, fail = 0;
const errors: string[] = [];

function assertNear(actual: number, expected: number, tol: number, label: string) {
  if (Math.abs(actual - expected) <= tol) {
    pass++;
  } else {
    fail++;
    errors.push(`${label}: expected ${expected} (±${tol}), got ${actual}`);
  }
}

function assertEq<T>(actual: T, expected: T, label: string) {
  if (actual === expected) pass++;
  else {
    fail++;
    errors.push(`${label}: expected ${String(expected)}, got ${String(actual)}`);
  }
}

// 方凳 fixture：腳 35×35×425，4 支在 ±x ±z；
// 前後牙條（apron-front / apron-back）連接左右腳的頂部；
// 上下橫撐（stretcher-low）跨左右腳近底部。
function makeStool(): FurnitureDesign {
  const legSize = 35;
  const legH = 425;
  const seatW = 350; // 寬（X）
  const seatD = 300; // 深（Z）
  const apronT = 18;
  const apronH = 60;
  const apronY = legH - apronH - 20; // 牙條頂下沉 20mm
  // 腳中心 X = ±(seatW/2 - legSize/2)
  const halfX = seatW / 2 - legSize / 2;
  const halfZ = seatD / 2 - legSize / 2;

  const makeLeg = (id: string, sx: number, sz: number): Part => ({
    id,
    nameZh: id,
    material: "white-oak",
    grainDirection: "length",
    visible: { length: legSize, width: legSize, thickness: legH },
    // length=X、thickness=Y、width=Z（unrotated）。腳要立起來 → rotation.z = -π/2
    // 旋轉後 worldExtents：xExt=thickness=425, yExt=length=35, zExt=width=35。
    // 為了測單純情況，這裡用「未旋轉」+ length 軸放垂直軸概念已經被旋轉成 X。
    // 改成 leg 直接以 visible.thickness 當高度，不旋轉，origin.y=0。
    // 但 worldExtents：xExt=length=35, yExt=thickness=425, zExt=width=35 ✓
    origin: { x: sx * halfX, y: 0, z: sz * halfZ },
    tenons: [],
    mortises: [],
  });

  const legFL = makeLeg("leg-FL", -1, -1);
  const legFR = makeLeg("leg-FR", +1, -1);
  const legBL = makeLeg("leg-BL", -1, +1);
  const legBR = makeLeg("leg-BR", +1, +1);

  // Apron 前後：X 跨整個 seat，Y 在 apronY，Z 在 ±halfZ（緊貼腳外側）
  // length=X、thickness=Y、width=Z；apron 沿 X 跑 → length=seatW、thickness=apronH、width=apronT
  // 注意：apronH = 60 用作 thickness（垂直）；apronT = 18 用作 width（前後深度）
  const apronFront: Part = {
    id: "apron-front",
    nameZh: "前牙條",
    material: "white-oak",
    grainDirection: "length",
    visible: { length: seatW - legSize, width: apronT, thickness: apronH },
    origin: { x: 0, y: apronY, z: -halfZ },
    tenons: [],
    mortises: [],
  };

  // 下橫撐前後（接 leg 近底部）
  const stretcherFront: Part = {
    id: "stretcher-front",
    nameZh: "前橫撐",
    material: "white-oak",
    grainDirection: "length",
    visible: { length: seatW - legSize, width: 25, thickness: 25 },
    origin: { x: 0, y: 80, z: -halfZ },
    tenons: [],
    mortises: [],
  };

  return {
    id: "test-stool",
    category: "stool",
    nameZh: "test",
    overall: { length: seatW, width: seatD, thickness: legH },
    parts: [legFL, legFR, legBL, legBR, apronFront, stretcherFront],
    defaultJoinery: "blind-tenon",
    primaryMaterial: "white-oak",
  };
}

// 測試 1：legFL 應該被 apron-front + stretcher-front 標到（兩個 sibling 都跨到 leg）
const design = makeStool();
const legFL = design.parts.find((p) => p.id === "leg-FL")!;
const marks = inferConnectionMarks(legFL, design);

assertEq(marks.length, 2, "legFL marks count");

const apronMark = marks.find((m) => m.siblingId === "apron-front");
assertEq(apronMark !== undefined, true, "legFL has apron-front mark");
if (apronMark) {
  // apron world Y 中心 = apronY + apronH/2 = 345+30 = 375
  // leg local Y = world Y − (0 + 425/2) = 375 − 212.5 = 162.5
  assertNear(apronMark.localY, 162.5, 1, "apron localY (center of apron in leg)");
  // 距頂端（local -T/2 = -212.5）：localY - (-212.5) = 375
  assertNear(apronMark.distanceFromTop, 375, 1, "apron distanceFromTop");
  assertEq(apronMark.kind, "apron", "apron kind classification");
}

const strMark = marks.find((m) => m.siblingId === "stretcher-front");
assertEq(strMark !== undefined, true, "legFL has stretcher-front mark");
if (strMark) {
  // stretcher Y 中心 = 80 + 25/2 = 92.5；local Y = 92.5 - 212.5 = -120
  assertNear(strMark.localY, -120, 1, "stretcher localY");
  // 距頂 = -120 - (-212.5) = 92.5
  assertNear(strMark.distanceFromTop, 92.5, 1, "stretcher distanceFromTop");
  assertEq(strMark.kind, "stretcher", "stretcher kind classification");
}

// 測試 2：兩支腳互相不應該標
const legFR = design.parts.find((p) => p.id === "leg-FR")!;
const legSelf = inferConnectionMarks(legFR, design);
const hasLegToLeg = legSelf.some((m) => m.siblingId.startsWith("leg-"));
assertEq(hasLegToLeg, false, "leg should not mark other legs");

// 測試 3：放寬 filter 後改成對稱 — apron 也應該標到接合的兩支 leg
// （legFL/legFR 跟 apron-front 在 z=-halfZ 共面、AABB 相交體積 > 100mm³）
// 這支援 P-02 牙板零件圖也能秀「接腳」紅虛線輪廓
const apron = design.parts.find((p) => p.id === "apron-front")!;
const apronMarks = inferConnectionMarks(apron, design);
const apronLegs = apronMarks.filter((m) => m.siblingId.startsWith("leg-"));
assertEq(apronLegs.length, 2, "apron should mark the 2 legs it joins (legFL + legFR)");
const apronLegIds = new Set(apronLegs.map((m) => m.siblingId));
assertEq(apronLegIds.has("leg-FL"), true, "apron marks leg-FL");
assertEq(apronLegIds.has("leg-FR"), true, "apron marks leg-FR");

// 測試 4：新放寬 filter — 加 sibling 沒被任何軸完全包覆的場景（橫撐跨多腳 / 牙條跨腳）
// 用同一 fixture 確認交集體積 filter 沒有漏掉這類「partial overlap」鄰件。
{
  const legFLMarks = inferConnectionMarks(legFL, design);
  const ids = new Set(legFLMarks.map((m) => m.siblingId));
  assertEq(ids.has("apron-front"), true, "legFL marks contain apron-front (partial overlap path)");
  assertEq(ids.has("stretcher-front"), true, "legFL marks contain stretcher-front");
}

// 測試 5：mark size 合理（不為 0、不超過 leg 截面）
if (apronMark) {
  // sizeY = apron 在 leg 上吃進的 Y 區間長度 = apronH 與 leg Y 區段交集 = 60
  assertNear(apronMark.sizeY, 60, 1, "apron mark sizeY");
  // sizeX = 在 leg local X 軸方向的交集 = legSize/2 = 17.5（apron 從 leg 中心吃到外緣）
  assertNear(apronMark.sizeX, 17.5, 1, "apron mark sizeX");
}

console.log(`\nconnection-marks tests: ${pass} passed, ${fail} failed`);
if (fail > 0) {
  for (const e of errors) console.log("  FAIL: " + e);
  process.exit(1);
}
