<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# 製圖 / 幾何 / 報價 公式集 = `docs/drafting-math.md`

碰到下列任何 code 前**必須先 grep `docs/drafting-math.md` 對應 section**，
提案要引用 § 編號（不引等於沒做）：

- `lib/render/svg-views.tsx` — 三視圖 → §A
- `lib/render/geometry.ts` — silhouette / projection → §A1, §A9
- `components/.../details.tsx` — 榫卯細節圖 → §B, §G
- `lib/pricing/*` — 報價 / 工時 / 材積 → §X, §AG, §T
- `lib/knowledge/style-*` / 古家具參數 → §AB
- `lib/templates/*` 任何家具 → §K（派系）, §L（木紋）, §M（撓度）, §O（人體工學）
- `lib/templates/*` 改 `visible.length` / 牙板長度 / 抽屜尺寸 → **§A10 (butt-joint 慣例)** ⭐
- `lib/templates/beginner-mode.ts` / `useButtJointConvention` flag → §A10.6

doc 開頭有 grep keyword 索引表，動手前花 30 秒查：
```bash
grep -nE "<keyword>" docs/drafting-math.md
```

⚠️ **doc 軸慣例（z 上 y 後）跟 code（y 上 z 後）不一樣**——doc 開頭有對照表，
讀公式時心裡換軸。撞到 doc/code 衝突先停下、問使用者哪邊為準。

修完發現新公式 / 新規則 → **回頭補進 doc 對應 section**，下個 dev / 下次 session
才看得到。

## ⭐ 加 / 改家具模板必跑 audit（butt-joint 迴歸）

`scripts/audit-overlaps.ts` 跑遍所有 `FURNITURE_CATALOG`，組裝版（預設）下偵測
零件 AABB 穿模。改完任一 `lib/templates/*` 後執行：

```bash
npx tsx scripts/audit-overlaps.ts
```

- 想加新家具：照 §A10 寫 visible.length（butt-joint length），design 設
  `useButtJointConvention: true`，audit 必須 0 overlaps
- 改舊家具：跑 audit 比較 before / after，數字不能變多
- 偵測精準：AABB 快速 reject + OBB SAT 確認，非 90° 旋轉零件也準（見 §A10.7）

## 卡住 / 改不好時也要查 doc（不要瞎試）

下列訊號出現 → **先停手 grep doc**，不要靠直覺亂改：

- 改 2-3 次還不對、使用者說「沒改好」/「還是怪怪的」/「還是失敗」
- 自己也覺得邏輯沒把握、要靠多次 trial & error 收斂
- 不確定某個視覺問題是「幾何錯」還是「投影錯」還是「camera 角度錯」
- 某個值（座高 / 靠背角 / 腳間距 / 板厚）不確定多少才合理
- 撞到「換軸 / 換座標系」的奇怪 bug

doc 3760 行涵蓋很多 edge case：
- 視覺扭曲 / silhouette 不對 → §A 三視圖, §A9 非 quarter rotation
- 椅子坐起來不舒服 / 不穩 → §O 人體工學, §V 椅子穩定性力學
- 板會撓 / 結構斷 → §M 撓度, §L 木紋方向
- 古家具型態怪怪 → §AB 明清 20 款圖譜
- 報價算錯 → §X 報價演算法, §T 台灣木材規格
- 五金孔位 / 抽屜尺寸 → §N 五金孔位

**規則：** 改第 2 次還不對，第 3 次出手前必 grep doc，不能直接再改。

---

# ⭐ 加 / 改任何功能的固定程序（2026-08-24 訂）

木頭仁：「每當新增了一個功能，以上就是該做的一系列操作。」
這份是從「兩向弧肩」那次完整跑過一遍萃取出來的。**不是建議，是清單。**

漏掉哪一步的後果都寫在旁邊了 —— 那些不是假設，全是實際踩過的。

## 0. 動手前

- [ ] **先 grep `docs/drafting-math.md`**，找對應 § 並在提案裡引編號。
      doc 沒有規格就**先寫規格再寫程式**（插肩榫那次就是這樣做的）。
- [ ] 撞到 doc / code 衝突 → **停下來問**，不要自己選一邊。

## 1. 做出來

- [ ] 新選項一律 **預設關閉 / 預設值不變**。舊設計一格都不能動。
- [ ] 夾制寫在**讀選項的那一行**（§A10.11），不是下游。
- [ ] **夾了要出聲**（§A10.11 第 2 條）。靜默改掉使用者的值 = 他以為滑桿壞了。
- [ ] 同一個判斷**只能有一套**。發現第二套 → 讓下游吃上游，不要各算各的。

## 2. 接線（最容易只做一半）

- [ ] 走**共用 builder** 的模板要一起接。⚠️ 兩向弧肩那次 9 款只接了 3 款，
      其餘 5 款「選項是死的」，導致上一輪的「0 問題」是假的。
