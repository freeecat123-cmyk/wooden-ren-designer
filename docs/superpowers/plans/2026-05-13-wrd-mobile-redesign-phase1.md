# wrd 手機版 Phase 1 MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `?ui=v2` 旗標下，於 mobile viewport (390×844) 提供 L0/L1/L2/L3 4 層手機版設計頁，桌面版維持不變。

**Architecture:** 純 CSS RWD（`hidden md:block` / `md:hidden`）切換 mobile shell vs desktop。Server component 偵測 `?ui=v2` 決定要不要 render `MobileShell`；MobileShell 內部用既有 server props 跑（不重建 state pipeline）。所有現有 components（PerspectiveView / ZoomableThreeViews / StylePresetButtons / DesignFormShell 等）100% 沿用。

**Tech Stack:** Next.js 16 (App Router, RSC), React 19, TypeScript, Tailwind CSS, Three.js (React Three Fiber)

**Spec:** `docs/superpowers/specs/2026-05-13-wrd-mobile-redesign.md`

**Verification convention:** 此 repo 無 jest/vitest，全靠 `npx tsc --noEmit` + Playwright + `npx tsx scripts/audit-overlaps.ts`。每個 task 結束都跑這 3 道。

**Deviation from spec:** Spec 提到 RangeInput 用 `react-aria` useSlider 顧 accessibility。Phase 1 MVP **改用 native `<input type="range">`**——native 已有鍵盤 arrow / screen reader 支援，bundle 不增重。若 Phase 3 a11y audit 發現缺陷再升級。

**Working dir:** `/Users/wengevaq989/Desktop/wooden-ren-designer` (Mac branch `main`)

---

## File Structure

### Create
- `components/mobile/RangeInput.tsx` — 雙模式滑桿+chip
- `components/mobile/StickyBottomBar.tsx` — L0 底部固定 bar（總價 + 報價 + LINE）
- `components/mobile/CollapsibleSection.tsx` — L2 折疊容器
- `components/mobile/AdvancedSheet.tsx` — L3 4-tab 全螢幕 sheet
- `components/mobile/MobileTopBar.tsx` — L0 頂部 bar
- `components/mobile/MobileShell.tsx` — 主架，組合 L0–L3
- `components/mobile/MobileOptionField.tsx` — OptionField 的 mobile 版（用 RangeInput）
- `components/mobile/MobileOverflowMenu.tsx` — L4 ⋯ 更多

### Modify
- `app/design/[type]/page.tsx` — 偵測 `?ui=v2` → 條件 render MobileShell vs 現有 layout

### Don't touch
- `lib/templates/*` · `lib/joinery/*` · `lib/render/*` · `lib/pricing/*` · 其他 desktop components

---

## Task 1: Feature flag `?ui=v2` 接線

**Files:**
- Modify: `app/design/[type]/page.tsx`

- [ ] **Step 1: 在 page.tsx 加 `uiV2` 旗標**

讀 `sp.ui === "v2"`，傳到 render 時用。在 `app/design/[type]/page.tsx` 既有 `parseDesignSearchParams` 後加：

```tsx
const uiV2 = (Array.isArray(sp.ui) ? sp.ui[0] : sp.ui) === "v2";
```

- [ ] **Step 2: 用 Tailwind hidden 包現有 main**

把現有 `<main>` JSX 整段包成 `<DesktopLayout>` div，加 className `${uiV2 ? "hidden md:block" : "block"}`。

```tsx
<div className={uiV2 ? "hidden md:block" : "block"}>
  {/* 現有整段 <main className="max-w-7xl ..."> */}
</div>
```

- [ ] **Step 3: 加 MobileShell placeholder**

在 DesktopLayout div 後面加：

```tsx
{uiV2 && (
  <div className="md:hidden">
    <div className="p-4 text-center text-zinc-500">MobileShell placeholder — coming soon</div>
  </div>
)}
```

- [ ] **Step 4: tsc 驗證**

```bash
npx tsc --noEmit 2>&1 | grep -v node_modules | grep "page.tsx"
```

Expected: 無新增 error

- [ ] **Step 5: Playwright 驗證**

```bash
# 確保 dev server 在跑 (port 3000)
```

在 mcp__playwright 跑：
1. `browser_resize 1280×800` → `browser_navigate http://localhost:3000/design/stool` → 截圖確認**桌面版正常**
2. `browser_resize 390×844` → `browser_navigate http://localhost:3000/design/stool` → 截圖確認**手機 viewport 仍 render 桌面版**（uiV2=false default）
3. `browser_navigate http://localhost:3000/design/stool?ui=v2` → 在 1280×800 確認**仍 render 桌面版**（md:block）
4. `browser_resize 390×844` → 同 URL → 確認**看到「MobileShell placeholder」**字樣

Expected: 4 步全綠

- [ ] **Step 6: Commit**

```bash
git add app/design/[type]/page.tsx
git commit -m "feat(mobile): add ?ui=v2 feature flag scaffolding

桌面版用 hidden md:block 包起來，當 ui=v2 + 螢幕 <768px 時切換到 mobile placeholder。完整 MobileShell 後續 task 補。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: RangeInput 元件

**Files:**
- Create: `components/mobile/RangeInput.tsx`

- [ ] **Step 1: 元件骨架 + 型別**

```tsx
"use client";

import { useState, useRef, useEffect } from "react";

