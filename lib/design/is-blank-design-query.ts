const VIEW_ONLY_KEYS = new Set([
  "material", "scene", "ui", "xray", "wf", "audit", "hide", "explode", "lidLift", "style", "styleVariant",
]);

/** A10.15: unknown keys and saved references conservatively retain legacy construction. */
export function isBlankDesignQuery(keys: Iterable<string>): boolean {
  for (const key of keys) if (!VIEW_ONLY_KEYS.has(key)) return false;
  return true;
}
