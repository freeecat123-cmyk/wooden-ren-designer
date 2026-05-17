# 明式圈椅模板設計 (circle-chair)

**日期**：2026-05-14
**狀態**：設計核可，待轉 writing-plans
**來源**：台南魯班學堂 黃俊傑木工訓練教材「明式圈椅工作圖」（高級班，比例 1:1，第一角法）

---

## 1. 背景與目標

在木頭仁家具設計生成器（wrd）新增一個「明式圈椅」家具模板。圈椅是傳統家具中最難的一件——連續彎曲的椅圈、S 形鵝脖／聯幫棍／靠背板、楔釘榫五段攢接椅圈、後腿一木連做穿椅盤。

工作圖已由 6 支拆解 agent + 1 支牙條確認 agent 徹底拆解，結論：**技術可行**。`docs/drafting-math.md` 已備齊關鍵配方（§S7 椅圈曲線、§G1 楔釘榫、§AS BATT 法、§AB5「先框架後曲線」路線、§AT1.3 複斜角、§A9 非 90° 投影）；`lib/templates/bench.ts` 的 windsor 分支是現成的「圓料下錨、上端追彎木」骨架。

### 用途（決定 4 phase 的施力方向）
1. **木匠學院教學工具**——學員照著做，重點：榫卯細節圖、工法工序、材料單看得懂。
2. **生成器旗艦展示件**——證明生成器能做最難的傳統家具，重點：3D 透視圖、三視圖漂亮、可截圖發社群。

才積報價精準度排在這兩者之後。

---

## 2. 範圍

- **完整 4 階段一次設計**（本 spec 涵蓋終態 + 分階段路徑），實作計畫再按 phase 切。
- **忠實還原這把工作圖** + 2-3 個風格 preset。曲線參數**不**開放給使用者，鎖在圖紙比例、隨基本尺寸等比縮放。
- 建構策略採**方案 A（水平分層・漸進近似）**：先全零件用現有 shape 近似 → 漸進升級到真曲線 → 最後補榫卯細節圖。

---

## 3. 來源圖拆解摘要（圈椅是什麼）

### 整體尺寸（估算，mm）
| 項目 | 數值 |
|---|---|
| 座面高 | ~480 |
| 椅圈高（地面→扶手） | ~700–720 |
| 座面外框 | ~610（寬）× ~497（深） |
| 座框內框（裝座板開口） | 446 × 332 |
| 椅圈俯視外徑（包絡） | ~698 × 690 |
| 椅圈斷面厚 | 36（全圈一致，寬度沿弧漸變） |
| 側腳收分 | 約 4°（腿軸與地面夾角 ~86°） |

### 四大結構塊
1. **椅圈**——5 段攢接（上靠桿 ×1 + 中桿 ×2 + 左右桿 ×2），4 個接點全用**楔釘榫**。俯視近 ¾ 圓 + 兩端外撇成鱔魚頭扶手。圖紙頂端附「八種楔釘榫示意圖」。
2. **立柱・一木連做**——椅後腳（985mm）穿過椅盤繼續上延、頂端圓榫頂椅圈；椅前腳（715mm）一木連做、上段彎成鵝脖。
3. **S 曲線三件**——鵝脖（=椅前腳上段）、聯幫棍（鐮刀把弓形）、靠背板（**素獨板** S 形，非攢框、無雕花）。
4. **下盤**——攢邊框座面（446×332 裝硬木座板 + 1 根穿帶）、四圓腿側腳收分 ~4°、步步高管腳棖（前低後高）、踏腳棖、橫飾棖 + 角牙。

### 完整零件清單（材料單 18 種 / 34 件，淨料尺寸 mm）
| 項次 | 零件 | 淨料尺寸 | 數量 |
|---|---|---|---|
| 1.1 | 椅圈上靠桿 | 625×200×36 | 1 |
| 1.2 | 椅圈中桿 | 410×120×36 | 2 |
| 1.3 | 椅圈左右桿 | 350×110×36 | 2 |
| 2.0 | 靠背板 | 500×185×40 | 1 |
| 3.1 | 椅前腳（含鵝脖一木連做） | 715×60×39 | 2 |
| 3.2 | 椅後腳（一木連做穿椅盤） | 985×36×39 | 2 |
| 4.0 | 聯幫棍 | 380×50×30 | 2 |
| 5.0 | 前腳角牙 | 115×55×10(15) | 2 |
| 6.0 | 穿帶 | 346×35×35 | 1 |
| 7.0 | 座板（可拼板） | 446×332×15 | 1 |
| 8.1 | 前後大邊 | 615×91×39 | 2 |
| 8.2 | 左右抹頭 | 497×91×39 | 2 |
| 9.1 | 前後橫飾棖 | 535×48×21 | 2 |
| 9.2 | 左右橫飾棖 | 410×48×21 | 2 |
| 10.1 | 步步高升後棖 | 572×27×27 | 1 |
| 10.2 | 步步高升側棖 | 416×27×27 | 2 |
| 11.0 | 前腳棖（踏腳棖） | 595×65×36 | 1 |
| 12.0 | 橫飾棖角牙 | 76×60×10 | 6 |

