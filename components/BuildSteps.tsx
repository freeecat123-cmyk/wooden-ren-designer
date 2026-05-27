import type { FurnitureDesign } from "@/lib/types";
import {
  deriveBuildSteps,
  totalEstimatedHours,
  phaseLabel,
  type StepPhase,
} from "@/lib/steps/derive";
import { TOOL_CATALOG, toolName } from "@/lib/tools/catalog";

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

interface BuildStepsProps {
  design: FurnitureDesign;
  /** "zh-TW" (default) or "en". Server passes from params; MobileShell uses useLocale(). */
  locale?: string;
}

export function BuildSteps({ design, locale = "zh-TW" }: BuildStepsProps) {
  const steps = deriveBuildSteps(design);
  const totalHours = totalEstimatedHours(steps);
  const saw = design.sawSettings;
  const isEn = locale === "en";

  return (
    <div className="space-y-3">
      <p className="text-sm text-zinc-600">
        {isEn ? (
          <>
            {steps.length} steps total, estimated <strong>{totalHours} hours</strong> of work
            (±50% depending on skill level).
          </>
        ) : (
          <>
            共 {steps.length} 個步驟，預估工時約 <strong>{totalHours} 小時</strong>
            （依個人熟練度可能差 ±50%）。
          </>
        )}
      </p>
      {saw && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">
          <div className="font-semibold text-amber-900 mb-1.5">
            {isEn
              ? `🪚 Compound miter setup (wall tilt ${saw.tiltDeg}°)`
              : `🪚 鋸床複斜角度（壁外撇 ${saw.tiltDeg}°）`}
          </div>
          <div className="text-amber-800 space-y-1">
            <div>
              {isEn ? "Miter (horizontal): " : "鋸盤水平轉角（Miter）："}
              <strong className="font-mono">{saw.miterDeg}°</strong>
            </div>
            <div>
              {isEn ? "Bevel (blade tilt): " : "鋸片垂直傾角（Bevel）："}
              <strong className="font-mono">{saw.bevelDeg}°</strong>
            </div>
            <div className="text-xs text-amber-700 mt-2">
              {isEn
                ? `Cut both ends of each of the ${saw.sides} walls with these settings so corners close up tight. Lay the board flat, miter ${saw.miterDeg}°, blade tilt ${saw.bevelDeg}°. Hopper formula (§AT1.1): M = arctan(cos θ · tan(180°/${saw.sides})), B = arcsin(sin θ · cos(180°/${saw.sides})).`
                : `4 片牆兩端依此設定切複斜角度，組裝才會 4 角密合。木板平放鋸台、鋸盤轉 ${saw.miterDeg}°、鋸片傾 ${saw.bevelDeg}°，兩端一起鋸。公式 §AT1.1（Hopper）：M = arctan(cos θ · tan(180°/${saw.sides}))、B = arcsin(sin θ · cos(180°/${saw.sides}))。`}
            </div>
          </div>
        </div>
      )}
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
                {phaseLabel(step.phase, locale)}
              </span>
              <h3 className="font-semibold text-zinc-900">{step.title}</h3>
              {step.estimatedMinutes && (
                <span className="text-xs text-zinc-500 ml-auto">
                  {isEn ? `~${step.estimatedMinutes} min` : `約 ${step.estimatedMinutes} 分鐘`}
                </span>
              )}
            </div>

            <p className="text-sm text-zinc-700 leading-relaxed">
              {step.description}
            </p>

            {step.toolIds.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                <span className="text-xs text-zinc-500">{isEn ? "Tools:" : "工具："}</span>
                {step.toolIds.map((id) => {
                  const t = TOOL_CATALOG[id];
                  if (!t) return null;
                  return (
                    <span
                      key={id}
                      className="text-xs px-2 py-0.5 rounded bg-zinc-100 text-zinc-700"
                    >
                      {toolName(t, locale)}
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
        {isEn
          ? "Above is the auto-generated standard build sequence. A future version will offer “AI deep-dive / YT script” buttons where Claude adds practitioner tips and filming notes."
          : "以上為依設計自動產出的標準工序。下一版將提供「AI 加強說明 / YT 腳本」按鈕，由 Claude 補上經驗談與拍攝重點。"}
      </p>
    </div>
  );
}
