"use client";

/**
 * /raised-floor — 防潮墊 + 踢腳板 設定區塊(可摺疊)
 *
 * 獨立元件:不直接 setState、改透過 props.set 把整把 setter 接出去,
 * 方便 RaisedFloorClient.tsx 之後手動 wire 進來而不衝突。
 */
import { useTranslations } from "next-intl";
import { FloorRangeInput } from "@/app/[locale]/floor/FloorRangeInput";
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

export function UnderlaySkirtingSection({
  input,
  set,
}: UnderlaySkirtingSectionProps) {
  const t = useTranslations("raisedFloorTool.underlaySkirting");
  const underlayId = input.underlay?.id ?? "";
  const skirtingType: SkirtingType = input.skirtingType ?? "none";
  const skirtingActive = skirtingType !== "none";

  const skirtingOptions: { value: SkirtingType; label: string }[] = [
    { value: "none", label: t("noneOption") },
    { value: "wood", label: t("skirtingWood") },
    { value: "pvc", label: t("skirtingPvc") },
  ];

  return (
    <div className="space-y-3">
      {/* 防潮墊 */}
      <details className="rounded-lg border border-zinc-200 p-4">
        <summary className="cursor-pointer text-sm font-semibold">
          {t("underlaySection")}
        </summary>
        <div className="mt-3 space-y-3">
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-zinc-500">{t("underlaySpecLabel")}</span>
            <select
              className="rounded border border-zinc-300 px-2 py-1"
              value={underlayId}
              onChange={(e) => {
                const id = e.target.value;
                set("underlay", id === "" ? undefined : getUnderlayPreset(id));
              }}
            >
              <option value="">{t("noneOption")}</option>
              {UNDERLAY_PRESETS.map((u) => (
                <option key={u.id} value={u.id}>
                  {t("underlayOptionFormat", {
                    name: u.nameZh,
                    areaM2: u.rollAreaM2,
                  })}
                </option>
              ))}
            </select>
          </label>
          {input.underlay && (
            <>
              <FloorRangeInput
                label={t("wasteLabel")}
                unit={t("wasteUnit")}
                value={Math.round((input.underlayWaste ?? 0.1) * 100)}
                min={0}
                max={50}
                step={5}
                onChange={(v) => set("underlayWaste", v / 100)}
              />
              <p className="text-[11px] text-zinc-500">
                {t("underlayPriceHint", { price: input.underlay.pricePerRoll })}
              </p>
            </>
          )}
        </div>
      </details>

      {/* 踢腳板 */}
      <details className="rounded-lg border border-zinc-200 p-4">
        <summary className="cursor-pointer text-sm font-semibold">
          {t("skirtingSection")}
        </summary>
        <div className="mt-3 space-y-3">
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-zinc-500">{t("skirtingTypeLabel")}</span>
            <select
              className="rounded border border-zinc-300 px-2 py-1"
              value={skirtingType}
              onChange={(e) =>
                set("skirtingType", e.target.value as SkirtingType)
              }
            >
              {skirtingOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          {skirtingActive && (
            <>
              <FloorRangeInput
                label={t("skirtingHeightLabel")}
                unit={t("skirtingHeightUnit")}
                value={input.skirtingHeightCm ?? 8}
                min={3}
                max={20}
                step={1}
                onChange={(v) => set("skirtingHeightCm", v)}
              />
              <FloorRangeInput
                label={t("doorCountLabel")}
                unit={t("doorCountUnit")}
                value={input.doorCount ?? 0}
                min={0}
                max={10}
                step={1}
                onChange={(v) => set("doorCount", v)}
              />
              {(input.doorCount ?? 0) > 0 && (
                <FloorRangeInput
                  label={t("doorWidthLabel")}
                  unit={t("doorWidthUnit")}
                  value={input.doorWidthCm ?? 90}
                  min={60}
                  max={200}
                  step={5}
                  onChange={(v) => set("doorWidthCm", v)}
                />
              )}
              <p className="text-[11px] text-zinc-500">
                {t("skirtingFormulaHint")}
              </p>
            </>
          )}
        </div>
      </details>
    </div>
  );
}
