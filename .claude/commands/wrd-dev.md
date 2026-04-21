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

## 常見任務

- **加新家具**：寫 `lib/templates/<name>.ts` → 在 `index.ts` 註冊 category + options + template → 在 `lib/types/index.ts` 加進 `FurnitureCategory` union
- **加新榫卯類型**：`lib/types/index.ts` 加進 `JoineryType` union → 在 `details.tsx` 寫 renderer function → 加進 `RENDERERS` map → `JOINERY_LABEL` / `JOINERY_DESCRIPTION` 補中文說明
- **改三視圖**：`lib/render/svg-views.tsx`
- **改 3D**：`components/PerspectiveView.tsx`

## 踩到新雷要更新這份 skill

這份 skill 是活的。迭代過程學到新慣例、新陷阱、新工作流，直接編輯 `.claude/commands/wrd-dev.md`（repo 內）把它寫進去並 commit，多台電腦透過 git pull 自動同步。
