import type { FurnitureDesign } from "@/lib/types";
import {
  deriveBuildSteps,
  totalEstimatedHours,
  PHASE_LABEL,
  type StepPhase,
} from "@/lib/steps/derive";
import { TOOL_CATALOG } from "@/lib/tools/catalog";

const PHASE_COLOR: Record<StepPhase, string> = {
  prepare: "bg-zinc-100 text-zinc-700",
  mark: "bg-sky-100 text-sky-800",
  "cut-stock": "bg-amber-100 text-amber-800",
  "cut-joinery": "bg-orange-100 text-orange-800",
  fit: "bg-violet-100 text-violet-800",
  glue: "bg-emerald-100 text-emerald-800",
  sand: "bg-yellow-100 text-yellow-800",
  finish: "bg-rose-100 text-rose-800",
};

export function BuildSteps({ design }: { design: FurnitureDesign }) {
  const steps = deriveBuildSteps(design);
  const totalHours = totalEstimatedHours(steps);

  return (
    <div className="space-y-3">
      <p className="text-sm text-zinc-600">
        共 {steps.length} 個步驟，預估工時約 <strong>{totalHours} 小時</strong>
        （依個人熟練度可能差 ±50%）。
      </p>
      <ol className="space-y-3">
        {steps.map((step, i) => (
          <li
            key={step.id}
            className="rounded-lg border border-zinc-200 bg-white p-4"
          >
            <div className="flex items-baseline gap-3 mb-2 flex-wrap">
              <span className="text-xs font-mono text-zinc-400 tabular-nums">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${PHASE_COLOR[step.phase]}`}
              >
                {PHASE_LABEL[step.phase]}
              </span>
              <h3 className="font-semibold text-zinc-900">{step.title}</h3>
              {step.estimatedMinutes && (
                <span className="text-xs text-zinc-500 ml-auto">
                  約 {step.estimatedMinutes} 分鐘
                </span>
              )}
            </div>

            <p className="text-sm text-zinc-700 leading-relaxed">
              {step.description}
            </p>

            {step.toolIds.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                <span className="text-xs text-zinc-500">工具：</span>
                {step.toolIds.map((id) => {
                  const t = TOOL_CATALOG[id];
                  if (!t) return null;
                  return (
                    <span
                      key={id}
                      className="text-xs px-2 py-0.5 rounded bg-zinc-100 text-zinc-700"
                    >
                      {t.nameZh}
                    </span>
                  );
                })}
              </div>
            )}

            {step.bullets && step.bullets.length > 0 && (
              <ul className="mt-3 space-y-1.5 text-sm text-zinc-700">
                {step.bullets.map((b, j) => (
                  <li key={j} className="flex gap-2 leading-relaxed">
                    <span className="text-amber-600 shrink-0">·</span>
                    <span dangerouslySetInnerHTML={{ __html: b.replace(/\*\*([^*]+)\*\*/g, '<strong class="text-zinc-900">$1</strong>') }} />
                  </li>
                ))}
              </ul>
            )}

            {step.warnings && step.warnings.length > 0 && (
              <ul className="mt-3 space-y-1">
                {step.warnings.map((w, j) => (
                  <li
                    key={j}
                    className="text-xs text-amber-800 bg-amber-50 border-l-2 border-amber-400 px-3 py-1.5 rounded-r"
                  >
                    ⚠️ {w}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ol>
      <p className="text-xs text-zinc-500">
        以上為依設計自動產出的標準工序。下一版將提供「AI 加強說明 / YT 腳本」按鈕，由 Claude 補上經驗談與拍攝重點。
      </p>
    </div>
  );
}
