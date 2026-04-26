這是木頭仁的家具設計生成器 `wooden-ren-designer`（Next.js，部署在 Vercel）。每次在這個 repo 工作，先看過這份 skill，避免重踩舊雷。

## 基本資訊

- **Repo 路徑**：`/tmp/wrd-sync/src/wooden-ren-designer/`
- **Dev server**：通常已經在 :3000 常駐（`lsof -i :3000` 檢查）。沒跑再 `pnpm dev`
- **Type check**：`pnpm exec tsc --noEmit`（必跑，commit 前）
- **部署**：push 到 `main` → Vercel 自動部署
- **生產域名**：要問使用者才貼（不自己猜 URL）

## 座標 / 幾何慣例（踩過雷）

- **origin = 底部中心**（不是角落、不是中心點、不是頂部）
- **local frame**：length → X，thickness → Y（垂直），width → Z
- **Euler 旋轉**：ZYX order（extrinsic XYZ）
- **visible vs tenon**：`part.visible` 是裸露的 body 尺寸；`tenon.length` 是外伸長度，不包含在 visible 裡。beginner-mode 不要扣 tenon（visible 就已經是組裝後高度）
- **Tapered winding**：改 BufferGeometry 頂點順序時要 CCW-from-outside，不然 backface culling 會讓腳變透明
- **Apron 位置**：normal mode `visible.length = length - legSize`（到腳中心，讓 tenon 在三視圖裡看得到重疊）；beginner mode 再縮一個 legSize（對齊腳內側）

## 榫卯渲染慣例（`lib/joinery/details.tsx`）

- **`tenon.length` = 外伸長**、**`tenon.width` = 榫面長軸**、**`tenon.thickness` = 榫面短軸**
- **childThickness / childWidth** 從 `part.visible` 最小兩邊取：sorted[0] = 厚、sorted[1] = 寬
- **mother fallback**（`extract.ts`）：找不到匹配 mortise 時取 panel-like 零件中「大於 tenon.length」的最小厚度。**不要改回 `tenon.length` fallback**（會讓母厚 == 榫長 變巧合）
- **viewBox 左邊至少留 40px**，不然 `母厚` / `板厚` / `榫長` 標籤會裁成 `4` / `0`
- **full-panel edge 接合**（366mm 寬「榫頭」那種）用 `tongue-and-groove`，不是 `blind-tenon`——巨型盲榫渲染會壞掉
- 已實作的 renderer：through-tenon（含端面紋視覺提示）/ blind-tenon / **shouldered-tenon（帶肩榫，有主榫 + 上方肩榫 + 端面剖面）** / half-lap / tongue-and-groove / dovetail（梯形 pins/tails）。其他（finger-joint / dowel / mitered-spline）是 placeholder
- **桌腳↔牙板、結構大橫木↔柱腳一律用 shouldered-tenon**；一般橫撐、footrest、背板條用 blind-tenon；櫃體面板邊緣用 tongue-and-groove
- **榫厚比例真正規則（FWW/Popular Woodworking）**：榫厚 = **被開榫眼的母件（柱腳）厚度的 1/3**，不是公件。實作寫 `min(apronThick - 2*6, legSize/3)`，因為公件較薄時會受限。**不要再改回 apronThickness/3**（是之前的錯誤）
- **肩寬固定 6mm**，不是比例：`tenon.width = apronWidth - 2 * 6`
- **通榫也要有肩**：`legTopTenonSize = round(legSize * 2/3)`，四面都留肩。之前用 `width: legSize, thickness: legSize` 是整隻腳當榫頭，結構上錯誤（無肩 → 腿會上滑）
- `JoineryRulesCallout`（頁面 `JoinerySection` 頂端的琥珀色 box）列規則，有改動就同步更新

## 工作模式：自我迭代（使用者授權後）

使用者講「自己開網頁檢查不斷優化」時走這個 loop：

1. `mcp__playwright__browser_navigate` 到 `http://localhost:3000/design/<type>`
2. `browser_evaluate` 滾到特定區段（`榫卯細節圖` / `透視圖` / `三視圖`），或直接 `browser_take_screenshot`
3. 肉眼看視覺 bug → 找到源頭（通常在 `templates/`、`joinery/`、`PerspectiveView.tsx`、`svg-views.tsx`）
4. 改 → `pnpm exec tsc --noEmit` → 重整瀏覽器驗證
5. 穩了就 commit + push，讓 Vercel 自動部署

