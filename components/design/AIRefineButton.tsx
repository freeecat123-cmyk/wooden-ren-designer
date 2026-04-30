"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { OptionSpec, FurnitureCategory } from "@/lib/types";

interface SuggestResponse {
  suggestions: Record<string, string | number | boolean>;
  rationale: string;
  warnings?: string[];
}

/**
 * 「🤖 AI 微調」按鈕。
 *
 * 流程：
 * 1. 收當前 design 狀態（風格 / 模板 / 尺寸 / 材質 / 既有參數）+ 使用者意圖
 * 2. POST 到 /api/style-suggest
 * 3. 顯示對話框：suggestions diff + rationale + warnings
 * 4. user 點「套用」→ 寫進 URL
 *
 * 跟 StylePresetButtons（靜態 detail pack）的差別：
 * - StylePreset 一鍵套標準包，快、無 cost
 * - AIRefine 看當前情境（粗/細/大/小、客製需求）給智能建議，慢、要 API key
 */
export function AIRefineButton({
  optionSchema,
  category,
  designSize,
}: {
  optionSchema: OptionSpec[];
  category: FurnitureCategory;
  designSize: { length: number; width: number; height: number };
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [intent, setIntent] = useState("");
  const [result, setResult] = useState<SuggestResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [available, setAvailable] = useState<boolean | null>(null);

  const styleId = sp?.get("style");
  const material = sp?.get("material") ?? undefined;
  const keys = new Set(optionSchema.map((s) => s.key));

  // 掛載時打 GET 健康檢查——後端有 ANTHROPIC_API_KEY 才 render 按鈕
  useEffect(() => {
    fetch("/api/style-suggest")
      .then((r) => r.json())
      .then((d) => setAvailable(!!d.available))
      .catch(() => setAvailable(false));
  }, []);

  // 沒套風格時不顯示——AI 微調是基於「當前風格」的優化
  if (!styleId) return null;
  // 後端沒設 key 不顯示——避免使用者點到才看錯誤訊息
  if (available === false) return null;
  if (available === null) return null; // 未確認前不閃

  const askAI = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      // 收當前 URL 內 user 改過的所有參數（只收 optionSchema 的 key）
      const currentParams: Record<string, string> = {};
      keys.forEach((k) => {
        const v = sp?.get(k);
        if (v !== null && v !== undefined) currentParams[k] = v;
      });

      const res = await fetch("/api/style-suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          styleId,
          category,
          currentParams,
          designSize,
          material,
          userIntent: intent.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "AI 服務錯誤");
        return;
      }
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "網路錯誤");
    } finally {
      setLoading(false);
    }
  };

  const apply = () => {
    if (!result) return;
    const next = new URLSearchParams(sp?.toString() ?? "");
    Object.entries(result.suggestions).forEach(([k, v]) => {
      // 只寫當前模板有的 key
      if (keys.has(k) || k === "material") {
        next.set(k, String(v));
      }
    });
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    setOpen(false);
    setResult(null);
    setIntent("");
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="px-3 py-1.5 rounded-md text-xs font-medium bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white hover:from-violet-600 hover:to-fuchsia-600 transition shadow-sm"
        title="AI 看當前設計給情境化的微調建議（會用到 LLM API）"
      >
        🤖 AI 微調
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
          // 攔截 textarea / button 的 change 事件冒泡——避免被外層
          // DesignFormShell 的 onChange 抓到觸發 router.replace（會讓
          // modal 整個 unmount）
          onChange={(e) => e.stopPropagation()}
          onInput={(e) => e.stopPropagation()}
        >
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b">
              <h3 className="text-sm font-semibold text-zinc-800 flex items-center gap-1.5">
                🤖 AI 微調當前 {styleId} 配置
              </h3>
              <p className="text-xs text-zinc-500 mt-1">
                AI 會看當前風格 + 尺寸 + 材質 + 你的需求給情境化建議。
              </p>
            </div>

            <div className="p-4 space-y-3">
              {!result && !loading && !error && (
                <>
                  <label className="block">
                    <span className="text-xs text-zinc-700 font-medium">
                      你的需求 (選填)
                    </span>
                    <textarea
                      value={intent}
                      onChange={(e) => setIntent(e.target.value)}
                      placeholder="例：腳要粗一點 / 給小孩用 / 預算有限想用便宜木材 / 客戶要中式現代風"
                      className="mt-1 w-full text-xs border border-zinc-300 rounded p-2 h-20 resize-none focus:ring-2 focus:ring-violet-300"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={askAI}
                    className="w-full py-2 rounded-md text-xs font-medium bg-violet-600 text-white hover:bg-violet-700 transition"
                  >
                    🤖 給我建議
                  </button>
                </>
              )}

              {loading && (
                <div className="text-center py-6 text-xs text-zinc-500">
                  ⏳ AI 思考中…通常 3-8 秒
                </div>
              )}

              {error && (
                <div className="text-xs text-rose-700 bg-rose-50 ring-1 ring-rose-200 rounded p-2">
                  ❌ {error}
                </div>
              )}

              {result && (
                <>
                  <div>
                    <div className="text-xs font-medium text-zinc-700 mb-1">
                      💡 AI 理由
                    </div>
                    <p className="text-xs text-zinc-600 leading-relaxed bg-violet-50 ring-1 ring-violet-200 rounded p-2">
                      {result.rationale}
                    </p>
                  </div>

                  <div>
                    <div className="text-xs font-medium text-zinc-700 mb-1">
                      🔧 建議調整 ({Object.keys(result.suggestions).length} 個欄位)
                    </div>
                    <div className="text-xs space-y-1 bg-zinc-50 ring-1 ring-zinc-200 rounded p-2 font-mono">
                      {Object.entries(result.suggestions).map(([k, v]) => {
                        const old = sp?.get(k);
                        return (
                          <div key={k} className="flex items-baseline gap-2">
                            <span className="text-zinc-500">{k}:</span>
                            {old !== null && old !== undefined ? (
                              <span className="text-zinc-400 line-through">{old}</span>
                            ) : null}
                            <span className="text-emerald-700 font-medium">→ {String(v)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {result.warnings && result.warnings.length > 0 && (
                    <div>
                      <div className="text-xs font-medium text-amber-800 mb-1">
                        ⚠️ 警告
                      </div>
                      <ul className="text-xs text-amber-900 bg-amber-50 ring-1 ring-amber-200 rounded p-2 space-y-0.5 list-disc list-inside">
                        {result.warnings.map((w, i) => (
                          <li key={i}>{w}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={apply}
                      className="flex-1 py-2 rounded-md text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition"
                    >
                      ✓ 套用 AI 建議
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setResult(null);
                        setIntent("");
                      }}
                      className="px-3 py-2 rounded-md text-xs font-medium bg-zinc-200 text-zinc-700 hover:bg-zinc-300 transition"
                    >
                      重新問
                    </button>
                  </div>
                </>
              )}

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="w-full py-1.5 text-xs text-zinc-500 hover:text-zinc-700"
              >
                關閉
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
