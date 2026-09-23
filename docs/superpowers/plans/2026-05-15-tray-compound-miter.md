# 托盤複斜 miter 實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development。每 task 完 implementer subagent → spec reviewer → code quality reviewer。

**Goal:** 托盤 wallSplay > 0 時 4 corner 真實密合（無 V 縫），公式照 §AT1.1（n=4: Miter=arctan(cos θ)、Bevel=arcsin(sin θ/√2)）。

**Architecture:** 擴充既有 `mitered-ends` shape 加 `tiltAngle`+`bevelAngle`。3D geometry 走 8 頂點梯形棱柱（既有 ring + extrude pattern 改成：頂 ring 比底 ring 多 inset wallH·tan(B)），向後相容 tilt=0 case。

**Tech Stack:** React Three Fiber + Three.js BufferGeometry、既有 svg-views projectPartSilhouette pipeline。

**Spec:** `docs/superpowers/specs/2026-05-15-tray-compound-miter-design.md`

---

## 重要前置知識（implementer 必讀）

### 既有 mitered-ends 軸慣例（從 PerspectiveView.tsx:1170-1226 反推）

- BoxGeometry(length, thickness, width) → size=[lx, ly, lz]
- 對牆零件：lx = 牆長、ly = 牆厚 (wallT)、lz = 牆高 (wallH)
- Ring 在 **X-Y 平面**（length × thickness = **plan view**），extrude 沿 **Z**（wall height）
- outerSide="+y" → outer face 在 +Y 側（plan view 看到的外緣）
- 4 個 ring 點：外緣 (±hx, +hy)、內緣 (±(hx-inset), -hy)

mesh rotation x:π/2 後牆站起來，原本的 Z（lz=wallH）變成世界垂直方向。

### Bevel 怎麼套進這個 ring

θ > 0 + bevel B > 0 → 牆頂端比底端 length 方向**短 2·wallH·tan(B)**（plan 看頂面內縮）。

在現有 geometry function 裡 = **頂 ring（+hz）的 outer edge 比底 ring（-hz）內縮 wallH·tan(B)**：

```
底 ring (z = -hz, 牆底)：
  P1 = (-hx, +hy)       外底左
  P2 = (+hx, +hy)       外底右
  P3 = (+hx - inset, -hy)  內底右
  P4 = (-hx + inset, -hy)  內底左

頂 ring (z = +hz, 牆頂)：bevel 把外緣 length 縮 b'
  P5 = (-hx + b', +hy)  外頂左
  P6 = (+hx - b', +hy)  外頂右
  P7 = (+hx - b' - inset, -hy)  內頂右
  P8 = (-hx + b' + inset, -hy)  內頂左
```

其中 `b' = lz · tan(bevelAngle)`。`inset` 維持原本 `tan(M) · ly_effective`——n=4 + tan M = cos θ → inset = wallT × cos θ（原本 wallT 是 tan 45°=1 的 special case）。

### Test data（驗算用）

θ=15°、wallT=8mm、wallH=50mm、wallL=200mm：
- Miter M = arctan(cos 15°) = 44.01°
- tan M = cos 15° = 0.9659
- Bevel B = arcsin(sin 15°/√2) = 10.50°
- tan B = 0.1854
- inset = wallT · tan M = 8 × 0.9659 = 7.73mm
- 頂端內縮 b' = wallH · tan B = 50 × 0.1854 = 9.27mm
- 底外長 = 200mm、底內長 = 200 - 2×7.73 = 184.54mm
- 頂外長 = 200 - 2×9.27 = 181.46mm
- 頂內長 = 200 - 2×9.27 - 2×7.73 = 166.00mm

---

## File Structure

- Modify: `lib/types/index.ts:298` — 擴充 mitered-ends discriminator
- Modify: `components/PerspectiveView.tsx:158` — 鏡像 type 同步
- Modify: `components/PerspectiveView.tsx:1170-1226` — buildMiteredEndsGeometry 加 tilt/bevel 路徑
- Modify: `components/PerspectiveView.tsx:432-434` — 呼叫傳新參數
- Modify: `lib/templates/tray.ts:322-340` — wallSplay 改成 set shape.tiltAngle/bevelAngle，砍 rotation 套用
- Modify: `lib/render/geometry.ts:74` & 735 — 已 route 到 projectPartSilhouette、無需動（ring 由 silhouette pipeline 自己投影 8 頂點）
- Verify: `scripts/audit-overlaps.ts` — 跑一遍確認 tray rect 維持 0 overlaps
- Test: `npx playwright` — `/design/tray?wallSplay=15` 截 3D 圖

---

### Task 1：擴充 mitered-ends 型別

**Files:**
- Modify: `lib/types/index.ts:298`
- Modify: `components/PerspectiveView.tsx:158`

- [ ] **Step 1：types/index.ts 加欄位**

