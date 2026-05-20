/**
 * lib/export/export-checks.ts 驗證腳本
 * 跑法：npx tsx lib/export/export-checks.test.ts
 */
import type { FurnitureDesign } from "@/lib/types";
import { analyzeMinThickness } from "./export-checks";
import { validateGeometry, validateGroup } from "./export-checks";
import { BoxGeometry, BufferGeometry, Float32BufferAttribute, Group, Mesh, MeshBasicMaterial } from "three";

let failed = 0;
function check(name: string, cond: boolean) {
  if (cond) console.log(`✅ ${name}`);
  else {
    console.error(`❌ ${name}`);
    failed++;
  }
}

// --- analyzeMinThickness ---
const fakeDesign = {
  parts: [
    { id: "leg", nameZh: "腳", visible: { length: 400, width: 35, thickness: 35 } },
    { id: "seat", nameZh: "座板", visible: { length: 300, width: 300, thickness: 18 } },
    { id: "drawer-bottom", nameZh: "抽屜底板", visible: { length: 280, width: 200, thickness: 3 } },
    { id: "glass", nameZh: "玻璃", visual: true, visible: { length: 5, width: 5, thickness: 1 } },
  ],
} as unknown as FurnitureDesign;

const r1 = analyzeMinThickness(fakeDesign, 1);
check("最薄件取最小維度（抽屜底板 3mm）", r1.thinnestMm === 3 && r1.partName === "抽屜底板");

const r2 = analyzeMinThickness(fakeDesign, 0.1);
check("套用 scale 0.1（3mm → 0.3mm）", Math.abs(r2.thinnestMm - 0.3) < 1e-9);

check("跳過 visual 五金件（玻璃不算）", analyzeMinThickness(fakeDesign, 1).partName !== "玻璃");

const empty = { parts: [] } as unknown as FurnitureDesign;
check("空零件回 Infinity", analyzeMinThickness(empty, 1).thinnestMm === Infinity);

// --- validateGeometry ---
// 封閉方塊（原生 BoxGeometry 角點頂點是分開的，validateGeometry 內部會先 mergeVertices）
const boxV = validateGeometry(new BoxGeometry(10, 10, 10));
check("BoxGeometry 是水密流形", boxV.ok && boxV.nonManifoldEdges === 0 && boxV.nanVertices === 0);

// 單一開放三角面 → 3 條邊各只被 1 面共用 → 3 條非流形邊
const openTri = new BufferGeometry();
openTri.setAttribute("position", new Float32BufferAttribute([0, 0, 0, 10, 0, 0, 0, 10, 0], 3));
const triV = validateGeometry(openTri);
check("開放三角面有 3 條非流形邊", triV.nonManifoldEdges === 3 && !triV.ok);

// NaN 頂點
const nanGeo = new BufferGeometry();
nanGeo.setAttribute("position", new Float32BufferAttribute([0, 0, 0, NaN, 0, 0, 0, 10, 0], 3));
check("偵測到 NaN 頂點", validateGeometry(nanGeo).nanVertices >= 1);

// --- validateGroup ---
const goodGroup = new Group();
const m = new MeshBasicMaterial();
const okMesh = new Mesh(new BoxGeometry(5, 5, 5), m);
okMesh.name = "好零件";
goodGroup.add(okMesh);
check("validateGroup：全封閉零件 ok", validateGroup(goodGroup).ok);

const badGroup = new Group();
const badTri = new BufferGeometry();
badTri.setAttribute("position", new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3));
const badMesh = new Mesh(badTri, m);
badMesh.name = "破面零件";
badGroup.add(badMesh);
const badResult = validateGroup(badGroup);
check(
  "validateGroup：破面零件回報 badParts",
  !badResult.ok && badResult.badParts.length === 1 && badResult.badParts[0].partName === "破面零件",
);

// --- 收尾 ---
if (failed > 0) {
  console.error(`\n${failed} 個測試失敗`);
  process.exit(1);
}
console.log("\n全部通過");