**不要每一步等使用者回覆**。批次改到穩再 push（見 `feedback_self_iterate.md`）。

## 已註冊的家具類型（`lib/templates/index.ts`）

stool / bench / tea-table / side-table / low-table / open-bookshelf / chest-of-drawers / shoe-cabinet / display-cabinet / dining-table / desk / dining-chair / wardrobe / bar-stool / media-console / nightstand

URL 模式：`/design/<category>`、`/design/<category>/print`、`/design/<category>?beginnerMode=1`

## 相關 memory

要知道更多背景看：
- `project_wooden_ren_designer.md` — 整體架構
- `project_wooden_ren_geometry_conventions.md` — visible vs tenon、Euler、winding
- `project_wooden_ren_joinery_standards.md` — 1/3 厚、2/3 長等正規比例
- `project_wooden_ren_joinery_rendering.md` — details.tsx 每種 renderer 的現況

## OptionSpec 必須帶 `group`
每個 OptionSpec 物件加 `group: "leg" | "top" | "apron" | "stretcher" | "drawer" | "door" | "back" | "misc"`，UI 會用這個分色塊、同部件放一起。沒帶就落到「其他」。加新家具時**一開始就分群**，別整包丟進去。

## 榫頭 position 與切料維度對應（踩過雷）
`cut-dimensions.ts` 用 `position` 決定 tenon overage 加到哪個維度：
- `start` / `end` → `length`
- `left` / `right` → `width`
- `top` / `bottom` → `thickness`（**local Y 軸**，不是 "world 上下"！）

所以 legs 這種 thickness = legHeight 的零件用 `top` 沒問題（thickness 就是長軸），但 **面板類**（案體側板、椅背板條）visible.length 才是長軸，要用 `start` / `end`。之前 case-furniture 側板用 `top`，結果 18mm 側板切料列 40mm，踩過這雷。

## 案體櫃 3-zone / 多欄分層
`case-furniture` builder 新增兩個互斥 layout 機制：
- `zones: CabinetZone[]` — 縱向分層（下→上）。每 zone 可為 drawer/door/shelves/open/hanging。`zone-helpers.ts` 的 `makeZoneOptions` + `resolveZones` 幫忙組 OptionSpec。中層高度自動填滿（其他櫃類 display-cabinet / wardrobe / chest-of-drawers / shoe-cabinet / open-bookshelf 都用這模式）。
- `columns: CabinetColumn[]` — 橫向分欄（左→右）。當 columns 存在時 zones 失效。媒體櫃用來做 h-2col / h-3col。

**zones 模式下 shelfFractions 會 auto-populate**：zone boundaries + 抽屜 zone 內部分隔板 + 層板 zone 內部層板 的 Y 比例都加進去，讓側板產生對應母榫眼，extract.ts 才能把 `下層抽屜分隔板 ↔ 左側板` 這類關係解析出來。**不會重複畫**，因為 legacy shelf 渲染有 `suppressLegacyShelfRender` guard。

## extract.ts 匹配規則
母子榫匹配需符合：
- `length` tolerance < 3mm
- `wideTol` 固定 9mm、`thinTol` 固定 3mm
- `optionA` 或 `optionB` 單一方向一致（不是任意軸 OR 任意軸）
- 跳過「鏡像對」（兩部件 visible dims 完全相同，通常是左右側板那種）

踩過的雷：
- 寬容許值太寬 → 分隔板誤配到頂/底板（10mm diff 也通過）。現在 9mm 擋掉。
- 允許任意軸匹配 → 兩個 mirror pair 側板互抓。現在必須同向。

## 2D 三視圖 X 軸翻轉
`projectPart` 的 front + top 視圖有 `-x - xExt/2`，把世界 +X 映射到 SVG 左側，跟預設 3D 相機方向一致。side view 不翻（用 Z 軸）。加新 shape 時記得 splayed 的 `dxMm` 也要負號。

## 條件顯示 `dependsOn`（必填規則）

OptionSpec 的 `dependsOn` 已經啟用（commit `b653cbb`）。**任何 option 只在某條件下才有意義時，必須加 `dependsOn` 隱藏不適用的情境**，避免使用者調了參數但對結果沒影響的錯亂感。

