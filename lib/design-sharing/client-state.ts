const VIEW_KEYS = ["scene", "xray", "wf", "audit", "explode", "ui", "lidLift", "designId", "revision", "loadSaved"];
export function geometrySearch(search: string) {
  const query = new URLSearchParams(search);
  for (const key of VIEW_KEYS) query.delete(key);
  query.sort();
  return query.toString();
}
export interface SavedShareEvent { id: string; revision?: string; fingerprint: string; search?: string }
export function savedEventMatches(event: SavedShareEvent, currentSearch: string, pending: Record<string, string>) {
  if (!event?.id || !event.revision || !event.fingerprint || typeof event.search !== "string") return false;
  if (geometrySearch(event.search) !== geometrySearch(currentSearch)) return false;
  const saved = new URLSearchParams(event.search);
  return Object.entries(pending).every(([key, value]) => saved.get(key) === value);
}
