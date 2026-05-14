# 衣櫃推拉門模式 — 設計 spec

**日期**：2026-05-14
**範圍**：`lib/templates/wardrobe.ts` + `lib/templates/_builders/case-furniture.ts`

## 目標

衣櫃加一個「推拉門模式」勾選項。打開後整櫃改成 **2 片前後錯開的外掛滑門**，
蓋滿上中下三層；鉸鏈門扇自動取消、zone 抽屜自動入柱。

## 已確認需求

- 一個勾選項，預設關閉
- 打開後整櫃變 **2 片滑門**（數量固定 2，不可調）
- 滑門**外掛全寬**：裝在櫃體最前方、門片總寬蓋滿櫃體外寬（連側板也蓋住）
- 滑門**前後錯開**：前軌一片 + 後軌一片，中間重疊，兩片在不同 z 深度
- 滑門材質**固定 slab 平板門**（18mm 夾板貼皮），不跟隨「門材質」設定
- 每片滑門靠中縫那側豎邊有**垂直指拉槽**
- 打開時鉸鏈門扇自動取消，但 zone 內部收納（層板 / 抽屜 / 吊衣 / 子欄分隔）全部保留
- 打開時 zone 抽屜自動改 inset 入柱

## 架構：方案 A

`caseFurniture` opts 加 `slidingDoorMode?: boolean` flag（預設 false）。
case-furniture.ts 本來就握有所有櫃體幾何（zFront / innerW / zone 迴圈 /
renderDoorZone），sliding door 邏輯掛在這裡最自然。flag 預設 off，
其他櫃類模板完全不受影響。`wardrobe.ts` 只負責加勾選項 + 傳 flag。

## §1 選項與動態隱藏

`wardrobe.ts` 的 `wardrobeOptions` 加（放 `door` group，zone 選項之後）：

```
key:          "slidingDoorMode"
label:        "推拉門模式（2 片外掛滑門）"
type:         checkbox
defaultValue: false
wide:         true
help:         打開後整櫃改 2 片前後錯開外掛滑門蓋滿上中下層；
              鉸鏈門扇自動取消、zone 抽屜自動入柱
```

`slidingDoorMode = true` 時動態隱藏只影響鉸鏈門扇的選項
（符合「無關選項要隱藏」慣例）：

- `doorType`（門材質）
- `doorMount`（門板安裝方式）
- `doorFrameRailWidth`（門框木條寬）
- `doorFrameThickness`（門框木條厚）
- `doorPullStyle`（門把樣式）

作法：這些選項的 `dependsOn` AND 上 `{ key: "slidingDoorMode", equals: false }`。
`doorMountOption` 等是 zone-helpers.ts 來的 shared option，wardrobe.ts 用
spread 覆寫其 `dependsOn`（原本多半是 `ANY_ZONE_IS_DOOR`，改成
`{ all: [ANY_ZONE_IS_DOOR, { key: "slidingDoorMode", equals: false }] }`）。

**不隱藏**：zone 類型選單。類型=門板 在滑門模式下仍有效——只是渲染
門內收納、不出鉸鏈門扇。

## §2 滑門幾何

`caseFurniture` opts 加 `slidingDoorMode?: boolean`。為 true 時在櫃體前方生：

| Part | 規格 |
|---|---|
| 滑門 A（前軌） | slab 18mm；寬 = 櫃外寬 / 2 + 25mm；高 = 內部三層總高 + 2 × panelThickness（上下各蓋住頂 / 底板前緣一個板厚，同全蓋門） |
| 滑門 B（後軌） | 同 A；往櫃內退 21mm（18 厚 + 3mm clearance）= 前後錯開 |
| 重疊 | 兩片各比半寬多 25mm → 關起來中間重疊 50mm、無縫 |
| 指拉槽 | 每片靠中縫側豎邊一道垂直 cosmetic mortise 凹槽（約 600mm 高、垂直置中、20mm 寬 × 10mm 深） |
| 頂滑軌 | 細長條，外寬 × 約 25mm 高 × 40mm 深，裝櫃體頂板前緣 |
| 底滑軌 | 同頂滑軌，裝櫃體底板前緣 |

Z 軸慣例（−width/2 = 櫃前緣，往前 = 更負）：

- 前軌門片：z = 櫃前緣外 ~3mm clearance 處
- 後軌門片：再往櫃內退 21mm
- 兩片 z-range 不重疊 → audit AABB 不會誤判
- 滑門 / 滑軌都在櫃體前方留 clearance，不撞櫃體

## §3 zone 互動（slidingDoorMode = true）

| 情況 | 行為 |
|---|---|
| zone 類型 = 門板 | 跳過鉸鏈門扇渲染：`renderDoorZone(...)` 那幾個 call 包進 `if (!slidingDoorMode)`。門內收納照舊——子欄分隔板 / 門內層板 / 門內抽屜 / 吊衣桿全部不變 |
| zone 類型 = 抽屜 | drawerMount 強制 inset。作法：case-furniture.ts 頂部 `const drawerMount = slidingDoorMode ? "inset" : (opts.drawerMount ?? "overlay-6")`，一行讓所有抽屜路徑吃到 |
| zone 類型 = 層板 / 空區 | 不變 |
| 門內抽屜 | 已經是 inset + 無把手（先前 commit `dc9a8c0` / `8f2645c`），不受影響 |

**zone 抽屜把手**：保留（使用者只說「入柱」、沒說無把手；門內抽屜才是
明確要求無把手的）。若之後使用者要 zone 抽屜也無把手再加。

## §4 3D 與三視圖

- **Part id**：`sliding-door-1` / `sliding-door-2`；指拉槽走 cosmetic mortise
  掛在門片 part 上；滑軌 `sliding-track-top` / `sliding-track-bottom`
- **xray**：`sliding-door-*` 會被現有 `/-door($|-)/` 規則（PerspectiveView.tsx）
  抓到 → 按「藏面板」會藏掉滑門、露出內部收納（符合需求）；
  `sliding-track-*` 不被門規則抓到，當結構件保留
- **配色**：`sliding-door-*` 歸 door 類，上門板色調
- **三視圖**（靠通用投影自動處理）：
  - 側視 / 俯視：看得出前後錯開的兩層
  - 正視：兩片重疊處會疊線，可接受（要更講究之後再微調，非本次範圍）

## §5 audit 與驗證

- **audit-overlaps**：預設 `slidingDoorMode = false`，audit 的 default 跑不受
  影響（143/151 維持）。前後錯開的 z-gap 留足（≥3mm）讓 AABB 不誤判；
  滑門 / 滑軌都在櫃前方留 clearance、不撞櫃體
- **實作時驗證步驟**：
  1. `npx tsx scripts/audit-overlaps.ts`（預設）
  2. 手動再跑一次 `slidingDoorMode = true` 確認無穿模
  3. `npx tsc --noEmit`
  4. playwright 自驗：滑門模式的正視 / 側視 / 俯視 + 3D（xray off 看門片、
     xray on 看內部收納）

## 動的檔案

- `lib/templates/wardrobe.ts` — 加勾選項、覆寫鉸鏈門選項 dependsOn、傳 flag
- `lib/templates/_builders/case-furniture.ts` — opts 加 `slidingDoorMode`、
  drawerMount 一行改、門扇渲染包 if、新增滑門 + 滑軌 part 渲染

## 不做（YAGNI）

- 滑門數量可調（固定 2）
- 鏡面 / 玻璃滑門材質（固定 slab）
- 滑門開合動畫
- 其他櫃類（display-cabinet / media-console 等）的滑門模式 — 本次只做衣櫃
- 正視圖兩片重疊的特殊處理
