# 衣櫃推拉門模式 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 衣櫃加「推拉門模式」勾選項，打開後整櫃變 2 片前後錯開的外掛滑門，鉸鏈門扇自動取消、zone 抽屜自動入柱。

**Architecture:** 方案 A — `caseFurniture` opts 加 `slidingDoorMode?: boolean` flag（預設 false，其他櫃類不受影響）。case-furniture.ts 握有所有櫃體幾何，sliding door 邏輯掛這裡。wardrobe.ts 只加勾選項 + 動態隱藏鉸鏈門選項 + 傳 flag。

**Tech Stack:** TypeScript / Next.js / Three.js。無單元測試框架——驗證靠 `npx tsc --noEmit`、`npx tsx scripts/audit-overlaps.ts`、playwright 截圖（dev server 在 localhost:3000）。

**Spec:** `docs/superpowers/specs/2026-05-14-wardrobe-sliding-door-design.md`

---

## File Structure

只動 2 個檔：

- `lib/templates/wardrobe.ts` — 加 `slidingDoorMode` 勾選項；覆寫 5 個鉸鏈門選項的 `dependsOn`；讀 flag 傳給 `caseFurniture`
- `lib/templates/_builders/case-furniture.ts` — `CaseFurnitureOpts` 加 `slidingDoorMode?`；`drawerMount` 一行改；門扇渲染包 `if`；zone 迴圈後新增滑門 + 滑軌 part 渲染

關鍵既有座標慣例（讀過確認）：
- `length` = X（左右寬）、`width` = Z（前後深）、`height` = Y（上下高）
- 櫃前緣 z = `-width / 2`；往前 = 更負的 z
- `caseBottomY = legHeight`；`innerH = caseHeight - 2*panelT`；`caseHeight = height - legHeight`
- `parts: Part[]` 在 case-furniture.ts:288 宣告
- zone 迴圈：`else if (opts.zones...)` 在 1448 開始、1917 結束
- 門扇（鉸鏈）`renderDoorZone({...})` 在 zone 迴圈內的呼叫：**1531（單欄門）+ 1677（多欄門子欄）**
- slab 門 part 範本：case-furniture.ts:815-834

---

## Task 1: Plumbing — opts flag + 勾選項 + 傳遞

**Files:**
- Modify: `lib/templates/_builders/case-furniture.ts` — `CaseFurnitureOpts` interface (~line 92-94)
- Modify: `lib/templates/wardrobe.ts` — `wardrobeOptions` 陣列 + builder body

- [ ] **Step 1: case-furniture.ts opts interface 加欄位**

在 `CaseFurnitureOpts` interface 內、`doorPullStyle?: string;`（約 line 94）那行之後加：

```typescript
  /** 衣櫃推拉門模式：true 時整櫃改 2 片前後錯開外掛滑門，鉸鏈門扇取消、zone 抽屜強制 inset。 */
  slidingDoorMode?: boolean;
```

- [ ] **Step 2: wardrobe.ts 加勾選項**

`wardrobeOptions` 陣列中，`doorFrameThicknessOption,`（約 line 53）那行之後加：

```typescript
  { group: "door", type: "checkbox", key: "slidingDoorMode", label: "推拉門模式（2 片外掛滑門）", defaultValue: false, wide: true, help: "打開後整櫃改 2 片前後錯開外掛滑門蓋滿上中下層；鉸鏈門扇自動取消、zone 抽屜自動入柱" },
```

- [ ] **Step 3: wardrobe.ts builder 讀 flag 並傳給 caseFurniture**

在 `wardrobe` builder 函式內，`const doorMount = resolveDoorMount(input, o);`（約 line 88）之後加：

```typescript
  const slidingDoorMode = getOption<boolean>(input, opt(o, "slidingDoorMode"));
```

在 `caseFurniture({...})` 呼叫的 opts 物件內，`drawerMount,`（約 line 139）那行之後加：

```typescript
    slidingDoorMode,
```

- [ ] **Step 4: tsc 驗證**

Run: `npx tsc --noEmit 2>&1 | grep -E "wardrobe|case-furniture"`
Expected: 無輸出（無 error）。`.pnpm-old` / `searchParams` 等既有無關 error 忽略。

