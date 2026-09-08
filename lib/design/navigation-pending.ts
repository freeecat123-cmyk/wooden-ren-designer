export function designSearchKey(search: string) {
  const query = new URLSearchParams(search);
  query.sort();
  return query.toString();
}

export function announceDesignNavigation(href: string) {
  if (typeof window === "undefined") return;
  const target = new URL(href, window.location.href);
  window.dispatchEvent(new CustomEvent("wooden-ren:design-navigation", {
    detail: { search: designSearchKey(target.search) },
  }));
}
