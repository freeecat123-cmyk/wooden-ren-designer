# 地板施工模擬器 `/floor` — 設計定案

**日期:** 2026-05-20
**狀態:** 設計定案,待轉實作計畫
**範圍:** 超耐磨 / 海島型木地板「平鋪(浮鋪)」工法的房間排版 + 算料模擬器

---

## 1. 目的與定位

在 `wooden-ren-designer` 內新增一個工具頁 `/floor`,讓使用者輸入房間形狀後,
**同時**得到:

- **排版視覺預覽** — 2D 俯視圖,看地板片怎麼排、錯縫花樣、哪些片要裁切
- **完整算料 BOM** — 地板片數(含損耗)、收邊條 / 踢腳板長度、防潮墊面積、伸縮縫提示

兩者互相連動:改錯縫比例 / 鋪設方向 → 預覽與片數同步更新。

本工具完全 **mirror 既有 `/ceiling`(天花板骨架模擬器)架構**,沿用其分層與分階段上線模式。

### 對照表

| 天花板模擬器 | → | 地板模擬器 |
|---|---|---|
| `lib/ceiling/` 算料引擎 | → | `lib/floor/` 排版 + 算料引擎 |
| `app/ceiling/` 路由 + Client UI | → | `app/floor/` |
| `canUseCeilingTool` 權限 flag | → | `canUseFloorTool` 權限 flag |
| 階段 1 admin 限定純引擎驗證頁 | → | 同樣分階段、admin 先測 |

---

## 2. 範圍邊界

### v1 範圍內

- 工法:超耐磨 / 海島型木地板**平鋪(浮鋪)**
- 房間形狀:**正交多邊形**(所有邊水平或垂直 → 涵蓋矩形 / L 型 / T 型 / 凸型,約九成住家)
- 排版花樣:**直鋪錯縫**(1/2、1/3、亂縫)
- 房間輸入:格線畫布拖拉編輯器(主)+ 形狀範本快速套用(輔)
- 預覽:2D 俯視排版圖(SVG)
- BOM:地板片數 + 損耗、收邊條 / 踢腳板、防潮墊、伸縮縫

### v1 範圍外(backlog,架構預留不實作)

- **斜牆 / 非正交多邊形** — 會讓裁切演算法複雜數倍
- **人字拼 / 魚骨拼(herringbone / chevron)** — 幾何複雜,另開 spec
- **3D 透視預覽** — 地板本質是平面,2D 已足夠;加分有限
- 架高木地板、實木地板釘工法(其他地板工法)
- 自訂鋪設角度(非 0° / 90°)
- 多房間 / 整層樓一次算

---

## 3. 架構與檔案配置

mirror `lib/ceiling/` + `app/ceiling/`:

```
lib/floor/
  types.ts              型別定義 + DEFAULT_FLOOR_INPUT
  geometry.ts           正交多邊形工具(面積、周長、bbox、點包含、矩形 ∩ 多邊形裁切)
  layout.ts             排版引擎:房間 + 設定 → 地板片清單(整片 / 裁切片)
  calc.ts               算料引擎:地板片清單 → 完整 BOM + trace
  cutting.ts            裁切餘料再利用優化(mirror ceiling/cutting.ts)
  calc.test.ts          單元測試 + fixtures
  fixtures.ts           測試用房間(矩形、L 型、T 型)
  FloorOverviewSvg.tsx  2D 俯視排版圖
  presets.ts            形狀範本(矩形 / L / T / 凸型)角點資料

app/floor/
  page.tsx              路由(分階段:階段 1 admin 限定)
  FloorDevClient.tsx    Client UI:畫布編輯器 + 設定表單 + BOM 顯示
  FloorCanvasEditor.tsx 格線畫布拖拉編輯器
```

權限:`lib/permissions.ts` 新增 `canUseFloorTool` flag。

---

## 4. 資料模型(`types.ts`)

全模組單位 **cm**(與 ceiling 一致,避免 mm/cm 轉換錯誤)。

### 房間多邊形

```
RoomPolygon = {
  vertices: Point[]   // 正交多邊形角點,順時針,單位 cm
}
Point = { x: number, y: number }
```

不變量:相鄰邊必為水平或垂直交替;多邊形不自交;順時針排列。

### 排版輸入 `FloorInput`

- `room: RoomPolygon`
- `plankLengthCm` — 地板片長(預設 120)
- `plankWidthCm` — 地板片寬(預設 19)
- `direction` — 鋪設方向:`"long-axis"` | `"short-axis"`
- `stagger` — 錯縫策略:`"half"`(1/2)| `"third"`(1/3)| `"random"`(亂縫)
- `startCorner` — 起鋪角:`"top-left"` 等四角
- `expansionGapMm` — 牆邊伸縮縫(預設 10mm,業界 8–12)
- `wasteMode` — 損耗計法:`"computed"`(實算裁切廢料)| `"empirical"`(經驗 +10%)
- `reuseOffcuts` — 裁切餘料是否再利用(boolean,預設 true)
- `skirtingType` — 收邊:`"skirting"`(踢腳板)| `"trim"`(收邊條)| `"none"`

### 排版輸出 `FloorLayout`

- `planks: PlacedPlank[]` — 每片:位置、尺寸、`kind: "full" | "cut"`、若 cut 記裁切後尺寸與來源
- `rows: number` — 排數

### BOM `FloorBom`

```
FloorBom = {
  input, layout,
  items: BomItem[],   // 沿用 ceiling BomItem 形式
  auto: {             // 唯讀自動計算值
    roomAreaM2, pingShu, perimeterM,
  },
  trace: {            // 計算過程透明化,給師傅核對
    fullPlankCount, cutPlankCount, totalPlankCount,
    wastePercent, plankRows,
    offcutReuseLog,   // 哪些裁切片由餘料拼出
  }
}
```

