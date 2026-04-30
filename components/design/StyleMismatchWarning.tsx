"use client";

import { useSearchParams } from "next/navigation";
import { STYLE_PRESETS } from "@/lib/knowledge/style-presets";
import { MATERIALS } from "@/lib/materials";
import type { MaterialId } from "@/lib/types";

/**
 * 風格 / 木種 mismatch 警告。
 *
 * 觸發條件：使用者按過 StylePresetButtons（URL 有 `style` 參數），
 * 但後來改了 `material` 變成不在該風格 preset.materials 清單內的木種。
 *
 * 例：套了 Shaker（傳統 maple/cherry/walnut）→ 改成 teak → 警告
 * 「Shaker 傳統用 maple/cherry/pine 等淺色硬木，柚木偏 Mid-Century / 殖民風」。
 *
 * 為什麼必要：preset 一鍵套很方便，但使用者後續會微調，沒驗證的話
 * UI 變「假風格」（看起來是 Shaker 風但用了違和木種）。
 */
export function StyleMismatchWarning() {
  const sp = useSearchParams();
  const styleId = sp?.get("style");
  const materialId = sp?.get("material") as MaterialId | null;

  if (!styleId || !materialId) return null;
  const preset = STYLE_PRESETS[styleId];
  if (!preset) return null;
  if (preset.materials.includes(materialId)) return null;

  const presetMaterialNames = preset.materials
    .map((m) => MATERIALS[m]?.nameZh ?? m)
    .join(" / ");
  const currentMaterialName = MATERIALS[materialId]?.nameZh ?? materialId;

  return (
    <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50/70 px-3 py-2.5">
      <div className="flex items-start gap-2 text-xs text-amber-900">
        <span className="text-base leading-none">⚠️</span>
        <div className="flex-1">
          <span className="font-medium">{preset.nameZh}</span>
          <span> 風格傳統用 </span>
          <span className="font-medium">{presetMaterialNames}</span>
          <span>，目前選的 </span>
          <span className="font-medium text-amber-800">{currentMaterialName}</span>
          <span> 偏離風格——可能變成「假{preset.nameZh}」。</span>
          <div className="mt-1 text-[11px] text-amber-700">
            來源：{preset.source}
          </div>
        </div>
      </div>
    </div>
  );
}