interface RangeInputProps {
  /** form field name（給 DesignFormShell 抓） */
  name: string;
  /** 中文 label，如「長」「寬」「腳粗」 */
  label: string;
  /** 初始值（從 server defaultValue 來） */
  defaultValue: number;
  /** 單位，如 "mm" "°" */
  unit?: string;
  /** 滑桿 min */
  min: number;
  /** 滑桿 max */
  max: number;
  /** snap 步距（長/寬/高=10, 腳粗/牙板=2, 角度=0.5） */
  step?: number;
  /** help tooltip */
  help?: string;
}

export function RangeInput({
  name,
  label,
  defaultValue,
  unit = "mm",
  min,
  max,
  step = 1,
  help,
}: RangeInputProps) {
  const [value, setValue] = useState<number>(defaultValue);
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // editing 切換時自動 focus
  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  return (
    <div className="flex flex-col gap-1.5 text-sm" title={help}>
      <div className="flex items-center justify-between">
        <span className="text-zinc-700 font-medium">{label}</span>
        {/* 數字 chip / 編輯模式時切換成 input */}
        {editing ? (
          <input
            ref={inputRef}
            type="number"
            name={name}
            value={value}
            min={min}
            max={max}
            step={step}
            onChange={(e) => setValue(Number(e.target.value))}
            onBlur={() => setEditing(false)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                setEditing(false);
              }
            }}
            className="w-20 text-right border-b-2 border-violet-500 px-1 py-0.5 font-mono tabular-nums"
            inputMode="numeric"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="min-h-[44px] min-w-[64px] px-3 py-1 rounded-md bg-zinc-100 hover:bg-zinc-200 font-mono tabular-nums text-zinc-900"
          >
            {value}
            <span className="text-zinc-500 text-xs ml-1">{unit}</span>
          </button>
        )}
      </div>
      {/* 滑桿 */}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => setValue(Number(e.target.value))}
        className="w-full accent-violet-600 h-6 cursor-grab"
        // 不勾 name，name 在隱藏 input 上送（避免 range 跟 chip 衝突）
      />
      {/* 隱藏的 number input 給 form 送 value（DesignFormShell 抓 name） */}
      {!editing && (
        <input type="hidden" name={name} value={value} />
      )}
    </div>
  );
}
```

- [ ] **Step 2: tsc 驗證**

```bash
npx tsc --noEmit 2>&1 | grep "RangeInput.tsx"
```

Expected: 無 error

- [ ] **Step 3: 暫時 mount 測試**

在 `app/design/[type]/page.tsx` 的 MobileShell placeholder 暫時加：

```tsx
{uiV2 && (
  <div className="md:hidden p-4 space-y-4">
    <form>
      {/* RangeInput 自驗 */}
      <div suppressHydrationWarning>
        {/* @ts-ignore */}
        {(() => {
          const RI = require("@/components/mobile/RangeInput").RangeInput;
          return <RI name="length" label="長" defaultValue={350} min={100} max={2400} step={10} />;
        })()}
      </div>
    </form>
  </div>
)}
```

> ⚠️ 這 require/IIFE 寫法只為臨時 smoke test，task 6 整合進 MobileShell 時拿掉。

- [ ] **Step 4: Playwright 驗證**

1. `browser_resize 390×844` → `browser_navigate http://localhost:3000/design/stool?ui=v2`
2. 截圖確認看到「長」+ 滑桿 + 「350 mm」chip
3. 用 `browser_evaluate` 拖動 slider：
   ```js
   const r = document.querySelector('input[type=range]');
   r.value = 800; r.dispatchEvent(new Event('input', {bubbles:true}));
   r.dispatchEvent(new Event('change', {bubbles:true}));
   ```
4. 截圖確認 chip 顯示 800 mm
5. 點 chip 確認變成 input + numeric keyboard 鍵盤模式（inputMode=numeric）

Expected: 全綠

- [ ] **Step 5: 拿掉暫時 mount**

把 step 3 的 require/IIFE 區塊改回 `placeholder` 字樣。

- [ ] **Step 6: Commit**

```bash
git add components/mobile/RangeInput.tsx app/design/[type]/page.tsx
git commit -m "feat(mobile): add RangeInput dual-mode slider+chip

雙模式：拖滑桿快速調整（snap 由 step prop 控制），點 chip → numeric keyboard 精準輸入。values 透過 hidden input 送進 DesignFormShell 既有 blur/Enter 邏輯。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: StickyBottomBar 元件

**Files:**
- Create: `components/mobile/StickyBottomBar.tsx`

- [ ] **Step 1: 元件實作**

```tsx
"use client";

import Link from "next/link";

interface StickyBottomBarProps {
  /** 總價（NTD，已含稅毛利） */
  totalPrice: number;
  /** 重量 kg */
  weight: number;
  /** 報價頁 URL（保留 /quote 路由） */
  quoteUrl: string;
  /** LINE 分享文字（前綴，URL 由 client 用 window.location.href 組） */
  lineShareText: string;
}