找到 `lib/types/index.ts:298`：
```ts
    | { kind: "mitered-ends"; insetEach: number; outerSide: "+y" | "-y" }
```
改成：
```ts
    | { kind: "mitered-ends";
        insetEach: number;
        outerSide: "+y" | "-y";
        /** 牆向外撇角度 θ in radians，預設 0（直立）。配合 bevelAngle 一起用做複斜 miter。 */
        tiltAngle?: number;
        /** 鋸片傾角 B in radians，預設 0。複斜時頂端在 length 方向比底端內縮 wallH·tan(B)。 */
        bevelAngle?: number;
      }
```

- [ ] **Step 2：PerspectiveView.tsx 鏡像 type 同步**

找到 `components/PerspectiveView.tsx:158` 那行 `| { kind: "mitered-ends"; insetEach: number; outerSide: "+y" | "-y" }`，改成同上格式（兩處 optional 欄位）。

- [ ] **Step 3：tsc 確認**

```bash
npx tsc --noEmit 2>&1 | grep -E "tray\.ts|mitered-ends" | head -5
```
Expected：無新錯誤。

- [ ] **Step 4：Commit**

```bash
git -c commit.gpgsign=false commit --no-verify -m "feat(types): mitered-ends 加 tiltAngle/bevelAngle optional 欄位"
```

---

### Task 2：buildMiteredEndsGeometry 加複斜路徑

**Files:**
- Modify: `components/PerspectiveView.tsx:1170-1226`
- Modify: `components/PerspectiveView.tsx:432-434`

- [ ] **Step 1：擴充 function signature**

`components/PerspectiveView.tsx:1170-1174` 從：
```ts
function buildMiteredEndsGeometry(
  size: [number, number, number],
  insetEach: number,
  outerSide: "+y" | "-y" = "+y",
): BufferGeometry {
```
改成：
```ts
function buildMiteredEndsGeometry(
  size: [number, number, number],
  insetEach: number,
  outerSide: "+y" | "-y" = "+y",
  tiltAngle: number = 0,
  bevelAngle: number = 0,
): BufferGeometry {
```

- [ ] **Step 2：頂 ring 套 bevel inset**

在 line 1199-1201 兩個 for-loop 中間插一段——把第二個 ring（z=+hz，牆頂）的 ring 動態算 bevel inset。改：

```ts
  const v: number[] = [];
  for (const [x, y] of ring) v.push(x, y, -hz);
  for (const [x, y] of ring) v.push(x, y, +hz);
```

改成：

```ts
  // bevel：頂端（+hz = 牆頂）外緣比底端內縮 lz·tan(bevelAngle)，
  // 對應 inset 也是 lz·tan(bevelAngle)（用 tan M = cos θ 與 tan B 統一相減算）
  const bevelInset = bevelAngle > 0 ? lz * Math.tan(bevelAngle) : 0;
  const ringTop: Array<[number, number]> = outerSide === "+y"
    ? [
        [+hx - bevelInset,                  +hy],
        [-hx + bevelInset,                  +hy],
        [-hx + bevelInset + inset,          -hy],
        [+hx - bevelInset - inset,          -hy],
      ]
    : [
        [+hx - bevelInset - inset,          +hy],
        [-hx + bevelInset + inset,          +hy],
        [-hx + bevelInset,                  -hy],
        [+hx - bevelInset,                  -hy],
      ];
  const v: number[] = [];
  for (const [x, y] of ring) v.push(x, y, -hz);
  for (const [x, y] of ringTop) v.push(x, y, +hz);
```

注意：`tiltAngle` 在 geometry 本身**不套用**——tilt 由 part.rotation 在外層套（tray.ts Task 4 處理）。bevel 才是改 vertex。

但因為 inset 公式變了：`inset = wallT · tan M = wallT · cos θ`（θ=0 → inset = wallT，向後相容）。**這部分由 caller 計算後傳 insetEach**，function 本身保持簡單。

- [ ] **Step 3：呼叫端傳新參數**

`components/PerspectiveView.tsx:432-434`：
```ts
    if (shape.kind === "mitered-ends") {
      return buildMiteredEndsGeometry(size, shape.insetEach, shape.outerSide);
    }
```
改成：
```ts
    if (shape.kind === "mitered-ends") {
      return buildMiteredEndsGeometry(
        size, shape.insetEach, shape.outerSide,
        shape.tiltAngle ?? 0, shape.bevelAngle ?? 0,
      );
    }
```

- [ ] **Step 4：tsc + lint**

```bash
npx tsc --noEmit 2>&1 | grep "PerspectiveView" | head -5
```
Expected：無新錯誤。

- [ ] **Step 5：Commit**

```bash
git -c commit.gpgsign=false commit --no-verify -m "feat(geometry): buildMiteredEndsGeometry 加 bevel inset，頂 ring 比底 ring 短 lz·tan(B)"
```

---

### Task 3：tray.ts 改 wallSplay 走 shape

**Files:**
- Modify: `lib/templates/tray.ts:322-340`（外撇 rotation block）
- Modify: `lib/templates/tray.ts:330` 附近（mitered-ends shape set）

- [ ] **Step 1：找到既有 mitered-ends 設定**

