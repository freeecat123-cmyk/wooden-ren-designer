"use client";

/**
 * /raised-floor — 防潮墊 + 踢腳板 設定區塊(可摺疊)
 *
 * 獨立元件:不直接 setState、改透過 props.set 把整把 setter 接出去,
 * 方便 RaisedFloorClient.tsx 之後手動 wire 進來而不衝突。
 *
 * 顯示位置建議:BOM 表下方(估價 ⑥ 之後)。
 *
 * 內部分兩個 details:
 *   1. 防潮墊 — preset 下拉 + 損耗滑桿(undefined = 不裝)
 *   2. 踢腳板 — none/wood/pvc 三選一 + 高度 + 門洞數/寬度
 */
import { FloorRangeInput } from "@/app/floor/FloorRangeInput";
import { UNDERLAY_PRESETS, getUnderlayPreset } from "@/lib/raised-floor/presets";
import type {
  RaisedFloorInput,
  SkirtingType,
} from "@/lib/raised-floor/types";

export interface UnderlaySkirtingSectionProps {
  /** 完整 input 物件 */
  input: RaisedFloorInput;
  /** 單欄 setter(沿用 RaisedFloorClient 既有 helper 的型別簽名) */
  set: <K extends keyof RaisedFloorInput>(k: K, v: RaisedFloorInput[K]) => void;
}

const SKIRTING_OPTIONS: { value: SkirtingType; label: string }[] = [
  { value: "none", label: "不裝" },
  { value: "wood", label: "木質踢腳" },
  { value: "pvc", label: "PVC 踢腳" },
];

export function UnderlaySkirtingSection({
  input,
  set,
}: UnderlaySkirtingSectionProps) {
  const underlayId = input.underlay?.id ?? "";
  const skirtingType: SkirtingType = input.skirtingType ?? "none";
  const skirtingActive = skirtingType !== "none";

  return (
    <div className="space-y-3">
      {/* 防潮墊 */}
      <details className="rounded-lg border border-zinc-200 p-4">
        <summary className="cursor-pointer text-sm font-semibold">
          ⑦ 防潮墊
        </summary>
        <div className="mt-3 space-y-3">
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-zinc-500">防潮墊規格</span>
            <select
              className="rounded border border-zinc-300 px-2 py-1"
              value={underlayId}
              onChange={(e) => {
                const id = e.target.value;
                set("underlay", id === "" ? undefined : getUnderlayPreset(id));
              }}
            >
              <option value="">不裝</option>
              {UNDERLAY_PRESETS.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nameZh}({u.rollAreaM2}m²/卷)
                </option>
              ))}
            </select>
          </label>
          {input.underlay && (
            <>
              <FloorRangeInput
                label="損耗"
                unit="%"
                value={Math.round((input.underlayWaste ?? 0.1) * 100)}
                min={0}
                max={50}
                step={5}
                onChange={(v) => set("underlayWaste", v / 100)}
              />
              <p className="text-[11px] text-zinc-500">
                預設報價 NT$ {input.underlay.pricePerRoll}/卷(可在價格區覆寫)
              </p>
            </>
          )}
        </div>
      </details>

      {/* 踢腳板 */}
      <details className="rounded-lg border border-zinc-200 p-4">
        <summary className="cursor-pointer text-sm font-semibold">
          ⑧ 踢腳板
        </summary>
        <div className="mt-3 space-y-3">
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-zinc-500">踢腳種類</span>
            <select
              className="rounded border border-zinc-300 px-2 py-1"
              value={skirtingType}
              onChange={(e) =>
                set("skirtingType", e.target.value as SkirtingType)
              }
            >
              {SKIRTING_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          {skirtingActive && (
            <>
              <FloorRangeInput
                label="踢腳高度"
                unit="cm"
                value={input.skirtingHeightCm ?? 8}
                min={3}
                max={20}
                step={1}
                onChange={(v) => set("skirtingHeightCm", v)}
              />
              <FloorRangeInput
                label="門洞數量"
                unit="個"
                value={input.doorCount ?? 0}
                min={0}
                max={10}
                step={1}
                onChange={(v) => set("doorCount", v)}
              />
              {(input.doorCount ?? 0) > 0 && (
                <FloorRangeInput
                  label="每個門洞寬"
                  unit="cm"
                  value={input.doorWidthCm ?? 90}
                  min={60}
                  max={200}
                  step={5}
                  onChange={(v) => set("doorWidthCm", v)}
                />
              )}
              <p className="text-[11px] text-zinc-500">
                踢腳板長度 = 平台周長 − 門洞數 × 門洞寬
              </p>
            </>
          )}
        </div>
      </details>
    </div>
  );
}

// TODO: 在 RaisedFloorClient.tsx 把 <UnderlaySkirtingSection /> 加進 BOM 區下方
//   範例:
//     import { UnderlaySkirtingSection } from "./UnderlaySkirtingSection";
//     ...
//     <UnderlaySkirtingSection input={input} set={set} />
