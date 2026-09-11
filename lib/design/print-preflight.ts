import { matchesSnapshotQuery } from "./model-snapshot";
import type { SpRecord } from "./parse-search-params";
import { savedDesignQuery } from "./saved-query";

export type PrintSavedState = "unsaved" | "matching" | "changed" | "unverified";
export function getPrintSavedState(category: string, sp: SpRecord,
  saved: { params: Record<string, unknown>; furniture_type: string; updated_at: string } | null,
  optionKeys: string[], defaults: Record<string, unknown>): PrintSavedState {
  if (!sp.designId) return "unsaved";
  if (!saved || saved.furniture_type.replace(/_/g, "-") !== category) return "unverified";
  if (sp.revision && sp.revision !== saved.updated_at) return "changed";
  // Parameter-only archives reopen with current defaults. Signed geometry must
  // keep the stricter snapshot comparison, including newly introduced options.
  const params = saved.params._modelSnapshot ? saved.params : {
    ...defaults,
    joineryMode: saved.params.beginnerMode === false,
    designerMode: false,
    constructionVersion: "1",
    ...Object.fromEntries(savedDesignQuery("", saved.params)),
  };
  return matchesSnapshotQuery(sp, params, optionKeys, defaults) ? "matching" : "changed";
}
