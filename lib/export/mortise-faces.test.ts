/**
 * lib/export/mortise-faces.ts 驗證腳本
 * 跑法：npx tsx lib/export/mortise-faces.test.ts
 *
 * 手算基準：一支腳 length=450(X) × width=30(Z) × thickness=30(Y)，
 * local 置中 x∈[-225,225] y∈[-15,15] z∈[-15,15]。
 * front view (u,v)=(-x, y+15) → outline bbox u∈[-225,225] v∈[0,30]，w=450 h=30。
 */
import { partMachiningFaces } from "./mortise-faces";
import type { Part } from "@/lib/types";

let failed = 0;
function check(name: string, cond: boolean) {
  if (cond) console.log(`✅ ${name}`);
  else {
    console.error(`❌ ${name}`);
    failed++;
  }
}
const near = (a: number, b: number, eps = 0.5) => Math.abs(a - b) < eps;

function leg(mortises: Part["mortises"]): Part {
  return {
    id: "leg",
    nameZh: "腳",
    visible: { length: 450, width: 30, thickness: 30 },
    origin: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    tenons: [],
    mortises,
  } as unknown as Part;
}

// --- 案例 1：+Z 面盲榫（牙板進腳的內側面）---
// origin z=15 貼 +Z 面、y=15 厚度中線、x=100 沿長度；depth 15 盲榫；孔 40×20
const f1 = partMachiningFaces(leg([
  { origin: { x: 100, y: 15, z: 15 }, depth: 15, length: 40, width: 20, through: false } as unknown as Part["mortises"][number],
]));
check("案例1：只有 1 個加工面", f1.length === 1);
check("案例1：面是正面(front)", f1[0]?.faceKey === "front");
check("案例1：外框 450×30", near(f1[0].w, 450) && near(f1[0].h, 30));
check("案例1：1 個榫孔、rect、盲榫", f1[0].holes.length === 1 && f1[0].holes[0].kind === "rect" && f1[0].holes[0].through === false);
{
  const pts = f1[0].holes[0].pts!;
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  const w = Math.max(...xs) - Math.min(...xs);
  const h = Math.max(...ys) - Math.min(...ys);
  const cx = (Math.max(...xs) + Math.min(...xs)) / 2;
  const cy = (Math.max(...ys) + Math.min(...ys)) / 2;
  check("案例1：榫孔尺寸 40×20", near(w, 40) && near(h, 20));
  // 榫孔在外框內（含 5mm margin 前的框內；此處點是 margin 前座標，範圍 [0,450]/[0,30]）
  check("案例1：榫孔落在外框範圍內", Math.min(...xs) >= 0 && Math.max(...xs) <= 450 && Math.min(...ys) >= 0 && Math.max(...ys) <= 30);
  // 厚度方向置中（y 中線 = 15）
  check("案例1：榫孔厚度置中 y≈15", near(cy, 15));
  // front view 翻 X：origin.x=+100 → 中心左移 100 → cx≈125（部件中心 225）
  check("案例1：榫孔沿長度位置 x≈125", near(cx, 125));
}

// --- 案例 2：通榫（through）→ 出兩面（正面 + 背面），背面鏡射 ---
const f2 = partMachiningFaces(leg([
  { origin: { x: 100, y: 15, z: 15 }, depth: 30, length: 40, width: 20, through: true } as unknown as Part["mortises"][number],
]));
check("案例2：通榫出 2 個加工面", f2.length === 2);
const front2 = f2.find((f) => f.faceKey === "front");
const back2 = f2.find((f) => f.faceKey === "back");
check("案例2：含正面與背面", !!front2 && !!back2);
if (front2 && back2) {
  const cxOf = (f: typeof front2) => {
    const xs = f.holes[0].pts!.map((p) => p.x);
    return (Math.max(...xs) + Math.min(...xs)) / 2;
  };
  const cf = cxOf(front2), cb = cxOf(back2);
  check("案例2：背面 X 鏡射（正面 cx + 背面 cx ≈ 450）", near(cf + cb, 450, 1));
  check("案例2：榫孔標記為通榫", front2.holes[0].through === true);
}

// --- 案例 3：+Y 頂面盲榫（depthAxis=y → 俯視面）---
// origin y=30 貼頂面（thickness 頂）、x=0 置中、z=0；depth 10；孔 40×20
const f3 = partMachiningFaces(leg([
  { origin: { x: 0, y: 30, z: 0 }, depth: 10, length: 40, width: 20, through: false } as unknown as Part["mortises"][number],
]));
check("案例3：頂面盲榫 → 1 個加工面 top", f3.length === 1 && f3[0].faceKey === "top");
// top view (u,v)=(-x,z) → outline 450×30（x×z）
check("案例3：頂面外框 450×30", f3[0] && near(f3[0].w, 450) && near(f3[0].h, 30));

// --- 案例 4：圓料腳圓榫 → circle ---
const f4 = partMachiningFaces(leg([
  { origin: { x: 0, y: 30, z: 0 }, depth: 10, length: 16, width: 16, through: false, shape: "round" } as unknown as Part["mortises"][number],
]));
check("案例4：圓榫畫成 circle", f4[0]?.holes[0]?.kind === "circle" && near(f4[0].holes[0].r ?? 0, 8));

// --- 案例 5：無母榫零件 → 回 []（呼叫端 fallback 純外框）---
check("案例5：無母榫回空陣列", partMachiningFaces(leg([])).length === 0);

// --- 收尾 ---
if (failed > 0) {
  console.error(`\n${failed} 個測試失敗`);
  process.exit(1);
}
console.log("\n全部通過");
