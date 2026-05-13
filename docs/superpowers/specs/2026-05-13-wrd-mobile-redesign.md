# wrd 手機版重設 — Design Spec

- **Date:** 2026-05-13
- **Author:** 木頭仁 + Claude
- **Status:** Approved（待 review 後進 plan）
- **Scope:** wrd 整套（設計頁、報價頁、裁切頁）的手機版重新設計，桌面版維持現狀

## 動機

5 個機器人手機 UX 試用（390×844）發現整套體驗在手機不順手，使用者「頁面跳來跳去」「3D 占畫面一半 + 鍵盤打開根本沒辦法輸入」「找不到下一步」。痛點分 6 類：阻塞 bug、排版、流程跳轉、第一眼困惑、浮動元素干擾、手機特有問題。詳細見 `.superpowers/brainstorm/4707-*/content/findings-synthesis.html`。

## 第一性原理

**手機 = 預覽 / 詢價 / 分享 device，不是 design device。**

使用者開手機 wrd 想做的三件事：
1. **看一個尺寸的家具長怎樣 + 多少錢**（10 秒任務）
2. **當場跟客戶/同學/老師分享**（一鍵 LINE / 連結）
3. **存起來回家繼續做**（細節微調是 desktop 任務）

設計推論：把「調榫卯/門板/抽屜/橫撐」這些 design 動作收進進階 sheet，預設摺疊。

## 硬規範

- **3D 容器最多 1/3 螢幕高**（844 → max 280px）
- **鍵盤展開時不能擋表單**（3D 可 swipe 收成 60px mini）
- **觸控目標 ≥ 44px**（Apple HIG）
- **字級 ≥ 14px**（核心資訊；輔助資訊 ≥ 12px）
- **URL 不變**（分享連結 / SEO / 書籤 / 報價短碼相容）
- **桌面版不重寫**（用 CSS `md:` 切換）

## Hotfix（已落地，commit `1790cac`）

1. **DesignFormShell**：number/text input 改 blur/Enter 送，避免 500ms debounce 打到一半被 clamp（後續 user 補強區分 spinner vs 鍵盤輸入）
2. **material URL 驗證**：parse-search-params + quote page 對 MATERIALS keys 驗，無效值 fallback walnut，不再爆 hardness undefined
3. **steps/derive + tools/derive**：hardness lookup optional chain
4. **PhotoToParamsButton**：沒 API key 整顆 return null（不顯示「待設」灰按鈕）
5. **DEFAULT_BRANDING**：清空公司資訊，避免多租戶 SaaS leak 木頭仁地址到別人客戶版

## 新架構：5 層資訊層級

### L0 · 永遠顯示
- Top app bar（56px）：← 回 · 標題 · ⋯ 更多
- Sticky bottom bar（72px）：總價 + 重量 · `💰 報價` · `📲 LINE`

### L1 · 主表單（無需點開）
- 3D viewer（max 280px，可 swipe 三狀態：60px mini / 280px 預設 / 全螢幕）
- 風格 chip 橫滑列（8 preset）
- 長 × 寬 × 高（雙模式 RangeInput — 滑桿 + 數字 chip，拖快速 / 點 chip 叫鍵盤精準）
- 材料 dropdown
- `💾 儲存` · `⚙ 進階設定`

### L2 · 折疊區段（標題點開）
- ▼ 三視圖（縮圖 → 點放大 sheet）
- ▼ 材料清單（按組 8 類）
- ▼ 工法 · 工序 · 工具清單（3 合 1）
- ▼ 建議與警告（StyleMismatch / ErgoHints / SuggestionsBox 合併）

### L3 · 進階設定 bottom sheet（⚙ → 全螢幕 4 tab）
- **結構**：腳 / 牙板 / 橫撐 / 抽屜 / 門板
- **美學**：邊緣 / 把手 / 五金 / 木紋
- **榫接**：組裝版 / 傳統榫卯 · 細節圖
- **場景**：純白 / 北歐 / 日式 / 工業 / 中式 · 視角 · 線框