`BomItem` 類別:`plank`(地板片)、`skirting`(踢腳板 / 收邊條)、`underlay`(防潮墊)。

---

## 5. 房間輸入 UX

### 形狀範本(快速起點)

`presets.ts` 提供:矩形、L 型、T 型、凸型。點選 → 帶入該形狀角點 + 預設尺寸,
使用者再於畫布微調。

### 格線畫布編輯器 `FloorCanvasEditor`

- 畫布顯示房間外框 + 格線(格距可設,預設 10cm)
- **拖角點**:角點吸附格線;拖動時即時維持「正交」不變量(移動角點時相鄰邊保持水平 / 垂直)
- **加 / 刪角點**:於邊上點擊新增、選角點刪除
- **數值編輯**:每段邊長可點開直接輸入數字(手機友善)
- 違反正交多邊形不變量的操作即時阻擋並提示

### 互動連動

房間或任何設定變更 → 即時重算 `layout` + `bom` → 重繪預覽與 BOM。

---

## 6. 排版引擎(`layout.ts` — 核心難點)

### 演算法

1. 算房間多邊形 bounding box。
2. 依 `direction` 決定鋪設軸;由 `startCorner` 決定原點與排列方向。
3. 逐排(每排寬 = `plankWidthCm`)鋪滿整個 bbox:每排內地板片首尾相接,
   排與排之間依 `stagger` 偏移起點(1/2 = 半片、1/3 = 三分之一片、random = 隨機種子)。
4. 牆邊內縮 `expansionGapMm` 形成「可鋪區域」= 房間多邊形向內 offset。
5. 對每片矩形與「可鋪區域」做**矩形 ∩ 正交多邊形裁切**(`geometry.ts`):
   - 完全在內 → `kind: "full"`
   - 部分在內 → `kind: "cut"`,記裁切後實際尺寸
   - 完全在外 → 丟棄
6. `reuseOffcuts=true` 時,把裁切片交給 `cutting.ts`:嘗試用前面裁掉的餘料
   拼出後續需要的裁切片,降低總片數。

### 幾何工具 `geometry.ts`

- 正交多邊形面積、周長、bounding box
- 點是否在多邊形內
- 多邊形向內 offset(伸縮縫用)
- **矩形與正交多邊形交集** — v1 因限正交,交集結果仍是正交多邊形,可用掃描線 / 矩形分解實作,不需通用多邊形布林庫

### 設計假設(`// ASSUMPTION` 標記,實作後請使用者核對鎖定)

1. 地板片為固定尺寸矩形(同一專案所有片同規格)。
2. 伸縮縫四周等寬。
3. 餘料再利用只在「長度方向」切一刀(不縱切),且餘料 ≥ 最小可用長度才回收。
4. 亂縫用固定隨機種子 → 結果可重現。
5. 損耗率「實算」= 裁切廢料總面積 / 房間面積;不含搬運破損,UI 註明。

---

## 7. BOM 輸出(`calc.ts`)

- **地板片**:整片數、需裁切排數、總片數;`empirical` 模式另給「+10% 進貨建議量」
- **收邊條 / 踢腳板**:長度 = 房間周長(扣門洞由使用者自行調整,v1 用周長 + note 提醒)
- **防潮墊**:面積 = 房間面積(平鋪需滿鋪)
- **伸縮縫**:文字提示(牆邊留 `expansionGapMm`、大面積需中段伸縮縫)
- **trace**:所有中間值(片數分解、損耗、排數、餘料拼接 log)輸出供師傅核對

數字 render 時 round 到 1 位小數(沿用全站慣例),內部計算保持高精度。

---

## 8. 預覽(`FloorOverviewSvg.tsx`)

2D 俯視排版圖:

- 房間多邊形外框
- 每片地板片(整片 / 裁切片不同填色,裁切片標紅)
- 錯縫接縫線
- 起鋪角 / 鋪設方向標示
- 伸縮縫範圍以虛線示意

3D 透視 → backlog。

---

## 9. 權限與分階段上線

mirror ceiling 的分階段:

- **階段 1** — `lib/floor/` 純引擎(geometry + layout + calc + cutting + 測試)+ 陽春 `/floor` 驗證頁,**admin 限定**(`isAdminEmail`),非 admin 導 `/`
- **階段 2** — `FloorCanvasEditor` 格線畫布編輯器 + 範本
- **階段 3** — `FloorOverviewSvg` 預覽美化 + BOM UI 完善
- **階段 4** — 接 `canUseFloorTool` permission,對 pro 方案開放;`/pricing` 露出

每階段獨立成可驗收的里程碑。本 spec 對應的實作計畫先聚焦**階段 1 + 階段 2**(引擎 + 編輯器),
階段 3 / 4 視驗收結果再開後續計畫。

---

## 10. 測試

`lib/floor/calc.test.ts` + `fixtures.ts`:

- fixture 房間:矩形、L 型、T 型
- 驗證:房間面積 / 周長、整片 + 裁切片數、損耗率、防潮墊面積、伸縮縫內縮正確
- 邊界:房間小於一片、伸縮縫吃掉整排、餘料再利用前後總片數
- 幾何工具單元測試:矩形 ∩ 正交多邊形交集、向內 offset

---

## 11. 待核對的開放假設

1. 地板片預設尺寸 120×19cm 是否符合木頭仁常推薦的規格?(實作後請使用者確認)
2. 收邊條 / 踢腳板門洞扣除 v1 不自動處理,僅 note 提醒 — 是否足夠?
3. 餘料再利用「只橫切一刀」的限制是否符合實務?