- [ ] **Step 5: Commit**

```bash
git add lib/templates/wardrobe.ts lib/templates/_builders/case-furniture.ts
git commit -m "feat(wardrobe): add slidingDoorMode option plumbing (no rendering yet)"
```

---

## Task 2: 動態隱藏鉸鏈門選項

slidingDoorMode 打開時，只影響鉸鏈門扇的選項要隱藏（門材質 / 安裝方式 / 門框寬 / 門框厚 / 門把樣式）。

**Files:**
- Modify: `lib/templates/wardrobe.ts` — `wardrobeOptions` 陣列

- [ ] **Step 1: 在 wardrobeOptions 上方定義共用條件**

`export const wardrobeOptions: OptionSpec[] = [` 那行**之前**加：

```typescript
// slidingDoorMode 打開時，只影響鉸鏈門扇的選項要隱藏
const HINGED_DOOR_VISIBLE = {
  all: [ANY_ZONE_IS_DOOR, { key: "slidingDoorMode", equals: false }],
};
```

- [ ] **Step 2: doorType 內聯選項改 dependsOn**

`wardrobeOptions` 內的 `doorType` 選項（約 line 46-50），把結尾的 `dependsOn: ANY_ZONE_IS_DOOR }` 改成 `dependsOn: HINGED_DOOR_VISIBLE }`。

- [ ] **Step 3: 4 個 shared 門選項用 spread 覆寫 dependsOn**

`wardrobeOptions` 內這 4 行：
```typescript
  doorMountOption,
  doorFrameRailWidthOption,
  doorFrameThicknessOption,
```
（`doorMountOption` 在 line 51，後兩個在 52-53）
以及 builder 尾段的 `doorPullStyleOption("door")`（約 line 76）

改成 spread + 覆寫 dependsOn：
```typescript
  { ...doorMountOption, dependsOn: HINGED_DOOR_VISIBLE },
  { ...doorFrameRailWidthOption, dependsOn: HINGED_DOOR_VISIBLE },
  { ...doorFrameThicknessOption, dependsOn: HINGED_DOOR_VISIBLE },
```
```typescript
  { ...doorPullStyleOption("door"), dependsOn: HINGED_DOOR_VISIBLE },
```

注意：`doorPullStyleOption("door")` 原本若已有 dependsOn，spread 後被 `HINGED_DOOR_VISIBLE` 覆蓋即可（門把樣式本來就只跟門扇有關）。先 `grep -n "doorPullStyleOption" lib/templates/_helpers.ts` 確認它原本的 dependsOn，若原本還 AND 了別的條件，把那條件一起併進 `HINGED_DOOR_VISIBLE` 的 `all` 陣列。

- [ ] **Step 4: tsc 驗證**

Run: `npx tsc --noEmit 2>&1 | grep -E "wardrobe"`
Expected: 無輸出。

- [ ] **Step 5: playwright 驗證動態隱藏**

確認 dev server 在跑（`lsof -i:3000 -sTCP:LISTEN`，沒有就 `npm run dev`）。
playwright 開 `http://localhost:3000/design/wardrobe`，snapshot 表單：
- slidingDoorMode 未勾：「門材質」「門板安裝方式」「門框木條寬」「門框木條厚」「門把樣式」可見
- 勾選 slidingDoorMode 後：上述 5 個選項消失
Expected: 符合上述。

- [ ] **Step 6: Commit**

```bash
git add lib/templates/wardrobe.ts
git commit -m "feat(wardrobe): hide hinged-door options when slidingDoorMode on"
```

---

## Task 3: zone 抽屜 slidingDoorMode 時強制 inset

**Files:**
- Modify: `lib/templates/_builders/case-furniture.ts:286`

- [ ] **Step 1: drawerMount 宣告改成依 slidingDoorMode**

case-furniture.ts:286 現在是：
```typescript
  const drawerMount = opts.drawerMount ?? "overlay-6";
```
改成：
```typescript
  const drawerMount = opts.slidingDoorMode ? "inset" : (opts.drawerMount ?? "overlay-6");
```