**確認事項**：椅盤下方**無獨立牙條／券口牙板**——壼門曲邊輪廓是「橫飾棖（9.x）+ 橫飾棖角牙（12.0）」的合成，已由專門 agent 逐行核對材料單 + 正/側視/縱剖面定案。

---

## 4. 整體架構

### 新家具種類（走 AGENTS.md「加新家具 4 步 SOP」）
1. `lib/types/index.ts` 的 `FurnitureCategory` union 加 `"circle-chair"`。
2. 新檔 `lib/templates/circle-chair.ts`——`OptionSpec[]` + builder 函式。
3. `lib/templates/index.ts` 註冊一筆 `FurnitureCatalogEntry`：
   - `nameZh: "明式圈椅"`、`difficulty: "advanced"`
   - `defaults`：`{ length: 610, width: 497, height: 720 }`（座寬/座深/椅圈總高）
   - `limits`：待 P1 實作時依人體工學 §O 訂（座高 420–520、座寬 550–680 區間）
4. `npm run gen-style-pack circle-chair` → 人工審改 → merge 進 `lib/knowledge/style-detail-packs.ts`。
5. `FurnitureDesign`：`useButtJointConvention: true`、`defaultJoinery` 走中式榫（見 §8 joineryMode）。

### 建構基底
複製改寫 `lib/templates/bench.ts` 的 windsor 分支（BATT 演算法、`buildVerticalRound`、bow 旋轉定位）。圈椅 ≈ windsor 椅背邏輯 + 椅圈取代直 bow + 扶手延伸。

### 座標慣例
- code 慣例：y 上、z 後（與 `docs/drafting-math.md` 的 z 上 y 後**不同**，引用公式時換軸）。
- part origin 沿用 wrd 慣例：底部中心。
- 椅圈中心相對座面中心**偏後** Y ≈ +40~60mm。

---

## 5. 4-Phase 路線圖

| Phase | 椅圈 | S 曲線三件 | 後腿 | 主要交付物 |
|---|---|---|---|---|
| **P1 直線化框架版** | 每段 `arch-bent` 近似（單拋物線弧拼多邊圈） | 聯幫棍 `splayed-round-tapered`、靠背板 `face-rounded`+`bendMm`、鵝脖併入椅前腳 `arch-bent` | `arch-bent`（彎度集中上段） | 全 18 種零件就位、結構正確、可調基本尺寸、三視圖+3D 出圖、材料單列滿 34 件含 5 段椅圈、`audit-overlaps` 0 overlaps、SOP 4 步走完、工序工法文案先有 |
| **P2 BATT 椅圈 + 真 S** | windsor BATT 法、5 段近似但椅圈呈真弧 | 鵝脖/聯幫棍真 S 曲線、靠背板 `face-rounded` 雙段 bend | 複斜角（§AT1.3：外撇+後傾合成角） | 3D 開始像真圈椅、椿榫/鴨母嘴可選、椅盤轉角兩種可選 |
| **P3 swept-curve 連續椅圈** | 新增 `swept-curve` shape、沿連續 B-spline、切 5 段 part | 鵝脖/聯幫棍/後腿改 `swept-curve` | `swept-curve`（側視 S 中心線 + 頂端圓榫） | 三視圖投影分支（§A9+§S5）、椅圈五接楔釘榫對位 |
| **P4 榫卯細節圖 + 曲線料 CSG** | — | — | — | 楔釘榫/夾頭榫等細節圖渲染器、自由曲面零件榫孔 CSG、`drafting-math.md` 補 4 章 |

**漸進原則**：下盤 14 件零件、S 曲線件與榫卯**資料結構**從 P1 就照終態寫。P1→P3 真正丟棄重寫的只有「椅圈那一個 shape kind」，其餘是升級不是 rework。

---

## 6. 零件模型

18 種零件分 6 組。每組 P1 近似 shape → 終態 shape：

