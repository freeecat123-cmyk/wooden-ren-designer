import { checkShelfDeflection } from "@/lib/design/deflection";
import type { Part } from "@/lib/types";

/**
 * 層板撓度提示。
 *
 * 不阻擋設計，只在設計參數警告區下方標出「跨距太長 + 板太薄會下垂」的
 * 層板，附帶加厚 / 加橫撐的結構安全建議。Server-rendered（純函數計算）。
 */
export function DeflectionHints({ parts }: { parts: Part[] }) {
  const warnings = checkShelfDeflection(parts);
  if (warnings.length === 0) return null;

  return (
    <div className="mb-4 space-y-1.5">
      {warnings.map((w, i) => {
        const isError = w.level === "ERROR";
        return (
          <div
            key={i}
            className={`text-xs leading-relaxed px-3 py-2 rounded border flex items-start gap-2 ${
              isError
                ? "bg-rose-50 border-rose-300 text-rose-800"
                : "bg-amber-50 border-amber-300 text-amber-800"
            }`}
          >
            <span aria-hidden className="mt-0.5">
              {isError ? "⚠️" : "💡"}
            </span>
            <span>
              <span className="font-medium">{w.message}</span>
              <span className="block mt-0.5 text-zinc-600">→ {w.suggest}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}
