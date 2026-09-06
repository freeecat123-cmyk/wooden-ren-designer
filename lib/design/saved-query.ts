export function savedDesignQuery(id: string, params: Record<string, unknown>, revision?: string): URLSearchParams {
  const query = new URLSearchParams({ designId: id });
  const reserved = new Set(["options", "designId", "loadSaved", "revision", "style", "styleVariant", "scene", "ui"]);
  for (const [key, value] of Object.entries(params)) {
    if (!reserved.has(key) && ["string", "number", "boolean"].includes(typeof value)) query.set(key, String(value));
  }
  if (params.options && typeof params.options === "object" && !Array.isArray(params.options)) {
    for (const [key, value] of Object.entries(params.options)) {
      if (!reserved.has(key) && ["string", "number", "boolean"].includes(typeof value)) query.set(key, String(value));
    }
  }
  if (revision) query.set("revision", revision);
  return query;
}

export function designFingerprint(params: Record<string, unknown>): string {
  const normalize = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(normalize);
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, v]) => [key, normalize(v)]));
    return value;
  };
  return JSON.stringify(normalize(params));
}