| 組 | 零件（數量） | P1 shape | 終態 shape |
|---|---|---|---|
| **A. 椅圈** | 上靠桿×1、中桿×2、左右桿×2（5 件，楔釘榫攢接） | 每段 `arch-bent` | `swept-curve`（連續 B-spline 切 5 段） |
| **B. 立柱・一木連做** | 椅前腳（含鵝脖）×2、椅後腳×2 | `arch-bent`（彎度集中上段） | `swept-curve` |
| **C. S 曲線件** | 聯幫棍×2、靠背板×1 | 聯幫棍 `splayed-round-tapered`；靠背板 `face-rounded`+`bendMm` | 聯幫棍 `swept-curve`；靠背板 `face-rounded` 雙段 bend |
| **D. 椅盤** | 前後大邊×2、左右抹頭×2、座板×1、穿帶×1 | `box`（座板 `chamfered-top`+`panelPieces`） | 不變（P4 joinery mode 加格角榫+打槽） |
| **E. 橫撐・步步高棖** | 前後橫飾棖×2、左右橫飾棖×2、步步高升後棖×1、側棖×2、前腳棖×1 | `box`/`chamfered-edges`，圓棖用 `round`；步步高用 `origin.y` 差做前低後高 | 不變 |
| **F. 角牙** | 前腳角牙×2、橫飾棖角牙×6 | `box` 佔位 | `face-rounded`（壼門/雲紋輪廓） |

### 關鍵決定
1. **椅前腳/椅後腳各為「一件」**（材料單就這樣列），一木連做，不拆成腿+鵝脖兩件。
2. **椅圈從 P1 就是 5 個獨立 part**——材料單與楔釘榫接點資料從 P1 齊；P3 只換 shape。
3. **椅盤/橫撐/步步高棖共 14 件，P1 即終態**——`box` 系列足夠。
4. **無獨立牙條零件**——以材料單為準。

---

## 7. swept-curve shape kind 設計（P3，全專案最高風險單元）

P1/P2 完全用現有 shape；`swept-curve` 純 P3 登場。設計目標：自包含、3D 與三視圖**共用同一份曲線取樣**，避免「3D 跟三視圖對不上」。

### 7.1 資料結構（`Part.shape` union 新增一支）
```ts
| {
    kind: "swept-curve";
    // 中心線控制點（part local frame, mm）— clamped cubic B-spline 內插（§S2/§S7）
    controlPoints: { x: number; y: number; z: number }[];
    profile:
      | { type: "round"; radiusStart: number; radiusEnd: number }
      | { type: "rect"; widthStart: number; widthEnd: number; thickness: number; cornerR?: number };
    segments?: number;  // 採樣上限，預設走 §S5 adaptive flatten ε=0.1mm
  }
```
- `profile.round`：圓料件（鵝脖、聯幫棍、後腿）。
- `profile.rect`：椅圈（斷面圓角矩形，寬度沿弧漸變：後正中 ~60mm → 扶手端 ~30mm）。

### 7.2 共用模組 `lib/geometry/swept-curve.ts`（單一真相來源）
- `sampleCenterline(shape)` → 控制點內插成 N 個取樣點 + 每點切線/法線（§S2 de Casteljau、§S5 adaptive flatten ε=0.1mm）。
- `projectSweptCurve(shape, view)` → 給定 front/side/top 回傳投影 polygon（§A9 非 90° 旋轉 silhouette）。
- 3D builder 與三視圖**都吃 `sampleCenterline` 的同一份輸出**——曲線只算一次。

### 7.3 3D 渲染（`components/PerspectiveView.tsx` 加 `buildSweptCurveGeometry`）
- `profile.round` → 沿曲線 loft 變半徑圓斷面（`TubeGeometry` 不支援變徑，自建 `BufferGeometry`）。
- `profile.rect` → 沿曲線 loft 變寬矩形斷面（§S8 `ExtrudeGeometry` 概念）。

### 7.4 三視圖（`lib/render/geometry.ts` 的 `projectPartPolygon` + `svg-views.tsx` 各加正/側/俯視分支）
- 抄 `arch-bent`/`lathe-turned`/`face-rounded` 三個現成曲線投影分支當範本。
- 椅圈俯視 = 投影出近 ¾ 圓 + 兩端外撇；正/側視 = 曲線輪廓 polygon。

### 7.5 風險控管
P3 開工前先拿**單一零件（聯幫棍，最簡單的單段曲線）**做端對端驗證（3D + 三視圖都對），通過再套椅圈五段、再套立柱。

---

## 8. 參數、preset、教材選項

