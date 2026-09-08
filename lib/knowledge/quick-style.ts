import type { OptionSpec } from "@/lib/types";
import { STYLE_PRESETS } from "./style-presets";

/** Quick styling is an appearance edit, not a new structural configuration. */
export function quickStyleQuery(
  current: URLSearchParams,
  styleId: string,
  category: string | undefined,
  schema: OptionSpec[],
): URLSearchParams | null {
  const preset = STYLE_PRESETS[styleId];
  if (!preset || category === "workbench" || category === "cert-c1") return null;
  if (category && preset.applicableTo && !preset.applicableTo.includes(category)) return null;
  const appearance: Record<string, string> = {
    legShape: preset.legShape,
    legEdgeStyle: preset.edgeStyle,
    seatEdgeStyle: preset.edgeStyle,
    topEdgeStyle: preset.edgeStyle,
    stretcherEdgeStyle: preset.edgeStyle,
  };
  const next = new URLSearchParams(current);
  let supported = false;
  for (const spec of schema) {
    const value = appearance[spec.key];
    // Conditional geometry stays under the template's own configuration controls.
    if (value === undefined || spec.type !== "select" || spec.dependsOn) continue;
    if (!spec.choices.some(choice => choice.value === value && !choice.dependsOn)) continue;
    next.set(spec.key, value);
    supported = true;
  }
  if (!supported) return null;
  next.set("style", styleId);
  next.delete("styleVariant");
  return next;
}