- [ ] 檢查方式：寫個探針確認**每一款**都真的吃到新值，不要靠讀 code。
- [ ] 三視圖有**兩條路徑**（`projectPartSilhouette` / `projectPartPolygon`），
      只改一條 → 三視圖跟零件圖對不起來。
- [ ] ⭐ **手機版要用真的瀏覽器開一次**（`devices["iPhone 13"]`），不能只看 HTML 有沒有那串字。
      新選項在手機的「進階設定」面板裡，那個面板只有約 287px 高、內容 2400px+，
      而右下角的浮動鈕（`BugReportFab`，`fixed bottom-24 z-50`）會**壓在右側控制項上**。
      實測曾有 91 個互動元件中 21 個被蓋住、點下去拿到的是浮動鈕。
      驗法：捲到該選項 → `document.elementFromPoint()` 看最上層是誰 → 真的點一次看網址有沒有變。

## 3. 下游全掃（六種輸出）

新幾何 / 新選項一定要跑過這六種，每種都要 **on / off 兩版對照**：

| 輸出 | 怎麼驗 |
|---|---|
| 三視圖 | 輪廓點數、NaN、面積 |
| 裁切圖 | 排不排得下、尺寸合法、台灣買不買得到（§T3/§T4） |
| 零件圖 / 套料 | viewBox 合法、無 NaN、線不出料件 |
| CNC（榫孔加工面）| `npm run audit:machining`，線不能畫到料件外 |
| 向量（1:1 實尺模板）| `npm run audit:template-pack`，每頁 A4、標 mm、有造型的面要印得出輪廓 |
| 印表機（列印頁）| SSR render 驗，⚠️ 直接 curl 會被**付費牆**擋，看到 0 個 SVG 不代表壞了 |
| 3D 匯出 | 0 頂點 / NaN / 退化面 |

## 4. 錢與工

- [ ] **材積**有沒有變？（挖掉的造型**不會**增加用料 —— 我曾把這句寫錯進 UI）
- [ ] **工時**有沒有跟著變？新工序要進 `lib/steps/derive.ts`，
      否則 `quote.ts` 吃 `totalEstimatedHours()` 算工資 = 這道工白做。
- [ ] 工時要**隨數量 / 面數線性放大**，不可以寫死。

## 5. 中英文

- [ ] `lib/templates/spec-labels.ts`：`SPEC_LABEL_EN` + `SPEC_HELP_EN`
- [ ] 新工序：`lib/steps/translations.ts` 的 `STEP_OVERRIDE_EN`
      ⚠️ 翻譯是 `translateSteps()` 做的，`deriveBuildSteps()` **不吃 locale**
- [ ] 沒補的話不會壞畫面（fallback 回中文），但英文站看到中文。

## 6. 相容性（木頭仁最在意的一條）

- [ ] **28 款預設值下的零件逐件比對，必須 100% 相同**
- [ ] `npm run audit:legs` —— 165 組（家具 × 腳型）指紋一組都不能動
      （只驗預設值**涵蓋不到**其他腳型，這是那支存在的理由）
- [ ] 會改到既有設計的話，**先查資料庫有幾筆受影響**再決定
- [ ] 網址往返：新選項存得進網址、讀得回來、舊設計沒有那個 key 也不會爆

## 7. 驗證（沒做這步等於沒驗）

- [ ] **每支探針都要先注入假錯誤確認它會紅。** 抓不到假錯誤的 0 一律不算數。
- [ ] **變異測試**：把新寫的邏輯一條條改壞，確認測試真的變紅。
- [ ] 測試的期望值要**手算**，不要把程式輸出貼上去。
- [ ] 反向測試：合理的輸入**不可以亂噴警告**（別把閘關過頭）。
- [ ] 全套：`npx tsc --noEmit` / `npx vitest run` / `npm run audit` /
      `npx tsx scripts/audit-overlaps.ts` / `audit-joints.ts` / `npx next build`

## 8. 收尾

- [ ] 規則寫回 `docs/drafting-math.md` 對應 § + **開頭 grep 索引表**
- [ ] 值得長期守的檢查 → 寫成 `scripts/audit-*.ts` 並接進 `npm run audit`
- [ ] commit 只 `git add` 這次動到的檔（**絕不用目錄層級的 add**）
- [ ] push 後輪詢 Vercel + 兩個 CI 到綠，再回報

## ⚠️ 這輪反覆踩到的探針陷阱（每次都要提防）

1. **欄位名用猜的** —— `position` vs `origin`、`m.height` vs `m.length`、
   `SPEC_LABELS_EN` vs `SPEC_LABEL_EN`。先 `console.log(Object.keys(x))`。
