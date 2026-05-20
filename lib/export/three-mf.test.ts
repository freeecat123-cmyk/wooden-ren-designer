/**
 * lib/export/three-mf.ts 驗證腳本
 * 跑法：npx tsx lib/export/three-mf.test.ts
 */
import { BoxGeometry, Group, Mesh, MeshBasicMaterial } from "three";
import { groupToModelXml } from "./three-mf";

let failed = 0;
function check(name: string, cond: boolean) {
  if (cond) console.log(`✅ ${name}`);
  else {
    console.error(`❌ ${name}`);
    failed++;
  }
}

// --- groupToModelXml ---
const g = new Group();
const m = new Mesh(new BoxGeometry(10, 20, 30), new MeshBasicMaterial());
m.name = "測試板";
g.add(m);
const xml = groupToModelXml(g);

check("含 XML 宣告", xml.startsWith("<?xml"));
check("model unit=millimeter", xml.includes('unit="millimeter"'));
check("object 帶零件中文名", xml.includes('name="測試板"'));
check("BoxGeometry → 24 個 vertex", (xml.match(/<vertex /g) ?? []).length === 24);
check("BoxGeometry → 12 個 triangle", (xml.match(/<triangle /g) ?? []).length === 12);
check("含 build / item", xml.includes("<build>") && xml.includes("<item "));

// XML 跳脫：名稱含 & < 要跳脫
const g2 = new Group();
const m2 = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
m2.name = 'A&B<C>';
g2.add(m2);
const xml2 = groupToModelXml(g2);
check("零件名 XML 跳脫", xml2.includes("A&amp;B&lt;C&gt;") && !xml2.includes("A&B<C>"));

if (failed > 0) {
  console.error(`\n${failed} 個測試失敗`);
  process.exit(1);
}
console.log("\n全部通過");
