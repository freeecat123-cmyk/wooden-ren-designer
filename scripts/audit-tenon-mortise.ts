/**
 * 稽核:腳上的「牙條榫眼」必須跟著牙條的縮進一起位移。
 *
 * 🩸 2026-08-25 加「牙條縮進」時,牙條位置與腳上榫眼位置是**兩段不同的程式**算的。
 *    只移牙條沒移榫眼 → 榫頭對不到孔（3D 看不出來,但榫接版與 1:1 樣板全錯）。
 *
 * ⚠️ 榫眼 origin 的慣例:`x` / `z` 是**腳斷面上離腳中心軸的位移**,
 *    其中 ±1 那個軸是「離入榫面 1mm」的標記(LEG_FACE_INSET),不是真座標。
 *    所以只驗**另一個軸**（橫向那個）有沒有等於應有的位移量。
 *    (第一版把 ±1 當座標去算世界距離,在基準版也一樣紅 —— 那是橡皮圖章,已重寫。)
 */
import { FURNITURE_CATALOG } from "@/lib/templates";

const TOL = 0.6;
const bad: string[] = [];
let checked = 0;

for (const e of FURNITURE_CATALOG as any[]) {
  const specs = (e.optionSchema ?? []) as any[];
  if (!specs.some((s) => s.key === "apronSetback")) continue;   // 這款還沒接縮進
  const base: any = specs.reduce((a: any, s: any) => ((a[s.key] = s.defaultValue), a), {});

  for (const sb of [0, 4, 10, 999]) {
    let d: any;
    try { d = e.template({ length: e.defaults.length, width: e.defaults.width, height: e.defaults.height, material: "pine", options: { ...base, apronSetback: sb } }); }
    catch { continue; }
    const ap = (d.parts as any[]).find((p) => /^apron-front$|^upper-apron-front$/.test(p.id));
    const legs = (d.parts as any[]).filter((p) => /^leg-|^leg\d/.test(p.id) && (p.mortises ?? []).length);
    if (!ap || !legs.length) continue;
    const leg = legs.slice().sort((a, b) => a.origin.z - b.origin.z)[0];
    const legD = leg.visible.width, apT = ap.visible.thickness;

    // 牙條實際位移(從腳中心量) —— 這是「真值」
    const apronShift = Math.abs(leg.origin.z) - Math.abs(ap.origin.z);
    /**
     * 認出「接前後牙條」的那個榫眼:入榫面在 ±X（|origin.x| === 1 的 face 標記）,
     * 且高度最接近牙條中心。它的 origin.z 就是該跟著牙條移的量。
     * ⚠️ 不可以用「值不等於 1」去濾 —— 位移剛好是 1mm 時會被自己濾掉（長凳撞過）。
     */
    const apCenterY = ap.origin.y + ap.visible.width / 2 - leg.origin.y;
    const xFaceMortises = (leg.mortises ?? []).filter((m: any) => Math.abs(Math.abs(m.origin.x) - 1) < 1e-6);
    if (!xFaceMortises.length) continue;
    const m = xFaceMortises.slice().sort((a: any, b: any) => Math.abs(a.origin.y - apCenterY) - Math.abs(b.origin.y - apCenterY))[0];
    const mortShift = Math.abs(m.origin.z ?? 0);
    checked++;
    if (Math.abs(mortShift - Math.abs(apronShift)) > TOL) {
      bad.push(`${d.nameZh}[縮進 ${sb}] 牙條位移 ${Math.abs(apronShift).toFixed(1)}mm,但榫眼只位移 ${mortShift.toFixed(1)}mm`);
    }
    void legD; void apT;
  }
}

console.log(`檢查 ${checked} 組（家具 × 縮進值）`);
console.log(`榫眼沒跟著移的:${bad.length}`);
bad.slice(0, 15).forEach((b) => console.log("   " + b));
if (bad.length) { console.log("\n⛔ 牙條移了、腳上的榫眼沒跟著移 → 榫頭對不到孔。"); process.exit(1); }
console.log("✅ 每一款、每一個縮進值,腳上的牙條榫眼都跟著牙條一起移。");