這一行讓所有抽屜渲染路徑（zone 抽屜、column 抽屜）在滑門模式下都吃到 inset。門內抽屜本來就已固定 inset，不受影響。

- [ ] **Step 2: tsc + audit 驗證**

Run: `npx tsc --noEmit 2>&1 | grep case-furniture && echo TSC_OK`
Expected: `TSC_OK`（無 error 行）。

Run: `npx tsx scripts/audit-overlaps.ts 2>&1 | tail -2`
Expected: `✅ All non-allowlisted cases clean (143/151).`（預設 slidingDoorMode=false，audit 不受影響）

- [ ] **Step 3: playwright 驗證**

playwright 開 `http://localhost:3000/design/wardrobe?slidingDoorMode=true&bottomType=drawer&bottomCount=2&bottomCols=2`，截正視圖。
Expected: 下層 zone 抽屜呈 inset（面板埋進開口、齊平），不是凸出的 overlay 蓋板。此時鉸鏈門 + 無滑門（後續 task 處理）。

- [ ] **Step 4: Commit**

```bash
git add lib/templates/_builders/case-furniture.ts
git commit -m "feat(case-furniture): force zone drawers inset when slidingDoorMode"
```

---

## Task 4: slidingDoorMode 時跳過鉸鏈門扇渲染

zone 類型=門板 時，門內收納（子欄分隔 / 層板 / 抽屜 / 吊衣桿）照舊，只跳過鉸鏈門扇本身。

**Files:**
- Modify: `lib/templates/_builders/case-furniture.ts` — zone 迴圈內 line 1531（單欄門）+ line 1677（多欄門子欄）的 `renderDoorZone({...})` 呼叫

- [ ] **Step 1: 單欄門 renderDoorZone 包 if**

case-furniture.ts:1531 附近的單欄門 `renderDoorZone({...})` 呼叫（在 `if (nDoorCols < 2) {` 分支內）。先 `Read` line 1525-1535 確認完整呼叫範圍，把整個 `renderDoorZone({ ... });` 呼叫包進 `if (!opts.slidingDoorMode) { ... }`。**只包 renderDoorZone 本身**——後面門內收納（renderDrawerZone / renderShelvesZone / 吊衣桿）的呼叫不要包。

- [ ] **Step 2: 多欄門子欄 renderDoorZone 包 if**

case-furniture.ts:1677 附近的多欄門 `renderDoorZone({...})`（在 `else` 多欄分支、`for (let ci...)` 迴圈內）。先 `Read` line 1666-1680 確認完整呼叫範圍，同樣把整個 `renderDoorZone({ ... });` 包進 `if (!opts.slidingDoorMode) { ... }`。子欄分隔板 / 子欄內收納的呼叫不要包。

- [ ] **Step 3: tsc + audit 驗證**

Run: `npx tsc --noEmit 2>&1 | grep case-furniture && echo TSC_OK`
Expected: `TSC_OK`

Run: `npx tsx scripts/audit-overlaps.ts 2>&1 | tail -2`
Expected: `✅ All non-allowlisted cases clean (143/151).`

- [ ] **Step 4: playwright 驗證**

playwright 開 `http://localhost:3000/design/wardrobe?slidingDoorMode=true&midType=door&midDoorCols=2&midDoorSub2Drawers=3`，截正視圖。
Expected: 中層門 zone **沒有鉸鏈門扇**，但子欄分隔 + 子欄2 的 3 個門內抽屜（等距分散、入柱、無把手）都還在。

- [ ] **Step 5: Commit**

```bash
git add lib/templates/_builders/case-furniture.ts
git commit -m "feat(case-furniture): skip hinged door leaves when slidingDoorMode"
```

---

## Task 5: 渲染 2 片滑門 + 邊緣指拉槽

**Files:**
- Modify: `lib/templates/_builders/case-furniture.ts` — zone 迴圈 `else if` 區塊結束（line 1917 的 `}`）之後、hangingArea 區塊（line 1919）之前插入

- [ ] **Step 1: 插入滑門渲染區塊**

在 case-furniture.ts:1917（zone `else if` 區塊的 `}`）之後、line 1919 `// 吊衣桿（若指定 hangingArea）` 之前，插入：