export function StickyBottomBar({
  totalPrice,
  weight,
  quoteUrl,
  lineShareText,
}: StickyBottomBarProps) {
  const handleLineShare = () => {
    if (typeof window === "undefined") return;
    const fullText = `${lineShareText} ${window.location.href}`;
    window.open(
      `https://line.me/R/msg/text/?${encodeURIComponent(fullText)}`,
      "_blank",
      "noopener,noreferrer",
    );
  };
  const formattedPrice = new Intl.NumberFormat("zh-TW").format(totalPrice);

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-zinc-200 shadow-[0_-2px_8px_rgba(0,0,0,0.08)]"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3 min-h-[72px]">
        <div className="flex flex-col">
          <span className="text-[11px] text-zinc-500 uppercase tracking-wide">參考總價</span>
          <span className="text-lg font-bold text-zinc-900 tabular-nums">
            NT$ {formattedPrice}
          </span>
          <span className="text-[11px] text-zinc-500">約 {weight.toFixed(1)} kg</span>
        </div>
        <div className="flex gap-2">
          <Link
            href={quoteUrl}
            className="inline-flex items-center justify-center min-h-[44px] px-4 rounded-md bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold"
          >
            💰 報價
          </Link>
          <button
            type="button"
            onClick={handleLineShare}
            className="inline-flex items-center justify-center min-h-[44px] px-4 rounded-md bg-green-600 hover:bg-green-700 text-white text-sm font-semibold"
          >
            📲 LINE
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: tsc 驗證**

```bash
npx tsc --noEmit 2>&1 | grep "StickyBottomBar.tsx"
```

Expected: 無 error

- [ ] **Step 3: Commit**

```bash
git add components/mobile/StickyBottomBar.tsx
git commit -m "feat(mobile): add StickyBottomBar with price + quote + LINE

底部固定 72px 高、含 iOS safe-area inset。總價用 Intl.NumberFormat 千分位，報價走既有 /quote 路由（phase 1 還沒做 sheet）。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: CollapsibleSection 元件

**Files:**
- Create: `components/mobile/CollapsibleSection.tsx`

- [ ] **Step 1: 用 native details/summary 實作**

```tsx
"use client";

interface CollapsibleSectionProps {
  title: string;
  /** 預設展開？預設 false */
  defaultOpen?: boolean;
  /** 右側可選副標（如 "5 件" "12 步"） */
  badge?: string;
  children: React.ReactNode;
}

export function CollapsibleSection({
  title,
  defaultOpen = false,
  badge,
  children,
}: CollapsibleSectionProps) {
  return (
    <details
      open={defaultOpen}
      className="group bg-white border border-zinc-200 rounded-lg overflow-hidden"
    >
      <summary
        className="flex items-center justify-between min-h-[48px] px-4 py-2.5 cursor-pointer list-none select-none hover:bg-zinc-50"
      >
        <div className="flex items-center gap-2">
          <span className="text-zinc-400 transition-transform group-open:rotate-90">▶</span>
          <span className="text-base font-semibold text-zinc-800">{title}</span>
        </div>
        {badge && <span className="text-xs text-zinc-500">{badge}</span>}
      </summary>
      <div className="border-t border-zinc-200 p-4">{children}</div>
    </details>
  );
}
```

- [ ] **Step 2: tsc 驗證**

```bash
npx tsc --noEmit 2>&1 | grep "CollapsibleSection.tsx"
```

Expected: 無 error

- [ ] **Step 3: Commit**

```bash
git add components/mobile/CollapsibleSection.tsx
git commit -m "feat(mobile): add CollapsibleSection (native details/summary)

用瀏覽器原生 details/summary 保證 a11y 跟 SSR；hover icon rotate 提示展開。min-height 48px 觸控目標。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: AdvancedSheet 元件

**Files:**
- Create: `components/mobile/AdvancedSheet.tsx`

- [ ] **Step 1: 元件實作（4 tab 全螢幕 sheet）**

```tsx
"use client";

import { useState } from "react";

type TabId = "structure" | "style" | "joinery" | "scene";

interface AdvancedSheetProps {
  open: boolean;
  onClose: () => void;
  /** 結構 tab（腳/牙板/抽屜/門板等 OptionField） */
  structureContent: React.ReactNode;
  /** 美學 tab（邊緣/把手/五金/木紋） */
  styleContent: React.ReactNode;
  /** 榫接 tab（組裝版/榫接版/榫卯細節） */
  joineryContent: React.ReactNode;
  /** 場景 tab（5 scene preset / 視角 / 線框） */
  sceneContent: React.ReactNode;
}

const TAB_LABEL: Record<TabId, string> = {
  structure: "結構",
  style: "美學",
  joinery: "榫接",
  scene: "場景",
};

export function AdvancedSheet({
  open,
  onClose,
  structureContent,
  styleContent,
  joineryContent,
  sceneContent,
}: AdvancedSheetProps) {
  const [tab, setTab] = useState<TabId>("structure");

  if (!open) return null;

  const contentByTab: Record<TabId, React.ReactNode> = {
    structure: structureContent,
    style: styleContent,
    joinery: joineryContent,
    scene: sceneContent,
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-white flex flex-col"
      role="dialog"
      aria-label="進階設定"
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 min-h-[56px]">
        <button
          type="button"
          onClick={onClose}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center text-zinc-600 hover:text-zinc-900"
          aria-label="關閉"
        >
          ✕
        </button>
        <h2 className="text-base font-semibold">⚙ 進階設定</h2>
        <div className="w-11" /> {/* spacer to center title */}
      </div>
      {/* Tabs */}
      <div className="flex border-b border-zinc-200 bg-zinc-50">
        {(Object.keys(TAB_LABEL) as TabId[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`flex-1 min-h-[48px] text-sm font-medium transition-colors ${
              tab === t
                ? "text-violet-700 border-b-2 border-violet-600 bg-white"
                : "text-zinc-600 hover:text-zinc-900"
            }`}
          >
            {TAB_LABEL[t]}
          </button>
        ))}
      </div>
      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-4 pb-24">
        {contentByTab[tab]}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: tsc 驗證**

```bash
npx tsc --noEmit 2>&1 | grep "AdvancedSheet.tsx"
```

Expected: 無 error

- [ ] **Step 3: Commit**

```bash
git add components/mobile/AdvancedSheet.tsx
git commit -m "feat(mobile): add AdvancedSheet (4-tab full-screen overlay)

結構 / 美學 / 榫接 / 場景 4 tab，z-50 全螢幕；上方 56px header 含關閉按鈕；下方 scrollable content 留 96px padding 給底部 sticky bar。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: MobileTopBar 元件

**Files:**
- Create: `components/mobile/MobileTopBar.tsx`

- [ ] **Step 1: 元件實作**

```tsx
"use client";

import Link from "next/link";

interface MobileTopBarProps {
  /** 家具中文名，如「方凳」 */
  title: string;
  /** 返回連結（通常是 /） */
  backHref: string;
  /** 點 ⋯ 觸發 overflow menu */
  onOverflow: () => void;
}

export function MobileTopBar({ title, backHref, onOverflow }: MobileTopBarProps) {
  return (
    <div className="sticky top-0 z-20 bg-white border-b border-zinc-200">
      <div className="flex items-center justify-between min-h-[56px] px-3">
        <Link
          href={backHref}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center text-zinc-700 hover:text-zinc-900"
          aria-label="返回"
        >
          ←
        </Link>
        <h1 className="text-base font-semibold text-zinc-900 truncate">{title}</h1>
        <button
          type="button"
          onClick={onOverflow}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center text-zinc-700 hover:text-zinc-900"
          aria-label="更多動作"
        >
          ⋯
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: tsc + commit**

```bash
npx tsc --noEmit 2>&1 | grep "MobileTopBar.tsx"
git add components/mobile/MobileTopBar.tsx
git commit -m "feat(mobile): add MobileTopBar (sticky top, 56px)

← 返回 / 家具名 / ⋯ 更多 三段式佈局，左右按鈕都 44×44 觸控目標。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: MobileOverflowMenu 元件

**Files:**
- Create: `components/mobile/MobileOverflowMenu.tsx`

- [ ] **Step 1: 元件實作（簡單 bottom sheet 列表）**

```tsx
"use client";

import Link from "next/link";

interface MobileOverflowMenuProps {
  open: boolean;
  onClose: () => void;
  cutPlanUrl: string;
  printUrl: string;
  /** 觸發複製連結 / QR / CSV 等 callback */
  onShareLink: () => void;
  onDownloadCsv: () => void;
}

export function MobileOverflowMenu({
  open,
  onClose,
  cutPlanUrl,
  printUrl,
  onShareLink,
  onDownloadCsv,
}: MobileOverflowMenuProps) {
  if (!open) return null;

  const items = [
    { label: "📐 裁切單", href: cutPlanUrl, action: null as null | (() => void) },
    { label: "📋 材料 CSV", href: null, action: onDownloadCsv },
    { label: "🔗 複製連結", href: null, action: onShareLink },
    { label: "🖨 列印 / PDF", href: printUrl, action: null },
  ];

  return (
    <>
      {/* backdrop */}
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      {/* sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-2xl"
           style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="flex items-center justify-center pt-3 pb-1">
          <div className="w-12 h-1 rounded-full bg-zinc-300" />
        </div>
        <ul className="py-2">
          {items.map((it) => (
            <li key={it.label}>
              {it.href ? (
                <Link
                  href={it.href}
                  onClick={onClose}
                  className="flex items-center min-h-[48px] px-5 text-base text-zinc-800 hover:bg-zinc-50"
                >
                  {it.label}
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    it.action?.();
                    onClose();
                  }}
                  className="w-full flex items-center min-h-[48px] px-5 text-base text-zinc-800 hover:bg-zinc-50 text-left"
                >
                  {it.label}
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
```

- [ ] **Step 2: tsc + commit**

```bash
npx tsc --noEmit 2>&1 | grep "MobileOverflowMenu.tsx"
git add components/mobile/MobileOverflowMenu.tsx
git commit -m "feat(mobile): add MobileOverflowMenu (L4 bottom sheet)

點 ⋯ 彈出 backdrop + 底部 sheet 列表：裁切單 / CSV / 複製連結 / 列印。每項 ≥ 48px 觸控目標。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: MobileOptionField 元件（OptionField 的 mobile 版）

**Files:**
- Create: `components/mobile/MobileOptionField.tsx`

- [ ] **Step 1: 元件實作（number 走 RangeInput）**

```tsx
"use client";

import type { OptionSpec, OptionDependency } from "@/lib/types";
import { RangeInput } from "./RangeInput";

function evalDep(
  dep: OptionDependency,
  values: Record<string, string | number | boolean>,
): boolean {
  // 跟 server 端 evalDep 邏輯一致——這裡為了 client mobile 沿用
  if ("all" in dep) return dep.all.every((d) => evalDep(d, values));
  if ("any" in dep) return dep.any.some((d) => evalDep(d, values));
  if ("not" in dep) return !evalDep(dep.not, values);
  const v = values[dep.key];
  if ("equals" in dep) return v === dep.equals;
  if ("in" in dep) return dep.in.includes(v as string);
  return true;
}

interface MobileOptionFieldProps {
  spec: OptionSpec;
  value: string | number | boolean;
  allValues?: Record<string, string | number | boolean>;
}

export function MobileOptionField({ spec, value, allValues }: MobileOptionFieldProps) {
  if (spec.type === "number") {
    return (
      <RangeInput
        name={spec.key}
        label={spec.label}
        defaultValue={Number(value)}
        unit={spec.unit ?? ""}
        min={spec.min ?? 0}
        max={spec.max ?? 9999}
        step={spec.step ?? 1}
        help={spec.help}
      />
    );
  }
  if (spec.type === "select") {
    const visibleChoices = spec.choices.filter(
      (c) => !c.dependsOn || (allValues && evalDep(c.dependsOn, allValues)),
    );
    return (
      <label className="flex flex-col gap-1 text-sm" title={spec.help}>
        <span className="text-zinc-700 font-medium">{spec.label}</span>
        <select
          name={spec.key}
          defaultValue={String(value)}
          className="min-h-[44px] border border-zinc-300 rounded-md px-3 py-2 bg-white text-zinc-900 text-base"
        >
          {visibleChoices.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
        {spec.help && <span className="text-xs text-zinc-500">{spec.help}</span>}
      </label>
    );
  }
  // checkbox → switch toggle
  return (
    <label className="flex items-center justify-between gap-2 min-h-[44px] text-sm" title={spec.help}>
      <span className="text-zinc-800 flex-1">{spec.label}</span>
      <input
        type="checkbox"
        name={spec.key}
        defaultChecked={Boolean(value)}
        className="w-12 h-6 accent-violet-600"
      />
    </label>
  );
}
```

- [ ] **Step 2: tsc + commit**

```bash
npx tsc --noEmit 2>&1 | grep "MobileOptionField.tsx"
git add components/mobile/MobileOptionField.tsx
git commit -m "feat(mobile): add MobileOptionField using RangeInput for numbers

number → RangeInput; select → 44px min-height dropdown; checkbox → 24x48 switch. select choices 沿用 evalDep 邏輯（dependsOn 過濾）。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: MobileShell 整合所有元件

**Files:**
- Create: `components/mobile/MobileShell.tsx`

- [ ] **Step 1: 拆解 props（拿 server 端已算好的資料）**

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { LazyPerspectiveView } from "@/components/LazyPerspectiveView";
import { ZoomableThreeViews } from "@/components/ZoomableThreeViews";
import { MaterialListWithSelection } from "@/components/MaterialListWithSelection";
import { ToolList } from "@/components/ToolList";
import { BuildSteps } from "@/components/BuildSteps";
import { StylePresetButtons } from "@/components/design/StylePresetButtons";
import { DesignFormShell } from "@/components/design/DesignFormShell";
import { SaveDesignButton } from "@/components/SaveDesignButton";
import { MobileTopBar } from "./MobileTopBar";
import { StickyBottomBar } from "./StickyBottomBar";
import { CollapsibleSection } from "./CollapsibleSection";
import { AdvancedSheet } from "./AdvancedSheet";
import { MobileOverflowMenu } from "./MobileOverflowMenu";
import { MobileOptionField } from "./MobileOptionField";
import { RangeInput } from "./RangeInput";
import type { FurnitureCatalogEntry } from "@/lib/templates";
import type { FurnitureDesign, MaterialId, OptionSpec } from "@/lib/types";
import { MATERIALS } from "@/lib/materials";

interface MobileShellProps {
  entry: FurnitureCatalogEntry;
  design: FurnitureDesign;
  length: number;
  width: number;
  height: number;
  material: MaterialId;
  optionValues: Record<string, string | number | boolean>;
  /** 從 server 算好的總價（NTD） */
  totalPrice: number;
  /** 重量 kg */
  weight: number;
  /** /design/[type] base URL */
  designUrl: string;
  /** /design/[type]/quote URL（含參數） */
  quoteUrl: string;
  /** /design/[type]/cut-plan URL */
  cutPlanUrl: string;
  /** /design/[type]/quote/print URL */
  printUrl: string;
  /** LINE 分享文字前綴（URL 在 client 端組） */
  lineShareText: string;
  /** form action target = designUrl */
  formAction: string;
}
```

- [ ] **Step 2: render L0 + L1 主表單骨架**

接在 Step 1 後：

```tsx
export function MobileShell(props: MobileShellProps) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [overflowOpen, setOverflowOpen] = useState(false);

  const { entry, design, length, width, height, material, optionValues, formAction } = props;
  const optionSchema: OptionSpec[] = entry.optionSchema ?? [];

  // 分流 spec 到 4 tab。先匹配美學 / 榫接，剩下的全進「結構」當 catch-all（避免漏選項）。
  // 場景：scene / wireframe / view（這些不在 optionSchema，是 URL state，phase 2 整合 SceneThemeToggle 等元件）
  const inGroup = (s: OptionSpec, keywords: string[]) =>
    keywords.some((k) => s.key.toLowerCase().includes(k));
  const styleSpecs = optionSchema.filter((s) =>
    inGroup(s, ["edge", "handle", "grain", "pull", "hardware", "knob", "finish"]),
  );
  const joinerySpecs = optionSchema.filter((s) =>
    inGroup(s, ["joinery", "tenon", "mortise", "joint"]) && !styleSpecs.includes(s),
  );
  const structureSpecs = optionSchema.filter(
    (s) => !styleSpecs.includes(s) && !joinerySpecs.includes(s),
  );

  return (
    <div className="md:hidden min-h-screen bg-zinc-50 pb-24">
      <MobileTopBar
        title={entry.nameZh}
        backHref="/"
        onOverflow={() => setOverflowOpen(true)}
      />

      <DesignFormShell action={formAction} className="px-4 py-3 space-y-4">
        {/* L1 · 3D viewer 固定 280px */}
        <div className="rounded-lg overflow-hidden border border-zinc-200 bg-white">
          <div style={{ height: 280 }}>
            <LazyPerspectiveView design={design} />
          </div>
        </div>

        {/* L1 · 風格 chip */}
        <div className="rounded-lg bg-white p-3 border border-zinc-200">
          <div className="text-xs text-zinc-500 mb-2">風格</div>
          <div className="overflow-x-auto -mx-1 px-1">
            <StylePresetButtons category={entry.category} />
          </div>
        </div>

        {/* L1 · 尺寸 + 材料 */}
        <div className="rounded-lg bg-white p-4 border border-zinc-200 space-y-4">
          <div className="grid grid-cols-1 gap-4">
            <RangeInput name="length" label="長" defaultValue={length} min={entry.limits.length.min} max={entry.limits.length.max} step={10} />
            <RangeInput name="width" label="寬" defaultValue={width} min={entry.limits.width.min} max={entry.limits.width.max} step={10} />
            <RangeInput name="height" label="高" defaultValue={height} min={entry.limits.height.min} max={entry.limits.height.max} step={10} />
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-zinc-700 font-medium">材料</span>
              <select
                name="material"
                defaultValue={material}
                className="min-h-[44px] border border-zinc-300 rounded-md px-3 py-2 bg-white text-zinc-900 text-base"
              >
                {Object.entries(MATERIALS).map(([id, m]) => (
                  <option key={id} value={id}>{m.nameZh}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <SaveDesignButton design={design} />
            <button
              type="button"
              onClick={() => setAdvancedOpen(true)}
              className="min-h-[44px] rounded-md bg-zinc-800 hover:bg-zinc-900 text-white text-sm font-semibold"
            >
              ⚙ 進階設定
            </button>
          </div>
        </div>

        {/* L2 · 折疊區段 */}
        <CollapsibleSection title="三視圖" badge="點圖放大">
          <ZoomableThreeViews design={design} />
        </CollapsibleSection>

        <CollapsibleSection title="材料清單" badge={`${design.parts.length} 件`}>
          <MaterialListWithSelection design={design} />
        </CollapsibleSection>

        <CollapsibleSection title="工法 · 工序 · 工具">
          <div className="space-y-4">
            <BuildSteps design={design} />
            <ToolList design={design} />
          </div>
        </CollapsibleSection>
      </DesignFormShell>

      {/* L0 · sticky bottom */}
      <StickyBottomBar
        totalPrice={props.totalPrice}
        weight={props.weight}
        quoteUrl={props.quoteUrl}
        lineShareText={props.lineShareText}
      />

      {/* L3 · 進階 sheet */}
      <AdvancedSheet
        open={advancedOpen}
        onClose={() => setAdvancedOpen(false)}
        structureContent={
          <DesignFormShell action={formAction} className="space-y-4">
            {structureSpecs.length === 0 ? (
              <div className="text-sm text-zinc-500">此家具無結構選項</div>
            ) : (
              structureSpecs.map((s) => (
                <MobileOptionField key={s.key} spec={s} value={optionValues[s.key]} allValues={optionValues} />
              ))
            )}
          </DesignFormShell>
        }
        styleContent={
          <DesignFormShell action={formAction} className="space-y-4">
            {styleSpecs.map((s) => (
              <MobileOptionField key={s.key} spec={s} value={optionValues[s.key]} allValues={optionValues} />
            ))}
          </DesignFormShell>
        }
        joineryContent={
          <DesignFormShell action={formAction} className="space-y-4">
            {joinerySpecs.map((s) => (
              <MobileOptionField key={s.key} spec={s} value={optionValues[s.key]} allValues={optionValues} />
            ))}
            <p className="text-xs text-zinc-500 mt-4">榫卯細節圖：phase 2 整合。</p>
          </DesignFormShell>
        }
        sceneContent={
          <div className="space-y-4 text-sm text-zinc-700">
            <p>場景 / 視角 / 線框設定：phase 2 整合（暫用 URL ?scene= ?wf=1 手動帶）。</p>
          </div>
        }
      />

      {/* L4 · ⋯ 更多 */}
      <MobileOverflowMenu
        open={overflowOpen}
        onClose={() => setOverflowOpen(false)}
        cutPlanUrl={props.cutPlanUrl}
        printUrl={props.printUrl}
        onShareLink={() => {
          if (typeof navigator !== "undefined" && "clipboard" in navigator) {
            navigator.clipboard.writeText(window.location.href);
            alert("連結已複製");
          }
        }}
        onDownloadCsv={() => {
          alert("材料 CSV phase 2 整合");
        }}
      />
    </div>
  );
}
```

- [ ] **Step 3: tsc 驗證**

```bash
npx tsc --noEmit 2>&1 | grep "mobile/MobileShell.tsx"
```

Expected: 無 error（若有 import path / type missing，補齊）

- [ ] **Step 4: Commit**

```bash
git add components/mobile/MobileShell.tsx
git commit -m "feat(mobile): assemble MobileShell with L0/L1/L2/L3/L4 layers

組合 MobileTopBar / 3D fixed 280px / StylePreset chip / 4 RangeInput L1 主表單 / 3 CollapsibleSection L2 / AdvancedSheet 4-tab L3 / StickyBottomBar L0 / MobileOverflowMenu L4。OptionSpec 用 keyword 分流到 4 tab（leg/apron→結構、edge/handle→美學、joinery/tenon→榫接）。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: 接到 /design/[type]/page.tsx

**Files:**
- Modify: `app/design/[type]/page.tsx`

- [ ] **Step 1: 算 totalPrice + weight + 各 URL（server 端）**

在 `app/design/[type]/page.tsx` 偵測 uiV2 為 true 後，加：

```tsx
// MobileShell 需要：totalPrice / weight / URLs
import { calculateQuote } from "@/lib/pricing/quote";
import { LABOR_DEFAULTS } from "@/lib/pricing/labor";
import { MATERIAL_PRICE_PER_BDFT } from "@/lib/pricing/catalog";

// uiV2 block:
let mobileTotalPrice = 0;
let mobileWeight = 0;
if (uiV2) {
  const quote = calculateQuote({
    design,
    primaryMaterialPricePerBdft: MATERIAL_PRICE_PER_BDFT[material] ?? 300,
    labor: LABOR_DEFAULTS,
    plywoodPricePerBdft: undefined,
    mdfPricePerBdft: undefined,
  });
  mobileTotalPrice = quote.totalWithVat;
  mobileWeight = design.totalWeightKg ?? 0;
}

const designUrl = `/design/${entry.category}`;
const quoteUrl = `${designUrl}/quote?${new URLSearchParams({
  length: String(length), width: String(width), height: String(height), material,
}).toString()}`;
const cutPlanUrl = `${designUrl}/cut-plan`;
const printUrl = `${quoteUrl}&print=1`;
const lineShareText = `木頭仁設計：${entry.nameZh} ${length}×${width}×${height}mm`;
```

> ⚠️ `LABOR_DEFAULTS` / `MATERIAL_PRICE_PER_BDFT` / `calculateQuote` 路徑要對齊 quote/page.tsx 既有 import，動手前 grep 一下。LINE 完整 URL 在 client 端 `window.location.href` 組（不用 SSR 環境 hardcode hostname）。

- [ ] **Step 2: 把 placeholder 換成 MobileShell**

```tsx
import { MobileShell } from "@/components/mobile/MobileShell";

// 替換 placeholder 那段：
{uiV2 && (
  <MobileShell
    entry={entry}
    design={design}
    length={length}
    width={width}
    height={height}
    material={material}
    optionValues={options}
    totalPrice={mobileTotalPrice}
    weight={mobileWeight}
    designUrl={designUrl}
    quoteUrl={quoteUrl}
    cutPlanUrl={cutPlanUrl}
    printUrl={printUrl}
    lineShareText={lineShareText}
    formAction={designUrl}
  />
)}
```

- [ ] **Step 3: tsc 驗證**

```bash
npx tsc --noEmit 2>&1 | grep -v node_modules | grep "design/\[type\]/page.tsx\|MobileShell"
```

Expected: 無 error

- [ ] **Step 4: Playwright 完整流程驗證**

1. `browser_resize 390×844`
2. `browser_navigate http://localhost:3000/design/stool?ui=v2`
3. 截圖：應看到 MobileTopBar + 3D + 風格 + 尺寸 RangeInputs + 折疊區 + 底部 NT$xx 報價/LINE
4. 拖第一個 slider（長）到 800
   ```js
   const r = document.querySelectorAll('input[type=range]')[0];
   r.value = 800;
   r.dispatchEvent(new Event('input', {bubbles:true}));
   r.dispatchEvent(new Event('change', {bubbles:true}));
   ```
5. 等 500ms 後截圖，3D 應跟著變長
6. 點 ⚙ 進階設定 → AdvancedSheet 開、應看到 4 tab、可切換結構/美學/榫接/場景
7. 點 ✕ 關閉 sheet
8. 點 ⋯ 更多 → MobileOverflowMenu 開
9. 點裁切單 → 應導去 /cut-plan
10. 桌面版 regression：`browser_resize 1280×800` → `browser_navigate http://localhost:3000/design/stool` → 截圖確認**桌面版完全不變**
11. 桌面版 ui=v2：`browser_navigate http://localhost:3000/design/stool?ui=v2` → 桌面版仍正常（md:hidden 蓋住 mobile）

Expected: 11 步全綠

- [ ] **Step 5: audit 跑一輪**

```bash
npx tsx scripts/audit-overlaps.ts 2>&1 | tail -10
```

Expected: 0 overlaps（不該動到 geometry）

- [ ] **Step 6: Commit**

```bash
git add app/design/[type]/page.tsx
git commit -m "feat(mobile): wire MobileShell into /design/[type] under ?ui=v2

server 端算 totalPrice / weight / URLs 傳給 MobileShell；MobileShell 用 md:hidden、桌面版用 hidden md:block 隔離；4 RangeInput + 進階 sheet + 折疊區全打通。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: A11y + 觸控目標 + 字級 audit

**Files:**
- Modify: 任何 components/mobile/*.tsx 不符規範的

- [ ] **Step 1: 跑 a11y 數據蒐集**

`browser_resize 390×844` → `browser_navigate http://localhost:3000/design/stool?ui=v2` → `browser_evaluate`：

```js
const issues = [];
document.querySelectorAll('button,a,input,select,[role=button]').forEach((el) => {
  const r = el.getBoundingClientRect();
  if (r.height > 0 && r.height < 44) {
    issues.push({type:'tap-target', tag:el.tagName, text:el.textContent?.slice(0,30), h:r.height, w:r.width});
  }
});
document.querySelectorAll('p,span,div,label,h1,h2,h3,a,button').forEach((el) => {
  if (el.children.length > 0) return;
  const fs = parseFloat(getComputedStyle(el).fontSize);
  if (fs > 0 && fs < 12) {
    issues.push({type:'font-size', tag:el.tagName, text:el.textContent?.slice(0,30), fs});
  }
});
JSON.stringify(issues, null, 2);
```

- [ ] **Step 2: 列出違規清單**

把 evaluate 回傳的 issues 寫成 markdown 清單。每筆有 tag / text / size。

- [ ] **Step 3: 逐個修**

對每個違規：
- tap-target h<44 → 把 className 加 `min-h-[44px]` 或 padding
- font-size <12 → 把 `text-[10px] / text-[11px]` 升 `text-xs`

- [ ] **Step 4: 重跑 step 1 驗證**

Expected: issues 陣列為空 `[]`

- [ ] **Step 5: Commit**

```bash
git add components/mobile/*.tsx
git commit -m "fix(mobile): a11y audit pass — all tap targets ≥44px, fonts ≥12px

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 12: 桌面版 regression playwright 自驗

**Files:**
- 無修改，純驗證

- [ ] **Step 1: 桌面版 4 個 URL 截圖比對**

`browser_resize 1280×800`，分別截圖：
- `/design/stool`
- `/design/stool?ui=v2`
- `/design/dining-table`
- `/design/chest-of-drawers`

`browser_take_screenshot fullPage=true filename=desktop-regression-N.png`

- [ ] **Step 2: 跟 git stash 之前的桌面版比較**

肉眼比對：佈局、按鈕、間距、顏色是否完全一致。

Expected: 4 張圖跟 main 之前桌面版渲染完全一致。若有差異 → 退回查 className 是否誤改桌面版區塊。

- [ ] **Step 3: 自動 audit**

```bash
npx tsx scripts/audit-overlaps.ts 2>&1 | tail -5
npx tsx scripts/audit-joints.ts 2>&1 | tail -5
```

Expected: 0 overlaps / joints unchanged

- [ ] **Step 4: 若有 regression，修；若無，pass**

無 commit（純驗證 task）。

---

## Task 13: 最終 push + spec acceptance 對齊

**Files:**
- 無修改

- [ ] **Step 1: 把 spec Phase 1 驗收 8 條逐一打勾**

對 `docs/superpowers/specs/2026-05-13-wrd-mobile-redesign.md` 的 Phase 1 驗收清單，用 `browser_resize 390×844` 跑：

- [ ] iPhone 14 (390×844) `/design/stool?ui=v2` 首屏看到：3D + 風格 + 尺寸 + 底部報價 bar
- [ ] 設計頁 full height ≤ 2400px（用 `browser_evaluate` 跑 `document.body.scrollHeight` 驗證）
- [ ] 進階設定點開可改腳/牙板/榫卯，關閉回主表單
- [ ] 觸控按鈕全部 ≥ 44px，字級全部 ≥ 12px（task 11 已 audit）
- [ ] sticky bottom bar 一直顯示 NT$ 總價
- [ ] 拖滑桿可改長/寬/高/腳粗，3D 即時跟著動
- [ ] 點 chip 開鍵盤可精準輸入
- [ ] desktop 版（≥ 768px）行為完全不變（task 12 已 verify）

任何不過的回前面 task 補。

- [ ] **Step 2: 寫 verify-mobile-phase1.md 報告**

把 8 條驗收結果 + 截圖 path 列在 `docs/superpowers/plans/verify-mobile-phase1.md`。

- [ ] **Step 3: 最終 push**

```bash
git log --oneline main..HEAD  # 看本 plan 累積 commits
git push
```

- [ ] **Step 4: 更新 memory**

更新 `~/.claude/projects/-Users-wengevaq989/memory/project_wrd_mobile_redesign.md` 加一段「Phase 1 完成」+ HEAD commit + 下一階段 Phase 2 待辦。

---

## Out of scope（Phase 1 不做）

- /quote、/cut-plan、/print 改 sheet（Phase 2）
- 3D 三狀態 swipe（Phase 3）
- 鍵盤偵測自動縮 3D（Phase 3）
- 場景 / 視角 / 線框設定 UI 在 AdvancedSheet 4th tab（暫用 URL hack，Phase 2 整合）
- 榫卯細節圖在 AdvancedSheet（Phase 2）
- 「材料 CSV」「複製連結」實際下載/複製（Phase 1 用 alert placeholder）
- 鎖頭家具的 paywall toast（spec 提及但歸 Phase 2 + permissions 模組重構）

---

## References

- Spec: `docs/superpowers/specs/2026-05-13-wrd-mobile-redesign.md`
- 既有元件 grep 點：
  - `LazyPerspectiveView` → `components/LazyPerspectiveView.tsx`
  - `ZoomableThreeViews` → `components/ZoomableThreeViews.tsx`
  - `MaterialListWithSelection` → `components/MaterialListWithSelection.tsx`
  - `StylePresetButtons` → `components/design/StylePresetButtons.tsx`
  - `DesignFormShell` → `components/design/DesignFormShell.tsx`（已有 number/text blur-only）
  - `calculateQuote` → `lib/pricing/quote.ts`
  - `MATERIAL_PRICE_PER_BDFT` → `lib/pricing/catalog.ts`
  - `LABOR_DEFAULTS` → `lib/pricing/labor.ts`
- AGENTS.md 不需查 `docs/drafting-math.md`（本 plan 不動 geometry / projection / templates）
