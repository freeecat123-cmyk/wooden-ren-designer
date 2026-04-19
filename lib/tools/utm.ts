const UTM_SOURCE = "generator";
const UTM_MEDIUM = "tool_list";

export function buildShopUrl(shopUrl: string, designId: string): string {
  const sep = shopUrl.includes("?") ? "&" : "?";
  const params = new URLSearchParams({
    utm_source: UTM_SOURCE,
    utm_medium: UTM_MEDIUM,
    utm_campaign: designId,
  });
  return `${shopUrl}${sep}${params.toString()}`;
}
