"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { SCENE_THEME_LIST, type SceneThemeId } from "@/lib/design/scene-themes";

/**
 * 3D 場景環境主題切換器。
 *
 * 透過 URL 參數 `?scene=nordic` 控制（server-rendered design 重算+套用）。
 * 預設 natural（純白懸浮）；切到 nordic / japandi / industrial / chinese
 * 後會在 3D 加地板 + 調光，給客戶看「擺在家裡的樣子」。
 */
export function SceneThemeToggle({ current }: { current: SceneThemeId }) {
  const t = useTranslations("sceneToggle");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const onSelect = (id: SceneThemeId) => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    if (id === "natural") {
      params.delete("scene");
    } else {
      params.set("scene", id);
    }
    const qs = params.toString();
    const path = pathname ?? "/";
    router.replace(qs ? `${path}?${qs}` : path, { scroll: false });
  };

  return (
    <div className="flex items-center gap-1 px-3 py-2 border-b border-amber-100 bg-amber-50/40">
      <span className="text-[11px] font-medium text-zinc-600 mr-1.5">{t("sceneLbl")}</span>
      {SCENE_THEME_LIST.map((theme) => {
        const active = theme.id === current;
        const label = t(theme.id);
        return (
          <button
            key={theme.id}
            type="button"
            onClick={() => onSelect(theme.id)}
            title={label}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] transition-all ${
              active
                ? "bg-amber-600 text-white shadow-sm shadow-amber-900/20"
                : "bg-white text-zinc-700 border border-zinc-200 hover:border-amber-300 hover:bg-amber-50"
            }`}
          >
            <span
              className="inline-block w-3 h-3 rounded-sm border border-black/10"
              style={{ backgroundColor: theme.swatch }}
            />
            {label}
          </button>
        );
      })}
    </div>
  );
}