### 8.1 表單參數
基本尺寸（mm 輸入，不用比例）：
- **catalog `defaults`（3 欄）**：`length` = 座寬（610）、`width` = 座深（497）、`height` = 椅圈總高（720）。
- **額外 `OptionSpec` 參數**：`seatHeight` = 座面高（預設 480，依 §O 人體工學 clamp 420–520）——獨立可調，不跟椅圈總高綁死。
- 椅圈弧度、鵝脖/聯幫棍/靠背 S 曲線、側腳收分角等**曲線參數不開放**，鎖在圖紙比例、隨上述基本尺寸等比縮放。

其餘 `OptionSpec`：
- 風格 preset 下拉（見 8.2）。
- 教材兩種做法下拉（見 8.3）。
- 主材選擇（沿用 wrd `MaterialId`）。

### 8.2 風格 preset（3 個）
1. **明式素圈椅**（預設）= 工作圖本身，胡桃木比例。
2. **黃花梨細秀款** = 椅圈斷面收細、整體比例瘦一號，淺色硬木。
3. **雞翅木壯實款** = 椅圈斷面飽滿、腿徑加粗，深色木紋。

### 8.3 教材兩種做法選項（這張圖本是教材，畫了兩套做法給學員對照）
- **管腳棖榫型**：椿榫（規矩方榫）↔ 鴨母嘴（斜口勾掛榫）二選一。
- **椅盤轉角**：第一種結構 ↔ 第二種結構 二選一。
- 影響榫卯細節圖與工序文案；不影響整體外觀尺寸。

### 8.4 joineryMode
圈椅不可能用螺絲組裝——**圈椅預設即榫接模式**（不同於其他家具預設組裝版）。`?joineryMode` 仍可切，但預設為 true。

---

## 9. 榫卯設計 + drafting-math.md 補章

### 9.1 主要接合點（共 23 處，詳見拆解報告）
| 接合 | 榫型 | math.md |
|---|---|---|
| 椅圈段 ↔ 椅圈段（4 處） | 楔釘榫 | §G1 已有 |
| 椅後腳頂 ↔ 椅圈底 | 圓榫（盲榫） | §B2 已有 |
| 鵝脖頂（椅前腳頂）↔ 椅圈底 | 圓榫（盲榫） | §B2 已有 |
| 聯幫棍上下端 ↔ 椅圈 / 椅盤 | 圓榫 | §B2 已有 |
| 靠背板上下端 ↔ 椅圈 / 後大邊 | 帶肩扁榫 | §B2 已有 |
| 椅盤大邊 ↔ 抹頭（4 角） | 格角榫（攢邊 45° 割角） | **缺，需補** |
| 椅盤框 ↔ 座板 | 攢邊打槽裝板 | **缺，需補** |
| 椅盤框 ↔ 穿帶 | 直榫 | §B2 已有 |
| 腿 ↔ 椅盤（穿椅盤） | 腿穿椅盤（大進大出） | **缺，需補** |
| 前腳角牙 ↔ 腿 + 椅盤 | 夾頭榫 | **缺，需補** |
| 橫飾棖角牙 ↔ 棖 + 腿 | 夾頭榫式角牙 | **缺，需補** |
| 管腳棖 ↔ 腿 | 椿榫 或 鴨母嘴（教材兩選項） | §G1 鈎掛榫家族 |
| 橫飾棖 ↔ 腿 / 橫飾棖十字交會 | 格肩榫 | §B2 已有 |

### 9.2 drafting-math.md 補章（P4 交付）
新增 §G1 條目：**夾頭榫、攢邊格角榫、攢邊打槽裝板、腿穿椅盤（大進大出）**。每條含尺寸比例規範 + 繪圖要點。

### 9.3 榫卯細節圖渲染（P4）
`lib/joinery/details.tsx` 的 `RENDERERS` 目前只有 12 種 western `JoineryType`、union 封閉。兩條路徑（P4 決定）：
- **路徑 A**：擴 `JoineryType` union 加楔釘榫/夾頭榫等（牽動 `extract.ts`/`audit-joints.ts`/`standards.ts` 全鏈）。
- **路徑 B**：走 `GenericTenonDetail` fallback + 文字說明（§G1 自己也建議楔釘榫「側視+剖面雙圖」、複雜榫「示意圖+文字」）。
- **預設傾向路徑 B**——風險低、P4 可先 ship，路徑 A 留後續優化。

---

## 10. 材料單 / 才積 / 工序工法

### 10.1 材料單
- 沿用 wrd 材料單分組顯示。圈椅零件落在「🪑 座板椅背」「🦵 腳底座」「━ 牙板橫撐」「⚙ 其他」等組。
- 椅圈 5 段各列一行。

