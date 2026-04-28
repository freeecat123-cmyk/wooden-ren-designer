"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { SCENE_THEME_LIST, type SceneThemeId } from "@/lib/design/scene-themes";

/**
 * 3D 場景環境主題切換器。
 *
 * 透過 URL 參數 `?scene=nordic` 控制（server-rendered design 重算+套用）。
 * 預設 natural（純白懸浮）；切到 nordic / japandi / industrial / chinese
 * 後會在 3D 加地板 + 調光，給客戶看「擺在家裡的樣子」。
 */
export function SceneThemeToggle({ current }: { current: SceneThemeId }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const onSelect = (id: SceneThemeId) => {
    const params = new URLSearchParams(searchParams.toString());
    if (id === "natural") {
      params.delete("scene");
    } else {
      params.set("scene", id);
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  return (
    <div className="flex items-center gap-1 px-3 py-1.5 border-b border-zinc-200 bg-zinc-50/50">
      <span className="text-[11px] text-zinc-600 mr-1.5">場景</span>
      {SCENE_THEME_LIST.map((t) => {
        const active = t.id === current;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onSelect(t.id)}
            title={t.nameZh}
            className={`flex items-center gap-1.5 px-2 py-1 rounded text-[11px] transition-colors ${
              active
                ? "bg-zinc-900 text-white"
                : "bg-white text-zinc-700 border border-zinc-200 hover:bg-zinc-100"
            }`}
          >
            <span
              className="inline-block w-3 h-3 rounded-sm border border-black/10"
              style={{ backgroundColor: t.swatch }}
            />
            {t.nameZh}
          </button>
        );
      })}
    </div>
  );
}
