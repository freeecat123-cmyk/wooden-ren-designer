import type { FurnitureDesign } from "@/lib/types";
import { collectThicknessHints } from "@/lib/design/standards";
import { checkShelfDeflection } from "@/lib/design/deflection";
import { checkGrainDirection } from "@/lib/design/grain";

/**
 * 設計合理性檢查面板：
 *  - 撓度（書架層板會下垂）
 *  - 木紋方向（椅腳橫紋會折斷）
 *  - 市售規格對齊（板厚 16 → 市售 18 刨 2 hint）
 *
 * 全是 server-rendered 純函數計算。設計刷新時跟著重算。
 */
export function DesignChecks({ design }: { design: FurnitureDesign }) {
  const deflectionWarnings = checkShelfDeflection(design.parts);
  const grainWarnings = checkGrainDirection(design.parts);
  const thicknessHints = collectThicknessHints(design.parts);

  const hasAny =
    deflectionWarnings.length > 0 ||
    grainWarnings.length > 0 ||
    thicknessHints.length > 0;
  if (!hasAny) return null;

  return (
    <details className="mb-4 rounded-lg border border-zinc-200 bg-white px-4 py-3">
      <summary className="cursor-pointer text-sm font-semibold text-zinc-800 flex items-center gap-2">
        <span className="w-0.5 h-4 bg-amber-500 rounded-full" />
        設計合理性檢查
        <span className="text-[10px] font-normal text-zinc-400 ml-1">
          結構/木紋/市售對齊
        </span>
        {(deflectionWarnings.length + grainWarnings.length) > 0 && (
          <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-mono">
            {deflectionWarnings.length + grainWarnings.length} 條警告
          </span>
        )}
      </summary>

      <div className="mt-3 space-y-3">
        {/* 撓度警告 */}
        {deflectionWarnings.length > 0 && (
          <section>
            <h4 className="text-[11px] font-semibold text-zinc-700 mb-1.5">
              📐 撓度（會下垂）
            </h4>
            <ul className="space-y-1">
              {deflectionWarnings.map((w) => {
                const isError = w.level === "ERROR";
                return (
                  <li
                    key={w.partId}
                    className={`text-[11px] leading-relaxed px-2.5 py-1.5 rounded border ${
                      isError
                        ? "bg-rose-50 border-rose-200 text-rose-800"
                        : "bg-amber-50 border-amber-200 text-amber-800"
                    }`}
                  >
                    <span className="font-medium">{w.message}</span>
                    <span className="ml-1 text-zinc-600">— {w.suggest}</span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* 木紋方向 */}
        {grainWarnings.length > 0 && (
          <section>
            <h4 className="text-[11px] font-semibold text-zinc-700 mb-1.5">
              🪵 木紋方向
            </h4>
            <ul className="space-y-1">
              {grainWarnings.map((w) => (
                <li
                  key={w.partId}
                  className="text-[11px] leading-relaxed px-2.5 py-1.5 rounded border bg-rose-50 border-rose-200 text-rose-800"
                >
                  <span className="font-medium">{w.message}</span>
                  <span className="ml-1 text-zinc-600">— {w.suggest}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* 市售規格對齊 */}
        {thicknessHints.length > 0 && (
          <section>
            <h4 className="text-[11px] font-semibold text-zinc-700 mb-1.5">
              📏 市售厚度對齊（材料採購提示）
            </h4>
            <ul className="space-y-1">
              {thicknessHints.map((h, i) => (
                <li
                  key={i}
                  className="text-[11px] leading-relaxed px-2.5 py-1.5 rounded border bg-sky-50 border-sky-200 text-sky-900"
                >
                  <span className="font-medium">
                    設計 {h.designValue} mm（{h.count} 件）
                  </span>
                  <span className="ml-1 text-zinc-700">
                    → 市售最近 <span className="font-mono">{h.standard} mm</span>，
                    {h.delta > 0
                      ? `要刨薄 ${h.delta.toFixed(1)} mm`
                      : `差 ${Math.abs(h.delta).toFixed(1)} mm 要拼或選下一級`}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </details>
  );
}