```typescript
  // —— 推拉門模式：2 片前後錯開外掛滑門 ——
  if (opts.slidingDoorMode) {
    const SLIDE_T = 18;                       // slab 滑門厚
    const SLIDE_OVERLAP = 50;                 // 兩片中間重疊量
    const panelW = length / 2 + SLIDE_OVERLAP / 2;  // 每片寬（半寬 + 25）
    const slideH = caseHeight;                // 高 = 內部三層 + 上下板，蓋滿前緣
    const slideYBottom = caseBottomY;         // 底部對齊櫃體底
    // Z：櫃前緣 = -width/2，往前更負。後軌片貼櫃前緣外 3mm，前軌片再往前 21mm。
    const zBackPanel = -width / 2 - 3 - SLIDE_T / 2;          // 後軌（右片）
    const zFrontPanel = zBackPanel - 21;                      // 前軌（左片）
    const leftPanelCx = -length / 2 + panelW / 2;             // 左片置左
    const rightPanelCx = length / 2 - panelW / 2;             // 右片置右
    const slidingPanels: Array<{ idx: number; cx: number; z: number; nameZh: string }> = [
      { idx: 1, cx: leftPanelCx, z: zFrontPanel, nameZh: "滑門（左／前軌）" },
      { idx: 2, cx: rightPanelCx, z: zBackPanel, nameZh: "滑門（右／後軌）" },
    ];
    for (const p of slidingPanels) {
      parts.push({
        id: `sliding-door-${p.idx}`,
        nameZh: p.nameZh,
        material,
        materialOverride: "plywood",
        grainDirection: "length",
        visible: { length: panelW, width: slideH, thickness: SLIDE_T },
        origin: { x: p.cx, y: slideYBottom, z: p.z },
        rotation: { x: Math.PI / 2, y: 0, z: 0 },
        tenons: [],
        mortises: [],
      });
    }
  }
```

說明：`origin.y` 用 part 底部（與 slab 門 part 範本 case-furniture.ts:826-830 的 `doorYBase` 慣例一致——slab 門 origin.y 也是底部）；`rotation: { x: Math.PI/2 }` 同 slab 門，讓平板立起來面朝前。

- [ ] **Step 2: tsc + audit 驗證**

Run: `npx tsc --noEmit 2>&1 | grep case-furniture && echo TSC_OK`
Expected: `TSC_OK`

Run: `npx tsx scripts/audit-overlaps.ts 2>&1 | tail -2`
Expected: `✅ All non-allowlisted cases clean (143/151).`（預設 slidingDoorMode=false 不受影響）

- [ ] **Step 3: playwright 驗證滑門出現 + 位置正確**

playwright 開 `http://localhost:3000/design/wardrobe?slidingDoorMode=true`，截**正視圖 + 側視圖 + 俯視圖**。
Expected：
- 正視：2 片滑門蓋滿櫃體外寬，中間重疊
- 側視：2 片滑門在櫃前方、看得出前後錯開兩層
- 俯視：2 片滑門 X 軸覆蓋全寬、Z 軸錯開 21mm

若 2 片貼在一起沒錯開、或位置穿進櫃體 → 調 `zBackPanel` / `zFrontPanel` 的 clearance 數字，重截確認。

- [ ] **Step 4: playwright 驗證 xray**

同 URL 加 `&xray=face`，截 3D。
Expected: 「藏面板」狀態下 2 片滑門被藏起來、露出櫃體內部（`sliding-door-N` id 被現有 `/-door($|-)/` 規則抓到）。

- [ ] **Step 5: 手動 audit slidingDoorMode=true 無穿模**

臨時把 wardrobe.ts 的 `slidingDoorMode` defaultValue 暫改 `true`，跑 `npx tsx scripts/audit-overlaps.ts 2>&1 | grep -i wardrobe`，確認 wardrobe 不在穿模清單（前後錯開 z-gap 夠大），再把 defaultValue 改回 `false`。

- [ ] **Step 6: Commit**

```bash
git add lib/templates/_builders/case-furniture.ts
git commit -m "feat(case-furniture): render 2 offset sliding door panels"
```

---

## Task 6: 滑門邊緣垂直指拉槽

每片滑門靠中縫那側的豎邊加一道垂直 cosmetic 凹槽。

