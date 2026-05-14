# 3D 木紋走向視覺化 — 設計文件

**日期**：2026-05-14
**狀態**：待使用者審閱

## 目標

讓家具設計器的 3D 透視圖能一眼看出每塊零件的木紋（纖維）走向。分兩階段：
強化既有擬真木紋的方向感（永遠開著），再加一個可開關的示意箭頭疊層。

## 背景

3D 圖已經有程序化木紋 shader（`components/wood-shader.ts`）——plain-sawn
cathedral grain，含年輪、導管孔、心邊材色差，每個零件依 `part.grainDirection`
（`"length" | "width"`）選 `woodCompileX` / `woodCompileZ`。問題不是「沒有木紋」，
而是年輪拱形的方向感弱：盯著看才分得出纖維往哪跑，比較「這塊順長邊、那塊順
短邊」時不夠一目了然。

`part.grainDirection` 是現成欄位（`lib/types/index.ts:138`），所有 template
都已正確設定，本功能不需要新增資料。

## 架構

兩個獨立階段，互不依賴，可分開實作、分開驗證：

- **Stage 1** — 改 `wood-shader.ts`，在既有 fragment shader 加一個沿 grain 軸
  的順紋條紋分量。永遠開著，預設視圖即受惠。
- **Stage 2** — 新增可開關的箭頭疊層，走 URL 參數 `?grain=1`（與既有
  `?wf=1` 線框、`?scene=` 場景同模式）。預設關。

## Stage 1：強化擬真木紋的順紋條紋

### 需求

現有 shader（`makeGrainFragment`）step 8 的「導管孔」是 `wd_noise` 點狀雜訊，
方向感弱。加入一個**純粹沿 grain 軸（`gx`）跑的高頻、低振幅暗紋分量**，讓纖維
走向不靠年輪也看得出來。

### 約束

- 只**新增**一個明確的方向性分量，**不改動**現有年輪（ring）邏輯——自訂 wood
  shader 互動敏感（見 `docs/drafting-math.md`，anisotropy 反射項待實作的風險註記）。
- 振幅要低（與現有 `dimming` 各項同量級，約 0.08–0.18 的乘法擾動），不能蓋掉
  年輪拱形的擬真感。
- 條紋頻率沿 `gx` 高、沿 cross 軸（`wz`）幾乎不變——這樣視覺上是「一條一條
  順著纖維的細線」，而不是棋盤格。

### 驗證

shader 改前 / 改後各截一張同角度同家具的圖，比對方向感是否明顯提升、年輪
擬真感是否保留。

## Stage 2：可開關的箭頭疊層

### 行為

`?grain=1` 時，每個木製零件在最顯眼那一面疊一支**雙向箭頭 ◄────►**，沿 grain
軸、長度約零件該軸長度的 80%。玻璃（`isGlass`）與銅件（`isBrass`）跳過。

### 「最顯眼面」與方向判定

- **方料零件**：取面積最大的面當最顯眼面，箭頭平貼其上、沿外法線方向往外推
  一個微小 offset（避免 z-fighting）。箭頭朝向依 `part.grainDirection`——
  `"length"` 沿零件 local X 軸、`"width"` 沿 local Z 軸（與 wood-shader 同慣例）。
- **圓料 / 車旋件**（`shape.kind` 為 `round` / `round-tapered` /
  `splayed-round-tapered` / `shaker` / `lathe-turned`）：沒有平面，箭頭沿圓柱
  長軸（local Y），浮在柱面外側一個微小 offset。旋鈕這類小圓件照畫，箭頭跟著
  零件尺寸縮小。

### 箭頭幾何

一根細軸（thin box 或 cylinder）+ 兩端各一個錐頭（cone），合成一個小 group，
以 `useMemo` 快取重用。

- 顏色：深炭灰 `#27272a`，加極低 emissive（約 0.15）避免被陰影吃掉。
- `renderOrder` 拉高壓在木紋之上；**保留 depthTest** —— 箭頭不會穿到櫃子背面，
  只有面朝鏡頭時可見，符合直覺。
- 軸長 = 該零件 grain 軸長度 × 0.8；軸粗與錐頭大小依零件尺寸等比縮放，設一個
  最小下限讓極小零件的箭頭仍可見。

### 與其他模式共存

- 爆炸視圖（`?explode=`）：箭頭跟零件一起位移。
- 線框模式（`?wf=1`）：箭頭照常顯示，骨架線與紋向箭頭互補。
- 榫接模式（`?joineryMode=`）：榫頭是獨立渲染的子零件，也各自拿一支箭頭。

### Toggle UI

新增 `components/GrainArrowToggle.tsx`，仿 `components/SceneThemeToggle.tsx`：
client component，點擊切換 URL 的 `?grain=` 參數。放在 3D 視圖上方，與
`SceneThemeToggle` 並列。

## 檔案結構

| 動作 | 檔案 | 責任 |
|---|---|---|
| 改 | `components/wood-shader.ts` | Stage 1：加順紋方向性條紋分量 |
| 建 | `components/GrainArrow.tsx` | 雙向箭頭幾何 + 依 grainDirection / shape 定位的 R3F 元件 |
| 改 | `components/PerspectiveView.tsx` | `Part` 內掛 `<GrainArrow>`；新增並向下穿 `showGrainArrows` prop |
| 改 | `components/LazyPerspectiveView.tsx` | 新增並向下穿 `showGrainArrows` prop |
| 建 | `components/GrainArrowToggle.tsx` | toggle 鈕，仿 `SceneThemeToggle` 寫 `?grain=` |
| 改 | `app/design/[type]/page.tsx` | 解析 `?grain=1`、傳 `showGrainArrows` prop、渲染 `<GrainArrowToggle>` |

## 資料流

```
URL ?grain=1
  → app/design/[type]/page.tsx 解析成 showGrainArrows: boolean
  → <LazyPerspectiveView showGrainArrows={...} />
  → <PerspectiveView showGrainArrows={...} />
  → 每個 <Part showGrainArrows={...} />
  → showGrainArrows 為 true 時渲染 <GrainArrow grainDirection size shape />
```

`<GrainArrowToggle>` 反向：點擊 → 改寫 `?grain=` URL 參數 → 觸發 re-render。

## 邊界情況

- **玻璃 / 銅件**：`isGlass` 或 `isBrass` 的零件不渲染箭頭。
- **極小零件**：箭頭軸粗 / 錐頭大小有最小下限，不會縮到看不見；旋鈕等小圓件
  仍照畫。
- **圓料無平面**：走圓柱長軸路徑（見上）。
- **效能**：一個設計約 10–40 個零件，每零件一個 memo 過的小箭頭 group，負擔
  可忽略；不需改 `frameloop`。

## 測試

- `npx tsc --noEmit` —— 本功能新增 / 改動的檔案無 type error。
- **不需** 跑 `scripts/audit-overlaps.ts` —— 未動 `lib/templates/*`。
- Playwright 自驗：開 `/design/open-bookshelf`（混合紋向零件），`?grain=1`
  開 / 關各截一張，確認箭頭沿正確軸、方料與圓料都對位；desktop 與 mobile 兩個
  viewport 都截圖比對（responsive 改動曾連帶影響側欄）。
- Stage 1：shader 改前 / 改後同角度同家具截圖比對。

## 不做（YAGNI）

- 箭頭動畫、hover 互動。
- 「紋向錯誤」紅色警示 —— 那是 `lib/design/grain.ts` 的職責，未來要做再另接
  （參考已上線的 `DeflectionHints` 模式）。
- 真實木紋貼圖 / 條紋 shader 以外的渲染路線 —— 已在 brainstorming 排除。