### L4 · ⋯ 更多 overflow
- 裁切單（cut-plan sheet）
- 材料 CSV 下載
- 分享連結 / QR code
- 列印 / PDF（手機建議改寄 email — phase 2 補）
- AI 優化建議

### 砍掉 / 重藏
- 場景/透視/線框/視角 3 列 chips → L3「場景」tab
- 頂部 5 個動作鈕 → 拆到 L0 / L1 / L4
- /quote、/cut-plan、/quote/print 三個獨立 mobile 入口 → 全變 sheet（URL 仍保留）

## 路由策略

URL 不變。同 URL 兩種 render，CSS 切換：

| URL | 桌面 | 手機 |
|---|---|---|
| `/design/[type]` | 現有設計頁 | MobileShell · 主表單 |
| `/design/[type]/quote` | 現有報價頁 | MobileShell · 報價 sheet 預開 |
| `/design/[type]/cut-plan` | 現有裁切頁 | MobileShell · 裁切 sheet 預開 |
| `/design/[type]/quote/print` | A4 列印版 | 仍走桌面版 |

實作：
```tsx
<DesktopLayout className="hidden md:block">{/* 現有 */}</DesktopLayout>
<MobileShell className="md:hidden">{/* 新 5 層 */}</MobileShell>
```

不用 UA sniff、不會閃版、橫向旋轉自動切桌面版。斷點 768px。

## 元件清單

### 沿用（不改）
- `LazyPerspectiveView`、`ZoomableThreeViews`、`ZoomableJoineryDetail`
- `MaterialListWithSelection`、`ToolList`、`BuildSteps`
- `StylePresetButtons`、`SizePresetButtons`、`HeightToSizeButton`、`EdgePresetButtons`
- `DesignFormShell`（已含 blur/Enter 邏輯）
- 所有 `lib/templates/*`、`lib/joinery/*`、`lib/render/*`

### 新建（mobile 專用）
- `components/mobile/MobileShell.tsx` — 主架，包 L0–L4
- `components/mobile/StickyBottomBar.tsx` — L0 底部 toolbar
- `components/mobile/CollapsibleSection.tsx` — L2 折疊容器
- `components/mobile/AdvancedSheet.tsx` — L3 4-tab 全螢幕 sheet
- `components/mobile/QuoteSheet.tsx` — 報價 sheet（包現有 quote 頁邏輯）
- `components/mobile/CutPlanSheet.tsx` — 裁切 sheet
- `components/mobile/RangeInput.tsx` — 雙模式滑桿 + 數字 chip（取代 number input）
- `components/mobile/ViewerSizeToggle.tsx` — 3D 三狀態切換（phase 3）
- `hooks/useKeyboardAware.ts` — visualViewport API 偵測鍵盤（phase 3）

#### RangeInput 規範
- 連續參數（長/寬/高/腳粗/牙板寬厚）：滑桿 + chip
  - 長/寬/高 snap 10mm，接近 50/100 mm 整數自動吸附
  - 腳粗 / 牙板 snap 2mm
  - 角度 snap 0.5°
- 整數參數（抽屜數/層數）：stepper ＋−
- 離散選項（材料/風格/工法）：chip 橫滑列
- boolean：switch toggle
- 拖滑桿時 3D 跟著動（透過現有 URL state debounce 200ms）
- 點 chip 叫鍵盤精準輸入（沿用 DesignFormShell blur/Enter 邏輯）
- 長按滑桿顯示 min/max tooltip
- 用 `react-aria` 的 `useSlider` 確保 accessibility（鍵盤箭頭、screen reader）

## 漸進切換 — Phase 1–4

### Phase 1 · MVP
- 新建 MobileShell + StickyBottomBar + CollapsibleSection
- 新建 RangeInput（雙模式滑桿 + chip），全 mobile 數值欄位用它
- L0/L1/L2 落地，3D 固定 280px（不做 swipe）
- L3 AdvancedSheet 4 tab
- Feature flag `?ui=v2` opt-in
- **驗收**：`/design/stool?ui=v2` 在 390×844 一頁可完成「看 3D / 拖滑桿改尺寸 / 看價 / 開進階」全流程，且全程不用打鍵盤就能調 50% 以上場景