2. **函式簽名用猜的** —— `partMachiningFaces` 第二參數是衍生榫眼、第三個才是 frame。
3. **零件是帶旋轉的** —— 用 `visible` 大小猜方向會全錯，要看 `rotation.y`。
4. **同一條規則抄了好幾份** —— `shoulder` 夾制在 3 個檔案各一份，
   改一份不會全動，做變異測試時很容易改到錯的那份而誤判「稽核壞了」。
5. **回 null / 被丟棄不一定是 bug** —— `planA4Tiles` 超過 6 張就刻意不出樣板；
   成型線超出料件範圍會整條丟掉。**先讀註解再報**。

---

# 家具設計器：加新家具種類的 SOP

每次新增家具種類（FurnitureCategory）必走完這 4 步，否則「風格快速套用」按鈕的覆蓋會缺一塊。

## 1. 加 template
- `lib/templates/<new-category>.ts` 寫 OptionSpec[] + builder 函式
- 在 `lib/templates/index.ts` 註冊
- 在 `lib/types/index.ts` 的 `FurnitureCategory` union 加上字串

## 2. 加 base style coverage（自動 ✓）
做完上面就夠 60-70% 風格差異——`STYLE_PRESETS[id]` 的 base params（legShape /
legSize / legEdge / material / apronWidth / backStyle / seatProfile / splayAngle）
會被 `applyStylePreset()` 寫進 URL，UI 過濾後留下 template 有的 key。
**這部分不用手動做**。

## 3. 補 detail packs（半自動 ✓）

跑：

```bash
npm run gen-style-pack <new-category>
```

這個 script（`scripts/gen-style-pack.ts`）會：
- 讀新 template 的 OptionSpec[]（含 min/max/choices）
- 對 8 風格各打一次 `/api/style-suggest`（用 wood-master 知識的 SYSTEM_PROMPT）
- 產生 detail pack JSON 放在 `/tmp/style-pack-<category>.json`
- 印出建議 merge 進 `lib/knowledge/style-detail-packs.ts` 的 diff

**人工審改後** 把 JSON 段 paste 進 `style-detail-packs.ts`（每個 style 物件下加
`"<new-category>": {...}` 那一格），跑 `npx tsc --noEmit` 確認、commit。

需要 `ANTHROPIC_API_KEY`（local `.env.local` 或匯出）。

## 4. （可選）給 Windsor null

Windsor 是椅匠傳統，不做櫃 / 桌 / 小物件。如果新家具不是椅 / 凳 / bench，
在 detail packs 加 `"windsor": { "<new-category>": null }`。null 會跳過套用，
fallback 到 base preset。

## Why 這個流程

- base preset 是萬用層（任何 template 都套）→ 新家具立刻有 60-70% 風格差異
- detail pack 是 per-template 的 fine tune → 風格內聚力 + 視覺差異拉開
- 漏 step 3 → 風格切換時細部設定全 fallback 到 template default → 使用者
  看不出差別（典型抱怨：「8 風格看起來都一樣」）

---

# 家具設計器：完整網頁觸點 inventory（一條龍 SOP 補強）

§前面 4 步只 cover 模板程式碼層。**新增家具到「跟現有 26 件一致水準」還要動以下網頁/SEO/權限觸點**。漏掉就會出現「我加了模板，可是介紹頁/首頁/搜尋沒看到」。

## 家具 — 自動接的觸點（catalog-driven，不用動）

只要 §1 完成（lib/templates/index.ts 註冊 + FurnitureCategory union 加字串），下列**自動接**：

- `/app` 設計器內目錄卡（FURNITURE_CATALOG loop）
- `/templates` 索引頁分類群組（CATEGORY_GROUPS match 規則）
- `/design/<category>` 設計頁
- `/design/<category>/quote` 報價頁、`/quote/print` A4 列印
- `/design/<category>/cut-plan` 裁切計算器
- `/design/<category>/print` 列印工程包

## 家具 — 手動觸點（容易漏）

- **`lib/templates/marketing.ts`** — 加 marketing entry（tagline / whatItDoes / scenarios / fitFor / notFor / faqs / presets / howToSteps）。沒這個 → `/templates/<category>` 介紹頁不會 render，`/templates` 索引卡 tagline 顯示 fallback。
- **`FEATURED_TEMPLATE_CATEGORIES`** — 同檔。加進去 → sitemap 收 `/templates/<category>` 介紹頁 + SEO 升權。
- **`public/thumbs/v2/<category>.webp`** — 縮圖。沒這個 → `/app` `/templates` 卡片破圖。產法見其他家具 webp 對齊規格。
- **`lib/permissions.ts:FREE_UNLOCKED_CATEGORIES`** — 免費家具加進去；付費家具不動。
- **`app/sitemap.ts`** — `FURNITURE_CATALOG` 自動 loop 進 `/design/<c>`，但 `DEV_CATEGORIES` set 要審：開發中暫不收。
- **`lib/render/svg-views.tsx`** — 加 shape kind / 新零件 visual 時要動。普通家具用既有 shape 不用改。
- **`scripts/audit-overlaps.ts`** — `npx tsx scripts/audit-overlaps.ts` 必跑 0 overlap（butt-joint 迴歸防護，§A10）。