**Files:**
- Modify: `lib/templates/_builders/case-furniture.ts` — Task 5 插入的滑門區塊

- [ ] **Step 1: 先讀懂既有 cosmetic mortise 座標系**

`Read` case-furniture.ts:803-814（slab 門的 finger-pull cosmetic mortise）。該範例是「靠頂端的水平槽」：`origin: { x: 0, y: 0, z: -doorOuterH/2 + 14 }`、`length: 80`、`width: 25`、`depth: 12`、`cosmetic: true`、`shape: "rect"`。注意 origin 是 part **rotation 後的 local 座標**。

- [ ] **Step 2: 在滑門 part 加垂直指拉槽 mortise**

把 Task 5 的滑門 `parts.push({...})` 內的 `mortises: [],` 改成靠中縫側的垂直槽。中縫側：左片（idx 1）的右邊緣、右片（idx 2）的左邊緣。

```typescript
        mortises: [{
          // 靠中縫側豎邊的垂直指拉槽（cosmetic）。idx 1=左片→右緣、idx 2=右片→左緣。
          origin: { x: p.idx === 1 ? panelW / 2 - 15 : -(panelW / 2 - 15), y: 0, z: 0 },
          depth: 10,
          length: 20,
          width: 600,
          through: false,
          cosmetic: true,
          shape: "rect",
        }],
```

- [ ] **Step 3: tsc 驗證**

Run: `npx tsc --noEmit 2>&1 | grep case-furniture && echo TSC_OK`
Expected: `TSC_OK`

- [ ] **Step 4: playwright 驗證槽的位置/方向**

playwright 開 `http://localhost:3000/design/wardrobe?slidingDoorMode=true`，截 3D（xray off）放大看滑門。
Expected: 每片滑門靠中縫側豎邊有一道**垂直**指拉槽（約 600mm 高、置中）。
若槽變成水平、或跑到外緣、或方向不對 → `length`（X 向槽寬）/ `width`（垂直高）/ `origin.x` 互換調整，重截確認（cosmetic mortise 的 local 軸在 rotation x=π/2 後 `width` 對應垂直方向、`length` 對應 X 向；若實測不符就對調 `length`/`width`）。

- [ ] **Step 5: audit 驗證**

Run: `npx tsx scripts/audit-overlaps.ts 2>&1 | tail -2`
Expected: `✅ All non-allowlisted cases clean (143/151).`（cosmetic mortise 不影響 AABB）

- [ ] **Step 6: Commit**

```bash
git add lib/templates/_builders/case-furniture.ts
git commit -m "feat(case-furniture): add vertical edge pull groove to sliding doors"
```

---

## Task 7: 渲染頂 / 底滑軌

**Files:**
- Modify: `lib/templates/_builders/case-furniture.ts` — Task 5 插入的滑門區塊

- [ ] **Step 1: 在滑門區塊加頂底滑軌 part**

在 Task 5 的 `if (opts.slidingDoorMode) {` 區塊內、滑門 `for` 迴圈**之後**加：

```typescript
    // 頂 / 底滑軌：兩條細長條，跨櫃體外寬，裝在櫃前緣
    const RAIL_H = 25;        // 滑軌條 Y 向高
    const RAIL_D = 42;        // 滑軌條 Z 向深（涵蓋前後兩軌）
    const railZ = -width / 2 - 3 - RAIL_D / 2;   // 貼櫃前緣外、涵蓋兩片門的 z 範圍
    const railSpecs: Array<{ id: string; nameZh: string; y: number }> = [
      { id: "sliding-track-top", nameZh: "滑門頂滑軌", y: caseBottomY + caseHeight - RAIL_H },
      { id: "sliding-track-bottom", nameZh: "滑門底滑軌", y: caseBottomY },
    ];
    for (const r of railSpecs) {
      parts.push({
        id: r.id,
        nameZh: r.nameZh,
        material,
        grainDirection: "length",
        visible: { length: length, width: RAIL_H, thickness: RAIL_D },
        origin: { x: 0, y: r.y, z: railZ },
        tenons: [],
        mortises: [],
      });
    }
```

- [ ] **Step 2: tsc 驗證**

