# 桌面 / 椅面 下緣倒角選項 — 設計文件

日期：2026-05-21

## 目標

讓使用者能對**桌面（桌子頂板）**與**椅面（座板）**的**下緣**獨立加倒角。
目前只有上緣有「倒角尺寸 (mm)」+「倒角樣式」兩個選項（`seatEdge` / `seatEdgeStyle`），
下緣只在特殊情形（方凳腳內縮、瀑布前緣）自動倒角。

## 約束：不可與桌腳 / 椅腳 / 牙條衝突

下緣倒角會切掉座板 / 桌面的下緣外緣，而桌腳、椅腳、牙條都接在這塊板的下面。
腳齊邊（`legInset = 0`）時牙條也貼邊 → 下緣倒角會切進接合區。
腳內縮（`legInset > 0`）時牙條跟著腳一起往內縮、座板下緣外露 → 可安全倒角。

因此單一個 `legInset > 0` 閘門同時涵蓋桌腳 / 椅腳 / 牙條三者。

## 適用家具

desk（桌面）、dining-chair、square-stool、bar-stool、bench、round-stool（座板）。

## 設計

### 1. 新選項 `seatEdgeBottom`「下緣倒角尺寸 (mm)」

- `type: number`，範圍 0–30，step 1，`defaultValue: 0`，group `top`
- 放在現有「倒角尺寸 (mm)」（上緣）下方
- 新 helper `seatEdgeBottomOption(group)` 寫進 `lib/templates/_helpers.ts`
- 倒角樣式**共用**現有 `seatEdgeStyle`（45° / 圓角），不另開下緣樣式選項
- help：「腳內縮後座板下緣外露才能倒角；倒角量會自動限制在腳內縮量內，不會切到牙條。」

### 2. 衝突閘門

**顯示閘門** — `dependsOn`：

- 通用：`{ key: "legInset", notIn: [0] }`，腳齊邊時整個選項隱藏，下緣維持直角
- desk 另加 `liveEdge` false 閘門（跟上緣 `seatEdge` 一致）：
  `dependsOn: { all: [{ key: "legInset", notIn: [0] }, { key: "liveEdge", notIn: [true] }] }`
- round-stool `legInset` 範圍 20–200，恆 > 0，選項永遠可見

**數值夾限（靜默）** — 在各 template body 計算實際下緣倒角：

```
effectiveBottom = Math.min(seatEdgeBottom, legInset)
```

滑桿可拉到 30，但實際只倒到 `legInset` 量，保證不切進牙條 / 腳的接合區。
夾限是靜默的（不在 UI 改 max），3D / 三視圖直接吃夾限後的值。

### 3. helper `seatEdgeShape()` 簽章調整

第 3 參數由 `bothSides?: boolean` 改為下緣 mm 值：

```ts
export function seatEdgeShape(
  v: string | number | undefined,
  style?: string,
  bottomV?: string | number,
): { kind: "chamfered-top"; chamferMm: number; bottomChamferMm?: number;
     style?: "chamfered" | "rounded" } | undefined {
  const mm = parseSeatChamferMm(v);
  const bottomMm = parseSeatChamferMm(bottomV);
  if (mm <= 0 && bottomMm <= 0) return undefined;        // 上下皆 0 才不修飾
  return {
    kind: "chamfered-top",
    chamferMm: mm,
    bottomChamferMm: bottomMm > 0 ? bottomMm : undefined,
    style: style === "rounded" ? "rounded" : "chamfered",
  };
}
```

上緣 0、下緣 > 0 時仍回傳 `chamfered-top`（`chamferMm: 0`），底層
`buildChamferedTopGeometry` 已支援 `cTop = 0`。

### 4. 各檔改動

| 檔案 | 改動 |
|---|---|
| `lib/templates/_helpers.ts` | 加 `seatEdgeBottomOption()`；改 `seatEdgeShape()` 第 3 參數 |
| `lib/templates/_builders/simple-table.ts` | `SimpleTableOpts` 加 `seatEdgeBottom?`；有傳值用明確值、沒傳值維持現有 `legInset>0 \|\| topOverhang>0` 自動鏡射（dining-table / side-table / low-table / tea-table 等不受影響） |
| `lib/templates/desk.ts` | 加 `seatEdgeBottomOption` 選項（legInset + liveEdge 雙閘門）；body 算 `min(seatEdgeBottom, legInset)` 傳進 simple-table |
| `lib/templates/bench.ts` | 加選項（legInset 閘門）；body 夾限後傳進 simple-table |
| `lib/templates/dining-chair.ts` | 加選項（legInset 閘門）；夾限後傳進座板 `seatEdgeShape` 呼叫（waterfall 模式維持原本自有 `bottomChamferMm` 不動） |
| `lib/templates/square-stool.ts` | 加選項（legInset 閘門）；原本 `seatEdgeShape(..., legInset > 0)` 自動下緣倒角改由明確選項（夾限後值）控制 |
| `lib/templates/bar-stool.ts` | 加選項（legInset 閘門）；夾限後傳進座板 `seatEdgeShape` |
| `lib/render/part-geometry.ts` | `round` shape 型別加 `bottomChamferMm?`；`round` 分支 lathe profile 把底緣轉角也倒角（底端點由 `(radius, -h/2)` 改為 `(innerR, -h/2)` + 倒角段，與頂緣對稱） |
| `lib/templates/round-stool.ts` | 加選項（legInset 恆 >0 永遠可見）；圓座板 shape 加 `bottomChamferMm`（夾限後值） |
| `lib/render/svg-views.tsx` | 確認三視圖側視會畫出 `chamfered-top` / `round` 的下緣倒角；若只畫上緣則補對稱下緣 |

### 5. 行為與相容性

- `seatEdgeShape` 既有 2 參數呼叫（dining-chair / bar-stool）行為不變（`bottomV` undefined → `parseSeatChamferMm(undefined)=0`）。
- simple-table 既有 `legInset>0||topOverhang>0` 自動鏡射只在「沒傳 `seatEdgeBottom`」時保留 → 其他桌類無回歸。
- square-stool 既有「腳內縮自動下緣倒角」改成由明確選項控制（預設 0）。屬預期改變（使用者要明確按鈕），記入文件。

## 驗證

- `npx tsc --noEmit` — 0 錯
- `npx tsx scripts/audit-overlaps.ts` — overlap 數不得多於 baseline
- 截 3D 圖：desk + dining-chair + square-stool + bar-stool + bench + round-stool，
  各設 `legInset > 0` 且下緣倒角 > 0，肉眼確認下緣有倒角、無穿模
- 截一張 `legInset = 0` 的 desk，確認下緣倒角選項隱藏、下緣維持直角
- 三視圖側視肉眼確認下緣倒角畫得出來