### 10.2 才積（曲線料）
- 曲線料（椅圈、立柱、聯幫棍）按**備料 bounding box** 計才——這正是工作圖材料單自己的做法（備料尺寸 ≠ 淨料尺寸，彎料要從寬板挖鋸）。
- `swept-curve` 零件的才積 = 控制點包絡的 AABB。`arch-bent` 等 P1 近似件沿用現有 cut-plan 邏輯。
- 精準弧長下料（§J）排在最後，非本 spec 重點（用途優先序：才積報價排第三）。

### 10.3 工序工法文案
- P1 即接 Claude API 生成工序/工法（沿用 wrd `/api/generate-text` 機制）。
- prompt 帶入：圈椅、楔釘榫、夾頭榫、步步高管腳棖、一木連做等術語，要求繁中、木頭仁教學口吻。
- 教材兩種做法選項要反映在工序文案（椿榫版 vs 鴨母嘴版工序不同）。

---

## 11. 錯誤處理與驗證測試

- **每個 phase 改完 `lib/templates/circle-chair.ts` 必跑** `npx tsx scripts/audit-overlaps.ts`——組裝版下 0 overlaps。
- 改 `svg-views.tsx`/`geometry.ts`/`PerspectiveView.tsx` 前先 grep `docs/drafting-math.md` 對應 §、提案引 § 編號。
- 每 phase 收尾用 playwright 走公開路徑 `/design/circle-chair` 自己截圖驗證（三視圖 + 3D），不等使用者貼圖。
- `npx tsc --noEmit` 必過。
- P3 `swept-curve` 額外驗證：`scripts/audit-overlaps.ts`/`audit-joints.ts` 對曲線料的 OBB 偵測是否準——先用聯幫棍單件確認。
- 改 leg/apron 邏輯要驗所有 leg-shape variant（圈椅腿是圓料 splayed，驗 splayed 收分各角度）。

---

## 12. 風險與未解項

| 風險 | 緩解 |
|---|---|
| `swept-curve` 三視圖投影是全專案最不確定處 | P3 先拿聯幫棍單件端對端驗證；§A9+§S5 公式已備 |
| 椅圈 5 段楔釘榫對位（曲線料端點對接 + audit OBB 偵測） | P3 椅圈五段前先驗證單段；audit 對曲線料的 OBB 需專門確認 |
| 後腿一木連做複斜角（同時外撇+後傾+上段順椅圈彎） | §AT1.3 公式齊備；P2 先用 BATT 法繞過真旋轉圓料 |
| 楔釘榫等中式榫卯細節圖 `JoineryType` union 封閉 | P4 預設走 `GenericTenonDetail` + 文字（路徑 B），低風險先 ship |
| 自由曲面零件榫孔 CSG（`PerspectiveView` 目前自由曲面不挖孔） | P4 補；joineryMode 下椅圈榫孔渲染 |

### 待使用者實作時確認的細項（不阻擋本 spec）
- 椅圈主圓半徑精確值（拆解估 R≈245–260mm，圖上無直接半徑標註）。
- 楔釘榫搭接長度（估 ~80mm）、八種變體實際採用哪一號。
- 角牙片數定義（前腳角牙「2 片」是否每側 1 片）。
- `limits`（尺寸上下限）依 §O 人體工學於 P1 訂定。

---

## 13. 拆解分歧記錄

- **牙條**：下盤拆解 agent 曾「推定每面 1 條牙條」，經專門 agent 逐行核對材料單 + 正/側視/縱剖面，定案**無獨立牙條**，先前是把橫飾棖誤判。本 spec 以「無獨立牙條」為準。
- **椅圈零件命名**：各 agent 對 1.1 的讀法有「上靠桿/上身桿/上下桿」之分，本 spec 統一用「椅圈上靠桿」。
- **後腿 vs 椅圈連接**：確認後腿一木連做穿椅盤、頂端圓榫接椅圈；椅圈本身是另外 5 段攢接，非後腿連做出椅圈。

---

## 附錄：drafting-math.md 引用索引
- §S2/§S7 — 參數化曲線、圈椅椅圈 clamped cubic B-spline 配方
- §S5 — adaptive flattening ε=0.1mm
- §S8 — Sweep/Revolve（TubeGeometry/ExtrudeGeometry）
- §G1 — 中式榫卯（楔釘榫；需補夾頭榫/格角榫/攢邊打槽裝板/腿穿椅盤）
- §G3 — wrd 榫卯實作優先序
- §AS — BATT 演算法（圓料下錨上追式）
- §AT1.3 — Windsor 椅複斜角公式
- §A9 — 非 90° 旋轉零件 silhouette 投影
- §A10 — butt-joint 慣例
- §AB2/§AB5 — 明清 20 款圖譜、圈椅「先框架後曲線」路線
- §O — 人體工學（座高/座深）