Run: `npx tsc --noEmit 2>&1 | grep case-furniture && echo TSC_OK`
Expected: `TSC_OK`

- [ ] **Step 3: audit 驗證**

Run: `npx tsx scripts/audit-overlaps.ts 2>&1 | tail -2`
Expected: `✅ All non-allowlisted cases clean (143/151).`

臨時把 wardrobe.ts `slidingDoorMode` defaultValue 改 `true` 跑一次 audit grep wardrobe，確認滑軌沒撞滑門 / 櫃體（railZ 的 RAIL_D 範圍要涵蓋兩片門但不穿櫃；若有撞調 railZ / RAIL_D），再改回 `false`。

- [ ] **Step 4: playwright 驗證**

playwright 開 `http://localhost:3000/design/wardrobe?slidingDoorMode=true`，截側視圖 + 3D。
Expected: 櫃體頂緣 + 底緣前方各一條滑軌，滑門夾在兩軌之間。

- [ ] **Step 5: Commit**

```bash
git add lib/templates/_builders/case-furniture.ts
git commit -m "feat(case-furniture): add top/bottom sliding door track rails"
```

---

## Task 8: 整體驗證

**Files:** 無（純驗證）

- [ ] **Step 1: 全套 tsc**

Run: `npx tsc --noEmit 2>&1 | grep -E "wardrobe|case-furniture" && echo "HAS_ERRORS" || echo "TSC_CLEAN"`
Expected: `TSC_CLEAN`

- [ ] **Step 2: 全套 audit（預設）**

Run: `npx tsx scripts/audit-overlaps.ts 2>&1 | tail -3`
Expected: `✅ All non-allowlisted cases clean (143/151).`

- [ ] **Step 3: playwright 完整自驗**

dev server 確認在跑。playwright 跑這幾個 case，每個截正視 / 側視 / 俯視 + 3D：
1. `http://localhost:3000/design/wardrobe`（slidingDoorMode 關）→ 一切照舊，鉸鏈門正常
2. `http://localhost:3000/design/wardrobe?slidingDoorMode=true` → 2 片錯開滑門、無鉸鏈門扇、有滑軌、滑門有指拉槽
3. `...?slidingDoorMode=true&xray=face` → 滑門藏起來露出內部
4. `...?slidingDoorMode=true&midType=door&midDoorCols=2&midDoorSub2Drawers=3&bottomType=drawer` → 門 zone 內收納保留、zone 抽屜入柱、滑門蓋在最前
Expected: 全部符合；console 0 errors。

- [ ] **Step 4: 確認勾選項 + 動態隱藏**

playwright 開 `http://localhost:3000/design/wardrobe`，表單勾 / 不勾 slidingDoorMode，確認 5 個鉸鏈門選項（門材質 / 安裝方式 / 門框寬 / 門框厚 / 門把樣式）跟著隱藏 / 顯示。

- [ ] **Step 5: 最終 commit（若有殘留）**

```bash
git status --short
# 若 Task 1-7 都已各自 commit，這裡應無未提交變更。有的話檢視後 commit。
git push origin main
```

---

## Self-Review 紀錄

- **Spec coverage**：§1 選項與動態隱藏 → Task 1+2；§2 滑門幾何 → Task 5+6+7；§3 zone 互動 → Task 3（抽屜 inset）+ Task 4（跳過門扇）；§4 3D/三視圖 → Task 5-8 的 playwright 步驟（xray / 三視圖）；§5 audit → 各 task 的 audit 步驟 + Task 8。全部有對應 task。
- **Placeholder scan**：geometry 微調步驟（Task 5 Step 3、Task 6 Step 4、Task 7 Step 3）是「截圖→比對→調數字」的合法迭代，非 placeholder——已給起始 code + 明確調整方向。
- **Type consistency**：`slidingDoorMode` 在 Task 1 定義、Task 3-7 使用一致；part id `sliding-door-{1,2}` / `sliding-track-{top,bottom}` 命名前後一致；幾何變數（`length` / `width` / `caseBottomY` / `caseHeight` / `panelT` / `innerH` / `material` / `parts`）皆為 case-furniture.ts 既有 function-scope 變數。
