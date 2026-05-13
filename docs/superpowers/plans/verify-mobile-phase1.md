# wrd 手機版 Phase 1 驗收報告

**Date:** 2026-05-13
**Tested commit:** 6b6bdbaf9ebd5b69016ee100d87aae93307eed91
**Viewport:** 390×844 (iPhone 14), 1280×800 (desktop)

## Acceptance Criteria 結果

| # | 條件 | 結果 | 說明 |
|---|------|------|------|
| 1 | iPhone 14 首屏：MobileTopBar + 3D + 風格 chips + 尺寸 RangeInputs + 底部報價 bar | ✅ | `←方凳⋯` TopBar、風格6顆 chip、長/寬/高 slider+chip、`NT$ 12,066` fixed bottom bar 全部首屏可見 |
| 2 | 設計頁 full height ≤ 2400px | ✅ | `document.body.scrollHeight = 1720px` |
| 3 | ⚙ 進階設定：4 tab 全部有內容 + ✕ 關閉回主表單 | ✅ | 結構/美學/榫接/場景 4 tab 點開皆有內容；榫接/場景為 phase 2 placeholder；✕ 後 `dialog` 消失 |
| 4 | 觸控按鈕 ≥ 44px + 字級 ≥ 12px | ⚠️ | 按鈕高度全過（`✅ tap targets all ≥44px`）；**字級部分 fail**：helper/hint `<span>` 有 10–11px（「場景」「透視」「線框」等 11px、說明文字 10px，共 40+ 條） |
| 5 | sticky bottom bar 一直顯示 NT$ 總價 | ✅ | `position: fixed; bottom: 0px`，scroll 到底後 `rect.bottom === 844 === viewport_height` |
| 6 | 拖滑桿可改長/寬/高/腳粗，URL 即時更新 | ✅ | native setter + `input`/`change` event → URL `?length=500` 即時更新；range max 500 clamp 正確 |
| 7 | 點 chip 開鍵盤精準輸入，URL 更新 | ✅ | 點 `350mm` chip → number input visible；set 420 + blur → URL `?length=420` |
| 8 | desktop ≥ 768px 行為完全不變 | ✅ | 1280×800 無 `?ui=v2`：無 MobileTopBar/MobileShell/fixed bottom bar，`<main>` 正常渲染；`?ui=v2` 加上：fixed bottom bar `height=0`（CSS hidden），mobile 元件全 `display:none` |

**整體結果：7/8 ✅，1/8 ⚠️（字級 helper text）**

### 字級問題詳細

觸控目標全數通過，字級 fail 的全部是**非互動輔助文字**（hint/tooltip span、說明段落），不影響核心操作：

- `場景` / `透視` / `線框` label spans：11px
- 進階設定中各欄位說明文字（「影響材料單與接合工序」等）：10–11px
- `約 5.3 kg` 等輔助資訊：10px

此問題在 Task 11 a11y audit 已知，`max-md:min-h-[44px]` 修的是按鈕高度，**hint text 的字級未一起修**。Phase 1 驗收等級：**非阻塞**（hint text 可讀性邊緣，但非主要互動路徑）。

---

## Known limitations (Phase 1)

- **拖滑桿即時改 URL**：依賴 native setter + `input`/`change` event 強制觸發；React controlled input 需此 workaround
- **hint text 字級**：10–11px `<span>` 輔助說明文字未達 12px spec，Phase 2 統一修
- **/quote、/cut-plan、/print** 仍是獨立 routes（Phase 2 改 bottom sheet）
- **場景 tab** 在 AdvancedSheet 是 placeholder（Phase 2 整合視角/線框設定）
- **榫卯細節圖** 在 AdvancedSheet 榫接 tab 是 placeholder（Phase 2）
- **3D 高度固定** 280px，swipe 縮/放大全螢幕留 Phase 3
- **ViewerSizeToggle、QuoteSheet、CutPlanSheet** spec 列為 Phase 2，Phase 1 未實作

---

## Files changed in Phase 1

### 新建元件
- `components/mobile/RangeInput.tsx` — 雙模式 slider + chip，`0227e00`
- `components/mobile/StickyBottomBar.tsx` — fixed bottom bar 總價+報價+LINE，`5061a16`
- `components/mobile/CollapsibleSection.tsx` — native `<details>/<summary>` 折疊，`5ce2d91`
- `components/mobile/AdvancedSheet.tsx` — 4-tab 全螢幕 overlay，`a1d383a`
- `components/mobile/MobileTopBar.tsx` — sticky top bar 56px，`c5c0569`
- `components/mobile/MobileOverflowMenu.tsx` — L4 ⋯ bottom sheet，`13221d3`
- `components/mobile/MobileOptionField.tsx` — MobileOptionField using RangeInput，`b0bde9a`
- `components/mobile/MobileShell.tsx` — L0/L1/L2/L3/L4 整合，`812dcb1`

### 修改檔案
- `app/design/[type]/page.tsx` — `?ui=v2` flag + MobileShell wire-up，`2506c86`
- `components/design/DesignFormShell.tsx` — PRESERVE_KEYS + ui + ShoeCabinetCoupling 提取，`2506c86`
- Tailwind config / globals（`max-md:min-h-[44px]` a11y scope fix），`ce8b2be`

---

## Commits

| SHA | Message |
|-----|---------|
| `0227e00` | feat(mobile): add RangeInput dual-mode slider+chip |
| `5061a16` | feat(mobile): add StickyBottomBar with price + quote + LINE |
| `5ce2d91` | feat(mobile): add CollapsibleSection (native details/summary) |
| `a1d383a` | feat(mobile): add AdvancedSheet (4-tab full-screen overlay) |
| `c5c0569` | feat(mobile): add MobileTopBar (sticky top, 56px) |
| `13221d3` | feat(mobile): add MobileOverflowMenu (L4 bottom sheet) |
| `b0bde9a` | feat(mobile): add MobileOptionField using RangeInput for numbers |
| `812dcb1` | feat(mobile): assemble MobileShell with L0/L1/L2/L3/L4 layers |
| `2506c86` | feat(mobile): wire MobileShell into /design/[type] under ?ui=v2 |
| `e092036` | fix(mobile): a11y audit pass — tap targets ≥44px, fonts ≥12px, price round |
| `ce8b2be` | fix(mobile): scope a11y min-h to mobile only (max-md:min-h-[44px]) |
| `6b6bdba` | ux(shoe-cabinet): 「數量」依類型拆 3 個 label（HEAD at test time） |