### Phase 2 · 整合 quote / cut-plan sheet
- QuoteSheet + CutPlanSheet 落地，從 L0 / L4 開
- 報價傳 LINE / 複製連結在 sheet 內完成
- 桌面路由仍可獨立進（SEO 不變）

### Phase 3 · 互動進化
- ViewerSizeToggle 3D swipe 三狀態
- useKeyboardAware 偵測鍵盤自動縮 3D
- 全站觸控目標 ≥ 44px / 字級 ≥ 14px audit
- `?ui=v2` 從 opt-in 改 default

### Phase 4 · 收尾
- `?ui=v1` 變 escape hatch
- 3 個月後 v1 deprecate

## Acceptance Criteria

### Phase 1 驗收
- [ ] iPhone 14 (390×844) `/design/stool?ui=v2` 首屏看到：3D + 風格 + 尺寸 + 底部報價 bar
- [ ] 設計頁 full height ≤ 2400px（從 5213 → 2400，降 54%）
- [ ] 進階設定點開可改腳/牙板/榫卯，關閉回主表單
- [ ] 觸控按鈕全部 ≥ 44px，字級全部 ≥ 12px
- [ ] sticky bottom bar 一直顯示 NT$ 總價
- [ ] **拖滑桿可改長/寬/高/腳粗，3D 即時跟著動**
- [ ] **點 chip 開鍵盤可精準輸入**
- [ ] desktop 版（≥ 768px）行為完全不變

### Phase 2 驗收
- [ ] 點底部 `💰 報價` 開 QuoteSheet（不換 URL，URL 自動更新到 `/quote`）
- [ ] QuoteSheet 內可填客戶資料、傳 LINE、複製連結
- [ ] 「⋯ 更多」→ 裁切單 / CSV / 列印 / QR / AI 建議
- [ ] 報價/裁切之間切換不重 load 3D bundle

### Phase 3 驗收
- [ ] swipe 3D 容器上下：60 / 280 / 全螢幕三狀態
- [ ] 鍵盤展開時 3D 自動收 mini
- [ ] 觸控/字級 audit 全綠

## 風險

- **Bundle 大小**：手機/桌面兩份 DOM 共存 → 用 `dynamic import` 把 L3 sheet / QuoteSheet lazy load，估 mobile chunk +~40KB
- **狀態管理**：URL state 是 source of truth（DesignFormShell 已用），不引入新 store
- **桌面 regression**：用 `hidden md:block` 隔離，自動 audit 跑 `npx tsx scripts/audit-overlaps.ts`
- **報價短碼相容**：Upstash redis 短碼仍指向同 URL，QuoteSheet 自動讀
- **平板**：採 Tailwind 預設 768px 斷點，iPad 直立（768px）走桌面版；Phase 1 完用 iPad portrait 實測，若擠迫再考慮 820px 斷點

## Out of scope

- 桌面版重排（保持現狀）
- PWA 安裝
- 離線模式
- 多語系
- 觸控手勢進階（pinch 縮放 3D 已由 OrbitControls 提供）
- 列印機直連手機

## References

- 痛點全景：`.superpowers/brainstorm/4707-*/content/findings-synthesis.html`
- 5 機器人原始回報：`/private/tmp/.../tasks/{a2f5a*,a13cf*,a3a49*,ae2d7*,a0553*}.output`
- AGENTS.md 已查 §A10 平接 / §O 人體工學 / §N 五金孔位（本 spec 不動幾何）
- 相關 memory：`feedback_first_principles_redesign.md`、`feedback_responsive_verify_both_viewports.md`、`feedback_fixed_full_width_css_trap.md`、`feedback_frameloop_demand_invalidate.md`、`feedback_view_render_bug_propagate.md`