# 新增裝潢工具（ceiling / floor / raised-floor 同等級）的一條龍 SOP

裝潢工具**不走 FURNITURE_CATALOG**，沒有 catalog-driven 自動接駁。每個都要手動掛 8+ 個位置。漏一個就會出現「工具有，但訪客找不到 / SEO 沒收 / 卡片連錯」。

## 必做（缺一個都算半成品）

### 1. 算料引擎 & 工具本體
- `lib/<tool>/types.ts` `calc.ts` `presets.ts` `geometry.ts` — 算料引擎
- `lib/<tool>/cutting.ts` — 裁切計算（1D FFD / 2D shelf packing）
- `app/<tool>/<Tool>Client.tsx` — 互動 UI
- `app/<tool>/page.tsx` — 路由 + 權限分流

### 2. 雙頭路由（訪客銷售頁 + 登入工具）
`app/<tool>/page.tsx` **必走雙頭分流**，不要直接 `redirect("/login")`：

```typescript
const { data: { user } } = await supabase.auth.getUser();
if (!user) return <ToolMarketing status="guest" />;
if (isAdminEmail(...)) return <ToolClient />;
// ...檢查 plan + unlocks...
if (!planAllows && !boughtUnlock) return <ToolMarketing status="loggedInNoAccess" />;
return <ToolClient />;
```

**理由**：訪客直接 redirect 走 = 沒 SEO 入口、沒銷售漏斗。雙頭分流訪客看銷售頁、有權限直進工具。

### 3. 銷售頁 `app/<tool>/<Tool>Marketing.tsx`
仿 `RaisedFloorMarketing.tsx` 6 段結構：
- **Hero**（標題 / tagline / SVG 示意圖 / 主副 CTA）
- **痛點**（4 個 emoji 卡）
- **功能**（6 個 emoji 卡）
- **適合誰**（4 個職業 + 「不適合」灰底框）
- **FAQ**（6–8 題折疊）
- **最終 CTA gradient banner**

CTA URL 用 `status` prop 分流：
- `guest` → `/login?next=/<tool>`
- `loggedInNoAccess` → `/pricing?upgrade=<tool>`

### 4. metadata
`app/<tool>/page.tsx` 必補 `metadata.description`（SEO + 社群分享 preview）。

### 5. `app/templates/page.tsx` — `INTERIOR_TOOLS` 加一筆
- `id` / `nameZh` / `tagline` / `href` / `difficulty`
- `InteriorToolCard` 內 `tool.id === "..."` 分支加新工具的 SVG 圖示 or `<Image src="/thumbs/v2/<tool>.webp">`

### 6. `app/app/page.tsx` — 設計器內工具卡
新加 `<ToolCard>` 元件 + 在 unownedTools 列表加進去。仿 `CeilingToolCard / FloorToolCard / RaisedFloorToolCard`。

### 7. `app/sitemap.ts` — 加 `/<tool>` 靜態路由
優先級 0.85 對齊家具介紹頁。

### 8. 權限 / 解鎖 / 定價
- `lib/permissions.ts` — 加 `canUse<Tool>Tool` feature flag + plan 規則
- `lib/tool-unlocks.ts` — 註冊 unlockable id（若可單買斷）
- `app/pricing/...` — 補 plan 文案、單買斷卡

### 9. 文案散落點
- `app/page.tsx` 首頁個人版 features 文字（line ~386）— 補新工具名
- `/about` 介紹（如果有放工具區）— 補新工具

## 自動測試
1. `npx tsc --noEmit` — 0 新型別錯誤
2. **未登入**訪問 `/<tool>` → 看到銷售頁、CTA 連 `/login?next=/<tool>`
3. **已登入無權限**訪問 `/<tool>` → 看到銷售頁、CTA 連 `/pricing?upgrade=<tool>`
4. **已登入有權限**訪問 `/<tool>` → 直進工具
5. `/templates` 看到「裝潢工具」群組多一張卡，「了解更多 / 開始試算」雙鈕都連 `/<tool>`
6. `/sitemap.xml` curl 看 `/<tool>` 已收

## 為什麼包這個 SOP

裝潢工具不像家具有 catalog 自動接駁，**漏 §5 / §6 / §7 = user 在 `/templates` 找不到、SEO 找不到、`/app` 工具卡沒新工具**。歷史教訓：raised-floor 上線後一段時間，user 才發現 `/templates` 沒收（這份 SOP 就是衝著這個寫的）。