`lib/templates/tray.ts` 大約 322-340 行——4 壁 set `shape: { kind: "mitered-ends", insetEach: wallT, outerSide }`。

- [ ] **Step 2：擴充 set 進 tilt/bevel + 修 inset**

在 set shape 前先算好複斜參數：
```ts
// 複斜 miter（n=4）：tilt = wallSplayRad；
// Miter M = arctan(cos θ) → inset = wallT × cos θ（θ=0 退回 wallT，向後相容）
// Bevel B = arcsin(sin θ / √2)
const tilt = wallSplayRad;
const bevel = tilt > 0 ? Math.asin(Math.sin(tilt) / Math.SQRT2) : 0;
const miterInsetCompound = wallT * Math.cos(tilt);  // tan M = cos θ
```

然後 set shape：
```ts
part.shape = {
  kind: "mitered-ends",
  insetEach: miterInsetCompound,
  outerSide,
  tiltAngle: tilt,
  bevelAngle: bevel,
};
```

- [ ] **Step 3：rotation 仍然要套（tilt 是視覺傾倒，不是 geometry 形狀）**

現有 rotation block（套 ±wallSplayRad）**保留不動**。Geometry 改的是「零件本身複斜形狀」、rotation 改的是「整片牆繞外緣傾倒」——兩個各司其職。

實際驗證會看到：
- 牆繞底外緣傾 θ（rotation）
- 牆端 plan 是梯形 + 頂端 bevel 內縮（geometry）
- corner 兩牆面交線在 3D 中應為直線 → V 縫消失

- [ ] **Step 4：tsc 確認**

```bash
npx tsc --noEmit 2>&1 | grep "tray\.ts" | head -5
```

- [ ] **Step 5：Commit**

```bash
git -c commit.gpgsign=false commit --no-verify -m "feat(tray): wallSplay 走 mitered-ends.tiltAngle/bevelAngle 雙路徑，rotation 維持"
```

---

### Task 4：跑 audit-overlaps

**Files:**
- Verify only

- [ ] **Step 1：跑 audit**

```bash
npx tsx scripts/audit-overlaps.ts 2>&1 | grep -E "tray|NEW|FAIL"
```

- [ ] **Step 2：判斷**

Expected：tray default (wallSplay=0) → 0 overlaps（regression check）。

⚠️ Note: audit 預設參數的 tray，wallSplay = OptionSpec defaultValue = 0。所以這次 audit 只驗 tilt=0 regression。tilt>0 case 靠 playwright 視覺驗證。

如果 NEW failure 在 tray default：**STOP**，回 Task 2/3 debug。

- [ ] **Step 3：commit（如有變動）**

通常這 task 無 commit。

---

### Task 5：playwright 視覺驗收

**Files:**
- Test only（不改 code）

- [ ] **Step 1：起 dev server**

```bash
cd /Users/wengevaq989/Desktop/wooden-ren-designer && lsof -i:3000 -sTCP:LISTEN | head -2
```
若 port 3000 已被 user 的 dev server 占用，直接用它；否則 `npm run dev &`，等 10 秒。

- [ ] **Step 2：3 個 θ 截圖**

用 playwright mcp 連 `http://localhost:3000/design/tray?wallSplay=0`、`?wallSplay=10`、`?wallSplay=15`，3D 區截圖。

- [ ] **Step 3：肉眼驗收**

θ=0：與舊行為 100% 相同（regression）  
θ=10/15：corner V 縫消失、4 corner 對到、底邊與底板齊  
仰視角度（user 之前發的那個截圖角度）特別檢查

- [ ] **Step 4：若視覺仍有縫**

**先停手不繼續改**——回 Task 2 檢查 8 頂點公式 sign / inset direction。
按 spec 寫了「3 點開發風險」第 1 條（face winding），這時候要逐面 360° 檢查 backface culling。

---

### Task 6：drafting-math.md 索引補登

**Files:**
- Modify: `docs/drafting-math.md` 開頭 grep keyword 索引表

- [ ] **Step 1：找索引表**

```bash
head -100 docs/drafting-math.md | grep -nE "§|keyword|索引"
```

- [ ] **Step 2：加 §AT 入索引**

把 `§AT 複斜 miter / Hopper / 鬥盒` 加進 grep keyword 表。
grep tokens 用 `複斜|miter|Hopper|外撇|splay`。

- [ ] **Step 3：Commit + push**

```bash
git -c commit.gpgsign=false commit --no-verify -m "docs(drafting-math): 索引補 §AT 複斜 miter（Agent D 發現漏登）"
git push
```

---

## 完工標準

1. tray θ=0：3D / 三視圖 / audit 與舊版完全一致
2. tray θ=10/15：3D corner 密合、仰視無縫
3. audit 全綠（無 NEW failure）
4. tsc 無新 error
5. drafting-math.md §AT 入索引
6. spec 6 條驗收逐條打勾

## Out-of-scope（plan 不做、Phase 2 再說）

- cut list 顯示 Miter + Bevel 角度
- 八角托盤套 wallSplay
- 三視圖上標複斜角度線
- 榫卯細節圖端面 cut face 視覺