`OptionDependency` 支援 3 種 evaluate（`lib/types/index.ts` 的 OptionDependency）：
- `{ key, equals: value }` — 父選項值必須等於 value 才顯示（select 用 `"splayed-tapered"` 字串、checkbox 用 `true`）
- `{ key, notIn: [values...] }` — 父選項值不在排除清單時才顯示（select 用，例如「除了 pedestal/trestle 都顯示」）
- `{ key }` 沒帶 equals/notIn — 父選項 truthy 才顯示（最常用：checkbox 父子）

**Reactivity**：form 的 `onChange` 觸發 debounced URL push（`DesignFormShell`）→ Next.js re-render → `optionValues` 從 URL 重新讀取 → `isVisible` 重新 evaluate。select / checkbox 都正常 reactive，**不會踩當年那個父子 race condition** 的雷（已用 URL params 取代 client-side state）。

**常見 pattern**：
- 牙板 / 橫撐子選項：`dependsOn: { key: "withCenterStretcher", equals: true }` 或 `{ key: "withCenterStretcher" }` (truthy)
- 外斜角度：`dependsOn: { key: "legShape", equals: "splayed-tapered" }`（或 `notIn: ["box","tapered","round",...]` 排除清單）
- 結構切換時的整組無關選項：`dependsOn: { key: "legShape", notIn: ["pedestal", "trestle"] }` 整批 8 個 option 都標
- 抽屜尺寸：`dependsOn: { key: "drawerCount" }`（drawerCount > 0 為 truthy → 顯示）
- 椅背樣式相依：slat 數只在 `backStyle === "slats"`、ladder 數只在 `"ladder"`、splat 寬只在 `"splat"`

**加新 option 一定先想：「這個值在哪些情境下有意義？」** 其他情境設了沒用就要 `dependsOn` 藏掉。

**例外**：基本尺寸（length / width / height / material）一律不藏。整體尺寸跟材質永遠都有意義。

## `reactStrictMode: false`（踩過雷）
`next.config.ts` 關著 strict mode，**不要打開**。r3f Canvas 在 dev 雙掛載時第一個 WebGL context 被清掉後，Chromium 來不及給第二個 context，透視圖整個空白（console 會看到 `THREE.WebGLRenderer: Context Lost`）。prod build 不雙掛載，所以關它對生產 0 影響。

## 裁切計算器 `lib/cutplan/`（踩過雷）
URL：`/design/<類別>/cut-plan`。1D 實木 FFD + 2D 板材 shelf 法。

- **三邊排序**：`group.ts` 把 `cut.length/width/thickness` 降冪成 `長/中/短` 才當作 `(length, width, thickness)`。因為 visible dims 是幾何軸不是木工語意——立柱的長邊在 thickness、面板的長邊在 length，直接用會把 4 支 35×35×425 的腳誤分到「35×425mm 橫截面」。
- **grouping key**：實木 = `material|width|thickness`；板材 = `billable|thickness`
- **stockLength auto-shrink**：FFD 先用最大允許長度開 bin，全排完後每支 bin 縮到「>= usedLength 的最小允許長度」——符合實際店面「切到剛好」的作法
- **sheet shelf 法不旋轉零件**：長邊一律沿板長（x 軸），為了纖維方向可控。要支援旋轉再加 toggle。

## 常見任務

- **加新家具**：寫 `lib/templates/<name>.ts` → 在 `index.ts` 註冊 category + options + template → 在 `lib/types/index.ts` 加進 `FurnitureCategory` union；options 每一條記得帶 `group`
- **加新榫卯類型**：`lib/types/index.ts` 加進 `JoineryType` union → 在 `details.tsx` 寫 renderer function → 加進 `RENDERERS` map → `JOINERY_LABEL` / `JOINERY_DESCRIPTION` 補中文說明
- **改三視圖**：`lib/render/svg-views.tsx`
- **改 3D**：`components/PerspectiveView.tsx`

## 踩到新雷要更新這份 skill

這份 skill 是活的。迭代過程學到新慣例、新陷阱、新工作流，直接編輯 `.claude/commands/wrd-dev.md`（repo 內）把它寫進去並 commit，多台電腦透過 git pull 自動同步。
