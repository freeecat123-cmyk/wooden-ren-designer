import { checkErgonomics, type ErgoInput } from "@/lib/design/ergonomics";

/**
 * 設計頁的人體工學合理性提示。
 *
 * 不阻擋設計，只在欄位下方顯示「太高/太低」hint。
 * Server-rendered（純函數計算），刷新後才更新——和 design preview 同步重生。
 */
export function ErgoHints({ category, overall, options }: ErgoInput) {
  const warnings = checkErgonomics({ category, overall, options });
  if (warnings.length === 0) return null;

  return (
    <div className="mt-2 mb-4 space-y-1">
      {warnings.map((w, i) => {
        const isError = w.level === "ERROR";
        return (
          <div
            key={i}
            className={`text-[11px] leading-relaxed px-2.5 py-1.5 rounded border flex items-start gap-1.5 ${
              isError
                ? "bg-rose-50 border-rose-200 text-rose-800"
                : "bg-amber-50 border-amber-200 text-amber-800"
            }`}
          >
            <span aria-hidden>{isError ? "⚠️" : "💡"}</span>
            <span>
              <span className="font-medium">{w.message}</span>
              <span className="ml-1 text-zinc-600">— {w.suggest}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}
